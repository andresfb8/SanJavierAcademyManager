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
  { name: 'Personas', href: '/personas/jugadores', icon: Users },
  { name: 'Clases', href: '/clases/parrilla', icon: GraduationCap },
  { name: 'Calendario', href: '/clases/parrilla', icon: CalendarDays },
  { name: 'Finanzas', href: '/pagos', icon: CreditCard, requiredModule: 'payments' },
  { name: 'Deportivo', href: '/informes-mensuales', icon: Trophy, requiredModule: 'informes_mensuales' },
]

const settingsItems: NavItem[] = [
  { name: 'Configuración', href: '/configuracion', icon: Settings, requiredModule: 'settings' },
  { name: 'Usuarios', href: '/usuarios', icon: ShieldCheck, requiredModule: 'users' },
  { name: 'Temporadas', href: '/temporadas', icon: CalendarRange, requiredModule: 'settings' },
  { name: 'Registro de actividad', href: '/actividad', icon: History, requiredModule: 'settings' },
]

const coachSettingsItems: NavItem[] = [
  { name: 'Grupos', href: '/clases/grupos', icon: GraduationCap },
  { name: 'Asistencia', href: '/clases/asistencia', icon: ClipboardCheck },
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
      const coachAllowedPaths = [
        '/', '/personas/jugadores',
        '/clases/parrilla', '/clases/grupos', '/clases/asistencia',
        '/clases/particulares', '/clases/eventos', '/clases/metodologia',
      ]
      if (!coachAllowedPaths.includes(item.href)) return false
    }

    if (item.requiredModule && activeRole) {
      return hasPermission(activeRole as UserRole, item.requiredModule, 'read')
    }
    return true
  }

  const visibleNavItems = navItems.filter(filterItem)
  const visibleSettingsItems = (activeRole === 'entrenador' ? coachSettingsItems : settingsItems).filter(filterItem)

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
