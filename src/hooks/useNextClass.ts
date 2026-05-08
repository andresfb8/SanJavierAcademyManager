import { useMemo } from 'react'
import { useDataStore } from '@/stores/dataStore'
import type { Group } from '@/types'

export interface NextClassCoachInfo {
  group: Group
  classTime: Date
  startTime: string
}

/**
 * Para un entrenador: devuelve la clase más próxima en las próximas 2 horas.
 * Útil para auto-detectar qué pase de lista cargar al entrar a /asistencia.
 *
 * @param coachId - ID del coach en la colección coaches (linkedCoachId del AppUser)
 */
export function useNextClass(coachId: string): NextClassCoachInfo | null {
  const { groups } = useDataStore()

  return useMemo(() => {
    if (!coachId) return null

    const now = new Date()
    const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    const todayDow = now.getDay() || 7 // ISO: 1=lunes…7=domingo

    const myGroups = groups.filter((g) => g.coachId === coachId && g.isActive)

    const candidates: NextClassCoachInfo[] = myGroups.flatMap((group) =>
      group.schedule
        .filter((slot) => slot.dayOfWeek === todayDow)
        .map((slot) => {
          const [h, m] = slot.startTime.split(':').map(Number)
          const classTime = new Date()
          classTime.setHours(h, m, 0, 0)
          return { group, classTime, startTime: slot.startTime }
        })
        .filter(({ classTime }) => classTime >= now && classTime <= in2h)
    )

    return (
      candidates.sort((a, b) => a.classTime.getTime() - b.classTime.getTime())[0] ?? null
    )
  }, [groups, coachId])
}
