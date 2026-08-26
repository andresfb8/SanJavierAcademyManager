import { useMemo, useState } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { useDataStore } from '@/stores/dataStore'
import { formatCurrency } from '@/lib/utils'
import {
  getCurrentPeriodMonthKeys,
  getPreviousPeriodMonthKeys,
  getLastNMonthKeys,
  formatMonthKeyLabel,
  type AnalyticsPeriod,
} from '@/lib/period'
import { normalizeAllPayments } from '@/lib/payment-utils'
import {
  revenueByOrigin,
  revenueByAgeGroup,
  revenueByLevel,
  contributionMarginByCategory,
  costStructure,
  breakEvenPoint,
  collectionStats,
  pctChange,
} from '@/lib/finance-analytics'
import { PLAYER_LEVELS } from '@/constants'
import type { PlayerLevel } from '@/types'

// Paleta categorica de la skill dataviz (orden fijo, no ciclico): slot 1 azul, slot 2 naranja.
// Usada para Fijos/Variables tanto en el donut como en la linea de evolucion, para que el
// color siga a la entidad en ambos graficos.
const CHART_COLORS = {
  seriesFixed: '#2a78d6', // slot 1 - azul
  seriesVariable: '#eb6834', // slot 2 - naranja
  seriesCollection: '#2a78d6', // slot 1 - azul (serie unica)
  grid: '#e1e0d9',
  statusGood: '#0ca30c',
  statusCritical: '#d03b3b',
  muted: '#898781',
}

const LEVEL_LABELS: Record<PlayerLevel, string> = Object.fromEntries(
  PLAYER_LEVELS.map(l => [l.value, l.label])
) as Record<PlayerLevel, string>

function VariationBadge({ current, previous }: { current: number; previous: number }) {
  const change = pctChange(current, previous)

  if (change === null) {
    return <span className="text-xs text-muted-foreground">Sin dato previo</span>
  }

  const rounded = Math.round(change)

  if (rounded === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: CHART_COLORS.muted }}>
        <Minus className="h-3 w-3" />
        Sin cambios
      </span>
    )
  }

  const isUp = rounded > 0
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold"
      style={{ color: isUp ? CHART_COLORS.statusGood : CHART_COLORS.statusCritical }}
    >
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isUp ? '+' : ''}
      {rounded}%
    </span>
  )
}

export function FinanceTab() {
  const {
    payments,
    eventPayments,
    privateLessonPayments,
    events,
    groups,
    players,
    privateLessons,
    coachSalaryConfigs,
    clubTransactions,
    enrollments,
  } = useDataStore()

  const [period, setPeriod] = useState<AnalyticsPeriod>('month')
  const now = new Date()

  const currentKeys = useMemo(() => new Set(getCurrentPeriodMonthKeys(period, now)), [period])
  const previousKeys = useMemo(() => new Set(getPreviousPeriodMonthKeys(period, now)), [period])
  const last6MonthKeys = useMemo(() => getLastNMonthKeys(6, now), [])

  const allPayments = useMemo(
    () => normalizeAllPayments(payments, eventPayments, privateLessonPayments ?? [], events),
    [payments, eventPayments, privateLessonPayments, events]
  )

  // ── Seccion 1: Ingresos por origen ──────────────────────────────────
  const originCurrent = useMemo(() => revenueByOrigin(allPayments, currentKeys), [allPayments, currentKeys])
  const originPrevious = useMemo(() => revenueByOrigin(allPayments, previousKeys), [allPayments, previousKeys])
  // "Otros" (p. ej. recargos de devolucion SEPA) es infrecuente: solo se muestra la fila
  // cuando hay importe en el periodo actual o el anterior, para no ensuciar el caso comun.
  const hasOtrosOrigin = originCurrent.otros > 0 || originPrevious.otros > 0

  // ── Seccion 2: Adultos vs Menores ────────────────────────────────────
  const ageCurrent = useMemo(
    () => revenueByAgeGroup(allPayments, groups, players, currentKeys),
    [allPayments, groups, players, currentKeys]
  )
  const agePrevious = useMemo(
    () => revenueByAgeGroup(allPayments, groups, players, previousKeys),
    [allPayments, groups, players, previousKeys]
  )
  const ageTotal = ageCurrent.adultos + ageCurrent.menores

  // ── Seccion 3: Por grupo/nivel ───────────────────────────────────────
  const byLevel = useMemo(() => revenueByLevel(allPayments, groups, currentKeys), [allPayments, groups, currentKeys])
  const byLevelRows = useMemo(() => {
    const entries = Object.entries(byLevel) as [PlayerLevel | 'sinGrupo', number][]
    return entries.sort((a, b) => b[1] - a[1])
  }, [byLevel])

  // ── Seccion 4: Margen por categoria ──────────────────────────────────
  const margin = useMemo(
    () =>
      contributionMarginByCategory({
        payments: allPayments,
        groups,
        coachSalaryConfigs,
        events,
        eventPayments,
        privateLessons,
        privateLessonPayments: privateLessonPayments ?? [],
        monthKeys: currentKeys,
      }),
    [allPayments, groups, coachSalaryConfigs, events, eventPayments, privateLessons, privateLessonPayments, currentKeys]
  )

  const marginRows = useMemo(() => {
    const rows = [
      { label: 'Cuotas', ...margin.cuotas },
      { label: 'Eventos', ...margin.eventos },
      { label: 'Clases particulares', ...margin.clases },
    ]
    return rows.sort((a, b) => b.margin - a.margin)
  }, [margin])

  // ── Seccion 5: Estructura de costes ──────────────────────────────────
  const currentCostStructure = useMemo(() => costStructure(clubTransactions, currentKeys), [clubTransactions, currentKeys])
  const costTrend = useMemo(
    () =>
      last6MonthKeys.map(key => {
        const stats = costStructure(clubTransactions, new Set([key]))
        return {
          name: formatMonthKeyLabel(key),
          'Fijos %': Math.round(stats.fixedPct),
          'Variables %': Math.round(stats.variablePct),
        }
      }),
    [clubTransactions, last6MonthKeys]
  )

  const costDonutData = useMemo(
    () => [
      { name: 'Fijos', value: currentCostStructure.fixed, color: CHART_COLORS.seriesFixed },
      { name: 'Variables', value: currentCostStructure.variable, color: CHART_COLORS.seriesVariable },
    ],
    [currentCostStructure]
  )

  // ── Seccion 6: Punto de equilibrio ───────────────────────────────────
  const activeEnrollmentCount = useMemo(
    () => enrollments.filter(e => e.isActive && !e.isWaitlist).length,
    [enrollments]
  )
  const avgMarginPerStudent = activeEnrollmentCount > 0 ? margin.cuotas.margin / activeEnrollmentCount : 0
  const breakEven = useMemo(
    () => breakEvenPoint(currentCostStructure.fixed, avgMarginPerStudent, activeEnrollmentCount),
    [currentCostStructure, avgMarginPerStudent, activeEnrollmentCount]
  )

  // ── Seccion 7: Morosidad y cobro ─────────────────────────────────────
  const collection = useMemo(() => collectionStats(allPayments, currentKeys), [allPayments, currentKeys])
  const collectionTrend = useMemo(
    () =>
      last6MonthKeys.map(key => {
        const stats = collectionStats(allPayments, new Set([key]))
        return { name: formatMonthKeyLabel(key), 'Tasa de cobro %': Math.round(stats.collectionRate) }
      }),
    [allPayments, last6MonthKeys]
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">Análisis financiero del club para el período seleccionado.</p>
        <Select
          className="w-36 h-8 text-xs"
          value={period}
          onChange={e => setPeriod(e.target.value as AnalyticsPeriod)}
          options={[
            { value: 'month', label: 'Este mes' },
            { value: 'quarter', label: 'Trimestre' },
            { value: 'year', label: 'Este año' },
          ]}
        />
      </div>

      {/* Seccion 1: Ingresos por origen */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Ingresos por origen</CardTitle>
        </CardHeader>
        <CardContent className={`grid grid-cols-1 gap-4 ${hasOtrosOrigin ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cuotas</p>
            <p className="text-xl font-bold text-foreground">{formatCurrency(originCurrent.cuotas)}</p>
            <VariationBadge current={originCurrent.cuotas} previous={originPrevious.cuotas} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Eventos</p>
            <p className="text-xl font-bold text-foreground">{formatCurrency(originCurrent.eventos)}</p>
            <VariationBadge current={originCurrent.eventos} previous={originPrevious.eventos} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Clases particulares</p>
            <p className="text-xl font-bold text-foreground">{formatCurrency(originCurrent.clases)}</p>
            <VariationBadge current={originCurrent.clases} previous={originPrevious.clases} />
          </div>
          {hasOtrosOrigin && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Otros</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(originCurrent.otros)}</p>
              <VariationBadge current={originCurrent.otros} previous={originPrevious.otros} />
            </div>
          )}
          <div className={`${hasOtrosOrigin ? 'sm:col-span-4' : 'sm:col-span-3'} pt-2 border-t border-border/60 flex items-center justify-between`}>
            <p className="text-sm font-medium text-foreground">Total</p>
            <div className="flex items-center gap-2">
              <p className="text-lg font-bold text-foreground">{formatCurrency(originCurrent.total)}</p>
              <VariationBadge current={originCurrent.total} previous={originPrevious.total} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seccion 2: Adultos vs Menores */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Adultos vs Menores</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Adultos</p>
            <p className="text-xl font-bold text-foreground">{formatCurrency(ageCurrent.adultos)}</p>
            <p className="text-xs text-muted-foreground">
              {ageTotal > 0 ? Math.round((ageCurrent.adultos / ageTotal) * 100) : 0}% del total
            </p>
            <VariationBadge current={ageCurrent.adultos} previous={agePrevious.adultos} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Menores</p>
            <p className="text-xl font-bold text-foreground">{formatCurrency(ageCurrent.menores)}</p>
            <p className="text-xs text-muted-foreground">
              {ageTotal > 0 ? Math.round((ageCurrent.menores / ageTotal) * 100) : 0}% del total
            </p>
            <VariationBadge current={ageCurrent.menores} previous={agePrevious.menores} />
          </div>
        </CardContent>
      </Card>

      {/* Seccion 3: Por grupo/nivel */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Ingresos de cuotas por nivel</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nivel</TableHead>
                <TableHead className="text-right">Importe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byLevelRows.map(([level, amount]) => (
                <TableRow key={level}>
                  <TableCell className="font-medium">
                    {level === 'sinGrupo' ? 'Sin grupo asignado' : LEVEL_LABELS[level]}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Seccion 4: Margen por categoria */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Margen de contribución por categoría</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
                <TableHead className="text-right">Coste</TableHead>
                <TableHead className="text-right">Margen</TableHead>
                <TableHead className="text-right">Margen %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {marginRows.map(row => (
                <TableRow key={row.label}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.revenue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.cost)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.margin)}</TableCell>
                  <TableCell className="text-right">{Math.round(row.marginPct)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Seccion 5: Estructura de costes */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Estructura de costes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
            <div className="h-[240px] w-full">
              {currentCostStructure.total > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={costDonutData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {costDonutData.map(entry => (
                        <Cell key={entry.name} fill={entry.color} stroke="#fcfcfb" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number | undefined) => formatCurrency(value ?? 0)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Sin gastos registrados en el período
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.seriesFixed }} />
                  Fijos
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {formatCurrency(currentCostStructure.fixed)} ({Math.round(currentCostStructure.fixedPct)}%)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.seriesVariable }} />
                  Variables
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {formatCurrency(currentCostStructure.variable)} ({Math.round(currentCostStructure.variablePct)}%)
                </span>
              </div>
              <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Total</span>
                <span className="text-sm font-bold text-foreground">{formatCurrency(currentCostStructure.total)}</span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground mb-3">Evolución fijos/variables — últimos 6 meses</p>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={costTrend} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                  <Tooltip formatter={(value: number | undefined) => `${value ?? 0}%`} />
                  <Legend />
                  <Line type="monotone" dataKey="Fijos %" stroke={CHART_COLORS.seriesFixed} strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="Variables %" stroke={CHART_COLORS.seriesVariable} strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seccion 6: Punto de equilibrio */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Punto de equilibrio</CardTitle>
        </CardHeader>
        <CardContent>
          {breakEven.studentsNeeded === Infinity ? (
            <p className="text-sm font-medium" style={{ color: CHART_COLORS.statusCritical }}>
              El margen medio por alumno de cuotas es cero o negativo: no es posible calcular cuántos alumnos se
              necesitan para cubrir los costes fijos con la configuración actual.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Alumnos necesarios</p>
                <p className="text-xl font-bold text-foreground">{breakEven.studentsNeeded}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Alumnos activos</p>
                <p className="text-xl font-bold text-foreground">{breakEven.actualStudents}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Margen de alumnos</p>
                <p
                  className="text-xl font-bold"
                  style={{ color: breakEven.marginStudents >= 0 ? CHART_COLORS.statusGood : CHART_COLORS.statusCritical }}
                >
                  {breakEven.marginStudents >= 0 ? '+' : ''}
                  {breakEven.marginStudents}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seccion 7: Morosidad y cobro */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Morosidad y cobro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cobrado</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(collection.paidAmount)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pendiente</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(collection.pendingAmount)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tasa de cobro</p>
              <p className="text-xl font-bold text-foreground">{Math.round(collection.collectionRate)}%</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground mb-3">Evolución de la tasa de cobro — últimos 6 meses</p>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={collectionTrend} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                  <Tooltip formatter={(value: number | undefined) => `${value ?? 0}%`} />
                  <Line
                    type="monotone"
                    dataKey="Tasa de cobro %"
                    stroke={CHART_COLORS.seriesCollection}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground mb-3">Top 5 deudores</p>
            {collection.topDebtors.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin pagos pendientes en el período</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jugador</TableHead>
                    <TableHead className="text-right">Importe pendiente</TableHead>
                    <TableHead className="text-right">Pagos pendientes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {collection.topDebtors.map(debtor => (
                    <TableRow key={debtor.playerId}>
                      <TableCell className="font-medium">{debtor.playerName}</TableCell>
                      <TableCell className="text-right">{formatCurrency(debtor.pendingAmount)}</TableCell>
                      <TableCell className="text-right">{debtor.pendingCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
