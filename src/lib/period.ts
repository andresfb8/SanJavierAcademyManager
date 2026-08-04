export type AnalyticsPeriod = 'month' | 'quarter' | 'year'

/**
 * Fecha de inicio del periodo (mes/trimestre/año en curso) al que pertenece
 * `now`. Puro, para poder reutilizarse en cualquier pestaña de analítica
 * sin duplicar el cálculo (KPIsTab, RiskTab, CoachRankingTab).
 */
export function getPeriodStart(period: AnalyticsPeriod, now: Date = new Date()): Date {
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1)
  if (period === 'quarter') return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
  return new Date(now.getFullYear(), 0, 1)
}
