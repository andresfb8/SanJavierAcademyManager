import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { useDataStore } from '@/stores/dataStore'
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
import {
  Plus,
  Euro,
  Eye,
  Edit2,
  Trash2,
  UserPlus,
  Users,
  MoreHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { cn, formatCurrency, normalizeText } from '@/lib/utils'
import { STAFF_ROLES } from '@/constants'
import type { Coach, StaffRole } from '@/types'
import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/stores/authStore'
import { createInvitation } from '@/lib/invitations'
import { sendInvitationEmail } from '@/lib/emailService'
import { useEventPaymentsQuery } from '@/hooks/useQueries'
import { calculateEventSalary } from '@/lib/salary-utils'
import type { PersonasOutletContext } from '@/components/layout/PersonasLayout'

interface CoachForm {
  firstName: string
  lastName: string
  dni: string
  email: string
  phone: string
  address: string
  specialization: string
  certifications: string
  notes: string
  isActive: boolean
  staffRole: StaffRole
  ratePerGroupAdults: string
  ratePerGroupMinors: string
  privateLessonPaymentType: string
  privateLessonRate: string
  eventPaymentType: string
  eventRate: string
  bonuses: string
  salaryNotes: string
}

const emptyForm: CoachForm = {
  firstName: '',
  lastName: '',
  dni: '',
  email: '',
  phone: '',
  address: '',
  specialization: '',
  certifications: '',
  notes: '',
  isActive: true,
  staffRole: 'entrenador',
  ratePerGroupAdults: '',
  ratePerGroupMinors: '',
  privateLessonPaymentType: 'fixed',
  privateLessonRate: '',
  eventPaymentType: 'percentage',
  eventRate: '',
  bonuses: '',
  salaryNotes: '',
}

export default function CoachesPage() {
  const {
    coaches,
    groups,
    coachSalaryConfigs,
    privateLessons,
    events,
    addCoach,
    updateCoach,
    deleteCoach,
    updateCoachSalaryConfig,
  } = useDataStore()

  const { data: eventPayments = [] } = useEventPaymentsQuery()
  const { search, setPrimaryAction } = useOutletContext<PersonasOutletContext>()

  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [activeFilter, setActiveFilter] = useState<string>('active')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingCoach, setEditingCoach] = useState<Coach | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [form, setForm] = useState<CoachForm>({ ...emptyForm })
  const [showInviteSuccess, setShowInviteSuccess] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteEmailStatus, setInviteEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ fixed: number; message: string } | null>(null)
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 12 })

  const resetForm = () => setForm({ ...emptyForm })

  const openCreateDialog = () => {
    resetForm()
    setEditingCoach(null)
    setShowCreateDialog(true)
  }

  useEffect(() => {
    setPrimaryAction({
      label: 'Nuevo entrenador',
      icon: Plus,
      onClick: openCreateDialog,
    })
    return () => setPrimaryAction(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setPrimaryAction])

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }, [search, activeFilter, roleFilter])

  const filteredCoaches = useMemo(() => {
    const q = normalizeText(search)
    return coaches.filter((c) => {
      const matchesSearch =
        search === '' ||
        normalizeText(`${c.firstName} ${c.lastName}`).includes(q) ||
        normalizeText(c.email).includes(q) ||
        c.phone.includes(search)
      const matchesActive =
        activeFilter === 'all' || (activeFilter === 'active' && c.isActive)
      const matchesRole =
        roleFilter === '' || (c.staffRole ?? 'entrenador') === roleFilter
      return matchesSearch && matchesActive && matchesRole
    })
  }, [coaches, search, activeFilter, roleFilter])

  const getCoachGroups = (coachId: string) =>
    groups.filter((g) => g.coachId === coachId)

  const getSalaryConfig = (coachId: string) =>
    coachSalaryConfigs.find((c) => c.coachId === coachId)

  const getEstimatedSalary = (coachId: string) => {
    const config = getSalaryConfig(coachId)
    if (!config) return 0
    const coachGroups = getCoachGroups(coachId)
    const adultGroupsCount = coachGroups.filter(g => g.level !== 'menores').length
    const minorsGroupsCount = coachGroups.filter(g => g.level === 'menores').length

    const groupsSalary = (adultGroupsCount * (config.ratePerGroupAdults || 0)) + (minorsGroupsCount * (config.ratePerGroupMinors || 0))

    const now = new Date()

    const monthLessons = privateLessons.filter(
      (pl) =>
        pl.coachId === coachId &&
        new Date(pl.date).getMonth() === now.getMonth() &&
        new Date(pl.date).getFullYear() === now.getFullYear()
    )

    const lessonsSalary = monthLessons.reduce((acc, lesson) => {
      if (config.privateLessonPaymentType === 'fixed') {
        return acc + (config.privateLessonRate || 0)
      } else {
        return acc + (lesson.price * ((config.privateLessonRate || 0) / 100))
      }
    }, 0)

    const monthEvents = events.filter(
      (ev) =>
        ev.coachIds.includes(coachId) &&
        new Date(ev.date).getMonth() === now.getMonth() &&
        new Date(ev.date).getFullYear() === now.getFullYear()
    )

    const eventsSalary = monthEvents.reduce((acc, ev) => {
      return acc + calculateEventSalary(ev, eventPayments, config)
    }, 0)

    return groupsSalary + lessonsSalary + eventsSalary + (config.bonuses || 0)
  }

  const handleSubmit = () => {
    if (!form.firstName || !form.lastName) return

    const coachData = {
      firstName: form.firstName,
      lastName: form.lastName,
      dni: form.dni,
      email: form.email,
      phone: form.phone,
      address: form.address || undefined,
      specialization: form.specialization || undefined,
      certifications: form.certifications || undefined,
      notes: form.notes || undefined,
      isActive: form.isActive,
      staffRole: form.staffRole,
      hireDate: editingCoach ? editingCoach.hireDate : new Date(),
    }

    if (editingCoach) {
      updateCoach(editingCoach.id, coachData)
      updateCoachSalaryConfig(editingCoach.id, {
        coachId: editingCoach.id,
        ratePerGroupAdults: parseFloat(form.ratePerGroupAdults) || 0,
        ratePerGroupMinors: parseFloat(form.ratePerGroupMinors) || 0,
        privateLessonPaymentType: form.privateLessonPaymentType as 'fixed' | 'percentage',
        privateLessonRate: parseFloat(form.privateLessonRate) || 0,
        eventPaymentType: form.eventPaymentType as 'fixed' | 'percentage',
        eventRate: parseFloat(form.eventRate) || 0,
        bonuses: parseFloat(form.bonuses) || 0,
        notes: form.salaryNotes || undefined,
      })
      setEditingCoach(null)
    } else {
      const newCoachId = addCoach(coachData)
      updateCoachSalaryConfig(newCoachId, {
        coachId: newCoachId,
        ratePerGroupAdults: parseFloat(form.ratePerGroupAdults) || 0,
        ratePerGroupMinors: parseFloat(form.ratePerGroupMinors) || 0,
        privateLessonPaymentType: form.privateLessonPaymentType as 'fixed' | 'percentage',
        privateLessonRate: parseFloat(form.privateLessonRate) || 0,
        eventPaymentType: form.eventPaymentType as 'fixed' | 'percentage',
        eventRate: parseFloat(form.eventRate) || 0,
        bonuses: parseFloat(form.bonuses) || 0,
        notes: form.salaryNotes || undefined,
      })
    }

    setShowCreateDialog(false)
    resetForm()
  }

  const openEditDialog = (coach: Coach) => {
    const config = getSalaryConfig(coach.id)
    setForm({
      firstName: coach.firstName,
      lastName: coach.lastName,
      dni: coach.dni,
      email: coach.email,
      phone: coach.phone,
      address: coach.address || '',
      specialization: coach.specialization || '',
      certifications: coach.certifications || '',
      notes: coach.notes || '',
      isActive: coach.isActive,
      staffRole: coach.staffRole ?? 'entrenador',
      ratePerGroupAdults: config && config.ratePerGroupAdults !== undefined ? String(config.ratePerGroupAdults) : '',
      ratePerGroupMinors: config && config.ratePerGroupMinors !== undefined ? String(config.ratePerGroupMinors) : '',
      privateLessonPaymentType: config?.privateLessonPaymentType ?? 'fixed',
      privateLessonRate: config && config.privateLessonRate !== undefined ? String(config.privateLessonRate) : '',
      eventPaymentType: config?.eventPaymentType ?? 'percentage',
      eventRate: config && config.eventRate !== undefined ? String(config.eventRate) : '',
      bonuses: config ? String(config.bonuses) : '',
      salaryNotes: config?.notes || '',
    })
    setEditingCoach(coach)
    setShowCreateDialog(true)
  }

  const getStaffRoleLabel = (role?: StaffRole) =>
    STAFF_ROLES.find((r) => r.value === (role ?? 'entrenador'))?.label ?? 'Entrenador'

  const getStaffRoleBadgeVariant = (role?: StaffRole) => {
    switch (role) {
      case 'director':
        return 'default' as const
      case 'coordinador':
        return 'warning' as const
      default:
        return 'outline' as const
    }
  }

  const handleCreateAccount = async (coach: Coach) => {
    if (!coach.email) return
    const role = coach.staffRole === 'coordinador' ? 'coordinador' : 'entrenador'

    let activationUrl: string
    try {
      const result = await createInvitation({
        email: coach.email,
        role,
        clubId: user?.clubId ?? 'club-001',
        createdBy: user?.id ?? 'unknown',
        coachId: coach.id,
      })
      activationUrl = result.activationUrl
    } catch (err) {
      console.error('[CoachesPage] handleCreateAccount: error creando la invitación:', err)
      setSyncResult({ fixed: 0, message: `No se pudo crear la invitación para ${coach.email}.` })
      return
    }

    setInviteEmail(coach.email)
    setInviteLink(activationUrl)
    setShowInviteSuccess(true)
    setInviteEmailStatus('sending')

    try {
      await sendInvitationEmail(
        { name: `${coach.firstName} ${coach.lastName}`.trim(), email: coach.email },
        activationUrl,
        role
      )
      setInviteEmailStatus('sent')
    } catch (err) {
      console.error('[CoachesPage] handleCreateAccount: error enviando el correo:', err)
      setInviteEmailStatus('failed')
    }
  }

  const handleSyncAccounts = async () => {
    const clubId = user?.clubId
    if (!clubId) return
    setIsSyncing(true)
    try {
      const usersSnap = await getDocs(
        query(
          collection(db, 'users'),
          where('clubId', '==', clubId),
          where('role', 'in', ['entrenador', 'coordinador'])
        )
      )
      const staffUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() as { email: string } }))

      const coachesSnap = await getDocs(
        query(collection(db, 'coaches'), where('clubId', '==', clubId))
      )

      let fixed = 0
      for (const coachDoc of coachesSnap.docs) {
        const coachData = coachDoc.data()
        if (coachData.userId) continue

        const matchingUser = staffUsers.find(
          (u) => u.email?.toLowerCase() === coachData.email?.toLowerCase()
        )
        if (matchingUser) {
          await updateDoc(doc(db, 'coaches', coachDoc.id), { userId: matchingUser.id })
          updateCoach(coachDoc.id, { userId: matchingUser.id })
          fixed++
        }
      }

      setSyncResult({
        fixed,
        message: fixed > 0
          ? `Se vincularon ${fixed} entrenador${fixed > 1 ? 'es' : ''} correctamente.`
          : 'Todos los entrenadores ya están vinculados correctamente.',
      })
    } catch (err) {
      console.error('[SyncAccounts] Failed:', err)
      setSyncResult({ fixed: 0, message: 'Error al sincronizar. Inténtalo de nuevo.' })
    } finally {
      setIsSyncing(false)
    }
  }

  const columns = useMemo<ColumnDef<Coach>[]>(() => [
    {
      accessorKey: 'firstName',
      header: 'Entrenador',
      cell: ({ row }) => {
        const coach = row.original
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                {coach.firstName[0]}{coach.lastName[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-sm">{coach.firstName} {coach.lastName}</p>
              {coach.specialization && (
                <p className="text-xs text-muted-foreground">{coach.specialization}</p>
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
      accessorKey: 'staffRole',
      header: 'Rol',
      cell: ({ row }) => (
        <Badge variant={getStaffRoleBadgeVariant(row.original.staffRole)}>
          {getStaffRoleLabel(row.original.staffRole)}
        </Badge>
      ),
    },
    {
      id: 'groups',
      header: 'Grupos',
      cell: ({ row }) => (
        <Badge variant="outline">{getCoachGroups(row.original.id).length}</Badge>
      ),
      enableSorting: false,
    },
    {
      id: 'salary',
      header: 'Salario est.',
      cell: ({ row }) => (
        <span className="text-sm font-medium">{formatCurrency(getEstimatedSalary(row.original.id))}</span>
      ),
      enableSorting: false,
    },
    {
      id: 'account',
      header: 'Cuenta',
      cell: ({ row }) => (
        <Badge variant={row.original.userId ? 'success' : 'secondary'}>
          {row.original.userId ? 'Con cuenta' : 'Sin cuenta'}
        </Badge>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'isActive',
      header: 'Estado',
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? 'success' : 'secondary'}>
          {row.original.isActive ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const coach = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => navigate(`/entrenadores/${coach.id}`)}>
                <Eye className="h-4 w-4 mr-2" /> Ver perfil
              </DropdownMenuItem>
              {!coach.userId && (
                <DropdownMenuItem onClick={() => handleCreateAccount(coach)}>
                  <UserPlus className="h-4 w-4 mr-2" /> Crear cuenta
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => openEditDialog(coach)}>
                <Edit2 className="h-4 w-4 mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowDeleteConfirm(coach.id)}>
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [groups, coachSalaryConfigs, privateLessons, events, eventPayments, navigate])

  const table = useReactTable({
    data: filteredCoaches,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
        <Select
          options={[
            { value: '', label: 'Todos los roles' },
            ...STAFF_ROLES.map((r) => ({ value: r.value, label: r.label })),
          ]}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="w-full sm:w-40"
        />
        <Select
          options={[
            { value: 'active', label: 'Solo activos' },
            { value: 'all', label: 'Todos' },
          ]}
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value)}
          className="w-full sm:w-40"
        />
        <div className="flex-1" />
        <Button
          size="sm"
          variant="outline"
          onClick={handleSyncAccounts}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <>
              <span className="h-4 w-4 mr-1 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Sincronizando...
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4 mr-1" />
              Reparar vinculaciones
            </>
          )}
        </Button>
      </div>

      {filteredCoaches.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No hay entrenadores"
          description="Anade tu primer entrenador para empezar a gestionar el personal"
          action={{ label: 'Anadir entrenador', onClick: openCreateDialog }}
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
                            header.column.getCanSort() && 'cursor-pointer select-none hover:text-foreground'
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
                    <tr key={row.id} className="border-b hover:bg-muted/30 transition-colors">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="p-3">
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
                –{Math.min((pagination.pageIndex + 1) * pagination.pageSize, filteredCoaches.length)}{' '}
                de {filteredCoaches.length} entrenadores
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

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-xl sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingCoach ? 'Editar miembro' : 'Nuevo miembro'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                placeholder="Nombre"
              />
            </div>
            <div className="space-y-2">
              <Label>Apellidos *</Label>
              <Input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                placeholder="Apellidos"
              />
            </div>
            <div className="space-y-2">
              <Label>DNI</Label>
              <Input
                value={form.dni}
                onChange={(e) => setForm({ ...form, dni: e.target.value })}
                placeholder="12345678A"
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Telefono *</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="600 000 000"
              />
            </div>
            <div className="space-y-2">
              <Label>Rol en el staff</Label>
              <Select
                options={STAFF_ROLES.map((r) => ({ value: r.value, label: r.label }))}
                value={form.staffRole}
                onChange={(e) => setForm({ ...form, staffRole: e.target.value as StaffRole })}
              />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                options={[
                  { value: 'true', label: 'Activo' },
                  { value: 'false', label: 'Inactivo' },
                ]}
                value={String(form.isActive)}
                onChange={(e) =>
                  setForm({ ...form, isActive: e.target.value === 'true' })
                }
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Direccion</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Calle, numero, ciudad..."
              />
            </div>
            <div className="space-y-2">
              <Label>Especializacion</Label>
              <Input
                value={form.specialization}
                onChange={(e) =>
                  setForm({ ...form, specialization: e.target.value })
                }
                placeholder="Ej: Padel competicion, menores..."
              />
            </div>
            <div className="space-y-2">
              <Label>Certificaciones</Label>
              <Input
                value={form.certifications}
                onChange={(e) =>
                  setForm({ ...form, certifications: e.target.value })
                }
                placeholder="Ej: Monitor FEP Nivel 2"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notas adicionales sobre el entrenador..."
                rows={2}
              />
            </div>

            {editingCoach && (
              <>
                <div className="col-span-2 border-t pt-4 mt-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <Euro className="h-4 w-4" />
                    Configuracion salarial
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tarifa Grupos Adultos (€/mes)</Label>
                    <Input
                      type="number"
                      value={form.ratePerGroupAdults}
                      onChange={(e) => setForm({ ...form, ratePerGroupAdults: e.target.value })}
                      placeholder="250"
                      min="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tarifa Grupos Menores (€/mes)</Label>
                    <Input
                      type="number"
                      value={form.ratePerGroupMinors}
                      onChange={(e) => setForm({ ...form, ratePerGroupMinors: e.target.value })}
                      placeholder="200"
                      min="0"
                    />
                  </div>
                </div>

                <div className="border-t border-border mt-4 mb-4"></div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Modo de cobro Clases Particulares</Label>
                    <Select
                      options={[
                        { value: 'fixed', label: 'Cantidad fija (€) por clase' },
                        { value: 'percentage', label: 'Porcentaje (%) de recaudación' },
                      ]}
                      value={form.privateLessonPaymentType}
                      onChange={(e) => setForm({ ...form, privateLessonPaymentType: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{form.privateLessonPaymentType === 'fixed' ? 'Cantidad fija (€/clase)' : 'Porcentaje de recaudación (%)'}</Label>
                    <Input
                      type="number"
                      value={form.privateLessonRate}
                      onChange={(e) =>
                        setForm({ ...form, privateLessonRate: e.target.value })
                      }
                      placeholder={form.privateLessonPaymentType === 'fixed' ? "30" : "50"}
                      min="0"
                    />
                  </div>
                </div>

                <div className="border-t border-border mt-4 mb-4"></div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Modo de cobro en Eventos</Label>
                    <Select
                      options={[
                        { value: 'fixed', label: 'Cantidad fija (€) por evento' },
                        { value: 'percentage', label: 'Porcentaje (%) de recaudación' },
                      ]}
                      value={form.eventPaymentType}
                      onChange={(e) => setForm({ ...form, eventPaymentType: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{form.eventPaymentType === 'fixed' ? 'Cantidad fija (€/evento)' : 'Porcentaje de Beneficio Neto (%)'}</Label>
                    <Input
                      type="number"
                      value={form.eventRate}
                      onChange={(e) =>
                        setForm({ ...form, eventRate: e.target.value })
                      }
                      placeholder={form.eventPaymentType === 'fixed' ? "50" : "60"}
                      min="0"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Primas / Bonificaciones (€)</Label>
                  <Input
                    type="number"
                    value={form.bonuses}
                    onChange={(e) => setForm({ ...form, bonuses: e.target.value })}
                    placeholder="0"
                    min="0"
                    step="10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notas salario</Label>
                  <Input
                    value={form.salaryNotes}
                    onChange={(e) => setForm({ ...form, salaryNotes: e.target.value })}
                    placeholder="Observaciones..."
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false)
                resetForm()
                setEditingCoach(null)
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!form.firstName || !form.lastName || !form.email || !form.phone}
            >
              {editingCoach ? 'Guardar cambios' : 'Crear miembro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!showDeleteConfirm}
        onOpenChange={() => setShowDeleteConfirm(null)}
        title="Eliminar miembro"
        description="Esta accion eliminara al miembro del equipo y todos sus datos asociados. Esta accion no se puede deshacer."
        variant="destructive"
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (showDeleteConfirm) deleteCoach(showDeleteConfirm)
          setShowDeleteConfirm(null)
        }}
      />

      <Dialog open={showInviteSuccess} onOpenChange={setShowInviteSuccess}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-green-600" />
              Invitacion creada
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {inviteEmailStatus === 'sending'
                ? 'Enviando el correo de activación…'
                : inviteEmailStatus === 'sent'
                ? `Hemos enviado un correo a ${inviteEmail} con el enlace de activación. También puedes compartirlo tú mismo.`
                : 'No se pudo enviar el correo automáticamente. Comparte tú este enlace para que active su cuenta.'}
            </p>
            <div className="flex gap-2">
              <Input readOnly value={inviteLink} className="flex-1 font-mono text-xs" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(inviteLink)
                }}
              >
                Copiar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">La invitacion expira en 7 dias.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowInviteSuccess(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!syncResult} onOpenChange={() => setSyncResult(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Sincronización completada
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{syncResult?.message}</p>
          <DialogFooter>
            <Button onClick={() => setSyncResult(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
