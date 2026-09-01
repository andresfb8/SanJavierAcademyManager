# Rediseño de interfaz — Módulo Clases, Fase D (Asistencia)

## Contexto

Continuación de las Fases A (topbar), B (Grupos), C (Parrilla) del
rediseño de Clases. Mockup de referencia en `san javier.pen`, nodo `uJtl6`
("03 · Clases / Asistencia"). A diferencia de las fases anteriores, aquí el
mock propone una arquitectura de escritorio distinta a la actual: una
pantalla única maestro-detalle (lista de sesiones del día + panel de
detalle), en vez de las 3 vistas independientes que hoy conviven en
`AttendancePage.tsx` (selector con tabla inline, `QuickAttendanceSheet` de
pantalla completa, `AttendanceCalendar` de historial).

## Alcance de esta fase

1. La pantalla principal de Asistencia (staff: director/coordinador/
   entrenador) pasa a ser un layout maestro-detalle: columna izquierda con
   la lista de sesiones del día seleccionado, columna derecha con el panel
   de la sesión elegida.
2. Se añade un gráfico de barras "Asistencia del grupo — últimas 8
   semanas" en el panel de detalle — dato agregable a partir de los
   `AttendanceRecord` ya existentes.
3. Funcionalidad existente que el mock no dibuja pero se conserva
   (recuperación, clase suelta, notificar hueco, exportar Excel, notas por
   jugador, alerta médica, WhatsApp) se reubica dentro del nuevo panel de
   detalle.
4. `QuickAttendanceSheet` (vista móvil de pantalla completa) y
   `AttendanceCalendar` (historial de un grupo) se mantienen intactos como
   componentes, alcanzables desde acciones del nuevo panel en vez de ser
   el punto de entrada por defecto en escritorio.

Fuera de alcance (decisiones ya tomadas):
- "Notas de la sesión" y "Objetivos de la sesión" (con checkboxes) del
  mock — es funcionalidad nueva de verdad (no existe en el modelo de
  datos), se evalúa en una fase separada.
- La vista de jugador/tutor ("Mi Asistencia", `MyAttendanceView`) no se
  toca.
- Las clases particulares SÍ aparecen en la lista de sesiones del día
  (para ver el día completo de un vistazo), pero no tienen concepto de
  asistencia — al hacer clic navegan a su propia ficha
  (`/clases-particulares/:id`, ruta ya existente), no abren un panel de
  asistencia.
- Los eventos no aparecen en la lista de sesiones (no aplica asistencia).

## 1. Cálculo de las sesiones del día

Nueva función pura en `src/lib/attendance-utils.ts` (mismo archivo que ya
tiene `getMyAttendanceForMonth`):

```ts
export interface DaySession {
  type: 'group' | 'private'
  id: string           // groupId o privateLessonId
  name: string          // nombre del grupo, o "Clase particular"
  startTime: string
  endTime: string
  coachName: string
  courtName: string
  level?: string         // solo type 'group'
  currentEnrollment?: number  // solo type 'group'
  maxCapacity?: number       // solo type 'group'
  hasRecord: boolean     // solo relevante para type 'group'
}

export function getSessionsForDate(
  date: Date,
  groups: Group[],
  privateLessons: PrivateLesson[],
  attendance: AttendanceRecord[]
): DaySession[] {
  const dayOfWeek = date.getDay()
  const sessions: DaySession[] = []

  for (const group of groups) {
    if (!isGroupCurrentlyActive(group, date)) continue
    for (const slot of group.schedule) {
      if (slot.dayOfWeek !== dayOfWeek) continue
      const hasRecord = attendance.some(
        (a) => a.groupId === group.id && isSameDay(new Date(a.date), date)
      )
      sessions.push({
        type: 'group', id: group.id, name: group.name,
        startTime: slot.startTime, endTime: slot.endTime,
        coachName: group.coachName, courtName: group.courtName,
        level: group.level, currentEnrollment: group.currentEnrollment,
        maxCapacity: group.maxCapacity, hasRecord,
      })
    }
  }

  for (const lesson of privateLessons) {
    const lessonDate = lesson.date instanceof Date ? lesson.date : new Date(lesson.date)
    if (!isSameDay(lessonDate, date)) continue
    sessions.push({
      type: 'private', id: lesson.id, name: 'Clase particular',
      startTime: lesson.startTime, endTime: lesson.endTime,
      coachName: lesson.coachName, courtName: lesson.courtName,
      hasRecord: false,
    })
  }

  return sessions.sort((a, b) => a.startTime.localeCompare(b.startTime))
}
```

Reutiliza `isGroupCurrentlyActive` (`@/lib/group-utils`) e `isSameDay`
(`@/lib/agenda-utils`) — mismos criterios ya usados en Parrilla, no se
reinventa la lógica de "¿este grupo tiene clase este día?".

### Estado de cada fila en la lista

- **Cerrada** (✓): `session.hasRecord === true`.
- **Ahora**: `!hasRecord` y la hora actual cae dentro de
  `[startTime, endTime]` de esa sesión, comparando solo si `date` es hoy.
- **Pendiente**: el resto.

Las filas de `type: 'private'` no tienen esta lógica de estado — se
muestran con un indicador neutro (icono de "clase particular", sin
badge de estado) y al hacer clic navegan con `navigate(`/clases-particulares/${session.id}`)` en vez de seleccionar sesión.

### Resumen del pie de la lista

- **Asistencia media del día**: promedio de `% presentes` entre las
  sesiones de tipo `group` con `hasRecord === true` ese día (mismo cálculo
  que ya existe por grupo, agregado sobre las cerradas del día). `null`/
  "Sin datos" si `sesiones cerradas === 0`.
- **Sesiones cerradas**: `X/Y` donde `Y` = número TOTAL de sesiones del
  día en la lista (`group` + `private`) y `X` = número de sesiones con
  `hasRecord === true` (solo las `group` pueden llegar a estarlo — las
  `private` cuentan para `Y` pero nunca para `X`, ya que no tienen
  concepto de asistencia). Esto reproduce fielmente el "2/7" del mock,
  donde de 7 sesiones del día (6 grupos + 1 particular) solo 2 grupos
  tenían asistencia registrada.

## 2. Gráfico "Asistencia del grupo — últimas 8 semanas"

Nueva función pura en `src/lib/attendance-utils.ts`:

```ts
export interface WeeklyAttendancePoint {
  weekLabel: string   // "25 ago" (lunes de esa semana, formato corto)
  rate: number | null // % de presentes esa semana, null si no hubo registro
}

export function getGroupAttendanceByWeek(
  attendance: AttendanceRecord[],
  groupId: string,
  referenceDate: Date,
  weeksBack = 8
): WeeklyAttendancePoint[] {
  const points: WeeklyAttendancePoint[] = []
  const thisWeekStart = getWeekStart(referenceDate)

  for (let i = weeksBack - 1; i >= 0; i--) {
    const weekStart = addDays(thisWeekStart, -7 * i)
    const weekEnd = addDays(weekStart, 6)
    const recordsThisWeek = attendance.filter((a) => {
      if (a.groupId !== groupId) return false
      const d = new Date(a.date)
      return d >= weekStart && d <= weekEnd
    })
    let present = 0
    let total = 0
    for (const record of recordsThisWeek) {
      for (const entry of record.records) {
        total++
        if (entry.status === 'presente') present++
      }
    }
    points.push({
      weekLabel: `${weekStart.getDate()} ${new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(weekStart).replace('.', '')}`,
      rate: total > 0 ? Math.round((present / total) * 100) : null,
    })
  }

  return points
}
```

Reutiliza `getWeekStart`/`addDays` de `@/lib/agenda-utils` (ya existen
desde la Fase C). Se renderiza con un `BarChart` de `recharts` (ya usado
en `StatCard.tsx`), barras sin datos (`rate === null`) mostradas a altura
0 con una etiqueta "Sin datos" en el tooltip.

## 3. Layout maestro-detalle

`AttendancePage.tsx` mantiene su `pageView` (`'selector' | 'sheet' |
'calendar'`), pero el contenido de `'selector'` para roles staff se
reescribe por completo:

```
┌─────────────────────────────────────────────────────────┐
│  ← Vie 28 ago →                                          │
├───────────────────────┬───────────────────────────────────┤
│ Escuela Menores 3  ✓  │  Perfeccionamiento    ● En curso  │
│ 16:00 · Marta Vera P2 │  18:00-19:00 · Pista 3 · Marta    │
│ ...                   │  Ruiz · Intermedio      7/8  ···  │
│ Perfeccionamiento     │  [Todos presentes] [Guardar]      │
│ 18:00 (seleccionada)  │  ┌────┬────┬────┬────┐            │
│ Clase particular      │  │ P1 │ P2 │ P3 │ P4 │ (rejilla)  │
│ 20:00 →               │  └────┴────┴────┴────┘            │
│ ...                   │                                    │
├───────────────────────┤  Asistencia — últimas 8 semanas   │
│ Asist. media  86%     │  [gráfico de barras]               │
│ Cerradas      2/7     │                                    │
└───────────────────────┴───────────────────────────────────┘
```

- **Columna izquierda** (`w-80` fijo en escritorio, se apila arriba en
  móvil/tablet — breakpoint `lg:` como en el resto de la app): navegación
  de día (flechas + fecha, reutilizando el mismo patrón que
  `AgendaPage.tsx`), lista de `DaySession` del día seleccionado, footer
  con las 2 métricas.
- **Columna derecha**: panel de la sesión seleccionada (`selectedSessionId`
  nuevo estado). Si no hay sesión seleccionada, `EmptyState` invitando a
  elegir una. Al montar la página (o al cambiar de día), si existe una
  sesión de tipo `group` cuyo estado es "Ahora", se auto-selecciona —
  sustituye al banner verde de "Clase próxima" que existía antes (mismo
  comportamiento, integrado en el nuevo layout en vez de un aviso aparte).

### Cabecera del panel de detalle

- Nombre del grupo, badge de estado ("En curso" si es la sesión "Ahora",
  "Cerrada" si `hasRecord`, "Pendiente" en el resto — colores verde/gris/
  ámbar respectivamente).
- Línea de metadatos: horario, pista, entrenador, nivel (`StatusBadge`).
- Badge de ocupación `X/Y`.
- Botón "Todos presentes" (ya existente, `handleMarkAllPresent`).
- Botón primario "Guardar asistencia" (ya existente, `handleSave`) —
  deshabilitado si no hay cambios sin guardar, igual que hoy con `saved`.
- Menú "···" (mismo componente `DropdownMenu` ya usado en Grupos/Parrilla)
  con las acciones que el mock no muestra pero existen hoy: "Añadir
  recuperación", "Añadir clase suelta", "Notificar hueco libre (WhatsApp)",
  "Exportar a Excel", "Ver historial completo" (abre `pageView =
  'calendar'` para este grupo), "Vista de pase rápido" (abre `pageView =
  'sheet'` para este grupo+fecha, es decir `QuickAttendanceSheet`).

### Rejilla de jugadores

Sustituye las filas verticales anchas actuales por tarjetas compactas en
grid (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3`): avatar con
iniciales, nombre, y 3 botones pequeños en fila (Presente/Ausente/
Justificado) usando los mismos iconos ya establecidos en el resto de la
app (`CheckCircle`/`XCircle`/`AlertCircle` de `lucide-react`, no se
persigue el icono exacto del mock). Badges existentes que no caben en la
cabecera de la tarjeta (Rec./Suelta/aviso de asistencia/alerta médica) se
muestran como un icono pequeño superpuesto en la esquina de la tarjeta,
con `title` para el detalle — mismo patrón de "icono + tooltip" ya usado
en Parrilla para las pistas.

La búsqueda de jugador (`searchQuery`, hoy solo en `QuickAttendanceSheet`)
NO se añade al panel de detalle en esta fase — los grupos son
suficientemente pequeños (según los datos vistos, 4-8 alumnos) para no
necesitar filtro.

### Cambios de estado (Presente/Ausente/Justificado)

Igual que el flujo actual de `pageView === 'selector'` (NO el de
`QuickAttendanceSheet`): los clics actualizan `entries` en memoria, y solo
se persisten al pulsar "Guardar asistencia" — no hay auto-guardado con
debounce en esta vista. Mantiene el patrón ya usado, evita introducir un
segundo modelo de guardado (autosave vs. guardado explícito) en la misma
página.

## 4. Qué se mantiene sin cambios

- `QuickAttendanceSheet.tsx` — ningún cambio, sigue siendo la vista de
  pantalla completa optimizada para móvil, ahora alcanzable desde el menú
  "···" del panel de detalle en vez de un botón en la tarjeta del
  selector.
- `AttendanceCalendar.tsx` — ningún cambio, alcanzable desde "Ver
  historial completo".
- `MyAttendanceView` (rol jugador/tutor) — ningún cambio.
- Los 3 diálogos existentes (Añadir recuperación, Exportar, Añadir clase
  suelta) — ningún cambio en su contenido, solo se abren desde el nuevo
  menú "···" en vez de los botones de cabecera de la tabla antigua.
- La detección automática por URL (`?groupId=&fecha=`) sigue funcionando
  igual — auto-selecciona esa sesión en el nuevo layout en vez de saltar
  directamente a `pageView = 'sheet'` como hace hoy.

## Fuera de alcance / riesgos conocidos

- El layout maestro-detalle en pantallas estrechas (móvil) se apila
  verticalmente (lista arriba, detalle abajo) siguiendo el mismo criterio
  `lg:` de breakpoint que el resto de la app — no se diseña una
  interacción táctil específica distinta a "tocar una fila para ver el
  detalle debajo", ya que el caso de uso móvil real ya está cubierto por
  `QuickAttendanceSheet`.
- "Notas de la sesión"/"Objetivos de la sesión" quedan fuera, como ya se
  ha dicho — si en el futuro se construyen, tendrán su propio ciclo de
  spec.
- El cálculo de `getSessionsForDate` recorre todos los grupos y clases
  particulares del club por cada día mostrado — con el volumen de datos
  actual (decenas de grupos) no es un problema; mismo criterio de
  aceptación de coste que ya se usó en Parrilla y Grupos.
