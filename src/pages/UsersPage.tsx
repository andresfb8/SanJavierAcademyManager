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
import { USER_ROLES, INVITATION_STATUSES } from '@/constants'
import { formatDate, generateId } from '@/lib/utils'
import type { UserRole, InvitationStatus } from '@/types'
import { UserPlus, Copy, Check, Trash2, ShieldCheck, Search } from 'lucide-react'

export default function UsersPage() {
  // --- Dialog state ---
  const [showInviteDialog, setShowInviteDialog] = useState(false)

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
  const [copied, setCopied] = useState(false)

  // --- Validation state ---
  const [emailError, setEmailError] = useState('')

  // --- Store ---
  const { invitations, addInvitation, deleteInvitation, players, coaches, addCoach } = useDataStore()
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

  // Available players for tutor multi-select (exclude already selected)
  const availableTutorPlayerOptions = useMemo(
    () => playerOptions.filter((opt) => !linkedPlayerIds.includes(opt.value)),
    [playerOptions, linkedPlayerIds]
  )

  const roleOptions = USER_ROLES.map((r) => ({ value: r.value, label: r.label }))
  const roleFilterOptions = [{ value: '', label: 'Todos los roles' }, ...roleOptions]
  const statusFilterOptions = [
    { value: '', label: 'Todos los estados' },
    ...INVITATION_STATUSES.map((s) => ({ value: s.value, label: s.label })),
  ]

  // Roles available for invitation (exclude 'director' — only one director allowed)
  const inviteRoleOptions = USER_ROLES.filter((r) => r.value !== 'director').map((r) => ({
    value: r.value,
    label: r.label,
  }))

  // --- Filtered invitations ---
  const filteredInvitations = useMemo(() => {
    return invitations.filter((inv) => {
      const matchesSearch =
        !searchTerm || inv.email.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesRole = !filterRole || inv.role === filterRole
      const matchesStatus = !filterStatus || inv.status === filterStatus
      return matchesSearch && matchesRole && matchesStatus
    })
  }, [invitations, searchTerm, filterRole, filterStatus])

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
      const names = inv.linkedPlayerIds
        .map((id) => {
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

  // --- Handlers ---
  function resetForm() {
    setInviteEmail('')
    setInviteRole('')
    setLinkedPlayerId('')
    setLinkedPlayerIds([])
    setAddingPlayerId('')
    setInviteSuccess(false)
    setInviteLink('')
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

  function handleSubmitInvitation() {
    // Validate
    setEmailError('')

    if (!inviteEmail.trim()) {
      setEmailError('El email es obligatorio')
      return
    }
    if (!validateEmail(inviteEmail.trim())) {
      setEmailError('El formato del email no es valido')
      return
    }
    if (!inviteRole) {
      setEmailError('Selecciona un rol')
      return
    }

    // Generate token and URL
    const token = generateId()
    const activationUrl = `${window.location.origin}/activar/${token}`

    // Build invitation data
    const now = new Date()
    const expiresAt = new Date(now)
    expiresAt.setDate(expiresAt.getDate() + 7) // Expires in 7 days

    const invitationData: Omit<import('@/types').Invitation, 'id'> = {
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole as UserRole,
      clubId: user?.clubId ?? 'club-001',
      status: 'pendiente',
      token,
      createdBy: user?.id ?? 'unknown',
      createdAt: now,
      expiresAt,
    }

    // Link player(s) based on role
    if (inviteRole === 'jugador' && linkedPlayerId) {
      invitationData.linkedPlayerId = linkedPlayerId
    }
    if (inviteRole === 'tutor' && linkedPlayerIds.length > 0) {
      invitationData.linkedPlayerIds = [...linkedPlayerIds]
    }

    addInvitation(invitationData)

    // Auto-create coach entry for staff roles
    if (inviteRole === 'entrenador' || inviteRole === 'coordinador') {
      const email = inviteEmail.trim().toLowerCase()
      const existingCoach = coaches.find((c) => c.email.toLowerCase() === email)
      if (!existingCoach) {
        // Derive name from email (part before @)
        const namePart = email.split('@')[0].replace(/[._-]/g, ' ')
        const parts = namePart.split(' ').filter(Boolean)
        const firstName = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : 'Nuevo'
        const lastName = parts.slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') || 'Miembro'
        addCoach({
          firstName,
          lastName,
          dni: '',
          email,
          phone: '',
          hireDate: new Date(),
          isActive: true,
          staffRole: inviteRole as 'entrenador' | 'coordinador',
        })
      }
    }

    // Show success
    setInviteLink(activationUrl)
    setInviteSuccess(true)
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleDeleteInvitation(id: string) {
    deleteInvitation(id)
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

  // --- Render ---
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
            Administra los usuarios y envia invitaciones
          </p>
        </div>
        <Button onClick={handleOpenDialog}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invitar usuario
        </Button>
      </div>

      <div className="p-6 space-y-4">

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="w-full sm:w-48">
          <Select
            options={roleFilterOptions}
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            options={statusFilterOptions}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
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
                        {' — '}
                        {getLinkedPlayerNames(inv)}
                      </span>
                    ) : inv.linkedPlayerId ? (
                      getLinkedPlayerNames(inv)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(inv.createdAt)}</TableCell>
                  <TableCell className="text-right">
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
      </div>

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
                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="usuario@ejemplo.com"
                    value={inviteEmail}
                    onChange={(e) => {
                      setInviteEmail(e.target.value)
                      setEmailError('')
                    }}
                  />
                  {emailError && (
                    <p className="text-sm text-destructive">{emailError}</p>
                  )}
                </div>

                {/* Role */}
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

                {/* Player linking: jugador role */}
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

                {/* Player linking: tutor role (multi-select) */}
                {inviteRole === 'tutor' && (
                  <div className="space-y-2">
                    <Label>Vincular jugadores</Label>

                    {/* Already selected players */}
                    {linkedPlayerIds.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {linkedPlayerIds.map((pid) => {
                          const player = players.find((p) => p.id === pid)
                          const name = player
                            ? `${player.firstName} ${player.lastName}`
                            : 'Desconocido'
                          return (
                            <Badge key={pid} variant="secondary" className="flex items-center gap-1">
                              {name}
                              <button
                                type="button"
                                onClick={() => handleRemoveTutorPlayer(pid)}
                                className="ml-1 rounded-full hover:bg-muted p-0.5"
                                title="Quitar jugador"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </Badge>
                          )
                        })}
                      </div>
                    )}

                    {/* Add player selector */}
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
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleAddTutorPlayer}
                          disabled={!addingPlayerId}
                        >
                          Anadir
                        </Button>
                      </div>
                    )}

                    {availableTutorPlayerOptions.length === 0 && linkedPlayerIds.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Todos los jugadores activos ya estan vinculados.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
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
                  Comparte el siguiente enlace con el usuario para que pueda activar su cuenta.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Enlace de activacion</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={inviteLink}
                      className="flex-1 font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      onClick={handleCopyLink}
                      className="shrink-0"
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 mr-2 text-green-600" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copiar enlace
                        </>
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
