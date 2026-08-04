import { useMemo, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { useDataStore } from '@/stores/dataStore'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/hooks/use-toast'
import { functions } from '@/lib/firebase'
import { formatCurrency } from '@/lib/utils'
import { aggregateSnapshots, type AggregatedMetrics } from '@/lib/metric-aggregation'
import { MetricTrendChart, type TrendPoint } from './MetricTrendChart'
import type { MetricSnapshot } from '@/types'

type ComparisonPeriod = 'month' | 'quarter'

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

interface MetricRow {
  key: string
  label: string
  format: (m: AggregatedMetrics) => string
  rawValue: (m: AggregatedMetrics) => number | null
  higherIsBetter: boolean | null // null = no aplica comparacion de color (ej. texto libre)
}

const METRIC_ROWS: MetricRow[] = [
  {
    key: 'revenue',
    label: 'Ingresos del grupo top',
    format: m => m.mostProfitableGroup ? `${formatCurrency(m.mostProfitableGroup.revenue)} (${m.mostProfitableGroup.groupName})` : 'Sin datos',
    rawValue: m => m.mostProfitableGroup?.revenue ?? null,
    higherIsBetter: true,
  },
  {
    key: 'newPlayers',
    label: 'Alumnos nuevos',
    format: m => `${m.newPlayersCount}`,
    rawValue: m => m.newPlayersCount,
    higherIsBetter: true,
  },
  {
    key: 'churn',
    label: 'Bajas del grupo con más abandonos',
    format: m => m.mostChurnGroup ? `${m.mostChurnGroup.count} (${m.mostChurnGroup.groupName})` : 'Sin bajas',
    rawValue: m => m.mostChurnGroup?.count ?? null,
    higherIsBetter: false,
  },
  {
    key: 'collectionRate',
    label: 'Tasa de cobro',
    format: m => m.collectionRatePct !== null ? `${m.collectionRatePct}%` : 'Sin datos',
    rawValue: m => m.collectionRatePct,
    higherIsBetter: true,
  },
  {
    key: 'bestDay',
    label: 'Día con más asistencia',
    format: m => m.bestDayOfWeek !== null ? DAY_NAMES[m.bestDayOfWeek] : 'Sin datos',
    rawValue: m => m.bestDayCount,
    higherIsBetter: null,
  },
  {
    key: 'underutilized',
    label: 'Franjas infrautilizadas (media)',
    format: m => `${m.underutilizedSlotsCount}`,
    rawValue: m => m.underutilizedSlotsCount,
    higherIsBetter: false,
  },
  {
    key: 'atRisk',
    label: 'Alumnos en riesgo (media)',
    format: m => `${m.atRiskPlayersCount}`,
    rawValue: m => m.atRiskPlayersCount,
    higherIsBetter: false,
  },
  {
    key: 'quality',
    label: 'Calidad media cuestionarios',
    format: m => m.avgReviewQuality !== null ? `${m.avgReviewQuality}/5` : 'Sin datos',
    rawValue: m => m.avgReviewQuality,
    higherIsBetter: true,
  },
]

function monthsBack(count: number, from: Date = new Date()): { year: number; month: number }[] {
  const result: { year: number; month: number }[] = []
  const cursor = new Date(from.getFullYear(), from.getMonth() - 1, 1) // el mes actual aun no ha cerrado
  for (let i = 0; i < count; i++) {
    result.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 })
    cursor.setMonth(cursor.getMonth() - 1)
  }
  return result.reverse()
}

function findSnapshot(snapshots: MetricSnapshot[], year: number, month: number): MetricSnapshot | undefined {
  return snapshots.find(s => s.year === year && s.month === month)
}

export function HistoryTab() {
  const { metricSnapshots } = useDataStore()
  const { user } = useAuthStore()
  const [comparisonPeriod, setComparisonPeriod] = useState<ComparisonPeriod>('month')
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const monthsNeeded = comparisonPeriod === 'month' ? 2 : 6 // mes vs mes: 2 meses; trimestre vs trimestre: 6 meses
  const recentMonths = useMemo(() => monthsBack(monthsNeeded), [monthsNeeded])

  const currentSnapshots = useMemo(() => {
    const months = comparisonPeriod === 'month' ? recentMonths.slice(-1) : recentMonths.slice(-3)
    return months.map(({ year, month }) => findSnapshot(metricSnapshots, year, month)).filter((s): s is MetricSnapshot => !!s)
  }, [metricSnapshots, recentMonths, comparisonPeriod])

  const previousSnapshots = useMemo(() => {
    const months = comparisonPeriod === 'month' ? recentMonths.slice(0, 1) : recentMonths.slice(0, 3)
    return months.map(({ year, month }) => findSnapshot(metricSnapshots, year, month)).filter((s): s is MetricSnapshot => !!s)
  }, [metricSnapshots, recentMonths, comparisonPeriod])

  const hasEnoughHistory = currentSnapshots.length > 0 && previousSnapshots.length > 0

  const current = useMemo(() => aggregateSnapshots(currentSnapshots), [currentSnapshots])
  const previous = useMemo(() => aggregateSnapshots(previousSnapshots), [previousSnapshots])

  const trendPoints = useMemo((): TrendPoint[] => {
    if (!selectedMetric) return []
    const row = METRIC_ROWS.find(r => r.key === selectedMetric)
    if (!row) return []
    const allMonths = monthsBack(12)
    return allMonths
      .map(({ year, month }) => {
        const snap = findSnapshot(metricSnapshots, year, month)
        if (!snap) return null
        const agg = aggregateSnapshots([snap])
        const value = row.rawValue(agg)
        if (value === null) return null
        return { label: `${MONTH_SHORT[month]} ${year}`, value }
      })
      .filter((p): p is TrendPoint => p !== null)
  }, [selectedMetric, metricSnapshots])

  const handleGenerate = async () => {
    if (!user?.clubId) return
    setGenerating(true)
    try {
      const fn = httpsCallable(functions, 'generateMetricSnapshotCallable')
      const now = new Date()
      await fn({ clubId: user.clubId, year: now.getFullYear(), month: now.getMonth() + 1 })
      toast.success('Snapshot generado')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido'
      toast.error(`Error al generar el snapshot: ${message}`)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          Comparación con el periodo inmediatamente anterior.
        </p>
        <div className="flex items-center gap-2">
          <Select
            className="w-36 h-8 text-xs"
            value={comparisonPeriod}
            onChange={e => setComparisonPeriod(e.target.value as ComparisonPeriod)}
            options={[
              { value: 'month', label: 'Mes vs mes' },
              { value: 'quarter', label: 'Trimestre vs trimestre' },
            ]}
          />
          <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating}>
            {generating ? 'Generando...' : 'Generar snapshot de este mes'}
          </Button>
        </div>
      </div>

      {!hasEnoughHistory ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Aún no hay suficiente histórico para comparar. Vuelve cuando se hayan cerrado al menos {comparisonPeriod === 'month' ? '2 meses' : '2 trimestres'}.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2">Métrica</th>
                  <th className="py-2">Periodo actual</th>
                  <th className="py-2">Periodo anterior</th>
                  <th className="py-2">Cambio</th>
                </tr>
              </thead>
              <tbody>
                {METRIC_ROWS.map(row => {
                  const currentVal = row.rawValue(current)
                  const previousVal = row.rawValue(previous)
                  const delta = currentVal !== null && previousVal !== null ? currentVal - previousVal : null
                  const isGood = delta !== null && row.higherIsBetter !== null
                    ? (row.higherIsBetter ? delta > 0 : delta < 0)
                    : null
                  return (
                    <tr
                      key={row.key}
                      className="border-b last:border-0 cursor-pointer hover:bg-accent/40"
                      onClick={() => setSelectedMetric(row.key)}
                    >
                      <td className="py-2 font-medium">{row.label}</td>
                      <td className="py-2">{row.format(current)}</td>
                      <td className="py-2 text-muted-foreground">{row.format(previous)}</td>
                      <td className="py-2">
                        {delta === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className={isGood === null ? 'text-muted-foreground' : isGood ? 'text-emerald-600' : 'text-red-600'}>
                            {delta > 0 ? '▲' : delta < 0 ? '▼' : '='} {Math.abs(delta)}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {selectedMetric && (
        <Card>
          <CardContent className="p-5">
            <MetricTrendChart
              title={METRIC_ROWS.find(r => r.key === selectedMetric)?.label ?? ''}
              points={trendPoints}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

const MONTH_SHORT: Record<number, string> = {
  1: 'Ene', 2: 'Feb', 3: 'Mar', 4: 'Abr', 5: 'May', 6: 'Jun',
  7: 'Jul', 8: 'Ago', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dic',
}
