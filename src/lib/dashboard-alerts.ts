import type { NormalizedPayment } from '@/lib/payment-utils'

export interface PendingPaymentAlert {
  playerId: string
  playerName: string
  pendingCount: number
  pendingAmount: number
}

/**
 * Jugadores con `minPendingCount` o mas recibos en estado 'pendiente', ordenados de mayor a
 * menor numero de recibos pendientes (empate: mayor importe pendiente primero).
 */
export function pendingPaymentAlerts(
  payments: NormalizedPayment[],
  minPendingCount = 2
): PendingPaymentAlert[] {
  const byPlayer = new Map<string, PendingPaymentAlert>()

  for (const p of payments) {
    if (p.status !== 'pendiente') continue
    const existing = byPlayer.get(p.playerId)
    if (existing) {
      existing.pendingCount += 1
      existing.pendingAmount += p.amount
    } else {
      byPlayer.set(p.playerId, {
        playerId: p.playerId,
        playerName: p.playerName,
        pendingCount: 1,
        pendingAmount: p.amount,
      })
    }
  }

  return Array.from(byPlayer.values())
    .filter(a => a.pendingCount >= minPendingCount)
    .sort((a, b) => b.pendingCount - a.pendingCount || b.pendingAmount - a.pendingAmount)
}
