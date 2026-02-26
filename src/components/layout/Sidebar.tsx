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
  Receipt,
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
      { name: 'Metodología', href: '/methodology', icon: BookOpen, requiredModule: 'settings' },
      { name: 'Planificación', href: '/planificacion', icon: BookOpen, requiredModule: 'settings' },
    ],
  },
  {
    label: 'Financiera',
    items: [
      { name: 'Pagos', href: '/pagos', icon: CreditCard, requiredModule: 'payments' },
      { name: 'Facturas', href: '/facturas', icon: Receipt, requiredModule: 'payments' },
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

const ROLE_COLORS: Record<string, string> = {
  director: 'from-amber-500 to-amber-600',
  coordinador: 'from-teal-500 to-teal-600',
  entrenador: 'from-emerald-500 to-emerald-600',
}

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
          'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
          isActive
            ? 'bg-sidebar-accent text-sidebar-primary'
            : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
        )}
      >
        {/* Active left-border indicator */}
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-sidebar-primary" />
        )}
        <item.icon
          className={cn(
            'h-[18px] w-[18px] shrink-0 transition-colors duration-150',
            isActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80'
          )}
        />
        <span className="truncate">{item.name}</span>
      </NavLink>
    )
  }

  const renderGroup = (group: NavGroup, index: number) => {
    const visibleItems = group.items.filter(filterItem)
    if (visibleItems.length === 0) return null

    if (!group.label) {
      return (
        <div key={index} className="mb-1">
          {visibleItems.map(renderNavItem)}
        </div>
      )
    }

    const isCollapsed = collapsedGroups[group.label] ?? false
    const groupActive = isGroupActive(visibleItems)

    return (
      <div key={group.label} className="mb-1">
        <button
          onClick={() => toggleGroup(group.label!)}
          className={cn(
            'flex w-full items-center justify-between rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-widest transition-colors duration-150',
            groupActive
              ? 'text-sidebar-foreground/90'
              : 'text-sidebar-foreground/40 hover:text-sidebar-foreground/60'
          )}
        >
          <div className="flex items-center gap-2">
            <span className={cn('h-1.5 w-1.5 rounded-full', groupActive ? 'bg-sidebar-primary' : 'bg-sidebar-foreground/30')} />
            {group.label}
          </div>
          {isCollapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>
        {!isCollapsed && (
          <div className="ml-1 mt-0.5 space-y-0.5">
            {visibleItems.map(renderNavItem)}
          </div>
        )}
      </div>
    )
  }

  const avatarGradient = ROLE_COLORS[user?.role || ''] || 'from-slate-500 to-slate-600'

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo area */}
      <div className="flex h-16 items-center gap-3 px-5 border-b border-sidebar-border shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground font-black text-base select-none shadow-sm">
          🎾
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[15px] font-bold text-sidebar-foreground tracking-tight">San Javier</span>
          <span className="text-[11px] text-sidebar-foreground/50 font-medium tracking-wide">Academy Manager</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navGroups.map(renderGroup)}
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border p-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br text-white text-sm font-bold shadow-sm shrink-0',
            avatarGradient
          )}>
            {user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground truncate leading-tight">
              {user?.displayName || 'Usuario'}
            </p>
            <p className="text-[11px] text-sidebar-foreground/50 truncate capitalize font-medium">
              {user?.role || 'director'}
            </p>
          </div>
          <button
            onClick={logout}
            className="rounded-lg p-2 text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-150 shrink-0"
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
        className="fixed top-4 left-4 z-40 rounded-xl bg-sidebar-background p-2.5 text-sidebar-foreground shadow-lg lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-72 bg-sidebar-background animate-slide-in-left">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-72 lg:flex-col bg-sidebar-background">
        {sidebarContent}
      </aside>
    </>
  )
}
