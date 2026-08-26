import { describe, it, expect } from 'vitest'
import { pctChange, revenueByOrigin, revenueByAgeGroup, revenueByLevel, contributionMarginByCategory, costStructure, breakEvenPoint, collectionStats } from '@/lib/finance-analytics'
import type { NormalizedPayment } from '@/lib/payment-utils'
import type { AcademyEvent, EventPayment, PrivateLesson, PrivateLessonPayment, CoachSalaryConfig, Group, Player, ClubTransaction } from '@/types'

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
    expect(result).toEqual({ cuotas: 120, eventos: 30, clases: 40, otros: 0, total: 190 })
  })

  it('ignora pagos fuera de las claves de mes dadas', () => {
    const payments: NormalizedPayment[] = [
      makePayment({ billingMonth: 7, billingYear: 2026, amount: 500 }),
    ]
    const result = revenueByOrigin(payments, new Set(['2026-8']))
    expect(result).toEqual({ cuotas: 0, eventos: 0, clases: 0, otros: 0, total: 0 })
  })

  it('suma pagos con source "otro" (p. ej. recargos SEPA) en su propio bucket, incluidos en el total', () => {
    const payments: NormalizedPayment[] = [
      makePayment({ source: 'cuota', amount: 100 }),
      makePayment({ source: 'otro', amount: 15 }),
    ]
    const result = revenueByOrigin(payments, new Set(['2026-8']))
    expect(result.otros).toBe(15)
    expect(result.total).toBe(115)
  })
})

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

  it('clasifica pagos con source "otro" via el mismo fallback que eventos/clases', () => {
    const players = [makePlayer({ id: 'p-adulto', isMinor: false }), makePlayer({ id: 'p-menor', isMinor: true })]
    const payments: NormalizedPayment[] = [
      makePayment({ source: 'otro', playerId: 'p-adulto', amount: 500 }),
      makePayment({ source: 'otro', playerId: 'p-menor', amount: 700 }),
    ]
    const result = revenueByAgeGroup(payments, [], players, new Set(['2026-8']))
    expect(result).toEqual({ adultos: 500, menores: 700 })
  })
})

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
      sinGrupo: 0,
    })
  })

  it('atribuye a "sinGrupo" las cuotas/manual sin groupId o con groupId que no resuelve a un grupo, sin perder ingreso', () => {
    const groups = [makeGroup({ id: 'g1', level: 'iniciacion' })]
    const payments: NormalizedPayment[] = [
      makePayment({ source: 'cuota', groupId: undefined, amount: 70 }),
      makePayment({ source: 'manual', groupId: 'g-inexistente', amount: 30 }),
      makePayment({ source: 'cuota', groupId: 'g1', amount: 100 }),
    ]
    const result = revenueByLevel(payments, groups, new Set(['2026-8']))
    expect(result).toEqual({
      iniciacion: 100,
      intermedio: 0,
      avanzado: 0,
      competicion: 0,
      menores: 0,
      sinGrupo: 100,
    })

    const total = Object.values(result).reduce((a, b) => a + b, 0)
    const expectedCuotas = revenueByOrigin(payments, new Set(['2026-8'])).cuotas
    expect(total).toBe(expectedCuotas)
  })
})

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
    const coachSalaryConfigs = [makeSalaryConfig({ coachId: 'c1', ratePerGroupAdults: 100 })]
    const payments: NormalizedPayment[] = [
      makePayment({ source: 'cuota', groupId: 'g1', amount: 300, billingMonth: 8, billingYear: 2026 }),
    ]
    const result = contributionMarginByCategory({
      payments, groups, coachSalaryConfigs,
      events: [], eventPayments: [], privateLessons: [], privateLessonPayments: [],
      monthKeys: new Set(['2026-8']),
    })
    expect(result.cuotas).toEqual({ revenue: 300, cost: 100, margin: 200, marginPct: (200 * 100) / 300 })
  })

  it('cobra la tarifa del coach una vez por cada mes distinto con ingreso del mismo grupo', () => {
    const groups = [makeGroup({ id: 'g1', level: 'avanzado', coachId: 'c1' })]
    const coachSalaryConfigs = [makeSalaryConfig({ coachId: 'c1', ratePerGroupAdults: 100 })]
    const payments: NormalizedPayment[] = [
      makePayment({ source: 'cuota', groupId: 'g1', amount: 300, billingMonth: 7, billingYear: 2026 }),
      makePayment({ source: 'cuota', groupId: 'g1', amount: 300, billingMonth: 8, billingYear: 2026 }),
    ]
    const result = contributionMarginByCategory({
      payments, groups, coachSalaryConfigs,
      events: [], eventPayments: [], privateLessons: [], privateLessonPayments: [],
      monthKeys: new Set(['2026-7', '2026-8']),
    })
    expect(result.cuotas).toEqual({ revenue: 600, cost: 200, margin: 400, marginPct: (400 * 100) / 600 })
  })

  it('calcula margen de eventos restando gastos y comision del coach', () => {
    const coachSalaryConfigs = [makeSalaryConfig({ coachId: 'c1', eventPaymentType: 'fixed', eventRate: 20 })]
    const event = makeEvent({ id: 'ev1', coachIds: ['c1'], expenses: [{ concept: 'Trofeos', amount: 30 }] as any })
    const eventPayments = [makeEventPayment({ eventId: 'ev1', amount: 100, status: 'pagado' })]
    const result = contributionMarginByCategory({
      payments: [], groups: [], coachSalaryConfigs,
      events: [event], eventPayments, privateLessons: [], privateLessonPayments: [],
      monthKeys: new Set(['2026-8']),
    })
    expect(result.eventos).toEqual({ revenue: 100, cost: 50, margin: 50, marginPct: 50 })
  })

  it('calcula margen de clases particulares restando la comision del coach', () => {
    const coachSalaryConfigs = [makeSalaryConfig({ coachId: 'c1', privateLessonPaymentType: 'fixed', privateLessonRate: 15 })]
    const lesson = makeLesson({ id: 'l1', coachId: 'c1', price: 40 })
    const lessonPayments = [makeLessonPayment({ lessonId: 'l1', amount: 40 })]
    const result = contributionMarginByCategory({
      payments: [], groups: [], coachSalaryConfigs,
      events: [], eventPayments: [], privateLessons: [lesson], privateLessonPayments: lessonPayments,
      monthKeys: new Set(['2026-8']),
    })
    expect(result.clases).toEqual({ revenue: 40, cost: 15, margin: 25, marginPct: 62.5 })
  })

  it('no descuenta coste cuando el groupId de la cuota no resuelve a un grupo (revenue se cuenta igual)', () => {
    const groups: Group[] = []
    const coachSalaryConfigs = [makeSalaryConfig({ coachId: 'c1', ratePerGroupAdults: 100 })]
    const payments: NormalizedPayment[] = [
      makePayment({ source: 'cuota', groupId: 'g-inexistente', amount: 300, billingMonth: 8, billingYear: 2026 }),
    ]
    const result = contributionMarginByCategory({
      payments, groups, coachSalaryConfigs,
      events: [], eventPayments: [], privateLessons: [], privateLessonPayments: [],
      monthKeys: new Set(['2026-8']),
    })
    expect(result.cuotas).toEqual({ revenue: 300, cost: 0, margin: 300, marginPct: 100 })
  })

  it('no suma comision cuando el coach del evento no tiene CoachSalaryConfig (solo cuentan los gastos)', () => {
    const coachSalaryConfigs: CoachSalaryConfig[] = []
    const event = makeEvent({ id: 'ev1', coachIds: ['c1'], expenses: [{ concept: 'Trofeos', amount: 30 }] as any })
    const eventPayments = [makeEventPayment({ eventId: 'ev1', amount: 100, status: 'pagado' })]
    const result = contributionMarginByCategory({
      payments: [], groups: [], coachSalaryConfigs,
      events: [event], eventPayments, privateLessons: [], privateLessonPayments: [],
      monthKeys: new Set(['2026-8']),
    })
    expect(result.eventos).toEqual({ revenue: 100, cost: 30, margin: 70, marginPct: 70 })
  })

  it('con dos coaches en un evento, suma la comision de calculateEventSalary calculada para cada uno (cada llamada ya divide por numCoaches)', () => {
    const coachSalaryConfigs = [
      makeSalaryConfig({ coachId: 'c1', eventPaymentType: 'fixed', eventRate: 20 }),
      makeSalaryConfig({ coachId: 'c2', eventPaymentType: 'fixed', eventRate: 20 }),
    ]
    const event = makeEvent({ id: 'ev1', coachIds: ['c1', 'c2'] })
    const eventPayments = [makeEventPayment({ eventId: 'ev1', amount: 100, status: 'pagado' })]
    const result = contributionMarginByCategory({
      payments: [], groups: [], coachSalaryConfigs,
      events: [event], eventPayments, privateLessons: [], privateLessonPayments: [],
      monthKeys: new Set(['2026-8']),
    })
    // calculateEventSalary usa event.coachIds.length (2) como divisor en cada llamada:
    // c1 -> 20/2=10, c2 -> 20/2=10, total comision = 20. Sin gastos, cost = 20.
    expect(result.eventos).toEqual({ revenue: 100, cost: 20, margin: 80, marginPct: 80 })
  })
})

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

  it('devuelve Infinity tambien cuando el margen medio por alumno es negativo', () => {
    const result = breakEvenPoint(1000, -10, 10)
    expect(result.studentsNeeded).toBe(Infinity)
    expect(result.marginStudents).toBe(-Infinity)
  })

  it('calcula un margen negativo cuando los alumnos actuales no llegan al punto de equilibrio', () => {
    const result = breakEvenPoint(1000, 45, 10)
    expect(result.studentsNeeded).toBe(23)
    expect(result.marginStudents).toBe(-13)
  })

  it('no redondea de mas cuando la division es exacta', () => {
    const result = breakEvenPoint(900, 45, 20)
    expect(result.studentsNeeded).toBe(20)
    expect(result.marginStudents).toBe(0)
  })
})

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

describe('reconciliacion revenueByOrigin <-> collectionStats', () => {
  it('el total de revenueByOrigin coincide con el pagado de collectionStats para los mismos pagos, incluyendo source "otro"', () => {
    const payments: NormalizedPayment[] = [
      makePayment({ source: 'cuota', amount: 100 }),
      makePayment({ source: 'manual', amount: 20 }),
      makePayment({ source: 'evento', amount: 30 }),
      makePayment({ source: 'clase_particular', amount: 40 }),
      makePayment({ source: 'otro', amount: 15 }), // p. ej. recargo de devolucion SEPA
      makePayment({ source: 'cuota', amount: 999, status: 'pendiente' }),
    ]
    const monthKeys = new Set(['2026-8'])
    const origin = revenueByOrigin(payments, monthKeys)
    const collection = collectionStats(payments, monthKeys)
    expect(origin.total).toBe(collection.paidAmount)
  })
})
