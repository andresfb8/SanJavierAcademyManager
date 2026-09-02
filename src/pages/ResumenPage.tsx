import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/shared/StatCard'
import { ChevronRight, DollarSign, TrendingDown, TrendingUp, AlertTriangle, Plus } from 'lucide-react'
import { useDataStore } from '@/stores/dataStore'
import { usePaymentsQuery, useEventPaymentsQuery, usePrivateLessonPaymentsQuery, useClubTransactionsQuery, useInvoicesQuery } from '@/hooks/useQueries'
import { normalizeAllPayments } from '@/lib/payment-utils'
import { MONTHS } from '@/constants'
import { formatCurrency } from '@/lib/utils'
import {
  monthlyTotals,
  collectionBreakdown,
  revenueByOrigin,
  attentionItems,
  forecastNextMonth,
  activeMonthlyEnrollmentAmounts,
  pctChange,
  dateToMonthKey,
} from '@/lib/finance-analytics'
import { AddManualPaymentDialog } from '@/components/payments/AddManualPaymentDialog'
import type { FinanzasOutletContext } from '@/components/layout/FinanzasLayout'

const MONTH_NAMES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function monthKeyFor(year: number, month1to12: number): string {
  return `${year}-${month1to12}`
}

export default function ResumenPage() {
  const { setPrimaryAction, selectedMonth, selectedYear } = useOutletContext<FinanzasOutletContext>()
  const { events, privateLessons, enrollments, groups } = useDataStore()

  const years = useMemo(() => {
    const start = new Date(selectedYear, selectedMonth - 1, 1)
    start.setMonth(start.getMonth() - 11)
    const set = new Set<number>()
    // Recorre desde 11 meses atras hasta un mes por delante del seleccionado
    // (inclusive) para que el mes siguiente (usado por el pronostico de
    // "Previsto para...") tambien caiga dentro del rango de anos consultado
    // — si no, en diciembre el ano del mes siguiente quedaria fuera y el
    // pronostico perderia en silencio las transacciones pendientes de enero.
    const end = new Date(selectedYear, selectedMonth, 1)
    for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
      set.add(d.getFullYear())
    }
    return Array.from(set)
  }, [selectedMonth, selectedYear])

  const { data: rawPayments = [] } = usePaymentsQuery(years)
  const { data: eventPayments = [] } = useEventPaymentsQuery()
  const { data: privateLessonPayments = [] } = usePrivateLessonPaymentsQuery()
  const { data: transactions = [] } = useClubTransactionsQuery(years)
  const { data: invoices = [] } = useInvoicesQuery()

  const payments = useMemo(
    () => normalizeAllPayments(rawPayments, eventPayments, privateLessonPayments, events),
    [rawPayments, eventPayments, privateLessonPayments, events]
  )

  const [manualDialogOpen, setManualDialogOpen] = useState(false)

  useEffect(() => {
    setPrimaryAction({ label: 'Registrar cobro', icon: Plus, onClick: () => setManualDialogOpen(true) })
    return () => setPrimaryAction(null)
  }, [setPrimaryAction])

  const monthKey = monthKeyFor(selectedYear, selectedMonth)
  const prevDate = new Date(selectedYear, selectedMonth - 2, 1)
  const prevMonthKey = monthKeyFor(prevDate.getFullYear(), prevDate.getMonth() + 1)
  const nextDate = new Date(selectedYear, selectedMonth, 1)
  const nextMonthKey = monthKeyFor(nextDate.getFullYear(), nextDate.getMonth() + 1)

  const current = useMemo(
    () => monthlyTotals(monthKey, payments, events, eventPayments, privateLessons, privateLessonPayments, transactions),
    [monthKey, payments, events, eventPayments, privateLessons, privateLessonPayments, transactions]
  )
  const previous = useMemo(
    () => monthlyTotals(prevMonthKey, payments, events, eventPayments, privateLessons, privateLessonPayments, transactions),
    [prevMonthKey, payments, events, eventPayments, privateLessons, privateLessonPayments, transactions]
  )

  const cobros = useMemo(() => collectionBreakdown(payments, new Set([monthKey])), [payments, monthKey])
  const origin = useMemo(() => revenueByOrigin(payments, new Set([monthKey])), [payments, monthKey])

  const morosidadPct = cobros.total > 0 ? (cobros.overdueAmount / cobros.total) * 100 : 0
  const margenPct = current.ingresos > 0 ? (current.beneficio / current.ingresos) * 100 : 0
  const round1 = (n: number) => Math.round(n * 10) / 10
  const ingresosDeltaRaw = pctChange(current.ingresos, previous.ingresos)
  const gastosDeltaRaw = pctChange(current.gastos, previous.gastos)
  const ingresosDelta = ingresosDeltaRaw !== null ? round1(ingresosDeltaRaw) : null
  const gastosDelta = gastosDeltaRaw !== null ? round1(gastosDeltaRaw) : null

  const composicion = useMemo(() => {
    const sumIngresoByCategory = (category: 'subvencion' | 'material') =>
      transactions
        .filter(t => t.type === 'ingreso' && t.category === category && (t.status ?? 'pagado') === 'pagado' && dateToMonthKey(t.date) === monthKey)
        .reduce((s, t) => s + t.amount, 0)
    const subvencion = sumIngresoByCategory('subvencion')
    const material = sumIngresoByCategory('material')
    const rows = [
      { name: 'Cuotas mensuales', amount: origin.cuotas },
      { name: 'Subvención/Patrocinio', amount: subvencion },
      { name: 'Clases particulares', amount: origin.clases },
      { name: 'Torneos y eventos', amount: origin.eventos },
      { name: 'Material y equipación', amount: material },
    ]
    const total = rows.reduce((s, r) => s + r.amount, 0)
    return rows.map(r => ({ ...r, pct: total > 0 ? (r.amount / total) * 100 : 0 })).filter(r => r.amount > 0)
  }, [transactions, origin, monthKey])

  const evolucion = useMemo(() => {
    const points = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(selectedYear, selectedMonth - 1 - i, 1)
      const key = monthKeyFor(d.getFullYear(), d.getMonth() + 1)
      const totals = monthlyTotals(key, payments, events, eventPayments, privateLessons, privateLessonPayments, transactions)
      points.push({ name: MONTH_NAMES_SHORT[d.getMonth()], Ingresos: totals.ingresos, Gastos: totals.gastos })
    }
    return points
  }, [selectedMonth, selectedYear, payments, events, eventPayments, privateLessons, privateLessonPayments, transactions])

  const avisos = useMemo(() => attentionItems(payments, invoices, transactions), [payments, invoices, transactions])

  const previsto = useMemo(() => {
    const activeAmounts = activeMonthlyEnrollmentAmounts(enrollments, groups)
    return forecastNextMonth(nextMonthKey, activeAmounts, transactions)
  }, [enrollments, groups, nextMonthKey, transactions])

  return (
    <div className="p-5 lg:p-8 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Ingresos totales"
          value={formatCurrency(current.ingresos)}
          icon={TrendingUp}
          trend={ingresosDelta !== null ? { value: ingresosDelta, label: 'vs. mes anterior' } : undefined}
        />
        <StatCard
          title="Gastos"
          value={formatCurrency(current.gastos)}
          icon={TrendingDown}
          trend={gastosDelta !== null ? { value: gastosDelta, label: 'vs. mes anterior' } : undefined}
        />
        <StatCard
          title="Resultado del mes"
          value={formatCurrency(current.beneficio)}
          icon={DollarSign}
          description={`margen ${margenPct.toFixed(1)}%`}
        />
        <StatCard
          title="Morosidad"
          value={`${morosidadPct.toFixed(1)}%`}
          icon={AlertTriangle}
          description={`${formatCurrency(cobros.overdueAmount)} vencidos`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ingresos vs. gastos · 12 meses</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={evolucion}>
                  <XAxis dataKey="name" fontSize={12} />
                  <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                  <Bar dataKey="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Estado de cobros</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                  {cobros.total > 0 && (
                    <>
                      <div className="bg-emerald-500" style={{ width: `${(cobros.paidAmount / cobros.total) * 100}%` }} />
                      <div className="bg-amber-400" style={{ width: `${(cobros.pendingAmount / cobros.total) * 100}%` }} />
                      <div className="bg-red-500" style={{ width: `${(cobros.overdueAmount / cobros.total) * 100}%` }} />
                    </>
                  )}
                </div>
                {[
                  { label: 'Cobrado', color: 'bg-emerald-500', amount: cobros.paidAmount },
                  { label: 'Pendiente', color: 'bg-amber-400', amount: cobros.pendingAmount },
                  { label: 'Vencido', color: 'bg-red-500', amount: cobros.overdueAmount },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-2 text-sm">
                    <span className={`h-2 w-2 rounded-full ${row.color}`} />
                    <span className="flex-1">{row.label}</span>
                    <span className="text-muted-foreground">{cobros.total > 0 ? ((row.amount / cobros.total) * 100).toFixed(0) : 0}%</span>
                    <span className="font-medium">{formatCurrency(row.amount)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>De dónde vienen los ingresos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {composicion.length === 0 && <p className="text-sm text-muted-foreground">Sin ingresos este mes.</p>}
                {composicion.map((row) => (
                  <div key={row.name} className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="flex-1">{row.name}</span>
                      <span className="text-muted-foreground">{row.pct.toFixed(0)}%</span>
                      <span className="font-medium">{formatCurrency(row.amount)}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted">
                      <div className="h-1.5 rounded-full bg-primary" style={{ width: `${row.pct}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resultado del mes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-3xl font-bold">{formatCurrency(current.beneficio)}</p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ingresos totales</span>
                <span className="font-medium">{formatCurrency(current.ingresos)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Gastos</span>
                <span className="font-medium text-red-600">−{formatCurrency(current.gastos)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Requiere tu atención</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {avisos.length === 0 && <p className="text-sm text-muted-foreground">Todo al día.</p>}
              {avisos.map((item) => (
                <Link
                  key={item.id}
                  to={item.href}
                  className="flex items-center gap-3 rounded-md p-2 -mx-2 hover:bg-accent transition-colors"
                >
                  <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">{item.title}</span>
                    <span className="block text-xs text-muted-foreground truncate">{item.subtitle}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Previsto para {MONTHS.find((m) => m.value === nextDate.getMonth() + 1)?.label.toLowerCase()}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {previsto.items.length === 0 && <p className="text-sm text-muted-foreground">Sin movimientos previstos.</p>}
              {previsto.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span>
                    <span className="block">{item.name}</span>
                    <span className="block text-xs text-muted-foreground">{item.meta}</span>
                  </span>
                  <span className={item.amount >= 0 ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
                    {item.amount >= 0 ? '+' : ''}{formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
              {previsto.items.length > 0 && (
                <div className="flex items-center justify-between text-sm font-semibold border-t border-border pt-2 mt-2">
                  <span>SALDO PREVISTO</span>
                  <span className={previsto.total >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                    {previsto.total >= 0 ? '+' : ''}{formatCurrency(previsto.total)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AddManualPaymentDialog open={manualDialogOpen} onOpenChange={setManualDialogOpen} />
    </div>
  )
}
