import { useMemo } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore, computePlayerRecoveryBalance } from '@/stores/dataStore'
import type { Group, ScheduleSlot, Enrollment } from '@/types'

export interface NextClassInfo {
  group: Group
  slot: ScheduleSlot
  classDate: Date
  diffHours: number
}

export interface PlayerDataResult {
  studentId: string | undefined
  myEnrollments: Enrollment[]
  myGroups: Group[]
  nextClass: NextClassInfo | null
  attendancePercent: number   // % presencia mes actual
  pendingPaymentsCount: number
  overduePaymentsCount: number
  recoveryBalance: number
  activeVouchersCount: number
}

/**
 * Centraliza todos los datos derivados que necesita el PlayerDashboard.
 * Encapsula la lógica de "próxima clase", asistencia mensual y estado de pagos.
 */
export function usePlayerData(): PlayerDataResult {
  const { user } = useAuthStore()
  const {
    groups,
    enrollments,
    attendance,
    payments,
    vouchers,
  } = useDataStore()

  const studentId = user?.linkedPlayerId

  const myEnrollments = useMemo(
    () => enrollments.filter((e) => e.playerId === studentId && e.isActive),
    [enrollments, studentId]
  )

  const myGroups = useMemo(
    () => groups.filter((g) => myEnrollments.some((e) => e.groupId === g.id)),
    [groups, myEnrollments]
  )

  // ── Próxima clase (próximos 7 días) ──────────────────────────────────────
  const nextClass = useMemo<NextClassInfo | null>(() => {
    let best: NextClassInfo | null = null
    let minDiff = Infinity

    for (let i = 0; i < 7; i++) {
      const targetDate = new Date()
      targetDate.setDate(targetDate.getDate() + i)
      // dayOfWeek: 1=lunes … 7=domingo (ISO)
      const targetDay = targetDate.getDay() || 7

      for (const group of myGroups) {
        const slots = group.schedule.filter((s) => s.dayOfWeek === targetDay)
        for (const slot of slots) {
          const [h, m] = slot.startTime.split(':').map(Number)
          const classDate = new Date(targetDate)
          classDate.setHours(h, m, 0, 0)

          const diff = classDate.getTime() - Date.now()
          if (diff > 0 && diff < minDiff) {
            minDiff = diff
            best = { group, slot, classDate, diffHours: diff / 3_600_000 }
          }
        }
      }
    }
    return best
  }, [myGroups])

  // ── % Asistencia mes actual ───────────────────────────────────────────────
  const attendancePercent = useMemo(() => {
    if (!studentId || myGroups.length === 0) return 0

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    const myGroupIds = new Set(myGroups.map((g) => g.id))

    const monthRecords = attendance.filter((a) => {
      const d = a.date instanceof Date ? a.date : new Date(a.date)
      return myGroupIds.has(a.groupId) && d >= monthStart && d <= monthEnd
    })

    if (monthRecords.length === 0) return 0

    let present = 0
    let total = 0
    for (const record of monthRecords) {
      const entry = record.records.find((r) => r.playerId === studentId)
      if (entry) {
        total++
        if (entry.status === 'presente') present++
      }
    }

    return total > 0 ? Math.round((present / total) * 100) : 0
  }, [attendance, studentId, myGroups])

  // ── Pagos pendientes y vencidos ───────────────────────────────────────────
  const { pendingPaymentsCount, overduePaymentsCount } = useMemo(() => {
    if (!studentId) return { pendingPaymentsCount: 0, overduePaymentsCount: 0 }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const myPending = payments.filter(
      (p) => p.playerId === studentId && p.status === 'pendiente'
    )
    const overdue = myPending.filter((p) => {
      const due = p.dueDate instanceof Date ? p.dueDate : new Date(p.dueDate)
      return due < today
    })

    return {
      pendingPaymentsCount: myPending.length,
      overduePaymentsCount: overdue.length,
    }
  }, [payments, studentId])

  // ── Créditos de recuperación ──────────────────────────────────────────────
  const recoveryBalance = useMemo(() => {
    if (!studentId) return 0
    return computePlayerRecoveryBalance(studentId, attendance)
  }, [studentId, attendance])

  // ── Bonos activos ─────────────────────────────────────────────────────────
  const activeVouchersCount = useMemo(
    () => vouchers.filter((v) => v.playerId === studentId && v.status === 'active').length,
    [vouchers, studentId]
  )

  return {
    studentId,
    myEnrollments,
    myGroups,
    nextClass,
    attendancePercent,
    pendingPaymentsCount,
    overduePaymentsCount,
    recoveryBalance,
    activeVouchersCount,
  }
}
