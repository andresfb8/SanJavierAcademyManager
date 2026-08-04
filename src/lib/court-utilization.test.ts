import { describe, it, expect } from 'vitest'
import { computeCourtUtilization, getUnderutilizedSlots } from '@/lib/court-utilization'
import type { Court, Group, PrivateLesson } from '@/types'

const NOW = new Date('2026-08-01T12:00:00Z') // sábado

function makeCourt(overrides: Partial<Court> = {}): Court {
  return {
    id: 'court-1',
    name: 'Pista 1',
    type: 'indoor',
    surface: 'cristal',
    isActive: true,
    ...overrides,
  }
}

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 'group-1',
    name: 'Iniciación Lunes',
    level: 'iniciacion',
    coachId: 'coach-1',
    coachName: 'Coach',
    courtId: 'court-1',
    courtName: 'Pista 1',
    schedule: [{ dayOfWeek: 1, startTime: '18:00', endTime: '19:00' }],
    maxCapacity: 8,
    currentEnrollment: 8,
    defaultTariffId: 't1',
    defaultTariffPrice: 40,
    billingFrequency: 'monthly',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    isActive: true,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  }
}

function makePrivateLesson(overrides: Partial<PrivateLesson> = {}): PrivateLesson {
  return {
    id: 'pl-1',
    playerIds: ['p1'],
    playerNames: ['Jugador'],
    coachId: 'coach-1',
    coachName: 'Coach',
    courtId: 'court-2',
    courtName: 'Pista 2',
    date: new Date('2026-07-20T00:00:00Z'), // lunes, dentro de las ultimas 6 semanas respecto a NOW
    startTime: '18:00',
    endTime: '19:00',
    price: 30,
    isPaid: true,
    createdAt: new Date('2026-07-20'),
    ...overrides,
  }
}

describe('computeCourtUtilization', () => {
  it('marca una pista con grupo lleno como "lleno"', () => {
    const courts = [makeCourt()]
    const groups = [makeGroup({ currentEnrollment: 8, maxCapacity: 8 })]
    const result = computeCourtUtilization(courts, groups, [], NOW)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ status: 'lleno', occupancyPct: 100, groupName: 'Iniciación Lunes' })
  })

  it('marca un grupo con menos del 40% como "bajo"', () => {
    const courts = [makeCourt()]
    const groups = [makeGroup({ currentEnrollment: 2, maxCapacity: 8 })]
    const result = computeCourtUtilization(courts, groups, [], NOW)
    expect(result[0].status).toBe('bajo')
    expect(result[0].occupancyPct).toBe(25)
  })

  it('marca un grupo entre 40% y 70% como "medio"', () => {
    const courts = [makeCourt()]
    const groups = [makeGroup({ currentEnrollment: 4, maxCapacity: 8 })]
    const result = computeCourtUtilization(courts, groups, [], NOW)
    expect(result[0].status).toBe('medio')
    expect(result[0].occupancyPct).toBe(50)
  })

  it('incluye TODOS los horarios de un grupo, no solo el primero', () => {
    const courts = [makeCourt()]
    const groups = [makeGroup({
      schedule: [
        { dayOfWeek: 1, startTime: '18:00', endTime: '19:00' },
        { dayOfWeek: 3, startTime: '18:00', endTime: '19:00' },
      ],
    })]
    const result = computeCourtUtilization(courts, groups, [], NOW)
    expect(result).toHaveLength(2)
    expect(result.map(r => r.dayOfWeek).sort()).toEqual([1, 3])
  })

  it('marca como "vacio" una pista sin grupo en una franja que otra pista si usa', () => {
    const courts = [makeCourt({ id: 'court-1', name: 'Pista 1' }), makeCourt({ id: 'court-2', name: 'Pista 2' })]
    const groups = [makeGroup({ courtId: 'court-1' })] // solo pista 1 tiene grupo lunes 18:00
    const result = computeCourtUtilization(courts, groups, [], NOW)
    const court2Slot = result.find(r => r.courtId === 'court-2')
    expect(court2Slot).toMatchObject({ status: 'vacio', occupancyPct: null })
  })

  it('marca como "ocasional" una franja vacia con una clase particular reciente en esa pista/dia/hora', () => {
    const courts = [makeCourt({ id: 'court-1' }), makeCourt({ id: 'court-2' })]
    const groups = [makeGroup({ courtId: 'court-1' })]
    const privateLessons = [makePrivateLesson({ courtId: 'court-2', date: new Date('2026-07-20T00:00:00Z') })]
    const result = computeCourtUtilization(courts, groups, privateLessons, NOW)
    const court2Slot = result.find(r => r.courtId === 'court-2')
    expect(court2Slot?.status).toBe('ocasional')
  })

  it('ignora clases particulares de hace mas de 6 semanas', () => {
    const courts = [makeCourt({ id: 'court-1' }), makeCourt({ id: 'court-2' })]
    const groups = [makeGroup({ courtId: 'court-1' })]
    const privateLessons = [makePrivateLesson({ courtId: 'court-2', date: new Date('2026-05-01T00:00:00Z') })]
    const result = computeCourtUtilization(courts, groups, privateLessons, NOW)
    const court2Slot = result.find(r => r.courtId === 'court-2')
    expect(court2Slot?.status).toBe('vacio')
  })

  it('ignora pistas inactivas', () => {
    const courts = [makeCourt({ id: 'court-1', isActive: true }), makeCourt({ id: 'court-2', isActive: false })]
    const groups = [makeGroup({ courtId: 'court-1' })]
    const result = computeCourtUtilization(courts, groups, [], NOW)
    expect(result.every(r => r.courtId !== 'court-2')).toBe(true)
  })
})

describe('getUnderutilizedSlots', () => {
  it('incluye franjas vacias y con poca gente, excluye ocasional/medio/lleno', () => {
    const courts = [makeCourt({ id: 'court-1' }), makeCourt({ id: 'court-2' })]
    const groups = [
      makeGroup({ id: 'g1', courtId: 'court-1', schedule: [{ dayOfWeek: 1, startTime: '18:00', endTime: '19:00' }], currentEnrollment: 2, maxCapacity: 8 }),
      makeGroup({ id: 'g2', courtId: 'court-2', schedule: [{ dayOfWeek: 3, startTime: '19:00', endTime: '20:00' }], currentEnrollment: 8, maxCapacity: 8 }),
    ]
    const utilization = computeCourtUtilization(courts, groups, [], NOW)
    const underutilized = getUnderutilizedSlots(utilization)
    expect(underutilized.some(s => s.status === 'lleno')).toBe(false)
    expect(underutilized.some(s => s.status === 'bajo')).toBe(true)
  })
})
