import type { Group } from '@/types'

function toDateOnly(d: Date | string): Date {
  const date = d instanceof Date ? d : new Date(d)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/**
 * Un grupo esta vigente en una fecha si isActive es true Y la fecha cae
 * dentro de [startDate, endDate] (inclusive, comparando solo la fecha, sin
 * hora). Se deriva automaticamente de las fechas del grupo en vez de
 * depender de que alguien lo desactive manualmente al terminar su
 * temporada.
 */
export function isGroupCurrentlyActive(
  group: Pick<Group, 'isActive' | 'startDate' | 'endDate'>,
  date: Date
): boolean {
  if (!group.isActive) return false
  const day = toDateOnly(date)
  return day >= toDateOnly(group.startDate) && day <= toDateOnly(group.endDate)
}

/** Ha pasado la fecha de fin pero el grupo sigue marcado como activo. */
export function isGroupStale(group: Pick<Group, 'isActive' | 'endDate'>, now: Date): boolean {
  return group.isActive && toDateOnly(now) > toDateOnly(group.endDate)
}
