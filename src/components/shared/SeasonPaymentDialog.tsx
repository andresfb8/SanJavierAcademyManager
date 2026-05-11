import { useState, useMemo } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useDataStore } from '@/stores/dataStore'
import { PAYMENT_METHODS } from '@/constants'
import { formatCurrency } from '@/lib/utils'
import type { PaymentMethod } from '@/types'
import { CalendarRange, CheckCircle2, AlertTriangle } from 'lucide-react'

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const MONTH_OPTIONS = MONTH_NAMES.map((label, i) => ({ value: String(i + 1), label }))

const currentYear = new Date().getFullYear()
const YEAR_OPTIONS = [currentYear - 1, currentYear, currentYear + 1].map((y) => ({
  value: String(y),
  label: String(y),
}))

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  playerId: string
  playerName: string
}

export function SeasonPaymentDialog({ open, onOpenChange, playerId, playerName }: Props) {
  const { enrollments, payments, registerSeasonPayment } = useDataStore()

  const [enrollmentId, setEnrollmentId] = useState('')
  const [startMonth, setStartMonth] = useState(String(new Date().getMonth() + 1))
  const [startYear, setStartYear] = useState(String(currentYear))
  const [endMonth, setEndMonth] = useState(String(new Date().getMonth() + 1))
  const [endYear, setEndYear] = useState(String(currentYear))
  const [totalAmount, setTotalAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo')
  const [paidDate, setPaidDate] = useState(() => new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const activeEnrollments = useMemo(
    () => enrollments.filter((e) => e.playerId === playerId && e.isActive),
    [enrollments, playerId],
  )

  const enrollmentOptions = activeEnrollments.map((e) => ({
    value: e.id,
    label: e.groupName,
  }))

  // Calcular los meses del periodo seleccionado
  const periodMonths = useMemo(() => {
    const sm = parseInt(startMonth)
    const sy = parseInt(startYear)
    const em = parseInt(endMonth)
    const ey = parseInt(endYear)
    if (sy > ey || (sy === ey && sm > em)) return []
    const months: { month: number; year: number }[] = []
    let m = sm
    let y = sy
    while (y < ey || (y === ey && m <= em)) {
      months.push({ month: m, year: y })
      m++
      if (m > 12) { m = 1; y++ }
    }
    return months
  }, [startMonth, startYear, endMonth, endYear])

  const amountPerMonth = useMemo(() => {
    const total = parseFloat(totalAmount)
    if (!total || periodMonths.length === 0) return 0
    return Math.round((total / periodMonths.length) * 100) / 100
  }, [totalAmount, periodMonths.length])

  // Detectar meses que ya tienen recibo (para avisar)
  const conflictMonths = useMemo(() => {
    if (!enrollmentId) return []
    return periodMonths.filter(({ month, year }) =>
      payments.some(
        (p) => p.enrollmentId === enrollmentId && p.billingMonth === month && p.billingYear === year
      )
    )
  }, [periodMonths, payments, enrollmentId])

  function resetForm() {
    setEnrollmentId('')
    setStartMonth(String(new Date().getMonth() + 1))
    setStartYear(String(currentYear))
    setEndMonth(String(new Date().getMonth() + 1))
    setEndYear(String(currentYear))
    setTotalAmount('')
    setPaymentMethod('efectivo')
    setPaidDate(new Date().toISOString().split('T')[0])
    setNotes('')
    setError('')
  }

  function handleClose() {
    resetForm()
    onOpenChange(false)
  }

  async function handleConfirm() {
    if (!enrollmentId) { setError('Selecciona un grupo'); return }
    if (periodMonths.length === 0) { setError('El periodo no es válido'); return }
    const total = parseFloat(totalAmount)
    if (!total || total <= 0) { setError('Introduce un importe válido'); return }

    setSaving(true)
    try {
      registerSeasonPayment({
        enrollmentId,
        startMonth: parseInt(startMonth),
        startYear: parseInt(startYear),
        endMonth: parseInt(endMonth),
        endYear: parseInt(endYear),
        totalAmount: total,
        paymentMethod,
        paidDate: new Date(paidDate),
        notes: notes.trim() || undefined,
      })
      handleClose()
    } finally {
      setSaving(false)
    }
  }

  const newMonthsCount = periodMonths.length - conflictMonths.length

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarRange className="h-5 w-5 text-primary" />
            Registrar pago de temporada
          </DialogTitle>
          <DialogDescription>
            {playerName} · El importe se distribuye en meses iguales. La facturación mensual omitirá automáticamente los meses ya registrados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Grupo */}
          <div className="space-y-1.5">
            <Label>Grupo / matrícula</Label>
            <Select
              options={enrollmentOptions}
              placeholder="Selecciona el grupo"
              value={enrollmentId}
              onChange={(e) => { setEnrollmentId(e.target.value); setError('') }}
            />
          </div>

          {/* Periodo */}
          <div className="space-y-1.5">
            <Label>Periodo</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Desde</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <Select
                    options={MONTH_OPTIONS}
                    value={startMonth}
                    onChange={(e) => setStartMonth(e.target.value)}
                  />
                  <Select
                    options={YEAR_OPTIONS}
                    value={startYear}
                    onChange={(e) => setStartYear(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Hasta</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <Select
                    options={MONTH_OPTIONS}
                    value={endMonth}
                    onChange={(e) => setEndMonth(e.target.value)}
                  />
                  <Select
                    options={YEAR_OPTIONS}
                    value={endYear}
                    onChange={(e) => setEndYear(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Importe y método */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sp-amount">Importe total (€)</Label>
              <Input
                id="sp-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="600.00"
                value={totalAmount}
                onChange={(e) => { setTotalAmount(e.target.value); setError('') }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-paid-date">Fecha de pago</Label>
              <Input
                id="sp-paid-date"
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Método de pago</Label>
            <Select
              options={PAYMENT_METHODS}
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sp-notes">Notas (opcional)</Label>
            <Input
              id="sp-notes"
              placeholder="Ej: Pago completo de la temporada 2024-25"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Preview de meses */}
          {periodMonths.length > 0 && parseFloat(totalAmount) > 0 && (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">
                  {periodMonths.length} {periodMonths.length === 1 ? 'mes' : 'meses'} · {formatCurrency(amountPerMonth)}/mes
                </span>
                <span className="text-xs font-bold text-slate-500">
                  Total: {formatCurrency(parseFloat(totalAmount) || 0)}
                </span>
              </div>
              <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
                {periodMonths.map(({ month, year }) => {
                  const hasConflict = conflictMonths.some((c) => c.month === month && c.year === year)
                  return (
                    <div key={`${year}-${month}`} className={`flex items-center justify-between px-4 py-2 text-sm ${hasConflict ? 'bg-amber-50' : ''}`}>
                      <span className={hasConflict ? 'text-amber-700 font-medium' : 'text-slate-700'}>
                        {MONTH_NAMES[month - 1]} {year}
                        {hasConflict && <span className="ml-2 text-[10px] font-bold text-amber-600">ya existe</span>}
                      </span>
                      <span className={hasConflict ? 'text-amber-500 line-through text-xs' : 'text-slate-500'}>
                        {formatCurrency(amountPerMonth)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Aviso de conflictos */}
          {conflictMonths.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                {conflictMonths.length} {conflictMonths.length === 1 ? 'mes ya tiene un recibo' : 'meses ya tienen recibo'} y {conflictMonths.length === 1 ? 'será omitido' : 'serán omitidos'}.
                Se crearán {newMonthsCount} {newMonthsCount === 1 ? 'recibo nuevo' : 'recibos nuevos'}.
              </span>
            </div>
          )}

          {newMonthsCount === 0 && periodMonths.length > 0 && enrollmentId && (
            <div className="flex items-start gap-2 rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm text-slate-600">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-slate-400" />
              Todos los meses del periodo ya tienen recibo registrado. No se creará ninguno nuevo.
            </div>
          )}

          {error && <p className="text-sm text-destructive font-medium">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={saving || newMonthsCount === 0 || periodMonths.length === 0}
          >
            {saving ? 'Registrando...' : `Registrar ${newMonthsCount > 0 ? newMonthsCount : ''} recibo${newMonthsCount !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
