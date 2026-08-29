# Rediseño UI Fase 2 — Personas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate `PlayersPage`, `CoachesPage`, and `UsersPage` under a single "Personas" section reachable via nested routes (`/personas/jugadores`, `/personas/lista-espera`, `/personas/entrenadores`, `/personas/usuarios`) with a shared tab strip, and redesign `PlayersPage` to match the `san javier.pen` mockup (new topbar, Grupo/Pago filters, new table columns, pagination).

**Architecture:** A new small `PersonasLayout` component renders only a tab strip + `<Outlet/>`; `AuthenticatedApp.tsx` gains nested routes under `/personas` plus backward-compatible redirects from the old flat routes; `PlayersPage.tsx` is rewritten (topbar, filters, columns, pagination) while `CoachesPage`/`UsersPage` are reused completely unchanged; `StatusBadge` gets one small additive change (an optional label override + two new status colors) to render the new "Estado de pago" chips.

**Tech Stack:** React 19 + TypeScript, react-router-dom v7 (nested routes), Tailwind CSS v4 (design tokens already in place from Fase 1), @tanstack/react-table (adds `getPaginationRowModel`, already a project dependency), Zustand (`useDataStore`).

Reference spec: `docs/superpowers/specs/2026-08-29-rediseno-ui-fase2-personas-design.md`

---

## Task 1: `StatusBadge` — label override + two new statuses

**Files:**
- Modify: `src/components/shared/StatusBadge.tsx`

- [ ] **Step 1: Add `al_dia` and `vencido` to the color/label maps, and an optional `label` override prop**

Find:

```tsx
interface StatusBadgeProps {
  status: string
  colorMap?: Record<string, string>
  className?: string
}
```

Replace with:

```tsx
interface StatusBadgeProps {
  status: string
  colorMap?: Record<string, string>
  className?: string
  label?: string
}
```

Find:

```tsx
  competicion: { dot: 'bg-red-500', badge: 'bg-red-100 text-red-800 ring-red-600/10' },
  menores: { dot: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-800 ring-yellow-600/10' },
}
```

Replace with:

```tsx
  competicion: { dot: 'bg-red-500', badge: 'bg-red-100 text-red-800 ring-red-600/10' },
  menores: { dot: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-800 ring-yellow-600/10' },
  al_dia: { dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-800 ring-emerald-600/10' },
  vencido: { dot: 'bg-red-500', badge: 'bg-red-100 text-red-800 ring-red-600/10' },
}
```

Find:

```tsx
  competicion: 'Competición',
  menores: 'Menores',
}
```

Replace with:

```tsx
  competicion: 'Competición',
  menores: 'Menores',
  al_dia: 'Al día',
  vencido: 'Vencido',
}
```

Find:

```tsx
  const styles = defaultColorMap[status] || fallback
  const label = labelMap[status] || status

  return (
```

Replace with:

```tsx
  const styles = defaultColorMap[status] || fallback
  const resolvedLabel = label ?? labelMap[status] ?? status

  return (
```

Find the last remaining use of the old `label` variable (in the JSX body of the same `return`):

```tsx
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', styles.dot)} />
      {label}
    </span>
  )
}
```

Replace with:

```tsx
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', styles.dot)} />
      {resolvedLabel}
    </span>
  )
}
```

Note: the EARLIER `colorMap`-branch of this same function (the `if (colorMap) { ... }` block near the top) also declares a local `const label = labelMap[status] || status` — that one is unrelated to this change (different branch, different variable, used only within that early-return block) and must NOT be renamed; leave it exactly as-is. Only the second declaration (in the default/non-`colorMap` branch, the one you just edited above) is renamed to `resolvedLabel`.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: succeeds. `StatusBadge` is used in several other pages (e.g. `PlayersPage.tsx`, `GroupsPage.tsx`) with just a `status` prop and no `label` — since `label` is optional and defaults to the old lookup behavior, none of those call sites need to change and none should break.

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/StatusBadge.tsx
git commit -m "feat: permitir override de label en StatusBadge y anadir estados al_dia/vencido"
```

---

## Task 2: Routing — `PersonasLayout` + nested routes + Sidebar update

**Files:**
- Create: `src/components/layout/PersonasLayout.tsx`
- Modify: `src/AuthenticatedApp.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Create `PersonasLayout`**

Create `src/components/layout/PersonasLayout.tsx` with:

```tsx
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useDataStore } from '@/stores/dataStore'
import { useAuthStore, hasPermission } from '@/stores/authStore'
import type { UserRole } from '@/types'

interface PersonasTab {
  name: string
  href: string
  count: number
  requiredModule?: string
}

export function PersonasLayout() {
  const location = useLocation()
  const { players, coaches, users } = useDataStore()
  const { user } = useAuthStore()
  const activeRole = user?.activeRole ?? user?.role

  const tabs: PersonasTab[] = [
    { name: 'Jugadores', href: '/personas/jugadores', count: players.length },
    { name: 'Lista de espera', href: '/personas/lista-espera', count: players.filter((p) => p.status === 'lista_espera').length },
    { name: 'Entrenadores', href: '/personas/entrenadores', count: coaches.length, requiredModule: 'coaches' },
    { name: 'Usuarios', href: '/personas/usuarios', count: users.length, requiredModule: 'users' },
  ]

  const visibleTabs = tabs.filter((tab) => {
    if (!tab.requiredModule) return true
    if (!activeRole) return false
    return hasPermission(activeRole as UserRole, tab.requiredModule, 'read')
  })

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto border-b border-border bg-card px-5 lg:px-8">
        {visibleTabs.map((tab) => {
          const isActive = location.pathname === tab.href
          return (
            <NavLink
              key={tab.href}
              to={tab.href}
              className={cn(
                'flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.name}
              <span className={cn(
                'rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
                isActive ? 'bg-accent text-primary' : 'bg-secondary text-muted-foreground'
              )}>
                {tab.count}
              </span>
            </NavLink>
          )
        })}
      </div>
      <Outlet />
    </div>
  )
}
```

- [ ] **Step 2: Update `AuthenticatedApp.tsx` routes**

First, find the type import line near the top:

```tsx
import type { UserRole } from '@/types'
```

Replace with:

```tsx
import type { UserRole, PlayerStatus } from '@/types'
```

Find the `MainLayout` import:

```tsx
import { MainLayout } from '@/components/layout/MainLayout'
```

Replace with:

```tsx
import { MainLayout } from '@/components/layout/MainLayout'
import { PersonasLayout } from '@/components/layout/PersonasLayout'
```

Find the `PlayersRouter` function:

```tsx
function PlayersRouter() {
  const { user } = useAuthStore()
  const { studentId } = useEffectiveStudent()
  const activeRole = user?.activeRole ?? user?.role
  if (activeRole === 'jugador' || activeRole === 'tutor') {
    if (studentId) {
      return <Navigate to={`/jugadores/${studentId}`} replace />
    }
    return <Navigate to="/" replace />
  }
  return <PlayersPage />
}
```

Replace with:

```tsx
function PlayersRouter({ initialStatusFilter }: { initialStatusFilter?: PlayerStatus }) {
  const { user } = useAuthStore()
  const { studentId } = useEffectiveStudent()
  const activeRole = user?.activeRole ?? user?.role
  if (activeRole === 'jugador' || activeRole === 'tutor') {
    if (studentId) {
      return <Navigate to={`/jugadores/${studentId}`} replace />
    }
    return <Navigate to="/" replace />
  }
  return <PlayersPage initialStatusFilter={initialStatusFilter} />
}
```

Find these four route lines:

```tsx
        <Route path="/jugadores" element={<PlayersRouter />} />
        <Route path="/jugadores/:id" element={<PlayerProfilePage />} />
        <Route path="/grupos" element={<GroupsRouter />} />
```

Replace with (adds the `/personas/*` nested block right after, keeps `/jugadores/:id` exactly where it was, turns `/jugadores` itself into a redirect):

```tsx
        <Route path="/jugadores" element={<Navigate to="/personas/jugadores" replace />} />
        <Route path="/jugadores/:id" element={<PlayerProfilePage />} />
        <Route path="/personas" element={<PersonasLayout />}>
          <Route index element={<Navigate to="/personas/jugadores" replace />} />
          <Route path="jugadores" element={<PlayersRouter />} />
          <Route path="lista-espera" element={<PlayersRouter initialStatusFilter="lista_espera" />} />
          <Route path="entrenadores" element={<RoleRoute module="coaches"><CoachesPage /></RoleRoute>} />
          <Route path="usuarios" element={<RoleRoute module="users"><UsersPage /></RoleRoute>} />
        </Route>
        <Route path="/grupos" element={<GroupsRouter />} />
```

Now find the existing standalone `/entrenadores`, `/entrenadores/:id`, and `/usuarios` route lines:

```tsx
        <Route path="/entrenadores" element={<RoleRoute module="coaches"><CoachesPage /></RoleRoute>} />
```

Replace with:

```tsx
        <Route path="/entrenadores" element={<Navigate to="/personas/entrenadores" replace />} />
```

Find:

```tsx
        <Route path="/usuarios" element={<RoleRoute module="users"><UsersPage /></RoleRoute>} />
```

Replace with:

```tsx
        <Route path="/usuarios" element={<Navigate to="/personas/usuarios" replace />} />
```

Leave `<Route path="/entrenadores/:id" element={<CoachProfilePage />} />` exactly where it is, untouched — only the list routes (`/entrenadores`, `/usuarios`) become redirects, not the detail routes.

- [ ] **Step 3: Verify the route table has no duplicate/orphaned routes**

Run:

```bash
grep -n "personas\|entrenadores\|usuarios\|jugadores" src/AuthenticatedApp.tsx
```

Expected output (order may vary slightly, but every one of these must appear exactly once):
- `/jugadores` → `Navigate` to `/personas/jugadores`
- `/jugadores/:id` → `PlayerProfilePage`
- `/personas` → `PersonasLayout` (parent, with 4 nested children: index redirect, `jugadores`, `lista-espera`, `entrenadores`, `usuarios`)
- `/entrenadores` → `Navigate` to `/personas/entrenadores`
- `/entrenadores/:id` → `CoachProfilePage`
- `/usuarios` → `Navigate` to `/personas/usuarios`

- [ ] **Step 4: Update `Sidebar.tsx` — nav href AND coach allow-list**

Find:

```tsx
  { name: 'Personas', href: '/jugadores', icon: Users },
```

Replace with:

```tsx
  { name: 'Personas', href: '/personas/jugadores', icon: Users },
```

Find (inside `filterItem`):

```tsx
      const coachAllowedPaths = ['/', '/jugadores', '/agenda', '/grupos', '/asistencia']
```

Replace with:

```tsx
      const coachAllowedPaths = ['/', '/personas/jugadores', '/agenda', '/grupos', '/asistencia']
```

**Why this second change matters:** `filterItem` for the `entrenador` role hides any nav item whose `href` isn't in `coachAllowedPaths`. The "Personas" nav item's `href` is changing from `/jugadores` to `/personas/jugadores` — if `coachAllowedPaths` isn't updated to match, the "Personas" item silently disappears from the entrenador's sidebar entirely (the exact same class of regression caught and fixed in Fase 1's Sidebar review). Do not skip this.

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: succeeds. `PlayersPage` doesn't yet accept an `initialStatusFilter` prop (that's Task 3) — TypeScript WILL complain about this at this point (`Property 'initialStatusFilter' does not exist on type...`). That is expected and correct: do not work around it by changing `PlayersRouter` or the route — just note it in your report as an expected, temporary type error that Task 3 resolves. If any OTHER error appears, stop and investigate before continuing.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/PersonasLayout.tsx src/AuthenticatedApp.tsx src/components/layout/Sidebar.tsx
git commit -m "feat: rutas anidadas /personas con PersonasLayout y redirects de compatibilidad"
```

Note in your commit report that `npm run build` has one expected, pre-known TypeScript error at this point (`initialStatusFilter` prop not yet defined on `PlayersPage`) — this is resolved by Task 3, not a defect in this task.

---

## Task 3: `PlayersPage` — topbar, new filters, new columns, pagination

**Files:**
- Modify: `src/pages/PlayersPage.tsx` (full replacement)

This is the largest task. It replaces the ENTIRE content of `src/pages/PlayersPage.tsx`. Every mutation handler (`handleFormSubmit`, `handleImport`, `handleExport`), every dialog (`PlayerFormDialog`, `ImportPlayersDialog`, `ConfirmDialog`, `CancelPlayerDialog`), and every bit of selection/bulk-action logic is preserved **verbatim** from the current file — only the header, filter bar, table columns, and pagination change.

- [ ] **Step 1: Replace the entire file content**

Replace the full contents of `src/pages/PlayersPage.tsx` with:

```tsx
import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { CancelPlayerDialog } from '@/components/shared/CancelPlayerDialog'
import { PlayerFormDialog, type PlayerFormData } from '@/components/shared/PlayerFormDialog'
import { ImportPlayersDialog, type ImportedPlayer } from '@/components/shared/ImportPlayersDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Select } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { useDataStore } from '@/stores/dataStore'
import { useAuthStore } from '@/stores/authStore'
import { getPlayerPortalStatus } from '@/lib/player-portal-status'
import { isGroupCurrentlyActive } from '@/lib/group-utils'
import { cn, isMinor as checkIsMinor, formatDate, normalizeText, formatCurrency } from '@/lib/utils'
import { PLAYER_LEVELS, PLAYER_STATUSES } from '@/constants'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type PaginationState,
} from '@tanstack/react-table'
import { downloadXlsx } from '@/lib/excel'
import { useAllPendingNormalizedPaymentsQuery } from '@/hooks/useQueries'
import type { Player, PlayerLevel, PlayerStatus } from '@/types'
import {
  Plus, Search, Upload, Download, Users, Mail,
  MoreHorizontal, Eye, Edit, Trash2, UserX, CheckCircle2,
  Clock, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, Gamepad2,
} from 'lucide-react'

function calculateAge(birthDate: Date): number {
  const bd = birthDate instanceof Date ? birthDate : new Date(birthDate)
  const diffMs = Date.now() - bd.getTime()
  return Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000))
}

interface PlayersPageProps {
  initialStatusFilter?: PlayerStatus | ''
}

export default function PlayersPage({ initialStatusFilter = '' }: PlayersPageProps) {
  const navigate = useNavigate()
  const { players, users, invitations, groups, enrollments, attendance, seasons, club, addPlayer, updatePlayer, cancelPlayer, deletePlayer, invitePlayer } = useDataStore()
  const { user } = useAuthStore()
  const activeRole = user?.activeRole ?? user?.role
  // Invitar al portal es cosa de admin (mismo criterio que isAdmin() en las rules).
  // Además, con rol de BD entrenador no se sincronizan `invitations` ni `users`,
  // así que el estado derivado no sería fiable para ellos.
  const isAdmin = activeRole === 'director' || activeRole === 'coordinador'
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter)
  const [groupFilter, setGroupFilter] = useState<string>('')
  const [paymentFilter, setPaymentFilter] = useState<string>('')
  const [portalFilter, setPortalFilter] = useState<string>('')
  // El filtro de portal se oculta para no-admins. Cambiar de rol activo no
  // remonta esta página, así que un filtro puesto sobreviviría al cambio y
  // dejaría la lista filtrada sin ningún control visible para limpiarla.
  useEffect(() => {
    if (!isAdmin) setPortalFilter('')
  }, [isAdmin])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState<string | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 12 })

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }, [search, levelFilter, statusFilter, groupFilter, paymentFilter, portalFilter])

  const { data: allPendingPayments = [] } = useAllPendingNormalizedPaymentsQuery()

  const pendingByPlayer = useMemo(() => {
    const map: Record<string, number> = {}
    allPendingPayments.forEach(p => {
      map[p.playerId] = (map[p.playerId] || 0) + p.amount
    })
    return map
  }, [allPendingPayments])

  const paymentStatusByPlayer = useMemo(() => {
    const now = new Date()
    const map: Record<string, { status: 'pendiente' | 'vencido'; amount: number }> = {}
    for (const p of allPendingPayments) {
      const isOverdue = p.dueDate != null && new Date(p.dueDate) < now
      const prev = map[p.playerId]
      const amount = (prev?.amount || 0) + p.amount
      const status: 'pendiente' | 'vencido' = isOverdue || prev?.status === 'vencido' ? 'vencido' : 'pendiente'
      map[p.playerId] = { status, amount }
    }
    return map
  }, [allPendingPayments])

  const activeGroups = useMemo(
    () => groups.filter((g) => isGroupCurrentlyActive(g, new Date())),
    [groups]
  )

  const activeEnrollmentByPlayer = useMemo(() => {
    const map: Record<string, { groupId: string; groupName: string }> = {}
    for (const e of enrollments) {
      if (e.isActive && !map[e.playerId]) {
        map[e.playerId] = { groupId: e.groupId, groupName: e.groupName }
      }
    }
    return map
  }, [enrollments])

  const activeSeason = useMemo(
    () => seasons.find((s) => s.id === club?.activeSeasonId),
    [seasons, club]
  )

  const attendanceRateByPlayer = useMemo(() => {
    const counts: Record<string, { present: number; total: number }> = {}
    for (const record of attendance) {
      const recordDate = record.date instanceof Date ? record.date : new Date(record.date)
      if (activeSeason && (recordDate < activeSeason.startDate || recordDate > activeSeason.endDate)) continue
      for (const entry of record.records) {
        const c = counts[entry.playerId] ?? { present: 0, total: 0 }
        c.total++
        if (entry.status === 'presente') c.present++
        counts[entry.playerId] = c
      }
    }
    const rates: Record<string, number | null> = {}
    for (const p of players) {
      const c = counts[p.id]
      rates[p.id] = c && c.total > 0 ? Math.round((c.present / c.total) * 100) : null
    }
    return rates
  }, [attendance, activeSeason, players])

  const portalStatusById = useMemo(() => {
    // `now` se congela hasta que cambie alguno de los tres arrays. Con caducidad
    // de 7 días no merece un timer: como mucho el menú ofrece "Reenviar" en vez
    // de "Invitar", y ambos hacen lo mismo.
    const now = new Date()
    const map: Record<string, ReturnType<typeof getPlayerPortalStatus>> = {}
    for (const p of players) {
      map[p.id] = getPlayerPortalStatus(p, users, invitations, now)
    }
    return map
  }, [players, users, invitations])

  const filteredPlayers = useMemo(() => {
    const q = normalizeText(search)
    return players.filter((p) => {
      const matchesSearch = search === '' ||
        normalizeText(`${p.firstName} ${p.lastName}`).includes(q) ||
        normalizeText(p.email).includes(q) ||
        p.phone.includes(search)
      const matchesLevel = levelFilter === '' || p.level === levelFilter
      const matchesStatus = statusFilter === '' || p.status === statusFilter
      const matchesGroup = groupFilter === '' || activeEnrollmentByPlayer[p.id]?.groupId === groupFilter
      const paymentStatus = paymentStatusByPlayer[p.id]?.status ?? 'al_dia'
      const matchesPayment = paymentFilter === '' || paymentStatus === paymentFilter
      const portalStatus = portalStatusById[p.id] ?? 'sin_acceso'
      const matchesPortal =
        portalFilter === '' ? true :
        portalFilter === 'active' ? portalStatus === 'activo' :
        portalFilter === 'sent' ? portalStatus === 'invitado' :
        portalFilter === 'none' ? portalStatus === 'sin_acceso' :
        true
      return matchesSearch && matchesLevel && matchesStatus && matchesGroup && matchesPayment && matchesPortal
    })
  }, [players, search, levelFilter, statusFilter, groupFilter, paymentFilter, portalFilter, portalStatusById, activeEnrollmentByPlayer, paymentStatusByPlayer])

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

  const handleFormSubmit = (formData: PlayerFormData) => {
    const birthDate = new Date(formData.birthDate)
    const playerIsMinor = checkIsMinor(birthDate)

    const playerData = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      dni: formData.dni,
      birthDate,
      email: formData.email,
      phone: formData.phone,
      address: formData.address,
      city: formData.city,
      postalCode: formData.postalCode,
      level: formData.level,
      dominantHand: formData.dominantHand,
      position: formData.position,
      clothingSize: formData.clothingSize || undefined,
      licenseNumber: formData.licenseNumber || undefined,
      previousExperience: formData.previousExperience || undefined,
      medicalNotes: formData.medicalNotes || undefined,
      bankAccountHolder: formData.bankAccountHolder,
      iban: formData.iban,
      status: formData.status,
      registrationDate: editingPlayer?.registrationDate || new Date(),
      isMinor: playerIsMinor,
      guardian: playerIsMinor ? {
        firstName: formData.guardianFirstName,
        lastName: formData.guardianLastName,
        dni: formData.guardianDni,
        phone: formData.guardianPhone,
        email: formData.guardianEmail,
        relationship: formData.guardianRelationship,
      } : undefined,
      notes: formData.notes || undefined,
    }

    if (editingPlayer) {
      updatePlayer(editingPlayer.id, playerData)
    } else {
      addPlayer(playerData)
    }
    setShowCreateDialog(false)
    setEditingPlayer(null)
  }

  const handleImport = async (importedPlayers: ImportedPlayer[]) => {
    for (const p of importedPlayers) {
      await addPlayer({
        firstName: p.firstName,
        lastName: p.lastName,
        dni: p.dni || '',
        birthDate: p.birthDate ? new Date(p.birthDate) : new Date('2000-01-01'),
        email: p.email || '',
        phone: p.phone || '',
        address: p.address || '',
        city: p.city || 'San Javier',
        postalCode: p.postalCode || '30730',
        level: (['iniciacion', 'intermedio', 'avanzado', 'competicion', 'menores'].includes(p.level) ? p.level : 'iniciacion') as PlayerLevel,
        dominantHand: 'derecha',
        position: 'ambos',
        clothingSize: (['4', '6', '8', '10', '12', '14', '16', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'].includes(p.clothingSize || '') ? p.clothingSize : undefined) as any,
        bankAccountHolder: '',
        iban: '',
        status: (['activo', 'lista_espera', 'baja'].includes(p.status) ? p.status : 'activo') as PlayerStatus,
        registrationDate: new Date(),
        isMinor: p.birthDate ? checkIsMinor(new Date(p.birthDate)) : false,
        notes: undefined,
      })
    }
    setShowImportDialog(false)
  }

  const handleExport = () => {
    const data = filteredPlayers.map((p) => ({
      'Nombre': p.firstName,
      'Apellidos': p.lastName,
      'DNI': p.dni,
      'Fecha Nacimiento': p.birthDate ? formatDate(p.birthDate) : '',
      'Email': p.email,
      'Telefono': p.phone,
      'Nivel': p.level,
      'Estado': p.status,
      'Direccion': p.address,
      'Ciudad': p.city,
      'CP': p.postalCode,
      'Mano': p.dominantHand,
      'Posicion': p.position,
      'Talla': p.clothingSize || '',
      'Licencia': p.licenseNumber || '',
      'Titular Cuenta': p.bankAccountHolder || '',
      'IBAN': p.iban || '',
      'Tutor Nombre': p.isMinor ? p.guardian?.firstName || '' : '',
      'Tutor Apellidos': p.isMinor ? p.guardian?.lastName || '' : '',
      'Tutor DNI': p.isMinor ? p.guardian?.dni || '' : '',
      'Tutor Telefono': p.isMinor ? p.guardian?.phone || '' : '',
      'Tutor Email': p.isMinor ? p.guardian?.email || '' : '',
      'Parentesco': p.isMinor ? p.guardian?.relationship || '' : '',
    }))
    const fileName = `jugadores_${new Date().toISOString().split('T')[0]}.xlsx`
    downloadXlsx(data, 'Jugadores', fileName)
  }

  const columns = useMemo<ColumnDef<Player>[]>(() => [
    {
      id: 'select',
      header: () => (
        <Checkbox
          checked={selectedIds.size === filteredPlayers.length && filteredPlayers.length > 0}
          onCheckedChange={toggleSelectAll}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selectedIds.has(row.original.id)}
          onCheckedChange={() => toggleSelect(row.original.id)}
        />
      ),
      enableSorting: false,
      size: 40,
    },
    {
      accessorKey: 'firstName',
      header: 'Jugador',
      cell: ({ row }) => {
        const player = row.original
        const debt = pendingByPlayer[player.id] || 0
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium shrink-0">
              {player.firstName[0]}{player.lastName[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">{player.firstName} {player.lastName}</p>
                {debt > 0 && (
                  <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-destructive text-destructive-foreground">
                    🔴 {formatCurrency(debt)}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {player.isMinor ? 'Menor' : 'Adulto'} · {calculateAge(player.birthDate)} años
              </p>
              {isAdmin && portalStatusById[player.id] === 'invitado' && (
                <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-blue-600 bg-blue-50 w-fit px-1.5 py-0.5 rounded-md">
                  <Mail className="h-3 w-3" /> Invitación enviada
                </div>
              )}
              {isAdmin && portalStatusById[player.id] === 'activo' && (
                <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 w-fit px-1.5 py-0.5 rounded-md">
                  <CheckCircle2 className="h-3 w-3" /> Portal Activo
                </div>
              )}
            </div>
          </div>
        )
      },
      sortingFn: (rowA, rowB) => {
        const a = `${rowA.original.firstName} ${rowA.original.lastName}`.toLowerCase()
        const b = `${rowB.original.firstName} ${rowB.original.lastName}`.toLowerCase()
        return a.localeCompare(b)
      },
    },
    {
      id: 'group',
      header: 'Grupo',
      cell: ({ row }) => {
        const info = activeEnrollmentByPlayer[row.original.id]
        return info
          ? <span className="text-sm text-foreground">{info.groupName}</span>
          : <span className="text-sm text-muted-foreground">Sin grupo</span>
      },
      enableSorting: false,
    },
    {
      accessorKey: 'level',
      header: 'Nivel',
      cell: ({ row }) => <StatusBadge status={row.original.level} />,
    },
    {
      id: 'attendance',
      header: 'Asistencia',
      cell: ({ row }) => {
        const rate = attendanceRateByPlayer[row.original.id]
        if (rate === null || rate === undefined) {
          return <span className="text-xs text-muted-foreground">Sin datos</span>
        }
        return (
          <div className="flex items-center gap-2 w-28">
            <div className="h-1.5 flex-1 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${rate}%` }} />
            </div>
            <span className="text-xs font-medium text-foreground w-9 text-right">{rate}%</span>
          </div>
        )
      },
      enableSorting: false,
    },
    {
      id: 'paymentStatus',
      header: 'Estado de pago',
      cell: ({ row }) => {
        const info = paymentStatusByPlayer[row.original.id]
        if (!info) return <StatusBadge status="al_dia" />
        const label = `${info.status === 'vencido' ? 'Vencido' : 'Pendiente'} ${formatCurrency(info.amount)}`
        return <StatusBadge status={info.status} label={label} />
      },
      enableSorting: false,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const player = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => navigate(`/jugadores/${player.id}`)}>
                <Eye className="h-4 w-4 mr-2" /> Ver perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setEditingPlayer(player); setShowCreateDialog(true) }}>
                <Edit className="h-4 w-4 mr-2" /> Editar
              </DropdownMenuItem>
              {isAdmin && player.email && portalStatusById[player.id] !== 'activo' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => invitePlayer(player.id)}
                    className="text-blue-700 focus:text-blue-700"
                  >
                    <Gamepad2 className="h-4 w-4 mr-2" />
                    {portalStatusById[player.id] === 'invitado' ? 'Reenviar invitación' : 'Invitar al portal'}
                  </DropdownMenuItem>
                </>
              )}
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
        )
      },
      enableSorting: false,
      size: 40,
    },
  ], [selectedIds, filteredPlayers.length, navigate, invitePlayer, portalStatusById, isAdmin, pendingByPlayer, activeEnrollmentByPlayer, attendanceRateByPlayer, paymentStatusByPlayer])

  const table = useReactTable({
    data: filteredPlayers,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <div>
      <div className="border-b border-border bg-card">
        <div className="flex flex-wrap items-center gap-4 px-5 py-5 lg:px-8">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">PERSONAS</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {players.filter((p) => p.status === 'activo').length} activos ·{' '}
              {players.filter((p) => p.status === 'lista_espera').length} en lista de espera ·{' '}
              {players.length} fichas totales
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Nombre, email o teléfono…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 pl-9"
              />
            </div>
            <Button onClick={() => { setEditingPlayer(null); setShowCreateDialog(true) }}>
              <Plus className="h-4 w-4 mr-1.5" />
              Nuevo jugador
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
          <Select
            options={[{ value: '', label: 'Todos los niveles' }, ...PLAYER_LEVELS.map((l) => ({ value: l.value, label: l.label }))]}
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="w-full sm:w-40"
          />
          <Select
            options={[{ value: '', label: 'Todos los estados' }, ...PLAYER_STATUSES.map((s) => ({ value: s.value, label: s.label }))]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-40"
          />
          <Select
            options={[{ value: '', label: 'Todos los grupos' }, ...activeGroups.map((g) => ({ value: g.id, label: g.name }))]}
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="w-full sm:w-44"
          />
          <Select
            options={[
              { value: '', label: 'Todos los pagos' },
              { value: 'al_dia', label: 'Al día' },
              { value: 'pendiente', label: 'Pendiente' },
              { value: 'vencido', label: 'Vencido' },
            ]}
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="w-full sm:w-40"
          />
          {isAdmin && (
            <Select
              options={[
                { value: '', label: 'Portal: todos' },
                { value: 'active', label: 'Portal activo' },
                { value: 'sent', label: 'Invitación enviada' },
                { value: 'none', label: 'Sin acceso' },
              ]}
              value={portalFilter}
              onChange={(e) => setPortalFilter(e.target.value)}
              className="w-full sm:w-44"
            />
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
              <Upload className="h-4 w-4 mr-1" />
              Importar
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <span className="text-sm font-semibold text-primary">
              {selectedIds.size} seleccionado{selectedIds.size > 1 ? 's' : ''}
            </span>
            <div className="h-4 w-px bg-border mx-1" />

            {/* Cambiar estado */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Cambiar estado
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => {
                  selectedIds.forEach((id) => updatePlayer(id, { status: 'activo' }))
                  setSelectedIds(new Set())
                }}>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 mr-2" />
                  Activo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  selectedIds.forEach((id) => updatePlayer(id, { status: 'lista_espera' }))
                  setSelectedIds(new Set())
                }}>
                  <span className="h-2 w-2 rounded-full bg-amber-500 mr-2" />
                  Lista de espera
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => {
                  selectedIds.forEach((id) => cancelPlayer(id))
                  setSelectedIds(new Set())
                }}>
                  <UserX className="h-3.5 w-3.5 mr-2 text-destructive" />
                  <span className="text-destructive">Dar de baja</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Cambiar nivel */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Cambiar nivel
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {PLAYER_LEVELS.map((lvl) => (
                  <DropdownMenuItem key={lvl.value} onClick={() => {
                    selectedIds.forEach((id) => updatePlayer(id, { level: lvl.value as PlayerLevel }))
                    setSelectedIds(new Set())
                  }}>
                    {lvl.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Invitar al portal */}
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                onClick={() => {
                  const { bulkInvitePlayers } = useDataStore.getState()
                  bulkInvitePlayers(Array.from(selectedIds))
                  setSelectedIds(new Set())
                }}
              >
                <Mail className="h-3.5 w-3.5" />
                Enviar invitaciones
              </Button>
            )}

            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelectedIds(new Set())}>
              Deseleccionar
            </Button>
          </div>
        )}

        {/* Table */}
        {filteredPlayers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No hay jugadores"
            description="Anade tu primer jugador para empezar a gestionar tu escuela"
            action={{ label: 'Anadir jugador', onClick: () => setShowCreateDialog(true) }}
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id} className="border-b bg-muted/50">
                        {headerGroup.headers.map((header) => (
                          <th
                            key={header.id}
                            className={cn(
                              'p-3 text-left text-sm font-medium text-muted-foreground',
                              header.column.getCanSort() && 'cursor-pointer select-none hover:text-foreground',
                              (header.column.columnDef.meta as Record<string, string> | undefined)?.className
                            )}
                            onClick={header.column.getToggleSortingHandler()}
                            style={{ width: header.column.columnDef.size }}
                          >
                            <div className="flex items-center gap-1">
                              {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                              {header.column.getCanSort() && (
                                header.column.getIsSorted() === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> :
                                  header.column.getIsSorted() === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> :
                                    <ArrowUpDown className="h-3.5 w-3.5 opacity-30" />
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => navigate(`/jugadores/${row.original.id}`)}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className={cn('p-3', (cell.column.columnDef.meta as Record<string, string> | undefined)?.className)}
                            onClick={(e) => {
                              if (cell.column.id === 'select' || cell.column.id === 'actions') {
                                e.stopPropagation()
                              }
                            }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
                <span>
                  Mostrando {pagination.pageIndex * pagination.pageSize + 1}
                  –{Math.min((pagination.pageIndex + 1) * pagination.pageSize, filteredPlayers.length)}{' '}
                  de {filteredPlayers.length} jugadores
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
                    Anterior
                  </Button>
                  <span className="text-xs font-medium">
                    Página {pagination.pageIndex + 1} de {Math.max(table.getPageCount(), 1)}
                  </span>
                  <Button variant="outline" size="sm" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
                    Siguiente
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <PlayerFormDialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open)
          if (!open) setEditingPlayer(null)
        }}
        player={editingPlayer}
        onSubmit={handleFormSubmit}
      />

      {/* Import Dialog */}
      <ImportPlayersDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImport={handleImport}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!showDeleteConfirm}
        onOpenChange={() => setShowDeleteConfirm(null)}
        title="Eliminar jugador"
        description="Esta accion eliminara al jugador y todos sus datos asociados. Esta accion no se puede deshacer."
        variant="destructive"
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (showDeleteConfirm) deletePlayer(showDeleteConfirm)
          setShowDeleteConfirm(null)
        }}
      />

      {/* Cancel Player Dialog */}
      <CancelPlayerDialog
        open={!!showCancelConfirm}
        onOpenChange={(open) => { if (!open) setShowCancelConfirm(null) }}
        player={players.find((p) => p.id === showCancelConfirm) ?? null}
        onConfirm={(options) => {
          if (showCancelConfirm) cancelPlayer(showCancelConfirm, options)
          setShowCancelConfirm(null)
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: succeeds with no TypeScript errors. This also resolves Task 2's expected temporary error (`initialStatusFilter` now exists on `PlayersPageProps`). If you see an error about `PaginationState` not being exported from `@tanstack/react-table`, check the installed version's type exports (`node_modules/@tanstack/react-table/package.json`) and report it — don't silently change the import.

- [ ] **Step 3: Manually trace the two tab entry points**

- `/personas/jugadores` → `PlayersRouter` (no prop) → `<PlayersPage initialStatusFilter={undefined} />` → `statusFilter` initial state = `''` (default param kicks in) → same "todos los estados" behavior as today's `/jugadores`.
- `/personas/lista-espera` → `PlayersRouter initialStatusFilter="lista_espera"` → `<PlayersPage initialStatusFilter="lista_espera" />` → `statusFilter` initial state = `'lista_espera'` → table opens pre-filtered to the waiting list, with the "Estado" select showing "Lista de espera" already selected (since `value={statusFilter}` on that `<Select>` reflects the state, and the user can still change it back to "Todos los estados" or any other value — the initial filter is a starting point, not a lock).

Confirm this trace matches the code you just wrote before moving on.

- [ ] **Step 4: Commit**

```bash
git add src/pages/PlayersPage.tsx
git commit -m "feat: rediseno de PlayersPage con filtros de grupo/pago, nuevas columnas y paginacion"
```

---

## Task 4: Visual and functional verification against the mockup

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (port 5173).

- [ ] **Step 2: Log in and open Personas**

Log in as `director` (see `CLAUDE.md` for the seeded account) and navigate to `/personas/jugadores` (either via the sidebar's "Personas" item or directly).

- [ ] **Step 3: Compare against the mockup**

Open `san javier.pen` and compare against node `T0o5x` ("02 · Personas / Jugadores"). Check specifically:
- The 4-tab strip renders above the page content, with correct counts, and highlights "Jugadores" as active.
- Clicking "Lista de espera" navigates to `/personas/lista-espera` and the table opens pre-filtered to that status (verify the row count matches the tab's count badge).
- Clicking "Entrenadores" navigates to `/personas/entrenadores` and renders the existing `CoachesPage` (its own header) directly below the tab strip, with no visual duplication of a second "Personas" title above it.
- Clicking "Usuarios" navigates to `/personas/usuarios` and renders `UsersPage` the same way.
- On the Jugadores tab: the new topbar (title, subtitle counts, search, "Nuevo jugador"), the filter row (Nivel/Estado/Grupo/Pago/Portal + Importar/Exportar), and the table (Jugador/Grupo/Nivel/Asistencia/Estado de pago/actions columns) all render without overflow or clipping at both 1440px and 1024px widths.
- Typing in the search box filters rows; changing the Grupo filter to a real group name narrows the table to just that group's enrolled players; changing Pago to "Vencido" shows only players with an overdue payment.
- Pagination controls appear when there are more than 12 filtered players, "Anterior" is disabled on page 1, "Siguiente" is disabled on the last page, and the "Mostrando X–Y de N" text updates correctly when paging.
- No console errors beyond the pre-existing, unrelated `matchReports` Firestore permission warning noted in Fase 1's verification.

- [ ] **Step 4: Verify old links still work**

Navigate directly to `/jugadores`, `/entrenadores`, and `/usuarios` in the browser's address bar — each must redirect to its `/personas/...` equivalent without a blank page or router error. Also confirm the "Nuevo jugador" button on the "Hoy" dashboard (built in Fase 1, navigates to `/jugadores`) still lands correctly on the Jugadores tab.

- [ ] **Step 5: Verify entrenador role**

Switch to (or log in as) an `entrenador` user and confirm "Personas" still appears in the sidebar and clicking it lands on `/personas/jugadores` successfully (this is the regression class caught in Fase 1 — re-verify it wasn't reintroduced here).

- [ ] **Step 6: Fix any issue found in Steps 3-5 directly, re-run `npm run build`, and re-check in the browser before moving on.**

- [ ] **Step 7: Stop the dev server.**

---

## Self-review notes

- Task ordering matters: Task 1 (StatusBadge) has no dependents from Task 2, but Task 3 depends on it (uses the new `label` prop and `al_dia`/`vencido` statuses) — done first to avoid rework.
- Task 2 intentionally leaves a known, temporary TypeScript error in the codebase between Task 2 and Task 3 (`initialStatusFilter` not yet defined on `PlayersPage`) — this is explicitly called out so an implementer doesn't mistake it for a mistake in Task 2's own work.
- Nothing in `PlayersPage.tsx`'s existing business logic (mutations, dialogs, export/import, bulk actions, portal invite flow) was changed — only add/relocate: new state (`groupFilter`, `paymentFilter`, `pagination`), new derived memos (`activeGroups`, `activeEnrollmentByPlayer`, `activeSeason`, `attendanceRateByPlayer`, `paymentStatusByPlayer`), and new/changed JSX (topbar, filter row, columns, pagination footer).
- `CoachesPage`/`UsersPage` are not modified at all in this plan — they're reused as-is under new routes, per the explicitly-approved design (no duplicate-header workaround needed there because `PersonasLayout` deliberately has no title/search of its own).
- The known simplification from the design spec (pagination footer uses Anterior/Siguiente + a page-count readout, not the mock's numbered page buttons) is intentional, not an oversight.
