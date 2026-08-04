import type { MetricSnapshot } from '@/types'

export interface AggregatedMetrics {
  mostProfitableGroup: { groupId: string; groupName: string; revenue: number } | null
  mostChurnGroup: { groupId: string; groupName: string; count: number } | null
  newPlayersCount: number
  bestDayOfWeek: number | null
  bestDayCount: number
  collectionRatePct: number | null
  paymentsGenerated: number
  paymentsPaid: number
  underutilizedSlotsCount: number
  atRiskPlayersCount: number
  avgReviewQuality: number | null
  coachStats: Array<{
    coachId: string
    coachName: string
    rph: number
    retentionPct: number | null
    hours: number
  }>
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/**
 * Combina 1 (mes) o 3 (trimestre) MetricSnapshot en una unica vista agregada.
 * Las metricas acumulables se suman y se recalcula el "ganador" sobre el
 * total; las metricas de estado se promedian. Puro, sin dependencias de
 * React ni del store, para poder testearse de forma aislada.
 */
export function aggregateSnapshots(snapshots: MetricSnapshot[]): AggregatedMetrics {
  // ── Grupo mas rentable (suma de revenueByGroup) ───────────────────
  const revenueByGroup: Record<string, number> = {}
  const groupNames: Record<string, string> = {}
  snapshots.forEach(s => {
    Object.assign(groupNames, s.groupNames)
    Object.entries(s.revenueByGroup).forEach(([groupId, amount]) => {
      revenueByGroup[groupId] = (revenueByGroup[groupId] ?? 0) + amount
    })
  })
  const revenueEntries = Object.entries(revenueByGroup).sort((a, b) => b[1] - a[1])
  const mostProfitableGroup = revenueEntries.length > 0
    ? { groupId: revenueEntries[0][0], groupName: groupNames[revenueEntries[0][0]] ?? 'Grupo desconocido', revenue: revenueEntries[0][1] }
    : null

  // ── Grupo con mas bajas (suma de churnByGroup) ────────────────────
  const churnByGroup: Record<string, number> = {}
  snapshots.forEach(s => {
    Object.entries(s.churnByGroup).forEach(([groupId, count]) => {
      churnByGroup[groupId] = (churnByGroup[groupId] ?? 0) + count
    })
  })
  const churnEntries = Object.entries(churnByGroup).sort((a, b) => b[1] - a[1])
  const mostChurnGroup = churnEntries.length > 0
    ? { groupId: churnEntries[0][0], groupName: groupNames[churnEntries[0][0]] ?? 'Grupo desconocido', count: churnEntries[0][1] }
    : null

  // ── Alumnos nuevos (suma) ──────────────────────────────────────────
  const newPlayersCount = snapshots.reduce((sum, s) => sum + s.newPlayersCount, 0)

  // ── Dia con mas asistencia (suma de attendanceByDayOfWeek) ────────
  const attendanceByDay: Record<number, number> = {}
  snapshots.forEach(s => {
    Object.entries(s.attendanceByDayOfWeek).forEach(([dow, count]) => {
      const day = Number(dow)
      attendanceByDay[day] = (attendanceByDay[day] ?? 0) + count
    })
  })
  const dayEntries = Object.entries(attendanceByDay).sort((a, b) => b[1] - a[1])
  const bestDayOfWeek = dayEntries.length > 0 ? Number(dayEntries[0][0]) : null
  const bestDayCount = dayEntries.length > 0 ? dayEntries[0][1] : 0

  // ── Tasa de cobro (sobre el total generado/pagado, no promedio de %) ──
  const paymentsGenerated = snapshots.reduce((sum, s) => sum + s.paymentsGenerated, 0)
  const paymentsPaid = snapshots.reduce((sum, s) => sum + s.paymentsPaid, 0)
  const collectionRatePct = paymentsGenerated > 0 ? Math.round((paymentsPaid / paymentsGenerated) * 100) : null

  // ── Metricas de estado (promedio) ──────────────────────────────────
  const underutilizedSlotsCount = Math.round(average(snapshots.map(s => s.underutilizedSlotsCount)))
  const atRiskPlayersCount = Math.round(average(snapshots.map(s => s.atRiskPlayersCount)))
  const qualityValues = snapshots.map(s => s.avgReviewQuality).filter((v): v is number => v !== null)
  const avgReviewQuality = qualityValues.length > 0 ? Math.round(average(qualityValues) * 10) / 10 : null

  // ── Coaches: promedio de rph/retentionPct/hours por coachId ───────
  const coachAccum: Record<string, { coachName: string; rph: number[]; retentionPct: number[]; hours: number[] }> = {}
  snapshots.forEach(s => {
    s.coachStats.forEach(c => {
      if (!coachAccum[c.coachId]) coachAccum[c.coachId] = { coachName: c.coachName, rph: [], retentionPct: [], hours: [] }
      coachAccum[c.coachId].rph.push(c.rph)
      if (c.retentionPct !== null) coachAccum[c.coachId].retentionPct.push(c.retentionPct)
      coachAccum[c.coachId].hours.push(c.hours)
    })
  })
  const coachStats = Object.entries(coachAccum).map(([coachId, data]) => ({
    coachId,
    coachName: data.coachName,
    rph: Math.round(average(data.rph) * 100) / 100,
    retentionPct: data.retentionPct.length > 0 ? Math.round(average(data.retentionPct)) : null,
    hours: Math.round(average(data.hours) * 10) / 10,
  }))

  return {
    mostProfitableGroup,
    mostChurnGroup,
    newPlayersCount,
    bestDayOfWeek,
    bestDayCount,
    collectionRatePct,
    paymentsGenerated,
    paymentsPaid,
    underutilizedSlotsCount,
    atRiskPlayersCount,
    avgReviewQuality,
    coachStats,
  }
}
