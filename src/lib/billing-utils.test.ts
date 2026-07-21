import { describe, it, expect } from 'vitest'
import { cycleLength } from '@/lib/billing-utils'

describe('cycleLength', () => {
  it('mensual cubre 1 mes', () => {
    expect(cycleLength('monthly')).toBe(1)
  })

  it('trimestral cubre 3 meses', () => {
    expect(cycleLength('quarterly')).toBe(3)
  })

  it('anual cubre 12 meses', () => {
    expect(cycleLength('annual')).toBe(12)
  })

  it('plazos cubre 1 mes (usa su propio precio por mes, no se multiplica)', () => {
    expect(cycleLength('installments')).toBe(1)
  })
})

describe('importe por periodo (base x cycleLength, misma fórmula que usan firestoreSync.ts y generateMonthlyReceipts.ts)', () => {
  it('mensual: 45 x 1 = 45', () => {
    expect(45 * cycleLength('monthly')).toBe(45)
  })

  it('trimestral: 45 x 3 = 135', () => {
    expect(45 * cycleLength('quarterly')).toBe(135)
  })

  it('anual: 45 x 12 = 540', () => {
    expect(45 * cycleLength('annual')).toBe(540)
  })
})
