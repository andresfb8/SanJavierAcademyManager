import { describe, it, expect } from 'vitest'
import { pctChange, revenueByOrigin, revenueByAgeGroup } from '@/lib/finance-analytics'
import type { NormalizedPayment } from '@/lib/payment-utils'
import type { Group, Player } from '@/types'

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
})
