# Rediseño UI Clases — Fase B (Grupos) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar la pestaña Grupos a fondo: buscador real en el topbar de `ClasesLayout`, filtros de Día/Plazas, métricas nuevas de asistencia y lista de espera por grupo (tarjetas y tabla), menú de acciones "···".

**Architecture:** `ClasesOutletContext` gana `search`/`setSearch` (mismo patrón que `PersonasOutletContext`). `ClasesLayout` renderiza el input solo cuando `location.pathname === '/clases/grupos'` (evita mostrar un buscador roto en las otras 5 pestañas). `GroupsPage` deja de tener `search` como `useState` local, lo lee del contexto, y añade dos `useMemo` nuevos (asistencia y lista de espera por grupo) reutilizando el mismo criterio de temporada activa que ya usa `PlayersPage` para asistencia por jugador.

**Tech Stack:** React 19, TypeScript, react-router-dom v7, Tailwind CSS v4, shadcn/ui, `@tanstack/react-table` no se usa aquí (esta página no lo usaba y no se introduce ahora).

**Spec:** `docs/superpowers/specs/2026-09-01-rediseno-ui-clases-fase-b-grupos-design.md`

---

### Task 1: `ClasesLayout` — buscador real (solo en Grupos) y subtítulo enriquecido

**Files:**
- Modify: `src/components/layout/ClasesLayout.tsx`

- [ ] **Step 1: Añadir `search`/`setSearch` al contexto**

Cambiar:

```ts
export interface ClasesOutletContext {
  setPrimaryAction: (action: ClasesPrimaryAction | null) => void
}
```

por:

```ts
export interface ClasesOutletContext {
  search: string
  setSearch: (value: string) => void
  setPrimaryAction: (action: ClasesPrimaryAction | null) => void
}
```

- [ ] **Step 2: Añadir el estado y su reseteo por ruta**

Cambiar:

```ts
export function ClasesLayout() {
  const location = useLocation()
  const { groups, events, privateLessons } = useDataStore()

  const [primaryAction, setPrimaryAction] = useState<ClasesPrimaryAction | null>(null)
```

por:

```ts
export function ClasesLayout() {
  const location = useLocation()
  const { groups, events, privateLessons } = useDataStore()

  const [search, setSearch] = useState('')
  const [primaryAction, setPrimaryAction] = useState<ClasesPrimaryAction | null>(null)

  useEffect(() => {
    setSearch('')
  }, [location.pathname])
```

`useEffect` no está importado todavía en este archivo (se quitó en la Task 1
de la Fase A por no usarse) — cambiar `import { useState, useMemo } from 'react'`
por `import { useState, useMemo, useEffect } from 'react'`.

- [ ] **Step 3: Enriquecer el subtítulo de Grupos**

Cambiar:

```ts
    if (location.pathname === '/clases/grupos') {
      const active = groups.filter((g) => g.isActive).length
      return `${active} activos · ${groups.length} total`
    }
```

por:

```ts
    if (location.pathname === '/clases/grupos') {
      const activeGroups = groups.filter((g) => g.isActive)
      const active = activeGroups.length
      if (active === 0) return '0 grupos activos'
      const totalInscritos = activeGroups.reduce((sum, g) => sum + g.currentEnrollment, 0)
      const promedio = (totalInscritos / active).toLocaleString('es-ES', { maximumFractionDigits: 1 })
      return `${active} activos · ${totalInscritos} alumnos inscritos · ${promedio} alumnos por grupo`
    }
```

- [ ] **Step 4: Añadir `showSearch` y el input, y actualizar el `outletContext`**

Cambiar:

```ts
  const outletContext = useMemo(
    () => ({ setPrimaryAction } satisfies ClasesOutletContext),
    [setPrimaryAction]
  )
```

por:

```ts
  const showSearch = location.pathname === '/clases/grupos'

  const outletContext = useMemo(
    () => ({ search, setSearch, setPrimaryAction } satisfies ClasesOutletContext),
    [search, setSearch, setPrimaryAction]
  )
```

Cambiar el bloque de `<div className="flex items-center gap-2">` del topbar
(el que hoy solo tiene `SeasonSwitcher` + `primaryAction`):

```tsx
          <div className="flex items-center gap-2">
            <SeasonSwitcher />
            {primaryAction && (
```

por:

```tsx
          <div className="flex items-center gap-2">
            {showSearch && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-64 pl-9"
                />
              </div>
            )}
            <SeasonSwitcher />
            {primaryAction && (
```

Añadir los imports de `Search` (icono) y `Input` (componente), que hoy no
están en este archivo:

```ts
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { SeasonSwitcher } from '@/components/layout/SeasonSwitcher'
import { ChevronDown, Search, type LucideIcon } from 'lucide-react'
```

(Solo cambia la línea de `lucide-react`, añadiendo `Search`; las demás
líneas de import ya existen tal cual — se muestran aquí solo para ubicar el
punto de inserción del nuevo import de `Input`.)

- [ ] **Step 5: Verificar que compila**

Run: `npm run build`
Expected: sin errores. `GroupsPage.tsx` (Task 2) es quien realmente
consume `search` del contexto — en este punto intermedio, antes de la
Task 2, `GroupsPage` sigue con su propio `search` local sin conflicto
(son namespaces distintos: el `search` del contexto no se usa todavía en
ningún sitio, lo cual es válido).

- [ ] **Step 6: Verificación manual en navegador**

1. `npm run dev`, sesión como `director`.
2. Ir a `/clases/grupos`: debe aparecer el buscador en el topbar (a la
   izquierda del `SeasonSwitcher`), con el subtítulo nuevo de 3 métricas.
   Escribir algo no debe filtrar nada todavía (eso es la Task 2).
3. Ir a las otras 5 pestañas: el buscador NO debe aparecer en ninguna.
4. Volver a Grupos: el buscador debe estar vacío (reseteado al cambiar de
   pestaña), no arrastrar lo que se escribió antes en otra visita.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/ClasesLayout.tsx
git commit -m "feat: buscador real en ClasesLayout, activo solo en Grupos"
```

---

### Task 2: `GroupsPage` — filtros nuevos, métricas nuevas, menú de acciones

**Files:**
- Modify: `src/pages/GroupsPage.tsx`

- [ ] **Step 1: Reescribir el archivo completo**

```tsx
import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import type { ClasesOutletContext } from '@/components/layout/ClasesLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useDataStore } from '@/stores/dataStore'
import { Plus, Users, Clock, MapPin, User, Trash2, Edit2, LayoutGrid, List, FileDown, MoreHorizontal, Activity, Hourglass } from 'lucide-react'
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
  const { groups, coaches, courts, tariffs, addGroup, updateGroup, deleteGroup, players, enrollments, club, seasons, attendance } = useDataStore()
  const { user } = useAuthStore()
  const clasesContext = useOutletContext<ClasesOutletContext | undefined>()
  const search = clasesContext?.search ?? ''

  const [levelFilter, setLevelFilter] = useState<string>('')
  const [coachFilter, setCoachFilter] = useState<string>('')
  const [seasonFilter, setSeasonFilter] = useState<string>('')
  const [dayFilter, setDayFilter] = useState<string>('')
  const [capacityFilter, setCapacityFilter] = useState<string>('')
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
  const activeSeason = club ? seasons.find((s) => s.id === club.activeSeasonId) : undefined

  const isEntrenador = user?.role === 'entrenador'
  const currentCoach = useMemo(
    () => coaches.find((c) => c.userId === user?.id),
    [coaches, user?.id]
  )

  const attendanceRateByGroup = useMemo(() => {
    const rates: Record<string, number | null> = {}
    for (const group of groups) {
      const records = attendance.filter((r) => {
        if (r.groupId !== group.id) return false
        const d = r.date instanceof Date ? r.date : new Date(r.date)
        if (activeSeason && (d < activeSeason.startDate || d > activeSeason.endDate)) return false
        return true
      })
      let present = 0
      let total = 0
      for (const record of records) {
        for (const entry of record.records) {
          total++
          if (entry.status === 'presente') present++
        }
      }
      rates[group.id] = total > 0 ? Math.round((present / total) * 100) : null
    }
    return rates
  }, [groups, attendance, activeSeason])

  const waitlistCountByGroup = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const group of groups) {
      counts[group.id] = enrollments.filter(
        (e) => e.groupId === group.id && e.isWaitlist && !e.isActive
      ).length
    }
    return counts
  }, [groups, enrollments])

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
      const matchesDay =
        dayFilter === '' || g.schedule.some((s) => s.dayOfWeek === Number(dayFilter))
      const matchesCapacity =
        capacityFilter === '' ||
        (capacityFilter === 'hueco' && g.currentEnrollment < g.maxCapacity) ||
        (capacityFilter === 'completo' && g.currentEnrollment >= g.maxCapacity)
      return matchesSearch && matchesLevel && matchesCoach && matchesSeason && matchesDay && matchesCapacity
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
  }, [groups, search, levelFilter, coachFilter, seasonFilter, dayFilter, capacityFilter, sortBy, isEntrenador, currentCoach, club?.activeSeasonId])

  const activeGroupsCount = groups.filter((g) => g.isActive).length
  const activeSeasonForEmptyState = club ? seasons.find((s) => s.id === club.activeSeasonId) : undefined

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

    const conflicts = checkGroupScheduleConflicts(
      newSlot,
      form.courtId,
      form.coachId,
      groups,
      editingGroup?.id
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
        seasonId: club?.activeSeasonId,
      })
    }

    setShowDialog(false)
    setEditingGroup(null)
    resetForm()
  }

  const isFormValid = form.name.trim() !== '' && form.coachId !== '' && form.courtId !== '' && form.startDate !== '' && form.endDate !== ''

  useEffect(() => {
    if (!clasesContext) return
    if (isEntrenador) {
      clasesContext.setPrimaryAction(null)
      return
    }
    clasesContext.setPrimaryAction({ label: 'Nuevo grupo', icon: Plus, onClick: openCreateDialog })
    return () => clasesContext.setPrimaryAction(null)
    // openCreateDialog/resetForm solo tocan setState y la constante
    // emptyForm — nada de lo que leen cambia entre renders, asi que no
    // hace falta incluirlos en las dependencias (a diferencia del bug de
    // closure obsoleta que hubo que arreglar en AgendaPage).
  }, [isEntrenador, clasesContext])

  const renderMetricsFooter = (groupId: string) => {
    const rate = attendanceRateByGroup[groupId]
    const waitlist = waitlistCountByGroup[groupId]
    return (
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" />
          <span>{rate === null ? 'Sin datos' : `${rate}%`}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Hourglass className="h-3.5 w-3.5" />
          <span>{waitlist === 0 ? 'Sin lista de espera' : `${waitlist} en espera`}</span>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="p-6 space-y-4">
        {/* Filters and view toggle */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
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
              { value: '', label: 'Todos los días' },
              ...DAYS_OF_WEEK.map((d) => ({ value: String(d.value), label: d.label })),
            ]}
            value={dayFilter}
            onChange={(e) => setDayFilter(e.target.value)}
            className="w-full sm:w-40"
          />
          <Select
            options={[
              { value: '', label: 'Todos' },
              { value: 'hueco', label: 'Con hueco' },
              { value: 'completo', label: 'Completo' },
            ]}
            value={capacityFilter}
            onChange={(e) => setCapacityFilter(e.target.value)}
            className="w-full sm:w-36"
          />
          <Select
            options={[
              { value: '', label: activeSeasonForEmptyState ? `Temporada actual: ${activeSeasonForEmptyState.name}` : 'Temporada actual' },
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
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={filteredGroups.length === 0}>
            <FileDown className="h-4 w-4 mr-1" />
            Exportar PDF
          </Button>
        </div>

        {/* Content */}
        {filteredGroups.length === 0 ? (
          <EmptyState
            icon={Users}
            title={isEntrenador ? "No tienes grupos asignados" : "No hay grupos"}
            description={
              isEntrenador
                ? "Actualmente no tienes ningún grupo asignado a tu perfil."
                : (!search && !levelFilter && !coachFilter && !dayFilter && !capacityFilter && seasonFilter !== ALL_SEASONS && (seasonFilter !== '' || club?.activeSeasonId))
                  ? "No hay grupos en esta temporada. Prueba a seleccionar 'Todas las temporadas' en el filtro, o crea un grupo nuevo."
                  : "Crea tu primer grupo para empezar a organizar las clases de la escuela"
            }
            action={isEntrenador ? undefined : { label: 'Crear grupo', onClick: openCreateDialog }}
          />
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGroups.map((group) => {
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
                      <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(group)}>
                              <Edit2 className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setShowDeleteConfirm(group.id)}>
                              <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                              <span className="text-destructive">Eliminar</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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

                    <div className="pt-2 border-t">
                      {renderMetricsFooter(group.id)}
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
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden md:table-cell">Asistencia</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden md:table-cell">Lista de espera</th>
                      {!isEntrenador && <th className="p-3 text-right text-sm font-medium text-muted-foreground w-24">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGroups.map((group) => {
                      const rate = attendanceRateByGroup[group.id]
                      const waitlist = waitlistCountByGroup[group.id]

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
                          <td className="p-3 hidden md:table-cell align-top">
                            <span className="text-sm text-muted-foreground">
                              {rate === null ? 'Sin datos' : `${rate}%`}
                            </span>
                          </td>
                          <td className="p-3 hidden md:table-cell align-top">
                            <span className="text-sm text-muted-foreground">
                              {waitlist === 0 ? 'Sin lista de espera' : `${waitlist} en espera`}
                            </span>
                          </td>
                          {!isEntrenador && (
                            <td className="p-3 text-right align-top" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openEditDialog(group)}>
                                    <Edit2 className="h-4 w-4 mr-2" /> Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => setShowDeleteConfirm(group.id)}>
                                    <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                                    <span className="text-destructive">Eliminar</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
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
```

Notas sobre este reemplazo respecto al archivo original:
- Se quita el `<Input>`/icono `Search` de búsqueda de la fila de filtros
  (ahora vive en `ClasesLayout`) y el import de `Search` de `lucide-react`
  (ya no se usa en este archivo).
- `search` ya no es `useState` local — se lee de `clasesContext?.search`.
- `activeGroupsCount` queda sin usar tras este cambio (no se usaba en
  ningún sitio del render ya en el archivo original tampoco — confirmar al
  implementar; si de verdad no se usa, se puede quitar esa línea también,
  no es necesario mantenerla).
- Se renombra la variable local `activeSeason` usada solo para el mensaje
  del `EmptyState` a `activeSeasonForEmptyState` para no chocar con la
  nueva `activeSeason` (usada por `attendanceRateByGroup`) — mismo valor,
  dos nombres porque uno se calculaba más abajo en el archivo original y
  ahora hace falta más arriba.

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: sin errores. Prestar atención a que `useDataStore()` exponga
`attendance` (ya lo usa `AgendaPage`/`AttendancePage`/`PlayersPage`, así
que debería existir con el mismo nombre).

- [ ] **Step 3: Verificación manual en navegador**

1. Ir a `/clases/grupos` como `director`.
2. Escribir en el buscador del topbar y confirmar que filtra la lista de
   grupos por nombre (tanto en vista Tarjetas como Tabla).
3. Probar los filtros nuevos: Día (un grupo con horario en Lunes debe
   aparecer al filtrar por "Lunes" y desaparecer al filtrar por otro día
   sin ese horario); Plazas ("Con hueco" debe ocultar los grupos llenos,
   "Completo" debe mostrar solo los llenos).
4. Confirmar que los filtros existentes (Nivel, Entrenador, Temporada,
   Ordenar) siguen funcionando igual que antes.
5. En vista Tarjetas: confirmar que cada tarjeta muestra la fila de
   Asistencia/Lista de espera al final, y que el menú "···" reemplaza a
   los botones de Editar/Eliminar (mismo comportamiento, sin navegar a la
   ficha del grupo al hacer clic en el menú).
6. En vista Tabla: confirmar las 2 columnas nuevas (Asistencia, Lista de
   espera) y que el menú "···" en Acciones también funciona.
7. Repetir como `entrenador`: sin botón "Nuevo grupo" (ya comprobado en
   Fase A), sin columna/menú de Acciones (ya era así antes), grupos
   filtrados a los propios.

- [ ] **Step 4: Commit**

```bash
git add src/pages/GroupsPage.tsx
git commit -m "feat: rediseñar GroupsPage con filtros nuevos, metricas de asistencia/lista de espera y menu de acciones"
```

---

### Task 3: Verificación final del conjunto

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Build y tests completos**

Run: `npm run build`
Expected: sin errores.

Run: `npm test`
Expected: mismo número de tests que el baseline antes de este plan (esta
página no tiene tests dedicados).

- [ ] **Step 2: Recorrido manual completo**

1. `npm run dev`, sesión como `director`.
2. Repetir el recorrido de la Fase A por las 6 pestañas de Clases y
   confirmar que nada se rompió fuera de Grupos (el buscador no debe
   aparecer en ninguna otra pestaña, los botones de acción primaria siguen
   correctos en cada una).
3. Crear un grupo de prueba, editarlo desde el menú "···", eliminarlo —
   confirmar que el flujo completo sigue funcionando igual que antes de
   este plan.
4. Verificar en la consola del navegador que no hay errores nuevos.

- [ ] **Step 3: Repetir el proceso de `subagent-driven-development`**

Tras completar las Tasks 1-2 (cada una con su implementador + revisor de
spec + revisor de calidad), dispatch un revisor final sobre el diff
completo de este plan. Después, usar
`superpowers:finishing-a-development-branch`.
