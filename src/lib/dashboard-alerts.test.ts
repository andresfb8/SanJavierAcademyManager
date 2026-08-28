import { describe, it, expect } from 'vitest'
import { pendingPaymentAlerts } from '@/lib/dashboard-alerts'
import type { NormalizedPayment } from '@/lib/payment-utils'

function makePayment(overrides: Partial<NormalizedPayment> = {}): NormalizedPayment {
  return {
    id: 'pay1',
    source: 'cuota',
    playerId: 'p1',
    playerName: 'Jugador',
    concept: 'Cuota',
    amount: 100,
    status: 'pendiente',
    billingMonth: 8,
    billingYear: 2026,
    ...overrides,
  }
}

describe('pendingPaymentAlerts', () => {
  it('agrupa pagos pendientes por jugador y filtra por minPendingCount', () => {
    const payments: NormalizedPayment[] = [
      makePayment({ id: 'a', playerId: 'p1', playerName: 'Ana', amount: 50 }),
      makePayment({ id: 'b', playerId: 'p1', playerName: 'Ana', amount: 30 }),
      makePayment({ id: 'c', playerId: 'p2', playerName: 'Bea', amount: 200 }),
    ]
    const result = pendingPaymentAlerts(payments, 2)
    expect(result).toEqual([
      { playerId: 'p1', playerName: 'Ana', pendingCount: 2, pendingAmount: 80 },
    ])
  })

  it('ignora pagos que no esten pendientes', () => {
    const payments: NormalizedPayment[] = [
      makePayment({ id: 'a', playerId: 'p1', status: 'pagado' }),
      makePayment({ id: 'b', playerId: 'p1', status: 'pendiente' }),
    ]
    expect(pendingPaymentAlerts(payments, 2)).toEqual([])
  })

  it('ordena por pendingCount desc, empate por pendingAmount desc', () => {
    const payments: NormalizedPayment[] = [
      makePayment({ id: 'a', playerId: 'p1', playerName: 'Ana', amount: 100 }),
      makePayment({ id: 'b', playerId: 'p1', playerName: 'Ana', amount: 100 }),
      makePayment({ id: 'c', playerId: 'p2', playerName: 'Bea', amount: 50 }),
      makePayment({ id: 'd', playerId: 'p2', playerName: 'Bea', amount: 50 }),
      makePayment({ id: 'e', playerId: 'p3', playerName: 'Caro', amount: 40 }),
      makePayment({ id: 'f', playerId: 'p3', playerName: 'Caro', amount: 40 }),
      makePayment({ id: 'g', playerId: 'p3', playerName: 'Caro', amount: 40 }),
    ]
    const result = pendingPaymentAlerts(payments, 2)
    expect(result.map(r => r.playerId)).toEqual(['p3', 'p1', 'p2'])
  })

  it('usa minPendingCount=2 por defecto', () => {
    const payments: NormalizedPayment[] = [
      makePayment({ id: 'a', playerId: 'p1', playerName: 'Ana' }),
    ]
    expect(pendingPaymentAlerts(payments)).toEqual([])
  })
})
