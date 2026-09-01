import type { AttendanceRecord, AttendanceStatus, Group, PrivateLesson } from '@/types'
import { isGroupCurrentlyActive } from '@/lib/group-utils'
import { isSameDay, getWeekStart, addDays } from '@/lib/agenda-utils'

export interface MyAttendanceRow {
  recordId: string
  date: Date
  groupName: string
  status: AttendanceStatus
}

/**
 * Historial de clases de un alumno en un mes/año concreto, más reciente
 * primero. Filtra por participación real del alumno en cada registro
 * (`records.find`), no por matrícula en el grupo: así se incluyen también
 * las recuperaciones en grupos donde el alumno no está inscrito.
 *
 * `record.date` está tipado Date pero `attendance` se persiste en
 * localStorage (partialize del store), así que tras rehidratar puede
 * llegar como string ISO — de ahí la coerción con `new Date(...)`.
 */
export function getMyAttendanceForMonth(
  attendance: AttendanceRecord[],
  studentId: string,
  month: number, // 1-12
  year: number
): MyAttendanceRow[] {
  const rows: MyAttendanceRow[] = []

  for (const record of attendance) {
    const date = new Date(record.date)
    if (date.getMonth() + 1 !== month || date.getFullYear() !== year) continue

    const entry = record.records.find((r) => r.playerId === studentId)
    if (!entry) continue

    rows.push({
      recordId: record.id,
      date,
      groupName: record.groupName,
      status: entry.status,
    })
  }

  return rows.sort((a, b) => b.date.getTime() - a.date.getTime())
}

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
