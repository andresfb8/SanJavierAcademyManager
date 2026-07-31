/**
 * src/components/player/PlayerDashboardCards.tsx
 *
 * Desktop card components for the PlayerDashboard 3-column grid layout.
 * Each component is self-contained and receives only the data it needs.
 */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  CalendarDays,
  MapPin,
  User,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Ticket,
  Zap,
  Clock,
  ChevronRight,
  Trophy,
  Award,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn, formatDate, ensureDate } from '@/lib/utils'
import { useDataStore } from '@/stores/dataStore'
import { useAuthStore } from '@/stores/authStore'
import type { NextClassInfo } from '@/hooks/usePlayerData'
import type { Group, AcademyEvent, Evaluation } from '@/types'

// ─── Helper ────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

// ─── ProximaClaseCard ───────────────────────────────────────────────────────

interface ProximaClaseCardProps {
  nextClass: NextClassInfo | null
}

export function ProximaClaseCard({ nextClass }: ProximaClaseCardProps) {
  const navigate = useNavigate()

  if (!nextClass) {
    return (
      <Card className="border border-slate-100 shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-10 text-center gap-2">
          <CalendarDays className="h-8 w-8 text-slate-200" />
          <p className="text-sm font-bold text-slate-400">Sin clases próximas</p>
          <p className="text-xs text-slate-300">Tu agenda está despejada</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className="border-none shadow-lg cursor-pointer overflow-hidden group"
      onClick={() => navigate(`/grupos/${nextClass.group.id}`)}
    >
      <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-5 text-white relative overflow-hidden">
        <div className="absolute -top-4 -right-4 opacity-10">
          <CalendarDays className="h-24 w-24" />
        </div>
        <Badge className="bg-white/20 text-white border-none text-[10px] font-black uppercase tracking-widest mb-3">
          Próxima Clase
        </Badge>
        <h3 className="text-xl font-black leading-tight mb-1">{nextClass.group.name}</h3>
        <div className="flex items-center gap-3 text-emerald-100 text-xs mt-2">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatDate(ensureDate(nextClass.classDate))} · {nextClass.slot.startTime}
          </span>
        </div>
        <div className="flex items-center gap-3 text-emerald-100 text-xs mt-1">
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {nextClass.group.courtName}
          </span>
          <span className="flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            {nextClass.group.coachName}
          </span>
        </div>
      </div>
      <CardContent className="p-4 flex items-center justify-between">
        <span className="text-xs font-semibold text-emerald-600">Ver detalle del grupo</span>
        <ChevronRight className="h-4 w-4 text-emerald-400 group-hover:translate-x-1 transition-transform" />
      </CardContent>
    </Card>
  )
}

// ─── MisGruposCard ──────────────────────────────────────────────────────────

interface MisGruposCardProps {
  groups: Group[]
}

export function MisGruposCard({ groups }: MisGruposCardProps) {
  const navigate = useNavigate()

  if (groups.length === 0) return null

  return (
    <Card className="border border-slate-100 shadow-sm">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-bold text-slate-600 flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          Mis Grupos
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {groups.map((group) => (
          <div
            key={group.id}
            onClick={() => navigate(`/grupos/${group.id}`)}
            className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-emerald-50 cursor-pointer transition-colors group"
          >
            <div>
              <p className="text-sm font-semibold text-slate-800">{group.name}</p>
              <p className="text-[11px] text-slate-400 font-medium">
                {group.schedule.map((s) => DAY_NAMES[s.dayOfWeek]).join(', ')} · {group.schedule[0]?.startTime}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ─── EstadoPagosCard ────────────────────────────────────────────────────────

interface EstadoPagosCardProps {
  pendingCount: number
  overdueCount: number
  studentId: string
  onClick?: () => void
}

export function EstadoPagosCard({ pendingCount, overdueCount, studentId, onClick }: EstadoPagosCardProps) {
  const navigate = useNavigate()

  const status = overdueCount > 0 ? 'vencido' : pendingCount > 0 ? 'pendiente' : 'al_dia'

  const config = {
    vencido: {
      icon: XCircle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200',
      label: `${overdueCount} pago${overdueCount > 1 ? 's' : ''} vencido${overdueCount > 1 ? 's' : ''}`,
      sub: 'Requiere atención inmediata',
    },
    pendiente: {
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      label: `${pendingCount} pago${pendingCount > 1 ? 's' : ''} pendiente${pendingCount > 1 ? 's' : ''}`,
      sub: 'Dentro del plazo',
    },
    al_dia: {
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      label: 'Pagos al día',
      sub: 'Sin deudas pendientes',
    },
  }[status]

  const Icon = config.icon

  return (
    <Card
      className={cn('border cursor-pointer transition-all hover:shadow-md', config.border)}
      onClick={onClick}
    >
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', config.bg)}>
          <Icon className={cn('h-5 w-5', config.color)} />
        </div>
        <div className="flex-1">
          <p className={cn('text-sm font-bold', config.color)}>{config.label}</p>
          <p className="text-xs text-slate-400">{config.sub}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-slate-300" />
      </CardContent>
    </Card>
  )
}

// ─── UltimasEvaluacionesCard ────────────────────────────────────────────────

interface UltimasEvaluacionesCardProps {
  evaluations: Evaluation[]
  studentId: string
  onClick?: () => void
}

export function UltimasEvaluacionesCard({ evaluations, studentId, onClick }: UltimasEvaluacionesCardProps) {
  const navigate = useNavigate()

  const recent = useMemo(
    () =>
      [...evaluations]
        .filter((e) => e.playerId === studentId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 3),
    [evaluations, studentId]
  )

  return (
    <Card className="border border-slate-100 shadow-sm">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-bold text-slate-600 flex items-center gap-2">
          <Award className="h-4 w-4" />
          Últimas Evaluaciones
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {recent.length === 0 ? (
          <div className="text-center py-6">
            <Award className="h-8 w-8 text-slate-200 mx-auto mb-2" />
            <p className="text-xs text-slate-400 font-medium">Sin evaluaciones aún</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((ev) => (
              <div
                key={ev.id}
                onClick={onClick}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-indigo-50 cursor-pointer transition-colors group"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {formatDate(ensureDate(ev.date))}
                  </p>
                  <p className="text-[11px] text-slate-400">{ev.coachName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'text-lg font-black',
                      ev.overallAverage >= 8
                        ? 'text-emerald-600'
                        : ev.overallAverage >= 6
                        ? 'text-amber-600'
                        : 'text-red-500'
                    )}
                  >
                    {ev.overallAverage.toFixed(1)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── AsistenciaMensualChart ─────────────────────────────────────────────────

interface AsistenciaMensualChartProps {
  studentId: string
  groupIds: string[]
  onClick?: () => void
}

export function AsistenciaMensualChart({ studentId, groupIds, onClick }: AsistenciaMensualChartProps) {
  const { attendance } = useDataStore()

  const data = useMemo(() => {
    const now = new Date()
    const myGroupIds = new Set(groupIds)

    return [-2, -1, 0].map((offset) => {
      const target = new Date(now.getFullYear(), now.getMonth() + offset, 1)
      const monthLabel = target.toLocaleDateString('es-ES', { month: 'short' })
      const monthStart = new Date(target.getFullYear(), target.getMonth(), 1)
      const monthEnd = new Date(target.getFullYear(), target.getMonth() + 1, 0, 23, 59, 59)

      const records = attendance.filter((a) => {
        const d = a.date instanceof Date ? a.date : new Date(a.date)
        return myGroupIds.has(a.groupId) && d >= monthStart && d <= monthEnd
      })

      let present = 0
      let total = 0
      for (const record of records) {
        const entry = record.records.find((r) => r.playerId === studentId)
        if (entry) {
          total++
          if (entry.status === 'presente') present++
        }
      }

      return {
        mes: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        pct: total > 0 ? Math.round((present / total) * 100) : 0,
        present,
        total,
      }
    })
  }, [attendance, studentId, groupIds])

  return (
    <Card
      className={cn(
        'border border-slate-100 shadow-sm transition-all',
        onClick && 'cursor-pointer hover:shadow-md'
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-bold text-slate-600 flex items-center gap-2">
          <Trophy className="h-4 w-4" />
          Asistencia Mensual
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {data.every((d) => d.total === 0) ? (
          <div className="text-center py-6">
            <p className="text-xs text-slate-400 font-medium">Sin datos de asistencia</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={data} barSize={32}>
              <XAxis dataKey="mes" tick={{ fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                formatter={(value) => {
                if (value === undefined) return ['0%', 'Asistencia']
                return [`${value}%`, 'Asistencia']
              }}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="pct" radius={[6, 6, 0, 0]}>
                {data.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={entry.pct >= 80 ? '#10b981' : entry.pct >= 60 ? '#f59e0b' : '#ef4444'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

// ─── ProximosEventosCard ────────────────────────────────────────────────────

interface ProximosEventosCardProps {
  events: AcademyEvent[]
  studentId: string
}

export function ProximosEventosCard({ events, studentId: _studentId }: ProximosEventosCardProps) {
  const navigate = useNavigate()

  const upcoming = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return [...events]
      .filter((e) => {
        const d = e.date instanceof Date ? e.date : new Date(e.date)
        return e.isActive && d >= today
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 3)
  }, [events])

  return (
    <Card className="border border-slate-100 shadow-sm">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-bold text-slate-600 flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Próximos Eventos
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {upcoming.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-xs text-slate-400 font-medium">Sin eventos próximos</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((ev) => (
              <div
                key={ev.id}
                onClick={() => navigate(`/eventos/${ev.id}`)}
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-blue-50 cursor-pointer transition-colors group"
              >
                <div className="h-10 w-10 rounded-xl bg-blue-100 flex flex-col items-center justify-center shrink-0">
                  <span className="text-[11px] font-black text-blue-700 leading-none">
                    {(ev.date instanceof Date ? ev.date : new Date(ev.date)).getDate()}
                  </span>
                  <span className="text-[9px] font-bold text-blue-500 uppercase">
                    {(ev.date instanceof Date ? ev.date : new Date(ev.date)).toLocaleDateString('es-ES', { month: 'short' })}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{ev.name}</p>
                  <p className="text-[11px] text-slate-400">{ev.startTime} · {ev.type}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── VouchersCard ────────────────────────────────────────────────────────────

interface VouchersCardProps {
  studentId: string
  onClick?: () => void
}

export function VouchersDesktopCard({ studentId, onClick }: VouchersCardProps) {
  const { vouchers } = useDataStore()

  const myVouchers = useMemo(
    () => vouchers.filter((v) => v.playerId === studentId && v.status === 'active'),
    [vouchers, studentId]
  )

  if (myVouchers.length === 0) return null

  return (
    <Card className="border border-slate-100 shadow-sm">
      <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-bold text-slate-600 flex items-center gap-2">
          <Ticket className="h-4 w-4" />
          Mis Bonos Activos
        </CardTitle>
        {onClick && (
          <button onClick={onClick} className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-tight">
            Ver Todos
          </button>
        )}
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {myVouchers.map((v) => {
          const remaining = v.totalClasses - v.usedClasses
          const pct = Math.round((remaining / v.totalClasses) * 100)
          return (
            <div key={v.id} className="p-3 rounded-xl bg-slate-50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-slate-700 capitalize">
                  Bono {v.type.replace('_', ' ')}
                </span>
                <span className="text-sm font-black text-emerald-600">{remaining} clases</span>
              </div>
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    pct > 50 ? 'bg-emerald-500' : pct > 20 ? 'bg-amber-500' : 'bg-red-500'
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {v.usedClasses} de {v.totalClasses} usadas
              </p>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
