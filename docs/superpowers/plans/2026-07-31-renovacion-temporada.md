# Renovación de temporada — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir a admin/coordinador traspasar grupos (con o sin sus alumnos matriculados) a una nueva temporada, en bloque, desde una página nueva "Temporadas" con un asistente de confirmación en acordeón.

**Architecture:** Nueva entidad `Season` (etiqueta histórica, sin lógica de "temporada activa"). `Group` gana `seasonId`/`renewedFromGroupId`/`renewedToGroupId`. Una acción de store `renewGroup` centraliza el traspaso: crea el grupo nuevo, archiva el viejo, cierra sus matrículas activas y crea matrículas nuevas para los alumnos incluidos. La UI vive en una página nueva (`SeasonsPage.tsx`) + un diálogo de traspaso en acordeón (`RenewGroupsDialog.tsx`), reutilizando componentes ya existentes (`Select`, `Checkbox`, `Dialog`) — no se añade ninguna librería nueva.

**Tech Stack:** React 19 + TypeScript, Zustand, Firebase Firestore, React Router, Tailwind CSS v4, Vitest.

---

### Task 1: Tipos — `Season`, campos nuevos en `Group`, `ActivityType`

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Paso 1: Añadir el tipo `Season`**

Justo después de la interfaz `Holiday` (línea 50, tras `// --- Configuración Global ---`), añadir:

```ts
// --- Temporada ---
export interface Season {
  id: string
  name: string
  startDate: Date
  endDate: Date
  createdAt: Date
}
```

- [ ] **Paso 2: Añadir los 3 campos nuevos a `Group`**

En la interfaz `Group` (líneas 207-227), justo antes de `isActive: boolean`, añadir:

```ts
  seasonId?: string           // temporada a la que pertenece; ausente = "sin temporada asignada"
  renewedFromGroupId?: string // si este grupo nació de un traspaso, el id del grupo viejo
  renewedToGroupId?: string   // si este grupo ya fue traspasado, el id del grupo nuevo
```

La interfaz queda:

```ts
export interface Group {
  id: string
  name: string
  level: PlayerLevel
  coachId: string
  coachName: string
  courtId: string
  courtName: string
  schedule: ScheduleSlot[]
  maxCapacity: number
  currentEnrollment: number
  defaultTariffId: string
  defaultTariffPrice: number
  billingFrequency: BillingFrequency
  /** Prices keyed by 'YYYY-MM', copied from the tariff for fast payment generation. */
  installmentPrices?: Record<string, number>
  startDate: Date
  endDate: Date
  seasonId?: string
  renewedFromGroupId?: string
  renewedToGroupId?: string
  isActive: boolean
  createdAt: Date
}
```

- [ ] **Paso 3: Añadir `'season_group_renewed'` a `ActivityType`**

En el `ActivityType` union (líneas 366-402), añadir la línea `| 'season_group_renewed'` justo después de `| 'waitlist_spot_available'`.

- [ ] **Paso 4: Build**

Run: `npm run build`
Expected: FALLA con un error de TypeScript en `src/pages/ActivityLogPage.tsx` — `ACTIVITY_LABELS` es `Record<ActivityType, string>` (exhaustivo) y no tiene entrada para `'season_group_renewed'` todavía. Este fallo es esperado y se corrige en el Paso 5.

- [ ] **Paso 5: Añadir la etiqueta en `ActivityLogPage.tsx`**

En `src/pages/ActivityLogPage.tsx`, en el objeto `ACTIVITY_LABELS` (líneas 23-56 aprox.), añadir justo después de `waitlist_spot_available: 'Plaza libre (lista de espera)',`:

```ts
  season_group_renewed: 'Grupo traspasado de temporada',
```

Opcionalmente, en `ACTIVITY_COLORS` (objeto `Partial`, no exhaustivo, líneas ~60-94), añadir:

```ts
  season_group_renewed: 'text-indigo-700',
```

- [ ] **Paso 6: Build de nuevo**

Run: `npm run build`
Expected: sin errores de TypeScript.

- [ ] **Paso 7: Commit**

```bash
git add src/types/index.ts src/pages/ActivityLogPage.tsx
git commit -m "feat: tipos para renovacion de temporada (Season, campos en Group)"
```

---

### Task 2: Firestore rules + registro en realtime sync

**Files:**
- Modify: `firestore.rules`
- Modify: `src/lib/realtimeSync.ts`

- [ ] **Paso 1: Añadir las reglas de `seasons`**

En `firestore.rules`, justo después del bloque `match /groups/{groupId} { ... }` (líneas 120-125), añadir:

```javascript
    match /seasons/{seasonId} {
      allow read: if isAuthenticated() && (isAdmin() || belongsToClub());
      allow create: if isAdmin() && (incomingBelongsToClub() || request.resource.data.clubId == null);
      allow update: if isAdmin() && (belongsToClub() || resource.data.clubId == null);
      allow delete: if isAdmin() && (belongsToClub() || resource.data.clubId == null);
    }
```

- [ ] **Paso 2: Registrar la colección en realtime sync**

En `src/lib/realtimeSync.ts`, en el array `COLLECTIONS` (líneas 14-39), añadir tras `{ name: 'groups', stateKey: 'groups' }`:

```ts
  { name: 'seasons', stateKey: 'seasons' },
```

- [ ] **Paso 3: Confirmar que jugador/tutor no reciben `seasons`**

Leer `src/lib/realtimeSync.ts` líneas 96-111 (el filtro por rol) y confirmar que la lista permitida para `jugador`/`tutor` (que hoy es `players, groups, enrollments, attendance, payments, events, invoices, privateLessonPayments, eventPayments, attendanceNotices, vouchers, evaluations, matchReports`) **no incluye** `seasons` — no hace falta añadirla ahí, es intencional que jugadores/tutores no vean la colección de temporadas.

- [ ] **Paso 4: Build**

Run: `npm run build`
Expected: sin errores de TypeScript (este cambio no afecta tipos, pero confirma que nada se rompió).

- [ ] **Paso 5: Commit**

```bash
git add firestore.rules src/lib/realtimeSync.ts
git commit -m "feat: reglas de seguridad y sincronizacion realtime para seasons"
```

---

### Task 3: Store — slice `seasons` + acción `addSeason`

**Files:**
- Modify: `src/stores/dataStore.ts`

- [ ] **Paso 1: Añadir el import del tipo `Season`**

En `src/stores/dataStore.ts`, buscar la línea donde se importan los tipos desde `@/types` (agrupados en un único `import type { ... } from '@/types'` o similar) y añadir `Season` a esa lista de imports.

- [ ] **Paso 2: Añadir el slice `seasons` a `DataState`**

En la interfaz `DataState` (líneas 93-118), añadir `seasons: Season[]` justo después de `groups: Group[]`.

- [ ] **Paso 3: Añadir `seasons: []` al estado inicial**

Buscar el objeto de estado inicial del store (donde se inicializan `courts: []`, `groups: []`, etc., antes de las acciones) y añadir `seasons: [],` junto a `groups: [],`.

- [ ] **Paso 4: Añadir la firma de `addSeason` a `DataState`**

Junto a las firmas de `addGroup`/`updateGroup`/`deleteGroup` (líneas 148-151), añadir:

```ts
  // --- Seasons CRUD ---
  addSeason: (season: Omit<Season, 'id' | 'createdAt'>) => Season
```

- [ ] **Paso 5: Implementar `addSeason`**

Junto a la implementación de `addGroup` (líneas 840-853), añadir la implementación de `addSeason`, siguiendo exactamente el mismo patrón:

```ts
      addSeason: (seasonData) => {
        const newSeason: Season = { ...seasonData, id: generateId(), createdAt: new Date() }
        set((state) => ({ seasons: [...state.seasons, newSeason] }))
        const clubId = getClubId()
        if (clubId) syncDoc('seasons', newSeason.id, newSeason as any, clubId)
        return newSeason
      },
```

- [ ] **Paso 6: Build**

Run: `npm run build`
Expected: sin errores de TypeScript.

- [ ] **Paso 7: Commit**

```bash
git add src/stores/dataStore.ts
git commit -m "feat: slice seasons y accion addSeason en el store"
```

---

### Task 4: Store — acción `renewGroup` (traspaso de un grupo)

**Files:**
- Modify: `src/stores/dataStore.ts`

**Contexto:** Esta es la acción central del feature. Por cada grupo traspasado: crea el grupo nuevo (vinculado a la temporada destino y al grupo viejo), archiva el grupo viejo, cierra todas sus matrículas activas, y crea matrículas nuevas solo para los alumnos incluidos. No usa transacciones atómicas de Firestore (a diferencia de `addEnrollment`/`moveEnrollment`, que las necesitan por el riesgo de condiciones de carrera en capacidad de grupo con múltiples usuarios matriculando a la vez) — aquí no hay ese riesgo: es una operación puntual de admin, con el conteo de alumnos ya conocido de antemano.

- [ ] **Paso 1: Añadir la firma de `renewGroup` a `DataState`**

Junto a la firma de `moveEnrollment` (cerca de la línea 163), añadir:

```ts
  renewGroup: (params: {
    oldGroupId: string
    seasonId: string
    groupData: {
      name: string
      level: PlayerLevel
      coachId: string
      coachName: string
      courtId: string
      courtName: string
      schedule: ScheduleSlot[]
      maxCapacity: number
      defaultTariffId: string
      defaultTariffPrice: number
      billingFrequency: BillingFrequency
      billingAnchorMonth?: number
      startDate: Date
      endDate: Date
    }
    includeStudents: boolean
    includedPlayerIds: string[]
  }) => Promise<{ newGroupId: string }>
  renewGroups: (
    items: Array<Parameters<DataState['renewGroup']>[0]>
  ) => Promise<{ newGroupId: string }[]>
```

(Confirmar que `PlayerLevel` y `ScheduleSlot` ya están importados en este archivo desde `@/types` — si no lo están, añadirlos al import existente.)

- [ ] **Paso 2: Implementar `renewGroup`**

Junto a la implementación de `moveEnrollment` (línea 1035), añadir:

```ts
      renewGroup: async ({ oldGroupId, seasonId, groupData, includeStudents, includedPlayerIds }) => {
        const clubId = getClubId()
        if (!clubId) throw new Error('No clubId found')

        const oldGroup = get().groups.find((g) => g.id === oldGroupId)
        if (!oldGroup) throw new Error('Grupo no encontrado')

        const tariff = get().tariffs.find((t) => t.id === groupData.defaultTariffId)
        if (!tariff) throw new Error('Tarifa no encontrada')

        const now = new Date()
        const newGroupId = generateId()

        const activeEnrollments = get().enrollments.filter(
          (e) => e.groupId === oldGroupId && e.isActive
        )
        const includedEnrollments = includeStudents
          ? activeEnrollments.filter((e) => includedPlayerIds.includes(e.playerId))
          : []

        const newGroup: Group = {
          ...groupData,
          id: newGroupId,
          seasonId,
          renewedFromGroupId: oldGroupId,
          currentEnrollment: includedEnrollments.length,
          isActive: true,
          createdAt: now,
        }

        const newEnrollments: Enrollment[] = includedEnrollments.map((e) => ({
          id: generateId(),
          playerId: e.playerId,
          playerName: e.playerName,
          groupId: newGroupId,
          groupName: newGroup.name,
          tariffId: tariff.id,
          tariffName: tariff.name,
          billingFrequency: groupData.billingFrequency,
          billingAnchorMonth: groupData.billingAnchorMonth,
          enrollmentDate: now,
          isActive: true,
        }))

        try {
          // 1. Crear el grupo nuevo
          set((state) => ({ groups: [...state.groups, newGroup] }))
          await syncDoc('groups', newGroupId, newGroup as any, clubId)

          // 2. Crear las matriculas nuevas para los alumnos incluidos
          for (const enrollment of newEnrollments) {
            await syncDoc('enrollments', enrollment.id, enrollment as any, clubId)
          }
          set((state) => ({ enrollments: [...state.enrollments, ...newEnrollments] }))

          // 3. Cerrar TODAS las matriculas activas del grupo viejo (se traspasen o no)
          for (const enrollment of activeEnrollments) {
            const closed = { ...enrollment, isActive: false, unenrollmentDate: now }
            await syncDoc('enrollments', enrollment.id, closed as any, clubId)
          }
          set((state) => ({
            enrollments: state.enrollments.map((e) =>
              activeEnrollments.some((ae) => ae.id === e.id)
                ? { ...e, isActive: false, unenrollmentDate: now }
                : e
            ),
          }))

          // 4. Archivar el grupo viejo
          const archivedOldGroup = { ...oldGroup, isActive: false, renewedToGroupId: newGroupId }
          await syncDoc('groups', oldGroupId, archivedOldGroup as any, clubId)
          set((state) => ({
            groups: state.groups.map((g) => (g.id === oldGroupId ? archivedOldGroup : g)),
          }))

          // 5. Jugadores excluidos sin otras matriculas activas: pasan a lista_espera
          const excludedPlayerIds = activeEnrollments
            .map((e) => e.playerId)
            .filter((playerId) => !includedPlayerIds.includes(playerId))
          for (const playerId of excludedPlayerIds) {
            const stillActive = get().enrollments.some(
              (e) => e.playerId === playerId && e.isActive
            )
            if (!stillActive) {
              const player = get().players.find((p) => p.id === playerId)
              if (player && player.status === 'activo') {
                get().updatePlayer(playerId, { status: 'lista_espera' })
              }
            }
          }

          const { userId, userName } = getCurrentUser()
          get().addActivity({
            type: 'season_group_renewed',
            description: `Grupo ${oldGroup.name} traspasado a ${newGroup.name}`,
            relatedEntityId: newGroupId,
            userId,
            userName,
          })

          return { newGroupId }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Error desconocido'
          toast.error(`Error al traspasar el grupo: ${message}`)
          throw error
        }
      },

      renewGroups: async (items) => {
        const results: { newGroupId: string }[] = []
        for (const item of items) {
          results.push(await get().renewGroup(item))
        }
        return results
      },
```

- [ ] **Paso 3: Build**

Run: `npm run build`
Expected: sin errores de TypeScript. Si hay un error de tipos por `PlayerLevel`/`ScheduleSlot`/`Enrollment`/`Group` no importados, añadirlos al import existente de `@/types` en la cabecera del archivo.

- [ ] **Paso 4: Commit**

```bash
git add src/stores/dataStore.ts
git commit -m "feat: accion renewGroup para traspasar un grupo a una nueva temporada"
```

---

### Task 5: Página `SeasonsPage.tsx`

**Files:**
- Create: `src/pages/SeasonsPage.tsx`

**Contexto:** Página con selector de temporada de origen, tabla de grupos de esa temporada con checkboxes, selector de temporada destino (+ crear nueva temporada), y botón para abrir el asistente de traspaso (Task 6).

- [ ] **Paso 1: Crear la página**

```tsx
import { useMemo, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { useDataStore } from '@/stores/dataStore'
import { NewSeasonDialog } from '@/components/shared/NewSeasonDialog'
import { RenewGroupsDialog } from '@/components/shared/RenewGroupsDialog'
import type { Group } from '@/types'

const NO_SEASON = '__none__'

export default function SeasonsPage() {
  const { seasons, groups, enrollments } = useDataStore()

  const [originSeasonId, setOriginSeasonId] = useState<string>(NO_SEASON)
  const [destinationSeasonId, setDestinationSeasonId] = useState<string>('')
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set())
  const [showNewSeason, setShowNewSeason] = useState<'origin' | 'destination' | null>(null)
  const [showWizard, setShowWizard] = useState(false)

  const seasonOptions = [
    { value: NO_SEASON, label: 'Sin temporada asignada' },
    ...seasons.map((s) => ({ value: s.id, label: s.name })),
  ]

  const originGroups = useMemo(() => {
    return groups.filter((g) =>
      g.isActive && (originSeasonId === NO_SEASON ? !g.seasonId : g.seasonId === originSeasonId)
    )
  }, [groups, originSeasonId])

  const studentCount = (group: Group) =>
    enrollments.filter((e) => e.groupId === group.id && e.isActive).length

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const selectableGroups = originGroups.filter((g) => !g.renewedToGroupId)

  return (
    <div>
      <Header title="Temporadas" subtitle="Traspasa grupos y sus alumnos a una nueva temporada" />
      <div className="p-6 space-y-4">
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600">Temporada de origen:</span>
                <Select
                  options={seasonOptions}
                  value={originSeasonId}
                  onChange={(e) => {
                    setOriginSeasonId(e.target.value)
                    setSelectedGroupIds(new Set())
                  }}
                  className="w-auto"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600">Traspasar a:</span>
                <Select
                  options={seasons.map((s) => ({ value: s.id, label: s.name }))}
                  value={destinationSeasonId}
                  onChange={(e) => setDestinationSeasonId(e.target.value)}
                  placeholder="Elegir temporada destino"
                  className="w-auto"
                />
                <Button variant="outline" size="sm" onClick={() => setShowNewSeason('destination')}>
                  + Nueva temporada
                </Button>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-2 w-8"></th>
                  <th className="py-2 pr-2">Grupo</th>
                  <th className="py-2 pr-2">Nivel</th>
                  <th className="py-2 pr-2">Alumnos</th>
                  <th className="py-2 pr-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {originGroups.map((group) => (
                  <tr key={group.id} className="border-b last:border-0">
                    <td className="py-2 pr-2">
                      {!group.renewedToGroupId && (
                        <Checkbox
                          checked={selectedGroupIds.has(group.id)}
                          onCheckedChange={() => toggleGroup(group.id)}
                        />
                      )}
                    </td>
                    <td className="py-2 pr-2 font-medium">{group.name}</td>
                    <td className="py-2 pr-2">{group.level}</td>
                    <td className="py-2 pr-2">{studentCount(group)}</td>
                    <td className="py-2 pr-2">
                      {group.renewedToGroupId ? (
                        <Badge variant="secondary" className="text-emerald-700">
                          ✓ Traspasado a{' '}
                          {seasons.find((s) => s.id === groups.find((g) => g.id === group.renewedToGroupId)?.seasonId)?.name ?? '—'}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-700">Pendiente</Badge>
                      )}
                    </td>
                  </tr>
                ))}
                {originGroups.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      No hay grupos en esta temporada de origen.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="flex justify-end">
              <Button
                disabled={selectedGroupIds.size === 0 || !destinationSeasonId}
                onClick={() => setShowWizard(true)}
              >
                Traspasar seleccionados ({selectedGroupIds.size}) →
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {showNewSeason && (
        <NewSeasonDialog
          open
          onOpenChange={(open) => !open && setShowNewSeason(null)}
          onCreated={(season) => {
            if (showNewSeason === 'destination') setDestinationSeasonId(season.id)
            setShowNewSeason(null)
          }}
        />
      )}

      {showWizard && destinationSeasonId && (
        <RenewGroupsDialog
          open
          onOpenChange={setShowWizard}
          seasonId={destinationSeasonId}
          groups={selectableGroups.filter((g) => selectedGroupIds.has(g.id))}
          onDone={() => {
            setShowWizard(false)
            setSelectedGroupIds(new Set())
          }}
        />
      )}
    </div>
  )
}
```

Nota: `originGroups` incluye grupos ya traspasados (`renewedToGroupId` presente) para que se vean en la tabla con su estado "✓ Traspasado", pero `selectableGroups` (usado al abrir el asistente) los excluye — solo los `Pendiente` son seleccionables, tal como ya refleja el checkbox condicional en la tabla (`{!group.renewedToGroupId && <Checkbox .../>}`).

- [ ] **Paso 2: Build (fallará, los componentes de los pasos 6-7 aún no existen)**

Run: `npm run build`
Expected: FALLA con "Cannot find module '@/components/shared/NewSeasonDialog'" y "Cannot find module '@/components/shared/RenewGroupsDialog'". Esperado — se resuelve en las tareas 6 y 7. No hacer commit todavía.

---

### Task 6: Diálogo `NewSeasonDialog.tsx`

**Files:**
- Create: `src/components/shared/NewSeasonDialog.tsx`

- [ ] **Paso 1: Crear el diálogo**

```tsx
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDataStore } from '@/stores/dataStore'
import { toast } from '@/hooks/use-toast'
import type { Season } from '@/types'

interface NewSeasonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (season: Season) => void
}

export function NewSeasonDialog({ open, onOpenChange, onCreated }: NewSeasonDialogProps) {
  const { addSeason } = useDataStore()
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const handleCreate = () => {
    if (!name.trim() || !startDate || !endDate) {
      toast.error('Rellena nombre, fecha de inicio y fecha de fin')
      return
    }
    const season = addSeason({
      name: name.trim(),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    })
    setName('')
    setStartDate('')
    setEndDate('')
    onCreated(season)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva temporada</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="season-name">Nombre</Label>
            <Input
              id="season-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="2026-2027"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="season-start">Fecha de inicio</Label>
              <Input
                id="season-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="season-end">Fecha de fin</Label>
              <Input
                id="season-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate}>Crear temporada</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Paso 2: Build**

Run: `npm run build`
Expected: sigue fallando solo por `RenewGroupsDialog` (Task 7). Confirmar que el error de `NewSeasonDialog` ya no aparece.

- [ ] **Paso 3: Commit**

```bash
git add src/components/shared/NewSeasonDialog.tsx
git commit -m "feat: dialogo para crear una nueva temporada"
```

---

### Task 7: Diálogo `RenewGroupsDialog.tsx` (asistente de traspaso en acordeón)

**Files:**
- Create: `src/components/shared/RenewGroupsDialog.tsx`

**Contexto:** No existe un componente Accordion en `src/components/ui/` (se confirmó al investigar el codebase). En vez de añadir una dependencia nueva, se replica el patrón de colapsable manual ya usado en `Sidebar.tsx` (`useState<Record<string, boolean>>` + icono de flecha), consistente con el resto del código.

- [ ] **Paso 1: Crear el componente**

```tsx
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useDataStore } from '@/stores/dataStore'
import { toast } from '@/hooks/use-toast'
import type { Group, BillingFrequency } from '@/types'

interface RenewGroupsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  seasonId: string
  groups: Group[]
  onDone: () => void
}

interface GroupDraft {
  name: string
  defaultTariffId: string
  defaultTariffPrice: number
  billingFrequency: BillingFrequency
  billingAnchorMonth: number
  startDate: string
  endDate: string
  includeStudents: boolean
  includedPlayerIds: Set<string>
}

const BILLING_OPTIONS = [
  { value: 'monthly', label: 'Mensual' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'annual', label: 'Anual' },
  { value: 'installments', label: 'Cuotas' },
]

function toDateInput(d: Date): string {
  return d.toISOString().split('T')[0]
}

export function RenewGroupsDialog({ open, onOpenChange, seasonId, groups, onDone }: RenewGroupsDialogProps) {
  const { seasons, enrollments, renewGroups } = useDataStore()
  const season = seasons.find((s) => s.id === seasonId)

  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(groups.map((g) => [g.id, true]))
  )
  const [drafts, setDrafts] = useState<Record<string, GroupDraft>>(() =>
    Object.fromEntries(
      groups.map((g) => {
        const activePlayerIds = enrollments
          .filter((e) => e.groupId === g.id && e.isActive)
          .map((e) => e.playerId)
        return [
          g.id,
          {
            name: g.name,
            defaultTariffId: g.defaultTariffId,
            defaultTariffPrice: g.defaultTariffPrice,
            billingFrequency: g.billingFrequency,
            billingAnchorMonth: 1,
            startDate: season ? toDateInput(season.startDate) : '',
            endDate: season ? toDateInput(season.endDate) : '',
            includeStudents: true,
            includedPlayerIds: new Set(activePlayerIds),
          },
        ]
      })
    )
  )
  const [submitting, setSubmitting] = useState(false)

  const updateDraft = (groupId: string, patch: Partial<GroupDraft>) => {
    setDrafts((prev) => ({ ...prev, [groupId]: { ...prev[groupId], ...patch } }))
  }

  const togglePlayer = (groupId: string, playerId: string) => {
    setDrafts((prev) => {
      const draft = prev[groupId]
      const next = new Set(draft.includedPlayerIds)
      if (next.has(playerId)) next.delete(playerId)
      else next.add(playerId)
      return { ...prev, [groupId]: { ...draft, includedPlayerIds: next } }
    })
  }

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      const items = groups.map((group) => {
        const draft = drafts[group.id]
        return {
          oldGroupId: group.id,
          seasonId,
          groupData: {
            name: draft.name,
            level: group.level,
            coachId: group.coachId,
            coachName: group.coachName,
            courtId: group.courtId,
            courtName: group.courtName,
            schedule: group.schedule,
            maxCapacity: group.maxCapacity,
            defaultTariffId: draft.defaultTariffId,
            defaultTariffPrice: draft.defaultTariffPrice,
            billingFrequency: draft.billingFrequency,
            billingAnchorMonth:
              draft.billingFrequency === 'quarterly' || draft.billingFrequency === 'annual'
                ? draft.billingAnchorMonth
                : undefined,
            startDate: new Date(draft.startDate),
            endDate: new Date(draft.endDate),
          },
          includeStudents: draft.includeStudents,
          includedPlayerIds: Array.from(draft.includedPlayerIds),
        }
      })
      await renewGroups(items)
      toast.success(`${groups.length} grupo(s) traspasado(s) a ${season?.name ?? 'la nueva temporada'}`)
      onDone()
    } catch {
      // renewGroup ya muestra su propio toast de error
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Traspasar a {season?.name ?? 'temporada'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {groups.map((group) => {
            const draft = drafts[group.id]
            const activeEnrollments = enrollments.filter((e) => e.groupId === group.id && e.isActive)
            const isOpen = expanded[group.id]

            return (
              <div key={group.id} className="border rounded-lg">
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-3 text-left font-medium"
                  onClick={() => setExpanded((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
                >
                  <span>{group.name}</span>
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>

                {isOpen && (
                  <div className="p-3 pt-0 space-y-3 border-t">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Precio</Label>
                        <Input
                          type="number"
                          value={draft.defaultTariffPrice}
                          onChange={(e) =>
                            updateDraft(group.id, { defaultTariffPrice: parseFloat(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div>
                        <Label>Frecuencia de facturación</Label>
                        <Select
                          options={BILLING_OPTIONS}
                          value={draft.billingFrequency}
                          onChange={(e) =>
                            updateDraft(group.id, { billingFrequency: e.target.value as BillingFrequency })
                          }
                        />
                      </div>
                      <div>
                        <Label>Fecha de inicio</Label>
                        <Input
                          type="date"
                          value={draft.startDate}
                          onChange={(e) => updateDraft(group.id, { startDate: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Fecha de fin</Label>
                        <Input
                          type="date"
                          value={draft.endDate}
                          onChange={(e) => updateDraft(group.id, { endDate: e.target.value })}
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={draft.includeStudents}
                        onCheckedChange={(checked) =>
                          updateDraft(group.id, { includeStudents: checked === true })
                        }
                      />
                      Traspasar también a los alumnos matriculados
                    </label>

                    {draft.includeStudents && (
                      <div className="space-y-1 max-h-40 overflow-y-auto border rounded p-2">
                        {activeEnrollments.map((e) => (
                          <label key={e.playerId} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={draft.includedPlayerIds.has(e.playerId)}
                              onCheckedChange={() => togglePlayer(group.id, e.playerId)}
                            />
                            {e.playerName}
                          </label>
                        ))}
                        {activeEnrollments.length === 0 && (
                          <p className="text-xs text-slate-400">Sin alumnos matriculados actualmente.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Traspasando...' : `Confirmar traspaso de ${groups.length} grupo(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Paso 2: Build**

Run: `npm run build`
Expected: sin errores de TypeScript.

- [ ] **Paso 3: Commit**

```bash
git add src/components/shared/RenewGroupsDialog.tsx
git commit -m "feat: asistente de traspaso de grupos en acordeon"
```

---

### Task 8: Ruta y enlace de navegación

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Paso 1: Registrar el lazy import y la ruta en `App.tsx`**

Junto a los demás `lazy(() => import(...))` (cerca de la línea 41), añadir:

```ts
const SeasonsPage = lazy(() => import('@/pages/SeasonsPage'))
```

Junto a las rutas administrativas ya protegidas con `RoleRoute` (cerca de la línea 171, dentro del mismo bloque `<Route>` protegido), añadir:

```tsx
            <Route path="/temporadas" element={<RoleRoute module="settings"><SeasonsPage /></RoleRoute>} />
```

- [ ] **Paso 2: Añadir el enlace en `Sidebar.tsx`**

En `src/components/layout/Sidebar.tsx`, en el grupo `Configuración` de `navGroups` (junto a `Configuración`, `Registro de actividad`), añadir un nuevo `NavItem`:

```ts
      { name: 'Temporadas', href: '/temporadas', icon: CalendarRange, requiredModule: 'settings' },
```

Añadir `CalendarRange` al import de `lucide-react` en la cabecera del archivo (junto a los demás iconos ya importados).

- [ ] **Paso 3: Confirmar que entrenador/jugador no ven el enlace**

`requiredModule: 'settings'` ya sigue el mismo mecanismo de `hasPermission` que oculta "Configuración"/"Registro de actividad" a roles sin ese permiso — no hace falta lógica adicional. Para `entrenador`, además, `coachAllowedPaths` (línea ~124 de `Sidebar.tsx`) no incluye `/temporadas`, así que aunque tuviera el permiso de módulo, el filtro por rol ya lo bloquearía; confirmar leyendo esa lista que sigue siendo así (no añadir `/temporadas` a `coachAllowedPaths`).

- [ ] **Paso 4: Build**

Run: `npm run build`
Expected: sin errores de TypeScript.

- [ ] **Paso 5: Commit**

```bash
git add src/App.tsx src/components/layout/Sidebar.tsx
git commit -m "feat: ruta y enlace de navegacion para la pagina Temporadas"
```

---

### Task 9: Verificación final

**Files:** ninguno (solo verificación)

- [ ] **Paso 1: Build y tests completos**

Run: `npm run build`
Expected: sin errores.

Run: `npm test`
Expected: los tests existentes (31) siguen pasando. Esta funcionalidad no añade tests nuevos (es UI + store actions sin lógica pura aislada equivalente a `invitation-utils.ts`; si el reviewer de calidad considera que `renewGroup` merece un test unitario extrayendo su lógica de selección de alumnos excluidos a una función pura, puede sugerirlo, pero no es requisito de este plan).

- [ ] **Paso 2: Verificación manual (dev o preview)**

1. Ir a "Temporadas" en el menú (como director/coordinador).
2. Crear una temporada "2026-2027".
3. Con origen "Sin temporada asignada", seleccionar 2 grupos con alumnos matriculados, destino "2026-2027", pulsar "Traspasar seleccionados".
4. En el asistente: cambiar el precio de un grupo, dejar el otro igual; desmarcar a un alumno en uno de los grupos. Confirmar.
5. Comprobar: 2 grupos nuevos activos vinculados a "2026-2027"; los 2 grupos viejos aparecen "✓ Traspasado a 2026-2027" en la tabla; el alumno desmarcado no tiene matrícula activa en ningún grupo; los alumnos incluidos tienen matrícula nueva en el grupo nuevo (con el precio editado si se cambió) y ninguna matrícula activa en el grupo viejo.
6. Cambiar el selector de temporada de origen a "2026-2027" — debe aparecer vacío de grupos pendientes (los grupos nuevos son destino, no origen, todavía).
7. Confirmar que un usuario con rol `entrenador` o `jugador`/`tutor` no ve el enlace "Temporadas" en el menú.
