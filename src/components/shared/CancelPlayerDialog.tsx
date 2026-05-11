import { useState, useMemo } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useDataStore } from '@/stores/dataStore'
import { formatCurrency } from '@/lib/utils'
import { CANCELLATION_DEADLINE_DAY } from '@/constants'
import { AlertTriangle, Receipt, CalendarX, CheckCircle2 } from 'lucide-react'
import type { Player } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  player: Player | null
  onConfirm: (options: { cancelCurrentMonthPayments: boolean }) => void
}

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export function CancelPlayerDialog({ open, onOpenChange, player, onConfirm }: Props) {
  const { payments } = useDataStore()
  const [cancelPayments, setCancelPayments] = useState<boolean | null>(null)

  const today = new Date()
  const currentDay = today.getDate()
  const currentMonth = today.getMonth() + 1
  const currentYear = today.getFullYear()
  const isBeforeDeadline = currentDay <= CANCELLATION_DEADLINE_DAY
  const monthLabel = `${MONTH_NAMES[currentMonth - 1]} ${currentYear}`

  const pendingCurrentMonthPayments = useMemo(() => {
    if (!player) return []
    return payments.filter(
      (p) =>
        p.playerId === player.id &&
        p.status === 'pendiente' &&
        p.billingMonth === currentMonth &&
        p.billingYear === currentYear,
    )
  }, [payments, player?.id, currentMonth, currentYear])

  const pendingTotal = pendingCurrentMonthPayments.reduce((s, p) => s + p.amount, 0)
  const hasPendingThisMonth = pendingCurrentMonthPayments.length > 0

  function handleClose() {
    setCancelPayments(null)
    onOpenChange(false)
  }

  function handleConfirm() {
    if (hasPendingThisMonth && cancelPayments === null) return
    onConfirm({ cancelCurrentMonthPayments: hasPendingThisMonth ? cancelPayments! : false })
    setCancelPayments(null)
  }

  if (!player) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarX className="h-5 w-5 text-destructive" />
            Dar de baja a {player.firstName} {player.lastName}
          </DialogTitle>
          <DialogDescription>
            Esta acción desactivará todas sus matrículas. No se generarán nuevos recibos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Contexto día 5 */}
          <div className={`flex items-start gap-3 rounded-xl p-3 text-sm ${
            isBeforeDeadline
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border border-amber-200 text-amber-800'
          }`}>
            <div className="mt-0.5 shrink-0">
              {isBeforeDeadline
                ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                : <AlertTriangle className="h-4 w-4 text-amber-600" />}
            </div>
            <div>
              <p className="font-semibold">
                Hoy es día {currentDay}
                {isBeforeDeadline
                  ? ` — antes del día ${CANCELLATION_DEADLINE_DAY}`
                  : ` — después del día ${CANCELLATION_DEADLINE_DAY}`}
              </p>
              <p className="text-xs mt-0.5 opacity-80">
                {isBeforeDeadline
                  ? 'Habitualmente no se cobra el mes en curso al darse de baja antes del día 5.'
                  : 'Habitualmente se cobra el mes completo al darse de baja después del día 5.'}
              </p>
            </div>
          </div>

          {/* Recibos pendientes del mes actual */}
          {hasPendingThisMonth ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Receipt className="h-4 w-4" />
                Recibo{pendingCurrentMonthPayments.length > 1 ? 's' : ''} pendiente{pendingCurrentMonthPayments.length > 1 ? 's' : ''} de {monthLabel}
              </div>

              <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                {pendingCurrentMonthPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-slate-600">{p.concept || 'Cuota mensual'}</span>
                    <Badge variant="outline" className="font-semibold">{formatCurrency(p.amount)}</Badge>
                  </div>
                ))}
                {pendingCurrentMonthPayments.length > 1 && (
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 rounded-b-xl">
                    <span className="text-sm font-bold text-slate-700">Total</span>
                    <span className="text-sm font-bold text-slate-900">{formatCurrency(pendingTotal)}</span>
                  </div>
                )}
              </div>

              <p className="text-sm text-slate-600 font-medium">¿Qué hacer con este recibo?</p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCancelPayments(true)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center transition-all ${
                    cancelPayments === true
                      ? 'border-destructive bg-red-50 text-destructive'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <CalendarX className="h-5 w-5" />
                  <span className="text-xs font-semibold">Cancelar recibo</span>
                  <span className="text-[10px] opacity-70">No se cobrará</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCancelPayments(false)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center transition-all ${
                    cancelPayments === false
                      ? 'border-amber-400 bg-amber-50 text-amber-700'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <Receipt className="h-5 w-5" />
                  <span className="text-xs font-semibold">Mantener pendiente</span>
                  <span className="text-[10px] opacity-70">Cobrar igualmente</span>
                </button>
              </div>

              {cancelPayments === null && (
                <p className="text-xs text-destructive font-medium">
                  Elige qué hacer con el recibo para continuar.
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-500">
              <CheckCircle2 className="h-4 w-4 text-slate-400 shrink-0" />
              No hay recibos pendientes de {monthLabel}. La baja no afecta a ningún recibo.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={hasPendingThisMonth && cancelPayments === null}
          >
            Confirmar baja
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
