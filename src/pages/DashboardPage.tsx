import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/shared/StatCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ActivityFeed } from '@/components/shared/ActivityFeed'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useDataStore } from '@/stores/dataStore'
import { useAuthStore, hasPermission } from '@/stores/authStore'
import type { UserRole } from '@/types'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { normalizeAllPayments } from '@/lib/payment-utils'
import { usePaymentsQuery, useEventPaymentsQuery, usePrivateLessonPaymentsQuery, useAttendanceQuery, useActivitiesQuery } from '@/hooks/useQueries'
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
  CheckCircle2,
  ChevronRight,
  Phone,
  Trophy,
  MapPin,
  Bell,
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
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'director' || user?.role === 'coordinador'
  const isCoach = user?.role === 'entrenador'
  const canReadPayments = hasPermission(user?.role as UserRole, 'payments', 'read')
  const { players, groups, enrollments, coaches, privateLessons, attendanceNotices } = useDataStore()

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const { data: paymentsCurrentYear = [] } = usePaymentsQuery(currentYear)
  const { data: paymentsPrevYear = [] } = usePaymentsQuery(currentYear - 1)
  const payments = [...paymentsCurrentYear, ...paymentsPrevYear]
  
  const { data: eventPayments = [] } = useEventPaymentsQuery()
  const { data: privateLessonPayments = [] } = usePrivateLessonPaymentsQuery()
  const { data: attendance = [] } = useAttendanceQuery()
  const { data: activities = [] } = useActivitiesQuery(100)

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

  // ── Active/Next Class Logic ───────────────────────────────────────
  const activeClass = useMemo(() => {
    if (!currentCoachId) return null
    const now = new Date()
    const jsDay = now.getDay()
    const dayOfWeek = jsDay === 0 ? 0 : jsDay // 0 is Sunday in constants too

    const currentCoachGroups = groups.filter(g => g.coachId === currentCoachId && g.isActive)
    
    for (const group of currentCoachGroups) {
      for (const slot of group.schedule) {
        if (slot.dayOfWeek === dayOfWeek) {
          const [startH, startM] = slot.startTime.split(':').map(Number)
          const [endH, endM] = slot.endTime.split(':').map(Number)
          
          const startTime = new Date(now)
          startTime.setHours(startH, startM, 0)
          
          const endTime = new Date(now)
          endTime.setHours(endH, endM, 0)
          
          // Current class or next one within 60 minutes
          const diffMinutes = (startTime.getTime() - now.getTime()) / (1000 * 60)
          
          if ((diffMinutes >= -15 && diffMinutes <= 60) || (now >= startTime && now <= endTime)) {
            return {
              id: group.id,
              name: group.name,
              startTime: slot.startTime,
              endTime: slot.endTime,
              isOngoing: now >= startTime && now <= endTime,
              courtName: group.courtName
            }
          }
        }
      }
    }
    return null
  }, [currentCoachId, groups])

  // ── KPI calculations ──────────────────────────────────────────────
  const activePlayers = players.filter((p) => p.status === 'activo').length
  const activeGroups = groups.filter((g) => g.isActive).length
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
    (g) => g.isActive && g.schedule.some((s) => s.dayOfWeek === today) && (!isCoach || g.coachId === currentCoachId)
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

  const visibleActivities = useMemo(() => {
    let filtered = activities
    if (!canReadPayments) {
      filtered = filtered.filter((a) => a.type !== 'payment_received')
    }
    if (isCoach && user?.id) {
      filtered = filtered.filter((a) => a.userId === user.id)
    }
    return filtered
  }, [activities, canReadPayments, isCoach, user?.id])

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

      {/* Coach-First Interface - Only for Coaches */}
      {isCoach && (
        <div className="px-5 lg:px-6 space-y-6 mb-6">
          
          {/* Recovery/Attendance Alerts Section */}
          <div className="space-y-3">
            {attendanceNotices
              .filter(notice => {
                const isToday = notice.date.toISOString().split('T')[0] === now.toISOString().split('T')[0];
                const coachGroupIds = groups.filter(g => g.coachId === currentCoachId).map(g => g.id);
                return isToday && coachGroupIds.includes(notice.groupId);
              })
              .map(notice => (
                <div key={notice.id} className={cn(
                  "rounded-2xl border p-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-500",
                  notice.type === 'absent' 
                    ? "border-amber-200 bg-amber-50/50" 
                    : "border-blue-200 bg-blue-50/50"
                )}>
                  <div className="flex gap-4">
                    <div className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      notice.type === 'absent' ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
                    )}>
                      {notice.type === 'absent' ? <Trophy className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
                    </div>
                    <div className="space-y-1">
                      <h4 className={cn(
                        "text-sm font-bold",
                        notice.type === 'absent' ? "text-amber-900" : "text-blue-900"
                      )}>
                        {notice.type === 'absent' ? 'Aviso de Ausencia' : 'Confirmación de Asistencia'}
                      </h4>
                      <p className={cn(
                        "text-xs leading-relaxed",
                        notice.type === 'absent' ? "text-amber-700" : "text-blue-700"
                      )}>
                        <strong>{notice.playerName}</strong> {notice.type === 'absent' ? 'no vendrá hoy.' : 'ha confirmado que viene.'}
                        {notice.notes && <span className="block mt-1 italic">"{notice.notes}"</span>}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            
            {/* Fallback mock if no real notices today - only in dev or if empty to show the feature */}
            {attendanceNotices.length === 0 && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50/30 p-4 border-dashed">
                <p className="text-[11px] text-slate-400 text-center font-medium">No hay avisos de alumnos para hoy</p>
              </div>
            )}
          </div>

          {/* Quick Attendance Widget (Active Class) */}
          {activeClass ? (
            <Card className="border-none shadow-xl shadow-primary/5 overflow-hidden rounded-[2rem] bg-white">
              <CardHeader className="pb-3 px-6 pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-wider text-primary/80">Pasar Lista</h3>
                  <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest animate-pulse">
                    En curso
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-6 space-y-4">
                {/* List of students in current class (Preview) */}
                <div className="space-y-3">
                  {[
                    { id: '1', name: 'Ana Gracía', initial: 'A' },
                    { id: '2', name: 'Carlos Ruíz', initial: 'C' },
                    { id: '3', name: 'Laura M.', initial: 'L', pending: true }
                  ].map((student) => (
                    <div key={student.id} className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-sm">
                          {student.initial}
                        </div>
                        <span className="text-sm font-bold text-slate-700">{student.name}</span>
                      </div>
                      <div className={cn(
                        "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors",
                        student.pending 
                          ? "border-slate-200 text-slate-200" 
                          : "border-emerald-500 bg-emerald-500 text-white"
                      )}>
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4">
                  <Button 
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 rounded-2xl font-bold shadow-lg shadow-emerald-200 transition-all active:scale-[0.98]"
                    onClick={() => navigate(`/asistencia?groupId=${activeClass.id}`)}
                  >
                    Ir a Gestión de Clase
                    <ChevronRight className="h-5 w-5 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-12 rounded-[2rem] border-2 border-dashed border-slate-100 bg-slate-50/50">
              <Clock className="h-8 w-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-400">No hay clases activas en este momento</p>
            </div>
          )}
        </div>
      )}

      <div className="p-5 lg:p-6 space-y-6 pt-0 sm:pt-6">

        {/* ── KPI Cards ────────────────────────────────────────── */}
        {isCoach && !currentCoachId && (
          <div className="col-span-full p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-amber-800">
              No se encontró un perfil de entrenador vinculado. Contacta al administrador.
            </p>
          </div>
        )}

        {/* Mobile: Horizontal scroll (flex). Tablet/Desktop: Grid */}
        <div className="flex flex-row overflow-x-auto pb-4 snap-x snap-mandatory -mx-5 px-5 md:mx-0 md:px-0 md:pb-0 md:grid md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 no-scrollbar">
          {isCoach ? (
            /* KPIs para Entrenadores */
            <>
              <StatCard
                title="Horas Trabajadas (Este Mes)"
                value={`${coachHoursThisMonth}h`}
                icon={Clock}
                iconClassName="bg-blue-100 text-blue-600"
                accentColor="#2563eb"
                className="min-w-[280px] shrink-0 sm:min-w-0 snap-center"
              />
              <StatCard
                title="Jugadores Asignados"
                value={coachAssignedPlayers}
                icon={Users}
                iconClassName="bg-green-100 text-green-600"
                accentColor="#16a34a"
                className="min-w-[280px] shrink-0 sm:min-w-0 snap-center"
              />
              <StatCard
                title="Grupos Totales"
                value={coachTotalGroups}
                icon={GraduationCap}
                iconClassName="bg-purple-100 text-purple-600"
                accentColor="#9333ea"
                className="min-w-[280px] shrink-0 sm:min-w-0 snap-center"
              />
              <StatCard
                title="Clases Particulares"
                value={coachTotalPrivateLessons}
                icon={CalendarDays}
                iconClassName="bg-orange-100 text-orange-600"
                accentColor="#ea580c"
                className="min-w-[280px] shrink-0 sm:min-w-0 snap-center"
              />
              <StatCard
                title="Clases Hoy"
                value={coachClassesToday}
                icon={CalendarCheck}
                iconClassName="bg-indigo-100 text-indigo-600"
                accentColor="#4f46e5"
                className="min-w-[280px] shrink-0 sm:min-w-0 snap-center"
              />
              <StatCard
                title="Grupos Incompletos"
                value={coachIncompleteGroups}
                icon={AlertCircle}
                iconClassName="bg-amber-100 text-amber-600"
                accentColor="#d97706"
                className="min-w-[280px] shrink-0 sm:min-w-0 snap-center"
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
                  className="min-w-[280px] shrink-0 sm:min-w-0 snap-center"
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
                  className="min-w-[280px] shrink-0 sm:min-w-0 snap-center"
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
                  className="min-w-[280px] shrink-0 sm:min-w-0 snap-center"
                />
              )}
              {kpiConfig.activeGroups && (
                <StatCard
                  title="Grupos activos"
                  value={activeGroups}
                  icon={GraduationCap}
                  iconClassName="bg-primary/10 text-primary"
                  accentColor="#0e7490"
                  className="min-w-[280px] shrink-0 sm:min-w-0 snap-center"
                />
              )}
              {isAdmin && kpiConfig.collectionRate && (
                <StatCard
                  title="Ratio de cobro"
                  value={`${collectionRate}%`}
                  icon={TrendingUp}
                  iconClassName="bg-primary/10 text-primary"
                  accentColor="#0e7490"
                  className="min-w-[280px] shrink-0 sm:min-w-0 snap-center"
                />
              )}
              {kpiConfig.todayClasses && (
                <StatCard
                  title="Clases hoy"
                  value={todayGroups.length}
                  icon={CalendarDays}
                  iconClassName="bg-primary/10 text-primary"
                  accentColor="#0e7490"
                  className="min-w-[280px] shrink-0 sm:min-w-0 snap-center"
                />
              )}
              {kpiConfig.totalEnrolled && (
                <StatCard
                  title="Alumnos inscritos"
                  value={enrollments.filter((e) => e.isActive).length}
                  icon={Activity}
                  iconClassName="bg-primary/10 text-primary"
                  accentColor="#0e7490"
                  className="min-w-[280px] shrink-0 sm:min-w-0 snap-center"
                />
              )}
              {kpiConfig.waitingList && (
                <StatCard
                  title="Lista de espera"
                  value={players.filter((p) => p.status === 'lista_espera').length}
                  icon={Clock}
                  iconClassName="bg-primary/10 text-primary"
                  accentColor="#0e7490"
                  className="min-w-[280px] shrink-0 sm:min-w-0 snap-center"
                />
              )}
              {kpiConfig.rotationIndex && (
                <StatCard
                  title="Índice de rotación"
                  value={`${rotationIndex}%`}
                  icon={RefreshCw}
                  iconClassName="bg-primary/10 text-primary"
                  accentColor="#0e7490"
                  className="min-w-[280px] shrink-0 sm:min-w-0 snap-center"
                />
              )}
              {kpiConfig.churnRate && (
                <StatCard
                  title="Ratio de abandono"
                  value={`${churnRate}%`}
                  icon={UserMinus}
                  iconClassName="bg-primary/10 text-primary"
                  accentColor="#0e7490"
                  className="min-w-[280px] shrink-0 sm:min-w-0 snap-center"
                />
              )}
            </>
          )}
        </div>

        {/* ── Charts row 1 ────────────────────────────────────── */}
        {!isCoach && (kpiConfig.attendanceChart || kpiConfig.levelChart) && (
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
        {!isCoach && isAdmin && kpiConfig.financialChart && (
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
            <ActivityFeed activities={visibleActivities} canReadPayments={canReadPayments} />
          </Card>

          {/* Today's schedule - Redesigned for Coach View */}
          <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
            <CardHeader className="px-6 pt-6 pb-3">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Tu Agenda Hoy</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              {todayGroups.length === 0 ? (
                <div className="text-center py-8">
                  <CalendarDays className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400 font-medium">Libre hoy</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {todayGroups
                    .sort((a, b) => {
                      const aTime = a.schedule.find((s) => s.dayOfWeek === today)?.startTime || ''
                      const bTime = b.schedule.find((s) => s.dayOfWeek === today)?.startTime || ''
                      return aTime.localeCompare(bTime)
                    })
                    .map((group) => {
                      const slot = group.schedule.find((s) => s.dayOfWeek === today)!
                      const isNext = activeClass?.id === group.id
                      
                      return (
                        <div key={group.id} className={cn(
                          "flex items-center gap-4 rounded-2xl p-4 transition-all duration-150 border-2",
                          isNext 
                            ? "bg-emerald-50/50 border-emerald-100 shadow-sm" 
                            : "bg-slate-50/30 border-transparent hover:border-slate-100"
                        )}>
                          <div className="text-center shrink-0 w-12">
                            <span className={cn(
                              "text-xs font-black block",
                              isNext ? "text-emerald-600" : "text-slate-400"
                            )}>
                              {slot.startTime}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className={cn(
                              "text-sm font-bold truncate",
                              isNext ? "text-emerald-900" : "text-slate-700"
                            )}>
                              {group.name}
                            </h4>
                            <p className="text-[11px] text-slate-400 font-medium truncate">
                              {group.courtName} · {group.currentEnrollment} alumnos
                            </p>
                          </div>
                          {isNext && (
                            <ChevronRight className="h-4 w-4 text-emerald-400 shrink-0" />
                          )}
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
