# Pestaña "Finanzas" en Inteligencia del Club — Diseño

**Fecha:** 2026-08-26
**Estado:** aprobado, pendiente de plan de implementación

## Contexto

El usuario quiere entender mejor las finanzas del club: qué % de ingresos viene de adultos vs. menores, de eventos, de clases particulares, qué categorías dejan más margen real y cuál es el colchón financiero del club, para poder tomar mejores decisiones.

Hoy existen dos piezas relacionadas pero que no cubren esto:
- `FinancialsPage.tsx` ("Beneficios y Gastos"): registra ingresos/gastos manuales y muestra el total de ingresos por origen (cuotas/eventos/clases) y gasto de un mes o rango de meses, pero sin porcentajes, sin desglose adulto/menor, sin margen por categoría y sin distinguir coste fijo de variable.
- `AnalyticsPage.tsx` ("Inteligencia del Club"): 5 pestañas (KPIs, Riesgo de baja, Cuestionarios, Ranking coaches, Histórico) con análisis de solo lectura orientado a decisiones, pero sin nada financiero salvo una tarjeta suelta de "tasa de cobro" en KPIsTab.

Se añade una sexta pestaña, **Finanzas**, en `AnalyticsPage.tsx`, que es donde ya vive el análisis de solo lectura orientado a decisiones — dejando `FinancialsPage` centrada en registrar movimientos.

## Decisiones de diseño (validadas con el usuario)

1. **Ubicación:** nueva pestaña `finanzas` en `AnalyticsPage.tsx`, junto a las 5 existentes (grid pasa de `grid-cols-5` a `grid-cols-6`).

2. **Selector de periodo:** reutiliza `AnalyticsPeriod` (mes actual / trimestre / año), igual que `KPIsTab`. Cada sección se recalcula para el periodo elegido y compara contra el periodo inmediatamente anterior de igual duración (variación %), para dar contexto de tendencia sin añadir un segundo selector de "periodo de comparación" (fuera de alcance, ver más abajo).

3. **Criterio adulto/menor:**
   - **Cuotas** (ligadas a `groupId`): se usa `Group.level === 'menores'` — el mismo criterio que ya usa el club para calcular nóminas (`CoachSalaryConfig.ratePerGroupAdults/Minors`), evitando introducir un segundo criterio incompatible con el que ya opera el negocio.
   - **Eventos y clases particulares** (no ligados a grupo): se usa `Player.isMinor` del jugador que paga.

4. **Clasificación de costes fijos vs. variables** (`ClubTransaction.category`), revisada para reflejar que la nómina de los coaches en este club **no** es un salario fijo sino que se paga por grupo/clase/evento existente (escala con la actividad):
   - **Fijos** (se pagan exista o no actividad ese mes): `alquiler`, `suministros`, `limpieza`, `publicidad` (esta última es una decisión de inversión, no una consecuencia de cuánta actividad hay).
   - **Variables** (escalan con grupos/alumnos/clases/eventos): `nomina`, `material`, `reparaciones`, `otro`.
   - Esto evita contar la nómina dos veces: ya se resta como coste directo en "Margen por categoría" (punto 6), así que no debe formar parte del numerador de costes fijos del punto de equilibrio (punto 7).

5. **Sin nueva persistencia.** Todo se calcula al vuelo sobre los datos ya cargados en `dataStore` (`payments`, `eventPayments`, `privateLessonPayments`, `events`, `privateLessons`, `groups`, `players`, `clubTransactions`, `coachSalaryConfigs`), igual que el resto de `AnalyticsPage`. No hay Cloud Functions ni colecciones nuevas.

## Arquitectura

### 1. Secciones de la pestaña (una `Card` cada una, en este orden)

1. **Ingresos por origen** — cuotas / eventos / clases particulares: € y % del total del periodo, con variación vs. periodo anterior.
2. **Adultos vs. Menores** — € y % de cada uno (criterio del punto 3 de arriba), con variación vs. periodo anterior.
3. **Por grupo/nivel** — tabla con los 5 niveles (`iniciacion`, `intermedio`, `avanzado`, `competicion`, `menores`), ingreso de cuotas de cada uno, ordenada de mayor a menor.
4. **Margen por categoría** — a cada ingreso se le resta el coste directamente atribuible:
   - Cuotas de un grupo → coste = `ratePerGroupAdults` o `ratePerGroupMinors` (según `group.level`) del coach de ese grupo, mensual.
   - Clases particulares → coste = nueva función `calculatePrivateLessonSalary` (espejo de `calculateEventSalary`, ver punto 2 de Implementación), aplicando `CoachSalaryConfig.privateLessonPaymentType/Rate`.
   - Eventos → coste = `event.expenses` + comisión del coach vía `calculateEventSalary` (ya existente).
   - Se muestra € y % de margen de contribución por categoría, ordenado de mayor a menor margen absoluto.
5. **Estructura de costes** — composición del gasto del periodo en fijo vs. variable (punto 4 de arriba), como barra apilada o donut de %, más evolución mensual de esa proporción en los últimos 6 meses (si los fijos ganan peso mes a mes, es una señal de alarma).
6. **Punto de equilibrio** — `costes fijos del periodo ÷ margen medio por alumno de cuota` (margen medio = margen de contribución de cuotas del punto 4, dividido entre el nº de alumnos con enrollment activo en el periodo) = nº de alumnos necesarios para cubrir los costes fijos. Se compara contra la matrícula activa real, mostrando el margen de seguridad (alumnos por encima/debajo del punto de equilibrio).
7. **Morosidad y cobro** — € cobrado vs. € pendiente vs. € cancelado del periodo; evolución de la tasa de cobro (cobrados/generados) de los últimos 6 meses; top 5 jugadores con más importe pendiente (nombre, importe, nº de recibos pendientes).

### 2. Lógica pura nueva

**`src/lib/finance-analytics.ts`** (nuevo, sin dependencias de React, testeable con Vitest siguiendo el patrón de `lib/period.ts` / `lib/court-utilization.ts`):

- `revenueByOrigin(payments, period)` → `{ cuotas, eventos, clases, total }` + variación vs. periodo anterior.
- `revenueByAgeGroup(payments, groups, players, period)` → `{ adultos, menores }` en €, usando el criterio del punto 3.
- `revenueByLevel(payments, groups, period)` → `Record<PlayerLevel, number>`, solo cuotas.
- `contributionMarginByCategory(payments, events, eventPayments, privateLessons, privateLessonPayments, groups, coachSalaryConfigs, period)` → margen € y % por categoría (cuotas/eventos/clases).
- `costStructure(clubTransactions, period)` → `{ fixed, variable, fixedPct, variablePct }` + serie de los últimos 6 meses.
- `breakEvenPoint(fixedCosts, avgMarginPerStudent, activeEnrollmentCount)` → `{ studentsNeeded, actualStudents, marginStudents }`.
- `collectionStats(payments, period)` → `{ paidAmount, pendingAmount, cancelledAmount, collectionRate }` + serie últimos 6 meses + top deudores.

Todas reciben los datos ya normalizados vía `normalizeAllPayments` (`lib/payment-utils.ts`, ya usado por `FinancialsPage`/`ReportsPage`) para no reimplementar esa normalización.

**`src/lib/salary-utils.ts`** (existente, se añade una función):
- `calculatePrivateLessonSalary(lesson, salaryConfig)` — espejo de `calculateEventSalary`, aplicando `privateLessonPaymentType`/`privateLessonRate` sobre `lesson.price`.

### 3. Componente UI

**`src/components/shared/analytics/FinanceTab.tsx`** (nuevo, patrón de `KPIsTab.tsx`: hooks de `useDataStore`, `useMemo` por sección, `Card` de shadcn, gráficos con Recharts siguiendo la paleta ya usada en `AnnualFinancialSummary`).

**`src/pages/AnalyticsPage.tsx`** (editado):
- `Tab` type y `VALID_TABS` incluyen `'finanzas'`.
- `TabsList` pasa a `grid-cols-6` (o `sm:grid-cols-6`, revisar breakpoint con las 6 pestañas en móvil).
- Nuevo `TabsTrigger`/`TabsContent` para `finanzas`, icono `Euro` o `PiggyBank` de lucide-react.

## Fuera de alcance

- Exportar esta pestaña a PDF/Excel (puede añadirse después reutilizando los generadores ya existentes en `ReportsPage`).
- Selector de periodo de comparación distinto al inmediatamente anterior (sin comparación interanual en esta primera versión).
- Persistencia histórica de estas métricas (ya existe una pestaña "Histórico" separada con snapshots mensuales para otras métricas; añadir finanzas a ese sistema es una extensión futura, no parte de este diseño).
- Proyecciones o forecasting de ingresos/gastos futuros.
- Cambios en `FinancialsPage.tsx` o `ReportsPage.tsx`.
- Reclasificación de `ClubTransaction` existentes: la clasificación fijo/variable se aplica solo para el cálculo, no se persiste ni se muestra como campo editable por transacción.

## Verificación manual

1. Con datos de varios meses en el emulador/dev: abrir la pestaña "Finanzas", confirmar que "Ingresos por origen" suma exactamente lo mismo que el "Total Ingresos" ya mostrado en `FinancialsPage` para el mismo mes (mismo dato, dos vistas).
2. Confirmar que "Adultos vs. Menores" + "Por grupo/nivel" son consistentes entre sí (la suma de adultos = suma de niveles != 'menores'; suma de menores = ingreso del nivel 'menores').
3. Confirmar que "Margen por categoría" resta correctamente el coste del coach: comparar manualmente un grupo conocido (`ratePerGroupAdults/Minors` del coach asignado) contra el margen mostrado.
4. Confirmar que "Estructura de costes" no incluye `nomina` en el bucket fijo, y que "Punto de equilibrio" no resta la nómina dos veces.
5. Cambiar el selector de periodo (mes/trimestre/año) y confirmar que todas las secciones se recalculan coherentemente, incluidas las variaciones vs. periodo anterior.
6. Confirmar el listado de "top 5 deudores" contra una consulta manual de pagos `pendiente` ordenados por importe.
7. `npm run build` y `npm test` sin errores.
