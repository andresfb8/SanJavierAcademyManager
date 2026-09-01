import { describe, it, expect } from 'vitest'
import {
  getWeekStart, addDays, formatWeekLabel, timeToSlotIndex, isSameDay,
  computeBlocksByCourtForDate, START_HOUR,
} from '@/lib/agenda-utils'
import type { Group, PrivateLesson, AcademyEvent, Court, AttendanceRecord } from '@/types'

describe('getWeekStart', () => {
  it('siempre devuelve un Lunes', () => {
    for (let i = 0; i < 14; i++) {
      const d = new Date(2026, 0, 1 + i)
      expect(getWeekStart(d).getDay()).toBe(1)
    }
  })

  it('no avanza el dia si la fecha ya es Lunes, y resetea la hora a 00:00', () => {
    let probe = new Date(2026, 5, 1)
    while (probe.getDay() !== 1) probe.setDate(probe.getDate() + 1)
    const monday = new Date(probe)
    monday.setHours(15, 30, 0, 0)
    const result = getWeekStart(monday)
    expect(result.getDay()).toBe(1)
    expect(result.getDate()).toBe(monday.getDate())
    expect(result.getHours()).toBe(0)
  })

  it('retrocede como mucho 6 dias', () => {
    const d = new Date(2026, 3, 10)
    const result = getWeekStart(d)
    const diffDays = (d.getTime() - result.getTime()) / (1000 * 60 * 60 * 24)
    expect(diffDays).toBeGreaterThanOrEqual(0)
    expect(diffDays).toBeLessThan(7)
  })
})

describe('addDays', () => {
  it('suma dias', () => {
    const d = new Date(2026, 0, 1)
    expect(addDays(d, 5).getDate()).toBe(6)
  })

  it('resta dias con numeros negativos', () => {
    const d = new Date(2026, 0, 10)
    expect(addDays(d, -3).getDate()).toBe(7)
  })
})

describe('formatWeekLabel', () => {
  it('formatea el rango cuando ambos extremos caen en el mismo mes', () => {
    const start = new Date(2026, 7, 24)
    const end = new Date(2026, 7, 29)
    const month = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(end).replace('.', '')
    expect(formatWeekLabel(start, end)).toBe(`24 - 29 ${month}`)
  })

  it('formatea el rango cuando cruza de mes', () => {
    const start = new Date(2026, 7, 31)
    const end = new Date(2026, 8, 5)
    const startMonth = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(start).replace('.', '')
    const endMonth = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(end).replace('.', '')
    expect(formatWeekLabel(start, end)).toBe(`31 ${startMonth} - 5 ${endMonth}`)
  })
})

describe('timeToSlotIndex', () => {
  it('la hora de inicio de la grilla es el slot 0', () => {
    expect(timeToSlotIndex(`${String(START_HOUR).padStart(2, '0')}:00`)).toBe(0)
  })

  it('la media hora siguiente es el slot 1', () => {
    expect(timeToSlotIndex(`${String(START_HOUR).padStart(2, '0')}:30`)).toBe(1)
  })
})

describe('isSameDay', () => {
  it('es true para la misma fecha con horas distintas', () => {
    expect(isSameDay(new Date(2026, 2, 10, 8, 0), new Date(2026, 2, 10, 20, 0))).toBe(true)
  })

  it('es false para dias distintos', () => {
    expect(isSameDay(new Date(2026, 2, 10), new Date(2026, 2, 11))).toBe(false)
  })
})

// ==========================================
// Fixtures para computeBlocksByCourtForDate
// ==========================================

function makeCourt(overrides: Partial<Court> = {}): Court {
  return { id: 'court-1', name: 'Pista 1', type: 'indoor', surface: 'cristal', isActive: true, order: 1, ...overrides }
}

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 'group-1', name: 'Grupo Test', level: 'iniciacion',
    coachId: 'coach-1', coachName: 'Coach Uno', courtId: 'court-1', courtName: 'Pista 1',
    schedule: [{ dayOfWeek: 1, startTime: '09:00', endTime: '10:00' }],
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
    date: new Date(2026, 2, 9), startTime: '09:00', endTime: '10:00',
    price: 30, isPaid: false, createdAt: new Date(2026, 2, 1),
    ...overrides,
  }
}

function makeEvent(overrides: Partial<AcademyEvent> = {}): AcademyEvent {
  return {
    id: 'event-1', name: 'Torneo Test', type: 'mini_torneo',
    date: new Date(2026, 2, 9), startTime: '09:00', endTime: '11:00',
    courtIds: ['court-1'], courtNames: ['Pista 1'],
    coachIds: ['coach-1'], coachNames: ['Coach Uno'],
    attendeePlayerIds: [], attendeePlayerNames: [],
    price: 10, attendeePrices: {}, vatRate: 21, isActive: true,
    createdAt: new Date(2026, 2, 1),
    ...overrides,
  }
}

const noAttendance: AttendanceRecord[] = []

describe('computeBlocksByCourtForDate', () => {
  // 9 marzo 2026 es Lunes.
  const monday = new Date(2026, 2, 9)

  it('incluye un grupo cuyo horario coincide con el dia de la semana', () => {
    const result = computeBlocksByCourtForDate({
      date: monday, courts: [makeCourt()], groups: [makeGroup()],
      privateLessons: [], events: [], attendance: noAttendance,
    })
    expect(result['court-1']).toHaveLength(1)
    expect(result['court-1'][0].type).toBe('group')
  })

  it('excluye un grupo cuyo horario no coincide con el dia de la semana', () => {
    const tuesdayGroup = makeGroup({ schedule: [{ dayOfWeek: 2, startTime: '09:00', endTime: '10:00' }] })
    const result = computeBlocksByCourtForDate({
      date: monday, courts: [makeCourt()], groups: [tuesdayGroup],
      privateLessons: [], events: [], attendance: noAttendance,
    })
    expect(result['court-1']).toHaveLength(0)
  })

  it('excluye un grupo fuera de su rango de fechas', () => {
    const oldGroup = makeGroup({ startDate: new Date(2020, 0, 1), endDate: new Date(2020, 11, 31) })
    const result = computeBlocksByCourtForDate({
      date: monday, courts: [makeCourt()], groups: [oldGroup],
      privateLessons: [], events: [], attendance: noAttendance,
    })
    expect(result['court-1']).toHaveLength(0)
  })

  it('aplica coachFilter a grupos y particulares pero no a eventos', () => {
    const result = computeBlocksByCourtForDate({
      date: monday, courts: [makeCourt()],
      groups: [makeGroup({ coachId: 'other-coach' })],
      privateLessons: [makeLesson({ coachId: 'other-coach' })],
      events: [makeEvent({ coachIds: ['other-coach'], coachNames: ['Otro Coach'] })],
      attendance: noAttendance,
      coachFilter: 'coach-1',
    })
    const types = result['court-1'].map((b) => b.type)
    expect(types).toEqual(['event'])
  })

  it('aplica levelFilter solo a grupos', () => {
    const result = computeBlocksByCourtForDate({
      date: monday, courts: [makeCourt()],
      groups: [makeGroup({ level: 'avanzado' })],
      privateLessons: [makeLesson()],
      events: [],
      attendance: noAttendance,
      levelFilter: 'iniciacion',
    })
    expect(result['court-1']).toHaveLength(1)
    expect(result['court-1'][0].type).toBe('private')
  })

  it('un evento aparece en cada pista listada en courtIds', () => {
    const court2 = makeCourt({ id: 'court-2', name: 'Pista 2' })
    const result = computeBlocksByCourtForDate({
      date: monday, courts: [makeCourt(), court2],
      groups: [], privateLessons: [],
      events: [makeEvent({ courtIds: ['court-1', 'court-2'] })],
      attendance: noAttendance,
    })
    expect(result['court-1']).toHaveLength(1)
    expect(result['court-2']).toHaveLength(1)
  })

  it('calcula attendanceStats cuando hay un registro de asistencia para ese grupo y fecha', () => {
    const attendance: AttendanceRecord[] = [{
      id: 'att-1', groupId: 'group-1', groupName: 'Grupo Test', date: monday,
      records: [
        { playerId: 'p1', playerName: 'A', status: 'presente', isRecovery: false },
        { playerId: 'p2', playerName: 'B', status: 'ausente', isRecovery: false },
      ],
      coachId: 'coach-1', createdAt: monday,
    } as AttendanceRecord]
    const result = computeBlocksByCourtForDate({
      date: monday, courts: [makeCourt()], groups: [makeGroup()],
      privateLessons: [], events: [], attendance,
    })
    expect(result['court-1'][0].attendanceStats).toEqual({ present: 1, absent: 1, justified: 0 })
  })

  it('attendanceStats es null cuando no hay registro para esa fecha', () => {
    const result = computeBlocksByCourtForDate({
      date: monday, courts: [makeCourt()], groups: [makeGroup()],
      privateLessons: [], events: [], attendance: noAttendance,
    })
    expect(result['court-1'][0].attendanceStats).toBeNull()
  })
})
