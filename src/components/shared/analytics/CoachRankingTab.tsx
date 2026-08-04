import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { useDataStore } from '@/stores/dataStore'
import { formatCurrency, cn } from '@/lib/utils'
import { findSlotForAttendanceDate } from '@/lib/attendance-schedule'

type Metric = 'rph' | 'retention' | 'hours'
type Period = 'month' | 'quarter' | 'year'

interface CoachStats {
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

export function CoachRankingTab() {
  const navigate = useNavigate()
  const { coaches, groups, payments, enrollments, attendance } = useDataStore()
  const [metric, setMetric] = useState<Metric>('rph')
  const [period, setPeriod] = useState<Period>('month')

  const now = new Date()

  const periodStart = useMemo(() => {
    const d = new Date(now)
    if (period === 'month') return new Date(d.getFullYear(), d.getMonth(), 1)
    if (period === 'quarter') return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1)
    return new Date(d.getFullYear(), 0, 1)
  }, [period])

  const coachGroupIds = useMemo(() => {
    const map: Record<string, string[]> = {}
    groups.forEach(g => {
      if (!map[g.coachId]) map[g.coachId] = []
      map[g.coachId].push(g.id)
    })
    return map
  }, [groups])

  const stats = useMemo((): CoachStats[] => {
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

        // Hours from attendance records (actual classes held)
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

        // Fallback: estimate from schedule if no attendance records
        const hoursFromSchedule = groups
          .filter(g => g.coachId === coach.id && g.isActive)
          .reduce((sum, g) => {
            const weeksInPeriod = period === 'month' ? 4 : period === 'quarter' ? 13 : 52
            return sum + g.schedule.reduce((s, slot) => s + slotMinutes(slot.startTime, slot.endTime) / 60, 0) * weeksInPeriod
          }, 0)

        const hours = hoursFromAttendance > 0 ? hoursFromAttendance : hoursFromSchedule
        const rph = hours > 0 ? revenue / hours : 0

        // ── Retention 3 months ────────────────────────────────────────
        const threeMonthsAgo = new Date(now)
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
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
      .sort((a, b) => {
        if (metric === 'rph') return b.rph - a.rph
        if (metric === 'retention') return (b.retentionPct ?? 0) - (a.retentionPct ?? 0)
        return b.hours - a.hours
      })
  }, [coaches, coachGroupIds, payments, attendance, enrollments, groups, periodStart, metric, period])

  const maxValue = useMemo(() => {
    if (stats.length === 0) return 1
    if (metric === 'rph') return Math.max(...stats.map(s => s.rph), 1)
    if (metric === 'retention') return 100
    return Math.max(...stats.map(s => s.hours), 1)
  }, [stats, metric])

  const getMetricValue = (s: CoachStats) => {
    if (metric === 'rph') return s.rph
    if (metric === 'retention') return s.retentionPct ?? 0
    return s.hours
  }

  const formatMetricValue = (s: CoachStats) => {
    if (metric === 'rph') return `${formatCurrency(s.rph)}/h`
    if (metric === 'retention') return s.retentionPct !== null ? `${s.retentionPct}%` : 'Sin datos'
    return `${s.hours}h`
  }

  const metricLabel: Record<Metric, string> = {
    rph: '€/hora generado',
    retention: '% retención 3 meses',
    hours: 'Horas trabajadas',
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <Select
          className="w-48 h-8 text-xs"
          value={metric}
          onChange={e => setMetric(e.target.value as Metric)}
          options={[
            { value: 'rph', label: '€/hora generado' },
            { value: 'retention', label: '% retención 3 meses' },
            { value: 'hours', label: 'Horas trabajadas' },
          ]}
        />
        <Select
          className="w-36 h-8 text-xs"
          value={period}
          onChange={e => setPeriod(e.target.value as Period)}
          options={[
            { value: 'month', label: 'Este mes' },
            { value: 'quarter', label: 'Trimestre' },
            { value: 'year', label: 'Este año' },
          ]}
        />
      </div>

      {stats.length === 0 ? (
        <div className="text-center py-12">
          <Trophy className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-medium text-foreground">Sin datos suficientes</p>
          <p className="text-sm text-muted-foreground mt-1">
            Añade pagos y asistencia para ver el ranking
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {stats.map((s, i) => {
            const value = getMetricValue(s)
            const pct = maxValue > 0 ? (value / maxValue) * 100 : 0
            const isTop = i === 0
            return (
              <Card
                key={s.coachId}
                className={cn(
                  'border-border/60 cursor-pointer hover:shadow-md transition-shadow',
                  isTop && 'border-purple-100 bg-purple-50/30'
                )}
                onClick={() => navigate(`/entrenadores/${s.coachId}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      {isTop && <Trophy className="h-4 w-4 text-purple-500 shrink-0" />}
                      <span className="font-semibold text-foreground">{s.coachName}</span>
                      {isTop && (
                        <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
                          Top
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{formatMetricValue(s)}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', isTop ? 'bg-purple-400' : 'bg-slate-300')}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    {metric !== 'rph' && <span>{formatCurrency(s.rph)}/h</span>}
                    {metric !== 'retention' && s.retentionPct !== null && <span>{s.retentionPct}% retención</span>}
                    {metric !== 'hours' && <span>{s.hours}h trabajadas</span>}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
