import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/shared/StatCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDataStore } from '@/stores/dataStore'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  Users,
  DollarSign,
  AlertCircle,
  GraduationCap,
  Clock,
  TrendingUp,
  CalendarDays,
  Activity,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const { players, payments, groups, activities, enrollments } = useDataStore()

  // KPIs
  const activePlayers = players.filter((p) => p.status === 'activo').length
  const activeGroups = groups.filter((g) => g.isActive).length

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear

  const currentMonthPayments = payments.filter(
    (p) => p.billingMonth === currentMonth && p.billingYear === currentYear
  )
  const prevMonthPayments = payments.filter(
    (p) => p.billingMonth === prevMonth && p.billingYear === prevYear
  )

  const currentRevenue = currentMonthPayments
    .filter((p) => p.status === 'pagado')
    .reduce((sum, p) => sum + p.amount, 0)
  const prevRevenue = prevMonthPayments
    .filter((p) => p.status === 'pagado')
    .reduce((sum, p) => sum + p.amount, 0)
  const revenueDiff = prevRevenue > 0 ? Math.round(((currentRevenue - prevRevenue) / prevRevenue) * 100) : 0

  const currentPending = currentMonthPayments
    .filter((p) => p.status === 'pendiente')
    .reduce((sum, p) => sum + p.amount, 0)
  const prevPending = prevMonthPayments
    .filter((p) => p.status === 'pendiente')
    .reduce((sum, p) => sum + p.amount, 0)
  const pendingDiff = prevPending > 0 ? Math.round(((currentPending - prevPending) / prevPending) * 100) : 0

  // Collection rate
  const totalCurrentMonth = currentMonthPayments
    .filter((p) => p.status !== 'cancelado')
    .reduce((sum, p) => sum + p.amount, 0)
  const collectionRate = totalCurrentMonth > 0 ? Math.round((currentRevenue / totalCurrentMonth) * 100) : 0

  // Attendance chart data (simulated weekly)
  const attendanceData = [
    { day: 'Lun', asistencia: 14, faltas: 2 },
    { day: 'Mar', asistencia: 12, faltas: 3 },
    { day: 'Mié', asistencia: 15, faltas: 1 },
    { day: 'Jue', asistencia: 11, faltas: 4 },
    { day: 'Vie', asistencia: 8, faltas: 2 },
    { day: 'Sáb', asistencia: 6, faltas: 0 },
  ]

  // Level distribution
  const levelData = [
    { name: 'Iniciación', value: players.filter((p) => p.level === 'iniciacion' && p.status === 'activo').length, color: '#22c55e' },
    { name: 'Intermedio', value: players.filter((p) => p.level === 'intermedio' && p.status === 'activo').length, color: '#3b82f6' },
    { name: 'Avanzado', value: players.filter((p) => p.level === 'avanzado' && p.status === 'activo').length, color: '#8b5cf6' },
    { name: 'Competición', value: players.filter((p) => p.level === 'competicion' && p.status === 'activo').length, color: '#ef4444' },
    { name: 'Menores', value: players.filter((p) => p.level === 'menores' && p.status === 'activo').length, color: '#f59e0b' },
  ].filter((d) => d.value > 0)

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
      />
      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Jugadores activos"
            value={activePlayers}
            icon={Users}
            iconClassName="bg-blue-50 text-blue-600"
          />
          <StatCard
            title="Ingresos este mes"
            value={formatCurrency(currentRevenue)}
            icon={DollarSign}
            trend={{ value: revenueDiff, label: 'vs mes anterior' }}
            iconClassName="bg-green-50 text-green-600"
          />
          <StatCard
            title="Pagos pendientes"
            value={formatCurrency(currentPending)}
            icon={AlertCircle}
            trend={{ value: pendingDiff, label: 'vs mes anterior' }}
            iconClassName="bg-yellow-50 text-yellow-600"
          />
          <StatCard
            title="Grupos activos"
            value={activeGroups}
            icon={GraduationCap}
            iconClassName="bg-purple-50 text-purple-600"
          />
        </div>

        {/* Second row: Collection rate + Today's classes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Ratio de cobro"
            value={`${collectionRate}%`}
            icon={TrendingUp}
            iconClassName="bg-emerald-50 text-emerald-600"
          />
          <StatCard
            title="Clases hoy"
            value={todayGroups.length}
            icon={CalendarDays}
            iconClassName="bg-indigo-50 text-indigo-600"
          />
          <StatCard
            title="Total alumnos inscritos"
            value={enrollments.filter((e) => e.isActive).length}
            icon={Activity}
            iconClassName="bg-pink-50 text-pink-600"
          />
          <StatCard
            title="Lista de espera"
            value={players.filter((p) => p.status === 'lista_espera').length}
            icon={Clock}
            iconClassName="bg-orange-50 text-orange-600"
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Attendance chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Asistencia semanal</CardTitle>
            </CardHeader>
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
          </Card>

          {/* Level distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribución por nivel</CardTitle>
            </CardHeader>
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
          </Card>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Activity feed */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actividad reciente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activities.slice(0, 8).map((activity) => {
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
    </div>
  )
}
