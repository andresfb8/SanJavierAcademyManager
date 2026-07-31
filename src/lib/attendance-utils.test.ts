import { describe, it, expect } from 'vitest'
import { getMyAttendanceForMonth } from '@/lib/attendance-utils'
import type { AttendanceRecord } from '@/types'

function makeRecord(overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: 'r1',
    groupId: 'g1',
    groupName: 'Grupo Intermedio',
    date: new Date('2026-07-10T10:00:00'),
    records: [
      { playerId: 'p1', playerName: 'Ana', status: 'presente', isRecovery: false },
    ],
    coachId: 'c1',
    createdAt: new Date('2026-07-10T10:00:00'),
    ...overrides,
  }
}

describe('getMyAttendanceForMonth', () => {
  it('incluye un registro del alumno en el mes/año pedidos', () => {
    const rows = getMyAttendanceForMonth([makeRecord()], 'p1', 7, 2026)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      recordId: 'r1',
      groupName: 'Grupo Intermedio',
      status: 'presente',
    })
  })

  it('ignora registros de otro mes', () => {
    const rows = getMyAttendanceForMonth([makeRecord()], 'p1', 8, 2026)
    expect(rows).toHaveLength(0)
  })

  it('ignora registros de otro año', () => {
    const rows = getMyAttendanceForMonth([makeRecord()], 'p1', 7, 2025)
    expect(rows).toHaveLength(0)
  })

  it('ignora registros donde el alumno no participó', () => {
    const record = makeRecord({
      records: [{ playerId: 'otro', playerName: 'Luis', status: 'presente', isRecovery: false }],
    })
    const rows = getMyAttendanceForMonth([record], 'p1', 7, 2026)
    expect(rows).toHaveLength(0)
  })

  it('incluye recuperaciones en grupos donde el alumno no está matriculado', () => {
    const record = makeRecord({
      groupId: 'otro-grupo',
      groupName: 'Grupo Avanzado',
      records: [{ playerId: 'p1', playerName: 'Ana', status: 'presente', isRecovery: true }],
    })
    const rows = getMyAttendanceForMonth([record], 'p1', 7, 2026)
    expect(rows).toHaveLength(1)
    expect(rows[0].groupName).toBe('Grupo Avanzado')
  })

  it('ordena de más reciente a más antiguo', () => {
    const older = makeRecord({ id: 'r-old', date: new Date('2026-07-02T10:00:00') })
    const newer = makeRecord({ id: 'r-new', date: new Date('2026-07-20T10:00:00') })
    const rows = getMyAttendanceForMonth([older, newer], 'p1', 7, 2026)
    expect(rows.map((r) => r.recordId)).toEqual(['r-new', 'r-old'])
  })

  it('acepta date como string ISO (rehidratado de localStorage)', () => {
    const record = makeRecord({ date: '2026-07-15T10:00:00' as unknown as Date })
    const rows = getMyAttendanceForMonth([record], 'p1', 7, 2026)
    expect(rows).toHaveLength(1)
  })

  it('devuelve vacío si no hay registros', () => {
    expect(getMyAttendanceForMonth([], 'p1', 7, 2026)).toEqual([])
  })
})
