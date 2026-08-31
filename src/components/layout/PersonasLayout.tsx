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
