import type { NormalizedPayment } from '@/lib/payment-utils'
import type { Group, Player } from '@/types'

/** Variacion porcentual de `current` respecto a `previous`. `null` si no es comparable (previo 0, actual > 0). */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / previous) * 100
}

function monthKeyOf(p: Pick<NormalizedPayment, 'billingYear' | 'billingMonth'>): string {
  return `${p.billingYear}-${p.billingMonth}`
}

function isPaidInPeriod(p: NormalizedPayment, monthKeys: Set<string>): boolean {
  return p.status === 'pagado' && monthKeys.has(monthKeyOf(p))
}

export interface RevenueByOrigin {
  cuotas: number
  eventos: number
  clases: number
  total: number
}

/** Ingresos pagados dentro de `monthKeys`, agrupados por origen (cuota+manual, evento, clase particular). */
export function revenueByOrigin(payments: NormalizedPayment[], monthKeys: Set<string>): RevenueByOrigin {
  const result: RevenueByOrigin = { cuotas: 0, eventos: 0, clases: 0, total: 0 }
  for (const p of payments) {
    if (!isPaidInPeriod(p, monthKeys)) continue
    if (p.source === 'cuota' || p.source === 'manual') result.cuotas += p.amount
    else if (p.source === 'evento') result.eventos += p.amount
    else if (p.source === 'clase_particular') result.clases += p.amount
  }
  result.total = result.cuotas + result.eventos + result.clases
  return result
}

export interface RevenueByAgeGroup {
  adultos: number
  menores: number
}

/**
 * Ingresos pagados dentro de `monthKeys`, agrupados por franja de edad.
 * Las cuotas de grupo se clasifican por `Group.level === 'menores'` (mismo criterio que
 * la nomina de entrenadores); eventos y clases particulares, al no estar ligados a un
 * grupo, se clasifican por `Player.isMinor` del jugador que paga.
 */
export function revenueByAgeGroup(
  payments: NormalizedPayment[],
  groups: Group[],
  players: Player[],
  monthKeys: Set<string>
): RevenueByAgeGroup {
  const result: RevenueByAgeGroup = { adultos: 0, menores: 0 }
  for (const p of payments) {
    if (!isPaidInPeriod(p, monthKeys)) continue
    if (p.source !== 'cuota' && p.source !== 'manual' && p.source !== 'evento' && p.source !== 'clase_particular') continue

    const group = p.groupId ? groups.find(g => g.id === p.groupId) : undefined
    if (group) {
      if (group.level === 'menores') result.menores += p.amount
      else result.adultos += p.amount
      continue
    }

    const player = players.find(pl => pl.id === p.playerId)
    if (player?.isMinor) result.menores += p.amount
    else result.adultos += p.amount
  }
  return result
}
