import type { AttendanceRecord, AttendanceStatus } from '@/types'

export interface MyAttendanceRow {
  recordId: string
  date: Date
  groupName: string
  status: AttendanceStatus
}

/**
 * Historial de clases de un alumno en un mes/año concreto, más reciente
 * primero. Filtra por participación real del alumno en cada registro
 * (`records.find`), no por matrícula en el grupo: así se incluyen también
 * las recuperaciones en grupos donde el alumno no está inscrito.
 *
 * `record.date` está tipado Date pero `attendance` se persiste en
 * localStorage (partialize del store), así que tras rehidratar puede
 * llegar como string ISO — de ahí la coerción con `new Date(...)`.
 */
export function getMyAttendanceForMonth(
  attendance: AttendanceRecord[],
  studentId: string,
  month: number, // 1-12
  year: number
): MyAttendanceRow[] {
  const rows: MyAttendanceRow[] = []

  for (const record of attendance) {
    const date = new Date(record.date)
    if (date.getMonth() + 1 !== month || date.getFullYear() !== year) continue

    const entry = record.records.find((r) => r.playerId === studentId)
    if (!entry) continue

    rows.push({
      recordId: record.id,
      date,
      groupName: record.groupName,
      status: entry.status,
    })
  }

  return rows.sort((a, b) => b.date.getTime() - a.date.getTime())
}
