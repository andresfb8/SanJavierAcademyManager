// ==========================================
// Schedule Conflict Detection Utilities
// ==========================================
// Detecta conflictos de horarios entre grupos, eventos, y clases particulares

import type { Group, AcademyEvent, ScheduleSlot } from '@/types'

export interface TimeRange {
  startTime: string // "HH:MM"
  endTime: string // "HH:MM"
}

export interface ScheduleConflict {
  type: 'group' | 'event' | 'coach'
  message: string
  conflictingItem: string
}

/**
 * Verifica si dos rangos de tiempo se solapan.
 * Asume formato "HH:MM" (ej: "10:00", "11:30")
 */
export function timeRangesOverlap(range1: TimeRange, range2: TimeRange): boolean {
  const [h1Start, m1Start] = range1.startTime.split(':').map(Number)
  const [h1End, m1End] = range1.endTime.split(':').map(Number)
  const [h2Start, m2Start] = range2.startTime.split(':').map(Number)
  const [h2End, m2End] = range2.endTime.split(':').map(Number)

  const start1 = h1Start * 60 + m1Start
  const end1 = h1End * 60 + m1End
  const start2 = h2Start * 60 + m2Start
  const end2 = h2End * 60 + m2End

  // Dos rangos se solapan si:
  // - El inicio de uno está entre el inicio y fin del otro
  // - O el fin de uno está entre el inicio y fin del otro
  // - O uno contiene completamente al otro
  return (
    (start1 < end2 && end1 > start2) ||
    (start2 < end1 && end2 > start1)
  )
}

/**
 * Verifica si un nuevo schedule slot tiene conflictos con los grupos existentes.
 * Busca conflictos de:
 * 1. Misma pista + mismo día + horario solapado
 * 2. Mismo entrenador + mismo día + horario solapado
 */
export function checkGroupScheduleConflicts(
  newSlot: ScheduleSlot,
  courtId: string,
  coachId: string,
  existingGroups: Group[],
  excludeGroupId?: string // Para edición, excluir el grupo actual
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = []

  for (const group of existingGroups) {
    // Excluir el grupo que se está editando
    if (excludeGroupId && group.id === excludeGroupId) continue
    if (!group.isActive) continue

    for (const slot of group.schedule) {
      // Verificar si es el mismo día
      if (slot.dayOfWeek !== newSlot.dayOfWeek) continue

      // Verificar si los horarios se solapan
      if (!timeRangesOverlap(newSlot, slot)) continue

      // Conflicto de pista
      if (group.courtId === courtId) {
        conflicts.push({
          type: 'group',
          message: `La pista ya está ocupada por "${group.name}"`,
          conflictingItem: group.name,
        })
      }

      // Conflicto de entrenador
      if (group.coachId === coachId) {
        conflicts.push({
          type: 'coach',
          message: `El entrenador ya tiene asignado "${group.name}"`,
          conflictingItem: group.name,
        })
      }
    }
  }

  return conflicts
}

/**
 * Verifica si un evento tiene conflictos con grupos o con otros eventos.
 * Un evento puede usar múltiples pistas, así que verifica todas.
 */
export function checkEventConflicts(
  eventDate: Date,
  startTime: string,
  endTime: string,
  courtIds: string[],
  existingGroups: Group[],
  existingEvents: AcademyEvent[],
  excludeEventId?: string // Para edición
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = []
  const eventDayOfWeek = eventDate.getDay()

  const eventRange: TimeRange = { startTime, endTime }

  // Verificar conflictos con grupos
  for (const group of existingGroups) {
    if (!group.isActive) continue

    for (const slot of group.schedule) {
      // Solo verificar si el grupo tiene clase ese día de la semana
      if (slot.dayOfWeek !== eventDayOfWeek) continue

      // Verificar si los horarios se solapan
      if (!timeRangesOverlap(eventRange, slot)) continue

      // Verificar si usan la misma pista
      if (courtIds.includes(group.courtId)) {
        conflicts.push({
          type: 'group',
          message: `Conflicto con el grupo "${group.name}" en la misma pista`,
          conflictingItem: group.name,
        })
      }
    }
  }

  // Verificar conflictos con otros eventos
  for (const event of existingEvents) {
    if (excludeEventId && event.id === excludeEventId) continue
    if (!event.isActive) continue

    // Verificar si es el mismo día
    const eventDateObj = event.date instanceof Date ? event.date : new Date(event.date)
    if (
      eventDateObj.getFullYear() !== eventDate.getFullYear() ||
      eventDateObj.getMonth() !== eventDate.getMonth() ||
      eventDateObj.getDate() !== eventDate.getDate()
    ) {
      continue
    }

    // Verificar si los horarios se solapan
    const existingEventRange: TimeRange = {
      startTime: event.startTime,
      endTime: event.endTime,
    }
    if (!timeRangesOverlap(eventRange, existingEventRange)) continue

    // Verificar si comparten alguna pista
    const sharedCourts = courtIds.filter((cId) => event.courtIds.includes(cId))
    if (sharedCourts.length > 0) {
      conflicts.push({
        type: 'event',
        message: `Conflicto con el evento "${event.name}"`,
        conflictingItem: event.name,
      })
    }
  }

  return conflicts
}

/**
 * Formatea una lista de conflictos en un mensaje legible
 */
export function formatConflictMessage(conflicts: ScheduleConflict[]): string {
  if (conflicts.length === 0) return ''

  const messages = conflicts.map((c) => `• ${c.message}`)
  return `⚠️ Conflictos de horario detectados:\n\n${messages.join('\n')}`
}
