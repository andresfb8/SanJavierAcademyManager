// ==========================================
// San Javier Academy Manager - Data Store
// ==========================================
// Zustand store principal para la gestión de todos los datos de la aplicación.
// Incluye lógica de negocio para cancelaciones, generación de recibos,
// asistencia con créditos de recuperación, y operaciones CRUD completas.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Club,
  Court,
  Tariff,
  Player,
  Coach,
  Group,
  Enrollment,
  Payment,
  AttendanceRecord,
  AttendanceEntry,
  Activity,
  PrivateLesson,
  Invitation,
  AcademyEvent,
  EventPayment,
  PrivateLessonPayment,
  Evaluation,
  MatchReport,
  CoachSalaryConfig,
  PaymentStatus,
  PaymentMethod,
  PaymentCategory,
  PlayerStatus,
  ActivityType,
  Invoice,
  AppUser,
} from '@/types'
import {
  demoCourts,
  demoTariffs,
  demoCoaches,
  demoPlayers,
  demoGroups,
  demoEnrollments,
  demoPayments,
  demoActivities,
  demoEvents,
  demoEvaluations,
  demoCoachSalaryConfigs,
} from '@/lib/demo-data'
import { generateId } from '@/lib/utils'
import { CANCELLATION_DEADLINE_DAY } from '@/constants'
import { useAuthStore } from '@/stores/authStore'
import {
  syncDoc,
  deleteFirestoreDoc,
  syncDocWithRetry,
  syncEnrollmentWithGroupCounter,
  updateEnrollmentStatus,
  generateMonthlyReceiptsAtomic,
  createInvoiceAtomic,
} from '@/lib/firestoreSync'
import { doc, getDoc, getDocs, query, collection, where, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { toast } from '@/hooks/use-toast'

// Helper: obtiene el clubId del usuario autenticado para sync con Firestore
function getClubId(): string | undefined {
  const user = useAuthStore.getState().user
  if (user?.clubId) return user.clubId

  // Log advertencia si falta clubId
  console.warn('[DataStore] getClubId: No clubId found. User may not be authenticated.')

  // Fallback en desarrollo para asegurar persistencia local
  if (import.meta.env.DEV) return 'club-001'
  return undefined
}

// ===================
// STORE INTERFACE
// ===================

export interface DataState {
  // --- Data ---
  club: Club | null
  courts: Court[]
  tariffs: Tariff[]
  players: Player[]
  coaches: Coach[]
  groups: Group[]
  enrollments: Enrollment[]
  payments: Payment[]
  attendance: AttendanceRecord[]
  activities: Activity[]
  privateLessons: PrivateLesson[]
  invitations: Invitation[]
  events: AcademyEvent[]
  eventPayments: EventPayment[]
  privateLessonPayments: PrivateLessonPayment[]
  evaluations: Evaluation[]
  matchReports: MatchReport[]
  coachSalaryConfigs: CoachSalaryConfig[]
  invoices: Invoice[]
  users: AppUser[]

  // --- Club ---
  updateClub: (club: Partial<Club>) => void

  // --- Courts CRUD ---
  addCourt: (court: Omit<Court, 'id'>) => void
  updateCourt: (id: string, data: Partial<Court>) => void
  deleteCourt: (id: string) => void

  // --- Tariffs CRUD ---
  addTariff: (tariff: Omit<Tariff, 'id' | 'createdAt'>) => void
  updateTariff: (id: string, data: Partial<Tariff>) => void
  deleteTariff: (id: string) => void

  // --- Players CRUD ---
  addPlayer: (player: Omit<Player, 'id' | 'createdAt' | 'updatedAt' | 'recoveryCredits'>) => void
  updatePlayer: (id: string, data: Partial<Player>) => void
  deletePlayer: (id: string) => void
  cancelPlayer: (id: string) => void

  // --- Coaches CRUD ---
  addCoach: (coach: Omit<Coach, 'id' | 'createdAt'>) => string
  updateCoach: (id: string, data: Partial<Coach>) => void
  deleteCoach: (id: string) => void

  // --- Groups CRUD ---
  addGroup: (group: Omit<Group, 'id' | 'createdAt' | 'currentEnrollment'>) => void
  updateGroup: (id: string, data: Partial<Group>) => void
  deleteGroup: (id: string) => void

  // --- Enrollments CRUD ---
  addEnrollment: (enrollment: Omit<Enrollment, 'id'>) => Promise<{ needsPartialReceipt: boolean; enrollmentId: string }>
  updateEnrollment: (id: string, data: Partial<Enrollment>) => void
  deleteEnrollment: (id: string) => void
  deactivateEnrollment: (id: string, effectiveDate?: Date) => Promise<void>

  // --- Payments ---
  generatePartialReceipt: (enrollmentId: string, amount: number) => Promise<void>
  addPayment: (payment: Omit<Payment, 'id' | 'createdAt'>) => void
  addManualPayment: (data: { playerId: string; playerName: string; concept: string; amount: number; category?: PaymentCategory; notes?: string }) => void
  updatePayment: (id: string, data: Partial<Payment>) => void
  deletePayment: (id: string) => void
  deleteEventPayment: (id: string) => void
  deletePrivateLessonPayment: (id: string) => void
  markPaymentPaid: (id: string, method: PaymentMethod) => void
  markEventPaymentPaid: (id: string, method: PaymentMethod) => void
  markPrivateLessonPaymentPaid: (id: string, method: PaymentMethod) => void
  revertPaymentPaidStatus: (id: string, source: 'cuota' | 'evento' | 'clase_particular' | 'manual' | 'otro') => void
  cancelPayment: (id: string) => void
  generateMonthlyReceipts: (month: number, year: number) => Promise<number>
  checkAndAutoGenerateReceipts: () => Promise<void>
  cleanupOrphanedPayments: () => void
  deleteAllPayments: () => Promise<void>

  // --- Invoices ---
  addInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt'>, newPayments?: Payment[]) => Promise<void>
  updateInvoice: (id: string, data: Partial<Invoice>) => void
  deleteInvoice: (id: string) => void
  unlinkPaymentsFromInvoice: (invoiceId: string) => Promise<void>

  // --- Attendance ---
  addAttendanceRecord: (record: Omit<AttendanceRecord, 'id' | 'createdAt'>) => void
  updateAttendanceRecord: (id: string, data: Partial<AttendanceRecord>) => void
  deleteAttendanceRecord: (id: string) => void

  // --- Activities ---
  addActivity: (activity: Omit<Activity, 'id' | 'createdAt'>) => void

  // --- Private Lessons ---
  addPrivateLesson: (lesson: Omit<PrivateLesson, 'id' | 'createdAt'>) => string
  updatePrivateLesson: (id: string, data: Partial<PrivateLesson>) => void
  deletePrivateLesson: (id: string) => void

  // --- Private Lesson Payments ---
  addPrivateLessonPayment: (payment: Omit<PrivateLessonPayment, 'id' | 'createdAt'>) => void
  updatePrivateLessonPayment: (id: string, data: Partial<PrivateLessonPayment>) => void
  deletePrivateLessonPaymentsByLesson: (lessonId: string) => void

  // --- Invitations ---
  addInvitation: (invitation: Omit<Invitation, 'id'>) => void
  updateInvitation: (id: string, data: Partial<Invitation>) => void
  deleteInvitation: (id: string) => void

  // --- Events ---
  addEvent: (event: Omit<AcademyEvent, 'id' | 'createdAt'>) => string
  updateEvent: (id: string, data: Partial<AcademyEvent>) => void
  deleteEvent: (id: string) => void

  // --- Event Payments ---
  addEventPayment: (payment: Omit<EventPayment, 'id' | 'createdAt'>) => void
  updateEventPayment: (id: string, data: Partial<EventPayment>) => void

  // --- Evaluations ---
  addEvaluation: (evaluation: Omit<Evaluation, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateEvaluation: (id: string, data: Partial<Evaluation>) => void
  deleteEvaluation: (id: string) => void

  // --- Match Reports ---
  addMatchReport: (report: Omit<MatchReport, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateMatchReport: (id: string, data: Partial<MatchReport>) => void
  deleteMatchReport: (id: string) => void

  // --- Coach Salary ---
  updateCoachSalaryConfig: (coachId: string, config: Partial<CoachSalaryConfig>) => void

}

const defaultClub: Club = {
  id: 'club-001',
  name: 'San Javier Padel Academy',
  address: 'Polideportivo Municipal, San Javier, Murcia',
  phone: '968 000 000',
  email: 'info@sanjavierpadelacademy.es',
  openingTime: '08:00',
  closingTime: '22:00',
  seasonStart: new Date('2025-09-15'),
  seasonEnd: new Date('2026-06-30'),
  createdAt: new Date('2025-01-01'),
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
function dateReviver(_key: string, value: unknown): unknown {
  if (typeof value === 'string' && ISO_DATE_REGEX.test(value)) {
    return new Date(value)
  }
  return value
}

function getCurrentUser() {
  const user = useAuthStore.getState().user
  return {
    userId: user?.id ?? 'demo-director-001',
    userName: user?.displayName ?? 'Director',
  }
}

function toISODate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date)
  if (isNaN(d.getTime())) return 'invalid-date'
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// =====================================================
// RECOVERY CREDIT BALANCE COMPUTATION
// =====================================================
// Computes the current usable credits for a player using a FIFO algorithm
// with 60-day expiration.
const RECOVERY_CREDIT_EXPIRY_DAYS = 60

function computePlayerRecoveryBalance(
  playerId: string,
  attendance: AttendanceRecord[],
  now = new Date()
): number {
  const expiryMs = RECOVERY_CREDIT_EXPIRY_DAYS * 24 * 60 * 60 * 1000

  // Collect all earned credits (justificado, non-recovery) sorted oldest first
  const earned: Date[] = []
  // Collect all recovery uses sorted oldest first
  const uses: Date[] = []

  for (const record of attendance) {
    const recordDate = record.date instanceof Date ? record.date : new Date(record.date)
    for (const entry of record.records) {
      if (entry.playerId !== playerId) continue
      if (entry.status === 'justificado' && !entry.isRecovery) {
        earned.push(recordDate)
      }
      if (entry.isRecovery) {
        uses.push(recordDate)
      }
    }
  }

  earned.sort((a, b) => a.getTime() - b.getTime())
  uses.sort((a, b) => a.getTime() - b.getTime())

  // Consumed credits are those that match a use (FIFO)
  // Since we only care about the balance, we just need to skip as many earned
  // credits as there were total uses.
  const totalUses = uses.length
  const unconsumedEarned = earned.slice(totalUses)

  // Count remaining unconsumed credits that have not yet expired
  return unconsumedEarned.filter(
    (earnedDate) => now.getTime() - earnedDate.getTime() < expiryMs
  ).length
}

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
      club: defaultClub,

      courts: [],
      tariffs: [],
      players: [],
      coaches: [],
      groups: [],
      enrollments: [],
      payments: [],
      attendance: [],
      activities: [],
      privateLessons: [],
      invitations: [],
      events: [],
      eventPayments: [],
      privateLessonPayments: [],
      evaluations: [],
      matchReports: [],
      coachSalaryConfigs: [],
      invoices: [],
      users: [],
      updateClub: (data) => {
        set((state) => ({
          club: state.club ? { ...state.club, ...data } : null,
        }))
        const clubId = getClubId()
        const updated = get().club
        if (clubId && updated) {
          syncDoc('clubs', clubId, { ...updated, ...data } as any, clubId)
        }
      },

      addCourt: (courtData) => {
        const newCourt: Court = { ...courtData, id: generateId() }
        set((state) => ({ courts: [...state.courts, newCourt] }))
        const clubId = getClubId()
        if (clubId) syncDoc('courts', newCourt.id, newCourt as any, clubId)
      },

      updateCourt: (id, data) => {
        set((state) => ({
          courts: state.courts.map((c) => (c.id === id ? { ...c, ...data } : c)),
        }))
        const clubId = getClubId()
        const updated = get().courts.find((c) => c.id === id)
        if (clubId && updated) syncDoc('courts', id, updated as any, clubId)
      },

      deleteCourt: (id) => {
        set((state) => ({
          courts: state.courts.filter((c) => c.id !== id),
        }))
        deleteFirestoreDoc('courts', id)
      },

      addTariff: (tariffData) => {
        const newTariff: Tariff = { ...tariffData, id: generateId(), createdAt: new Date() }
        set((state) => ({ tariffs: [...state.tariffs, newTariff] }))
        const clubId = getClubId()
        if (clubId) syncDoc('tariffs', newTariff.id, newTariff as any, clubId)
      },

      updateTariff: (id, data) => {
        set((state) => ({
          tariffs: state.tariffs.map((t) => (t.id === id ? { ...t, ...data } : t)),
        }))
        const clubId = getClubId()
        const updated = get().tariffs.find((t) => t.id === id)
        if (clubId && updated) syncDoc('tariffs', id, updated as any, clubId)
      },

      deleteTariff: (id) => {
        set((state) => ({
          tariffs: state.tariffs.filter((t) => t.id !== id),
        }))
        deleteFirestoreDoc('tariffs', id)
      },

      addPlayer: (playerData) => {
        const now = new Date()
        const newPlayer: Player = {
          ...playerData,
          id: generateId(),
          recoveryCredits: 0,
          createdAt: now,
          updatedAt: now,
        }
        set((state) => ({ players: [...state.players, newPlayer] }))
        const clubId = getClubId()
        if (clubId) {
          syncDoc('players', newPlayer.id, newPlayer as any, clubId)
            .then(() => console.info(`[DataStore] addPlayer: ✅ Firestore OK`))
            .catch((err) => console.warn(`[DataStore] addPlayer: ❌ Firestore FAILED`, err))
        }
        const { userId, userName } = getCurrentUser()
        get().addActivity({
          type: 'player_created',
          description: `Se registró a ${playerData.firstName} ${playerData.lastName}`,
          relatedEntityId: newPlayer.id,
          userId,
          userName,
        })
      },

      updatePlayer: (id, data) => {
        set((state) => ({
          players: state.players.map((p) =>
            p.id === id ? { ...p, ...data, updatedAt: new Date() } : p
          ),
        }))
        const clubId = getClubId()
        const updated = get().players.find((p) => p.id === id)
        if (clubId && updated) syncDoc('players', id, updated as any, clubId)
        const { userId, userName } = getCurrentUser()
        get().addActivity({
          type: 'player_updated',
          description: `Se actualizó el perfil de ${updated?.firstName || id}`,
          relatedEntityId: id,
          userId,
          userName,
        })
      },

      deletePlayer: (id) => {
        const enrollmentsToDelete = get().enrollments.filter((e) => e.playerId === id).map((e) => e.id)
        set((state) => ({
          players: state.players.filter((p) => p.id !== id),
          enrollments: state.enrollments.filter((e) => e.playerId !== id),
        }))
        deleteFirestoreDoc('players', id)
        enrollmentsToDelete.forEach((eid) => deleteFirestoreDoc('enrollments', eid))
      },

      cancelPlayer: (playerId) => {
        const state = get()
        const player = state.players.find((p) => p.id === playerId)
        if (!player || player.status === 'baja') return
        const today = new Date()
        const currentDay = today.getDate()
        const currentMonth = today.getMonth() + 1
        const currentYear = today.getFullYear()

        set((prevState) => ({
          players: prevState.players.map((p) =>
            p.id === playerId ? { ...p, status: 'baja' as PlayerStatus, cancellationDate: today, updatedAt: today } : p
          ),
        }))

        const activeEnrollments = state.enrollments.filter((e) => e.playerId === playerId && e.isActive)
        const affectedGroupIds = activeEnrollments.map((e) => e.groupId)

        set((prevState) => ({
          enrollments: prevState.enrollments.map((e) =>
            e.playerId === playerId && e.isActive ? { ...e, isActive: false, unenrollmentDate: today } : e
          ),
          groups: prevState.groups.map((g) =>
            affectedGroupIds.includes(g.id) ? { ...g, currentEnrollment: Math.max(0, g.currentEnrollment - 1) } : g
          ),
        }))

        if (currentDay <= CANCELLATION_DEADLINE_DAY) {
          set((prevState) => ({
            payments: prevState.payments.map((p) =>
              p.playerId === playerId && p.billingMonth === currentMonth && p.billingYear === currentYear && p.status === 'pendiente'
                ? { ...p, status: 'cancelado' as PaymentStatus }
                : p
            ),
          }))
        }

        const clubId = getClubId()
        if (clubId) {
          const stateAfter = get()
          const updatedPlayer = stateAfter.players.find((p) => p.id === playerId)
          if (updatedPlayer) syncDoc('players', playerId, updatedPlayer as any, clubId)
          stateAfter.enrollments.filter((e) => e.playerId === playerId && !e.isActive).forEach((e) => syncDoc('enrollments', e.id, e as any, clubId))
          affectedGroupIds.forEach((gid) => {
            const g = stateAfter.groups.find((grp) => grp.id === gid)
            if (g) syncDoc('groups', gid, g as any, clubId)
          })
        }
        const { userId, userName } = getCurrentUser()
        get().addActivity({
          type: 'player_cancelled',
          description: `${player.firstName} ${player.lastName} se ha dado de baja`,
          relatedEntityId: playerId,
          userId,
          userName,
        })
      },

      addCoach: (coachData) => {
        const newCoach: Coach = { ...coachData, id: generateId(), createdAt: new Date() }
        set((state) => ({ coaches: [...state.coaches, newCoach] }))
        const clubId = getClubId()
        if (clubId) syncDoc('coaches', newCoach.id, newCoach as any, clubId)
        const { userId, userName } = getCurrentUser()
        get().addActivity({
          type: 'coach_created',
          description: `Se añadió al entrenador ${coachData.firstName} ${coachData.lastName}`,
          relatedEntityId: newCoach.id,
          userId,
          userName,
        })
        return newCoach.id
      },

      updateCoach: (id, data) => {
        set((state) => ({
          coaches: state.coaches.map((c) => (c.id === id ? { ...c, ...data } : c)),
        }))
        const clubId = getClubId()
        const updated = get().coaches.find((c) => c.id === id)
        if (clubId && updated) syncDoc('coaches', id, updated as any, clubId)
        const { userId, userName } = getCurrentUser()
        get().addActivity({
          type: 'coach_updated',
          description: `Se actualizó el perfil de ${updated?.firstName || id}`,
          relatedEntityId: id,
          userId,
          userName,
        })
      },

      deleteCoach: (id) => {
        const coach = get().coaches.find((c) => c.id === id)
        set((state) => ({ coaches: state.coaches.filter((c) => c.id !== id) }))
        deleteFirestoreDoc('coaches', id)
        const { userId, userName } = getCurrentUser()
        get().addActivity({
          type: 'coach_deleted',
          description: `Se eliminó el entrenador ${coach?.firstName || id} ${coach?.lastName || ''}`,
          relatedEntityId: id,
          userId,
          userName,
        })
      },

      addGroup: (groupData) => {
        const newGroup: Group = { ...groupData, id: generateId(), currentEnrollment: 0, createdAt: new Date() }
        set((state) => ({ groups: [...state.groups, newGroup] }))
        const clubId = getClubId()
        if (clubId) syncDoc('groups', newGroup.id, newGroup as any, clubId)
        const { userId, userName } = getCurrentUser()
        get().addActivity({
          type: 'group_created',
          description: `Se creó el grupo ${groupData.name}`,
          relatedEntityId: newGroup.id,
          userId,
          userName,
        })
      },

      updateGroup: (id, data) => {
        set((state) => ({
          groups: state.groups.map((g) => (g.id === id ? { ...g, ...data } : g)),
        }))
        const clubId = getClubId()
        const updated = get().groups.find((g) => g.id === id)
        if (clubId && updated) syncDoc('groups', id, updated as any, clubId)
        const { userId, userName } = getCurrentUser()
        get().addActivity({
          type: 'group_updated',
          description: `Se actualizó el grupo ${updated?.name || id}`,
          relatedEntityId: id,
          userId,
          userName,
        })
      },

      deleteGroup: (id) => {
        const group = get().groups.find((g) => g.id === id)
        const affectedEnrollments = get().enrollments.filter((e) => e.groupId === id)
        set((state) => ({
          groups: state.groups.filter((g) => g.id !== id),
          enrollments: state.enrollments.map((e) => e.groupId === id ? { ...e, isActive: false } : e),
        }))
        deleteFirestoreDoc('groups', id)
        const clubId = getClubId()
        if (clubId) {
          affectedEnrollments.forEach((e) => syncDoc('enrollments', e.id, { ...e, isActive: false } as any, clubId))
        }
        const { userId, userName } = getCurrentUser()
        get().addActivity({
          type: 'group_deleted',
          description: `Se eliminó el grupo ${group?.name || id}`,
          relatedEntityId: id,
          userId,
          userName,
        })
      },
      addEnrollment: async (enrollmentData) => {
        const newEnrollment: Enrollment = { ...enrollmentData, id: generateId() }
        const clubId = getClubId()

        if (!clubId) {
          console.error('[addEnrollment] No clubId found')
          throw new Error('No clubId found')
        }

        try {
          // Transacción atómica para prevenir race conditions
          await syncEnrollmentWithGroupCounter(
            newEnrollment.id,
            newEnrollment as any,
            enrollmentData.groupId,
            enrollmentData.isActive ? 1 : 0,
            clubId
          )

          // Update local state (listeners confirmarán desde Firestore)
          set((state) => ({
            enrollments: [...state.enrollments, newEnrollment],
            groups: state.groups.map((g) =>
              g.id === enrollmentData.groupId && enrollmentData.isActive
                ? { ...g, currentEnrollment: g.currentEnrollment + 1 }
                : g
            ),
          }))

          const { userId, userName } = getCurrentUser()
          get().addActivity({
            type: 'enrollment_created',
            description: `${enrollmentData.playerName} inscrito en ${enrollmentData.groupName}`,
            relatedEntityId: newEnrollment.id,
            userId,
            userName,
          })

          console.info('[addEnrollment] Success:', newEnrollment.id)

          let needsPartialReceipt = false

          // Verificar si ya se generaron los recibos de este mes
          if (enrollmentData.isActive) {
            const now = new Date()
            const currentMonth = now.getMonth() + 1
            const currentYear = now.getFullYear()
            const generationId = `${clubId}-${currentYear}-${currentMonth}`

            // Check in Firestore if generation doc exists
            const generationRef = doc(db, 'receiptGenerations', generationId)
            const snap = await getDoc(generationRef)

            if (snap.exists() && snap.data().status === 'completed') {
              needsPartialReceipt = true
            } else {
              // Backup check: if there are already payments for this group/month,
              // it's very likely receipts were already generated.
              const existingPayments = await getDocs(
                query(
                  collection(db, 'payments'),
                  where('clubId', '==', clubId),
                  where('groupId', '==', enrollmentData.groupId),
                  where('billingMonth', '==', currentMonth),
                  where('billingYear', '==', currentYear),
                  limit(1)
                )
              )
              if (!existingPayments.empty || (now.getDate() > 1 && !snap.exists())) {
                needsPartialReceipt = true
              }
            }
          }

          return { needsPartialReceipt, enrollmentId: newEnrollment.id }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Error desconocido'
          console.error('[addEnrollment] Failed:', message)
          toast.error(`Error al inscribir: ${message}`)
          throw error
        }
      },

      generatePartialReceipt: async (enrollmentId: string, amount: number) => {
        const clubId = getClubId()
        if (!clubId) throw new Error('No clubId found')

        const now = new Date()
        const month = now.getMonth() + 1
        const year = now.getFullYear()

        const enrollment = get().enrollments.find(e => e.id === enrollmentId)
        if (!enrollment) throw new Error('Inscripción no encontrada')

        const paymentId = generateId()
        const dueDate = new Date() // El mismo día que se genera

        const newPayment: Payment = {
          id: paymentId,
          playerId: enrollment.playerId,
          playerName: enrollment.playerName,
          groupId: enrollment.groupId,
          groupName: enrollment.groupName,
          enrollmentId,
          concept: `Cuota parcial ${enrollment.groupName} (${month}/${year})`,
          amount,
          status: 'pendiente',
          category: 'cuota',
          billingMonth: month,
          billingYear: year,
          dueDate,
          autogenerated: true,
          registeredBy: getCurrentUser().userName,
          createdAt: now,
        }

        // Optimistic update
        set((state) => ({ payments: [...state.payments, newPayment] }))

        try {
          await syncDoc('payments', paymentId, newPayment as any, clubId)
          toast.success(`Recibo parcial de ${amount}€ generado correctamente`)
        } catch (error) {
          // Rollback
          set((state) => ({ payments: state.payments.filter(p => p.id !== paymentId) }))
          const msg = error instanceof Error ? error.message : 'Error al guardar el recibo parcial'
          toast.error(msg)
          throw error
        }
      },

      updateEnrollment: (id, data) => {
        set((state) => ({ enrollments: state.enrollments.map((e) => e.id === id ? { ...e, ...data } : e) }))
        const clubId = getClubId()
        const updated = get().enrollments.find((e) => e.id === id)
        if (clubId && updated) syncDoc('enrollments', id, updated as any, clubId)
      },

      deleteEnrollment: (id) => {
        const enrollment = get().enrollments.find((e) => e.id === id)
        set((state) => ({
          enrollments: state.enrollments.filter((e) => e.id !== id),
          groups: enrollment?.isActive ? state.groups.map((g) => g.id === enrollment.groupId ? { ...g, currentEnrollment: Math.max(0, g.currentEnrollment - 1) } : g) : state.groups,
        }))
        deleteFirestoreDoc('enrollments', id)
        const { userId, userName } = getCurrentUser()
        get().addActivity({
          type: 'enrollment_deleted',
          description: `${enrollment?.playerName || 'Alumno'} dado de baja del grupo ${enrollment?.groupName || ''}`,
          relatedEntityId: id,
          userId,
          userName,
        })
      },

      deactivateEnrollment: async (id: string, effectiveDate?: Date) => {
        const enrollment = get().enrollments.find((e) => e.id === id)
        if (!enrollment || !enrollment.isActive) return

        const clubId = getClubId()
        if (!clubId) {
          console.error('[deactivateEnrollment] No clubId found')
          return
        }

        const dateToUse = effectiveDate || new Date()
        const unenrollDay = dateToUse.getDate()
        const unenrollMonth = dateToUse.getMonth() + 1
        const unenrollYear = dateToUse.getFullYear()

        try {
          // Conditional Receipt Deletion (<= 5)
          if (unenrollDay <= 5) {
            // Find PENDING payments for this user, this group, this month
            const paymentsToDelete = get().payments.filter(p =>
              p.enrollmentId === id &&
              p.status === 'pendiente' &&
              p.billingMonth === unenrollMonth &&
              p.billingYear === unenrollYear
            )

            if (paymentsToDelete.length > 0) {
              set((state) => ({
                payments: state.payments.filter(p => !paymentsToDelete.some(dp => dp.id === p.id))
              }))
              // Delete from firestore in parallel
              await Promise.all(
                paymentsToDelete.map(p => deleteFirestoreDoc('payments', p.id))
              )
              console.info(`[deactivateEnrollment] Deleted ${paymentsToDelete.length} pending receipts for month ${unenrollMonth}`)
            }
          }

          // Transacción atómica para actualizar enrollment y contador de grupo
          await updateEnrollmentStatus(id, enrollment.groupId, false, clubId)

          // Update local state (listeners confirmarán desde Firestore)
          set((state) => ({
            enrollments: state.enrollments.map((e) =>
              e.id === id ? { ...e, isActive: false, unenrollmentDate: dateToUse } : e
            ),
            groups: state.groups.map((g) =>
              g.id === enrollment.groupId
                ? { ...g, currentEnrollment: Math.max(0, g.currentEnrollment - 1) }
                : g
            ),
          }))

          const { userId, userName } = getCurrentUser()
          get().addActivity({
            type: 'enrollment_deleted',
            description: `${enrollment.playerName} dado de baja del grupo ${enrollment.groupName} (Efectiva: ${dateToUse.toLocaleDateString()})`,
            relatedEntityId: id,
            userId,
            userName,
          })

          console.info('[deactivateEnrollment] Success:', id)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Error desconocido'
          console.error('[deactivateEnrollment] Failed:', message)
          toast.error(`Error al desactivar inscripción: ${message}`)
          throw error
        }
      },
      addPayment: (paymentData) => {
        const newPayment: Payment = { ...paymentData, id: generateId(), createdAt: new Date() }
        set((state) => ({ payments: [...state.payments, newPayment] }))
        const clubId = getClubId()
        if (clubId) syncDoc('payments', newPayment.id, newPayment as any, clubId)
      },

      addManualPayment: (data) => {
        const now = new Date()
        const { userName } = getCurrentUser()
        const newPayment: Payment = {
          id: generateId(), playerId: data.playerId, playerName: data.playerName, concept: data.concept,
          amount: data.amount, category: data.category ?? 'manual', status: 'pendiente',
          billingMonth: now.getMonth() + 1, billingYear: now.getFullYear(), dueDate: now,
          autogenerated: false, notes: data.notes, registeredBy: userName, createdAt: now,
        }
        set((state) => ({ payments: [...state.payments, newPayment] }))
        const clubId = getClubId()
        if (clubId) syncDoc('payments', newPayment.id, newPayment as any, clubId)
      },

      updatePayment: (id, data) => {
        set((state) => ({ payments: state.payments.map((p) => p.id === id ? { ...p, ...data } : p) }))
        const clubId = getClubId()
        const updated = get().payments.find((p) => p.id === id)
        if (clubId && updated) syncDoc('payments', id, updated as any, clubId)
      },

      deletePayment: (id) => {
        set((state) => ({ payments: state.payments.filter((p) => p.id !== id) }))
        deleteFirestoreDoc('payments', id)
      },

      deleteEventPayment: (id) => {
        set((state) => ({ eventPayments: state.eventPayments.filter((p) => p.id !== id) }))
        deleteFirestoreDoc('eventPayments', id)
      },

      deletePrivateLessonPayment: (id) => {
        set((state) => ({ privateLessonPayments: state.privateLessonPayments.filter((p) => p.id !== id) }))
        deleteFirestoreDoc('privateLessonPayments', id)
      },

      markPaymentPaid: (id, method) => {
        const payment = get().payments.find((p) => p.id === id)
        if (!payment || payment.status === 'pagado') return
        const now = new Date()
        const { userName } = getCurrentUser()
        set((state) => ({
          payments: state.payments.map((p) => p.id === id ? { ...p, status: 'pagado' as PaymentStatus, paidDate: now, paymentMethod: method, registeredBy: userName } : p)
        }))
        const clubId = getClubId()
        const updated = get().payments.find((p) => p.id === id)
        if (clubId && updated) syncDoc('payments', id, updated as any, clubId)
      },

      markEventPaymentPaid: (id, method) => {
        const payment = get().eventPayments.find((p) => p.id === id)
        if (!payment || payment.status === 'pagado') return
        const now = new Date()
        const { userName } = getCurrentUser()
        set((state) => ({
          eventPayments: state.eventPayments.map((p) => p.id === id ? { ...p, status: 'pagado' as PaymentStatus, paidDate: now, paymentMethod: method, registeredBy: userName } : p)
        }))
        const clubId = getClubId()
        const updated = get().eventPayments.find((p) => p.id === id)
        if (clubId && updated) syncDoc('eventPayments', id, updated as any, clubId)
      },

      markPrivateLessonPaymentPaid: (id, method) => {
        const payment = get().privateLessonPayments.find((p) => p.id === id)
        if (!payment || payment.status === 'pagado') return
        const now = new Date()
        const { userName } = getCurrentUser()
        set((state) => ({
          privateLessonPayments: state.privateLessonPayments.map((p) => p.id === id ? { ...p, status: 'pagado' as PaymentStatus, paidDate: now, paymentMethod: method, registeredBy: userName } : p)
        }))
        const clubId = getClubId()
        const updated = get().privateLessonPayments.find((p) => p.id === id)
        if (clubId && updated) syncDoc('privateLessonPayments', id, updated as any, clubId)
      },

      cancelPayment: (id) => {
        set((state) => ({ payments: state.payments.map((p) => p.id === id ? { ...p, status: 'cancelado' as PaymentStatus } : p) }))
        const clubId = getClubId()
        const updated = get().payments.find((p) => p.id === id)
        if (clubId && updated) syncDoc('payments', id, updated as any, clubId)
      },

      revertPaymentPaidStatus: (id, source) => {
        let collectionName: 'payments' | 'eventPayments' | 'privateLessonPayments' = 'payments'
        if (source === 'evento') collectionName = 'eventPayments'
        if (source === 'clase_particular') collectionName = 'privateLessonPayments'

        set((state) => {
          if (collectionName === 'payments') {
            return { payments: state.payments.map((p) => p.id === id ? { ...p, status: 'pendiente', paidDate: undefined, paymentMethod: undefined, registeredBy: undefined } : p) }
          } else if (collectionName === 'eventPayments') {
            return { eventPayments: state.eventPayments.map((p) => p.id === id ? { ...p, status: 'pendiente', paidDate: undefined, paymentMethod: undefined, registeredBy: undefined } : p) }
          } else {
            return { privateLessonPayments: state.privateLessonPayments.map((p) => p.id === id ? { ...p, status: 'pendiente', paidDate: undefined, paymentMethod: undefined, registeredBy: undefined } : p) }
          }
        })

        const clubId = getClubId()
        if (clubId) {
          // Send nulls to explicitly clear fields in Firestore
          syncDoc(collectionName, id, {
            status: 'pendiente',
            paidDate: null,
            paymentMethod: null,
            registeredBy: null
          } as any, clubId)
        }
      },

      generateMonthlyReceipts: async (month, year) => {
        const clubId = getClubId()
        const userId = useAuthStore.getState().user?.id

        if (!clubId || !userId) {
          console.error('[generateMonthlyReceipts] No clubId or userId found')
          return 0
        }

        try {
          // Usar generación atómica server-side para prevenir duplicados
          const count = await generateMonthlyReceiptsAtomic(clubId, month, year, userId, generateId)

          console.info(`[generateMonthlyReceipts] Generated ${count} receipts for ${month}/${year}`)
          if (count > 0) {
            toast.success(`${count} recibos generados correctamente`)
          }

          // Los listeners onSnapshot actualizarán el store automáticamente
          return count
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Error desconocido'
          console.error('[generateMonthlyReceipts] Failed:', message)

          // Silenciar si ya fueron generados (es esperado)
          if (!message.includes('ya han sido generados') && !message.includes('en proceso')) {
            toast.error(`Error al generar recibos: ${message}`)
          }

          return 0
        }
      },

      checkAndAutoGenerateReceipts: async () => {
        const now = new Date()
        const month = now.getMonth() + 1
        const year = now.getFullYear()

        try {
          const clubId = getClubId()
          const userId = useAuthStore.getState().user?.id

          if (!clubId || !userId) return

          // Usar generación atómica server-side (las funciones lanzan error si ya están generados)
          const count = await generateMonthlyReceiptsAtomic(clubId, month, year, userId, generateId)

          if (count > 0) {
            console.info(`[AutoGenerate] Successfully generated ${count} receipts for ${month}/${year}`)
            toast.success(`Se han generado ${count} recibos automáticamente para este mes.`)

            const { userName } = getCurrentUser()
            get().addActivity({
              type: 'system_action',
              description: `Generación automática de ${count} recibos del mes ${month}/${year}`,
              relatedEntityId: 'system',
              userId: 'system',
              userName: 'Sistema',
            })
          }
        } catch (error) {
          // Silenciar errores en auto-generación (no iniciada por usuario)
          console.warn('[checkAndAutoGenerateReceipts] Failed (silent):', error)
        }
      },

      addAttendanceRecord: (recordData) => {
        const clubId = getClubId()

        // Guard: prevent duplicate attendance records for the same group/day
        const recordDateStr = toISODate(recordData.date)
        const duplicate = get().attendance.find((a) => {
          const d = toISODate(a.date)
          return a.groupId === recordData.groupId && d === recordDateStr
        })
        if (duplicate) {
          console.warn('[addAttendanceRecord] Duplicate record detected. Update the existing record instead:', duplicate.id)
          return
        }

        const newRecord: AttendanceRecord = { ...recordData, id: generateId(), createdAt: new Date() }

        // Collect all players affected by this new record
        const affectedPlayerIds = new Set(recordData.records.map((e) => e.playerId))

        set((state) => {
          const newAttendance = [...state.attendance, newRecord]
          const players = state.players.map((p) => {
            if (!affectedPlayerIds.has(p.id)) return p
            const newCredits = computePlayerRecoveryBalance(p.id, newAttendance)
            if (newCredits === (p.recoveryCredits ?? 0)) return p
            return { ...p, recoveryCredits: newCredits, updatedAt: new Date() }
          })
          return { attendance: newAttendance, players }
        })

        if (clubId) {
          syncDoc('attendance', newRecord.id, newRecord as any, clubId)
          get().players
            .filter((p) => affectedPlayerIds.has(p.id))
            .forEach((p) => syncDoc('players', p.id, p as any, clubId))
        }
        const { userName } = getCurrentUser()
        get().addActivity({ type: 'attendance_recorded', description: `Asistencia: ${recordData.groupName}`, relatedEntityId: newRecord.id, userId: 'sys', userName })
      },

      updateAttendanceRecord: (id, data) => {
        const oldRecord = get().attendance.find((a) => a.id === id)

        set((state) => ({ attendance: state.attendance.map((a) => a.id === id ? { ...a, ...data } : a) }))

        const clubId = getClubId()
        const updated = get().attendance.find((a) => a.id === id)
        if (clubId && updated) syncDoc('attendance', id, updated as any, clubId)

        // Recompute credits for all players affected by old or new records
        if (data.records && oldRecord) {
          const affectedPlayerIds = new Set([
            ...oldRecord.records.map((e) => e.playerId),
            ...data.records.map((e) => e.playerId),
          ])
          const clubId2 = getClubId()
          set((state) => ({
            players: state.players.map((p) => {
              if (!affectedPlayerIds.has(p.id)) return p
              const newCredits = computePlayerRecoveryBalance(p.id, state.attendance)
              if (newCredits === (p.recoveryCredits ?? 0)) return p
              return { ...p, recoveryCredits: newCredits, updatedAt: new Date() }
            }),
          }))
          if (clubId2) {
            get().players
              .filter((p) => affectedPlayerIds.has(p.id))
              .forEach((p) => syncDoc('players', p.id, p as any, clubId2))
          }
        }
      },

      deleteAttendanceRecord: (id) => {
        const record = get().attendance.find((a) => a.id === id)
        const affectedPlayerIds = new Set(record?.records.map((e) => e.playerId) ?? [])

        set((state) => ({ attendance: state.attendance.filter((a) => a.id !== id) }))
        deleteFirestoreDoc('attendance', id)

        // Recompute credits for affected players after deletion
        if (affectedPlayerIds.size > 0) {
          const clubId = getClubId()
          set((state) => ({
            players: state.players.map((p) => {
              if (!affectedPlayerIds.has(p.id)) return p
              const newCredits = computePlayerRecoveryBalance(p.id, state.attendance)
              if (newCredits === (p.recoveryCredits ?? 0)) return p
              return { ...p, recoveryCredits: newCredits, updatedAt: new Date() }
            }),
          }))
          if (clubId) {
            get().players
              .filter((p) => affectedPlayerIds.has(p.id))
              .forEach((p) => syncDoc('players', p.id, p as any, clubId))
          }
        }
      },

      // --- Invoices ---

      addInvoice: async (invoiceData, newPayments?: Payment[]) => {
        const { userId, userName } = getCurrentUser()
        const newInvoice: Invoice = {
          ...invoiceData,
          id: generateId(),
          createdAt: new Date(),
          createdBy: userId,
        }

        // Optimistic update
        set((state) => ({
          invoices: [...state.invoices, newInvoice],
          // Si hay nuevos pagos manuales, los añadimos al estado optimista también
          ...(newPayments && newPayments.length > 0
            ? { payments: [...state.payments, ...newPayments.map(p => ({ ...p, invoiceId: newInvoice.id }))] }
            : {})
        }))

        const clubId = getClubId()
        if (!clubId) {
          throw new Error('No club ID found')
        }

        try {
          // Transacción atómica: crear invoice + actualizar (o insertar nuevos) payments + incrementar contador
          await createInvoiceAtomic(newInvoice, invoiceData.paymentIds, clubId, newPayments)

          // Actualizar contador local para evitar números duplicados en la misma sesión
          // (el onSnapshot lo reconciliará desde Firestore eventualmente)
          const invoiceYear = new Date().getFullYear()
          const invoiceSeries = invoiceData.series
          set((state) => ({
            club: state.club ? {
              ...state.club,
              invoiceCounters: {
                ...state.club.invoiceCounters,
                [invoiceYear]: {
                  ...state.club.invoiceCounters?.[invoiceYear],
                  [invoiceSeries]: (state.club.invoiceCounters?.[invoiceYear]?.[invoiceSeries as 'FC' | 'FR'] ?? 0) + 1,
                },
              },
            } : null,
          }))

          // Activity log
          get().addActivity({
            type: 'invoice_created',
            description: `Factura ${newInvoice.invoiceNumber} generada para ${invoiceData.playerName}`,
            relatedEntityId: newInvoice.id,
            userId,
            userName,
          })

          toast.success(`Factura ${newInvoice.invoiceNumber} creada correctamente`)
        } catch (error) {
          // Rollback optimistic update completo
          set((state) => ({
            invoices: state.invoices.filter((i) => i.id !== newInvoice.id),
            ...(newPayments && newPayments.length > 0
              ? { payments: state.payments.filter((p) => !newPayments.some((np) => np.id === p.id)) }
              : {})
          }))

          const message = error instanceof Error ? error.message : 'Error desconocido'
          console.error('[addInvoice] Failed:', message)
          toast.error(`Error al crear factura: ${message}`)
          throw error
        }
      },

      updateInvoice: (id, data) => {
        const { userId, userName } = getCurrentUser()
        set((state) => ({
          invoices: state.invoices.map((i) => (i.id === id ? { ...i, ...data } : i)),
        }))

        const clubId = getClubId()
        const updated = get().invoices.find((i) => i.id === id)
        if (clubId && updated) {
          syncDoc('invoices', id, updated as any, clubId)

          // Activity log para cambios de estado importantes
          if (data.status) {
            let activityType: ActivityType = 'invoice_created'
            let description = ''

            if (data.status === 'issued') {
              activityType = 'invoice_issued'
              description = `Factura ${updated.invoiceNumber} emitida`
            } else if (data.status === 'paid') {
              activityType = 'invoice_paid'
              description = `Factura ${updated.invoiceNumber} marcada como pagada`
            } else if (data.status === 'cancelled') {
              activityType = 'invoice_cancelled'
              description = `Factura ${updated.invoiceNumber} cancelada`
            }

            if (description) {
              get().addActivity({
                type: activityType,
                description,
                relatedEntityId: id,
                userId,
                userName,
              })
            }
          }
        }
      },

      deleteInvoice: (id) => {
        const invoice = get().invoices.find((i) => i.id === id)
        if (invoice) {
          // Desvincular pagos primero
          get().unlinkPaymentsFromInvoice(id)
        }

        set((state) => ({ invoices: state.invoices.filter((i) => i.id !== id) }))
        deleteFirestoreDoc('invoices', id)
      },

      unlinkPaymentsFromInvoice: async (invoiceId) => {
        const invoice = get().invoices.find((i) => i.id === invoiceId)
        if (!invoice) return

        const clubId = getClubId()
        if (!clubId) return

        // Actualizar payments eliminando invoiceId
        for (const paymentId of invoice.paymentIds) {
          // Buscar en payments
          const payment = get().payments.find((p) => p.id === paymentId)
          if (payment) {
            get().updatePayment(paymentId, { invoiceId: undefined })
            continue
          }

          // Buscar en eventPayments
          const eventPayment = get().eventPayments.find((p) => p.id === paymentId)
          if (eventPayment) {
            get().updateEventPayment(paymentId, { invoiceId: undefined })
            continue
          }

          // Buscar en privateLessonPayments
          const lessonPayment = get().privateLessonPayments.find((p) => p.id === paymentId)
          if (lessonPayment) {
            get().updatePrivateLessonPayment(paymentId, { invoiceId: undefined })
          }
        }
      },

      addActivity: (activityData) => {
        const newActivity: Activity = { ...activityData, id: generateId(), createdAt: new Date() }
        set((state) => ({ activities: [newActivity, ...state.activities] }))
        const clubId = getClubId()
        if (clubId) syncDoc('activities', newActivity.id, newActivity as any, clubId)
      },

      addPrivateLesson: (lessonData) => {
        const newId = generateId()
        const newLesson: PrivateLesson = { ...lessonData, id: newId, createdAt: new Date() }
        set((state) => ({ privateLessons: [...state.privateLessons, newLesson] }))
        const clubId = getClubId()
        if (clubId) syncDoc('privateLessons', newId, newLesson as any, clubId)
        const { userId, userName } = getCurrentUser()
        get().addActivity({
          type: 'lesson_created',
          description: `Clase particular creada con ${lessonData.coachName} (${lessonData.playerNames.join(', ')})`,
          relatedEntityId: newId,
          userId,
          userName,
        })
        return newId
      },

      updatePrivateLesson: (id, data) => {
        set((state) => ({ privateLessons: state.privateLessons.map((l) => l.id === id ? { ...l, ...data } : l) }))
        const clubId = getClubId()
        const updated = get().privateLessons.find((l) => l.id === id)
        if (clubId && updated) syncDoc('privateLessons', id, updated as any, clubId)
        const { userId, userName } = getCurrentUser()
        get().addActivity({
          type: 'lesson_updated',
          description: `Clase particular actualizada (${updated?.coachName || id})`,
          relatedEntityId: id,
          userId,
          userName,
        })
      },

      deletePrivateLesson: (id) => {
        const lesson = get().privateLessons.find((l) => l.id === id)
        const paymentsToDelete = get().privateLessonPayments.filter((p) => p.lessonId === id).map((p) => p.id)
        set((state) => ({ privateLessons: state.privateLessons.filter((l) => l.id !== id), privateLessonPayments: state.privateLessonPayments.filter((p) => p.lessonId !== id) }))
        deleteFirestoreDoc('privateLessons', id)
        paymentsToDelete.forEach((pid) => deleteFirestoreDoc('privateLessonPayments', pid))
        const { userId, userName } = getCurrentUser()
        get().addActivity({
          type: 'lesson_deleted',
          description: `Clase particular eliminada (${lesson?.coachName || id} - ${lesson?.date ? new Date(lesson.date).toLocaleDateString('es-ES') : ''})`,
          relatedEntityId: id,
          userId,
          userName,
        })
      },

      addPrivateLessonPayment: (paymentData) => {
        const newPayment: PrivateLessonPayment = { ...paymentData, id: generateId(), createdAt: new Date() }
        set((state) => ({ privateLessonPayments: [...state.privateLessonPayments, newPayment] }))
        const clubId = getClubId()
        if (clubId) syncDoc('privateLessonPayments', newPayment.id, newPayment as any, clubId)
      },

      updatePrivateLessonPayment: (id, data) => {
        set((state) => ({ privateLessonPayments: state.privateLessonPayments.map((p) => p.id === id ? { ...p, ...data } : p) }))
        const clubId = getClubId()
        const updated = get().privateLessonPayments.find((p) => p.id === id)
        if (clubId && updated) syncDoc('privateLessonPayments', id, updated as any, clubId)
      },

      deletePrivateLessonPaymentsByLesson: (lessonId) => {
        const paymentsToDelete = get().privateLessonPayments.filter((p) => p.lessonId === lessonId).map((p) => p.id)
        set((state) => ({ privateLessonPayments: state.privateLessonPayments.filter((p) => p.lessonId !== lessonId) }))
        paymentsToDelete.forEach((pid) => deleteFirestoreDoc('privateLessonPayments', pid))
      },

      addInvitation: (invitationData) => {
        // Usar token como ID para consistencia con Firestore
        const newI: Invitation = { ...invitationData, id: invitationData.token }
        set((state) => ({ invitations: [...state.invitations, newI] }))
        const clubId = getClubId()
        if (clubId) syncDoc('invitations', invitationData.token, newI as any, clubId)
      },

      updateInvitation: (id, data) => {
        set((state) => ({ invitations: state.invitations.map((i) => i.id === id ? { ...i, ...data } : i) }))
        const clubId = getClubId()
        const updated = get().invitations.find((i) => i.id === id)
        if (clubId && updated) syncDoc('invitations', id, updated as any, clubId)
      },

      deleteInvitation: (id) => {
        set((state) => ({ invitations: state.invitations.filter((i) => i.id !== id) }))
        deleteFirestoreDoc('invitations', id)
      },

      addEvent: (eventData) => {
        const newId = generateId()
        const newEvent: AcademyEvent = { ...eventData, id: newId, createdAt: new Date() }
        set((state) => ({ events: [...state.events, newEvent] }))
        const clubId = getClubId()
        if (clubId) syncDoc('events', newId, newEvent as any, clubId)
        const { userId, userName } = getCurrentUser()
        get().addActivity({
          type: 'event_created',
          description: `Se creó el evento "${eventData.name}"`,
          relatedEntityId: newId,
          userId,
          userName,
        })
        return newId
      },

      updateEvent: (id, data) => {
        set((state) => ({ events: state.events.map((e) => e.id === id ? { ...e, ...data } : e) }))
        const clubId = getClubId()
        const updated = get().events.find((e) => e.id === id)
        if (clubId && updated) syncDoc('events', id, updated as any, clubId)
        const { userId, userName } = getCurrentUser()
        get().addActivity({
          type: 'event_updated',
          description: `Se actualizó el evento "${updated?.name || id}"`,
          relatedEntityId: id,
          userId,
          userName,
        })
      },

      deleteEvent: (id) => {
        const event = get().events.find((e) => e.id === id)
        const paymentsToDelete = get().eventPayments.filter((p) => p.eventId === id).map((p) => p.id)
        set((state) => ({ events: state.events.filter((e) => e.id !== id), eventPayments: state.eventPayments.filter((p) => p.eventId !== id) }))
        deleteFirestoreDoc('events', id)
        paymentsToDelete.forEach((pid) => deleteFirestoreDoc('eventPayments', pid))
        const { userId, userName } = getCurrentUser()
        get().addActivity({
          type: 'event_deleted',
          description: `Se eliminó el evento "${event?.name || id}"`,
          relatedEntityId: id,
          userId,
          userName,
        })
      },

      addEventPayment: (paymentData) => {
        const newPayment: EventPayment = { ...paymentData, id: generateId(), createdAt: new Date() }
        set((state) => ({ eventPayments: [...state.eventPayments, newPayment] }))
        const clubId = getClubId()
        if (clubId) syncDoc('eventPayments', newPayment.id, newPayment as any, clubId)
      },

      updateEventPayment: (id, data) => {
        set((state) => ({ eventPayments: state.eventPayments.map((p) => p.id === id ? { ...p, ...data } : p) }))
        const clubId = getClubId()
        const updated = get().eventPayments.find((p) => p.id === id)
        if (clubId && updated) syncDoc('eventPayments', id, updated as any, clubId)
      },

      addEvaluation: (evaluationData) => {
        const now = new Date()
        const newE: Evaluation = { ...evaluationData, id: generateId(), createdAt: now, updatedAt: now }
        set((state) => ({ evaluations: [...state.evaluations, newE] }))
        const clubId = getClubId()
        if (clubId) syncDoc('evaluations', newE.id, newE as any, clubId)
      },

      updateEvaluation: (id, data) => {
        set((state) => ({ evaluations: state.evaluations.map((e) => e.id === id ? { ...e, ...data, updatedAt: new Date() } : e) }))
        const clubId = getClubId()
        const updated = get().evaluations.find((e) => e.id === id)
        if (clubId && updated) syncDoc('evaluations', id, updated as any, clubId)
      },

      deleteEvaluation: (id) => {
        const evaluation = get().evaluations.find((e) => e.id === id)
        set((state) => ({ evaluations: state.evaluations.filter((e) => e.id !== id) }))
        deleteFirestoreDoc('evaluations', id)
        const { userId, userName } = getCurrentUser()
        get().addActivity({
          type: 'evaluation_deleted',
          description: `Evaluación eliminada (${evaluation?.playerName || id})`,
          relatedEntityId: id,
          userId,
          userName,
        })
      },

      addMatchReport: (reportData) => {
        const now = new Date()
        const newR: MatchReport = { ...reportData, id: generateId(), createdAt: now, updatedAt: now }
        set((state) => ({ matchReports: [...state.matchReports, newR] }))
        const clubId = getClubId()
        if (clubId) syncDoc('matchReports', newR.id, newR as any, clubId)
      },

      updateMatchReport: (id, data) => {
        set((state) => ({ matchReports: state.matchReports.map((r) => r.id === id ? { ...r, ...data, updatedAt: new Date() } : r) }))
        const clubId = getClubId()
        const updated = get().matchReports.find((r) => r.id === id)
        if (clubId && updated) syncDoc('matchReports', id, updated as any, clubId)
      },

      deleteMatchReport: (id) => {
        const report = get().matchReports.find((r) => r.id === id)
        set((state) => ({ matchReports: state.matchReports.filter((r) => r.id !== id) }))
        deleteFirestoreDoc('matchReports', id)
        const { userId, userName } = getCurrentUser()
        get().addActivity({
          type: 'match_report_deleted',
          description: `Informe de partido eliminado (${report?.title || id})`,
          relatedEntityId: id,
          userId,
          userName,
        })
      },

      updateCoachSalaryConfig: (coachId, config) => {
        const existing = get().coachSalaryConfigs.find((c) => c.coachId === coachId)
        if (existing) {
          set((state) => ({ coachSalaryConfigs: state.coachSalaryConfigs.map((c) => c.coachId === coachId ? { ...c, ...config } : c) }))
        } else {
          const newConfig = {
            coachId,
            ratePerGroup: config.ratePerGroup || 0,
            ratePerPrivateLesson: config.ratePerPrivateLesson || 0,
            bonuses: config.bonuses || 0,
            notes: config.notes,
          }
          set((state) => ({ coachSalaryConfigs: [...state.coachSalaryConfigs, newConfig] }))
        }

        const clubId = getClubId()
        const updated = get().coachSalaryConfigs.find((c) => c.coachId === coachId)
        if (clubId && updated) syncDoc('coachSalaryConfigs', coachId, updated as any, clubId)
      },

      cleanupOrphanedPayments: () => {
        const { events, eventPayments, privateLessons, privateLessonPayments } = get()
        const eventIds = new Set(events.map((e) => e.id))
        const lessonIds = new Set(privateLessons.map((l) => l.id))
        set((state) => ({
          eventPayments: state.eventPayments.filter((p) => eventIds.has(p.eventId)),
          privateLessonPayments: state.privateLessonPayments.filter((p) => lessonIds.has(p.lessonId)),
        }))
      },

      deleteAllPayments: async () => {
        const clubId = getClubId()
        if (!clubId) return
        const { payments, eventPayments, privateLessonPayments } = get()
        set({ payments: [], eventPayments: [], privateLessonPayments: [] })
        const collections = ['payments', 'eventPayments', 'privateLessonPayments']
        for (const coll of collections) {
          const list = coll === 'payments' ? payments : coll === 'eventPayments' ? eventPayments : privateLessonPayments
          for (const item of list) await deleteFirestoreDoc(coll, item.id)
        }
      }
    }),
    {
      name: 'san-javier-academy-config',
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          if (!str) return null
          return JSON.parse(str, dateReviver)
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value))
        },
        removeItem: (name) => {
          localStorage.removeItem(name)
        },
      },
      partialize: (state) => ({
        club: state.club,
        courts: state.courts,
        tariffs: state.tariffs,
        players: state.players,
        coaches: state.coaches,
        groups: state.groups,
        enrollments: state.enrollments,
        payments: state.payments.map(p => ({
          ...p,
          createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
          dueDate: p.dueDate instanceof Date ? p.dueDate.toISOString() : p.dueDate,
          paidDate: p.paidDate instanceof Date ? p.paidDate.toISOString() : p.paidDate,
        })),
        attendance: state.attendance,
        activities: state.activities,
        privateLessons: state.privateLessons,
        invitations: state.invitations,
        events: state.events,
        eventPayments: state.eventPayments.map(p => ({
          ...p,
          createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
          paidDate: p.paidDate instanceof Date ? p.paidDate.toISOString() : p.paidDate,
        })),
        privateLessonPayments: state.privateLessonPayments.map(p => ({
          ...p,
          createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
          paidDate: p.paidDate instanceof Date ? p.paidDate.toISOString() : p.paidDate,
        })),
        evaluations: state.evaluations,
        matchReports: state.matchReports,
        coachSalaryConfigs: state.coachSalaryConfigs,
        invoices: state.invoices.map(i => ({
          ...i,
          createdAt: i.createdAt instanceof Date ? i.createdAt.toISOString() : i.createdAt,
          dueDate: i.dueDate instanceof Date ? i.dueDate.toISOString() : i.dueDate,
        })),
        users: state.users,
      } as unknown as DataState)
    }
  )
)
