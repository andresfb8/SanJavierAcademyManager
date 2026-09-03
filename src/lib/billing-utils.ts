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

/**
 * Quita el aviso de ciclo incompleto (⚠ ...) del concepto de un pago, para
 * usos de cara al cliente (factura, remesa SEPA) donde esa nota interna no
 * debe aparecer. El concepto guardado en el pago no se toca — esto solo
 * afecta a la copia usada en esos documentos.
 */
export function stripCycleWarning(concept: string): string {
  return concept.replace(/\s*⚠.*$/, '')
}

/**
 * Genera las claves 'YYYY-MM' de todos los meses entre inicio y fin (ambos
 * incluidos), para un plan de tarifa por plazos. Única fuente de verdad para
 * "qué meses caen en el rango del plan" — la usan tanto la pantalla de
 * edición de tarifas (qué inputs mostrar) como el guardado (qué plazos
 * persistir), para que nunca puedan desincronizarse.
 * Si el rango está invertido (fin antes que inicio), devuelve un array vacío.
 */
export function buildInstallmentMonthKeys(
  startYear: number,
  startMonth: number, // 1-12
  endYear: number,
  endMonth: number, // 1-12
): string[] {
  const months: string[] = []
  let y = startYear, m = startMonth
  while (y < endYear || (y === endYear && m <= endMonth)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) { m = 1; y++ }
    if (months.length >= 60) break // safety cap: 5 años, cubre el selector de año existente
  }
  return months
}

export interface EnrollmentAmountInput {
  billingFrequency: BillingFrequency
  customPrice?: number
  tariffPrice?: number
  tariffInstallmentPrices?: Record<string, number>
}

/**
 * Importe a facturar a una matricula para `billingKey` ("YYYY-MM"),
 * resuelto siempre a partir de SU PROPIA tarifa (nunca la del grupo).
 * `null` significa "no se puede facturar este mes" (tarifa de cuotas sin
 * precio para ese mes, o tarifa sin precio base en el resto de
 * frecuencias) — el caller debe saltar la matricula, no caer de vuelta a
 * ningun precio de grupo (ese era exactamente el bug que esta funcion
 * sustituye: usar group.defaultTariffPrice/installmentPrices en vez de
 * la tarifa individual de cada matricula).
 */
export function resolveEnrollmentAmount(
  input: EnrollmentAmountInput,
  billingKey: string
): number | null {
  if (input.customPrice !== undefined) return input.customPrice
  if (input.billingFrequency === 'installments') {
    return input.tariffInstallmentPrices?.[billingKey] ?? null
  }
  return input.tariffPrice ?? null
}
