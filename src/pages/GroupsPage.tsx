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
import { generateId, normalizeText } from '@/lib/utils'
import { PLAYER_LEVELS, DAYS_OF_WEEK } from '@/constants'
import type { Group, PlayerLevel, ScheduleSlot } from '@/types'
import { generateGroupsListReport } from '@/lib/pdf-reports'
import { useAuthStore } from '@/stores/authStore'
import { checkGroupScheduleConflicts, formatConflictMessage } from '@/lib/schedule-conflicts'
import { isGroupStale } from '@/lib/group-utils'

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

const ALL_SEASONS = '__all__'

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
  const { groups, coaches, courts, tariffs, addGroup, updateGroup, deleteGroup, players, enrollments, club, seasons } = useDataStore()
  const { user } = useAuthStore()

  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('')
  const [coachFilter, setCoachFilter] = useState<string>('')
  const [seasonFilter, setSeasonFilter] = useState<string>('')
  const [sortBy, setSortBy] = useState<'schedule' | 'name'>('schedule')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [showDialog, setShowDialog] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [form, setForm] = useState<GroupFormState>({ ...emptyForm })

  // Schedule slot being added
  const [newSlotDay, setNewSlotDay] = useState<number>(1)
  const [newSlotStart, setNewSlotStart] = useState('18:00')
  const [newSlotEnd, setNewSlotEnd] = useState('19:30')

  const activeCoaches = useMemo(() => coaches.filter((c) => c.isActive), [coaches])
  const activeCourts = useMemo(() => {
    return courts
      .filter((c) => c.isActive)
      .sort((a, b) => {
        const orderA = a.order ?? 9999
        const orderB = b.order ?? 9999
        if (orderA !== orderB) return orderA - orderB
        return a.name.localeCompare(b.name)
      })
  }, [courts])
  const activeTariffs = useMemo(() => tariffs.filter((t) => t.isActive), [tariffs])

  const isEntrenador = user?.role === 'entrenador'
  const currentCoach = useMemo(
    () => coaches.find((c) => c.userId === user?.id),
    [coaches, user?.id]
  )

  const filteredGroups = useMemo(() => {
    const effectiveSeasonFilter = seasonFilter === '' ? (club?.activeSeasonId ?? '') : seasonFilter

    const filtered = groups.filter((g) => {
      const q = normalizeText(search)
      const matchesSearch = search === '' || normalizeText(g.name).includes(q)
      const matchesLevel = levelFilter === '' || g.level === levelFilter
      const matchesCoach = isEntrenador
        ? g.coachId === currentCoach?.id
        : coachFilter === '' || g.coachId === coachFilter
      const matchesSeason =
        effectiveSeasonFilter === ALL_SEASONS ||
        effectiveSeasonFilter === '' ||
        g.seasonId === effectiveSeasonFilter
      return matchesSearch && matchesLevel && matchesCoach && matchesSeason
    })

    return filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name)
      }

      const aSlot = a.schedule[0]
      const bSlot = b.schedule[0]
      if (!aSlot && !bSlot) return 0
      if (!aSlot) return 1
      if (!bSlot) return -1

      if (aSlot.dayOfWeek !== bSlot.dayOfWeek) {
        return aSlot.dayOfWeek - bSlot.dayOfWeek
      }
      return aSlot.startTime.localeCompare(bSlot.startTime)
    })
  }, [groups, search, levelFilter, coachFilter, seasonFilter, sortBy, isEntrenador, currentCoach, club?.activeSeasonId])

  const activeGroupsCount = groups.filter((g) => g.isActive).length
  const activeSeason = club ? seasons.find((s) => s.id === club.activeSeasonId) : undefined

  const handleExportPDF = async () => {
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

    await generateGroupsListReport({
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
    const installmentPrices = selectedTariff?.installmentPrices

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
        installmentPrices,
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
        installmentPrices,
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
        subtitle={
          (search || levelFilter || coachFilter || (seasonFilter !== '' && seasonFilter !== ALL_SEASONS))
            ? `${filteredGroups.length} grupos encontrados`
            : (seasonFilter === ALL_SEASONS)
              ? `${activeGroupsCount} activos · ${groups.length} total`
              : `${filteredGroups.length} de la temporada actual`
        }
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
        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
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
              { value: 'schedule', label: 'Ordenar: Horario' },
              { value: 'name', label: 'Ordenar: Nombre' },
            ]}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'schedule' | 'name')}
            className="w-full sm:w-40"
          />
          {!isEntrenador && (
            <Select
              options={[
                { value: '', label: 'Todos los entrenadores' },
                ...activeCoaches.map((c) => ({
                  value: c.id,
                  label: `${c.firstName} ${c.lastName}`
                }))
              ]}
              value={coachFilter}
              onChange={(e) => setCoachFilter(e.target.value)}
              className="w-full sm:w-48"
            />
          )}
          <Select
            options={[
              { value: '', label: 'Todos los niveles' },
              ...PLAYER_LEVELS.map((l) => ({ value: l.value, label: l.label })),
            ]}
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="w-full sm:w-48"
          />
          <Select
            options={[
              { value: '', label: activeSeason ? `Temporada actual: ${activeSeason.name}` : 'Temporada actual' },
              { value: ALL_SEASONS, label: 'Todas las temporadas' },
              ...seasons.map((s) => ({ value: s.id, label: s.name })),
            ]}
            value={seasonFilter}
            onChange={(e) => setSeasonFilter(e.target.value)}
            className="w-full sm:w-56"
          />
          <div className="flex items-center border rounded-md shrink-0">
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
            title={isEntrenador ? "No tienes grupos asignados" : "No hay grupos"}
            description={
              isEntrenador
                ? "Actualmente no tienes ningún grupo asignado a tu perfil."
                : seasonFilter !== ALL_SEASONS
                  ? "No hay grupos en esta temporada. Prueba a seleccionar 'Todas las temporadas' en el filtro, o crea un grupo nuevo."
                  : "Crea tu primer grupo para empezar a organizar las clases de la escuela"
            }
            action={isEntrenador ? undefined : { label: 'Crear grupo', onClick: openCreateDialog }}
          />
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGroups.map((group) => {
              const occupancyPct = group.maxCapacity > 0
                ? (group.currentEnrollment / group.maxCapacity) * 100
                : 0

              const activeEnrollments = enrollments.filter(e => e.groupId === group.id && e.isActive)
              const groupPlayers = activeEnrollments
                .map(e => players.find(p => p.id === e.playerId))
                .filter(Boolean) as any[]
              
              const displayPlayers = groupPlayers.slice(0, 4)
              const remainingPlayers = groupPlayers.length - 4

              return (
                <Card
                  key={group.id}
                  className="cursor-pointer hover:shadow-md transition-shadow flex flex-col"
                  onClick={() => navigate(`/grupos/${group.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-base leading-tight">{group.name}</CardTitle>
                        <div className="mt-1 flex items-center gap-1.5">
                          <StatusBadge status={group.level} />
                          {isGroupStale(group, new Date()) && (
                            <Badge variant="destructive" className="text-[10px]">Finalizado</Badge>
                          )}
                        </div>
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
                  <CardContent className="space-y-4 flex-1 flex flex-col">
                    <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground bg-muted/30 p-2 rounded-lg">
                      <div className="flex items-center gap-1.5 truncate">
                        <User className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate" title={group.coachName || 'Sin entrenador'}>{group.coachName || 'Sin entrenador'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate" title={group.courtName || 'Sin pista'}>{group.courtName || 'Sin pista'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 col-span-2 truncate">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate" title={formatSchedule(group.schedule)}>{formatSchedule(group.schedule)}</span>
                      </div>
                    </div>

                    <div className="flex-1 min-h-[100px]">
                      {groupPlayers.length > 0 ? (
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Alumnos ({group.currentEnrollment})
                          </div>
                          <div className="space-y-1.5">
                            {displayPlayers.map(p => (
                              <div key={p.id} className="flex items-center gap-2 text-sm">
                                <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-semibold shrink-0">
                                  {p.firstName?.charAt(0)}{p.lastName?.charAt(0)}
                                </div>
                                <span className="truncate font-medium text-foreground/90">{p.firstName}</span>
                              </div>
                            ))}
                            {remainingPlayers > 0 && (
                              <div className="text-xs text-muted-foreground pl-8 pt-0.5">
                                + {remainingPlayers} alumno{remainingPlayers !== 1 ? 's' : ''} más
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center border-2 border-dashed rounded-lg p-4 bg-muted/20">
                          <span className="text-sm text-muted-foreground">Sin alumnos inscritos</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5 pt-2 border-t mt-auto">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Ocupación</span>
                        <span className="font-medium">
                          {group.currentEnrollment} / {group.maxCapacity} plazas
                        </span>
                      </div>
                      <Progress
                        value={group.currentEnrollment}
                        max={group.maxCapacity}
                        className="h-1.5"
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
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden md:table-cell">Detalles</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">Alumnos</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">Ocupación</th>
                      {!isEntrenador && <th className="p-3 text-right text-sm font-medium text-muted-foreground w-24">Acciones</th>}
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
                          <td className="p-3 align-top">
                            <span className="font-medium text-sm">{group.name}</span>
                          </td>
                          <td className="p-3 align-top">
                            <div className="flex items-center gap-1.5">
                              <StatusBadge status={group.level} />
                              {isGroupStale(group, new Date()) && (
                                <Badge variant="destructive" className="text-[10px]">Finalizado</Badge>
                              )}
                            </div>
                          </td>
                          <td className="p-3 hidden md:table-cell align-top">
                            <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5" />
                                {group.coachName || 'Sin entrenador'}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5" />
                                {group.courtName || 'Sin pista'}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                {formatSchedule(group.schedule)}
                              </div>
                            </div>
                          </td>
                          <td className="p-3 align-top">
                            <div className="text-sm">
                              {(() => {
                                const activeEnrollments = enrollments.filter(e => e.groupId === group.id && e.isActive)
                                const groupPlayers = activeEnrollments
                                  .map(e => players.find(p => p.id === e.playerId))
                                  .filter(Boolean) as any[]
                                return groupPlayers.length > 0 ? (
                                  <span className="text-foreground/90">
                                    {groupPlayers.map(p => p.firstName).join(', ')}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground italic text-xs">Sin alumnos</span>
                                )
                              })()}
                            </div>
                          </td>
                          <td className="p-3 align-top">
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
                          {!isEntrenador && (
                            <td className="p-3 text-right align-top" onClick={(e) => e.stopPropagation()}>
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
                          )}
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
                      label: t.billingFrequency === 'monthly'
                        ? `${t.name} - ${t.price.toFixed(2)} €/mes`
                        : `${t.name} - ${t.price.toFixed(2)} € total (${Object.keys(t.installmentPrices ?? {}).length} plazos)`,
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
