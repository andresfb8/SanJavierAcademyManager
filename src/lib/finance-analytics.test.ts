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
