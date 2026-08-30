# Rediseño de interfaz — Módulo Personas completo (topbar unificado + Entrenadores + Usuarios)

## Contexto

Continuación del rediseño de `san javier.pen`, rama `claude/rediseno-ui`. La Fase 2
(`docs/superpowers/specs/2026-08-29-rediseno-ui-fase2-personas-design.md`) dejó
las 4 pestañas de Personas funcionando bajo rutas anidadas, pero con dos
desviaciones deliberadas del mock que esta fase resuelve:

1. `PersonasLayout` solo renderiza la barra de pestañas; el topbar unificado
   (título + buscador + botón primario) que muestra el mock por encima de las
   pestañas no existía — cada página (`PlayersPage`, `CoachesPage`,
   `UsersPage`) traía su propio header.
2. `CoachesPage` y `UsersPage` quedaron "sin cambios internos" — visualmente
   pertenecen al diseño antiguo (tarjetas, `Header` clásico, colores previos).

Mockup de referencia en `san javier.pen`: nodo `T0o5x` ("02 · Personas /
Jugadores") — es la única pantalla de Personas con mock explícito; no existen
mocks dedicados para Entrenadores ni Usuarios. Esta fase aplica el mismo
lenguaje visual del mock a esas dos pestañas por consistencia, sin un mock
pixel-a-pixel que seguir.

Confirmado con el usuario: el módulo Personas completo (las 4 pestañas) solo
es accesible para `director`/`coordinador` — no hace falta diseñar una
variante reducida para `entrenador`.

## Alcance de esta fase

1. Topbar unificado en `PersonasLayout`, compartido por las 4 pestañas.
2. `PlayersPage` pierde su topbar propio (pasa a vivir en el layout); resto
   sin cambios.
3. Reescritura completa de `CoachesPage`: de tarjetas/lista con `Header`
   antiguo a una tabla única en el lenguaje visual de Jugadores.
4. Restructuración de `UsersPage`: se eliminan su título/descripción y sus 3
   botones propios (absorbidos por el topbar); sus 3 sub-vistas pasan a
   pestañas secundarias bajo la barra de pestañas de Personas.

Fuera de alcance: `CoachProfilePage`, `PlayerProfilePage`, la lógica de
negocio de invitaciones/salarios/roles/portal (sin cambios), los diálogos de
creación/edición de cada página (sin cambios internos), las rutas
`/entrenadores/:id` y los redirects de compatibilidad ya existentes
(`/jugadores`, `/entrenadores`, `/usuarios`), y los módulos
Clases/Finanzas/Deportivo/Calendario.

## 1. Topbar unificado en `PersonasLayout`

### Mecanismo: Outlet context

`PersonasLayout` pasa a poseer el estado de búsqueda y el botón de acción
primaria, comunicándolos a la página activa vía `useOutletContext`:

```ts
// src/components/layout/PersonasLayout.tsx
export interface PersonasPrimaryAction {
  label: string
  icon?: LucideIcon
  onClick?: () => void
  items?: { label: string; icon?: LucideIcon; onClick: () => void }[]
}

export interface PersonasOutletContext {
  search: string
  setSearch: (value: string) => void
  setPrimaryAction: (action: PersonasPrimaryAction | null) => void
}
```

Cada página consumidora (`PlayersPage`, `CoachesPage`, `UsersPage`) llama:

```ts
const { search, setSearch, setPrimaryAction } = useOutletContext<PersonasOutletContext>()

useEffect(() => {
  setPrimaryAction({ label: 'Nuevo jugador', onClick: () => { setEditingPlayer(null); setShowCreateDialog(true) } })
  return () => setPrimaryAction(null)
}, [setPrimaryAction])
```

El `return () => setPrimaryAction(null)` evita que el botón de una pestaña
"sobreviva" visualmente un instante al navegar a otra, antes de que el nuevo
`useEffect` registre el suyo.

`search` se resetea a `''` en `PersonasLayout` cada vez que cambia
`location.pathname` (cambiar de pestaña no debe arrastrar el término de
búsqueda de la pestaña anterior).

### Estructura visual (orden: Topbar → Tabs → contenido de la página)

```tsx
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
    {/* ...tabs existentes, sin cambios... */}
  </div>
  <Outlet context={{ search, setSearch, setPrimaryAction }} />
</div>
```

Sin iconos de notificación ni calendario — son específicos del topbar de
"Hoy" (Fase 1) y no aplican aquí, tal como ya decidió la Fase 2 para
Jugadores.

### Subtítulo y placeholder de búsqueda por pestaña

Contadores propios por pestaña (leídos de `useDataStore`, igual que hace hoy
`PersonasLayout` para los badges de las pestañas):

| Pestaña | Subtítulo | Placeholder buscador |
| --- | --- | --- |
| Jugadores / Lista de espera | `${activos} activos · ${listaEspera} en lista de espera · ${total} fichas totales` (igual que hoy) | `Nombre, email o teléfono…` |
| Entrenadores | `${activos} activos · ${total} total` | `Nombre, email o teléfono…` |
| Usuarios | `${personal} personal del club · ${conPortal} con portal activo · ${pendientes} invitaciones pendientes` | `Email o nombre…` |

## 2. `PlayersPage` — quitar topbar propio

Se elimina el bloque `<div className="border-b border-border bg-card">...`
(el que hoy renderiza "PERSONAS" + buscador + "Nuevo jugador", ver
`src/pages/PlayersPage.tsx:457-484`). El resto de la página (fila de
filtros, tabla, paginación, diálogos) no cambia.

`search`/`setSearch` dejan de ser un `useState` local: se leen de
`useOutletContext<PersonasOutletContext>()`. Se registra el botón primario:

```ts
useEffect(() => {
  setPrimaryAction({
    label: 'Nuevo jugador',
    icon: Plus,
    onClick: () => { setEditingPlayer(null); setShowCreateDialog(true) },
  })
  return () => setPrimaryAction(null)
}, [setPrimaryAction])
```

## 3. `CoachesPage` — reescritura completa

Se elimina: el `Header` clásico, la vista de tarjetas, la vista de lista con
`shadcn/Table`, el selector Tarjetas/Lista (`viewMode`), y los imports que
solo servían a esas vistas (`LayoutGrid`, `List`, `Card`/`CardContent` para
tarjetas, `Avatar` grande, etc. — se conserva `Avatar` pequeño para la nueva
columna "Entrenador").

Se mantiene sin cambios: toda la lógica de datos y handlers (`filteredCoaches`,
`getCoachGroups`, `getSalaryConfig`, `getEstimatedSalary`, `handleSubmit`,
`openEditDialog`, `openCreateDialog`, `handleCreateAccount`,
`handleSyncAccounts`, `getStaffRoleLabel`, `getStaffRoleBadgeVariant`), los 4
diálogos (crear/editar, confirmación de borrado, invitación creada,
resultado de sincronización) tal cual están hoy.

### Nueva tabla (mismo patrón `@tanstack/react-table` que `PlayersPage`)

Columnas, en orden (sin columna `select`: a diferencia de Jugadores, no hay
acciones masivas sobre entrenadores en esta fase, así que un checkbox de
selección no tendría para qué servir):

1. **`Entrenador`** — avatar con iniciales + nombre + línea meta con
   `coach.specialization` (si existe; si no, no se muestra la segunda línea).
2. **`Rol`** — `Badge` con `getStaffRoleBadgeVariant`/`getStaffRoleLabel`
   (igual lógica que hoy).
3. **`Grupos`** — número de grupos asignados (`getCoachGroups(coach.id).length`),
   como `Badge variant="outline"`, igual que en la vista de lista actual.
4. **`Salario est.`** — `formatCurrency(getEstimatedSalary(coach.id))`.
5. **`Cuenta`** — `Badge` "Con cuenta" (success) / "Sin cuenta" (secondary),
   igual lógica que hoy (`coach.userId`).
6. **`Estado`** — `Badge` "Activo" (success) / "Inactivo" (secondary),
   igual que hoy (`coach.isActive`).
7. **`actions`** — menú o botones: "Ver perfil" (`/entrenadores/${id}`),
   "Crear cuenta" (solo si `!coach.userId`, llama a `handleCreateAccount`),
   "Editar" (`openEditDialog`), "Eliminar" (`setShowDeleteConfirm`).

Paginación: `getPaginationRowModel`, tamaño de página fijo en 12, mismo pie
de tabla "Mostrando X–Y de N entrenadores" que Jugadores.

### Fila de filtros

Buscador viene del topbar (contexto) — no se repite en esta fila. Fila:
`Select` Rol (`STAFF_ROLES` + "Todos los roles"), `Select` Estado
("Solo activos"/"Todos"), espaciador, botón "Reparar vinculaciones"
(`handleSyncAccounts`, con el mismo spinner/disabled que hoy).

`filteredCoaches` cambia su filtro de búsqueda para usar el `search` del
contexto en vez del `useState` local eliminado.

## 4. `UsersPage` — restructuración de layout

Se elimina el bloque de cabecera propio (`<h1>Gestión de Usuarios</h1>` +
descripción + los 3 botones "Invitar tutores"/"Invitar jugadores"/"Invitar
usuario", ver `src/pages/UsersPage.tsx:411-436`). Esas 3 acciones se mueven
al menú desplegable del botón primario del topbar compartido:

```ts
useEffect(() => {
  setPrimaryAction({
    label: 'Invitar',
    icon: UserPlus,
    items: [
      { label: 'Invitar usuario', icon: UserPlus, onClick: handleOpenDialog },
      { label: 'Invitar tutores', icon: Users, onClick: () => setShowBulkTutorDialog(true) },
      { label: 'Invitar jugadores', icon: Gamepad2, onClick: () => setShowInvitePlayersDialog(true) },
    ],
  })
  return () => setPrimaryAction(null)
}, [setPrimaryAction])
```

Las 3 pestañas actuales (`activeTab`: `invitations`/`staff`/`portal`) se
conservan como estado y lógica, pero cambian de posición y estilo: pasan de
un `<div className="flex gap-1 border-b">` bajo el header eliminado, a una
fila de pestañas secundarias justo debajo de la barra de pestañas de
Personas (mismo componente visual que las pestañas de `PersonasLayout`, pero
más compactas — sin necesidad de contorno propio de página completa).

Filtros (buscador propio de fila — el de "Email o nombre" ya cubierto por el
topbar se retira de aquí — `Select` Rol/Estado según pestaña) y las 3 tablas
(`Invitaciones`, `Personal del club`, `Portal de jugadores`) **no cambian**:
siguen usando `shadcn/Table`, misma lógica de filtrado
(`filteredInvitations`/`filteredStaffUsers`/`filteredPortalUsers`, ahora
usando el `search` del contexto en vez del `searchTerm` local eliminado),
mismos badges y acciones.

`search` se resetea también al cambiar de sub-pestaña interna (mismo
comportamiento que hoy tiene `onClick` de cada tab, que ya limpia
`searchTerm`/`filterRole`/`filterStatus`).

## Fuera de alcance / riesgos conocidos

- No existe mock dedicado para Entrenadores ni Usuarios — el diseño de sus
  tablas sigue el lenguaje visual ya validado en Jugadores (colores, tipos de
  badge, estructura de columnas) por consistencia, no una réplica de un mock
  específico.
- La columna `select` en la tabla de Entrenadores puede omitirse en la
  implementación si no aporta valor sin acciones masivas — decisión final se
  toma en el plan/implementación, no bloquea este spec.
- Las 3 tablas internas de `UsersPage` se quedan en `shadcn/Table` (no se
  portan a `@tanstack/react-table`) — mismo critero de "no tocar lo que
  funciona" aplicado en Fase 2 a estas dos páginas.
- El campo `search` compartido vía Outlet context es una sola cadena de texto
  para las 4 pestañas; cada página decide contra qué campos la compara
  (nombre/email/teléfono para Jugadores y Entrenadores, email/nombre para
  Usuarios) — mismo criterio que ya usaba cada página por separado.
