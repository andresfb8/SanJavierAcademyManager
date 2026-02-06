import { useState, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { StatCard } from '@/components/shared/StatCard'
import { useDataStore } from '@/stores/dataStore'
import { DollarSign, TrendingUp, AlertCircle, CheckCircle, Search, FileText, CreditCard, Download } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PAYMENT_STATUSES, PAYMENT_METHODS, MONTHS } from '@/constants'
import type { Payment, PaymentMethod } from '@/types'

export default function PaymentsPage() {
  const { payments, markPaymentPaid, generateMonthlyReceipts } = useDataStore()

  const now = new Date()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear())

  // Mark as paid dialog
  const [paymentToMark, setPaymentToMark] = useState<Payment | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('transferencia')

  // Generate available years (current year +/- 2)
  const availableYears = useMemo(() => {
    const currentYear = now.getFullYear()
    return [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2]
  }, [])

  // Filtered and sorted payments
  const filteredPayments = useMemo(() => {
    return payments
      .filter((p) => {
        const matchesSearch =
          search === '' ||
          p.playerName.toLowerCase().includes(search.toLowerCase()) ||
          p.concept.toLowerCase().includes(search.toLowerCase())
        const matchesStatus = statusFilter === '' || p.status === statusFilter
        const matchesMonth = p.billingMonth === selectedMonth
        const matchesYear = p.billingYear === selectedYear
        return matchesSearch && matchesStatus && matchesMonth && matchesYear
      })
      .sort((a, b) => {
        const dateA = a.paidDate || a.dueDate
        const dateB = b.paidDate || b.dueDate
        return new Date(dateB).getTime() - new Date(dateA).getTime()
      })
  }, [payments, search, statusFilter, selectedMonth, selectedYear])

  // KPI calculations for current selected month
  const currentMonthPayments = useMemo(() => {
    return payments.filter(
      (p) => p.billingMonth === selectedMonth && p.billingYear === selectedYear
    )
  }, [payments, selectedMonth, selectedYear])

  const previousMonthPayments = useMemo(() => {
    const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1
    const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear
    return payments.filter(
      (p) => p.billingMonth === prevMonth && p.billingYear === prevYear
    )
  }, [payments, selectedMonth, selectedYear])

  const ingresosMes = useMemo(() => {
    return currentMonthPayments
      .filter((p) => p.status === 'pagado')
      .reduce((sum, p) => sum + p.amount, 0)
  }, [currentMonthPayments])

  const ingresosMesAnterior = useMemo(() => {
    return previousMonthPayments
      .filter((p) => p.status === 'pagado')
      .reduce((sum, p) => sum + p.amount, 0)
  }, [previousMonthPayments])

  const ingresosTrend = useMemo(() => {
    if (ingresosMesAnterior === 0) return 0
    return Math.round(((ingresosMes - ingresosMesAnterior) / ingresosMesAnterior) * 100)
  }, [ingresosMes, ingresosMesAnterior])

  const pendienteCobro = useMemo(() => {
    return currentMonthPayments
      .filter((p) => p.status === 'pendiente')
      .reduce((sum, p) => sum + p.amount, 0)
  }, [currentMonthPayments])

  const tasaCobro = useMemo(() => {
    if (currentMonthPayments.length === 0) return 0
    const pagados = currentMonthPayments.filter((p) => p.status === 'pagado').length
    return Math.round((pagados / currentMonthPayments.length) * 100)
  }, [currentMonthPayments])

  const totalRecibos = currentMonthPayments.length

  // Handlers
  const handleMarkPaid = () => {
    if (!paymentToMark) return
    markPaymentPaid(paymentToMark.id, selectedMethod)
    setPaymentToMark(null)
    setSelectedMethod('transferencia')
  }

  const handleGenerateReceipts = () => {
    const count = generateMonthlyReceipts(selectedMonth, selectedYear)
    if (count > 0) {
      alert(`Se han generado ${count} recibos para ${MONTHS.find((m) => m.value === selectedMonth)?.label} ${selectedYear}.`)
    } else {
      alert('No se han generado nuevos recibos. Puede que ya existan recibos para este mes o no haya inscripciones activas.')
    }
  }

  const handleExport = () => {
    const headers = ['Jugador', 'Concepto', 'Grupo', 'Importe', 'Estado', 'Vencimiento', 'Fecha pago', 'Metodo']
    const rows = filteredPayments.map((p) => [
      p.playerName,
      p.concept,
      p.groupName,
      p.amount.toFixed(2),
      p.status,
      p.dueDate ? formatDate(new Date(p.dueDate)) : '',
      p.paidDate ? formatDate(new Date(p.paidDate)) : '',
      p.paymentMethod || '',
    ])
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pagos_${selectedMonth}_${selectedYear}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const openMarkPaidDialog = (payment: Payment) => {
    setPaymentToMark(payment)
    setSelectedMethod('transferencia')
  }

  const selectedMonthLabel = MONTHS.find((m) => m.value === selectedMonth)?.label || ''

  return (
    <div>
      <Header
        title="Pagos y Facturación"
        subtitle={`${selectedMonthLabel} ${selectedYear} · ${totalRecibos} recibos`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" />
              Exportar
            </Button>
            <Button size="sm" onClick={handleGenerateReceipts}>
              <FileText className="h-4 w-4 mr-1" />
              Generar recibos
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Ingresos del mes"
            value={formatCurrency(ingresosMes)}
            icon={DollarSign}
            trend={{
              value: ingresosTrend,
              label: 'vs mes anterior',
            }}
            iconClassName="bg-green-100 text-green-700"
          />
          <StatCard
            title="Pendiente de cobro"
            value={formatCurrency(pendienteCobro)}
            icon={AlertCircle}
            iconClassName="bg-yellow-100 text-yellow-700"
          />
          <StatCard
            title="Tasa de cobro"
            value={`${tasaCobro}%`}
            icon={TrendingUp}
            iconClassName="bg-blue-100 text-blue-700"
          />
          <StatCard
            title="Total recibos"
            value={totalRecibos}
            icon={FileText}
            iconClassName="bg-purple-100 text-purple-700"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por jugador o concepto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            options={[
              { value: '', label: 'Todos los estados' },
              ...PAYMENT_STATUSES.map((s) => ({ value: s.value, label: s.label })),
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-48"
          />
          <Select
            options={MONTHS.map((m) => ({ value: String(m.value), label: m.label }))}
            value={String(selectedMonth)}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="w-full sm:w-40"
          />
          <Select
            options={availableYears.map((y) => ({ value: String(y), label: String(y) }))}
            value={String(selectedYear)}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="w-full sm:w-32"
          />
        </div>

        {/* Payments table */}
        {filteredPayments.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-1">No hay recibos</h3>
              <p className="text-sm text-muted-foreground">
                No se encontraron recibos para los filtros seleccionados. Prueba a generar recibos para este mes.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Jugador</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="hidden md:table-cell">Grupo</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="hidden lg:table-cell">Vencimiento</TableHead>
                    <TableHead className="hidden lg:table-cell">Fecha pago</TableHead>
                    <TableHead className="hidden md:table-cell">Método</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <span className="font-medium text-sm">{payment.playerName}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{payment.concept}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm text-muted-foreground">{payment.groupName}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold text-sm">{formatCurrency(payment.amount)}</span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={payment.status} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-sm text-muted-foreground">
                          {payment.dueDate ? formatDate(new Date(payment.dueDate)) : '-'}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-sm text-muted-foreground">
                          {payment.paidDate ? formatDate(new Date(payment.paidDate)) : '-'}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm text-muted-foreground">
                          {payment.paymentMethod
                            ? PAYMENT_METHODS.find((m) => m.value === payment.paymentMethod)?.label || payment.paymentMethod
                            : '-'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {payment.status === 'pendiente' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openMarkPaidDialog(payment)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Marcar pagado
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Mark as Paid Dialog */}
      <Dialog open={!!paymentToMark} onOpenChange={(open) => { if (!open) setPaymentToMark(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar pago</DialogTitle>
          </DialogHeader>

          {paymentToMark && (
            <div className="space-y-4">
              {/* Payment summary */}
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Jugador</span>
                  <span className="font-medium">{paymentToMark.playerName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Concepto</span>
                  <span className="font-medium">{paymentToMark.concept}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Importe</span>
                  <span className="font-semibold text-green-700">{formatCurrency(paymentToMark.amount)}</span>
                </div>
              </div>

              {/* Payment method */}
              <div className="space-y-2">
                <Label>Método de pago</Label>
                <Select
                  options={PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label }))}
                  value={selectedMethod}
                  onChange={(e) => setSelectedMethod(e.target.value as PaymentMethod)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentToMark(null)}>
              Cancelar
            </Button>
            <Button onClick={handleMarkPaid}>
              <CreditCard className="h-4 w-4 mr-1" />
              Confirmar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
