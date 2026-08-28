import { describe, it, expect } from 'vitest'
import { isTariffInUse, tariffUsageCount } from '@/lib/tariff-utils'
import type { Enrollment, Group } from '@/types'

function makeEnrollment(overrides: Partial<Enrollment> = {}): Enrollment {
  return {
    id: 'e1',
    playerId: 'p1',
    playerName: 'Jugador',
    groupId: 'g1',
    groupName: 'Grupo 1',
    tariffId: 't1',
    tariffName: 'Tarifa 1',
    enrollmentDate: new Date('2026-01-01'),
    isActive: true,
    ...overrides,
  }
}

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

describe('isTariffInUse', () => {
  it('true si una matricula activa usa la tarifa', () => {
    const enrollments = [makeEnrollment({ tariffId: 't1', isActive: true })]
    expect(isTariffInUse('t1', enrollments, [])).toBe(true)
  })

  it('true si un grupo activo la tiene como tarifa por defecto', () => {
    const groups = [makeGroup({ defaultTariffId: 't1', isActive: true })]
    expect(isTariffInUse('t1', [], groups)).toBe(true)
  })

  it('false si solo la usan matriculas o grupos inactivos', () => {
    const enrollments = [makeEnrollment({ tariffId: 't1', isActive: false })]
    const groups = [makeGroup({ defaultTariffId: 't1', isActive: false })]
    expect(isTariffInUse('t1', enrollments, groups)).toBe(false)
  })

  it('false si nadie la usa', () => {
    const enrollments = [makeEnrollment({ tariffId: 'otra', isActive: true })]
    const groups = [makeGroup({ defaultTariffId: 'otra', isActive: true })]
    expect(isTariffInUse('t1', enrollments, groups)).toBe(false)
  })
})

describe('tariffUsageCount', () => {
  it('cuenta matriculas y grupos activos por separado', () => {
    const enrollments = [
      makeEnrollment({ id: 'e1', tariffId: 't1', isActive: true }),
      makeEnrollment({ id: 'e2', tariffId: 't1', isActive: true }),
      makeEnrollment({ id: 'e3', tariffId: 't1', isActive: false }),
    ]
    const groups = [
      makeGroup({ id: 'g1', defaultTariffId: 't1', isActive: true }),
      makeGroup({ id: 'g2', defaultTariffId: 't1', isActive: false }),
    ]
    expect(tariffUsageCount('t1', enrollments, groups)).toEqual({ enrollmentCount: 2, groupCount: 1 })
  })

  it('devuelve ceros si nadie la usa', () => {
    expect(tariffUsageCount('t1', [], [])).toEqual({ enrollmentCount: 0, groupCount: 0 })
  })
})
