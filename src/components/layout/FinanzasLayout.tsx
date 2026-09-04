import { useState, useMemo } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useDataStore } from '@/stores/dataStore'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { Select } from '@/components/ui/select'
import { NotificationBell } from '@/components/shared/NotificationBell'
import { MONTHS } from '@/constants'
import { ChevronDown, CalendarDays } from 'lucide-react'
import type { PrimaryAction } from '@/components/layout/topbar-types'

interface FinanzasTab {
  name: string
  href: string
  count?: number
}

export interface FinanzasOutletContext {
  setPrimaryAction: (action: PrimaryAction | null) => void
  selectedMonth: number
  selectedYear: number
}

export function FinanzasLayout() {
  const location = useLocation()
  const { payments, invoices, club, seasons } = useDataStore()

  const [primaryAction, setPrimaryAction] = useState<PrimaryAction | null>(null)
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())

  const isResumen = location.pathname === '/finanzas/resumen'
  const isPagos = location.pathname === '/finanzas/pagos'

  const activeSeason = club ? seasons.find((s) => s.id === club.activeSeasonId) : undefined

  const inActiveSeason = (date: Date | string) => {
    if (!activeSeason) return true
    const d = date instanceof Date ? date : new Date(date)
    return d >= activeSeason.startDate && d <= activeSeason.endDate
  }

  // A diferencia de una fecha puntual (factura), un pago solo tiene mes/año
  // de facturacion — comparar contra el dia 1 del mes rompe con temporadas
  // que no empiezan el dia 1 (p. ej. 15 de septiembre): el mes de arranque
  // quedaria fuera. Se comprueba en su lugar que el rango del mes entero
  // (dia 1 a ultimo dia) solape con el rango de la temporada.
  const billingMonthInActiveSeason = (year: number, month: number) => {
    if (!activeSeason) return true
    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 0)
    return monthEnd >= activeSeason.startDate && monthStart <= activeSeason.endDate
  }

  const pagosCount = payments.filter((p) => billingMonthInActiveSeason(p.billingYear, p.billingMonth)).length

  const tabs: FinanzasTab[] = [
    { name: 'Resumen', href: '/finanzas/resumen' },
    { name: 'Pagos', href: '/finanzas/pagos', count: pagosCount },
    { name: 'Facturas', href: '/finanzas/facturas', count: invoices.filter((i) => i.status !== 'cancelled' && inActiveSeason(i.invoiceDate)).length },
    { name: 'Ingresos y gastos', href: '/finanzas/ingresos-gastos' },
    { name: 'Análisis', href: '/finanzas/analisis' },
  ]

  const subtitle = isResumen
    ? `Resumen de ${MONTHS.find((m) => m.value === selectedMonth)?.label.toLowerCase()} ${selectedYear}${activeSeason ? ` · temporada ${activeSeason.name}` : ''}`
    : isPagos
      ? `Pagos · ${MONTHS.find((m) => m.value === now.getMonth() + 1)?.label.toLowerCase()} ${now.getFullYear()} · ${pagosCount} recibos de la temporada`
      : undefined

  // No se limpia `primaryAction` aquí a propósito — mismo motivo que en
  // ClasesLayout/PersonasLayout: el cleanup de la página saliente ya lo
  // hace, y limpiarlo aquí también lo borraría después de que la página
  // entrante lo registre (el efecto del hijo se ejecuta antes que el del
  // padre en el mismo commit). Antes de este arreglo, esto rompía el botón
  // "Registrar cobro" del Resumen en una carga directa/en frío de
  // /finanzas/resumen (donde FinanzasLayout y ResumenPage montan a la vez):
  // el efecto de este layout podía ejecutarse despues del de ResumenPage y
  // lo dejaba en null. En una navegación cliente-a-cliente ya montado no se
  // notaba, lo que lo hacía facil de pasar por alto sin probar en el
  // navegador con una carga en frío.

  const availableYears = useMemo(() => {
    const years = new Set<number>([now.getFullYear()])
    for (const p of payments) years.add(p.billingYear)
    return Array.from(years).sort((a, b) => b - a)
  }, [payments])

  const outletContext = useMemo(
    () => ({ setPrimaryAction, selectedMonth, selectedYear } satisfies FinanzasOutletContext),
    [selectedMonth, selectedYear]
  )

  return (
    <div>
      <div className="border-b border-border bg-card">
        <div className="flex flex-wrap items-center gap-4 px-5 py-5 lg:px-8">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">FINANZAS</h1>
            {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {isResumen && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Elegir mes">
                    <CalendarDays className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="p-3 flex flex-col gap-2 w-48">
                  <Select
                    options={MONTHS.map((m) => ({ value: String(m.value), label: m.label }))}
                    value={String(selectedMonth)}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  />
                  <Select
                    options={availableYears.map((y) => ({ value: String(y), label: String(y) }))}
                    value={String(selectedYear)}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                  />
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <NotificationBell />
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
