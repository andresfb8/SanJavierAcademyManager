import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { isGroupCurrentlyActive } from '@/lib/group-utils'
import { cn, isMinor as checkIsMinor, formatDate, normalizeText, formatCurrency } from '@/lib/utils'
import { PLAYER_LEVELS, PLAYER_STATUSES } from '@/constants'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type PaginationState,
} from '@tanstack/react-table'
import { downloadXlsx } from '@/lib/excel'
import { useAllPendingNormalizedPaymentsQuery } from '@/hooks/useQueries'
import type { Player, PlayerLevel, PlayerStatus } from '@/types'
import {
  Plus, Search, Upload, Download, Users, Mail,
  MoreHorizontal, Eye, Edit, Trash2, UserX, CheckCircle2,
  Clock, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, Gamepad2,
} from 'lucide-react'

function calculateAge(birthDate: Date): number {
  const bd = birthDate instanceof Date ? birthDate : new Date(birthDate)
  const diffMs = Date.now() - bd.getTime()
  return Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000))
}

interface PlayersPageProps {
  initialStatusFilter?: PlayerStatus | ''
}

export default function PlayersPage({ initialStatusFilter = '' }: PlayersPageProps) {
  const navigate = useNavigate()
  const { players, users, invitations, groups, enrollments, attendance, seasons, club, addPlayer, updatePlayer, cancelPlayer, deletePlayer, invitePlayer } = useDataStore()
  const { user } = useAuthStore()
  const activeRole = user?.activeRole ?? user?.role
  // Invitar al portal es cosa de admin (mismo criterio que isAdmin() en las rules).
  // Además, con rol de BD entrenador no se sincronizan `invitations` ni `users`,
  // así que el estado derivado no sería fiable para ellos.
  const isAdmin = activeRole === 'director' || activeRole === 'coordinador'
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter)
  const [groupFilter, setGroupFilter] = useState<string>('')
  const [paymentFilter, setPaymentFilter] = useState<string>('')
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
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 12 })

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }, [search, levelFilter, statusFilter, groupFilter, paymentFilter, portalFilter])

  const { data: allPendingPayments = [] } = useAllPendingNormalizedPaymentsQuery()

  const paymentStatusByPlayer = useMemo(() => {
    const now = new Date()
    const map: Record<string, { status: 'pendiente' | 'vencido'; amount: number }> = {}
    for (const p of allPendingPayments) {
      const isOverdue = p.dueDate != null && new Date(p.dueDate) < now
      const prev = map[p.playerId]
      const amount = (prev?.amount || 0) + p.amount
      const status: 'pendiente' | 'vencido' = isOverdue || prev?.status === 'vencido' ? 'vencido' : 'pendiente'
      map[p.playerId] = { status, amount }
    }
    return map
  }, [allPendingPayments])

  const activeGroups = useMemo(
    () => groups.filter((g) => isGroupCurrentlyActive(g, new Date())),
    [groups]
  )

  const activeEnrollmentByPlayer = useMemo(() => {
    const map: Record<string, { groupId: string; groupName: string }> = {}
    for (const e of enrollments) {
      if (e.isActive && !map[e.playerId]) {
        map[e.playerId] = { groupId: e.groupId, groupName: e.groupName }
      }
    }
    return map
  }, [enrollments])

  const activeSeason = useMemo(
    () => seasons.find((s) => s.id === club?.activeSeasonId),
    [seasons, club]
  )

  const attendanceRateByPlayer = useMemo(() => {
    const counts: Record<string, { present: number; total: number }> = {}
    for (const record of attendance) {
      const recordDate = record.date instanceof Date ? record.date : new Date(record.date)
      if (activeSeason && (recordDate < activeSeason.startDate || recordDate > activeSeason.endDate)) continue
      for (const entry of record.records) {
        const c = counts[entry.playerId] ?? { present: 0, total: 0 }
        c.total++
        if (entry.status === 'presente') c.present++
        counts[entry.playerId] = c
      }
    }
    const rates: Record<string, number | null> = {}
    for (const p of players) {
      const c = counts[p.id]
      rates[p.id] = c && c.total > 0 ? Math.round((c.present / c.total) * 100) : null
    }
    return rates
  }, [attendance, activeSeason, players])

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
      const matchesGroup = groupFilter === '' || activeEnrollmentByPlayer[p.id]?.groupId === groupFilter
      const paymentStatus = paymentStatusByPlayer[p.id]?.status ?? 'al_dia'
      const matchesPayment = paymentFilter === '' || paymentStatus === paymentFilter
      const portalStatus = portalStatusById[p.id] ?? 'sin_acceso'
      const matchesPortal =
        portalFilter === '' ? true :
        portalFilter === 'active' ? portalStatus === 'activo' :
        portalFilter === 'sent' ? portalStatus === 'invitado' :
        portalFilter === 'none' ? portalStatus === 'sin_acceso' :
        true
      return matchesSearch && matchesLevel && matchesStatus && matchesGroup && matchesPayment && matchesPortal
    })
  }, [players, search, levelFilter, statusFilter, groupFilter, paymentFilter, portalFilter, portalStatusById, activeEnrollmentByPlayer, paymentStatusByPlayer])

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
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium shrink-0">
              {player.firstName[0]}{player.lastName[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">{player.firstName} {player.lastName}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {player.isMinor ? 'Menor' : 'Adulto'} · {calculateAge(player.birthDate)} años
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
      id: 'group',
      header: 'Grupo',
      cell: ({ row }) => {
        const info = activeEnrollmentByPlayer[row.original.id]
        return info
          ? <span className="text-sm text-foreground">{info.groupName}</span>
          : <span className="text-sm text-muted-foreground">Sin grupo</span>
      },
      enableSorting: false,
    },
    {
      accessorKey: 'level',
      header: 'Nivel',
      cell: ({ row }) => <StatusBadge status={row.original.level} />,
    },
    {
      id: 'attendance',
      header: 'Asistencia',
      cell: ({ row }) => {
        const rate = attendanceRateByPlayer[row.original.id]
        if (rate === null || rate === undefined) {
          return <span className="text-xs text-muted-foreground">Sin datos</span>
        }
        return (
          <div className="flex items-center gap-2 w-28">
            <div className="h-1.5 flex-1 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${rate}%` }} />
            </div>
            <span className="text-xs font-medium text-foreground w-9 text-right">{rate}%</span>
          </div>
        )
      },
      enableSorting: false,
    },
    {
      id: 'paymentStatus',
      header: 'Estado de pago',
      cell: ({ row }) => {
        const info = paymentStatusByPlayer[row.original.id]
        if (!info) return <StatusBadge status="al_dia" />
        const label = `${info.status === 'vencido' ? 'Vencido' : 'Pendiente'} ${formatCurrency(info.amount)}`
        return <StatusBadge status={info.status} label={label} />
      },
      enableSorting: false,
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
  ], [selectedIds, filteredPlayers.length, navigate, invitePlayer, portalStatusById, isAdmin, activeEnrollmentByPlayer, attendanceRateByPlayer, paymentStatusByPlayer])

  const table = useReactTable({
    data: filteredPlayers,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <div>
      <div className="border-b border-border bg-card">
        <div className="flex flex-wrap items-center gap-4 px-5 py-5 lg:px-8">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">PERSONAS</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {players.filter((p) => p.status === 'activo').length} activos ·{' '}
              {players.filter((p) => p.status === 'lista_espera').length} en lista de espera ·{' '}
              {players.length} fichas totales
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Nombre, email o teléfono…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 pl-9"
              />
            </div>
            <Button onClick={() => { setEditingPlayer(null); setShowCreateDialog(true) }}>
              <Plus className="h-4 w-4 mr-1.5" />
              Nuevo jugador
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
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
          <Select
            options={[{ value: '', label: 'Todos los grupos' }, ...activeGroups.map((g) => ({ value: g.id, label: g.name }))]}
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="w-full sm:w-44"
          />
          <Select
            options={[
              { value: '', label: 'Todos los pagos' },
              { value: 'al_dia', label: 'Al día' },
              { value: 'pendiente', label: 'Pendiente' },
              { value: 'vencido', label: 'Vencido' },
            ]}
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
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
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
              <Upload className="h-4 w-4 mr-1" />
              Importar
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" />
              Exportar
            </Button>
          </div>
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
              <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
                <span>
                  Mostrando {pagination.pageIndex * pagination.pageSize + 1}
                  –{Math.min((pagination.pageIndex + 1) * pagination.pageSize, filteredPlayers.length)}{' '}
                  de {filteredPlayers.length} jugadores
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
                    Anterior
                  </Button>
                  <span className="text-xs font-medium">
                    Página {pagination.pageIndex + 1} de {Math.max(table.getPageCount(), 1)}
                  </span>
                  <Button variant="outline" size="sm" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
                    Siguiente
                  </Button>
                </div>
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
