// ==========================================
// San Javier Academy Manager - Data Loader
// ==========================================
// Carga todas las colecciones desde Firestore al hacer login.
// Reemplaza los datos del store de Zustand (Firestore es la fuente de verdad).

import { loadCollection, syncDoc } from './firestoreSync'
import { useDataStore } from '@/stores/dataStore'
import type {
  Court,
  Tariff,
  Player,
  Coach,
  Group,
  Enrollment,
  Payment,
  AttendanceRecord,
  Activity,
  PrivateLesson,
  Invitation,
  AcademyEvent,
  EventPayment,
  PrivateLessonPayment,
  Evaluation,
  MatchReport,
  CoachSalaryConfig,
} from '@/types'

export async function loadAllData(clubId: string): Promise<void> {
  const [
    courts,
    tariffs,
    players,
    coaches,
    groups,
    enrollments,
    payments,
    attendance,
    activities,
    privateLessons,
    invitations,
    events,
    eventPayments,
    privateLessonPayments,
    evaluations,
    matchReports,
    coachSalaryConfigs,
  ] = await Promise.all([
    loadCollection<Court>('courts', clubId),
    loadCollection<Tariff>('tariffs', clubId),
    loadCollection<Player>('players', clubId),
    loadCollection<Coach>('coaches', clubId),
    loadCollection<Group>('groups', clubId),
    loadCollection<Enrollment>('enrollments', clubId),
    loadCollection<Payment>('payments', clubId),
    loadCollection<AttendanceRecord>('attendance', clubId),
    loadCollection<Activity>('activities', clubId),
    loadCollection<PrivateLesson>('privateLessons', clubId),
    loadCollection<Invitation>('invitations', clubId),
    loadCollection<AcademyEvent>('events', clubId),
    loadCollection<EventPayment>('eventPayments', clubId),
    loadCollection<PrivateLessonPayment>('privateLessonPayments', clubId),
    loadCollection<Evaluation>('evaluations', clubId),
    loadCollection<MatchReport>('matchReports', clubId),
    loadCollection<CoachSalaryConfig>('coachSalaryConfigs', clubId),
  ])

  useDataStore.setState({
    courts,
    tariffs,
    players,
    coaches,
    groups,
    enrollments,
    payments,
    attendance,
    activities,
    privateLessons,
    invitations,
    events,
    eventPayments,
    privateLessonPayments,
    evaluations,
    matchReports,
    coachSalaryConfigs,
  })
}

// Migra datos existentes de localStorage → Firestore (se ejecuta una sola vez).
// Solo actúa si Firestore está vacío pero el store local tiene datos.
export async function migrateLocalToFirestore(clubId: string): Promise<void> {
  const migrationKey = `sjam-migrated-to-firestore-${clubId}`
  if (localStorage.getItem(migrationKey)) return

  const state = useDataStore.getState()

  // Solo migrar si hay datos en local pero Firestore está vacío (verificamos players)
  const existingPlayers = await loadCollection<Player>('players', clubId)
  if (existingPlayers.length > 0) {
    // Firestore ya tiene datos — marcar como migrado y salir
    localStorage.setItem(migrationKey, new Date().toISOString())
    return
  }

  // Firestore vacío → volcar todo el estado local
  const collections: Array<{ name: string; items: Array<Record<string, unknown> & { id?: string; coachId?: string }> }> = [
    { name: 'courts', items: state.courts as unknown as Array<Record<string, unknown>> },
    { name: 'tariffs', items: state.tariffs as unknown as Array<Record<string, unknown>> },
    { name: 'players', items: state.players as unknown as Array<Record<string, unknown>> },
    { name: 'coaches', items: state.coaches as unknown as Array<Record<string, unknown>> },
    { name: 'groups', items: state.groups as unknown as Array<Record<string, unknown>> },
    { name: 'enrollments', items: state.enrollments as unknown as Array<Record<string, unknown>> },
    { name: 'payments', items: state.payments as unknown as Array<Record<string, unknown>> },
    { name: 'attendance', items: state.attendance as unknown as Array<Record<string, unknown>> },
    { name: 'activities', items: state.activities as unknown as Array<Record<string, unknown>> },
    { name: 'privateLessons', items: state.privateLessons as unknown as Array<Record<string, unknown>> },
    { name: 'invitations', items: state.invitations as unknown as Array<Record<string, unknown>> },
    { name: 'events', items: state.events as unknown as Array<Record<string, unknown>> },
    { name: 'eventPayments', items: state.eventPayments as unknown as Array<Record<string, unknown>> },
    { name: 'privateLessonPayments', items: state.privateLessonPayments as unknown as Array<Record<string, unknown>> },
    { name: 'evaluations', items: state.evaluations as unknown as Array<Record<string, unknown>> },
    { name: 'matchReports', items: state.matchReports as unknown as Array<Record<string, unknown>> },
    { name: 'coachSalaryConfigs', items: state.coachSalaryConfigs as unknown as Array<Record<string, unknown>> },
  ]

  for (const { name, items } of collections) {
    for (const item of items) {
      // CoachSalaryConfig usa coachId como clave, el resto usa id
      const docId = (item.id as string | undefined) ?? (item.coachId as string | undefined)
      if (docId) {
        syncDoc(name, docId, item as Record<string, unknown>, clubId)
      }
    }
  }

  localStorage.setItem(migrationKey, new Date().toISOString())
  console.info(`[Firestore] Migración completada para club ${clubId}`)
}
