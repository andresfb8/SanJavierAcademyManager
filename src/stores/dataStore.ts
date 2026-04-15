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
  Holiday,
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
import { doc, getDoc, getDocs, query, collection, where, limit, deleteDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { toast } from '@/hooks/use-toast'
import { queryClient } from '@/lib/queryClient'

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
  privateLessons: PrivateLesson[]
  invitations: Invitation[]
  events: AcademyEvent[]
  coachSalaryConfigs: CoachSalaryConfig[]
  users: AppUser[]
  holidays: Holiday[]

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
  addAttendanceRecord: (...args: any[]) => any
  updateAttendanceRecord: (...args: any[]) => any
  addInvoice: (...args: any[]) => any
  updateInvoice: (...args: any[]) => any
  unlinkPaymentsFromInvoice: (...args: any[]) => any
  deleteInvoice: (...args: any[]) => any
  addHolidayStore: (...args: any[]) => any
  deleteHolidayStore: (...args: any[]) => any
  updateInvitation: (...args: any[]) => any
  addInvitation: (...args: any[]) => any
  deleteInvitation: (...args: any[]) => any
  addPrivateLesson: (...args: any[]) => any
  updatePrivateLesson: (...args: any[]) => any
  deletePrivateLesson: (...args: any[]) => any
  addPrivateLessonPayment: (...args: any[]) => any
  updatePrivateLessonPayment: (...args: any[]) => any
  addEvent: (...args: any[]) => any
  updateEvent: (...args: any[]) => any
  deleteEvent: (...args: any[]) => any
  addEventPayment: (...args: any[]) => any
  updateEventPayment: (...args: any[]) => any
  updateCoachSalaryConfig: (...args: any[]) => any
  addEvaluation: (...args: any[]) => any
  deleteEvaluation: (...args: any[]) => any
  addMatchReport: (...args: any[]) => any
  deleteMatchReport: (...args: any[]) => any
  addActivity: (...args: any[]) => any
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
      privateLessons: [],
      invitations: [],
      events: [],
      coachSalaryConfigs: [],
      users: [],
      holidays: [],
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
        const enrollmentsToDelete = get().enrollments.filter((e) => e.playerId === id).map((e: any) => e.id)
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
        const affectedGroupIds = activeEnrollments.map((e: any) => e.groupId)

        set((prevState) => ({
          enrollments: prevState.enrollments.map((e) =>
            e.playerId === playerId && e.isActive ? { ...e, isActive: false, unenrollmentDate: today } : e
          ),
          groups: prevState.groups.map((g) =>
            affectedGroupIds.includes(g.id) ? { ...g, currentEnrollment: Math.max(0, g.currentEnrollment - 1) } : g
          ),
        }))

        if (currentDay <= CANCELLATION_DEADLINE_DAY) {
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
          enrollments: state.enrollments.map((e: any) => e.groupId === id ? { ...e, isActive: false } : e),
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
        try {
          await syncDoc('payments', paymentId, newPayment as any, clubId)
        queryClient.invalidateQueries({ queryKey: ['payments'] });
          toast.success(`Recibo parcial de ${amount}€ generado correctamente`)
        } catch (error) {
          // Rollback
          const msg = error instanceof Error ? error.message : 'Error al guardar el recibo parcial'
          toast.error(msg)
          throw error
        }
      },

      updateEnrollment: (id, data) => {
        set((state) => ({ enrollments: state.enrollments.map((e: any) => e.id === id ? { ...e, ...data } : e) }))
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
            const paymentsSnap = await getDocs(
              query(
                collection(db, 'payments'),
                where('clubId', '==', clubId),
                where('enrollmentId', '==', id),
                where('status', '==', 'pendiente'),
                where('billingMonth', '==', unenrollMonth),
                where('billingYear', '==', unenrollYear)
              )
            );

            if (!paymentsSnap.empty) {
              // Delete from firestore in parallel
              await Promise.all(
                paymentsSnap.docs.map((d) => deleteFirestoreDoc('payments', d.id))
              )
              queryClient.invalidateQueries({ queryKey: ['payments'] });
              console.info(`[deactivateEnrollment] Deleted ${paymentsSnap.docs.length} pending receipts for month ${unenrollMonth}`)
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
        const clubId = getClubId()
        if (clubId) syncDoc('payments', newPayment.id, newPayment as any, clubId)
        queryClient.invalidateQueries({ queryKey: ['payments'] });
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
        const clubId = getClubId()
        if (clubId) syncDoc('payments', newPayment.id, newPayment as any, clubId)
        queryClient.invalidateQueries({ queryKey: ['payments'] });
      },

      updatePayment: (id, data) => {
        const clubId = getClubId()
        if (clubId) syncDoc('payments', id, data as any, clubId, { merge: true })
        queryClient.invalidateQueries({ queryKey: ['payments'] });
      },

      deletePayment: (id) => {
        deleteFirestoreDoc('payments', id)
        queryClient.invalidateQueries({ queryKey: ['payments'] });
      },

      deleteEventPayment: (id) => {
        deleteFirestoreDoc('eventPayments', id)
        queryClient.invalidateQueries({ queryKey: ['eventPayments'] });
      },

      deletePrivateLessonPayment: (id) => {
        deleteFirestoreDoc('privateLessonPayments', id)
        queryClient.invalidateQueries({ queryKey: ['privateLessonPayments'] });
      },

      markPaymentPaid: (id, method) => {
        const now = new Date()
        const { userName } = getCurrentUser()
        const clubId = getClubId()
        if (clubId) {
          syncDoc('payments', id, { status: 'pagado', paymentMethod: method, paidDate: now, registeredBy: userName } as any, clubId, { merge: true })
          queryClient.invalidateQueries({ queryKey: ['payments'] });
        }
      },

      markEventPaymentPaid: (id, method) => {
        const now = new Date()
        const { userName } = getCurrentUser()
        const clubId = getClubId()
        if (clubId) {
          syncDoc('eventPayments', id, { status: 'pagado', paymentMethod: method, paidDate: now, registeredBy: userName } as any, clubId, { merge: true })
          queryClient.invalidateQueries({ queryKey: ['eventPayments'] });
        }
      },

      markPrivateLessonPaymentPaid: (id, method) => {
        const now = new Date()
        const { userName } = getCurrentUser()
        const clubId = getClubId()
        if (clubId) {
          syncDoc('privateLessonPayments', id, { status: 'pagado', paymentMethod: method, paidDate: now, registeredBy: userName } as any, clubId, { merge: true })
          queryClient.invalidateQueries({ queryKey: ['privateLessonPayments'] });
        }
      },

      cancelPayment: (id) => {
        const clubId = getClubId()
        if (clubId) {
          syncDoc('payments', id, { status: 'cancelado' } as any, clubId, { merge: true })
          queryClient.invalidateQueries({ queryKey: ['payments'] });
        }
      },

      revertPaymentPaidStatus: (id, source) => {
        let collectionName: 'payments' | 'eventPayments' | 'privateLessonPayments' = 'payments'
        if (source === 'evento') collectionName = 'eventPayments'
        if (source === 'clase_particular') collectionName = 'privateLessonPayments'

        const clubId = getClubId()
        if (clubId) {
          // Send nulls to explicitly clear fields in Firestore
          syncDoc(collectionName, id, {
            status: 'pendiente',
            paidDate: null,
            paymentMethod: null,
            registeredBy: null
          } as any, clubId, { merge: true })
          queryClient.invalidateQueries({ queryKey: [collectionName] })
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
        const newRecord: AttendanceRecord = { ...recordData, id: generateId(), createdAt: new Date() }
        if (clubId) syncDoc('attendance', newRecord.id, newRecord as any, clubId)
        queryClient.invalidateQueries({ queryKey: ['attendance'] })
      },
      updateAttendanceRecord: (id, data) => {
        const clubId = getClubId()
        if (clubId) syncDoc('attendance', id, data as any, clubId, { merge: true })
        queryClient.invalidateQueries({ queryKey: ['attendance'] });
        // En la versión con queryClient la actualización del store (recoveryCredits) es delegada al lado de vista/consultas o hooks dedicados.
      },

      deleteAttendanceRecord: (id: string) => {
        deleteFirestoreDoc('attendance', id)
        queryClient.invalidateQueries({ queryKey: ['attendance'] })
      },
      addActivity: (activityData) => {
        const newActivity: Activity = { ...activityData, id: generateId(), createdAt: new Date() }
        const clubId = getClubId()
        if (clubId) syncDoc('activities', newActivity.id, newActivity as any, clubId)
        queryClient.invalidateQueries({ queryKey: ['activities'] });
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

      updatePrivateLesson: (id: string, data: any) => {
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

      deletePrivateLesson: async (id: string) => {
        const lesson = get().privateLessons.find((l) => l.id === id)
        set((state) => ({ privateLessons: state.privateLessons.filter((l) => l.id !== id) }))
        deleteFirestoreDoc('privateLessons', id)
        
        const clubId = getClubId()
        if (clubId) {
          const paymentsSnap = await getDocs(query(collection(db, 'privateLessonPayments'), where('clubId', '==', clubId), where('lessonId', '==', id)))
          paymentsSnap.docs.forEach((d) => deleteFirestoreDoc('privateLessonPayments', d.id))
          queryClient.invalidateQueries({ queryKey: ['privateLessonPayments'] });
        }
        
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
        const clubId = getClubId()
        if (clubId) syncDoc('privateLessonPayments', newPayment.id, newPayment as any, clubId)
        queryClient.invalidateQueries({ queryKey: ['privateLessonPayments'] });
      },

      updatePrivateLessonPayment: (id, data) => {
        const clubId = getClubId()
        if (clubId) syncDoc('privateLessonPayments', id, data as any, clubId, { merge: true })
        queryClient.invalidateQueries({ queryKey: ['privateLessonPayments'] });
      },

      deletePrivateLessonPaymentsByLesson: async (lessonId: string) => {
        const clubId = getClubId()
        if (clubId) {
          const paymentsSnap = await getDocs(query(collection(db, 'privateLessonPayments'), where('clubId', '==', clubId), where('lessonId', '==', lessonId)))
          paymentsSnap.docs.forEach((doc) => deleteFirestoreDoc('privateLessonPayments', doc.id))
          queryClient.invalidateQueries({ queryKey: ['privateLessonPayments'] });
        }
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
        set((state) => ({ events: state.events.map((e: any) => e.id === id ? { ...e, ...data } : e) }))
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

      deleteEvent: async (id) => {
        const event = get().events.find((e) => e.id === id)
        set((state) => ({ events: state.events.filter((e) => e.id !== id) }))
        deleteFirestoreDoc('events', id)
        
        const clubId = getClubId()
        if (clubId) {
          const paymentsSnap = await getDocs(query(collection(db, 'eventPayments'), where('clubId', '==', clubId), where('eventId', '==', id)))
          paymentsSnap.docs.forEach((doc) => deleteFirestoreDoc('eventPayments', doc.id))
          queryClient.invalidateQueries({ queryKey: ['eventPayments'] });
        }
        
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
        const clubId = getClubId()
        if (clubId) syncDoc('eventPayments', newPayment.id, newPayment as any, clubId)
        queryClient.invalidateQueries({ queryKey: ['eventPayments'] });
      },

      updateEventPayment: (id: string, data: any) => {
        const clubId = getClubId()
        if (clubId) syncDoc('eventPayments', id, data as any, clubId, { merge: true })
        queryClient.invalidateQueries({ queryKey: ['eventPayments'] });
      },

      addEvaluation: (evaluationData) => {
        const now = new Date()
        const newE: Evaluation = { ...evaluationData, id: generateId(), createdAt: now, updatedAt: now }
        const clubId = getClubId()
        if (clubId) syncDoc('evaluations', newE.id, newE as any, clubId)
        queryClient.invalidateQueries({ queryKey: ['evaluations'] });
      },

      updateEvaluation: (id: string, data: any) => {
        const clubId = getClubId()
        if (clubId) syncDoc('evaluations', id, data as any, clubId, { merge: true })
        queryClient.invalidateQueries({ queryKey: ['evaluations'] });
      },

      deleteEvaluation: (id) => {
        deleteFirestoreDoc('evaluations', id)
        queryClient.invalidateQueries({ queryKey: ['evaluations'] });
        const { userId, userName } = getCurrentUser()
        get().addActivity({
          type: 'evaluation_deleted',
          description: `Evaluación eliminada (${id})`,
          relatedEntityId: id,
          userId,
          userName,
        })
      },

      addMatchReport: (reportData) => {
        const now = new Date()
        const newR: MatchReport = { ...reportData, id: generateId(), createdAt: now, updatedAt: now }
        const clubId = getClubId()
        if (clubId) syncDoc('matchReports', newR.id, newR as any, clubId)
        queryClient.invalidateQueries({ queryKey: ['matchReports'] });
      },

      updateMatchReport: (id: string, data: any) => {
        const clubId = getClubId()
        if (clubId) syncDoc('matchReports', id, data as any, clubId, { merge: true })
        queryClient.invalidateQueries({ queryKey: ['matchReports'] });
      },

      deleteMatchReport: (id) => {
        deleteFirestoreDoc('matchReports', id)
        queryClient.invalidateQueries({ queryKey: ['matchReports'] });
        const { userId, userName } = getCurrentUser()
        get().addActivity({
          type: 'match_report_deleted',
          description: `Informe de partido eliminado (${id})`,
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
            ratePerGroupAdults: config.ratePerGroupAdults || 0,
            ratePerGroupMinors: config.ratePerGroupMinors || 0,
            privateLessonPaymentType: config.privateLessonPaymentType || 'fixed',
            privateLessonRate: config.privateLessonRate || 0,
            eventPaymentType: config.eventPaymentType || 'percentage',
            eventRate: config.eventRate || 0,
            bonuses: config.bonuses || 0,
            notes: config.notes,
          }
          set((state) => ({ coachSalaryConfigs: [...state.coachSalaryConfigs, newConfig] }))
        }

        const clubId = getClubId()
        const updated = get().coachSalaryConfigs.find((c) => c.coachId === coachId)
        if (clubId && updated) syncDoc('coachSalaryConfigs', coachId, updated as any, clubId, { merge: false })
      },

      cleanupOrphanedPayments: () => {},

      deleteAllPayments: async () => {},
      addInvoice: (...args: any[]) => {},
      updateInvoice: (...args: any[]) => {},
      unlinkPaymentsFromInvoice: (...args: any[]) => {},
      deleteInvoice: (...args: any[]) => {},


      // --- Holidays Actions ---
      addHolidayStore: async (date: Date, description?: string) => {
        const clubId = getClubId()
        if (!clubId) return

        const { addHoliday: addHolidayService } = await import('@/lib/settings-service')
        try {
          const id = await addHolidayService(clubId, date, description)
          // local update will be handled by realtimeSync
          console.info('[DataStore] addHoliday: Firestore OK', id)
        } catch (error) {
          console.error('[DataStore] addHoliday: FAILED', error)
          throw error
        }
      },

      deleteHolidayStore: async (id: string) => {
        const { deleteHoliday: deleteHolidayService } = await import('@/lib/settings-service')
        try {
          await deleteHolidayService(id)
          // local update will be handled by realtimeSync
        } catch (error) {
          console.error('[DataStore] deleteHoliday: FAILED', error)
          throw error
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
        privateLessons: state.privateLessons,
        invitations: state.invitations,
        events: state.events,
        coachSalaryConfigs: state.coachSalaryConfigs,
        users: state.users,
        holidays: state.holidays,
      } as unknown as DataState)
    }
  )
)
