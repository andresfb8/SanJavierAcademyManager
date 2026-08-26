import { describe, it, expect } from 'vitest'
import { pctChange, revenueByOrigin, revenueByAgeGroup, revenueByLevel, contributionMarginByCategory } from '@/lib/finance-analytics'
import type { NormalizedPayment } from '@/lib/payment-utils'
import type { AcademyEvent, EventPayment, PrivateLesson, PrivateLessonPayment, CoachSalaryConfig, Group, Player } from '@/types'

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

  it('excluye pagos con source "otro" para reconciliar con revenueByOrigin', () => {
    const groups = [makeGroup({ id: 'g-menores', level: 'menores' })]
    const players = [makePlayer({ id: 'p-menor', isMinor: true })]
    const payments: NormalizedPayment[] = [
      makePayment({ source: 'otro', groupId: 'g-menores', amount: 500 }),
      makePayment({ source: 'otro', playerId: 'p-menor', amount: 700 }),
    ]
    const result = revenueByAgeGroup(payments, groups, players, new Set(['2026-8']))
    expect(result).toEqual({ adultos: 0, menores: 0 })
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
    const configs = [makeSalaryConfig({ coachId: 'c1', ratePerGroupAdults: 100 })]
    const payments: NormalizedPayment[] = [
      makePayment({ source: 'cuota', groupId: 'g1', amount: 300, billingMonth: 8, billingYear: 2026 }),
    ]
    const result = contributionMarginByCategory(payments, groups, configs, [], [], [], [], new Set(['2026-8']))
    expect(result.cuotas).toEqual({ revenue: 300, cost: 100, margin: 200, marginPct: (200 * 100) / 300 })
  })

  it('cobra la tarifa del coach una vez por cada mes distinto con ingreso del mismo grupo', () => {
    const groups = [makeGroup({ id: 'g1', level: 'avanzado', coachId: 'c1' })]
    const configs = [makeSalaryConfig({ coachId: 'c1', ratePerGroupAdults: 100 })]
    const payments: NormalizedPayment[] = [
      makePayment({ source: 'cuota', groupId: 'g1', amount: 300, billingMonth: 7, billingYear: 2026 }),
      makePayment({ source: 'cuota', groupId: 'g1', amount: 300, billingMonth: 8, billingYear: 2026 }),
    ]
    const result = contributionMarginByCategory(payments, groups, configs, [], [], [], [], new Set(['2026-7', '2026-8']))
    expect(result.cuotas).toEqual({ revenue: 600, cost: 200, margin: 400, marginPct: (400 * 100) / 600 })
  })

  it('calcula margen de eventos restando gastos y comision del coach', () => {
    const configs = [makeSalaryConfig({ coachId: 'c1', eventPaymentType: 'fixed', eventRate: 20 })]
    const event = makeEvent({ id: 'ev1', coachIds: ['c1'], expenses: [{ concept: 'Trofeos', amount: 30 }] as any })
    const eventPayments = [makeEventPayment({ eventId: 'ev1', amount: 100, status: 'pagado' })]
    const result = contributionMarginByCategory([], [], configs, [event], eventPayments, [], [], new Set(['2026-8']))
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
