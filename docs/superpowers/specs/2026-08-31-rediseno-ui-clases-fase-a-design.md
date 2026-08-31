# Rediseño de interfaz — Módulo Clases, Fase A (topbar unificado + 6 pestañas)

## Contexto

Continuación del rediseño de `san javier.pen`, rama `claude/rediseno-ui`, tras
cerrar Hoy/Dashboard y Personas completo. El sidebar (Fase 1) apunta hoy
"Clases" a una sola página provisional (`/agenda`), igual que le pasaba a
Personas antes de su Fase 2.

Mockups de referencia en `san javier.pen`: `X60Ar` ("05 · Clases / Parrilla"),
`adT95` ("06 · Clases / Grupos"), `uJtl6` ("03 · Clases / Asistencia"),
`MorHZ` ("07 · Clases / Particulares"), `f57Q4` ("08 · Clases / Eventos").
El tab-bar de estos 5 mocks incluye una 6ª pestaña, "Metodología", sin mock
propio.

**Corrección tras revisar el código** (esto invalida lo que se dijo más
abajo sobre crear un placeholder): `src/pages/MethodologyPage.tsx` **ya
existe** (314 líneas, gestión de "parámetros de metodología" por
categoría/nivel con CRUD completo) y ya está enrutado en
`/methodology` — pero huérfano, sin ningún enlace desde el sidebar ni desde
ninguna otra página. No hace falta crear nada nuevo para la pestaña
Metodología: solo enlazar esta página ya construida bajo
`/clases/metodologia`. (`PlanningPage.tsx` en `/planificacion` es un
huérfano similar pero no corresponde a ninguna pestaña de este mock — se
deja fuera, sin tocar.)

**Alcance decidido con el usuario para esta fase (Fase A):** solo el topbar +
barra de 6 pestañas compartidos, enlazando las páginas ya existentes **tal
cual** (sin rediseñar su contenido interno). El rediseño visual completo de
cada pestaña (convertir Grupos de tarjetas a lo que corresponda, rehacer
Asistencia según el mock de dos columnas, construir Particulares/Eventos
con KPIs, etc.) queda para una fase futura por pestaña — igual que
Entrenadores/Usuarios tuvieron su propia fase tras el topbar de Personas.

Módulo de gran tamaño: ~5300 líneas repartidas en `AgendaPage.tsx` (1104),
`GroupsPage.tsx` (878), `AttendancePage.tsx` (1259, con 3 vistas internas
distintas), `EventsActivitiesPage.tsx` (929) — mucho mayor que Personas, de
ahí la decisión explícita de fasear por pestaña en vez de un solo plan
gigante.

## Alcance de esta fase (Fase A)

1. `ClasesLayout` nuevo (análogo a `PersonasLayout`): topbar (título CLASES +
   subtítulo dinámico por pestaña + `SeasonSwitcher` + botón/menú de acción
   primaria) + barra de 6 pestañas (Parrilla · Grupos · Asistencia ·
   Particulares · Eventos · Metodología).
2. Rutas anidadas bajo `/clases/*` con redirects desde las rutas actuales.
3. `AgendaPage`, `GroupsPage`, `AttendancePage` (solo su vista principal
   "selector"), `EventsActivitiesPage` pierden su `<Header>` propio; sus
   acciones se reubican (al topbar si son "crear algo", al cuerpo de la
   página si no encajan como acción primaria). Nada más de su contenido
   cambia.
4. `EventsActivitiesPage` gana un prop `initialTab` para que
   `/clases/eventos` y `/clases/particulares` la reutilicen con su pestaña
   interna ya existente preseleccionada (ya tiene lista de eventos Y de
   clases particulares con búsqueda/filtros/scoping por entrenador — no
   hace falta página nueva).
5. `/clases/metodologia` enlaza el `MethodologyPage.tsx` **ya existente**
   (hoy huérfano en `/methodology`) — sin crear nada nuevo, sin tocar su
   contenido interno.
6. Entrenador pasa a ver las 6 pestañas (hoy solo veía 3 vías separadas:
   `/agenda`, `/grupos`, `/asistencia`) — no hace falta lógica nueva de
   filtrado de datos porque las 4 páginas reales ya filtran por
   `isEntrenador && currentCoach` internamente.

Fuera de alcance: el diseño visual interno de cualquiera de las 6 páginas
(colores, tarjetas vs. tabla, el layout de dos columnas de Asistencia, los
KPIs de Particulares/Eventos del mock, etc.); las vistas `sheet`/`calendar`
de `AttendancePage` (tomar asistencia, historial) — siguen sin `<Header>`
propio, sin cambios; `ClassDetailPage`, `GroupDetailPage`, `EventDetailPage`,
`PrivateLessonDetailPage` (rutas `:id`, fuera del layout nuevo, igual que
`/jugadores/:id` quedó fuera de `PersonasLayout`); el buscador del topbar
(ver más abajo); la duplicación histórica de "Clases" y "Calendario"
apuntando ambos a `/agenda` en el sidebar — se corrige de rebote al
actualizar los `href`, pero no es un objetivo en sí.

## 1. Rutas y `ClasesLayout`

### Nuevas rutas (en `src/AuthenticatedApp.tsx`)

```
/clases                → Navigate replace a /clases/parrilla
/clases/parrilla       → ClasesLayout > AgendaPage
/clases/grupos         → ClasesLayout > GroupsPage (directamente, sin GroupsRouter — ver nota)
/clases/asistencia     → ClasesLayout > AttendancePage
/clases/particulares   → ClasesLayout > EventsActivitiesPage initialTab="private"
/clases/eventos        → ClasesLayout > EventsActivitiesPage initialTab="events"
/clases/metodologia    → ClasesLayout > MethodologyPage (ya existente, hoy huérfana en /methodology)
```

Redirects de compatibilidad — **solo para las dos rutas que hoy sirven
exclusivamente a personal del club**:

```
/agenda       → Navigate replace a /clases/parrilla    (rutas :id/:date no cambian)
/eventos      → Navigate replace a /clases/eventos      (/eventos/:id no cambia)
/methodology  → Navigate replace a /clases/metodologia  (huérfana hoy, sin riesgo de romper nada)
```

**`/grupos` y `/asistencia` NO se redirigen** — a diferencia de `/agenda` y
`/eventos`, estas dos rutas hoy sirven contenido distinto según el rol:

- `/grupos` pasa hoy por `GroupsRouter` (`src/AuthenticatedApp.tsx:85-92`),
  que renderiza `PlayerGroupsPage` para jugador/tutor y `GroupsPage` para el
  resto. `PlayerGroupsPage` no tiene ninguna otra ruta propia.
- `/asistencia` renderiza `AttendancePage`, que internamente comprueba
  `activeRole === 'jugador' || 'tutor'` y muestra su propia vista "Mi
  Asistencia" — y `PlayerDashboard.tsx` enlaza activamente a `/asistencia`
  desde el portal de jugador/tutor (no es un caso residual/de bookmark, es
  navegación real y viva hoy).

Redirigir cualquiera de las dos anidaría por error la vista de jugador/tutor
dentro del `ClasesLayout` (pensado solo para
director/coordinador/entrenador). En su lugar, `/clases/grupos` y
`/clases/asistencia` son rutas **nuevas y paralelas** que renderizan
`GroupsPage`/`AttendancePage` directamente (sin pasar por `GroupsRouter`,
que no hace falta aquí porque solo el personal del club llega a estas URLs
vía el sidebar). `/grupos` y `/asistencia` siguen existiendo exactamente
como hoy, sin tocar, sirviendo a jugador/tutor.

`/clases-particulares/:id` no cambia (ruta de detalle, ya vive fuera de
cualquier layout de listado).

### Sidebar (`src/components/layout/Sidebar.tsx`)

- El item "Clases" (línea 45) cambia su `href` de `/agenda` a
  `/clases/parrilla`.
- El item "Calendario" (línea 46, hoy también apunta a `/agenda` —
  duplicado histórico) cambia igualmente a `/clases/parrilla`.
- `coachSettingsItems` (`Grupos` → `/grupos`, `Asistencia` → `/asistencia`,
  líneas 58-61) actualizan sus `href` a `/clases/grupos` y
  `/clases/asistencia`.
- `coachAllowedPaths` (línea 98) se amplía para incluir las 6 rutas nuevas
  de Clases (antes solo cubría `/agenda`, `/grupos`, `/asistencia`).

### `ClasesLayout` (nuevo, `src/components/layout/ClasesLayout.tsx`)

Mismo patrón que `PersonasLayout`: `PersonasOutletContext`-equivalente
(`ClasesOutletContext`) con `setPrimaryAction` (sin `search` — ver más
abajo por qué esta fase no unifica el buscador), expuesto vía
`useOutletContext`.

- Título fijo "CLASES".
- Subtítulo dinámico por pestaña, calculado en el layout desde
  `useDataStore` (mismo criterio que `PersonasLayout`):
  - Parrilla: `"Vista diaria de pistas y horarios"` (texto estático, igual
    que ya muestra `AgendaPage` hoy).
  - Grupos: `"${activos} activos · ${total} total"` (simplificación respecto
    al subtítulo actual de `GroupsPage`, que cambia dinámicamente con sus
    propios filtros internos — el layout no tiene visibilidad de esos
    filtros; ver "Fuera de alcance/riesgos").
  - Asistencia: `"Registro de asistencia de los grupos"` (estático, igual
    que hoy).
  - Particulares: `"${lessonsCount} clases particulares"` (mismo cálculo que
    ya hace `EventsActivitiesPage`).
  - Eventos: `"${eventsCount} eventos"` (idem).
  - Metodología: sin subtítulo (la página ya existente gestiona su propio
    contenido; no hay ningún agregado obvio que mostrar desde el layout).
- **Sin buscador en el topbar.** Cada página ya tiene su propio buscador
  funcional en su fila de filtros interna (`GroupsPage`,
  `EventsActivitiesPage`); duplicarlo en el topbar sin conectarlo (como el
  de "Hoy") sería confuso, y conectarlo de verdad requeriría tocar el
  filtrado interno de cada página — eso se hace cuando cada pestaña tenga
  su propia fase de rediseño, replicando entonces el patrón ya usado en
  Personas (`useOutletContext` con `search`).
- `SeasonSwitcher` (recuperado de `src/components/layout/Header.tsx`) en el
  topbar, junto al botón de acción primaria. `ChildSwitcher` NO se recupera
  aquí — es una función de portal (tutor), sin relación con las páginas de
  Clases (director/coordinador/entrenador).
- Botón/menú de acción primaria por pestaña (vía `setPrimaryAction`, mismo
  tipo `ClasesPrimaryAction` que `PersonasPrimaryAction` — botón simple o
  dropdown con `items`):
  - Parrilla: dropdown con "Nuevo evento" (oculto si `isEntrenador`) +
    "Nueva clase particular" — mismas dos acciones que ya tiene el `<Header>`
    de `AgendaPage`.
  - Grupos: botón simple "Nuevo grupo" (oculto si `isEntrenador`). El botón
    "Exportar PDF" que hoy vive en el `<Header>` de `GroupsPage` baja al
    cuerpo de la página (fila de filtros), no ocupa el slot de acción
    primaria.
  - Asistencia: sin acción primaria (no hay un "crear" natural en esta
    pantalla). El botón "Exportar" que hoy vive en su `<Header>` baja al
    cuerpo de la página.
  - Particulares / Eventos: dropdown con "Nuevo evento" + "Nueva clase" —
    mismas dos acciones que ya tiene el `<Header>` de
    `EventsActivitiesPage` (idéntico en ambas pestañas, ya que es la misma
    página con distinto `initialTab`).
  - Metodología: sin acción primaria (la página ya tiene su propio botón
    "Nuevo parámetro" dentro de su contenido, sin tocar).
- Barra de 6 pestañas con contador donde tenga sentido (Grupos: nº grupos
  activos; Eventos: nº eventos activos; Particulares: nº clases
  particulares; Parrilla/Asistencia/Metodología: sin contador, igual que
  "Jugadores"/"Entrenadores" sí lo tenían pero un contador de "clases de
  hoy" no aporta lo mismo aquí — se deja sin badge por simplicidad de esta
  fase).
- Visibilidad de pestañas: las 6 se muestran para cualquier rol que llegue a
  esta ruta (director, coordinador, entrenador) — no hay filtrado por
  `hasPermission` como en Personas, porque Clases no tiene ese concepto de
  módulos separados por pestaña; el filtrado de qué VE cada entrenador
  ocurre dentro de cada página (ya implementado), no a nivel de pestañas.

## 2. Cambios en las 4 páginas existentes

Patrón idéntico en las 4 (mismo que `PlayersPage`/`UsersPage` en Personas):

- Se elimina el `<Header title=... subtitle=... actions=.../>` propio.
- Se añade `const { setPrimaryAction } = useOutletContext<ClasesOutletContext>()`
  y un `useEffect` que registra la acción primaria correspondiente (ver
  arriba) con cleanup `setPrimaryAction(null)`.
- Los botones que no encajan como acción primaria (Exportar PDF en Grupos,
  Exportar en Asistencia) se mueven a una fila propia dentro del `<div>` de
  contenido de la página (donde antes empezaba justo debajo del `<Header>`),
  sin alterar el resto del layout interno.

### Caso especial: `AttendancePage`

Esta página tiene 3 `return` distintos según `pageView` (`'selector'`,
`'sheet'`, `'calendar'`), cada uno con su propio `<Header>` (o sin ninguno,
en el caso de `'sheet'`). Solo se toca el `<Header>` de la vista
`'selector'` (la que corresponde a "entrar a la pestaña Asistencia" desde
`ClasesLayout`) — las vistas `'sheet'`/`'calendar'` son navegación interna
dentro del mismo componente (no rutas propias) y se quedan exactamente
como están.

**Corrección tras verificar en navegador**: `pageView` es estado interno
de este componente, no un cambio de ruta — así que el topbar+pestañas de
`ClasesLayout` (que se decide por routing, no por este estado) **sigue
visible** encima de las 3 vistas, incluida `'sheet'`, aunque esta última no
tenga su propio `<Header>`. No es posible "esconder" el layout padre desde
un estado interno del hijo sin reestructurar las rutas (convertir
`'sheet'`/`'calendar'` en rutas propias), algo fuera de alcance de esta
fase. En la práctica el resultado es aceptable — la barra ocupa algo de
espacio vertical pero no rompe la tarea de pasar lista — así que se deja
así; la afirmación anterior de que estas vistas "se quedan sin el topbar
compartido" era incorrecta y se corrige aquí.

### Caso especial: `EventsActivitiesPage`

Se añade una prop nueva:

```ts
interface EventsActivitiesPageProps {
  initialTab?: 'all' | 'events' | 'private'
}
export default function EventsActivitiesPage({ initialTab = 'all' }: EventsActivitiesPageProps)
```

`activeTab` se inicializa con `initialTab` en vez de `'all'` (mismo patrón
que `initialStatusFilter` en `PlayersPage`). `/clases/eventos` renderiza
`<EventsActivitiesPage initialTab="events" />`, `/clases/particulares`
renderiza `<EventsActivitiesPage initialTab="private" />`. El resto de la
página (contenido, filtros, tabs internos, diálogos) no cambia.

## 3. `MethodologyPage` (ya existente, sin cambios)

Se enruta tal cual bajo `/clases/metodologia`, sin tocar ni una línea de su
contenido. No usa el `<Header>` compartido (tiene su propio `<h1>Metodología
(Catálogo Global)</h1>` + botón "Nuevo Parámetro" inline, no el componente
`@/components/layout/Header`), así que no aplica el patrón de "quitar
Header + registrar primaryAction" de la sección 2 — se queda con su propio
título duplicado debajo del topbar de Clases, igual que `CoachesPage`
y `UsersPage` convivieron con su propio `<Header>` bajo la barra de
pestañas de Personas antes de su propia fase de rediseño.

## Fuera de alcance / riesgos conocidos

- El subtítulo de Grupos en el mock (y en la implementación actual de
  `GroupsPage`) reacciona a los filtros internos de la página (nº de
  resultados al buscar/filtrar); en esta fase el layout no tiene visibilidad
  de esos filtros (no expone `search` todavía), así que el subtítulo del
  topbar se simplifica a un agregado estático (`activos · total`) que NO
  cambia al buscar dentro de la página. Se pierde algo de reactividad
  visual, aceptado como parte de "sin rediseñar por dentro".
- `AttendancePage`'s vistas `'sheet'`/`'calendar'` quedan sin el topbar
  compartido — ver "Caso especial" arriba.
- La duplicación "Clases"/"Calendario" en el sidebar apuntando a la misma
  URL no se investiga ni se resuelve más allá de actualizar ambos `href` al
  mismo destino nuevo — si son redundantes de verdad, es una decisión para
  otra sesión.
- No existe mock propio para "Metodología" en `san javier.pen` — su diseño
  visual actual (`MethodologyPage.tsx`, ya existente) queda tal cual hasta
  que le toque su propia fase, igual que las otras 4 páginas.
- `PlanningPage.tsx` (`/planificacion`) es otro huérfano de navegación
  similar a `MethodologyPage` pero no corresponde a ninguna pestaña de este
  mock — se queda exactamente como está (huérfano), sin redirect ni enlace
  nuevo. No confundirlo con Metodología al tocar rutas.
