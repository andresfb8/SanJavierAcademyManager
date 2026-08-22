import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { CancelPlayerDialog } from '@/components/shared/CancelPlayerDialog'
import { PlayerFormDialog, type PlayerFormData } from '@/components/shared/PlayerFormDialog'
import { ImportPlayersDialog, type ImportedPlayer } from '@/components/shared/ImportPlayersDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Select } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { useDataStore } from '@/stores/dataStore'
import { useAuthStore } from '@/stores/authStore'
import { getPlayerPortalStatus } from '@/lib/player-portal-status'
import { cn, isMinor as checkIsMinor, formatDate, normalizeText, formatCurrency } from '@/lib/utils'
import { PLAYER_LEVELS, PLAYER_STATUSES } from '@/constants'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { downloadXlsx } from '@/lib/excel'
import { useAllPendingNormalizedPaymentsQuery } from '@/hooks/useQueries'
import type { Player, PlayerLevel, PlayerStatus } from '@/types'
import {
  Plus, Search, Upload, Download, Users, Mail, Phone,
  MoreHorizontal, Eye, Edit, Trash2, UserX, CheckCircle2,
  Clock, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, Gamepad2,
} from 'lucide-react'

export default function PlayersPage() {
  const navigate = useNavigate()
  const { players, users, invitations, addPlayer, updatePlayer, cancelPlayer, deletePlayer, invitePlayer } = useDataStore()
  const { user } = useAuthStore()
  const activeRole = user?.activeRole ?? user?.role
  // Invitar al portal es cosa de admin (mismo criterio que isAdmin() en las rules).
  // Además, con rol de BD entrenador no se sincronizan `invitations` ni `users`,
  // así que el estado derivado no sería fiable para ellos.
  const isAdmin = activeRole === 'director' || activeRole === 'coordinador'
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [portalFilter, setPortalFilter] = useState<string>('')
  // El filtro de portal se oculta para no-admins. Cambiar de rol activo no
  // remonta esta página, así que un filtro puesto sobreviviría al cambio y
  // dejaría la lista filtrada sin ningún control visible para limpiarla.
  useEffect(() => {
    if (!isAdmin) setPortalFilter('')
  }, [isAdmin])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState<string | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([])

  const { data: allPendingPayments = [] } = useAllPendingNormalizedPaymentsQuery()

  const pendingByPlayer = useMemo(() => {
    const map: Record<string, number> = {}
    allPendingPayments.forEach(p => {
      map[p.playerId] = (map[p.playerId] || 0) + p.amount
    })
    return map
  }, [allPendingPayments])

  const portalStatusById = useMemo(() => {
    // `now` se congela hasta que cambie alguno de los tres arrays. Con caducidad
    // de 7 días no merece un timer: como mucho el menú ofrece "Reenviar" en vez
    // de "Invitar", y ambos hacen lo mismo.
    const now = new Date()
    const map: Record<string, ReturnType<typeof getPlayerPortalStatus>> = {}
    for (const p of players) {
      map[p.id] = getPlayerPortalStatus(p, users, invitations, now)
    }
    return map
  }, [players, users, invitations])

  const filteredPlayers = useMemo(() => {
    const q = normalizeText(search)
    return players.filter((p) => {
      const matchesSearch = search === '' ||
        normalizeText(`${p.firstName} ${p.lastName}`).includes(q) ||
        normalizeText(p.email).includes(q) ||
        p.phone.includes(search)
      const matchesLevel = levelFilter === '' || p.level === levelFilter
      const matchesStatus = statusFilter === '' || p.status === statusFilter
      const portalStatus = portalStatusById[p.id] ?? 'sin_acceso'
      const matchesPortal =
        portalFilter === '' ? true :
        portalFilter === 'active' ? portalStatus === 'activo' :
        portalFilter === 'sent' ? portalStatus === 'invitado' :
        portalFilter === 'none' ? portalStatus === 'sin_acceso' :
        true
      return matchesSearch && matchesLevel && matchesStatus && matchesPortal
    })
  }, [players, search, levelFilter, statusFilter, portalFilter, portalStatusById])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredPlayers.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredPlayers.map((p) => p.id)))
    }
  }

  const handleFormSubmit = (formData: PlayerFormData) => {
    const birthDate = new Date(formData.birthDate)
    const playerIsMinor = checkIsMinor(birthDate)

    const playerData = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      dni: formData.dni,
      birthDate,
      email: formData.email,
      phone: formData.phone,
      address: formData.address,
      city: formData.city,
      postalCode: formData.postalCode,
      level: formData.level,
      dominantHand: formData.dominantHand,
      position: formData.position,
      clothingSize: formData.clothingSize || undefined,
      licenseNumber: formData.licenseNumber || undefined,
      previousExperience: formData.previousExperience || undefined,
      medicalNotes: formData.medicalNotes || undefined,
      bankAccountHolder: formData.bankAccountHolder,
      iban: formData.iban,
      status: formData.status,
      registrationDate: editingPlayer?.registrationDate || new Date(),
      isMinor: playerIsMinor,
      guardian: playerIsMinor ? {
        firstName: formData.guardianFirstName,
        lastName: formData.guardianLastName,
        dni: formData.guardianDni,
        phone: formData.guardianPhone,
        email: formData.guardianEmail,
        relationship: formData.guardianRelationship,
      } : undefined,
      notes: formData.notes || undefined,
    }

    if (editingPlayer) {
      updatePlayer(editingPlayer.id, playerData)
    } else {
      addPlayer(playerData)
    }
    setShowCreateDialog(false)
    setEditingPlayer(null)
  }

  const handleImport = async (importedPlayers: ImportedPlayer[]) => {
    for (const p of importedPlayers) {
      await addPlayer({
        firstName: p.firstName,
        lastName: p.lastName,
        dni: p.dni || '',
        birthDate: p.birthDate ? new Date(p.birthDate) : new Date('2000-01-01'),
        email: p.email || '',
        phone: p.phone || '',
        address: p.address || '',
        city: p.city || 'San Javier',
        postalCode: p.postalCode || '30730',
        level: (['iniciacion', 'intermedio', 'avanzado', 'competicion', 'menores'].includes(p.level) ? p.level : 'iniciacion') as PlayerLevel,
        dominantHand: 'derecha',
        position: 'ambos',
        clothingSize: (['4', '6', '8', '10', '12', '14', '16', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'].includes(p.clothingSize || '') ? p.clothingSize : undefined) as any,
        bankAccountHolder: '',
        iban: '',
        status: (['activo', 'lista_espera', 'baja'].includes(p.status) ? p.status : 'activo') as PlayerStatus,
        registrationDate: new Date(),
        isMinor: p.birthDate ? checkIsMinor(new Date(p.birthDate)) : false,
        notes: undefined,
      })
    }
    setShowImportDialog(false)
  }

  const handleExport = () => {
    const data = filteredPlayers.map((p) => ({
      'Nombre': p.firstName,
      'Apellidos': p.lastName,
      'DNI': p.dni,
      'Fecha Nacimiento': p.birthDate ? formatDate(p.birthDate) : '',
      'Email': p.email,
      'Telefono': p.phone,
      'Nivel': p.level,
      'Estado': p.status,
      'Direccion': p.address,
      'Ciudad': p.city,
      'CP': p.postalCode,
      'Mano': p.dominantHand,
      'Posicion': p.position,
      'Talla': p.clothingSize || '',
      'Licencia': p.licenseNumber || '',
      'Titular Cuenta': p.bankAccountHolder || '',
      'IBAN': p.iban || '',
      'Tutor Nombre': p.isMinor ? p.guardian?.firstName || '' : '',
      'Tutor Apellidos': p.isMinor ? p.guardian?.lastName || '' : '',
      'Tutor DNI': p.isMinor ? p.guardian?.dni || '' : '',
      'Tutor Telefono': p.isMinor ? p.guardian?.phone || '' : '',
      'Tutor Email': p.isMinor ? p.guardian?.email || '' : '',
      'Parentesco': p.isMinor ? p.guardian?.relationship || '' : '',
    }))
    const fileName = `jugadores_${new Date().toISOString().split('T')[0]}.xlsx`
    downloadXlsx(data, 'Jugadores', fileName)
  }

  const columns = useMemo<ColumnDef<Player>[]>(() => [
    {
      id: 'select',
      header: () => (
        <Checkbox
          checked={selectedIds.size === filteredPlayers.length && filteredPlayers.length > 0}
          onCheckedChange={toggleSelectAll}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selectedIds.has(row.original.id)}
          onCheckedChange={() => toggleSelect(row.original.id)}
        />
      ),
      enableSorting: false,
      size: 40,
    },
    {
      accessorKey: 'firstName',
      header: 'Jugador',
      cell: ({ row }) => {
        const player = row.original
        const debt = pendingByPlayer[player.id] || 0
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium shrink-0">
              {player.firstName[0]}{player.lastName[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">{player.firstName} {player.lastName}</p>
                {debt > 0 && (
                  <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-destructive text-destructive-foreground">
                    🔴 {formatCurrency(debt)}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {player.isMinor && '👶 Menor · '}{player.dni}
              </p>
              {isAdmin && portalStatusById[player.id] === 'invitado' && (
                <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-blue-600 bg-blue-50 w-fit px-1.5 py-0.5 rounded-md">
                  <Mail className="h-3 w-3" /> Invitación enviada
                </div>
              )}
              {isAdmin && portalStatusById[player.id] === 'activo' && (
                <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 w-fit px-1.5 py-0.5 rounded-md">
                  <CheckCircle2 className="h-3 w-3" /> Portal Activo
                </div>
              )}
            </div>
          </div>
        )
      },
      sortingFn: (rowA, rowB) => {
        const a = `${rowA.original.firstName} ${rowA.original.lastName}`.toLowerCase()
        const b = `${rowB.original.firstName} ${rowB.original.lastName}`.toLowerCase()
        return a.localeCompare(b)
      },
    },
    {
      id: 'contact',
      header: 'Contacto',
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            {row.original.email}
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Phone className="h-3.5 w-3.5" />
            {row.original.phone}
          </div>
        </div>
      ),
      enableSorting: false,
      meta: { className: 'hidden md:table-cell' },
    },
    {
      accessorKey: 'level',
      header: 'Nivel',
      cell: ({ row }) => <StatusBadge status={row.original.level} />,
    },
    {
      accessorKey: 'status',
      header: 'Estado',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const player = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => navigate(`/jugadores/${player.id}`)}>
                <Eye className="h-4 w-4 mr-2" /> Ver perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setEditingPlayer(player); setShowCreateDialog(true) }}>
                <Edit className="h-4 w-4 mr-2" /> Editar
              </DropdownMenuItem>
              {isAdmin && player.email && portalStatusById[player.id] !== 'activo' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => invitePlayer(player.id)}
                    className="text-blue-700 focus:text-blue-700"
                  >
                    <Gamepad2 className="h-4 w-4 mr-2" />
                    {portalStatusById[player.id] === 'invitado' ? 'Reenviar invitación' : 'Invitar al portal'}
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              {player.status === 'activo' && (
                <DropdownMenuItem onClick={() => setShowCancelConfirm(player.id)}>
                  <UserX className="h-4 w-4 mr-2" /> Dar de baja
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setShowDeleteConfirm(player.id)}>
                <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                <span className="text-destructive">Eliminar</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
      enableSorting: false,
      size: 40,
    },
  ], [selectedIds, filteredPlayers.length, navigate, invitePlayer, portalStatusById, isAdmin, pendingByPlayer])

  const table = useReactTable({
    data: filteredPlayers,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div>
      <Header
        title="Jugadores"
        subtitle={`${players.filter((p) => p.status === 'activo').length} activos · ${players.length} total`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
              <Upload className="h-4 w-4 mr-1" />
              Importar
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" />
              Exportar
            </Button>
            <Button size="sm" onClick={() => { setEditingPlayer(null); setShowCreateDialog(true) }}>
              <Plus className="h-4 w-4 mr-1" />
              Nuevo jugador
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, email o telefono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            options={[{ value: '', label: 'Todos los niveles' }, ...PLAYER_LEVELS.map((l) => ({ value: l.value, label: l.label }))]}
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="w-full sm:w-40"
          />
          <Select
            options={[{ value: '', label: 'Todos los estados' }, ...PLAYER_STATUSES.map((s) => ({ value: s.value, label: s.label }))]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-40"
          />
          {isAdmin && (
            <Select
              options={[
                { value: '', label: 'Portal: todos' },
                { value: 'active', label: 'Portal activo' },
                { value: 'sent', label: 'Invitación enviada' },
                { value: 'none', label: 'Sin acceso' },
              ]}
              value={portalFilter}
              onChange={(e) => setPortalFilter(e.target.value)}
              className="w-full sm:w-44"
            />
          )}
        </div>

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <span className="text-sm font-semibold text-primary">
              {selectedIds.size} seleccionado{selectedIds.size > 1 ? 's' : ''}
            </span>
            <div className="h-4 w-px bg-border mx-1" />

            {/* Cambiar estado */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Cambiar estado
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => {
                  selectedIds.forEach((id) => updatePlayer(id, { status: 'activo' }))
                  setSelectedIds(new Set())
                }}>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 mr-2" />
                  Activo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  selectedIds.forEach((id) => updatePlayer(id, { status: 'lista_espera' }))
                  setSelectedIds(new Set())
                }}>
                  <span className="h-2 w-2 rounded-full bg-amber-500 mr-2" />
                  Lista de espera
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => {
                  selectedIds.forEach((id) => cancelPlayer(id))
                  setSelectedIds(new Set())
                }}>
                  <UserX className="h-3.5 w-3.5 mr-2 text-destructive" />
                  <span className="text-destructive">Dar de baja</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Cambiar nivel */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Cambiar nivel
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {PLAYER_LEVELS.map((lvl) => (
                  <DropdownMenuItem key={lvl.value} onClick={() => {
                    selectedIds.forEach((id) => updatePlayer(id, { level: lvl.value as PlayerLevel }))
                    setSelectedIds(new Set())
                  }}>
                    {lvl.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Invitar al portal */}
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                onClick={() => {
                  const { bulkInvitePlayers } = useDataStore.getState()
                  bulkInvitePlayers(Array.from(selectedIds))
                  setSelectedIds(new Set())
                }}
              >
                <Mail className="h-3.5 w-3.5" />
                Enviar invitaciones
              </Button>
            )}

            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelectedIds(new Set())}>
              Deseleccionar
            </Button>
          </div>
        )}

        {/* Table */}
        {filteredPlayers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No hay jugadores"
            description="Anade tu primer jugador para empezar a gestionar tu escuela"
            action={{ label: 'Anadir jugador', onClick: () => setShowCreateDialog(true) }}
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id} className="border-b bg-muted/50">
                        {headerGroup.headers.map((header) => (
                          <th
                            key={header.id}
                            className={cn(
                              'p-3 text-left text-sm font-medium text-muted-foreground',
                              header.column.getCanSort() && 'cursor-pointer select-none hover:text-foreground',
                              (header.column.columnDef.meta as Record<string, string> | undefined)?.className
                            )}
                            onClick={header.column.getToggleSortingHandler()}
                            style={{ width: header.column.columnDef.size }}
                          >
                            <div className="flex items-center gap-1">
                              {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                              {header.column.getCanSort() && (
                                header.column.getIsSorted() === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> :
                                  header.column.getIsSorted() === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> :
                                    <ArrowUpDown className="h-3.5 w-3.5 opacity-30" />
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => navigate(`/jugadores/${row.original.id}`)}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className={cn('p-3', (cell.column.columnDef.meta as Record<string, string> | undefined)?.className)}
                            onClick={(e) => {
                              if (cell.column.id === 'select' || cell.column.id === 'actions') {
                                e.stopPropagation()
                              }
                            }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <PlayerFormDialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open)
          if (!open) setEditingPlayer(null)
        }}
        player={editingPlayer}
        onSubmit={handleFormSubmit}
      />

      {/* Import Dialog */}
      <ImportPlayersDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImport={handleImport}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!showDeleteConfirm}
        onOpenChange={() => setShowDeleteConfirm(null)}
        title="Eliminar jugador"
        description="Esta accion eliminara al jugador y todos sus datos asociados. Esta accion no se puede deshacer."
        variant="destructive"
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (showDeleteConfirm) deletePlayer(showDeleteConfirm)
          setShowDeleteConfirm(null)
        }}
      />

      {/* Cancel Player Dialog */}
      <CancelPlayerDialog
        open={!!showCancelConfirm}
        onOpenChange={(open) => { if (!open) setShowCancelConfirm(null) }}
        player={players.find((p) => p.id === showCancelConfirm) ?? null}
        onConfirm={(options) => {
          if (showCancelConfirm) cancelPlayer(showCancelConfirm, options)
          setShowCancelConfirm(null)
        }}
      />
    </div>
  )
}
