import type { NormalizedPayment } from '@/lib/payment-utils'
import type { AttendanceRecord, Group } from '@/types'

export interface PendingPaymentAlert {
  playerId: string
  playerName: string
  pendingCount: number
  pendingAmount: number
}

export interface HighAbsenceGroupAlert {
  groupId: string
  groupName: string
  absenceRate: number
  recordCount: number
}

/**
 * Jugadores con `minPendingCount` o mas recibos en estado 'pendiente', ordenados de mayor a
 * menor numero de recibos pendientes (empate: mayor importe pendiente primero).
 */
export function pendingPaymentAlerts(
  payments: NormalizedPayment[],
  minPendingCount = 2
): PendingPaymentAlert[] {
  const byPlayer = new Map<string, PendingPaymentAlert>()

  for (const p of payments) {
    if (p.status !== 'pendiente') continue
    const existing = byPlayer.get(p.playerId)
    if (existing) {
      existing.pendingCount += 1
      existing.pendingAmount += p.amount
    } else {
      byPlayer.set(p.playerId, {
        playerId: p.playerId,
        playerName: p.playerName,
        pendingCount: 1,
        pendingAmount: p.amount,
      })
    }
  }

  return Array.from(byPlayer.values())
    .filter(a => a.pendingCount >= minPendingCount)
    .sort((a, b) => b.pendingCount - a.pendingCount || b.pendingAmount - a.pendingAmount)
}

interface HighAbsenceGroupOptions {
  minRate?: number
  minRecords?: number
}

/**
 * Grupos cuya tasa de ausencia (registros con status 'ausente' / total de registros de
 * asistencia del grupo en el mes dado) alcanza `minRate`, exigiendo al menos `minRecords`
 * registros totales para evitar falsos positivos con datos escasos. Solo cuenta 'ausente' como
 * ausencia (no 'justificado'), igual criterio que `atRiskPlayers` en IntelligenceCards.tsx.
 */
export function highAbsenceGroupAlerts(
  attendance: AttendanceRecord[],
  groups: Group[],
  month: number,
  year: number,
  { minRate = 0.3, minRecords = 3 }: HighAbsenceGroupOptions = {}
): HighAbsenceGroupAlert[] {
  const totals = new Map<string, { absences: number; total: number }>()

  for (const record of attendance) {
    const d = record.date instanceof Date ? record.date : new Date(record.date)
    if (d.getMonth() + 1 !== month || d.getFullYear() !== year) continue

    const entry = totals.get(record.groupId) ?? { absences: 0, total: 0 }
    for (const r of record.records) {
      entry.total += 1
      if (r.status === 'ausente') entry.absences += 1
    }
    totals.set(record.groupId, entry)
  }

  const result: HighAbsenceGroupAlert[] = []
  for (const [groupId, { absences, total }] of totals) {
    if (total < minRecords) continue
    const absenceRate = absences / total
    if (absenceRate < minRate) continue
    const group = groups.find(g => g.id === groupId)
    result.push({
      groupId,
      groupName: group?.name ?? 'Grupo desconocido',
      absenceRate,
      recordCount: total,
    })
  }

  return result.sort((a, b) => b.absenceRate - a.absenceRate)
}
