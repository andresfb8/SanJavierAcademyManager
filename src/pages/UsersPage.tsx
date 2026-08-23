import { useState, useMemo } from 'react'
import { useDataStore } from '@/stores/dataStore'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { BulkTutorInviteDialog } from '@/components/shared/BulkTutorInviteDialog'
import { InvitePlayersDialog } from '@/components/shared/InvitePlayersDialog'
import { USER_ROLES, INVITATION_STATUSES } from '@/constants'
import { formatDate, normalizeText } from '@/lib/utils'
import { createInvitation } from '@/lib/invitations'
import { sendInvitationEmail } from '@/lib/emailService'
import { buildActivationUrl, isInvitationLive } from '@/lib/invitation-utils'
import type { UserRole, InvitationStatus } from '@/types'
import { UserPlus, Copy, Check, Trash2, ShieldCheck, Search, UserX, UserCog, UserCheck, Users, Gamepad2 } from 'lucide-react'
import { doc, deleteDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

interface FirestoreUser {
  id: string
  email: string
  displayName: string
  role: UserRole
  clubId: string
  isActive: boolean
  createdAt: Date
  linkedPlayerId?: string
  linkedPlayerIds?: string[]
  roles?: UserRole[]
}

const STAFF_ROLES: UserRole[] = ['director', 'coordinador', 'entrenador']
const PORTAL_ROLES: UserRole[] = ['jugador', 'tutor']

function isStaffUser(usr: FirestoreUser): boolean {
  const roles = usr.roles && usr.roles.length > 0 ? usr.roles : [usr.role]
  return roles.some((r) => STAFF_ROLES.includes(r)) && !roles.some((r) => PORTAL_ROLES.includes(r))
}

function isPortalUser(usr: FirestoreUser): boolean {
  const roles = usr.roles && usr.roles.length > 0 ? usr.roles : [usr.role]
  return roles.some((r) => PORTAL_ROLES.includes(r))
}

export default function UsersPage() {
  // --- Tab state ---
  const [activeTab, setActiveTab] = useState<'invitations' | 'staff' | 'portal'>('invitations')

  // --- Dialog state ---
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [showBulkTutorDialog, setShowBulkTutorDialog] = useState(false)
  const [showInvitePlayersDialog, setShowInvitePlayersDialog] = useState(false)

  // --- Users state ---
  const [deactivateUserId, setDeactivateUserId] = useState<string | null>(null)

  // --- Edit roles state ---
  const [showRolesDialog, setShowRolesDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<FirestoreUser | null>(null)
  const [editingRoles, setEditingRoles] = useState<UserRole[]>([])
  const [editingLinkedPlayerId, setEditingLinkedPlayerId] = useState('')
  const [editingLinkedPlayerIds, setEditingLinkedPlayerIds] = useState<string[]>([])
  const [addingEditingPlayerId, setAddingEditingPlayerId] = useState('')

  // --- Filter state ---
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // --- Invitation form state ---
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<string>('')
  const [linkedPlayerId, setLinkedPlayerId] = useState('')
  const [linkedPlayerIds, setLinkedPlayerIds] = useState<string[]>([])
  const [addingPlayerId, setAddingPlayerId] = useState('')

  // --- Success state ---
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [inviteEmailStatus, setInviteEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const [copied, setCopied] = useState(false)

  // --- Validation state ---
  const [emailError, setEmailError] = useState('')

  // --- Invitation link copy state ---
  const [copiedInvitationId, setCopiedInvitationId] = useState('')

  // --- Store ---
  const { invitations, deleteInvitation, players, coaches, addCoach, users } = useDataStore()
  const { user } = useAuthStore()

  // --- Derived data ---
  const activePlayers = useMemo(
    () => players.filter((p) => p.status === 'activo'),
    [players]
  )

  const playerOptions = useMemo(
    () =>
      activePlayers.map((p) => ({
        value: p.id,
        label: `${p.firstName} ${p.lastName}`,
      })),
    [activePlayers]
  )

  const availableTutorPlayerOptions = useMemo(
    () => playerOptions.filter((opt) => !linkedPlayerIds.includes(opt.value)),
    [playerOptions, linkedPlayerIds]
  )

  const availableEditingTutorPlayerOptions = useMemo(
    () => playerOptions.filter((opt) => !editingLinkedPlayerIds.includes(opt.value)),
    [playerOptions, editingLinkedPlayerIds]
  )

  const roleOptions = USER_ROLES.map((r) => ({ value: r.value, label: r.label }))
  const roleFilterOptions = [{ value: '', label: 'Todos los roles' }, ...roleOptions]
  const statusFilterOptions = [
    { value: '', label: 'Todos los estados' },
    ...INVITATION_STATUSES.map((s) => ({ value: s.value, label: s.label })),
  ]

  const inviteRoleOptions = USER_ROLES.filter((r) => r.value !== 'director').map((r) => ({
    value: r.value,
    label: r.label,
  }))

  // --- Portal stats ---
  const portalStats = useMemo(() => {
    const activePortalUsers = users.filter(isPortalUser)
    const withActivePortal = new Set(
      activePortalUsers
        .filter((u) => u.isActive)
        .flatMap((u) => [
          ...(u.linkedPlayerIds || []),
          ...(u.linkedPlayerId ? [u.linkedPlayerId] : []),
        ])
    )
    const pendingInvitations = invitations.filter(
      (inv) => inv.status === 'pendiente' && PORTAL_ROLES.includes(inv.role)
    ).length
    const totalActive = players.filter((p) => p.status === 'activo').length
    return { withPortal: withActivePortal.size, pending: pendingInvitations, total: totalActive }
  }, [users, invitations, players])

  // --- Filtered invitations ---
  const filteredInvitations = useMemo(() => {
    return invitations.filter((inv) => {
      const q = normalizeText(searchTerm)
      const matchesSearch = !searchTerm || normalizeText(inv.email).includes(q)
      const matchesRole = !filterRole || inv.role === filterRole
      const matchesStatus = !filterStatus || inv.status === filterStatus
      return matchesSearch && matchesRole && matchesStatus
    })
  }, [invitations, searchTerm, filterRole, filterStatus])

  // --- Filtered staff users ---
  const filteredStaffUsers = useMemo(() => {
    return users.filter((usr) => {
      if (!isStaffUser(usr)) return false
      const q = normalizeText(searchTerm)
      const matchesSearch =
        !searchTerm ||
        normalizeText(usr.email).includes(q) ||
        normalizeText(usr.displayName).includes(q)
      const matchesRole = !filterRole || usr.role === filterRole
      return matchesSearch && matchesRole
    })
  }, [users, searchTerm, filterRole])

  // --- Filtered portal users ---
  const filteredPortalUsers = useMemo(() => {
    return users.filter((usr) => {
      if (!isPortalUser(usr)) return false
      const q = normalizeText(searchTerm)
      const matchesSearch =
        !searchTerm ||
        normalizeText(usr.email).includes(q) ||
        normalizeText(usr.displayName).includes(q) ||
        getLinkedPlayerNames(usr).toLowerCase().includes(q)
      return matchesSearch
    })
  }, [users, searchTerm, players])

  // --- Helpers ---
  function getRoleLabel(role: UserRole): string {
    return USER_ROLES.find((r) => r.value === role)?.label ?? role
  }

  function getStatusBadge(status: InvitationStatus) {
    switch (status) {
      case 'aceptada':
        return <Badge variant="success">Aceptada</Badge>
      case 'pendiente':
        return <Badge variant="warning">Pendiente</Badge>
      case 'expirada':
        return <Badge variant="secondary">Expirada</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  function getLinkedPlayerNames(inv: { linkedPlayerId?: string; linkedPlayerIds?: string[] }): string {
    if (inv.linkedPlayerIds && inv.linkedPlayerIds.length > 0) {
      const names = inv.linkedPlayerIds.map((id) => {
        const player = players.find((p) => p.id === id)
        return player ? `${player.firstName} ${player.lastName}` : 'Desconocido'
      })
      return names.join(', ')
    }
    if (inv.linkedPlayerId) {
      const player = players.find((p) => p.id === inv.linkedPlayerId)
      return player ? `${player.firstName} ${player.lastName}` : 'Desconocido'
    }
    return '—'
  }

  function getLinkedPlayerCount(usr: FirestoreUser): number {
    if (usr.linkedPlayerIds && usr.linkedPlayerIds.length > 0) return usr.linkedPlayerIds.length
    if (usr.linkedPlayerId) return 1
    return 0
  }

  // --- Handlers ---
  function resetForm() {
    setInviteEmail('')
    setInviteRole('')
    setLinkedPlayerId('')
    setLinkedPlayerIds([])
    setAddingPlayerId('')
    setInviteSuccess(false)
    setInviteLink('')
    setInviteEmailStatus('idle')
    setCopied(false)
    setEmailError('')
  }

  function handleOpenDialog() {
    resetForm()
    setShowInviteDialog(true)
  }

  function handleCloseDialog() {
    setShowInviteDialog(false)
    resetForm()
  }

  function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  async function handleSubmitInvitation() {
    setEmailError('')

    if (!inviteEmail.trim()) { setEmailError('El email es obligatorio'); return }
    if (!validateEmail(inviteEmail.trim())) { setEmailError('El formato del email no es valido'); return }
    if (!inviteRole) { setEmailError('Selecciona un rol'); return }

    if (inviteRole === 'entrenador' || inviteRole === 'coordinador') {
      const email = inviteEmail.trim().toLowerCase()
      const existingCoach = coaches.find((c) => c.email.toLowerCase() === email)
      if (!existingCoach) {
        const namePart = email.split('@')[0].replace(/[._-]/g, ' ')
        const parts = namePart.split(' ').filter(Boolean)
        const firstName = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : 'Nuevo'
        const lastName = parts.slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') || 'Miembro'
        addCoach({
          firstName, lastName, dni: '', email, phone: '',
          hireDate: new Date(), isActive: true,
          staffRole: inviteRole as 'entrenador' | 'coordinador',
        })
      }
    }

    try {
      const { activationUrl } = await createInvitation({
        email: inviteEmail,
        role: inviteRole as UserRole,
        clubId: user?.clubId ?? 'club-001',
        createdBy: user?.id ?? 'unknown',
        linkedPlayerId: inviteRole === 'jugador' && linkedPlayerId ? linkedPlayerId : undefined,
        linkedPlayerIds: inviteRole === 'tutor' && linkedPlayerIds.length > 0 ? linkedPlayerIds : undefined,
      })
      setInviteLink(activationUrl)
      setInviteSuccess(true)
      setInviteEmailStatus('sending')

      try {
        await sendInvitationEmail(
          { email: inviteEmail.trim() },
          activationUrl,
          inviteRole as UserRole
        )
        setInviteEmailStatus('sent')
      } catch (emailErr) {
        console.error('No se pudo enviar el correo de invitación:', emailErr)
        setInviteEmailStatus('failed')
      }
    } catch (err) {
      console.error('Error saving invitation to Firestore:', err)
      setEmailError('Error al guardar la invitacion. Intentalo de nuevo.')
    }
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function handleDeleteInvitation(id: string) {
    deleteInvitation(id)
    try {
      await deleteDoc(doc(db, 'invitations', id))
    } catch (err) {
      console.error('Error deleting invitation from Firestore:', err)
    }
  }

  async function handleDeactivateUser() {
    if (!deactivateUserId) return
    try {
      await updateDoc(doc(db, 'users', deactivateUserId), { isActive: false })
    } catch (err) {
      console.error('Error deactivating user:', err)
    } finally {
      setDeactivateUserId(null)
    }
  }

  async function handleReactivateUser(userId: string) {
    try {
      await updateDoc(doc(db, 'users', userId), { isActive: true })
    } catch (err) {
      console.error('Error reactivating user:', err)
    }
  }

  async function handleSaveRoles() {
    if (!editingUser || editingRoles.length === 0) return
    try {
      await updateDoc(doc(db, 'users', editingUser.id), {
        roles: editingRoles,
        role: editingRoles[0],
        linkedPlayerId: editingRoles.includes('jugador') ? editingLinkedPlayerId : '',
        linkedPlayerIds: editingRoles.includes('tutor') ? editingLinkedPlayerIds : [],
      })
      setShowRolesDialog(false)
      setEditingUser(null)
    } catch (err) {
      console.error('Error updating user roles:', err)
    }
  }

  function toggleRole(role: UserRole) {
    if (editingRoles.includes(role)) {
      if (editingRoles.length > 1) setEditingRoles((prev) => prev.filter((r) => r !== role))
    } else {
      setEditingRoles((prev) => [...prev, role])
    }
  }

  function handleAddTutorPlayer() {
    if (addingPlayerId && !linkedPlayerIds.includes(addingPlayerId)) {
      setLinkedPlayerIds((prev) => [...prev, addingPlayerId])
      setAddingPlayerId('')
    }
  }

  function handleRemoveTutorPlayer(playerId: string) {
    setLinkedPlayerIds((prev) => prev.filter((id) => id !== playerId))
  }

  function handleAddEditingTutorPlayer() {
    if (addingEditingPlayerId && !editingLinkedPlayerIds.includes(addingEditingPlayerId)) {
      setEditingLinkedPlayerIds((prev) => [...prev, addingEditingPlayerId])
      setAddingEditingPlayerId('')
    }
  }

  function handleRemoveEditingTutorPlayer(playerId: string) {
    setEditingLinkedPlayerIds((prev) => prev.filter((id) => id !== playerId))
  }

  function openEditUser(usr: FirestoreUser) {
    setEditingUser(usr)
    setEditingRoles(usr.roles && usr.roles.length > 0 ? [...usr.roles] : [usr.role])
    setEditingLinkedPlayerId(usr.linkedPlayerId || '')
    setEditingLinkedPlayerIds(usr.linkedPlayerIds ? [...usr.linkedPlayerIds] : [])
    setAddingEditingPlayerId('')
    setShowRolesDialog(true)
  }

  const tabs = [
    { id: 'invitations' as const, label: 'Invitaciones', count: invitations.filter(i => i.status === 'pendiente').length },
    { id: 'staff' as const, label: 'Personal del club', count: filteredStaffUsers.length },
    { id: 'portal' as const, label: 'Portal de jugadores', count: users.filter(isPortalUser).length },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-6 pt-6 pb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-7 w-7" />
            Gestion de Usuarios
          </h1>
          <p className="text-muted-foreground">
            Administra el acceso al sistema y el portal de jugadores
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowBulkTutorDialog(true)}>
            <Users className="h-4 w-4 mr-2" />
            Invitar tutores
          </Button>
          <Button variant="outline" onClick={() => setShowInvitePlayersDialog(true)}>
            <Gamepad2 className="h-4 w-4 mr-2" />
            Invitar jugadores
          </Button>
          <Button onClick={handleOpenDialog}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invitar usuario
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-4">
        <div className="flex gap-1 border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`px-4 py-2 font-medium text-sm transition-colors relative flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => { setActiveTab(tab.id); setSearchTerm(''); setFilterRole(''); setFilterStatus('') }}
            >
              {tab.id === 'staff' && <Users className="h-3.5 w-3.5" />}
              {tab.id === 'portal' && <Gamepad2 className="h-3.5 w-3.5" />}
              {tab.label}
              {tab.count > 0 && (
                <span className={`inline-flex items-center justify-center rounded-full text-[11px] font-semibold px-1.5 min-w-[20px] h-5 ${
                  activeTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                }`}>
                  {tab.count}
                </span>
              )}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-4">

        {/* Portal stats banner — only on portal tab */}
        {activeTab === 'portal' && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border bg-emerald-50 border-emerald-200 p-3 text-center">
              <p className="text-2xl font-bold text-emerald-700">{portalStats.withPortal}</p>
              <p className="text-xs text-emerald-600 mt-0.5">Con portal activo</p>
            </div>
            <div className="rounded-lg border bg-amber-50 border-amber-200 p-3 text-center">
              <p className="text-2xl font-bold text-amber-700">{portalStats.pending}</p>
              <p className="text-xs text-amber-600 mt-0.5">Invitaciones pendientes</p>
            </div>
            <div className="rounded-lg border bg-muted p-3 text-center">
              <p className="text-2xl font-bold text-muted-foreground">{portalStats.total - portalStats.withPortal - portalStats.pending}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Sin acceso</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={
                  activeTab === 'invitations' ? 'Buscar por email...' :
                  activeTab === 'portal' ? 'Buscar por email o jugador...' :
                  'Buscar por email o nombre...'
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          {activeTab !== 'portal' && (
            <div className="w-full sm:w-48">
              <Select
                options={roleFilterOptions}
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
              />
            </div>
          )}
          {activeTab === 'invitations' && (
            <div className="w-full sm:w-48">
              <Select
                options={statusFilterOptions}
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* ── Tab: Invitaciones ── */}
        {activeTab === 'invitations' && (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Jugador vinculado</TableHead>
                  <TableHead>Fecha creacion</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvitations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      {invitations.length === 0
                        ? 'No hay invitaciones. Haz clic en "Invitar usuario" para crear una.'
                        : 'No se encontraron invitaciones con los filtros aplicados.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvitations.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.email}</TableCell>
                      <TableCell>{getRoleLabel(inv.role)}</TableCell>
                      <TableCell>{getStatusBadge(inv.status)}</TableCell>
                      <TableCell>
                        {inv.linkedPlayerIds && inv.linkedPlayerIds.length > 0 ? (
                          <span title={getLinkedPlayerNames(inv)}>
                            {inv.linkedPlayerIds.length} jugador{inv.linkedPlayerIds.length > 1 ? 'es' : ''}
                            {' — '}{getLinkedPlayerNames(inv)}
                          </span>
                        ) : inv.linkedPlayerId ? (
                          getLinkedPlayerNames(inv)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(inv.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        {isInvitationLive(inv) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Copiar enlace de activación"
                            onClick={() => {
                              navigator.clipboard.writeText(buildActivationUrl(inv.token))
                                .then(() => {
                                  setCopiedInvitationId(inv.id)
                                  setTimeout(() => setCopiedInvitationId(''), 2000)
                                })
                                .catch((err) => console.error('No se pudo copiar el enlace:', err))
                            }}
                          >
                            {copiedInvitationId === inv.id
                              ? <Check className="h-4 w-4 text-green-600" />
                              : <Copy className="h-4 w-4" />}
                          </Button>
                        )}
                        {inv.status === 'pendiente' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteInvitation(inv.id)}
                            title="Eliminar invitacion"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* ── Tab: Personal del club ── */}
        {activeTab === 'staff' && (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Alta</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaffUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No hay personal del club registrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStaffUsers.map((usr) => (
                    <TableRow key={usr.id}>
                      <TableCell className="font-medium">{usr.displayName}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{usr.email}</TableCell>
                      <TableCell>
                        {usr.roles && usr.roles.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {usr.roles.map((r) => (
                              <Badge key={r} variant="outline" className="text-xs">
                                {getRoleLabel(r)}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-xs">{getRoleLabel(usr.role)}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {usr.isActive ? (
                          <Badge variant="success">Activo</Badge>
                        ) : (
                          <Badge variant="secondary">Inactivo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(usr.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEditUser(usr)} title="Gestionar roles">
                          <UserCog className="h-4 w-4 text-primary" />
                        </Button>
                        {usr.isActive ? (
                          <Button variant="ghost" size="icon" onClick={() => setDeactivateUserId(usr.id)} title="Desactivar usuario">
                            <UserX className="h-4 w-4 text-destructive" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" onClick={() => handleReactivateUser(usr.id)} title="Reactivar usuario">
                            <UserCheck className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* ── Tab: Portal de jugadores ── */}
        {activeTab === 'portal' && (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jugador(es) vinculado(s)</TableHead>
                  <TableHead>Email de acceso</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado portal</TableHead>
                  <TableHead>Alta</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPortalUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      {users.filter(isPortalUser).length === 0
                        ? 'Aún no hay jugadores con acceso al portal. Usa "Invitar usuario" para empezar.'
                        : 'No se encontraron usuarios con ese criterio.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPortalUsers.map((usr) => {
                    const playerCount = getLinkedPlayerCount(usr)
                    const playerNames = getLinkedPlayerNames(usr)
                    const isTutor = (usr.roles || [usr.role]).includes('tutor')
                    return (
                      <TableRow key={usr.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                              {playerCount > 1 ? playerCount : playerNames.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                {playerNames === '—' ? <span className="text-muted-foreground italic">Sin vincular</span> : playerNames}
                              </p>
                              {playerCount === 0 && (
                                <p className="text-xs text-amber-600">⚠ Vincular jugador recomendado</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{usr.email}</TableCell>
                        <TableCell>
                          <Badge variant={isTutor ? 'secondary' : 'outline'} className="text-xs">
                            {isTutor ? 'Tutor' : 'Jugador'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {usr.isActive ? (
                            <Badge variant="success">Activo</Badge>
                          ) : (
                            <Badge variant="secondary">Inactivo</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(usr.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEditUser(usr)} title="Editar vinculación">
                            <UserCog className="h-4 w-4 text-primary" />
                          </Button>
                          {usr.isActive ? (
                            <Button variant="ghost" size="icon" onClick={() => setDeactivateUserId(usr.id)} title="Desactivar acceso">
                              <UserX className="h-4 w-4 text-destructive" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" onClick={() => handleReactivateUser(usr.id)} title="Reactivar acceso">
                              <UserCheck className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Deactivate User Confirmation Dialog */}
      <BulkTutorInviteDialog
        open={showBulkTutorDialog}
        onOpenChange={setShowBulkTutorDialog}
      />

      <InvitePlayersDialog
        open={showInvitePlayersDialog}
        onOpenChange={setShowInvitePlayersDialog}
      />

      <ConfirmDialog
        open={deactivateUserId !== null}
        onOpenChange={(open) => !open && setDeactivateUserId(null)}
        title="Desactivar acceso"
        description="Esta accion desactivara el acceso al portal. Puedes reactivarlo mas tarde si es necesario."
        confirmLabel="Desactivar"
        cancelLabel="Cancelar"
        variant="destructive"
        onConfirm={handleDeactivateUser}
      />

      {/* Edit Roles Dialog */}
      <Dialog open={showRolesDialog} onOpenChange={setShowRolesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gestionar roles de usuario</DialogTitle>
            <DialogDescription>
              Roles y vinculacion para {editingUser?.displayName || editingUser?.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-2">
              {USER_ROLES.map((role) => {
                const isSelected = editingRoles.includes(role.value)
                return (
                  <div
                    key={role.value}
                    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                    }`}
                    onClick={() => toggleRole(role.value)}
                  >
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-primary bg-primary' : 'border-input'}`}>
                      {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                    <span className="text-sm font-medium">{role.label}</span>
                  </div>
                )
              })}
            </div>
            {editingRoles.length === 0 && (
              <p className="text-sm text-destructive">Debes seleccionar al menos un rol.</p>
            )}

            {editingRoles.includes('jugador') && (
              <div className="space-y-2 mt-4 pt-4 border-t">
                <Label htmlFor="edit-linked-player">Vincular jugador (Rol: Jugador)</Label>
                <Select
                  id="edit-linked-player"
                  options={playerOptions}
                  placeholder="Selecciona un jugador"
                  value={editingLinkedPlayerId}
                  onChange={(e) => setEditingLinkedPlayerId(e.target.value)}
                />
                {!editingLinkedPlayerId && <p className="text-xs text-amber-500">Es recomendable vincular un jugador para que el portal funcione.</p>}
              </div>
            )}

            {editingRoles.includes('tutor') && (
              <div className="space-y-2 mt-4 pt-4 border-t">
                <Label>Vincular jugadores (Rol: Tutor)</Label>
                {editingLinkedPlayerIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {editingLinkedPlayerIds.map((pid) => {
                      const player = players.find((p) => p.id === pid)
                      const name = player ? `${player.firstName} ${player.lastName}` : 'Desconocido'
                      return (
                        <Badge key={pid} variant="secondary" className="flex items-center gap-1">
                          {name}
                          <button type="button" onClick={() => handleRemoveEditingTutorPlayer(pid)} className="ml-1 rounded-full hover:bg-muted p-0.5">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </Badge>
                      )
                    })}
                  </div>
                )}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Select
                      options={availableEditingTutorPlayerOptions}
                      placeholder="Anadir un jugador"
                      value={addingEditingPlayerId}
                      onChange={(e) => setAddingEditingPlayerId(e.target.value)}
                    />
                  </div>
                  <Button type="button" variant="outline" onClick={handleAddEditingTutorPlayer} disabled={!addingEditingPlayerId}>
                    Anadir
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRolesDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveRoles} disabled={editingRoles.length === 0}>Guardar cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          {!inviteSuccess ? (
            <>
              <DialogHeader>
                <DialogTitle>Invitar usuario</DialogTitle>
                <DialogDescription>
                  Crea una invitacion para que un nuevo usuario se registre en la academia.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="usuario@ejemplo.com"
                    value={inviteEmail}
                    onChange={(e) => { setInviteEmail(e.target.value); setEmailError('') }}
                  />
                  {emailError && <p className="text-sm text-destructive">{emailError}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invite-role">Rol</Label>
                  <Select
                    id="invite-role"
                    options={inviteRoleOptions}
                    placeholder="Selecciona un rol"
                    value={inviteRole}
                    onChange={(e) => {
                      setInviteRole(e.target.value)
                      setLinkedPlayerId('')
                      setLinkedPlayerIds([])
                      setAddingPlayerId('')
                    }}
                  />
                </div>

                {inviteRole === 'jugador' && (
                  <div className="space-y-2">
                    <Label htmlFor="linked-player">Vincular jugador</Label>
                    <Select
                      id="linked-player"
                      options={playerOptions}
                      placeholder="Selecciona un jugador (opcional)"
                      value={linkedPlayerId}
                      onChange={(e) => setLinkedPlayerId(e.target.value)}
                    />
                  </div>
                )}

                {inviteRole === 'tutor' && (
                  <div className="space-y-2">
                    <Label>Vincular jugadores</Label>
                    {linkedPlayerIds.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {linkedPlayerIds.map((pid) => {
                          const player = players.find((p) => p.id === pid)
                          const name = player ? `${player.firstName} ${player.lastName}` : 'Desconocido'
                          return (
                            <Badge key={pid} variant="secondary" className="flex items-center gap-1">
                              {name}
                              <button type="button" onClick={() => handleRemoveTutorPlayer(pid)} className="ml-1 rounded-full hover:bg-muted p-0.5" title="Quitar jugador">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </Badge>
                          )
                        })}
                      </div>
                    )}
                    {availableTutorPlayerOptions.length > 0 && (
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Select
                            options={availableTutorPlayerOptions}
                            placeholder="Selecciona un jugador"
                            value={addingPlayerId}
                            onChange={(e) => setAddingPlayerId(e.target.value)}
                          />
                        </div>
                        <Button type="button" variant="outline" onClick={handleAddTutorPlayer} disabled={!addingPlayerId}>
                          Anadir
                        </Button>
                      </div>
                    )}
                    {availableTutorPlayerOptions.length === 0 && linkedPlayerIds.length > 0 && (
                      <p className="text-sm text-muted-foreground">Todos los jugadores activos ya estan vinculados.</p>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDialog}>Cancelar</Button>
                <Button onClick={handleSubmitInvitation}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Crear invitacion
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-600" />
                  Invitacion creada correctamente
                </DialogTitle>
                <DialogDescription>
                  {inviteEmailStatus === 'sending'
                    ? 'Enviando el correo de activación…'
                    : inviteEmailStatus === 'sent'
                    ? `Hemos enviado un correo a ${inviteEmail} con el enlace de activación. También puedes compartirlo tú mismo.`
                    : 'No se pudo enviar el correo automáticamente. Comparte tú este enlace para que pueda activar su cuenta.'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Enlace de activacion</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={inviteLink} className="flex-1 font-mono text-xs" />
                    <Button variant="outline" onClick={handleCopyLink} className="shrink-0">
                      {copied ? (
                        <><Check className="h-4 w-4 mr-2 text-green-600" />Copiado</>
                      ) : (
                        <><Copy className="h-4 w-4 mr-2" />Copiar enlace</>
                      )}
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  La invitacion expira en 7 dias. El usuario debe acceder al enlace para activar su cuenta.
                </p>
              </div>

              <DialogFooter>
                <Button onClick={handleCloseDialog}>Cerrar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
