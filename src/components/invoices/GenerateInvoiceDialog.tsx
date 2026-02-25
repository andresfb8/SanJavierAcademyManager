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
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/shared/SearchableSelect'
import { AlertCircle, FileText } from 'lucide-react'
import { useDataStore } from '@/stores/dataStore'
import { INVOICE_SERIES } from '@/constants'
import { formatCurrency, generateId } from '@/lib/utils'
import { generateInvoiceFromPayments, generateManualInvoice, canGenerateInvoice } from '@/lib/invoice-utils'
import type { InvoiceSeries, Payment, EventPayment, PrivateLessonPayment, VatRate, InvoiceLineItem } from '@/types'

interface GenerateInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preSelectedPaymentIds?: string[]
  preSelectedPlayerId?: string
}

type AnyPayment = Payment | EventPayment | PrivateLessonPayment

const EMPTY_PAYMENTS_ARRAY: string[] = []

export function GenerateInvoiceDialog({
  open,
  onOpenChange,
  preSelectedPaymentIds = EMPTY_PAYMENTS_ARRAY,
  preSelectedPlayerId,
}: GenerateInvoiceDialogProps) {
  const { players, payments, eventPayments, privateLessonPayments, club, addInvoice } = useDataStore()

  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(preSelectedPlayerId || '')
  const [selectedSeries, setSelectedSeries] = useState<InvoiceSeries>('FC')
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<string>>(
    new Set(preSelectedPaymentIds)
  )
  const [notes, setNotes] = useState('')
  const [invoiceStatus, setInvoiceStatus] = useState<'issued' | 'paid'>('issued')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [isManualClient, setIsManualClient] = useState(false)
  const [manualClient, setManualClient] = useState({
    nif: '',
    name: '',
    address: '',
    postalCode: '',
    city: '',
  })
  const [manualLineItems, setManualLineItems] = useState<Array<{
    id: string
    description: string
    quantity: number
    unitPrice: number
    vatRate: VatRate
  }>>([{
    id: generateId(),
    description: '',
    quantity: 1,
    unitPrice: 0,
    vatRate: 0
  }])

  // Reset form cuando se abre el diálogo
  useEffect(() => {
    if (open) {
      setSelectedPlayerId(preSelectedPlayerId || '')
      setSelectedSeries('FC')
      setSelectedPaymentIds(new Set(preSelectedPaymentIds))
      setNotes('')
      setInvoiceStatus('issued')
      setError('')
      setIsSubmitting(false)
      setIsManualClient(false)
      setManualClient({ nif: '', name: '', address: '', postalCode: '', city: '' })
      setManualLineItems([{
        id: generateId(),
        description: '',
        quantity: 1,
        unitPrice: 0,
        vatRate: 0
      }])
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
    // Si hay líneas manuales con contenido, calcular desde ahí
    const hasManualItems = manualLineItems.length > 0 && manualLineItems.some(item => item.description.trim())

    if (isManualClient || (selectedPlayerId && selectedPaymentIds.size === 0 && hasManualItems)) {
      let subtotal = 0
      let totalVat = 0
      const vatBreakdown: Record<number, { base: number; amount: number }> = {}

      manualLineItems.forEach(item => {
        const lineSubtotal = item.quantity * item.unitPrice
        const lineVat = lineSubtotal * (item.vatRate / 100)

        subtotal += lineSubtotal
        totalVat += lineVat

        if (!vatBreakdown[item.vatRate]) {
          vatBreakdown[item.vatRate] = { base: 0, amount: 0 }
        }
        vatBreakdown[item.vatRate].base += lineSubtotal
        vatBreakdown[item.vatRate].amount += lineVat
      })

      return {
        subtotal: Math.round(subtotal * 100) / 100,
        totalVat: Math.round(totalVat * 100) / 100,
        total: Math.round((subtotal + totalVat) * 100) / 100,
        vatBreakdown,
        count: manualLineItems.length
      }
    }

    // Si hay pagos seleccionados, calcular desde pagos (código existente)
    if (selectedPaymentIds.size === 0) {
      return { subtotal: 0, totalVat: 0, total: 0, vatBreakdown: {}, count: 0 }
    }

    const selectedPayments = allPayments.filter((p) => selectedPaymentIds.has(p.id))
    const total = selectedPayments.reduce((sum, p) => sum + p.amount, 0)

    return {
      subtotal: total,
      totalVat: 0,
      total,
      vatBreakdown: {},
      count: selectedPayments.length,
    }
  }, [isManualClient, selectedPlayerId, availablePayments, manualLineItems, selectedPaymentIds, allPayments])

  // Validación
  const validationResult = useMemo(() => {
    if (isManualClient) {
      // Validar cliente manual
      if (!manualClient.nif || !manualClient.name || !manualClient.address ||
        !manualClient.postalCode || !manualClient.city) {
        return { canInvoice: false, reason: 'Complete todos los datos del cliente' }
      }

      // Validar líneas
      if (manualLineItems.length === 0 || manualLineItems.every(item => !item.description.trim())) {
        return { canInvoice: false, reason: 'Debe agregar al menos una línea con concepto' }
      }

      if (manualLineItems.some(item => item.unitPrice <= 0)) {
        return { canInvoice: false, reason: 'Todas las líneas deben tener un precio mayor a 0' }
      }
    } else {
      // Validación existente para jugadores registrados
      if (!selectedPlayerId) {
        return { canInvoice: false, reason: 'Debe seleccionar un cliente' }
      }

      if (selectedPaymentIds.size === 0) {
        if (manualLineItems.length === 0 || manualLineItems.every(item => !item.description.trim())) {
          return { canInvoice: false, reason: 'Debe agregar líneas de factura manuales o seleccionar pagos existentes' }
        }

        if (manualLineItems.some(item => item.unitPrice <= 0)) {
          return { canInvoice: false, reason: 'Todas las líneas deben tener un precio mayor a 0' }
        }
      }
    }

    if (!club?.nif || !club?.legalName || !club?.fiscalAddress) {
      return {
        canInvoice: false,
        reason: 'El club debe tener configurados NIF, razón social y domicilio fiscal en Ajustes',
      }
    }

    if (!isManualClient && selectedPaymentIds.size > 0) {
      return canGenerateInvoice(Array.from(selectedPaymentIds), allPayments)
    }

    return { canInvoice: true, reason: '' }
  }, [isManualClient, manualClient, selectedPlayerId, availablePayments, selectedPaymentIds, manualLineItems, club, allPayments])

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

    if (!club) {
      setError('Datos del club incompletos')
      return
    }

    setIsSubmitting(true)

    try {
      let invoiceData
      let newPayments: Payment[] | undefined = undefined

      const hasManualItems = manualLineItems.length > 0 && manualLineItems.some(item => item.description.trim())

      if (isManualClient || (selectedPlayerId && hasManualItems && selectedPaymentIds.size === 0)) {
        // Crear factura con líneas manuales
        const player = isManualClient
          ? {
            id: 'manual-' + Date.now(),
            firstName: manualClient.name.split(' ')[0] || manualClient.name,
            lastName: manualClient.name.split(' ').slice(1).join(' ') || '',
            dni: manualClient.nif,
            address: manualClient.address,
            postalCode: manualClient.postalCode,
            city: manualClient.city,
          }
          : players.find((p) => p.id === selectedPlayerId)

        if (!player) {
          setError('Cliente no encontrado')
          setIsSubmitting(false)
          return
        }

        // Crear line items desde manualLineItems
        const lineItems: InvoiceLineItem[] = manualLineItems
          .filter(item => item.description.trim()) // Solo incluir líneas con descripción
          .map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatRate: item.vatRate,
            subtotal: item.quantity * item.unitPrice,
            vatAmount: (item.quantity * item.unitPrice) * (item.vatRate / 100),
            total: (item.quantity * item.unitPrice) * (1 + item.vatRate / 100),
            paymentId: undefined,
            paymentType: undefined
          }))

        invoiceData = await generateManualInvoice(
          lineItems,
          player as any,
          club,
          selectedSeries,
          { notes, status: invoiceStatus }
        )

        // Crear Payment en background para contabilidad
        const now = new Date()
        const firstDescription = lineItems[0]?.description || 'Factura libre'
        newPayments = [{
          id: generateId(),
          playerId: player.id,
          playerName: `${player.firstName} ${player.lastName}`,
          concept: lineItems.length > 1 ? `Varios conceptos (incl. ${firstDescription})` : firstDescription,
          category: 'manual',
          amount: invoiceData.total,
          status: invoiceStatus === 'paid' ? 'pagado' : 'pendiente',
          billingMonth: now.getMonth() + 1,
          billingYear: now.getFullYear(),
          dueDate: new Date(now),
          paidDate: invoiceStatus === 'paid' ? new Date(now) : undefined,
          autogenerated: false,
          createdAt: now
        }]
      } else {
        // Flujo existente para facturas desde pagos
        const player = players.find((p) => p.id === selectedPlayerId)
        if (!player) {
          setError('Jugador no encontrado')
          setIsSubmitting(false)
          return
        }

        invoiceData = await generateInvoiceFromPayments(
          Array.from(selectedPaymentIds),
          payments,
          eventPayments,
          privateLessonPayments,
          player,
          club,
          selectedSeries,
          { notes, status: invoiceStatus }
        )
      }

      await addInvoice(invoiceData, newPayments)
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Todos los jugadores activos (para permitir facturas manuales a cualquier jugador)
  const allActivePlayers = useMemo(() => {
    return players.filter((p) => p.status === 'activo')
  }, [players])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generar Factura
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Toggle: Cliente Registrado vs Cliente Puntual */}
          <div className="flex items-center gap-4 mb-4">
            <Label>Tipo de cliente:</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={!isManualClient ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setIsManualClient(false)
                  setManualClient({ nif: '', name: '', address: '', postalCode: '', city: '' })
                  setError('')
                }}
              >
                Cliente registrado
              </Button>
              <Button
                type="button"
                variant={isManualClient ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setIsManualClient(true)
                  setSelectedPlayerId('')
                  setSelectedPaymentIds(new Set())
                  setError('')
                }}
              >
                Cliente puntual
              </Button>
            </div>
          </div>

          {!isManualClient ? (
            <>
              {/* Selector de Cliente y Serie - Modo Registrado */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="player">Cliente *</Label>
                  <SearchableSelect
                    options={allActivePlayers.map((player) => ({
                      value: player.id,
                      label: `${player.lastName}, ${player.firstName}${player.dni ? ` - ${player.dni}` : ''}`,
                    }))}
                    value={selectedPlayerId}
                    onChange={(value) => {
                      setSelectedPlayerId(value)
                      setSelectedPaymentIds(new Set())
                      setError('')
                    }}
                    disabled={!!preSelectedPlayerId}
                    placeholder="Seleccionar cliente..."
                    searchPlaceholder="Buscar por nombre, apellido o DNI..."
                    emptyMessage="No se encontraron clientes"
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
            </>
          ) : (
            <>
              {/* Formulario de Cliente Manual */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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

                <div className="border rounded-lg p-4 space-y-4">
                  <h4 className="font-semibold text-sm">Datos del cliente</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="manual-nif">NIF/CIF *</Label>
                      <Input
                        id="manual-nif"
                        value={manualClient.nif}
                        onChange={(e) => setManualClient({ ...manualClient, nif: e.target.value })}
                        placeholder="12345678A"
                      />
                    </div>
                    <div>
                      <Label htmlFor="manual-name">Nombre completo / Razón social *</Label>
                      <Input
                        id="manual-name"
                        value={manualClient.name}
                        onChange={(e) => setManualClient({ ...manualClient, name: e.target.value })}
                        placeholder="Juan Pérez / Empresa SL"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="manual-address">Dirección *</Label>
                      <Input
                        id="manual-address"
                        value={manualClient.address}
                        onChange={(e) => setManualClient({ ...manualClient, address: e.target.value })}
                        placeholder="Calle Principal 123"
                      />
                    </div>
                    <div>
                      <Label htmlFor="manual-postal">Código postal *</Label>
                      <Input
                        id="manual-postal"
                        value={manualClient.postalCode}
                        onChange={(e) => setManualClient({ ...manualClient, postalCode: e.target.value })}
                        placeholder="30730"
                      />
                    </div>
                    <div>
                      <Label htmlFor="manual-city">Ciudad *</Label>
                      <Input
                        id="manual-city"
                        value={manualClient.city}
                        onChange={(e) => setManualClient({ ...manualClient, city: e.target.value })}
                        placeholder="San Javier"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Líneas Manuales de Factura */}
          {(isManualClient || (selectedPlayerId && selectedPaymentIds.size === 0)) && (
            <div className="space-y-4 border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Líneas de factura</h4>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setManualLineItems([...manualLineItems, {
                      id: generateId(),
                      description: '',
                      quantity: 1,
                      unitPrice: 0,
                      vatRate: 0
                    }])
                  }}
                >
                  + Agregar línea
                </Button>
              </div>

              {manualLineItems.map((item, index) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Label htmlFor={`desc-${item.id}`}>Concepto *</Label>
                    <Input
                      id={`desc-${item.id}`}
                      value={item.description}
                      onChange={(e) => {
                        const newItems = [...manualLineItems]
                        newItems[index].description = e.target.value
                        setManualLineItems(newItems)
                      }}
                      placeholder="Ej: Clase de pádel"
                    />
                  </div>

                  <div className="col-span-2">
                    <Label htmlFor={`qty-${item.id}`}>Cant.</Label>
                    <Input
                      id={`qty-${item.id}`}
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => {
                        const newItems = [...manualLineItems]
                        newItems[index].quantity = parseInt(e.target.value) || 1
                        setManualLineItems(newItems)
                      }}
                    />
                  </div>

                  <div className="col-span-2">
                    <Label htmlFor={`price-${item.id}`}>Precio</Label>
                    <Input
                      id={`price-${item.id}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => {
                        const newItems = [...manualLineItems]
                        newItems[index].unitPrice = parseFloat(e.target.value) || 0
                        setManualLineItems(newItems)
                      }}
                    />
                  </div>

                  <div className="col-span-2">
                    <Label htmlFor={`vat-${item.id}`}>IVA %</Label>
                    <Select
                      id={`vat-${item.id}`}
                      value={item.vatRate.toString()}
                      onChange={(e) => {
                        const newItems = [...manualLineItems]
                        newItems[index].vatRate = parseInt(e.target.value) as VatRate
                        setManualLineItems(newItems)
                      }}
                      options={[
                        { value: '0', label: '0%' },
                        { value: '10', label: '10%' },
                        { value: '21', label: '21%' }
                      ]}
                    />
                  </div>

                  <div className="col-span-1 flex justify-center">
                    {manualLineItems.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setManualLineItems(manualLineItems.filter((_, i) => i !== index))
                        }}
                      >
                        🗑️
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {/* Preview de líneas manuales */}
              {preview.total > 0 && (
                <div className="rounded-lg border bg-muted/30 p-4 mt-4">
                  <h4 className="font-semibold mb-3">Preview de Factura</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal (base):</span>
                      <span className="font-medium">{formatCurrency(preview.subtotal)}</span>
                    </div>
                    {Object.entries(preview.vatBreakdown).map(([rate, data]) => (
                      <div key={rate} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">IVA {rate}%:</span>
                        <span>{formatCurrency(data.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-2 border-t">
                      <span className="font-semibold">TOTAL:</span>
                      <span className="font-bold text-lg">
                        {formatCurrency(preview.total)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tabla de Pagos Disponibles */}
          {!isManualClient && selectedPlayerId && (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Pagos a incluir en la factura</Label>
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

          {/* Opciones de la factura */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status">Estado de la factura</Label>
              <Select
                id="status"
                value={invoiceStatus}
                onChange={(e) => setInvoiceStatus(e.target.value as 'issued' | 'paid')}
                options={[
                  { value: 'issued', label: 'Emitida (Pendiente de cobro)' },
                  { value: 'paid', label: 'Pagada (Cobrada)' },
                ]}
              />
            </div>
            <div>
              <Label htmlFor="notes">Observaciones (opcional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas adicionales para la factura..."
                rows={2}
              />
            </div>
          </div>

          {/* Mensajes de Error de Validación o Sumisión */}
          {(error || (!validationResult.canInvoice && validationResult.reason)) && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>{error || validationResult.reason}</p>
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
