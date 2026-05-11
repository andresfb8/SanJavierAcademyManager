// ==========================================
// Invoice Detail Dialog
// ==========================================
// Diálogo de vista detallada de factura con opciones de descarga PDF y gestión

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  FileText,
  Download,
  MoreVertical,
  CheckCircle2,
  XCircle,
  FileX,
  Send,
} from 'lucide-react'
import { useDataStore } from '@/stores/dataStore'
import { INVOICE_STATUSES } from '@/constants'
import { formatCurrency } from '@/lib/utils'
import { generateInvoicePDF } from '@/lib/invoice-pdf'
import type { Invoice, InvoiceStatus } from '@/types'

interface InvoiceDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: Invoice | null
  onGenerateCorrective?: (invoice: Invoice) => void
}

export function InvoiceDetailDialog({
  open,
  onOpenChange,
  invoice,
  onGenerateCorrective,
}: InvoiceDetailDialogProps) {
  const { club, updateInvoice, unlinkPaymentsFromInvoice, deleteInvoice } = useDataStore()
  const [isProcessing, setIsProcessing] = useState(false)

  if (!invoice) return null

  const statusConfig = INVOICE_STATUSES.find((s) => s.value === invoice.status)

  const formatDate = (date: Date) => {
    const d = date instanceof Date ? date : new Date(date)
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const handleDownloadPDF = async () => {
    if (!club) return
    await generateInvoicePDF(invoice, club)
  }

  const handleChangeStatus = async (newStatus: InvoiceStatus) => {
    setIsProcessing(true)
    try {
      updateInvoice(invoice.id, { status: newStatus })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleGenerateCorrective = () => {
    if (onGenerateCorrective) {
      onGenerateCorrective(invoice)
      onOpenChange(false)
    }
  }

  const handleCancel = async () => {
    if (invoice.status === 'paid') {
      alert('No se puede cancelar una factura pagada. Genera una rectificativa.')
      return
    }

    if (!confirm('¿Cancelar esta factura? Los pagos se desvinculan automáticamente.')) {
      return
    }

    setIsProcessing(true)
    try {
      await unlinkPaymentsFromInvoice(invoice.id)
      updateInvoice(invoice.id, { status: 'cancelled' })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('¿Eliminar esta factura? Esta acción no se puede deshacer.')) {
      return
    }

    setIsProcessing(true)
    try {
      deleteInvoice(invoice.id)
      onOpenChange(false)
    } finally {
      setIsProcessing(false)
    }
  }

  const canIssue = invoice.status === 'draft'
  const canMarkPaid = invoice.status === 'issued'
  const canCancel = invoice.status === 'draft' || invoice.status === 'issued'
  const canDelete = invoice.status === 'draft'
  const canGenerateCorrective = invoice.status === 'issued' || invoice.status === 'paid'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Factura {invoice.invoiceNumber}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {invoice.series === 'FC' ? 'Factura Corriente' : 'Factura Rectificativa'}
              </p>
            </div>
            <Badge className={statusConfig?.color}>
              {statusConfig?.label || invoice.status}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Fechas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Fecha de Emisión</p>
              <p className="text-sm">{formatDate(invoice.invoiceDate)}</p>
            </div>
            {invoice.dueDate && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Fecha de Vencimiento</p>
                <p className="text-sm">{formatDate(invoice.dueDate)}</p>
              </div>
            )}
          </div>

          {/* Cliente */}
          <div>
            <h4 className="font-semibold mb-2">Cliente</h4>
            <div className="rounded-lg border p-3 space-y-1 text-sm">
              <p className="font-medium">{invoice.playerName}</p>
              {invoice.customerNif && <p className="text-muted-foreground">NIF/DNI: {invoice.customerNif}</p>}
              {invoice.customerAddress && (
                <p className="text-muted-foreground">{invoice.customerAddress}</p>
              )}
              {invoice.customerEmail && (
                <p className="text-muted-foreground">Email: {invoice.customerEmail}</p>
              )}
              {invoice.customerPhone && (
                <p className="text-muted-foreground">Tel: {invoice.customerPhone}</p>
              )}
            </div>
          </div>

          {/* Líneas de Factura */}
          <div>
            <h4 className="font-semibold mb-2">Líneas de Factura</h4>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-3 py-2">Descripción</th>
                    <th className="text-center px-3 py-2">Cant.</th>
                    <th className="text-right px-3 py-2">P. Unit.</th>
                    <th className="text-center px-3 py-2">IVA %</th>
                    <th className="text-right px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lineItems.map((item, index) => (
                    <tr key={index} className="border-b last:border-b-0">
                      <td className="px-3 py-2">{item.description}</td>
                      <td className="px-3 py-2 text-center">{item.quantity}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-3 py-2 text-center">{item.vatRate}%</td>
                      <td className="px-3 py-2 text-right font-medium">
                        {formatCurrency(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Desglose de IVA */}
          {Object.keys(invoice.vatBreakdown).length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Desglose de IVA</h4>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2">Tipo IVA</th>
                      <th className="text-right px-3 py-2">Base Imponible</th>
                      <th className="text-right px-3 py-2">Cuota IVA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(invoice.vatBreakdown).map(([rate, { base, vat }]) => (
                      <tr key={rate} className="border-b last:border-b-0">
                        <td className="px-3 py-2">{rate}%</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(base)}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(vat)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Totales */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base Imponible:</span>
                <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total IVA:</span>
                <span className="font-medium">{formatCurrency(invoice.totalVat)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="font-bold">TOTAL:</span>
                <span className="font-bold text-lg">
                  {formatCurrency(invoice.total)}
                </span>
              </div>
            </div>
          </div>

          {/* Notas */}
          {invoice.notes && (
            <div>
              <h4 className="font-semibold mb-2">Observaciones</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap rounded-lg border p-3">
                {invoice.notes}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2 flex-1">
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadPDF}
              disabled={isProcessing}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Descargar PDF
            </Button>

            {/* Menú de acciones */}
            {invoice.status !== 'cancelled' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={isProcessing}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {canIssue && (
                    <DropdownMenuItem onClick={() => handleChangeStatus('issued')}>
                      <Send className="h-4 w-4 mr-2" />
                      Emitir
                    </DropdownMenuItem>
                  )}
                  {canMarkPaid && (
                    <DropdownMenuItem onClick={() => handleChangeStatus('paid')}>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Marcar como pagada
                    </DropdownMenuItem>
                  )}
                  {canGenerateCorrective && (
                    <DropdownMenuItem onClick={handleGenerateCorrective}>
                      <FileX className="h-4 w-4 mr-2" />
                      Generar rectificativa
                    </DropdownMenuItem>
                  )}
                  {canCancel && (
                    <DropdownMenuItem onClick={handleCancel}>
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancelar factura
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                    <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                      <XCircle className="h-4 w-4 mr-2" />
                      Eliminar
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
