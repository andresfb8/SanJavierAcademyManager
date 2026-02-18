import { useState, useEffect, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/shared/StatCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
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
  Activity,
  Settings as SettingsIcon,
  ChevronDown,
  ChevronUp,
  RefreshCw,
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
  // Chart visibility
  attendanceChart: true,
  levelChart: true,
  financialChart: true,
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const canReadPayments = hasPermission(user?.role as UserRole, 'payments', 'read')
  const { players, payments, groups, activities, enrollments, attendance, eventPayments, privateLessonPayments, checkAndAutoGenerateReceipts, cleanupOrphanedPayments } = useDataStore()

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

  // Auto-generate receipts and clean up orphaned payments on mount
  useEffect(() => {
    checkAndAutoGenerateReceipts()
    cleanupOrphanedPayments()
  }, [checkAndAutoGenerateReceipts, cleanupOrphanedPayments])

  const [chartCollapsed, setChartCollapsed] = useState<Record<string, boolean>>({})

  const toggleChartCollapsed = (key: string) => {
    setChartCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // KPIs
  const activePlayers = players.filter((p) => p.status === 'activo').length
  const activeGroups = groups.filter((g) => g.isActive).length

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear

  // Unificar todos los pagos (cuotas + eventos + clases particulares)
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

  // Collection rate
  const totalCurrentMonth = currentMonthAllPayments
    .filter((p) => p.status !== 'cancelado')
    .reduce((sum, p) => sum + p.amount, 0)
  const collectionRate = totalCurrentMonth > 0 ? Math.round((currentRevenue / totalCurrentMonth) * 100) : 0

  // Rotation index KPI
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

  // Attendance chart data (real data from current week)
  const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const attendanceData = useMemo(() => {
    // Get start of current week (Monday)
    const todayDate = new Date()
    const dayOfWeek = todayDate.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const weekStart = new Date(todayDate)
    weekStart.setDate(todayDate.getDate() + mondayOffset)
    weekStart.setHours(0, 0, 0, 0)

    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    // Initialize data for Mon-Sat (indexes 1-6)
    const weekDays = [1, 2, 3, 4, 5, 6] // Mon to Sat
    const data = weekDays.map((d) => ({
      day: DAY_LABELS[d],
      asistencia: 0,
      faltas: 0,
    }))

    // Iterate attendance records from the current week
    for (const record of attendance) {
      const recordDate = new Date(record.date)
      if (recordDate < weekStart || recordDate > weekEnd) continue
      const recordDay = recordDate.getDay()
      const idx = weekDays.indexOf(recordDay)
      if (idx === -1) continue

      for (const entry of record.records) {
        if (entry.status === 'presente') {
          data[idx].asistencia++
        } else if (entry.status === 'ausente' || entry.status === 'justificado') {
          data[idx].faltas++
        }
      }
    }
    return data
  }, [attendance])

  // Level distribution
  const levelData = [
    { name: 'Iniciación', value: players.filter((p) => p.level === 'iniciacion' && p.status === 'activo').length, color: '#22c55e' },
    { name: 'Intermedio', value: players.filter((p) => p.level === 'intermedio' && p.status === 'activo').length, color: '#3b82f6' },
    { name: 'Avanzado', value: players.filter((p) => p.level === 'avanzado' && p.status === 'activo').length, color: '#8b5cf6' },
    { name: 'Competición', value: players.filter((p) => p.level === 'competicion' && p.status === 'activo').length, color: '#ef4444' },
    { name: 'Menores', value: players.filter((p) => p.level === 'menores' && p.status === 'activo').length, color: '#f59e0b' },
  ].filter((d) => d.value > 0)

  // Financial chart data (last 6 months) — incluye todos los origenes de pago
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

  // Filtered activities (hide payment events for roles without payment access)
  const visibleActivities = canReadPayments
    ? activities
    : activities.filter((a) => a.type !== 'payment_received')

  // Today's classes
  const today = now.getDay()
  const todayGroups = groups.filter(
    (g) => g.isActive && g.schedule.some((s) => s.dayOfWeek === today)
  )

  // Activity type icons and labels
  const activityConfig: Record<string, { icon: string; color: string }> = {
    payment_received: { icon: '💰', color: 'text-green-600' },
    player_created: { icon: '👤', color: 'text-blue-600' },
    player_cancelled: { icon: '🚪', color: 'text-red-600' },
    attendance_recorded: { icon: '📋', color: 'text-purple-600' },
    group_created: { icon: '👥', color: 'text-indigo-600' },
    recovery_used: { icon: '🔄', color: 'text-yellow-600' },
  }

  const timeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
    if (seconds < 60) return 'Hace un momento'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `Hace ${minutes} min`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `Hace ${hours}h`
    const days = Math.floor(hours / 24)
    return `Hace ${days}d`
  }

  return (
    <div>
      <Header
        title={`Hola, ${user?.displayName?.split(' ')[0] || 'Director'}`}
        subtitle="Resumen de tu escuela de pádel"
        actions={
          <Button variant="ghost" size="icon" onClick={() => setShowKpiDialog(true)} title="Configurar KPIs">
            <SettingsIcon className="h-5 w-5" />
          </Button>
        }
      />
      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiConfig.activePlayers && (
            <StatCard
              title="Jugadores activos"
              value={activePlayers}
              icon={Users}
              iconClassName="bg-blue-50 text-blue-600"
            />
          )}
          {canReadPayments && kpiConfig.revenue && (
            <StatCard
              title="Ingresos este mes"
              value={formatCurrency(currentRevenue)}
              icon={DollarSign}
              trend={{ value: revenueDiff, label: 'vs mes anterior' }}
              iconClassName="bg-green-50 text-green-600"
            />
          )}
          {canReadPayments && kpiConfig.pendingPayments && (
            <StatCard
              title="Pagos pendientes"
              value={formatCurrency(currentPending)}
              icon={AlertCircle}
              trend={{ value: pendingDiff, label: 'vs mes anterior' }}
              iconClassName="bg-yellow-50 text-yellow-600"
            />
          )}
          {kpiConfig.activeGroups && (
            <StatCard
              title="Grupos activos"
              value={activeGroups}
              icon={GraduationCap}
              iconClassName="bg-purple-50 text-purple-600"
            />
          )}
          {canReadPayments && kpiConfig.collectionRate && (
            <StatCard
              title="Ratio de cobro"
              value={`${collectionRate}%`}
              icon={TrendingUp}
              iconClassName="bg-emerald-50 text-emerald-600"
            />
          )}
          {kpiConfig.todayClasses && (
            <StatCard
              title="Clases hoy"
              value={todayGroups.length}
              icon={CalendarDays}
              iconClassName="bg-indigo-50 text-indigo-600"
            />
          )}
          {kpiConfig.totalEnrolled && (
            <StatCard
              title="Total alumnos inscritos"
              value={enrollments.filter((e) => e.isActive).length}
              icon={Activity}
              iconClassName="bg-pink-50 text-pink-600"
            />
          )}
          {kpiConfig.waitingList && (
            <StatCard
              title="Lista de espera"
              value={players.filter((p) => p.status === 'lista_espera').length}
              icon={Clock}
              iconClassName="bg-orange-50 text-orange-600"
            />
          )}
          {kpiConfig.rotationIndex && (
            <StatCard
              title="Índice de rotación"
              value={`${rotationIndex}%`}
              icon={RefreshCw}
              iconClassName="bg-teal-50 text-teal-600"
            />
          )}
        </div>

        {/* Charts row 1 */}
        {(kpiConfig.attendanceChart || kpiConfig.levelChart) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Attendance chart */}
            {kpiConfig.attendanceChart && (
              <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">Asistencia semanal</CardTitle>
                    {chartCollapsed.attendanceChart && (
                      <span className="text-xs text-muted-foreground">(Minimizado)</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => toggleChartCollapsed('attendanceChart')}
                    title={chartCollapsed.attendanceChart ? 'Expandir' : 'Minimizar'}
                  >
                    {chartCollapsed.attendanceChart ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronUp className="h-4 w-4" />
                    )}
                  </Button>
                </CardHeader>
                {!chartCollapsed.attendanceChart && (
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={attendanceData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="day" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            fontSize: '12px',
                          }}
                        />
                        <Bar dataKey="asistencia" fill="#2563eb" radius={[4, 4, 0, 0]} name="Asistencia" />
                        <Bar dataKey="faltas" fill="#ef4444" radius={[4, 4, 0, 0]} name="Faltas" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                )}
              </Card>
            )}

            {/* Level distribution */}
            {kpiConfig.levelChart && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">Distribución por nivel</CardTitle>
                    {chartCollapsed.levelChart && (
                      <span className="text-xs text-muted-foreground">(Minimizado)</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => toggleChartCollapsed('levelChart')}
                    title={chartCollapsed.levelChart ? 'Expandir' : 'Minimizar'}
                  >
                    {chartCollapsed.levelChart ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronUp className="h-4 w-4" />
                    )}
                  </Button>
                </CardHeader>
                {!chartCollapsed.levelChart && (
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={levelData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {levelData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${value} jugadores`, '']} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-2 space-y-1">
                      {levelData.map((entry) => (
                        <div key={entry.name} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-muted-foreground">{entry.name}</span>
                          </div>
                          <span className="font-medium">{entry.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            )}
          </div>
        )}

        {/* Financial chart row */}
        {canReadPayments && kpiConfig.financialChart && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">Resumen financiero</CardTitle>
                  {chartCollapsed.financialChart && (
                    <span className="text-xs text-muted-foreground">(Minimizado)</span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => toggleChartCollapsed('financialChart')}
                  title={chartCollapsed.financialChart ? 'Expandir' : 'Minimizar'}
                >
                  {chartCollapsed.financialChart ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </Button>
              </CardHeader>
              {!chartCollapsed.financialChart && (
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={financialData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" fontSize={12} />
                      <YAxis fontSize={12} tickFormatter={(v) => `${v}€`} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          fontSize: '12px',
                        }}
                        formatter={(value) => [`${Number(value).toLocaleString('es-ES')}€`, '']}
                      />
                      <Legend />
                      <Bar dataKey="cobrado" fill="#22c55e" radius={[4, 4, 0, 0]} name="Cobrado" />
                      <Bar dataKey="pendiente" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Pendiente" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              )}
            </Card>
          </div>
        )}

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Activity feed */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actividad reciente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {visibleActivities.slice(0, 8).map((activity) => {
                  const config = activityConfig[activity.type] || { icon: '📌', color: 'text-gray-600' }
                  return (
                    <div key={activity.id} className="flex items-start gap-3">
                      <span className="text-lg mt-0.5">{config.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{activity.description}</p>
                        <p className="text-xs text-muted-foreground">{timeAgo(activity.createdAt)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Today's schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Clases de hoy</CardTitle>
            </CardHeader>
            <CardContent>
              {todayGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No hay clases programadas para hoy
                </p>
              ) : (
                <div className="space-y-3">
                  {todayGroups
                    .sort((a, b) => {
                      const aTime = a.schedule.find((s) => s.dayOfWeek === today)?.startTime || ''
                      const bTime = b.schedule.find((s) => s.dayOfWeek === today)?.startTime || ''
                      return aTime.localeCompare(bTime)
                    })
                    .map((group) => {
                      const slot = group.schedule.find((s) => s.dayOfWeek === today)!
                      return (
                        <div key={group.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{group.name}</span>
                              <StatusBadge status={group.level} />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {group.courtName} · {group.coachName}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {slot.startTime} - {slot.endTime}
                            </p>
                            <p className="text-xs text-muted-foreground">
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

      {/* KPI Config Dialog */}
      <Dialog open={showKpiDialog} onOpenChange={setShowKpiDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar indicadores</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Selecciona qué indicadores quieres mostrar en el panel principal.</p>
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
              ].filter((item) => !item.financial || canReadPayments).map((item) => (
                <div key={item.key} className="flex items-center gap-3">
                  <Checkbox
                    checked={kpiConfig[item.key]}
                    onCheckedChange={(checked) =>
                      setKpiConfig((prev) => ({ ...prev, [item.key]: checked }))
                    }
                  />
                  <Label className="cursor-pointer">{item.label}</Label>
                </div>
              ))}

              <div className="border-t pt-3 mt-3">
                <p className="text-sm font-medium mb-3">Graficos</p>
                {[
                  { key: 'attendanceChart', label: 'Grafico de asistencia semanal', financial: false },
                  { key: 'levelChart', label: 'Grafico de distribucion por nivel', financial: false },
                  { key: 'financialChart', label: 'Grafico resumen financiero', financial: true },
                ].filter((item) => !item.financial || canReadPayments).map((item) => (
                  <div key={item.key} className="flex items-center gap-3 mb-3">
                    <Checkbox
                      checked={kpiConfig[item.key]}
                      onCheckedChange={(checked) =>
                        setKpiConfig((prev) => ({ ...prev, [item.key]: checked }))
                      }
                    />
                    <Label className="cursor-pointer">{item.label}</Label>
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
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
