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
