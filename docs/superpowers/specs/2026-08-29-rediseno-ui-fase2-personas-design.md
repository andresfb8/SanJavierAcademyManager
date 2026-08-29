# Rediseño de interfaz — Fase 2, módulo 1: Personas

## Contexto

Continuación del rediseño de `san javier.pen`. La Fase 1 (mergeada... en curso en
la rama `claude/rediseno-ui`, ver
`docs/superpowers/specs/2026-08-29-rediseno-ui-fase1-sidebar-hoy-design.md`)
dejó el sidebar con 6 items planos, cada uno apuntando de forma **provisional**
a una sola página existente. Esta fase integra las páginas reales bajo el
item "Personas" como pestañas, siguiendo el mapeo ya acordado en el spec de
Fase 1: Jugadores · Lista de espera · Entrenadores · Usuarios.

Mockups de referencia en `san javier.pen`: nodo `T0o5x` ("02 · Personas /
Jugadores").

## Alcance de esta fase

1. Rutas anidadas bajo `/personas` + un layout compartido con la barra de
   pestañas.
2. Rediseño completo de `PlayersPage` (pestañas Jugadores y Lista de espera).
3. `CoachesPage` y `UsersPage` pasan a vivir bajo `/personas/entrenadores` y
   `/personas/usuarios` **sin cambios internos**.
4. Redirects de compatibilidad para las rutas antiguas.

Fuera de alcance: cualquier cambio a `CoachesPage.tsx`, `UsersPage.tsx`,
`PlayerProfilePage.tsx` o `CoachProfilePage.tsx` por dentro; los módulos
Clases/Finanzas/Deportivo/Calendario (fases futuras); paleta de comandos para
el buscador.

## 1. Rutas y layout compartido

### Nuevas rutas (en `src/AuthenticatedApp.tsx`)

```
/personas                    → Navigate replace a /personas/jugadores
/personas/jugadores          → PersonasLayout > PlayersPage
/personas/lista-espera       → PersonasLayout > PlayersPage (con initialStatusFilter="lista_espera")
/personas/entrenadores       → PersonasLayout > CoachesPage
/personas/usuarios           → PersonasLayout > UsersPage (RoleRoute module="users", como hoy)
```

Rutas antiguas se convierten en redirects (para no romper enlaces ya
existentes, incluido el botón "Nuevo jugador" del topbar de "Hoy" creado en
Fase 1, que navega a `/jugadores`):

```
/jugadores            → Navigate replace a /personas/jugadores   (SOLO la lista; /jugadores/:id no cambia)
/entrenadores         → Navigate replace a /personas/entrenadores (/entrenadores/:id no cambia)
/usuarios             → Navigate replace a /personas/usuarios
```

`PlayersRouter` (el wrapper que hoy decide entre `PlayersPage` y la vista de
jugador/tutor) se actualiza para redirigir admin/coordinador/entrenador a
`/personas/jugadores` en vez de renderizar `PlayersPage` directamente.

### `PersonasLayout` (nuevo, `src/components/layout/PersonasLayout.tsx`)

Un componente pequeño, análogo en espíritu a `PlayersRouter`/`GroupsRouter`
pero de layout, no de rol:

- Renderiza **solo** una barra de 4 pestañas (Jugadores · Lista de espera ·
  Entrenadores · Usuarios), cada una con su contador (nº de jugadores
  activos, nº en lista de espera, nº de entrenadores, nº de usuarios — leídos
  de `useDataStore`), y resalta la pestaña activa según la ruta actual
  (`useLocation`).
- Debajo, un `<Outlet />`.
- **No** incluye título, buscador ni botón de acción propios — esos ya los
  aporta cada página individualmente (para no duplicar cabecera con
  `CoachesPage`/`UsersPage`, que no se tocan en esta fase). Esto se aleja
  ligeramente del mock (que muestra un topbar unificado por encima de las
  pestañas); aquí el orden visual es pestañas arriba, cabecera de cada página
  debajo.
- Las pestañas respetan permisos de rol: si el rol activo no tiene acceso a
  `/personas/usuarios` (por `hasPermission`), esa pestaña no se muestra.

### Sidebar

El item "Personas" (`src/components/layout/Sidebar.tsx`) cambia su `href` de
`/jugadores` a `/personas/jugadores`.

## 2. `PlayersPage` — rediseño completo

Cubre las pestañas **Jugadores** y **Lista de espera** (mismo componente).

### Prop nueva

```ts
interface PlayersPageProps {
  initialStatusFilter?: PlayerStatus | ''
}
export default function PlayersPage({ initialStatusFilter = '' }: PlayersPageProps)
```

`statusFilter` se inicializa con `initialStatusFilter` en vez de `''`. La ruta
`/personas/lista-espera` renderiza `<PlayersPage initialStatusFilter="lista_espera" />`.

### Topbar (sustituye al `<Header>` actual)

Igual patrón que el topbar de "Hoy" en Fase 1 (bloque propio, no el
componente `Header` compartido):

- Título "PERSONAS", subtítulo con contadores:
  `${activos} activos · ${listaEspera} en lista de espera · ${total} fichas totales`
  (mismos datos que ya calcula la página hoy en `players.filter(...)`).
- Buscador visual (reutiliza el mismo `search`/`setSearch` que ya existe —
  a diferencia del buscador de "Hoy", este sí queda conectado a filtrado real,
  porque ya lo estaba antes de este cambio).
- Botón "Nuevo jugador" (llama a `setShowCreateDialog(true)`, comportamiento
  igual que hoy).
- Sin iconos de notificación/calendario (esos son específicos del dashboard
  "Hoy"; aquí no aplican).

### Barra de filtros

Fila con, en orden: buscador (si no cabe en el topbar en pantallas
estrechas, se deja aquí como hoy), Nivel, Estado, **Grupo (nuevo)**, **Pago
(nuevo)**, un espaciador, y los botones Importar/Exportar (movidos aquí desde
las acciones del `Header` antiguo).

- **Filtro Grupo (nuevo, funcional):** un `Select` con opciones = nombre de
  cada grupo activo (`groups` de `useDataStore`, filtrado por
  `isGroupCurrentlyActive`) más "Todos los grupos". Filtra jugadores cuyo
  `enrollments` activo (`e.isActive`) tenga `groupId` igual al grupo
  seleccionado.
- **Filtro Pago (nuevo, funcional):** un `Select` con opciones "Todos",
  "Al día", "Pendiente", "Vencido". Se apoya en el mismo cálculo que ya
  existe para pintar la deuda en la fila (`pendingByPlayer`), extendido para
  distinguir vencido de pendiente (ver más abajo).
- El filtro de Portal actual (Activo/Invitación enviada/Sin acceso, solo
  admin) se mantiene tal cual, sin equivalente en el mock — se queda como
  quinto filtro adicional, no descrito en el mock pero sin motivo para
  quitarlo.

### Cálculo de estado de pago por jugador (nuevo)

Extraer (o ampliar junto a) `pendingByPlayer` un mapa adicional:

```ts
type PlayerPaymentStatus = 'al_dia' | 'pendiente' | 'vencido'

const paymentStatusByPlayer = useMemo(() => {
  const now = new Date()
  const map: Record<string, { status: PlayerPaymentStatus; amount: number }> = {}
  for (const p of allPendingPayments) {
    const isOverdue = p.dueDate != null && new Date(p.dueDate) < now
    const prev = map[p.playerId]
    const amount = (prev?.amount || 0) + p.amount
    const status: PlayerPaymentStatus = isOverdue || prev?.status === 'vencido' ? 'vencido' : 'pendiente'
    map[p.playerId] = { status, amount }
  }
  return map
}, [allPendingPayments])
```

(`allPendingPayments` ya viene de `useAllPendingNormalizedPaymentsQuery()`,
usada hoy para `pendingByPlayer`; cada `NormalizedPayment` tiene `playerId` y
un `dueDate` **opcional** — algunos tipos de pago normalizado, p. ej. de
eventos, pueden no tenerlo. Si `dueDate` falta, ese pago cuenta como
"pendiente", nunca como "vencido", para no marcar como vencido algo sin
fecha límite conocida.) Un jugador sin entradas en el mapa está "al_dia".

### Tabla — columnas nuevas

Sustituye las columnas actuales (`select`, `firstName` con avatar/nombre,
`contact`, `level`, `status`, `actions`) por:

1. **`select`** — igual que hoy (checkbox).
2. **`Jugador`** — avatar con iniciales + nombre + línea meta:
   `${p.isMinor ? 'Menor' : 'Adulto'} · ${edad} años` (edad calculada desde
   `p.birthDate`), sustituyendo la línea actual de DNI/menor. El badge de
   deuda (🔴 importe) y las etiquetas de estado de portal (invitado/activo)
   se mantienen igual que hoy. Email/teléfono se retiran de esta vista de
   tabla (siguen visibles en `PlayerProfilePage`).
3. **`Grupo`** (nueva) — nombre del primer grupo activo del jugador
   (`enrollments` con `isActive: true`, `groupId` → `groups.find(...).name`);
   si no tiene ninguno, mostrar "Sin grupo" en texto atenuado.
4. **`Nivel`** — igual que hoy (`StatusBadge` con el nivel).
5. **`Asistencia`** (nueva) — barra de progreso + porcentaje. Calculado como
   asistencias `presente` / total de registros de asistencia del jugador en
   la temporada activa del club (mismo criterio de "temporada activa" que ya
   usa el resto de la app vía `club.activeSeasonId`); si el jugador no tiene
   ningún registro de asistencia, mostrar "Sin datos" en vez de "0%".
6. **`Estado de pago`** (nueva, sustituye a la columna `status` actual del
   jugador) — chip con punto de color + texto, usando
   `paymentStatusByPlayer`: "Al día" (verde/`success`), "Pendiente {importe}"
   (ámbar/`warning`), "Vencido {importe}" (rojo/`destructive`). El **estado
   del jugador** (activo/lista_espera/baja) deja de tener columna propia —
   ya se refleja indirectamente por la pestaña activa (Jugadores vs. Lista
   de espera) y sigue editable desde el menú de acciones de la fila y desde
   el diálogo de edición.
7. **`actions`** — igual que hoy (menú "Ver perfil", "Editar", invitar al
   portal, dar de baja, eliminar).

### Paginación (nueva)

Añadir paginación real con `getPaginationRowModel` de `@tanstack/react-table`
(ya es una dependencia del proyecto), tamaño de página fijo en 12 filas (como
en el mock), con pie de tabla mostrando "Mostrando X–Y de N jugadores" y
controles Anterior/Números de página/Siguiente. El estado de paginación se
reinicia a la página 1 cuando cambia cualquier filtro o el término de
búsqueda.

## Fuera de alcance / riesgos conocidos

- El buscador y las acciones (Importar/Exportar/Nuevo jugador) mantienen
  exactamente la misma lógica de negocio que hoy; solo cambian de sitio en el
  layout.
- El cálculo de "Asistencia" es nuevo; si el rendimiento con 316+ jugadores
  resulta pobre (recorrer todos los registros de asistencia por jugador en un
  `useMemo` por render), se podrá optimizar en una iteración posterior — no
  se bloquea esta fase por eso.
- `CoachesPage`/`UsersPage` quedan con su propio `<Header>` intacto,
  apareciendo debajo de la barra de pestañas compartida — layout ligeramente
  distinto al mock unificado, aceptado conscientemente para no tocar esas dos
  páginas en esta fase.
