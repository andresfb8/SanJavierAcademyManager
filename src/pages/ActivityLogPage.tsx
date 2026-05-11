import { useState, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/shared/EmptyState'
import { useDataStore } from '@/stores/dataStore'
import { formatDate, normalizeText } from '@/lib/utils'
import { History, Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { MONTHS } from '@/constants'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import type { Activity, ActivityType } from '@/types'

// --- Labels legibles para cada tipo de actividad ---
const ACTIVITY_LABELS: Record<ActivityType, string> = {
  player_created: 'Jugador registrado',
  player_updated: 'Jugador actualizado',
  player_deleted: 'Jugador eliminado',
  player_cancelled: 'Jugador dado de baja',
  payment_received: 'Pago recibido',
  payment_created: 'Pago creado',
  payment_cancelled: 'Pago cancelado',
  group_created: 'Grupo creado',
  group_updated: 'Grupo actualizado',
  group_deleted: 'Grupo eliminado',
  coach_created: 'Entrenador añadido',
  coach_updated: 'Entrenador actualizado',
  coach_deleted: 'Entrenador eliminado',
  enrollment_created: 'Inscripción creada',
  enrollment_deleted: 'Inscripción eliminada',
  attendance_recorded: 'Asistencia registrada',
  recovery_used: 'Recuperación usada',
  evaluation_created: 'Evaluación creada',
  evaluation_updated: 'Evaluación actualizada',
  evaluation_deleted: 'Evaluación eliminada',
  event_created: 'Evento creado',
  event_updated: 'Evento actualizado',
  event_deleted: 'Evento eliminado',
  lesson_created: 'Clase particular creada',
  lesson_updated: 'Clase particular actualizada',
  lesson_deleted: 'Clase particular eliminada',
  match_report_created: 'Informe creado',
  match_report_updated: 'Informe actualizado',
  match_report_deleted: 'Informe eliminado',
  invitation_sent: 'Invitación enviada',
  invoice_created: 'Factura generada',
  invoice_issued: 'Factura emitida',
  invoice_paid: 'Factura pagada',
  invoice_cancelled: 'Factura cancelada',
  system_action: 'Accion del sistema',
}

// --- Colores por tipo de actividad ---
const ACTIVITY_COLORS: Partial<Record<ActivityType, string>> = {
  payment_received: 'text-green-700',
  payment_created: 'text-blue-700',
  payment_cancelled: 'text-red-600',
  player_cancelled: 'text-red-600',
  player_created: 'text-green-700',
  player_updated: 'text-blue-700',
  player_deleted: 'text-red-600',
  group_created: 'text-indigo-700',
  group_updated: 'text-indigo-500',
  group_deleted: 'text-red-600',
  coach_created: 'text-sky-700',
  coach_updated: 'text-sky-500',
  coach_deleted: 'text-red-600',
  enrollment_created: 'text-violet-700',
  enrollment_deleted: 'text-red-600',
  event_created: 'text-teal-700',
  event_updated: 'text-teal-600',
  event_deleted: 'text-red-600',
  lesson_created: 'text-amber-700',
  lesson_updated: 'text-amber-600',
  lesson_deleted: 'text-red-600',
  evaluation_created: 'text-indigo-700',
  evaluation_deleted: 'text-red-600',
  match_report_created: 'text-indigo-700',
  match_report_deleted: 'text-red-600',
  invoice_created: 'text-green-700',
  invoice_issued: 'text-blue-700',
  invoice_paid: 'text-green-700',
  invoice_cancelled: 'text-red-600',
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

export default function ActivityLogPage() {
  // Las actividades ya están cargadas en el store via real-time sync
  // No necesitamos una query separada (que requeriría un índice Firestore adicional)
  const { activities } = useDataStore()

  const now = new Date()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [selectedMonth, setSelectedMonth] = useState<number>(0) // 0 = todos los meses
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear())
  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }])

  const availableYears = useMemo(() => {
    const currentYear = now.getFullYear()
    return [currentYear - 2, currentYear - 1, currentYear, currentYear + 1]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const typeOptions = useMemo(() =>
    Object.entries(ACTIVITY_LABELS).map(([value, label]) => ({ value, label })),
    []
  )

  const filteredActivities = useMemo(() => {
    return activities.filter((a) => {
      const d = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt)
      const matchesYear = d.getFullYear() === selectedYear
      const matchesMonth = selectedMonth === 0 || d.getMonth() + 1 === selectedMonth
      const matchesType = typeFilter === '' || a.type === typeFilter
      const displayUser = a.userName ?? a.userId
      const q = normalizeText(search)
      const matchesSearch =
        search === '' ||
        normalizeText(a.description).includes(q) ||
        normalizeText(displayUser).includes(q)
      return matchesYear && matchesMonth && matchesType && matchesSearch
    })
  }, [activities, search, typeFilter, selectedMonth, selectedYear])

  const columns = useMemo<ColumnDef<Activity>[]>(
    () => [
      {
        accessorKey: 'createdAt',
        header: ({ column }) => <SortableHeader column={column}>Fecha</SortableHeader>,
        cell: ({ getValue }) => {
          const val = getValue<Date>()
          const d = val instanceof Date ? val : new Date(val)
          return (
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {formatDate(d)}{' '}
              <span className="text-xs">
                {d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </span>
          )
        },
        meta: { className: 'w-36' },
      },
      {
        id: 'userName',
        accessorFn: (row) => row.userName ?? row.userId,
        header: ({ column }) => <SortableHeader column={column}>Usuario</SortableHeader>,
        cell: ({ getValue }) => (
          <span className="text-sm font-medium">{getValue<string>()}</span>
        ),
        meta: { className: 'hidden sm:table-cell' },
      },
      {
        accessorKey: 'type',
        header: 'Tipo',
        cell: ({ getValue }) => {
          const type = getValue<ActivityType>()
          const label = ACTIVITY_LABELS[type] ?? type
          const colorClass = ACTIVITY_COLORS[type] ?? 'text-muted-foreground'
          return (
            <span className={`text-xs font-medium ${colorClass}`}>{label}</span>
          )
        },
        enableSorting: false,
        meta: { className: 'hidden md:table-cell' },
      },
      {
        accessorKey: 'description',
        header: 'Descripcion',
        cell: ({ getValue }) => (
          <span className="text-sm">{getValue<string>()}</span>
        ),
        enableSorting: false,
      },
    ],
    []
  )

  const table = useReactTable({
    data: filteredActivities,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Registro de actividad" />

      <main className="flex-1 p-4 md:p-6 space-y-4">
        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por descripcion o usuario..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Type filter */}
              <Select
                options={[{ value: '', label: 'Todos los tipos' }, ...typeOptions]}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full sm:w-52"
              />

              {/* Month filter */}
              <Select
                options={[
                  { value: '0', label: 'Todos los meses' },
                  ...MONTHS.map((m) => ({ value: String(m.value), label: m.label })),
                ]}
                value={String(selectedMonth)}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full sm:w-36"
              />

              {/* Year filter */}
              <Select
                options={availableYears.map((y) => ({ value: String(y), label: String(y) }))}
                value={String(selectedYear)}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full sm:w-28"
              />
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="pt-4">
            {filteredActivities.length === 0 ? (
              <EmptyState
                icon={History}
                title="Sin actividad registrada"
                description="No hay registros de actividad para los filtros seleccionados."
              />
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => {
                          const meta = header.column.columnDef.meta as { className?: string } | undefined
                          return (
                            <TableHead key={header.id} className={meta?.className}>
                              {header.isPlaceholder
                                ? null
                                : flexRender(header.column.columnDef.header, header.getContext())}
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
                          const meta = cell.column.columnDef.meta as { className?: string } | undefined
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
              </div>
            )}

            {filteredActivities.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3 text-right">
                {filteredActivities.length} {filteredActivities.length === 1 ? 'registro' : 'registros'}
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
