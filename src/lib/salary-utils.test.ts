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
