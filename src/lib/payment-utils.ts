import type { Payment, EventPayment, PrivateLessonPayment, PaymentStatus, PaymentMethod } from '@/types'

// Tipo unificado para agregar todos los flujos de pago en un formato comun
export interface NormalizedPayment {
  id: string
  source: 'cuota' | 'evento' | 'clase_particular' | 'manual' | 'otro'
  playerId: string
  playerName: string
  concept: string
  amount: number
  status: PaymentStatus
  billingMonth: number
  billingYear: number
  paidDate?: Date
  paymentMethod?: PaymentMethod
  groupId?: string
  groupName?: string
  dueDate?: Date
  registeredBy?: string
}

/**
 * Normaliza los 3 tipos de pago del sistema en un array comun
 * para calculos financieros unificados (dashboard, estadisticas, etc.)
 */
export function normalizeAllPayments(
  payments: Payment[],
  eventPayments: EventPayment[],
  privateLessonPayments: PrivateLessonPayment[],
): NormalizedPayment[] {
  const normalized: NormalizedPayment[] = []

  // Cuotas y pagos manuales de grupo
  for (const p of payments) {
    normalized.push({
      id: p.id,
      source: (p.category as NormalizedPayment['source']) ?? 'cuota',
      playerId: p.playerId,
      playerName: p.playerName,
      concept: p.concept,
      amount: p.amount,
      status: p.status,
      billingMonth: p.billingMonth,
      billingYear: p.billingYear,
      paidDate: p.paidDate,
      paymentMethod: p.paymentMethod,
      groupId: p.groupId,
      groupName: p.groupName,
      dueDate: p.dueDate,
      registeredBy: p.registeredBy,
    })
  }

  // Pagos de eventos
  for (const ep of eventPayments) {
    let d: Date
    const refDate = ep.paidDate ?? ep.createdAt
    if (refDate instanceof Date) {
      d = refDate
    } else if (typeof refDate === 'string') {
      d = new Date(refDate)
    } else {
      d = new Date() // Fallback seguro
    }

    // Ensure valid date
    if (isNaN(d.getTime())) d = new Date()

    normalized.push({
      id: ep.id,
      source: 'evento',
      playerId: ep.playerId,
      playerName: ep.playerName,
      concept: ep.eventName,
      amount: ep.amount,
      status: ep.status,
      billingMonth: d.getMonth() + 1,
      billingYear: d.getFullYear(),
      paidDate: ep.paidDate,
      paymentMethod: ep.paymentMethod,
      registeredBy: ep.registeredBy,
    })
  }

  // Pagos de clases particulares
  for (const plp of privateLessonPayments) {
    let d: Date
    const refDate = plp.lessonDate
    if (refDate instanceof Date) {
      d = refDate
    } else if (typeof refDate === 'string') {
      d = new Date(refDate)
    } else {
      d = new Date() // Fallback seguro
    }

    // Ensure valid date
    if (isNaN(d.getTime())) d = new Date()

    normalized.push({
      id: plp.id,
      source: 'clase_particular',
      playerId: plp.playerId,
      playerName: plp.playerName,
      concept: `Clase particular (${d.toLocaleDateString('es-ES')})`,
      amount: plp.amount,
      status: plp.status,
      billingMonth: d.getMonth() + 1,
      billingYear: d.getFullYear(),
      paidDate: plp.paidDate,
      paymentMethod: plp.paymentMethod,
      registeredBy: plp.registeredBy,
    })
  }

  return normalized
}
