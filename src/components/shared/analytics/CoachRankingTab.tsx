import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { useDataStore } from '@/stores/dataStore'
import { formatCurrency, cn } from '@/lib/utils'
import { computeCoachStats, type CoachStats } from '@/lib/coach-stats'
import { getPeriodStart, type AnalyticsPeriod } from '@/lib/period'

type Metric = 'rph' | 'retention' | 'hours'
type Period = AnalyticsPeriod

export function CoachRankingTab() {
  const navigate = useNavigate()
  const { coaches, groups, payments, enrollments, attendance } = useDataStore()
  const [metric, setMetric] = useState<Metric>('rph')
  const [period, setPeriod] = useState<Period>('month')

  const now = new Date()

  const periodStart = useMemo(() => getPeriodStart(period, now), [period])

  const weeksInPeriod = period === 'month' ? 4 : period === 'quarter' ? 13 : 52

  const stats = useMemo((): CoachStats[] => {
    const raw = computeCoachStats(coaches, groups, payments, enrollments, attendance, periodStart, weeksInPeriod)
    return [...raw].sort((a, b) => {
      if (metric === 'rph') return b.rph - a.rph
      if (metric === 'retention') return (b.retentionPct ?? 0) - (a.retentionPct ?? 0)
      return b.hours - a.hours
    })
  }, [coaches, groups, payments, attendance, enrollments, periodStart, weeksInPeriod, metric])

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
