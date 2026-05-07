// ==========================================
// Invoices Page
// ==========================================
// Página principal de gestión de facturas

import { useState, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StatCard } from '@/components/shared/StatCard'
import { useDataStore } from '@/stores/dataStore'
import {
  FileText,
  Plus,
  Search,
  Download,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Send,
  FileX,
  TrendingUp,
  DollarSign,
  ClipboardList,
  Receipt,
  RotateCcw,
  MessageCircle,
} from 'lucide-react'
import { formatCurrency, normalizeText } from '@/lib/utils'
import { INVOICE_STATUSES, INVOICE_SERIES } from '@/constants'
import { GenerateInvoiceDialog } from '@/components/invoices/GenerateInvoiceDialog'
import { InvoiceDetailDialog } from '@/components/invoices/InvoiceDetailDialog'
import { generateInvoicePDF } from '@/lib/invoice-pdf'
import { generateCorrectiveInvoice } from '@/lib/invoice-utils'
import { WhatsAppNotificationDialog } from '@/components/shared/WhatsAppNotificationDialog'
import type { WhatsAppPayload } from '@/components/shared/WhatsAppNotificationDialog'
import type { Invoice, InvoiceStatus, InvoiceSeries } from '@/types'
import { useMatchReportsQuery } from '@/hooks/useQueries'


export default function InvoicesPage() {
  const { players, club, updateInvoice, unlinkPaymentsFromInvoice, deleteInvoice, addInvoice, invoices } = useDataStore()


  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [seriesFilter, setSeriesFilter] = useState<string>('')
  const [playerFilter, setPlayerFilter] = useState<string>('')

  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [showDetailDialog, setShowDetailDialog] = useState(false)

  // WhatsApp notification
  const [whatsAppPayload, setWhatsAppPayload] = useState<WhatsAppPayload | null>(null)

  // Filtrar facturas
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Búsqueda por número o nombre de cliente
      if (search) {
        const q = normalizeText(search)
        const matchesNumber = normalizeText(inv.invoiceNumber).includes(q)
        const matchesPlayer = normalizeText(inv.playerName).includes(q)
        if (!matchesNumber && !matchesPlayer) return false
      }

      // Filtro por estado
      if (statusFilter && inv.status !== statusFilter) return false

      // Filtro por serie
      if (seriesFilter && inv.series !== seriesFilter) return false

      // Filtro por jugador
      if (playerFilter && inv.playerId !== playerFilter) return false

      return true
    })
  }, [invoices, search, statusFilter, seriesFilter, playerFilter])

  // KPIs
  const stats = useMemo(() => {
    const totalFacturado = invoices
      .filter((inv) => inv.status !== 'cancelled')
      .reduce((sum, inv) => sum + inv.total, 0)

    const totalCobrado = invoices
      .filter((inv) => inv.status === 'paid')
      .reduce((sum, inv) => sum + inv.total, 0)

    const totalPendiente = invoices
      .filter((inv) => inv.status === 'issued')
      .reduce((sum, inv) => sum + inv.total, 0)

    const facturasEmitidas = invoices.filter(
      (inv) => inv.status !== 'draft' && inv.status !== 'cancelled'
    ).length

    return {
      totalFacturado,
      totalCobrado,
      totalPendiente,
      facturasEmitidas,
    }
  }, [invoices])

  const handleViewDetail = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setShowDetailDialog(true)
  }

  const handleDownloadPDF = (invoice: Invoice) => {
    if (!club) return
    generateInvoicePDF(invoice, club)
  }

  const handleChangeStatus = (invoice: Invoice, newStatus: InvoiceStatus) => {
    updateInvoice(invoice.id, { status: newStatus })
  }

  const handleGenerateCorrective = async (originalInvoice: Invoice) => {
    if (!club) return

    try {
      const correctiveData = await generateCorrectiveInvoice(originalInvoice, club)
      await addInvoice(correctiveData)

      // Cancelar la factura original automáticamente
      updateInvoice(originalInvoice.id, { status: 'cancelled' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido'
      alert(`Error al generar rectificativa: ${message}`)
    }
  }

  const handleCancel = async (invoice: Invoice) => {
    if (invoice.status === 'paid') {
      alert('No se puede cancelar una factura pagada. Genera una rectificativa.')
      return
    }

    if (!confirm('¿Cancelar esta factura? Los pagos se desvinculan automáticamente.')) {
      return
    }

    await unlinkPaymentsFromInvoice(invoice.id)
    updateInvoice(invoice.id, { status: 'cancelled' })
  }

  const handleDelete = (invoice: Invoice) => {
    if (!confirm('¿Eliminar esta factura? Esta acción no se puede deshacer.')) {
      return
    }

    deleteInvoice(invoice.id)
  }

  const formatDate = (date: Date) => {
    const d = date instanceof Date ? date : new Date(date)
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  return (
    <div className="flex flex-col h-screen">
      <Header title="Facturas" subtitle="Gestión de facturación" />

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Facturado"
            value={formatCurrency(stats.totalFacturado)}
            icon={DollarSign}
          />
          <StatCard
            title="Cobrado"
            value={formatCurrency(stats.totalCobrado)}
            icon={CheckCircle2}
          />
          <StatCard
            title="Pendiente"
            value={formatCurrency(stats.totalPendiente)}
            icon={TrendingUp}
          />
          <StatCard
            title="Facturas Emitidas"
            value={stats.facturasEmitidas.toString()}
            icon={ClipboardList}
          />
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Búsqueda */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar por número o cliente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filtro Estado */}
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: '', label: 'Todos los estados' },
                  ...INVOICE_STATUSES.map((status) => ({ value: status.value, label: status.label })),
                ]}
              />

              {/* Filtro Serie */}
              <Select
                value={seriesFilter}
                onChange={(e) => setSeriesFilter(e.target.value)}
                options={[
                  { value: '', label: 'Todas las series' },
                  ...INVOICE_SERIES.map((series) => ({ value: series.value, label: series.label })),
                ]}
              />

              {/* Filtro Jugador */}
              <Select
                value={playerFilter}
                onChange={(e) => setPlayerFilter(e.target.value)}
                options={[
                  { value: '', label: 'Todos los clientes' },
                  ...players.map((player) => ({
                    value: player.id,
                    label: `${player.firstName} ${player.lastName}`,
                  })),
                ]}
              />

              {/* Botón Nueva Factura */}
              <Button onClick={() => setShowGenerateDialog(true)} className="gap-2 shrink-0">
                <Plus className="h-4 w-4" />
                Nueva Factura
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabla de Facturas */}
        <Card>
          <CardContent className="pt-6">
            {filteredInvoices.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No hay facturas</h3>
                <p className="text-muted-foreground mb-4">
                  {search || statusFilter || seriesFilter || playerFilter
                    ? 'No se encontraron facturas con los filtros aplicados'
                    : 'Comienza generando tu primera factura'}
                </p>
                {!search && !statusFilter && !seriesFilter && !playerFilter && (
                  <Button onClick={() => setShowGenerateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Generar Primera Factura
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold">Número</th>
                      <th className="text-left px-4 py-3 font-semibold">Fecha</th>
                      <th className="text-left px-4 py-3 font-semibold">Cliente</th>
                      <th className="text-center px-4 py-3 font-semibold">Serie</th>
                      <th className="text-right px-4 py-3 font-semibold">Base</th>
                      <th className="text-right px-4 py-3 font-semibold">IVA</th>
                      <th className="text-right px-4 py-3 font-semibold">Total</th>
                      <th className="text-center px-4 py-3 font-semibold">Estado</th>
                      <th className="text-center px-4 py-3 font-semibold w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((invoice) => {
                      const statusConfig = INVOICE_STATUSES.find((s) => s.value === invoice.status)

                      const canIssue = invoice.status === 'draft'
                      const canMarkPaid = invoice.status === 'issued'
                      const canRevertPaid = invoice.status === 'paid'
                      const canCancel = invoice.status === 'draft' || invoice.status === 'issued'
                      const canDelete = invoice.status === 'draft'
                      const canGenerateCorrective = invoice.status === 'issued' || invoice.status === 'paid'

                      return (
                        <tr
                          key={invoice.id}
                          className="border-b hover:bg-muted/50 cursor-pointer"
                          onClick={() => handleViewDetail(invoice)}
                        >
                          <td className="px-4 py-3 font-medium">{invoice.invoiceNumber}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDate(invoice.invoiceDate)}
                          </td>
                          <td className="px-4 py-3">{invoice.playerName}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
                              {invoice.series}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">{formatCurrency(invoice.subtotal)}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">
                            {formatCurrency(invoice.totalVat)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">
                            {formatCurrency(invoice.total)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge className={statusConfig?.color}>
                              {statusConfig?.label || invoice.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewDetail(invoice)}>
                                  <FileText className="h-4 w-4 mr-2" />
                                  Ver detalle
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDownloadPDF(invoice)}>
                                  <Download className="h-4 w-4 mr-2" />
                                  Descargar PDF
                                </DropdownMenuItem>
                                {canIssue && (
                                  <DropdownMenuItem onClick={() => handleChangeStatus(invoice, 'issued')}>
                                    <Send className="h-4 w-4 mr-2" />
                                    Emitir
                                  </DropdownMenuItem>
                                )}
                                {canMarkPaid && (
                                  <DropdownMenuItem onClick={() => handleChangeStatus(invoice, 'paid')}>
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Marcar pagada
                                  </DropdownMenuItem>
                                )}
                                {(canMarkPaid || canRevertPaid) && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      const player = players.find((p) => p.id === invoice.playerId)
                                      const phone = player?.phone ?? player?.guardian?.phone ?? ''
                                      const clubName = club?.name ?? 'Club de Padel San Javier'
                                      const msg = `Hola ${invoice.playerName}, te informamos que la factura ${invoice.invoiceNumber} de ${clubName} por importe de ${formatCurrency(invoice.total)} está pendiente de pago. Puedes contactarnos para cualquier consulta. ¡Gracias!`
                                      setWhatsAppPayload({ phone, message: msg, recipientName: invoice.playerName })
                                    }}
                                  >
                                    <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
                                    Avisar por WhatsApp
                                  </DropdownMenuItem>
                                )}
                                {canRevertPaid && (
                                  <DropdownMenuItem onClick={() => handleChangeStatus(invoice, 'issued')}>
                                    <RotateCcw className="h-4 w-4 mr-2" />
                                    Deshacer (Marcar pendiente)
                                  </DropdownMenuItem>
                                )}
                                {canGenerateCorrective && (
                                  <DropdownMenuItem onClick={() => handleGenerateCorrective(invoice)}>
                                    <FileX className="h-4 w-4 mr-2" />
                                    Generar rectificativa
                                  </DropdownMenuItem>
                                )}
                                {canCancel && (
                                  <DropdownMenuItem onClick={() => handleCancel(invoice)}>
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Cancelar
                                  </DropdownMenuItem>
                                )}
                                {canDelete && (
                                  <DropdownMenuItem onClick={() => handleDelete(invoice)} className="text-destructive">
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Eliminar
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <GenerateInvoiceDialog
        open={showGenerateDialog}
        onOpenChange={setShowGenerateDialog}
      />

      <InvoiceDetailDialog
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        invoice={selectedInvoice}
        onGenerateCorrective={handleGenerateCorrective}
      />

      {/* WhatsApp Notification Dialog */}
      <WhatsAppNotificationDialog
        open={!!whatsAppPayload}
        onOpenChange={(open) => { if (!open) setWhatsAppPayload(null) }}
        payload={whatsAppPayload}
      />
    </div>
  )
}
