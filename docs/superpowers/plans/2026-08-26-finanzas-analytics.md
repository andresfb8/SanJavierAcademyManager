# Pestaña "Finanzas" en Inteligencia del Club — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir una pestaña "Finanzas" a `AnalyticsPage.tsx` que muestre ingresos por origen, adultos vs. menores, ingresos por grupo/nivel, margen de contribución por categoría, estructura de costes (fijo/variable), punto de equilibrio y morosidad/cobro — todo calculado al vuelo sobre los datos ya cargados en `dataStore`, sin persistencia nueva.

**Architecture:** Lógica pura y testeable en `src/lib/finance-analytics.ts` (nueva) más dos extensiones pequeñas a `src/lib/period.ts` y `src/lib/salary-utils.ts`, consumida por un componente nuevo `src/components/shared/analytics/FinanceTab.tsx` que se añade como sexta pestaña de `AnalyticsPage.tsx`. Sigue el patrón ya establecido por `KPIsTab.tsx` (Cards + `useMemo` + Recharts) y reutiliza `normalizeAllPayments` de `lib/payment-utils.ts`.

**Tech Stack:** React 19 + TypeScript, Zustand (`useDataStore`), Recharts, Vitest, shadcn/ui (Card, Table, Select, Tabs).

**Diseño de referencia:** `docs/superpowers/specs/2026-08-26-finanzas-analytics-design.md`

---

## Task 1: Helpers de periodo (`lib/period.ts`)

**Files:**
- Modify: `src/lib/period.ts`
- Test: `src/lib/period.test.ts`

Añade tres funciones que faltan para poder comparar "este periodo" contra "el periodo anterior de igual duración" y para generar series de los últimos N meses.

- [ ] **Step 1: Escribir los tests que fallan**

Añadir al final de `src/lib/period.test.ts`:

```ts
import { getCurrentPeriodMonthKeys, getPreviousPeriodMonthKeys, getLastNMonthKeys } from '@/lib/period'

describe('getCurrentPeriodMonthKeys', () => {
  it('devuelve solo el mes actual para "month"', () => {
    expect(getCurrentPeriodMonthKeys('month', new Date('2026-08-15T12:00:00'))).toEqual(['2026-8'])
  })

  it('devuelve los meses transcurridos del trimestre para "quarter"', () => {
    expect(getCurrentPeriodMonthKeys('quarter', new Date('2026-08-15T12:00:00'))).toEqual(['2026-7', '2026-8'])
  })

  it('devuelve los meses transcurridos del ano para "year"', () => {
    expect(getCurrentPeriodMonthKeys('year', new Date('2026-08-15T12:00:00'))).toEqual([
      '2026-1', '2026-2', '2026-3', '2026-4', '2026-5', '2026-6', '2026-7', '2026-8',
    ])
  })
})

describe('getPreviousPeriodMonthKeys', () => {
  it('devuelve el mes inmediatamente anterior para "month"', () => {
    expect(getPreviousPeriodMonthKeys('month', new Date('2026-08-15T12:00:00'))).toEqual(['2026-7'])
  })

  it('devuelve los meses equivalentes del trimestre anterior para "quarter"', () => {
    // Q3 en curso (jul, ago transcurridos) -> meses equivalentes de Q2 (abr, may)
    expect(getPreviousPeriodMonthKeys('quarter', new Date('2026-08-15T12:00:00'))).toEqual(['2026-4', '2026-5'])
  })

  it('devuelve los mismos meses del ano anterior para "year"', () => {
    expect(getPreviousPeriodMonthKeys('year', new Date('2026-08-15T12:00:00'))).toEqual([
      '2025-1', '2025-2', '2025-3', '2025-4', '2025-5', '2025-6', '2025-7', '2025-8',
    ])
  })
})

describe('getLastNMonthKeys', () => {
  it('devuelve los ultimos 6 meses en orden ascendente, incluyendo el actual', () => {
    expect(getLastNMonthKeys(6, new Date('2026-08-15T12:00:00'))).toEqual([
      '2026-3', '2026-4', '2026-5', '2026-6', '2026-7', '2026-8',
    ])
  })

  it('cruza el cambio de ano correctamente', () => {
    expect(getLastNMonthKeys(6, new Date('2026-02-10T12:00:00'))).toEqual([
      '2025-9', '2025-10', '2025-11', '2025-12', '2026-1', '2026-2',
    ])
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que fallan**

Run: `npm test -- period.test.ts`
Expected: FAIL — `getCurrentPeriodMonthKeys`, `getPreviousPeriodMonthKeys` y `getLastNMonthKeys` no existen.

- [ ] **Step 3: Implementar**

Añadir al final de `src/lib/period.ts`:

```ts
function periodLengthMonths(period: AnalyticsPeriod): number {
  if (period === 'month') return 1
  if (period === 'quarter') return 3
  return 12
}

function monthKeysFrom(start: Date, count: number): string[] {
  const keys: string[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  for (let i = 0; i < count; i++) {
    keys.push(`${cursor.getFullYear()}-${cursor.getMonth() + 1}`)
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return keys
}

/**
 * Claves 'YYYY-M' de los meses ya transcurridos del periodo actual (hasta
 * `now` inclusive). Un trimestre o ano en curso solo incluye los meses ya
 * empezados, nunca meses futuros.
 */
export function getCurrentPeriodMonthKeys(period: AnalyticsPeriod, now: Date = new Date()): string[] {
  const start = getPeriodStart(period, now)
  const monthsElapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1
  return monthKeysFrom(start, monthsElapsed)
}

/**
 * Claves 'YYYY-M' del periodo anterior de igual duracion, desplazando cada
 * mes del periodo actual hacia atras la longitud del periodo (1/3/12 meses).
 * Asi un trimestre o ano parcial se compara con los mismos meses relativos
 * del periodo anterior, en vez de con una ventana de longitud fija distinta.
 */
export function getPreviousPeriodMonthKeys(period: AnalyticsPeriod, now: Date = new Date()): string[] {
  const current = getCurrentPeriodMonthKeys(period, now)
  const shift = periodLengthMonths(period)
  return current.map(key => {
    const [yearStr, monthStr] = key.split('-')
    const d = new Date(Number(yearStr), Number(monthStr) - 1 - shift, 1)
    return `${d.getFullYear()}-${d.getMonth() + 1}`
  })
}

/** Claves 'YYYY-M' de los ultimos `n` meses, en orden ascendente, incluyendo el mes de `now`. */
export function getLastNMonthKeys(n: number, now: Date = new Date()): string[] {
  const start = new Date(now.getFullYear(), now.getMonth() - (n - 1), 1)
  return monthKeysFrom(start, n)
}
```

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npm test -- period.test.ts`
Expected: PASS (todos los tests, incluidos los de `getPeriodStart` ya existentes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/period.ts src/lib/period.test.ts
git commit -m "feat: añadir helpers de periodo actual/anterior para comparativas financieras"
```

---

## Task 2: `calculatePrivateLessonSalary` (`lib/salary-utils.ts`)

**Files:**
- Modify: `src/lib/salary-utils.ts`
- Test: `src/lib/salary-utils.test.ts` (nuevo)

Esta fórmula ya está duplicada tal cual en `CoachesPage.tsx:183-187`, `CoachDashboard.tsx:169-171`, `CoachProfilePage.tsx:131-134`, `PayrollCloseDialog.tsx:71-72` y `ReportsPage.tsx:255-256`. Se extrae como función pura para reutilizarla en el cálculo de margen de la Task 6, sin tocar los 5 sitios existentes (fuera de alcance del spec).

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/salary-utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { calculatePrivateLessonSalary } from '@/lib/salary-utils'
import type { PrivateLesson, CoachSalaryConfig } from '@/types'

function makeLesson(overrides: Partial<PrivateLesson> = {}): PrivateLesson {
  return {
    id: 'l1',
    playerIds: ['p1'],
    playerNames: ['Jugador'],
    coachId: 'c1',
    coachName: 'Coach',
    courtId: 'ct1',
    courtName: 'Pista 1',
    date: new Date('2026-08-01'),
    startTime: '10:00',
    endTime: '11:00',
    price: 40,
    isPaid: true,
    createdAt: new Date('2026-08-01'),
    ...overrides,
  }
}

function makeSalaryConfig(overrides: Partial<CoachSalaryConfig> = {}): CoachSalaryConfig {
  return {
    coachId: 'c1',
    ratePerGroupAdults: 0,
    ratePerGroupMinors: 0,
    privateLessonPaymentType: 'fixed',
    privateLessonRate: 0,
    eventPaymentType: 'fixed',
    eventRate: 0,
    bonuses: 0,
    ...overrides,
  }
}

describe('calculatePrivateLessonSalary', () => {
  it('devuelve la tarifa fija cuando el tipo es fixed', () => {
    const lesson = makeLesson({ price: 40 })
    const config = makeSalaryConfig({ privateLessonPaymentType: 'fixed', privateLessonRate: 20 })
    expect(calculatePrivateLessonSalary(lesson, config)).toBe(20)
  })

  it('calcula el porcentaje sobre el precio de la clase cuando el tipo es percentage', () => {
    const lesson = makeLesson({ price: 40 })
    const config = makeSalaryConfig({ privateLessonPaymentType: 'percentage', privateLessonRate: 50 })
    expect(calculatePrivateLessonSalary(lesson, config)).toBe(20)
  })

  it('trata una tarifa fija indefinida como 0', () => {
    const lesson = makeLesson({ price: 40 })
    const config = makeSalaryConfig({ privateLessonPaymentType: 'fixed', privateLessonRate: undefined as unknown as number })
    expect(calculatePrivateLessonSalary(lesson, config)).toBe(0)
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- salary-utils.test.ts`
Expected: FAIL — `calculatePrivateLessonSalary` no existe.

- [ ] **Step 3: Implementar**

Añadir al final de `src/lib/salary-utils.ts` (y añadir `PrivateLesson` al import de tipos de la línea 1):

```ts
import { AcademyEvent, EventPayment, CoachSalaryConfig, PrivateLesson } from '@/types'
```

```ts
/**
 * Calcula la comision del entrenador por una clase particular, segun el
 * mismo criterio ya usado (duplicado) en CoachesPage, CoachDashboard,
 * CoachProfilePage, PayrollCloseDialog y ReportsPage: tarifa fija por clase,
 * o porcentaje sobre el precio de la clase.
 */
export function calculatePrivateLessonSalary(
  lesson: PrivateLesson,
  salaryConfig: CoachSalaryConfig
): number {
  if (salaryConfig.privateLessonPaymentType === 'fixed') {
    return salaryConfig.privateLessonRate || 0
  }
  return lesson.price * ((salaryConfig.privateLessonRate || 0) / 100)
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npm test -- salary-utils.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/salary-utils.ts src/lib/salary-utils.test.ts
git commit -m "feat: extraer calculatePrivateLessonSalary como funcion pura"
```

---

## Task 3: `finance-analytics.ts` — `pctChange` y `revenueByOrigin`

**Files:**
- Create: `src/lib/finance-analytics.ts`
- Test: `src/lib/finance-analytics.test.ts` (nuevo)

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/lib/finance-analytics.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { pctChange, revenueByOrigin } from '@/lib/finance-analytics'
import type { NormalizedPayment } from '@/lib/payment-utils'

function makePayment(overrides: Partial<NormalizedPayment> = {}): NormalizedPayment {
  return {
    id: 'pay1',
    source: 'cuota',
    playerId: 'p1',
    playerName: 'Jugador',
    concept: 'Cuota',
    amount: 100,
    status: 'pagado',
    billingMonth: 8,
    billingYear: 2026,
    ...overrides,
  }
}

describe('pctChange', () => {
  it('calcula el porcentaje de variacion normal', () => {
    expect(pctChange(150, 100)).toBe(50)
    expect(pctChange(50, 100)).toBe(-50)
  })

  it('devuelve 0 cuando ambos valores son 0', () => {
    expect(pctChange(0, 0)).toBe(0)
  })

  it('devuelve null cuando el periodo anterior es 0 pero el actual no', () => {
    expect(pctChange(100, 0)).toBeNull()
  })
})

describe('revenueByOrigin', () => {
  it('suma cuotas, manual, eventos y clases en sus buckets, ignorando lo no pagado', () => {
    const payments: NormalizedPayment[] = [
      makePayment({ source: 'cuota', amount: 100 }),
      makePayment({ source: 'manual', amount: 20 }),
      makePayment({ source: 'evento', amount: 30 }),
      makePayment({ source: 'clase_particular', amount: 40 }),
      makePayment({ source: 'cuota', amount: 999, status: 'pendiente' }),
    ]
    const result = revenueByOrigin(payments, new Set(['2026-8']))
    expect(result).toEqual({ cuotas: 120, eventos: 30, clases: 40, total: 190 })
  })

  it('ignora pagos fuera de las claves de mes dadas', () => {
    const payments: NormalizedPayment[] = [
      makePayment({ billingMonth: 7, billingYear: 2026, amount: 500 }),
    ]
    const result = revenueByOrigin(payments, new Set(['2026-8']))
    expect(result).toEqual({ cuotas: 0, eventos: 0, clases: 0, total: 0 })
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que fallan**

Run: `npm test -- finance-analytics.test.ts`
Expected: FAIL — el módulo `@/lib/finance-analytics` no existe.

- [ ] **Step 3: Implementar**

Crear `src/lib/finance-analytics.ts`:

```ts
import type { NormalizedPayment } from '@/lib/payment-utils'

/** Variacion porcentual de `current` respecto a `previous`. `null` si no es comparable (previo 0, actual > 0). */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / previous) * 100
}

function monthKeyOf(p: Pick<NormalizedPayment, 'billingYear' | 'billingMonth'>): string {
  return `${p.billingYear}-${p.billingMonth}`
}

function isPaidInPeriod(p: NormalizedPayment, monthKeys: Set<string>): boolean {
  return p.status === 'pagado' && monthKeys.has(monthKeyOf(p))
}

export interface RevenueByOrigin {
  cuotas: number
  eventos: number
  clases: number
  total: number
}

export function revenueByOrigin(payments: NormalizedPayment[], monthKeys: Set<string>): RevenueByOrigin {
  const result: RevenueByOrigin = { cuotas: 0, eventos: 0, clases: 0, total: 0 }
  for (const p of payments) {
    if (!isPaidInPeriod(p, monthKeys)) continue
    if (p.source === 'cuota' || p.source === 'manual') result.cuotas += p.amount
    else if (p.source === 'evento') result.eventos += p.amount
    else if (p.source === 'clase_particular') result.clases += p.amount
  }
  result.total = result.cuotas + result.eventos + result.clases
  return result
}
```

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npm test -- finance-analytics.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance-analytics.ts src/lib/finance-analytics.test.ts
git commit -m "feat: añadir pctChange y revenueByOrigin en finance-analytics"
```

---

## Task 4: `revenueByAgeGroup`

**Files:**
- Modify: `src/lib/finance-analytics.ts`
- Test: `src/lib/finance-analytics.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `src/lib/finance-analytics.test.ts`:

```ts
import { revenueByAgeGroup } from '@/lib/finance-analytics'
import type { Group, Player } from '@/types'

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
    currentEnrollment: 4,
    defaultTariffId: 't1',
    defaultTariffPrice: 50,
    billingFrequency: 'monthly',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    isActive: true,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  }
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    firstName: 'Jugador',
    lastName: 'Uno',
    dni: '00000000A',
    birthDate: new Date('1990-01-01'),
    email: 'j@example.com',
    phone: '600000000',
    address: '',
    city: '',
    postalCode: '',
    level: 'intermedio',
    dominantHand: 'derecha',
    position: 'ambos',
    bankAccountHolder: '',
    iban: '',
    status: 'activo',
    registrationDate: new Date('2026-01-01'),
    isMinor: false,
    recoveryCredits: 0,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}

describe('revenueByAgeGroup', () => {
  it('clasifica cuotas de grupo por Group.level === "menores"', () => {
    const groups = [makeGroup({ id: 'g-adultos', level: 'avanzado' }), makeGroup({ id: 'g-menores', level: 'menores' })]
    const payments: NormalizedPayment[] = [
      makePayment({ source: 'cuota', groupId: 'g-adultos', amount: 100 }),
      makePayment({ source: 'cuota', groupId: 'g-menores', amount: 60 }),
    ]
    const result = revenueByAgeGroup(payments, groups, [], new Set(['2026-8']))
    expect(result).toEqual({ adultos: 100, menores: 60 })
  })

  it('clasifica eventos y clases particulares por Player.isMinor', () => {
    const players = [makePlayer({ id: 'p-adulto', isMinor: false }), makePlayer({ id: 'p-menor', isMinor: true })]
    const payments: NormalizedPayment[] = [
      makePayment({ source: 'evento', playerId: 'p-adulto', amount: 30 }),
      makePayment({ source: 'clase_particular', playerId: 'p-menor', amount: 40 }),
    ]
    const result = revenueByAgeGroup(payments, [], players, new Set(['2026-8']))
    expect(result).toEqual({ adultos: 30, menores: 40 })
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- finance-analytics.test.ts`
Expected: FAIL — `revenueByAgeGroup` no existe.

- [ ] **Step 3: Implementar**

Añadir a `src/lib/finance-analytics.ts` (ampliar el import del principio del archivo):

```ts
import type { Group, Player } from '@/types'
```

```ts
export interface RevenueByAgeGroup {
  adultos: number
  menores: number
}

export function revenueByAgeGroup(
  payments: NormalizedPayment[],
  groups: Group[],
  players: Player[],
  monthKeys: Set<string>
): RevenueByAgeGroup {
  const result: RevenueByAgeGroup = { adultos: 0, menores: 0 }
  for (const p of payments) {
    if (!isPaidInPeriod(p, monthKeys)) continue

    const group = p.groupId ? groups.find(g => g.id === p.groupId) : undefined
    if (group) {
      if (group.level === 'menores') result.menores += p.amount
      else result.adultos += p.amount
      continue
    }

    const player = players.find(pl => pl.id === p.playerId)
    if (player?.isMinor) result.menores += p.amount
    else result.adultos += p.amount
  }
  return result
}
```

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npm test -- finance-analytics.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance-analytics.ts src/lib/finance-analytics.test.ts
git commit -m "feat: añadir revenueByAgeGroup en finance-analytics"
```

---

## Task 5: `revenueByLevel`

**Files:**
- Modify: `src/lib/finance-analytics.ts`
- Test: `src/lib/finance-analytics.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `src/lib/finance-analytics.test.ts`:

```ts
import { revenueByLevel } from '@/lib/finance-analytics'

describe('revenueByLevel', () => {
  it('agrupa ingresos de cuotas por nivel de grupo, con los 5 niveles siempre presentes', () => {
    const groups = [
      makeGroup({ id: 'g1', level: 'iniciacion' }),
      makeGroup({ id: 'g2', level: 'competicion' }),
    ]
    const payments: NormalizedPayment[] = [
      makePayment({ source: 'cuota', groupId: 'g1', amount: 100 }),
      makePayment({ source: 'manual', groupId: 'g2', amount: 50 }),
      makePayment({ source: 'evento', groupId: undefined, amount: 999 }),
    ]
    const result = revenueByLevel(payments, groups, new Set(['2026-8']))
    expect(result).toEqual({
      iniciacion: 100,
      intermedio: 0,
      avanzado: 0,
      competicion: 50,
      menores: 0,
    })
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- finance-analytics.test.ts`
Expected: FAIL — `revenueByLevel` no existe.

- [ ] **Step 3: Implementar**

Añadir a `src/lib/finance-analytics.ts` (ampliar el import de tipos con `PlayerLevel`):

```ts
import type { Group, Player, PlayerLevel } from '@/types'
```

```ts
const ALL_LEVELS: PlayerLevel[] = ['iniciacion', 'intermedio', 'avanzado', 'competicion', 'menores']

export function revenueByLevel(
  payments: NormalizedPayment[],
  groups: Group[],
  monthKeys: Set<string>
): Record<PlayerLevel, number> {
  const result = ALL_LEVELS.reduce((acc, level) => {
    acc[level] = 0
    return acc
  }, {} as Record<PlayerLevel, number>)

  for (const p of payments) {
    if (!isPaidInPeriod(p, monthKeys)) continue
    if (p.source !== 'cuota' && p.source !== 'manual') continue
    if (!p.groupId) continue
    const group = groups.find(g => g.id === p.groupId)
    if (!group) continue
    result[group.level] += p.amount
  }
  return result
}
```

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npm test -- finance-analytics.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance-analytics.ts src/lib/finance-analytics.test.ts
git commit -m "feat: añadir revenueByLevel en finance-analytics"
```

---

## Task 6: `contributionMarginByCategory`

**Files:**
- Modify: `src/lib/finance-analytics.ts`
- Test: `src/lib/finance-analytics.test.ts`

Resta a cada ingreso el coste directamente atribuible: para cuotas, la tarifa mensual del coach de ese grupo (`ratePerGroupAdults/Minors`, sumada una vez por cada mes-grupo con ingreso dentro del periodo, para no infravalorar el coste en periodos de varios meses); para eventos, `event.expenses` más la comisión del coach vía `calculateEventSalary`; para clases particulares, la comisión del coach vía `calculatePrivateLessonSalary` (Task 2).

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `src/lib/finance-analytics.test.ts`:

```ts
import { contributionMarginByCategory } from '@/lib/finance-analytics'
import type { AcademyEvent, EventPayment, PrivateLesson, PrivateLessonPayment, CoachSalaryConfig } from '@/types'

function makeSalaryConfig(overrides: Partial<CoachSalaryConfig> = {}): CoachSalaryConfig {
  return {
    coachId: 'c1',
    ratePerGroupAdults: 100,
    ratePerGroupMinors: 60,
    privateLessonPaymentType: 'fixed',
    privateLessonRate: 15,
    eventPaymentType: 'fixed',
    eventRate: 20,
    bonuses: 0,
    ...overrides,
  }
}

function makeEvent(overrides: Partial<AcademyEvent> = {}): AcademyEvent {
  return {
    id: 'ev1',
    name: 'Torneo',
    type: 'torneo',
    date: new Date('2026-08-10'),
    startTime: '10:00',
    endTime: '13:00',
    courtIds: ['ct1'],
    courtNames: ['Pista 1'],
    coachIds: ['c1'],
    coachNames: ['Coach'],
    attendeePlayerIds: [],
    attendeePlayerNames: [],
    price: 20,
    vatRate: 21,
    isActive: true,
    ...overrides,
  } as AcademyEvent
}

function makeEventPayment(overrides: Partial<EventPayment> = {}): EventPayment {
  return {
    id: 'ep1',
    eventId: 'ev1',
    eventName: 'Torneo',
    playerId: 'p1',
    playerName: 'Jugador',
    amount: 20,
    status: 'pagado',
    createdAt: new Date('2026-08-10'),
    ...overrides,
  }
}

function makeLesson(overrides: Partial<PrivateLesson> = {}): PrivateLesson {
  return {
    id: 'l1',
    playerIds: ['p1'],
    playerNames: ['Jugador'],
    coachId: 'c1',
    coachName: 'Coach',
    courtId: 'ct1',
    courtName: 'Pista 1',
    date: new Date('2026-08-05'),
    startTime: '10:00',
    endTime: '11:00',
    price: 40,
    isPaid: true,
    createdAt: new Date('2026-08-05'),
    ...overrides,
  }
}

function makeLessonPayment(overrides: Partial<PrivateLessonPayment> = {}): PrivateLessonPayment {
  return {
    id: 'lp1',
    lessonId: 'l1',
    lessonDate: new Date('2026-08-05'),
    playerId: 'p1',
    playerName: 'Jugador',
    amount: 40,
    status: 'pagado',
    createdAt: new Date('2026-08-05'),
    ...overrides,
  }
}

describe('contributionMarginByCategory', () => {
  it('calcula margen de cuotas restando la tarifa del coach por grupo y mes con ingreso', () => {
    const groups = [makeGroup({ id: 'g1', level: 'avanzado', coachId: 'c1' })]
    const configs = [makeSalaryConfig({ coachId: 'c1', ratePerGroupAdults: 100 })]
    const payments: NormalizedPayment[] = [
      makePayment({ source: 'cuota', groupId: 'g1', amount: 300, billingMonth: 8, billingYear: 2026 }),
    ]
    const result = contributionMarginByCategory(payments, groups, configs, [], [], [], [], new Set(['2026-8']))
    expect(result.cuotas).toEqual({ revenue: 300, cost: 100, margin: 200, marginPct: 200 / 3 })
  })

  it('cobra la tarifa del coach una vez por cada mes distinto con ingreso del mismo grupo', () => {
    const groups = [makeGroup({ id: 'g1', level: 'avanzado', coachId: 'c1' })]
    const configs = [makeSalaryConfig({ coachId: 'c1', ratePerGroupAdults: 100 })]
    const payments: NormalizedPayment[] = [
      makePayment({ source: 'cuota', groupId: 'g1', amount: 300, billingMonth: 7, billingYear: 2026 }),
      makePayment({ source: 'cuota', groupId: 'g1', amount: 300, billingMonth: 8, billingYear: 2026 }),
    ]
    const result = contributionMarginByCategory(payments, groups, configs, [], [], [], [], new Set(['2026-7', '2026-8']))
    expect(result.cuotas).toEqual({ revenue: 600, cost: 200, margin: 400, marginPct: 400 / 6 * 10 })
  })

  it('calcula margen de eventos restando gastos y comision del coach', () => {
    const configs = [makeSalaryConfig({ coachId: 'c1', eventPaymentType: 'fixed', eventRate: 20 })]
    const event = makeEvent({ id: 'ev1', coachIds: ['c1'], expenses: [{ concept: 'Trofeos', amount: 30 }] as any })
    const eventPayments = [makeEventPayment({ eventId: 'ev1', amount: 100, status: 'pagado' })]
    const result = contributionMarginByCategory([], [], configs, [event], eventPayments, [], [], new Set(['2026-8']))
    // ingreso 100, gastos 30, comision fija 20 -> coste total 50, margen 50
    expect(result.eventos).toEqual({ revenue: 100, cost: 50, margin: 50, marginPct: 50 })
  })

  it('calcula margen de clases particulares restando la comision del coach', () => {
    const configs = [makeSalaryConfig({ coachId: 'c1', privateLessonPaymentType: 'fixed', privateLessonRate: 15 })]
    const lesson = makeLesson({ id: 'l1', coachId: 'c1', price: 40 })
    const lessonPayments = [makeLessonPayment({ lessonId: 'l1', amount: 40 })]
    const result = contributionMarginByCategory([], [], configs, [], [], [lesson], lessonPayments, new Set(['2026-8']))
    expect(result.clases).toEqual({ revenue: 40, cost: 15, margin: 25, marginPct: 62.5 })
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- finance-analytics.test.ts`
Expected: FAIL — `contributionMarginByCategory` no existe.

- [ ] **Step 3: Implementar**

Añadir a `src/lib/finance-analytics.ts` (ampliar imports):

```ts
import type {
  AcademyEvent,
  CoachSalaryConfig,
  EventPayment,
  Group,
  Player,
  PlayerLevel,
  PrivateLesson,
  PrivateLessonPayment,
} from '@/types'
import { calculateEventSalary, calculatePrivateLessonSalary } from '@/lib/salary-utils'
```

```ts
export interface CategoryMargin {
  revenue: number
  cost: number
  margin: number
  marginPct: number
}

export interface MarginByCategory {
  cuotas: CategoryMargin
  eventos: CategoryMargin
  clases: CategoryMargin
}

function toMargin(revenue: number, cost: number): CategoryMargin {
  const margin = revenue - cost
  const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0
  return { revenue, cost, margin, marginPct }
}

function eventMonthKey(ev: AcademyEvent): string {
  const d = ev.date instanceof Date ? ev.date : new Date(ev.date)
  return `${d.getFullYear()}-${d.getMonth() + 1}`
}

function lessonMonthKey(pl: PrivateLesson): string {
  const d = pl.date instanceof Date ? pl.date : new Date(pl.date)
  return `${d.getFullYear()}-${d.getMonth() + 1}`
}

export function contributionMarginByCategory(
  payments: NormalizedPayment[],
  groups: Group[],
  coachSalaryConfigs: CoachSalaryConfig[],
  events: AcademyEvent[],
  eventPayments: EventPayment[],
  privateLessons: PrivateLesson[],
  privateLessonPayments: PrivateLessonPayment[],
  monthKeys: Set<string>
): MarginByCategory {
  // Cuotas: coste del coach cobrado una vez por cada (grupo, mes) con ingreso.
  const cuotaByGroupMonth = new Map<string, number>()
  for (const p of payments) {
    if (!isPaidInPeriod(p, monthKeys)) continue
    if (p.source !== 'cuota' && p.source !== 'manual') continue
    if (!p.groupId) continue
    const key = `${p.groupId}|${monthKeyOf(p)}`
    cuotaByGroupMonth.set(key, (cuotaByGroupMonth.get(key) ?? 0) + p.amount)
  }
  let cuotaRevenue = 0
  let cuotaCost = 0
  for (const [key, revenue] of cuotaByGroupMonth) {
    cuotaRevenue += revenue
    const groupId = key.split('|')[0]
    const group = groups.find(g => g.id === groupId)
    if (!group) continue
    const config = coachSalaryConfigs.find(c => c.coachId === group.coachId)
    if (!config) continue
    cuotaCost += group.level === 'menores' ? (config.ratePerGroupMinors || 0) : (config.ratePerGroupAdults || 0)
  }

  // Eventos: ingreso pagado del evento, menos gastos y comision del coach.
  let eventRevenue = 0
  let eventCost = 0
  for (const ev of events) {
    if (!monthKeys.has(eventMonthKey(ev))) continue
    const revenue = eventPayments
      .filter(ep => ep.eventId === ev.id && ep.status === 'pagado')
      .reduce((s, ep) => s + ep.amount, 0)
    eventRevenue += revenue
    eventCost += (ev.expenses ?? []).reduce((s, ex) => s + ex.amount, 0)
    for (const coachId of ev.coachIds) {
      const config = coachSalaryConfigs.find(c => c.coachId === coachId)
      if (config) eventCost += calculateEventSalary(ev, eventPayments, config)
    }
  }

  // Clases particulares: ingreso pagado de la clase, menos comision del coach.
  let lessonRevenue = 0
  let lessonCost = 0
  for (const pl of privateLessons) {
    if (!monthKeys.has(lessonMonthKey(pl))) continue
    const revenue = privateLessonPayments
      .filter(lp => lp.lessonId === pl.id && lp.status === 'pagado')
      .reduce((s, lp) => s + lp.amount, 0)
    lessonRevenue += revenue
    const config = coachSalaryConfigs.find(c => c.coachId === pl.coachId)
    if (config) lessonCost += calculatePrivateLessonSalary(pl, config)
  }

  return {
    cuotas: toMargin(cuotaRevenue, cuotaCost),
    eventos: toMargin(eventRevenue, eventCost),
    clases: toMargin(lessonRevenue, lessonCost),
  }
}
```

Nota: elimina el import duplicado de `calculatePrivateLessonSalary`/`calculateEventSalary` si el editor los deja en dos líneas separadas — deben quedar en una sola línea `import { calculateEventSalary, calculatePrivateLessonSalary } from '@/lib/salary-utils'`.

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npm test -- finance-analytics.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance-analytics.ts src/lib/finance-analytics.test.ts
git commit -m "feat: añadir contributionMarginByCategory en finance-analytics"
```

---

## Task 7: `costStructure`

**Files:**
- Modify: `src/lib/finance-analytics.ts`
- Test: `src/lib/finance-analytics.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `src/lib/finance-analytics.test.ts`:

```ts
import { costStructure } from '@/lib/finance-analytics'
import type { ClubTransaction } from '@/types'

function makeTransaction(overrides: Partial<ClubTransaction> = {}): ClubTransaction {
  return {
    id: 't1',
    clubId: 'club-001',
    type: 'gasto',
    category: 'alquiler',
    concept: 'Alquiler pistas',
    amount: 500,
    date: new Date('2026-08-01'),
    createdAt: new Date('2026-08-01'),
    ...overrides,
  }
}

describe('costStructure', () => {
  it('clasifica alquiler, suministros, limpieza y publicidad como fijos', () => {
    const transactions: ClubTransaction[] = [
      makeTransaction({ category: 'alquiler', amount: 500 }),
      makeTransaction({ category: 'suministros', amount: 100 }),
      makeTransaction({ category: 'limpieza', amount: 80 }),
      makeTransaction({ category: 'publicidad', amount: 20 }),
    ]
    const result = costStructure(transactions, new Set(['2026-8']))
    expect(result.fixed).toBe(700)
    expect(result.variable).toBe(0)
    expect(result.fixedPct).toBe(100)
  })

  it('clasifica nomina, material, reparaciones y otro como variables', () => {
    const transactions: ClubTransaction[] = [
      makeTransaction({ category: 'nomina', amount: 300 }),
      makeTransaction({ category: 'material', amount: 50 }),
      makeTransaction({ category: 'reparaciones', amount: 40 }),
      makeTransaction({ category: 'otro', amount: 10 }),
    ]
    const result = costStructure(transactions, new Set(['2026-8']))
    expect(result.variable).toBe(400)
    expect(result.fixed).toBe(0)
    expect(result.variablePct).toBe(100)
  })

  it('ignora ingresos y transacciones fuera del periodo', () => {
    const transactions: ClubTransaction[] = [
      makeTransaction({ type: 'ingreso', category: 'otro', amount: 1000 }),
      makeTransaction({ category: 'alquiler', amount: 500, date: new Date('2026-07-01') }),
    ]
    const result = costStructure(transactions, new Set(['2026-8']))
    expect(result).toEqual({ fixed: 0, variable: 0, total: 0, fixedPct: 0, variablePct: 0 })
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- finance-analytics.test.ts`
Expected: FAIL — `costStructure` no existe.

- [ ] **Step 3: Implementar**

Añadir a `src/lib/finance-analytics.ts` (ampliar imports con `ClubTransaction`, `TransactionCategory`):

```ts
import type { ClubTransaction, TransactionCategory } from '@/types'
```

```ts
export interface CostStructure {
  fixed: number
  variable: number
  total: number
  fixedPct: number
  variablePct: number
}

const FIXED_COST_CATEGORIES = new Set<TransactionCategory>(['alquiler', 'suministros', 'limpieza', 'publicidad'])

export function costStructure(clubTransactions: ClubTransaction[], monthKeys: Set<string>): CostStructure {
  let fixed = 0
  let variable = 0
  for (const t of clubTransactions) {
    if (t.type !== 'gasto') continue
    const d = t.date instanceof Date ? t.date : new Date(t.date)
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`
    if (!monthKeys.has(key)) continue
    if (FIXED_COST_CATEGORIES.has(t.category)) fixed += t.amount
    else variable += t.amount
  }
  const total = fixed + variable
  return {
    fixed,
    variable,
    total,
    fixedPct: total > 0 ? (fixed / total) * 100 : 0,
    variablePct: total > 0 ? (variable / total) * 100 : 0,
  }
}
```

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npm test -- finance-analytics.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance-analytics.ts src/lib/finance-analytics.test.ts
git commit -m "feat: añadir costStructure en finance-analytics"
```

---

## Task 8: `breakEvenPoint`

**Files:**
- Modify: `src/lib/finance-analytics.ts`
- Test: `src/lib/finance-analytics.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `src/lib/finance-analytics.test.ts`:

```ts
import { breakEvenPoint } from '@/lib/finance-analytics'

describe('breakEvenPoint', () => {
  it('calcula alumnos necesarios redondeando hacia arriba', () => {
    const result = breakEvenPoint(1000, 45, 25)
    expect(result.studentsNeeded).toBe(23) // 1000/45 = 22.22 -> 23
    expect(result.actualStudents).toBe(25)
    expect(result.marginStudents).toBe(2)
  })

  it('devuelve 0 alumnos necesarios cuando no hay costes fijos', () => {
    const result = breakEvenPoint(0, 45, 10)
    expect(result.studentsNeeded).toBe(0)
    expect(result.marginStudents).toBe(10)
  })

  it('devuelve Infinity cuando el margen medio por alumno es 0 o negativo', () => {
    const result = breakEvenPoint(1000, 0, 10)
    expect(result.studentsNeeded).toBe(Infinity)
    expect(result.marginStudents).toBe(-Infinity)
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- finance-analytics.test.ts`
Expected: FAIL — `breakEvenPoint` no existe.

- [ ] **Step 3: Implementar**

Añadir a `src/lib/finance-analytics.ts`:

```ts
export interface BreakEvenPoint {
  studentsNeeded: number
  actualStudents: number
  marginStudents: number
}

export function breakEvenPoint(
  fixedCosts: number,
  avgMarginPerStudent: number,
  activeEnrollmentCount: number
): BreakEvenPoint {
  const studentsNeeded = avgMarginPerStudent > 0 ? Math.ceil(fixedCosts / avgMarginPerStudent) : Infinity
  return {
    studentsNeeded,
    actualStudents: activeEnrollmentCount,
    marginStudents: activeEnrollmentCount - studentsNeeded,
  }
}
```

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npm test -- finance-analytics.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance-analytics.ts src/lib/finance-analytics.test.ts
git commit -m "feat: añadir breakEvenPoint en finance-analytics"
```

---

## Task 9: `collectionStats`

**Files:**
- Modify: `src/lib/finance-analytics.ts`
- Test: `src/lib/finance-analytics.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `src/lib/finance-analytics.test.ts`:

```ts
import { collectionStats } from '@/lib/finance-analytics'

describe('collectionStats', () => {
  it('suma cobrado, pendiente y cancelado, y calcula la tasa de cobro', () => {
    const payments: NormalizedPayment[] = [
      makePayment({ status: 'pagado', amount: 300 }),
      makePayment({ status: 'pendiente', amount: 100, playerId: 'p1', playerName: 'Ana' }),
      makePayment({ status: 'cancelado', amount: 50 }),
    ]
    const result = collectionStats(payments, new Set(['2026-8']))
    expect(result.paidAmount).toBe(300)
    expect(result.pendingAmount).toBe(100)
    expect(result.cancelledAmount).toBe(50)
    expect(result.collectionRate).toBeCloseTo((300 / 450) * 100)
  })

  it('agrupa los pendientes por jugador y devuelve el top 5 por importe', () => {
    const payments: NormalizedPayment[] = [
      makePayment({ status: 'pendiente', amount: 100, playerId: 'p1', playerName: 'Ana' }),
      makePayment({ status: 'pendiente', amount: 50, playerId: 'p1', playerName: 'Ana' }),
      makePayment({ status: 'pendiente', amount: 200, playerId: 'p2', playerName: 'Bea' }),
    ]
    const result = collectionStats(payments, new Set(['2026-8']))
    expect(result.topDebtors).toEqual([
      { playerId: 'p2', playerName: 'Bea', pendingAmount: 200, pendingCount: 1 },
      { playerId: 'p1', playerName: 'Ana', pendingAmount: 150, pendingCount: 2 },
    ])
  })

  it('devuelve tasa de cobro 0 cuando no hay pagos generados en el periodo', () => {
    const result = collectionStats([], new Set(['2026-8']))
    expect(result.collectionRate).toBe(0)
    expect(result.topDebtors).toEqual([])
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- finance-analytics.test.ts`
Expected: FAIL — `collectionStats` no existe.

- [ ] **Step 3: Implementar**

Añadir a `src/lib/finance-analytics.ts`:

```ts
export interface DebtorSummary {
  playerId: string
  playerName: string
  pendingAmount: number
  pendingCount: number
}

export interface CollectionStats {
  paidAmount: number
  pendingAmount: number
  cancelledAmount: number
  collectionRate: number
  topDebtors: DebtorSummary[]
}

export function collectionStats(payments: NormalizedPayment[], monthKeys: Set<string>): CollectionStats {
  let paidAmount = 0
  let pendingAmount = 0
  let cancelledAmount = 0
  const debtors = new Map<string, DebtorSummary>()

  for (const p of payments) {
    if (!monthKeys.has(monthKeyOf(p))) continue
    if (p.status === 'pagado') {
      paidAmount += p.amount
    } else if (p.status === 'pendiente') {
      pendingAmount += p.amount
      const existing = debtors.get(p.playerId)
      if (existing) {
        existing.pendingAmount += p.amount
        existing.pendingCount += 1
      } else {
        debtors.set(p.playerId, {
          playerId: p.playerId,
          playerName: p.playerName,
          pendingAmount: p.amount,
          pendingCount: 1,
        })
      }
    } else if (p.status === 'cancelado') {
      cancelledAmount += p.amount
    }
  }

  const generated = paidAmount + pendingAmount + cancelledAmount
  const collectionRate = generated > 0 ? (paidAmount / generated) * 100 : 0
  const topDebtors = Array.from(debtors.values())
    .sort((a, b) => b.pendingAmount - a.pendingAmount)
    .slice(0, 5)

  return { paidAmount, pendingAmount, cancelledAmount, collectionRate, topDebtors }
}
```

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npm test -- finance-analytics.test.ts`
Expected: PASS (deberían ser ~19 tests en total en este archivo, todos en verde)

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance-analytics.ts src/lib/finance-analytics.test.ts
git commit -m "feat: añadir collectionStats en finance-analytics"
```

---

## Task 10: Componente `FinanceTab.tsx`

**Files:**
- Create: `src/components/shared/analytics/FinanceTab.tsx`

Antes de escribir el JSX de los gráficos (donut de estructura de costes, líneas de evolución), invoca la skill `dataviz` para aplicar su paleta y reglas de color/leyenda — no improvises colores de gráfico a mano.

- [ ] **Step 1: Invocar la skill `dataviz`**

Usar la herramienta `Skill` con `skill: "dataviz"` antes de escribir cualquier `<Bar>`, `<Line>`, `<Pie>` o color de gráfico en este archivo. Seguir su paleta y heurísticas para: el donut de fijo/variable, la línea de evolución de `fixedPct`, y la línea de evolución de `collectionRate`.

- [ ] **Step 2: Crear el componente**

Crear `src/components/shared/analytics/FinanceTab.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { useDataStore } from '@/stores/dataStore'
import { formatCurrency } from '@/lib/utils'
import { normalizeAllPayments } from '@/lib/payment-utils'
import { getCurrentPeriodMonthKeys, getPreviousPeriodMonthKeys, getLastNMonthKeys, type AnalyticsPeriod } from '@/lib/period'
import {
  pctChange,
  revenueByOrigin,
  revenueByAgeGroup,
  revenueByLevel,
  contributionMarginByCategory,
  costStructure,
  breakEvenPoint,
  collectionStats,
} from '@/lib/finance-analytics'
import type { PlayerLevel } from '@/types'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

const LEVEL_LABELS: Record<PlayerLevel, string> = {
  iniciacion: 'Iniciación',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
  competicion: 'Competición',
  menores: 'Menores',
}

const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function monthKeyLabel(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return `${MONTH_SHORT[month - 1]} ${year}`
}

function VariationBadge({ current, previous }: { current: number; previous: number }) {
  const change = pctChange(current, previous)
  if (change === null) {
    return <span className="text-xs text-muted-foreground">Sin dato previo</span>
  }
  const rounded = Math.round(change * 10) / 10
  if (rounded === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> Sin cambios
      </span>
    )
  }
  const isUp = rounded > 0
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${isUp ? 'text-green-600' : 'text-red-600'}`}>
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isUp ? '+' : ''}{rounded}%
    </span>
  )
}

export function FinanceTab() {
  const {
    payments,
    eventPayments,
    privateLessonPayments,
    events,
    groups,
    players,
    privateLessons,
    coachSalaryConfigs,
    clubTransactions,
    enrollments,
  } = useDataStore()

  const [period, setPeriod] = useState<AnalyticsPeriod>('month')
  const now = useMemo(() => new Date(), [])

  const currentKeys = useMemo(() => new Set(getCurrentPeriodMonthKeys(period, now)), [period, now])
  const previousKeys = useMemo(() => new Set(getPreviousPeriodMonthKeys(period, now)), [period, now])
  const last6MonthKeys = useMemo(() => getLastNMonthKeys(6, now), [now])

  const allPayments = useMemo(
    () => normalizeAllPayments(payments, eventPayments, privateLessonPayments ?? [], events),
    [payments, eventPayments, privateLessonPayments, events]
  )

  // ── 1. Ingresos por origen ──────────────────────────────────────────
  const originCurrent = useMemo(() => revenueByOrigin(allPayments, currentKeys), [allPayments, currentKeys])
  const originPrevious = useMemo(() => revenueByOrigin(allPayments, previousKeys), [allPayments, previousKeys])

  // ── 2. Adultos vs Menores ───────────────────────────────────────────
  const ageCurrent = useMemo(
    () => revenueByAgeGroup(allPayments, groups, players, currentKeys),
    [allPayments, groups, players, currentKeys]
  )
  const agePrevious = useMemo(
    () => revenueByAgeGroup(allPayments, groups, players, previousKeys),
    [allPayments, groups, players, previousKeys]
  )
  const ageTotal = ageCurrent.adultos + ageCurrent.menores

  // ── 3. Por grupo/nivel ──────────────────────────────────────────────
  const byLevel = useMemo(() => revenueByLevel(allPayments, groups, currentKeys), [allPayments, groups, currentKeys])
  const byLevelRows = useMemo(
    () => (Object.entries(byLevel) as [PlayerLevel, number][]).sort((a, b) => b[1] - a[1]),
    [byLevel]
  )

  // ── 4. Margen por categoria ──────────────────────────────────────────
  const margin = useMemo(
    () => contributionMarginByCategory(
      allPayments, groups, coachSalaryConfigs, events, eventPayments, privateLessons, privateLessonPayments ?? [], currentKeys
    ),
    [allPayments, groups, coachSalaryConfigs, events, eventPayments, privateLessons, privateLessonPayments, currentKeys]
  )
  const marginRows = useMemo(
    () => ([
      { label: 'Cuotas', ...margin.cuotas },
      { label: 'Eventos', ...margin.eventos },
      { label: 'Clases particulares', ...margin.clases },
    ]).sort((a, b) => b.margin - a.margin),
    [margin]
  )

  // ── 5. Estructura de costes ──────────────────────────────────────────
  const currentCostStructure = useMemo(() => costStructure(clubTransactions, currentKeys), [clubTransactions, currentKeys])
  const costTrend = useMemo(
    () => last6MonthKeys.map(key => {
      const stats = costStructure(clubTransactions, new Set([key]))
      return { name: monthKeyLabel(key), 'Fijos %': Math.round(stats.fixedPct), 'Variables %': Math.round(stats.variablePct) }
    }),
    [clubTransactions, last6MonthKeys]
  )
  const costPieData = [
    { name: 'Fijos', value: currentCostStructure.fixed },
    { name: 'Variables', value: currentCostStructure.variable },
  ]
  const COST_COLORS = ['#f97316', '#3b82f6']

  // ── 6. Punto de equilibrio ───────────────────────────────────────────
  const activeEnrollmentCount = useMemo(() => enrollments.filter(e => e.isActive && !e.isWaitlist).length, [enrollments])
  const avgMarginPerStudent = activeEnrollmentCount > 0 ? margin.cuotas.margin / activeEnrollmentCount : 0
  const breakEven = useMemo(
    () => breakEvenPoint(currentCostStructure.fixed, avgMarginPerStudent, activeEnrollmentCount),
    [currentCostStructure.fixed, avgMarginPerStudent, activeEnrollmentCount]
  )

  // ── 7. Morosidad y cobro ──────────────────────────────────────────────
  const collection = useMemo(() => collectionStats(allPayments, currentKeys), [allPayments, currentKeys])
  const collectionTrend = useMemo(
    () => last6MonthKeys.map(key => {
      const stats = collectionStats(allPayments, new Set([key]))
      return { name: monthKeyLabel(key), 'Tasa de cobro %': Math.round(stats.collectionRate) }
    }),
    [allPayments, last6MonthKeys]
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          Análisis financiero del club: origen de ingresos, margen real por categoría y colchón financiero.
        </p>
        <Select
          className="w-36 h-8 text-xs"
          value={period}
          onChange={e => setPeriod(e.target.value as AnalyticsPeriod)}
          options={[
            { value: 'month', label: 'Este mes' },
            { value: 'quarter', label: 'Trimestre' },
            { value: 'year', label: 'Este año' },
          ]}
        />
      </div>

      {/* 1. Ingresos por origen */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ingresos por origen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {([
            ['Cuotas', originCurrent.cuotas, originPrevious.cuotas],
            ['Eventos', originCurrent.eventos, originPrevious.eventos],
            ['Clases particulares', originCurrent.clases, originPrevious.clases],
          ] as [string, number, number][]).map(([label, value, previous]) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-sm">{label}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {originCurrent.total > 0 ? Math.round((value / originCurrent.total) * 100) : 0}%
                </span>
                <span className="font-semibold">{formatCurrency(value)}</span>
                <VariationBadge current={value} previous={previous} />
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between border-t pt-3 font-semibold">
            <span>Total</span>
            <span>{formatCurrency(originCurrent.total)}</span>
          </div>
        </CardContent>
      </Card>

      {/* 2. Adultos vs Menores */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adultos vs. Menores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {([
            ['Adultos', ageCurrent.adultos, agePrevious.adultos],
            ['Menores', ageCurrent.menores, agePrevious.menores],
          ] as [string, number, number][]).map(([label, value, previous]) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-sm">{label}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {ageTotal > 0 ? Math.round((value / ageTotal) * 100) : 0}%
                </span>
                <span className="font-semibold">{formatCurrency(value)}</span>
                <VariationBadge current={value} previous={previous} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 3. Por grupo/nivel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ingresos de cuotas por nivel</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nivel</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byLevelRows.map(([level, amount]) => (
                <TableRow key={level}>
                  <TableCell>{LEVEL_LABELS[level]}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 4. Margen por categoria */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Margen por categoría</CardTitle>
          <p className="text-xs text-muted-foreground">Ingreso menos el coste del coach directamente atribuible.</p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Ingreso</TableHead>
                <TableHead className="text-right">Coste coach</TableHead>
                <TableHead className="text-right">Margen</TableHead>
                <TableHead className="text-right">% Margen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {marginRows.map(row => (
                <TableRow key={row.label}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.revenue)}</TableCell>
                  <TableCell className="text-right text-red-600">-{formatCurrency(row.cost)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(row.margin)}</TableCell>
                  <TableCell className="text-right">{Math.round(row.marginPct)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 5. Estructura de costes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estructura de costes</CardTitle>
          <p className="text-xs text-muted-foreground">
            Fijos: alquiler, suministros, limpieza, publicidad. Variables: nómina, material, reparaciones, otro.
          </p>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={costPieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {costPieData.map((entry, i) => <Cell key={entry.name} fill={COST_COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={costTrend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => `${value}%`} />
                <Legend />
                <Line type="monotone" dataKey="Fijos %" stroke={COST_COLORS[0]} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Variables %" stroke={COST_COLORS[1]} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 6. Punto de equilibrio */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Punto de equilibrio</CardTitle>
          <p className="text-xs text-muted-foreground">
            Alumnos de cuota necesarios para cubrir los costes fijos del periodo, según el margen medio actual por alumno.
          </p>
        </CardHeader>
        <CardContent>
          {breakEven.studentsNeeded === Infinity ? (
            <p className="text-sm text-red-600">
              El margen medio por alumno es cero o negativo este periodo: ningún número de alumnos cubriría los costes fijos con la estructura actual.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{breakEven.studentsNeeded}</p>
                <p className="text-xs text-muted-foreground">alumnos necesarios</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{breakEven.actualStudents}</p>
                <p className="text-xs text-muted-foreground">alumnos activos</p>
              </div>
              <div>
                <p className={`text-2xl font-bold ${breakEven.marginStudents >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {breakEven.marginStudents >= 0 ? '+' : ''}{breakEven.marginStudents}
                </p>
                <p className="text-xs text-muted-foreground">margen de seguridad</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 7. Morosidad y cobro */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Morosidad y cobro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xl font-bold text-green-600">{formatCurrency(collection.paidAmount)}</p>
              <p className="text-xs text-muted-foreground">Cobrado</p>
            </div>
            <div>
              <p className="text-xl font-bold text-amber-600">{formatCurrency(collection.pendingAmount)}</p>
              <p className="text-xs text-muted-foreground">Pendiente</p>
            </div>
            <div>
              <p className="text-xl font-bold text-muted-foreground">{formatCurrency(collection.cancelledAmount)}</p>
              <p className="text-xs text-muted-foreground">Cancelado</p>
            </div>
          </div>

          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={collectionTrend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} domain={[0, 100]} />
                <Tooltip formatter={(value: number) => `${value}%`} />
                <Line type="monotone" dataKey="Tasa de cobro %" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {collection.topDebtors.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Top deudores</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jugador</TableHead>
                    <TableHead className="text-right">Recibos pendientes</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {collection.topDebtors.map(d => (
                    <TableRow key={d.playerId}>
                      <TableCell>{d.playerName}</TableCell>
                      <TableCell className="text-right">{d.pendingCount}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(d.pendingAmount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npm run build`
Expected: sin errores de TypeScript en `FinanceTab.tsx` (puede haber otros errores si `AnalyticsPage.tsx` aún no importa el componente — eso se corrige en la Task 11; si aparece algún error específico de este archivo, corregirlo antes de continuar).

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/analytics/FinanceTab.tsx
git commit -m "feat: crear componente FinanceTab con las 7 secciones de analitica financiera"
```

---

## Task 11: Integrar la pestaña "Finanzas" en `AnalyticsPage.tsx`

**Files:**
- Modify: `src/pages/AnalyticsPage.tsx`

- [ ] **Step 1: Añadir el import y el tipo de pestaña**

En `src/pages/AnalyticsPage.tsx`, cambiar:

```ts
import { TrendingUp, AlertTriangle, Star, Trophy, History } from 'lucide-react'
```

por:

```ts
import { TrendingUp, AlertTriangle, Star, Trophy, History, Euro } from 'lucide-react'
```

y añadir el import del nuevo componente junto a los demás:

```ts
import { FinanceTab } from '@/components/shared/analytics/FinanceTab'
```

Cambiar:

```ts
type Tab = 'kpis' | 'riesgo' | 'cuestionarios' | 'ranking' | 'historico'

const VALID_TABS: Tab[] = ['kpis', 'riesgo', 'cuestionarios', 'ranking', 'historico']
```

por:

```ts
type Tab = 'kpis' | 'finanzas' | 'riesgo' | 'cuestionarios' | 'ranking' | 'historico'

const VALID_TABS: Tab[] = ['kpis', 'finanzas', 'riesgo', 'cuestionarios', 'ranking', 'historico']
```

- [ ] **Step 2: Añadir el TabsTrigger y ajustar el grid**

Cambiar:

```tsx
<TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-auto gap-1 mb-6">
  <TabsTrigger value="kpis" className="flex items-center gap-1.5 text-xs py-2">
    <TrendingUp className="h-3.5 w-3.5 hidden sm:block" />
    KPIs del Club
  </TabsTrigger>
  <TabsTrigger value="riesgo" className="flex items-center gap-1.5 text-xs py-2">
```

por:

```tsx
<TabsList className="grid w-full grid-cols-2 sm:grid-cols-6 h-auto gap-1 mb-6">
  <TabsTrigger value="kpis" className="flex items-center gap-1.5 text-xs py-2">
    <TrendingUp className="h-3.5 w-3.5 hidden sm:block" />
    KPIs del Club
  </TabsTrigger>
  <TabsTrigger value="finanzas" className="flex items-center gap-1.5 text-xs py-2">
    <Euro className="h-3.5 w-3.5 hidden sm:block" />
    Finanzas
  </TabsTrigger>
  <TabsTrigger value="riesgo" className="flex items-center gap-1.5 text-xs py-2">
```

- [ ] **Step 3: Añadir el TabsContent**

Cambiar:

```tsx
          <TabsContent value="kpis">
            <KPIsTab />
          </TabsContent>

          <TabsContent value="riesgo">
```

por:

```tsx
          <TabsContent value="kpis">
            <KPIsTab />
          </TabsContent>

          <TabsContent value="finanzas">
            <FinanceTab />
          </TabsContent>

          <TabsContent value="riesgo">
```

- [ ] **Step 4: Verificar build**

Run: `npm run build`
Expected: sin errores de TypeScript ni de build.

- [ ] **Step 5: Commit**

```bash
git add src/pages/AnalyticsPage.tsx
git commit -m "feat: añadir pestaña Finanzas a Inteligencia del Club"
```

---

## Task 12: Verificación final

**Files:** ninguno (solo comandos)

- [ ] **Step 1: Ejecutar toda la suite de tests**

Run: `npm test`
Expected: todos los tests en verde, incluidos los nuevos de `period.test.ts`, `salary-utils.test.ts` y `finance-analytics.test.ts`.

- [ ] **Step 2: Build completo**

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 3: Verificación manual en el navegador**

Usar la skill `run` (o `npm run dev` manualmente) para levantar la app, iniciar sesión como director/coordinador, ir a "Inteligencia del Club" → pestaña "Finanzas", y confirmar:
1. Las 7 secciones cargan sin errores en consola.
2. Cambiar el selector de periodo (mes/trimestre/año) recalcula todas las secciones sin romper la página.
3. "Ingresos por origen" (Cuotas) coincide con el importe de "Cuotas M." mostrado en `FinancialsPage` → "Beneficios y Gastos" para el mismo mes.
4. Si el club no tiene transacciones/eventos/clases particulares de prueba, las secciones muestran 0 € o tablas vacías sin romper (sin `NaN`, sin `Infinity` visible salvo el aviso explícito del punto de equilibrio).

- [ ] **Step 4: Commit final si hubo ajustes**

Si el paso 3 reveló algún ajuste visual menor, aplicarlo y:

```bash
git add -A
git commit -m "fix: ajustes de verificacion manual en pestaña Finanzas"
```
