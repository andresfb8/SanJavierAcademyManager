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
  Map,
  KeyRound,
  BarChart3,
  User,
  TrendingUp,
  CalendarRange,
  Euro,
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
      { name: 'Evaluaciones', href: '/informes', icon: FileText, requiredModule: 'settings' },
      { name: 'Informes Mensuales', href: '/informes-mensuales', icon: BarChart3, requiredModule: 'informes_mensuales' },
      { name: 'Metodología', href: '/methodology', icon: BookOpen, requiredModule: 'settings' },
      { name: 'Planificación', href: '/planificacion', icon: Map, requiredModule: 'settings' },
      { name: 'Analítica', href: '/analitica', icon: TrendingUp, requiredModule: 'settings' },
    ],
  },
  {
    label: 'Financiera',
    items: [
      { name: 'Pagos', href: '/pagos', icon: CreditCard, requiredModule: 'payments' },
      { name: 'Facturas', href: '/facturas', icon: Receipt, requiredModule: 'payments' },
      { name: 'Beneficios y Gastos', href: '/finanzas', icon: BarChart3, requiredModule: 'informes_mensuales' },
      { name: 'Análisis Financiero', href: '/finanzas-analitica', icon: Euro, requiredModule: 'informes_mensuales' },
    ],
  },
  {
    label: 'Configuración',
    items: [
      { name: 'Configuración', href: '/configuracion', icon: Settings, requiredModule: 'settings' },
      { name: 'Registro de actividad', href: '/actividad', icon: History, requiredModule: 'settings' },
      { name: 'Temporadas', href: '/temporadas', icon: CalendarRange, requiredModule: 'settings' },
      { name: 'Usuarios', href: '/usuarios', icon: ShieldCheck, requiredModule: 'users' },
    ],
  },
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
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  const isItemActive = (href: string) => {
    if (href === '/') return location.pathname === '/'
    if (location.pathname === href) return true
    return location.pathname.startsWith(`${href}/`)
  }

  const isGroupActive = (items: NavItem[]) =>
    items.some((item) => isItemActive(item.href))

  const filterItem = (item: NavItem) => {
    const activeRole = user?.activeRole ?? user?.role

    // Jugador y tutor: solo ven el Dashboard (portal)
    if (activeRole === 'jugador' || activeRole === 'tutor') {
      return item.href === '/'
    }

    // Entrenador: módulos permitidos explícitamente
    if (activeRole === 'entrenador') {
      const coachAllowedPaths = [
        '/',
        '/jugadores',
        '/grupos',
        '/asistencia',
        '/agenda',
        '/eventos',
        '/informes',
        '/methodology',
        '/planificacion'
      ]
      if (!coachAllowedPaths.includes(item.href)) return false
    }

    if (item.requiredModule && activeRole) {
      return hasPermission(activeRole as UserRole, item.requiredModule, 'read')
    }
    return true
  }

  const renderNavItem = (item: NavItem, isCollapsed: boolean) => {
    const isActive = isItemActive(item.href)
    const link = (
      <NavLink
        key={item.name}
        to={item.href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
          isCollapsed && 'justify-center px-0',
          isActive
            ? 'bg-primary text-white shadow-md'
            : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
        )}
      >
        <item.icon
          className={cn(
            'h-[18px] w-[18px] shrink-0 transition-colors duration-150',
            isActive ? 'text-white' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80'
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

  const renderGroup = (group: NavGroup, index: number, isCollapsed: boolean) => {
    const visibleItems = group.items.filter(filterItem)
    if (visibleItems.length === 0) return null

    if (!group.label) {
      return (
        <div key={index} className="mb-1">
          {visibleItems.map((item) => renderNavItem(item, isCollapsed))}
        </div>
      )
    }

    if (isCollapsed) {
      // En modo icono no caben las etiquetas de grupo: se listan los iconos sin separador,
      // ignorando collapsedGroups (que solo aplica al sidebar expandido).
      return (
        <div key={group.label} className="mb-1">
          {visibleItems.map((item) => renderNavItem(item, true))}
        </div>
      )
    }

    const isGroupCollapsedState = collapsedGroups[group.label] ?? false
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
          {isGroupCollapsedState ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>
        {!isGroupCollapsedState && (
          <div className="ml-1 mt-0.5 space-y-0.5">
            {visibleItems.map((item) => renderNavItem(item, false))}
          </div>
        )}
      </div>
    )
  }

  const avatarGradient = ROLE_COLORS[user?.activeRole ?? user?.role ?? ''] || 'from-slate-500 to-slate-600'

  // Bottom Nav items depending on active role
  const activeRole = user?.activeRole ?? user?.role
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
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sidebar-primary to-cyan-600 text-sidebar-primary-foreground font-black text-lg select-none shadow-lg shadow-sidebar-primary/20">
          🎾
        </div>
        {!isCollapsed && (
          <div className="flex flex-col leading-none">
            <span className="text-[16px] font-extrabold text-sidebar-foreground tracking-tight font-jakarta">San Javier</span>
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

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navGroups.map((group, index) => renderGroup(group, index, isCollapsed))}
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
                  {user?.activeRole ?? user?.role ?? 'director'}
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
        'hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:flex-col bg-sidebar-background border-r border-slate-100 shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-[width] duration-200',
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
