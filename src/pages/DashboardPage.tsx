import { useState, useEffect, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/shared/StatCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ActivityFeed } from '@/components/shared/ActivityFeed'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useDataStore } from '@/stores/dataStore'
import { useAuthStore, hasPermission } from '@/stores/authStore'
import type { UserRole } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { normalizeAllPayments } from '@/lib/payment-utils'
import {
  Users,
  DollarSign,
  AlertCircle,
  GraduationCap,
  Clock,
  TrendingUp,
  CalendarDays,
  CalendarCheck,
  Activity,
  Settings as SettingsIcon,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  UserMinus,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

const KPI_STORAGE_KEY = 'dashboard-kpi-config'

interface KpiConfig {
  [key: string]: boolean
}

const defaultKpiConfig: KpiConfig = {
  activePlayers: true,
  revenue: true,
  pendingPayments: true,
  activeGroups: true,
  collectionRate: true,
  todayClasses: true,
  totalEnrolled: true,
  waitingList: true,
  rotationIndex: true,
  churnRate: true,
  attendanceChart: true,
  levelChart: true,
  financialChart: true,
}

// Chart theme tokens
const CHART_COLORS = {
  primary: '#0e7490',
  secondary: '#f59e0b',
  success: '#10b981',
  danger: '#f43f5e',
  grid: '#f1f5f9',
  tooltip: { background: '#ffffff', border: '#e2e8f0' },
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'director' || user?.role === 'coordinador'
  const isCoach = user?.role === 'entrenador'
  const canReadPayments = hasPermission(user?.role as UserRole, 'payments', 'read')
  const { players, payments, groups, activities, enrollments, attendance, eventPayments, privateLessonPayments, coaches, privateLessons, cleanupOrphanedPayments } = useDataStore()

  const [showKpiDialog, setShowKpiDialog] = useState(false)
  const [kpiConfig, setKpiConfig] = useState<KpiConfig>(() => {
    try {
      const saved = localStorage.getItem(KPI_STORAGE_KEY)
      return saved ? { ...defaultKpiConfig, ...JSON.parse(saved) } : defaultKpiConfig
    } catch {
      return defaultKpiConfig
    }
  })

  useEffect(() => {
    localStorage.setItem(KPI_STORAGE_KEY, JSON.stringify(kpiConfig))
  }, [kpiConfig])

  useEffect(() => {
    cleanupOrphanedPayments()
  }, [cleanupOrphanedPayments])

  const [chartCollapsed, setChartCollapsed] = useState<Record<string, boolean>>({})
  const toggleChartCollapsed = (key: string) => {
    setChartCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // ── Coach identification ──────────────────────────────────────────
  const currentCoachId = useMemo(() => {
    if (!isCoach || !user?.id) return null
    return coaches.find(c => c.userId === user.id)?.id ?? null
  }, [isCoach, user?.id, coaches])

  // ── Coach-specific KPIs ───────────────────────────────────────────
  const coachHoursThisMonth = useMemo(() => {
    if (!currentCoachId) return 0

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    let totalMinutes = 0

    // Horas de grupos
    const coachGroups = groups.filter(g => g.coachId === currentCoachId)
    coachGroups.forEach(group => {
      group.schedule.forEach(slot => {
        const [startH, startM] = slot.startTime.split(':').map(Number)
        const [endH, endM] = slot.endTime.split(':').map(Number)
        const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM)
        // Aproximación: 4 semanas por mes
        const occurrences = 4
        totalMinutes += durationMinutes * occurrences
      })
    })

    // Horas de clases particulares del mes
    const coachLessons = privateLessons.filter(pl => {
      const lessonDate = pl.date instanceof Date ? pl.date : new Date(pl.date)
      return pl.coachId === currentCoachId &&
        lessonDate >= startOfMonth &&
        lessonDate <= endOfMonth
    })

    coachLessons.forEach(lesson => {
      const [startH, startM] = lesson.startTime.split(':').map(Number)
      const [endH, endM] = lesson.endTime.split(':').map(Number)
      const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM)
      totalMinutes += durationMinutes
    })

    return Math.round(totalMinutes / 60 * 10) / 10
  }, [currentCoachId, groups, privateLessons])

  const coachAssignedPlayers = useMemo(() => {
    if (!currentCoachId) return 0

    const coachGroupIds = groups
      .filter(g => g.coachId === currentCoachId)
      .map(g => g.id)

    const playerIds = new Set(
      enrollments
        .filter(e => coachGroupIds.includes(e.groupId))
        .map(e => e.playerId)
    )

    return playerIds.size
  }, [currentCoachId, groups, enrollments])

  const coachTotalGroups = useMemo(() => {
    if (!currentCoachId) return 0
    return groups.filter(g => g.coachId === currentCoachId).length
  }, [currentCoachId, groups])

  const coachTotalPrivateLessons = useMemo(() => {
    if (!currentCoachId) return 0
    return privateLessons.filter(pl => pl.coachId === currentCoachId).length
  }, [currentCoachId, privateLessons])

  const coachIncompleteGroups = useMemo(() => {
    if (!currentCoachId) return 0

    return groups.filter(g =>
      g.coachId === currentCoachId &&
      g.currentEnrollment < g.maxCapacity
    ).length
  }, [currentCoachId, groups])

  // ── KPI calculations ──────────────────────────────────────────────
  const activePlayers = players.filter((p) => p.status === 'activo').length
  const activeGroups = groups.filter((g) => g.isActive).length

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear

  const allPayments = useMemo(
    () => normalizeAllPayments(payments, eventPayments, privateLessonPayments ?? []),
    [payments, eventPayments, privateLessonPayments]
  )

  const currentMonthAllPayments = allPayments.filter(
    (p) => p.billingMonth === currentMonth && p.billingYear === currentYear
  )
  const prevMonthAllPayments = allPayments.filter(
    (p) => p.billingMonth === prevMonth && p.billingYear === prevYear
  )

  const currentRevenue = currentMonthAllPayments
    .filter((p) => p.status === 'pagado')
    .reduce((sum, p) => sum + p.amount, 0)
  const prevRevenue = prevMonthAllPayments
    .filter((p) => p.status === 'pagado')
    .reduce((sum, p) => sum + p.amount, 0)
  const revenueDiff = prevRevenue > 0 ? Math.round(((currentRevenue - prevRevenue) / prevRevenue) * 100) : 0

  const currentPending = currentMonthAllPayments
    .filter((p) => p.status === 'pendiente')
    .reduce((sum, p) => sum + p.amount, 0)
  const prevPending = prevMonthAllPayments
    .filter((p) => p.status === 'pendiente')
    .reduce((sum, p) => sum + p.amount, 0)
  const pendingDiff = prevPending > 0 ? Math.round(((currentPending - prevPending) / prevPending) * 100) : 0

  const totalCurrentMonth = currentMonthAllPayments
    .filter((p) => p.status !== 'cancelado')
    .reduce((sum, p) => sum + p.amount, 0)
  const collectionRate = totalCurrentMonth > 0 ? Math.round((currentRevenue / totalCurrentMonth) * 100) : 0

  const monthStart = new Date(currentYear, currentMonth - 1, 1)
  const monthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59)
  const altasEsteMes = players.filter(
    (p) => p.registrationDate >= monthStart && p.registrationDate <= monthEnd
  ).length
  const bajasEsteMes = players.filter(
    (p) => p.cancellationDate && p.cancellationDate >= monthStart && p.cancellationDate <= monthEnd
  ).length
  const rotationDivisor = activePlayers + bajasEsteMes
  const rotationIndex = rotationDivisor > 0
    ? Math.round(((bajasEsteMes + altasEsteMes) / rotationDivisor) * 100)
    : 0
  const churnRate = rotationDivisor > 0
    ? Math.round((bajasEsteMes / rotationDivisor) * 100)
    : 0

  const today = now.getDay()
  const todayGroups = groups.filter(
    (g) => g.isActive && g.schedule.some((s) => s.dayOfWeek === today)
  )

  const coachClassesToday = useMemo(() => {
    if (!currentCoachId) return 0
    return todayGroups.filter(g => g.coachId === currentCoachId).length
  }, [currentCoachId, todayGroups])

  // ── Chart data ────────────────────────────────────────────────────
  const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const attendanceData = useMemo(() => {
    const todayDate = new Date()
    const dayOfWeek = todayDate.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const weekStart = new Date(todayDate)
    weekStart.setDate(todayDate.getDate() + mondayOffset)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    const weekDays = [1, 2, 3, 4, 5, 6]
    const data = weekDays.map((d) => ({ day: DAY_LABELS[d], asistencia: 0, faltas: 0 }))

    for (const record of attendance) {
      const recordDate = new Date(record.date)
      if (recordDate < weekStart || recordDate > weekEnd) continue
      const recordDay = recordDate.getDay()
      const idx = weekDays.indexOf(recordDay)
      if (idx === -1) continue
      for (const entry of record.records) {
        if (entry.status === 'presente') data[idx].asistencia++
        else if (entry.status === 'ausente' || entry.status === 'justificado') data[idx].faltas++
      }
    }
    return data
  }, [attendance])

  const levelData = [
    { name: 'Iniciación', value: players.filter((p) => p.level === 'iniciacion' && p.status === 'activo').length, color: '#10b981' },
    { name: 'Intermedio', value: players.filter((p) => p.level === 'intermedio' && p.status === 'activo').length, color: '#0e7490' },
    { name: 'Avanzado', value: players.filter((p) => p.level === 'avanzado' && p.status === 'activo').length, color: '#6366f1' },
    { name: 'Competición', value: players.filter((p) => p.level === 'competicion' && p.status === 'activo').length, color: '#f43f5e' },
    { name: 'Menores', value: players.filter((p) => p.level === 'menores' && p.status === 'activo').length, color: '#f59e0b' },
  ].filter((d) => d.value > 0)

  const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const financialData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(currentYear, currentMonth - 1 - (5 - i), 1)
    const m = d.getMonth() + 1
    const y = d.getFullYear()
    const monthPayments = allPayments.filter((p) => p.billingMonth === m && p.billingYear === y)
    return {
      month: MONTH_NAMES[d.getMonth()],
      cobrado: monthPayments.filter((p) => p.status === 'pagado').reduce((sum, p) => sum + p.amount, 0),
      pendiente: monthPayments.filter((p) => p.status === 'pendiente').reduce((sum, p) => sum + p.amount, 0),
    }
  })

  const visibleActivities = canReadPayments
    ? activities
    : activities.filter((a) => a.type !== 'payment_received')

  const timeAgo = (_date: Date) => '' // now handled by ActivityFeed

  // Shared chart tooltip style
  const tooltipStyle = {
    contentStyle: {
      borderRadius: '10px',
      border: `1px solid ${CHART_COLORS.tooltip.border}`,
      fontSize: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      background: CHART_COLORS.tooltip.background,
    },
  }

  return (
    <div>
      <Header
        title={`Hola, ${user?.displayName?.split(' ')[0] || 'Director'} 👋`}
        subtitle={`Resumen de hoy · ${now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}`}
        actions={
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowKpiDialog(true)}
            title="Configurar KPIs"
            className="rounded-xl text-muted-foreground hover:text-foreground"
          >
            <SettingsIcon className="h-5 w-5" />
          </Button>
        }
      />

      <div className="p-5 lg:p-6 space-y-6">

        {/* ── KPI Cards ────────────────────────────────────────── */}
        {isCoach && !currentCoachId && (
          <div className="col-span-full p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-amber-800">
              No se encontró un perfil de entrenador vinculado. Contacta al administrador.
            </p>
          </div>
        )}

        <div className="flex overflow-x-auto pb-4 snap-x snap-mandatory -mx-5 px-5 lg:mx-0 lg:px-0 lg:pb-0 lg:grid lg:grid-cols-4 xl:grid-cols-5 gap-4 no-scrollbar">
          {isCoach ? (
            /* KPIs para Entrenadores */
            <>
              <StatCard
                title="Horas Trabajadas (Este Mes)"
                value={`${coachHoursThisMonth}h`}
                icon={Clock}
                iconClassName="bg-blue-100 text-blue-600"
                accentColor="#2563eb"
                className="min-w-[280px] sm:min-w-0 snap-center"
              />
              <StatCard
                title="Jugadores Asignados"
                value={coachAssignedPlayers}
                icon={Users}
                iconClassName="bg-green-100 text-green-600"
                accentColor="#16a34a"
                className="min-w-[280px] sm:min-w-0 snap-center"
              />
              <StatCard
                title="Grupos Totales"
                value={coachTotalGroups}
                icon={GraduationCap}
                iconClassName="bg-purple-100 text-purple-600"
                accentColor="#9333ea"
                className="min-w-[280px] sm:min-w-0 snap-center"
              />
              <StatCard
                title="Clases Particulares"
                value={coachTotalPrivateLessons}
                icon={CalendarDays}
                iconClassName="bg-orange-100 text-orange-600"
                accentColor="#ea580c"
                className="min-w-[280px] sm:min-w-0 snap-center"
              />
              <StatCard
                title="Clases Hoy"
                value={coachClassesToday}
                icon={CalendarCheck}
                iconClassName="bg-indigo-100 text-indigo-600"
                accentColor="#4f46e5"
                className="min-w-[280px] sm:min-w-0 snap-center"
              />
              <StatCard
                title="Grupos Incompletos"
                value={coachIncompleteGroups}
                icon={AlertCircle}
                iconClassName="bg-amber-100 text-amber-600"
                accentColor="#d97706"
                className="min-w-[280px] sm:min-w-0 snap-center"
              />
            </>
          ) : (
            /* KPIs existentes para otros roles */
            <>
              {kpiConfig.activePlayers && (
                <StatCard
                  title="Jugadores activos"
                  value={activePlayers}
                  icon={Users}
                  iconClassName="bg-primary/10 text-primary"
                  accentColor="#0e7490"
                  className="min-w-[280px] sm:min-w-0 snap-center"
                />
              )}
              {isAdmin && kpiConfig.revenue && (
                <StatCard
                  title="Ingresos este mes"
                  value={formatCurrency(currentRevenue)}
                  icon={DollarSign}
                  trend={{ value: revenueDiff, label: 'vs mes anterior' }}
                  iconClassName="bg-primary/10 text-primary"
                  accentColor="#0e7490"
                  className="min-w-[280px] sm:min-w-0 snap-center"
                />
              )}
              {isAdmin && kpiConfig.pendingPayments && (
                <StatCard
                  title="Pagos pendientes"
                  value={formatCurrency(currentPending)}
                  icon={AlertCircle}
                  trend={{ value: pendingDiff, label: 'vs mes anterior' }}
                  iconClassName="bg-primary/10 text-primary"
                  accentColor="#0e7490"
                  className="min-w-[280px] sm:min-w-0 snap-center"
                />
              )}
              {kpiConfig.activeGroups && (
                <StatCard
                  title="Grupos activos"
                  value={activeGroups}
                  icon={GraduationCap}
                  iconClassName="bg-primary/10 text-primary"
                  accentColor="#0e7490"
                  className="min-w-[280px] sm:min-w-0 snap-center"
                />
              )}
              {isAdmin && kpiConfig.collectionRate && (
                <StatCard
                  title="Ratio de cobro"
                  value={`${collectionRate}%`}
                  icon={TrendingUp}
                  iconClassName="bg-primary/10 text-primary"
                  accentColor="#0e7490"
                  className="min-w-[280px] sm:min-w-0 snap-center"
                />
              )}
              {kpiConfig.todayClasses && (
                <StatCard
                  title="Clases hoy"
                  value={todayGroups.length}
                  icon={CalendarDays}
                  iconClassName="bg-primary/10 text-primary"
                  accentColor="#0e7490"
                  className="min-w-[280px] sm:min-w-0 snap-center"
                />
              )}
              {kpiConfig.totalEnrolled && (
                <StatCard
                  title="Alumnos inscritos"
                  value={enrollments.filter((e) => e.isActive).length}
                  icon={Activity}
                  iconClassName="bg-primary/10 text-primary"
                  accentColor="#0e7490"
                  className="min-w-[280px] sm:min-w-0 snap-center"
                />
              )}
              {kpiConfig.waitingList && (
                <StatCard
                  title="Lista de espera"
                  value={players.filter((p) => p.status === 'lista_espera').length}
                  icon={Clock}
                  iconClassName="bg-primary/10 text-primary"
                  accentColor="#0e7490"
                  className="min-w-[280px] sm:min-w-0 snap-center"
                />
              )}
              {kpiConfig.rotationIndex && (
                <StatCard
                  title="Índice de rotación"
                  value={`${rotationIndex}%`}
                  icon={RefreshCw}
                  iconClassName="bg-primary/10 text-primary"
                  accentColor="#0e7490"
                  className="min-w-[280px] sm:min-w-0 snap-center"
                />
              )}
              {kpiConfig.churnRate && (
                <StatCard
                  title="Ratio de abandono"
                  value={`${churnRate}%`}
                  icon={UserMinus}
                  iconClassName="bg-primary/10 text-primary"
                  accentColor="#0e7490"
                  className="min-w-[280px] sm:min-w-0 snap-center"
                />
              )}
            </>
          )}
        </div>

        {/* ── Charts row 1 ────────────────────────────────────── */}
        {(kpiConfig.attendanceChart || kpiConfig.levelChart) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {kpiConfig.attendanceChart && (
              <Card className="lg:col-span-2 border-border/60 shadow-[var(--shadow-card)]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-5 pt-5">
                  <div>
                    <CardTitle className="text-sm font-bold text-foreground">📊 Asistencia semanal</CardTitle>
                    {chartCollapsed.attendanceChart && (
                      <p className="text-xs text-muted-foreground">Minimizado</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-muted-foreground"
                    onClick={() => toggleChartCollapsed('attendanceChart')}
                  >
                    {chartCollapsed.attendanceChart ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  </Button>
                </CardHeader>
                {!chartCollapsed.attendanceChart && (
                  <CardContent className="px-5 pb-5">
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={attendanceData} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                        <XAxis dataKey="day" fontSize={11} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis fontSize={11} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip {...tooltipStyle} />
                        <Bar dataKey="asistencia" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} name="Asistencia" maxBarSize={40} />
                        <Bar dataKey="faltas" fill={CHART_COLORS.danger} radius={[6, 6, 0, 0]} name="Faltas" maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                )}
              </Card>
            )}

            {kpiConfig.levelChart && (
              <Card className="border-border/60 shadow-[var(--shadow-card)]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-5 pt-5">
                  <div>
                    <CardTitle className="text-sm font-bold text-foreground">🎯 Distribución por nivel</CardTitle>
                    {chartCollapsed.levelChart && (
                      <p className="text-xs text-muted-foreground">Minimizado</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-muted-foreground"
                    onClick={() => toggleChartCollapsed('levelChart')}
                  >
                    {chartCollapsed.levelChart ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  </Button>
                </CardHeader>
                {!chartCollapsed.levelChart && (
                  <CardContent className="px-5 pb-5">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={levelData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={78}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {levelData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip {...tooltipStyle} formatter={(value) => [`${value} jugadores`, '']} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-3 space-y-1.5">
                      {levelData.map((entry) => (
                        <div key={entry.name} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                            <span className="text-muted-foreground text-xs">{entry.name}</span>
                          </div>
                          <span className="font-bold text-foreground text-xs">{entry.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            )}
          </div>
        )}

        {/* ── Financial chart ──────────────────────────────────── */}
        {isAdmin && kpiConfig.financialChart && (
          <Card className="border-border/60 shadow-[var(--shadow-card)]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-5 pt-5">
              <div>
                <CardTitle className="text-sm font-bold text-foreground">💶 Resumen financiero · últimos 6 meses</CardTitle>
                {chartCollapsed.financialChart && (
                  <p className="text-xs text-muted-foreground">Minimizado</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground"
                onClick={() => toggleChartCollapsed('financialChart')}
              >
                {chartCollapsed.financialChart ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </Button>
            </CardHeader>
            {!chartCollapsed.financialChart && (
              <CardContent className="px-5 pb-5">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={financialData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                    <XAxis dataKey="month" fontSize={11} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis fontSize={11} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}€`} />
                    <Tooltip {...tooltipStyle} formatter={(value) => [`${Number(value).toLocaleString('es-ES')}€`, '']} />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                    <Bar dataKey="cobrado" fill={CHART_COLORS.success} radius={[6, 6, 0, 0]} name="Cobrado" maxBarSize={48} />
                    <Bar dataKey="pendiente" fill={CHART_COLORS.secondary} radius={[6, 6, 0, 0]} name="Pendiente" maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            )}
          </Card>
        )}

        {/* ── Bottom row ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Activity feed */}
          <Card className="border-border/60 shadow-[var(--shadow-card)] flex flex-col min-h-[460px]">
            <ActivityFeed activities={activities} canReadPayments={canReadPayments} />
          </Card>

          {/* Today's schedule */}
          <Card className="border-border/60 shadow-[var(--shadow-card)]">
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-sm font-bold text-foreground">📅 Clases de hoy</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {todayGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No hay clases programadas para hoy
                </p>
              ) : (
                <div className="space-y-2.5">
                  {todayGroups
                    .sort((a, b) => {
                      const aTime = a.schedule.find((s) => s.dayOfWeek === today)?.startTime || ''
                      const bTime = b.schedule.find((s) => s.dayOfWeek === today)?.startTime || ''
                      return aTime.localeCompare(bTime)
                    })
                    .map((group) => {
                      const slot = group.schedule.find((s) => s.dayOfWeek === today)!
                      return (
                        <div key={group.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-secondary/40 px-4 py-3 hover:bg-secondary/70 transition-colors duration-150">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-foreground">{group.name}</span>
                              <StatusBadge status={group.level} />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {group.courtName} · {group.coachName}
                            </p>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <span className="inline-flex items-center rounded-lg bg-primary/10 text-primary px-2.5 py-1 text-xs font-bold">
                              {slot.startTime}–{slot.endTime}
                            </span>
                            <p className="text-xs text-muted-foreground mt-1">
                              {group.currentEnrollment}/{group.maxCapacity} alumnos
                            </p>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── KPI Config Dialog ─────────────────────────────────── */}
      <Dialog open={showKpiDialog} onOpenChange={setShowKpiDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar indicadores</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Selecciona qué indicadores mostrar en el panel.</p>
            <div className="space-y-3">
              {[
                { key: 'activePlayers', label: 'Jugadores activos', financial: false },
                { key: 'revenue', label: 'Ingresos del mes', financial: true },
                { key: 'pendingPayments', label: 'Pagos pendientes', financial: true },
                { key: 'activeGroups', label: 'Grupos activos', financial: false },
                { key: 'collectionRate', label: 'Ratio de cobro', financial: true },
                { key: 'todayClasses', label: 'Clases de hoy', financial: false },
                { key: 'totalEnrolled', label: 'Total alumnos inscritos', financial: false },
                { key: 'waitingList', label: 'Lista de espera', financial: false },
                { key: 'rotationIndex', label: 'Índice de rotación', financial: false },
                { key: 'churnRate', label: 'Ratio de abandono (Churn)', financial: false },
              ].filter((item) => !item.financial || isAdmin).map((item) => (
                <div key={item.key} className="flex items-center gap-3">
                  <Checkbox
                    checked={kpiConfig[item.key]}
                    onCheckedChange={(checked) =>
                      setKpiConfig((prev) => ({ ...prev, [item.key]: checked }))
                    }
                  />
                  <Label className="cursor-pointer text-sm">{item.label}</Label>
                </div>
              ))}

              <div className="border-t pt-3 mt-1">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Gráficos</p>
                {[
                  { key: 'attendanceChart', label: 'Asistencia semanal', financial: false },
                  { key: 'levelChart', label: 'Distribución por nivel', financial: false },
                  { key: 'financialChart', label: 'Resumen financiero', financial: true },
                ].filter((item) => !item.financial || isAdmin).map((item) => (
                  <div key={item.key} className="flex items-center gap-3 mb-3">
                    <Checkbox
                      checked={kpiConfig[item.key]}
                      onCheckedChange={(checked) =>
                        setKpiConfig((prev) => ({ ...prev, [item.key]: checked }))
                      }
                    />
                    <Label className="cursor-pointer text-sm">{item.label}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKpiConfig(defaultKpiConfig)}>
              Restaurar
            </Button>
            <Button onClick={() => setShowKpiDialog(false)}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
