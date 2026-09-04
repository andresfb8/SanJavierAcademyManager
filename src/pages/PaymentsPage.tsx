import { useState, useMemo, useEffect } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { StatCard } from '@/components/shared/StatCard'
import { GenerateInvoiceDialog } from '@/components/invoices/GenerateInvoiceDialog'
import { AddManualPaymentDialog } from '@/components/payments/AddManualPaymentDialog'
import { useDataStore } from '@/stores/dataStore'
import { toast } from '@/hooks/use-toast'
import {
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Search,
  FileText,
  CreditCard,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  BarChart3,
  TableIcon,
  Plus,
  Receipt,
  RotateCcw,
  Trash2,
  Pencil,
  MessageCircle,
  UploadCloud,
} from 'lucide-react'
import { formatCurrency, formatDate, normalizeText } from '@/lib/utils'
import { normalizeAllPayments } from '@/lib/payment-utils'
import { paymentsKpis } from '@/lib/finance-analytics'
import { prepareSepaPayments, generateSepaXml } from '@/lib/sepa-utils'
import type { SepaClubConfig } from '@/lib/sepa-utils'
import { PAYMENT_METHODS, PAYMENT_CATEGORIES, MONTHS } from '@/constants'
import type { PaymentMethod } from '@/types'
import type { NormalizedPayment } from '@/lib/payment-utils'
import { WhatsAppNotificationDialog } from '@/components/shared/WhatsAppNotificationDialog'
import type { WhatsAppPayload } from '@/components/shared/WhatsAppNotificationDialog'
import type { FinanzasOutletContext } from '@/components/layout/FinanzasLayout'
import { WhatsAppCSVDialog } from '@/components/shared/WhatsAppCSVDialog'
import { SepaImportDialog } from '@/components/financials/SepaImportDialog'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { downloadXlsxAoa } from '@/lib/excel'
import { useAttendanceQuery } from '@/hooks/useQueries'


type ViewMode = 'mensual' | 'anual' | 'morosidad'

// --- Annual summary row type ---
interface AnnualSummaryRow {
  month: number
  monthLabel: string
  ingresos: number
  pendiente: number
  tasaCobro: number
  recibos: number
}

// --- Sortable column header helper ---
function SortableHeader({
  column,
  children,
}: {
  column: { getIsSorted: () => false | 'asc' | 'desc'; toggleSorting: (desc?: boolean) => void }
  children: React.ReactNode
}) {
  const sorted = column.getIsSorted()
  return (
    <button
      type="button"
      className="flex items-center gap-1 hover:text-foreground transition-colors -ml-2 px-2 py-1 rounded"
      onClick={() => column.toggleSorting(sorted === 'asc')}
    >
      {children}
      {sorted === 'asc' ? (
        <ArrowUp className="h-3.5 w-3.5" />
      ) : sorted === 'desc' ? (
        <ArrowDown className="h-3.5 w-3.5" />
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
      )}
    </button>
  )
}

export default function PaymentsPage() {
  const {
    groups,
    seasons,
    players,
    club, 
    markPaymentPaid, 
    markEventPaymentPaid, 
    markPrivateLessonPaymentPaid, 
    revertPaymentPaidStatus,
    updatePayment,
    deletePayment,
    deleteEventPayment, 
    deletePrivateLessonPayment, 
    generateMonthlyReceipts, 
    addManualPayment, 
    bulkGenerateInvoices,
    payments: allBasePayments,
    eventPayments,
    privateLessonPayments,
    invoices,
    events
  } = useDataStore()

  const { setPrimaryAction } = useOutletContext<FinanzasOutletContext>()

  const payments = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return allBasePayments.filter(p => p.billingYear === currentYear || p.billingYear === currentYear - 1)
  }, [allBasePayments])

  const allPendingPayments = useMemo(
    () => normalizeAllPayments(
      allBasePayments.filter(p => p.status === 'pendiente'),
      eventPayments.filter(p => p.status === 'pendiente'),
      privateLessonPayments.filter(p => p.status === 'pendiente'),
      events
    ),
    [allBasePayments, eventPayments, privateLessonPayments, events]
  )


  const now = new Date()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [groupFilter, setGroupFilter] = useState<string>('')
  const [seasonFilter, setSeasonFilter] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear())
  const [viewMode, setViewMode] = useState<ViewMode>('mensual')

  // Mark as paid dialog
  const [paymentToMark, setPaymentToMark] = useState<NormalizedPayment | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('transferencia')

  // Edit payment dialog
  const [paymentToEdit, setPaymentToEdit] = useState<NormalizedPayment | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editConcept, setEditConcept] = useState('')

  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [methodFilter, setMethodFilter] = useState<string>('')

  // Manual payment dialog
  const [manualDialogOpen, setManualDialogOpen] = useState(false)

  useEffect(() => {
    setPrimaryAction({ label: 'Registrar cobro', icon: Plus, onClick: () => setManualDialogOpen(true) })
    return () => setPrimaryAction(null)
  }, [setPrimaryAction])

  const [searchParams] = useSearchParams()

  useEffect(() => {
    const estado = searchParams.get('estado')
    if (estado === 'vencido') setStatusFilter('vencido')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // TanStack Table sorting state
  const [sorting, setSorting] = useState<SortingState>([])

  // Invoice generation
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<string>>(new Set())
  const [showGenerateInvoiceDialog, setShowGenerateInvoiceDialog] = useState(false)

  // WhatsApp notification
  const [whatsAppPayloads, setWhatsAppPayloads] = useState<WhatsAppPayload[]>([])
  const [whatsappCSVOpen, setWhatsappCSVOpen] = useState(false)
  const [sepaImportOpen, setSepaImportOpen] = useState(false)

  // Generate available years (current year +/- 2)
  const availableYears = useMemo(() => {
    const currentYear = now.getFullYear()
    return [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Group options for filter
  const groupOptions = useMemo(() => {
    return groups
      .filter((g) => g.isActive)
      .map((g) => ({ value: g.id, label: g.name }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [groups])

  // Unificar todos los pagos para KPIs globales y tabla principal
  const allPayments = useMemo(
    () => normalizeAllPayments(payments, eventPayments, privateLessonPayments ?? [], events),
    [payments, eventPayments, privateLessonPayments, events]
  )

  // Filtered payments (para vista mensual — incluye los 3 origenes de pago)
  const filteredPayments = useMemo(() => {
    return allPayments.filter((p) => {
      const q = normalizeText(search)
      const matchesSearch =
        search === '' ||
        normalizeText(p.playerName).includes(q) ||
        normalizeText(p.concept).includes(q)
      const matchesStatus =
        statusFilter === ''
          ? true
          : statusFilter === 'vencido'
            ? p.status === 'pendiente' && !!p.dueDate && new Date(p.dueDate) < now
            : p.status === statusFilter
      const matchesGroup = groupFilter === '' || p.groupId === groupFilter
      const matchesCategory = categoryFilter === '' || p.source === categoryFilter
      const matchesMethod = methodFilter === '' || p.paymentMethod === methodFilter
      const matchesMonth = p.billingMonth === selectedMonth
      const matchesYear = p.billingYear === selectedYear
      const matchesSeason =
        seasonFilter === '' ||
        groups.find((g) => g.id === p.groupId)?.seasonId === seasonFilter
      return matchesSearch && matchesStatus && matchesGroup && matchesCategory && matchesMethod && matchesMonth && matchesYear && matchesSeason
    })
  }, [allPayments, search, statusFilter, groupFilter, categoryFilter, methodFilter, selectedMonth, selectedYear, seasonFilter, groups])

  // KPI calculations for current selected month (usando TODOS los origenes)
  const currentMonthAllPayments = useMemo(() => {
    return allPayments.filter(
      (p) => p.billingMonth === selectedMonth && p.billingYear === selectedYear
    )
  }, [allPayments, selectedMonth, selectedYear])

  const monthKeys = useMemo(() => new Set([`${selectedYear}-${selectedMonth}`]), [selectedYear, selectedMonth])

  const kpis = useMemo(
    () => paymentsKpis(currentMonthAllPayments, monthKeys, now),
    [currentMonthAllPayments, monthKeys]
  )

  const devueltosDelMes = useMemo(() => {
    return allBasePayments.filter(
      (p) =>
        p.category === 'otro' &&
        p.concept === 'Recargo por devolución SEPA' &&
        p.billingMonth === selectedMonth &&
        p.billingYear === selectedYear
    )
  }, [allBasePayments, selectedMonth, selectedYear])

  const devueltosAmount = devueltosDelMes.reduce((sum, p) => sum + Number(p.amount || 0), 0)

  // --- Annual summary data (usando TODOS los origenes) ---
  const annualSummary = useMemo<AnnualSummaryRow[]>(() => {
    return MONTHS.map((m) => {
      const monthPayments = allPayments.filter(
        (p) => p.billingMonth === m.value && p.billingYear === selectedYear
      )
      const ingresos = monthPayments
        .filter((p) => p.status === 'pagado')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0)
      const pendiente = monthPayments
        .filter((p) => p.status === 'pendiente')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0)
      const total = monthPayments.length
      const pagados = monthPayments.filter((p) => p.status === 'pagado').length
      const tasa = total > 0 ? Math.round((pagados / total) * 100) : 0

      return {
        month: m.value,
        monthLabel: m.label,
        ingresos,
        pendiente,
        tasaCobro: tasa,
        recibos: total,
      }
    })
  }, [allPayments, selectedYear])

  const annualTotals = useMemo(() => {
    const totalIngresos = annualSummary.reduce((sum, r) => sum + Number(r.ingresos || 0), 0)
    const totalPendiente = annualSummary.reduce((sum, r) => sum + Number(r.pendiente || 0), 0)
    const totalRecibos = annualSummary.reduce((sum, r) => sum + Number(r.recibos || 0), 0)
    const totalPagados = annualSummary.reduce((sum, r) => {
      const monthPayments = allPayments.filter(
        (p) => p.billingMonth === r.month && p.billingYear === selectedYear && p.status === 'pagado'
      )
      return sum + monthPayments.length
    }, 0)
    const tasaCobroAnual = totalRecibos > 0 ? Math.round((totalPagados / totalRecibos) * 100) : 0

    return { totalIngresos, totalPendiente, tasaCobroAnual, totalRecibos }
  }, [annualSummary, allPayments, selectedYear])

  // --- Morosidad group data ---
  const pendingByPlayer = useMemo(() => {
    const grouped = pendingPaymentsMap(allPendingPayments)
    return Object.values(grouped).sort((a, b) => b.totalDebt - a.totalDebt)
  }, [allPendingPayments])

  function pendingPaymentsMap(payments: NormalizedPayment[]) {
    const map: Record<string, {
      playerId: string
      playerName: string
      totalDebt: number
      receiptCount: number
      oldestMonth: number
      oldestYear: number
    }> = {}
    
    payments.forEach(p => {
      if (!map[p.playerId]) {
        map[p.playerId] = {
          playerId: p.playerId,
          playerName: p.playerName,
          totalDebt: 0,
          receiptCount: 0,
          oldestMonth: p.billingMonth,
          oldestYear: p.billingYear
        }
      }
      map[p.playerId].totalDebt += p.amount
      map[p.playerId].receiptCount += 1
      
      const pDate = new Date(p.billingYear, p.billingMonth - 1)
      const cDate = new Date(map[p.playerId].oldestYear, map[p.playerId].oldestMonth - 1)
      if (pDate < cDate) {
        map[p.playerId].oldestMonth = p.billingMonth
        map[p.playerId].oldestYear = p.billingYear
      }
    })
    
    return map
  }

  // --- Selection handlers ---
  const handleBulkGenerateInvoices = () => {
    // Buscamos todos los pagos cobrados que NO tengan factura, independientemente del mes seleccionado
    const toInvoice = allPayments.filter(p => p.status === 'pagado' && !p.invoiceId)
    
    if (toInvoice.length === 0) {
      toast.info('No hay cobros pendientes de facturar')
      return
    }

    if (window.confirm(`¿Deseas generar facturas para ${toInvoice.length} cobros pendientes de facturar (agrupados por jugador)?`)) {
      bulkGenerateInvoices(toInvoice.map(p => p.id))
    }
  }

  const handleBulkMarkPaid = () => {
    const targets = selectedPayments.filter((p) => p.status === 'pendiente')
    if (targets.length === 0) return
    if (!window.confirm(`¿Marcar como cobrados ${targets.length} recibo${targets.length === 1 ? '' : 's'} por transferencia?`)) return

    targets.forEach((payment) => {
      if (payment.source === 'evento') {
        markEventPaymentPaid(payment.id, 'transferencia')
      } else if (payment.source === 'clase_particular') {
        markPrivateLessonPaymentPaid(payment.id, 'transferencia')
      } else {
        markPaymentPaid(payment.id, 'transferencia')
      }
    })
    setSelectedPaymentIds(new Set())
  }

  const handleBulkRemind = () => {
    const targets = selectedPayments.filter((p) => p.status === 'pendiente')
    const payloads: WhatsAppPayload[] = targets
      .map((payment) => {
        const player = players.find((pl) => pl.id === payment.playerId)
        const phone = player?.phone ?? player?.guardian?.phone ?? ''
        if (!phone) return null
        return {
          phone,
          message: getWhatsAppReminderMessage(payment.playerId, payment.playerName),
          recipientName: payment.playerName,
        }
      })
      .filter((p): p is WhatsAppPayload => p !== null)

    if (payloads.length === 0) return
    setWhatsAppPayloads(payloads)
  }

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
  }

  const handleToggleAll = () => {
    // Cualquier fila visible es seleccionable
    if (selectedPaymentIds.size === filteredPayments.length) {
      setSelectedPaymentIds(new Set())
    } else {
      setSelectedPaymentIds(new Set(filteredPayments.map((p) => p.id)))
    }
  }

  const selectableCount = filteredPayments.length

  const selectedPayments = useMemo(
    () => filteredPayments.filter((p) => selectedPaymentIds.has(p.id)),
    [filteredPayments, selectedPaymentIds]
  )

  const canMarkPaid = selectedPayments.some((p) => p.status === 'pendiente')

  const canRemind = selectedPayments.some(
    (p) => p.status === 'pendiente' && !!(players.find((pl) => pl.id === p.playerId)?.phone ?? players.find((pl) => pl.id === p.playerId)?.guardian?.phone)
  )

  const canInvoice = selectedPayments.some((p) => p.status === 'pagado' && !p.invoiceId)

  // --- TanStack React Table columns ---
  const columns = useMemo<ColumnDef<NormalizedPayment>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <Checkbox
            checked={selectableCount > 0 && selectedPaymentIds.size === selectableCount}
            onCheckedChange={handleToggleAll}
            aria-label="Seleccionar todos"
          />
        ),
        cell: ({ row }) => {
          const payment = row.original
          return (
            <Checkbox
              checked={selectedPaymentIds.has(payment.id)}
              onCheckedChange={() => handleTogglePayment(payment.id)}
              aria-label="Seleccionar pago"
            />
          )
        },
        enableSorting: false,
        meta: { className: 'w-12' },
      },
      {
        accessorKey: 'playerName',
        header: ({ column }) => <SortableHeader column={column}>Jugador</SortableHeader>,
        cell: ({ getValue }) => (
          <span className="font-medium text-sm">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'concept',
        header: ({ column }) => <SortableHeader column={column}>Concepto</SortableHeader>,
        cell: ({ getValue }) => <span className="text-sm">{getValue<string>()}</span>,
      },
      {
        accessorKey: 'groupName',
        header: ({ column }) => <SortableHeader column={column}>Grupo</SortableHeader>,
        cell: ({ getValue }) => (
          <span className="text-sm text-muted-foreground">{getValue<string>() || '--'}</span>
        ),
        meta: { className: 'hidden md:table-cell' },
      },
      {
        accessorKey: 'source',
        header: 'Categoria',
        cell: ({ getValue }) => {
          const src = getValue<NormalizedPayment['source']>() ?? 'cuota'
          const info = PAYMENT_CATEGORIES.find((c) => c.value === src)
          return <span className="text-xs text-muted-foreground">{info?.label ?? src}</span>
        },
        enableSorting: false,
        meta: { className: 'hidden lg:table-cell' },
      },
      {
        accessorKey: 'amount',
        header: ({ column }) => (
          <div className="text-right">
            <SortableHeader column={column}>Importe</SortableHeader>
          </div>
        ),
        cell: ({ getValue }) => (
          <span className="font-semibold text-sm">{formatCurrency(getValue<number>())}</span>
        ),
        meta: { className: 'text-right' },
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <SortableHeader column={column}>Estado</SortableHeader>,
        cell: ({ row }) => {
          const payment = row.original
          const displayStatus =
            payment.status === 'pendiente' && payment.dueDate && new Date(payment.dueDate) < now
              ? 'vencido'
              : payment.status
          return <StatusBadge status={displayStatus} />
        },
      },
      {
        accessorKey: 'dueDate',
        header: ({ column }) => <SortableHeader column={column}>Vencimiento</SortableHeader>,
        cell: ({ getValue }) => {
          const val = getValue<Date | undefined>()
          return (
            <span className="text-sm text-muted-foreground">
              {val ? formatDate(new Date(val)) : '-'}
            </span>
          )
        },
        meta: { className: 'hidden lg:table-cell' },
      },
      {
        accessorKey: 'paidDate',
        header: ({ column }) => <SortableHeader column={column}>Fecha pago</SortableHeader>,
        cell: ({ getValue }) => {
          const val = getValue<Date | undefined>()
          return (
            <span className="text-sm text-muted-foreground">
              {val ? formatDate(new Date(val)) : '-'}
            </span>
          )
        },
        meta: { className: 'hidden lg:table-cell' },
      },
      {
        accessorKey: 'paymentMethod',
        header: 'Metodo',
        cell: ({ getValue }) => {
          const method = getValue<PaymentMethod | undefined>()
          return (
            <span className="text-sm text-muted-foreground">
              {method
                ? PAYMENT_METHODS.find((m) => m.value === method)?.label || method
                : '-'}
            </span>
          )
        },
        enableSorting: false,
        meta: { className: 'hidden md:table-cell' },
      },
      {
        accessorKey: 'registeredBy',
        header: 'Registrado por',
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground">
            {getValue<string | undefined>() ?? '-'}
          </span>
        ),
        enableSorting: false,
        meta: { className: 'hidden xl:table-cell' },
      },
      {
        accessorKey: 'invoiceId',
        header: 'Factura',
        cell: ({ row }) => {
          const payment = row.original
          if (!payment.invoiceId) return <span className="text-xs text-muted-foreground">-</span>

          // Buscar el número de factura
          const invoice = invoices.find((inv) => inv.id === payment.invoiceId)
          if (!invoice) return <span className="text-xs text-muted-foreground">-</span>

          return (
            <Link
              to="/finanzas/facturas"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <Receipt className="h-3 w-3" />
              {invoice.invoiceNumber}
            </Link>
          )
        },
        enableSorting: false,
        meta: { className: 'hidden md:table-cell' },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Acciones</span>,
        cell: ({ row }) => {
          const payment = row.original
          if (payment.status === 'pendiente') {
            const player = players.find((p) => p.id === payment.playerId)
            const monthLabel = MONTHS.find((m) => m.value === payment.billingMonth)?.label ?? payment.billingMonth

            return (
              <div className="flex items-center gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                  title="Avisar por WhatsApp"
                  onClick={() => {
                    const phone = player?.phone ?? player?.guardian?.phone ?? ''
                    const msg = getWhatsAppReminderMessage(payment.playerId, payment.playerName)
                    setWhatsAppPayloads([{ phone, message: msg, recipientName: payment.playerName }])
                  }}
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openMarkPaidDialog(payment)}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Marcar pagado
                </Button>
                {payment.source !== 'evento' && payment.source !== 'clase_particular' && !payment.invoiceId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEditPaymentDialog(payment)}
                    title="Editar importe/concepto"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleDeletePayment(payment)}
                  title="Eliminar recibo"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )
          } else if (payment.status === 'pagado') {
            return (
              <div className="flex items-center gap-2 justify-end">
                {payment.source !== 'evento' && payment.source !== 'clase_particular' && !payment.invoiceId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEditPaymentDialog(payment)}
                    title="Editar importe/concepto"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRevertPaidStatus(payment)}
                  title="Deshacer pago y marcar como pendiente"
                >
                  <RotateCcw className="h-4 w-4 md:mr-1" />
                  <span className="hidden md:inline">Deshacer</span>
                </Button>
              </div>
            )
          }
          return null
        },
        meta: { className: 'text-right' },
        enableSorting: false,
      },
    ],
    [invoices, selectedPaymentIds, selectableCount]
  )

  const table = useReactTable({
    data: filteredPayments,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  // --- Handlers ---
  const openMarkPaidDialog = (payment: NormalizedPayment) => {
    setPaymentToMark(payment)
    setSelectedMethod('transferencia')
  }

  const handleMarkPaid = () => {
    if (!paymentToMark) return
    const { id, source } = paymentToMark
    if (source === 'evento') {
      markEventPaymentPaid(id, selectedMethod)
    } else if (source === 'clase_particular') {
      markPrivateLessonPaymentPaid(id, selectedMethod)
    } else {
      markPaymentPaid(id, selectedMethod)
    }
    setPaymentToMark(null)
    setSelectedMethod('transferencia')
  }

  const handleRevertPaidStatus = (payment: NormalizedPayment) => {
    if (window.confirm(`¿Estás seguro de deshacer el cobro de ${formatCurrency(payment.amount)} por ${payment.concept}? Volverá a estar pendiente y podrás borrarlo o editarlo si corresponde.`)) {
      revertPaymentPaidStatus(payment.id, payment.source ?? 'cuota')
    }
  }

  const handleDeletePayment = (payment: NormalizedPayment) => {
    if (window.confirm(`¿Estás seguro de eliminar el recibo de ${formatCurrency(payment.amount)} por ${payment.concept}? Esta acción no se puede deshacer.`)) {
      if (payment.source === 'evento') {
        deleteEventPayment(payment.id)
      } else if (payment.source === 'clase_particular') {
        deletePrivateLessonPayment(payment.id)
      } else {
        deletePayment(payment.id)
      }
    }
  }

  const openEditPaymentDialog = (payment: NormalizedPayment) => {
    setPaymentToEdit(payment)
    setEditAmount(String(payment.amount))
    setEditConcept(payment.concept)
  }

  const handleSaveEditPayment = () => {
    if (!paymentToEdit) return
    const amount = parseFloat(editAmount)
    if (isNaN(amount) || amount <= 0 || !editConcept.trim()) return
    updatePayment(paymentToEdit.id, { amount, concept: editConcept.trim() })
    setPaymentToEdit(null)
  }

  const handleGenerateReceipts = async () => {
    try {
      const count = await generateMonthlyReceipts(selectedMonth, selectedYear)
      if (count > 0) {
        alert(
          `Se han generado ${count} recibos para ${MONTHS.find((m) => m.value === selectedMonth)?.label} ${selectedYear}.`
        )
      } else {
        alert(
          'No se han generado nuevos recibos. Puede que ya existan recibos para este mes o no haya inscripciones activas.'
        )
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido'
      alert(`Error al generar recibos: ${message}`)
    }
  }

  const handleExportXLSX = () => {
    if (viewMode === 'anual') {
      const wsData = [
        ['Mes', 'Ingresos', 'Pendiente', 'Tasa cobro (%)', 'Recibos'],
        ...annualSummary.map((r) => [
          r.monthLabel,
          r.ingresos,
          r.pendiente,
          r.tasaCobro,
          r.recibos,
        ]),
        [
          'TOTAL',
          annualTotals.totalIngresos,
          annualTotals.totalPendiente,
          annualTotals.tasaCobroAnual,
          annualTotals.totalRecibos,
        ],
      ]
      downloadXlsxAoa(wsData, 'Resumen Anual', `pagos_anual_${selectedYear}.xlsx`)
    } else if (viewMode === 'morosidad') {
      const wsData = [
        ['Jugador', 'Deuda Total', 'Recibos', 'Mes mas antiguo'],
        ...pendingByPlayer.map((r) => [
          r.playerName,
          r.totalDebt,
          r.receiptCount,
          r.oldestMonth ? `${MONTHS.find(m => m.value === r.oldestMonth)?.label} ${r.oldestYear}` : '-'
        ]),
        ['TOTAL', pendingByPlayer.reduce((s, r) => s + r.totalDebt, 0), pendingByPlayer.reduce((s, r) => s + r.receiptCount, 0), '']
      ]
      downloadXlsxAoa(wsData, 'Morosidad', `morosidad_${selectedMonth}_${selectedYear}.xlsx`)
    } else {
      const wsData = [
        ['Jugador', 'Concepto', 'Grupo', 'Categoria', 'Importe', 'Estado', 'Vencimiento', 'Fecha pago', 'Metodo', 'Registrado por'],
        ...filteredPayments.map((p) => [
          p.playerName,
          p.concept,
          p.groupName || '',
          PAYMENT_CATEGORIES.find((c) => c.value === p.source)?.label ?? p.source,
          p.amount,
          p.status === 'pagado' ? 'Pagado' : p.status === 'pendiente' ? 'Pendiente' : 'Cancelado',
          p.dueDate ? formatDate(new Date(p.dueDate)) : '',
          p.paidDate ? formatDate(new Date(p.paidDate)) : '',
          p.paymentMethod
            ? PAYMENT_METHODS.find((m) => m.value === p.paymentMethod)?.label || p.paymentMethod
            : '',
          p.registeredBy ?? '',
        ]),
      ]
      downloadXlsxAoa(wsData, 'Pagos', `pagos_${selectedMonth}_${selectedYear}.xlsx`)
    }
  }

  const handleExportSepaXML = () => {
    // Verificar configuración SEPA del club
    if (!club?.iban || !club?.creditorId) {
      alert('Por favor configura el IBAN y el Creditor ID SEPA en Configuración antes de exportar')
      return
    }

    // Filtrar pagos pendientes del mes actual (de los pagos originales, no normalizados)
    const monthlyPayments = payments.filter(
      (p) => p.billingMonth === selectedMonth && p.billingYear === selectedYear && p.status === 'pendiente'
    )

    if (monthlyPayments.length === 0) {
      alert('No hay pagos pendientes para exportar este mes')
      return
    }

    // Preparar configuración SEPA
    const sepaConfig: SepaClubConfig = {
      iban: club.iban,
      bic: club.bic,
      creditorId: club.creditorId,
    }

    try {
      // Preparar datos SEPA
      const sepaData = prepareSepaPayments(monthlyPayments, players, club, sepaConfig)

      if (sepaData.payments.length === 0) {
        alert('No hay pagos con IBAN válido para domiciliar')
        return
      }

      // Generar XML SEPA
      const xml = generateSepaXml(sepaData)

      // Descargar archivo
      const blob = new Blob([xml], { type: 'application/xml' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sepa_${selectedMonth}_${selectedYear}.xml`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      alert(`Archivo SEPA generado: ${sepaData.payments.length} recibos`)
    } catch (error) {
      console.error('Error al generar SEPA XML:', error)
      alert('Error al generar archivo SEPA: ' + (error instanceof Error ? error.message : 'Error desconocido'))
    }
  }

  const handleProcessConciliation = (paidIds: string[], returned: { paymentId: string; penaltyAmount: number }[]) => {
    // 1. Mark paid
    paidIds.forEach(id => {
      // Find the payment to know if it's event or regular
      const payment = allPendingPayments.find(p => p.id === id)
      if (!payment) return

      if (payment.source === 'evento') {
        markEventPaymentPaid(id, 'domiciliacion')
      } else if (payment.source === 'clase_particular') {
        markPrivateLessonPaymentPaid(id, 'domiciliacion')
      } else {
        markPaymentPaid(id, 'domiciliacion')
      }
    })
    
    // 2. Process returned
    returned.forEach(r => {
      const originalPayment = allPendingPayments.find(p => p.id === r.paymentId)
      if (!originalPayment) return
      
      // Add penalty
      if (r.penaltyAmount > 0) {
        addManualPayment({
          playerId: originalPayment.playerId,
          playerName: originalPayment.playerName,
          concept: 'Recargo por devolución SEPA',
          amount: r.penaltyAmount,
          category: 'otro',
          notes: `Recargo asociado al recibo: ${originalPayment.concept}`
        })
      }
    })
    
    alert(`Conciliación completada:\n- ${paidIds.length} recibos cobrados\n- ${returned.length} devoluciones procesadas con recargo.`)
  }

  // --- Chart data for annual view ---
  const chartData = useMemo(() => {
    return annualSummary.map((r) => ({
      name: r.monthLabel.substring(0, 3),
      Ingresos: r.ingresos,
      Pendiente: r.pendiente,
    }))
  }, [annualSummary])

  const getWhatsAppReminderMessage = (playerId: string, playerName: string) => {
    const playerPending = allPendingPayments.filter(p => p.playerId === playerId)
    const clubName = club?.name ?? 'Club de Padel San Javier'
    
    if (playerPending.length === 0) return ''

    let totalDebt = 0
    let message = `Hola ${playerName}, te recordamos desde ${clubName} que tienes los siguientes recibos pendientes:\n\n`
    
    playerPending.forEach(p => {
      const monthLabel = MONTHS.find((m) => m.value === p.billingMonth)?.label ?? p.billingMonth
      message += `- ${monthLabel} ${p.billingYear}: ${formatCurrency(p.amount)} (${p.concept})\n`
      totalDebt += p.amount
    })

    message += `\n*Total pendiente: ${formatCurrency(totalDebt)}*\n\nPor favor, realiza el pago cuando puedas. ¡Gracias!`
    return message
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 px-6 pt-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExportXLSX}>
            <Download className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Exportar XLSX</span>
          </Button>
          {viewMode === 'mensual' && (
            <>
              <Button variant="outline" size="sm" onClick={handleExportSepaXML} title="Exportar XML para domiciliación SEPA">
                <Download className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">XML SEPA</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSepaImportOpen(true)} title="Importar respuestas del banco para conciliar" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                <UploadCloud className="h-4 w-4 md:mr-1" />
                <span className="hidden md:inline">Conciliar SEPA</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWhatsappCSVOpen(true)}
                title="Envío masivo WhatsApp CSV"
                className="gap-1 border-green-300 text-green-700 hover:bg-green-50"
              >
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline">WhatsApp CSV</span>
              </Button>
              {selectedPaymentIds.size > 0 && (
                <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-2 py-1">
                  <span className="text-xs text-muted-foreground px-1">{selectedPaymentIds.size} seleccionados</span>
                  {canMarkPaid && (
                    <Button variant="outline" size="sm" onClick={handleBulkMarkPaid} className="gap-1">
                      <CheckCircle className="h-4 w-4" />
                      <span className="hidden sm:inline">Marcar como cobrado</span>
                    </Button>
                  )}
                  {canRemind && (
                    <Button variant="outline" size="sm" onClick={handleBulkRemind} className="gap-1 text-green-700 border-green-300 hover:bg-green-50">
                      <MessageCircle className="h-4 w-4" />
                      <span className="hidden sm:inline">Enviar recordatorio</span>
                    </Button>
                  )}
                  {canInvoice && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setShowGenerateInvoiceDialog(true)}
                      className="gap-1"
                    >
                      <Receipt className="h-4 w-4" />
                      <span className="hidden sm:inline">Emitir factura</span>
                    </Button>
                  )}
                </div>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkGenerateInvoices}
                title="Generar facturas de todos los cobros que aún no tienen factura"
                className="gap-1 border-primary/20 hover:border-primary/40 text-primary"
              >
                <Receipt className="h-4 w-4" />
                <span className="hidden sm:inline">Facturar Pendientes</span>
              </Button>
              <Button size="sm" onClick={handleGenerateReceipts} title="Generar recibos de cuotas mensuales">
                <FileText className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Generar cuotas</span>
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI Cards - only in monthly view */}
        {viewMode === 'mensual' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Cobrado"
              value={formatCurrency(kpis.paidAmount)}
              icon={DollarSign}
              iconClassName="bg-green-100 text-green-700"
            />
            <StatCard
              title="Pendiente"
              value={formatCurrency(kpis.pendingAmount)}
              icon={FileText}
              iconClassName="bg-blue-100 text-blue-700"
            />
            <StatCard
              title="Vencido"
              value={formatCurrency(kpis.overdueAmount)}
              icon={AlertCircle}
              iconClassName="bg-red-100 text-red-700"
            />
            <StatCard
              title="Devueltos"
              value={devueltosDelMes.length}
              description={devueltosDelMes.length > 0 ? formatCurrency(devueltosAmount) : undefined}
              icon={RotateCcw}
              iconClassName="bg-amber-100 text-amber-700"
            />
          </div>
        )}

        {/* Annual KPI Cards */}
        {viewMode === 'anual' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Ingresos anuales"
              value={formatCurrency(annualTotals.totalIngresos)}
              icon={DollarSign}
              iconClassName="bg-green-100 text-green-700"
            />
            <StatCard
              title="Pendiente anual"
              value={formatCurrency(annualTotals.totalPendiente)}
              icon={AlertCircle}
              iconClassName="bg-yellow-100 text-yellow-700"
            />
            <StatCard
              title="Tasa de cobro anual"
              value={`${annualTotals.tasaCobroAnual}%`}
              icon={TrendingUp}
              iconClassName="bg-blue-100 text-blue-700"
            />
            <StatCard
              title="Total recibos anuales"
              value={annualTotals.totalRecibos}
              icon={FileText}
              iconClassName="bg-purple-100 text-purple-700"
            />
          </div>
        )}

        {/* Filters + View Toggle */}
        <div className="flex flex-col gap-3">
          {/* View mode toggle + Year selector (always visible) */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            {/* Mensual / Anual toggle */}
            <div className="inline-flex rounded-lg border border-input p-1 bg-muted/30">
              <button
                type="button"
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === 'mensual'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
                onClick={() => setViewMode('mensual')}
              >
                <TableIcon className="h-4 w-4" />
                Mensual
              </button>
              <button
                type="button"
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === 'anual'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
                onClick={() => setViewMode('anual')}
              >
                <BarChart3 className="h-4 w-4" />
                Anual
              </button>
              <button
                type="button"
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === 'morosidad'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
                onClick={() => setViewMode('morosidad')}
              >
                <AlertCircle className="h-4 w-4" />
                Morosidad
              </button>
            </div>

            {/* Year selector (always shown) */}
            <Select
              options={availableYears.map((y) => ({ value: String(y), label: String(y) }))}
              value={String(selectedYear)}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full sm:w-32"
            />

            {/* Month selector only in monthly view */}
            {viewMode === 'mensual' && (
              <Select
                options={MONTHS.map((m) => ({ value: String(m.value), label: m.label }))}
                value={String(selectedMonth)}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full sm:w-40"
              />
            )}
          </div>

          {/* Monthly view filters */}
          {viewMode === 'mensual' && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
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
                    { value: 'pendiente', label: 'Pendiente' },
                    { value: 'vencido', label: 'Vencido' },
                    { value: 'pagado', label: 'Pagado' },
                    { value: 'cancelado', label: 'Cancelado' },
                  ]}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full sm:w-48"
                />
                <Select
                  options={[
                    { value: '', label: 'Todos los metodos' },
                    ...PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label })),
                  ]}
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className="w-full sm:w-48"
                />
                <Select
                  options={[
                    { value: '', label: 'Todos los grupos' },
                    ...groupOptions,
                  ]}
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                  className="w-full sm:w-48"
                />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center flex-wrap gap-3 pt-1 text-muted-foreground">
                <Select
                  options={[
                    { value: '', label: 'Todas las categorias' },
                    ...PAYMENT_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
                  ]}
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="h-8 w-full text-xs sm:w-44"
                />
                <Select
                  options={[
                    { value: '', label: 'Todas las temporadas' },
                    ...seasons.map((s) => ({ value: s.id, label: s.name })),
                  ]}
                  value={seasonFilter}
                  onChange={(e) => setSeasonFilter(e.target.value)}
                  className="h-8 w-full text-xs sm:w-44"
                />
              </div>
            </div>
          )}
        </div>

        {/* ========== MONTHLY VIEW ========== */}
        {viewMode === 'mensual' && (
          <>
            {filteredPayments.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-1">No hay recibos</h3>
                  <p className="text-sm text-muted-foreground">
                    No se encontraron recibos para los filtros seleccionados. Prueba a generar
                    recibos para este mes.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id} className="bg-muted/50">
                          {headerGroup.headers.map((header) => {
                            const meta = header.column.columnDef.meta as
                              | { className?: string }
                              | undefined
                            return (
                              <TableHead
                                key={header.id}
                                className={meta?.className}
                              >
                                {header.isPlaceholder
                                  ? null
                                  : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )}
                              </TableHead>
                            )
                          })}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {table.getRowModel().rows.map((row) => (
                        <TableRow key={row.id}>
                          {row.getVisibleCells().map((cell) => {
                            const meta = cell.column.columnDef.meta as
                              | { className?: string }
                              | undefined
                            return (
                              <TableCell key={cell.id} className={meta?.className}>
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ========== ANNUAL VIEW ========== */}
        {viewMode === 'anual' && (
          <div className="space-y-6">
            {/* Bar chart */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-base font-semibold mb-4">Ingresos mensuales {selectedYear}</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 12 }} />
                      <YAxis
                        className="text-xs"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v: number) => `${v}€`}
                      />
                      <Tooltip
                        formatter={(value, name) => [
                          formatCurrency(Number(value) || 0),
                          String(name),
                        ]}
                        labelFormatter={(label) => {
                          const labelStr = String(label)
                          const found = MONTHS.find((m) => m.label.substring(0, 3) === labelStr)
                          return found ? found.label : labelStr
                        }}
                        contentStyle={{
                          borderRadius: '8px',
                          border: '1px solid hsl(var(--border))',
                          backgroundColor: 'hsl(var(--background))',
                        }}
                      />
                      <Bar dataKey="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Pendiente" fill="#eab308" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Annual summary table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Mes</TableHead>
                      <TableHead className="text-right">Ingresos</TableHead>
                      <TableHead className="text-right">Pendiente</TableHead>
                      <TableHead className="text-right">Tasa cobro</TableHead>
                      <TableHead className="text-right">Recibos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {annualSummary.map((row) => (
                      <TableRow key={row.month}>
                        <TableCell>
                          <span className="font-medium text-sm">{row.monthLabel}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm font-semibold text-success">
                            {formatCurrency(row.ingresos)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm font-medium text-amber-600">
                            {formatCurrency(row.pendiente)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm">{row.tasaCobro}%</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm">{row.recibos}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals row */}
                    <TableRow className="bg-muted/30 font-semibold">
                      <TableCell>
                        <span className="font-bold text-sm">TOTAL</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-bold text-success">
                          {formatCurrency(annualTotals.totalIngresos)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-bold text-amber-600">
                          {formatCurrency(annualTotals.totalPendiente)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-bold">{annualTotals.tasaCobroAnual}%</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-bold">{annualTotals.totalRecibos}</span>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ========== MOROSIDAD VIEW ========== */}
        {viewMode === 'morosidad' && (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Jugador</TableHead>
                      <TableHead className="text-right">Recibos</TableHead>
                      <TableHead className="text-right">Mes más antiguo</TableHead>
                      <TableHead className="text-right">Deuda Total</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingByPlayer.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                          No hay alumnos con deudas en el sistema.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendingByPlayer.map((row) => (
                        <TableRow key={row.playerId}>
                          <TableCell>
                            <span className="font-medium text-sm">{row.playerName}</span>
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {row.receiptCount}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {MONTHS.find(m => m.value === row.oldestMonth)?.label} {row.oldestYear}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-[15px] font-extrabold text-destructive tracking-tight">
                              {formatCurrency(row.totalDebt)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                              title="Avisar por WhatsApp"
                              onClick={() => {
                                const player = players.find(p => p.id === row.playerId)
                                const phone = player?.phone ?? player?.guardian?.phone ?? ''
                                const msg = getWhatsAppReminderMessage(row.playerId, row.playerName)
                                setWhatsAppPayloads([{ phone, message: msg, recipientName: row.playerName }])
                              }}
                            >
                              <MessageCircle className="h-4 w-4 mr-2" />
                              Avisar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
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
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Importe</span>
                  <span className="text-lg font-black text-success">
                    {formatCurrency(paymentToMark.amount)}
                  </span>
                </div>
              </div>

              {/* Payment method */}
              <div className="space-y-2">
                <Label>Metodo de pago</Label>
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

      {/* Edit Payment Dialog */}
      <Dialog open={!!paymentToEdit} onOpenChange={(open) => { if (!open) setPaymentToEdit(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar recibo</DialogTitle>
          </DialogHeader>

          {paymentToEdit && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Jugador</span>
                  <span className="font-medium">{paymentToEdit.playerName}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Concepto</Label>
                <Input value={editConcept} onChange={(e) => setEditConcept(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Importe (€)</Label>
                <Input
                  type="number" min={0} step={0.01}
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentToEdit(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEditPayment} disabled={!editConcept.trim() || isNaN(parseFloat(editAmount)) || parseFloat(editAmount) <= 0}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Payment Dialog */}
      <AddManualPaymentDialog open={manualDialogOpen} onOpenChange={setManualDialogOpen} />

      {/* Generate Invoice Dialog */}
      <GenerateInvoiceDialog
        open={showGenerateInvoiceDialog}
        onOpenChange={(open) => {
          setShowGenerateInvoiceDialog(open)
          if (!open) setSelectedPaymentIds(new Set()) // Limpiar selección al cerrar
        }}
        preSelectedPaymentIds={Array.from(selectedPaymentIds)}
      />

      {/* WhatsApp Notification Dialog */}
      <WhatsAppNotificationDialog
        open={whatsAppPayloads.length > 0}
        onOpenChange={(open) => { if (!open) setWhatsAppPayloads([]) }}
        payloads={whatsAppPayloads}
      />

      {/* WhatsApp CSV Dialog */}
      <WhatsAppCSVDialog
        open={whatsappCSVOpen}
        onOpenChange={setWhatsappCSVOpen}
      />

      {/* SEPA Conciliation Dialog */}
      <SepaImportDialog
        open={sepaImportOpen}
        onOpenChange={setSepaImportOpen}
        pendingPayments={payments.filter(p => p.status === 'pendiente' && p.billingMonth === selectedMonth && p.billingYear === selectedYear)}
        players={players}
        onProcessConciliation={handleProcessConciliation}
      />
    </div>
  )
}
