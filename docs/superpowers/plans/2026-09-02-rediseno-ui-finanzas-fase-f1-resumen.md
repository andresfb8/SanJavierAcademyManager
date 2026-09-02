# Finanzas Fase F1 (Layout + Resumen) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear el layout compartido de Finanzas (`FinanzasLayout`, topbar +
5 pestañas) y la nueva página `ResumenPage`, con todos sus cálculos sobre
datos reales, según
`docs/superpowers/specs/2026-09-02-rediseno-ui-finanzas-fase-f1-resumen-design.md`.

**Architecture:** Mismo patrón que `ClasesLayout`/Fases A-E de Clases:
un layout con `<Outlet context={...}>` envolviendo rutas anidadas bajo
`/finanzas`. Las 4 páginas de Finanzas existentes (`PaymentsPage`,
`InvoicesPage`, `FinancialsPage`, `FinancialAnalyticsPage`) se cuelgan de
ese layout sin tocar su contenido. Se extiende `finance-analytics.ts` con
funciones puras y testeadas para alimentar el dashboard nuevo.

**Tech Stack:** React 19 + TypeScript, react-router-dom v7, Zustand
(`useDataStore`), Recharts, Vitest (tests de `finance-analytics.ts`).

---

## Task 1: Modelo de datos + funciones nuevas en `finance-analytics.ts`

**Files:**
- Modify: `src/types/index.ts:675-690`
- Modify: `src/lib/finance-analytics.ts`
- Modify: `src/lib/finance-analytics.test.ts`
- Modify: `src/pages/FinancialsPage.tsx:67-75` (añadir label de la nueva categoría)

- [ ] **Step 1: Extender `ClubTransaction` y `TransactionCategory`**

En `src/types/index.ts`, reemplazar el bloque (líneas 675-690):

```ts
// --- Transacciones Financieras del Club (P&L) ---
export type TransactionType = 'ingreso' | 'gasto'
export type TransactionCategory = 'alquiler' | 'suministros' | 'material' | 'reparaciones' | 'publicidad' | 'limpieza' | 'nomina' | 'otro'

export interface ClubTransaction {
  id: string
  clubId: string
  type: TransactionType
  category: TransactionCategory
  concept: string
  amount: number
  date: Date
  registeredBy?: string // userId del usuario que la registró
  relatedId?: string    // Ej: coachId para vincular la nómina a un entrenador
  notes?: string
```

por:

```ts
// --- Transacciones Financieras del Club (P&L) ---
export type TransactionType = 'ingreso' | 'gasto'
export type TransactionCategory = 'alquiler' | 'suministros' | 'material' | 'reparaciones' | 'publicidad' | 'limpieza' | 'nomina' | 'otro' | 'subvencion'
export type TransactionStatus = 'pagado' | 'pendiente'

export interface ClubTransaction {
  id: string
  clubId: string
  type: TransactionType
  category: TransactionCategory
  concept: string
  amount: number
  date: Date            // puede ser futura cuando status === 'pendiente'
  status?: TransactionStatus // ausente == 'pagado' (compatibilidad con registros existentes)
  registeredBy?: string // userId del usuario que la registró
  relatedId?: string    // Ej: coachId para vincular la nómina a un entrenador
  notes?: string
```

(el resto de la interfaz, `createdAt: Date` y el cierre `}`, no cambia).

- [ ] **Step 2: Añadir el label de la nueva categoría en `FinancialsPage.tsx`**

En `src/pages/FinancialsPage.tsx`, localizar `CATEGORY_LABELS` (línea 67)
y añadir la entrada que falta:

```ts
const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  alquiler: 'Alquiler',
  suministros: 'Suministros',
  material: 'Material',
  reparaciones: 'Reparaciones',
  publicidad: 'Publicidad',
  limpieza: 'Limpieza',
  nomina: 'Nómina',
  otro: 'Otro',
  subvencion: 'Subvención/Patrocinio',
}
```

(mantener el resto de claves existentes tal cual; TypeScript daría error
de "missing property" si se omite `subvencion`, así que este paso es
obligatorio para que el proyecto compile tras el Step 1).

- [ ] **Step 3: Exportar `dateToMonthKey` en `finance-analytics.ts`**

En `src/lib/finance-analytics.ts`, la función ya existe como privada
(línea 149). Cambiar:

```ts
function dateToMonthKey(date: Date | string): string {
```

por:

```ts
export function dateToMonthKey(date: Date | string): string {
```

- [ ] **Step 4: Escribir los tests que fallan para `monthlyTotals`**

Añadir a `src/lib/finance-analytics.test.ts` (revisar el import existente
en la línea 4 y añadir `Invoice`, `Enrollment` a la lista de tipos
importados de `@/types`, ya que se usan en tests de pasos posteriores):

```ts
import { monthlyTotals, collectionBreakdown, attentionItems, forecastNextMonth, activeMonthlyEnrollmentAmounts } from './finance-analytics'
import type { Invoice, Enrollment } from '@/types'
```

Añadir al final del archivo:

```ts
describe('monthlyTotals', () => {
  it('suma ingresos y gastos de cuotas, eventos, clases y transacciones del mes', () => {
    const payments: NormalizedPayment[] = [
      { id: 'p1', source: 'cuota', playerId: 'pl1', playerName: 'A', concept: 'Cuota', amount: 100, status: 'pagado', billingMonth: 8, billingYear: 2026 },
    ]
    const events: AcademyEvent[] = []
    const eventPayments: EventPayment[] = []
    const privateLessons: PrivateLesson[] = []
    const privateLessonPayments: PrivateLessonPayment[] = []
    const transactions: ClubTransaction[] = [
      makeTransaction({ type: 'ingreso', category: 'subvencion', amount: 200, date: new Date(2026, 7, 5) }),
      makeTransaction({ type: 'gasto', category: 'alquiler', amount: 50, date: new Date(2026, 7, 10) }),
    ]
    const result = monthlyTotals('2026-8', payments, events, eventPayments, privateLessons, privateLessonPayments, transactions)
    expect(result.ingresos).toBe(300)
    expect(result.gastos).toBe(50)
    expect(result.beneficio).toBe(250)
  })

  it('ignora transacciones con status pendiente', () => {
    const transactions: ClubTransaction[] = [
      makeTransaction({ type: 'gasto', category: 'otro', amount: 999, date: new Date(2026, 7, 15), status: 'pendiente' }),
    ]
    const result = monthlyTotals('2026-8', [], [], [], [], [], transactions)
    expect(result.gastos).toBe(0)
  })

  it('ignora movimientos fuera del mes pedido', () => {
    const transactions: ClubTransaction[] = [
      makeTransaction({ type: 'ingreso', category: 'otro', amount: 500, date: new Date(2026, 6, 30) }),
    ]
    const result = monthlyTotals('2026-8', [], [], [], [], [], transactions)
    expect(result.ingresos).toBe(0)
  })
})
```

- [ ] **Step 5: Ejecutar los tests y verificar que fallan**

Run: `npm test -- finance-analytics`
Expected: FAIL — `monthlyTotals is not a function` (o error de import).

- [ ] **Step 6: Implementar `monthlyTotals`**

Añadir a `src/lib/finance-analytics.ts`, después de `revenueByOrigin`:

```ts
export interface MonthlyTotals {
  ingresos: number
  gastos: number
  beneficio: number
}

/**
 * Ingresos y gastos totales de `monthKey` ("YYYY-M"): cuotas+eventos+clases
 * pagados (via revenueByOrigin) mas transacciones de club con status
 * 'pagado' (o sin status, por compatibilidad), y gastos de eventos
 * (`event.expenses`) mas transacciones de tipo gasto en el mismo estado.
 * Extraida de la logica que antes vivia duplicada en
 * AnnualFinancialSummary.tsx y FinancialsPage.tsx.
 */
export function monthlyTotals(
  monthKey: string,
  payments: NormalizedPayment[],
  events: AcademyEvent[],
  eventPayments: EventPayment[],
  privateLessons: PrivateLesson[],
  privateLessonPayments: PrivateLessonPayment[],
  transactions: ClubTransaction[]
): MonthlyTotals {
  const monthKeys = new Set([monthKey])
  const origin = revenueByOrigin(payments, monthKeys)

  const gastosEventos = events
    .filter(ev => dateToMonthKey(ev.date) === monthKey)
    .reduce((s, ev) => s + (ev.expenses ?? []).reduce((s2, ex) => s2 + ex.amount, 0), 0)

  const transMes = transactions.filter(t => (t.status ?? 'pagado') === 'pagado' && dateToMonthKey(t.date) === monthKey)
  const extrasIngresos = transMes.filter(t => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0)
  const extrasGastos = transMes.filter(t => t.type === 'gasto').reduce((s, t) => s + t.amount, 0)

  const ingresos = origin.cuotas + origin.eventos + origin.clases + extrasIngresos
  const gastos = gastosEventos + extrasGastos
  return { ingresos, gastos, beneficio: ingresos - gastos }
}
```

`eventPayments`/`privateLessons`/`privateLessonPayments` quedan sin usar
directamente aquí porque `revenueByOrigin` ya opera sobre
`NormalizedPayment[]` (que ya incluye eventos y clases particulares
normalizados) — se mantienen como parámetros para que la firma sea
autoexplicativa y coherente con `AnnualFinancialSummary`, que construye
`payments` a partir de esas mismas fuentes antes de llamar aquí.

- [ ] **Step 7: Ejecutar los tests y verificar que pasan**

Run: `npm test -- finance-analytics`
Expected: PASS (los 3 tests de `monthlyTotals`).

- [ ] **Step 8: Escribir los tests que fallan para `collectionBreakdown`**

Añadir a `finance-analytics.test.ts`:

```ts
describe('collectionBreakdown', () => {
  const now = new Date(2026, 7, 28)

  it('separa pagado, pendiente (futuro) y vencido (pasado)', () => {
    const payments: NormalizedPayment[] = [
      { id: 'a', source: 'cuota', playerId: 'p1', playerName: 'A', concept: 'Cuota', amount: 100, status: 'pagado', billingMonth: 8, billingYear: 2026 },
      { id: 'b', source: 'manual', playerId: 'p2', playerName: 'B', concept: 'Manual', amount: 50, status: 'pendiente', billingMonth: 8, billingYear: 2026, dueDate: new Date(2026, 8, 5) },
      { id: 'c', source: 'cuota', playerId: 'p3', playerName: 'C', concept: 'Cuota', amount: 30, status: 'pendiente', billingMonth: 8, billingYear: 2026, dueDate: new Date(2026, 7, 1) },
    ]
    const result = collectionBreakdown(payments, new Set(['2026-8']), now)
    expect(result.paidAmount).toBe(100)
    expect(result.pendingAmount).toBe(50)
    expect(result.overdueAmount).toBe(30)
    expect(result.total).toBe(180)
  })

  it('ignora pagos que no son de cuota/manual', () => {
    const payments: NormalizedPayment[] = [
      { id: 'a', source: 'evento', playerId: 'p1', playerName: 'A', concept: 'Evento', amount: 999, status: 'pagado', billingMonth: 8, billingYear: 2026 },
    ]
    const result = collectionBreakdown(payments, new Set(['2026-8']), now)
    expect(result.total).toBe(0)
  })
})
```

- [ ] **Step 9: Ejecutar los tests y verificar que fallan**

Run: `npm test -- finance-analytics`
Expected: FAIL — `collectionBreakdown is not a function`.

- [ ] **Step 10: Implementar `collectionBreakdown`**

Añadir después de `monthlyTotals`:

```ts
export interface CollectionBreakdown {
  paidAmount: number
  pendingAmount: number
  overdueAmount: number
  total: number
}

/**
 * Como collectionStats, pero separa 'pendiente' en pendiente (dueDate en
 * el futuro) y vencido (dueDate ya pasado), solo para pagos de cuota
 * (source cuota/manual) — pensado para la tarjeta "Estado de cobros" del
 * Resumen de Finanzas, que distingue ambos.
 */
export function collectionBreakdown(
  payments: NormalizedPayment[],
  monthKeys: Set<string>,
  now: Date = new Date()
): CollectionBreakdown {
  let paidAmount = 0
  let pendingAmount = 0
  let overdueAmount = 0
  for (const p of payments) {
    if (p.source !== 'cuota' && p.source !== 'manual') continue
    if (!monthKeys.has(monthKeyOf(p))) continue
    if (p.status === 'pagado') {
      paidAmount += p.amount
    } else if (p.status === 'pendiente') {
      if (p.dueDate && new Date(p.dueDate) < now) overdueAmount += p.amount
      else pendingAmount += p.amount
    }
  }
  return { paidAmount, pendingAmount, overdueAmount, total: paidAmount + pendingAmount + overdueAmount }
}
```

- [ ] **Step 11: Ejecutar los tests y verificar que pasan**

Run: `npm test -- finance-analytics`
Expected: PASS.

- [ ] **Step 12: Escribir los tests que fallan para `attentionItems`**

Añadir a `finance-analytics.test.ts`:

```ts
function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv1',
    invoiceNumber: 'FC-2026-001',
    series: 'FC',
    invoiceDate: new Date(2026, 7, 1),
    playerId: 'p1',
    playerName: 'Jugador Uno',
    lineItems: [],
    subtotal: 100,
    totalVat: 10,
    total: 110,
    vatBreakdown: {},
    status: 'issued',
    paymentIds: [],
    createdAt: new Date(2026, 7, 1),
    createdBy: 'user1',
    ...overrides,
  }
}

describe('attentionItems', () => {
  const now = new Date(2026, 7, 28)

  it('incluye un aviso de recibos vencidos con el importe y los dias del mas antiguo', () => {
    const payments: NormalizedPayment[] = [
      { id: 'a', source: 'cuota', playerId: 'p1', playerName: 'A', concept: 'Cuota', amount: 100, status: 'pendiente', billingMonth: 7, billingYear: 2026, dueDate: new Date(2026, 6, 27) },
    ]
    const items = attentionItems(payments, [], [], now)
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('1 recibo vencido')
    expect(items[0].subtitle).toContain('32 días')
  })

  it('incluye un aviso de facturas emitidas sin cobrar', () => {
    const items = attentionItems([], [makeInvoice({ status: 'issued' })], [], now)
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('1 factura sin cobrar')
  })

  it('incluye un aviso por cada transaccion de gasto pendiente ya vencida', () => {
    const transactions: ClubTransaction[] = [
      makeTransaction({ type: 'gasto', category: 'otro', concept: 'Seguro RC', amount: 410, date: new Date(2026, 7, 20), status: 'pendiente' }),
    ]
    const items = attentionItems([], [], transactions, now)
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Seguro RC sin pagar')
  })

  it('no incluye nada cuando no hay avisos', () => {
    expect(attentionItems([], [], [], now)).toHaveLength(0)
  })
})
```

- [ ] **Step 13: Ejecutar los tests y verificar que fallan**

Run: `npm test -- finance-analytics`
Expected: FAIL — `attentionItems is not a function`.

- [ ] **Step 14: Implementar `attentionItems`**

Añadir el import de `Invoice` en la cabecera del archivo (junto a los
demás tipos importados de `@/types`), y después de `collectionBreakdown`:

```ts
export interface AttentionItem {
  id: string
  title: string
  subtitle: string
  href: string
}

/**
 * Avisos de "Requiere tu atencion" del Resumen de Finanzas: recibos
 * vencidos, facturas emitidas sin cobrar, y transacciones de gasto
 * marcadas como pendientes cuya fecha ya llego o paso.
 */
export function attentionItems(
  payments: NormalizedPayment[],
  invoices: Invoice[],
  transactions: ClubTransaction[],
  now: Date = new Date()
): AttentionItem[] {
  const items: AttentionItem[] = []

  const overdue = payments.filter(p => p.status === 'pendiente' && p.dueDate && new Date(p.dueDate) < now)
  if (overdue.length > 0) {
    const amount = overdue.reduce((s, p) => s + p.amount, 0)
    const oldestMs = Math.min(...overdue.map(p => new Date(p.dueDate as Date).getTime()))
    const oldestDays = Math.floor((now.getTime() - oldestMs) / 86400000)
    items.push({
      id: 'overdue',
      title: `${overdue.length} recibo${overdue.length === 1 ? '' : 's'} vencido${overdue.length === 1 ? '' : 's'}`,
      subtitle: `${formatCurrency(amount)} · el más antiguo lleva ${oldestDays} días`,
      href: '/finanzas/pagos',
    })
  }

  const unpaidInvoices = invoices.filter(i => i.status === 'issued')
  if (unpaidInvoices.length > 0) {
    const oldest = unpaidInvoices.reduce((min, i) => new Date(i.invoiceDate) < new Date(min.invoiceDate) ? i : min)
    items.push({
      id: 'unpaid-invoices',
      title: `${unpaidInvoices.length} factura${unpaidInvoices.length === 1 ? '' : 's'} sin cobrar`,
      subtitle: `emitidas desde el ${formatDateLong(new Date(oldest.invoiceDate))}`,
      href: '/finanzas/facturas',
    })
  }

  const pendingExpenses = transactions.filter(
    t => t.type === 'gasto' && t.status === 'pendiente' && new Date(t.date) <= now
  )
  for (const t of pendingExpenses) {
    items.push({
      id: t.id,
      title: `${t.concept} sin pagar`,
      subtitle: `${formatCurrency(t.amount)} · vence el ${formatDateLong(new Date(t.date))}`,
      href: '/finanzas/ingresos-gastos',
    })
  }

  return items
}
```

Añadir el import necesario al principio del archivo:

```ts
import { formatCurrency, formatDateLong } from '@/lib/utils'
```

- [ ] **Step 15: Ejecutar los tests y verificar que pasan**

Run: `npm test -- finance-analytics`
Expected: PASS.

- [ ] **Step 16: Escribir los tests que fallan para `activeMonthlyEnrollmentAmounts` y `forecastNextMonth`**

Añadir a `finance-analytics.test.ts`:

```ts
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
    currentEnrollment: 1,
    defaultTariffId: 't1',
    defaultTariffPrice: 50,
    billingFrequency: 'monthly',
    startDate: new Date(2026, 0, 1),
    endDate: new Date(2026, 11, 31),
    isActive: true,
    createdAt: new Date(2026, 0, 1),
    ...overrides,
  }
}

function makeEnrollment(overrides: Partial<Enrollment> = {}): Enrollment {
  return {
    id: 'e1',
    playerId: 'p1',
    playerName: 'Jugador Uno',
    groupId: 'g1',
    groupName: 'Grupo 1',
    tariffId: 't1',
    tariffName: 'Tarifa mensual',
    enrollmentDate: new Date(2026, 0, 1),
    isActive: true,
    ...overrides,
  }
}

describe('activeMonthlyEnrollmentAmounts', () => {
  it('incluye matriculas activas mensuales, usando customPrice si existe', () => {
    const groups = [makeGroup()]
    const enrollments = [makeEnrollment(), makeEnrollment({ id: 'e2', customPrice: 40 })]
    const result = activeMonthlyEnrollmentAmounts(enrollments, groups)
    expect(result).toEqual([{ enrollmentId: 'e1', amount: 50 }, { enrollmentId: 'e2', amount: 40 }])
  })

  it('excluye matriculas inactivas, en lista de espera, o de frecuencia no mensual', () => {
    const groups = [makeGroup(), makeGroup({ id: 'g2', billingFrequency: 'quarterly' })]
    const enrollments = [
      makeEnrollment({ id: 'e1', isActive: false }),
      makeEnrollment({ id: 'e2', isWaitlist: true }),
      makeEnrollment({ id: 'e3', groupId: 'g2', groupName: 'Grupo 2' }),
    ]
    expect(activeMonthlyEnrollmentAmounts(enrollments, groups)).toEqual([])
  })
})

describe('forecastNextMonth', () => {
  it('incluye el cobro de cuotas previsto y los movimientos pendientes del mes', () => {
    const transactions: ClubTransaction[] = [
      makeTransaction({ type: 'ingreso', category: 'subvencion', concept: 'Subvención deporte base', amount: 1200, date: new Date(2026, 8, 15), status: 'pendiente' }),
      makeTransaction({ type: 'gasto', category: 'nomina', concept: 'Nóminas del equipo', amount: 2250, date: new Date(2026, 8, 5), status: 'pendiente' }),
      makeTransaction({ type: 'gasto', category: 'otro', concept: 'Ya pagado', amount: 999, date: new Date(2026, 8, 5), status: 'pagado' }),
    ]
    const result = forecastNextMonth('2026-9', [{ enrollmentId: 'e1', amount: 11520 }], transactions)
    expect(result.items).toHaveLength(3)
    expect(result.items[0]).toEqual({ name: 'Cobro de cuotas', meta: '1 recibos previstos', amount: 11520 })
    expect(result.total).toBe(11520 + 1200 - 2250)
  })

  it('omite la linea de cuotas cuando no hay matriculas activas mensuales', () => {
    const result = forecastNextMonth('2026-9', [], [])
    expect(result.items).toHaveLength(0)
    expect(result.total).toBe(0)
  })
})
```

- [ ] **Step 17: Ejecutar los tests y verificar que fallan**

Run: `npm test -- finance-analytics`
Expected: FAIL — `activeMonthlyEnrollmentAmounts`/`forecastNextMonth` no
son funciones.

- [ ] **Step 18: Implementar `activeMonthlyEnrollmentAmounts` y `forecastNextMonth`**

Añadir el import de `Enrollment` en la cabecera del archivo, y al final
del archivo:

```ts
export interface ActiveEnrollmentAmount {
  enrollmentId: string
  amount: number
}

/**
 * Importe mensual de cada matricula activa cuya frecuencia de facturacion
 * (resuelta de enrollment.billingFrequency, o group.billingFrequency si
 * no hay override) es 'monthly'. Las matriculas trimestrales/anuales/por
 * plazos se excluyen a proposito: su mes exacto de cobro depende de
 * billingAnchorMonth/installmentPrices, logica que hoy solo vive de forma
 * fiable en la generacion de recibos server-side
 * (generateMonthlyReceiptsAtomic) — reimplementarla aqui duplicaria una
 * pieza de negocio con historial de bugs (ver notas de "tarifa unica
 * precio/frecuencia"). Limitacion aceptada: la prevision de "Cobro de
 * cuotas" en el Resumen solo cubre las matriculas mensuales.
 */
export function activeMonthlyEnrollmentAmounts(
  enrollments: Enrollment[],
  groups: Group[]
): ActiveEnrollmentAmount[] {
  const result: ActiveEnrollmentAmount[] = []
  for (const e of enrollments) {
    if (!e.isActive || e.isWaitlist) continue
    const group = groups.find(g => g.id === e.groupId)
    if (!group) continue
    const frequency = e.billingFrequency ?? group.billingFrequency
    if (frequency !== 'monthly') continue
    result.push({ enrollmentId: e.id, amount: e.customPrice ?? group.defaultTariffPrice })
  }
  return result
}

export interface ForecastItem {
  name: string
  meta: string
  amount: number // positivo = ingreso, negativo = gasto
}

export interface Forecast {
  items: ForecastItem[]
  total: number
}

/**
 * Movimientos previstos para `nextMonthKey` ("YYYY-M"): el cobro de
 * cuotas mensuales recurrentes (ver activeMonthlyEnrollmentAmounts) mas
 * cualquier ClubTransaction con status 'pendiente' fechada ese mes
 * (ingreso o gasto ya registrado como previsto).
 */
export function forecastNextMonth(
  nextMonthKey: string,
  activeEnrollments: ActiveEnrollmentAmount[],
  transactions: ClubTransaction[]
): Forecast {
  const items: ForecastItem[] = []
  if (activeEnrollments.length > 0) {
    items.push({
      name: 'Cobro de cuotas',
      meta: `${activeEnrollments.length} recibos previstos`,
      amount: activeEnrollments.reduce((s, e) => s + e.amount, 0),
    })
  }
  const scheduled = transactions.filter(t => t.status === 'pendiente' && dateToMonthKey(t.date) === nextMonthKey)
  for (const t of scheduled) {
    items.push({
      name: t.concept,
      meta: t.type === 'ingreso' ? 'previsto, pendiente de cobro' : formatDate(new Date(t.date)),
      amount: t.type === 'ingreso' ? t.amount : -t.amount,
    })
  }
  return { items, total: items.reduce((s, i) => s + i.amount, 0) }
}
```

Añadir `formatDate` al import ya añadido en el Step 14:

```ts
import { formatCurrency, formatDate, formatDateLong } from '@/lib/utils'
```

- [ ] **Step 19: Ejecutar todos los tests de `finance-analytics` y verificar que pasan**

Run: `npm test -- finance-analytics`
Expected: PASS — todos los tests, incluidos los preexistentes.

- [ ] **Step 20: Verificar el build de TypeScript**

Run: `npm run build`
Expected: sin errores (verifica que `TransactionCategory`/`CATEGORY_LABELS`
quedaron sincronizados, y que no queda ningún otro `switch`/objeto
exhaustivo sobre `TransactionCategory` sin actualizar — si el build falla
por eso, añadir el caso que falte).

- [ ] **Step 21: Commit**

```bash
git add src/types/index.ts src/lib/finance-analytics.ts src/lib/finance-analytics.test.ts src/pages/FinancialsPage.tsx
git commit -m "feat: extender ClubTransaction y anadir calculos de Resumen a finance-analytics"
```

---

## Task 2: Extraer `AddManualPaymentDialog` de `PaymentsPage`

**Files:**
- Create: `src/components/payments/AddManualPaymentDialog.tsx`
- Modify: `src/pages/PaymentsPage.tsx`

- [ ] **Step 1: Crear el componente `AddManualPaymentDialog`**

Crear `src/components/payments/AddManualPaymentDialog.tsx` con el
contenido íntegro del diálogo y su estado, extraído de
`PaymentsPage.tsx` (líneas 164-168, 199-202, 833-855, 1507-1567 de la
versión actual):

```tsx
import { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/shared/SearchableSelect'
import { useDataStore } from '@/stores/dataStore'
import { PAYMENT_CATEGORIES } from '@/constants'
import type { PaymentCategory } from '@/types'
import { Plus } from 'lucide-react'

interface AddManualPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddManualPaymentDialog({ open, onOpenChange }: AddManualPaymentDialogProps) {
  const { players, addManualPayment } = useDataStore()

  const [playerId, setPlayerId] = useState('')
  const [concept, setConcept] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<PaymentCategory>('manual')
  const [notes, setNotes] = useState('')

  const activePlayers = useMemo(
    () => players.filter((p) => p.status === 'activo').sort((a, b) => a.lastName.localeCompare(b.lastName)),
    [players]
  )

  function reset() {
    setPlayerId('')
    setConcept('')
    setAmount('')
    setCategory('manual')
    setNotes('')
  }

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen)
    if (!nextOpen) reset()
  }

  function handleSave() {
    if (!playerId || !concept || !amount) return
    const player = players.find((p) => p.id === playerId)
    if (!player) return
    addManualPayment({
      playerId,
      playerName: `${player.firstName} ${player.lastName}`,
      concept,
      amount: parseFloat(amount) || 0,
      category,
      notes: notes || undefined,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl sm:max-w-xl md:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo pago manual</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="player">Jugador *</Label>
            <SearchableSelect
              options={activePlayers.map((p) => ({
                value: p.id,
                label: `${p.lastName}, ${p.firstName}${p.dni ? ` - ${p.dni}` : ''}`
              }))}
              value={playerId}
              onChange={setPlayerId}
              placeholder="Seleccionar jugador..."
              searchPlaceholder="Buscar por nombre, apellido o DNI..."
              emptyMessage="No se encontraron jugadores"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Concepto</Label>
            <Input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Ej: Material deportivo, Clinica especial..." />
          </div>
          <div className="space-y-1.5">
            <Label>Importe (&euro;)</Label>
            <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select
              options={PAYMENT_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
              value={category}
              onChange={(e) => setCategory(e.target.value as PaymentCategory)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas adicionales (opcional)" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!playerId || !concept || !amount}>
            <Plus className="h-4 w-4 mr-1" />
            Crear pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Usar el componente nuevo en `PaymentsPage.tsx`**

En `src/pages/PaymentsPage.tsx`:

1. Añadir el import: `import { AddManualPaymentDialog } from '@/components/payments/AddManualPaymentDialog'`.
2. Eliminar las 5 líneas de estado `manualDialogOpen`/`manualPlayerId`/`manualConcept`/`manualAmount`/`manualCategory`/`manualNotes` (líneas 164-168), dejando solo `const [manualDialogOpen, setManualDialogOpen] = useState(false)`.
3. Eliminar el `useMemo` de `activePlayers` (líneas 199-202) — ya no se usa en este archivo tras el siguiente punto (comprobar con el compilador en el Step 3 que ninguna otra parte de `PaymentsPage.tsx` lo sigue usando; si alguna otra sección del archivo lo necesita, mantenerlo y solo eliminar el duplicado dentro del diálogo).
4. Eliminar `openManualPaymentDialog` y `handleSaveManualPayment` (líneas 833-855), y sustituir la única llamada a `openManualPaymentDialog()` (el botón que abre el diálogo) por `() => setManualDialogOpen(true)`.
5. Sustituir el bloque `<Dialog open={manualDialogOpen} ...>...</Dialog>` completo (líneas 1507-1567) por:

```tsx
<AddManualPaymentDialog open={manualDialogOpen} onOpenChange={setManualDialogOpen} />
```

6. Cambiar el `<Link to="/facturas" ...>` de la línea 545 a `<Link to="/finanzas/facturas" ...>` (la ruta `/facturas` seguirá funcionando via redirect tras la Tarea 5, pero enlazar directo evita un salto innecesario).

- [ ] **Step 3: Verificar que compila y los tests existentes pasan**

Run: `npm run build`
Expected: sin errores. Si `PaymentCategory`/`Plus`/`SearchableSelect` u
otros imports quedaron sin uso en `PaymentsPage.tsx` tras la extracción,
eliminarlos.

- [ ] **Step 4: Verificación manual en el navegador**

Arrancar `npm run dev`, ir a `/pagos`, abrir "Nuevo pago manual", crear un
pago de prueba y confirmar que aparece en la tabla igual que antes de la
extracción.

- [ ] **Step 5: Commit**

```bash
git add src/components/payments/AddManualPaymentDialog.tsx src/pages/PaymentsPage.tsx
git commit -m "refactor: extraer AddManualPaymentDialog de PaymentsPage para reutilizarlo en Resumen"
```

---

## Task 3: `FinanzasLayout.tsx`

**Files:**
- Create: `src/components/layout/topbar-types.ts`
- Modify: `src/components/layout/ClasesLayout.tsx`
- Create: `src/components/layout/FinanzasLayout.tsx`

- [ ] **Step 1: Mover `ClasesPrimaryAction` a un archivo compartido**

Crear `src/components/layout/topbar-types.ts`:

```ts
import type { LucideIcon } from 'lucide-react'

export type PrimaryAction =
  | { label: string; icon?: LucideIcon; onClick: () => void }
  | { label: string; icon?: LucideIcon; items: { label: string; icon?: LucideIcon; onClick: () => void }[] }
```

- [ ] **Step 2: Hacer que `ClasesLayout.tsx` reutilice el tipo compartido**

En `src/components/layout/ClasesLayout.tsx`, sustituir la definición
local de `ClasesPrimaryAction` (líneas 17-19):

```ts
export type ClasesPrimaryAction =
  | { label: string; icon?: LucideIcon; onClick: () => void }
  | { label: string; icon?: LucideIcon; items: { label: string; icon?: LucideIcon; onClick: () => void }[] }
```

por:

```ts
import type { PrimaryAction } from '@/components/layout/topbar-types'

export type ClasesPrimaryAction = PrimaryAction
```

(añadir el `import` junto a los demás imports del archivo; el import de
`LucideIcon` de `lucide-react` puede quedar si `ClasesOutletContext` u
otro tipo del archivo lo sigue necesitando — comprobar con el
compilador en el Step 4 y eliminarlo si queda sin uso).

- [ ] **Step 3: Crear `FinanzasLayout.tsx`**

Crear `src/components/layout/FinanzasLayout.tsx`:

```tsx
import { useState, useMemo, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useDataStore } from '@/stores/dataStore'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@/components/ui/dropdown-menu'
import { Select } from '@/components/ui/select'
import { NotificationBell } from '@/components/shared/NotificationBell'
import { MONTHS } from '@/constants'
import { ChevronDown, CalendarDays } from 'lucide-react'
import type { PrimaryAction } from '@/components/layout/topbar-types'

interface FinanzasTab {
  name: string
  href: string
  count?: number
}

export interface FinanzasOutletContext {
  setPrimaryAction: (action: PrimaryAction | null) => void
  selectedMonth: number
  selectedYear: number
}

export function FinanzasLayout() {
  const location = useLocation()
  const { payments, invoices, club, seasons } = useDataStore()

  const [primaryAction, setPrimaryAction] = useState<PrimaryAction | null>(null)
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())

  const isResumen = location.pathname === '/finanzas/resumen'

  const activeSeason = club ? seasons.find((s) => s.id === club.activeSeasonId) : undefined

  const inActiveSeason = (date: Date | string) => {
    if (!activeSeason) return true
    const d = date instanceof Date ? date : new Date(date)
    return d >= activeSeason.startDate && d <= activeSeason.endDate
  }

  const tabs: FinanzasTab[] = [
    { name: 'Resumen', href: '/finanzas/resumen' },
    { name: 'Pagos', href: '/finanzas/pagos', count: payments.filter((p) => inActiveSeason(new Date(p.billingYear, p.billingMonth - 1, 1))).length },
    { name: 'Facturas', href: '/finanzas/facturas', count: invoices.filter((i) => i.status !== 'cancelled' && inActiveSeason(i.invoiceDate)).length },
    { name: 'Ingresos y gastos', href: '/finanzas/ingresos-gastos' },
    { name: 'Análisis', href: '/finanzas/analisis' },
  ]

  const subtitle = isResumen
    ? `Resumen de ${MONTHS.find((m) => m.value === selectedMonth)?.label.toLowerCase()} ${selectedYear}${activeSeason ? ` · temporada ${activeSeason.name}` : ''}`
    : undefined

  useEffect(() => {
    setPrimaryAction(null)
  }, [location.pathname])

  const availableYears = useMemo(() => {
    const years = new Set<number>([now.getFullYear()])
    for (const p of payments) years.add(p.billingYear)
    return Array.from(years).sort((a, b) => b - a)
  }, [payments])

  const outletContext = useMemo(
    () => ({ setPrimaryAction, selectedMonth, selectedYear } satisfies FinanzasOutletContext),
    [selectedMonth, selectedYear]
  )

  return (
    <div>
      <div className="border-b border-border bg-card">
        <div className="flex flex-wrap items-center gap-4 px-5 py-5 lg:px-8">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">FINANZAS</h1>
            {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {isResumen && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Elegir mes">
                    <CalendarDays className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="p-3 flex flex-col gap-2 w-48">
                  <Select
                    options={MONTHS.map((m) => ({ value: String(m.value), label: m.label }))}
                    value={String(selectedMonth)}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  />
                  <Select
                    options={availableYears.map((y) => ({ value: String(y), label: String(y) }))}
                    value={String(selectedYear)}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                  />
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <NotificationBell />
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
                      <Button key={item.label} variant="ghost" className="w-full justify-start" onClick={item.onClick}>
                        {item.icon && <item.icon className="h-4 w-4 mr-2" />}
                        {item.label}
                      </Button>
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

Nota sobre `DropdownMenuContent` en el submenú de `primaryAction.items`:
`ClasesLayout` usa `DropdownMenuItem` ahí; se reutiliza el mismo
componente aquí — corregir el bloque anterior para usar
`DropdownMenuItem` en vez de `Button` (igual que `ClasesLayout.tsx`
líneas 115-121), y añadir `DropdownMenuItem` al import de
`@/components/ui/dropdown-menu`:

```tsx
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
```

```tsx
                  <DropdownMenuContent align="end">
                    {primaryAction.items.map((item) => (
                      <DropdownMenuItem key={item.label} onClick={item.onClick}>
                        {item.icon && <item.icon className="h-4 w-4 mr-2" />}
                        {item.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
```

- [ ] **Step 4: Verificar que compila**

Run: `npm run build`
Expected: sin errores. `FinanzasLayout`/`ResumenPage` aún no están
enrutados (eso es la Tarea 5), así que este build solo verifica que el
archivo nuevo y el cambio en `ClasesLayout.tsx` son válidos por sí
mismos — no hace falta ver la página en el navegador todavía.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/topbar-types.ts src/components/layout/ClasesLayout.tsx src/components/layout/FinanzasLayout.tsx
git commit -m "feat: crear FinanzasLayout con topbar y pestanas compartidas de Finanzas"
```

---

## Task 4: `ResumenPage.tsx`

**Files:**
- Create: `src/pages/ResumenPage.tsx`

- [ ] **Step 1: Crear `ResumenPage.tsx`**

Crear `src/pages/ResumenPage.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/shared/StatCard'
import { Button } from '@/components/ui/button'
import { ChevronRight, DollarSign, TrendingDown, TrendingUp, AlertTriangle, Plus } from 'lucide-react'
import { useDataStore } from '@/stores/dataStore'
import { usePaymentsQuery, useEventPaymentsQuery, usePrivateLessonPaymentsQuery, useClubTransactionsQuery, useInvoicesQuery } from '@/hooks/useQueries'
import { normalizeAllPayments } from '@/lib/payment-utils'
import { MONTHS } from '@/constants'
import { formatCurrency } from '@/lib/utils'
import {
  monthlyTotals,
  collectionBreakdown,
  revenueByOrigin,
  attentionItems,
  forecastNextMonth,
  activeMonthlyEnrollmentAmounts,
  pctChange,
} from '@/lib/finance-analytics'
import { AddManualPaymentDialog } from '@/components/payments/AddManualPaymentDialog'
import type { FinanzasOutletContext } from '@/components/layout/FinanzasLayout'

const MONTH_NAMES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function monthKeyFor(year: number, month1to12: number): string {
  return `${year}-${month1to12}`
}

export default function ResumenPage() {
  const { setPrimaryAction, selectedMonth, selectedYear } = useOutletContext<FinanzasOutletContext>()
  const { events, privateLessons, enrollments, groups } = useDataStore()

  const years = useMemo(() => {
    const start = new Date(selectedYear, selectedMonth - 1, 1)
    start.setMonth(start.getMonth() - 11)
    const set = new Set<number>()
    for (let d = new Date(start); d <= new Date(selectedYear, selectedMonth - 1, 1); d.setMonth(d.getMonth() + 1)) {
      set.add(d.getFullYear())
    }
    return Array.from(set)
  }, [selectedMonth, selectedYear])

  const { data: rawPayments = [] } = usePaymentsQuery(years)
  const { data: eventPayments = [] } = useEventPaymentsQuery()
  const { data: privateLessonPayments = [] } = usePrivateLessonPaymentsQuery()
  const { data: transactions = [] } = useClubTransactionsQuery(years)
  const { data: invoices = [] } = useInvoicesQuery()

  const payments = useMemo(
    () => normalizeAllPayments(rawPayments, eventPayments, privateLessonPayments, events),
    [rawPayments, eventPayments, privateLessonPayments, events]
  )

  const [manualDialogOpen, setManualDialogOpen] = useState(false)

  useEffect(() => {
    setPrimaryAction({ label: 'Registrar cobro', icon: Plus, onClick: () => setManualDialogOpen(true) })
    return () => setPrimaryAction(null)
  }, [setPrimaryAction])

  const monthKey = monthKeyFor(selectedYear, selectedMonth)
  const prevDate = new Date(selectedYear, selectedMonth - 2, 1)
  const prevMonthKey = monthKeyFor(prevDate.getFullYear(), prevDate.getMonth() + 1)
  const nextDate = new Date(selectedYear, selectedMonth, 1)
  const nextMonthKey = monthKeyFor(nextDate.getFullYear(), nextDate.getMonth() + 1)

  const current = useMemo(
    () => monthlyTotals(monthKey, payments, events, eventPayments, privateLessons, privateLessonPayments, transactions),
    [monthKey, payments, events, eventPayments, privateLessons, privateLessonPayments, transactions]
  )
  const previous = useMemo(
    () => monthlyTotals(prevMonthKey, payments, events, eventPayments, privateLessons, privateLessonPayments, transactions),
    [prevMonthKey, payments, events, eventPayments, privateLessons, privateLessonPayments, transactions]
  )

  const cobros = useMemo(() => collectionBreakdown(payments, new Set([monthKey])), [payments, monthKey])
  const origin = useMemo(() => revenueByOrigin(payments, new Set([monthKey])), [payments, monthKey])

  const morosidadPct = cobros.total > 0 ? (cobros.overdueAmount / cobros.total) * 100 : 0
  const margenPct = current.ingresos > 0 ? (current.beneficio / current.ingresos) * 100 : 0
  const round1 = (n: number) => Math.round(n * 10) / 10
  const ingresosDeltaRaw = pctChange(current.ingresos, previous.ingresos)
  const gastosDeltaRaw = pctChange(current.gastos, previous.gastos)
  const ingresosDelta = ingresosDeltaRaw !== null ? round1(ingresosDeltaRaw) : null
  const gastosDelta = gastosDeltaRaw !== null ? round1(gastosDeltaRaw) : null

  const composicion = useMemo(() => {
    const monthKeys = new Set([monthKey])
    const subvencion = transactions
      .filter(t => t.type === 'ingreso' && t.category === 'subvencion' && (t.status ?? 'pagado') === 'pagado' && new Date(t.date).getFullYear() === selectedYear && new Date(t.date).getMonth() + 1 === selectedMonth)
      .reduce((s, t) => s + t.amount, 0)
    const material = transactions
      .filter(t => t.type === 'ingreso' && t.category === 'material' && (t.status ?? 'pagado') === 'pagado' && new Date(t.date).getFullYear() === selectedYear && new Date(t.date).getMonth() + 1 === selectedMonth)
      .reduce((s, t) => s + t.amount, 0)
    const rows = [
      { name: 'Cuotas mensuales', amount: origin.cuotas },
      { name: 'Subvención/Patrocinio', amount: subvencion },
      { name: 'Clases particulares', amount: origin.clases },
      { name: 'Torneos y eventos', amount: origin.eventos },
      { name: 'Material y equipación', amount: material },
    ]
    const total = rows.reduce((s, r) => s + r.amount, 0)
    return rows.map(r => ({ ...r, pct: total > 0 ? (r.amount / total) * 100 : 0 })).filter(r => r.amount > 0)
  }, [transactions, origin, monthKey, selectedMonth, selectedYear])

  const evolucion = useMemo(() => {
    const points = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(selectedYear, selectedMonth - 1 - i, 1)
      const key = monthKeyFor(d.getFullYear(), d.getMonth() + 1)
      const totals = monthlyTotals(key, payments, events, eventPayments, privateLessons, privateLessonPayments, transactions)
      points.push({ name: MONTH_NAMES_SHORT[d.getMonth()], Ingresos: totals.ingresos, Gastos: totals.gastos })
    }
    return points
  }, [selectedMonth, selectedYear, payments, events, eventPayments, privateLessons, privateLessonPayments, transactions])

  const avisos = useMemo(() => attentionItems(payments, invoices, transactions), [payments, invoices, transactions])

  const previsto = useMemo(() => {
    const activeAmounts = activeMonthlyEnrollmentAmounts(enrollments, groups)
    return forecastNextMonth(nextMonthKey, activeAmounts, transactions)
  }, [enrollments, groups, nextMonthKey, transactions])

  return (
    <div className="p-5 lg:p-8 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Ingresos totales"
          value={formatCurrency(current.ingresos)}
          icon={TrendingUp}
          trend={ingresosDelta !== null ? { value: ingresosDelta, label: 'vs. mes anterior' } : undefined}
        />
        <StatCard
          title="Gastos"
          value={formatCurrency(current.gastos)}
          icon={TrendingDown}
          trend={gastosDelta !== null ? { value: gastosDelta, label: 'vs. mes anterior' } : undefined}
        />
        <StatCard
          title="Resultado del mes"
          value={formatCurrency(current.beneficio)}
          icon={DollarSign}
          description={`margen ${margenPct.toFixed(1)}%`}
        />
        <StatCard
          title="Morosidad"
          value={`${morosidadPct.toFixed(1)}%`}
          icon={AlertTriangle}
          description={`${formatCurrency(cobros.overdueAmount)} vencidos`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ingresos vs. gastos · 12 meses</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={evolucion}>
                  <XAxis dataKey="name" fontSize={12} />
                  <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                  <Bar dataKey="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Estado de cobros</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                  {cobros.total > 0 && (
                    <>
                      <div className="bg-emerald-500" style={{ width: `${(cobros.paidAmount / cobros.total) * 100}%` }} />
                      <div className="bg-amber-400" style={{ width: `${(cobros.pendingAmount / cobros.total) * 100}%` }} />
                      <div className="bg-red-500" style={{ width: `${(cobros.overdueAmount / cobros.total) * 100}%` }} />
                    </>
                  )}
                </div>
                {[
                  { label: 'Cobrado', color: 'bg-emerald-500', amount: cobros.paidAmount },
                  { label: 'Pendiente', color: 'bg-amber-400', amount: cobros.pendingAmount },
                  { label: 'Vencido', color: 'bg-red-500', amount: cobros.overdueAmount },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-2 text-sm">
                    <span className={`h-2 w-2 rounded-full ${row.color}`} />
                    <span className="flex-1">{row.label}</span>
                    <span className="text-muted-foreground">{cobros.total > 0 ? ((row.amount / cobros.total) * 100).toFixed(0) : 0}%</span>
                    <span className="font-medium">{formatCurrency(row.amount)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>De dónde vienen los ingresos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {composicion.length === 0 && <p className="text-sm text-muted-foreground">Sin ingresos este mes.</p>}
                {composicion.map((row) => (
                  <div key={row.name} className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="flex-1">{row.name}</span>
                      <span className="text-muted-foreground">{row.pct.toFixed(0)}%</span>
                      <span className="font-medium">{formatCurrency(row.amount)}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted">
                      <div className="h-1.5 rounded-full bg-primary" style={{ width: `${row.pct}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resultado del mes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-3xl font-bold">{formatCurrency(current.beneficio)}</p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ingresos totales</span>
                <span className="font-medium">{formatCurrency(current.ingresos)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Gastos</span>
                <span className="font-medium text-red-600">−{formatCurrency(current.gastos)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Requiere tu atención</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {avisos.length === 0 && <p className="text-sm text-muted-foreground">Todo al día.</p>}
              {avisos.map((item) => (
                <Link
                  key={item.id}
                  to={item.href}
                  className="flex items-center gap-3 rounded-md p-2 -mx-2 hover:bg-accent transition-colors"
                >
                  <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">{item.title}</span>
                    <span className="block text-xs text-muted-foreground truncate">{item.subtitle}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Previsto para {MONTHS.find((m) => m.value === nextDate.getMonth() + 1)?.label.toLowerCase()}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {previsto.items.length === 0 && <p className="text-sm text-muted-foreground">Sin movimientos previstos.</p>}
              {previsto.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span>
                    <span className="block">{item.name}</span>
                    <span className="block text-xs text-muted-foreground">{item.meta}</span>
                  </span>
                  <span className={item.amount >= 0 ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
                    {item.amount >= 0 ? '+' : ''}{formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
              {previsto.items.length > 0 && (
                <div className="flex items-center justify-between text-sm font-semibold border-t border-border pt-2 mt-2">
                  <span>SALDO PREVISTO</span>
                  <span className={previsto.total >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                    {previsto.total >= 0 ? '+' : ''}{formatCurrency(previsto.total)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AddManualPaymentDialog open={manualDialogOpen} onOpenChange={setManualDialogOpen} />
    </div>
  )
}
```

- [ ] **Step 2: Confirmar el redondeo de los deltas**

`StatCard` (`src/components/shared/StatCard.tsx`) renderiza
`trend.value` directamente como `{trend.value}%` (con signo `+` si es
positivo, verde/rojo/gris según el signo) — sin redondear internamente.
`ingresosDelta`/`gastosDelta` ya se redondean a 1 decimal en el Step 1
(`round1`) antes de pasarlos, así que no hace falta ningún ajuste
adicional aquí; este paso es solo una verificación de que ese redondeo
sigue en el código antes de continuar al Step 3.

- [ ] **Step 3: Verificar que compila**

Run: `npm run build`
Expected: sin errores. `FinanzasOutletContext` se importa de
`FinanzasLayout.tsx`, que ya existe desde la Tarea 3 — la página todavía
no está enrutada (Tarea 5), así que este build solo comprueba tipos e
imports.

- [ ] **Step 4: Commit**

```bash
git add src/pages/ResumenPage.tsx
git commit -m "feat: crear ResumenPage con KPIs, evolucion, cobros, composicion y previsiones"
```

---

## Task 5: Enrutado (`AuthenticatedApp.tsx` + `Sidebar.tsx`)

**Files:**
- Modify: `src/AuthenticatedApp.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Añadir los imports nuevos**

En `src/AuthenticatedApp.tsx`, junto a `import { ClasesLayout } from '@/components/layout/ClasesLayout'` (línea 8):

```ts
import { FinanzasLayout } from '@/components/layout/FinanzasLayout'
```

Junto a `const FinancialAnalyticsPage = lazy(...)` (línea 40):

```ts
const ResumenPage = lazy(() => import('@/pages/ResumenPage'))
```

- [ ] **Step 2: Sustituir `PaymentsRouter` por `PaymentsLegacyRedirect`**

Reemplazar la función `PaymentsRouter` (líneas 78-85) por:

```tsx
// Simetrico a GroupsLegacyRedirect/AttendanceLegacyRedirect: jugador/tutor
// siguen viendo PlayerPaymentsPage tal cual en /pagos (su portal no tiene
// seccion de Finanzas); el resto del personal se redirige a la nueva
// ubicacion bajo FinanzasLayout.
function PaymentsLegacyRedirect() {
  const { user } = useAuthStore()
  const activeRole = user?.activeRole ?? user?.role
  if (isPortalRole(activeRole)) {
    return <PlayerPaymentsPage />
  }
  return <Navigate to="/finanzas/pagos" replace />
}
```

(`isPortalRole` sigue definida justo debajo, sin cambios — al ser ambas
`function` declarations, el orden entre ellas no importa por hoisting;
no hace falta reordenar nada más en el archivo).

- [ ] **Step 3: Sustituir las rutas de Finanzas**

Reemplazar estas 4 líneas:

```tsx
        <Route path="/pagos" element={<RoleRoute module="payments"><PaymentsRouter /></RoleRoute>} />
        <Route path="/facturas" element={<RoleRoute module="payments"><InvoicesPage /></RoleRoute>} />
```

y

```tsx
        <Route path="/finanzas" element={<RoleRoute module="informes_mensuales"><FinancialsPage /></RoleRoute>} />
        <Route path="/finanzas-analitica" element={<RoleRoute module="informes_mensuales"><FinancialAnalyticsPage /></RoleRoute>} />
```

por:

```tsx
        <Route path="/finanzas" element={<FinanzasLayout />}>
          <Route index element={<Navigate to="/finanzas/resumen" replace />} />
          <Route path="resumen" element={<RoleRoute module="payments"><ResumenPage /></RoleRoute>} />
          <Route path="pagos" element={<RoleRoute module="payments"><PaymentsPage /></RoleRoute>} />
          <Route path="facturas" element={<RoleRoute module="payments"><InvoicesPage /></RoleRoute>} />
          <Route path="ingresos-gastos" element={<RoleRoute module="informes_mensuales"><FinancialsPage /></RoleRoute>} />
          <Route path="analisis" element={<RoleRoute module="informes_mensuales"><FinancialAnalyticsPage /></RoleRoute>} />
        </Route>
        {/* /pagos, /facturas y /finanzas-analitica ya no son la ubicacion
            principal (ahora bajo /finanzas), pero se mantienen: /pagos
            sigue sirviendo el portal de jugador/tutor (PlayerPaymentsPage,
            ver PaymentsLegacyRedirect) y los otros dos evitan romper
            marcadores/enlaces existentes (NotificationBell, DashboardPage). */}
        <Route path="/pagos" element={<RoleRoute module="payments"><PaymentsLegacyRedirect /></RoleRoute>} />
        <Route path="/facturas" element={<Navigate to="/finanzas/facturas" replace />} />
        <Route path="/finanzas-analitica" element={<Navigate to="/finanzas/analisis" replace />} />
```

- [ ] **Step 4: Actualizar el sidebar**

En `src/components/layout/Sidebar.tsx`, cambiar la línea 47:

```ts
  { name: 'Finanzas', href: '/pagos', icon: CreditCard, requiredModule: 'payments' },
```

por:

```ts
  { name: 'Finanzas', href: '/finanzas', icon: CreditCard, requiredModule: 'payments' },
```

(la línea 190, del portal de jugador/tutor, no se toca — sigue
apuntando a `/pagos`, que sigue funcionando para ese portal).

- [ ] **Step 5: Verificar el build**

Run: `npm run build`
Expected: sin errores. Confirmar que no queda ninguna referencia a
`PaymentsRouter` (ya renombrada) en el archivo.

- [ ] **Step 6: Verificación manual en el navegador**

Arrancar `npm run dev` y comprobar, con un usuario director/coordinador:
1. El sidebar "Finanzas" lleva a `/finanzas/resumen`, con el nuevo
   topbar y las 5 pestañas.
2. Cada pestaña (Pagos, Facturas, Ingresos y gastos, Análisis) carga su
   página existente sin errores.
3. Entrar a `/pagos` directamente redirige a `/finanzas/pagos`.
4. Entrar a `/facturas` directamente redirige a `/finanzas/facturas`.
5. Entrar a `/finanzas-analitica` redirige a `/finanzas/analisis`.

Y con un usuario jugador o tutor (cambiar de rol si la app lo permite, o
revisar el código de `isPortalRole` para confirmar la lógica): `/pagos`
sigue mostrando `PlayerPaymentsPage`, no redirige.

- [ ] **Step 7: Commit**

```bash
git add src/AuthenticatedApp.tsx src/components/layout/Sidebar.tsx
git commit -m "feat: enrutar Finanzas bajo FinanzasLayout con Resumen como pantalla principal"
```

---

## Task 6: Refactorizar `AnnualFinancialSummary.tsx` para reutilizar `monthlyTotals`

**Files:**
- Modify: `src/components/financials/AnnualFinancialSummary.tsx`

- [ ] **Step 1: Sustituir el cálculo mensual inline por `monthlyTotals`**

En `src/components/financials/AnnualFinancialSummary.tsx`, dentro del
`useMemo` de `chartData` (líneas 30-87), sustituir el cuerpo del bucle
`while (curr <= end) { ... }` (líneas 42-84, todo el cálculo de
`ingresosCuotas`/`ingresosEventos`/`gastosEventos`/`ingresosClases`/
`extrasIngresos`/`extrasGastos`/`totalIngresos`/`totalGastos`/
`beneficio`) por:

```ts
    let curr = new Date(start)
    while (curr <= end) {
      const monthIdx = curr.getMonth() + 1
      const yearIdx = curr.getFullYear()
      const monthKey = `${yearIdx}-${monthIdx}`
      const totals = monthlyTotals(monthKey, normalizedPayments, events, eventPayments, privateLessons, privateLessonPayments, transactions)

      data.push({
        name: `${monthNames[monthIdx - 1]} ${yearIdx}`,
        Ingresos: totals.ingresos,
        Gastos: totals.gastos,
        Beneficio: totals.beneficio
      })

      curr.setMonth(curr.getMonth() + 1)
    }
    return data
  }, [startMonth, startYear, endMonth, endYear, normalizedPayments, events, eventPayments, privateLessons, privateLessonPayments, transactions])
```

`monthlyTotals` espera `NormalizedPayment[]`, no `Payment[]` — añadir,
antes del `useMemo` de `chartData`, la normalización (mismo patrón que
`ResumenPage.tsx`):

```ts
  const normalizedPayments = useMemo(
    () => normalizeAllPayments(payments, eventPayments, privateLessonPayments, events),
    [payments, eventPayments, privateLessonPayments, events]
  )
```

Y añadir los imports que falten al principio del archivo:

```ts
import { monthlyTotals } from '@/lib/finance-analytics'
import { normalizeAllPayments } from '@/lib/payment-utils'
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 3: Verificación manual en el navegador**

Ir a la página que renderiza `AnnualFinancialSummary` (buscar sus usos
con grep si no se recuerda cuál es — `FinancialsPage.tsx` o
`FinancialAnalyticsPage.tsx`) y comprobar que la gráfica anual muestra
exactamente los mismos números que antes del refactor (comparar con una
captura o con los valores ya conocidos de un mes concreto).

- [ ] **Step 4: Commit**

```bash
git add src/components/financials/AnnualFinancialSummary.tsx
git commit -m "refactor: AnnualFinancialSummary reutiliza monthlyTotals en vez de duplicar el calculo"
```
