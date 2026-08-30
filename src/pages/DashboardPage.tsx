import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { StatCard } from '@/components/shared/StatCard'
import { ActivityFeed } from '@/components/shared/ActivityFeed'
import { NotificationBell } from '@/components/shared/NotificationBell'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useDataStore } from '@/stores/dataStore'
import { useAuthStore, hasPermission } from '@/stores/authStore'
import type { UserRole } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { normalizeAllPayments } from '@/lib/payment-utils'
import { isGroupCurrentlyActive } from '@/lib/group-utils'
import { ClubIndicatorsGrid, type ClubIndicator } from '@/components/shared/dashboard/ClubIndicatorsGrid'
import { MonthlyCollectionsCard, type CollectionSegment } from '@/components/shared/dashboard/MonthlyCollectionsCard'
import { TodayClassesCard, type TodayClassRow } from '@/components/shared/dashboard/TodayClassesCard'
import { AttentionAlertsCard, type AttentionAlert } from '@/components/shared/dashboard/AttentionAlertsCard'
import {
  Users,
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Search,
  Plus,
} from 'lucide-react'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'director' || user?.role === 'coordinador'
  const canReadPayments = hasPermission(user?.role as UserRole, 'payments', 'read')
  const {
    players,
    groups,
    enrollments,
    activities,
    payments: allBasePayments,
    eventPayments,
    privateLessonPayments,
    attendance,
    events,
    evaluations,
  } = useDataStore()

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  // ── KPI calculations ──────────────────────────────────────────────
  const activePlayers = players.filter((p) => p.status === 'activo').length
  const activeGroups = groups.filter((g) => isGroupCurrentlyActive(g, now)).length

  const allPayments = useMemo(
    () => normalizeAllPayments(allBasePayments, eventPayments, privateLessonPayments ?? [], events),
    [allBasePayments, eventPayments, privateLessonPayments, events]
  )

  const currentMonthAllPayments = allPayments.filter(
    (p) => p.billingMonth === currentMonth && p.billingYear === currentYear
  )

  const currentRevenue = currentMonthAllPayments
    .filter((p) => p.status === 'pagado')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0)

  const currentPending = currentMonthAllPayments
    .filter((p) => p.status === 'pendiente')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0)

  const totalCurrentMonth = currentMonthAllPayments
    .filter((p) => p.status !== 'cancelado')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const collectionRate = totalCurrentMonth > 0 ? Math.round((currentRevenue / totalCurrentMonth) * 100) : 0

  const monthStart = new Date(currentYear, currentMonth - 1, 1)
  const monthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59)
  const altasEsteMes = players.filter(
    (p) => p.registrationDate >= monthStart && p.registrationDate <= monthEnd
  ).length
  const { bajasEsteMes } = useMemo(() => {
    const nextMonthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59)

    const playersActiveInMonth = players.filter(p => {
      const pEnrols = enrollments.filter(e => e.playerId === p.id)
      return pEnrols.some(e => {
        const eStart = e.enrollmentDate instanceof Date ? e.enrollmentDate : new Date(e.enrollmentDate)
        const eEnd = e.unenrollmentDate ? (e.unenrollmentDate instanceof Date ? e.unenrollmentDate : new Date(e.unenrollmentDate)) : null
        return eStart <= monthEnd && (!eEnd || eEnd >= monthStart)
      })
    })

    const trueBajas = playersActiveInMonth.filter(p => {
      const pEnrols = enrollments.filter(e => e.playerId === p.id)

      const isActiveAtEnd = pEnrols.some(e => {
        const eStart = e.enrollmentDate instanceof Date ? e.enrollmentDate : new Date(e.enrollmentDate)
        const eEnd = e.unenrollmentDate ? (e.unenrollmentDate instanceof Date ? e.unenrollmentDate : new Date(e.unenrollmentDate)) : null
        return eStart <= monthEnd && (!eEnd || eEnd > monthEnd)
      })

      if (isActiveAtEnd) return false

      const hasNextMonthEnrollment = pEnrols.some(e => {
        const eStart = e.enrollmentDate instanceof Date ? e.enrollmentDate : new Date(e.enrollmentDate)
        return eStart > monthEnd && eStart <= nextMonthEnd
      })

      return !hasNextMonthEnrollment
    }).length

    return { bajasEsteMes: trueBajas }
  }, [players, enrollments, currentMonth, currentYear, monthStart, monthEnd])

  const rotationDivisor = activePlayers + bajasEsteMes
  const rotationIndex = rotationDivisor > 0
    ? Math.round(((altasEsteMes + bajasEsteMes) / rotationDivisor) * 100)
    : 0
  const churnRate = rotationDivisor > 0
    ? Math.round((bajasEsteMes / rotationDivisor) * 100)
    : 0

  const today = now.getDay()
  const todayGroups = groups.filter(
    (g) => isGroupCurrentlyActive(g, now) && g.schedule.some((s) => s.dayOfWeek === today)
  )

  const classesInProgress = useMemo(() => {
    return todayGroups.filter((g) => {
      const slot = g.schedule.find((s) => s.dayOfWeek === today)
      if (!slot) return false
      const [startH, startM] = slot.startTime.split(':').map(Number)
      const [endH, endM] = slot.endTime.split(':').map(Number)
      const start = new Date(now)
      start.setHours(startH, startM, 0, 0)
      const end = new Date(now)
      end.setHours(endH, endM, 0, 0)
      return now >= start && now <= end
    }).length
  }, [todayGroups, today])

  const netPlayerChange = altasEsteMes - bajasEsteMes

  const weekAttendanceStats = useMemo(() => {
    const rangeRate = (start: Date, end: Date) => {
      let present = 0
      let total = 0
      for (const record of attendance) {
        const recordDate = new Date(record.date)
        if (recordDate < start || recordDate > end) continue
        for (const entry of record.records) {
          total++
          if (entry.status === 'presente') present++
        }
      }
      return total > 0 ? Math.round((present / total) * 100) : 0
    }

    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() + mondayOffset)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    const prevWeekStart = new Date(weekStart)
    prevWeekStart.setDate(weekStart.getDate() - 7)
    const prevWeekEnd = new Date(weekEnd)
    prevWeekEnd.setDate(weekEnd.getDate() - 7)

    const current = rangeRate(weekStart, weekEnd)
    const previous = rangeRate(prevWeekStart, prevWeekEnd)
    return { current, diff: current - previous }
  }, [attendance, now])

  const pendingPlayersCount = useMemo(() => {
    return new Set(
      currentMonthAllPayments.filter((p) => p.status === 'pendiente').map((p) => p.playerId)
    ).size
  }, [currentMonthAllPayments])

  // ── Occupancy calculation ─────────────────────────────────────────
  const occupancyStats = useMemo(() => {
    const classGroups = groups.filter(g => isGroupCurrentlyActive(g, now))
    const totalCapacity = classGroups.reduce((sum, g) => sum + (g.maxCapacity || 0), 0)
    const totalOccupied = classGroups.reduce((sum, g) => sum + (g.currentEnrollment || 0), 0)
    const rate = totalCapacity > 0 ? Math.min(100, Math.round((totalOccupied / totalCapacity) * 100)) : 0
    return { totalCapacity, totalOccupied, rate }
  }, [groups, now])

  // ── Evolucion de 12 meses (solo se usa aqui para el valor del MES ANTERIOR:
  // indice [10]. El indice [11] es el mes en curso, calculado tambien arriba
  // con una formula mas simple — se aceptan ambas formulas conviviendo, ya
  // convivian asi antes de esta tarea) ──────────────────────────────────
  const evolutionData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(currentYear, currentMonth - 1 - (11 - i), 1)
      const m = d.getMonth() + 1
      const y = d.getFullYear()

      const monthPayments = allPayments.filter(p => p.billingMonth === m && p.billingYear === y)
      const revenue = monthPayments.filter(p => p.status === 'pagado').reduce((sum, p) => sum + Number(p.amount || 0), 0)

      const mEnd = new Date(y, m, 0, 23, 59, 59)
      const totalBilled = monthPayments.filter(p => p.status !== 'cancelado').reduce((sum, p) => sum + Number(p.amount || 0), 0)
      const monthCollectionRate = totalBilled > 0 ? Math.round((revenue / totalBilled) * 100) : 0

      const mStart = new Date(y, m - 1, 1)
      const nextMonthEnd = new Date(y, m + 1, 0, 23, 59, 59)

      const altas = players.filter(p => {
        const regDate = p.registrationDate instanceof Date ? p.registrationDate : new Date(p.registrationDate)
        return regDate >= mStart && regDate <= mEnd
      }).length

      const playersActiveInMonth = players.filter(p => {
        const pEnrols = enrollments.filter(e => e.playerId === p.id)
        return pEnrols.some(e => {
          const eStart = e.enrollmentDate instanceof Date ? e.enrollmentDate : new Date(e.enrollmentDate)
          const eEnd = e.unenrollmentDate ? (e.unenrollmentDate instanceof Date ? e.unenrollmentDate : new Date(e.unenrollmentDate)) : null
          return eStart <= mEnd && (!eEnd || eEnd >= mStart)
        })
      })

      const bajas = playersActiveInMonth.filter(p => {
        const pEnrols = enrollments.filter(e => e.playerId === p.id)

        const isActiveAtEnd = pEnrols.some(e => {
          const eStart = e.enrollmentDate instanceof Date ? e.enrollmentDate : new Date(e.enrollmentDate)
          const eEnd = e.unenrollmentDate ? (e.unenrollmentDate instanceof Date ? e.unenrollmentDate : new Date(e.unenrollmentDate)) : null
          return eStart <= mEnd && (!eEnd || eEnd > mEnd)
        })

        if (isActiveAtEnd) return false

        const hasNextMonthEnrollment = pEnrols.some(e => {
          const eStart = e.enrollmentDate instanceof Date ? e.enrollmentDate : new Date(e.enrollmentDate)
          return eStart > mEnd && eStart <= nextMonthEnd
        })

        return !hasNextMonthEnrollment
      }).length

      const activeAtEnd = playersActiveInMonth.length - bajas
      const monthRotationDivisor = activeAtEnd + bajas

      const isStartMonth = m === 2 && y === 2026

      const monthRotationIndex = (monthRotationDivisor > 0 && !isStartMonth) ? Math.round(((altas + bajas) / monthRotationDivisor) * 100) : 0
      const monthChurnRate = monthRotationDivisor > 0 ? Math.round((bajas / monthRotationDivisor) * 100) : 0

      const groupsInMonth = groups.filter(g => {
        const gStart = g.startDate instanceof Date ? g.startDate : new Date(g.startDate)
        const gEnd = g.endDate ? (g.endDate instanceof Date ? g.endDate : new Date(g.endDate)) : null
        return g.isActive && gStart <= mEnd && (!gEnd || gEnd >= mStart)
      })

      const monthCapacity = groupsInMonth.reduce((sum, g) => sum + (g.maxCapacity || 0), 0)

      const occupiedInMonth = enrollments.filter(e => {
        if (!groupsInMonth.some(g => g.id === e.groupId)) return false

        const eStart = e.enrollmentDate instanceof Date ? e.enrollmentDate : new Date(e.enrollmentDate)
        const eEnd = e.unenrollmentDate ? (e.unenrollmentDate instanceof Date ? e.unenrollmentDate : new Date(e.unenrollmentDate)) : null

        return e.isActive && eStart <= mEnd && (!eEnd || eEnd >= mStart)
      }).length

      const monthOccupancyRate = monthCapacity > 0 ? Math.min(100, Math.round((occupiedInMonth / monthCapacity) * 100)) : 0

      return {
        ratioCobro: monthCollectionRate,
        rotacion: monthRotationIndex,
        abandono: monthChurnRate,
        ocupacion: monthOccupancyRate,
      }
    })
  }, [allPayments, players, groups, enrollments, currentMonth, currentYear])

  // ── Indicadores del club ────────────────────────────────────────────
  const prevMonthEvolution = evolutionData[10]
  const alumnosPorGrupo = activeGroups > 0 ? occupancyStats.totalOccupied / activeGroups : 0
  const plazasPorGrupo = activeGroups > 0 ? Math.round(occupancyStats.totalCapacity / activeGroups) : 0

  const clubIndicators: ClubIndicator[] = [
    {
      label: '% Ocupación de clases',
      value: `${occupancyStats.rate}%`,
      progressPct: occupancyStats.rate,
      deltaText: `${occupancyStats.rate - prevMonthEvolution.ocupacion >= 0 ? '+' : ''}${occupancyStats.rate - prevMonthEvolution.ocupacion} pts`,
      deltaTone: occupancyStats.rate - prevMonthEvolution.ocupacion >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Índice de rotación',
      value: `${rotationIndex}%`,
      progressPct: rotationIndex,
      deltaText: `${rotationIndex - prevMonthEvolution.rotacion >= 0 ? '+' : ''}${rotationIndex - prevMonthEvolution.rotacion} pts`,
      deltaTone: rotationIndex - prevMonthEvolution.rotacion <= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Tasa de abandono',
      value: `${churnRate}%`,
      progressPct: churnRate,
      deltaText: `${churnRate - prevMonthEvolution.abandono >= 0 ? '+' : ''}${churnRate - prevMonthEvolution.abandono} pts`,
      deltaTone: churnRate - prevMonthEvolution.abandono <= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Ratio de cobro',
      value: `${collectionRate}%`,
      progressPct: collectionRate,
      deltaText: `${collectionRate - prevMonthEvolution.ratioCobro >= 0 ? '+' : ''}${collectionRate - prevMonthEvolution.ratioCobro} pts`,
      deltaTone: collectionRate - prevMonthEvolution.ratioCobro >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Alumnos por grupo',
      value: alumnosPorGrupo.toFixed(1),
      progressPct: plazasPorGrupo > 0 ? Math.min(100, Math.round((alumnosPorGrupo / plazasPorGrupo) * 100)) : 0,
      deltaText: `de ${plazasPorGrupo} plazas`,
      deltaTone: 'neutral',
    },
  ]

  // ── Cobros del mes ──────────────────────────────────────────────────
  const currentMonthPending = currentMonthAllPayments.filter((p) => p.status === 'pendiente')
  const currentOverdueThisMonth = currentMonthPending
    .filter((p) => p.dueDate != null && new Date(p.dueDate) < now)
    .reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const currentPendingNotOverdue = currentPending - currentOverdueThisMonth

  const pctOfMonth = (amount: number) => (totalCurrentMonth > 0 ? Math.round((amount / totalCurrentMonth) * 100) : 0)

  const collectionSegments: CollectionSegment[] = [
    { label: 'Cobrado', amount: currentRevenue, pct: pctOfMonth(currentRevenue), colorClass: 'bg-success', dotClass: 'bg-success' },
    { label: 'Pendiente', amount: currentPendingNotOverdue, pct: pctOfMonth(currentPendingNotOverdue), colorClass: 'bg-warning', dotClass: 'bg-warning' },
    { label: 'Vencido', amount: currentOverdueThisMonth, pct: pctOfMonth(currentOverdueThisMonth), colorClass: 'bg-destructive', dotClass: 'bg-destructive' },
  ]

  const monthLabel = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  // ── Clases de hoy ────────────────────────────────────────────────────
  const todayClassRows: TodayClassRow[] = useMemo(() => {
    return todayGroups
      .slice()
      .sort((a, b) => {
        const aTime = a.schedule.find((s) => s.dayOfWeek === today)?.startTime || ''
        const bTime = b.schedule.find((s) => s.dayOfWeek === today)?.startTime || ''
        return aTime.localeCompare(bTime)
      })
      .map((group) => {
        const slot = group.schedule.find((s) => s.dayOfWeek === today)!
        const record = attendance.find(
          (a) => a.groupId === group.id && new Date(a.date).toDateString() === now.toDateString()
        )
        const attendanceLabel = record
          ? `${record.records.filter((r) => r.status === 'presente').length}/${record.records.length}`
          : '—'
        return {
          id: group.id,
          time: slot.startTime,
          name: group.name,
          meta: `${group.coachName} · ${group.courtName}`,
          attendanceLabel,
        }
      })
  }, [todayGroups, today, attendance, now])

  // ── Atención requerida ──────────────────────────────────────────────
  const allOverduePayments = useMemo(
    () => allPayments.filter((p) => p.status === 'pendiente' && p.dueDate != null && new Date(p.dueDate) < now),
    [allPayments, now]
  )
  const overdueAmount = allOverduePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const oldestOverdueDays = allOverduePayments.length > 0
    ? Math.floor((now.getTime() - Math.min(...allOverduePayments.map((p) => new Date(p.dueDate!).getTime()))) / 86400000)
    : 0

  const playersWithoutEvaluation = useMemo(
    () => players.filter((p) => p.status === 'activo' && !evaluations.some((e) => e.playerId === p.id)),
    [players, evaluations]
  )

  const waitlistPlayers = useMemo(() => players.filter((p) => p.status === 'lista_espera'), [players])
  const waitlistWithSpace = useMemo(
    () => waitlistPlayers.filter((p) =>
      groups.some((g) => isGroupCurrentlyActive(g, now) && g.level === p.level && g.currentEnrollment < g.maxCapacity)
    ),
    [waitlistPlayers, groups, now]
  )

  const attentionAlerts: AttentionAlert[] = useMemo(() => {
    const items: AttentionAlert[] = []
    if (allOverduePayments.length > 0) {
      items.push({
        id: 'overdue',
        title: `${allOverduePayments.length} pagos vencidos`,
        sub: `Suman ${formatCurrency(overdueAmount)} · desde hace ${oldestOverdueDays} días`,
        onNavigate: () => navigate('/pagos'),
      })
    }
    if (playersWithoutEvaluation.length > 0) {
      items.push({
        id: 'no-evaluation',
        title: `${playersWithoutEvaluation.length} jugadores sin evaluación`,
        sub: 'Nunca se les ha registrado ninguna',
        onNavigate: () => navigate('/personas/jugadores'),
      })
    }
    if (waitlistPlayers.length > 0) {
      items.push({
        id: 'waitlist',
        title: `${waitlistPlayers.length} en lista de espera`,
        sub: `${waitlistWithSpace.length} encajan en grupos con hueco`,
        onNavigate: () => navigate('/personas/lista-espera'),
      })
    }
    return items
  }, [allOverduePayments.length, overdueAmount, oldestOverdueDays, playersWithoutEvaluation.length, waitlistPlayers.length, waitlistWithSpace.length, navigate])

  const visibleActivities = useMemo(() => {
    if (canReadPayments) return activities
    return activities.filter((a) => a.type !== 'payment_received')
  }, [activities, canReadPayments])

  return (
    <div>
      <div className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="flex flex-wrap items-center gap-4 px-5 py-5 lg:px-8">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">HOY</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar jugador, grupo, pago…"
                className="h-10 w-64 rounded-xl border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <NotificationBell />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/agenda')}
              title="Ir a la agenda"
              className="rounded-xl text-muted-foreground hover:text-foreground"
            >
              <CalendarDays className="h-5 w-5" />
            </Button>
            <Button
              className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => navigate('/jugadores')}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Nuevo jugador
            </Button>
          </div>
        </div>
      </div>

      <div className="px-5 pt-5 lg:px-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            title="Jugadores activos"
            value={activePlayers}
            icon={Users}
            description={`${netPlayerChange >= 0 ? '+' : ''}${netPlayerChange} este mes`}
            iconClassName="bg-accent text-primary"
            accentColor="#2A5FD9"
          />
          <StatCard
            title="Clases hoy"
            value={todayGroups.length}
            icon={CalendarDays}
            description={`${classesInProgress} en curso`}
            iconClassName="bg-accent text-primary"
            accentColor="#2A5FD9"
          />
          <StatCard
            title="Asistencia media"
            value={`${weekAttendanceStats.current}%`}
            icon={CheckCircle2}
            description={`${weekAttendanceStats.diff >= 0 ? '+' : ''}${weekAttendanceStats.diff} pts vs. semana`}
            iconClassName="bg-accent text-primary"
            accentColor="#2A5FD9"
          />
          {isAdmin && (
            <StatCard
              title="Pendiente de cobro"
              value={formatCurrency(currentPending)}
              icon={AlertCircle}
              description={`${pendingPlayersCount} jugadores`}
              iconClassName="bg-accent text-primary"
              accentColor="#2A5FD9"
            />
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="grid grid-cols-1 gap-5 px-5 py-5 lg:grid-cols-2 lg:px-8">
          <div className="space-y-5">
            <ClubIndicatorsGrid indicators={clubIndicators} monthLabel={monthLabel} />
            <MonthlyCollectionsCard monthLabel={monthLabel} total={totalCurrentMonth} segments={collectionSegments} />
          </div>
          <div className="space-y-5">
            <TodayClassesCard rows={todayClassRows} />
            <AttentionAlertsCard alerts={attentionAlerts} />
          </div>
        </div>
      )}

      <div className="p-5 lg:p-6">
        <Card className="border-border/60 shadow-[var(--shadow-card)] flex flex-col min-h-[460px]">
          <ActivityFeed activities={visibleActivities} canReadPayments={canReadPayments} />
        </Card>
      </div>
    </div>
  )
}
