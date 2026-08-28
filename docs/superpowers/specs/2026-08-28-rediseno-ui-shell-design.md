# Rediseño de UI — Fase 1: Shell (Sidebar/Header) y Dashboard del director

**Fecha:** 2026-08-28
**Estado:** en revisión con el usuario
**Rama:** `claude/rediseno-ui`

## Contexto

El usuario quiere un rediseño completo de la interfaz, motivado por el lanzamiento próximo al
público de las partes de entrenadores y jugadores (portales que hoy sólo usan internamente). El
objetivo es una interfaz más amigable, especialmente en los dashboards, apoyándose en shadcn/ui
(componentes ya usados en el proyecto: Card, Tabs, Select, Dialog, etc., aunque sin `components.json`
— se añadieron a mano en `src/components/ui/`).

Un rediseño completo de toda la app (paneles de director/coordinador + portal de entrenador +
portal de jugador, ~20 páginas) es demasiado grande para un solo spec. Se decompone en fases;
este documento cubre solo la **Fase 1**, elegida como punto de partida porque el shell
(Sidebar/Header/MainLayout) es la base visual de la que cuelga toda la app, incluidos los
portales que se lanzarán después:

- **Fase 1 (este spec):** Sidebar, Header, MainLayout, Dashboard del director/coordinador.
- **Fase 2 (futura):** Portal de entrenador y jugador (CoachDashboard, PlayerDashboard,
  Asistencia) con foco touch-friendly.
- **Fase 3 (futura):** Páginas de gestión con tablas/calendarios densos (Grupos, Agenda,
  Jugadores...), posible vista de planificación tipo timeline.

El usuario aportó 4 capturas de inspiración (sin URLs, pegadas directamente en la conversación):
1. Dashboard con sidebar oscura, tarjetas KPI simples y panel "Smart Alerts & Insights" con
   avisos accionables (pagos atrasados, ausencia alta, mantenimiento de pista, solicitud de coach).
2. Dashboard con sidebar slate oscura, tarjetas KPI con mini-gráfica (sparkline), panel
   "Inteligencia del Club" con accesos rápidos, gráfica de evolución histórica de 12 meses.
3. Vista de asistencia diaria con toggles grandes (presente/ausente/justificado), muy
   touch-friendly — referencia para la Fase 2, no para este spec.
4. Vista de calendario/timeline de grupos y pistas con filtros — referencia para la Fase 3.

## Decisiones de diseño (validadas con el usuario)

1. **Paleta:** se mantiene la actual (`src/index.css`): primario teal `#0891b2`, sidebar slate
   `#0f172a`, semánticos (éxito/aviso/error) y paleta de 5 colores de gráfico ya definidos. No se
   introducen colores nuevos, solo se reorganiza cómo se usan.
2. **Herramienta:** se usa el CLI oficial de shadcn/ui (`npx shadcn@latest add ...`) para traer
   bloques nuevos (sidebar colapsable, componente `chart` con sparkline) y adaptarlos a la
   paleta anterior — no una skill dedicada (no existe ninguna en este entorno).
3. **Contenido del Dashboard del director:** combinar imagen 1 + imagen 2 — tarjetas KPI con
   sparkline, panel de alertas accionables (imagen 1) y panel "Inteligencia del Club" (imagen 2,
   ya existe como `IntelligenceCards.tsx`) más la gráfica de evolución histórica (ya existe).
   El heatmap de ocupación de pistas de la imagen 1 queda fuera — no existe hoy y es una pieza
   nueva de análisis, no de rediseño visual; se puede proponer como proyecto aparte más adelante.
4. **Sidebar:** además del restyle visual, se añade modo colapsado a solo-iconos (con tooltip al
   pasar el ratón), con estado persistido. Se mantienen los grupos colapsables
   (Administración/Financiera/Configuración) tal y como existen hoy — no se cambia esa
   interacción, solo se le da modo icon-only como capa adicional.
5. **Sin cambios de lógica de negocio.** Los cálculos de KPIs, gráficas y permisos de
   `DashboardPage.tsx` no se tocan; el rediseño es de presentación. La vista específica de
   entrenador dentro de `DashboardPage.tsx` (bloque `isCoach`) no se toca en esta fase — ya es
   razonablemente touch-friendly y se revisará en la Fase 2 junto al resto del portal.

## Arquitectura

### 1. Componentes shadcn/ui nuevos (vía CLI)

- `npx shadcn@latest add sidebar` — trae el bloque de sidebar colapsable de shadcn (usa
  `SidebarProvider`, `SidebarTrigger`, estado icon-only) junto con sus dependencias
  (`@radix-ui/react-*` que falten). Se adapta: colores del bloque sustituidos por los tokens
  `--color-sidebar-*` ya existentes, estructura de `navGroups` reutilizada tal cual.
- `npx shadcn@latest add chart` — trae el wrapper de gráficos de shadcn sobre Recharts
  (`ChartContainer`, `ChartTooltip`) usado para el sparkline dentro de `StatCard`. Se usa un
  `LineChart` minimal sin ejes, altura ~32px, color = `accentColor` que ya recibe cada `StatCard`.

Estos son los únicos dos `add` necesarios para esta fase; no se tocan Table/Select/Dialog/etc.
(ya existen y no cambian en esta fase).

### 2. Estado de colapso del sidebar (`src/stores/uiStore.ts`, nuevo)

Store Zustand mínimo, persistido en localStorage (mismo patrón que el resto de stores del
proyecto):

```ts
interface UIState {
  sidebarCollapsed: boolean
  toggleSidebarCollapsed: () => void
}
```

Solo aplica en desktop (`lg:` en adelante) — el sidebar móvil (drawer con overlay, `lg:hidden`)
no cambia y no participa del colapso.

### 3. `Sidebar.tsx` (editado)

- Restyle visual siguiendo la estética de las imágenes 1/2 (más aire, iconos con fondo sutil en
  el ítem activo, tipografía ya definida en el proyecto — Plus Jakarta Sans para títulos).
- Nuevo botón de colapsar/expandir en la cabecera del sidebar (icono `PanelLeftClose` /
  `PanelLeftOpen` de lucide-react).
- Cuando `sidebarCollapsed`: `lg:w-72` → `lg:w-[72px]`, se ocultan labels de texto y de grupo,
  cada `NavItem` muestra tooltip con el nombre al hover (usa el componente `Tooltip` de
  shadcn/ui ya existente en `src/components/ui/tooltip.tsx`). Los grupos colapsables
  (`collapsedGroups`) se ignoran visualmente en modo icon-only: se listan todos los iconos sin
  separación de grupo, ya que las etiquetas de grupo no caben.
- El bloque de usuario (avatar, cambiar contraseña, logout) se reduce a solo avatar + icono
  logout apilados cuando está colapsado.
- `RoleSwitcher` se oculta en modo colapsado (requiere espacio para el selector; se puede
  acceder expandiendo el sidebar).

### 4. `MainLayout.tsx` (editado)

`lg:pl-72` pasa a ser condicional según `sidebarCollapsed` del nuevo store
(`lg:pl-72` / `lg:pl-[72px]`), con `transition-[padding]` para que el cambio sea animado, a
juego con la transición de ancho del propio `<aside>`.

### 5. `Header.tsx`

Solo ajustes visuales menores (padding, tipografía) para consistencia con el nuevo sidebar; su
API (`title`, `subtitle`, `actions`) no cambia — ningún consumidor necesita tocarse.

### 6. `StatCard.tsx` (editado)

Se añade una prop opcional `sparkline?: number[]` que, si se pasa, renderiza un `LineChart`
compacto (vía el nuevo componente `chart` de shadcn) a la derecha del valor, usando
`accentColor` como color de línea. Sin la prop, la tarjeta se ve igual que hoy — cambio
retrocompatible, no rompe los usos existentes en `CoachDashboard`, `PlayerDashboard`, etc.

### 7. `DashboardPage.tsx` — reorganización de la vista admin (`isAdmin`, no `isCoach`)

Solo se reordena/reestiliza la sección ya existente entre `{/* KPI Cards */}` y
`{/* Bottom row */}` (líneas ~766–1226 hoy). No se toca el bloque `isCoach` (líneas 597–762) ni
los cálculos (`useMemo`s) — mismos datos, presentación nueva:

1. **Fila de KPIs con sparkline:** las `StatCard` existentes (jugadores activos, ingresos,
   pendientes, grupos activos, ratio de cobro...) pasan `sparkline` con la serie de los últimos
   6-8 puntos ya disponible en `evolutionData`/`financialData` para esa métrica cuando exista
   (p.ej. ingresos usa `evolutionData.map(d => d.ingresos)`); las que no tengan serie histórica
   natural (p.ej. "Grupos incompletos") se quedan sin sparkline.
2. **Nuevo panel "Alertas inteligentes"** (nuevo componente `src/components/shared/dashboard/SmartAlertsPanel.tsx`),
   junto a `IntelligenceCards` en una fila de dos columnas. Reutiliza *solo* datos que ya se
   calculan en la app hoy — no se inventan features nuevas:
   - Jugadores con 2 o más recibos pendientes este mes → reutiliza `collectionStats`/`payments`
     ya cargados en `dataStore`, mismo criterio que el "top deudores" de `FinanceTab`.
   - Grupos con tasa de ausencia ≥ 30% este mes (ausencias registradas ÷ registros de asistencia
     totales del grupo en el mes, mínimo 3 registros para evitar falsos positivos con datos
     escasos) → mismo dataset de `attendance` que ya usa `atRiskPlayers` en
     `IntelligenceCards.tsx`, agregado por `groupId` en vez de por alumno.
   - Fuera de alcance: "mantenimiento de pista" y "solicitud de nuevo coach" de la imagen 1 —
     no existen como features en la app; añadirlos sería un proyecto aparte, no rediseño visual.
3. **`IntelligenceCards`** se mantiene con su lógica actual, solo restyle para encajar visualmente
   junto al nuevo panel de alertas.
4. **Gráficas existentes** (asistencia semanal, distribución por nivel, resumen financiero,
   evolución histórica de 12 meses): mismo `BarChart`/`PieChart`/datos, solo se ajustan
   `Card`/paddings/tipografía para consistencia visual con el resto del rediseño. La gráfica de
   evolución histórica ya cubre lo que pide la imagen 2 — no se duplica.
5. **Activity feed y "Tu Agenda Hoy"** (bottom row): sin cambios funcionales, restyle menor si
   hace falta para consistencia.

## Fuera de alcance (Fase 1)

- Cualquier página fuera de Sidebar/Header/MainLayout/DashboardPage (Jugadores, Grupos,
  Asistencia, Agenda, Pagos, Finanzas, Configuración, etc.) — quedan para fases futuras.
- Vista de Dashboard específica de entrenador (bloque `isCoach`) y portales de
  entrenador/jugador — Fase 2.
- Heatmap de ocupación de pistas en vivo (imagen 1) y vista de timeline de grupos/pistas
  (imagen 4) — features nuevas de análisis/calendario, no rediseño visual; posibles proyectos
  aparte.
- Cambios de paleta de color, tipografía base o iconografía (Lucide se mantiene).
- Cambios en `RoleSwitcher`, `SeasonSwitcher`, `ChildSwitcher`, `NotificationBell` más allá de
  encajarlos visualmente en el nuevo Header — su lógica no se toca.

## Verificación manual

1. `npm run dev`: comprobar Sidebar en desktop (colapsar/expandir, tooltips en modo icono,
   persistencia del estado tras recargar) y que el drawer móvil sigue funcionando igual que hoy.
2. Dashboard como `director`: sparklines visibles en tarjetas con serie histórica, panel de
   Alertas inteligentes con datos reales (pagos pendientes / grupo con ausencia alta) o estado
   vacío correcto si no hay ninguno.
3. Dashboard como `entrenador`: confirmar que la vista de coach (bloque `isCoach`) se ve
   exactamente igual que antes del cambio (no debe haberse tocado).
4. Comprobar que los KPIs mostrados/ocultados por `kpiConfig` (diálogo de configuración) siguen
   funcionando igual.
5. `npm run build` y `npm test` sin errores.
6. Repasar en las tres franjas de ancho (móvil, tablet, desktop colapsado, desktop expandido).
