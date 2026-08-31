import { useState, useMemo } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useDataStore } from '@/stores/dataStore'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { SeasonSwitcher } from '@/components/layout/SeasonSwitcher'
import { ChevronDown, type LucideIcon } from 'lucide-react'

interface ClasesTab {
  name: string
  href: string
  count?: number
}

export type ClasesPrimaryAction =
  | { label: string; icon?: LucideIcon; onClick: () => void }
  | { label: string; icon?: LucideIcon; items: { label: string; icon?: LucideIcon; onClick: () => void }[] }

export interface ClasesOutletContext {
  setPrimaryAction: (action: ClasesPrimaryAction | null) => void
}

export function ClasesLayout() {
  const location = useLocation()
  const { groups, events, privateLessons } = useDataStore()

  const [primaryAction, setPrimaryAction] = useState<ClasesPrimaryAction | null>(null)

  // No se limpia `primaryAction` aquí a propósito — mismo motivo que en
  // PersonasLayout: el cleanup de la página saliente ya lo hace, y limpiarlo
  // aquí también lo borraría después de que la página entrante lo registre
  // (el efecto del hijo se ejecuta antes que el del padre en el mismo commit).

  const tabs: ClasesTab[] = [
    { name: 'Parrilla', href: '/clases/parrilla' },
    { name: 'Grupos', href: '/clases/grupos', count: groups.filter((g) => g.isActive).length },
    { name: 'Asistencia', href: '/clases/asistencia' },
    { name: 'Particulares', href: '/clases/particulares', count: privateLessons.length },
    { name: 'Eventos', href: '/clases/eventos', count: events.filter((e) => e.isActive).length },
    { name: 'Metodología', href: '/clases/metodologia' },
  ]

  const subtitle = useMemo(() => {
    if (location.pathname === '/clases/grupos') {
      const active = groups.filter((g) => g.isActive).length
      return `${active} activos · ${groups.length} total`
    }
    if (location.pathname === '/clases/particulares') {
      return `${privateLessons.length} clases particulares`
    }
    if (location.pathname === '/clases/eventos') {
      const activeEvents = events.filter((e) => e.isActive).length
      return `${activeEvents} eventos`
    }
    if (location.pathname === '/clases/asistencia') {
      return 'Registro de asistencia de los grupos'
    }
    if (location.pathname === '/clases/parrilla') {
      return 'Vista diaria de pistas y horarios'
    }
    return undefined
  }, [location.pathname, groups, events, privateLessons])

  const outletContext = useMemo(
    () => ({ setPrimaryAction } satisfies ClasesOutletContext),
    [setPrimaryAction]
  )

  return (
    <div>
      <div className="border-b border-border bg-card">
        <div className="flex flex-wrap items-center gap-4 px-5 py-5 lg:px-8">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">CLASES</h1>
            {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            <SeasonSwitcher />
            {primaryAction && (
              'items' in primaryAction ? (
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
        {tabs.map((tab) => {
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
              {tab.count !== undefined && (
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
                  isActive ? 'bg-accent text-primary' : 'bg-secondary text-muted-foreground'
                )}>
                  {tab.count}
                </span>
              )}
            </NavLink>
          )
        })}
      </div>
      <Outlet context={outletContext} />
    </div>
  )
}
