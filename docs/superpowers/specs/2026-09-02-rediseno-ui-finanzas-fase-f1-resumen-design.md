# Rediseño de interfaz — Módulo Finanzas, Fase F1 (Layout + Resumen)

## Contexto

Primera fase del rediseño de Finanzas, continuación de las Fases A-E de
Clases. Mockup de referencia en `san javier.pen`, frame `sIuXr`
("04 · Finanzas / Resumen"). El mock muestra un módulo de 5 pestañas
(Resumen, Pagos, Facturas, Ingresos y gastos, Análisis) bajo un topbar y
KPIs compartidos.

Hoy Finanzas son 5 páginas ya existentes y funcionales, pero desconectadas
entre sí: `PaymentsPage.tsx`, `InvoicesPage.tsx`, `FinancialsPage.tsx`,
`FinancialAnalyticsPage.tsx`, y una pestaña "Resumen" que **no existe
todavía**. El sidebar solo tiene una entrada ("Finanzas" → `/pagos`).
`AnalyticsPage.tsx` ("Inteligencia del Club") es un módulo distinto, no
forma parte de Finanzas.

Restricción explícita del usuario para todo el módulo Finanzas: el diseño
debe ser fiel al estilo general del mock, y **todo elemento debe estar
conectado a datos/funcionalidad real — ningún botón o dato de relleno.**

## Alcance de esta fase (F1)

1. Crear `FinanzasLayout.tsx` (mismo patrón que `ClasesLayout.tsx`): topbar
   + tabs compartidos, envolviendo las 5 rutas de Finanzas.
2. Crear `ResumenPage.tsx`, el dashboard nuevo fiel al mock `sIuXr`.
3. Repuntar las 4 rutas de Finanzas existentes (`/finanzas/pagos`,
   `/finanzas/facturas`, `/finanzas/ingresos-gastos`,
   `/finanzas/analisis`) para que cuelguen de `FinanzasLayout`, sin
   modificar el contenido de esas 4 páginas — eso es trabajo de fases
   posteriores (F2-F5).
4. Actualizar el sidebar: la entrada "Finanzas" pasa a apuntar a
   `/finanzas` (que redirige a `/finanzas/resumen`).
5. Extender el modelo de datos (`ClubTransaction`, `TransactionCategory`)
   según lo acordado (ver sección 2), y las funciones de
   `finance-analytics.ts` necesarias para que el Resumen sea 100% real.

Fuera de alcance (fases posteriores):
- El contenido visual de Pagos, Facturas, Ingresos y gastos, Análisis
  (F2-F5) — siguen mostrando su `Header` propio y su diseño actual hasta
  que les toque su fase. Es el mismo estado transicional que tuvo Clases
  entre Fases A y E.
- Un selector de temporada interactivo en el topbar de Finanzas — el mock
  no lo muestra (a diferencia de `ClasesLayout`), solo texto informativo
  en el subtítulo. Si hiciera falta filtrar Finanzas por temporada se
  abordará como una fase propia.

## 1. `FinanzasLayout.tsx`

Mismo patrón estructural que `ClasesLayout.tsx`: outlet context para que
cada página hija registre su propio botón principal (patrón ya
establecido, cada página fija su acción y la limpia al desmontarse) y,
en el caso de Resumen, lea el mes seleccionado en el topbar.

```ts
export interface FinanzasOutletContext {
  setPrimaryAction: (action: ClasesPrimaryAction | null) => void
  selectedMonth: number   // 1-12
  selectedYear: number
}
```

(reutiliza el tipo `ClasesPrimaryAction` ya definido en
`ClasesLayout.tsx` — mismo shape, se mueve a un archivo compartido
`src/components/layout/topbar-types.ts` para no duplicarlo entre los dos
layouts.)

### Topbar

- Título: "FINANZAS".
- Subtítulo: `Resumen de {mes en curso en minúscula} {año} · temporada
  {club.activeSeasonId → season.name, o "sin temporada activa" si no hay
  ninguna}`. El subtítulo solo se muestra en la pestaña Resumen (mismo
  criterio condicional que `ClasesLayout.subtitle`); en las otras 4
  pestañas no se muestra subtítulo por ahora (sus páginas ya tienen su
  propio `Header` con su propio subtítulo).
- Buscador: **no se añade en esta fase** — el mock lo muestra pero ninguna
  pestaña construida hasta ahora (solo Resumen) tiene una lista que
  buscar. Se añadirá cuando la fase de Pagos/Facturas lo necesite (mismo
  criterio que `ClasesLayout.showSearch`).
- Icono campana → `NotificationBell` (componente ya existente,
  reutilizado tal cual).
- Icono calendario ("calendar-days") → abre un `Popover` con selector de
  mes/año (usa `MONTHS` de `@/constants`, igual estética que el selector
  de mes ya existente en `PaymentsPage`). Controla qué mes se muestra en
  todo el Resumen (por defecto, el mes en curso). El estado
  (`selectedMonth`/`selectedYear`) vive en `FinanzasLayout` y se expone
  vía el outlet context. **Este icono solo se renderiza cuando la
  pestaña activa es Resumen** (`location.pathname === '/finanzas/resumen'`)
  — en las otras 4 pestañas no hay todavía ningún consumidor de
  `selectedMonth`, así que mostrarlo ahí sería un botón sin efecto
  visible, lo cual viola el requisito de "nada sin conectar". Cuando una
  fase futura (F2-F5) necesite filtrar por mes, se decidirá entonces si
  reutiliza este mismo selector o usa uno propio de esa pestaña.

### Tabs

`Resumen · Pagos ({count}) · Facturas ({count}) · Ingresos y gastos ·
Análisis`, mismo componente visual de pestañas que `ClasesLayout` (borde
inferior activo + contador con pill).

- `{count}` de Pagos: nº de `Payment` de la temporada activa del club
  (mismo criterio de "temporada activa" ya usado en Grupos/Eventos:
  `payment.billingYear`/`billingMonth` dentro del rango
  `season.startDate`-`season.endDate`; si no hay temporada activa, se
  cuentan todos).
- `{count}` de Facturas: nº de `Invoice` con `status !== 'cancelled'`
  cuya `invoiceDate` cae dentro de la temporada activa (mismo criterio).

### Rutas

```
/finanzas                    → redirect a /finanzas/resumen
/finanzas/resumen            → ResumenPage
/finanzas/pagos              → PaymentsPage (sin cambios)
/finanzas/facturas           → InvoicesPage (sin cambios)
/finanzas/ingresos-gastos    → FinancialsPage (sin cambios)
/finanzas/analisis           → FinancialAnalyticsPage (sin cambios)
```

Las rutas antiguas `/pagos`, `/facturas`, `/finanzas`,
`/finanzas-analitica` se sustituyen por las anteriores. Se busca
cualquier `Link`/`navigate` que apunte a las rutas antiguas en el resto
del código y se actualiza (p. ej. accesos directos desde
`PlayerDetailPage` o similares a "Ver pagos del jugador").

## 2. Cambios de modelo de datos

### `ClubTransaction` (`src/types/index.ts`)

```ts
export type TransactionStatus = 'pagado' | 'pendiente'
export type TransactionCategory = 'alquiler' | 'suministros' | 'material' | 'reparaciones' | 'publicidad' | 'limpieza' | 'nomina' | 'otro' | 'subvencion'

export interface ClubTransaction {
  id: string
  clubId: string
  type: TransactionType
  category: TransactionCategory
  concept: string
  amount: number
  date: Date            // puede ser futura si status === 'pendiente'
  status?: TransactionStatus  // ausente = 'pagado' (compatibilidad con registros existentes)
  registeredBy?: string
  relatedId?: string
  notes?: string
  createdAt: Date
}
```

- `status` ausente se trata siempre como `'pagado'` — ningún dato
  existente cambia de significado.
- `FinancialsPage.tsx` (fase F4) es quien expondrá el control para crear
  un movimiento con `status: 'pendiente'` y fecha futura; en esta fase
  F1 solo se **lee** ese campo (Resumen no permite crear transacciones).
- `CATEGORY_LABELS` en `FinancialsPage.tsx` se extiende con
  `subvencion: 'Subvención/Patrocinio'`.
- `FIXED_COST_CATEGORIES` en `finance-analytics.ts` no cambia
  (`subvencion` es ingreso, nunca gasto, así que no aplica).

## 3. `ResumenPage.tsx`

Página presentacional que usa `useOutletContext<FinanzasOutletContext>()`
para leer `selectedMonth`/`selectedYear` puestos por `FinanzasLayout`, y
`useDataStore()` + queries existentes para los datos. Sin filtros de
temporada (el mock no los muestra en esta pestaña).

### `finance-analytics.ts` — nuevas funciones

**`monthlyTotals`** — extrae y reutiliza la lógica que hoy está duplicada
en `AnnualFinancialSummary.tsx` (líneas 30-87) y `FinancialsPage.tsx`
(gastos de eventos + extras):

```ts
export interface MonthlyTotals {
  ingresos: number
  gastos: number
  beneficio: number
}

export function monthlyTotals(
  monthKey: string, // "2026-8"
  payments: NormalizedPayment[],
  events: AcademyEvent[],
  eventPayments: EventPayment[],
  privateLessons: PrivateLesson[],
  privateLessonPayments: PrivateLessonPayment[],
  transactions: ClubTransaction[]
): MonthlyTotals {
  const monthKeys = new Set([monthKey])
  const ingresosCuotas = revenueByOrigin(payments, monthKeys).cuotas
  const ingresosEventos = revenueByOrigin(payments, monthKeys).eventos
  const ingresosClases = revenueByOrigin(payments, monthKeys).clases
  const [y, m] = monthKey.split('-').map(Number)
  const gastosEventos = events
    .filter(ev => dateToMonthKey(ev.date) === monthKey)
    .reduce((s, ev) => s + (ev.expenses ?? []).reduce((s2, ex) => s2 + ex.amount, 0), 0)
  const extrasIngresos = transactions
    .filter(t => t.type === 'ingreso' && (t.status ?? 'pagado') === 'pagado' && dateToMonthKey(t.date) === monthKey)
    .reduce((s, t) => s + t.amount, 0)
  const extrasGastos = transactions
    .filter(t => t.type === 'gasto' && (t.status ?? 'pagado') === 'pagado' && dateToMonthKey(t.date) === monthKey)
    .reduce((s, t) => s + t.amount, 0)
  const ingresos = ingresosCuotas + ingresosEventos + ingresosClases + extrasIngresos
  const gastos = gastosEventos + extrasGastos
  return { ingresos, gastos, beneficio: ingresos - gastos }
}
```

`dateToMonthKey` pasa a exportarse (hoy es privada en el archivo).
`AnnualFinancialSummary.tsx` se refactoriza para llamar a `monthlyTotals`
en su bucle mensual en vez de repetir la lógica (limpieza dentro del
alcance, no funcional).

**KPIs (Stat Strip)**: `monthlyTotals` del mes seleccionado y del mes
anterior, para las 3 primeras tarjetas y sus deltas
(`pctChange(actual.ingresos, anterior.ingresos)`, etc. — "Resultado del
mes" muestra el margen: `beneficio/ingresos*100` si `ingresos > 0`, si no
`0`). Morosidad: ver "Estado de cobros" más abajo.

**Evolución (12 meses)**: bucle de 12 `monthKey` terminando en el mes
seleccionado, cada uno vía `monthlyTotals`, igual que hace hoy
`AnnualFinancialSummary`.

**`collectionBreakdown`** (nueva, en `finance-analytics.ts`) — sustituye
el uso de `collectionStats` para esta vista porque el mock separa
Pendiente/Vencido (hoy `collectionStats` los junta en un único
`pendingAmount`):

```ts
export interface CollectionBreakdown {
  paidAmount: number
  pendingAmount: number   // dueDate >= hoy
  overdueAmount: number   // dueDate < hoy
  total: number
}

export function collectionBreakdown(
  payments: NormalizedPayment[],
  monthKeys: Set<string>,
  now: Date = new Date()
): CollectionBreakdown {
  let paidAmount = 0, pendingAmount = 0, overdueAmount = 0
  for (const p of payments) {
    if (p.source !== 'cuota' && p.source !== 'manual') continue
    if (!monthKeys.has(monthKeyOf(p))) continue
    if (p.status === 'pagado') paidAmount += p.amount
    else if (p.status === 'pendiente') {
      if (new Date(p.dueDate) < now) overdueAmount += p.amount
      else pendingAmount += p.amount
    }
  }
  const total = paidAmount + pendingAmount + overdueAmount
  return { paidAmount, pendingAmount, overdueAmount, total }
}
```

Sólo se filtra a `cuota`/`manual` porque la tarjeta del mock se titula
"Estado de cobros" con subtítulo "X € en cuotas". Morosidad (KPI) =
`overdueAmount / total * 100` de este mismo resultado, sobre el mes
seleccionado.

**Composición de ingresos**: `revenueByOrigin` da cuotas/eventos/clases;
se añaden dos líneas leyendo `transactions` directamente:
"Subvención/Patrocinio" (`type: 'ingreso', category: 'subvencion'`) y
"Material y equipación" (`type: 'ingreso', category: 'material'`). Cada
línea muestra importe y `importe / total * 100` redondeado.

**`attentionItems`** (nueva) — un array ordenado de avisos:

```ts
export interface AttentionItem {
  id: string
  title: string
  subtitle: string
  href: string
}

export function attentionItems(
  payments: NormalizedPayment[],
  invoices: Invoice[],
  transactions: ClubTransaction[],
  now: Date = new Date()
): AttentionItem[] {
  const items: AttentionItem[] = []

  const overdue = payments.filter(p => p.status === 'pendiente' && new Date(p.dueDate) < now)
  if (overdue.length > 0) {
    const amount = overdue.reduce((s, p) => s + p.amount, 0)
    const oldestDays = Math.floor((now.getTime() - Math.min(...overdue.map(p => new Date(p.dueDate).getTime()))) / 86400000)
    items.push({
      id: 'overdue',
      title: `${overdue.length} recibo${overdue.length === 1 ? '' : 's'} vencido${overdue.length === 1 ? '' : 's'}`,
      subtitle: `${formatCurrency(amount)} · el más antiguo lleva ${oldestDays} días`,
      href: '/finanzas/pagos?estado=vencido',
    })
  }

  const unpaidInvoices = invoices.filter(i => i.status === 'issued')
  if (unpaidInvoices.length > 0) {
    const oldest = unpaidInvoices.reduce((min, i) => new Date(i.invoiceDate) < new Date(min.invoiceDate) ? i : min)
    items.push({
      id: 'unpaid-invoices',
      title: `${unpaidInvoices.length} factura${unpaidInvoices.length === 1 ? '' : 's'} sin cobrar`,
      subtitle: `emitidas desde el ${formatDate(oldest.invoiceDate)}`,
      href: '/finanzas/facturas?estado=issued',
    })
  }

  const pendingExpenses = transactions.filter(t => t.type === 'gasto' && t.status === 'pendiente' && new Date(t.date) <= now)
  for (const t of pendingExpenses) {
    items.push({
      id: t.id,
      title: `${t.concept} sin pagar`,
      subtitle: `${formatCurrency(t.amount)} · vence el ${formatDate(t.date)}`,
      href: '/finanzas/ingresos-gastos',
    })
  }

  return items
}
```

Nota de naming: el mock dice "12 facturas sin enviar"; se usa "sin
cobrar" (`status === 'issued'`, es decir emitida y no pagada) porque es
el dato real disponible — no existe un campo "enviada por email" en
`Invoice` hoy, y esta fase no lo añade (no lo pidió el usuario, y no hay
mock adicional que lo requiera).

Cada aviso es un `<Link>` a su `href`; en la pestaña Pagos (fase F2) se
implementará el filtro por query param `estado`; en Facturas (fase F3) el
filtro por `estado`; hasta entonces el enlace navega correctamente a la
pestaña pero no aplica el filtro visualmente (la pestaña destino ya
existe y es funcional, solo no lee aún ese query param — se documenta
como pendiente de F2/F3, igual que ya se aceptó para Grupos/Eventos con
la fila de filtros).

**`forecastNextMonth`** (nueva) — movimientos previstos del mes
siguiente al seleccionado:

```ts
export interface ForecastItem {
  name: string
  meta: string
  amount: number // positivo = ingreso, negativo = gasto
}

export interface Forecast {
  items: ForecastItem[]
  total: number
}

export function forecastNextMonth(
  nextMonthKey: string,
  activeEnrollments: { amount: number }[], // importe de tarifa mensual por matrícula activa
  transactions: ClubTransaction[]
): Forecast {
  const items: ForecastItem[] = []
  if (activeEnrollments.length > 0) {
    const total = activeEnrollments.reduce((s, e) => s + e.amount, 0)
    items.push({
      name: 'Cobro de cuotas',
      meta: `${activeEnrollments.length} recibos previstos`,
      amount: total,
    })
  }
  const scheduled = transactions.filter(t => t.status === 'pendiente' && dateToMonthKey(t.date) === nextMonthKey)
  for (const t of scheduled) {
    items.push({
      name: t.concept,
      meta: t.type === 'ingreso' ? 'previsto, pendiente de cobro' : formatDate(t.date),
      amount: t.type === 'ingreso' ? t.amount : -t.amount,
    })
  }
  return { items, total: items.reduce((s, i) => s + i.amount, 0) }
}
```

`activeEnrollments` se calcula en `ResumenPage` a partir de
`enrollments.filter(e => e.isActive)` cruzado con la tarifa de cada uno
(mismo patrón de resolución de tarifa ya usado en el módulo de Grupos
para "importe fijo trimestral/anual" — reutiliza esa función existente
en vez de reimplementar el cálculo de precio).

### "Resultado del mes" (columna derecha)

`monthlyTotals` del mes seleccionado; desglose Ingresos totales / Gastos
= los mismos dos números ya calculados arriba, sin cálculo adicional.

### Botón "Registrar cobro"

Extrae el diálogo de alta manual de pago de `PaymentsPage.tsx` (líneas
~833-855 y su JSX del `Dialog`) a un componente compartido
`src/components/payments/AddManualPaymentDialog.tsx` (mismo patrón que
otros diálogos ya extraídos como `GenerateInvoiceDialog`). `PaymentsPage`
pasa a usar ese componente en vez de su copia inline (limpieza dentro del
alcance: mismo comportamiento, sin duplicar lógica). `ResumenPage` lo usa
igual, registrando la acción vía `setPrimaryAction({ label: 'Registrar
cobro', icon: Plus, onClick: () => setDialogOpen(true) })`.

## Fuera de alcance / riesgos conocidos

- El coste de `attentionItems`/`forecastNextMonth`/`monthlyTotals` es
  lineal sobre pagos/transacciones/eventos/clases — mismo criterio de
  aceptación que fases anteriores con el volumen de datos actual del
  club.
- `forecastNextMonth` asume que toda matrícula activa genera un recibo el
  mes siguiente por el importe íntegro de su tarifa; no tiene en cuenta
  altas/bajas a mitad de mes, prorrateos, ni descuentos — es una
  estimación, coherente con que el propio mock la titula "previsto"
  (comprometido, no garantizado).
- Los 3 enlaces de "Requiere tu atención" navegan a la pestaña correcta
  pero el filtrado por query param (`?estado=...`) no se implementa hasta
  las fases F2/F3 de Pagos/Facturas — limitación aceptada y documentada
  arriba.
- Las 4 páginas de Finanzas no rediseñadas todavía muestran su propio
  `Header` (con su propio subtítulo/acciones) debajo del topbar nuevo de
  `FinanzasLayout` durante esta fase transicional — mismo estado por el
  que pasó Clases entre Fases A y E.
