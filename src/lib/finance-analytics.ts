import type { NormalizedPayment } from '@/lib/payment-utils'

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
