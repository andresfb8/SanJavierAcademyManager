import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useDataStore } from '@/stores/dataStore'
import { Plus, Search, Users, Clock, MapPin, User, Trash2, Edit2, LayoutGrid, List, FileDown } from 'lucide-react'
import { generateId } from '@/lib/utils'
import { PLAYER_LEVELS, DAYS_OF_WEEK } from '@/constants'
import type { Group, PlayerLevel, ScheduleSlot } from '@/types'
import { generateGroupsListReport } from '@/lib/pdf-reports'
import { useAuthStore } from '@/stores/authStore'
import { checkGroupScheduleConflicts, formatConflictMessage } from '@/lib/schedule-conflicts'

type ViewMode = 'grid' | 'list'

interface GroupFormState {
  name: string
  level: PlayerLevel
  coachId: string
  courtId: string
  schedule: ScheduleSlot[]
  maxCapacity: number
  defaultTariffId: string
  startDate: string
  endDate: string
}

const emptyForm: GroupFormState = {
  name: '',
  level: 'iniciacion',
  coachId: '',
  courtId: '',
  schedule: [],
  maxCapacity: 4,
  defaultTariffId: '',
  startDate: '',
  endDate: '',
}

function getOccupancyColor(current: number, max: number): string {
  if (max === 0) return 'bg-gray-400'
  const pct = (current / max) * 100
  if (pct >= 100) return 'bg-red-500'
  if (pct >= 75) return 'bg-yellow-500'
  return 'bg-green-500'
}

function formatSchedule(schedule: ScheduleSlot[]): string {
  if (schedule.length === 0) return 'Sin horario'
  const dayShorts = schedule.map((s) => {
    const day = DAYS_OF_WEEK.find((d) => d.value === s.dayOfWeek)
    return day?.short || '?'
  })
  const uniqueDays = [...new Set(dayShorts)]
  const times = schedule[0]
  return `${uniqueDays.join(', ')} ${times.startTime} - ${times.endTime}`
}

export default function GroupsPage() {
  const navigate = useNavigate()
  const { groups, coaches, courts, tariffs, addGroup, updateGroup, deleteGroup, players, enrollments } = useDataStore()
  const { user } = useAuthStore()

  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [showDialog, setShowDialog] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [form, setForm] = useState<GroupFormState>({ ...emptyForm })

  // Schedule slot being added
  const [newSlotDay, setNewSlotDay] = useState<number>(1)
  const [newSlotStart, setNewSlotStart] = useState('18:00')
  const [newSlotEnd, setNewSlotEnd] = useState('19:30')

  const activeCoaches = useMemo(() => coaches.filter((c) => c.isActive), [coaches])
  const activeCourts = useMemo(() => courts.filter((c) => c.isActive), [courts])
  const activeTariffs = useMemo(() => tariffs.filter((t) => t.isActive), [tariffs])

  const isEntrenador = user?.role === 'entrenador'
  const currentCoach = useMemo(
    () => coaches.find((c) => c.userId === user?.id),
    [coaches, user?.id]
  )

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      const matchesSearch = search === '' || g.name.toLowerCase().includes(search.toLowerCase())
      const matchesLevel = levelFilter === '' || g.level === levelFilter
      const matchesCoach = !isEntrenador || g.coachId === currentCoach?.id
      return matchesSearch && matchesLevel && matchesCoach
    })
  }, [groups, search, levelFilter, isEntrenador, currentCoach])

  const activeGroupsCount = groups.filter((g) => g.isActive).length

  const handleExportPDF = () => {
    const clubName = user?.clubId || 'San Javier Academy'

    const groupsData = filteredGroups.map((group) => {
      const coach = coaches.find((c) => c.id === group.coachId)
      const court = courts.find((c) => c.id === group.courtId)
      const levelInfo = PLAYER_LEVELS.find((l) => l.value === group.level)

      return {
        name: group.name,
        level: levelInfo?.label || group.level,
        coach: coach ? `${coach.firstName} ${coach.lastName}` : 'Sin asignar',
        court: court?.name || 'Sin asignar',
        schedule: formatSchedule(group.schedule),
        enrollment: `${group.currentEnrollment}/${group.maxCapacity}`,
      }
    })

    generateGroupsListReport({
      clubName,
      groups: groupsData,
    })
  }

  const resetForm = () => {
    setForm({ ...emptyForm })
    setNewSlotDay(1)
    setNewSlotStart('18:00')
    setNewSlotEnd('19:30')
  }

  const openCreateDialog = () => {
    resetForm()
    setEditingGroup(null)
    setShowDialog(true)
  }

  const openEditDialog = (group: Group) => {
    setEditingGroup(group)
    setForm({
      name: group.name,
      level: group.level,
      coachId: group.coachId,
      courtId: group.courtId,
      schedule: [...group.schedule],
      maxCapacity: group.maxCapacity,
      defaultTariffId: group.defaultTariffId,
      startDate: group.startDate instanceof Date
        ? group.startDate.toISOString().split('T')[0]
        : new Date(group.startDate).toISOString().split('T')[0],
      endDate: group.endDate instanceof Date
        ? group.endDate.toISOString().split('T')[0]
        : new Date(group.endDate).toISOString().split('T')[0],
    })
    setShowDialog(true)
  }

  const addScheduleSlot = () => {
    const newSlot: ScheduleSlot = {
      dayOfWeek: newSlotDay,
      startTime: newSlotStart,
      endTime: newSlotEnd,
    }

    // Verificar conflictos con grupos existentes
    const conflicts = checkGroupScheduleConflicts(
      newSlot,
      form.courtId,
      form.coachId,
      groups,
      editingGroup?.id // Excluir el grupo actual si estamos editando
    )

    if (conflicts.length > 0) {
      const message = formatConflictMessage(conflicts)
      const confirmed = window.confirm(
        `${message}\n\n¿Deseas agregar este horario de todas formas?`
      )
      if (!confirmed) return
    }

    setForm({
      ...form,
      schedule: [...form.schedule, newSlot],
    })
  }

  const removeScheduleSlot = (index: number) => {
    setForm({
      ...form,
      schedule: form.schedule.filter((_, i) => i !== index),
    })
  }

  const handleSubmit = () => {
    // Verificar conflictos en todos los schedules
    const allConflicts: string[] = []
    for (const slot of form.schedule) {
      const conflicts = checkGroupScheduleConflicts(
        slot,
        form.courtId,
        form.coachId,
        groups,
        editingGroup?.id
      )
      if (conflicts.length > 0) {
        const dayName = DAYS_OF_WEEK.find((d) => d.value === slot.dayOfWeek)?.label || 'Día desconocido'
        allConflicts.push(`${dayName} ${slot.startTime}-${slot.endTime}: ${conflicts.map(c => c.message).join(', ')}`)
      }
    }

    if (allConflicts.length > 0) {
      const message = `⚠️ Conflictos de horario detectados:\n\n${allConflicts.map(c => `• ${c}`).join('\n')}\n\n¿Deseas guardar de todas formas?`
      const confirmed = window.confirm(message)
      if (!confirmed) return
    }

    const selectedCoach = coaches.find((c) => c.id === form.coachId)
    const selectedCourt = courts.find((c) => c.id === form.courtId)
    const selectedTariff = tariffs.find((t) => t.id === form.defaultTariffId)

    const coachName = selectedCoach ? `${selectedCoach.firstName} ${selectedCoach.lastName}` : ''
    const courtName = selectedCourt ? selectedCourt.name : ''
    const tariffPrice = selectedTariff ? selectedTariff.price : 0
    const billingFrequency = selectedTariff?.billingFrequency ?? 'monthly'
    const installmentMonths = selectedTariff?.installmentMonths

    if (editingGroup) {
      updateGroup(editingGroup.id, {
        name: form.name,
        level: form.level,
        coachId: form.coachId,
        coachName,
        courtId: form.courtId,
        courtName,
        schedule: form.schedule,
        maxCapacity: form.maxCapacity,
        defaultTariffId: form.defaultTariffId,
        defaultTariffPrice: tariffPrice,
        billingFrequency,
        installmentMonths,
        startDate: new Date(form.startDate),
        endDate: new Date(form.endDate),
      })
    } else {
      addGroup({
        name: form.name,
        level: form.level,
        coachId: form.coachId,
        coachName,
        courtId: form.courtId,
        courtName,
        schedule: form.schedule,
        maxCapacity: form.maxCapacity,
        defaultTariffId: form.defaultTariffId,
        defaultTariffPrice: tariffPrice,
        billingFrequency,
        installmentMonths,
        startDate: new Date(form.startDate),
        endDate: new Date(form.endDate),
        isActive: true,
      })
    }

    setShowDialog(false)
    setEditingGroup(null)
    resetForm()
  }

  const isFormValid = form.name.trim() !== '' && form.coachId !== '' && form.courtId !== '' && form.startDate !== '' && form.endDate !== ''

  return (
    <div>
      <Header
        title="Grupos"
        subtitle={`${activeGroupsCount} activos · ${groups.length} total`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={filteredGroups.length === 0}>
              <FileDown className="h-4 w-4 mr-1" />
              Exportar PDF
            </Button>
            {!isEntrenador && (
              <Button size="sm" onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-1" />
                Nuevo grupo
              </Button>
            )}
          </div>
        }
      />

      <div className="p-6 space-y-4">
        {/* Filters and view toggle */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre del grupo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            options={[
              { value: '', label: 'Todos los niveles' },
              ...PLAYER_LEVELS.map((l) => ({ value: l.value, label: l.label })),
            ]}
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="w-full sm:w-48"
          />
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="icon"
              className="h-10 w-10 rounded-r-none"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="icon"
              className="h-10 w-10 rounded-l-none"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        {filteredGroups.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No hay grupos"
            description="Crea tu primer grupo para empezar a organizar las clases de la escuela"
            action={{ label: 'Crear grupo', onClick: openCreateDialog }}
          />
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGroups.map((group) => {
              const occupancyPct = group.maxCapacity > 0
                ? (group.currentEnrollment / group.maxCapacity) * 100
                : 0

              return (
                <Card
                  key={group.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/grupos/${group.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-base">{group.name}</CardTitle>
                        <StatusBadge status={group.level} />
                      </div>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(group)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setShowDeleteConfirm(group.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 shrink-0" />
                        <span>{group.coachName || 'Sin entrenador'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span>{group.courtName || 'Sin pista'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 shrink-0" />
                        <span>{formatSchedule(group.schedule)}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Ocupación</span>
                        <span className="font-medium">
                          {group.currentEnrollment} / {group.maxCapacity}
                        </span>
                      </div>
                      <Progress
                        value={group.currentEnrollment}
                        max={group.maxCapacity}
                        className="h-2"
                        indicatorClassName={getOccupancyColor(group.currentEnrollment, group.maxCapacity)}
                      />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          /* List View */
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">Grupo</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">Nivel</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden md:table-cell">Entrenador</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden md:table-cell">Pista</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden lg:table-cell">Horario</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">Ocupación</th>
                      <th className="p-3 text-right text-sm font-medium text-muted-foreground w-24">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGroups.map((group) => {
                      const occupancyPct = group.maxCapacity > 0
                        ? (group.currentEnrollment / group.maxCapacity) * 100
                        : 0

                      return (
                        <tr
                          key={group.id}
                          className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => navigate(`/grupos/${group.id}`)}
                        >
                          <td className="p-3">
                            <span className="font-medium text-sm">{group.name}</span>
                          </td>
                          <td className="p-3">
                            <StatusBadge status={group.level} />
                          </td>
                          <td className="p-3 hidden md:table-cell">
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <User className="h-3.5 w-3.5" />
                              {group.coachName || 'Sin entrenador'}
                            </div>
                          </td>
                          <td className="p-3 hidden md:table-cell">
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5" />
                              {group.courtName || 'Sin pista'}
                            </div>
                          </td>
                          <td className="p-3 hidden lg:table-cell">
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" />
                              {formatSchedule(group.schedule)}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <Progress
                                value={group.currentEnrollment}
                                max={group.maxCapacity}
                                className="h-2 w-20"
                                indicatorClassName={getOccupancyColor(group.currentEnrollment, group.maxCapacity)}
                              />
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {group.currentEnrollment}/{group.maxCapacity}
                              </span>
                            </div>
                          </td>
                          <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditDialog(group)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setShowDeleteConfirm(group.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-xl sm:max-w-xl md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Editar grupo' : 'Nuevo grupo'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 mt-2">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre del grupo *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: Grupo Iniciación Lunes"
                />
              </div>
              <div className="space-y-2">
                <Label>Nivel *</Label>
                <Select
                  options={PLAYER_LEVELS.map((l) => ({ value: l.value, label: l.label }))}
                  value={form.level}
                  onChange={(e) => setForm({ ...form, level: e.target.value as PlayerLevel })}
                />
              </div>
              <div className="space-y-2">
                <Label>Entrenador *</Label>
                <Select
                  options={[
                    { value: '', label: 'Seleccionar entrenador' },
                    ...activeCoaches.map((c) => ({
                      value: c.id,
                      label: `${c.firstName} ${c.lastName}`,
                    })),
                  ]}
                  value={form.coachId}
                  onChange={(e) => setForm({ ...form, coachId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Pista *</Label>
                <Select
                  options={[
                    { value: '', label: 'Seleccionar pista' },
                    ...activeCourts.map((c) => ({
                      value: c.id,
                      label: c.name,
                    })),
                  ]}
                  value={form.courtId}
                  onChange={(e) => setForm({ ...form, courtId: e.target.value })}
                />
              </div>
            </div>

            {/* Schedule */}
            <div className="space-y-3">
              <Label>Horario</Label>
              {form.schedule.length > 0 && (
                <div className="space-y-2">
                  {form.schedule.map((slot, index) => {
                    const day = DAYS_OF_WEEK.find((d) => d.value === slot.dayOfWeek)
                    return (
                      <div
                        key={index}
                        className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm"
                      >
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{day?.label || '?'}</span>
                        <span className="text-muted-foreground">
                          {slot.startTime} - {slot.endTime}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 ml-auto text-destructive hover:text-destructive"
                          onClick={() => removeScheduleSlot(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="flex items-end gap-2">
                <div className="space-y-1 flex-1">
                  <Label className="text-xs text-muted-foreground">Día</Label>
                  <Select
                    options={DAYS_OF_WEEK.map((d) => ({
                      value: String(d.value),
                      label: d.label,
                    }))}
                    value={String(newSlotDay)}
                    onChange={(e) => setNewSlotDay(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Inicio</Label>
                  <Input
                    type="time"
                    value={newSlotStart}
                    onChange={(e) => setNewSlotStart(e.target.value)}
                    className="w-28"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Fin</Label>
                  <Input
                    type="time"
                    value={newSlotEnd}
                    onChange={(e) => setNewSlotEnd(e.target.value)}
                    className="w-28"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={addScheduleSlot}>
                  <Plus className="h-4 w-4 mr-1" />
                  Añadir
                </Button>
              </div>
            </div>

            {/* Capacity, tariff, billing */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Capacidad máxima</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.maxCapacity}
                  onChange={(e) => setForm({ ...form, maxCapacity: Number(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Tarifa</Label>
                <Select
                  options={[
                    { value: '', label: 'Seleccionar tarifa' },
                    ...activeTariffs.map((t) => ({
                      value: t.id,
                      label: `${t.name} - ${t.price.toFixed(2)} € (${t.billingFrequency === 'installments' ? 'Por plazos' : 'Mensual'})`,
                    })),
                  ]}
                  value={form.defaultTariffId}
                  onChange={(e) => setForm({ ...form, defaultTariffId: e.target.value })}
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha de inicio *</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha de fin *</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDialog(false)
                setEditingGroup(null)
                resetForm()
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!isFormValid}>
              {editingGroup ? 'Guardar cambios' : 'Crear grupo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!showDeleteConfirm}
        onOpenChange={() => setShowDeleteConfirm(null)}
        title="Eliminar grupo"
        description="Esta acción eliminará el grupo y desactivará todas las inscripciones asociadas. Esta acción no se puede deshacer."
        variant="destructive"
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (showDeleteConfirm) deleteGroup(showDeleteConfirm)
          setShowDeleteConfirm(null)
        }}
      />
    </div>
  )
}
