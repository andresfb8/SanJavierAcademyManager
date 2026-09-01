# Rediseño UI Clases — Fase D (Asistencia) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sustituir el flujo de escritorio de `AttendancePage.tsx` (selector de grupo/fecha + tabla inline) por un layout maestro-detalle (lista de sesiones del día + panel de la sesión seleccionada), añadiendo un gráfico de asistencia semanal, y reubicando la funcionalidad existente (recuperación, clase suelta, notificar hueco, exportar, historial completo, vista móvil) en un menú "···" dentro del nuevo panel.

**Architecture:** Nueva lógica pura en `src/lib/attendance-utils.ts` (cálculo de sesiones del día y de la serie semanal para el gráfico), un nuevo componente presentacional `src/components/agenda/DaySessionList.tsx` para la columna izquierda (mismo patrón que `WeekGrid.tsx` en la Fase C), y una reescritura del `pageView === 'selector'` de `AttendancePage.tsx` para el panel de detalle. `QuickAttendanceSheet`, `AttendanceCalendar` y `MyAttendanceView` no se tocan — siguen siendo los mismos componentes, solo cambia cómo se llega a ellos.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Recharts, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-01-rediseno-ui-clases-fase-d-asistencia-design.md`

---

### Task 1: Añadir lógica de sesiones del día y de asistencia semanal a `src/lib/attendance-utils.ts`

**Files:**
- Modify: `src/lib/attendance-utils.ts`
- Modify: `src/lib/attendance-utils.test.ts`

- [ ] **Step 1: Leer el archivo actual**

Leer `src/lib/attendance-utils.ts` y `src/lib/attendance-utils.test.ts` completos antes de editar, para añadir el código nuevo sin romper `getMyAttendanceForMonth`/sus tests existentes.

- [ ] **Step 2: Añadir las funciones nuevas**

Cambiar el import de tipos al principio del archivo:

```ts
import type { AttendanceRecord, AttendanceStatus } from '@/types'
```

por:

```ts
import type { AttendanceRecord, AttendanceStatus, Group, PrivateLesson } from '@/types'
import { isGroupCurrentlyActive } from '@/lib/group-utils'
import { isSameDay, getWeekStart, addDays } from '@/lib/agenda-utils'
```

Añadir, al final del archivo (después de `getMyAttendanceForMonth`):

```ts
// ==========================================
// Sesiones del día (vista maestro-detalle de Asistencia)
// ==========================================

export interface DaySession {
  type: 'group' | 'private'
  id: string
  name: string
  startTime: string
  endTime: string
  coachName: string
  courtName: string
  level?: string
  currentEnrollment?: number
  maxCapacity?: number
  hasRecord: boolean
}

/**
 * Sesiones (grupos + clases particulares) de una fecha concreta, ordenadas
 * por hora de inicio. Los grupos incluyen si ya tienen un `AttendanceRecord`
 * guardado (`hasRecord`); las particulares no tienen concepto de asistencia
 * y `hasRecord` siempre es `false` para ellas — se listan solo para tener el
 * día completo a la vista, no abren un panel de asistencia.
 */
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

/** ¿La hora actual (`now`) cae dentro de `[startTime, endTime)`? */
export function isSessionHappeningNow(startTime: string, endTime: string, now: Date = new Date()): boolean {
  const [startH, startM] = startTime.split(':').map(Number)
  const [endH, endM] = endTime.split(':').map(Number)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM
  return nowMinutes >= startMinutes && nowMinutes < endMinutes
}

// ==========================================
// Asistencia semanal de un grupo (gráfico de la Fase D)
// ==========================================

export interface WeeklyAttendancePoint {
  weekLabel: string
  rate: number | null
}

/**
 * Serie de `weeksBack` semanas (por defecto 8), terminando en la semana que
 * contiene `referenceDate`, con el % de asistencia de cada una. `rate` es
 * `null` (no `0`) cuando esa semana no tiene ningún registro, igual que el
 * resto de cálculos de asistencia de la app.
 */
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

- [ ] **Step 3: Añadir tests**

Añadir, al final de `src/lib/attendance-utils.test.ts` (después de los tests existentes de `getMyAttendanceForMonth`, sin tocarlos):

```ts
import {
  getSessionsForDate, isSessionHappeningNow, getGroupAttendanceByWeek,
} from '@/lib/attendance-utils'
import type { Group, PrivateLesson } from '@/types'

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 'group-1', name: 'Grupo Test', level: 'iniciacion',
    coachId: 'coach-1', coachName: 'Coach Uno', courtId: 'court-1', courtName: 'Pista 1',
    schedule: [{ dayOfWeek: 1, startTime: '18:00', endTime: '19:00' }],
    maxCapacity: 4, currentEnrollment: 2,
    defaultTariffId: 'tariff-1', defaultTariffPrice: 50, billingFrequency: 'monthly',
    startDate: new Date(2026, 0, 1), endDate: new Date(2026, 11, 31),
    isActive: true, createdAt: new Date(2026, 0, 1),
    ...overrides,
  }
}

function makeLesson(overrides: Partial<PrivateLesson> = {}): PrivateLesson {
  return {
    id: 'lesson-1', playerIds: ['p1'], playerNames: ['Jugador Uno'],
    coachId: 'coach-1', coachName: 'Coach Uno', courtId: 'court-1', courtName: 'Pista 1',
    date: new Date(2026, 2, 9), startTime: '20:00', endTime: '21:00',
    price: 30, isPaid: false, createdAt: new Date(2026, 2, 1),
    ...overrides,
  }
}

describe('getSessionsForDate', () => {
  // 9 marzo 2026 es Lunes.
  const monday = new Date(2026, 2, 9)

  it('incluye un grupo cuyo horario coincide con el dia de la semana', () => {
    const result = getSessionsForDate(monday, [makeGroup()], [], [])
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('group')
    expect(result[0].hasRecord).toBe(false)
  })

  it('marca hasRecord=true si ya existe un AttendanceRecord para ese grupo y fecha', () => {
    const attendance = [{
      id: 'att-1', groupId: 'group-1', groupName: 'Grupo Test', date: monday,
      records: [], coachId: 'coach-1', createdAt: monday,
    }] as any
    const result = getSessionsForDate(monday, [makeGroup()], [], attendance)
    expect(result[0].hasRecord).toBe(true)
  })

  it('incluye clases particulares de esa fecha, siempre con hasRecord=false', () => {
    const result = getSessionsForDate(monday, [], [makeLesson()], [])
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('private')
    expect(result[0].hasRecord).toBe(false)
    expect(result[0].name).toBe('Clase particular')
  })

  it('ordena las sesiones por hora de inicio', () => {
    const earlyGroup = makeGroup({ id: 'group-early', schedule: [{ dayOfWeek: 1, startTime: '09:00', endTime: '10:00' }] })
    const result = getSessionsForDate(monday, [makeGroup(), earlyGroup], [makeLesson()], [])
    expect(result.map((s) => s.startTime)).toEqual(['09:00', '18:00', '20:00'])
  })

  it('excluye un grupo cuyo horario no coincide con el dia de la semana', () => {
    const tuesdayGroup = makeGroup({ schedule: [{ dayOfWeek: 2, startTime: '18:00', endTime: '19:00' }] })
    const result = getSessionsForDate(monday, [tuesdayGroup], [], [])
    expect(result).toHaveLength(0)
  })
})

describe('isSessionHappeningNow', () => {
  it('es true si la hora actual cae dentro del rango', () => {
    const now = new Date(2026, 2, 9, 18, 30)
    expect(isSessionHappeningNow('18:00', '19:00', now)).toBe(true)
  })

  it('es false antes de que empiece', () => {
    const now = new Date(2026, 2, 9, 17, 59)
    expect(isSessionHappeningNow('18:00', '19:00', now)).toBe(false)
  })

  it('es false justo en la hora de fin (rango exclusivo al final)', () => {
    const now = new Date(2026, 2, 9, 19, 0)
    expect(isSessionHappeningNow('18:00', '19:00', now)).toBe(false)
  })
})

describe('getGroupAttendanceByWeek', () => {
  it('devuelve weeksBack puntos, en orden cronologico', () => {
    const result = getGroupAttendanceByWeek([], 'group-1', new Date(2026, 2, 9), 8)
    expect(result).toHaveLength(8)
  })

  it('rate es null cuando esa semana no tiene registros', () => {
    const result = getGroupAttendanceByWeek([], 'group-1', new Date(2026, 2, 9), 3)
    expect(result.every((p) => p.rate === null)).toBe(true)
  })

  it('calcula el porcentaje de presentes de la semana correcta', () => {
    const referenceDate = new Date(2026, 2, 9) // Lunes
    const attendance = [{
      id: 'att-1', groupId: 'group-1', groupName: 'G', date: referenceDate,
      records: [
        { playerId: 'p1', playerName: 'A', status: 'presente', isRecovery: false },
        { playerId: 'p2', playerName: 'B', status: 'ausente', isRecovery: false },
      ],
      coachId: 'coach-1', createdAt: referenceDate,
    }] as any
    const result = getGroupAttendanceByWeek(attendance, 'group-1', referenceDate, 1)
    expect(result).toHaveLength(1)
    expect(result[0].rate).toBe(50)
  })

  it('ignora registros de otro grupo', () => {
    const referenceDate = new Date(2026, 2, 9)
    const attendance = [{
      id: 'att-1', groupId: 'other-group', groupName: 'G', date: referenceDate,
      records: [{ playerId: 'p1', playerName: 'A', status: 'presente', isRecovery: false }],
      coachId: 'coach-1', createdAt: referenceDate,
    }] as any
    const result = getGroupAttendanceByWeek(attendance, 'group-1', referenceDate, 1)
    expect(result[0].rate).toBeNull()
  })
})
```

- [ ] **Step 4: Ejecutar los tests nuevos**

Run: `npm test -- attendance-utils`
Expected: todos los tests (existentes de `getMyAttendanceForMonth` + los nuevos) en verde.

- [ ] **Step 5: Verificar que compila**

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/lib/attendance-utils.ts src/lib/attendance-utils.test.ts
git commit -m "feat: añadir calculo de sesiones del dia y asistencia semanal a attendance-utils"
```

---

### Task 2: Crear `src/components/agenda/DaySessionList.tsx`

**Files:**
- Create: `src/components/agenda/DaySessionList.tsx`

Componente presentacional puro (sin `useDataStore`), mismo patrón que
`WeekGrid.tsx` de la Fase C: recibe los datos ya calculados por props, no
gestiona estado propio salvo el necesario para su render. No se conecta a
`AttendancePage.tsx` todavía — eso ocurre en la Task 3.

- [ ] **Step 1: Crear el componente**

```tsx
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react'
import { isSessionHappeningNow, type DaySession } from '@/lib/attendance-utils'
import { isSameDay } from '@/lib/agenda-utils'

export interface DaySessionListProps {
  sessions: DaySession[]
  /** Fecha seleccionada, formato 'YYYY-MM-DD'. */
  selectedDate: string
  selectedGroupId: string
  dayAverageAttendance: number | null
  closedSessionsCount: number
  onSelectGroup: (groupId: string) => void
  onSelectPrivate: (privateLessonId: string) => void
  onPreviousDay: () => void
  onNextDay: () => void
  onDateChange: (value: string) => void
}

export function DaySessionList({
  sessions, selectedDate, selectedGroupId, dayAverageAttendance, closedSessionsCount,
  onSelectGroup, onSelectPrivate, onPreviousDay, onNextDay, onDateChange,
}: DaySessionListProps) {
  const isToday = isSameDay(new Date(selectedDate + 'T00:00:00'), new Date())
  const groupSessionsCount = sessions.filter((s) => s.type === 'group').length

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="icon" onClick={onPreviousDay}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              className="h-9 w-[150px] text-sm text-center cursor-pointer"
              value={selectedDate}
              onChange={(e) => { if (e.target.value) onDateChange(e.target.value) }}
            />
            <Button variant="outline" size="icon" onClick={onNextDay}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 px-4">
              No hay sesiones este día.
            </p>
          ) : (
            <div className="divide-y">
              {sessions.map((session) => {
                if (session.type === 'private') {
                  return (
                    <button
                      key={`private-${session.id}`}
                      type="button"
                      onClick={() => onSelectPrivate(session.id)}
                      className="w-full text-left px-4 py-3 hover:bg-accent/30 transition-colors"
                    >
                      <p className="text-sm font-medium truncate">{session.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {session.startTime} · {session.coachName}
                      </p>
                    </button>
                  )
                }

                const isSelected = session.id === selectedGroupId
                const isNow = isToday && !session.hasRecord && isSessionHappeningNow(session.startTime, session.endTime)

                return (
                  <button
                    key={`group-${session.id}`}
                    type="button"
                    onClick={() => onSelectGroup(session.id)}
                    className={`w-full text-left px-4 py-3 transition-colors ${isSelected ? 'bg-primary/10' : 'hover:bg-accent/30'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{session.name}</p>
                      {session.hasRecord ? (
                        <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                      ) : isNow ? (
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-none shrink-0">Ahora</Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground shrink-0">Pendiente</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {session.startTime} · {session.coachName}
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
        {groupSessionsCount > 0 && (
          <div className="border-t px-4 py-3 grid grid-cols-2 gap-2 text-center">
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Asist. media</p>
              <p className="text-lg font-black">
                {dayAverageAttendance === null ? 'Sin datos' : `${dayAverageAttendance}%`}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Cerradas</p>
              <p className="text-lg font-black">{closedSessionsCount}/{sessions.length}</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: sin errores. El componente no se usa todavía desde ningún sitio, es esperado.

- [ ] **Step 3: Commit**

```bash
git add src/components/agenda/DaySessionList.tsx
git commit -m "feat: componente DaySessionList para la vista maestro-detalle de Asistencia"
```

---

### Task 3: Reescribir `AttendancePage.tsx` a maestro-detalle

**Files:**
- Modify: `src/pages/AttendancePage.tsx`

Esta es la tarea principal. Sustituye el selector de grupo/fecha + tabla
inline por el layout maestro-detalle, añade el menú "···" con las acciones
reubicadas, la rejilla compacta de jugadores, y el gráfico de asistencia
semanal. `QuickAttendanceSheet`, `AttendanceCalendar`, `MyAttendanceView`
y los 3 diálogos (recuperación/exportar/clase suelta) NO se tocan en su
contenido — solo cambia qué botón los abre.

- [ ] **Step 1: Añadir imports nuevos**

Cambiar:

```ts
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  UserPlus,
  Calendar,
  Users,
  ClipboardList,
  Save,
  Download,
  RotateCcw,
  Phone,
  Share2,
  CalendarDays,
  Zap,
} from 'lucide-react'
import { formatDate, generateId } from '@/lib/utils'
import { downloadXlsx } from '@/lib/excel'
import type { AttendanceEntry, AttendanceStatus } from '@/types'
import { usePaymentsQuery, useEventPaymentsQuery, usePrivateLessonPaymentsQuery, useAttendanceQuery, useActivitiesQuery, useEvaluationsQuery, useMatchReportsQuery, useInvoicesQuery } from '@/hooks/useQueries'
import { QuickAttendanceSheet } from '@/components/attendance/QuickAttendanceSheet'
import { AttendanceCalendar } from '@/components/attendance/AttendanceCalendar'
import { useNextClass } from '@/hooks/useNextClass'
import { MyAttendanceView } from '@/components/attendance/MyAttendanceView'
```

por:

```ts
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  UserPlus,
  Users,
  Save,
  Download,
  RotateCcw,
  Phone,
  Share2,
  MoreHorizontal,
  History,
  Smartphone,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { downloadXlsx } from '@/lib/excel'
import type { AttendanceEntry, AttendanceStatus } from '@/types'
import { usePaymentsQuery, useEventPaymentsQuery, usePrivateLessonPaymentsQuery, useAttendanceQuery, useActivitiesQuery, useEvaluationsQuery, useMatchReportsQuery, useInvoicesQuery } from '@/hooks/useQueries'
import { QuickAttendanceSheet } from '@/components/attendance/QuickAttendanceSheet'
import { AttendanceCalendar } from '@/components/attendance/AttendanceCalendar'
import { useNextClass } from '@/hooks/useNextClass'
import { MyAttendanceView } from '@/components/attendance/MyAttendanceView'
import { DaySessionList } from '@/components/agenda/DaySessionList'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import { isSameDay } from '@/lib/agenda-utils'
import { getSessionsForDate, getGroupAttendanceByWeek } from '@/lib/attendance-utils'
```

(`Calendar`/`CalendarDays`/`Zap`/`ClipboardList` se quitan del import de
iconos porque ya no se usan tras este task — se usaban solo en el banner
de auto-detección, la cabecera "Pasar lista" y el botón "Pasar Lista" que
se eliminan en el Step 6. `generateId` también se quita: ya estaba
importado sin usarse en el archivo original, antes de este task —
aprovechamos este cambio de import para retirar ese import muerto
preexistente. `History`/`Smartphone` son los iconos nuevos para
las 3 acciones reubicadas al menú "···".)

- [ ] **Step 2: Añadir `privateLessons` a la desestructuración del store**

Cambiar:

```ts
  const { groups, players, enrollments, addAttendanceRecord, updateAttendanceRecord, coaches, attendanceNotices } = useDataStore()
```

por:

```ts
  const { groups, players, enrollments, addAttendanceRecord, updateAttendanceRecord, coaches, attendanceNotices, privateLessons } = useDataStore()
```

- [ ] **Step 3: Sesiones del día, sesión seleccionada y resumen del pie**

Añadir, justo después de `const activeGroups = useMemo(...)` (que ya
existe en el archivo):

```ts
  // Mismo criterio que `activeGroups`: un entrenador solo ve sus propias
  // clases particulares en la lista del dia, no las de otros companeros.
  const visiblePrivateLessons = useMemo(() => {
    if (isEntrenador && currentCoach) {
      return privateLessons.filter((l) => l.coachId === currentCoach.id)
    }
    return privateLessons
  }, [privateLessons, isEntrenador, currentCoach])

  const daySessions = useMemo(
    () => getSessionsForDate(new Date(selectedDate + 'T00:00:00'), activeGroups, visiblePrivateLessons, attendance),
    [selectedDate, activeGroups, visiblePrivateLessons, attendance]
  )

  const selectedSession = useMemo(
    () => daySessions.find((s) => s.type === 'group' && s.id === selectedGroupId) ?? null,
    [daySessions, selectedGroupId]
  )

  const dayAttendanceSummary = useMemo(() => {
    const groupSessions = daySessions.filter((s) => s.type === 'group')
    const closedSessions = groupSessions.filter((s) => s.hasRecord)
    if (closedSessions.length === 0) return { average: null, closedCount: 0 }

    let present = 0
    let total = 0
    for (const session of closedSessions) {
      const record = attendance.find(
        (a) => a.groupId === session.id && isSameDay(new Date(a.date), new Date(selectedDate + 'T00:00:00'))
      )
      if (!record) continue
      for (const entry of record.records) {
        total++
        if (entry.status === 'presente') present++
      }
    }
    return {
      average: total > 0 ? Math.round((present / total) * 100) : null,
      closedCount: closedSessions.length,
    }
  }, [daySessions, attendance, selectedDate])

  const weeklyAttendance = useMemo(() => {
    if (!selectedGroupId) return []
    return getGroupAttendanceByWeek(attendance, selectedGroupId, new Date(selectedDate + 'T00:00:00'))
  }, [attendance, selectedGroupId, selectedDate])
```

- [ ] **Step 4: Quitar el salto directo a `pageView === 'sheet'` de los efectos de auto-navegación**

Cambiar:

```ts
  // ── Auto-navegación por URL params ──────────────────────────────────────
  useEffect(() => {
    if (urlGroupId) {
      setSelectedGroupId(urlGroupId)
      if (urlDate) setSelectedDate(urlDate)
      setPageView('sheet')
    }
  }, [urlGroupId, urlDate])

  // ── Auto-detección de clase próxima (entrenador, 2h ventana) ───────────
  useEffect(() => {
    if (nextClass && !urlGroupId && pageView === 'selector') {
      const todayISO = new Date().toISOString().split('T')[0]
      setSelectedGroupId(nextClass.group.id)
      setSelectedDate(todayISO)
      setPageView('sheet')
    }
  }, [nextClass, urlGroupId])
```

por:

```ts
  // ── Auto-navegación por URL params ──────────────────────────────────────
  // Ya no salta a pageView 'sheet' — el layout maestro-detalle muestra la
  // sesion seleccionada directamente en la pantalla principal.
  useEffect(() => {
    if (urlGroupId) {
      setSelectedGroupId(urlGroupId)
      if (urlDate) setSelectedDate(urlDate)
    }
  }, [urlGroupId, urlDate])

  // ── Auto-deteccion de clase proxima (entrenador, 2h ventana) ────────────
  // Sustituye al antiguo banner "Clase proxima" — la sesion se auto-
  // selecciona y aparece resaltada con el badge "Ahora" en DaySessionList.
  useEffect(() => {
    if (nextClass && !urlGroupId && !selectedGroupId) {
      const todayISO = new Date().toISOString().split('T')[0]
      setSelectedGroupId(nextClass.group.id)
      setSelectedDate(todayISO)
    }
  }, [nextClass, urlGroupId, selectedGroupId])
```

- [ ] **Step 5: Sustituir la carga manual de la hoja por un `useEffect` automático al seleccionar sesión**

Cambiar:

```ts
  // Cuando cambia el grupo o la fecha, reinicializar las entries
  const initializeEntries = () => {
    if (!selectedGroupId) {
      setEntries([])
      setEntriesInitialized(false)
      return
    }

    const newEntries: AttendanceEntry[] = enrolledPlayers.map((p) => ({
      playerId: p.id,
      playerName: p.name,
      status: 'presente' as AttendanceStatus,
      isRecovery: false,
    }))

    setEntries(newEntries)
    setEntriesInitialized(true)
    setSaved(false)
  }

  // Cambiar grupo
  const handleGroupChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const groupId = e.target.value
    setSelectedGroupId(groupId)
    setEntriesInitialized(false)
    setSaved(false)
  }

  // Cambiar fecha
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value)
    setEntriesInitialized(false)
    setSaved(false)
  }

  // Cargar hoja de asistencia
  const handleLoadSheet = () => {
    if (!selectedGroupId) return

    if (existingRecord) {
      // Pre-load existing entries for editing
      setEntries(existingRecord.records)
      setEntriesInitialized(true)
      setSaved(false)
      return
    }

    initializeEntries()
  }
```

por:

```ts
  // Al seleccionar una sesion (cambia selectedGroupId o selectedDate), se
  // carga su hoja de asistencia automaticamente — ya no hace falta un boton
  // "Cargar hoja" manual. Deliberadamente NO se incluyen `existingRecord`/
  // `enrolledPlayers` en las dependencias (mismo patron ya usado en
  // QuickAttendanceSheet.tsx): solo debe re-inicializar cuando cambia la
  // sesion elegida, no cada vez que las entries en curso provocan un
  // recalculo de esos memos.
  useEffect(() => {
    if (!selectedGroupId) {
      setEntries([])
      setEntriesInitialized(false)
      return
    }
    if (existingRecord) {
      setEntries(existingRecord.records)
    } else {
      setEntries(
        enrolledPlayers.map((p) => ({
          playerId: p.id,
          playerName: p.name,
          status: 'presente' as AttendanceStatus,
          isRecovery: false,
        }))
      )
    }
    setEntriesInitialized(true)
    setSaved(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId, selectedDate])
```

- [ ] **Step 6: Reescribir el `return` para roles staff (layout maestro-detalle)**

Cambiar todo el bloque desde `return (` (justo después del `if (pageView
=== 'calendar' && sheetGroup) { ... }`) hasta el cierre `)` antes de los 3
`<Dialog>` finales — es decir, todo el contenido de la vista `'selector'`
para staff (banner de auto-detección, Card de selector, bloque de
`entriesInitialized`, historial de registros, estados vacíos):

```tsx
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 sm:p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Columna izquierda: navegacion de dia + lista de sesiones */}
          <div className="lg:w-80 shrink-0">
            <DaySessionList
              sessions={daySessions}
              selectedDate={selectedDate}
              selectedGroupId={selectedGroupId}
              dayAverageAttendance={dayAttendanceSummary.average}
              closedSessionsCount={dayAttendanceSummary.closedCount}
              onSelectGroup={(groupId) => setSelectedGroupId(groupId)}
              onSelectPrivate={(privateLessonId) => navigate(`/clases-particulares/${privateLessonId}`)}
              onPreviousDay={() => {
                const d = new Date(selectedDate + 'T00:00:00')
                d.setDate(d.getDate() - 1)
                setSelectedDate(d.toISOString().split('T')[0])
              }}
              onNextDay={() => {
                const d = new Date(selectedDate + 'T00:00:00')
                d.setDate(d.getDate() + 1)
                setSelectedDate(d.toISOString().split('T')[0])
              }}
              onDateChange={(value) => setSelectedDate(value)}
            />
          </div>

          {/* Columna derecha: panel de detalle de la sesion seleccionada */}
          <div className="flex-1 min-w-0">
            {entriesInitialized && selectedGroup && selectedSession ? (
              <Card>
                <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-base">{selectedGroup.name}</CardTitle>
                        {selectedSession.hasRecord ? (
                          <Badge className="bg-slate-100 text-slate-600 border-none text-[10px]">Cerrada</Badge>
                        ) : isSameDay(new Date(selectedDate + 'T00:00:00'), new Date()) ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-none text-[10px]">En curso</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700 border-none text-[10px]">Pendiente</Badge>
                        )}
                        <StatusBadge status={selectedGroup.level} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {selectedSession.startTime} - {selectedSession.endTime} · {selectedGroup.courtName} · {selectedGroup.coachName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="text-xs">
                        {selectedGroup.currentEnrollment}/{selectedGroup.maxCapacity}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleMarkAllPresent}
                        className="text-green-600 border-green-200 hover:bg-green-50 rounded-full"
                      >
                        <CheckCircle className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Todos presentes</span>
                      </Button>
                      <Button onClick={handleSave} disabled={saved} className="min-w-[130px]">
                        <Save className="h-4 w-4 mr-2" />
                        {saved ? 'Guardado' : 'Guardar'}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setShowRecoveryDialog(true)}>
                            <RotateCcw className="h-4 w-4 mr-2" /> Añadir recuperación
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setShowOneOffDialog(true)}>
                            <UserPlus className="h-4 w-4 mr-2" /> Añadir clase suelta
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleNotifyFreeSlots}>
                            <Share2 className="h-4 w-4 mr-2" /> Notificar hueco libre
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setPageView('calendar')}>
                            <History className="h-4 w-4 mr-2" /> Ver historial completo
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setPageView('sheet')}>
                            <Smartphone className="h-4 w-4 mr-2" /> Vista de pase rápido
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={handleOpenExportDialog}>
                            <Download className="h-4 w-4 mr-2" /> Exportar a Excel
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-6">
                  {entries.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No hay jugadores inscritos en este grupo.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {entries.map((entry) => {
                        const player = players.find((p) => p.id === entry.playerId)
                        const notice = attendanceNotices.find(
                          (n) =>
                            n.playerId === entry.playerId &&
                            n.groupId === selectedGroupId &&
                            toISODate(n.date) === selectedDate
                        )
                        return (
                          <div
                            key={`${entry.playerId}-${entry.isRecovery ? 'rec' : 'reg'}`}
                            className="relative rounded-xl border bg-card p-3 space-y-2"
                          >
                            {(entry.isRecovery || entry.isOneOff || notice || player?.medicalNotes) && (
                              <div className="absolute -top-2 -right-2 flex gap-1">
                                {entry.isRecovery && (
                                  <span className="h-5 px-1.5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold flex items-center" title="Recuperación">R</span>
                                )}
                                {entry.isOneOff && (
                                  <span className="h-5 px-1.5 rounded-full bg-orange-100 text-orange-700 text-[9px] font-bold flex items-center" title="Clase suelta">S</span>
                                )}
                                {notice && (
                                  <span
                                    className={`h-5 px-1.5 rounded-full text-[9px] font-bold flex items-center animate-pulse ${notice.type === 'absent' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}
                                    title={notice.notes}
                                  >
                                    {notice.type === 'absent' ? '!' : '✓'}
                                  </span>
                                )}
                                {player?.medicalNotes && (
                                  <span className="h-5 w-5 rounded-full bg-red-100 text-red-700 flex items-center justify-center" title={player.medicalNotes}>
                                    <AlertCircle className="h-3 w-3" />
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <div
                                className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                  entry.status === 'presente'
                                    ? 'bg-green-100 text-green-700'
                                    : entry.status === 'ausente'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-yellow-100 text-yellow-700'
                                }`}
                              >
                                {entry.playerName.charAt(0)}
                              </div>
                              <span className="text-sm font-medium truncate">{entry.playerName}</span>
                            </div>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => handleStatusChange(entry.playerId, 'presente')}
                                className={`flex-1 flex items-center justify-center py-1.5 rounded-md border ${
                                  entry.status === 'presente'
                                    ? 'bg-green-100 text-green-700 border-green-300'
                                    : 'bg-background text-muted-foreground border-border hover:bg-green-50'
                                }`}
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStatusChange(entry.playerId, 'ausente')}
                                className={`flex-1 flex items-center justify-center py-1.5 rounded-md border ${
                                  entry.status === 'ausente'
                                    ? 'bg-red-100 text-red-700 border-red-300'
                                    : 'bg-background text-muted-foreground border-border hover:bg-red-50'
                                }`}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStatusChange(entry.playerId, 'justificado')}
                                className={`flex-1 flex items-center justify-center py-1.5 rounded-md border ${
                                  entry.status === 'justificado'
                                    ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
                                    : 'bg-background text-muted-foreground border-border hover:bg-yellow-50'
                                }`}
                              >
                                <AlertCircle className="h-3.5 w-3.5" />
                              </button>
                              {player?.phone && (
                                <a
                                  href={`https://wa.me/${player.phone.replace(/\s+/g, '')}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center justify-center px-1.5 rounded-md text-green-600 hover:bg-green-50 shrink-0"
                                  title="WhatsApp"
                                >
                                  <Phone className="h-3.5 w-3.5" />
                                </a>
                              )}
                              {entry.isRecovery && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRecovery(entry.playerId)}
                                  className="text-muted-foreground hover:text-destructive shrink-0 px-1"
                                  title="Quitar recuperación"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                            <Input
                              placeholder="Notas..."
                              value={entry.notes ?? ''}
                              onChange={(e) => handleNoteChange(entry.playerId, e.target.value)}
                              className="h-7 text-[11px]"
                            />
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {saved && (
                    <div className="flex items-center gap-2 rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
                      <CheckCircle className="h-5 w-5 flex-shrink-0" />
                      <span>
                        Asistencia guardada correctamente. Los créditos de recuperación se han actualizado automáticamente.
                      </span>
                    </div>
                  )}

                  {weeklyAttendance.some((p) => p.rate !== null) && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Asistencia del grupo — últimas 8 semanas</h3>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={weeklyAttendance}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="weekLabel" tick={{ fontSize: 11 }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={32} />
                          <Tooltip
                            formatter={(value: number | null) => (value === null ? 'Sin datos' : `${value}%`)}
                          />
                          <Bar dataKey="rate" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <EmptyState
                icon={Users}
                title="Selecciona una sesión"
                description="Elige una sesión de la lista para pasar o revisar su asistencia."
              />
            )}
          </div>
        </div>
      </div>
```

(El resto del archivo — los 3 `<Dialog>` de recuperación/exportar/clase
suelta — sigue exactamente igual, cierran el mismo `</div>` final del
componente. No se tocan.)

`toISODate` (usada en el `find` de `notice` de arriba) ya está definida al
principio de `AttendancePage.tsx`, no hace falta importarla ni
redefinirla.

- [ ] **Step 7: Verificar que compila**

Run: `npm run build`
Expected: sin errores. Prestar especial atención a que no queden
referencias a `handleGroupChange`/`handleDateChange`/`initializeEntries`/
`handleLoadSheet` (eliminadas en el Step 5) en ningún sitio del archivo.

Run: `npm test`
Expected: mismo número de tests que el baseline + los nuevos de
`attendance-utils.test.ts` de la Task 1 (esta página no tiene tests
dedicados).

- [ ] **Step 8: Verificación manual en navegador**

1. `npm run dev`, sesión como `director`, ir a `/clases/asistencia`.
2. Confirmar que aparece la navegación de día + lista de sesiones a la
   izquierda, con grupos y (si hay alguna ese día) clases particulares.
3. Hacer clic en una sesión de grupo: confirmar que el panel de la derecha
   se carga automáticamente (sin botón "Cargar hoja"), muestra la rejilla
   de jugadores en tarjetas compactas, y el badge de estado correcto
   (Cerrada/En curso/Pendiente).
4. Marcar algunos jugadores como Ausente/Justificado, pulsar "Guardar" —
   confirmar que se guarda, que la sesión pasa a mostrar ✓ en la lista de
   la izquierda, y que el badge de la cabecera cambia a "Cerrada".
5. Confirmar que "Todos presentes" sigue funcionando.
6. Abrir el menú "···" y probar cada acción: Añadir recuperación, Añadir
   clase suelta, Notificar hueco libre (abre WhatsApp), Exportar a Excel —
   todas deben abrir su diálogo/acción exactamente igual que antes.
7. Desde el menú "···", pulsar "Ver historial completo" — confirma que
   entra en la vista `AttendanceCalendar` para ese grupo, y que su botón
   de volver regresa correctamente al layout maestro-detalle.
8. Desde el menú "···", pulsar "Vista de pase rápido" — confirma que entra
   en `QuickAttendanceSheet` para esa sesión, y que su botón de volver
   regresa correctamente.
9. Hacer clic en una fila de "Clase particular" en la lista — confirma que
   navega a `/clases-particulares/:id` (la ficha existente), sin intentar
   abrir ningún panel de asistencia.
10. Navegar de día con las flechas y con el selector de fecha — confirma
    que la lista se actualiza y que, si hay una sesión en curso ahora
    mismo, aparece resaltada con "Ahora" (si además no ha sido guardada).
11. Confirmar que el gráfico de "últimas 8 semanas" aparece cuando el
    grupo tiene al menos un registro de asistencia histórico, y no rompe
    el layout cuando no tiene ninguno (no debe mostrarse el bloque del
    gráfico si `weeklyAttendance.every(p => p.rate === null)`).
12. Repetir como `entrenador`: confirmar que la lista solo muestra sus
    propios grupos Y sus propias clases particulares (filtradas por
    `coachId` vía `visiblePrivateLessons`, igual criterio que
    `activeGroups`) — no las de otros entrenadores.
13. Repetir como `jugador`/`tutor`: confirmar que `MyAttendanceView` sigue
    intacta, sin cambios.
14. Confirmar en la consola del navegador que no hay errores nuevos.

- [ ] **Step 9: Commit**

```bash
git add src/pages/AttendancePage.tsx
git commit -m "feat: reescribir Asistencia a layout maestro-detalle con menu de acciones y grafico semanal"
```

---

### Task 4: Verificación final

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Build y tests completos**

Run: `npm run build`
Expected: sin errores.

Run: `npm test`
Expected: todos los tests pasan, incluidos los nuevos de
`attendance-utils.test.ts`.

- [ ] **Step 2: Recorrido manual completo**

Repetir el recorrido del Step 9 de la Task 3 una vez más de principio a
fin, esta vez sin interrupciones, tomando nota de cualquier detalle visual
que no encaje bien (paridad de alturas entre columnas, scroll, etc.) y
corrigiéndolo si es trivial, o documentándolo como hallazgo si no lo es.

- [ ] **Step 3: Repetir el proceso de `subagent-driven-development`**

Tras completar las Tasks 1-3 (cada una con su implementador + revisor de
spec + revisor de calidad), dispatch un revisor final sobre el diff
completo de este plan. Después, usar
`superpowers:finishing-a-development-branch`.
