# Rediseño UI Personas completo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar el topbar de `PersonasLayout` sobre las 4 pestañas de Personas (Jugadores · Lista de espera · Entrenadores · Usuarios) y reescribir `CoachesPage`/`UsersPage` para que compartan el mismo lenguaje visual que ya tiene `PlayersPage`, terminando el trabajo dejado pendiente en la Fase 2.

**Architecture:** `PersonasLayout` pasa a poseer el estado de búsqueda y el botón de acción primaria (`search`, `setSearch`, `setPrimaryAction`), comunicándolos a la página activa vía `useOutletContext`. `PlayersPage` pierde su topbar propio. `CoachesPage` se reescribe de tarjetas/lista a una tabla única con `@tanstack/react-table` (mismo patrón que `PlayersPage`). `UsersPage` pierde su cabecera propia; sus 3 sub-vistas pasan a pestañas secundarias bajo la barra de pestañas de Personas.

**Tech Stack:** React 19, TypeScript, react-router-dom v7 (`useOutletContext`), `@tanstack/react-table` v8, Tailwind CSS v4, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-08-30-rediseno-ui-personas-completo-design.md`

---

### Task 1: Topbar unificado en `PersonasLayout`

**Files:**
- Modify: `src/components/layout/PersonasLayout.tsx`

- [ ] **Step 1: Reescribir el archivo completo**

```tsx
import { useState, useEffect, useMemo } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useDataStore } from '@/stores/dataStore'
import { useAuthStore, hasPermission } from '@/stores/authStore'
import type { UserRole } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Search, ChevronDown, type LucideIcon } from 'lucide-react'

interface PersonasTab {
  name: string
  href: string
  count: number
  requiredModule?: string
}

export interface PersonasPrimaryAction {
  label: string
  icon?: LucideIcon
  onClick?: () => void
  items?: { label: string; icon?: LucideIcon; onClick: () => void }[]
}

// Solo lectura: ninguna página necesita escribir en `search` hoy (el propio
// input del topbar ya vive en este layout), así que no se expone `setSearch`.
export interface PersonasOutletContext {
  search: string
  setPrimaryAction: (action: PersonasPrimaryAction | null) => void
}

const STAFF_ROLES_FOR_SUBTITLE: UserRole[] = ['director', 'coordinador', 'entrenador']
const PORTAL_ROLES_FOR_SUBTITLE: UserRole[] = ['jugador', 'tutor']

export function PersonasLayout() {
  const location = useLocation()
  const { players, coaches, users, invitations } = useDataStore()
  const { user } = useAuthStore()
  const activeRole = user?.activeRole ?? user?.role

  const [search, setSearch] = useState('')
  const [primaryAction, setPrimaryAction] = useState<PersonasPrimaryAction | null>(null)

  useEffect(() => {
    setSearch('')
  }, [location.pathname])

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

  const { subtitle, searchPlaceholder } = useMemo(() => {
    if (location.pathname === '/personas/entrenadores') {
      const activeCoaches = coaches.filter((c) => c.isActive).length
      return {
        subtitle: `${activeCoaches} activos · ${coaches.length} total`,
        searchPlaceholder: 'Nombre, email o teléfono…',
      }
    }
    if (location.pathname === '/personas/usuarios') {
      const staffCount = users.filter((u) =>
        u.roles.some((r) => STAFF_ROLES_FOR_SUBTITLE.includes(r)) &&
        !u.roles.some((r) => PORTAL_ROLES_FOR_SUBTITLE.includes(r))
      ).length
      const withPortal = new Set(
        users
          .filter((u) => u.isActive && u.roles.some((r) => PORTAL_ROLES_FOR_SUBTITLE.includes(r)))
          .flatMap((u) => [...(u.linkedPlayerIds || []), ...(u.linkedPlayerId ? [u.linkedPlayerId] : [])])
      ).size
      const pending = invitations.filter((inv) => inv.status === 'pendiente').length
      return {
        subtitle: `${staffCount} personal del club · ${withPortal} con portal activo · ${pending} invitaciones pendientes`,
        searchPlaceholder: 'Email o nombre…',
      }
    }
    return {
      subtitle: `${players.filter((p) => p.status === 'activo').length} activos · ${players.filter((p) => p.status === 'lista_espera').length} en lista de espera · ${players.length} fichas totales`,
      searchPlaceholder: 'Nombre, email o teléfono…',
    }
  }, [location.pathname, players, coaches, users, invitations])

  return (
    <div>
      <div className="border-b border-border bg-card">
        <div className="flex flex-wrap items-center gap-4 px-5 py-5 lg:px-8">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">PERSONAS</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 pl-9"
              />
            </div>
            {primaryAction && (
              primaryAction.items ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button>
                      {primaryAction.icon && <primaryAction.icon className="h-4 w-4 mr-1.5" />}
                      {primaryAction.label}
                      <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {primaryAction.items.map((item) => (
                      <DropdownMenuItem key={item.label} onClick={item.onClick}>
                        {item.icon && <item.icon className="h-4 w-4 mr-2" />}
                        {item.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button onClick={primaryAction.onClick}>
                  {primaryAction.icon && <primaryAction.icon className="h-4 w-4 mr-1.5" />}
                  {primaryAction.label}
                </Button>
              )
            )}
          </div>
        </div>
      </div>

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
      <Outlet context={{ search, setPrimaryAction } satisfies PersonasOutletContext} />
    </div>
  )
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: sin errores de TypeScript. `PlayersPage.tsx`, `CoachesPage.tsx` y `UsersPage.tsx` seguirán compilando en esta Task porque `useDataStore`/`useAuthStore` no cambian de forma — solo se añade un nuevo export (`PersonasOutletContext`) que nadie consume todavía.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/PersonasLayout.tsx
git commit -m "feat: topbar unificado en PersonasLayout con Outlet context"
```

---

### Task 2: `PlayersPage` — quitar topbar propio, usar el contexto compartido

**Files:**
- Modify: `src/pages/PlayersPage.tsx`

- [ ] **Step 1: Actualizar imports**

Reemplazar la línea 2 y añadir el import del contexto. Cambiar:

```ts
import { useNavigate } from 'react-router-dom'
```

por:

```ts
import { useNavigate, useOutletContext } from 'react-router-dom'
```

Añadir, junto a los demás imports de `@/components/layout` (no existe ninguno hoy en este archivo, así que se añade uno nuevo cerca del resto de imports de `@/components`):

```ts
import type { PersonasOutletContext } from '@/components/layout/PersonasLayout'
```

Quitar el import de `Input` (línea 10, `import { Input } from '@/components/ui/input'`) — ya no se usa en este archivo tras quitar el topbar (la fila de filtros usa `Select`, no `Input`).

Quitar `Search` de la lista de iconos de `lucide-react` (línea 34-38) — ya no se renderiza aquí; el resto de iconos de esa lista se mantienen igual.

- [ ] **Step 2: Sustituir el estado local de búsqueda por el contexto**

Cambiar:

```ts
  const isAdmin = activeRole === 'director' || activeRole === 'coordinador'
  const [search, setSearch] = useState('')
```

por:

```ts
  const isAdmin = activeRole === 'director' || activeRole === 'coordinador'
  const { search, setPrimaryAction } = useOutletContext<PersonasOutletContext>()
```

(`setSearch` no se destructura aquí: tras quitar el input de búsqueda de este archivo, `PlayersPage` ya no necesita escribir en `search`, solo leerlo.)

- [ ] **Step 3: Registrar el botón primario**

Añadir un nuevo `useEffect` inmediatamente después del `useEffect` existente que resetea la paginación (el que depende de `[search, levelFilter, statusFilter, groupFilter, paymentFilter, portalFilter]`):

```ts
  useEffect(() => {
    setPrimaryAction({
      label: 'Nuevo jugador',
      icon: Plus,
      onClick: () => { setEditingPlayer(null); setShowCreateDialog(true) },
    })
    return () => setPrimaryAction(null)
  }, [setPrimaryAction])
```

- [ ] **Step 4: Quitar el bloque de topbar del render**

Eliminar por completo este bloque (justo después de `return (\n    <div>`):

```tsx
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
```

por únicamente:

```tsx
      <div className="p-6 space-y-4">
```

(El resto del JSX —filtros, tabla, paginación, diálogos— no cambia. `search` sigue leyéndose exactamente igual en `filteredPlayers`.)

- [ ] **Step 5: Verificar que compila y los tests pasan**

Run: `npm run build`
Expected: sin errores.

Run: `npm test`
Expected: 137/137 (este archivo no tiene tests dedicados; la cifra no debería cambiar).

- [ ] **Step 6: Commit**

```bash
git add src/pages/PlayersPage.tsx
git commit -m "refactor: PlayersPage usa el topbar compartido de PersonasLayout"
```

---

### Task 3: `CoachesPage` — reescritura completa a tabla única

**Files:**
- Modify: `src/pages/CoachesPage.tsx`

- [ ] **Step 1: Reescribir el archivo completo**

```tsx
import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
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
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { useDataStore } from '@/stores/dataStore'
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
import {
  Plus,
  Euro,
  Eye,
  Edit2,
  Trash2,
  UserPlus,
  Users,
  MoreHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { cn, formatCurrency, normalizeText } from '@/lib/utils'
import { STAFF_ROLES } from '@/constants'
import type { Coach, StaffRole } from '@/types'
import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/stores/authStore'
import { createInvitation } from '@/lib/invitations'
import { sendInvitationEmail } from '@/lib/emailService'
import { useEventPaymentsQuery } from '@/hooks/useQueries'
import { calculateEventSalary } from '@/lib/salary-utils'
import type { PersonasOutletContext } from '@/components/layout/PersonasLayout'

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
  staffRole: StaffRole
  ratePerGroupAdults: string
  ratePerGroupMinors: string
  privateLessonPaymentType: string
  privateLessonRate: string
  eventPaymentType: string
  eventRate: string
  bonuses: string
  salaryNotes: string
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
  staffRole: 'entrenador',
  ratePerGroupAdults: '',
  ratePerGroupMinors: '',
  privateLessonPaymentType: 'fixed',
  privateLessonRate: '',
  eventPaymentType: 'percentage',
  eventRate: '',
  bonuses: '',
  salaryNotes: '',
}

export default function CoachesPage() {
  const {
    coaches,
    groups,
    coachSalaryConfigs,
    privateLessons,
    events,
    addCoach,
    updateCoach,
    deleteCoach,
    updateCoachSalaryConfig,
  } = useDataStore()

  const { data: eventPayments = [] } = useEventPaymentsQuery()
  const { search, setPrimaryAction } = useOutletContext<PersonasOutletContext>()

  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [activeFilter, setActiveFilter] = useState<string>('active')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingCoach, setEditingCoach] = useState<Coach | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [form, setForm] = useState<CoachForm>({ ...emptyForm })
  const [showInviteSuccess, setShowInviteSuccess] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteEmailStatus, setInviteEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ fixed: number; message: string } | null>(null)
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 12 })

  const resetForm = () => setForm({ ...emptyForm })

  const openCreateDialog = () => {
    resetForm()
    setEditingCoach(null)
    setShowCreateDialog(true)
  }

  useEffect(() => {
    setPrimaryAction({
      label: 'Nuevo entrenador',
      icon: Plus,
      onClick: openCreateDialog,
    })
    return () => setPrimaryAction(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setPrimaryAction])

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }, [search, activeFilter, roleFilter])

  const filteredCoaches = useMemo(() => {
    const q = normalizeText(search)
    return coaches.filter((c) => {
      const matchesSearch =
        search === '' ||
        normalizeText(`${c.firstName} ${c.lastName}`).includes(q) ||
        normalizeText(c.email).includes(q) ||
        c.phone.includes(search)
      const matchesActive =
        activeFilter === 'all' || (activeFilter === 'active' && c.isActive)
      const matchesRole =
        roleFilter === '' || (c.staffRole ?? 'entrenador') === roleFilter
      return matchesSearch && matchesActive && matchesRole
    })
  }, [coaches, search, activeFilter, roleFilter])

  const getCoachGroups = (coachId: string) =>
    groups.filter((g) => g.coachId === coachId)

  const getSalaryConfig = (coachId: string) =>
    coachSalaryConfigs.find((c) => c.coachId === coachId)

  const getEstimatedSalary = (coachId: string) => {
    const config = getSalaryConfig(coachId)
    if (!config) return 0
    const coachGroups = getCoachGroups(coachId)
    const adultGroupsCount = coachGroups.filter(g => g.level !== 'menores').length
    const minorsGroupsCount = coachGroups.filter(g => g.level === 'menores').length

    const groupsSalary = (adultGroupsCount * (config.ratePerGroupAdults || 0)) + (minorsGroupsCount * (config.ratePerGroupMinors || 0))

    const now = new Date()

    const monthLessons = privateLessons.filter(
      (pl) =>
        pl.coachId === coachId &&
        new Date(pl.date).getMonth() === now.getMonth() &&
        new Date(pl.date).getFullYear() === now.getFullYear()
    )

    const lessonsSalary = monthLessons.reduce((acc, lesson) => {
      if (config.privateLessonPaymentType === 'fixed') {
        return acc + (config.privateLessonRate || 0)
      } else {
        return acc + (lesson.price * ((config.privateLessonRate || 0) / 100))
      }
    }, 0)

    const monthEvents = events.filter(
      (ev) =>
        ev.coachIds.includes(coachId) &&
        new Date(ev.date).getMonth() === now.getMonth() &&
        new Date(ev.date).getFullYear() === now.getFullYear()
    )

    const eventsSalary = monthEvents.reduce((acc, ev) => {
      return acc + calculateEventSalary(ev, eventPayments, config)
    }, 0)

    return groupsSalary + lessonsSalary + eventsSalary + (config.bonuses || 0)
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
      staffRole: form.staffRole,
      hireDate: editingCoach ? editingCoach.hireDate : new Date(),
    }

    if (editingCoach) {
      updateCoach(editingCoach.id, coachData)
      updateCoachSalaryConfig(editingCoach.id, {
        coachId: editingCoach.id,
        ratePerGroupAdults: parseFloat(form.ratePerGroupAdults) || 0,
        ratePerGroupMinors: parseFloat(form.ratePerGroupMinors) || 0,
        privateLessonPaymentType: form.privateLessonPaymentType as 'fixed' | 'percentage',
        privateLessonRate: parseFloat(form.privateLessonRate) || 0,
        eventPaymentType: form.eventPaymentType as 'fixed' | 'percentage',
        eventRate: parseFloat(form.eventRate) || 0,
        bonuses: parseFloat(form.bonuses) || 0,
        notes: form.salaryNotes || undefined,
      })
      setEditingCoach(null)
    } else {
      const newCoachId = addCoach(coachData)
      updateCoachSalaryConfig(newCoachId, {
        coachId: newCoachId,
        ratePerGroupAdults: parseFloat(form.ratePerGroupAdults) || 0,
        ratePerGroupMinors: parseFloat(form.ratePerGroupMinors) || 0,
        privateLessonPaymentType: form.privateLessonPaymentType as 'fixed' | 'percentage',
        privateLessonRate: parseFloat(form.privateLessonRate) || 0,
        eventPaymentType: form.eventPaymentType as 'fixed' | 'percentage',
        eventRate: parseFloat(form.eventRate) || 0,
        bonuses: parseFloat(form.bonuses) || 0,
        notes: form.salaryNotes || undefined,
      })
    }

    setShowCreateDialog(false)
    resetForm()
  }

  const openEditDialog = (coach: Coach) => {
    const config = getSalaryConfig(coach.id)
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
      staffRole: coach.staffRole ?? 'entrenador',
      ratePerGroupAdults: config && config.ratePerGroupAdults !== undefined ? String(config.ratePerGroupAdults) : '',
      ratePerGroupMinors: config && config.ratePerGroupMinors !== undefined ? String(config.ratePerGroupMinors) : '',
      privateLessonPaymentType: config?.privateLessonPaymentType ?? 'fixed',
      privateLessonRate: config && config.privateLessonRate !== undefined ? String(config.privateLessonRate) : '',
      eventPaymentType: config?.eventPaymentType ?? 'percentage',
      eventRate: config && config.eventRate !== undefined ? String(config.eventRate) : '',
      bonuses: config ? String(config.bonuses) : '',
      salaryNotes: config?.notes || '',
    })
    setEditingCoach(coach)
    setShowCreateDialog(true)
  }

  const getStaffRoleLabel = (role?: StaffRole) =>
    STAFF_ROLES.find((r) => r.value === (role ?? 'entrenador'))?.label ?? 'Entrenador'

  const getStaffRoleBadgeVariant = (role?: StaffRole) => {
    switch (role) {
      case 'director':
        return 'default' as const
      case 'coordinador':
        return 'warning' as const
      default:
        return 'outline' as const
    }
  }

  const handleCreateAccount = async (coach: Coach) => {
    if (!coach.email) return
    const role = coach.staffRole === 'coordinador' ? 'coordinador' : 'entrenador'

    let activationUrl: string
    try {
      const result = await createInvitation({
        email: coach.email,
        role,
        clubId: user?.clubId ?? 'club-001',
        createdBy: user?.id ?? 'unknown',
        coachId: coach.id,
      })
      activationUrl = result.activationUrl
    } catch (err) {
      console.error('[CoachesPage] handleCreateAccount: error creando la invitación:', err)
      setSyncResult({ fixed: 0, message: `No se pudo crear la invitación para ${coach.email}.` })
      return
    }

    setInviteEmail(coach.email)
    setInviteLink(activationUrl)
    setShowInviteSuccess(true)
    setInviteEmailStatus('sending')

    try {
      await sendInvitationEmail(
        { name: `${coach.firstName} ${coach.lastName}`.trim(), email: coach.email },
        activationUrl,
        role
      )
      setInviteEmailStatus('sent')
    } catch (err) {
      console.error('[CoachesPage] handleCreateAccount: error enviando el correo:', err)
      setInviteEmailStatus('failed')
    }
  }

  const handleSyncAccounts = async () => {
    const clubId = user?.clubId
    if (!clubId) return
    setIsSyncing(true)
    try {
      const usersSnap = await getDocs(
        query(
          collection(db, 'users'),
          where('clubId', '==', clubId),
          where('role', 'in', ['entrenador', 'coordinador'])
        )
      )
      const staffUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() as { email: string } }))

      const coachesSnap = await getDocs(
        query(collection(db, 'coaches'), where('clubId', '==', clubId))
      )

      let fixed = 0
      for (const coachDoc of coachesSnap.docs) {
        const coachData = coachDoc.data()
        if (coachData.userId) continue

        const matchingUser = staffUsers.find(
          (u) => u.email?.toLowerCase() === coachData.email?.toLowerCase()
        )
        if (matchingUser) {
          await updateDoc(doc(db, 'coaches', coachDoc.id), { userId: matchingUser.id })
          updateCoach(coachDoc.id, { userId: matchingUser.id })
          fixed++
        }
      }

      setSyncResult({
        fixed,
        message: fixed > 0
          ? `Se vincularon ${fixed} entrenador${fixed > 1 ? 'es' : ''} correctamente.`
          : 'Todos los entrenadores ya están vinculados correctamente.',
      })
    } catch (err) {
      console.error('[SyncAccounts] Failed:', err)
      setSyncResult({ fixed: 0, message: 'Error al sincronizar. Inténtalo de nuevo.' })
    } finally {
      setIsSyncing(false)
    }
  }

  const columns = useMemo<ColumnDef<Coach>[]>(() => [
    {
      accessorKey: 'firstName',
      header: 'Entrenador',
      cell: ({ row }) => {
        const coach = row.original
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                {coach.firstName[0]}{coach.lastName[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-sm">{coach.firstName} {coach.lastName}</p>
              {coach.specialization && (
                <p className="text-xs text-muted-foreground">{coach.specialization}</p>
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
      accessorKey: 'staffRole',
      header: 'Rol',
      cell: ({ row }) => (
        <Badge variant={getStaffRoleBadgeVariant(row.original.staffRole)}>
          {getStaffRoleLabel(row.original.staffRole)}
        </Badge>
      ),
    },
    {
      id: 'groups',
      header: 'Grupos',
      cell: ({ row }) => (
        <Badge variant="outline">{getCoachGroups(row.original.id).length}</Badge>
      ),
      enableSorting: false,
    },
    {
      id: 'salary',
      header: 'Salario est.',
      cell: ({ row }) => (
        <span className="text-sm font-medium">{formatCurrency(getEstimatedSalary(row.original.id))}</span>
      ),
      enableSorting: false,
    },
    {
      id: 'account',
      header: 'Cuenta',
      cell: ({ row }) => (
        <Badge variant={row.original.userId ? 'success' : 'secondary'}>
          {row.original.userId ? 'Con cuenta' : 'Sin cuenta'}
        </Badge>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'isActive',
      header: 'Estado',
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? 'success' : 'secondary'}>
          {row.original.isActive ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const coach = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => navigate(`/entrenadores/${coach.id}`)}>
                <Eye className="h-4 w-4 mr-2" /> Ver perfil
              </DropdownMenuItem>
              {!coach.userId && (
                <DropdownMenuItem onClick={() => handleCreateAccount(coach)}>
                  <UserPlus className="h-4 w-4 mr-2" /> Crear cuenta
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => openEditDialog(coach)}>
                <Edit2 className="h-4 w-4 mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowDeleteConfirm(coach.id)}>
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [groups, coachSalaryConfigs, privateLessons, events, eventPayments, navigate])

  const table = useReactTable({
    data: filteredCoaches,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
        <Select
          options={[
            { value: '', label: 'Todos los roles' },
            ...STAFF_ROLES.map((r) => ({ value: r.value, label: r.label })),
          ]}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="w-full sm:w-40"
        />
        <Select
          options={[
            { value: 'active', label: 'Solo activos' },
            { value: 'all', label: 'Todos' },
          ]}
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value)}
          className="w-full sm:w-40"
        />
        <div className="flex-1" />
        <Button
          size="sm"
          variant="outline"
          onClick={handleSyncAccounts}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <>
              <span className="h-4 w-4 mr-1 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Sincronizando...
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4 mr-1" />
              Reparar vinculaciones
            </>
          )}
        </Button>
      </div>

      {filteredCoaches.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No hay entrenadores"
          description="Anade tu primer entrenador para empezar a gestionar el personal"
          action={{ label: 'Anadir entrenador', onClick: openCreateDialog }}
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
                            header.column.getCanSort() && 'cursor-pointer select-none hover:text-foreground'
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
                    <tr key={row.id} className="border-b hover:bg-muted/30 transition-colors">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="p-3">
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
                –{Math.min((pagination.pageIndex + 1) * pagination.pageSize, filteredCoaches.length)}{' '}
                de {filteredCoaches.length} entrenadores
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

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-xl sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingCoach ? 'Editar miembro' : 'Nuevo miembro'}
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
              <Label>Rol en el staff</Label>
              <Select
                options={STAFF_ROLES.map((r) => ({ value: r.value, label: r.label }))}
                value={form.staffRole}
                onChange={(e) => setForm({ ...form, staffRole: e.target.value as StaffRole })}
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
                rows={2}
              />
            </div>

            {editingCoach && (
              <>
                <div className="col-span-2 border-t pt-4 mt-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <Euro className="h-4 w-4" />
                    Configuracion salarial
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tarifa Grupos Adultos (€/mes)</Label>
                    <Input
                      type="number"
                      value={form.ratePerGroupAdults}
                      onChange={(e) => setForm({ ...form, ratePerGroupAdults: e.target.value })}
                      placeholder="250"
                      min="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tarifa Grupos Menores (€/mes)</Label>
                    <Input
                      type="number"
                      value={form.ratePerGroupMinors}
                      onChange={(e) => setForm({ ...form, ratePerGroupMinors: e.target.value })}
                      placeholder="200"
                      min="0"
                    />
                  </div>
                </div>

                <div className="border-t border-border mt-4 mb-4"></div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Modo de cobro Clases Particulares</Label>
                    <Select
                      options={[
                        { value: 'fixed', label: 'Cantidad fija (€) por clase' },
                        { value: 'percentage', label: 'Porcentaje (%) de recaudación' },
                      ]}
                      value={form.privateLessonPaymentType}
                      onChange={(e) => setForm({ ...form, privateLessonPaymentType: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{form.privateLessonPaymentType === 'fixed' ? 'Cantidad fija (€/clase)' : 'Porcentaje de recaudación (%)'}</Label>
                    <Input
                      type="number"
                      value={form.privateLessonRate}
                      onChange={(e) =>
                        setForm({ ...form, privateLessonRate: e.target.value })
                      }
                      placeholder={form.privateLessonPaymentType === 'fixed' ? "30" : "50"}
                      min="0"
                    />
                  </div>
                </div>

                <div className="border-t border-border mt-4 mb-4"></div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Modo de cobro en Eventos</Label>
                    <Select
                      options={[
                        { value: 'fixed', label: 'Cantidad fija (€) por evento' },
                        { value: 'percentage', label: 'Porcentaje (%) de recaudación' },
                      ]}
                      value={form.eventPaymentType}
                      onChange={(e) => setForm({ ...form, eventPaymentType: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{form.eventPaymentType === 'fixed' ? 'Cantidad fija (€/evento)' : 'Porcentaje de Beneficio Neto (%)'}</Label>
                    <Input
                      type="number"
                      value={form.eventRate}
                      onChange={(e) =>
                        setForm({ ...form, eventRate: e.target.value })
                      }
                      placeholder={form.eventPaymentType === 'fixed' ? "50" : "60"}
                      min="0"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Primas / Bonificaciones (€)</Label>
                  <Input
                    type="number"
                    value={form.bonuses}
                    onChange={(e) => setForm({ ...form, bonuses: e.target.value })}
                    placeholder="0"
                    min="0"
                    step="10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notas salario</Label>
                  <Input
                    value={form.salaryNotes}
                    onChange={(e) => setForm({ ...form, salaryNotes: e.target.value })}
                    placeholder="Observaciones..."
                  />
                </div>
              </>
            )}
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
              {editingCoach ? 'Guardar cambios' : 'Crear miembro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!showDeleteConfirm}
        onOpenChange={() => setShowDeleteConfirm(null)}
        title="Eliminar miembro"
        description="Esta accion eliminara al miembro del equipo y todos sus datos asociados. Esta accion no se puede deshacer."
        variant="destructive"
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (showDeleteConfirm) deleteCoach(showDeleteConfirm)
          setShowDeleteConfirm(null)
        }}
      />

      <Dialog open={showInviteSuccess} onOpenChange={setShowInviteSuccess}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-green-600" />
              Invitacion creada
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {inviteEmailStatus === 'sending'
                ? 'Enviando el correo de activación…'
                : inviteEmailStatus === 'sent'
                ? `Hemos enviado un correo a ${inviteEmail} con el enlace de activación. También puedes compartirlo tú mismo.`
                : 'No se pudo enviar el correo automáticamente. Comparte tú este enlace para que active su cuenta.'}
            </p>
            <div className="flex gap-2">
              <Input readOnly value={inviteLink} className="flex-1 font-mono text-xs" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(inviteLink)
                }}
              >
                Copiar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">La invitacion expira en 7 dias.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowInviteSuccess(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!syncResult} onOpenChange={() => setSyncResult(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Sincronización completada
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{syncResult?.message}</p>
          <DialogFooter>
            <Button onClick={() => setSyncResult(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: sin errores. Prestar atención especial a que `Coach` tenga los campos `staffRole`, `userId`, `specialization`, `isActive` usados en las columnas (ya existían antes de este cambio, solo se reorganizan).

- [ ] **Step 3: Verificación manual en navegador**

1. `npm run dev`
2. Iniciar sesión como `director` o `coordinador`.
3. Ir a `/personas/entrenadores`.
4. Verificar: topbar muestra "PERSONAS" + subtítulo "X activos · Y total" + botón "Nuevo entrenador"; tabla única con las 7 columnas; filtros Rol/Estado + botón "Reparar vinculaciones" funcionan; clic en una fila no navega (a diferencia de Jugadores, aquí solo el menú "..." tiene acciones); ordenar por nombre/rol/estado funciona; paginación con 12 filas por página si hay más de 12 entrenadores.
5. Crear un entrenador de prueba, editarlo, verificar que el diálogo de salario sigue funcionando igual que antes.

- [ ] **Step 4: Commit**

```bash
git add src/pages/CoachesPage.tsx
git commit -m "feat: reescribir CoachesPage a tabla unica, estilo Jugadores"
```

---

### Task 4: `UsersPage` — quitar cabecera propia, sub-pestañas bajo el tab-bar de Personas

**Files:**
- Modify: `src/pages/UsersPage.tsx`

- [ ] **Step 1: Actualizar imports**

Añadir a los imports de `react-router-dom` (hoy este archivo no importa nada de `react-router-dom`, así que se añade una línea nueva junto a los imports de React):

```ts
import { useOutletContext } from 'react-router-dom'
```

Añadir el import del contexto compartido:

```ts
import type { PersonasOutletContext } from '@/components/layout/PersonasLayout'
```

Quitar `ShieldCheck` y `Search` de la lista de iconos importados de `lucide-react` (ya no se usan: `ShieldCheck` estaba solo en el `<h1>` eliminado, `Search` estaba solo en el input de búsqueda eliminado). El resto de iconos (`UserPlus, Copy, Check, Trash2, UserX, UserCog, UserCheck, Users, Gamepad2`) se mantienen.

- [ ] **Step 2: Sustituir `searchTerm` local por el contexto**

Cambiar:

```ts
  // --- Filter state ---
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState('')
```

por:

```ts
  // --- Filter state ---
  const { search: searchTerm, setPrimaryAction } = useOutletContext<PersonasOutletContext>()
  const [filterRole, setFilterRole] = useState('')
```

(El resto del archivo sigue leyendo `searchTerm` exactamente igual — solo cambia su origen. Como ya no hay `setSearchTerm` local, hay que quitar la llamada a `setSearchTerm('')` dentro del `onClick` compartido de las 3 pestañas, y también la del `onChange` del input de búsqueda que se elimina — ver Step 4 y Step 5.)

- [ ] **Step 3: Registrar el botón primario con menú desplegable**

Añadir `useEffect` a los imports de React (línea 1): cambiar `import { useState, useMemo } from 'react'` por `import { useState, useMemo, useEffect } from 'react'`.

Añadir el `useEffect` inmediatamente **antes** de `const tabs = [...]` (que ya está justo antes del `return (` — así el efecto queda después de todas las funciones que referencia: `handleOpenDialog`, `setShowBulkTutorDialog`, `setShowInvitePlayersDialog`, todas declaradas más arriba en el archivo):

```ts
  useEffect(() => {
    setPrimaryAction({
      label: 'Invitar',
      icon: UserPlus,
      items: [
        { label: 'Invitar usuario', icon: UserPlus, onClick: handleOpenDialog },
        { label: 'Invitar tutores', icon: Users, onClick: () => setShowBulkTutorDialog(true) },
        { label: 'Invitar jugadores', icon: Gamepad2, onClick: () => setShowInvitePlayersDialog(true) },
      ],
    })
    return () => setPrimaryAction(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setPrimaryAction])

  const tabs = [
```

(la última línea de arriba, `const tabs = [`, ya existe en el archivo — se muestra solo como ancla; no duplicar la declaración.)

- [ ] **Step 4: Quitar la cabecera propia y ajustar la fila de pestañas**

Sustituir todo este bloque:

```tsx
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
```

por:

```tsx
      {/* Sub-pestañas */}
      <div className="border-b border-border bg-card px-6">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`px-4 py-2.5 font-medium text-sm transition-colors relative flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => { setActiveTab(tab.id); setFilterRole(''); setFilterStatus('') }}
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
```

- [ ] **Step 5: Quitar el buscador propio de la fila de filtros**

Dentro de la fila `{/* Filters */}`, eliminar el bloque del buscador (el buscador ya vive en el topbar compartido):

```tsx
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
```

Dejando la fila `{/* Filters */}` con solo los `Select` de Rol/Estado (que ya usan `flex-1` implícito al ser los únicos elementos; añadir `className="w-full sm:w-48"` ya lo tienen, no requiere más cambios en esos `Select`).

`Input` deja de usarse en este archivo tras este cambio — quitar su import (`import { Input } from '@/components/ui/input'`, no se usa en ningún otro sitio del archivo: los diálogos de invitación sí usan `Input`, así que **no** se quita, solo se confirma que se sigue usando en los diálogos más abajo — dejar el import).

- [ ] **Step 6: Verificar que compila**

Run: `npm run build`
Expected: sin errores. Revisar que no queden referencias a `setSearchTerm` (debe haber cero, ya que ahora `searchTerm` viene de `search` del contexto, de solo lectura).

- [ ] **Step 7: Verificación manual en navegador**

1. `npm run dev`, iniciar sesión como `director`.
2. Ir a `/personas/usuarios`.
3. Verificar: topbar muestra "PERSONAS" + subtítulo con los 3 contadores + botón "Invitar" con menú desplegable (3 opciones, cada una abre su diálogo correspondiente).
4. Verificar las 3 sub-pestañas (Invitaciones/Personal del club/Portal de jugadores) debajo de la barra de pestañas de Personas, cada una con su tabla y filtros intactos.
5. Escribir en el buscador del topbar y confirmar que filtra la tabla de la sub-pestaña activa.
6. Cambiar de sub-pestaña y confirmar que el buscador del topbar NO se resetea (solo se resetea al cambiar de pestaña de Personas, no de sub-pestaña) — comportamiento aceptado, ya que el spec no pide reseteo por sub-pestaña, solo por pestaña principal.
7. Probar las 3 acciones de invitar desde el menú del topbar.

- [ ] **Step 8: Commit**

```bash
git add src/pages/UsersPage.tsx
git commit -m "refactor: UsersPage con sub-pestanas bajo el tab-bar de Personas"
```

---

### Task 5: Verificación final del conjunto

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Build y tests completos**

Run: `npm run build`
Expected: sin errores.

Run: `npm test`
Expected: 137/137 (ninguna de estas páginas tiene tests dedicados; la cifra no debería cambiar respecto al baseline antes de esta plan).

- [ ] **Step 2: Recorrido manual completo de las 4 pestañas**

1. `npm run dev`, sesión como `director`.
2. `/personas/jugadores`: topbar con "Nuevo jugador", filtros, tabla, paginación — comportamiento idéntico a antes de este plan salvo la posición del buscador/botón (ahora en el topbar compartido).
3. `/personas/lista-espera`: mismo componente, filtro de estado preseleccionado en "Lista de espera", topbar con el mismo "Nuevo jugador".
4. `/personas/entrenadores`: tabla nueva, botón "Nuevo entrenador", filtros Rol/Estado, "Reparar vinculaciones".
5. `/personas/usuarios`: sub-pestañas, botón "Invitar" con menú.
6. Cambiar entre las 4 pestañas repetidamente y confirmar que el buscador se vacía cada vez (no arrastra el término de la pestaña anterior) y que no aparecen errores en la consola del navegador.
7. Confirmar con un usuario `entrenador` (si hay uno de prueba) que sigue sin ver las pestañas Entrenadores/Usuarios (permisos sin cambios).

- [ ] **Step 3: Repetir el proceso de `subagent-driven-development`**

Tras completar las Tasks 1-4 (cada una con su implementador + revisor de spec + revisor de calidad), dispatch un revisor final sobre el diff completo de este plan (rango: desde el commit anterior a la Task 1 de este plan, hasta el HEAD tras la Task 4), igual que se hizo para el plan de Hoy/Dashboard. Después, usar `superpowers:finishing-a-development-branch`.
