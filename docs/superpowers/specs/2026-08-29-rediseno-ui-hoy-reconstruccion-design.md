# Rediseño de interfaz — Reconstrucción de "Hoy" (Dashboard)

## Contexto

Continuación del rediseño de `san javier.pen`. La Fase 1 (mergeada en
`claude/rediseno-ui`) añadió el topbar y la fila de 4 KPIs de "Hoy" **por
encima** del dashboard antiguo, sin borrar nada (ver
`docs/superpowers/specs/2026-08-29-rediseno-ui-fase1-sidebar-hoy-design.md`).
El usuario ha dado ahora permiso explícito para borrar/reescribir libremente
lo que no encaje con el diseño (ver memoria `rediseno-ui-libertad-para-borrar`),
así que esta tarea reconstruye `DashboardPage.tsx` para que sea, de arriba a
abajo, exactamente lo que muestra el mock (`san javier.pen`, nodo `p2DVS`,
"01 · Hoy"), eliminando todo lo que sobra.

Releí el mock nodo por nodo (no solo la captura de pantalla) para esta spec;
el contenido de "Indicadores del club", "Cobros del mes" y "Atención" es más
específico de lo que Fase 1 implementó (que reutilizó `IntelligenceCards` y
`SmartAlertsPanel`, dos componentes con un contenido completamente distinto
al del mock).

## Alcance

Un único archivo de trabajo principal (`DashboardPage.tsx`) más 4 componentes
nuevos y pequeños. Fuera de alcance: `CoachDashboard.tsx`, `PlayerDashboard.tsx`
(dashboards de otros roles, sin mockup propio todavía) y cualquier otro módulo
(Personas, Clases, Finanzas, Deportivo).

## 1. Qué se elimina

- **Las ramas `isCoach`** en `DashboardPage.tsx`: sección "Coach-First
  Interface" completa (avisos de asistencia, "Pasar Lista", `activeClass`),
  los 6 `StatCard` de entrenador, y todas las variables que solo alimentan
  esas ramas (`currentCoachId`, `coachHoursThisMonth`, `coachAssignedPlayers`,
  `coachTotalGroups`, `coachTotalPrivateLessons`, `coachIncompleteGroups`,
  `activeClass`). Confirmado muerto: el enrutado (`AuthenticatedApp.tsx`)
  envía a `entrenador` a `CoachDashboard`, esta página nunca se renderiza
  para ese rol.
- **La fila de KPIs configurable antigua** (el bloque `isCoach ? (...) : (...)`
  con ~11 `StatCard` controlados por `kpiConfig`), el diálogo "Configurar
  indicadores", `KPI_STORAGE_KEY`, `defaultKpiConfig`, `kpiConfig`,
  `showKpiDialog`.
- **Los 4 gráficos de recharts** (asistencia semanal, distribución por nivel,
  evolución histórica de 12 meses, resumen financiero de 6 meses) y todo lo
  que solo los alimenta: `attendanceData`, `levelData`, `financialData`,
  `chartCollapsed`/`toggleChartCollapsed`, el import completo de `recharts`.
  `evolutionData` (el array de 12 meses) **se mantiene** — ya no se dibuja
  como gráfico, pero se reutiliza como fuente de los valores "mes anterior"
  del grid de Indicadores (ver más abajo).
- **`IntelligenceCards`** (`src/components/shared/analytics/IntelligenceCards.tsx`)
  y **`SmartAlertsPanel`** (`src/components/shared/dashboard/SmartAlertsPanel.tsx`):
  se borran del repositorio. Comprobado: `DashboardPage.tsx` es su único
  consumidor. Si al borrar `SmartAlertsPanel.tsx` alguna función de
  `src/lib/dashboard-alerts.ts` o `src/lib/coach-stats.ts` se queda sin más
  usos en el resto del proyecto, se borra también esa función (no el archivo
  entero si tiene otros usos — comprobar con grep antes de borrar cada uno).
- **Imports muertos ya existentes** (no introducidos por esta tarea, pero
  visibles al tocar este archivo): `useEvaluationsQuery`, `useMatchReportsQuery`,
  `useInvoicesQuery` se importan de `@/hooks/useQueries` pero nunca se llaman
  en el archivo actual — se eliminan. `useClassReviewsQuery` sí se llama, pero
  solo para alimentar `IntelligenceCards`; al borrar ese componente, también
  se elimina esta llamada.
- **Duplicidad de fórmulas de rotación/ocupación**: hoy existen dos maneras de
  calcular el mes en curso — las variables sueltas (`occupancyStats`,
  `rotationIndex`, `churnRate`, `collectionRate`, fórmula simple) y el último
  elemento de `evolutionData` (fórmula más elaborada basada en enrollments).
  Esta tarea no unifica ambas fórmulas (sería un cambio de comportamiento no
  solicitado) — usa las variables sueltas para el **valor actual** de cada
  indicador (igual que hace hoy la fila de KPIs superior) y `evolutionData[10]`
  (mes anterior) para el **delta**, aceptando que son dos métodos de cálculo
  ligeramente distintos, tal y como ya conviven hoy en este mismo archivo.

## 2. Qué se mantiene sin cambios

- Topbar completo (título, fecha, buscador visual, `NotificationBell`, botón
  agenda, botón "Nuevo jugador").
- La fila de 4 KPIs (Jugadores activos, Clases hoy, Asistencia media,
  Pendiente de cobro) y todas las variables que la alimentan: `activePlayers`,
  `netPlayerChange`, `todayGroups`, `classesInProgress`, `weekAttendanceStats`,
  `currentPending`, `pendingPlayersCount`, `altasEsteMes`, `bajasEsteMes`.
- `visibleActivities` + `<ActivityFeed>` al final de la página, sin cambios.
- Todas las variables base de pagos: `allPayments`, `currentMonthAllPayments`,
  `currentRevenue`, `totalCurrentMonth`, `collectionRate`.
- `occupancyStats`, `rotationIndex`, `churnRate`, `rotationDivisor`,
  `evolutionData` (reutilizados por el nuevo grid de Indicadores).

## 3. Componentes nuevos

Se crean en `src/components/shared/dashboard/` (mismo directorio donde vivía
`SmartAlertsPanel`):

### `ClubIndicatorsGrid.tsx`

Grid de **5** indicadores (el mock tenía 6; se quita "Conversión lista de
espera" por falta de dato histórico fiable — ver spec de decisiones más
abajo). Cada celda: label, valor grande, barra de progreso, delta.

| Indicador | Valor | Delta |
|---|---|---|
| % Ocupación de clases | `occupancyStats.rate` | `occupancyStats.rate - evolutionData[10].ocupacion` puntos |
| Índice de rotación | `rotationIndex` | `rotationIndex - evolutionData[10].rotacion` puntos |
| Tasa de abandono | `churnRate` | `churnRate - evolutionData[10].abandono` puntos |
| Ratio de cobro | `collectionRate` | `collectionRate - evolutionData[10].ratioCobro` puntos |
| Alumnos por grupo | `occupancyStats.totalOccupied / activeGroups` (1 decimal) | texto fijo: "de {`round(occupancyStats.totalCapacity / activeGroups)`} plazas" (sin delta de puntos) |

Props: recibe estos 5 valores ya calculados (no vuelve a leer `useDataStore`
él mismo) — mantiene el componente como una función de presentación pura,
fácil de entender sin mirar `DashboardPage.tsx`.

### `MonthlyCollectionsCard.tsx`

Reemplaza la lista plana actual de "Cobros del mes" por: total del mes,
barra apilada de 3 segmentos, y leyenda con 3 filas (Cobrado / Pendiente /
Vencido), cada una con importe y porcentaje sobre el total.

Cálculo nuevo (dentro de `DashboardPage.tsx`, se pasa ya calculado):
```ts
const currentMonthPending = currentMonthAllPayments.filter(p => p.status === 'pendiente')
const currentOverdueThisMonth = currentMonthPending
  .filter(p => p.dueDate != null && new Date(p.dueDate) < now)
  .reduce((sum, p) => sum + Number(p.amount || 0), 0)
const currentPendingNotOverdue = currentPending - currentOverdueThisMonth
```
(`currentPending` ya existe y es la suma de TODO lo pendiente del mes;
`currentOverdueThisMonth` es el subconjunto vencido. `dueDate` es opcional en
`NormalizedPayment` — igual que en el módulo Personas, un pago sin `dueDate`
nunca cuenta como vencido.)

### `TodayClassesCard.tsx`

Misma lista de hoy que ya existe, con dos cambios de contenido para
coincidir con el mock:
- La línea meta pasa de `{courtName} · {currentEnrollment} alumnos` a
  `{coachName} · {courtName}` (`Group.coachName` ya viene denormalizado, sin
  necesidad de buscar en `coaches`).
- Se añade una columna de asistencia a la derecha de cada fila: busca en
  `attendance` el registro de ese `groupId` con fecha de hoy; si existe,
  muestra `"{presentes}/{total}"`; si no existe todavía, muestra `"—"`.
- Se añade un enlace "Ver agenda" en la cabecera de la tarjeta que navega a
  `/agenda`.

### `AttentionAlertsCard.tsx`

Sustituye a `SmartAlertsPanel`. Tres alertas fijas (no una lista dinámica de
N por jugador/grupo como hacía el componente viejo):

1. **Pagos vencidos** — a diferencia de "Cobros del mes" (que se limita al
   mes en curso), esta alerta mira **todos** los pagos pendientes vencidos,
   de cualquier mes de facturación, porque el dinero atrasado de meses
   anteriores es igual o más urgente que el del mes actual:
   ```ts
   const allOverduePayments = allPayments.filter(p => p.status === 'pendiente' && p.dueDate != null && new Date(p.dueDate) < now)
   const overdueCount = allOverduePayments.length
   const overdueAmount = allOverduePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
   const oldestOverdueDays = overdueCount > 0
     ? Math.floor((now.getTime() - Math.min(...allOverduePayments.map(p => new Date(p.dueDate!).getTime()))) / 86400000)
     : 0
   ```
   Texto: `"{overdueCount} pagos vencidos"` / `"Suman {formatCurrency(overdueAmount)} · desde hace {oldestOverdueDays} días"`.
   Si `overdueCount === 0`, esta alerta no se muestra.

2. **Jugadores activos sin evaluación** — sustituye a "evaluaciones sin
   cerrar" del mock (que exigiría un concepto de periodos/trimestres con
   fecha límite que no existe hoy):
   ```ts
   const playersWithoutEvaluation = players.filter(p =>
     p.status === 'activo' && !evaluations.some(e => e.playerId === p.id)
   )
   ```
   Texto: `"{count} jugadores sin evaluación"` / `"Nunca se les ha registrado ninguna"`.
   Si el conteo es 0, no se muestra. `evaluations` se lee directamente de
   `useDataStore()` (ya sincronizado en tiempo real, sin necesidad de
   `useEvaluationsQuery`).

3. **Lista de espera** —
   ```ts
   const waitlistPlayers = players.filter(p => p.status === 'lista_espera')
   const waitlistWithSpace = waitlistPlayers.filter(p =>
     groups.some(g => isGroupCurrentlyActive(g, now) && g.level === p.level && g.currentEnrollment < g.maxCapacity)
   )
   ```
   Texto: `"{waitlistPlayers.length} en lista de espera"` / `"{waitlistWithSpace.length} encajan en grupos con hueco"`.
   Si `waitlistPlayers.length === 0`, no se muestra.

Cada alerta es clicable y navega a la página relevante (`/pagos`,
`/personas/jugadores`, `/personas/lista-espera` respectivamente), igual que
`SmartAlertsPanel` ya hacía con sus botones "Ver detalles". Si las 3 alertas
están vacías, la tarjeta muestra un estado "Todo al día" (mismo tono que el
`!hasAlerts` que ya tenía `SmartAlertsPanel`).

## Fuera de alcance / riesgos conocidos

- El delta de Ocupación/Rotación/Abandono/Ratio de cobro mezcla dos métodos
  de cálculo distintos (actual = fórmula simple ya existente, mes anterior =
  fórmula de `evolutionData`) — inconsistencia heredada del código actual,
  no introducida ni resuelta por esta tarea.
- "Conversión lista de espera" no se implementa (sin dato histórico
  fiable — ver decisión con el usuario). El grid de Indicadores tiene 5
  celdas, no 6.
- "Evaluaciones sin cerrar" se sustituye por una métrica más simple
  ("jugadores activos sin evaluación nunca") que no depende de periodos con
  fecha límite.
- Al borrar `IntelligenceCards.tsx`/`SmartAlertsPanel.tsx`, revisar antes con
  grep si `src/lib/dashboard-alerts.ts` o `src/lib/coach-stats.ts` quedan
  con funciones sin ningún otro consumidor, y borrarlas también si es así
  (no borrar el archivo si conserva otros usos).
