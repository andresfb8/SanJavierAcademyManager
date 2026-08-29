# Rediseño UI Fase 1 (Sidebar + Hoy) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the new visual identity from `san javier.pen` (warm palette, Archivo/Barlow Condensed typography) and restructure the app's navigation into a flat 7-item sidebar, then rebuild the "Hoy" dashboard's above-the-fold layout to match the mockup, without deleting any existing dashboard functionality.

**Architecture:** Three independent file changes: (1) global design tokens in `src/index.css` that cascade to every page via Tailwind's `@theme`, (2) a full restructure of `src/components/layout/Sidebar.tsx` from grouped/collapsible nav to a flat 6-item list + a secondary settings flyout, (3) new topbar + hero KPI row + 2-column summary section prepended to `src/pages/DashboardPage.tsx`, with existing dashboard content (charts, activity feed, KPI config dialog) relocated below rather than deleted.

**Tech Stack:** React 19 + TypeScript, Tailwind CSS v4 (`@theme` tokens in `src/index.css`), react-router-dom v7, lucide-react icons, Zustand (`useDataStore`, `useAuthStore`), no test framework applies to this visual work — verification is `npm run build` (tsc type-check + vite build) plus a manual dev-server visual check against the `.pen` mockups.

Reference spec: `docs/superpowers/specs/2026-08-29-rediseno-ui-fase1-sidebar-hoy-design.md`

---

## Task 1: Global design tokens

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Replace the font import and `@theme` block**

Replace the current file's first 67 lines (from the top `@import` through the closing `}` of `@theme`) with:

```css
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=Barlow+Condensed:wght@500;600;700&display=swap');
@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

@theme {
  /* ── Base Canvas ── */
  --color-background: #F4F1EA;
  --color-foreground: #16202B;
  --color-card: #FFFFFF;
  --color-card-foreground: #16202B;
  --color-popover: #FFFFFF;
  --color-popover-foreground: #16202B;

  /* ── Brand/Primary: San Javier Blue ── */
  --color-primary: #2A5FD9;
  --color-primary-foreground: #FFFFFF;

  /* ── Secondary / UI surfaces ── */
  --color-secondary: #F1EEE6;
  --color-secondary-foreground: #16202B;
  --color-muted: #F1EEE6;
  --color-muted-foreground: #6E7A85;
  --color-accent: #E5EDFC;
  --color-accent-foreground: #2A5FD9;

  /* ── Semantic ── */
  --color-destructive: #C13A2B;
  --color-destructive-foreground: #ffffff;
  --color-success: #158060;
  --color-success-foreground: #ffffff;
  --color-warning: #A96A05;
  --color-warning-foreground: #ffffff;

  /* ── Borders & Inputs ── */
  --color-border: #E2DDD1;
  --color-input: #E2DDD1;
  --color-ring: #2A5FD9;

  /* ── Chart Palette ── */
  --color-chart-1: #2A5FD9;
  --color-chart-2: #A96A05;
  --color-chart-3: #158060;
  --color-chart-4: #C13A2B;
  --color-chart-5: #5B41B8;

  /* ── Badge categories (niveles / tipos de clase) ── */
  --color-badge-escuela: #E5EDFC;
  --color-badge-escuela-foreground: #2A5FD9;
  --color-badge-adultos: #E1F0EB;
  --color-badge-adultos-foreground: #0F6E53;
  --color-badge-competicion: #EDE8FA;
  --color-badge-competicion-foreground: #5B41B8;
  --color-badge-particular: #FAEEDC;
  --color-badge-particular-foreground: #9A6206;
  --color-badge-eventos: #FBE7E3;
  --color-badge-eventos-foreground: #B93C2C;

  /* ── Sidebar: Light ── */
  --color-sidebar-background: #FFFFFF;
  --color-sidebar-foreground: #16202B;
  --color-sidebar-primary: #2A5FD9;
  --color-sidebar-primary-foreground: #ffffff;
  --color-sidebar-accent: #F1EEE6;
  --color-sidebar-accent-foreground: #16202B;
  --color-sidebar-border: #E2DDD1;
  --color-sidebar-ring: #2A5FD9;

  /* ── Radius ── */
  --radius-lg: 0.75rem;
  --radius-md: calc(var(--radius-lg) - 2px);
  --radius-sm: calc(var(--radius-lg) - 4px);

  /* ── Shadows ── */
  --shadow-card: 0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.06);
  --shadow-card-hover: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --shadow-header: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-glass: 0 8px 32px 0 rgba(31, 38, 135, 0.07);
}
```

- [ ] **Step 2: Update the base font family and add the `.font-num` utility**

In the same file, find the `@layer base` block:

```css
@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
    font-weight: 700;
  }
}
```

Replace it with:

```css
@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    font-family: 'Archivo', system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    font-family: 'Archivo', system-ui, sans-serif;
    font-weight: 700;
  }
}
```

Then, inside the existing `@layer utilities { ... }` block (do not remove any of its current rules), add this rule right after the opening `@layer utilities {` line:

```css
  .font-num {
    font-family: 'Barlow Condensed', 'Archivo', system-ui, sans-serif;
  }
```

- [ ] **Step 3: Search for other files referencing the old font names or hardcoded old hex colors that must track the rebrand**

Run:

```bash
grep -rn "Plus Jakarta Sans\|font-jakarta\|#0891b2" src --include="*.tsx" --include="*.ts" --include="*.css" -l
```

Expected: this lists files using the old teal hex or the old heading font class outside of `src/index.css` (e.g. `Sidebar.tsx`, `DashboardPage.tsx`, `tailwind` font utility config). Do not edit any file found here yet — Task 2 and Task 3 handle `Sidebar.tsx` and `DashboardPage.tsx` explicitly. Just confirm nothing else outside those two files needs a token update for this phase (Task 1 only touches `index.css`); note anything unexpected for follow-up but do not fix it now (out of scope for Fase 1 per the spec).

- [ ] **Step 4: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds with no TypeScript or Vite errors (Tailwind v4 reads `@theme` tokens at build time; a malformed block would fail the build).

- [ ] **Step 5: Commit**

```bash
git add src/index.css
git commit -m "feat: aplicar paleta y tipografia del rediseno (fase 1)"
```

---

## Task 2: Sidebar — flat navigation + settings flyout

**Files:**
- Modify: `src/components/layout/Sidebar.tsx` (full replacement)

- [ ] **Step 1: Replace the entire file content**

Replace the full contents of `src/components/layout/Sidebar.tsx` with:

```tsx
import { NavLink, useLocation } from 'react-router-dom'
import {
  Home,
  Users,
  GraduationCap,
  CalendarDays,
  CreditCard,
  Trophy,
  Settings,
  ShieldCheck,
  CalendarRange,
  History,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  KeyRound,
  User,
  ClipboardCheck,
  LayoutDashboard,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore, hasPermission } from '@/stores/authStore'
import { useEffectiveStudent } from '@/hooks/usePlayerData'
import { useState } from 'react'
import type { UserRole } from '@/types'
import { ChangePasswordDialog } from '@/components/auth/ChangePasswordDialog'
import { RoleSwitcher } from '@/components/layout/RoleSwitcher'
import { Tooltip } from '@/components/ui/tooltip'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  requiredModule?: string
}

const navItems: NavItem[] = [
  { name: 'Hoy', href: '/', icon: Home },
  { name: 'Personas', href: '/jugadores', icon: Users },
  { name: 'Clases', href: '/agenda', icon: GraduationCap },
  { name: 'Calendario', href: '/agenda', icon: CalendarDays },
  { name: 'Finanzas', href: '/pagos', icon: CreditCard, requiredModule: 'payments' },
  { name: 'Deportivo', href: '/informes-mensuales', icon: Trophy, requiredModule: 'informes_mensuales' },
]

const settingsItems: NavItem[] = [
  { name: 'Configuración', href: '/configuracion', icon: Settings, requiredModule: 'settings' },
  { name: 'Usuarios', href: '/usuarios', icon: ShieldCheck, requiredModule: 'users' },
  { name: 'Temporadas', href: '/temporadas', icon: CalendarRange, requiredModule: 'settings' },
  { name: 'Registro de actividad', href: '/actividad', icon: History, requiredModule: 'settings' },
]

const ROLE_COLORS: Record<string, string> = {
  director: 'from-amber-500 to-amber-600',
  coordinador: 'from-teal-500 to-teal-600',
  entrenador: 'from-emerald-500 to-emerald-600',
  jugador: 'from-blue-500 to-blue-600',
}

interface SidebarProps {
  collapsed: boolean
  onToggleCollapsed: () => void
}

export function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps) {
  const { user, logout } = useAuthStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)

  const isItemActive = (href: string) => {
    if (href === '/') return location.pathname === '/'
    if (location.pathname === href) return true
    return location.pathname.startsWith(`${href}/`)
  }

  const activeRole = user?.activeRole ?? user?.role

  const filterItem = (item: NavItem) => {
    // Jugador y tutor: solo ven el Dashboard (portal)
    if (activeRole === 'jugador' || activeRole === 'tutor') {
      return item.href === '/'
    }

    // Entrenador: módulos permitidos explícitamente
    if (activeRole === 'entrenador') {
      const coachAllowedPaths = ['/', '/jugadores', '/agenda']
      if (!coachAllowedPaths.includes(item.href)) return false
    }

    if (item.requiredModule && activeRole) {
      return hasPermission(activeRole as UserRole, item.requiredModule, 'read')
    }
    return true
  }

  const visibleNavItems = navItems.filter(filterItem)
  const visibleSettingsItems = settingsItems.filter(filterItem)

  const renderNavItem = (item: NavItem, isCollapsed: boolean) => {
    const isActive = isItemActive(item.href)
    const link = (
      <NavLink
        key={item.name}
        to={item.href}
        onClick={() => setMobileOpen(false)}
        aria-label={item.name}
        className={cn(
          'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
          isCollapsed && 'justify-center px-0',
          isActive
            ? 'bg-accent text-primary'
            : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
        )}
      >
        <item.icon
          className={cn(
            'h-[18px] w-[18px] shrink-0 transition-colors duration-150',
            isActive ? 'text-primary' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80'
          )}
        />
        {!isCollapsed && <span className="truncate">{item.name}</span>}
      </NavLink>
    )

    if (!isCollapsed) return link

    return (
      <Tooltip key={item.name} content={item.name} side="right" className="whitespace-nowrap w-auto">
        {link}
      </Tooltip>
    )
  }

  const renderSettingsSection = (isCollapsed: boolean) => {
    if (visibleSettingsItems.length === 0) return null

    if (isCollapsed) {
      return (
        <div className="mb-1 mt-2 border-t border-sidebar-border/60 pt-2">
          {visibleSettingsItems.map((item) => renderNavItem(item, true))}
        </div>
      )
    }

    return (
      <div className="mb-1 mt-2 border-t border-sidebar-border/60 pt-2">
        <button
          onClick={() => setSettingsOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 hover:text-sidebar-foreground/60 transition-colors duration-150"
        >
          <div className="flex items-center gap-2">
            <Settings className="h-3.5 w-3.5" />
            Ajustes
          </div>
          {settingsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        {settingsOpen && (
          <div className="ml-1 mt-0.5 space-y-0.5">
            {visibleSettingsItems.map((item) => renderNavItem(item, false))}
          </div>
        )}
      </div>
    )
  }

  const avatarGradient = ROLE_COLORS[activeRole ?? ''] || 'from-slate-500 to-slate-600'

  const { studentId: effectiveStudentId } = useEffectiveStudent()

  const bottomNavItems = activeRole === 'jugador' || activeRole === 'tutor'
    ? [
        { href: '/', label: 'Inicio', icon: LayoutDashboard },
        { href: '/grupos', label: activeRole === 'tutor' ? 'Clases' : 'Mi Clase', icon: GraduationCap },
        { href: '/pagos', label: activeRole === 'tutor' ? 'Pagos' : 'Mis Pagos', icon: CreditCard },
        { href: effectiveStudentId ? `/jugadores/${effectiveStudentId}` : '/', label: 'Perfil', icon: User },
      ]
    : [
        { href: '/', label: 'Inicio', icon: LayoutDashboard },
        { href: '/grupos', label: 'Clases', icon: GraduationCap },
        { href: '/asistencia', label: 'Asistencia', icon: ClipboardCheck },
      ]

  const renderSidebarContent = (isCollapsed: boolean) => (
    <div className="flex h-full flex-col">
      {/* Logo area */}
      <div className={cn(
        'flex h-20 items-center gap-3 border-b border-sidebar-border/50 shrink-0',
        isCollapsed ? 'justify-center px-2' : 'px-6'
      )}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-sm select-none">
          SJ
        </div>
        {!isCollapsed && (
          <div className="flex flex-col leading-none">
            <span className="text-[16px] font-extrabold text-sidebar-foreground tracking-tight">San Javier</span>
            <span className="text-[10px] text-sidebar-foreground/40 font-bold uppercase tracking-widest mt-0.5">Academy Manager</span>
          </div>
        )}
      </div>

      {/* Collapse toggle — solo en desktop, el drawer movil siempre se renderiza expandido */}
      <button
        onClick={onToggleCollapsed}
        className={cn(
          'hidden lg:flex items-center gap-2 mx-3 mt-3 rounded-lg px-3 py-2 text-xs font-medium text-sidebar-foreground/50 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors duration-150',
          isCollapsed && 'justify-center px-0'
        )}
        title={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
      >
        {isCollapsed ? <PanelLeftOpen className="h-4 w-4 shrink-0" /> : <PanelLeftClose className="h-4 w-4 shrink-0" />}
        {!isCollapsed && <span>Colapsar</span>}
      </button>

      {!isCollapsed && (
        <div className="mx-3 mt-3 flex items-center gap-2 rounded-xl border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 text-sidebar-foreground/40">
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate text-xs">Buscar…</span>
          <kbd className="text-[10px] font-semibold">⌘K</kbd>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {!isCollapsed && (
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
            Navegación
          </div>
        )}
        <div className="space-y-0.5">
          {visibleNavItems.map((item) => renderNavItem(item, isCollapsed))}
        </div>
        {renderSettingsSection(isCollapsed)}
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border shrink-0">
        {!isCollapsed && <RoleSwitcher />}
        <div className={cn('p-4 pt-2', isCollapsed && 'flex flex-col items-center gap-2 px-2')}>
          <div className={cn('flex items-center gap-3', isCollapsed && 'flex-col gap-2')}>
            <div className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br text-white text-sm font-bold shadow-sm shrink-0',
              avatarGradient
            )}>
              {user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-sidebar-foreground truncate leading-tight">
                  {user?.displayName || 'Usuario'}
                </p>
                <p className="text-[11px] text-sidebar-foreground/50 truncate capitalize font-medium">
                  {activeRole ?? 'director'}
                </p>
              </div>
            )}
            <div className={cn('flex items-center gap-1 shrink-0', isCollapsed && 'flex-col')}>
              {!isCollapsed && (
                <button
                  onClick={() => setIsPasswordDialogOpen(true)}
                  className="rounded-xl p-2.5 text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-150 active:scale-95"
                  title="Cambiar contraseña"
                >
                  <KeyRound className="h-5 w-5" />
                </button>
              )}
              <button
                onClick={logout}
                className="rounded-xl p-2.5 text-red-500/70 hover:bg-red-500/10 hover:text-red-500 transition-all duration-150 active:scale-95 ml-1"
                title="Cerrar sesión"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile Bottom Nav — conditional by role */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-slate-200 bg-white px-2 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] lg:hidden">
        {bottomNavItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => cn(
              'flex flex-col items-center justify-center gap-1 px-3 py-2 text-[10px] font-medium transition-colors',
              isActive ? 'text-primary' : 'text-slate-500 hover:text-slate-900'
            )}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
        {/* Botón Menú — solo roles admin/entrenador */}
        {activeRole !== 'jugador' && (
          <button
            onClick={() => setMobileOpen(true)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 px-3 py-2 text-[10px] font-medium transition-colors',
              mobileOpen ? 'text-primary' : 'text-slate-500 hover:text-slate-900'
            )}
          >
            <Menu className="h-5 w-5" />
            <span>Menú</span>
          </button>
        )}
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 z-50 w-72 bg-sidebar-background shadow-2xl animate-in slide-in-from-right-full duration-300">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 z-50 rounded-lg p-1.5 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            {renderSidebarContent(false)}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className={cn(
        'hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:flex-col bg-sidebar-background border-r border-sidebar-border shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-[width] duration-200',
        collapsed ? 'lg:w-[72px]' : 'lg:w-72'
      )}>
        {renderSidebarContent(collapsed)}
      </aside>

      {/* Change Password Dialog */}
      <ChangePasswordDialog
        open={isPasswordDialogOpen}
        onOpenChange={setIsPasswordDialogOpen}
      />
    </>
  )
}
```

- [ ] **Step 2: Verify the app builds and type-checks**

Run: `npm run build`
Expected: succeeds. If TypeScript complains about an unused import, remove that specific import — double check first whether it's genuinely unused in the file above (it shouldn't be, every imported icon is referenced).

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: sidebar plano de 7 items con menu de ajustes secundario"
```

---

## Task 3: "Hoy" dashboard — new topbar, hero KPIs, and 2-column summary

**Files:**
- Modify: `src/pages/DashboardPage.tsx`

This task only changes the **top** of the page (topbar + hero row + a new 2-column summary). Nothing below it is deleted — the existing coach-specific section, the old configurable KPI row, charts, and the KPI config dialog all stay exactly as they are today, just pushed further down the page. Two existing cards (the "Tu Agenda Hoy" card and the `SmartAlertsPanel`/`IntelligenceCards` row) are **moved** into the new 2-column summary instead of being duplicated — remove them from their old location as part of this task.

- [ ] **Step 1: Update imports and chart color tokens**

Find this block near the top of the file:

```tsx
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/shared/StatCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ActivityFeed } from '@/components/shared/ActivityFeed'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
```

Replace it with:

```tsx
import { StatCard } from '@/components/shared/StatCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ActivityFeed } from '@/components/shared/ActivityFeed'
import { NotificationBell } from '@/components/shared/NotificationBell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
```

(`Header` is no longer used on this page — Task scope keeps `Header.tsx` itself untouched since it's shared by every other page; `DashboardPage` now builds its own topbar instead of using it. `NotificationBell` is imported directly so the new topbar can reuse the existing notification logic instead of rebuilding it.)

Find the icon import list:

```tsx
import {
  Users,
  DollarSign,
  AlertCircle,
  GraduationCap,
  Clock,
  TrendingUp,
  CalendarDays,
  CalendarCheck,
  Activity,
  Settings as SettingsIcon,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  UserMinus,
  CheckCircle2,
  ChevronRight,
  Phone,
  Trophy,
  MapPin,
  Bell,
} from 'lucide-react'
```

Replace it with (adds `Search` and `Plus`, drops the never-used `Phone` and `MapPin`):

```tsx
import {
  Users,
  DollarSign,
  AlertCircle,
  GraduationCap,
  Clock,
  TrendingUp,
  CalendarDays,
  CalendarCheck,
  Activity,
  Settings as SettingsIcon,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  UserMinus,
  CheckCircle2,
  ChevronRight,
  Trophy,
  Bell,
  Search,
  Plus,
} from 'lucide-react'
```

Find the `CHART_COLORS` constant:

```tsx
const CHART_COLORS = {
  primary: '#0891b2',
  secondary: '#f59e0b',
  success: '#10b981',
  danger: '#ef4444',
  grid: '#f1f5f9',
  tooltip: { background: '#ffffff', border: '#e2e8f0' },
}
```

Replace it with:

```tsx
const CHART_COLORS = {
  primary: '#2A5FD9',
  secondary: '#A96A05',
  success: '#158060',
  danger: '#C13A2B',
  grid: '#F1EEE6',
  tooltip: { background: '#FFFFFF', border: '#E2DDD1' },
}
```

- [ ] **Step 2: Run build to confirm the import/token changes alone are clean**

Run: `npm run build`
Expected: fails with unused-variable errors for `MapPin`/`Phone` only if they were still referenced elsewhere in the file — check the build output. If it fails for any other reason, stop and re-read the error before continuing (don't proceed to Step 3 with a broken baseline).

- [ ] **Step 3: Add the new computed values for the hero KPI row**

Find this block (the `today`/`todayGroups` computation):

```tsx
  const today = now.getDay()
  const todayGroups = groups.filter(
    (g) => isGroupCurrentlyActive(g, now) && g.schedule.some((s) => s.dayOfWeek === today) && (!isCoach || g.coachId === currentCoachId)
  )

  const coachClassesToday = useMemo(() => {
    if (!currentCoachId) return 0
    return todayGroups.filter(g => g.coachId === currentCoachId).length
  }, [currentCoachId, todayGroups])
```

Right after it (still before `// ── Occupancy calculation`), insert:

```tsx
  const classesInProgress = useMemo(() => {
    return todayGroups.filter((g) => {
      const slot = g.schedule.find((s) => s.dayOfWeek === today)
      if (!slot) return false
      const [startH, startM] = slot.startTime.split(':').map(Number)
      const [endH, endM] = slot.endTime.split(':').map(Number)
      const start = new Date(now)
      start.setHours(startH, startM, 0, 0)
      const end = new Date(now)
      end.setHours(endH, endM, 0, 0)
      return now >= start && now <= end
    }).length
  }, [todayGroups, today])

  const netPlayerChange = altasEsteMes - bajasEsteMes

  const weekAttendanceStats = useMemo(() => {
    const rangeRate = (start: Date, end: Date) => {
      let present = 0
      let total = 0
      for (const record of attendance) {
        const recordDate = new Date(record.date)
        if (recordDate < start || recordDate > end) continue
        for (const entry of record.records) {
          total++
          if (entry.status === 'presente') present++
        }
      }
      return total > 0 ? Math.round((present / total) * 100) : 0
    }

    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() + mondayOffset)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    const prevWeekStart = new Date(weekStart)
    prevWeekStart.setDate(weekStart.getDate() - 7)
    const prevWeekEnd = new Date(weekEnd)
    prevWeekEnd.setDate(weekEnd.getDate() - 7)

    const current = rangeRate(weekStart, weekEnd)
    const previous = rangeRate(prevWeekStart, prevWeekEnd)
    return { current, diff: current - previous }
  }, [attendance, now])

  const pendingPlayersCount = useMemo(() => {
    return new Set(
      currentMonthAllPayments.filter((p) => p.status === 'pendiente').map((p) => p.playerId)
    ).size
  }, [currentMonthAllPayments])
```

`altasEsteMes` and `bajasEsteMes` are already computed above this point in the file (the "altas/bajas este mes" block); `currentMonthAllPayments` and `currentPending`/`currentRevenue`/`collectionRate` are already computed further below — this insertion point sits between the two, so `netPlayerChange` and `weekAttendanceStats` compile immediately, and `pendingPlayersCount` (which depends on `currentMonthAllPayments`) will compile once Step 3 is saved, since `currentMonthAllPayments` is declared earlier in the file (around the `allPayments`/`currentMonthAllPayments` block) — confirm this by checking that `currentMonthAllPayments` appears above line ~286 and this insertion is below `todayGroups` (~line 386), which it is.

- [ ] **Step 4: Verify build after adding the new calculations**

Run: `npm run build`
Expected: succeeds (these are pure additions, nothing yet references them).

- [ ] **Step 5: Replace the `<Header ... />` call with the new topbar**

Find:

```tsx
  return (
    <div>
      <Header
        title={`Hola, ${user?.displayName?.split(' ')[0] || 'Director'} 👋`}
        subtitle={`Resumen de hoy · ${now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}`}
        actions={
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowKpiDialog(true)}
            title="Configurar KPIs"
            className="rounded-xl text-muted-foreground hover:text-foreground"
          >
            <SettingsIcon className="h-5 w-5" />
          </Button>
        }
      />
```

Replace it with:

```tsx
  return (
    <div>
      <div className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="flex flex-wrap items-center gap-4 px-5 py-5 lg:px-8">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">HOY</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar jugador, grupo, pago…"
                className="h-10 w-64 rounded-xl border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <NotificationBell />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/agenda')}
              title="Ir a la agenda"
              className="rounded-xl text-muted-foreground hover:text-foreground"
            >
              <CalendarDays className="h-5 w-5" />
            </Button>
            <Button
              className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => navigate('/jugadores')}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Nuevo jugador
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowKpiDialog(true)}
              title="Configurar KPIs"
              className="rounded-xl text-muted-foreground hover:text-foreground"
            >
              <SettingsIcon className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
```

Note: the search input is visual-only in this phase (no filtering wired up yet, matching the spec's "Acción rápida ⌘K es solo visual" precedent) — do not add an `onChange` handler or state for it.

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: succeeds. `navigate` is already defined earlier in the component (`const navigate = useNavigate()`), so no new import is needed for it.

- [ ] **Step 7: Insert the fixed 4-KPI hero row and new 2-column summary**

Find the start of the coach-first section:

```tsx
      {/* Coach-First Interface - Only for Coaches */}
      {isCoach && (
```

Insert this new block immediately **before** that line (after the closing `</div>` of the topbar you just added in Step 5, and before the `{/* Coach-First Interface`comment):

```tsx
      <div className="px-5 pt-5 lg:px-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            title="Jugadores activos"
            value={activePlayers}
            icon={Users}
            description={`${netPlayerChange >= 0 ? '+' : ''}${netPlayerChange} este mes`}
            iconClassName="bg-accent text-primary"
            accentColor="#2A5FD9"
          />
          <StatCard
            title="Clases hoy"
            value={todayGroups.length}
            icon={CalendarDays}
            description={`${classesInProgress} en curso`}
            iconClassName="bg-accent text-primary"
            accentColor="#2A5FD9"
          />
          <StatCard
            title="Asistencia media"
            value={`${weekAttendanceStats.current}%`}
            icon={CheckCircle2}
            description={`${weekAttendanceStats.diff >= 0 ? '+' : ''}${weekAttendanceStats.diff} pts vs. semana`}
            iconClassName="bg-accent text-primary"
            accentColor="#2A5FD9"
          />
          {isAdmin && (
            <StatCard
              title="Pendiente de cobro"
              value={formatCurrency(currentPending)}
              icon={AlertCircle}
              description={`${pendingPlayersCount} jugadores`}
              iconClassName="bg-accent text-primary"
              accentColor="#2A5FD9"
            />
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="grid grid-cols-1 gap-5 px-5 pt-5 lg:grid-cols-2 lg:px-8">
          <div className="space-y-5">
            <div>
              <h2 className="mb-3 text-sm font-bold text-foreground">Indicadores del club</h2>
              <IntelligenceCards classReviews={classReviewsData} />
            </div>
            <Card className="border-border/60 shadow-[var(--shadow-card)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-foreground">Cobros del mes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Cobrado</span>
                  <span className="font-num text-lg font-bold text-foreground">{formatCurrency(currentRevenue)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Pendiente</span>
                  <span className="font-num text-lg font-bold text-foreground">{formatCurrency(currentPending)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Ratio de cobro</span>
                  <span className="font-num text-lg font-bold text-foreground">{collectionRate}%</span>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-5">
            <div>
              <h2 className="mb-3 text-sm font-bold text-foreground">Clases de hoy</h2>
              <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
                <CardContent className="px-6 py-6">
                  {todayGroups.length === 0 ? (
                    <div className="text-center py-8">
                      <CalendarDays className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                      <p className="text-sm text-slate-400 font-medium">Libre hoy</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {todayGroups
                        .sort((a, b) => {
                          const aTime = a.schedule.find((s) => s.dayOfWeek === today)?.startTime || ''
                          const bTime = b.schedule.find((s) => s.dayOfWeek === today)?.startTime || ''
                          return aTime.localeCompare(bTime)
                        })
                        .map((group) => {
                          const slot = group.schedule.find((s) => s.dayOfWeek === today)!
                          const isNext = activeClass?.id === group.id

                          return (
                            <div key={group.id} className={cn(
                              "flex items-center gap-4 rounded-2xl p-4 transition-all duration-150 border-2",
                              isNext
                                ? "bg-emerald-50/50 border-emerald-100 shadow-sm"
                                : "bg-slate-50/30 border-transparent hover:border-slate-100"
                            )}>
                              <div className="text-center shrink-0 w-12">
                                <span className={cn(
                                  "text-xs font-black block",
                                  isNext ? "text-emerald-600" : "text-slate-400"
                                )}>
                                  {slot.startTime}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className={cn(
                                  "text-sm font-bold truncate",
                                  isNext ? "text-emerald-900" : "text-slate-700"
                                )}>
                                  {group.name}
                                </h4>
                                <p className="text-[11px] text-slate-400 font-medium truncate">
                                  {group.courtName} · {group.currentEnrollment} alumnos
                                </p>
                              </div>
                              {isNext && (
                                <ChevronRight className="h-4 w-4 text-emerald-400 shrink-0" />
                              )}
                            </div>
                          )
                        })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            <div>
              <h2 className="mb-3 text-sm font-bold text-foreground">Atención requerida</h2>
              <SmartAlertsPanel />
            </div>
          </div>
        </div>
      )}

```

- [ ] **Step 8: Remove the now-duplicated `SmartAlertsPanel`/`IntelligenceCards` block further down the page**

Find (still inside the `<div className="p-5 lg:p-6 ...">` body, after the old KPI row):

```tsx
        {/* ── Alertas inteligentes + Inteligencia del Club ────────── */}
        {isAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            <SmartAlertsPanel />
            <IntelligenceCards classReviews={classReviewsData} />
          </div>
        )}

```

Delete this whole block — both components now render once, inside the new 2-column summary added in Step 7.

- [ ] **Step 9: Remove the now-duplicated "Tu Agenda Hoy" card from the bottom row**

Find the "Bottom row" section:

```tsx
        {/* ── Bottom row ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Activity feed */}
          <Card className="border-border/60 shadow-[var(--shadow-card)] flex flex-col min-h-[460px]">
            <ActivityFeed activities={visibleActivities} canReadPayments={canReadPayments} />
          </Card>

          {/* Today's schedule - Redesigned for Coach View */}
          <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
            <CardHeader className="px-6 pt-6 pb-3">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Tu Agenda Hoy</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              {todayGroups.length === 0 ? (
                <div className="text-center py-8">
                  <CalendarDays className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400 font-medium">Libre hoy</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {todayGroups
                    .sort((a, b) => {
                      const aTime = a.schedule.find((s) => s.dayOfWeek === today)?.startTime || ''
                      const bTime = b.schedule.find((s) => s.dayOfWeek === today)?.startTime || ''
                      return aTime.localeCompare(bTime)
                    })
                    .map((group) => {
                      const slot = group.schedule.find((s) => s.dayOfWeek === today)!
                      const isNext = activeClass?.id === group.id
                      
                      return (
                        <div key={group.id} className={cn(
                          "flex items-center gap-4 rounded-2xl p-4 transition-all duration-150 border-2",
                          isNext 
                            ? "bg-emerald-50/50 border-emerald-100 shadow-sm" 
                            : "bg-slate-50/30 border-transparent hover:border-slate-100"
                        )}>
                          <div className="text-center shrink-0 w-12">
                            <span className={cn(
                              "text-xs font-black block",
                              isNext ? "text-emerald-600" : "text-slate-400"
                            )}>
                              {slot.startTime}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className={cn(
                              "text-sm font-bold truncate",
                              isNext ? "text-emerald-900" : "text-slate-700"
                            )}>
                              {group.name}
                            </h4>
                            <p className="text-[11px] text-slate-400 font-medium truncate">
                              {group.courtName} · {group.currentEnrollment} alumnos
                            </p>
                          </div>
                          {isNext && (
                            <ChevronRight className="h-4 w-4 text-emerald-400 shrink-0" />
                          )}
                        </div>
                      )
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
```

Replace it with (keeps `ActivityFeed` alone, full width, removes the duplicated schedule card):

```tsx
        {/* ── Activity feed ────────────────────────────────────── */}
        <Card className="border-border/60 shadow-[var(--shadow-card)] flex flex-col min-h-[460px]">
          <ActivityFeed activities={visibleActivities} canReadPayments={canReadPayments} />
        </Card>
```

- [ ] **Step 10: Verify build**

Run: `npm run build`
Expected: succeeds with no unused-variable or unused-import errors. If `StatusBadge` or any other previously-used import is now reported unused, check whether Steps 8–9 removed its only usage; if so, remove that specific import line (do not remove imports still used elsewhere in the file).

- [ ] **Step 11: Commit**

```bash
git add src/pages/DashboardPage.tsx
git commit -m "feat: nueva cabecera, KPIs fijos y resumen de dos columnas en Hoy"
```

---

## Task 4: Visual verification against the mockups

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (leave it running; default port is 5173 per `CLAUDE.md`)

- [ ] **Step 2: Log in and open the dashboard**

Open `http://localhost:5173` in a browser, log in as a `director` or `coordinador` user (see `CLAUDE.md` for the seeded director account), and land on `/`.

- [ ] **Step 3: Compare against the mockup**

Open `san javier.pen` in the pen.dev app (already open per this project's earlier session) and compare the running page against:
- Node `Fl6o0` ("Sidebar") for the sidebar: 6 flat nav items with no group labels, light background, blue active-item highlight, "SJ" logo badge, search box with "⌘K", settings items are NOT visible in the mockup itself (they were an addition agreed with the user) — confirm they appear correctly in a collapsible "Ajustes" section instead.
- Node `p2DVS` ("01 · Hoy") for the dashboard: topbar with title/date/search/notification/calendar/primary-button, 4-card KPI row, 2-column body underneath.

Check specifically:
- No layout is broken, collapsed, or overflowing at both desktop width and a narrower (tablet) width.
- The 4 KPI cards show real numbers (not `NaN`, `undefined`, or `0` where real data exists in the seeded/dev dataset).
- Clicking each of the 6 sidebar nav items navigates to its provisional destination without a blank page or router error.
- The "Ajustes" flyout expands and its items are reachable.
- Existing lower content (old KPI config dialog via the gear icon, charts, activity feed) still renders and the "Configurar KPIs" dialog still opens/saves correctly.

- [ ] **Step 4: Fix any visual or functional issue found in Step 3 directly in `Sidebar.tsx` or `DashboardPage.tsx`, then re-run `npm run build` and re-check in the browser before moving on.**

- [ ] **Step 5: Stop the dev server once verified.**

---

## Self-review notes

- Every task ends with a `npm run build` check because this codebase has no component/visual test suite (`vitest` exists but no test files use it for UI); `CLAUDE.md` explicitly calls for a real browser check on frontend changes, which Task 4 covers.
- Nothing from the existing `DashboardPage.tsx` feature set is deleted: the coach-specific section, the old configurable KPI row + "Configurar KPIs" dialog, the attendance/level/evolution/financial charts, and `ActivityFeed` all remain, just below the new mockup-matching summary. `SmartAlertsPanel`, `IntelligenceCards`, and the "today's schedule" card are relocated (not duplicated) into the new 2-column summary.
- The `Calendario` and `Clases` sidebar items intentionally both point to `/agenda` for now (approved by the user as a temporary merge) — this means both can appear highlighted at once when on `/agenda`; this is a known, accepted quirk until each gets its own tabbed phase.
- `Usuarios` appears only in the new "Ajustes" flyout for this phase, even though the long-term mapping puts it under "Personas" — noted in the design spec as a deliberate temporary placement.
