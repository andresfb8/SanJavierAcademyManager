// src/lib/metric-aggregation.test.ts
import { describe, it, expect } from 'vitest'
import { aggregateSnapshots } from '@/lib/metric-aggregation'
import type { MetricSnapshot } from '@/types'

function makeSnapshot(overrides: Partial<MetricSnapshot> = {}): MetricSnapshot {
  return {
    id: 'club-1_2026-06',
    clubId: 'club-1',
    year: 2026,
    month: 6,
    generatedAt: new Date('2026-07-01'),
    generatedBy: 'scheduled',
    revenueByGroup: { 'g1': 100 },
    groupNames: { g1: 'Grupo 1', g2: 'Grupo 2' },
    churnByGroup: { 'g1': 1 },
    newPlayersCount: 3,
    attendanceByDayOfWeek: { 1: 10, 3: 5 },
    paymentsGenerated: 10,
    paymentsPaid: 8,
    underutilizedSlotsCount: 4,
    atRiskPlayersCount: 2,
    avgReviewQuality: 4.0,
    coachStats: [{ coachId: 'c1', coachName: 'Ana', rph: 40, retentionPct: 80, hours: 10 }],
    ...overrides,
  }
}

describe('aggregateSnapshots', () => {
  it('con un solo snapshot, devuelve sus valores tal cual', () => {
    const result = aggregateSnapshots([makeSnapshot()])
    expect(result.mostProfitableGroup).toEqual({ groupId: 'g1', groupName: 'Grupo 1', revenue: 100 })
    expect(result.newPlayersCount).toBe(3)
    expect(result.underutilizedSlotsCount).toBe(4)
  })

  it('suma los ingresos por grupo entre varios meses y recalcula el ganador', () => {
    const s1 = makeSnapshot({ revenueByGroup: { g1: 100, g2: 50 } })
    const s2 = makeSnapshot({ revenueByGroup: { g1: 20, g2: 200 } })
    const result = aggregateSnapshots([s1, s2])
    // g1: 120, g2: 250 -> gana g2 en el trimestre, aunque g1 ganara el primer mes
    expect(result.mostProfitableGroup).toEqual({ groupId: 'g2', groupName: 'Grupo 2', revenue: 250 })
  })

  it('suma alumnos nuevos entre meses', () => {
    const s1 = makeSnapshot({ newPlayersCount: 3 })
    const s2 = makeSnapshot({ newPlayersCount: 5 })
    const result = aggregateSnapshots([s1, s2])
    expect(result.newPlayersCount).toBe(8)
  })

  it('suma asistencia por dia de la semana y recalcula el dia con mas asistencia', () => {
    const s1 = makeSnapshot({ attendanceByDayOfWeek: { 1: 10, 3: 5 } })
    const s2 = makeSnapshot({ attendanceByDayOfWeek: { 1: 2, 3: 20 } })
    const result = aggregateSnapshots([s1, s2])
    // dia 1: 12, dia 3: 25 -> gana el 3 en el trimestre
    expect(result.bestDayOfWeek).toBe(3)
  })

  it('calcula la tasa de cobro sobre el total de pagos generados/pagados, no promediando porcentajes', () => {
    const s1 = makeSnapshot({ paymentsGenerated: 10, paymentsPaid: 10 }) // 100%
    const s2 = makeSnapshot({ paymentsGenerated: 90, paymentsPaid: 0 })  // 0%
    const result = aggregateSnapshots([s1, s2])
    // promedio simple de 100%/0% seria 50%, pero el correcto es 10/100 = 10%
    expect(result.collectionRatePct).toBe(10)
  })

  it('promedia las metricas de estado (franjas infrautilizadas, calidad, retencion, €/h)', () => {
    const s1 = makeSnapshot({ underutilizedSlotsCount: 4, avgReviewQuality: 4.0 })
    const s2 = makeSnapshot({ underutilizedSlotsCount: 8, avgReviewQuality: 3.0 })
    const result = aggregateSnapshots([s1, s2])
    expect(result.underutilizedSlotsCount).toBe(6)
    expect(result.avgReviewQuality).toBe(3.5)
  })

  it('ignora avgReviewQuality nulo al promediar en vez de tratarlo como 0', () => {
    const s1 = makeSnapshot({ avgReviewQuality: 4.0 })
    const s2 = makeSnapshot({ avgReviewQuality: null })
    const result = aggregateSnapshots([s1, s2])
    expect(result.avgReviewQuality).toBe(4.0)
  })

  it('promedia rph/retentionPct/hours por coach a traves de los snapshots', () => {
    const s1 = makeSnapshot({ coachStats: [{ coachId: 'c1', coachName: 'Ana', rph: 40, retentionPct: 80, hours: 10 }] })
    const s2 = makeSnapshot({ coachStats: [{ coachId: 'c1', coachName: 'Ana', rph: 60, retentionPct: 60, hours: 20 }] })
    const result = aggregateSnapshots([s1, s2])
    const ana = result.coachStats.find(c => c.coachId === 'c1')
    expect(ana).toMatchObject({ rph: 50, retentionPct: 70, hours: 15 })
  })

  it('devuelve null en mostProfitableGroup si no hay ingresos en ningun mes', () => {
    const result = aggregateSnapshots([makeSnapshot({ revenueByGroup: {} })])
    expect(result.mostProfitableGroup).toBeNull()
  })
})
