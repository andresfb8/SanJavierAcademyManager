import { useState, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { useDataStore } from '@/stores/dataStore'
import {
  FileText,
  TrendingDown,
  TrendingUp,
  Euro,
  Plus,
  BarChart3,
  Trash2,
  Edit,
  Car
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { 
  useAttendanceQuery,
  useActivitiesQuery 
} from '@/hooks/useQueries'
import { normalizeAllPayments } from '@/lib/payment-utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ClubTransaction, TransactionCategory } from '@/types'
import { useToast } from '@/hooks/use-toast'
import { PayrollCloseDialog } from '@/components/financials/PayrollCloseDialog'
import { AnnualFinancialSummary } from '@/components/financials/AnnualFinancialSummary'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const MONTHS = [
  { value: '1', label: 'Enero' },
  { value: '2', label: 'Febrero' },
  { value: '3', label: 'Marzo' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Mayo' },
  { value: '6', label: 'Junio' },
  { value: '7', label: 'Julio' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
]

const currentYear = new Date().getFullYear()
const YEARS = [currentYear - 1, currentYear, currentYear + 1].map((y) => ({
  value: String(y),
  label: String(y),
}))

const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  alquiler: 'Alquiler',
  suministros: 'Suministros',
  material: 'Material',
  reparaciones: 'Reparaciones',
  publicidad: 'Publicidad',
  limpieza: 'Limpieza',
  nomina: 'Nómina',
  otro: 'Otro',
  subvencion: 'Subvención/Patrocinio',
}

function getDefaultMonth() {
  const d = new Date()
  const m = d.getMonth() + 1
  const y = d.getFullYear()
  return { month: String(m), year: String(y) }
}

export default function FinancialsPage() {
  const defaults = getDefaultMonth()
  const [selectedMonth, setSelectedMonth] = useState(defaults.month)
  const [selectedYear, setSelectedYear] = useState(defaults.year)

  const [startMonth, setStartMonth] = useState('9')
  const [startYear, setStartYear] = useState(String(currentYear - 1))
  const [endMonth, setEndMonth] = useState('6')
  const [endYear, setEndYear] = useState(String(currentYear))

  const [isPayrollDialogOpen, setIsPayrollDialogOpen] = useState(false)

  const { success, error } = useToast()
  const { 
    events, 
    privateLessons, 
    addTransaction, 
    deleteTransaction,
    payments: allBasePayments,
    eventPayments,
    privateLessonPayments,
    clubTransactions: allTransactions
  } = useDataStore()

  const year = parseInt(selectedYear)
  const month = parseInt(selectedMonth)

  // =====================================
  // DATA NORMALIZATION (Shared with Dashboard/Payments)
  // =====================================
  const allPayments = useMemo(
    () => normalizeAllPayments(allBasePayments, eventPayments, privateLessonPayments ?? [], events),
    [allBasePayments, eventPayments, privateLessonPayments, events]
  )

  const currentMonthAllPayments = useMemo(
    () => allPayments.filter(p => p.billingMonth === month && p.billingYear === year),
    [allPayments, month, year]
  )

  const transactions = useMemo(() => {
    return allTransactions.filter(t => {
      const d = t.date instanceof Date ? t.date : new Date(t.date)
      return d.getFullYear() === year && d.getMonth() + 1 === month
    })
  }, [allTransactions, year, month])

  const isLoadingTransactions = false // Ya no es asíncrono desde el punto de vista del componente

  // Dialog State
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false)
  const [formData, setFormData] = useState<{
    type: 'ingreso' | 'gasto';
    amount: string;
    concept: string;
    category: TransactionCategory;
    date: string;
  }>({
    type: 'gasto',
    amount: '',
    concept: '',
    category: 'otro',
    date: new Date().toISOString().split('T')[0]
  })

  // =====================================
  // CALCULOS (Sincronizados con Dashboard)
  // =====================================

  // -- Ingresos por tipo --
  const ingresosCuotas = useMemo(
    () => currentMonthAllPayments
        .filter((p: any) => p.status === 'pagado' && (p.source === 'cuota' || p.source === 'manual'))
        .reduce((s: number, p: any) => s + Number(p.amount || 0), 0),
    [currentMonthAllPayments]
  )

  const ingresosEventos = useMemo(
    () => currentMonthAllPayments
        .filter((p: any) => p.status === 'pagado' && p.source === 'evento')
        .reduce((s: number, p: any) => s + Number(p.amount || 0), 0),
    [currentMonthAllPayments]
  )

  const ingresosClases = useMemo(
    () => currentMonthAllPayments
        .filter((p: any) => p.status === 'pagado' && p.source === 'clase_particular')
        .reduce((s: number, p: any) => s + Number(p.amount || 0), 0),
    [currentMonthAllPayments]
  )
  
  // -- Gastos de eventos (Basado en fecha del evento) --
  const eventosDelMes = useMemo(
    () => events.filter((ev) => {
        const d = ev.date instanceof Date ? ev.date : new Date(ev.date)
        return d.getMonth() + 1 === month && d.getFullYear() === year
      }),
    [events, month, year]
  )

  const gastosEventos = useMemo(
    () => eventosDelMes.reduce((acc, ev) => acc + (ev.expenses ?? []).reduce((s, ex) => s + Number(ex.amount || 0), 0), 0),
    [eventosDelMes]
  )

  // -- Transacciones manuales del mes --
  const extrasIngresos = useMemo(() => transactions.filter(t => t.type === 'ingreso').reduce((sum, t) => sum + Number(t.amount || 0), 0), [transactions])
  const extrasGastos = useMemo(() => transactions.filter(t => t.type === 'gasto').reduce((sum, t) => sum + Number(t.amount || 0), 0), [transactions])

  const totalIngresos = ingresosCuotas + ingresosEventos + ingresosClases + extrasIngresos
  const totalGastos = gastosEventos + extrasGastos
  const beneficioNetoTotal = totalIngresos - totalGastos

  // =====================================
  // HANDLERS
  // =====================================

  const handleSaveTransaction = async () => {
    if (!formData.concept || !formData.amount || !formData.category || !formData.date) {
      error('Rellena todos los campos obligatorios')
      return
    }

    try {
      await addTransaction({
        type: formData.type,
        amount: parseFloat(formData.amount),
        concept: formData.concept,
        category: formData.category,
        date: new Date(formData.date)
      })

      setIsTransactionDialogOpen(false)
      success('Transacción guardada correctamente')
      setFormData({
        type: 'gasto',
        amount: '',
        concept: '',
        category: 'otro',
        date: new Date().toISOString().split('T')[0]
      })
    } catch (err: any) {
      error(err.message || 'Error al procesar')
    }
  }

  const handleDeleteTransaction = async (id: string, concept: string) => {
    if (!confirm(`¿Eliminar la transacción "${concept}"?`)) return
    try {
      await deleteTransaction(id)
      success('Transacción eliminada')
    } catch (err: any) {
      error(err.message || 'Error')
    }
  }

  return (
    <div>
      <Header
        title="Beneficios y Gastos"
        subtitle="Analiza los resultados del club y añade ingresos o gastos adicionales"
      />

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Tabs defaultValue="mensual" className="w-full">
          <div className="flex justify-between items-center mb-6">
            <TabsList>
              <TabsTrigger value="mensual">Vista Mensual</TabsTrigger>
              <TabsTrigger value="anual">Vista Anual</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="mensual" className="space-y-6 mt-0">
            <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Seleccionar período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 space-y-1.5 flex flex-col justify-end">
                <label className="text-sm font-medium text-muted-foreground">Mes</label>
                <Select
                  options={MONTHS}
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                />
              </div>
              <div className="w-32 space-y-1.5 flex flex-col justify-end">
                <label className="text-sm font-medium text-muted-foreground">Año</label>
                <Select
                  options={YEARS}
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resumen Superior */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-transparent border-green-100 dark:border-green-900/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Total Ingresos
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-700 dark:text-green-500">
                {formatCurrency(totalIngresos)}
              </div>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between"><span>Cuotas M.:</span> <span>{formatCurrency(ingresosCuotas)}</span></div>
                <div className="flex justify-between"><span>Eventos:</span> <span>{formatCurrency(ingresosEventos)}</span></div>
                <div className="flex justify-between"><span>Particular:</span> <span>{formatCurrency(ingresosClases)}</span></div>
                {extrasIngresos > 0 && <div className="flex justify-between font-medium text-green-600"><span>Extra:</span> <span>+{formatCurrency(extrasIngresos)}</span></div>}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-white dark:from-red-950/20 dark:to-transparent border-red-100 dark:border-red-900/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4" />
                  Gastos Estimados
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-700 dark:text-red-500">
                {formatCurrency(totalGastos)}
              </div>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between"><span>Eventos:</span> <span>{formatCurrency(gastosEventos)}</span></div>
                <div className="flex justify-between text-red-600 font-medium"><span>Club (General):</span> <span>{formatCurrency(extrasGastos)}</span></div>
              </div>
            </CardContent>
          </Card>

          <Card className={`bg-gradient-to-br ${beneficioNetoTotal >= 0 ? 'from-slate-50 to-white dark:from-slate-900' : 'from-orange-50 to-white dark:from-orange-950/20'} border`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Euro className="h-4 w-4" />
                Beneficio Neto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-4xl font-bold ${beneficioNetoTotal >= 0 ? 'text-primary' : 'text-red-600'}`}>
                {formatCurrency(beneficioNetoTotal)}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                A falta de cerrar nóminas de monitores del mes actual o facturas pendientes.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Listado de transacciones manuales */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-5">
            <div className="space-y-1">
              <CardTitle className="text-lg">Transacciones del Club</CardTitle>
              <p className="text-sm text-muted-foreground">Ingresos extra y gastos de explotación registrados este mes.</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => setIsPayrollDialogOpen(true)} className="border-primary text-primary hover:bg-primary/5">
                Cerrar Nóminas
              </Button>
              <Button onClick={() => setIsTransactionDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Añadir Movimiento
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {transactions.length > 0 ? (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Importe</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="whitespace-nowrap">{formatDate(t.date)}</TableCell>
                        <TableCell className="font-medium">{t.concept}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            t.type === 'ingreso' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {t.type.toUpperCase()}
                          </span>
                        </TableCell>
                        <TableCell>{CATEGORY_LABELS[t.category]}</TableCell>
                        <TableCell className={`text-right font-semibold ${t.type === 'ingreso' ? 'text-green-600' : 'text-red-600'}`}>
                          {t.type === 'gasto' ? '-' : '+'}{formatCurrency(t.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteTransaction(t.id, t.concept)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 border rounded-md border-dashed">
                <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
                <h3 className="text-base font-medium">Sin movimientos</h3>
                <p className="text-sm text-muted-foreground mt-1">No hay gastos generales ni ingresos extra registrados este mes.</p>
              </div>
            )}
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="anual" className="mt-0">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Seleccionar Período (Temporada)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-4">
                <div className="w-32 space-y-1.5 flex flex-col justify-end">
                  <label className="text-sm font-medium text-muted-foreground">Mes Inicio</label>
                  <Select
                    options={MONTHS}
                    value={startMonth}
                    onChange={(e) => setStartMonth(e.target.value)}
                  />
                </div>
                <div className="w-32 space-y-1.5 flex flex-col justify-end">
                  <label className="text-sm font-medium text-muted-foreground">Año Inicio</label>
                  <Select
                    options={YEARS}
                    value={startYear}
                    onChange={(e) => setStartYear(e.target.value)}
                  />
                </div>
                <div className="px-4 py-2 text-sm font-medium text-muted-foreground hidden sm:block">hasta</div>
                <div className="w-32 space-y-1.5 flex flex-col justify-end border-t pt-4 sm:border-0 sm:pt-0">
                  <label className="text-sm font-medium text-muted-foreground">Mes Fin</label>
                  <Select
                    options={MONTHS}
                    value={endMonth}
                    onChange={(e) => setEndMonth(e.target.value)}
                  />
                </div>
                <div className="w-32 space-y-1.5 flex flex-col justify-end">
                  <label className="text-sm font-medium text-muted-foreground">Año Fin</label>
                  <Select
                    options={YEARS}
                    value={endYear}
                    onChange={(e) => setEndYear(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <AnnualFinancialSummary 
            startMonth={parseInt(startMonth)} 
            startYear={parseInt(startYear)} 
            endMonth={parseInt(endMonth)} 
            endYear={parseInt(endYear)} 
          />
        </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Transacción</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo</label>
                <div className="flex rounded-md shadow-sm">
                  <button
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, type: 'gasto' }))}
                    className={`flex-1 px-4 py-2 text-sm font-medium border border-r-0 rounded-l-md transition-colors ${
                      formData.type === 'gasto' 
                      ? 'bg-red-50 text-red-700 border-red-200' 
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Gasto
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, type: 'ingreso' }))}
                    className={`flex-1 px-4 py-2 text-sm font-medium border rounded-r-md transition-colors ${
                      formData.type === 'ingreso' 
                      ? 'bg-green-50 text-green-700 border-green-200' 
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Ingreso
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha</label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(p => ({ ...p, date: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Concepto</label>
              <Input
                placeholder="Ej. Compra de material, Luz, Patrocinador..."
                value={formData.concept}
                onChange={(e) => setFormData(p => ({ ...p, concept: e.target.value }))}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Categoría</label>
                <Select
                  value={formData.category}
                  onChange={(e) => setFormData(p => ({ ...p, category: e.target.value as TransactionCategory }))}
                  options={Object.entries(CATEGORY_LABELS).map(([val, label]) => ({
                    value: val,
                    label
                  }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Importe (€)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData(p => ({ ...p, amount: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTransactionDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveTransaction}>Guardar Transacción</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PayrollCloseDialog 
        open={isPayrollDialogOpen} 
        onOpenChange={setIsPayrollDialogOpen} 
        year={year} 
        month={month} 
      />
    </div>
  )
}
