# Vista de asistencia de solo lectura para jugador/tutor — Diseño

**Fecha:** 2026-07-31
**Estado:** aprobado, pendiente de plan de implementación

## Contexto

Un jugador o tutor que navega a `/asistencia` (por ejemplo desde la tarjeta "Mi Asistencia" del dashboard, [PlayerDashboard.tsx:222](../../../src/pages/PlayerDashboard.tsx#L222)) ve hoy la página completa de gestión de asistencia que usan entrenadores y admin. `AttendancePage.tsx` solo distingue `isEntrenador` e `isAdmin` ([líneas 74-75](../../../src/pages/AttendancePage.tsx#L74)); ninguna de las dos rutas de rol aplica a jugador/tutor, así que caen en el comportamiento por defecto: `activeGroups` les muestra **todos los grupos activos del club** ([líneas 114-122](../../../src/pages/AttendancePage.tsx#L114)), y desde ahí pueden abrir el editor de asistencia (`pageView: 'sheet'`) de cualquier grupo.

**No hay vulnerabilidad de datos real.** Las reglas de Firestore ya cierran la escritura: `attendance` solo permite `create`/`update` a `isAdmin()` o `hasRole('entrenador')` ([firestore.rules:138-143](../../../firestore.rules#L138)). Un intento de guardar desde una cuenta de jugador sería denegado por el servidor. El problema es puramente de experiencia: se le enseña una herramienta de gestión que no le corresponde, y que fallaría (sin manejo de error específico) si intentara usarla.

**Lo que falta hoy:** el dashboard ya tiene un resumen agregado (`AsistenciaMensualChart`, gráfico de barras de los últimos 3 meses), pero no existe ninguna vista donde el jugador vea el detalle clase a clase — qué días fue marcado presente, ausente o justificado.

## Decisiones (validadas con el usuario)

1. **Contenido:** lista cronológica de sus clases (fecha, grupo, estado), la más reciente primero. No un calendario ni una fusión con el gráfico existente.
2. **Enrutado:** misma ruta `/asistencia`. `AttendancePage.tsx` comprueba el rol activo al entrar y, si es `jugador` o `tutor`, renderiza un componente nuevo de solo lectura en vez del editor. No se toca `App.tsx`, `Sidebar.tsx` ni el enlace del dashboard.
3. **Alcance temporal:** por defecto el mes actual, con un selector de mes/año para navegar a meses anteriores de la temporada (mismo patrón que ya usan Pagos/Finanzas).
4. **Backend:** sin cambios — las reglas de `attendance` ya son correctas (ver Contexto).

## Arquitectura

### Componente nuevo: `MyAttendanceView`

`src/components/attendance/MyAttendanceView.tsx`. Sin props obligatorias — resuelve todo internamente:

- **Alumno:** `useEffectiveStudent()` (ya existe en `src/hooks/usePlayerData.ts`), el mismo hook que usa el resto del portal para resolver "jugador propio o hijo activo del tutor".
- **Datos fuente:** `useAttendanceQuery()` (ya existe) para los `AttendanceRecord`, y `enrollments` del store para saber en qué grupos tiene el alumno inscripción activa (para no arrastrar registros de grupos ajenos si en algún momento existiera un `groupId` mal enlazado).
- **Filtro:** de los `AttendanceRecord` cuyo `groupId` esté entre los grupos del alumno, se busca su entrada (`record.records.find(r => r.playerId === studentId)`). Solo se listan los registros donde aparece.
- **Selector de mes/año:** estado local `selectedMonth`/`selectedYear`, inicializado al mes/año actuales. Reutiliza el patrón `MONTHS`/`YEARS` ya usado en `FinancialsPage.tsx`/`PaymentsPage.tsx` (un `<Select>` de mes y otro de año). Filtra los registros por `record.date` dentro del mes/año seleccionado.
- **Orden:** descendente por fecha (más reciente primero).
- **Cada fila muestra:** fecha formateada, nombre del grupo, y un badge de estado con los mismos colores que ya usa el editor de asistencia (verde=presente, rojo=ausente, amarillo=justificado — mismos tonos que `AttendancePage.tsx:849-877`), para que el código de color sea consistente entre lo que ve el alumno y lo que ve el entrenador.
- **Estado vacío:** si no hay registros en el mes/año seleccionado, mensaje simple ("Sin clases registradas en {mes} {año}"), siguiendo el patrón de estado vacío ya usado en el resto del portal (p. ej. `EmptyState` si aplica al tamaño del bloque, o un párrafo simple si es más ligero).
- **Responsive:** lista de tarjetas apiladas en móvil (consistente con el resto del portal, que es mobile-first); en escritorio puede mostrarse como tabla simple o mantener las tarjetas — decisión de implementación menor, sin necesidad de spec adicional.

### Cambio en `AttendancePage.tsx`

Justo después de calcular `activeRole`/`isEntrenador`/`isAdmin` (líneas 73-75), añadir:

```ts
const isPlayerOrTutor = activeRole === 'jugador' || activeRole === 'tutor'
```

Y al inicio del `return` del componente (antes del JSX actual de selector/sheet/calendar), un guard:

```tsx
if (isPlayerOrTutor) {
  return (
    <div>
      <Header title="Mi Asistencia" subtitle="Historial de tus clases" />
      <div className="p-4 sm:p-6">
        <MyAttendanceView />
      </div>
    </div>
  )
}
```

El resto de la página (todo lo que usa `isEntrenador`/`isAdmin`, el selector de grupos, el editor, etc.) no cambia.

## Fuera de alcance

- No se toca `firestore.rules` (ya correcto).
- No se añade una ruta nueva ni se cambia el enlace del dashboard.
- No se fusiona con `AsistenciaMensualChart` — ambos widgets coexisten (el resumen en el dashboard, el detalle en `/asistencia`); es intencional y evita tocar el dashboard en este spec (ese es un problema aparte, ya identificado, de duplicación de contenido en el dashboard de escritorio).

## Verificación manual

1. Entrar con una cuenta de rol `jugador`: ir a `/asistencia` (directamente o desde "Mi Asistencia" en el dashboard) → debe verse la lista de clases con estado, no el editor de gestión, y no debe poder seleccionar otros grupos.
2. Cambiar de mes con el selector → la lista se actualiza a las clases de ese mes.
3. Mes sin registros → mensaje de estado vacío.
4. Entrar con una cuenta de `tutor` con un hijo activo → la lista corresponde al hijo seleccionado en el `ChildSwitcher`; cambiar de hijo actualiza la lista.
5. Entrar con `entrenador`/`director`/`coordinador` → la página de gestión de asistencia sigue funcionando exactamente igual que antes (sin regresión).
