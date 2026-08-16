import type { BillingFrequency } from '@/types'

/**
 * Returns true if billingMonth is a payment month for the given frequency/anchor.
 *
 * - monthly: always true
 * - quarterly: true when (billingMonth - anchorMonth) mod 3 === 0  (mod 12 arithmetic)
 *   Example: anchorMonth=9 → payment months: 9, 12, 3, 6
 * - annual: true only when billingMonth === anchorMonth
 * - installments: always returns true — caller must additionally check
 *   group.installmentPrices[YYYY-MM] exists and is > 0
 */
export function isBillingMonth(
  frequency: BillingFrequency,
  anchorMonth: number,   // 1-12
  billingMonth: number,  // 1-12
): boolean {
  switch (frequency) {
    case 'monthly':
      return true
    case 'quarterly':
      return ((billingMonth - anchorMonth + 12) % 12) % 3 === 0
    case 'annual':
      return billingMonth === anchorMonth
    case 'installments':
      return true
  }
}

/** Short display label for a billing frequency. */
export function billingFrequencyLabel(freq: BillingFrequency): string {
  switch (freq) {
    case 'monthly':      return 'Mensual'
    case 'quarterly':    return 'Trimestral'
    case 'annual':       return 'Anual'
    case 'installments': return 'Plazos'
  }
}

/** Nº de meses que cubre un recibo de esta frecuencia. */
export function cycleLength(frequency: BillingFrequency): number {
  switch (frequency) {
    case 'monthly':      return 1
    case 'quarterly':    return 3
    case 'annual':       return 12
    case 'installments': return 1   // plazos usa su propio precio por mes, no se multiplica
  }
}

/**
 * Nº de meses restantes de un grupo, contando desde el mes de facturación
 * (inclusive) hasta el mes en que termina el grupo (inclusive).
 * Ej: grupo termina en septiembre, se factura en septiembre -> 1.
 * Ej: grupo termina en noviembre, se factura en septiembre -> 3 (sep, oct, nov).
 */
export function remainingMonthsInGroup(
  groupEnd: Date,
  billingMonth: number, // 1-12
  billingYear: number,
): number {
  const endMonthsTotal = groupEnd.getFullYear() * 12 + (groupEnd.getMonth() + 1)
  const billingMonthsTotal = billingYear * 12 + billingMonth
  return endMonthsTotal - billingMonthsTotal + 1
}
