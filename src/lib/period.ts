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

function periodLengthMonths(period: AnalyticsPeriod): number {
  if (period === 'month') return 1
  if (period === 'quarter') return 3
  return 12
}

function monthKeysFrom(start: Date, count: number): string[] {
  const keys: string[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  for (let i = 0; i < count; i++) {
    keys.push(`${cursor.getFullYear()}-${cursor.getMonth() + 1}`)
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return keys
}

/**
 * Claves 'YYYY-M' de los meses ya transcurridos del periodo actual (hasta
 * `now` inclusive). Un trimestre o ano en curso solo incluye los meses ya
 * empezados, nunca meses futuros.
 */
export function getCurrentPeriodMonthKeys(period: AnalyticsPeriod, now: Date = new Date()): string[] {
  const start = getPeriodStart(period, now)
  const monthsElapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1
  return monthKeysFrom(start, monthsElapsed)
}

/**
 * Claves 'YYYY-M' del periodo anterior de igual duracion, desplazando cada
 * mes del periodo actual hacia atras la longitud del periodo (1/3/12 meses).
 * Asi un trimestre o ano parcial se compara con los mismos meses relativos
 * del periodo anterior, en vez de con una ventana de longitud fija distinta.
 */
export function getPreviousPeriodMonthKeys(period: AnalyticsPeriod, now: Date = new Date()): string[] {
  const current = getCurrentPeriodMonthKeys(period, now)
  const shift = periodLengthMonths(period)
  return current.map(key => {
    const [yearStr, monthStr] = key.split('-')
    const d = new Date(Number(yearStr), Number(monthStr) - 1 - shift, 1)
    return `${d.getFullYear()}-${d.getMonth() + 1}`
  })
}

/** Claves 'YYYY-M' de los ultimos `n` meses, en orden ascendente, incluyendo el mes de `now`. */
export function getLastNMonthKeys(n: number, now: Date = new Date()): string[] {
  const start = new Date(now.getFullYear(), now.getMonth() - (n - 1), 1)
  return monthKeysFrom(start, n)
}

const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/** Convierte una clave 'YYYY-M' (como las que devuelven las funciones de este modulo) a una etiqueta corta, ej. 'Ago 2026'. */
export function formatMonthKeyLabel(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return `${MONTH_SHORT[month - 1]} ${year}`
}
