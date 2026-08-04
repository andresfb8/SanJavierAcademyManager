import type { Coach, Group, Payment, Enrollment, AttendanceRecord } from '@/types'
import { findSlotForAttendanceDate } from '@/lib/attendance-schedule'

export interface CoachStats {
  coachId: string
  coachName: string
  rph: number
  retentionPct: number | null
  hours: number
}

function slotMinutes(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  return (eh * 60 + em) - (sh * 60 + sm)
}

/**
 * Calcula €/hora, retención a 3 meses y horas trabajadas por entrenador
 * activo en el periodo indicado. Puro: no lee stores ni hace I/O, para poder
 * testearse de forma aislada y ser consumido tanto por el ranking completo
 * (CoachRankingTab) como por la vista resumen (IntelligenceCards) sin que
 * ambos diverjan.
 */
export function computeCoachStats(
  coaches: Coach[],
  groups: Group[],
  payments: Payment[],
  enrollments: Enrollment[],
  attendance: AttendanceRecord[],
  periodStart: Date,
  weeksInPeriod: number,
  now: Date = new Date()
): CoachStats[] {
  const coachGroupIds: Record<string, string[]> = {}
  groups.forEach(g => {
    if (!coachGroupIds[g.coachId]) coachGroupIds[g.coachId] = []
    coachGroupIds[g.coachId].push(g.id)
  })

  const threeMonthsAgo = new Date(now)
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  return coaches
    .filter(c => c.isActive)
    .map(coach => {
      const groupIds = coachGroupIds[coach.id] ?? []

      // ── €/h ──────────────────────────────────────────────────────
      const revenue = payments
        .filter(p =>
          p.status === 'pagado' &&
          p.groupId &&
          groupIds.includes(p.groupId) &&
          new Date(p.paidDate ?? p.dueDate) >= periodStart
        )
        .reduce((sum, p) => sum + p.amount, 0)

      // Horas a partir de la asistencia real
      const coachAttendance = attendance.filter(r => {
        const d = r.date instanceof Date ? r.date : new Date(r.date)
        return r.coachId === coach.id && d >= periodStart
      })
      const hoursFromAttendance = coachAttendance.reduce((sum, record) => {
        const group = groups.find(g => g.id === record.groupId)
        if (!group) return sum
        const recordDate = record.date instanceof Date ? record.date : new Date(record.date)
        const slot = findSlotForAttendanceDate(group, recordDate)
        if (!slot) return sum
        return sum + slotMinutes(slot.startTime, slot.endTime) / 60
      }, 0)

      // Respaldo: estimar a partir del horario si no hay asistencia registrada
      const hoursFromSchedule = groups
        .filter(g => g.coachId === coach.id && g.isActive)
        .reduce((sum, g) => {
          return sum + g.schedule.reduce((s, slot) => s + slotMinutes(slot.startTime, slot.endTime) / 60, 0) * weeksInPeriod
        }, 0)

      const hours = hoursFromAttendance > 0 ? hoursFromAttendance : hoursFromSchedule
      const rph = hours > 0 ? revenue / hours : 0

      // ── Retención 3 meses ────────────────────────────────────────
      const eligibleEnrollments = enrollments.filter(e => {
        const d = e.enrollmentDate instanceof Date ? e.enrollmentDate : new Date(e.enrollmentDate)
        return groupIds.includes(e.groupId) && d <= threeMonthsAgo
      })
      const retained = eligibleEnrollments.filter(e => e.isActive).length
      const retentionPct = eligibleEnrollments.length > 0
        ? Math.round((retained / eligibleEnrollments.length) * 100)
        : null

      return {
        coachId: coach.id,
        coachName: `${coach.firstName} ${coach.lastName}`,
        rph,
        retentionPct,
        hours: Math.round(hours * 10) / 10,
      }
    })
    .filter(s => s.rph > 0 || s.hours > 0 || s.retentionPct !== null)
}
