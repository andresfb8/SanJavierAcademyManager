import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  UserCog,
  Calendar,
  Settings,
  BookOpen,
  ShieldCheck,
  FileText,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  CalendarPlus,
  History,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore, hasPermission } from '@/stores/authStore'
import { useState } from 'react'
import type { UserRole } from '@/types'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  requiredModule?: string
}

interface NavGroup {
  label?: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    // Dashboard - sin grupo, siempre visible
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Administración',
    items: [
      { name: 'Jugadores', href: '/jugadores', icon: Users },
      { name: 'Grupos', href: '/grupos', icon: GraduationCap },
      { name: 'Asistencia', href: '/asistencia', icon: ClipboardCheck },
      { name: 'Agenda', href: '/agenda', icon: Calendar },
      { name: 'Eventos y Actividades', href: '/eventos', icon: CalendarPlus },
      { name: 'Personal', href: '/entrenadores', icon: UserCog, requiredModule: 'coaches' },
      { name: 'Informes', href: '/informes', icon: FileText, requiredModule: 'informes' },
      { name: 'Planificación', href: '/planificacion', icon: BookOpen },
    ],
  },
  {
    label: 'Financiera',
    items: [
      { name: 'Pagos', href: '/pagos', icon: CreditCard, requiredModule: 'payments' },
    ],
  },
  {
    label: 'Configuración',
    items: [
      { name: 'Configuración', href: '/configuracion', icon: Settings, requiredModule: 'settings' },
      { name: 'Registro de actividad', href: '/actividad', icon: History, requiredModule: 'settings' },
      { name: 'Usuarios', href: '/usuarios', icon: ShieldCheck, requiredModule: 'users' },
    ],
  },
]

export function Sidebar() {
  const { user, logout } = useAuthStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  const isItemActive = (href: string) =>
    href === '/' ? location.pathname === '/' : location.pathname.startsWith(href)

  const isGroupActive = (items: NavItem[]) =>
    items.some((item) => isItemActive(item.href))

  const filterItem = (item: NavItem) => {
    if (item.requiredModule && user?.role) {
      return hasPermission(user.role as UserRole, item.requiredModule, 'read')
    }
    return true
  }

  const renderNavItem = (item: NavItem) => {
    const isActive = isItemActive(item.href)
    return (
      <NavLink
        key={item.name}
        to={item.href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-sidebar-accent text-sidebar-primary'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
        )}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        {item.name}
      </NavLink>
    )
  }

  const renderGroup = (group: NavGroup, index: number) => {
    const visibleItems = group.items.filter(filterItem)
    if (visibleItems.length === 0) return null

    // Grupo sin label (Dashboard) - renderizar items directamente
    if (!group.label) {
      return (
        <div key={index}>
          {visibleItems.map(renderNavItem)}
        </div>
      )
    }

    const isCollapsed = collapsedGroups[group.label] ?? false
    const groupActive = isGroupActive(visibleItems)

    return (
      <div key={group.label}>
        <button
          onClick={() => toggleGroup(group.label!)}
          className={cn(
            'flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors',
            groupActive
              ? 'text-sidebar-foreground'
              : 'text-sidebar-foreground/50 hover:text-sidebar-foreground/70'
          )}
        >
          {group.label}
          {isCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
        {!isCollapsed && (
          <div className="ml-1 space-y-0.5">
            {visibleItems.map(renderNavItem)}
          </div>
        )}
      </div>
    )
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-6 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm">
          SJ
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-sidebar-foreground">San Javier</span>
          <span className="text-xs text-sidebar-accent-foreground/70">Academy Manager</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-3 px-3 py-4 overflow-y-auto">
        {navGroups.map(renderGroup)}
      </nav>

      {/* User */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-foreground text-sm font-medium">
            {user?.displayName?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user?.displayName || 'Usuario'}
            </p>
            <p className="text-xs text-sidebar-foreground/50 truncate capitalize">
              {user?.role || 'director'}
            </p>
          </div>
          <button
            onClick={logout}
            className="rounded-lg p-2 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-40 rounded-lg bg-sidebar-background p-2 text-sidebar-foreground shadow-lg lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 w-64 bg-sidebar-background">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1 text-sidebar-foreground/50 hover:text-sidebar-foreground"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col bg-sidebar-background">
        {sidebarContent}
      </aside>
    </>
  )
}
