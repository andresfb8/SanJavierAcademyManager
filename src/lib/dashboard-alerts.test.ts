import { describe, it, expect } from 'vitest'
import { pendingPaymentAlerts, highAbsenceGroupAlerts } from '@/lib/dashboard-alerts'
import type { NormalizedPayment } from '@/lib/payment-utils'
import type { AttendanceRecord, Group } from '@/types'

function makePayment(overrides: Partial<NormalizedPayment> = {}): NormalizedPayment {
  return {
    id: 'pay1',
    source: 'cuota',
    playerId: 'p1',
    playerName: 'Jugador',
    concept: 'Cuota',
    amount: 100,
    status: 'pendiente',
    billingMonth: 8,
    billingYear: 2026,
    ...overrides,
  }
}

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 'g1',
    name: 'Grupo 1',
    level: 'intermedio',
    coachId: 'c1',
    coachName: 'Coach',
    courtId: 'ct1',
    courtName: 'Pista 1',
    schedule: [],
    maxCapacity: 8,
    currentEnrollment: 4,
    defaultTariffId: 't1',
    defaultTariffPrice: 50,
    billingFrequency: 'monthly',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    isActive: true,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  }
}

function makeAttendanceRecord(overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: 'a1',
    groupId: 'g1',
    groupName: 'Grupo 1',
    date: new Date('2026-08-10'),
    records: [],
    coachId: 'c1',
    createdAt: new Date('2026-08-10'),
    ...overrides,
  }
}

describe('pendingPaymentAlerts', () => {
  it('agrupa pagos pendientes por jugador y filtra por minPendingCount', () => {
    const payments: NormalizedPayment[] = [
      makePayment({ id: 'a', playerId: 'p1', playerName: 'Ana', amount: 50 }),
      makePayment({ id: 'b', playerId: 'p1', playerName: 'Ana', amount: 30 }),
      makePayment({ id: 'c', playerId: 'p2', playerName: 'Bea', amount: 200 }),
    ]
    const result = pendingPaymentAlerts(payments, 2)
    expect(result).toEqual([
      { playerId: 'p1', playerName: 'Ana', pendingCount: 2, pendingAmount: 80 },
    ])
  })

  it('ignora pagos que no esten pendientes', () => {
    const payments: NormalizedPayment[] = [
      makePayment({ id: 'a', playerId: 'p1', status: 'pagado' }),
      makePayment({ id: 'b', playerId: 'p1', status: 'pendiente' }),
    ]
    expect(pendingPaymentAlerts(payments, 2)).toEqual([])
  })

  it('ordena por pendingCount desc, empate por pendingAmount desc', () => {
    const payments: NormalizedPayment[] = [
      makePayment({ id: 'a', playerId: 'p1', playerName: 'Ana', amount: 100 }),
      makePayment({ id: 'b', playerId: 'p1', playerName: 'Ana', amount: 100 }),
      makePayment({ id: 'c', playerId: 'p2', playerName: 'Bea', amount: 50 }),
      makePayment({ id: 'd', playerId: 'p2', playerName: 'Bea', amount: 50 }),
      makePayment({ id: 'e', playerId: 'p3', playerName: 'Caro', amount: 40 }),
      makePayment({ id: 'f', playerId: 'p3', playerName: 'Caro', amount: 40 }),
      makePayment({ id: 'g', playerId: 'p3', playerName: 'Caro', amount: 40 }),
    ]
    const result = pendingPaymentAlerts(payments, 2)
    expect(result.map(r => r.playerId)).toEqual(['p3', 'p1', 'p2'])
  })

  it('usa minPendingCount=2 por defecto', () => {
    const payments: NormalizedPayment[] = [
      makePayment({ id: 'a', playerId: 'p1', playerName: 'Ana' }),
    ]
    expect(pendingPaymentAlerts(payments)).toEqual([])
  })
})

describe('highAbsenceGroupAlerts', () => {
  it('calcula la tasa de ausencia por grupo y filtra por minRate', () => {
    const groups = [makeGroup({ id: 'g1', name: 'Iniciación A' })]
    const attendance: AttendanceRecord[] = [
      makeAttendanceRecord({
        groupId: 'g1',
        date: new Date('2026-08-10'),
        records: [
          { playerId: 'p1', playerName: 'Ana', status: 'ausente', isRecovery: false },
          { playerId: 'p2', playerName: 'Bea', status: 'ausente', isRecovery: false },
          { playerId: 'p3', playerName: 'Caro', status: 'presente', isRecovery: false },
        ],
      }),
    ]
    const result = highAbsenceGroupAlerts(attendance, groups, 8, 2026, { minRate: 0.3, minRecords: 3 })
    expect(result).toEqual([
      { groupId: 'g1', groupName: 'Iniciación A', absenceRate: 2 / 3, recordCount: 3 },
    ])
  })

  it('excluye grupos con menos registros que minRecords', () => {
    const groups = [makeGroup({ id: 'g1' })]
    const attendance: AttendanceRecord[] = [
      makeAttendanceRecord({
        groupId: 'g1',
        date: new Date('2026-08-10'),
        records: [
          { playerId: 'p1', playerName: 'Ana', status: 'ausente', isRecovery: false },
          { playerId: 'p2', playerName: 'Bea', status: 'ausente', isRecovery: false },
        ],
      }),
    ]
    expect(highAbsenceGroupAlerts(attendance, groups, 8, 2026, { minRate: 0.3, minRecords: 3 })).toEqual([])
  })

  it('ignora registros fuera del mes/año dados', () => {
    const groups = [makeGroup({ id: 'g1' })]
    const attendance: AttendanceRecord[] = [
      makeAttendanceRecord({
        groupId: 'g1',
        date: new Date('2026-07-10'),
        records: [
          { playerId: 'p1', playerName: 'Ana', status: 'ausente', isRecovery: false },
          { playerId: 'p2', playerName: 'Bea', status: 'ausente', isRecovery: false },
          { playerId: 'p3', playerName: 'Caro', status: 'ausente', isRecovery: false },
        ],
      }),
    ]
    expect(highAbsenceGroupAlerts(attendance, groups, 8, 2026)).toEqual([])
  })

  it('solo cuenta status "ausente" como ausencia, no "justificado"', () => {
    const groups = [makeGroup({ id: 'g1' })]
    const attendance: AttendanceRecord[] = [
      makeAttendanceRecord({
        groupId: 'g1',
        date: new Date('2026-08-10'),
        records: [
          { playerId: 'p1', playerName: 'Ana', status: 'justificado', isRecovery: false },
          { playerId: 'p2', playerName: 'Bea', status: 'justificado', isRecovery: false },
          { playerId: 'p3', playerName: 'Caro', status: 'presente', isRecovery: false },
        ],
      }),
    ]
    expect(highAbsenceGroupAlerts(attendance, groups, 8, 2026, { minRate: 0.3, minRecords: 3 })).toEqual([])
  })

  it('usa minRate=0.3 y minRecords=3 por defecto', () => {
    const groups = [makeGroup({ id: 'g1', name: 'Grupo Test' })]
    const attendance: AttendanceRecord[] = [
      makeAttendanceRecord({
        groupId: 'g1',
        date: new Date('2026-08-10'),
        records: [
          { playerId: 'p1', playerName: 'Ana', status: 'ausente', isRecovery: false },
          { playerId: 'p2', playerName: 'Bea', status: 'presente', isRecovery: false },
          { playerId: 'p3', playerName: 'Caro', status: 'presente', isRecovery: false },
          { playerId: 'p4', playerName: 'Dana', status: 'presente', isRecovery: false },
        ],
      }),
    ]
    expect(highAbsenceGroupAlerts(attendance, groups, 8, 2026)).toEqual([])
  })
})
