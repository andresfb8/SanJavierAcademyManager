import type { Group, ScheduleSlot } from '@/types'

/**
 * Un AttendanceRecord representa una única sesión de clase en una fecha
 * concreta. Para grupos con varios horarios semanales (ej. lunes 1h y
 * miércoles 1h30), hay que usar el horario del día que realmente coincide
 * con esa sesión, no siempre el primero del array.
 */
export function findSlotForAttendanceDate(group: Group, date: Date): ScheduleSlot | undefined {
  const dayOfWeek = date.getDay()
  return group.schedule.find(s => s.dayOfWeek === dayOfWeek) ?? group.schedule[0]
}
