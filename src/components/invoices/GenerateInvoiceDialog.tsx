// ==========================================
// Generate Invoice Dialog
// ==========================================
// Diálogo para generar facturas desde pagos seleccionados

import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { AlertCircle, FileText } from 'lucide-react'
import { useDataStore } from '@/stores/dataStore'
import { INVOICE_SERIES } from '@/constants'
import { formatCurrency } from '@/lib/utils'
import { generateInvoiceFromPayments, canGenerateInvoice } from '@/lib/invoice-utils'
import type { InvoiceSeries, Payment, EventPayment, PrivateLessonPayment } from '@/types'

interface GenerateInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preSelectedPaymentIds?: string[]
  preSelectedPlayerId?: string
}

type AnyPayment = Payment | EventPayment | PrivateLessonPayment

export function GenerateInvoiceDialog({
  open,
  onOpenChange,
  preSelectedPaymentIds = [],
  preSelectedPlayerId,
}: GenerateInvoiceDialogProps) {
  const { players, payments, eventPayments, privateLessonPayments, club, addInvoice } = useDataStore()

  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(preSelectedPlayerId || '')
  const [selectedSeries, setSelectedSeries] = useState<InvoiceSeries>('FC')
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<string>>(
    new Set(preSelectedPaymentIds)
  )
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Reset form cuando se abre el diálogo
  useEffect(() => {
    if (open) {
      setSelectedPlayerId(preSelectedPlayerId || '')
      setSelectedSeries('FC')
      setSelectedPaymentIds(new Set(preSelectedPaymentIds))
      setNotes('')
      setError('')
      setIsSubmitting(false)
    }
  }, [open, preSelectedPlayerId, preSelectedPaymentIds])

  // Combinar todos los pagos
  const allPayments: AnyPayment[] = useMemo(
    () => [...payments, ...eventPayments, ...privateLessonPayments],
    [payments, eventPayments, privateLessonPayments]
  )

  // Filtrar pagos disponibles para facturar del jugador seleccionado
  const availablePayments = useMemo(() => {
    if (!selectedPlayerId) return []

    return allPayments.filter(
      (p) =>
        p.playerId === selectedPlayerId &&
        p.status === 'pagado' &&
        !p.invoiceId
    )
  }, [selectedPlayerId, allPayments])

  // Calcular preview de la factura
  const preview = useMemo(() => {
    if (selectedPaymentIds.size === 0) {
      return { subtotal: 0, totalVat: 0, total: 0, vatBreakdown: {} }
    }

    const selectedPayments = allPayments.filter((p) => selectedPaymentIds.has(p.id))

    // Calcular totales simples (en la factura real se calcula con desglose IVA)
    const total = selectedPayments.reduce((sum, p) => sum + p.amount, 0)

    // Estimación simple: asumimos que amount incluye IVA
    // El cálculo real se hace en generateInvoiceFromPayments
    return {
      subtotal: total,
      totalVat: 0,
      total,
      vatBreakdown: {},
      count: selectedPayments.length,
    }
  }, [selectedPaymentIds, allPayments])

  // Validación
  const validationResult = useMemo(() => {
    if (!selectedPlayerId) {
      return { canInvoice: false, reason: 'Debe seleccionar un cliente' }
    }

    if (!club?.nif || !club?.legalName || !club?.fiscalAddress) {
      return {
        canInvoice: false,
        reason: 'El club debe tener configurados NIF, razón social y domicilio fiscal en Ajustes',
      }
    }

    return canGenerateInvoice(Array.from(selectedPaymentIds), allPayments)
  }, [selectedPlayerId, selectedPaymentIds, allPayments, club])

  const handleTogglePayment = (paymentId: string) => {
    setSelectedPaymentIds((prev) => {
      const next = new Set(prev)
      if (next.has(paymentId)) {
        next.delete(paymentId)
      } else {
        next.add(paymentId)
      }
      return next
    })
    setError('')
  }

  const handleToggleAll = () => {
    if (selectedPaymentIds.size === availablePayments.length) {
      setSelectedPaymentIds(new Set())
    } else {
      setSelectedPaymentIds(new Set(availablePayments.map((p) => p.id)))
    }
    setError('')
  }

  const handleSubmit = async () => {
    setError('')

    if (!validationResult.canInvoice) {
      setError(validationResult.reason || 'No se puede generar la factura')
      return
    }

    const player = players.find((p) => p.id === selectedPlayerId)
    if (!player || !club) {
      setError('Datos incompletos')
      return
    }

    setIsSubmitting(true)

    try {
      const invoiceData = await generateInvoiceFromPayments(
        Array.from(selectedPaymentIds),
        payments,
        eventPayments,
        privateLessonPayments,
        player,
        club,
        selectedSeries,
        { notes }
      )

      await addInvoice(invoiceData)
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Jugadores activos con pagos pendientes de facturar
  const playersWithPayments = useMemo(() => {
    const playerIds = new Set(
      allPayments
        .filter((p) => p.status === 'pagado' && !p.invoiceId)
        .map((p) => p.playerId)
    )
    return players.filter((p) => playerIds.has(p.id))
  }, [players, allPayments])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generar Factura
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Selector de Cliente y Serie */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="player">Cliente *</Label>
              <Select
                id="player"
                value={selectedPlayerId}
                onChange={(e) => {
                  setSelectedPlayerId(e.target.value)
                  setSelectedPaymentIds(new Set())
                  setError('')
                }}
                disabled={!!preSelectedPlayerId}
                options={[
                  { value: '', label: 'Seleccionar cliente...' },
                  ...playersWithPayments.map((player) => ({
                    value: player.id,
                    label: `${player.firstName} ${player.lastName}${player.dni ? ` - ${player.dni}` : ''}`,
                  })),
                ]}
              />
            </div>

            <div>
              <Label htmlFor="series">Serie *</Label>
              <Select
                id="series"
                value={selectedSeries}
                onChange={(e) => setSelectedSeries(e.target.value as InvoiceSeries)}
                options={INVOICE_SERIES.map((s) => ({ value: s.value, label: s.label }))}
              />
            </div>
          </div>

          {/* Tabla de Pagos Disponibles */}
          {selectedPlayerId && (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Pagos a incluir en la factura *</Label>
                  {availablePayments.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleToggleAll}
                    >
                      {selectedPaymentIds.size === availablePayments.length
                        ? 'Deseleccionar todos'
                        : 'Seleccionar todos'}
                    </Button>
                  )}
                </div>

                {availablePayments.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                    No hay pagos disponibles para facturar
                  </div>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 border-b sticky top-0">
                          <tr>
                            <th className="w-12 px-4 py-2">
                              <Checkbox
                                checked={
                                  availablePayments.length > 0 &&
                                  selectedPaymentIds.size === availablePayments.length
                                }
                                onCheckedChange={handleToggleAll}
                              />
                            </th>
                            <th className="text-left px-4 py-2">Concepto</th>
                            <th className="text-left px-4 py-2">Tipo</th>
                            <th className="text-right px-4 py-2">Importe</th>
                            <th className="text-left px-4 py-2">Fecha Pago</th>
                          </tr>
                        </thead>
                        <tbody>
                          {availablePayments.map((payment) => {
                            const isEvent = eventPayments.some((ep) => ep.id === payment.id)
                            const isLesson = privateLessonPayments.some((plp) => plp.id === payment.id)
                            const type = isEvent ? 'Evento' : isLesson ? 'Clase Particular' : 'Cuota'

                            const concept = 'concept' in payment && payment.concept
                              ? payment.concept
                              : isEvent && 'eventName' in payment
                                ? payment.eventName
                                : 'groupName' in payment
                                  ? payment.groupName
                                  : 'Pago'

                            const paidDate = payment.paidDate
                              ? new Date(payment.paidDate).toLocaleDateString('es-ES')
                              : '-'

                            return (
                              <tr
                                key={payment.id}
                                className="border-b hover:bg-muted/30 cursor-pointer"
                                onClick={() => handleTogglePayment(payment.id)}
                              >
                                <td className="px-4 py-2">
                                  <Checkbox
                                    checked={selectedPaymentIds.has(payment.id)}
                                    onCheckedChange={() => handleTogglePayment(payment.id)}
                                  />
                                </td>
                                <td className="px-4 py-2">{concept}</td>
                                <td className="px-4 py-2 text-muted-foreground">{type}</td>
                                <td className="px-4 py-2 text-right font-medium">
                                  {formatCurrency(payment.amount)}
                                </td>
                                <td className="px-4 py-2 text-muted-foreground text-xs">
                                  {paidDate}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Preview de Totales */}
              {selectedPaymentIds.size > 0 && (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <h4 className="font-semibold mb-3">Preview de Factura</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Líneas seleccionadas:</span>
                      <span className="font-medium">{preview.count}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="font-semibold">TOTAL:</span>
                      <span className="font-bold text-lg">
                        {formatCurrency(preview.total)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground pt-2">
                      * El desglose de IVA se calculará al generar la factura según la
                      configuración de cada tipo de pago
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Notas Opcionales */}
          <div>
            <Label htmlFor="notes">Observaciones (opcional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionales para la factura..."
              rows={3}
            />
          </div>

          {/* Mensajes de Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!validationResult.canInvoice || isSubmitting}
          >
            {isSubmitting ? 'Generando...' : 'Generar Factura'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
