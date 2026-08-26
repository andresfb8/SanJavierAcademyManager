import type { NormalizedPayment } from '@/lib/payment-utils'
import type {
  AcademyEvent,
  CoachSalaryConfig,
  EventPayment,
  Group,
  Player,
  PlayerLevel,
  PrivateLesson,
  PrivateLessonPayment,
} from '@/types'
import { calculateEventSalary, calculatePrivateLessonSalary } from '@/lib/salary-utils'

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

const ALL_LEVELS: PlayerLevel[] = ['iniciacion', 'intermedio', 'avanzado', 'competicion', 'menores']

/**
 * Ingresos de cuotas (cuota+manual) pagados dentro de `monthKeys`, agrupados por nivel del grupo.
 * Los 5 niveles siempre estan presentes en el resultado, mas un bucket `sinGrupo` para ingresos
 * de cuota/manual sin grupo atribuible (p. ej. facturas manuales sin `groupId`, o un `groupId`
 * que ya no resuelve a un grupo existente), de forma que el total sea siempre reconciliable con
 * `revenueByOrigin(...).cuotas` y no se pierda ingreso silenciosamente.
 */
export function revenueByLevel(
  payments: NormalizedPayment[],
  groups: Group[],
  monthKeys: Set<string>
): Record<PlayerLevel | 'sinGrupo', number> {
  const result = ALL_LEVELS.reduce((acc, level) => {
    acc[level] = 0
    return acc
  }, { sinGrupo: 0 } as Record<PlayerLevel | 'sinGrupo', number>)

  for (const p of payments) {
    if (!isPaidInPeriod(p, monthKeys)) continue
    if (p.source !== 'cuota' && p.source !== 'manual') continue
    const group = p.groupId ? groups.find(g => g.id === p.groupId) : undefined
    if (!group) {
      result.sinGrupo += p.amount
      continue
    }
    result[group.level] += p.amount
  }
  return result
}

export interface CategoryMargin {
  revenue: number
  cost: number
  margin: number
  marginPct: number
}

export interface MarginByCategory {
  cuotas: CategoryMargin
  eventos: CategoryMargin
  clases: CategoryMargin
}

function toMargin(revenue: number, cost: number): CategoryMargin {
  const margin = revenue - cost
  const marginPct = revenue > 0 ? (margin * 100) / revenue : 0
  return { revenue, cost, margin, marginPct }
}

function eventMonthKey(ev: AcademyEvent): string {
  const d = ev.date instanceof Date ? ev.date : new Date(ev.date)
  return `${d.getFullYear()}-${d.getMonth() + 1}`
}

function lessonMonthKey(pl: PrivateLesson): string {
  const d = pl.date instanceof Date ? pl.date : new Date(pl.date)
  return `${d.getFullYear()}-${d.getMonth() + 1}`
}

/**
 * Margen de contribucion por categoria de ingreso: a cada ingreso se le resta el coste
 * directamente atribuible.
 * - Cuotas: tarifa mensual del coach del grupo (`ratePerGroupAdults/Minors`), cobrada una
 *   vez por cada par (grupo, mes) con ingreso dentro del periodo (no una vez por pago, para
 *   no infravalorar el coste en periodos de varios meses).
 * - Eventos: `event.expenses` mas la comision del coach via `calculateEventSalary`.
 * - Clases particulares: comision del coach via `calculatePrivateLessonSalary`.
 */
export function contributionMarginByCategory(
  payments: NormalizedPayment[],
  groups: Group[],
  coachSalaryConfigs: CoachSalaryConfig[],
  events: AcademyEvent[],
  eventPayments: EventPayment[],
  privateLessons: PrivateLesson[],
  privateLessonPayments: PrivateLessonPayment[],
  monthKeys: Set<string>
): MarginByCategory {
  // Cuotas: coste del coach cobrado una vez por cada (grupo, mes) con ingreso.
  const cuotaByGroupMonth = new Map<string, number>()
  for (const p of payments) {
    if (!isPaidInPeriod(p, monthKeys)) continue
    if (p.source !== 'cuota' && p.source !== 'manual') continue
    if (!p.groupId) continue
    const key = `${p.groupId}|${monthKeyOf(p)}`
    cuotaByGroupMonth.set(key, (cuotaByGroupMonth.get(key) ?? 0) + p.amount)
  }
  let cuotaRevenue = 0
  let cuotaCost = 0
  for (const [key, revenue] of cuotaByGroupMonth) {
    cuotaRevenue += revenue
    const groupId = key.split('|')[0]
    const group = groups.find(g => g.id === groupId)
    if (!group) continue
    const config = coachSalaryConfigs.find(c => c.coachId === group.coachId)
    if (!config) continue
    cuotaCost += group.level === 'menores' ? (config.ratePerGroupMinors || 0) : (config.ratePerGroupAdults || 0)
  }

  // Eventos: ingreso pagado del evento, menos gastos y comision del coach.
  let eventRevenue = 0
  let eventCost = 0
  for (const ev of events) {
    if (!monthKeys.has(eventMonthKey(ev))) continue
    const revenue = eventPayments
      .filter(ep => ep.eventId === ev.id && ep.status === 'pagado')
      .reduce((s, ep) => s + ep.amount, 0)
    eventRevenue += revenue
    eventCost += (ev.expenses ?? []).reduce((s, ex) => s + ex.amount, 0)
    for (const coachId of ev.coachIds) {
      const config = coachSalaryConfigs.find(c => c.coachId === coachId)
      if (config) eventCost += calculateEventSalary(ev, eventPayments, config)
    }
  }

  // Clases particulares: ingreso pagado de la clase, menos comision del coach.
  let lessonRevenue = 0
  let lessonCost = 0
  for (const pl of privateLessons) {
    if (!monthKeys.has(lessonMonthKey(pl))) continue
    const revenue = privateLessonPayments
      .filter(lp => lp.lessonId === pl.id && lp.status === 'pagado')
      .reduce((s, lp) => s + lp.amount, 0)
    lessonRevenue += revenue
    const config = coachSalaryConfigs.find(c => c.coachId === pl.coachId)
    if (config) lessonCost += calculatePrivateLessonSalary(pl, config)
  }

  return {
    cuotas: toMargin(cuotaRevenue, cuotaCost),
    eventos: toMargin(eventRevenue, eventCost),
    clases: toMargin(lessonRevenue, lessonCost),
  }
}
