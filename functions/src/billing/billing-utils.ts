type BillingFrequency = "monthly" | "quarterly" | "annual" | "installments";

/**
 * Returns true if billingMonth is a payment month for the given frequency/anchor.
 * See src/lib/billing-utils.ts for full documentation.
 */
export function isBillingMonth(
  frequency: BillingFrequency,
  anchorMonth: number,
  billingMonth: number,
): boolean {
  switch (frequency) {
    case "monthly":
      return true;
    case "quarterly":
      return ((billingMonth - anchorMonth + 12) % 12) % 3 === 0;
    case "annual":
      return billingMonth === anchorMonth;
    case "installments":
      return true;
  }
}

/**
 * Nº de meses que cubre un recibo de esta frecuencia.
 * See src/lib/billing-utils.ts for full documentation.
 */
export function cycleLength(frequency: BillingFrequency): number {
  switch (frequency) {
    case "monthly":
      return 1;
    case "quarterly":
      return 3;
    case "annual":
      return 12;
    case "installments":
      return 1; // plazos usa su propio precio por mes, no se multiplica
  }
}

/** Short display label for a billing frequency. */
export function billingFrequencyLabel(freq: BillingFrequency): string {
  switch (freq) {
    case "monthly":
      return "Mensual";
    case "quarterly":
      return "Trimestral";
    case "annual":
      return "Anual";
    case "installments":
      return "Plazos";
  }
}

/**
 * Nº de meses restantes de un grupo, contando desde el mes de facturación
 * (inclusive) hasta el mes en que termina el grupo (inclusive).
 * See src/lib/billing-utils.ts for full documentation.
 */
export function remainingMonthsInGroup(
  groupEnd: Date,
  billingMonth: number,
  billingYear: number,
): number {
  const endMonthsTotal = groupEnd.getFullYear() * 12 + (groupEnd.getMonth() + 1);
  const billingMonthsTotal = billingYear * 12 + billingMonth;
  return endMonthsTotal - billingMonthsTotal + 1;
}
