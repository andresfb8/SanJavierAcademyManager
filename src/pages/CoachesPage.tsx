import { useState, useMemo } from 'react'
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
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Coach } from '@/types'

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
}

export default function CoachesPage() {
  const { coaches, groups, addCoach, updateCoach, deleteCoach } = useDataStore()

  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<string>('active')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingCoach, setEditingCoach] = useState<Coach | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [form, setForm] = useState<CoachForm>({ ...emptyForm })

  const resetForm = () => {
    setForm({ ...emptyForm })
  }

  const filteredCoaches = useMemo(() => {
    return coaches.filter((c) => {
      const matchesSearch =
        search === '' ||
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search)
      const matchesActive =
        activeFilter === 'all' || (activeFilter === 'active' && c.isActive)
      return matchesSearch && matchesActive
    })
  }, [coaches, search, activeFilter])

  const getCoachGroups = (coachId: string) => {
    return groups.filter((g) => g.coachId === coachId)
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
      hireDate: editingCoach ? editingCoach.hireDate : new Date(),
    }

    if (editingCoach) {
      updateCoach(editingCoach.id, coachData)
      setEditingCoach(null)
    } else {
      addCoach(coachData)
    }

    setShowCreateDialog(false)
    resetForm()
  }

  const openEditDialog = (coach: Coach) => {
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
    })
    setEditingCoach(coach)
    setShowCreateDialog(true)
  }

  const openCreateDialog = () => {
    resetForm()
    setEditingCoach(null)
    setShowCreateDialog(true)
  }

  const activeCount = coaches.filter((c) => c.isActive).length

  return (
    <div>
      <Header
        title="Entrenadores"
        subtitle={`${activeCount} activos · ${coaches.length} total`}
        actions={
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-1" />
            Nuevo entrenador
          </Button>
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
              { value: 'active', label: 'Solo activos' },
              { value: 'all', label: 'Todos' },
            ]}
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="w-full sm:w-48"
          />
        </div>

        {/* Grid de entrenadores */}
        {filteredCoaches.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No hay entrenadores"
            description="Anade tu primer entrenador para empezar a gestionar el equipo tecnico"
            action={{ label: 'Anadir entrenador', onClick: openCreateDialog }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCoaches.map((coach) => {
              const coachGroups = getCoachGroups(coach.id)
              return (
                <Card key={coach.id} className="overflow-hidden">
                  <CardContent className="p-5">
                    {/* Cabecera: Avatar + Nombre + Badge */}
                    <div className="flex items-start gap-4 mb-4">
                      <Avatar className="h-14 w-14">
                        <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                          {coach.firstName[0]}
                          {coach.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-base truncate">
                            {coach.firstName} {coach.lastName}
                          </h3>
                          <Badge
                            variant={coach.isActive ? 'success' : 'secondary'}
                            className="shrink-0"
                          >
                            {coach.isActive ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </div>
                        {coach.specialization && (
                          <p className="text-sm text-muted-foreground truncate mt-0.5">
                            {coach.specialization}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Informacion de contacto */}
                    <div className="space-y-2 mb-4">
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
                            : `${coachGroups.length} grupo${coachGroups.length > 1 ? 's' : ''} asignado${coachGroups.length > 1 ? 's' : ''}`}
                        </span>
                      </div>
                    </div>

                    {/* Grupos asignados */}
                    {coachGroups.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {coachGroups.map((group) => (
                          <Badge key={group.id} variant="outline" className="text-xs">
                            {group.name}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Acciones */}
                    <div className="flex items-center gap-2 pt-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => openEditDialog(coach)}
                      >
                        <Edit2 className="h-3.5 w-3.5 mr-1" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
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
        )}
      </div>

      {/* Dialogo de creacion/edicion */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingCoach ? 'Editar entrenador' : 'Nuevo entrenador'}
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
                rows={3}
              />
            </div>
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
              {editingCoach ? 'Guardar cambios' : 'Crear entrenador'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogo de confirmacion de eliminacion */}
      <ConfirmDialog
        open={!!showDeleteConfirm}
        onOpenChange={() => setShowDeleteConfirm(null)}
        title="Eliminar entrenador"
        description="Esta accion eliminara al entrenador y todos sus datos asociados. Esta accion no se puede deshacer."
        variant="destructive"
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (showDeleteConfirm) deleteCoach(showDeleteConfirm)
          setShowDeleteConfirm(null)
        }}
      />
    </div>
  )
}
