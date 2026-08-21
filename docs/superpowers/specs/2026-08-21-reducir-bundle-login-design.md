# Reducir el bundle de entrada para acelerar la pantalla de login — Diseño

**Fecha:** 2026-08-21
**Estado:** aprobado, pendiente de plan de implementación

## Contexto

Investigación de rendimiento (ver conversación) encontró que el bundle de entrada (`dist/assets/index-*.js`) pesa **889 KB / 274 KB comprimido**, y debe descargarse, parsearse y ejecutarse por completo antes de que aparezca ni siquiera el formulario de login — no hay ni spinner visible antes de eso.

La causa: aunque la app ya tiene code-splitting por página (`React.lazy` en `src/App.tsx` para las 31 páginas), `App.tsx` en sí mismo importa de forma **no perezosa** varias cosas que solo hacen falta después de iniciar sesión, y que arrastran consigo `src/stores/dataStore.ts` (2.487 líneas, toda la lógica de negocio de la app) por **tres vías independientes**:

1. `App.tsx` → `useAuthStore` (`src/stores/authStore.ts`) → `useDataStore` (import directo, línea 23) — y además `authStore.ts` importa `dataLoader.ts` y `realtimeSync.ts` de forma estática, y AMBOS también importan `dataStore.ts` de forma estática, así que en realidad son **4 imports** en `authStore.ts` (`migrateLocalToFirestore`, `subscribeToAllData`, `retryFailedSyncs`, `useDataStore`) los que arrastran `dataStore.ts` incluso antes de saber si el login va a tener éxito.
2. `App.tsx` → `MainLayout` (`src/components/layout/MainLayout.tsx`, línea 7, import estático) → `useDataStore` (línea 4, para `checkAndAutoGenerateReceipts`).
3. `App.tsx` → `useEffectiveStudent` (`src/hooks/usePlayerData.ts`, línea 5, import estático, usado dentro de `PlayersRouter`) → `useDataStore` (línea 3).

Arreglar solo una de las tres vías no reduce el bundle de forma perceptible, porque las otras dos siguen arrastrando lo mismo.

## Decisión (validada con el usuario)

Separar `App.tsx` en dos ramas, ambas ya usando el patrón de `React.lazy` que la app ya usa en todas partes:

1. **Rama pública** (login + activación de cuenta): se queda en `App.tsx`, sin cambios de fondo — sigue siendo ligera.
2. **Rama autenticada** (todo lo que hoy vive dentro de `<ProtectedRoute><MainLayout /></ProtectedRoute>`, más los componentes `RoleRoute`/`PaymentsRouter`/`GroupsRouter`/`PlayersRouter` y sus 28 páginas `lazy`): se extrae a un archivo nuevo, `src/AuthenticatedApp.tsx`, cargado también con `React.lazy` desde `App.tsx`. Así, nada de esa rama —ni `MainLayout`, ni `dataStore.ts`, ni las páginas— se descarga hasta que `isAuthenticated` es `true`.

Además, dentro de `authStore.ts` (que sí debe cargarse antes del login, porque gestiona la autenticación), los 4 imports estáticos identificados arriba pasan a `import()` dinámico, resuelto en el punto donde ya se usan — todos están dentro de funciones ya asíncronas o de una cadena de promesas fire-and-forget que arranca solo tras un login exitoso, así que el cambio es mecánico, no estructural.

**Fuera de alcance** (confirmado con el usuario): `firebase.ts` (Firestore/Functions/Messaging siguen inicializándose igual, eagerly), `vite.config.ts`/`manualChunks`, y las consultas sin límite a colecciones grandes de Firestore (`attendance`, `payments`, etc.) — ese es un problema distinto, de mayor riesgo, que se abordará en otra sesión de diseño aparte.

## Arquitectura

### 1. `src/AuthenticatedApp.tsx` (nuevo archivo)

Contiene, movido tal cual desde `App.tsx` (sin cambios de lógica, solo de ubicación):
- Los 28 `const XxxPage = lazy(() => import('@/pages/XxxPage'))` que NO son `LoginPage`, `ActivateAccountPage`, `ActivateInvitationPage` (esos se quedan en `App.tsx`).
- `PageLoader` (se necesita en ambos archivos — se duplica la constante, es una función de 6 líneas sin dependencias, no merece un archivo compartido para esto).
- `RoleRoute`, `ProtectedRoute`, `PaymentsRouter`, `GroupsRouter`, `PlayersRouter` (idénticos a como están hoy).
- Un componente `AuthenticatedApp` (export default) que renderiza su propio `<Routes>` con exactamente la misma estructura de rutas que hoy cuelga de `<Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>` en `App.tsx` (líneas 132-174), más el catch-all `<Route path="*" element={<Navigate to="/" replace />} />` (línea 175 de hoy).
- Necesita `user` de `useAuthStore()` para la lógica de la ruta `/` (elegir `PlayerDashboard`/`CoachDashboard`/`DashboardPage` según rol) — se lee dentro del propio componente `AuthenticatedApp`, igual que hoy se lee dentro de `App()`.

`App.tsx` lo monta así:
```tsx
const AuthenticatedApp = lazy(() => import('@/AuthenticatedApp'))
...
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route path="/activar-cuenta" element={<ActivateAccountPage />} />
  <Route path="/activar/:token" element={<ActivateInvitationPage />} />
  <Route path="/*" element={<AuthenticatedApp />} />
</Routes>
```
React Router v6 soporta un `<Routes>` anidado dentro de un elemento montado en una ruta `/*` — es el patrón estándar para dividir una app en sub-árboles de rutas cargados de forma perezosa; las rutas internas de `AuthenticatedApp` se declaran con las mismas rutas absolutas que ya tienen hoy y siguen resolviendo correctamente contra la URL completa.

`App.tsx` se queda con: `LoginPage`, `ActivateAccountPage`, `ActivateInvitationPage` (sin cambios), `AuthenticatedApp` (nuevo, lazy), `PageLoader`, `initAuth()`, `useNotificationSetup()`, y el `<Suspense>`/`<Toaster/>` que ya tenía. Dejan de estar en `App.tsx`: `RoleRoute`, `ProtectedRoute`, `PaymentsRouter`, `GroupsRouter`, `PlayersRouter`, el import de `useEffectiveStudent`, el import de `MainLayout`, y los 28 imports `lazy` de páginas autenticadas.

### 2. `src/stores/authStore.ts` — imports dinámicos

Los 4 imports estáticos en cabecera:
```ts
import { migrateLocalToFirestore } from '@/lib/dataLoader'
import { subscribeToAllData } from '@/lib/realtimeSync'
import { retryFailedSyncs } from '@/lib/firestoreSync'
import { useDataStore } from '@/stores/dataStore'
```
se eliminan de la cabecera. Cada punto de uso actual pasa a resolver su módulo con `import()` dinámico:

- **`clearDataStore()`** (línea 49): pasa a ser `async`, con `const { useDataStore } = await import('@/stores/dataStore')` como primera línea, y el resto de la función (el `useDataStore.setState({...})` con los 18 campos) sin cambios. Los 4 sitios donde se llama (`login`'s rama de usuario desactivado, `logout()`, y 2 sitios dentro del listener de `initAuth`) siguen llamándola igual — en `logout()` (que no es `async`) se llama sin `await` (fire-and-forget; el `window.location.href = '/login'` que viene justo después provoca una recarga completa de la página de todos modos, así que no hay ninguna condición de carrera observable). En los otros 3 sitios, que sí están dentro de funciones `async`, se añade `await`.
- **`migrateLocalToFirestore`, `subscribeToAllData`, `retryFailedSyncs`**: se usan solo dentro de la cadena fire-and-forget de `loadUserProfile` (la que arranca tras un login exitoso). Se resuelven con un único `import()` combinado al principio de esa cadena:
  ```ts
  const [{ migrateLocalToFirestore }, { subscribeToAllData }, { retryFailedSyncs }] = await Promise.all([
    import('@/lib/dataLoader'),
    import('@/lib/realtimeSync'),
    import('@/lib/firestoreSync'),
  ])
  ```
  seguido del resto de la cadena (`migrateLocalToFirestore(...).then(...)`) sin cambios.
- **`useDataStore.getState().ensureActiveSeason()`** (dentro del callback `onFirstLoad` pasado a `subscribeToAllData`): para este punto, `dataStore.ts` ya está garantizado cargado (porque `subscribeToAllData`, ya resuelto dinámicamente arriba, internamente hace `import`/usa `useDataStore` de forma estática dentro de `realtimeSync.ts` — module ya en caché del bundler). Se cambia a `const { useDataStore } = await import('@/stores/dataStore')` igualmente, por claridad y consistencia, aunque en la práctica el módulo ya esté cargado en ese punto.

Ningún otro archivo de `src/lib/` o `src/stores/` se toca — `dataLoader.ts`, `realtimeSync.ts`, `firestoreSync.ts`, `dataStore.ts` mantienen sus imports internos tal cual están (ellos SÍ pueden importarse entre sí de forma estática, porque para cuando se cargan ya ha habido un login).

## Verificación manual

1. `npm run build` — comparar el tamaño de `dist/assets/index-*.js` antes y después (debe bajar sustancialmente; `dataStore.ts` y su grafo de dependencias deben aparecer en un chunk aparte, cargado solo tras autenticarse).
2. Abrir la app sin sesión iniciada (pestaña de incógnito o `localStorage` limpio) y confirmar que el formulario de login aparece visiblemente más rápido.
3. Iniciar sesión con cada rol relevante (`director`, `coordinador`, `entrenador`, `jugador`, `tutor`) y navegar por varias rutas (`/`, `/grupos`, `/jugadores`, `/pagos`, `/jugadores/:id`) para confirmar que el enrutado sigue funcionando exactamente igual que antes — especial atención a `PlayersRouter` (redirección de jugador/tutor a su propio perfil) y a la ruta raíz `/` (selección de dashboard por rol).
4. Cerrar sesión (`logout()`) y confirmar que redirige a `/login` y que un login posterior con otro usuario no arrastra datos del anterior (verifica que `clearDataStore` sigue funcionando pese a ser ahora asíncrona).
5. Simular un fallo de red intermitente (o revisar el código) para confirmar que la cola de reintentos (`retryFailedSyncs`) sigue disparándose correctamente tras el import dinámico.
6. `npm test` — no se espera que ningún test existente se rompa (ninguno cubre `App.tsx`/`authStore.ts` a este nivel de detalle de bundling), pero deben seguir en verde.
