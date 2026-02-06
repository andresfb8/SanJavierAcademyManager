import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useDataStore } from '@/stores/dataStore'
import { isMinor as checkIsMinor } from '@/lib/utils'
import {
  PLAYER_LEVELS,
  PLAYER_STATUSES,
  DOMINANT_HANDS,
  PLAYER_POSITIONS,
  GUARDIAN_RELATIONSHIPS,
} from '@/constants'
import {
  Plus,
  Search,
  Upload,
  Download,
  Users,
  Mail,
  Phone,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  UserX,
  Filter,
} from 'lucide-react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import type { Player, PlayerLevel, PlayerStatus } from '@/types'

export default function PlayersPage() {
  const navigate = useNavigate()
  const { players, addPlayer, updatePlayer, cancelPlayer, deletePlayer } = useDataStore()
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState<string | null>(null)

  // Form state
  const [form, setForm] = useState({
    firstName: '', lastName: '', dni: '', birthDate: '',
    email: '', phone: '', address: '', city: 'San Javier', postalCode: '30730',
    level: 'iniciacion' as PlayerLevel, dominantHand: 'derecha' as 'derecha' | 'izquierda',
    position: 'ambos' as 'drive' | 'reves' | 'ambos',
    previousExperience: '', medicalNotes: '',
    bankAccountHolder: '', iban: '',
    status: 'activo' as PlayerStatus, notes: '',
    // Guardian
    guardianFirstName: '', guardianLastName: '', guardianDni: '',
    guardianPhone: '', guardianEmail: '', guardianRelationship: 'padre' as 'padre' | 'madre' | 'tutor',
  })

  const resetForm = () => {
    setForm({
      firstName: '', lastName: '', dni: '', birthDate: '',
      email: '', phone: '', address: '', city: 'San Javier', postalCode: '30730',
      level: 'iniciacion', dominantHand: 'derecha', position: 'ambos',
      previousExperience: '', medicalNotes: '',
      bankAccountHolder: '', iban: '',
      status: 'activo', notes: '',
      guardianFirstName: '', guardianLastName: '', guardianDni: '',
      guardianPhone: '', guardianEmail: '', guardianRelationship: 'padre',
    })
  }

  const isMinorForm = form.birthDate ? checkIsMinor(new Date(form.birthDate)) : false

  const filteredPlayers = useMemo(() => {
    return players.filter((p) => {
      const matchesSearch = search === '' ||
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        p.email.toLowerCase().includes(search.toLowerCase()) ||
        p.phone.includes(search)
      const matchesLevel = levelFilter === '' || p.level === levelFilter
      const matchesStatus = statusFilter === '' || p.status === statusFilter
      return matchesSearch && matchesLevel && matchesStatus
    })
  }, [players, search, levelFilter, statusFilter])

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

  const handleSubmit = () => {
    const birthDate = new Date(form.birthDate)
    const playerIsMinor = checkIsMinor(birthDate)

    const playerData = {
      firstName: form.firstName,
      lastName: form.lastName,
      dni: form.dni,
      birthDate,
      email: form.email,
      phone: form.phone,
      address: form.address,
      city: form.city,
      postalCode: form.postalCode,
      level: form.level,
      dominantHand: form.dominantHand,
      position: form.position,
      previousExperience: form.previousExperience || undefined,
      medicalNotes: form.medicalNotes || undefined,
      bankAccountHolder: form.bankAccountHolder,
      iban: form.iban,
      status: form.status,
      registrationDate: new Date(),
      isMinor: playerIsMinor,
      guardian: playerIsMinor ? {
        firstName: form.guardianFirstName,
        lastName: form.guardianLastName,
        dni: form.guardianDni,
        phone: form.guardianPhone,
        email: form.guardianEmail,
        relationship: form.guardianRelationship,
      } : undefined,
      notes: form.notes || undefined,
    }

    if (editingPlayer) {
      updatePlayer(editingPlayer.id, playerData)
      setEditingPlayer(null)
    } else {
      addPlayer(playerData)
    }
    setShowCreateDialog(false)
    resetForm()
  }

  const openEditDialog = (player: Player) => {
    setForm({
      firstName: player.firstName,
      lastName: player.lastName,
      dni: player.dni,
      birthDate: player.birthDate.toISOString().split('T')[0],
      email: player.email,
      phone: player.phone,
      address: player.address,
      city: player.city,
      postalCode: player.postalCode,
      level: player.level,
      dominantHand: player.dominantHand,
      position: player.position,
      previousExperience: player.previousExperience || '',
      medicalNotes: player.medicalNotes || '',
      bankAccountHolder: player.bankAccountHolder,
      iban: player.iban,
      status: player.status,
      notes: player.notes || '',
      guardianFirstName: player.guardian?.firstName || '',
      guardianLastName: player.guardian?.lastName || '',
      guardianDni: player.guardian?.dni || '',
      guardianPhone: player.guardian?.phone || '',
      guardianEmail: player.guardian?.email || '',
      guardianRelationship: player.guardian?.relationship || 'padre',
    })
    setEditingPlayer(player)
    setShowCreateDialog(true)
  }

  const handleExport = () => {
    const headers = ['Nombre', 'Apellidos', 'DNI', 'Email', 'Teléfono', 'Nivel', 'Estado']
    const rows = filteredPlayers.map((p) => [
      p.firstName, p.lastName, p.dni, p.email, p.phone, p.level, p.status,
    ])
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `jugadores_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <Header
        title="Jugadores"
        subtitle={`${players.filter((p) => p.status === 'activo').length} activos · ${players.length} total`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" />
              Exportar
            </Button>
            <Button size="sm" onClick={() => { resetForm(); setEditingPlayer(null); setShowCreateDialog(true) }}>
              <Plus className="h-4 w-4 mr-1" />
              Nuevo jugador
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, email o teléfono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            options={[{ value: '', label: 'Todos los niveles' }, ...PLAYER_LEVELS.map((l) => ({ value: l.value, label: l.label }))]}
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="w-full sm:w-48"
          />
          <Select
            options={[{ value: '', label: 'Todos los estados' }, ...PLAYER_STATUSES.map((s) => ({ value: s.value, label: s.label }))]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-48"
          />
        </div>

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
            <span className="text-sm font-medium">{selectedIds.size} seleccionados</span>
            <Button variant="outline" size="sm" onClick={() => {
              selectedIds.forEach((id) => cancelPlayer(id))
              setSelectedIds(new Set())
            }}>
              <UserX className="h-4 w-4 mr-1" />
              Dar de baja
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              Deseleccionar
            </Button>
          </div>
        )}

        {/* Table */}
        {filteredPlayers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No hay jugadores"
            description="Añade tu primer jugador para empezar a gestionar tu escuela"
            action={{ label: 'Añadir jugador', onClick: () => setShowCreateDialog(true) }}
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 w-10">
                        <Checkbox
                          checked={selectedIds.size === filteredPlayers.length && filteredPlayers.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">Jugador</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden md:table-cell">Contacto</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">Nivel</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">Estado</th>
                      <th className="p-3 text-right text-sm font-medium text-muted-foreground w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlayers.map((player) => (
                      <tr
                        key={player.id}
                        className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => navigate(`/jugadores/${player.id}`)}
                      >
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(player.id)}
                            onCheckedChange={() => toggleSelect(player.id)}
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium shrink-0">
                              {player.firstName[0]}{player.lastName[0]}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{player.firstName} {player.lastName}</p>
                              <p className="text-xs text-muted-foreground">
                                {player.isMinor && '👶 Menor · '}{player.dni}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 hidden md:table-cell">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Mail className="h-3.5 w-3.5" />
                              {player.email}
                            </div>
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Phone className="h-3.5 w-3.5" />
                              {player.phone}
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <StatusBadge status={player.level} />
                        </td>
                        <td className="p-3">
                          <StatusBadge status={player.status} />
                        </td>
                        <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onClick={() => navigate(`/jugadores/${player.id}`)}>
                                <Eye className="h-4 w-4 mr-2" /> Ver perfil
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEditDialog(player)}>
                                <Edit className="h-4 w-4 mr-2" /> Editar
                              </DropdownMenuItem>
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
                        </td>
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
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPlayer ? 'Editar jugador' : 'Nuevo jugador'}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="personal">
            <TabsList className="w-full">
              <TabsTrigger value="personal" className="flex-1">Datos personales</TabsTrigger>
              <TabsTrigger value="deportivos" className="flex-1">Datos deportivos</TabsTrigger>
              <TabsTrigger value="bancarios" className="flex-1">Datos bancarios</TabsTrigger>
              {isMinorForm && <TabsTrigger value="tutor" className="flex-1">Tutor</TabsTrigger>}
            </TabsList>

            <TabsContent value="personal">
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Apellidos *</Label>
                  <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>DNI *</Label>
                  <Input value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Fecha de nacimiento *</Label>
                  <Input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
                  {isMinorForm && (
                    <p className="text-xs text-yellow-600 font-medium">Este jugador es menor de edad. Completa los datos del tutor.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono *</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Dirección</Label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Ciudad</Label>
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Código postal</Label>
                  <Input value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="deportivos">
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label>Nivel *</Label>
                  <Select
                    options={PLAYER_LEVELS.map((l) => ({ value: l.value, label: l.label }))}
                    value={form.level}
                    onChange={(e) => setForm({ ...form, level: e.target.value as PlayerLevel })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mano dominante</Label>
                  <Select
                    options={DOMINANT_HANDS.map((h) => ({ value: h.value, label: h.label }))}
                    value={form.dominantHand}
                    onChange={(e) => setForm({ ...form, dominantHand: e.target.value as 'derecha' | 'izquierda' })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Posición</Label>
                  <Select
                    options={PLAYER_POSITIONS.map((p) => ({ value: p.value, label: p.label }))}
                    value={form.position}
                    onChange={(e) => setForm({ ...form, position: e.target.value as 'drive' | 'reves' | 'ambos' })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select
                    options={PLAYER_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as PlayerStatus })}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Experiencia previa</Label>
                  <Input value={form.previousExperience} onChange={(e) => setForm({ ...form, previousExperience: e.target.value })} />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Notas médicas</Label>
                  <Input value={form.medicalNotes} onChange={(e) => setForm({ ...form, medicalNotes: e.target.value })} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="bancarios">
              <div className="grid grid-cols-1 gap-4 mt-4">
                <div className="space-y-2">
                  <Label>Titular de la cuenta *</Label>
                  <Input value={form.bankAccountHolder} onChange={(e) => setForm({ ...form, bankAccountHolder: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>IBAN *</Label>
                  <Input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} placeholder="ES00 0000 0000 0000 0000 0000" />
                </div>
                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
            </TabsContent>

            {isMinorForm && (
              <TabsContent value="tutor">
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 col-span-2">
                    <p className="text-sm text-yellow-800 font-medium">
                      Datos del padre, madre o tutor legal del menor
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Parentesco *</Label>
                    <Select
                      options={GUARDIAN_RELATIONSHIPS.map((r) => ({ value: r.value, label: r.label }))}
                      value={form.guardianRelationship}
                      onChange={(e) => setForm({ ...form, guardianRelationship: e.target.value as 'padre' | 'madre' | 'tutor' })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>DNI *</Label>
                    <Input value={form.guardianDni} onChange={(e) => setForm({ ...form, guardianDni: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nombre *</Label>
                    <Input value={form.guardianFirstName} onChange={(e) => setForm({ ...form, guardianFirstName: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Apellidos *</Label>
                    <Input value={form.guardianLastName} onChange={(e) => setForm({ ...form, guardianLastName: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono *</Label>
                    <Input value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input type="email" value={form.guardianEmail} onChange={(e) => setForm({ ...form, guardianEmail: e.target.value })} />
                  </div>
                </div>
              </TabsContent>
            )}
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); setEditingPlayer(null) }}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!form.firstName || !form.lastName || !form.birthDate}>
              {editingPlayer ? 'Guardar cambios' : 'Crear jugador'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!showDeleteConfirm}
        onOpenChange={() => setShowDeleteConfirm(null)}
        title="Eliminar jugador"
        description="Esta acción eliminará al jugador y todos sus datos asociados. Esta acción no se puede deshacer."
        variant="destructive"
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (showDeleteConfirm) deletePlayer(showDeleteConfirm)
          setShowDeleteConfirm(null)
        }}
      />

      {/* Cancel Confirm */}
      <ConfirmDialog
        open={!!showCancelConfirm}
        onOpenChange={() => setShowCancelConfirm(null)}
        title="Dar de baja"
        description="El jugador será dado de baja. Se aplicará la lógica de facturación según la fecha actual (antes o después del día 5 del mes)."
        confirmLabel="Dar de baja"
        onConfirm={() => {
          if (showCancelConfirm) cancelPlayer(showCancelConfirm)
          setShowCancelConfirm(null)
        }}
      />
    </div>
  )
}
