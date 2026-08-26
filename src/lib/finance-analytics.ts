import type { NormalizedPayment } from '@/lib/payment-utils'
import type {
  AcademyEvent,
  ClubTransaction,
  CoachSalaryConfig,
  EventPayment,
  Group,
  Player,
  PlayerLevel,
  PrivateLesson,
  PrivateLessonPayment,
  TransactionCategory,
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
  otros: number
  total: number
}

/** Ingresos pagados dentro de `monthKeys`, agrupados por origen (cuota+manual, evento, clase particular, otro). */
export function revenueByOrigin(payments: NormalizedPayment[], monthKeys: Set<string>): RevenueByOrigin {
  const result: RevenueByOrigin = { cuotas: 0, eventos: 0, clases: 0, otros: 0, total: 0 }
  for (const p of payments) {
    if (!isPaidInPeriod(p, monthKeys)) continue
    if (p.source === 'cuota' || p.source === 'manual') result.cuotas += p.amount
    else if (p.source === 'evento') result.eventos += p.amount
    else if (p.source === 'clase_particular') result.clases += p.amount
    else if (p.source === 'otro') result.otros += p.amount
  }
  result.total = result.cuotas + result.eventos + result.clases + result.otros
  return result
}

export interface RevenueByAgeGroup {
  adultos: number
  menores: number
}

/**
 * Ingresos pagados dentro de `monthKeys`, agrupados por franja de edad.
 * Las cuotas de grupo se clasifican por `Group.level === 'menores'` (mismo criterio que
 * la nomina de entrenadores); eventos, clases particulares y pagos de source 'otro'
 * (p. ej. recargos de devolucion SEPA), al no estar ligados a un grupo normalmente,
 * se clasifican por `Player.isMinor` del jugador que paga. Se incluyen los 5 origenes
 * posibles de `NormalizedPayment.source` para que el total (adultos + menores) siga
 * siendo reconciliable con `revenueByOrigin(...).total`.
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
    if (
      p.source !== 'cuota' &&
      p.source !== 'manual' &&
      p.source !== 'evento' &&
      p.source !== 'clase_particular' &&
      p.source !== 'otro'
    )
      continue

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

function dateToMonthKey(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date)
  return `${d.getFullYear()}-${d.getMonth() + 1}`
}

export interface ContributionMarginInput {
  payments: NormalizedPayment[]
  groups: Group[]
  coachSalaryConfigs: CoachSalaryConfig[]
  events: AcademyEvent[]
  eventPayments: EventPayment[]
  privateLessons: PrivateLesson[]
  privateLessonPayments: PrivateLessonPayment[]
  monthKeys: Set<string>
}

/**
 * Margen de contribucion por categoria de ingreso: a cada ingreso se le resta el coste
 * directamente atribuible.
 * - Cuotas: tarifa mensual del coach del grupo (`ratePerGroupAdults/Minors`), cobrada una
 *   vez por cada par (grupo, mes) con ingreso dentro del periodo (no una vez por pago, para
 *   no infravalorar el coste en periodos de varios meses).
 * - Eventos: `event.expenses` mas la comision del coach via `calculateEventSalary`.
 * - Clases particulares: comision del coach via `calculatePrivateLessonSalary`.
 *
 * Limitacion conocida: si un grupo/entrenador no tiene `CoachSalaryConfig` (o un pago de
 * cuota referencia un `groupId` que ya no existe en `groups`), ese coste se trata como 0 en
 * vez de excluir el ingreso — el margen mostrado puede ser optimista si la configuracion de
 * nominas esta incompleta. No se corrige aqui; queda como limitacion aceptada por ahora.
 */
export function contributionMarginByCategory(input: ContributionMarginInput): MarginByCategory {
  const {
    payments,
    groups,
    coachSalaryConfigs,
    events,
    eventPayments,
    privateLessons,
    privateLessonPayments,
    monthKeys,
  } = input

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
    if (!monthKeys.has(dateToMonthKey(ev.date))) continue
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
    if (!monthKeys.has(dateToMonthKey(pl.date))) continue
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

export interface CostStructure {
  fixed: number
  variable: number
  total: number
  fixedPct: number
  variablePct: number
}

const FIXED_COST_CATEGORIES = new Set<TransactionCategory>(['alquiler', 'suministros', 'limpieza', 'publicidad'])

/**
 * Estructura de costes (gastos) dentro de `monthKeys`, dividida en fijos y variables.
 * Fijos: alquiler, suministros, limpieza, publicidad. Variables: nomina, material,
 * reparaciones, otro. La nomina se clasifica como variable porque en este club los
 * entrenadores cobran por grupo/clase/evento en vez de un salario fijo, y ya se descuenta
 * como coste directo en `contributionMarginByCategory`.
 */
export function costStructure(clubTransactions: ClubTransaction[], monthKeys: Set<string>): CostStructure {
  let fixed = 0
  let variable = 0
  for (const t of clubTransactions) {
    if (t.type !== 'gasto') continue
    if (!monthKeys.has(dateToMonthKey(t.date))) continue
    if (FIXED_COST_CATEGORIES.has(t.category)) fixed += t.amount
    else variable += t.amount
  }
  const total = fixed + variable
  return {
    fixed,
    variable,
    total,
    fixedPct: total > 0 ? (fixed / total) * 100 : 0,
    variablePct: total > 0 ? (variable / total) * 100 : 0,
  }
}

export interface BreakEvenPoint {
  studentsNeeded: number
  actualStudents: number
  marginStudents: number
}

/**
 * Alumnos de cuota necesarios para cubrir `fixedCosts`, dado el margen medio por alumno.
 * Devuelve `Infinity` (no `null`, a diferencia de `pctChange`) cuando el margen medio es 0
 * o negativo, para que `marginStudents` siga siendo una resta valida (`-Infinity`) en vez
 * de requerir un guard adicional antes de esa aritmetica.
 */
export function breakEvenPoint(
  fixedCosts: number,
  avgMarginPerStudent: number,
  activeEnrollmentCount: number
): BreakEvenPoint {
  const studentsNeeded = avgMarginPerStudent > 0 ? Math.ceil(fixedCosts / avgMarginPerStudent) : Infinity
  return {
    studentsNeeded,
    actualStudents: activeEnrollmentCount,
    marginStudents: activeEnrollmentCount - studentsNeeded,
  }
}

export interface DebtorSummary {
  playerId: string
  playerName: string
  pendingAmount: number
  pendingCount: number
}

export interface CollectionStats {
  paidAmount: number
  pendingAmount: number
  cancelledAmount: number
  collectionRate: number
  topDebtors: DebtorSummary[]
}

/**
 * Estadisticas de cobro dentro de `monthKeys`: importes pagado, pendiente y cancelado,
 * tasa de cobro (pagado / total generado) y el top 5 de jugadores con mas importe pendiente.
 */
export function collectionStats(payments: NormalizedPayment[], monthKeys: Set<string>): CollectionStats {
  let paidAmount = 0
  let pendingAmount = 0
  let cancelledAmount = 0
  const debtors = new Map<string, DebtorSummary>()

  for (const p of payments) {
    if (!monthKeys.has(monthKeyOf(p))) continue
    if (p.status === 'pagado') {
      paidAmount += p.amount
    } else if (p.status === 'pendiente') {
      pendingAmount += p.amount
      const existing = debtors.get(p.playerId)
      if (existing) {
        existing.pendingAmount += p.amount
        existing.pendingCount += 1
      } else {
        debtors.set(p.playerId, {
          playerId: p.playerId,
          playerName: p.playerName,
          pendingAmount: p.amount,
          pendingCount: 1,
        })
      }
    } else if (p.status === 'cancelado') {
      cancelledAmount += p.amount
    }
  }

  const generated = paidAmount + pendingAmount + cancelledAmount
  const collectionRate = generated > 0 ? (paidAmount / generated) * 100 : 0
  const topDebtors = Array.from(debtors.values())
    .sort((a, b) => b.pendingAmount - a.pendingAmount)
    .slice(0, 5)

  return { paidAmount, pendingAmount, cancelledAmount, collectionRate, topDebtors }
}
