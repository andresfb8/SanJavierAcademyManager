# Rediseño UI Clases — Fase C (Parrilla) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el toggle Semana/Día/Mes de Parrilla en real: Semana es una vista nueva que replica el mock (semana Lunes-Sábado, pistas apiladas por celda), Día reutiliza toda la lógica ya probada de `AgendaPage.tsx`, Mes queda deshabilitado. Se añaden filtros de Entrenador/Pista/Nivel compartidos entre ambas vistas y se migra el resumen de estadísticas al componente `StatCard`.

**Architecture:** Se extrae toda la lógica pura de agenda (constantes de horario, cálculo de bloques por pista/fecha, utilidades de semana) a `src/lib/agenda-utils.ts`, reutilizable tanto por `AgendaPage.tsx` (vista Día, ya existente) como por un nuevo componente `src/components/agenda/WeekGrid.tsx` (vista Semana). `AgendaPage.tsx` mantiene el estado y toda la interacción rica de Día; Semana es de solo lectura salvo por "saltar a Día" al hacer clic.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-01-rediseno-ui-clases-fase-c-parrilla-design.md`

---

### Task 1: Extraer lógica pura de agenda a `src/lib/agenda-utils.ts`

**Files:**
- Create: `src/lib/agenda-utils.ts`
- Create: `src/lib/agenda-utils.test.ts`
- Modify: `src/pages/AgendaPage.tsx`

Esta tarea NO cambia el comportamiento visible de la página — es un refactor de extracción. La vista Día debe funcionar exactamente igual que antes al terminar esta tarea.

- [ ] **Step 1: Crear `src/lib/agenda-utils.ts`**

```ts
import type { Group, PrivateLesson, AcademyEvent, Court, AttendanceRecord } from '@/types'
import { PLAYER_LEVELS, EVENT_TYPES } from '@/constants'
import { isGroupCurrentlyActive } from '@/lib/group-utils'

// ==========================================
// Horario de la grilla
// ==========================================

export const START_HOUR = 8
export const END_HOUR = 22
export const SLOT_HEIGHT = 48

function generateTimeSlots(): string[] {
  const slots: string[] = []
  for (let h = START_HOUR; h < END_HOUR; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  return slots
}

export const TIME_SLOTS = generateTimeSlots()

export const LEVEL_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  iniciacion: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-800' },
  intermedio: { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-800' },
  avanzado: { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-800' },
  competicion: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-800' },
  menores: { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-800' },
}

export function timeToSlotIndex(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h - START_HOUR) * 2 + (m >= 30 ? 1 : 0)
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// ==========================================
// Semana
// ==========================================

/** Lunes (00:00) de la semana que contiene `date`. */
export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0=Dom, 1=Lun, ..., 6=Sáb
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** "25 - 30 ago" si caen en el mismo mes, "31 ago - 5 sept" si cruzan de mes. */
export function formatWeekLabel(weekStart: Date, weekEnd: Date): string {
  const startDay = weekStart.getDate()
  const endDay = weekEnd.getDate()
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth()
  const monthFmt = (d: Date) => new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(d).replace('.', '')
  if (sameMonth) return `${startDay} - ${endDay} ${monthFmt(weekEnd)}`
  return `${startDay} ${monthFmt(weekStart)} - ${endDay} ${monthFmt(weekEnd)}`
}

// ==========================================
// Bloques de la grilla (grupos, particulares, eventos)
// ==========================================

export interface GridBlock {
  type: 'group' | 'private' | 'event'
  id: string
  startSlot: number
  endSlot: number
  groupName?: string
  level?: string
  levelLabel?: string
  coachName?: string
  enrollment?: number
  maxCapacity?: number
  playerNames?: string[]
  price?: number
  notes?: string
  eventName?: string
  eventType?: string
  eventTypeLabel?: string
  attendanceStats?: {
    present: number
    absent: number
    justified: number
  } | null
  coachId?: string
}

export interface ComputeBlocksParams {
  date: Date
  /** Pistas a incluir en el resultado (ya filtradas por el filtro de Pista si corresponde). */
  courts: Court[]
  groups: Group[]
  privateLessons: PrivateLesson[]
  events: AcademyEvent[]
  attendance: AttendanceRecord[]
  /** id de entrenador; '' o ausente = sin filtro. No aplica a eventos (pueden tener varios). */
  coachFilter?: string
  /** valor de PlayerLevel; '' o ausente = sin filtro. No aplica a particulares/eventos (no tienen nivel). */
  levelFilter?: string
}

/**
 * Calcula, para una fecha concreta, los bloques (grupo/particular/evento) que
 * caen ese día, indexados por pista. Usada tanto por la vista Día (una
 * llamada, con `date = selectedDate`) como por la vista Semana (una llamada
 * por cada uno de los 6 días de la semana).
 */
export function computeBlocksByCourtForDate(params: ComputeBlocksParams): Record<string, GridBlock[]> {
  const { date, courts, groups, privateLessons, events, attendance, coachFilter = '', levelFilter = '' } = params
  const dayOfWeek = date.getDay()
  const map: Record<string, GridBlock[]> = {}
  for (const court of courts) { map[court.id] = [] }

  // 1. Grupos
  for (const group of groups) {
    if (!isGroupCurrentlyActive(group, date)) continue
    if (coachFilter && group.coachId !== coachFilter) continue
    if (levelFilter && group.level !== levelFilter) continue
    for (const slot of group.schedule) {
      if (slot.dayOfWeek !== dayOfWeek) continue
      if (!map[group.courtId]) continue
      const levelInfo = PLAYER_LEVELS.find((l) => l.value === group.level)

      const attendanceForDate = attendance.find((a) => {
        return a.groupId === group.id && isSameDay(new Date(a.date), date)
      })

      const attendanceStats = attendanceForDate ? {
        present: attendanceForDate.records.filter((r) => r.status === 'presente').length,
        absent: attendanceForDate.records.filter((r) => r.status === 'ausente').length,
        justified: attendanceForDate.records.filter((r) => r.status === 'justificado').length,
      } : null

      map[group.courtId].push({
        type: 'group', id: group.id,
        startSlot: timeToSlotIndex(slot.startTime), endSlot: timeToSlotIndex(slot.endTime),
        groupName: group.name, level: group.level, levelLabel: levelInfo?.label ?? group.level,
        coachName: group.coachName, enrollment: group.currentEnrollment, maxCapacity: group.maxCapacity,
        attendanceStats,
        coachId: group.coachId,
      })
    }
  }

  // 2. Clases particulares
  for (const lesson of privateLessons) {
    if (coachFilter && lesson.coachId !== coachFilter) continue
    const lessonDate = lesson.date instanceof Date ? lesson.date : new Date(lesson.date)
    if (!isSameDay(lessonDate, date)) continue
    if (!map[lesson.courtId]) continue
    map[lesson.courtId].push({
      type: 'private', id: lesson.id,
      startSlot: timeToSlotIndex(lesson.startTime), endSlot: timeToSlotIndex(lesson.endTime),
      coachName: lesson.coachName, playerNames: lesson.playerNames, price: lesson.price, notes: lesson.notes,
      coachId: lesson.coachId,
    })
  }

  // 3. Eventos
  for (const event of events) {
    if (!event.isActive) continue
    const eventDate = event.date instanceof Date ? event.date : new Date(event.date)
    if (!isSameDay(eventDate, date)) continue
    const typeInfo = EVENT_TYPES.find((t) => t.value === event.type)
    for (const courtId of event.courtIds) {
      if (!map[courtId]) continue
      map[courtId].push({
        type: 'event', id: event.id,
        startSlot: timeToSlotIndex(event.startTime), endSlot: timeToSlotIndex(event.endTime),
        eventName: event.name, eventType: event.type, eventTypeLabel: typeInfo?.label ?? event.type,
        coachName: event.coachNames.join(', '), playerNames: event.attendeePlayerNames, price: event.price,
      })
    }
  }

  return map
}
```

- [ ] **Step 2: Crear `src/lib/agenda-utils.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import {
  getWeekStart, addDays, formatWeekLabel, timeToSlotIndex, isSameDay,
  computeBlocksByCourtForDate, START_HOUR,
} from '@/lib/agenda-utils'
import type { Group, PrivateLesson, AcademyEvent, Court, AttendanceRecord } from '@/types'

describe('getWeekStart', () => {
  it('siempre devuelve un Lunes', () => {
    for (let i = 0; i < 14; i++) {
      const d = new Date(2026, 0, 1 + i)
      expect(getWeekStart(d).getDay()).toBe(1)
    }
  })

  it('no avanza el dia si la fecha ya es Lunes, y resetea la hora a 00:00', () => {
    let probe = new Date(2026, 5, 1)
    while (probe.getDay() !== 1) probe.setDate(probe.getDate() + 1)
    const monday = new Date(probe)
    monday.setHours(15, 30, 0, 0)
    const result = getWeekStart(monday)
    expect(result.getDay()).toBe(1)
    expect(result.getDate()).toBe(monday.getDate())
    expect(result.getHours()).toBe(0)
  })

  it('retrocede como mucho 6 dias', () => {
    const d = new Date(2026, 3, 10)
    const result = getWeekStart(d)
    const diffDays = (d.getTime() - result.getTime()) / (1000 * 60 * 60 * 24)
    expect(diffDays).toBeGreaterThanOrEqual(0)
    expect(diffDays).toBeLessThan(7)
  })
})

describe('addDays', () => {
  it('suma dias', () => {
    const d = new Date(2026, 0, 1)
    expect(addDays(d, 5).getDate()).toBe(6)
  })

  it('resta dias con numeros negativos', () => {
    const d = new Date(2026, 0, 10)
    expect(addDays(d, -3).getDate()).toBe(7)
  })
})

describe('formatWeekLabel', () => {
  it('formatea el rango cuando ambos extremos caen en el mismo mes', () => {
    const start = new Date(2026, 7, 24)
    const end = new Date(2026, 7, 29)
    const month = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(end).replace('.', '')
    expect(formatWeekLabel(start, end)).toBe(`24 - 29 ${month}`)
  })

  it('formatea el rango cuando cruza de mes', () => {
    const start = new Date(2026, 7, 31)
    const end = new Date(2026, 8, 5)
    const startMonth = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(start).replace('.', '')
    const endMonth = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(end).replace('.', '')
    expect(formatWeekLabel(start, end)).toBe(`31 ${startMonth} - 5 ${endMonth}`)
  })
})

describe('timeToSlotIndex', () => {
  it('la hora de inicio de la grilla es el slot 0', () => {
    expect(timeToSlotIndex(`${String(START_HOUR).padStart(2, '0')}:00`)).toBe(0)
  })

  it('la media hora siguiente es el slot 1', () => {
    expect(timeToSlotIndex(`${String(START_HOUR).padStart(2, '0')}:30`)).toBe(1)
  })
})

describe('isSameDay', () => {
  it('es true para la misma fecha con horas distintas', () => {
    expect(isSameDay(new Date(2026, 2, 10, 8, 0), new Date(2026, 2, 10, 20, 0))).toBe(true)
  })

  it('es false para dias distintos', () => {
    expect(isSameDay(new Date(2026, 2, 10), new Date(2026, 2, 11))).toBe(false)
  })
})

// ==========================================
// Fixtures para computeBlocksByCourtForDate
// ==========================================

function makeCourt(overrides: Partial<Court> = {}): Court {
  return { id: 'court-1', name: 'Pista 1', type: 'indoor', surface: 'cristal', isActive: true, order: 1, ...overrides }
}

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 'group-1', name: 'Grupo Test', level: 'iniciacion',
    coachId: 'coach-1', coachName: 'Coach Uno', courtId: 'court-1', courtName: 'Pista 1',
    schedule: [{ dayOfWeek: 1, startTime: '09:00', endTime: '10:00' }],
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
    date: new Date(2026, 2, 9), startTime: '09:00', endTime: '10:00',
    price: 30, isPaid: false, createdAt: new Date(2026, 2, 1),
    ...overrides,
  }
}

function makeEvent(overrides: Partial<AcademyEvent> = {}): AcademyEvent {
  return {
    id: 'event-1', name: 'Torneo Test', type: 'mini_torneo',
    date: new Date(2026, 2, 9), startTime: '09:00', endTime: '11:00',
    courtIds: ['court-1'], courtNames: ['Pista 1'],
    coachIds: ['coach-1'], coachNames: ['Coach Uno'],
    attendeePlayerIds: [], attendeePlayerNames: [],
    price: 10, attendeePrices: {}, vatRate: 21, isActive: true,
    createdAt: new Date(2026, 2, 1),
    ...overrides,
  }
}

const noAttendance: AttendanceRecord[] = []

describe('computeBlocksByCourtForDate', () => {
  // 9 marzo 2026 es Lunes.
  const monday = new Date(2026, 2, 9)

  it('incluye un grupo cuyo horario coincide con el dia de la semana', () => {
    const result = computeBlocksByCourtForDate({
      date: monday, courts: [makeCourt()], groups: [makeGroup()],
      privateLessons: [], events: [], attendance: noAttendance,
    })
    expect(result['court-1']).toHaveLength(1)
    expect(result['court-1'][0].type).toBe('group')
  })

  it('excluye un grupo cuyo horario no coincide con el dia de la semana', () => {
    const tuesdayGroup = makeGroup({ schedule: [{ dayOfWeek: 2, startTime: '09:00', endTime: '10:00' }] })
    const result = computeBlocksByCourtForDate({
      date: monday, courts: [makeCourt()], groups: [tuesdayGroup],
      privateLessons: [], events: [], attendance: noAttendance,
    })
    expect(result['court-1']).toHaveLength(0)
  })

  it('excluye un grupo fuera de su rango de fechas', () => {
    const oldGroup = makeGroup({ startDate: new Date(2020, 0, 1), endDate: new Date(2020, 11, 31) })
    const result = computeBlocksByCourtForDate({
      date: monday, courts: [makeCourt()], groups: [oldGroup],
      privateLessons: [], events: [], attendance: noAttendance,
    })
    expect(result['court-1']).toHaveLength(0)
  })

  it('aplica coachFilter a grupos y particulares pero no a eventos', () => {
    const result = computeBlocksByCourtForDate({
      date: monday, courts: [makeCourt()],
      groups: [makeGroup({ coachId: 'other-coach' })],
      privateLessons: [makeLesson({ coachId: 'other-coach' })],
      events: [makeEvent({ coachIds: ['other-coach'], coachNames: ['Otro Coach'] })],
      attendance: noAttendance,
      coachFilter: 'coach-1',
    })
    const types = result['court-1'].map((b) => b.type)
    expect(types).toEqual(['event'])
  })

  it('aplica levelFilter solo a grupos', () => {
    const result = computeBlocksByCourtForDate({
      date: monday, courts: [makeCourt()],
      groups: [makeGroup({ level: 'avanzado' })],
      privateLessons: [makeLesson()],
      events: [],
      attendance: noAttendance,
      levelFilter: 'iniciacion',
    })
    expect(result['court-1']).toHaveLength(1)
    expect(result['court-1'][0].type).toBe('private')
  })

  it('un evento aparece en cada pista listada en courtIds', () => {
    const court2 = makeCourt({ id: 'court-2', name: 'Pista 2' })
    const result = computeBlocksByCourtForDate({
      date: monday, courts: [makeCourt(), court2],
      groups: [], privateLessons: [],
      events: [makeEvent({ courtIds: ['court-1', 'court-2'] })],
      attendance: noAttendance,
    })
    expect(result['court-1']).toHaveLength(1)
    expect(result['court-2']).toHaveLength(1)
  })

  it('calcula attendanceStats cuando hay un registro de asistencia para ese grupo y fecha', () => {
    const attendance: AttendanceRecord[] = [{
      id: 'att-1', groupId: 'group-1', groupName: 'Grupo Test', date: monday,
      records: [
        { playerId: 'p1', playerName: 'A', status: 'presente', isRecovery: false },
        { playerId: 'p2', playerName: 'B', status: 'ausente', isRecovery: false },
      ],
      coachId: 'coach-1', createdAt: monday,
    } as AttendanceRecord]
    const result = computeBlocksByCourtForDate({
      date: monday, courts: [makeCourt()], groups: [makeGroup()],
      privateLessons: [], events: [], attendance,
    })
    expect(result['court-1'][0].attendanceStats).toEqual({ present: 1, absent: 1, justified: 0 })
  })

  it('attendanceStats es null cuando no hay registro para esa fecha', () => {
    const result = computeBlocksByCourtForDate({
      date: monday, courts: [makeCourt()], groups: [makeGroup()],
      privateLessons: [], events: [], attendance: noAttendance,
    })
    expect(result['court-1'][0].attendanceStats).toBeNull()
  })
})
```

- [ ] **Step 3: Ejecutar los tests nuevos**

Run: `npm test -- agenda-utils`
Expected: todos los tests de `agenda-utils.test.ts` en verde.

- [ ] **Step 4: Refactorizar `AgendaPage.tsx` para usar `agenda-utils.ts`**

Cambiar el bloque de imports (líneas 1-21 del archivo original):

```ts
import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import type { ClasesOutletContext } from '@/components/layout/ClasesLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { AttendanceQuickDialog } from '@/components/attendance/AttendanceQuickDialog'
import { useDataStore } from '@/stores/dataStore'
import { useAuthStore } from '@/stores/authStore'
import { ChevronLeft, ChevronRight, Plus, Clock, Users, MapPin, CalendarPlus, Star, X, Edit2, Trash2, Euro, Calendar as CalendarIcon } from 'lucide-react'
import { DAYS_OF_WEEK, PLAYER_LEVELS, EVENT_TYPES, PAYMENT_METHODS } from '@/constants'
import { formatCurrency } from '@/lib/utils'
import { isGroupCurrentlyActive } from '@/lib/group-utils'
import type { PrivateLesson, EventType } from '@/types'
import { usePaymentsQuery, useEventPaymentsQuery, usePrivateLessonPaymentsQuery, useAttendanceQuery, useActivitiesQuery, useEvaluationsQuery, useMatchReportsQuery, useInvoicesQuery } from '@/hooks/useQueries'
```

por:

```ts
import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import type { ClasesOutletContext } from '@/components/layout/ClasesLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { AttendanceQuickDialog } from '@/components/attendance/AttendanceQuickDialog'
import { useDataStore } from '@/stores/dataStore'
import { useAuthStore } from '@/stores/authStore'
import { ChevronLeft, ChevronRight, Plus, Clock, Users, MapPin, CalendarPlus, Star, X, Edit2, Trash2, Euro, Calendar as CalendarIcon } from 'lucide-react'
import { DAYS_OF_WEEK, PLAYER_LEVELS, EVENT_TYPES, PAYMENT_METHODS } from '@/constants'
import { formatCurrency } from '@/lib/utils'
import {
  START_HOUR, END_HOUR, SLOT_HEIGHT, TIME_SLOTS, LEVEL_COLORS,
  isSameDay, timeToSlotIndex, computeBlocksByCourtForDate,
  type GridBlock,
} from '@/lib/agenda-utils'
import type { PrivateLesson, EventType } from '@/types'
import { usePaymentsQuery, useEventPaymentsQuery, usePrivateLessonPaymentsQuery, useAttendanceQuery, useActivitiesQuery, useEvaluationsQuery, useMatchReportsQuery, useInvoicesQuery } from '@/hooks/useQueries'
```

(Nota: se quita `import { isGroupCurrentlyActive } from '@/lib/group-utils'` porque ya no se usa directamente en este archivo — ahora vive dentro de `computeBlocksByCourtForDate`.)

Cambiar el bloque completo de constantes/tipos locales (desde `const START_HOUR = 8` hasta el cierre de la interfaz `GridBlock`, es decir todo el contenido entre los comentarios `// Constantes de la agenda` y `// Componente principal`):

```ts
// ==========================================
// Constantes de la agenda
// ==========================================

const START_HOUR = 8
const END_HOUR = 22
const SLOT_HEIGHT = 48

function generateTimeSlots(): string[] {
  const slots: string[] = []
  for (let h = START_HOUR; h < END_HOUR; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  return slots
}

const TIME_SLOTS = generateTimeSlots()

const LEVEL_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  iniciacion: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-800' },
  intermedio: { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-800' },
  avanzado: { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-800' },
  competicion: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-800' },
  menores: { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-800' },
}

function timeToSlotIndex(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h - START_HOUR) * 2 + (m >= 30 ? 1 : 0)
}

function formatDateLong(date: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(date)
}

function toInputDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// ==========================================
// Tipo interno para bloques en la grilla
// ==========================================

interface GridBlock {
  type: 'group' | 'private' | 'event'
  id: string
  startSlot: number
  endSlot: number
  groupName?: string
  level?: string
  levelLabel?: string
  coachName?: string
  enrollment?: number
  maxCapacity?: number
  playerNames?: string[]
  price?: number
  notes?: string
  eventName?: string
  eventType?: string
  eventTypeLabel?: string
  attendanceStats?: {
    present: number
    absent: number
    justified: number
  } | null
  coachId?: string
}
```

por (se quitan las definiciones que ahora vienen de `agenda-utils.ts`, se conservan solo `formatDateLong`/`toInputDate` que siguen siendo exclusivas de esta página):

```ts
// ==========================================
// Utilidades locales de esta pagina
// ==========================================

function formatDateLong(date: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(date)
}

function toInputDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
```

Cambiar el `useMemo` de `blocksByCourt` (dentro del componente):

```ts
  const blocksByCourt = useMemo(() => {
    const map: Record<string, GridBlock[]> = {}
    for (const court of activeCourts) { map[court.id] = [] }

    // 1. Grupos
    for (const group of groups) {
      if (!isGroupCurrentlyActive(group, selectedDate)) continue
      for (const slot of group.schedule) {
        if (slot.dayOfWeek !== selectedDayOfWeek) continue
        if (!map[group.courtId]) continue
        const levelInfo = PLAYER_LEVELS.find((l) => l.value === group.level)

        // Calcular estadísticas de asistencia para esta fecha
        const attendanceForDate = attendance.find(a => {
          return a.groupId === group.id && isSameDay(new Date(a.date), selectedDate)
        })

        const attendanceStats = attendanceForDate ? {
          present: attendanceForDate.records.filter(r => r.status === 'presente').length,
          absent: attendanceForDate.records.filter(r => r.status === 'ausente').length,
          justified: attendanceForDate.records.filter(r => r.status === 'justificado').length,
        } : null

        map[group.courtId].push({
          type: 'group', id: group.id,
          startSlot: timeToSlotIndex(slot.startTime), endSlot: timeToSlotIndex(slot.endTime),
          groupName: group.name, level: group.level, levelLabel: levelInfo?.label ?? group.level,
          coachName: group.coachName, enrollment: group.currentEnrollment, maxCapacity: group.maxCapacity,
          attendanceStats,
          coachId: group.coachId,
        })
      }
    }

    // 2. Clases particulares
    for (const lesson of privateLessons) {
      const lessonDate = lesson.date instanceof Date ? lesson.date : new Date(lesson.date)
      if (!isSameDay(lessonDate, selectedDate)) continue
      if (!map[lesson.courtId]) continue
      map[lesson.courtId].push({
        type: 'private', id: lesson.id,
        startSlot: timeToSlotIndex(lesson.startTime), endSlot: timeToSlotIndex(lesson.endTime),
        coachName: lesson.coachName, playerNames: lesson.playerNames, price: lesson.price, notes: lesson.notes,
        coachId: lesson.coachId,
      })
    }

    // 3. Eventos
    for (const event of events) {
      if (!event.isActive) continue
      const eventDate = event.date instanceof Date ? event.date : new Date(event.date)
      if (!isSameDay(eventDate, selectedDate)) continue
      const typeInfo = EVENT_TYPES.find((t) => t.value === event.type)
      for (const courtId of event.courtIds) {
        if (!map[courtId]) continue
        map[courtId].push({
          type: 'event', id: event.id,
          startSlot: timeToSlotIndex(event.startTime), endSlot: timeToSlotIndex(event.endTime),
          eventName: event.name, eventType: event.type, eventTypeLabel: typeInfo?.label ?? event.type,
          coachName: event.coachNames.join(', '), playerNames: event.attendeePlayerNames, price: event.price,
        })
      }
    }

    return map
  }, [groups, privateLessons, events, activeCourts, selectedDate, selectedDayOfWeek])
```

por:

```ts
  const blocksByCourt = useMemo(() => {
    return computeBlocksByCourtForDate({
      date: selectedDate,
      courts: activeCourts,
      groups,
      privateLessons,
      events,
      attendance,
    })
  }, [groups, privateLessons, events, activeCourts, selectedDate, attendance])
```

`selectedDayOfWeek` (declarado justo antes, `const selectedDayOfWeek = selectedDate.getDay()`) NO se toca — sigue haciendo falta para `dayLabel` un poco más abajo en el archivo.

- [ ] **Step 5: Verificar que compila y que los tests existentes siguen pasando**

Run: `npm run build`
Expected: sin errores. Si TypeScript se queja de tipos en `computeBlocksByCourtForDate` (por ejemplo porque `events`/`groups`/`privateLessons` del store no coinciden exactamente con `AcademyEvent[]`/`Group[]`/`PrivateLesson[]`), ajustar los tipos en `agenda-utils.ts` para que coincidan con los reales de `@/types` y `useDataStore()` — no forzar con `as any`.

Run: `npm test`
Expected: todos los tests pasan (los preexistentes + los nuevos de `agenda-utils.test.ts`).

- [ ] **Step 6: Verificación manual en navegador (regresión de Día)**

1. `npm run dev`, sesión como `director`, ir a `/clases/parrilla`.
2. Confirmar que la vista actual (día único, columnas por pista) se sigue viendo y comportando exactamente igual que antes: navegar con las flechas de día, seleccionar una fecha con el date-picker, pulsar "Hoy".
3. Hacer clic en un bloque de grupo → se abre `AttendanceQuickDialog`. Hacer clic en un hueco vacío → se abre el diálogo de nueva clase particular. Si hay algún evento o clase particular ese día, confirmar que sus clics siguen abriendo su diálogo/detalle correspondiente.
4. Confirmar en la consola del navegador que no hay errores nuevos.

- [ ] **Step 7: Commit**

```bash
git add src/lib/agenda-utils.ts src/lib/agenda-utils.test.ts src/pages/AgendaPage.tsx
git commit -m "refactor: extraer logica pura de agenda a src/lib/agenda-utils.ts"
```

---

### Task 2: Crear `src/components/agenda/WeekGrid.tsx`

**Files:**
- Create: `src/components/agenda/WeekGrid.tsx`

Este componente es nuevo y no se usa todavía desde ningún sitio (se conecta en la Task 3). Es puramente presentacional: recibe los datos ya calculados y filtrados, no llama a `useDataStore` ni gestiona estado propio salvo el necesario para su propio render.

- [ ] **Step 1: Crear el componente**

```tsx
import { Card, CardContent } from '@/components/ui/card'
import { Clock } from 'lucide-react'
import type { Court } from '@/types'
import { START_HOUR, END_HOUR, LEVEL_COLORS, type GridBlock } from '@/lib/agenda-utils'

const ENTRY_HEIGHT = 22
const MIN_ROW_HEIGHT = 32

interface WeekCellEntry {
  courtOrder: number
  courtName: string
  block: GridBlock
}

function getWeekCellEntries(
  blocksByCourt: Record<string, GridBlock[]>,
  courts: Court[],
  hourSlotIdx: number
): WeekCellEntry[] {
  const entries: WeekCellEntry[] = []
  courts.forEach((court, i) => {
    const blocks = blocksByCourt[court.id] ?? []
    const block = blocks.find((b) => b.startSlot === hourSlotIdx)
    if (block) entries.push({ courtOrder: i + 1, courtName: court.name, block })
  })
  return entries
}

function getBlockClasses(block: GridBlock): string {
  if (block.type === 'group') {
    const colors = LEVEL_COLORS[block.level ?? ''] ?? LEVEL_COLORS.iniciacion
    return `${colors.bg} ${colors.text} border ${colors.border}`
  }
  if (block.type === 'private') return 'bg-amber-50 text-amber-800 border border-amber-300'
  return 'bg-teal-50 text-teal-800 border border-teal-400'
}

function getBlockLabel(block: GridBlock): string {
  if (block.type === 'group') return block.groupName ?? ''
  if (block.type === 'private') return `Particular${block.playerNames?.[0] ? ': ' + block.playerNames[0] : ''}`
  return block.eventName ?? ''
}

const DAY_HEADER_FORMAT = new Intl.DateTimeFormat('es-ES', { weekday: 'short' })

export interface WeekGridProps {
  /** 6 fechas, Lunes a Sábado, en orden. */
  weekDays: Date[]
  /** Pistas a mostrar (ya filtradas por el filtro de Pista si corresponde), en orden estable. */
  activeCourts: Court[]
  /** Un elemento por cada fecha de `weekDays`, en el mismo orden. */
  blocksByCourtByDay: Record<string, GridBlock[]>[]
  /** Se llama al hacer clic en cualquier bloque o cabecera de dia. */
  onSelectDay: (date: Date) => void
}

export function WeekGrid({ weekDays, activeCourts, blocksByCourtByDay, onSelectDay }: WeekGridProps) {
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

  if (activeCourts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No hay pistas activas configuradas.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <div className="grid min-w-[700px]" style={{ gridTemplateColumns: '70px repeat(6, 1fr)' }}>
            <div className="sticky top-0 z-10 border-b border-r bg-muted/50 px-2 py-3 text-xs font-medium text-muted-foreground flex items-center justify-center">
              <Clock className="h-3.5 w-3.5" />
            </div>
            {weekDays.map((day) => (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => onSelectDay(day)}
                className="sticky top-0 z-10 border-b border-l px-2 py-3 text-center hover:bg-muted/70 transition-colors cursor-pointer"
              >
                <p className="text-xs font-semibold uppercase text-muted-foreground">{DAY_HEADER_FORMAT.format(day)}</p>
                <p className="text-sm font-bold">{day.getDate()}</p>
              </button>
            ))}

            {hours.map((h) => {
              const hourSlotIdx = (h - START_HOUR) * 2
              const entriesPerDay = weekDays.map((_, dayIdx) =>
                getWeekCellEntries(blocksByCourtByDay[dayIdx], activeCourts, hourSlotIdx)
              )
              const maxEntries = Math.max(1, ...entriesPerDay.map((e) => e.length))
              const rowHeight = Math.max(MIN_ROW_HEIGHT, maxEntries * ENTRY_HEIGHT + 8)

              return (
                <div key={`row-${h}`} className="contents">
                  <div
                    className="border-t border-r px-2 flex items-start justify-end pt-1 text-xs font-mono text-muted-foreground"
                    style={{ height: rowHeight }}
                  >
                    {String(h).padStart(2, '0')}:00
                  </div>
                  {weekDays.map((day, dayIdx) => {
                    const entries = entriesPerDay[dayIdx]
                    return (
                      <div
                        key={`${day.toISOString()}-${h}`}
                        className="border-t border-l px-1 py-1 space-y-0.5 hover:bg-muted/20 cursor-pointer transition-colors"
                        style={{ height: rowHeight }}
                        onClick={() => onSelectDay(day)}
                      >
                        {entries.map(({ courtOrder, courtName, block }) => (
                          <div
                            key={`${block.type}-${block.id}`}
                            title={courtName}
                            className={`rounded px-1 text-[10px] leading-tight truncate ${getBlockClasses(block)}`}
                            style={{ height: ENTRY_HEIGHT - 2 }}
                          >
                            <span className="font-semibold">P{courtOrder}</span> {getBlockLabel(block)}
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: sin errores. El componente no se importa desde ningún sitio todavía, así que si el bundler avisa de "unused export" (no debería, ya que es una exportación de módulo válida) no es un error real.

- [ ] **Step 3: Commit**

```bash
git add src/components/agenda/WeekGrid.tsx
git commit -m "feat: componente WeekGrid para la vista Semana de Parrilla"
```

---

### Task 3: Integrar el toggle Semana/Día/Mes, filtros y resumen en `AgendaPage.tsx`

**Files:**
- Modify: `src/pages/AgendaPage.tsx`

Esta es la tarea principal de la fase: añade el estado y la UI del toggle de vista, los 3 filtros nuevos, migra el resumen a `StatCard`, y conecta `WeekGrid`. Los diálogos de crear/editar clase particular y evento (todo lo que hay después de `{/* Dialogo: Nueva clase particular */}`) NO se tocan — sus selects de Pista siguen usando `activeCourts` (la lista completa, sin filtrar), porque al crear una clase hay que poder elegir cualquier pista del club, no solo la que esté seleccionada en el filtro de Parrilla.

- [ ] **Step 1: Añadir imports nuevos**

Cambiar la línea de import de `agenda-utils` (añadida en la Task 1):

```ts
import {
  START_HOUR, END_HOUR, SLOT_HEIGHT, TIME_SLOTS, LEVEL_COLORS,
  isSameDay, timeToSlotIndex, computeBlocksByCourtForDate,
  type GridBlock,
} from '@/lib/agenda-utils'
```

por:

```ts
import {
  START_HOUR, END_HOUR, SLOT_HEIGHT, TIME_SLOTS, LEVEL_COLORS,
  isSameDay, timeToSlotIndex, computeBlocksByCourtForDate,
  getWeekStart, addDays, formatWeekLabel,
  type GridBlock,
} from '@/lib/agenda-utils'
```

Añadir, junto al resto de imports de componentes:

```ts
import { WeekGrid } from '@/components/agenda/WeekGrid'
import { StatCard } from '@/components/shared/StatCard'
```

- [ ] **Step 2: Añadir estado nuevo**

Cambiar:

```ts
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [dialogOpen, setDialogOpen] = useState(false)
```

por:

```ts
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [viewMode, setViewMode] = useState<'semana' | 'dia'>('semana')
  const [coachFilter, setCoachFilter] = useState('')
  const [courtFilter, setCourtFilter] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
```

- [ ] **Step 3: Derivar pistas filtradas, filtro de entrenador efectivo, semana y bloques**

Cambiar:

```ts
  const activeCourts = useMemo(() => {
    return courts
      .filter((c) => c.isActive)
      .sort((a, b) => {
        const orderA = a.order ?? 9999
        const orderB = b.order ?? 9999
        if (orderA !== orderB) return orderA - orderB
        return a.name.localeCompare(b.name)
      })
  }, [courts])
  const selectedDayOfWeek = selectedDate.getDay()

  const blocksByCourt = useMemo(() => {
    return computeBlocksByCourtForDate({
      date: selectedDate,
      courts: activeCourts,
      groups,
      privateLessons,
      events,
      attendance,
    })
  }, [groups, privateLessons, events, activeCourts, selectedDate, attendance])
```

por:

```ts
  const activeCourts = useMemo(() => {
    return courts
      .filter((c) => c.isActive)
      .sort((a, b) => {
        const orderA = a.order ?? 9999
        const orderB = b.order ?? 9999
        if (orderA !== orderB) return orderA - orderB
        return a.name.localeCompare(b.name)
      })
  }, [courts])
  const selectedDayOfWeek = selectedDate.getDay()

  // Pistas realmente renderizadas en la grilla (Día y Semana) — respeta el
  // filtro de Pista. Los dialogos de crear clase/evento siguen usando
  // `activeCourts` sin filtrar, porque ahi se puede elegir cualquier pista.
  const renderedCourts = useMemo(
    () => (courtFilter ? activeCourts.filter((c) => c.id === courtFilter) : activeCourts),
    [activeCourts, courtFilter]
  )

  const effectiveCoachFilter = isEntrenador ? (currentCoachId ?? '') : coachFilter

  const blocksByCourt = useMemo(() => {
    return computeBlocksByCourtForDate({
      date: selectedDate,
      courts: renderedCourts,
      groups,
      privateLessons,
      events,
      attendance,
      coachFilter: effectiveCoachFilter,
      levelFilter,
    })
  }, [groups, privateLessons, events, renderedCourts, selectedDate, attendance, effectiveCoachFilter, levelFilter])

  const weekStart = useMemo(() => getWeekStart(selectedDate), [selectedDate])
  const weekEnd = useMemo(() => addDays(weekStart, 5), [weekStart])
  const weekDays = useMemo(
    () => Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )

  const blocksByCourtByDay = useMemo(() => {
    return weekDays.map((day) =>
      computeBlocksByCourtForDate({
        date: day,
        courts: renderedCourts,
        groups,
        privateLessons,
        events,
        attendance,
        coachFilter: effectiveCoachFilter,
        levelFilter,
      })
    )
  }, [weekDays, renderedCourts, groups, privateLessons, events, attendance, effectiveCoachFilter, levelFilter])
```

`isEntrenador` y `currentCoachId` ya existen más arriba en el archivo (líneas 108-134 del original) — no hace falta declararlos de nuevo.

- [ ] **Step 4: Añadir navegación de semana y "saltar a Día"**

Cambiar:

```ts
  function goToPreviousDay() { setSelectedDate((prev) => { const d = new Date(prev); d.setDate(d.getDate() - 1); return d }) }
  function goToNextDay() { setSelectedDate((prev) => { const d = new Date(prev); d.setDate(d.getDate() + 1); return d }) }
  function goToToday() { setSelectedDate(new Date()) }
```

por:

```ts
  function goToPreviousDay() { setSelectedDate((prev) => { const d = new Date(prev); d.setDate(d.getDate() - 1); return d }) }
  function goToNextDay() { setSelectedDate((prev) => { const d = new Date(prev); d.setDate(d.getDate() + 1); return d }) }
  function goToToday() { setSelectedDate(new Date()) }
  function goToPreviousWeek() { setSelectedDate((prev) => addDays(prev, -7)) }
  function goToNextWeek() { setSelectedDate((prev) => addDays(prev, 7)) }
  function jumpToDay(date: Date) {
    setSelectedDate(date)
    setViewMode('dia')
  }
```

- [ ] **Step 5: Contadores semanales para el resumen**

Añadir, justo antes de `const isToday = isSameDay(selectedDate, new Date())`:

```ts
  const weekGroupCount = blocksByCourtByDay.reduce(
    (acc, byCourt) => acc + Object.values(byCourt).reduce((a, blocks) => a + blocks.filter((b) => b.type === 'group').length, 0),
    0
  )
  const weekPrivateCount = blocksByCourtByDay.reduce(
    (acc, byCourt) => acc + Object.values(byCourt).reduce((a, blocks) => a + blocks.filter((b) => b.type === 'private').length, 0),
    0
  )
  const weekEventCount = blocksByCourtByDay.reduce(
    (acc, byCourt) => acc + Object.values(byCourt).reduce((a, blocks) => a + blocks.filter((b) => b.type === 'event').length, 0),
    0
  )
```

- [ ] **Step 6: Reescribir la tarjeta de controles superior (toggle, navegación, filtros, leyenda)**

Cambiar:

```tsx
        {/* Navegacion de fecha */}
        <Card>
          <CardContent className="py-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={goToPreviousDay}><ChevronLeft className="h-4 w-4" /></Button>

                <div className="relative flex items-center">
                  <CalendarIcon className="absolute left-3 text-muted-foreground h-4 w-4 pointer-events-none" />
                  <Input
                    type="date"
                    className="pl-9 h-9 w-[150px] sm:w-[170px] text-sm cursor-pointer"
                    value={toInputDate(selectedDate)}
                    onChange={(e) => {
                      if (e.target.value) {
                        const newDate = new Date(e.target.value + 'T00:00:00')
                        setSelectedDate(newDate)
                      }
                    }}
                  />
                </div>

                <Button variant="outline" size="icon" onClick={goToNextDay}><ChevronRight className="h-4 w-4" /></Button>
                {!isToday && <Button variant="outline" size="sm" onClick={goToToday}>Hoy</Button>}
              </div>
              <div className="hidden sm:block text-center">
                <h2 className="text-base sm:text-lg font-semibold capitalize">{formatDateLong(selectedDate)}</h2>
                <p className="text-sm text-muted-foreground">{dayLabel}</p>
              </div>
              <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                <div className="flex items-center gap-1"><div className="h-3 w-3 rounded-sm bg-blue-100 border border-blue-300" />Grupo</div>
                <div className="flex items-center gap-1"><div className="h-3 w-3 rounded-sm bg-amber-100 border border-amber-300" />Particular</div>
                <div className="flex items-center gap-1"><div className="h-3 w-3 rounded-sm bg-teal-100 border border-teal-300" />Evento</div>
              </div>
            </div>
          </CardContent>
        </Card>
```

por:

```tsx
        {/* Controles: toggle de vista, navegacion, filtros y leyenda */}
        <Card>
          <CardContent className="py-3 space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center border rounded-md overflow-hidden shrink-0">
                  <Button
                    type="button"
                    variant={viewMode === 'semana' ? 'default' : 'ghost'}
                    size="sm"
                    className="rounded-none"
                    onClick={() => setViewMode('semana')}
                  >
                    Semana
                  </Button>
                  <Button
                    type="button"
                    variant={viewMode === 'dia' ? 'default' : 'ghost'}
                    size="sm"
                    className="rounded-none"
                    onClick={() => setViewMode('dia')}
                  >
                    Día
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-none"
                    disabled
                    title="Próximamente"
                  >
                    Mes
                  </Button>
                </div>

                {viewMode === 'dia' ? (
                  <>
                    <Button variant="outline" size="icon" onClick={goToPreviousDay}><ChevronLeft className="h-4 w-4" /></Button>
                    <div className="relative flex items-center">
                      <CalendarIcon className="absolute left-3 text-muted-foreground h-4 w-4 pointer-events-none" />
                      <Input
                        type="date"
                        className="pl-9 h-9 w-[150px] sm:w-[170px] text-sm cursor-pointer"
                        value={toInputDate(selectedDate)}
                        onChange={(e) => {
                          if (e.target.value) {
                            const newDate = new Date(e.target.value + 'T00:00:00')
                            setSelectedDate(newDate)
                          }
                        }}
                      />
                    </div>
                    <Button variant="outline" size="icon" onClick={goToNextDay}><ChevronRight className="h-4 w-4" /></Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" size="icon" onClick={goToPreviousWeek}><ChevronLeft className="h-4 w-4" /></Button>
                    <span className="text-sm font-semibold px-2 min-w-[120px] text-center">{formatWeekLabel(weekStart, weekEnd)}</span>
                    <Button variant="outline" size="icon" onClick={goToNextWeek}><ChevronRight className="h-4 w-4" /></Button>
                  </>
                )}
                {!isToday && <Button variant="outline" size="sm" onClick={goToToday}>Hoy</Button>}
              </div>
              <div className="hidden sm:block text-center">
                {viewMode === 'dia' ? (
                  <>
                    <h2 className="text-base sm:text-lg font-semibold capitalize">{formatDateLong(selectedDate)}</h2>
                    <p className="text-sm text-muted-foreground">{dayLabel}</p>
                  </>
                ) : (
                  <h2 className="text-base sm:text-lg font-semibold">Semana del {formatWeekLabel(weekStart, weekEnd)}</h2>
                )}
              </div>
              <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs text-muted-foreground flex-wrap justify-end">
                {PLAYER_LEVELS.map((level) => {
                  const colors = LEVEL_COLORS[level.value] ?? LEVEL_COLORS.iniciacion
                  return (
                    <div key={level.value} className="flex items-center gap-1">
                      <div className={`h-3 w-3 rounded-sm ${colors.bg} border ${colors.border}`} />
                      {level.label}
                    </div>
                  )
                })}
                <div className="flex items-center gap-1"><div className="h-3 w-3 rounded-sm bg-amber-50 border border-amber-300" />Particular</div>
                <div className="flex items-center gap-1"><div className="h-3 w-3 rounded-sm bg-teal-50 border border-teal-400" />Evento</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              {!isEntrenador && (
                <Select
                  options={[
                    { value: '', label: 'Todos los entrenadores' },
                    ...activeCoaches.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName}` })),
                  ]}
                  value={coachFilter}
                  onChange={(e) => setCoachFilter(e.target.value)}
                  className="w-full sm:w-48"
                />
              )}
              <Select
                options={[
                  { value: '', label: 'Todas las pistas' },
                  ...activeCourts.map((c) => ({ value: c.id, label: c.name })),
                ]}
                value={courtFilter}
                onChange={(e) => setCourtFilter(e.target.value)}
                className="w-full sm:w-48"
              />
              <Select
                options={[
                  { value: '', label: 'Todos los niveles' },
                  ...PLAYER_LEVELS.map((l) => ({ value: l.value, label: l.label })),
                ]}
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="w-full sm:w-48"
              />
            </div>
          </CardContent>
        </Card>
```

`activeCoaches` ya existe más abajo en el archivo (declarado antes del `return`), así que está disponible aquí sin cambios adicionales.

- [ ] **Step 7: Alternar entre `WeekGrid` y la grilla de Día existente**

Cambiar:

```tsx
        {/* Grilla horaria */}
        {activeCourts.length === 0 ? (
          <Card><CardContent className="py-12 text-center"><MapPin className="h-10 w-10 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">No hay pistas activas configuradas.</p></CardContent></Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <div className="grid min-w-[800px]" style={{ gridTemplateColumns: `80px repeat(${activeCourts.length}, 1fr)` }}>
                  <div className="sticky top-0 z-10 border-b border-r bg-muted/50 px-2 py-3 text-xs font-medium text-muted-foreground flex items-center justify-center">
                    <Clock className="h-3.5 w-3.5 mr-1" />Hora
                  </div>
                  {activeCourts.map((court) => (
```

por:

```tsx
        {/* Grilla horaria */}
        {viewMode === 'semana' ? (
          <WeekGrid
            weekDays={weekDays}
            activeCourts={renderedCourts}
            blocksByCourtByDay={blocksByCourtByDay}
            onSelectDay={jumpToDay}
          />
        ) : renderedCourts.length === 0 ? (
          <Card><CardContent className="py-12 text-center"><MapPin className="h-10 w-10 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">No hay pistas activas configuradas.</p></CardContent></Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <div className="grid min-w-[800px]" style={{ gridTemplateColumns: `80px repeat(${renderedCourts.length}, 1fr)` }}>
                  <div className="sticky top-0 z-10 border-b border-r bg-muted/50 px-2 py-3 text-xs font-medium text-muted-foreground flex items-center justify-center">
                    <Clock className="h-3.5 w-3.5 mr-1" />Hora
                  </div>
                  {renderedCourts.map((court) => (
```

Un poco más abajo, dentro del mismo bloque, cambiar (es la ÚNICA otra aparición de `activeCourts` dentro de esta grilla — la que itera las columnas en cada fila de hora):

```tsx
                        {activeCourts.map((court) => {
                          const blocks = blocksByCourt[court.id] ?? []
```

por:

```tsx
                        {renderedCourts.map((court) => {
                          const blocks = blocksByCourt[court.id] ?? []
```

**Importante:** estos son los ÚNICOS 3 sitios de esta sección (grid-template-columns, cabecera, filas) donde `activeCourts` pasa a ser `renderedCourts`. El resto del archivo — en particular los `<Select>` de Pista dentro de los diálogos de "Nueva clase particular" y "Nuevo evento" (más abajo, fuera de esta sección) — debe seguir usando `activeCourts` sin cambios, porque ahí se debe poder elegir cualquier pista del club al crear una clase, independientemente del filtro de Pista de Parrilla. No hacer un `replace_all` de `activeCourts` por `renderedCourts` en todo el archivo.

- [ ] **Step 8: Migrar el resumen de estadísticas a `StatCard` y añadir el resumen semanal**

Cambiar:

```tsx
        {/* Resumen del dia */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card><CardContent className="py-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100"><Users className="h-5 w-5 text-blue-600" /></div><div><p className="text-2xl font-bold">{Object.values(blocksByCourt).reduce((acc, blocks) => acc + blocks.filter((b) => b.type === 'group').length, 0)}</p><p className="text-sm text-muted-foreground">Grupos con clase</p></div></div></CardContent></Card>
          <Card><CardContent className="py-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100"><Clock className="h-5 w-5 text-amber-600" /></div><div><p className="text-2xl font-bold">{Object.values(blocksByCourt).reduce((acc, blocks) => acc + blocks.filter((b) => b.type === 'private').length, 0)}</p><p className="text-sm text-muted-foreground">Clases particulares</p></div></div></CardContent></Card>
          <Card><CardContent className="py-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100"><Star className="h-5 w-5 text-teal-600" /></div><div><p className="text-2xl font-bold">{Object.values(blocksByCourt).reduce((acc, blocks) => acc + blocks.filter((b) => b.type === 'event').length, 0)}</p><p className="text-sm text-muted-foreground">Eventos</p></div></div></CardContent></Card>
          <Card><CardContent className="py-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100"><MapPin className="h-5 w-5 text-green-600" /></div><div><p className="text-2xl font-bold">{activeCourts.length}</p><p className="text-sm text-muted-foreground">Pistas activas</p></div></div></CardContent></Card>
        </div>
```

por:

```tsx
        {/* Resumen del dia */}
        {viewMode === 'dia' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              title="Grupos con clase"
              value={Object.values(blocksByCourt).reduce((acc, blocks) => acc + blocks.filter((b) => b.type === 'group').length, 0)}
              icon={Users}
              iconClassName="bg-blue-500/10 text-blue-600"
            />
            <StatCard
              title="Clases particulares"
              value={Object.values(blocksByCourt).reduce((acc, blocks) => acc + blocks.filter((b) => b.type === 'private').length, 0)}
              icon={Clock}
              iconClassName="bg-amber-500/10 text-amber-600"
            />
            <StatCard
              title="Eventos"
              value={Object.values(blocksByCourt).reduce((acc, blocks) => acc + blocks.filter((b) => b.type === 'event').length, 0)}
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
        )}

        {/* Resumen de la semana */}
        {viewMode === 'semana' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard title="Grupos con clase (semana)" value={weekGroupCount} icon={Users} iconClassName="bg-blue-500/10 text-blue-600" />
            <StatCard title="Clases particulares (semana)" value={weekPrivateCount} icon={Clock} iconClassName="bg-amber-500/10 text-amber-600" />
            <StatCard title="Eventos (semana)" value={weekEventCount} icon={Star} iconClassName="bg-teal-500/10 text-teal-600" />
            <StatCard title="Pistas activas" value={activeCourts.length} icon={MapPin} iconClassName="bg-emerald-500/10 text-emerald-600" />
          </div>
        )}
```

- [ ] **Step 9: Verificar que compila**

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 10: Commit**

```bash
git add src/pages/AgendaPage.tsx
git commit -m "feat: activar toggle Semana/Dia/Mes con filtros y resumen StatCard en Parrilla"
```

---

### Task 4: Verificación final

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Build y tests completos**

Run: `npm run build`
Expected: sin errores.

Run: `npm test`
Expected: todos los tests pasan, incluidos los nuevos de `agenda-utils.test.ts`.

- [ ] **Step 2: Recorrido manual — vista Semana**

1. `npm run dev`, sesión como `director`, ir a `/clases/parrilla`.
2. Confirmar que Semana es la vista por defecto, con el rango de fechas correcto en la etiqueta central y en el selector de semana.
3. Navegar con las flechas de semana (adelante/atrás) y con "Hoy" — confirmar que saltan de 7 en 7 días y que "Hoy" vuelve a la semana actual.
4. Confirmar que los bloques de grupos/particulares/eventos aparecen en la columna del día y la fila de hora correctas, con la etiqueta "Pn" y el nombre correspondiente, coloreados según nivel/tipo.
5. Pasar el cursor sobre una línea de bloque y confirmar que el tooltip nativo muestra el nombre completo de la pista.
6. Hacer clic en un bloque y en la cabecera de un día — ambos deben cambiar a la vista Día en la fecha correspondiente.
7. Probar los 3 filtros (Entrenador, Pista, Nivel) y confirmar que a la vez que enseriecen ambas vistas, la grilla y el resumen semanal reflejan el filtro.
8. Confirmar que el botón "Mes" está deshabilitado y no hace nada al pulsarlo.
9. Confirmar que la leyenda muestra 5 niveles + Particular + Evento.

- [ ] **Step 3: Recorrido manual — regresión de Día**

1. Cambiar a la vista Día y repetir el recorrido de la Task 1 (navegación por flechas/date-picker/Hoy, clic en grupo → asistencia rápida, clic en hueco → nueva clase particular, clic en particular/evento existente si los hay).
2. Confirmar que los filtros de Entrenador/Pista/Nivel también afectan a la vista Día.
3. Confirmar que el resumen de 4 `StatCard` de Día muestra los mismos números que antes de esta fase (comparar con capturas previas si hace falta) y que visualmente sigue el estilo del resto de la app (mismo look que Dashboard/Pagos).
4. Como `entrenador`: confirmar que el filtro de Entrenador está oculto y que tanto Día como Semana muestran solo sus propios grupos/particulares (fuerza `effectiveCoachFilter` a `currentCoachId`).
5. Confirmar en la consola del navegador que no hay errores nuevos en ninguna de las dos vistas.

- [ ] **Step 4: Repetir el proceso de `subagent-driven-development`**

Tras completar las Tasks 1-3 (cada una con su implementador + revisor de spec + revisor de calidad), dispatch un revisor final sobre el diff completo de este plan. Después, usar `superpowers:finishing-a-development-branch`.
