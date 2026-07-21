import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
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
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { useDataStore } from '@/stores/dataStore'
import {
  Plus,
  Mail,
  Phone,
  Calendar,
  Award,
  Users,
  Search,
  Edit2,
  Trash2,
  LayoutGrid,
  List,
  Euro,
  Eye,
  UserPlus,
} from 'lucide-react'
import { formatDate, formatCurrency, normalizeText } from '@/lib/utils'
import { STAFF_ROLES } from '@/constants'
import type { Coach, StaffRole } from '@/types'
import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/stores/authStore'
import { createInvitation } from '@/lib/invitations'
import { sendInvitationEmail } from '@/lib/emailService'
import { useEventPaymentsQuery } from '@/hooks/useQueries'
import { calculateEventSalary } from '@/lib/salary-utils'


// ==========================================
// CoachesPage - Gestion de personal (entrenadores y coordinadores)
// ==========================================

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

  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<string>('active')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards')
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

  const resetForm = () => setForm({ ...emptyForm })

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

    // Salary from groups
    const groupsSalary = (adultGroupsCount * (config.ratePerGroupAdults || 0)) + (minorsGroupsCount * (config.ratePerGroupMinors || 0))

    const now = new Date()

    // Salary from private lessons (current month)
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

    // Salary from events (current month) — based on net profit
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
      // Update salary config
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
      // Save initial salary config
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

  const openCreateDialog = () => {
    resetForm()
    setEditingCoach(null)
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
      // createInvitation persiste en Firestore (la ruta /activar/{token} la lee de
      // ahí); addInvitation solo escribía el store local, así que el enlace nunca
      // se podía activar. Mismo mecanismo que jugadores y tutores.
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

  const activeCount = coaches.filter((c) => c.isActive).length

  // Repair: match existing user accounts to coach records that are missing a userId
  const handleSyncAccounts = async () => {
    const clubId = user?.clubId
    if (!clubId) return
    setIsSyncing(true)
    try {
      // 1. Load all coach/coordinador users from Firestore
      const usersSnap = await getDocs(
        query(
          collection(db, 'users'),
          where('clubId', '==', clubId),
          where('role', 'in', ['entrenador', 'coordinador'])
        )
      )
      const staffUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() as { email: string } }))

      // 2. Load coaches missing a userId
      const coachesSnap = await getDocs(
        query(collection(db, 'coaches'), where('clubId', '==', clubId))
      )

      let fixed = 0
      for (const coachDoc of coachesSnap.docs) {
        const coachData = coachDoc.data()
        if (coachData.userId) continue // Already linked

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

  return (
    <div>
      <Header
        title="Personal"
        subtitle={`${activeCount} activos · ${coaches.length} total`}
        actions={
          <div className="flex gap-2">
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
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-1" />
              Nuevo miembro
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, email o telefono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
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
          <div className="flex gap-1 border rounded-md p-1">
            <Button
              variant={viewMode === 'cards' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('cards')}
              className="h-8 px-2"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="h-8 px-2"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Contenido */}
        {filteredCoaches.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No hay personal"
            description="Anade tu primer miembro del equipo para empezar a gestionar el personal"
            action={{ label: 'Anadir miembro', onClick: openCreateDialog }}
          />
        ) : viewMode === 'cards' ? (
          /* ====== VISTA CARDS ====== */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCoaches.map((coach) => {
              const coachGroups = getCoachGroups(coach.id)
              const salary = getEstimatedSalary(coach.id)
              const config = getSalaryConfig(coach.id)
              return (
                <Card key={coach.id} className="flex flex-col overflow-hidden border-border/60 shadow-[var(--shadow-card)] hover-lift">
                  <CardContent className="flex flex-col flex-1 p-5">
                    <div className="flex items-start gap-4 mb-4">
                      <Avatar className="h-14 w-14">
                        <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                          {coach.firstName[0]}
                          {coach.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-base truncate">
                            {coach.firstName} {coach.lastName}
                          </h3>
                          <Badge variant={getStaffRoleBadgeVariant(coach.staffRole)} className="shrink-0">
                            {getStaffRoleLabel(coach.staffRole)}
                          </Badge>
                          <Badge
                            variant={coach.isActive ? 'success' : 'secondary'}
                            className="shrink-0"
                          >
                            {coach.isActive ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {coach.specialization && (
                            <p className="text-sm text-muted-foreground truncate">
                              {coach.specialization}
                            </p>
                          )}
                          <Badge variant={coach.userId ? 'success' : 'secondary'} className="text-[10px] shrink-0">
                            {coach.userId ? 'Con cuenta' : 'Sin cuenta'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4 flex-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{coach.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span>{coach.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span>Contratado: {formatDate(coach.hireDate)}</span>
                      </div>
                      {coach.certifications && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Award className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{coach.certifications}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {coachGroups.length === 0
                            ? 'Sin grupos asignados'
                            : `${coachGroups.length} grupo${coachGroups.length > 1 ? 's' : ''}`}
                        </span>
                      </div>
                      {config && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Euro className="h-3.5 w-3.5 shrink-0" />
                          <span className="font-medium text-foreground">
                            Salario est.: {formatCurrency(salary)}
                          </span>
                        </div>
                      )}
                    </div>

                    {coachGroups.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {coachGroups.map((group) => (
                          <Badge key={group.id} variant="outline" className="text-xs">
                            {group.name}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-3 border-t border-border/60 mt-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/entrenadores/${coach.id}`)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                        Ver perfil
                      </Button>
                      {!coach.userId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCreateAccount(coach)}
                        >
                          <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                          Crear cuenta
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => openEditDialog(coach)}
                      >
                        <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setShowDeleteConfirm(coach.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          /* ====== VISTA LISTA ====== */
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead className="hidden lg:table-cell">Especializacion</TableHead>
                    <TableHead className="text-center">Grupos</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Salario est.</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCoaches.map((coach) => {
                    const coachGroups = getCoachGroups(coach.id)
                    const salary = getEstimatedSalary(coach.id)
                    return (
                      <TableRow key={coach.id}>
                        <TableCell>
                          <button
                            className="flex items-center gap-3 text-left hover:underline"
                            onClick={() => navigate(`/entrenadores/${coach.id}`)}
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                                {coach.firstName[0]}{coach.lastName[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">
                                {coach.firstName} {coach.lastName}
                              </span>
                              <Badge variant={coach.userId ? 'success' : 'secondary'} className="text-[10px] w-fit mt-0.5">
                                {coach.userId ? 'Con cuenta' : 'Sin cuenta'}
                              </Badge>
                            </div>
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStaffRoleBadgeVariant(coach.staffRole)}>
                            {getStaffRoleLabel(coach.staffRole)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm hidden md:table-cell">{coach.email}</TableCell>
                        <TableCell className="text-sm text-muted-foreground hidden lg:table-cell">
                          {coach.specialization || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{coachGroups.length}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium hidden md:table-cell">
                          {formatCurrency(salary)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={coach.isActive ? 'success' : 'secondary'}>
                            {coach.isActive ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!coach.userId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Crear cuenta de usuario"
                                onClick={() => handleCreateAccount(coach)}
                              >
                                <UserPlus className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(coach)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setShowDeleteConfirm(coach.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialogo de creacion/edicion */}
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

            {/* Seccion Salario */}
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

      {/* Dialogo de confirmacion de eliminacion */}
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

      {/* Dialogo de cuenta creada */}
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
      {/* Sync result dialog */}
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
