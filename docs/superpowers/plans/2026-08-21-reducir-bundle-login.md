# Reducir bundle de entrada para el login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sacar `dataStore.ts` (y todo lo que arrastra) del bundle de entrada, para que la pantalla de login aparezca sin esperar a descargar/parsear ~889 KB de código que solo hace falta tras iniciar sesión.

**Architecture:** Se extrae todo lo que hoy cuelga de `<ProtectedRoute><MainLayout/></ProtectedRoute>` en `App.tsx` a un componente nuevo `src/AuthenticatedApp.tsx`, cargado con `React.lazy`. Un guard nuevo en `App.tsx` (`AuthenticatedGate`) comprueba `isAuthenticated` **antes** de renderizar ese componente perezoso, para que un visitante no autenticado que aterrice en `/` (el caso más común) nunca dispare la descarga del bundle autenticado. En paralelo, los 4 imports estáticos de `authStore.ts` que arrastran `dataStore.ts` (directa o transitivamente vía `dataLoader.ts`/`realtimeSync.ts`) pasan a `import()` dinámico, resuelto donde ya se usan.

**Tech Stack:** React 19 + TypeScript + Vite 7, React Router v6, Zustand.

---

## Task 1: Extraer `AuthenticatedApp.tsx` de `App.tsx`

**Files:**
- Create: `src/AuthenticatedApp.tsx`
- Modify: `src/App.tsx`

### Step 1: Crear `src/AuthenticatedApp.tsx` con todo lo que se extrae de `App.tsx`

Crear el archivo con este contenido exacto:

```tsx
import { lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore, hasPermission } from '@/stores/authStore'
import { useEffectiveStudent } from '@/hooks/usePlayerData'
import type { UserRole } from '@/types'
import { MainLayout } from '@/components/layout/MainLayout'

const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const PlayersPage = lazy(() => import('@/pages/PlayersPage'))
const PlayerProfilePage = lazy(() => import('@/pages/PlayerProfilePage'))
const GroupsPage = lazy(() => import('@/pages/GroupsPage'))
const GroupDetailPage = lazy(() => import('@/pages/GroupDetailPage'))
const AttendancePage = lazy(() => import('@/pages/AttendancePage'))
const PaymentsPage = lazy(() => import('@/pages/PaymentsPage'))
const PlayerPaymentsPage = lazy(() => import('@/pages/PlayerPaymentsPage'))
const PlayerGroupsPage = lazy(() => import('@/pages/PlayerGroupsPage'))
const CoachesPage = lazy(() => import('@/pages/CoachesPage'))
const AgendaPage = lazy(() => import('@/pages/AgendaPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const PlanningPage = lazy(() => import('@/pages/PlanningPage'))
const MethodologyPage = lazy(() => import('@/pages/MethodologyPage'))
const UsersPage = lazy(() => import('@/pages/UsersPage'))
const EventsActivitiesPage = lazy(() => import('@/pages/EventsActivitiesPage'))
const EventDetailPage = lazy(() => import('@/pages/EventDetailPage'))
const PrivateLessonDetailPage = lazy(() => import('@/pages/PrivateLessonDetailPage'))
const ClassDetailPage = lazy(() => import('@/pages/ClassDetailPage'))
const CoachProfilePage = lazy(() => import('@/pages/CoachProfilePage'))
const EvaluacionesPage = lazy(() => import('@/pages/EvaluacionesPage'))
const ActivityLogPage = lazy(() => import('@/pages/ActivityLogPage'))
const InvoicesPage = lazy(() => import('@/pages/InvoicesPage'))
const ReportsPage = lazy(() => import('@/pages/ReportsPage'))
const FinancialsPage = lazy(() => import('@/pages/FinancialsPage'))
const PlayerDashboard = lazy(() => import('@/pages/PlayerDashboard'))
const CoachDashboard = lazy(() => import('@/pages/CoachDashboard'))
const FreeSlotsPage = lazy(() => import('@/pages/FreeSlotsPage'))
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'))
const SeasonsPage = lazy(() => import('@/pages/SeasonsPage'))

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Cargando...</p>
    </div>
  </div>
)

function RoleRoute({
  children,
  module,
  action = 'read',
}: {
  children: React.ReactNode
  module: string
  action?: string
}) {
  const { user } = useAuthStore()
  const effectiveRole = (user?.activeRole ?? user?.role) as UserRole | undefined
  if (effectiveRole && !hasPermission(effectiveRole, module, action)) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore()
  if (isLoading) {
    return <PageLoader />
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PaymentsRouter() {
  const { user } = useAuthStore()
  const activeRole = user?.activeRole ?? user?.role
  if (activeRole === 'jugador' || activeRole === 'tutor') {
    return <PlayerPaymentsPage />
  }
  return <PaymentsPage />
}

function GroupsRouter() {
  const { user } = useAuthStore()
  const activeRole = user?.activeRole ?? user?.role
  if (activeRole === 'jugador' || activeRole === 'tutor') {
    return <PlayerGroupsPage />
  }
  return <GroupsPage />
}

function PlayersRouter() {
  const { user } = useAuthStore()
  const { studentId } = useEffectiveStudent()
  const activeRole = user?.activeRole ?? user?.role
  if (activeRole === 'jugador' || activeRole === 'tutor') {
    if (studentId) {
      return <Navigate to={`/jugadores/${studentId}`} replace />
    }
    return <Navigate to="/" replace />
  }
  return <PlayersPage />
}

export default function AuthenticatedApp() {
  const { user } = useAuthStore()

  return (
    <Routes>
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route
          path="/"
          element={(() => {
            const activeRole = user?.activeRole ?? user?.role
            if (activeRole === 'jugador' || activeRole === 'tutor') return <PlayerDashboard />
            if (activeRole === 'entrenador') return <CoachDashboard />
            return <DashboardPage />
          })()}
        />
        <Route path="/jugadores" element={<PlayersRouter />} />
        <Route path="/jugadores/:id" element={<PlayerProfilePage />} />
        <Route path="/grupos" element={<GroupsRouter />} />
        <Route path="/grupos/:id" element={<GroupDetailPage />} />
        <Route path="/asistencia" element={<AttendancePage />} />
        <Route path="/huecos" element={<FreeSlotsPage />} />
        <Route path="/agenda" element={<AgendaPage />} />
        <Route path="/eventos" element={<EventsActivitiesPage />} />
        <Route path="/eventos/:id" element={<EventDetailPage />} />
        <Route path="/clases-particulares/:id" element={<PrivateLessonDetailPage />} />
        <Route path="/clases/:groupId/:date" element={<ClassDetailPage />} />
        <Route path="/pagos" element={<RoleRoute module="payments"><PaymentsRouter /></RoleRoute>} />
        <Route path="/facturas" element={<RoleRoute module="payments"><InvoicesPage /></RoleRoute>} />
        <Route path="/entrenadores" element={<RoleRoute module="coaches"><CoachesPage /></RoleRoute>} />
        {/* Sin RoleRoute: los entrenadores pueden ver su propio perfil */}
        <Route path="/entrenadores/:id" element={<CoachProfilePage />} />
        <Route path="/informes" element={<RoleRoute module="settings"><EvaluacionesPage /></RoleRoute>} />
        <Route path="/informes-mensuales" element={<RoleRoute module="informes_mensuales"><ReportsPage /></RoleRoute>} />
        <Route path="/finanzas" element={<RoleRoute module="informes_mensuales"><FinancialsPage /></RoleRoute>} />
        <Route path="/usuarios" element={<RoleRoute module="users"><UsersPage /></RoleRoute>} />
        <Route path="/configuracion" element={<RoleRoute module="settings"><SettingsPage /></RoleRoute>} />
        <Route path="/actividad" element={<RoleRoute module="settings"><ActivityLogPage /></RoleRoute>} />
        <Route path="/temporadas" element={<RoleRoute module="settings"><SeasonsPage /></RoleRoute>} />
        <Route path="/planificacion" element={<RoleRoute module="settings"><PlanningPage /></RoleRoute>} />
        <Route path="/methodology" element={<RoleRoute module="settings"><MethodologyPage /></RoleRoute>} />
        <Route path="/analitica" element={<RoleRoute module="settings"><AnalyticsPage /></RoleRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
```

Este contenido es una copia literal de lo que hoy vive en `App.tsx` (comentario incluido), sin cambios de lógica — solo cambia de archivo.

### Step 2: Reescribir `src/App.tsx`

**Importante — un problema que hay que evitar**: si simplemente se sustituye el bloque de rutas protegidas por `<Route path="/*" element={<AuthenticatedApp />} />` sin más, un visitante que NO ha iniciado sesión y aterriza en la ruta raíz `/` (el caso más habitual para alguien que nunca ha entrado) dispararía igualmente la carga perezosa de `AuthenticatedApp` — exactamente el bundle pesado que se quiere evitar — porque `/` no coincide con `/login`, `/activar-cuenta` ni `/activar/:token`, y caería en el catch-all `/*`. Para evitarlo, se añade un guard `AuthenticatedGate` en el propio `App.tsx` que comprueba `isAuthenticated` **antes** de renderizar `<AuthenticatedApp />` — si no está autenticado, redirige a `/login` sin llegar a montar el componente perezoso, así que su `import()` nunca se dispara.

Reemplazar el contenido completo de `src/App.tsx` por:

```tsx
import { useEffect, lazy, Suspense } from 'react'
import { useNotificationSetup } from '@/hooks/useNotificationSetup'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Toaster } from '@/components/ui/toaster'

const LoginPage = lazy(() => import('@/pages/LoginPage'))
const ActivateAccountPage = lazy(() => import('@/pages/ActivateAccountPage'))
const ActivateInvitationPage = lazy(() => import('@/pages/ActivateInvitationPage'))
const AuthenticatedApp = lazy(() => import('@/AuthenticatedApp'))

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Cargando...</p>
    </div>
  </div>
)

// Comprueba si hay sesión ANTES de renderizar AuthenticatedApp — si no la hay,
// redirige a /login sin llegar a disparar el import() perezoso del bundle
// autenticado (MainLayout, dataStore.ts y todas las páginas internas).
function AuthenticatedGate() {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <AuthenticatedApp />
}

export default function App() {
  const { initAuth, isLoading } = useAuthStore()

  useEffect(() => {
    const unsubscribe = initAuth()
    return unsubscribe
  }, [initAuth])

  // Solicita permiso de notificaciones y registra el token FCM tras login
  useNotificationSetup()

  if (isLoading) {
    return <PageLoader />
  }

  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/activar-cuenta" element={<ActivateAccountPage />} />
          <Route path="/activar/:token" element={<ActivateInvitationPage />} />
          <Route path="/*" element={<AuthenticatedGate />} />
        </Routes>
      </Suspense>
      <Toaster />
    </>
  )
}
```

### Step 3: Verificar que compila

Run: `npm run build`
Expected: sin errores de TypeScript. En el resumen del build debería aparecer un chunk nuevo (p. ej. `AuthenticatedApp-*.js`) separado del chunk de entrada (`index-*.js`), y el chunk de entrada debería pesar sensiblemente menos que antes (compararlo con el peso actual: 889 KB / 274 KB gzip).

### Step 4: Verificación manual — navegación

Run `npm run dev` si no hay ya un servidor corriendo.

1. Abrir la app en una pestaña de incógnito (sin sesión) navegando directamente a `/` — confirmar que redirige a `/login` y que, mirando la pestaña Red/Network del navegador, NO se descarga ningún chunk de `AuthenticatedApp` ni de páginas internas antes de llegar a `/login`.
2. Iniciar sesión como `director` — confirmar que tras el login se ve el Dashboard, y que en ese momento sí se descarga el chunk de `AuthenticatedApp`.
3. Navegar a `/grupos`, `/jugadores`, `/pagos`, `/jugadores/:id` (con un id real) y confirmar que cada ruta sigue funcionando igual que antes.
4. Iniciar sesión como `jugador` o `tutor` — confirmar que `/` muestra `PlayerDashboard`, que `/jugadores` redirige automáticamente al perfil propio, y que `/grupos`/`/pagos` muestran las versiones de jugador (`PlayerGroupsPage`/`PlayerPaymentsPage`).
5. Iniciar sesión como `entrenador` — confirmar que `/` muestra `CoachDashboard`.
6. Cerrar sesión y confirmar que vuelve a `/login` correctamente.

### Step 5: Commit

```bash
git add src/AuthenticatedApp.tsx src/App.tsx
git commit -m "perf: extraer AuthenticatedApp a un chunk perezoso para acelerar el login"
```

---

## Task 2: Convertir a `import()` dinámico los 4 imports de `authStore.ts` que arrastran `dataStore.ts`

**Files:**
- Modify: `src/stores/authStore.ts`

### Step 1: Quitar los 4 imports estáticos de la cabecera

Eliminar estas líneas del bloque de imports al principio del archivo:
```ts
import { migrateLocalToFirestore } from '@/lib/dataLoader'
import { subscribeToAllData } from '@/lib/realtimeSync'
import { retryFailedSyncs } from '@/lib/firestoreSync'
import { useDataStore } from '@/stores/dataStore'
```

### Step 2: Convertir `clearDataStore` en `async` con import dinámico

Reemplazar:
```ts
function clearDataStore(): void {
  useDataStore.setState({
    courts: [],
    tariffs: [],
    players: [],
    coaches: [],
    groups: [],
    enrollments: [],
    privateLessons: [],
    invitations: [],
    events: [],
    coachSalaryConfigs: [],
    attendanceNotices: [],
    vouchers: [],
    attendance: [],
    payments: [],
    evaluations: [],
    matchReports: [],
    invoices: [],
    users: [],
  })
}
```
por:
```ts
async function clearDataStore(): Promise<void> {
  const { useDataStore } = await import('@/stores/dataStore')
  useDataStore.setState({
    courts: [],
    tariffs: [],
    players: [],
    coaches: [],
    groups: [],
    enrollments: [],
    privateLessons: [],
    invitations: [],
    events: [],
    coachSalaryConfigs: [],
    attendanceNotices: [],
    vouchers: [],
    attendance: [],
    payments: [],
    evaluations: [],
    matchReports: [],
    invoices: [],
    users: [],
  })
}
```

### Step 3: Actualizar los 4 sitios donde se llama a `clearDataStore()`

Hay 4 llamadas en el archivo. Localízalas por su contexto:

**a) Dentro de `login`, rama de usuario desactivado** (justo después de `if (!appUser.isActive) {`):
```ts
        clearDataStore()
        await signOut(auth)
```
pasa a:
```ts
        await clearDataStore()
        await signOut(auth)
```

**b) Dentro de `logout()`** (función NO async — aquí se deja sin `await`, ya que justo después hay una redirección de página completa que de todos modos recarga todo el estado):
```ts
    // 2. Limpiar datos del store para el siguiente usuario
    clearDataStore()
```
pasa a:
```ts
    // 2. Limpiar datos del store para el siguiente usuario
    void clearDataStore()
```

**c) Dentro de `initAuth`'s `onAuthStateChanged`, rama de usuario desactivado**:
```ts
          clearDataStore()
          await signOut(auth)
```
pasa a:
```ts
          await clearDataStore()
          await signOut(auth)
```

**d) Dentro de `initAuth`'s `onAuthStateChanged`, rama de sesión expirada/logout externo**:
```ts
        clearDataStore()
        set({ user: null, isAuthenticated: false, isLoading: false, isDataLoading: false })
```
pasa a:
```ts
        await clearDataStore()
        set({ user: null, isAuthenticated: false, isLoading: false, isDataLoading: false })
```

### Step 4: Envolver la cadena de sincronización de `loadUserProfile` en un `import()` dinámico combinado

Localizar este bloque (dentro de `loadUserProfile`, justo antes de `return appUser`):
```ts
  // Iniciar sincronización en tiempo real con Firestore
  if (appUser.clubId) {
    setDataLoading(true)
    // Cancelar listeners previos antes de crear nuevos (guard para doble disparo de onAuthStateChanged)
    if (_dataUnsubscribe) {
      _dataUnsubscribe()
      _dataUnsubscribe = null
    }
    migrateLocalToFirestore(appUser.clubId)
      .then(() => {
        // Reintentar syncs fallidos de sesiones anteriores
        return retryFailedSyncs()
      })
      .then((retriedCount) => {
        if (retriedCount > 0) {
          console.info(`[Auth] Retried ${retriedCount} failed syncs on login`)
        }
        // Iniciar listeners en tiempo real.
        // Se pasa `role` (el de BD), NO `activeRole`: es el rol que aplican las
        // security rules, y al no cambiar en toda la sesión, el RoleSwitcher no
        // deja suscripciones con un alcance obsoleto.
        _dataUnsubscribe = subscribeToAllData(appUser.clubId, appUser.role, () => {
          setDataLoading(false)
          // Solo tras la primera carga completa (incluida `seasons`), y solo
          // para roles que pueden escribir en clubs/groups/seasons — evita
          // que ensureActiveSeason vea `seasons` vacío y cree una temporada
          // duplicada, y evita permission-denied para roles no admin.
          if (appUser.role === 'director' || appUser.role === 'coordinador') {
            useDataStore.getState().ensureActiveSeason()
          }
        })
      })
      .catch((err) => {
        console.warn('[Firestore] Error en carga inicial:', err)
        setDataLoading(false)
      })
  }
```

Reemplazarlo por:
```ts
  // Iniciar sincronización en tiempo real con Firestore
  if (appUser.clubId) {
    setDataLoading(true)
    // Cancelar listeners previos antes de crear nuevos (guard para doble disparo de onAuthStateChanged)
    if (_dataUnsubscribe) {
      _dataUnsubscribe()
      _dataUnsubscribe = null
    }
    Promise.all([
      import('@/lib/dataLoader'),
      import('@/lib/realtimeSync'),
      import('@/lib/firestoreSync'),
    ])
      .then(([{ migrateLocalToFirestore }, { subscribeToAllData }, { retryFailedSyncs }]) => {
        return migrateLocalToFirestore(appUser.clubId)
          .then(() => {
            // Reintentar syncs fallidos de sesiones anteriores
            return retryFailedSyncs()
          })
          .then((retriedCount) => {
            if (retriedCount > 0) {
              console.info(`[Auth] Retried ${retriedCount} failed syncs on login`)
            }
            // Iniciar listeners en tiempo real.
            // Se pasa `role` (el de BD), NO `activeRole`: es el rol que aplican las
            // security rules, y al no cambiar en toda la sesión, el RoleSwitcher no
            // deja suscripciones con un alcance obsoleto.
            _dataUnsubscribe = subscribeToAllData(appUser.clubId, appUser.role, () => {
              setDataLoading(false)
              // Solo tras la primera carga completa (incluida `seasons`), y solo
              // para roles que pueden escribir en clubs/groups/seasons — evita
              // que ensureActiveSeason vea `seasons` vacío y cree una temporada
              // duplicada, y evita permission-denied para roles no admin.
              if (appUser.role === 'director' || appUser.role === 'coordinador') {
                import('@/stores/dataStore').then(({ useDataStore }) => {
                  useDataStore.getState().ensureActiveSeason()
                })
              }
            })
          })
      })
      .catch((err) => {
        console.warn('[Firestore] Error en carga inicial:', err)
        setDataLoading(false)
      })
  }
```

### Step 5: Verificar que compila

Run: `npm run build`
Expected: sin errores de TypeScript. `dataStore.ts` ya no debería aparecer en el chunk de entrada — debería aparecer como parte del chunk de `AuthenticatedApp` (o uno propio cargado junto a él).

### Step 6: Ejecutar el conjunto de tests

Run: `npm test`
Expected: todos los tests pasan (ningún test existente cubre estos archivos a este nivel, no se esperan roturas).

### Step 7: Verificación manual — login/logout/reintentos

Con el dev server corriendo:

1. Iniciar sesión normalmente — confirmar que el dashboard carga con datos (grupos, jugadores, etc. visibles), señal de que `subscribeToAllData` sigue arrancando correctamente tras el `import()` dinámico.
2. Cerrar sesión (`logout()`) e iniciar sesión con OTRO usuario en el mismo navegador — confirmar que no aparecen datos del usuario anterior (verifica que `clearDataStore`, ahora asíncrona, se sigue ejecutando a tiempo).
3. Si es fácil de provocar: dejar el navegador sin red un instante durante el login y confirmar que no se rompe nada (el `.catch` final sigue capturando errores de los imports dinámicos igual que antes capturaba errores de la cadena).
4. Como `director`/`coordinador`, confirmar que `ensureActiveSeason` se sigue disparando tras el primer login (comprobar en Firestore o en la consola que `club.activeSeasonId` sigue funcionando como antes).

### Step 8: Commit

```bash
git add src/stores/authStore.ts
git commit -m "perf: cargar dataStore.ts de forma dinamica en authStore.ts para reducir el bundle de entrada"
```

---

## Task 3: Verificación final del bundle y de la rama completa

**Files:** ninguno (tarea de verificación)

### Step 1: Comparar el tamaño del bundle de entrada

Run: `npm run build`

Anotar el tamaño de `dist/assets/index-*.js` (raw y gzip) y compararlo con el valor de partida (889.41 KB raw / 273.64 KB gzip). Confirmar que ha bajado sustancialmente y que `dataStore.ts`/`MainLayout`/las páginas internas ya no aparecen en ese chunk (se puede confirmar rápidamente buscando alguna cadena de texto característica de `dataStore.ts`, p. ej. `"ensureActiveSeason"`, dentro de `dist/assets/index-*.js` — no debería encontrarse ahí, sino en el chunk de `AuthenticatedApp`).

### Step 2: Build y tests completos

Run: `npm run build && npm --prefix functions run build && npm test`
Expected: los tres comandos terminan sin errores.

### Step 3: Smoke test final

Repetir brevemente los puntos 1-6 de la verificación manual de la Tarea 1 y los puntos 1-4 de la Tarea 2, ahora con ambos cambios ya aplicados juntos, para confirmar que no hay ninguna interacción inesperada entre ambos.

---

## Self-Review Notes

- **Cobertura del spec:** Sección "1. `src/AuthenticatedApp.tsx`" → Tarea 1. Sección "2. `src/stores/authStore.ts` — imports dinámicos" → Tarea 2. La verificación manual del spec (6 puntos) → repartida entre las Tareas 1, 2 y 3.
- **Hallazgo añadido durante la redacción del plan, no presente en el spec original:** el spec no anticipaba que un `<Route path="/*" element={<AuthenticatedApp/>}/>` ingenuo dispararía la carga del bundle pesado para un visitante no autenticado en la ruta raíz `/` — el caso más común. Se añadió `AuthenticatedGate` (Tarea 1, Step 2) para cerrar ese hueco; es una pieza necesaria para que el objetivo del spec ("la pantalla de login aparece más rápido") se cumpla de verdad en el caso de uso principal, no solo cuando se navega directamente a `/login`.
- **Consistencia de tipos:** `AuthenticatedApp` es `export default function AuthenticatedApp()` (Tarea 1) e importado como `const AuthenticatedApp = lazy(() => import('@/AuthenticatedApp'))` (mismo nombre, default export — consistente). `clearDataStore` cambia de `(): void` a `(): Promise<void>` en un único sitio (Tarea 2, Step 2) y los 4 call sites se actualizan a juego en el mismo paso.
- **Nada de placeholders** — cada paso de código tiene el bloque completo a escribir, sin abreviar ninguna de las 28 páginas ni ninguna de las 4 llamadas a `clearDataStore`.
