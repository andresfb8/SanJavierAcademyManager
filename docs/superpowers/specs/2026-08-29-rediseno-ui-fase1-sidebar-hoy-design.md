# Rediseño de interfaz — Fase 1: Tokens globales + Sidebar + "Hoy"

## Contexto

El usuario diseñó una nueva interfaz completa para San Javier Academy Manager en
`san javier.pen` (pen.dev), con 8 pantallas: Sidebar, Hoy, Personas, Clases (5
sub-vistas: Parrilla, Grupos, Asistencia, Particulares, Eventos), Finanzas.
Es un rediseño visual y de navegación completo, demasiado grande para un solo
cambio, así que se decidió abordarlo por fases. Esta spec cubre únicamente la
**Fase 1**: los tokens de diseño globales, el shell de navegación (Sidebar) y
la página "Hoy" (Dashboard). El resto de páginas (Personas, Clases, Finanzas,
Deportivo, Calendario) se migran en fases posteriores, cada una con su propio
spec.

## Mapeo de navegación acordado (referencia para todas las fases)

El sidebar nuevo tiene **7 items planos, sin agrupar** (el diseño original solo
mostraba 6; "Deportivo" se añadió por decisión del usuario):

| Item | Sub-pestañas (fases futuras) | Página(s) actuales reutilizadas |
|---|---|---|
| Hoy | — | `DashboardPage` (esta fase) |
| Personas | Jugadores · Lista de espera · Entrenadores · Usuarios | `PlayersPage` (+ filtro lista de espera) · `CoachesPage` · `UsersPage` |
| Clases | Parrilla · Grupos · Asistencia · Particulares · Eventos | `AgendaPage` (la grid semanal) · `GroupsPage` · `AttendancePage` · nueva (no existe listado de particulares, solo detalle) · `EventsActivitiesPage` |
| Calendario | (fusionable con Parrilla/Agenda, sin mockup propio) | `AgendaPage` |
| Finanzas | Resumen · Pagos · Facturas · Gastos · Análisis | nuevo resumen · `PaymentsPage` · `InvoicesPage` · `FinancialsPage` (Beneficios y Gastos) · `FinancialAnalyticsPage` |
| Deportivo | Evaluaciones · Informes Mensuales · Analítica · Planificación · Metodología | `EvaluacionesPage` · `ReportsPage` · `AnalyticsPage` · `PlanningPage` · `MethodologyPage` |

Páginas sin hueco en el diseño nuevo (Configuración, Temporadas, Registro de
actividad): se mueven a un icono de ajustes secundario en el sidebar, fuera de
la navegación principal de 7 items.

**Importante:** en esta Fase 1 los 7 items del sidebar son navegación plana
(sin pestañas todavía) que enlaza a una página existente "provisional" como
destino, hasta que a esa sección le toque su propia fase de rediseño con
pestañas:

- Hoy → `/`
- Personas → `/jugadores`
- Clases → `/agenda`
- Calendario → `/agenda`
- Finanzas → `/pagos`
- Deportivo → `/informes-mensuales`

Estos destinos son provisionales y se reemplazarán por los contenedores con
pestañas en cada fase correspondiente.

## Alcance de la Fase 1

1. Tokens de diseño globales (colores, tipografía, radios, sombras) en
   `src/index.css`.
2. Rediseño de `src/components/layout/Sidebar.tsx`: navegación plana de 7
   items + menú secundario de ajustes.
3. Rediseño de `src/pages/DashboardPage.tsx` ("Hoy"): nueva estructura visual
   reutilizando los datos/hooks existentes.

Fuera de alcance (fases futuras): cualquier cambio a Personas, Clases,
Finanzas, Deportivo, Calendario como páginas propias con pestañas; cambios a
`CoachDashboard.tsx` o `PlayerDashboard.tsx` (dashboards de otros roles, no
cubiertos por el mockup "Hoy" que es de vista director/coordinador).

## 1. Tokens de diseño (`src/index.css`)

Reemplazar los valores del bloque `@theme` (manteniendo los mismos nombres de
variable para no romper referencias en el resto de la app):

| Variable | Valor actual | Valor nuevo |
|---|---|---|
| `--color-background` | `#fcfdfe` | `#F4F1EA` |
| `--color-card` | `#ffffff` | `#FFFFFF` |
| `--color-foreground` / `--color-card-foreground` | `#0f172a` | `#16202B` |
| `--color-secondary` / `--color-muted` | `#f1f5f9` | `#F1EEE6` |
| `--color-muted-foreground` | `#64748b` | `#6E7A85` |
| `--color-primary` | `#0891b2` (teal) | `#2A5FD9` (azul) |
| `--color-accent` | `#ecfeff` | `#E5EDFC` |
| `--color-accent-foreground` | `#0891b2` | `#2A5FD9` |
| `--color-border` / `--color-input` | `#e2e8f0` | `#E2DDD1` |
| `--color-ring` | `#0891b2` | `#2A5FD9` |
| `--color-success` | `#10b981` | `#158060` |
| `--color-warning` | `#f59e0b` | `#A96A05` |
| `--color-destructive` | `#ef4444` | `#C13A2B` |
| `--color-sidebar-background` | `#0f172a` (oscuro) | `#FFFFFF` (claro, igual que `--color-card`) |
| `--color-sidebar-foreground` | `#f1f5f9` | `#16202B` |
| `--color-sidebar-primary` | `#0891b2` | `#2A5FD9` |
| `--color-sidebar-accent` | `#1e293b` | `#F1EEE6` |
| `--color-sidebar-border` | `#1e293b` | `#E2DDD1` |

Añadir además colores semánticos nuevos usados en badges/etiquetas del diseño
(niveles, tipos de grupo): `sj-esc`/`sj-esc-fg` (escuela), `sj-adu`/`sj-adu-fg`
(adultos), `sj-com`/`sj-com-fg` (competición), `sj-par`/`sj-par-fg`
(particular), `sj-eve`/`sj-eve-fg` (eventos) — como variables nuevas
`--color-badge-*`, sin sustituir nada existente.

Tipografía: sustituir el `@import` de Google Fonts (quitar Plus Jakarta Sans e
Inter, añadir **Archivo** y **Barlow Condensed**). `body` usa Archivo como
fuente base; los valores numéricos grandes (KPIs, cifras destacadas) usan
Barlow Condensed vía una utilidad nueva (p. ej. clase `.font-num`). Los
`h1`-`h6` pasan de Plus Jakarta Sans a Archivo (weight 700/800).

Radios y sombras: mantener la estructura actual (`--radius-lg` etc.), ajustar
valores solo si el mockup lo requiere visualmente (verificar con capturas del
`.pen` al implementar, sin necesidad de decisión previa aquí).

## 2. Sidebar (`src/components/layout/Sidebar.tsx`)

Reestructurar `navGroups` (hoy: 4 grupos con ~20 items) a una lista plana de 7
`NavItem`, sin `NavGroup`/etiquetas de sección ni lógica de
colapsar/expandir grupo (se elimina `collapsedGroups`, `toggleGroup`,
`renderGroup` en su forma actual de grupos con label):

```
Hoy            → /
Personas       → /jugadores
Clases         → /agenda
Calendario     → /agenda
Finanzas       → /pagos
Deportivo      → /informes-mensuales
```

(Iconos a elegir siguiendo el mockup: Home/LayoutDashboard, Users, GraduationCap,
CalendarDays, CreditCard/Euro, Trophy o similar para Deportivo.)

Añadir un ítem/icono de "Ajustes" separado (footer o header del sidebar) que
despliega: Configuración, Registro de actividad, Temporadas, Usuarios — nota:
Usuarios ya vive bajo Personas en el mapeo de fases futuras, así que aquí en
Fase 1 (donde Personas apunta directo a `/jugadores` sin pestañas) Usuarios se
incluye temporalmente en este menú de ajustes también, hasta que la fase de
Personas cree la pestaña dedicada.

Mantener: filtrado por rol (`hasPermission`, casos especiales de
`jugador`/`tutor`/`entrenador`), el bottom nav móvil (revisar que sus 3-4
accesos directos sigan siendo coherentes con las nuevas rutas), el diálogo de
cambio de contraseña, `RoleSwitcher`, logout.

Rediseño visual del contenedor:
- Logo: badge cuadrado redondeado con "SJ" (sustituye el emoji 🎾 actual) +
  wordmark "SAN JAVIER" / "Academy Manager" en mayúsculas pequeñas.
- Etiqueta de sección "NAVEGACIÓN" sobre la lista de items (texto pequeño,
  mayúsculas, tracking ancho — mismo tratamiento que ya existe para las
  etiquetas de grupo actuales, pero una sola, no por grupo).
- Buscador rápido con atajo "⌘K" y botón "Acción rápida" (nuevo; puede quedar
  como control visual sin funcionalidad de comando todavía — no se define en
  esta fase ninguna paleta de comandos).
- Item activo: fondo `sj-accent-dim` (azul tenue) con texto/icono en color
  `primary`, en vez del actual `bg-primary text-white`.
- Tarjeta de usuario en el pie: avatar circular con iniciales, nombre y rol,
  igual que ahora pero con la nueva paleta.

## 3. Página "Hoy" (`src/pages/DashboardPage.tsx`)

Reestructurar el layout visual (sin tocar la lógica de datos: se siguen
usando `useDataStore`, `useEvaluationsQuery`, `useMatchReportsQuery`,
`useInvoicesQuery`, `useClassReviewsQuery`, `normalizeAllPayments`,
`isGroupCurrentlyActive`, `StatCard`, `IntelligenceCards`,
`SmartAlertsPanel`, etc. — estos ya calculan datos equivalentes a los KPIs del
mockup):

- **Topbar**: título "HOY" + subtítulo (fecha larga + temporada activa),
  buscador ("Buscar jugador, grupo, pago…"), botón icono de notificaciones,
  botón icono de calendario, botón primario "Nuevo jugador".
- **Fila de KPIs** (4 tarjetas): Jugadores activos, Clases hoy, Asistencia
  media, Pendiente de cobro — cada una con valor grande (fuente Barlow
  Condensed) y variación/delta pequeña debajo. Mapear a los `StatCard`
  existentes o adaptar su estilo.
- **Cuerpo en 2 columnas**:
  - Columna izquierda: "Indicadores del club" (métricas del club, posiblemente
    `IntelligenceCards` reestilizado) + "Cobros del mes" (desglose de cobros,
    reutilizando datos de pagos/facturas ya calculados en la página).
  - Columna derecha: "Clases de hoy" (lista de sesiones del día — ya existe
    lógica similar en el dashboard actual o en `AgendaPage`/`isGroupCurrentlyActive`)
    + "Atención requerida" (alertas — mapear a `SmartAlertsPanel` reestilizado).

No se reordena ni elimina ninguna fuente de datos existente; el cambio es de
disposición (grid 2 columnas, tarjetas con el nuevo estilo) y de las
etiquetas/orden de las secciones para que coincidan con el mockup.

## Fuera de alcance / riesgos conocidos

- Cambiar los tokens globales afecta visualmente a **todas** las páginas no
  migradas todavía (aceptado explícitamente por el usuario): sus colores
  cambiarán aunque su estructura no se toque en esta fase.
- Las rutas "provisionales" de los 6 items no-Hoy del sidebar no tienen
  pestañas ni vista de resumen propia todavía; apuntan a la página existente
  más representativa de cada sección hasta su fase.
- `CoachDashboard.tsx` y `PlayerDashboard.tsx` no se tocan en esta fase.
- El botón "Acción rápida ⌘K" es solo visual en esta fase, sin funcionalidad
  de paleta de comandos.
