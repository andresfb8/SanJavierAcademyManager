# Rediseño UI Clases — Fase A (topbar unificado) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear un topbar+tabs compartido ("CLASES") análogo a `PersonasLayout`, con 6 pestañas (Parrilla · Grupos · Asistencia · Particulares · Eventos · Metodología), enlazando las páginas ya existentes sin rediseñar su contenido interno.

**Architecture:** `ClasesLayout` nuevo posee el botón de acción primaria (`setPrimaryAction`, mismo tipo `ClasesPrimaryAction` que `PersonasPrimaryAction`) y el `SeasonSwitcher`, expuestos vía `useOutletContext`. Las 4 páginas existentes (`AgendaPage`, `GroupsPage`, `AttendancePage`, `EventsActivitiesPage`) pierden su `<Header>` propio y registran su acción primaria vía `useEffect`. `EventsActivitiesPage` gana un prop `initialTab` para servir tanto la pestaña Eventos como Particulares. `MethodologyPage` (ya existente, huérfana) se enlaza tal cual bajo Metodología.

**Tech Stack:** React 19, TypeScript, react-router-dom v7 (`useOutletContext`), Tailwind CSS v4, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-08-31-rediseno-ui-clases-fase-a-design.md`

---

### Task 1: `ClasesLayout` nuevo

**Files:**
- Create: `src/components/layout/ClasesLayout.tsx`

- [ ] **Step 1: Crear el archivo completo**

```tsx
import { useState, useEffect, useMemo } from 'react'
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
```

Nota: a diferencia de `PersonasLayout`, este layout no lee `useAuthStore`
porque no filtra pestañas por rol (todas las 6 se muestran siempre, según
el spec) ni calcula ningún dato dependiente del rol activo.

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: sin errores. Nada más importa este archivo todavía.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/ClasesLayout.tsx
git commit -m "feat: crear ClasesLayout con topbar y 6 pestañas de Clases"
```

---

### Task 2: Rutas y sidebar

**Files:**
- Modify: `src/AuthenticatedApp.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Añadir el import de `ClasesLayout`**

En `src/AuthenticatedApp.tsx`, junto al import de `PersonasLayout`:

```ts
import { PersonasLayout } from '@/components/layout/PersonasLayout'
import { ClasesLayout } from '@/components/layout/ClasesLayout'
```

- [ ] **Step 2: Añadir las rutas nuevas de Clases**

Sustituir estas líneas:

```tsx
        <Route path="/grupos" element={<GroupsRouter />} />
        <Route path="/grupos/:id" element={<GroupDetailPage />} />
        <Route path="/asistencia" element={<AttendancePage />} />
        <Route path="/huecos" element={<FreeSlotsPage />} />
        <Route path="/agenda" element={<AgendaPage />} />
        <Route path="/eventos" element={<EventsActivitiesPage />} />
        <Route path="/eventos/:id" element={<EventDetailPage />} />
        <Route path="/clases-particulares/:id" element={<PrivateLessonDetailPage />} />
        <Route path="/clases/:groupId/:date" element={<ClassDetailPage />} />
```

por:

```tsx
        <Route path="/clases" element={<ClasesLayout />}>
          <Route index element={<Navigate to="/clases/parrilla" replace />} />
          <Route path="parrilla" element={<AgendaPage />} />
          <Route path="grupos" element={<GroupsPage />} />
          <Route path="asistencia" element={<AttendancePage />} />
          <Route path="particulares" element={<EventsActivitiesPage initialTab="private" />} />
          <Route path="eventos" element={<EventsActivitiesPage initialTab="events" />} />
          <Route path="metodologia" element={<RoleRoute module="settings"><MethodologyPage /></RoleRoute>} />
        </Route>
        <Route path="/agenda" element={<Navigate to="/clases/parrilla" replace />} />
        <Route path="/eventos" element={<Navigate to="/clases/eventos" replace />} />
        <Route path="/methodology" element={<Navigate to="/clases/metodologia" replace />} />
        <Route path="/grupos" element={<GroupsRouter />} />
        <Route path="/grupos/:id" element={<GroupDetailPage />} />
        <Route path="/asistencia" element={<AttendancePage />} />
        <Route path="/huecos" element={<FreeSlotsPage />} />
        <Route path="/eventos/:id" element={<EventDetailPage />} />
        <Route path="/clases-particulares/:id" element={<PrivateLessonDetailPage />} />
        <Route path="/clases/:groupId/:date" element={<ClassDetailPage />} />
```

(`index` dentro del layout, igual que hace `PersonasLayout`, en vez de una
segunda `<Route path="/clases">` separada — eso crearía un conflicto de
rutas duplicadas.)

Notas importantes de este cambio:
- `/grupos` y `/asistencia` **no se tocan ni se redirigen** — siguen
  exactamente como estaban (sirven a jugador/tutor con contenido distinto,
  ver spec sección 1). `/clases/grupos` y `/clases/asistencia` son rutas
  nuevas y separadas.
- El viejo `<Route path="/methodology" element={<RoleRoute module="settings"><MethodologyPage /></RoleRoute>} />` (línea ~160, más abajo en el archivo, fuera del bloque de arriba) **se elimina** — ver Step 3.

- [ ] **Step 3: Eliminar la ruta huérfana antigua de `/methodology`**

Buscar y eliminar esta línea (más abajo en el archivo, cerca de
`/planificacion`):

```tsx
        <Route path="/methodology" element={<RoleRoute module="settings"><MethodologyPage /></RoleRoute>} />
```

(Ya quedó reemplazada por el redirect `/methodology → /clases/metodologia`
del Step 2. `/planificacion` con `PlanningPage` **no se toca** — es un
huérfano distinto, sin relación con este plan.)

- [ ] **Step 4: Actualizar el sidebar**

En `src/components/layout/Sidebar.tsx`, cambiar:

```ts
const navItems: NavItem[] = [
  { name: 'Hoy', href: '/', icon: Home },
  { name: 'Personas', href: '/personas/jugadores', icon: Users },
  { name: 'Clases', href: '/agenda', icon: GraduationCap },
  { name: 'Calendario', href: '/agenda', icon: CalendarDays },
  { name: 'Finanzas', href: '/pagos', icon: CreditCard, requiredModule: 'payments' },
  { name: 'Deportivo', href: '/informes-mensuales', icon: Trophy, requiredModule: 'informes_mensuales' },
]
```

por:

```ts
const navItems: NavItem[] = [
  { name: 'Hoy', href: '/', icon: Home },
  { name: 'Personas', href: '/personas/jugadores', icon: Users },
  { name: 'Clases', href: '/clases/parrilla', icon: GraduationCap },
  { name: 'Calendario', href: '/clases/parrilla', icon: CalendarDays },
  { name: 'Finanzas', href: '/pagos', icon: CreditCard, requiredModule: 'payments' },
  { name: 'Deportivo', href: '/informes-mensuales', icon: Trophy, requiredModule: 'informes_mensuales' },
]
```

Cambiar:

```ts
const coachSettingsItems: NavItem[] = [
  { name: 'Grupos', href: '/grupos', icon: GraduationCap },
  { name: 'Asistencia', href: '/asistencia', icon: ClipboardCheck },
]
```

por:

```ts
const coachSettingsItems: NavItem[] = [
  { name: 'Grupos', href: '/clases/grupos', icon: GraduationCap },
  { name: 'Asistencia', href: '/clases/asistencia', icon: ClipboardCheck },
]
```

Cambiar (dentro de `filterItem`, el bloque de rutas permitidas para
`entrenador`):

```ts
    // Entrenador: módulos permitidos explícitamente
    if (activeRole === 'entrenador') {
      const coachAllowedPaths = ['/', '/personas/jugadores', '/agenda', '/grupos', '/asistencia']
      if (!coachAllowedPaths.includes(item.href)) return false
    }
```

por:

```ts
    // Entrenador: módulos permitidos explícitamente
    if (activeRole === 'entrenador') {
      const coachAllowedPaths = [
        '/', '/personas/jugadores',
        '/clases/parrilla', '/clases/grupos', '/clases/asistencia',
        '/clases/particulares', '/clases/eventos', '/clases/metodologia',
      ]
      if (!coachAllowedPaths.includes(item.href)) return false
    }
```

- [ ] **Step 5: Verificar que compila**

Run: `npm run build`
Expected: **un único error de TypeScript**, en la línea nueva
`<Route path="particulares" element={<EventsActivitiesPage initialTab="private" />} />`
(y la de `eventos`): `EventsActivitiesPage` todavía no acepta la prop
`initialTab` — eso lo resuelve la Task 3, que se ejecuta inmediatamente
después de esta. No corregirlo aquí; es el único error esperado en este
punto.

Además, `AgendaPage`, `GroupsPage`, `AttendancePage` (su vista principal)
todavía tienen su `<Header>` propio — verás doble cabecera al navegar a
`/clases/parrilla`, `/clases/grupos`, `/clases/asistencia` hasta completar
las Tasks 4, 5 y 6 respectivamente. Es un estado intermedio esperado
(mismo patrón que en el plan de Personas completo).

- [ ] **Step 6: Commit**

```bash
git add src/AuthenticatedApp.tsx src/components/layout/Sidebar.tsx
git commit -m "feat: rutas /clases/* con ClasesLayout y sidebar actualizado"
```

---

### Task 3: `EventsActivitiesPage` — prop `initialTab`

**Files:**
- Modify: `src/pages/EventsActivitiesPage.tsx`

(Se hace justo después de la Task 2 para que el build vuelva a estar
limpio cuanto antes — antes de tocar el resto de páginas.)

- [ ] **Step 1: Añadir la prop `initialTab`**

Cambiar:

```ts
export default function EventsActivitiesPage() {
```

por:

```ts
interface EventsActivitiesPageProps {
  initialTab?: 'all' | 'events' | 'private'
}

export default function EventsActivitiesPage({ initialTab = 'all' }: EventsActivitiesPageProps) {
```

Cambiar:

```ts
  const [activeTab, setActiveTab] = useState<TabValue>('all')
```

por:

```ts
  const [activeTab, setActiveTab] = useState<TabValue>(initialTab)
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: sin errores (esto resuelve el error de tipos temporal de la
Task 2 sobre `initialTab`).

- [ ] **Step 3: Commit**

```bash
git add src/pages/EventsActivitiesPage.tsx
git commit -m "feat: añadir prop initialTab a EventsActivitiesPage"
```

---

### Task 4: `AgendaPage` — quitar Header, registrar acción primaria

**Files:**
- Modify: `src/pages/AgendaPage.tsx`

- [ ] **Step 1: Actualizar imports**

Cambiar:

```ts
import { useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
```

por:

```ts
import { useNavigate, useOutletContext } from 'react-router-dom'
import type { ClasesOutletContext } from '@/components/layout/ClasesLayout'
```

(Se elimina el import de `Header` por completo — verificar que no se usa
en ningún otro sitio del archivo antes de borrarlo.)

- [ ] **Step 2: Obtener `setPrimaryAction` del contexto**

Justo después de `const isEntrenador = user?.role === 'entrenador'` (línea
109), añadir:

```ts
  const { setPrimaryAction } = useOutletContext<ClasesOutletContext>()
```

- [ ] **Step 3: Registrar la acción primaria**

Justo antes de `return (` (la línea donde empieza el JSX, hoy en torno a la
línea 577), añadir:

```ts
  useEffect(() => {
    const items = [
      ...(!isEntrenador ? [{ label: 'Nuevo evento', icon: CalendarPlus, onClick: openNewEventDialog }] : []),
      { label: 'Nueva clase particular', icon: Plus, onClick: openNewLessonDialog },
    ]
    setPrimaryAction(
      items.length > 1
        ? { label: 'Nueva clase', icon: Plus, items }
        : { label: items[0].label, icon: items[0].icon, onClick: items[0].onClick }
    )
    return () => setPrimaryAction(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEntrenador, setPrimaryAction])
```

`useEffect` ya está disponible — comprobar el import de React al principio
del archivo; si solo importa `useState, useMemo`, cambiar a
`import { useState, useMemo, useEffect } from 'react'`.
`CalendarPlus` y `Plus` ya están en el import de `lucide-react` de este
archivo — no añadir de nuevo.

- [ ] **Step 4: Quitar el `<Header>` del render**

Cambiar:

```tsx
  return (
    <div>
      <Header
        title="Agenda"
        subtitle="Vista diaria de pistas y horarios"
        actions={
          <div className="flex items-center gap-2">
            {!isEntrenador && (
              <Button variant="outline" onClick={openNewEventDialog} className="gap-1" size="sm">
                <CalendarPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Nuevo evento</span>
              </Button>
            )}
            <Button onClick={openNewLessonDialog} className="gap-1" size="sm">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nueva clase particular</span>
            </Button>
          </div>
        }
      />

      <div className="p-3 sm:p-6 space-y-4">
```

por:

```tsx
  return (
    <div>
      <div className="p-3 sm:p-6 space-y-4">
```

- [ ] **Step 5: Verificar que compila**

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 6: Verificación manual en navegador**

1. `npm run dev`, sesión como `director`.
2. Ir a `/clases/parrilla`.
3. Verificar: topbar "CLASES" + subtítulo "Vista diaria de pistas y
   horarios" + `SeasonSwitcher` + botón "Nueva clase" con menú (Nuevo
   evento / Nueva clase particular); sin doble cabecera; el resto de la
   página (navegación de fecha, grid, diálogos) funciona exactamente igual
   que antes.
4. Repetir sesión como `entrenador`: el botón debe ser un botón simple
   "Nueva clase particular" (sin menú, ya que "Nuevo evento" se oculta).

- [ ] **Step 7: Commit**

```bash
git add src/pages/AgendaPage.tsx
git commit -m "refactor: AgendaPage usa el topbar compartido de ClasesLayout"
```

---

### Task 5: `GroupsPage` — quitar Header, registrar acción primaria

**Files:**
- Modify: `src/pages/GroupsPage.tsx`

- [ ] **Step 1: Actualizar imports**

Cambiar:

```ts
import { useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
```

por:

```ts
import { useNavigate, useOutletContext } from 'react-router-dom'
import type { ClasesOutletContext } from '@/components/layout/ClasesLayout'
```

Cambiar `import { useState, useMemo } from 'react'` por
`import { useState, useMemo, useEffect } from 'react'`.

**Importante — `GroupsPage` se sigue renderizando en DOS rutas**: la nueva
`/clases/grupos` (dentro de `ClasesLayout`, con contexto) y la antigua
`/grupos` (vía `GroupsRouter`, **fuera** de cualquier `Outlet` con
contexto — ver spec, `/grupos` no se redirige). `useOutletContext()` no
lanza excepción por sí solo, pero si no hay ningún `<Outlet context=...>`
ancestro devuelve `undefined` — desestructurar
`const { setPrimaryAction } = useOutletContext(...)` directamente
**rompería la página entera en `/grupos`** con un `TypeError` al intentar
leer `setPrimaryAction` de `undefined`. Por eso aquí NO se desestructura
directamente: se comprueba que el contexto exista antes de usarlo.

- [ ] **Step 2: Obtener el contexto (de forma segura)**

Justo después de `const { user } = useAuthStore()` (línea 75), añadir:

```ts
  const clasesContext = useOutletContext<ClasesOutletContext | undefined>()
```

- [ ] **Step 3: Registrar la acción primaria**

Justo antes de `return (` (hoy en torno a la línea 322), añadir:

```ts
  useEffect(() => {
    if (!clasesContext) return
    if (isEntrenador) {
      clasesContext.setPrimaryAction(null)
      return
    }
    clasesContext.setPrimaryAction({ label: 'Nuevo grupo', icon: Plus, onClick: openCreateDialog })
    return () => clasesContext.setPrimaryAction(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEntrenador, clasesContext])
```

En `/grupos` (fuera de `ClasesLayout`), `clasesContext` es `undefined` y el
efecto no hace nada — el comportamiento de esa ruta no cambia en absoluto.
En `/clases/grupos`, `clasesContext` existe y el botón se registra
normalmente.

(`Plus` ya está importado. `openCreateDialog` está declarado como `const`
en la línea 181, antes de este punto de inserción — sin problemas de
hoisting.)

- [ ] **Step 4: Quitar el `<Header>` y mover "Exportar PDF" a la fila de filtros**

Cambiar:

```tsx
      <Header
        title="Grupos"
        subtitle={
          (search || levelFilter || coachFilter || (seasonFilter !== '' && seasonFilter !== ALL_SEASONS))
            ? `${filteredGroups.length} grupos encontrados`
            : (seasonFilter === ALL_SEASONS || (seasonFilter === '' && !club?.activeSeasonId))
              ? `${activeGroupsCount} activos · ${groups.length} total`
              : `${filteredGroups.length} de la temporada actual`
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={filteredGroups.length === 0}>
              <FileDown className="h-4 w-4 mr-1" />
              Exportar PDF
            </Button>
            {!isEntrenador && (
              <Button size="sm" onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-1" />
                Nuevo grupo
              </Button>
            )}
          </div>
        }
      />

      <div className="p-6 space-y-4">
```

por:

```tsx
      <div className="p-6 space-y-4">
```

Localizar el bloque del selector de vista (toggle Tarjetas/Lista) dentro de
la fila de filtros — es el único `<div className="flex items-center border rounded-md shrink-0">`
del archivo, con los botones `LayoutGrid`/`List` dentro. Ese bloque hoy es
el último hijo de la fila de filtros, así que su `</div>` de cierre es
inmediatamente seguido por el `</div>` que cierra toda la fila. Insertar el
botón "Exportar PDF" justo entre esos dos `</div>` (es decir, después del
toggle de vista, como nuevo último hijo de la fila):

```tsx
          </div>
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={filteredGroups.length === 0}>
            <FileDown className="h-4 w-4 mr-1" />
            Exportar PDF
          </Button>
        </div>
```

(El primer `</div>` de este fragmento es el cierre del toggle de vista, ya
existente — no duplicarlo. Solo se inserta el `<Button>` de en medio antes
del `</div>` final de la fila de filtros, también ya existente.)

El subtítulo dinámico basado en `search`/`levelFilter`/etc. que vivía en el
`<Header>` **se elimina** — ya no se muestra en ningún sitio (el topbar
compartido ahora muestra su propio subtítulo estático "X activos · Y
total", ver `ClasesLayout`). No hace falta añadir nada más aquí.

- [ ] **Step 5: Verificar que compila**

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 6: Verificación manual en navegador**

1. Ir a `/clases/grupos` como `director`.
2. Verificar: topbar "CLASES" + subtítulo "X activos · Y total" +
   `SeasonSwitcher` + botón "Nuevo grupo"; sin doble cabecera; fila de
   filtros con buscador, ordenar, entrenador, nivel, temporada, toggle
   vista y el nuevo botón "Exportar PDF" al final; el resto (tarjetas/lista
   de grupos, diálogos) funciona igual que antes.
3. Repetir como `entrenador`: sin botón "Nuevo grupo" en el topbar (ya que
   `setPrimaryAction(null)` se llama cuando `isEntrenador`), grupos
   filtrados a los propios (comportamiento ya existente, sin cambios).
4. Visitar `/grupos` directamente (la ruta antigua, fuera de
   `ClasesLayout`) y confirmar que la página carga sin errores en consola
   ni pantalla en blanco — es la comprobación crítica de que
   `useOutletContext` devolviendo `undefined` ahí no rompe nada.

- [ ] **Step 7: Commit**

```bash
git add src/pages/GroupsPage.tsx
git commit -m "refactor: GroupsPage usa el topbar compartido de ClasesLayout"
```

---

### Task 6: `AttendancePage` — quitar Header de la vista principal

**Files:**
- Modify: `src/pages/AttendancePage.tsx`

- [ ] **Step 1: Actualizar imports**

Cambiar:

```ts
import { useSearchParams } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
```

por:

```ts
import { useSearchParams, useOutletContext } from 'react-router-dom'
import type { ClasesOutletContext } from '@/components/layout/ClasesLayout'
```

`useEffect` ya está importado en este archivo (`import { useState, useMemo, useEffect } from 'react'`).

**Importante**: este archivo tiene OTROS 2 usos de `<Header>` que **no se
tocan** (ver spec, sección "Caso especial: AttendancePage"):
- Línea ~536: `<Header title="Mi Asistencia" .../>`, dentro de un
  `if (isPlayerOrTutor) { return (...) }` que corta la ejecución ANTES de
  llegar a los `if` de `pageView` — es la vista de solo-lectura para
  jugador/tutor, no un valor de `pageView`.
- Línea ~560: `<Header title="Historial de Asistencia" .../>`, dentro de
  `if (pageView === 'calendar' && sheetGroup) { return (...) }`.

Solo se elimina el `<Header>` del `return` final de la función (después de
todos los `if` anteriores, incluido `pageView === 'sheet'` que no tiene
ningún `<Header>`) — esa es la vista principal, la que corresponde a
entrar a la pestaña Asistencia desde `ClasesLayout`. Por eso NO se puede
quitar el import de `Header` — sigue haciendo falta para esos otros 2
usos.

**Importante — mismo caso que `GroupsPage` (Task 5)**: `AttendancePage`
también se sigue renderizando en `/asistencia` (fuera de `ClasesLayout`,
sin contexto) además de en la nueva `/clases/asistencia`. No desestructurar
`useOutletContext(...)` directamente — usar la misma variante opcional.

- [ ] **Step 2: Obtener el contexto (de forma segura)**

Cerca del inicio del componente (junto a otras llamadas a hooks como
`useDataStore`/`useAuthStore`), añadir:

```ts
  const clasesContext = useOutletContext<ClasesOutletContext | undefined>()
```

- [ ] **Step 3: Registrar (la ausencia de) acción primaria**

Justo antes del `return (` final del componente (el de la vista
`'selector'`, en torno a la línea 576-577), añadir:

```ts
  useEffect(() => {
    clasesContext?.setPrimaryAction(null)
    return () => clasesContext?.setPrimaryAction(null)
  }, [clasesContext])
```

(Asistencia no tiene acción primaria según el spec — este efecto solo
asegura que no quede un botón de otra pestaña visible al entrar aquí,
aunque en la práctica `setPrimaryAction(null)` en el mount ya lo cubre; se
incluye por claridad y simetría con el resto de páginas. En `/asistencia`,
`clasesContext` es `undefined` y el `?.` hace que no pase nada.)

- [ ] **Step 4: Quitar el `<Header>` de la vista principal y mover "Exportar"**

Cambiar (el `return` final, después de los `if (pageView === 'sheet' ...)`
y `if (pageView === 'calendar' ...)`):

```tsx
  return (
    <div className="flex flex-col h-full">
      <Header
        title="Asistencia"
        subtitle="Registro de asistencia de los grupos"
        actions={
          <Button variant="outline" size="sm" onClick={handleOpenExportDialog}>
            <Download className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-6">
```

por:

```tsx
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-6">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={handleOpenExportDialog}>
            <Download className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>
        </div>
```

- [ ] **Step 5: Verificar que compila**

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 6: Verificación manual en navegador**

1. Ir a `/clases/asistencia` como `director`.
2. Verificar: topbar "CLASES" + subtítulo "Registro de asistencia de los
   grupos" + `SeasonSwitcher`, sin botón de acción primaria; sin doble
   cabecera; botón "Exportar" ahora visible dentro del contenido, alineado
   a la derecha, justo antes del banner de "próxima clase"/lista de
   grupos; el resto (selector de grupo, tomar asistencia, historial) sigue
   funcionando exactamente igual, incluidas las vistas `'sheet'` y
   `'calendar'` que conservan su propio `<Header>` sin tocar.
3. Visitar `/asistencia` directamente (la ruta antigua, fuera de
   `ClasesLayout`) y confirmar que carga sin errores en consola ni pantalla
   en blanco — comprobación crítica de que `useOutletContext` devolviendo
   `undefined` ahí no rompe nada. Si hay un usuario `jugador`/`tutor` de
   prueba, confirmar también que su vista "Mi Asistencia" en `/asistencia`
   sigue intacta.

- [ ] **Step 7: Commit**

```bash
git add src/pages/AttendancePage.tsx
git commit -m "refactor: AttendancePage usa el topbar compartido de ClasesLayout en su vista principal"
```

---

### Task 7: `EventsActivitiesPage` — quitar Header, registrar acción primaria

**Files:**
- Modify: `src/pages/EventsActivitiesPage.tsx`

(La prop `initialTab` ya se añadió en la Task 3 — esta task completa la
migración al topbar compartido.)

- [ ] **Step 1: Actualizar imports**

Cambiar:

```ts
import { useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
```

por:

```ts
import { useNavigate, useOutletContext } from 'react-router-dom'
import type { ClasesOutletContext } from '@/components/layout/ClasesLayout'
```

Cambiar `import { useState, useMemo } from 'react'` por
`import { useState, useMemo, useEffect } from 'react'`.

- [ ] **Step 2: Obtener `setPrimaryAction` del contexto**

Justo después de `const { user } = useAuthStore()` (línea 56), añadir:

```ts
  const { setPrimaryAction } = useOutletContext<ClasesOutletContext>()
```

- [ ] **Step 3: Registrar la acción primaria**

Justo antes de `return (` (hoy en torno a la línea 540), añadir:

```ts
  useEffect(() => {
    setPrimaryAction({
      label: 'Nueva clase',
      icon: Plus,
      items: [
        { label: 'Nuevo evento', icon: CalendarPlus, onClick: openNewEventDialog },
        { label: 'Nueva clase particular', icon: Plus, onClick: openNewLessonDialog },
      ],
    })
    return () => setPrimaryAction(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setPrimaryAction])
```

(`CalendarPlus` y `Plus` ya están importados. Sin distinción por
`isEntrenador` aquí — a diferencia de `AgendaPage`, `EventsActivitiesPage`
no oculta "Nuevo evento" para entrenador hoy; no se introduce ese cambio de
comportamiento, se mantiene igual que ya estaba en su `<Header>` actual.)

- [ ] **Step 4: Quitar el `<Header>` del render**

Cambiar:

```tsx
      <Header
        title="Eventos y Actividades"
        subtitle={`${eventsCount} eventos · ${lessonsCount} clases particulares`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={openNewEventDialog}>
              <CalendarPlus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Nuevo evento</span>
            </Button>
            <Button size="sm" onClick={openNewLessonDialog}>
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Nueva clase</span>
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-4">
```

por:

```tsx
      <div className="p-6 space-y-4">
```

- [ ] **Step 5: Verificar que compila**

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 6: Verificación manual en navegador**

1. Ir a `/clases/eventos` como `director`. Verificar: topbar "CLASES" +
   subtítulo "X eventos" + botón "Nueva clase" con menú (Nuevo evento /
   Nueva clase particular); pestaña interna "Eventos" preseleccionada
   (`activeTab === 'events'`); sin doble cabecera.
2. Ir a `/clases/particulares`. Verificar: subtítulo "X clases
   particulares"; pestaña interna "Clases Particulares" preseleccionada
   (`activeTab === 'private'`); mismo botón de acción primaria (es la misma
   página).
3. Confirmar que cambiar manualmente entre las 3 sub-pestañas internas
   (Todos/Eventos/Clases Particulares) dentro de cualquiera de las 2 rutas
   sigue funcionando igual que antes (comportamiento interno sin cambios).

- [ ] **Step 7: Commit**

```bash
git add src/pages/EventsActivitiesPage.tsx
git commit -m "refactor: EventsActivitiesPage usa el topbar compartido de ClasesLayout"
```

---

### Task 8: Verificación final del conjunto

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Build y tests completos**

Run: `npm run build`
Expected: sin errores.

Run: `npm test`
Expected: mismo número de tests que el baseline antes de este plan (ninguna
de estas páginas tiene tests dedicados, así que la cifra no debería
cambiar).

- [ ] **Step 2: Recorrido manual completo de las 6 pestañas**

1. `npm run dev`, sesión como `director`.
2. Navegar por las 6 pestañas (`/clases/parrilla`, `/grupos`, `/asistencia`,
   `/particulares`, `/eventos`, `/metodologia`) usando los tabs, no la URL
   directamente. Confirmar en cada una: subtítulo correcto, botón/menú de
   acción primaria correcto (o ausente en Asistencia/Metodología), sin
   botón "fantasma" de la pestaña anterior, `SeasonSwitcher` visible y
   funcional en las 6.
3. Confirmar que `/clases/metodologia` muestra `MethodologyPage` con su
   propio `<h1>` y botón "Nuevo Parámetro" tal cual, debajo del topbar de
   Clases (doble título aceptado, ver spec).
4. Verificar en la consola del navegador que no hay errores nuevos
   (aparte del ya conocido y no relacionado de `matchReports`).
5. Repetir el recorrido como `entrenador`: confirmar que ahora ve las 6
   pestañas (antes solo tenía 3 vías separadas) y que cada página sigue
   mostrando solo sus propios grupos/eventos/clases (comportamiento ya
   existente, sin cambios de esta fase).
6. Verificar que `/grupos` y `/asistencia` siguen funcionando exactamente
   igual que antes de este plan para un usuario `jugador` o `tutor` de
   prueba (si hay alguno disponible) — no deben redirigir ni mostrar el
   topbar de Clases.
7. Verificar los redirects: visitar `/agenda`, `/eventos`, `/methodology`
   directamente en la URL y confirmar que llevan a
   `/clases/parrilla`, `/clases/eventos`, `/clases/metodologia`
   respectivamente.

- [ ] **Step 3: Repetir el proceso de `subagent-driven-development`**

Tras completar las Tasks 1-7 (cada una con su implementador + revisor de
spec + revisor de calidad), dispatch un revisor final sobre el diff
completo de este plan (rango: desde el commit anterior a la Task 1 de este
plan, hasta el HEAD tras la Task 7). Después, usar
`superpowers:finishing-a-development-branch`.
