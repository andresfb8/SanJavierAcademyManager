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

import {
  getSessionsForDate, isSessionHappeningNow, getGroupAttendanceByWeek,
} from '@/lib/attendance-utils'
import type { Group, PrivateLesson } from '@/types'

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 'group-1', name: 'Grupo Test', level: 'iniciacion',
    coachId: 'coach-1', coachName: 'Coach Uno', courtId: 'court-1', courtName: 'Pista 1',
    schedule: [{ dayOfWeek: 1, startTime: '18:00', endTime: '19:00' }],
    maxCapacity: 4, currentEnrollment: 2,
    defaultTariffId: 'tariff-1', defaultTariffPrice: 50, billingFrequency: 'monthly',
    startDate: new Date(2026, 0, 1), endDate: new Date(2026, 11, 31),
    isActive: true, createdAt: new Date(2026, 0, 1),
    ...overrides,
  }
}

function makeLesson(overrides: Partial<PrivateLesson> = {}): PrivateLesson {
  return {
    id: 'lesson-1', playerIds: ['p1'], playerNames: ['Jugador Uno'],
    coachId: 'coach-1', coachName: 'Coach Uno', courtId: 'court-1', courtName: 'Pista 1',
    date: new Date(2026, 2, 9), startTime: '20:00', endTime: '21:00',
    price: 30, isPaid: false, createdAt: new Date(2026, 2, 1),
    ...overrides,
  }
}

describe('getSessionsForDate', () => {
  // 9 marzo 2026 es Lunes.
  const monday = new Date(2026, 2, 9)

  it('incluye un grupo cuyo horario coincide con el dia de la semana', () => {
    const result = getSessionsForDate(monday, [makeGroup()], [], [])
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('group')
    expect(result[0].hasRecord).toBe(false)
  })

  it('marca hasRecord=true si ya existe un AttendanceRecord para ese grupo y fecha', () => {
    const attendance = [{
      id: 'att-1', groupId: 'group-1', groupName: 'Grupo Test', date: monday,
      records: [], coachId: 'coach-1', createdAt: monday,
    }] as any
    const result = getSessionsForDate(monday, [makeGroup()], [], attendance)
    expect(result[0].hasRecord).toBe(true)
  })

  it('incluye clases particulares de esa fecha, siempre con hasRecord=false', () => {
    const result = getSessionsForDate(monday, [], [makeLesson()], [])
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('private')
    expect(result[0].hasRecord).toBe(false)
    expect(result[0].name).toBe('Clase particular')
  })

  it('ordena las sesiones por hora de inicio', () => {
    const earlyGroup = makeGroup({ id: 'group-early', schedule: [{ dayOfWeek: 1, startTime: '09:00', endTime: '10:00' }] })
    const result = getSessionsForDate(monday, [makeGroup(), earlyGroup], [makeLesson()], [])
    expect(result.map((s) => s.startTime)).toEqual(['09:00', '18:00', '20:00'])
  })

  it('excluye un grupo cuyo horario no coincide con el dia de la semana', () => {
    const tuesdayGroup = makeGroup({ schedule: [{ dayOfWeek: 2, startTime: '18:00', endTime: '19:00' }] })
    const result = getSessionsForDate(monday, [tuesdayGroup], [], [])
    expect(result).toHaveLength(0)
  })
})

describe('isSessionHappeningNow', () => {
  it('es true si la hora actual cae dentro del rango', () => {
    const now = new Date(2026, 2, 9, 18, 30)
    expect(isSessionHappeningNow('18:00', '19:00', now)).toBe(true)
  })

  it('es false antes de que empiece', () => {
    const now = new Date(2026, 2, 9, 17, 59)
    expect(isSessionHappeningNow('18:00', '19:00', now)).toBe(false)
  })

  it('es false justo en la hora de fin (rango exclusivo al final)', () => {
    const now = new Date(2026, 2, 9, 19, 0)
    expect(isSessionHappeningNow('18:00', '19:00', now)).toBe(false)
  })
})

describe('getGroupAttendanceByWeek', () => {
  it('devuelve weeksBack puntos, en orden cronologico', () => {
    const result = getGroupAttendanceByWeek([], 'group-1', new Date(2026, 2, 9), 8)
    expect(result).toHaveLength(8)
  })

  it('rate es null cuando esa semana no tiene registros', () => {
    const result = getGroupAttendanceByWeek([], 'group-1', new Date(2026, 2, 9), 3)
    expect(result.every((p) => p.rate === null)).toBe(true)
  })

  it('calcula el porcentaje de presentes de la semana correcta', () => {
    const referenceDate = new Date(2026, 2, 9) // Lunes
    const attendance = [{
      id: 'att-1', groupId: 'group-1', groupName: 'G', date: referenceDate,
      records: [
        { playerId: 'p1', playerName: 'A', status: 'presente', isRecovery: false },
        { playerId: 'p2', playerName: 'B', status: 'ausente', isRecovery: false },
      ],
      coachId: 'coach-1', createdAt: referenceDate,
    }] as any
    const result = getGroupAttendanceByWeek(attendance, 'group-1', referenceDate, 1)
    expect(result).toHaveLength(1)
    expect(result[0].rate).toBe(50)
  })

  it('ignora registros de otro grupo', () => {
    const referenceDate = new Date(2026, 2, 9)
    const attendance = [{
      id: 'att-1', groupId: 'other-group', groupName: 'G', date: referenceDate,
      records: [{ playerId: 'p1', playerName: 'A', status: 'presente', isRecovery: false }],
      coachId: 'coach-1', createdAt: referenceDate,
    }] as any
    const result = getGroupAttendanceByWeek(attendance, 'group-1', referenceDate, 1)
    expect(result[0].rate).toBeNull()
  })
})
