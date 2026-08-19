# Temporada activa en Grupos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introducir "temporada activa" como concepto de primera clase: un selector en la cabecera (solo director/coordinador) que marca en qué temporada trabaja el club, con migración automática de los grupos existentes, filtrado por defecto en Grupos, filtrado opcional en Pagos, y sin tocar la generación de recibos.

**Architecture:** Se añade `activeSeasonId?: string` a `Club`. Una acción `ensureActiveSeason` en el store crea/reutiliza "Temporada 2025/2026", asigna esa temporada a los grupos activos sin `seasonId`, y fija `club.activeSeasonId` — se ejecuta una vez, automáticamente, tras la primera carga de datos, solo para roles `director`/`coordinador`. Un componente `SeasonSwitcher` (mismo patrón que `ChildSwitcher`) permite cambiarla. `GroupsPage.tsx` filtra por defecto por la temporada activa (con opción de ver otras); `PaymentsPage.tsx` gana un filtro de temporada opcional, calculado al vuelo desde el grupo del pago. La generación de recibos no cambia.

**Tech Stack:** React 19 + TypeScript, Zustand (`src/stores/dataStore.ts`), Firebase Firestore (writeBatch), Vitest.

---

## Task 1: `Club.activeSeasonId` + acción `ensureActiveSeason` en el store, con tests

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/stores/dataStore.ts`
- Test: `src/lib/season-utils.test.ts` (nuevo)
- Create: `src/lib/season-utils.ts` (nuevo — lógica pura extraída para poder testearla sin Firestore)

Antes de tocar el store, extraemos la única pieza de lógica pura de `ensureActiveSeason` (encontrar-o-decidir-crear la temporada de migración) a un archivo separado, testeable sin mocks de Firestore.

- [ ] **Step 1: Escribir el test que falla para `findOrBuildMigrationSeason`**

Crear `src/lib/season-utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { findOrBuildMigrationSeason } from '@/lib/season-utils'
import type { Season } from '@/types'

const MIGRATION_SEASON_NAME = 'Temporada 2025/2026'

describe('findOrBuildMigrationSeason', () => {
  it('reutiliza una temporada existente con el nombre exacto', () => {
    const existing: Season = {
      id: 'season-1',
      name: MIGRATION_SEASON_NAME,
      startDate: new Date(2025, 8, 1),
      endDate: new Date(2026, 5, 30),
      createdAt: new Date(2025, 8, 1),
    }
    const result = findOrBuildMigrationSeason([existing], new Date(2025, 8, 1), new Date(2026, 5, 30))
    expect(result.reuse).toBe(true)
    if (result.reuse) {
      expect(result.season.id).toBe('season-1')
    }
  })

  it('reutiliza una temporada existente ignorando mayusculas/minusculas y espacios', () => {
    const existing: Season = {
      id: 'season-2',
      name: '  temporada 2025/2026  ',
      startDate: new Date(2025, 8, 1),
      endDate: new Date(2026, 5, 30),
      createdAt: new Date(2025, 8, 1),
    }
    const result = findOrBuildMigrationSeason([existing], new Date(2025, 8, 1), new Date(2026, 5, 30))
    expect(result.reuse).toBe(true)
    if (result.reuse) {
      expect(result.season.id).toBe('season-2')
    }
  })

  it('propone crear una temporada nueva si no existe ninguna con ese nombre', () => {
    const result = findOrBuildMigrationSeason([], new Date(2025, 8, 1), new Date(2026, 5, 30))
    expect(result.reuse).toBe(false)
    if (!result.reuse) {
      expect(result.name).toBe(MIGRATION_SEASON_NAME)
      expect(result.startDate).toEqual(new Date(2025, 8, 1))
      expect(result.endDate).toEqual(new Date(2026, 5, 30))
    }
  })

  it('no confunde una temporada con nombre parecido pero distinto', () => {
    const existing: Season = {
      id: 'season-3',
      name: 'Temporada 2026/2027',
      startDate: new Date(2026, 8, 1),
      endDate: new Date(2027, 5, 30),
      createdAt: new Date(2026, 8, 1),
    }
    const result = findOrBuildMigrationSeason([existing], new Date(2025, 8, 1), new Date(2026, 5, 30))
    expect(result.reuse).toBe(false)
  })
})
```

- [ ] **Step 2: Ejecutar el test y comprobar que falla**

Run: `npm test -- season-utils`
Expected: FAIL — no existe el módulo `@/lib/season-utils`.

- [ ] **Step 3: Crear `src/lib/season-utils.ts` con la implementación**

```ts
import type { Season } from '@/types'

export const MIGRATION_SEASON_NAME = 'Temporada 2025/2026'

export type MigrationSeasonResult =
  | { reuse: true; season: Season }
  | { reuse: false; name: string; startDate: Date; endDate: Date }

/**
 * Decide si hay que reutilizar una temporada existente llamada
 * "Temporada 2025/2026" (comparación case-insensitive, sin espacios) o crear
 * una nueva con ese nombre y el rango de fechas dado.
 */
export function findOrBuildMigrationSeason(
  seasons: Season[],
  fallbackStartDate: Date,
  fallbackEndDate: Date,
): MigrationSeasonResult {
  const normalizedTarget = MIGRATION_SEASON_NAME.trim().toLowerCase()
  const existing = seasons.find((s) => s.name.trim().toLowerCase() === normalizedTarget)
  if (existing) {
    return { reuse: true, season: existing }
  }
  return {
    reuse: false,
    name: MIGRATION_SEASON_NAME,
    startDate: fallbackStartDate,
    endDate: fallbackEndDate,
  }
}
```

- [ ] **Step 4: Ejecutar el test y comprobar que pasa**

Run: `npm test -- season-utils`
Expected: PASS — los 4 tests en verde.

- [ ] **Step 5: Añadir `activeSeasonId` a `Club`**

En `src/types/index.ts`, dentro de `interface Club` (línea 9-42), añadir tras `seasonEnd: Date` (línea 19):

```ts
  seasonStart: Date
  seasonEnd: Date
  activeSeasonId?: string  // temporada en la que el club está trabajando ahora mismo
```

- [ ] **Step 6: Añadir la firma de `ensureActiveSeason` a la interfaz del store**

En `src/stores/dataStore.ts`, junto a `addSeason` (línea 162):

```ts
  // --- Seasons CRUD ---
  addSeason: (season: Omit<Season, 'id' | 'createdAt'>) => Season
  ensureActiveSeason: () => Promise<void>
```

- [ ] **Step 7: Implementar `ensureActiveSeason` en el store**

Añadir el import de `findOrBuildMigrationSeason` junto a los demás imports locales de `src/stores/dataStore.ts` (cerca de `import { generateId } from '@/lib/utils'`, línea 62):

```ts
import { generateId } from '@/lib/utils'
import { findOrBuildMigrationSeason } from '@/lib/season-utils'
```

Añadir la acción justo después de `addSeason` (tras la línea 905, `},`):

```ts
      ensureActiveSeason: async () => {
        const club = get().club
        if (!club || club.activeSeasonId) return

        const clubId = getClubId()
        if (!clubId) return

        const result = findOrBuildMigrationSeason(get().seasons, club.seasonStart, club.seasonEnd)

        let seasonId: string
        if (result.reuse) {
          seasonId = result.season.id
        } else {
          const newSeason: Season = {
            id: generateId(),
            name: result.name,
            startDate: result.startDate,
            endDate: result.endDate,
            createdAt: new Date(),
          }
          set((state) => ({ seasons: [...state.seasons, newSeason] }))
          syncDoc('seasons', newSeason.id, newSeason as any, clubId)
          seasonId = newSeason.id
        }

        const groupsToMigrate = get().groups.filter((g) => g.isActive && !g.seasonId)

        if (groupsToMigrate.length > 0) {
          const batch = writeBatch(db)
          for (const g of groupsToMigrate) {
            batch.update(doc(db, 'groups', g.id), { seasonId })
          }
          await batch.commit()
          set((state) => ({
            groups: state.groups.map((g) =>
              groupsToMigrate.some((m) => m.id === g.id) ? { ...g, seasonId } : g
            ),
          }))
        }

        set((state) => ({
          club: state.club ? { ...state.club, activeSeasonId: seasonId } : null,
        }))
        syncDoc('clubs', clubId, { activeSeasonId: seasonId }, clubId)
      },
```

- [ ] **Step 8: Verificar que compila**

Run: `npm run build`
Expected: sin errores de TypeScript.

- [ ] **Step 9: Ejecutar el conjunto de tests**

Run: `npm test`
Expected: todos los tests pasan (incluidos los 4 nuevos de `season-utils`).

- [ ] **Step 10: Commit**

```bash
git add src/types/index.ts src/stores/dataStore.ts src/lib/season-utils.ts src/lib/season-utils.test.ts
git commit -m "feat: añadir Club.activeSeasonId y migración automática ensureActiveSeason"
```

---

## Task 2: Disparar `ensureActiveSeason` tras el primer login (solo director/coordinador)

**Files:**
- Modify: `src/stores/authStore.ts`

- [ ] **Step 1: Añadir la llamada en el callback `onFirstLoad`**

En `src/stores/authStore.ts`, dentro del bloque que llama a `subscribeToAllData` (líneas 163-169):

```ts
        // Iniciar listeners en tiempo real.
        // Se pasa `role` (el de BD), NO `activeRole`: es el rol que aplican las
        // security rules, y al no cambiar en toda la sesión, el RoleSwitcher no
        // deja suscripciones con un alcance obsoleto.
        _dataUnsubscribe = subscribeToAllData(appUser.clubId, appUser.role, () => {
          setDataLoading(false)
          if (appUser.role === 'director' || appUser.role === 'coordinador') {
            useDataStore.getState().ensureActiveSeason()
          }
        })
```

`useDataStore` ya está importado en este archivo (línea 23, `import { useDataStore } from '@/stores/dataStore'`) — no hace falta añadir ningún import nuevo.

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: sin errores de TypeScript.

- [ ] **Step 3: Verificación manual en local**

Run: `npm run dev` (si no hay ya un servidor corriendo; si lo hay, déjalo como está)

1. Iniciar sesión como `director` en un club con grupos activos sin `seasonId` (el estado actual de producción/desarrollo, ya que este campo no existía hasta ahora).
2. Confirmar en las DevTools (pestaña Firestore o consola) que se crea/reutiliza la temporada "Temporada 2025/2026", que `club.activeSeasonId` queda establecido, y que los grupos activos quedan con ese `seasonId`.
3. Recargar la página — confirmar que `ensureActiveSeason` no hace nada la segunda vez (no se duplica la temporada, no hay escrituras extra) porque `club.activeSeasonId` ya está definido.

- [ ] **Step 4: Commit**

```bash
git add src/stores/authStore.ts
git commit -m "feat: ejecutar ensureActiveSeason tras el primer login de director/coordinador"
```

---

## Task 3: Componente `SeasonSwitcher` en la cabecera

**Files:**
- Create: `src/components/layout/SeasonSwitcher.tsx`
- Modify: `src/components/layout/Header.tsx`

- [ ] **Step 1: Crear `SeasonSwitcher.tsx`, mismo patrón que `ChildSwitcher.tsx`**

```tsx
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'

/**
 * Selector de temporada activa del club, visible solo para director/coordinador.
 * Cambiarla actualiza club.activeSeasonId para todo el club (no es por sesión).
 */
export function SeasonSwitcher() {
  const { user } = useAuthStore()
  const { club, seasons, updateClub } = useDataStore()

  const activeRole = user?.activeRole ?? user?.role
  if (activeRole !== 'director' && activeRole !== 'coordinador') return null
  if (seasons.length === 0) return null

  const activeSeason = seasons.find((s) => s.id === club?.activeSeasonId)
  const activeName = activeSeason?.name ?? 'Sin temporada'

  const pill = (
    <div className="flex items-center gap-2 rounded-full border border-border/60 bg-white px-3 py-1.5 shadow-sm">
      <span className="text-sm font-semibold text-foreground truncate max-w-[10rem]">
        {activeName}
      </span>
      {seasons.length > 1 && <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
    </div>
  )

  if (seasons.length <= 1) return pill

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full transition-transform active:scale-95" title="Cambiar de temporada">
        {pill}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[14rem]">
        <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
          Temporada activa
        </DropdownMenuLabel>
        {seasons.map((season) => {
          const isActive = season.id === club?.activeSeasonId
          return (
            <DropdownMenuItem
              key={season.id}
              onClick={() => updateClub({ activeSeasonId: season.id })}
              className={cn('gap-2', isActive && 'bg-accent/60')}
            >
              <span className="flex-1 truncate">{season.name}</span>
              {isActive && <Check className="h-4 w-4 text-primary shrink-0" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 2: Añadirlo a `Header.tsx`**

En `src/components/layout/Header.tsx`, importar y renderizar junto a `ChildSwitcher`:

```tsx
import { NotificationBell } from '@/components/shared/NotificationBell'
import { ChildSwitcher } from '@/components/layout/ChildSwitcher'
import { SeasonSwitcher } from '@/components/layout/SeasonSwitcher'

interface HeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/40"
      style={{ boxShadow: 'var(--shadow-header)' }}
    >
      <div className="flex min-h-[4.5rem] items-center justify-between gap-3 pl-14 pr-4 lg:pl-8 lg:pr-8 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl lg:text-2xl font-bold text-foreground truncate leading-tight tracking-tight font-jakarta">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs lg:text-[13px] text-muted-foreground hidden sm:block mt-0.5 font-medium opacity-80">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <ChildSwitcher />
          <SeasonSwitcher />
          {actions}
          <div className="h-6 w-px bg-border/60 mx-1 hidden sm:block" />
          <NotificationBell />
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 3: Verificar que compila**

Run: `npm run build`
Expected: sin errores de TypeScript.

- [ ] **Step 4: Verificación manual en local**

Con el dev server corriendo:
1. Iniciar sesión como `director` (o `coordinador`) — confirmar que aparece la píldora con el nombre de la temporada activa en la cabecera.
2. Crear una segunda temporada desde `SeasonsPage.tsx` (botón "+ Nueva temporada") y confirmar que ahora el `SeasonSwitcher` muestra un desplegable con ambas temporadas.
3. Cambiar la temporada activa desde el desplegable — confirmar que la píldora actualiza el nombre mostrado.
4. Iniciar sesión como `entrenador` o como jugador/tutor — confirmar que el `SeasonSwitcher` NO aparece.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/SeasonSwitcher.tsx src/components/layout/Header.tsx
git commit -m "feat: añadir selector de temporada activa en la cabecera"
```

---

## Task 4: `GroupsPage.tsx` — filtro por temporada activa

**Files:**
- Modify: `src/pages/GroupsPage.tsx`

- [ ] **Step 1: Añadir `club` y `seasons` al destructuring del store**

Cambiar (línea 72):
```ts
  const { groups, coaches, courts, tariffs, addGroup, updateGroup, deleteGroup, players, enrollments } = useDataStore()
```
por:
```ts
  const { groups, coaches, courts, tariffs, addGroup, updateGroup, deleteGroup, players, enrollments, club, seasons } = useDataStore()
```

- [ ] **Step 2: Añadir el estado del filtro de temporada**

Junto a los demás estados de filtro (tras la línea 77, `const [coachFilter, setCoachFilter] = useState<string>('')`), añadir:

```ts
  const ALL_SEASONS = '__all__'
  const [seasonFilter, setSeasonFilter] = useState<string>('')
```

`seasonFilter === ''` significa "usar la temporada activa del club" (el valor por defecto real se resuelve más abajo, porque `club.activeSeasonId` puede tardar un instante en cargar). `seasonFilter === ALL_SEASONS` significa "ver todas las temporadas".

- [ ] **Step 3: Incorporar el filtro a `filteredGroups`**

Reemplazar el cuerpo de `filteredGroups` (líneas 109-136):

```ts
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
```

(Nota: cuando `club?.activeSeasonId` es `undefined` — p. ej. si `ensureActiveSeason` de la Tarea 1/2 todavía no ha corrido — `effectiveSeasonFilter` queda `''`, que la condición `matchesSeason` trata como "no filtrar", así que no se oculta nada por error mientras la migración no ha corrido todavía.)

- [ ] **Step 4: Añadir el `Select` de temporada a la barra de filtros**

En la barra de filtros (tras el `Select` de nivel, líneas 371-379), añadir:

```tsx
          <Select
            options={[
              { value: '', label: club && seasons.find(s => s.id === club.activeSeasonId) ? `Temporada actual: ${seasons.find(s => s.id === club.activeSeasonId)!.name}` : 'Temporada actual' },
              { value: ALL_SEASONS, label: 'Todas las temporadas' },
              ...seasons.map((s) => ({ value: s.id, label: s.name })),
            ]}
            value={seasonFilter}
            onChange={(e) => setSeasonFilter(e.target.value)}
            className="w-full sm:w-56"
          />
```

- [ ] **Step 5: Verificar que compila**

Run: `npm run build`
Expected: sin errores de TypeScript.

- [ ] **Step 6: Verificación manual en local**

1. Con la migración de la Tarea 1/2 ya ejecutada (temporada activa = "Temporada 2025/2026"), abrir Grupos — confirmar que se ven los grupos de siempre (todos deberían tener esa `seasonId` tras la migración).
2. Crear una temporada nueva y cambiarla a activa desde `SeasonSwitcher` — confirmar que Grupos ahora muestra la lista vacía (ningún grupo pertenece todavía a la temporada nueva).
3. Usar el `Select` de temporada de esta página para volver a ver "Temporada 2025/2026" o "Todas las temporadas", sin tocar el `SeasonSwitcher` — confirmar que los grupos antiguos reaparecen y que la temporada activa del club no ha cambiado.
4. Crear un grupo nuevo estando la temporada nueva activa (ver Tarea 5) y confirmar que aparece en la vista filtrada por defecto.

- [ ] **Step 7: Commit**

```bash
git add src/pages/GroupsPage.tsx
git commit -m "feat: filtrar Grupos por temporada activa por defecto"
```

---

## Task 5: Grupos nuevos se etiquetan con la temporada activa

**Files:**
- Modify: `src/pages/GroupsPage.tsx`

- [ ] **Step 1: Pasar `seasonId` en la llamada a `addGroup`**

En el bloque `else` que crea un grupo nuevo (líneas 284-301), añadir `seasonId: club?.activeSeasonId` al objeto:

```ts
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
```

No se toca la rama `if (editingGroup)` — editar un grupo no cambia su temporada (según el spec).

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: sin errores de TypeScript (el tipo `Omit<Group, 'id' | 'createdAt' | 'currentEnrollment'>` que espera `addGroup` ya incluye `seasonId?: string` como campo opcional del tipo `Group`, así que no hace falta ningún cambio de tipos).

- [ ] **Step 3: Verificación manual en local**

1. Con una temporada activa concreta seleccionada, crear un grupo nuevo desde "Nuevo grupo".
2. Confirmar en Firestore (o revisando que aparece en la vista filtrada de Grupos de la Tarea 4) que el grupo nuevo tiene el `seasonId` de la temporada activa en el momento de crearlo.

- [ ] **Step 4: Commit**

```bash
git add src/pages/GroupsPage.tsx
git commit -m "feat: los grupos nuevos se etiquetan con la temporada activa al crearse"
```

---

## Task 6: `PaymentsPage.tsx` — filtro opcional por temporada

**Files:**
- Modify: `src/pages/PaymentsPage.tsx`

- [ ] **Step 1: Añadir `seasons` al destructuring del store**

Cambiar (línea 104-124, el bloque de `useDataStore()`) para incluir `seasons` — por ejemplo, añadir `seasons,` tras `groups,` (línea 105):

```ts
  const { 
    groups, 
    seasons,
    players, 
    club, 
    markPaymentPaid, 
    markEventPaymentPaid, 
    markPrivateLessonPaymentPaid, 
    revertPaymentPaidStatus,
    updatePayment,
    deletePayment,
    deleteEventPayment, 
    deletePrivateLessonPayment, 
    generateMonthlyReceipts, 
    addManualPayment, 
    bulkGenerateInvoices,
    payments: allBasePayments,
    eventPayments,
    privateLessonPayments,
    invoices,
    events
  } = useDataStore()
```

- [ ] **Step 2: Añadir el estado del filtro**

Junto a `groupFilter` (línea 145, `const [groupFilter, setGroupFilter] = useState<string>('')`), añadir:

```ts
  const [seasonFilter, setSeasonFilter] = useState<string>('')
```

(Vacío = "todas las temporadas", a diferencia de Grupos — aquí no hay temporada por defecto, es una herramienta de consulta.)

- [ ] **Step 3: Incorporar el filtro a `filteredPayments`**

Reemplazar el cuerpo de `filteredPayments` (líneas 209-223):

```ts
  const filteredPayments = useMemo(() => {
    return allPayments.filter((p) => {
      const q = normalizeText(search)
      const matchesSearch =
        search === '' ||
        normalizeText(p.playerName).includes(q) ||
        normalizeText(p.concept).includes(q)
      const matchesStatus = statusFilter === '' || p.status === statusFilter
      const matchesGroup = groupFilter === '' || p.groupId === groupFilter
      const matchesCategory = categoryFilter === '' || p.source === categoryFilter
      const matchesMonth = p.billingMonth === selectedMonth
      const matchesYear = p.billingYear === selectedYear
      const matchesSeason =
        seasonFilter === '' ||
        groups.find((g) => g.id === p.groupId)?.seasonId === seasonFilter
      return matchesSearch && matchesStatus && matchesGroup && matchesCategory && matchesMonth && matchesYear && matchesSeason
    })
  }, [allPayments, search, statusFilter, groupFilter, categoryFilter, selectedMonth, selectedYear, seasonFilter, groups])
```

- [ ] **Step 4: Añadir el `Select` de temporada a la barra de filtros**

Buscar en el archivo dónde se renderiza el `Select` de `groupFilter` (el filtro de grupo ya existente, usa `groupOptions`) y añadir, justo después, un `Select` análogo:

```tsx
          <Select
            options={[
              { value: '', label: 'Todas las temporadas' },
              ...seasons.map((s) => ({ value: s.id, label: s.name })),
            ]}
            value={seasonFilter}
            onChange={(e) => setSeasonFilter(e.target.value)}
            className="w-full sm:w-48"
          />
```

(Ajustar `className`/estructura envolvente exactamente a como esté el `Select` de `groupFilter` vecino, para que quede visualmente consistente — leer el archivo antes de insertar.)

- [ ] **Step 5: Verificar que compila**

Run: `npm run build`
Expected: sin errores de TypeScript.

- [ ] **Step 6: Ejecutar el conjunto de tests**

Run: `npm test`
Expected: todos los tests pasan.

- [ ] **Step 7: Verificación manual en local**

1. En Pagos, confirmar que por defecto ("Todas las temporadas") se ve exactamente lo mismo que antes de este cambio.
2. Seleccionar una temporada concreta — confirmar que la lista se reduce a los pagos de grupos de esa temporada.
3. Confirmar que la generación de recibos (botón "Generar recibos") sigue funcionando exactamente igual que antes — este cambio no debe alterar ese flujo.

- [ ] **Step 8: Commit**

```bash
git add src/pages/PaymentsPage.tsx
git commit -m "feat: añadir filtro opcional por temporada en Pagos"
```

---

## Self-Review Notes

- **Cobertura del spec:** Punto 1 (modelo de datos) → Tarea 1. Punto 2 (migración automática) → Tareas 1-2. Punto 3 (grupos nuevos se etiquetan) → Tarea 5. Punto 4 (selector + filtro en Grupos) → Tareas 3-4. Punto 5 (generación de recibos sin cambios + filtro en Pagos) → Tarea 6 (recibos explícitamente no tocados). Punto 6 (fuera de alcance: Jugadores/Agenda/Dashboard/RenewGroupsDialog/Enrollment.seasonId) → ninguna tarea los toca, correcto.
- **Consistencia de tipos:** `ensureActiveSeason(): Promise<void>` se declara en la interfaz del store (Tarea 1, Step 6) y se implementa con esa misma firma (Step 7). `findOrBuildMigrationSeason` se usa con la misma firma en su definición (Task 1 Step 3) y en su único call site (`ensureActiveSeason`, Task 1 Step 7). `SeasonSwitcher` usa `updateClub` (ya existente en el store, `dataStore.ts:549`) sin cambiar su firma.
- **Nada de placeholders** — cada paso de código tiene el bloque completo a escribir, incluidos los tests.
- **Orden de tareas**: Tarea 1 y 2 deben ir antes que 3-6 (dependen de que `activeSeasonId` exista en el tipo y en el store). Tarea 3 (selector) es independiente de 4/5/6 salvo por compartir el mismo `club.activeSeasonId`. Tareas 4, 5 y 6 son independientes entre sí una vez completadas 1-3.
