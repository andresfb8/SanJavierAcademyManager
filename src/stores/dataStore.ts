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
  EventExpense,
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
  AttendanceNotice,
  Voucher,
  VoucherType,
  VoucherStatus,
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
  unlinkPaymentsFromInvoiceAtomic,
} from '@/lib/firestoreSync'
import { doc, getDoc, getDocs, query, collection, where, limit, deleteDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { toast } from '@/hooks/use-toast'
import { queryClient } from '@/lib/queryClient'
import { sendPlayerInvitation } from '@/lib/emailService'

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
  attendanceNotices: AttendanceNotice[]
  vouchers: Voucher[]
  payments: Payment[]
  eventPayments: EventPayment[]
  privateLessonPayments: PrivateLessonPayment[]
  invoices: Invoice[]
  attendance: AttendanceRecord[]
  activities: Activity[]
  evaluations: Evaluation[]
  matchReports: MatchReport[]

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
  addPlayer: (player: Omit<Player, 'id' | 'recoveryCredits' | 'createdAt' | 'updatedAt' | 'invitationToken' | 'inviteCode' | 'invitationStatus'>) => string
  updatePlayer: (id: string, updates: Partial<Player>) => void
  invitePlayer: (id: string) => Promise<void>
  bulkInvitePlayers: (ids: string[]) => Promise<void>
  cancelPlayer: (id: string, options?: { cancelCurrentMonthPayments: boolean }) => void
  deletePlayer: (id: string) => void

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
  deactivateEnrollment: (id: string, effectiveDate?: Date, options?: { deleteInvoice?: boolean }) => Promise<void>
  checkPendingPaymentsForEnrollment: (enrollmentId: string) => Promise<boolean>

  // --- Payments ---
  generatePartialReceipt: (enrollmentId: string, amount: number) => Promise<void>
  addPayment: (payment: Omit<Payment, 'id' | 'createdAt'>) => void
  addManualPayment: (data: { playerId: string; playerName: string; concept: string; amount: number; category?: PaymentCategory; notes?: string }) => void
  registerSeasonPayment: (data: { enrollmentId: string; startMonth: number; startYear: number; endMonth: number; endYear: number; totalAmount: number; paymentMethod: import('@/types').PaymentMethod; paidDate: Date; notes?: string }) => void
  generateScheduledInstallments: (enrollmentId: string) => number
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
  bulkGenerateInvoices: (paymentIds: string[]) => Promise<void>

  // --- Invoices ---
  addAttendanceRecord: (...args: any[]) => any
  updateAttendanceRecord: (...args: any[]) => any
  addInvoice: (invoiceData: Omit<Invoice, 'id' | 'createdAt'>, newPayments?: Payment[]) => Promise<void>
  updateInvoice: (id: string, updates: Partial<Invoice>) => Promise<void>
  unlinkPaymentsFromInvoice: (invoiceId: string) => Promise<void>
  deleteInvoice: (id: string) => Promise<void>
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
  addEventExpense: (eventId: string, expense: Omit<EventExpense, 'id'>) => void
  removeEventExpense: (eventId: string, expenseId: string) => void
  addEventPayment: (...args: any[]) => any
  updateEventPayment: (...args: any[]) => any
  updateCoachSalaryConfig: (...args: any[]) => any
  addEvaluation: (...args: any[]) => any
  deleteEvaluation: (...args: any[]) => any
  addMatchReport: (...args: any[]) => any
  deleteMatchReport: (...args: any[]) => any
  addActivity: (...args: any[]) => any

  // --- Financials (P&L) ---
  clubTransactions: import('@/types').ClubTransaction[]
  addTransaction: (transaction: Omit<import('@/types').ClubTransaction, 'id' | 'createdAt' | 'clubId' | 'registeredBy'>) => Promise<void>
  updateTransaction: (id: string, data: Partial<import('@/types').ClubTransaction>) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>
  deleteAttendanceNotice: (id: string) => void
  addAttendanceNotice: (noticeData: Omit<AttendanceNotice, 'id' | 'createdAt'>) => void

  // --- Vouchers ---
  addVoucher: (voucherData: Omit<Voucher, 'id' | 'createdAt'>) => void
  updateVoucher: (id: string, data: Partial<Voucher>) => void
  deleteVoucher: (id: string) => void
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

export function computePlayerRecoveryBalance(
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
      clubTransactions: [],
      attendanceNotices: [],
      vouchers: [],
      payments: [],
      eventPayments: [],
      privateLessonPayments: [],
      invoices: [],
      attendance: [],
      activities: [],
      evaluations: [],
      matchReports: [],

      // --- Vouchers ---
      addVoucher: (voucherData) => {
        const newVoucher: Voucher = { ...voucherData, id: generateId(), createdAt: new Date() }
        set((state) => ({ vouchers: [...state.vouchers, newVoucher] }))
        const clubId = getClubId()
        if (clubId) syncDoc('vouchers', newVoucher.id, newVoucher as any, clubId)
        const { userId, userName } = getCurrentUser()
        get().addActivity({
          type: 'payment_manual', // Reuse payment_manual for now
          description: `Se creó un bono de tipo ${voucherData.type} para ${voucherData.playerName}`,
          relatedEntityId: newVoucher.id,
          userId,
          userName,
        })
      },
      updateVoucher: (id, data) => {
        set((state) => ({
          vouchers: state.vouchers.map((v) => (v.id === id ? { ...v, ...data } : v)),
        }))
        const clubId = getClubId()
        const updated = get().vouchers.find((v) => v.id === id)
        if (clubId && updated) syncDoc('vouchers', id, updated as any, clubId)
      },
      deleteVoucher: (id) => {
        set((state) => ({ vouchers: state.vouchers.filter((v) => v.id !== id) }))
        deleteFirestoreDoc('vouchers', id)
      },

      // --- Financials (P&L) ---
      addTransaction: async (transactionData) => {
        const clubId = getClubId()
        const { userId, userName } = getCurrentUser()
        if (!clubId) {
          console.error('[addTransaction] No clubId found')
          return
        }

        const newTransaction: import('@/types').ClubTransaction = {
          ...transactionData,
          id: generateId(),
          clubId,
          registeredBy: userId,
          createdAt: new Date(),
        }

        set((state) => ({ clubTransactions: [...state.clubTransactions, newTransaction] }))
        await syncDoc('clubTransactions', newTransaction.id, newTransaction as any, clubId)

        get().addActivity({
          type: 'payment_manual', // Reuse payment_manual or create new activity type if desired
          description: `Se registró un ${newTransaction.type} de ${newTransaction.amount}€ en la categoría ${newTransaction.category}`,
          relatedEntityId: newTransaction.id,
          userId,
          userName,
        })
        queryClient.invalidateQueries({ queryKey: ['clubTransactions'] })
      },

      updateTransaction: async (id, data) => {
        set((state) => ({
          clubTransactions: state.clubTransactions.map((t) => (t.id === id ? { ...t, ...data } : t)),
        }))
        const clubId = getClubId()
        const updated = get().clubTransactions.find((t) => t.id === id)
        if (clubId && updated) await syncDoc('clubTransactions', id, updated as any, clubId)
        const { userId, userName } = getCurrentUser()
        get().addActivity({
          type: 'payment_updated', // We use existing activity type for simplicity
          description: `Se actualizó el registro financiero ${id}`,
          relatedEntityId: id,
          userId,
          userName,
        })
        queryClient.invalidateQueries({ queryKey: ['clubTransactions'] })
      },

      deleteTransaction: async (id) => {
        const transaction = get().clubTransactions.find((t) => t.id === id)
        set((state) => ({ clubTransactions: state.clubTransactions.filter((t) => t.id !== id) }))
        deleteFirestoreDoc('clubTransactions', id)
        const { userId, userName } = getCurrentUser()
        get().addActivity({
          type: 'payment_deleted',
          description: `Se eliminó el registro financiero ${transaction?.concept || id}`,
          relatedEntityId: id,
          userId,
          userName,
        })
        queryClient.invalidateQueries({ queryKey: ['clubTransactions'] })
      },

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
        const invitationToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
        const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()
        
        const newPlayer: Player = {
          ...playerData,
          id: generateId(),
          recoveryCredits: 0,
          invitationToken,
          inviteCode,
          invitationStatus: 'pending',
          createdAt: now,
          updatedAt: now,
        }
        set((state) => ({ players: [...state.players, newPlayer] }))
        const clubId = getClubId()
        if (clubId) {
          syncDoc('players', newPlayer.id, newPlayer as any, clubId)
            .then(() => {
              console.info(`[DataStore] addPlayer: ✅ Firestore OK`)
              // Automatically trigger invitation if email is present
              if (newPlayer.email) {
                get().invitePlayer(newPlayer.id)
              }
            })
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
        return newPlayer.id
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

      cancelPlayer: (playerId, options) => {
        const state = get()
        const player = state.players.find((p) => p.id === playerId)
        if (!player || player.status === 'baja') return
        const today = new Date()
        const currentMonth = today.getMonth() + 1
        const currentYear = today.getFullYear()

        // 1. Marcar jugador como baja
        set((prevState) => ({
          players: prevState.players.map((p) =>
            p.id === playerId ? { ...p, status: 'baja' as PlayerStatus, cancellationDate: today, updatedAt: today } : p
          ),
        }))

        // 2. Desactivar matrículas y actualizar contadores de grupos
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

        // 3. Cancelar recibos del mes actual si el admin lo decide
        if (options?.cancelCurrentMonthPayments) {
          const currentMonthPendingPayments = get().payments.filter(
            (p) =>
              p.playerId === playerId &&
              p.status === 'pendiente' &&
              p.billingMonth === currentMonth &&
              p.billingYear === currentYear
          )
          currentMonthPendingPayments.forEach((p) => {
            get().updatePayment(p.id, { status: 'cancelado' })
          })
        }

        // 4. Persistir cambios en Firestore
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
      
      invitePlayer: async (playerId) => {
        const player = get().players.find(p => p.id === playerId)
        if (!player || !player.email) return

        try {
          const token = player.invitationToken || (Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15))
          await sendPlayerInvitation({ name: player.firstName, email: player.email }, token)
          
          get().updatePlayer(playerId, { 
            invitationToken: token,
            invitationStatus: 'sent' 
          })
          
          toast.success(`Se ha enviado el acceso a ${player.email}`)
        } catch (error) {
          console.error('[DataStore] invitePlayer error:', error)
          toast.error(`No se pudo enviar a ${player.email}`)
        }
      },

      bulkInvitePlayers: async (playerIds) => {
        const players = get().players.filter(p => playerIds.includes(p.id) && p.email)
        if (players.length === 0) return

        toast.info(`Procesando ${players.length} correos...`)

        let successCount = 0
        for (const player of players) {
          try {
            const token = player.invitationToken || (Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15))
            await sendPlayerInvitation({ name: player.firstName, email: player.email }, token)
            
            get().updatePlayer(player.id, { 
              invitationToken: token,
              invitationStatus: 'sent' 
            })
            successCount++
          } catch (err) {
            console.error(`Failed to invite ${player.email}:`, err)
          }
        }

        if (successCount > 0) {
          toast.success(`Se han enviado ${successCount} invitaciones correctamente.`)
        } else {
          toast.error("No se pudo enviar ninguna invitación.")
        }
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

          // Auto-promoción a 'activo' si el jugador estaba en lista de espera
          if (enrollmentData.isActive) {
            const player = get().players.find((p) => p.id === enrollmentData.playerId)
            if (player && player.status === 'lista_espera') {
              get().updatePlayer(player.id, { status: 'activo' })
              console.info(`[addEnrollment] Player ${player.id} promoted to activo`)
            }
          }

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

      checkPendingPaymentsForEnrollment: async (enrollmentId: string): Promise<boolean> => {
        const clubId = getClubId()
        if (!clubId) return false
        const now = new Date()
        const currentMonth = now.getMonth() + 1
        const currentYear = now.getFullYear()
        try {
          const paymentsSnap = await getDocs(
            query(
              collection(db, 'payments'),
              where('clubId', '==', clubId),
              where('enrollmentId', '==', enrollmentId),
              where('status', '==', 'pendiente'),
              where('billingMonth', '==', currentMonth),
              where('billingYear', '==', currentYear)
            )
          )
          return !paymentsSnap.empty
        } catch {
          return false
        }
      },

      deactivateEnrollment: async (id: string, effectiveDate?: Date, options?: { deleteInvoice?: boolean }) => {
        const enrollment = get().enrollments.find((e) => e.id === id)
        if (!enrollment || !enrollment.isActive) return

        const clubId = getClubId()
        if (!clubId) {
          console.error('[deactivateEnrollment] No clubId found')
          return
        }

        const dateToUse = effectiveDate || new Date()
        const unenrollMonth = dateToUse.getMonth() + 1
        const unenrollYear = dateToUse.getFullYear()

        try {
          // Conditional Receipt Deletion based on explicit user choice (options.deleteInvoice)
          if (options?.deleteInvoice === true) {
            const paymentsSnap = await getDocs(
              query(
                collection(db, 'payments'),
                where('clubId', '==', clubId),
                where('enrollmentId', '==', id),
                where('status', '==', 'pendiente'),
                where('billingMonth', '==', unenrollMonth),
                where('billingYear', '==', unenrollYear)
              )
            )
            if (!paymentsSnap.empty) {
              await Promise.all(
                paymentsSnap.docs.map((d) => deleteFirestoreDoc('payments', d.id))
              )
              queryClient.invalidateQueries({ queryKey: ['payments'] })
              console.info(`[deactivateEnrollment] Deleted ${paymentsSnap.docs.length} pending receipts`)
            }
          }

          // Atomic transaction: update enrollment status and group counter
          await updateEnrollmentStatus(id, enrollment.groupId, false, clubId)

          // Update local state (Firestore listeners will confirm)
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

          // Mejora 1: Auto-assign 'lista_espera' if no other active enrollments remain
          const remainingActiveEnrollments = get().enrollments.filter(
            (e) => e.playerId === enrollment.playerId && e.isActive && e.id !== id
          )
          if (remainingActiveEnrollments.length === 0) {
            const player = get().players.find((p) => p.id === enrollment.playerId)
            if (player && player.status === 'activo') {
              get().updatePlayer(enrollment.playerId, { status: 'lista_espera' })
              console.info(`[deactivateEnrollment] Player ${enrollment.playerId} moved to lista_espera`)
            }
          }

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

      registerSeasonPayment: (data) => {
        const state = get()
        const enrollment = state.enrollments.find((e) => e.id === data.enrollmentId)
        if (!enrollment) return

        const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
        const { userName } = getCurrentUser()

        // Calcular los meses del periodo
        const months: { month: number; year: number }[] = []
        let m = data.startMonth
        let y = data.startYear
        while (y < data.endYear || (y === data.endYear && m <= data.endMonth)) {
          months.push({ month: m, year: y })
          m++
          if (m > 12) { m = 1; y++ }
        }

        if (months.length === 0) return

        const amountPerMonth = Math.round((data.totalAmount / months.length) * 100) / 100

        months.forEach(({ month, year }) => {
          // Verificar que no exista ya un pago para este mes/matrícula
          const existing = state.payments.find(
            (p) => p.enrollmentId === data.enrollmentId && p.billingMonth === month && p.billingYear === year
          )
          if (existing) return // No sobreescribir recibos ya existentes

          const dueDate = new Date(year, month - 1, 5)
          get().addPayment({
            playerId: enrollment.playerId,
            playerName: enrollment.playerName,
            groupId: enrollment.groupId,
            groupName: enrollment.groupName,
            enrollmentId: enrollment.id,
            concept: `Cuota ${MONTH_NAMES[month - 1]} ${year} — ${enrollment.groupName} (temporada)`,
            category: 'cuota',
            amount: amountPerMonth,
            status: 'pagado',
            billingMonth: month,
            billingYear: year,
            dueDate,
            paidDate: data.paidDate,
            paymentMethod: data.paymentMethod,
            autogenerated: false,
            notes: data.notes,
            registeredBy: userName,
          })
        })

        const { userId } = getCurrentUser()
        get().addActivity({
          type: 'payment_received',
          description: `Pago de temporada registrado para ${enrollment.playerName} (${enrollment.groupName}): ${data.totalAmount}€`,
          relatedEntityId: enrollment.playerId,
          userId,
          userName,
        })
      },

      generateScheduledInstallments: (enrollmentId) => {
        const state = get()
        const enrollment = state.enrollments.find((e) => e.id === enrollmentId)
        if (!enrollment) return 0
        const group = state.groups.find((g) => g.id === enrollment.groupId)
        if (!group || group.billingFrequency !== 'installments' || !group.installmentPrices) return 0

        const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
        const { userName } = getCurrentUser()

        // Meses que ya tienen recibo para esta matrícula
        const existingKeys = new Set(
          state.payments
            .filter((p) => p.enrollmentId === enrollmentId)
            .map((p) => `${p.billingYear}-${String(p.billingMonth).padStart(2, '0')}`)
        )

        let created = 0
        Object.entries(group.installmentPrices)
          .sort(([a], [b]) => a.localeCompare(b))
          .forEach(([key, amount]) => {
            if (existingKeys.has(key)) return
            const [yearStr, monthStr] = key.split('-')
            const year = parseInt(yearStr)
            const month = parseInt(monthStr)
            const dueDate = new Date(year, month - 1, 5)
            get().addPayment({
              playerId: enrollment.playerId,
              playerName: enrollment.playerName,
              groupId: enrollment.groupId,
              groupName: enrollment.groupName,
              enrollmentId: enrollment.id,
              concept: `Cuota ${MONTH_NAMES[month - 1]} ${year} — ${enrollment.groupName}`,
              category: 'cuota',
              amount: enrollment.customPrice ?? amount,
              status: 'pendiente',
              billingMonth: month,
              billingYear: year,
              dueDate,
              autogenerated: false,
              registeredBy: userName,
            })
            created++
          })

        return created
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
        
        if (clubId) {
          syncDoc('attendance', newRecord.id, newRecord as any, clubId)
          
          // Side Effects: Process each entry for credits and payments
          newRecord.records.forEach(entry => {
            // 1. Recovery Credits Logic
            if (entry.status === 'justificado' && !entry.isRecovery) {
              // Earned a credit
              const player = get().players.find(p => p.id === entry.playerId)
              if (player) {
                get().updatePlayer(player.id, { recoveryCredits: (player.recoveryCredits || 0) + 1 })
              }
            } else if (entry.isRecovery && entry.status === 'presente') {
              // Used a credit
              const player = get().players.find(p => p.id === entry.playerId)
              if (player && (player.recoveryCredits || 0) > 0) {
                get().updatePlayer(player.id, { recoveryCredits: player.recoveryCredits - 1 })
              }
            }
            
            // 2. One-off Class Payment Logic
            if (entry.isOneOff && entry.oneOffPrice && entry.oneOffPrice > 0) {
              const { userName } = getCurrentUser()
              const paymentId = generateId()
              const newPayment: Payment = {
                id: paymentId,
                playerId: entry.playerId,
                playerName: entry.playerName,
                groupId: newRecord.groupId,
                groupName: newRecord.groupName,
                concept: `Clase Suelta - ${newRecord.groupName} (${new Date(newRecord.date).toLocaleDateString('es-ES')})`,
                amount: entry.oneOffPrice,
                status: 'pendiente',
                category: 'clase_particular',
                billingMonth: new Date(newRecord.date).getMonth() + 1,
                billingYear: new Date(newRecord.date).getFullYear(),
                dueDate: new Date(newRecord.date),
                autogenerated: true,
                registeredBy: userName,
                createdAt: new Date(),
              }
              syncDoc('payments', paymentId, newPayment as any, clubId)
            }
          })
        }
        
        queryClient.invalidateQueries({ queryKey: ['attendance'] })
        queryClient.invalidateQueries({ queryKey: ['payments'] })
        queryClient.invalidateQueries({ queryKey: ['players'] })
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
        // Ensure amount is a valid number and at least 0
        const amount = Math.max(0, typeof paymentData.amount === 'number' ? paymentData.amount : parseFloat(paymentData.amount as any) || 0)
        
        const newPayment: PrivateLessonPayment = { 
          ...paymentData, 
          amount,
          id: generateId(), 
          createdAt: new Date() 
        }
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

      addEventExpense: (eventId: string, expense: Omit<EventExpense, 'id'>) => {
        const newExpense: EventExpense = { ...expense, id: generateId() }
        const event = get().events.find((e) => e.id === eventId)
        if (!event) return
        const updatedExpenses = [...(event.expenses ?? []), newExpense]
        set((state) => ({
          events: state.events.map((e) =>
            e.id === eventId ? { ...e, expenses: updatedExpenses } : e
          ),
        }))
        const clubId = getClubId()
        if (clubId) syncDoc('events', eventId, { expenses: updatedExpenses } as any, clubId, { merge: true })
      },

      removeEventExpense: (eventId: string, expenseId: string) => {
        const event = get().events.find((e) => e.id === eventId)
        if (!event) return
        const updatedExpenses = (event.expenses ?? []).filter((ex) => ex.id !== expenseId)
        set((state) => ({
          events: state.events.map((e) =>
            e.id === eventId ? { ...e, expenses: updatedExpenses } : e
          ),
        }))
        const clubId = getClubId()
        if (clubId) syncDoc('events', eventId, { expenses: updatedExpenses } as any, clubId, { merge: true })
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

      addInvoice: async (invoiceData: Omit<Invoice, 'id' | 'createdAt'>, newPayments?: Payment[]) => {
        const clubId = getClubId()
        if (!clubId) throw new Error('No se encontró el ID del club')
        
        const { userId } = getCurrentUser()
        const invoice: Invoice = {
          ...invoiceData as any,
          id: generateId(),
          createdAt: new Date(),
          createdBy: userId,
        }

        const { createInvoiceAtomic } = await import('@/lib/firestoreSync')
        await createInvoiceAtomic(invoice, invoiceData.paymentIds || [], clubId, newPayments)
        
        queryClient.invalidateQueries({ queryKey: ['invoices'] })
        queryClient.invalidateQueries({ queryKey: ['payments'] })
        queryClient.invalidateQueries({ queryKey: ['eventPayments'] })
        queryClient.invalidateQueries({ queryKey: ['privateLessonPayments'] })
      },

      updateInvoice: async (id: string, updates: Partial<Invoice>) => {
        const clubId = getClubId()
        if (!clubId) return
        await syncDoc('invoices', id, updates as any, clubId)
        queryClient.invalidateQueries({ queryKey: ['invoices'] })
      },

      unlinkPaymentsFromInvoice: async (invoiceId: string) => {
        const clubId = getClubId()
        if (!clubId) return
        
        const q = query(collection(db, 'invoices'), where('clubId', '==', clubId), where('id', '==', invoiceId))
        const snap = await getDocs(q)
        if (snap.empty) return
        
        const invoice = snap.docs[0].data() as Invoice
        const paymentIds = invoice.paymentIds || []
        
        await unlinkPaymentsFromInvoiceAtomic(paymentIds)
        
        queryClient.invalidateQueries({ queryKey: ['payments'] })
        queryClient.invalidateQueries({ queryKey: ['eventPayments'] })
        queryClient.invalidateQueries({ queryKey: ['privateLessonPayments'] })
        queryClient.invalidateQueries({ queryKey: ['invoices'] })
      },

      deleteInvoice: async (id: string) => {
        await deleteFirestoreDoc('invoices', id)
        queryClient.invalidateQueries({ queryKey: ['invoices'] })
        queryClient.invalidateQueries({ queryKey: ['payments'] })
        queryClient.invalidateQueries({ queryKey: ['eventPayments'] })
        queryClient.invalidateQueries({ queryKey: ['privateLessonPayments'] })
      },

      bulkGenerateInvoices: async (paymentIds: string[]) => {
        const clubId = getClubId()
        const { players, club } = get()
        if (!clubId || !club) {
          toast.error('Datos incompletos para generar facturas')
          return
        }

        try {
          const { generateInvoiceFromPayments } = await import('@/lib/invoice-utils')
          const { collection, getDocs, query, where } = await import('firebase/firestore')
          const { db } = await import('@/lib/firebase')
          const { fromFirestore } = await import('@/lib/firestoreSync')

          // 1. Obtener todos los pagos involucrados para tener los datos completos
          const snap = await getDocs(query(collection(db, 'payments'), where('clubId', '==', clubId), where('status', '==', 'pagado')))
          const allPayments = snap.docs.map(d => ({ ...fromFirestore(d.data()), id: d.id } as Payment))
          
          const eventSnap = await getDocs(query(collection(db, 'eventPayments'), where('clubId', '==', clubId), where('status', '==', 'pagado')))
          const allEventPayments = eventSnap.docs.map(d => ({ ...fromFirestore(d.data()), id: d.id } as EventPayment))
          
          const privateSnap = await getDocs(query(collection(db, 'privateLessonPayments'), where('clubId', '==', clubId), where('status', '==', 'pagado')))
          const allPrivatePayments = privateSnap.docs.map(d => ({ ...fromFirestore(d.data()), id: d.id } as PrivateLessonPayment))

          const selectedPayments = [...allPayments, ...allEventPayments, ...allPrivatePayments]
            .filter(p => paymentIds.includes(p.id))

          // 2. Agrupar por jugador
          const byPlayer: Record<string, typeof selectedPayments> = {}
          selectedPayments.forEach(p => {
            if (!byPlayer[p.playerId]) byPlayer[p.playerId] = []
            byPlayer[p.playerId].push(p)
          })

          let successCount = 0
          const playerIds = Object.keys(byPlayer)

          for (const playerId of playerIds) {
            const player = players.find(p => p.id === playerId)
            if (!player) continue

            const playerPayments = byPlayer[playerId]
            const pIds = playerPayments.map(p => p.id)

            const invoiceData = await generateInvoiceFromPayments(
              pIds,
              allPayments,
              allEventPayments,
              allPrivatePayments,
              player,
              club,
              'FC',
              { status: 'paid' }
            )

            await get().addInvoice(invoiceData)
            successCount++
          }

          toast.success(`Se han generado ${successCount} facturas para ${playerIds.length} jugadores.`)

        } catch (error) {
          console.error('[DataStore] bulkGenerateInvoices failed:', error)
          toast.error(error instanceof Error ? error.message : 'Error desconocido')
        }
      },


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
      },

      addAttendanceNotice: (noticeData: Omit<AttendanceNotice, 'id' | 'createdAt'>) => {
        const newNotice: import('@/types').AttendanceNotice = { 
          ...noticeData, 
          id: generateId(), 
          createdAt: new Date() 
        }
        set((state) => ({ attendanceNotices: [...state.attendanceNotices, newNotice] }))
        const clubId = getClubId()
        if (clubId) syncDoc('attendanceNotices', newNotice.id, newNotice as any, clubId)
        queryClient.invalidateQueries({ queryKey: ['attendanceNotices'] })
      },

      deleteAttendanceNotice: (id) => {
        set((state) => ({
          attendanceNotices: state.attendanceNotices.filter((n) => n.id !== id),
        }))
        deleteFirestoreDoc('attendanceNotices', id)
        queryClient.invalidateQueries({ queryKey: ['attendanceNotices'] })
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
        attendanceNotices: state.attendanceNotices,
        vouchers: state.vouchers,
        attendance: state.attendance,
        payments: state.payments,
        evaluations: state.evaluations,
        matchReports: state.matchReports,
      } as unknown as DataState)
    }
  )
)
