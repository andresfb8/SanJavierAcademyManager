import type { Enrollment, Group } from '@/types'

/** `true` si alguna matricula activa o algun grupo activo sigue usando esta tarifa. */
export function isTariffInUse(tariffId: string, enrollments: Enrollment[], groups: Group[]): boolean {
  const usedByEnrollment = enrollments.some((e) => e.isActive && e.tariffId === tariffId)
  const usedByGroup = groups.some((g) => g.isActive && g.defaultTariffId === tariffId)
  return usedByEnrollment || usedByGroup
}
