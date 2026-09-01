# Rediseño de interfaz — Módulo Clases, Fase C (Parrilla)

## Contexto

Continuación de las Fases A (topbar unificado) y B (Grupos) de Clases, ya
mergeadas en `claude/rediseno-ui`. Antes de arrancar esta fase se revisó el
resultado de la Fase B contra el mock y se encontraron divergencias no
aprobadas (fila de filtros más recargada que el mock, tarjetas más altas
por conservar el listado de alumnos inscritos). Esas correcciones quedan
pendientes para una fase posterior — el usuario decidió explícitamente
seguir con Fase C antes de volver a Grupos.

Mockup de referencia en `san javier.pen`: nodo `X60Ar` ("05 · Clases /
Parrilla"). A diferencia de Grupos, aquí el mock no es un reskin de la
página actual — es una **vista semanal** (columnas Lunes-Sábado, filas por
hora, con las pistas apiladas dentro de cada celda), mientras que
`AgendaPage.tsx` hoy es una vista de un único día con columnas por pista.

## Alcance de esta fase

1. El toggle **Semana / Día / Mes** del mock se implementa de verdad:
   - **Semana**: vista nueva, replica el mock. Es la vista por defecto al
     entrar a `/clases/parrilla`.
   - **Día**: reutiliza toda la lógica ya existente y probada de
     `AgendaPage.tsx` (clic en hueco para crear clase particular, clic en
     grupo para abrir `AttendanceQuickDialog`, clic en particular para ver
     detalle, clic en evento para navegar a su ficha).
   - **Mes**: fuera de alcance — el mock tampoco lo diseña, solo existe el
     botón del toggle sin implementación detrás por ahora.
2. Filtros de **Entrenador**, **Pista** y **Nivel** (nuevos), compartidos
   entre Semana y Día — misma barra de controles, la grilla de debajo
   cambia según el toggle activo.
3. El resumen de 4 tarjetas al final de la vista Día se migra del estilo
   actual (cajas de color planas hechas a mano) al componente compartido
   `StatCard` (`src/components/shared/StatCard.tsx`, ya usado en
   Dashboard/Pagos/Facturas — es el que sigue el lenguaje visual real del
   mock). Se añade un resumen equivalente, con `StatCard`, para la semana
   completa, visible solo en la vista Semana.
4. Se mantienen los 5 niveles reales (`PLAYER_LEVELS`) con los colores ya
   definidos en `AgendaPage.tsx` (`LEVEL_COLORS`) — no se adopta la
   simplificación a 3 categorías (Escuela/Adultos/Competición) que muestra
   la leyenda del mock. La leyenda final tiene 5 niveles + Particular +
   Evento (7 entradas).
5. Clic en cualquier bloque de la vista Semana → cambia el toggle a Día y
   navega a esa fecha. No se duplica la interacción rica de Día dentro de
   Semana.

Fuera de alcance: vista Mes; conectar el buscador del topbar en Parrilla
(se queda oculto, igual que en las pestañas sin fase propia); corregir las
divergencias pendientes de Grupos (Fase B); cualquier cambio a los
diálogos de crear/editar clase particular o evento.

## 1. Arquitectura del toggle de vista

`AgendaPage.tsx` gana un estado `const [viewMode, setViewMode] =
useState<'semana' | 'dia'>('semana')` (sin `'mes'` como valor real todavía
— el botón "Mes" del toggle puede quedar deshabilitado o simplemente no
hacer nada al pulsarlo, ver Task correspondiente en el plan).

El `selectedDate` actual se sigue usando igual en ambas vistas: en Día, es
el día mostrado (como hoy). En Semana, se deriva de `selectedDate` la
semana que la contiene (`getWeekStart(selectedDate)` → Lunes de esa
semana), y los controles de navegación de semana avanzan/retroceden
`selectedDate` en bloques de 7 días en vez de 1.

```ts
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0=Dom, 1=Lun, ..., 6=Sáb
  const diff = day === 0 ? -6 : 1 - day // retrocede hasta el Lunes
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}
```

Navegación de semana:

```ts
function goToPreviousWeek() { setSelectedDate((prev) => addDays(prev, -7)) }
function goToNextWeek() { setSelectedDate((prev) => addDays(prev, 7)) }
```

El botón "Hoy" existente sigue funcionando igual en ambas vistas
(`setSelectedDate(new Date())`) — en Semana esto salta a la semana que
contiene hoy, no solo al día de hoy.

## 2. Filtros compartidos: Entrenador, Pista, Nivel

Nuevo estado:

```ts
const [coachFilter, setCoachFilter] = useState('')
const [courtFilter, setCourtFilter] = useState('')
const [levelFilter, setLevelFilter] = useState('')
```

Tres `<Select>` nuevos en la barra de controles (visibles en ambas
vistas), con las opciones "Todos" + `activeCoaches`/`activeCourts`/
`PLAYER_LEVELS` respectivamente. Si el usuario es `entrenador`, el filtro
de Entrenador se oculta (igual que ya hace `GroupsPage` para su filtro de
Entrenador) y el filtrado se fuerza a `currentCoachId`, replicando el
patrón ya establecido de "solo ve lo suyo" del resto de Clases.

Estos 3 filtros afectan a `blocksByCourt` (Día) y a la nueva función
equivalente para Semana: un bloque de tipo `group` se descarta si no
coincide con `coachFilter`/`courtFilter`/`levelFilter`; un bloque
`private` se descarta si no coincide con `coachFilter`/`courtFilter`
(no tiene nivel); un bloque `event` se descarta si no coincide con
`courtFilter` (los eventos pueden tener varios entrenadores y no tienen
nivel — no se filtran por Entrenador/Nivel, solo por Pista, ya que un
evento puede ocupar varias pistas y basta con que una coincida).

## 3. Vista Semana — estructura de datos

Se generaliza la lógica que ya existe en `blocksByCourt` (hoy calculada
solo para `selectedDate`) para poder ejecutarla sobre cualquier fecha. Se
extrae una función pura `computeBlocksByCourtForDate(date, ...)` con el
mismo cuerpo que el `useMemo` actual de `blocksByCourt`, parametrizada por
`date` en vez de leer `selectedDate` del cierre — Día sigue usando esta
función para su único día; Semana la llama 6 veces (una por cada día de
la semana).

```ts
const weekStart = useMemo(() => getWeekStart(selectedDate), [selectedDate])
const weekDays = useMemo(
  () => Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)),
  [weekStart]
)

const blocksByCourtByDay = useMemo(() => {
  return weekDays.map((day) => computeBlocksByCourtForDate(day))
}, [weekDays, groups, privateLessons, events, activeCourts, attendance, coachFilter, courtFilter, levelFilter])
```

Cada entrada de `blocksByCourtByDay` es un `Record<courtId, GridBlock[]>`
igual que el `blocksByCourt` de hoy, ya con los 3 filtros nuevos
aplicados.

### Filas por hora, no por bloque de 30 minutos

A diferencia de Día (que usa `TIME_SLOTS` de 30 en 30 minutos para poder
posicionar bloques con precisión de media hora), Semana usa una fila por
hora completa (`8:00`, `9:00`, ..., `21:00`, reutilizando `START_HOUR`/
`END_HOUR`). Dentro de cada celda día×hora, los bloques que EMPIEZAN en
esa hora se listan como líneas compactas de una sola línea (no como
tarjetas con alto proporcional a la duración) — esto es una simplificación
deliberada respecto a Día: el mock muestra los bloques de Semana como
texto compacto de una línea, sin cajas con alto variable, así que un
bloque de 90 minutos aparece una sola vez, en la fila de su hora de
inicio, igual que uno de 60 minutos.

### Orden de pistas dentro de cada celda

Cada celda día×hora reserva una línea por cada pista activa que tenga un
bloque empezando esa hora, en el mismo orden estable ya usado en
`activeCourts` (por `order`, luego nombre). No se implementa un algoritmo
genérico de detección de solapamientos: como cada bloque ya sabe a qué
pista pertenece (`courtId`), basta con iterar `activeCourts` en orden y,
para cada pista, comprobar si tiene un bloque empezando esa hora ese día.

```ts
interface WeekCellEntry {
  courtOrder: number // posición 1-indexada dentro de activeCourts, para la etiqueta "Pn"
  block: GridBlock
}

function getWeekCellEntries(
  blocksByCourt: Record<string, GridBlock[]>,
  activeCourts: Court[],
  hourSlotIdx: number // índice de TIME_SLOTS correspondiente al inicio de la hora
): WeekCellEntry[] {
  const entries: WeekCellEntry[] = []
  activeCourts.forEach((court, i) => {
    const blocks = blocksByCourt[court.id] ?? []
    const block = blocks.find((b) => b.startSlot === hourSlotIdx)
    if (block) entries.push({ courtOrder: i + 1, block })
  })
  return entries
}
```

La altura de cada fila-hora (misma para las 6 columnas de esa fila) se
calcula como `Math.max(1, entriesPorDía...).length` — el máximo número de
entradas en cualquiera de los 6 días para esa hora, con una altura mínima
para que la grilla no colapse en horas sin clases.

### Render de cada línea

Cada línea muestra: una etiqueta corta `Pn` (n = `courtOrder`), un color
de fondo/borde según el tipo de bloque (mismo criterio que Día: nivel del
grupo vía `LEVEL_COLORS`, ámbar para particular, teal para evento), y el
nombre (grupo/"Clase particular"+alumno principal/evento). Al pulsar
sobre la línea:

```ts
function jumpToDay(date: Date) {
  setSelectedDate(date)
  setViewMode('dia')
}
```

## 4. Migración de las tarjetas de resumen a `StatCard`

Las 4 tarjetas actuales de Día (líneas 780-785 de `AgendaPage.tsx`) se
reescriben usando `StatCard`:

```tsx
import { StatCard } from '@/components/shared/StatCard'
// ...
<div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
  <StatCard
    title="Grupos con clase"
    value={dayGroupCount}
    icon={Users}
    iconClassName="bg-blue-500/10 text-blue-600"
  />
  <StatCard
    title="Clases particulares"
    value={dayPrivateCount}
    icon={Clock}
    iconClassName="bg-amber-500/10 text-amber-600"
  />
  <StatCard
    title="Eventos"
    value={dayEventCount}
    icon={Star}
    iconClassName="bg-teal-500/10 text-teal-600"
  />
  <StatCard
    title="Pistas activas"
    value={activeCourts.length}
    icon={MapPin}
    iconClassName="bg-emerald-500/10 text-emerald-600"
  />
</div>
```

Donde `dayGroupCount`/`dayPrivateCount`/`dayEventCount` son las mismas
expresiones `Object.values(blocksByCourt).reduce(...)` que ya existen hoy,
solo renombradas para claridad al convivir con sus equivalentes
semanales.

Para Semana se añade un bloque análogo, visible solo cuando
`viewMode === 'semana'`, sumando sobre los 6 días de `blocksByCourtByDay`:

```ts
const weekGroupCount = blocksByCourtByDay.reduce(
  (acc, byCourtForDay) => acc + Object.values(byCourtForDay).reduce((a, blocks) => a + blocks.filter(b => b.type === 'group').length, 0),
  0
)
// weekPrivateCount y weekEventCount análogos, filtrando por 'private'/'event'
```

```tsx
{viewMode === 'semana' && (
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
    <StatCard title="Grupos con clase (semana)" value={weekGroupCount} icon={Users} iconClassName="bg-blue-500/10 text-blue-600" />
    <StatCard title="Clases particulares (semana)" value={weekPrivateCount} icon={Clock} iconClassName="bg-amber-500/10 text-amber-600" />
    <StatCard title="Eventos (semana)" value={weekEventCount} icon={Star} iconClassName="bg-teal-500/10 text-teal-600" />
    <StatCard title="Pistas activas" value={activeCourts.length} icon={MapPin} iconClassName="bg-emerald-500/10 text-emerald-600" />
  </div>
)}
```

El bloque de Día se envuelve igual en `{viewMode === 'dia' && (...)}`.

## 5. Leyenda

Se sustituye la leyenda actual de 3 colores (Grupo/Particular/Evento,
líneas 630-633) por una de 7 entradas: los 5 niveles (con el color de
fondo/borde de `LEVEL_COLORS`) + Particular (ámbar) + Evento (teal). Común
a ambas vistas.

## 6. Controles de navegación por vista

- **Día**: el date-picker + flechas ← → + botón "Hoy" actuales se
  mantienen sin cambios.
- **Semana**: se sustituyen por un selector de semana: flechas ← →
  (`goToPreviousWeek`/`goToNextWeek`), una etiqueta central con el rango
  de fechas, y el mismo botón "Hoy" reutilizado (salta a la semana
  actual). Formato de la etiqueta (mismo mes) — `"25 - 30 ago"`:

  ```ts
  function formatWeekLabel(weekStart: Date, weekEnd: Date): string {
    const startDay = weekStart.getDate()
    const endDay = weekEnd.getDate()
    const sameMonth = weekStart.getMonth() === weekEnd.getMonth()
    const monthFmt = (d: Date) => new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(d).replace('.', '')
    if (sameMonth) return `${startDay} - ${endDay} ${monthFmt(weekEnd)}`
    return `${startDay} ${monthFmt(weekStart)} - ${endDay} ${monthFmt(weekEnd)}`
  }
  ```

  `weekEnd` es el Sábado de la semana (`addDays(weekStart, 5)`).
- El toggle Semana/Día/Mes vive en la misma barra, junto a los filtros de
  Entrenador/Pista/Nivel.

## Fuera de alcance / riesgos conocidos

- La vista Mes no se implementa — el botón del toggle se renderiza
  deshabilitado (`disabled`, con estilo atenuado y `title="Próximamente"`)
  en vez de quitarse, para que el toggle conserve la forma de 3 opciones
  del mock sin prometer una función que no existe todavía.
- Los bloques de Semana no muestran su duración real (solo aparecen en su
  hora de inicio, sin alto proporcional) — es una simplificación
  deliberada frente a Día, coherente con el estilo compacto del mock.
- Las clases programadas en domingo no aparecen en la vista Semana (que
  va de Lunes a Sábado, igual que el mock) — siguen siendo visibles desde
  Día si se navega a esa fecha.
- La etiqueta "Pn" de cada línea es una posición relativa dentro de
  `activeCourts` (1, 2, 3...), no un identificador real de la pista. Cada
  línea lleva un atributo `title` HTML nativo con el nombre completo de la
  pista (`court.name`), visible al pasar el cursor por encima.
- Las divergencias pendientes de la Fase B (Grupos) — fila de filtros más
  recargada que el mock, tarjetas de grupo sin recorte del listado de
  alumnos — quedan fuera de esta fase, pendientes de una fase de ajuste
  posterior.
