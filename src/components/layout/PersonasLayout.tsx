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
