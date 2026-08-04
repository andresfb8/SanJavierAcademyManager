import { describe, it, expect } from 'vitest'
import { findSlotForAttendanceDate } from '@/lib/attendance-schedule'
import type { Group } from '@/types'

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 'group-1',
    name: 'Iniciación',
    level: 'iniciacion',
    coachId: 'coach-1',
    coachName: 'Coach',
    courtId: 'court-1',
    courtName: 'Pista 1',
    schedule: [
      { dayOfWeek: 1, startTime: '18:00', endTime: '19:00' },
      { dayOfWeek: 3, startTime: '17:00', endTime: '18:30' },
    ],
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

describe('findSlotForAttendanceDate', () => {
  it('elige el horario del lunes cuando la fecha es lunes', () => {
    const group = makeGroup()
    const monday = new Date('2026-08-03T00:00:00')
    const slot = findSlotForAttendanceDate(group, monday)
    expect(slot).toEqual({ dayOfWeek: 1, startTime: '18:00', endTime: '19:00' })
  })

  it('elige el horario del miercoles cuando la fecha es miercoles, no el primero del array', () => {
    const group = makeGroup()
    const wednesday = new Date('2026-08-05T00:00:00')
    const slot = findSlotForAttendanceDate(group, wednesday)
    expect(slot).toEqual({ dayOfWeek: 3, startTime: '17:00', endTime: '18:30' })
  })

  it('usa el primer horario como respaldo si ningun dia coincide', () => {
    const group = makeGroup()
    const saturday = new Date('2026-08-08T00:00:00')
    const slot = findSlotForAttendanceDate(group, saturday)
    expect(slot).toEqual({ dayOfWeek: 1, startTime: '18:00', endTime: '19:00' })
  })
})
