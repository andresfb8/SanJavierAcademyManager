# Dashboard de jugador en escritorio: eliminar contenido duplicado — Diseño

**Fecha:** 2026-07-31
**Estado:** aprobado, pendiente de plan de implementación

## Contexto

En la vista de escritorio de `PlayerDashboard.tsx` (`hidden lg:block`, [líneas 615-736](../../../src/pages/PlayerDashboard.tsx#L615)), cada dato del alumno aparece **dos veces**:

1. Una fila "Quick Actions" ([líneas 636-655](../../../src/pages/PlayerDashboard.tsx#L636)) — pensada originalmente para móvil y reutilizada tal cual en escritorio — con 5 tarjetas (Mi Próxima Clase, Mis Pagos, Mi Asistencia, Mi Perfil, Mis Ausencias) en una rejilla de 4 columnas. Como son 5 elementos, el quinto ("Mis Ausencias") cae a una fila nueva ocupando 1 de 4 columnas, dejando 3 huecos vacíos — el hueco visible en la captura que reportó el usuario.
2. Debajo, un grid de 3 columnas con tarjetas de escritorio más ricas (`EstadoPagosCard`, `AsistenciaMensualChart`, un botón de ausencias, `renderNextClassWidget`) que **repiten los mismos datos**.

Además, la fila superior y la tarjeta de abajo pueden mostrar **números distintos para el mismo dato** (ej. "0% este mes" en la quick action vs "Sin datos de asistencia" en `AsistenciaMensualChart`), porque calculan el porcentaje de forma ligeramente distinta.

**Decisión (validada con el usuario):** una sola tarjeta por dato en escritorio. Se elimina la fila de accesos rápidos de escritorio; las tarjetas ricas ya existentes son la única fuente. Esto resuelve tanto la duplicación como la inconsistencia de datos (al quedar un único cálculo por dato, no puede haber dos números distintos).

## Decisiones de diseño (validadas con el usuario, incluida validación visual)

1. **Se elimina solo la sección "Quick Actions Desktop"** ([líneas 635-655](../../../src/pages/PlayerDashboard.tsx#L635)). El array `quickActions` ([líneas 188-240](../../../src/pages/PlayerDashboard.tsx#L188)) no se toca — sigue usándose sin cambios en la vista móvil, que no tiene el problema (ahí la fila de accesos rápidos es la única representación de estos datos).

2. **Hueco a cubrir: "Mi Perfil" no tenía tarjeta de escritorio equivalente.** Se resuelve con un **avatar clicable en el saludo de escritorio** ([líneas 617-625](../../../src/pages/PlayerDashboard.tsx#L617)): un círculo con gradiente por rol e inicial del nombre, replicando el patrón visual ya usado en `Sidebar.tsx` (`ROLE_COLORS` + `user.displayName.charAt(0)`, [Sidebar.tsx:216,258-262](../../../src/components/layout/Sidebar.tsx#L216)). Al pulsarlo, navega a `/jugadores/{studentId}` — la misma ruta que usaba la quick action "Mi Perfil" ([línea 230](../../../src/pages/PlayerDashboard.tsx#L230)).

3. **`AsistenciaMensualChart` gana un `onClick` opcional** que navega a `/asistencia` (la vista de historial de solo lectura ya implementada, `MyAttendanceView`). Esto cierra el mismo círculo que cubría la quick action "Mi Asistencia" eliminada. Sigue el mismo patrón que ya usa `EstadoPagosCard` en el mismo archivo: `className={cn('border cursor-pointer transition-all hover:shadow-md', ...)}` + `onClick={onClick}` en el `Card` raíz ([PlayerDashboardCards.tsx:188-191](../../../src/components/player/PlayerDashboardCards.tsx#L188)).

4. **El resto del grid de 3 columnas no cambia.** Sigue siendo:
   - Izquierda: `renderNextClassWidget()`, `MisGruposCard`, botón "Programar ausencia", `EstadoPagosCard`.
   - Centro: `UltimasEvaluacionesCard`, `AsistenciaMensualChart` (con el `onClick` nuevo).
   - Derecha: `ProximosEventosCard`, `VouchersDesktopCard`, tarjeta de Recuperaciones.

## Arquitectura

### 1. Avatar clicable en el saludo (`PlayerDashboard.tsx`)

En el bloque del saludo de escritorio ([líneas 617-625](../../../src/pages/PlayerDashboard.tsx#L617)), añadir el avatar como un `<button>` (no un `<div>` con `onClick`, para mantener foco de teclado y semántica correcta) junto al saludo, dentro del mismo contenedor `flex`. El botón incluye:
- Un círculo `h-10 w-10 rounded-full bg-gradient-to-br` con el gradiente de `ROLE_COLORS[activeRole]` (mismo mapa que `Sidebar.tsx`, se importa o se replica localmente — ver nota de reutilización abajo) y la inicial de `user?.displayName`.
- `onClick={() => { if (studentId) navigate(`/jugadores/${studentId}`) }}` (mismo guard que ya usa la quick action "Mi Perfil" hoy).

**Nota de reutilización:** `ROLE_COLORS` está definido de forma local (no exportado) en `Sidebar.tsx`. Como solo hace falta el color de un rol (`jugador`/`tutor`), no merece la pena exportarlo para un único consumo — se puede replicar la entrada relevante (`jugador: 'from-blue-500 to-blue-600'`, `tutor: 'from-blue-500 to-blue-600'` según el mapa existente) directamente en `PlayerDashboard.tsx`, ya que este componente ya distingue `isTutor` internamente.

### 2. `AsistenciaMensualChart` acepta `onClick` (`PlayerDashboardCards.tsx`)

Añadir `onClick?: () => void` a `AsistenciaMensualChartProps` ([líneas 280-283](../../../src/components/player/PlayerDashboardCards.tsx#L280)) y aplicarlo al `Card` raíz del componente ([línea 323](../../../src/components/player/PlayerDashboardCards.tsx#L323)), con las mismas clases de interactividad que `EstadoPagosCard` (`cursor-pointer transition-all hover:shadow-md`).

En `PlayerDashboard.tsx`, el consumo de `AsistenciaMensualChart` ([líneas 710-715](../../../src/pages/PlayerDashboard.tsx#L710)) pasa `onClick={() => navigate('/asistencia')}`.

### 3. Eliminar la sección "Quick Actions Desktop"

Borrar el bloque completo en `PlayerDashboard.tsx` ([líneas 635-655](../../../src/pages/PlayerDashboard.tsx#L635)): el `<div className="grid grid-cols-4 gap-4 mb-8">` que mapea `quickActions`. No se toca la definición de `quickActions` ni su uso en la vista móvil.

## Fuera de alcance

- No se toca la vista móvil (`hidden lg:hidden` o equivalente) — el problema es exclusivo de escritorio.
- No se toca `usePlayerData` ni el cálculo de `attendancePercent` — al desaparecer la quick action que lo consumía en escritorio, la inconsistencia de datos entre las dos tarjetas deja de ser observable sin necesidad de arreglar el cálculo en sí (el resumen mensual de `AsistenciaMensualChart` sigue teniendo su propio cálculo de 3 meses, que es correcto para su propósito).
- No se rediseña el contenido interno de `EstadoPagosCard`, `MisGruposCard`, etc. — solo se les añade la navegación que faltaba donde corresponde.

## Verificación manual

1. Entrar como jugador en escritorio (`npm run dev`, ventana ancha) → el dashboard ya no debe mostrar la fila de accesos rápidos ni el hueco vacío de "Mis Ausencias" en una fila de 4 columnas.
2. Cada dato (próxima clase, pagos, asistencia, ausencias) aparece una sola vez.
3. Pulsar el avatar del saludo → navega al perfil del alumno (`/jugadores/{id}`).
4. Pulsar la tarjeta "Asistencia Mensual" → navega a `/asistencia` y muestra el historial de solo lectura.
5. Repetir como tutor con un hijo activo → el avatar y los enlaces respetan al hijo seleccionado (mismo `studentId` que ya usa el resto del dashboard).
6. Comprobar la vista móvil (ventana estrecha o DevTools) → sigue mostrando la fila de accesos rápidos exactamente igual que antes (sin regresión).
