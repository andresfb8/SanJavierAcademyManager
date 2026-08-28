# Rediseño UI Fase 1 (Shell + Dashboard) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un sidebar colapsable a solo-iconos, sparklines en las tarjetas KPI del
Dashboard del director y un nuevo panel de "Alertas inteligentes", todo construido a mano
(sin CLI de shadcn, sin dependencias nuevas), manteniendo la paleta e interacciones actuales.

**Architecture:** Estado de colapso del sidebar vive en `MainLayout.tsx` (padre común de
`Sidebar`/`<main>`) persistido en localStorage con el mismo patrón `useState` + `useEffect` que
ya usa `kpiConfig` en `DashboardPage.tsx` — no se crea un store de Zustand nuevo, evitando una
pieza de estado más para un solo booleano. Lógica pura y testeable en
`src/lib/dashboard-alerts.ts` (nueva), consumida por un componente nuevo `SmartAlertsPanel.tsx`
que sigue el mismo patrón self-contained de `IntelligenceCards.tsx` (llama a `useDataStore()`
directamente, sin props). El sparkline de `StatCard` reutiliza `recharts` directamente, igual
que ya se usa en el resto del proyecto.

**Tech Stack:** React 19 + TypeScript, Zustand (`useDataStore`, solo lectura — no store nuevo),
Recharts, Vitest, Tailwind v4 (tokens ya definidos en `src/index.css`).

**Nota sobre el spec:** el spec (`docs/superpowers/specs/2026-08-28-rediseno-ui-shell-design.md`)
menciona un store `uiStore.ts` nuevo para el estado de colapso; este plan usa en su lugar estado
levantado en `MainLayout.tsx` con el mismo patrón localStorage que `kpiConfig`
(`DashboardPage.tsx:123-135`) — mismo resultado (persistido, compartido entre Sidebar y
MainLayout), un archivo menos, más consistente con cómo ya se resuelve este mismo problema en
el proyecto.

**Fuera de esta iteración (ver spec, sección "Fuera de alcance", ampliada aquí):** el restyle
menor de Header, de las gráficas ya existentes (asistencia semanal, distribución por nivel,
resumen financiero, evolución histórica) y del bottom row (activity feed / "Tu Agenda Hoy") se
deja fuera de este plan — el spec los describe como "ajustes de consistencia" sin un cambio
concreto definido, y no hay nada que planificar en bite-sized steps sin inventar detalles. Si el
usuario quiere cambios concretos ahí, es un plan aparte con su propio spec.

---

## Task 1: `Tooltip` — soportar posición a la derecha (`side="right"`)

**Files:**
- Modify: `src/components/ui/tooltip.tsx`

Necesario para los tooltips de los iconos del sidebar colapsado (el tooltip actual solo se
posiciona arriba, lo que no funciona pegado al borde izquierdo de la pantalla). Cambio
retrocompatible: por defecto (`side` omitido) se comporta exactamente igual que hoy.

- [ ] **Step 1: Leer el archivo actual**

Ya se ha leído en esta sesión (28 líneas) — confirma que sigue igual antes de editar:

```
import * as React from "react"
import { cn } from "@/lib/utils"

function Tooltip({ children, content, className }: { children: React.ReactNode; content: string; className?: string }) {
  return (
    <div className="relative group inline-flex">
      {children}
      <div className={cn(
        "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-[10px] leading-tight rounded-lg bg-slate-900 text-slate-50 opacity-0 group-hover:opacity-100 transition-opacity w-48 text-center pointer-events-none z-[100] shadow-xl",
        className
      )}>
        {content}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
      </div>
    </div>
  )
}

export { Tooltip }
```

- [ ] **Step 2: Reescribir el componente con soporte de `side`**

Reemplazar el contenido completo de `src/components/ui/tooltip.tsx` por:

```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

interface TooltipProps {
  children: React.ReactNode
  content: string
  className?: string
  side?: 'top' | 'right'
}

function Tooltip({ children, content, className, side = 'top' }: TooltipProps) {
  const positionClasses = side === 'right'
    ? 'left-full top-1/2 -translate-y-1/2 ml-2'
    : 'bottom-full left-1/2 -translate-x-1/2 mb-2'

  const arrowClasses = side === 'right'
    ? 'absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900'
    : 'absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900'

  return (
    <div className="relative group inline-flex">
      {children}
      <div className={cn(
        "absolute px-3 py-2 text-[10px] leading-tight rounded-lg bg-slate-900 text-slate-50 opacity-0 group-hover:opacity-100 transition-opacity w-48 text-center pointer-events-none z-[100] shadow-xl",
        positionClasses,
        className
      )}>
        {content}
        <div className={arrowClasses} />
      </div>
    </div>
  )
}

export { Tooltip }
```

- [ ] **Step 3: Verificar que compila y que los usos existentes no cambian visualmente**

Run: `npm run build`
Expected: sin errores de TypeScript.

Manual: `npm run dev`, abrir cualquier `StatCard` con `info` (p.ej. Dashboard → "Jugadores
activos"), pasar el ratón por el icono de ayuda — el tooltip debe seguir apareciendo arriba,
igual que antes (no se pasó `side`, usa el valor por defecto `'top'`).

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/tooltip.tsx
git commit -m "feat: soportar posicion 'right' en Tooltip para el sidebar colapsado"
```

---

## Task 2: Sidebar colapsable a solo-iconos

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/MainLayout.tsx`

El estado de colapso vive en `MainLayout` (padre de `Sidebar` y del `<main>` que necesita ajustar
su padding), persistido en localStorage. Solo afecta al `<aside>` de desktop — el drawer móvil
(`lg:hidden`) se sigue renderizando siempre expandido.

- [ ] **Step 1: Añadir estado de colapso persistido en `MainLayout.tsx`**

Reemplazar el contenido completo de `src/components/layout/MainLayout.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useDataStore } from '@/stores/dataStore'
import { cn } from '@/lib/utils'

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed'

export function MainLayout() {
  const { checkAndAutoGenerateReceipts } = useDataStore()

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    checkAndAutoGenerateReceipts()
  }, [checkAndAutoGenerateReceipts])

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed))
    } catch {
      // localStorage no disponible (modo privado, etc.) — el estado sigue funcionando en memoria
    }
  }, [sidebarCollapsed])

  return (
    <div className="min-h-screen bg-slate-50 pb-16 lg:pb-0">
      <Sidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed((prev) => !prev)} />
      <main className={cn('transition-[padding] duration-200', sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-72')}>
        <div className="min-h-screen animate-fade-in p-4 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Aceptar las nuevas props en `Sidebar.tsx`**

En `src/components/layout/Sidebar.tsx`, añadir `PanelLeftClose` y `PanelLeftOpen` al import de
`lucide-react` (junto a los ya existentes `Menu, X, ChevronDown, ...`):

```tsx
  PanelLeftClose,
  PanelLeftOpen,
```

Cambiar la firma del componente:

```tsx
interface SidebarProps {
  collapsed: boolean
  onToggleCollapsed: () => void
}

export function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps) {
```

(sustituye la línea actual `export function Sidebar() {`).

- [ ] **Step 3: Parametrizar `renderNavItem` y `renderGroup` con el modo colapsado**

Reemplazar `renderNavItem`:

```tsx
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
```

Añadir el import de `Tooltip` junto a los demás imports de `src/components/layout/Sidebar.tsx`:

```tsx
import { Tooltip } from '@/components/ui/tooltip'
```

Reemplazar `renderGroup`:

```tsx
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
```

(Renombra la variable local `isCollapsed` del `useState` de grupos — ya se llama
`collapsedGroups`, así que no hay colisión de nombres; el parámetro nuevo se llama
`isCollapsed` solo dentro de estas dos funciones.)

- [ ] **Step 4: Parametrizar `sidebarContent` y añadir el botón de colapsar**

`sidebarContent` pasa de ser una constante a una función `renderSidebarContent(isCollapsed)`,
para poder pedir la versión siempre-expandida en el drawer móvil y la versión
colapsable en el `<aside>` de desktop. Reemplazar el bloque `const sidebarContent = (...)`
completo (incluyendo el `</div>` final de cierre) por:

```tsx
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
```

- [ ] **Step 5: Usar `renderSidebarContent` en el drawer móvil y en el `<aside>` de desktop**

Sustituir las tres apariciones de `{sidebarContent}` (drawer móvil y `<aside>` de desktop) y el
ancho fijo del `<aside>`:

```tsx
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
```

(El drawer móvil (primer `renderSidebarContent(false)`) queda siempre expandido a propósito —
el colapso solo aplica al `<aside>` de desktop, como dice el spec.)

- [ ] **Step 6: Verificar tipos y build**

Run: `npm run build`
Expected: sin errores de TypeScript (revisa que no queden referencias a la constante
`sidebarContent` antigua ni a un `renderGroup`/`renderNavItem` con la firma vieja).

- [ ] **Step 7: Verificación manual en el navegador**

`npm run dev`, como `director`:
1. Sidebar desktop expandido por defecto (o como haya quedado en localStorage de una sesión
   anterior — borra `sidebar-collapsed` de localStorage si quieres partir de cero).
2. Click en "Colapsar" → el sidebar se reduce a ~72px, los textos desaparecen, los grupos se
   listan como iconos sueltos sin cabecera.
3. Pasa el ratón por un icono → aparece el tooltip a la derecha con el nombre del ítem.
4. Recarga la página → el sidebar sigue colapsado (persistencia).
5. Click en el icono de expandir → vuelve al estado normal, con los grupos
   Administración/Financiera/Configuración colapsables tal cual funcionaban antes.
6. Reduce la ventana a móvil → el bottom nav y el drawer (botón "Menú") funcionan igual que
   antes, siempre expandidos, sin importar el estado de colapso de desktop.

- [ ] **Step 8: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/components/layout/MainLayout.tsx
git commit -m "feat: sidebar colapsable a solo-iconos en desktop"
```

---

## Task 3: Sparkline opcional en `StatCard`

**Files:**
- Modify: `src/components/shared/StatCard.tsx`

- [ ] **Step 1: Añadir la prop `sparkline` y el import de recharts**

En `src/components/shared/StatCard.tsx`, añadir el import:

```tsx
import { LineChart, Line, ResponsiveContainer } from 'recharts'
```

Añadir `sparkline?: number[]` a `StatCardProps`:

```tsx
interface StatCardProps {
  title: string
  value: string | number
  description?: string
  info?: string
  icon: React.ElementType
  trend?: {
    value: number
    label: string
  }
  sparkline?: number[]
  className?: string
  iconClassName?: string
  accentColor?: string
}
```

- [ ] **Step 2: Renderizar el sparkline bajo el trend/description**

En la firma del componente, añadir `sparkline` a los props desestructurados:

```tsx
export function StatCard({ title, value, description, info, icon: Icon, trend, sparkline, className, iconClassName, accentColor }: StatCardProps) {
```

Insertar, justo después del bloque `{trend && (...)}` y antes del `</div>` que cierra
`space-y-2 flex-1 min-w-0` (el div de la izquierda de la card):

```tsx
            {sparkline && sparkline.length > 1 && (
              <div className="h-8 -mx-1 mt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparkline.map((v, i) => ({ i, v }))}>
                    <Line
                      type="monotone"
                      dataKey="v"
                      stroke={accentColor || 'var(--color-primary)'}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: sin errores. Los usos existentes de `StatCard` en `CoachDashboard.tsx`,
`PlayerDashboard.tsx`, etc. no pasan `sparkline` — deben verse exactamente igual que antes
(prop opcional, sin efecto si no se pasa).

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/StatCard.tsx
git commit -m "feat: soportar sparkline opcional en StatCard"
```

---

## Task 4: `dashboard-alerts.ts` — `pendingPaymentAlerts`

**Files:**
- Create: `src/lib/dashboard-alerts.ts`
- Test: `src/lib/dashboard-alerts.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/dashboard-alerts.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { pendingPaymentAlerts } from '@/lib/dashboard-alerts'
import type { NormalizedPayment } from '@/lib/payment-utils'

function makePayment(overrides: Partial<NormalizedPayment> = {}): NormalizedPayment {
  return {
    id: 'pay1',
    source: 'cuota',
    playerId: 'p1',
    playerName: 'Jugador',
    concept: 'Cuota',
    amount: 100,
    status: 'pendiente',
    billingMonth: 8,
    billingYear: 2026,
    ...overrides,
  }
}

describe('pendingPaymentAlerts', () => {
  it('agrupa pagos pendientes por jugador y filtra por minPendingCount', () => {
    const payments: NormalizedPayment[] = [
      makePayment({ id: 'a', playerId: 'p1', playerName: 'Ana', amount: 50 }),
      makePayment({ id: 'b', playerId: 'p1', playerName: 'Ana', amount: 30 }),
      makePayment({ id: 'c', playerId: 'p2', playerName: 'Bea', amount: 200 }),
    ]
    const result = pendingPaymentAlerts(payments, 2)
    expect(result).toEqual([
      { playerId: 'p1', playerName: 'Ana', pendingCount: 2, pendingAmount: 80 },
    ])
  })

  it('ignora pagos que no esten pendientes', () => {
    const payments: NormalizedPayment[] = [
      makePayment({ id: 'a', playerId: 'p1', status: 'pagado' }),
      makePayment({ id: 'b', playerId: 'p1', status: 'pendiente' }),
    ]
    expect(pendingPaymentAlerts(payments, 2)).toEqual([])
  })

  it('ordena por pendingCount desc, empate por pendingAmount desc', () => {
    const payments: NormalizedPayment[] = [
      makePayment({ id: 'a', playerId: 'p1', playerName: 'Ana', amount: 100 }),
      makePayment({ id: 'b', playerId: 'p1', playerName: 'Ana', amount: 100 }),
      makePayment({ id: 'c', playerId: 'p2', playerName: 'Bea', amount: 50 }),
      makePayment({ id: 'd', playerId: 'p2', playerName: 'Bea', amount: 50 }),
      makePayment({ id: 'e', playerId: 'p3', playerName: 'Caro', amount: 40 }),
      makePayment({ id: 'f', playerId: 'p3', playerName: 'Caro', amount: 40 }),
      makePayment({ id: 'g', playerId: 'p3', playerName: 'Caro', amount: 40 }),
    ]
    const result = pendingPaymentAlerts(payments, 2)
    expect(result.map(r => r.playerId)).toEqual(['p3', 'p1', 'p2'])
  })

  it('usa minPendingCount=2 por defecto', () => {
    const payments: NormalizedPayment[] = [
      makePayment({ id: 'a', playerId: 'p1', playerName: 'Ana' }),
    ]
    expect(pendingPaymentAlerts(payments)).toEqual([])
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- dashboard-alerts.test.ts`
Expected: FAIL — el módulo `@/lib/dashboard-alerts` no existe.

- [ ] **Step 3: Implementar**

Crear `src/lib/dashboard-alerts.ts`:

```ts
import type { NormalizedPayment } from '@/lib/payment-utils'

export interface PendingPaymentAlert {
  playerId: string
  playerName: string
  pendingCount: number
  pendingAmount: number
}

/**
 * Jugadores con `minPendingCount` o mas recibos en estado 'pendiente', ordenados de mayor a
 * menor numero de recibos pendientes (empate: mayor importe pendiente primero).
 */
export function pendingPaymentAlerts(
  payments: NormalizedPayment[],
  minPendingCount = 2
): PendingPaymentAlert[] {
  const byPlayer = new Map<string, PendingPaymentAlert>()

  for (const p of payments) {
    if (p.status !== 'pendiente') continue
    const existing = byPlayer.get(p.playerId)
    if (existing) {
      existing.pendingCount += 1
      existing.pendingAmount += p.amount
    } else {
      byPlayer.set(p.playerId, {
        playerId: p.playerId,
        playerName: p.playerName,
        pendingCount: 1,
        pendingAmount: p.amount,
      })
    }
  }

  return Array.from(byPlayer.values())
    .filter(a => a.pendingCount >= minPendingCount)
    .sort((a, b) => b.pendingCount - a.pendingCount || b.pendingAmount - a.pendingAmount)
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npm test -- dashboard-alerts.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboard-alerts.ts src/lib/dashboard-alerts.test.ts
git commit -m "feat: añadir pendingPaymentAlerts en dashboard-alerts"
```

---

## Task 5: `dashboard-alerts.ts` — `highAbsenceGroupAlerts`

**Files:**
- Modify: `src/lib/dashboard-alerts.ts`
- Modify: `src/lib/dashboard-alerts.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `src/lib/dashboard-alerts.test.ts`:

```ts
import { highAbsenceGroupAlerts } from '@/lib/dashboard-alerts'
import type { AttendanceRecord, Group } from '@/types'

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 'g1',
    name: 'Grupo 1',
    level: 'intermedio',
    coachId: 'c1',
    coachName: 'Coach',
    courtId: 'ct1',
    courtName: 'Pista 1',
    schedule: [],
    maxCapacity: 8,
    currentEnrollment: 4,
    defaultTariffId: 't1',
    defaultTariffPrice: 50,
    billingFrequency: 'monthly',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    isActive: true,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  }
}

function makeAttendanceRecord(overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: 'a1',
    groupId: 'g1',
    groupName: 'Grupo 1',
    date: new Date('2026-08-10'),
    records: [],
    coachId: 'c1',
    createdAt: new Date('2026-08-10'),
    ...overrides,
  }
}

describe('highAbsenceGroupAlerts', () => {
  it('calcula la tasa de ausencia por grupo y filtra por minRate', () => {
    const groups = [makeGroup({ id: 'g1', name: 'Iniciación A' })]
    const attendance: AttendanceRecord[] = [
      makeAttendanceRecord({
        groupId: 'g1',
        date: new Date('2026-08-10'),
        records: [
          { playerId: 'p1', playerName: 'Ana', status: 'ausente', isRecovery: false },
          { playerId: 'p2', playerName: 'Bea', status: 'ausente', isRecovery: false },
          { playerId: 'p3', playerName: 'Caro', status: 'presente', isRecovery: false },
        ],
      }),
    ]
    const result = highAbsenceGroupAlerts(attendance, groups, 8, 2026, { minRate: 0.3, minRecords: 3 })
    expect(result).toEqual([
      { groupId: 'g1', groupName: 'Iniciación A', absenceRate: 2 / 3, recordCount: 3 },
    ])
  })

  it('excluye grupos con menos registros que minRecords', () => {
    const groups = [makeGroup({ id: 'g1' })]
    const attendance: AttendanceRecord[] = [
      makeAttendanceRecord({
        groupId: 'g1',
        date: new Date('2026-08-10'),
        records: [
          { playerId: 'p1', playerName: 'Ana', status: 'ausente', isRecovery: false },
          { playerId: 'p2', playerName: 'Bea', status: 'ausente', isRecovery: false },
        ],
      }),
    ]
    expect(highAbsenceGroupAlerts(attendance, groups, 8, 2026, { minRate: 0.3, minRecords: 3 })).toEqual([])
  })

  it('ignora registros fuera del mes/año dados', () => {
    const groups = [makeGroup({ id: 'g1' })]
    const attendance: AttendanceRecord[] = [
      makeAttendanceRecord({
        groupId: 'g1',
        date: new Date('2026-07-10'),
        records: [
          { playerId: 'p1', playerName: 'Ana', status: 'ausente', isRecovery: false },
          { playerId: 'p2', playerName: 'Bea', status: 'ausente', isRecovery: false },
          { playerId: 'p3', playerName: 'Caro', status: 'ausente', isRecovery: false },
        ],
      }),
    ]
    expect(highAbsenceGroupAlerts(attendance, groups, 8, 2026)).toEqual([])
  })

  it('solo cuenta status "ausente" como ausencia, no "justificado"', () => {
    const groups = [makeGroup({ id: 'g1' })]
    const attendance: AttendanceRecord[] = [
      makeAttendanceRecord({
        groupId: 'g1',
        date: new Date('2026-08-10'),
        records: [
          { playerId: 'p1', playerName: 'Ana', status: 'justificado', isRecovery: false },
          { playerId: 'p2', playerName: 'Bea', status: 'justificado', isRecovery: false },
          { playerId: 'p3', playerName: 'Caro', status: 'presente', isRecovery: false },
        ],
      }),
    ]
    expect(highAbsenceGroupAlerts(attendance, groups, 8, 2026, { minRate: 0.3, minRecords: 3 })).toEqual([])
  })

  it('usa minRate=0.3 y minRecords=3 por defecto', () => {
    const groups = [makeGroup({ id: 'g1', name: 'Grupo Test' })]
    const attendance: AttendanceRecord[] = [
      makeAttendanceRecord({
        groupId: 'g1',
        date: new Date('2026-08-10'),
        records: [
          { playerId: 'p1', playerName: 'Ana', status: 'ausente', isRecovery: false },
          { playerId: 'p2', playerName: 'Bea', status: 'presente', isRecovery: false },
          { playerId: 'p3', playerName: 'Caro', status: 'presente', isRecovery: false },
        ],
      }),
    ]
    expect(highAbsenceGroupAlerts(attendance, groups, 8, 2026)).toEqual([])
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que fallan**

Run: `npm test -- dashboard-alerts.test.ts`
Expected: FAIL — `highAbsenceGroupAlerts` no existe.

- [ ] **Step 3: Implementar**

Añadir a `src/lib/dashboard-alerts.ts` (ampliar el import del principio del archivo):

```ts
import type { AttendanceRecord, Group } from '@/types'
```

```ts
export interface HighAbsenceGroupAlert {
  groupId: string
  groupName: string
  absenceRate: number
  recordCount: number
}

interface HighAbsenceGroupOptions {
  minRate?: number
  minRecords?: number
}

/**
 * Grupos cuya tasa de ausencia (registros con status 'ausente' / total de registros de
 * asistencia del grupo en el mes dado) alcanza `minRate`, exigiendo al menos `minRecords`
 * registros totales para evitar falsos positivos con datos escasos. Solo cuenta 'ausente' como
 * ausencia (no 'justificado'), igual criterio que `atRiskPlayers` en IntelligenceCards.tsx.
 */
export function highAbsenceGroupAlerts(
  attendance: AttendanceRecord[],
  groups: Group[],
  month: number,
  year: number,
  { minRate = 0.3, minRecords = 3 }: HighAbsenceGroupOptions = {}
): HighAbsenceGroupAlert[] {
  const totals = new Map<string, { absences: number; total: number }>()

  for (const record of attendance) {
    const d = record.date instanceof Date ? record.date : new Date(record.date)
    if (d.getMonth() + 1 !== month || d.getFullYear() !== year) continue

    const entry = totals.get(record.groupId) ?? { absences: 0, total: 0 }
    for (const r of record.records) {
      entry.total += 1
      if (r.status === 'ausente') entry.absences += 1
    }
    totals.set(record.groupId, entry)
  }

  const result: HighAbsenceGroupAlert[] = []
  for (const [groupId, { absences, total }] of totals) {
    if (total < minRecords) continue
    const absenceRate = absences / total
    if (absenceRate < minRate) continue
    const group = groups.find(g => g.id === groupId)
    result.push({
      groupId,
      groupName: group?.name ?? 'Grupo desconocido',
      absenceRate,
      recordCount: total,
    })
  }

  return result.sort((a, b) => b.absenceRate - a.absenceRate)
}
```

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npm test -- dashboard-alerts.test.ts`
Expected: PASS (9 tests en total en este archivo)

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboard-alerts.ts src/lib/dashboard-alerts.test.ts
git commit -m "feat: añadir highAbsenceGroupAlerts en dashboard-alerts"
```

---

## Task 6: Componente `SmartAlertsPanel`

**Files:**
- Create: `src/components/shared/dashboard/SmartAlertsPanel.tsx`

Sigue el mismo patrón self-contained que `IntelligenceCards.tsx`: llama a `useDataStore()`
directamente, sin recibir los datos por props.

- [ ] **Step 1: Crear el componente**

Crear `src/components/shared/dashboard/SmartAlertsPanel.tsx`:

```tsx
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, UsersRound, ChevronRight, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useDataStore } from '@/stores/dataStore'
import { formatCurrency } from '@/lib/utils'
import { normalizeAllPayments } from '@/lib/payment-utils'
import { pendingPaymentAlerts, highAbsenceGroupAlerts } from '@/lib/dashboard-alerts'

const MAX_ALERTS_PER_TYPE = 5

export function SmartAlertsPanel() {
  const navigate = useNavigate()
  const { payments, eventPayments, privateLessonPayments, events, attendance, groups } = useDataStore()

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const allPayments = useMemo(
    () => normalizeAllPayments(payments, eventPayments, privateLessonPayments ?? [], events),
    [payments, eventPayments, privateLessonPayments, events]
  )

  const currentMonthPayments = useMemo(
    () => allPayments.filter(p => p.billingMonth === currentMonth && p.billingYear === currentYear),
    [allPayments, currentMonth, currentYear]
  )

  const paymentAlerts = useMemo(
    () => pendingPaymentAlerts(currentMonthPayments, 2).slice(0, MAX_ALERTS_PER_TYPE),
    [currentMonthPayments]
  )

  const absenceAlerts = useMemo(
    () => highAbsenceGroupAlerts(attendance, groups, currentMonth, currentYear).slice(0, MAX_ALERTS_PER_TYPE),
    [attendance, groups, currentMonth, currentYear]
  )

  const hasAlerts = paymentAlerts.length > 0 || absenceAlerts.length > 0

  return (
    <Card className="border-amber-200 bg-amber-50/30 shadow-sm h-full">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-100 shrink-0">
            <Sparkles className="h-4 w-4 text-amber-600" />
          </div>
          <h2 className="text-sm font-bold text-amber-900">Alertas inteligentes</h2>
        </div>

        {!hasAlerts && (
          <p className="text-xs text-amber-700/70 py-2">No hay alertas activas este mes.</p>
        )}

        {paymentAlerts.map(alert => (
          <div key={alert.playerId} className="flex items-start gap-3 rounded-xl border border-amber-100 bg-white/60 p-3">
            <div className="p-1.5 rounded-lg bg-amber-100 shrink-0">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-900">
                {alert.playerName} tiene {alert.pendingCount} recibos pendientes
              </p>
              <p className="text-[11px] text-amber-700/80 mt-0.5">
                {formatCurrency(alert.pendingAmount)} pendientes de cobro
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-1.5 h-6 px-1.5 text-[11px] text-amber-700 hover:bg-amber-100 -ml-1.5"
                onClick={() => navigate('/pagos')}
              >
                Ver detalles
                <ChevronRight className="h-3 w-3 ml-0.5" />
              </Button>
            </div>
          </div>
        ))}

        {absenceAlerts.map(alert => (
          <div key={alert.groupId} className="flex items-start gap-3 rounded-xl border border-amber-100 bg-white/60 p-3">
            <div className="p-1.5 rounded-lg bg-amber-100 shrink-0">
              <UsersRound className="h-3.5 w-3.5 text-amber-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-900">
                Ausencia alta en '{alert.groupName}'
              </p>
              <p className="text-[11px] text-amber-700/80 mt-0.5">
                {Math.round(alert.absenceRate * 100)}% de ausencia este mes
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-1.5 h-6 px-1.5 text-[11px] text-amber-700 hover:bg-amber-100 -ml-1.5"
                onClick={() => navigate(`/asistencia?groupId=${alert.groupId}`)}
              >
                Ver detalles
                <ChevronRight className="h-3 w-3 ml-0.5" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: sin errores de TypeScript.

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/dashboard/SmartAlertsPanel.tsx
git commit -m "feat: añadir componente SmartAlertsPanel"
```

---

## Task 7: Wirear sparklines en las `StatCard` del Dashboard (vista admin)

**Files:**
- Modify: `src/pages/DashboardPage.tsx`

Añade `sparkline` a las `StatCard` que ya tienen una serie histórica calculada en
`evolutionData`/`financialData` (ambos ya existen en el componente, líneas ~438-553). No se
toca ningún cálculo, solo se pasa la prop nueva.

- [ ] **Step 1: Jugadores activos**

En el bloque `{kpiConfig.activePlayers && (...)}` (dentro de la vista no-coach), añadir
`sparkline` a la `StatCard` de "Jugadores activos":

```tsx
              {kpiConfig.activePlayers && (
                <StatCard
                  title="Jugadores activos"
                  value={activePlayers}
                  info="Número total de alumnos con estado 'Activo' en el sistema."
                  icon={Users}
                  sparkline={evolutionData.map(d => d.jugadores)}
                  iconClassName="bg-cyan-50 text-cyan-600"
                  accentColor="#0891b2"
                  className="min-w-[280px] shrink-0 sm:min-w-0 snap-center"
                />
              )}
```

- [ ] **Step 2: Ingresos este mes**

```tsx
              {isAdmin && kpiConfig.revenue && (
                <StatCard
                  title="Ingresos este mes"
                  value={formatCurrency(currentRevenue)}
                  info="Suma de todos los pagos marcados como 'Pagado' en el mes en curso, incluyendo ingresos manuales."
                  icon={DollarSign}
                  trend={{ value: revenueDiff, label: 'vs mes anterior' }}
                  sparkline={evolutionData.map(d => d.ingresos)}
                  iconClassName="bg-cyan-50 text-cyan-600"
                  accentColor="#0891b2"
                  className="min-w-[280px] shrink-0 sm:min-w-0 snap-center"
                />
              )}
```

- [ ] **Step 3: Pagos pendientes**

```tsx
              {isAdmin && kpiConfig.pendingPayments && (
                <StatCard
                  title="Pagos pendientes"
                  value={formatCurrency(currentPending)}
                  info="Total de importes de pagos que aún están en estado 'Pendiente' para el mes en curso."
                  icon={AlertCircle}
                  trend={{ value: pendingDiff, label: 'vs mes anterior' }}
                  sparkline={financialData.map(d => d.pendiente)}
                  iconClassName="bg-cyan-50 text-cyan-600"
                  accentColor="#0891b2"
                  className="min-w-[280px] shrink-0 sm:min-w-0 snap-center"
                />
              )}
```

- [ ] **Step 4: Ratio de cobro**

```tsx
              {isAdmin && kpiConfig.collectionRate && (
                <StatCard
                  title="Ratio de cobro"
                  value={`${collectionRate}%`}
                  info="Porcentaje de dinero cobrado respecto al total facturado (cobrado + pendiente). Mide la eficiencia de la recaudación."
                  icon={TrendingUp}
                  sparkline={evolutionData.map(d => d.ratioCobro)}
                  iconClassName="bg-primary/10 text-primary"
                  accentColor="#0e7490"
                  className="min-w-[280px] shrink-0 sm:min-w-0 snap-center"
                />
              )}
```

- [ ] **Step 5: Índice de rotación, ratio de abandono y tasa de ocupación**

```tsx
              {kpiConfig.rotationIndex && (
                <StatCard
                  title="Índice de rotación"
                  value={`${rotationIndex}%`}
                  info="Mide el movimiento total de alumnos (altas + bajas) respecto al volumen total. Un índice alto indica mucha variabilidad en el alumnado."
                  icon={RefreshCw}
                  sparkline={evolutionData.map(d => d.rotacion)}
                  iconClassName="bg-primary/10 text-primary"
                  accentColor="#0e7490"
                  className="min-w-[280px] shrink-0 sm:min-w-0 snap-center"
                />
              )}
              {kpiConfig.churnRate && (
                <StatCard
                  title="Ratio de abandono"
                  value={`${churnRate}%`}
                  info="Porcentaje de alumnos que han causado baja respecto al total de alumnos activos en el mes."
                  icon={UserMinus}
                  sparkline={evolutionData.map(d => d.abandono)}
                  iconClassName="bg-primary/10 text-primary"
                  accentColor="#0e7490"
                  className="min-w-[280px] shrink-0 sm:min-w-0 snap-center"
                />
              )}
              {kpiConfig.occupancyRate && (
                <StatCard
                  title="Tasa de ocupación"
                  value={`${occupancyStats.rate}%`}
                  description={`${occupancyStats.totalOccupied} / ${occupancyStats.totalCapacity} plazas`}
                  info="Porcentaje de plazas ocupadas respecto a la capacidad máxima de todos los grupos activos."
                  icon={CalendarCheck}
                  sparkline={evolutionData.map(d => d.ocupacion)}
                  iconClassName="bg-primary/10 text-primary"
                  accentColor="#0e7490"
                  className="min-w-[280px] shrink-0 sm:min-w-0 snap-center"
                />
              )}
```

("Grupos activos", "Clases hoy", "Alumnos inscritos" y "Lista de espera" no tienen una serie
histórica ya calculada en `evolutionData`/`financialData` — se quedan sin `sparkline`, tal como
dice el spec.)

- [ ] **Step 6: Verificar build y visualmente**

Run: `npm run build`
Expected: sin errores.

Manual: `npm run dev` como `director`, comprobar que las tarjetas indicadas muestran una
mini-gráfica bajo el número, y que las que no se tocaron (Grupos activos, Clases hoy...) se ven
igual que antes.

- [ ] **Step 7: Commit**

```bash
git add src/pages/DashboardPage.tsx
git commit -m "feat: sparklines en las tarjetas KPI del Dashboard"
```

---

## Task 8: Insertar `SmartAlertsPanel` junto a `IntelligenceCards`

**Files:**
- Modify: `src/pages/DashboardPage.tsx`

- [ ] **Step 1: Añadir el import**

Junto a `import { IntelligenceCards } from '@/components/shared/analytics/IntelligenceCards'`:

```tsx
import { SmartAlertsPanel } from '@/components/shared/dashboard/SmartAlertsPanel'
```

- [ ] **Step 2: Envolver `IntelligenceCards` en una fila de dos columnas junto al nuevo panel**

Reemplazar:

```tsx
        {/* ── Inteligencia del Club ────────────────────────────── */}
        {isAdmin && (
          <IntelligenceCards classReviews={classReviewsData} />
        )}
```

por:

```tsx
        {/* ── Alertas inteligentes + Inteligencia del Club ────────── */}
        {isAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            <SmartAlertsPanel />
            <IntelligenceCards classReviews={classReviewsData} />
          </div>
        )}
```

- [ ] **Step 3: Verificar build y visualmente**

Run: `npm run build`
Expected: sin errores.

Manual: `npm run dev` como `director` — el panel "Alertas inteligentes" aparece a la izquierda
de "Inteligencia del Club" en desktop (dos columnas), y apilado en móvil (una columna). Si hay
jugadores con 2+ recibos pendientes este mes o algún grupo con ausencia alta, aparecen listados;
si no, se ve el mensaje "No hay alertas activas este mes."

- [ ] **Step 4: Commit**

```bash
git add src/pages/DashboardPage.tsx
git commit -m "feat: mostrar SmartAlertsPanel junto a Inteligencia del Club en el Dashboard"
```

---

## Task 9: Verificación final de la Fase 1

**Files:** (ninguno — solo verificación)

- [ ] **Step 1: Suite completa de tests**

Run: `npm test`
Expected: todos los tests pasan, incluidos los ~13 archivos previos más
`dashboard-alerts.test.ts` (9 tests nuevos).

- [ ] **Step 2: Build de producción**

Run: `npm run build`
Expected: sin errores ni warnings de TypeScript.

- [ ] **Step 3: Repaso manual completo (checklist del spec)**

Con `npm run dev`, como `director`:
1. Sidebar: colapsar/expandir, tooltips en modo icono, persistencia tras recargar, drawer móvil
   sin cambios.
2. Dashboard: sparklines visibles en las tarjetas indicadas en la Tarea 7; panel de Alertas
   inteligentes con datos reales o mensaje vacío.
3. Diálogo "Configurar indicadores" (icono de ajustes del Header): activar/desactivar KPIs y
   gráficos sigue funcionando igual que antes.

Como `entrenador`:
4. La vista de Dashboard específica de coach (bloque `isCoach`) se ve exactamente igual que
   antes de estos cambios — no se tocó.

En las tres franjas de ancho (móvil, tablet, desktop):
5. Ninguna tarjeta ni panel se desborda o corta contenido.

- [ ] **Step 4: Confirmar que no queda nada sin commitear**

Run: `git status --short`
Expected: sin cambios pendientes (todo commiteado tarea a tarea).
