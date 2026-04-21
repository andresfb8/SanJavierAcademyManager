import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine, CartesianGrid } from 'recharts'
import { usePaymentsQuery, useEventPaymentsQuery, usePrivateLessonPaymentsQuery, useClubTransactionsQuery } from '@/hooks/useQueries'
import { useDataStore } from '@/stores/dataStore'
import { formatCurrency } from '@/lib/utils'

interface AnnualFinancialSummaryProps {
  startMonth: number
  startYear: number
  endMonth: number
  endYear: number
}

export function AnnualFinancialSummary({ startMonth, startYear, endMonth, endYear }: AnnualFinancialSummaryProps) {
  const { events, privateLessons } = useDataStore()

  const years: number[] = useMemo(() => {
    const arr = []
    for (let y = startYear; y <= endYear; y++) arr.push(y)
    return arr
  }, [startYear, endYear])

  // Fetches en background que cubren todos los años involucrados
  const { data: payments = [] } = usePaymentsQuery(years)
  const { data: eventPayments = [] } = useEventPaymentsQuery()
  const { data: privateLessonPayments = [] } = usePrivateLessonPaymentsQuery()
  const { data: transactions = [] } = useClubTransactionsQuery(years)

  const chartData = useMemo(() => {
    const data = []
    
    const start = new Date(startYear, startMonth - 1, 1)
    const end = new Date(endYear, endMonth - 1, 1)

    if (start > end) return []

    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

    let curr = new Date(start)
    while (curr <= end) {
      const monthIdx = curr.getMonth() + 1
      const yearIdx = curr.getFullYear()

      // 1. Ingresos Cuotas
      const ingresosCuotas = payments
        .filter(p => p.status === 'pagado' && p.billingMonth === monthIdx && p.billingYear === yearIdx)
        .reduce((s, p) => s + p.amount, 0)

      // 2. Eventos
      const eventosMes = events.filter(ev => {
        const d = ev.date instanceof Date ? ev.date : new Date(ev.date)
        return (d.getMonth() + 1) === monthIdx && d.getFullYear() === yearIdx
      })
      const ingresosEventos = eventosMes.reduce((acc, ev) => acc + eventPayments.filter(ep => ep.eventId === ev.id && ep.status === 'pagado').reduce((s, ep) => s + ep.amount, 0), 0)
      const gastosEventos = eventosMes.reduce((acc, ev) => acc + (ev.expenses ?? []).reduce((s, ex) => s + ex.amount, 0), 0)

      // 3. Clases Particulares
      const clasesMes = privateLessons.filter(pl => {
        const d = pl.date instanceof Date ? pl.date : new Date(pl.date)
        return (d.getMonth() + 1) === monthIdx && d.getFullYear() === yearIdx
      })
      const ingresosClases = clasesMes.reduce((acc, pl) => acc + privateLessonPayments.filter(lp => lp.lessonId === pl.id && lp.status === 'pagado').reduce((s, lp) => s + lp.amount, 0), 0)

      // 4. Extras (clubTransactions)
      const transMes = transactions.filter(t => {
        const d = t.date instanceof Date ? t.date : new Date(t.date)
        return (d.getMonth() + 1) === monthIdx && d.getFullYear() === yearIdx
      })
      const extrasIngresos = transMes.filter(t => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0)
      const extrasGastos = transMes.filter(t => t.type === 'gasto').reduce((s, t) => s + t.amount, 0)

      const totalIngresos = ingresosCuotas + ingresosEventos + ingresosClases + extrasIngresos
      const totalGastos = gastosEventos + extrasGastos
      const beneficio = totalIngresos - totalGastos

      data.push({
        name: `${monthNames[monthIdx - 1]} ${yearIdx}`,
        Ingresos: totalIngresos,
        Gastos: totalGastos,
        Beneficio: beneficio
      })

      curr.setMonth(curr.getMonth() + 1)
    }
    return data
  }, [startMonth, startYear, endMonth, endYear, payments, events, eventPayments, privateLessons, privateLessonPayments, transactions])

  const totalAnual = useMemo(() => {
    return chartData.reduce((acc, curr) => ({
      ingresos: acc.ingresos + curr.Ingresos,
      gastos: acc.gastos + curr.Gastos,
      beneficio: acc.beneficio + curr.Beneficio
    }), { ingresos: 0, gastos: 0, beneficio: 0 })
  }, [chartData])

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-green-50 border-green-200">
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium text-green-800">Ingresos Totales (Período)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{formatCurrency(totalAnual.ingresos)}</div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium text-red-800">Gastos Totales (Período)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{formatCurrency(totalAnual.gastos)}</div>
          </CardContent>
        </Card>
        <Card className={totalAnual.beneficio >= 0 ? "bg-blue-50 border-blue-200" : "bg-orange-50 border-orange-200"}>
          <CardHeader className="py-4">
            <CardTitle className={`text-sm font-medium ${totalAnual.beneficio >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>Beneficio Neto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalAnual.beneficio >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
              {formatCurrency(totalAnual.beneficio)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evolución Mensual de Beneficios y Gastos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
                <XAxis dataKey="name" tickMargin={10} />
                <YAxis tickFormatter={(val) => `€${val}`} tickMargin={10} />
                <Tooltip 
                  formatter={(value: any) => formatCurrency(value || 0)}
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <ReferenceLine y={0} stroke="#000" />
                <Bar dataKey="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={50} />
                <Bar dataKey="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
