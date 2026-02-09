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
  Evaluation,
  MatchReport,
  CoachSalaryConfig,
  PaymentStatus,
  PaymentMethod,
  PlayerStatus,
  ActivityType,
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

// ===================
// STORE INTERFACE
// ===================

interface DataState {
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
  evaluations: Evaluation[]
  matchReports: MatchReport[]
  coachSalaryConfigs: CoachSalaryConfig[]

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
  addCoach: (coach: Omit<Coach, 'id' | 'createdAt'>) => void
  updateCoach: (id: string, data: Partial<Coach>) => void
  deleteCoach: (id: string) => void

  // --- Groups CRUD ---
  addGroup: (group: Omit<Group, 'id' | 'createdAt' | 'currentEnrollment'>) => void
  updateGroup: (id: string, data: Partial<Group>) => void
  deleteGroup: (id: string) => void

  // --- Enrollments CRUD ---
  addEnrollment: (enrollment: Omit<Enrollment, 'id'>) => void
  updateEnrollment: (id: string, data: Partial<Enrollment>) => void
  deleteEnrollment: (id: string) => void
  deactivateEnrollment: (id: string) => void

  // --- Payments ---
  addPayment: (payment: Omit<Payment, 'id' | 'createdAt'>) => void
  updatePayment: (id: string, data: Partial<Payment>) => void
  deletePayment: (id: string) => void
  markPaymentPaid: (id: string, method: PaymentMethod) => void
  cancelPayment: (id: string) => void
  generateMonthlyReceipts: (month: number, year: number) => number

  // --- Attendance ---
  addAttendanceRecord: (record: Omit<AttendanceRecord, 'id' | 'createdAt'>) => void
  updateAttendanceRecord: (id: string, data: Partial<AttendanceRecord>) => void
  deleteAttendanceRecord: (id: string) => void

  // --- Activities ---
  addActivity: (activity: Omit<Activity, 'id' | 'createdAt'>) => void

  // --- Private Lessons ---
  addPrivateLesson: (lesson: Omit<PrivateLesson, 'id' | 'createdAt'>) => void
  updatePrivateLesson: (id: string, data: Partial<PrivateLesson>) => void
  deletePrivateLesson: (id: string) => void

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

// ===================
// DEFAULT CLUB DATA
// ===================

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

// ===================
// DATE REVIVER for localStorage
// ===================
// Converts ISO date strings back to Date objects when loading from localStorage

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/

function dateReviver(_key: string, value: unknown): unknown {
  if (typeof value === 'string' && ISO_DATE_REGEX.test(value)) {
    return new Date(value)
  }
  return value
}

// ===================
// STORE IMPLEMENTATION
// ===================

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
  // --- Initial Data (empty for production) ---
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
  evaluations: [],
  matchReports: [],
  coachSalaryConfigs: [],

  // ================================
  // CLUB
  // ================================

  updateClub: (data) => {
    set((state) => ({
      club: state.club ? { ...state.club, ...data } : null,
    }))
  },

  // ================================
  // COURTS CRUD
  // ================================

  addCourt: (courtData) => {
    const newCourt: Court = {
      ...courtData,
      id: generateId(),
    }
    set((state) => ({
      courts: [...state.courts, newCourt],
    }))
  },

  updateCourt: (id, data) => {
    set((state) => ({
      courts: state.courts.map((c) => (c.id === id ? { ...c, ...data } : c)),
    }))
  },

  deleteCourt: (id) => {
    set((state) => ({
      courts: state.courts.filter((c) => c.id !== id),
    }))
  },

  // ================================
  // TARIFFS CRUD
  // ================================

  addTariff: (tariffData) => {
    const newTariff: Tariff = {
      ...tariffData,
      id: generateId(),
      createdAt: new Date(),
    }
    set((state) => ({
      tariffs: [...state.tariffs, newTariff],
    }))
  },

  updateTariff: (id, data) => {
    set((state) => ({
      tariffs: state.tariffs.map((t) => (t.id === id ? { ...t, ...data } : t)),
    }))
  },

  deleteTariff: (id) => {
    set((state) => ({
      tariffs: state.tariffs.filter((t) => t.id !== id),
    }))
  },

  // ================================
  // PLAYERS CRUD
  // ================================

  addPlayer: (playerData) => {
    const now = new Date()
    const newPlayer: Player = {
      ...playerData,
      id: generateId(),
      recoveryCredits: 0,
      createdAt: now,
      updatedAt: now,
    }
    set((state) => ({
      players: [...state.players, newPlayer],
    }))

    // Log activity
    get().addActivity({
      type: 'player_created',
      description: `Se registró a ${playerData.firstName} ${playerData.lastName}${playerData.status === 'lista_espera' ? ' en lista de espera' : ''}`,
      relatedEntityId: newPlayer.id,
      userId: 'demo-director-001',
    })
  },

  updatePlayer: (id, data) => {
    set((state) => ({
      players: state.players.map((p) =>
        p.id === id ? { ...p, ...data, updatedAt: new Date() } : p
      ),
    }))
  },

  deletePlayer: (id) => {
    set((state) => ({
      players: state.players.filter((p) => p.id !== id),
      enrollments: state.enrollments.filter((e) => e.playerId !== id),
    }))
  },

  /**
   * cancelPlayer - Dar de baja a un jugador
   *
   * Regla de negocio (día 5):
   * - Si el día actual <= CANCELLATION_DEADLINE_DAY (5):
   *   Se cancelan los pagos pendientes del mes en curso.
   * - Si el día actual > CANCELLATION_DEADLINE_DAY:
   *   Los pagos del mes en curso se mantienen (el jugador debe pagar el mes completo).
   *
   * En ambos casos:
   * 1. El estado del jugador cambia a 'baja'
   * 2. Se establece la fecha de cancelación
   * 3. Se desactivan todas las inscripciones activas
   * 4. Se actualizan los contadores de inscripción de los grupos afectados
   * 5. Se registra la actividad
   */
  cancelPlayer: (playerId) => {
    const state = get()
    const player = state.players.find((p) => p.id === playerId)
    if (!player || player.status === 'baja') return

    const today = new Date()
    const currentDay = today.getDate()
    const currentMonth = today.getMonth() + 1
    const currentYear = today.getFullYear()

    // 1. Update player status
    set((prevState) => ({
      players: prevState.players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              status: 'baja' as PlayerStatus,
              cancellationDate: today,
              updatedAt: today,
            }
          : p
      ),
    }))

    // 2. Deactivate all active enrollments and update group counts
    const activeEnrollments = state.enrollments.filter(
      (e) => e.playerId === playerId && e.isActive
    )

    const affectedGroupIds = activeEnrollments.map((e) => e.groupId)

    set((prevState) => ({
      enrollments: prevState.enrollments.map((e) =>
        e.playerId === playerId && e.isActive
          ? { ...e, isActive: false, unenrollmentDate: today }
          : e
      ),
      groups: prevState.groups.map((g) =>
        affectedGroupIds.includes(g.id)
          ? { ...g, currentEnrollment: Math.max(0, g.currentEnrollment - 1) }
          : g
      ),
    }))

    // 3. Handle payments based on day-5 rule
    if (currentDay <= CANCELLATION_DEADLINE_DAY) {
      // Cancel current month's pending payments
      set((prevState) => ({
        payments: prevState.payments.map((p) =>
          p.playerId === playerId &&
          p.billingMonth === currentMonth &&
          p.billingYear === currentYear &&
          p.status === 'pendiente'
            ? { ...p, status: 'cancelado' as PaymentStatus }
            : p
        ),
      }))
    }
    // If day > 5, pending payments for the current month remain as-is

    // 4. Log activity
    get().addActivity({
      type: 'player_cancelled',
      description: `${player.firstName} ${player.lastName} se ha dado de baja${currentDay <= CANCELLATION_DEADLINE_DAY ? ' (pagos del mes cancelados)' : ' (pagos del mes vigentes)'}`,
      relatedEntityId: playerId,
      userId: 'demo-director-001',
    })
  },

  // ================================
  // COACHES CRUD
  // ================================

  addCoach: (coachData) => {
    const newCoach: Coach = {
      ...coachData,
      id: generateId(),
      createdAt: new Date(),
    }
    set((state) => ({
      coaches: [...state.coaches, newCoach],
    }))
  },

  updateCoach: (id, data) => {
    set((state) => ({
      coaches: state.coaches.map((c) => (c.id === id ? { ...c, ...data } : c)),
    }))
  },

  deleteCoach: (id) => {
    set((state) => ({
      coaches: state.coaches.filter((c) => c.id !== id),
    }))
  },

  // ================================
  // GROUPS CRUD
  // ================================

  addGroup: (groupData) => {
    const newGroup: Group = {
      ...groupData,
      id: generateId(),
      currentEnrollment: 0,
      createdAt: new Date(),
    }
    set((state) => ({
      groups: [...state.groups, newGroup],
    }))

    get().addActivity({
      type: 'group_created',
      description: `Se creó el grupo ${groupData.name}`,
      relatedEntityId: newGroup.id,
      userId: 'demo-director-001',
    })
  },

  updateGroup: (id, data) => {
    set((state) => ({
      groups: state.groups.map((g) => (g.id === id ? { ...g, ...data } : g)),
    }))
  },

  deleteGroup: (id) => {
    set((state) => ({
      groups: state.groups.filter((g) => g.id !== id),
      enrollments: state.enrollments.map((e) =>
        e.groupId === id ? { ...e, isActive: false } : e
      ),
    }))
  },

  // ================================
  // ENROLLMENTS CRUD
  // ================================

  addEnrollment: (enrollmentData) => {
    const newEnrollment: Enrollment = {
      ...enrollmentData,
      id: generateId(),
    }
    set((state) => ({
      enrollments: [...state.enrollments, newEnrollment],
      // Increment group enrollment count
      groups: state.groups.map((g) =>
        g.id === enrollmentData.groupId && enrollmentData.isActive
          ? { ...g, currentEnrollment: g.currentEnrollment + 1 }
          : g
      ),
    }))
  },

  updateEnrollment: (id, data) => {
    set((state) => ({
      enrollments: state.enrollments.map((e) =>
        e.id === id ? { ...e, ...data } : e
      ),
    }))
  },

  deleteEnrollment: (id) => {
    const enrollment = get().enrollments.find((e) => e.id === id)
    set((state) => ({
      enrollments: state.enrollments.filter((e) => e.id !== id),
      groups: enrollment?.isActive
        ? state.groups.map((g) =>
            g.id === enrollment.groupId
              ? { ...g, currentEnrollment: Math.max(0, g.currentEnrollment - 1) }
              : g
          )
        : state.groups,
    }))
  },

  deactivateEnrollment: (id) => {
    const enrollment = get().enrollments.find((e) => e.id === id)
    if (!enrollment || !enrollment.isActive) return

    set((state) => ({
      enrollments: state.enrollments.map((e) =>
        e.id === id
          ? { ...e, isActive: false, unenrollmentDate: new Date() }
          : e
      ),
      groups: state.groups.map((g) =>
        g.id === enrollment.groupId
          ? { ...g, currentEnrollment: Math.max(0, g.currentEnrollment - 1) }
          : g
      ),
    }))
  },

  // ================================
  // PAYMENTS
  // ================================

  addPayment: (paymentData) => {
    const newPayment: Payment = {
      ...paymentData,
      id: generateId(),
      createdAt: new Date(),
    }
    set((state) => ({
      payments: [...state.payments, newPayment],
    }))
  },

  updatePayment: (id, data) => {
    set((state) => ({
      payments: state.payments.map((p) => (p.id === id ? { ...p, ...data } : p)),
    }))
  },

  deletePayment: (id) => {
    set((state) => ({
      payments: state.payments.filter((p) => p.id !== id),
    }))
  },

  /**
   * markPaymentPaid - Marcar un pago como pagado
   *
   * Actualiza el estado del pago, la fecha de pago, y el método de pago.
   * Registra una actividad de pago recibido.
   */
  markPaymentPaid: (id, method) => {
    const payment = get().payments.find((p) => p.id === id)
    if (!payment || payment.status === 'pagado') return

    const now = new Date()

    set((state) => ({
      payments: state.payments.map((p) =>
        p.id === id
          ? {
              ...p,
              status: 'pagado' as PaymentStatus,
              paidDate: now,
              paymentMethod: method,
            }
          : p
      ),
    }))

    get().addActivity({
      type: 'payment_received',
      description: `Pago recibido de ${payment.playerName} - ${payment.amount.toFixed(2)} € (${payment.groupName})`,
      relatedEntityId: id,
      userId: 'demo-director-001',
    })
  },

  cancelPayment: (id) => {
    set((state) => ({
      payments: state.payments.map((p) =>
        p.id === id ? { ...p, status: 'cancelado' as PaymentStatus } : p
      ),
    }))
  },

  /**
   * generateMonthlyReceipts - Generar recibos mensuales
   *
   * Para cada grupo activo, revisa sus inscripciones activas y genera
   * un recibo (Payment) para cada una, respetando las siguientes reglas:
   *
   * 1. Frecuencia de facturación:
   *    - 'monthly': Se genera siempre.
   *    - 'installments': Solo se genera si el mes actual está en installmentMonths.
   *
   * 2. Idempotencia:
   *    No se generan recibos duplicados. Si ya existe un pago para la misma
   *    combinación de enrollmentId + billingMonth + billingYear, se omite.
   *
   * 3. Importe:
   *    Se usa customPrice de la inscripción si existe; si no, defaultTariffPrice del grupo.
   *
   * Devuelve el número de recibos generados.
   */
  generateMonthlyReceipts: (month, year) => {
    const state = get()
    const newPayments: Payment[] = []

    for (const group of state.groups) {
      if (!group.isActive) continue

      // Check billing frequency
      if (group.billingFrequency === 'installments') {
        const installmentMonths = group.installmentMonths || []
        if (!installmentMonths.includes(month)) {
          continue // Skip this group for this month
        }
      }

      // Get active enrollments for this group
      const groupEnrollments = state.enrollments.filter(
        (e) => e.groupId === group.id && e.isActive
      )

      for (const enrollment of groupEnrollments) {
        // Idempotency check: don't generate if already exists
        const alreadyExists = state.payments.some(
          (p) =>
            p.enrollmentId === enrollment.id &&
            p.billingMonth === month &&
            p.billingYear === year
        )
        if (alreadyExists) continue

        // Determine amount: custom price or default tariff price
        const amount = enrollment.customPrice ?? group.defaultTariffPrice

        const newPayment: Payment = {
          id: generateId(),
          playerId: enrollment.playerId,
          playerName: enrollment.playerName,
          groupId: group.id,
          groupName: group.name,
          enrollmentId: enrollment.id,
          concept: `Cuota ${group.name} (${month}/${year})`,
          amount,
          status: 'pendiente',
          billingMonth: month,
          billingYear: year,
          dueDate: new Date(year, month - 1, 5),
          autogenerated: true,
          createdAt: new Date(),
        }

        newPayments.push(newPayment)
      }
    }

    if (newPayments.length > 0) {
      set((prevState) => ({
        payments: [...prevState.payments, ...newPayments],
      }))
    }

    return newPayments.length
  },

  // ================================
  // ATTENDANCE
  // ================================

  /**
   * addAttendanceRecord - Registrar asistencia de un grupo
   *
   * Procesa cada entrada de asistencia con lógica de créditos de recuperación:
   *
   * 1. Si status === 'justificado':
   *    Se incrementa recoveryCredits del jugador en 1.
   *    (El jugador puede usar este crédito para asistir a otra clase como recuperación.)
   *
   * 2. Si isRecovery === true:
   *    Se decrementa recoveryCredits del jugador en 1.
   *    (El jugador está usando un crédito de recuperación previamente ganado.)
   *
   * Registra la actividad de asistencia.
   */
  addAttendanceRecord: (recordData) => {
    const newRecord: AttendanceRecord = {
      ...recordData,
      id: generateId(),
      createdAt: new Date(),
    }

    // Process recovery credits for each entry
    const playerUpdates: Map<string, number> = new Map()

    for (const entry of recordData.records) {
      const currentDelta = playerUpdates.get(entry.playerId) || 0

      if (entry.status === 'justificado') {
        // Justified absence: grant a recovery credit
        playerUpdates.set(entry.playerId, currentDelta + 1)
      }

      if (entry.isRecovery) {
        // Using a recovery credit: decrement
        playerUpdates.set(entry.playerId, currentDelta - 1)
      }
    }

    set((state) => ({
      attendance: [...state.attendance, newRecord],
      players:
        playerUpdates.size > 0
          ? state.players.map((p) => {
              const delta = playerUpdates.get(p.id)
              if (delta !== undefined && delta !== 0) {
                return {
                  ...p,
                  recoveryCredits: Math.max(0, p.recoveryCredits + delta),
                  updatedAt: new Date(),
                }
              }
              return p
            })
          : state.players,
    }))

    // Log activity
    get().addActivity({
      type: 'attendance_recorded',
      description: `Asistencia registrada para ${recordData.groupName}`,
      relatedEntityId: newRecord.id,
      userId: 'demo-director-001',
    })

    // Log individual recovery usages
    for (const entry of recordData.records) {
      if (entry.isRecovery) {
        get().addActivity({
          type: 'recovery_used',
          description: `${entry.playerName} usó crédito de recuperación en ${recordData.groupName}`,
          relatedEntityId: entry.playerId,
          userId: 'demo-director-001',
        })
      }
    }
  },

  updateAttendanceRecord: (id, data) => {
    set((state) => ({
      attendance: state.attendance.map((a) =>
        a.id === id ? { ...a, ...data } : a
      ),
    }))
  },

  deleteAttendanceRecord: (id) => {
    set((state) => ({
      attendance: state.attendance.filter((a) => a.id !== id),
    }))
  },

  // ================================
  // ACTIVITIES
  // ================================

  addActivity: (activityData) => {
    const newActivity: Activity = {
      ...activityData,
      id: generateId(),
      createdAt: new Date(),
    }
    set((state) => ({
      activities: [newActivity, ...state.activities],
    }))
  },

  // ================================
  // PRIVATE LESSONS
  // ================================

  addPrivateLesson: (lessonData) => {
    const newLesson: PrivateLesson = {
      ...lessonData,
      id: generateId(),
      createdAt: new Date(),
    }
    set((state) => ({
      privateLessons: [...state.privateLessons, newLesson],
    }))
  },

  updatePrivateLesson: (id, data) => {
    set((state) => ({
      privateLessons: state.privateLessons.map((l) =>
        l.id === id ? { ...l, ...data } : l
      ),
    }))
  },

  deletePrivateLesson: (id) => {
    set((state) => ({
      privateLessons: state.privateLessons.filter((l) => l.id !== id),
    }))
  },

  // ================================
  // INVITATIONS
  // ================================

  addInvitation: (invitationData) => {
    const newInvitation: Invitation = {
      ...invitationData,
      id: generateId(),
    }
    set((state) => ({
      invitations: [...state.invitations, newInvitation],
    }))
  },

  updateInvitation: (id, data) => {
    set((state) => ({
      invitations: state.invitations.map((i) =>
        i.id === id ? { ...i, ...data } : i
      ),
    }))
  },

  deleteInvitation: (id) => {
    set((state) => ({
      invitations: state.invitations.filter((i) => i.id !== id),
    }))
  },

  // ================================
  // EVENTS
  // ================================

  addEvent: (eventData) => {
    const newId = generateId()
    const newEvent: AcademyEvent = {
      ...eventData,
      id: newId,
      createdAt: new Date(),
    }
    set((state) => ({
      events: [...state.events, newEvent],
    }))
    return newId
  },

  updateEvent: (id, data) => {
    set((state) => ({
      events: state.events.map((e) => (e.id === id ? { ...e, ...data } : e)),
    }))
  },

  deleteEvent: (id) => {
    set((state) => ({
      events: state.events.filter((e) => e.id !== id),
    }))
  },

  // ================================
  // EVENT PAYMENTS
  // ================================

  addEventPayment: (paymentData) => {
    const newPayment: EventPayment = {
      ...paymentData,
      id: generateId(),
      createdAt: new Date(),
    }
    set((state) => ({
      eventPayments: [...state.eventPayments, newPayment],
    }))
  },

  updateEventPayment: (id, data) => {
    set((state) => ({
      eventPayments: state.eventPayments.map((p) =>
        p.id === id ? { ...p, ...data } : p
      ),
    }))
  },

  // ================================
  // EVALUATIONS
  // ================================

  addEvaluation: (evaluationData) => {
    const now = new Date()
    const newEvaluation: Evaluation = {
      ...evaluationData,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    }
    set((state) => ({
      evaluations: [...state.evaluations, newEvaluation],
    }))
  },

  updateEvaluation: (id, data) => {
    set((state) => ({
      evaluations: state.evaluations.map((e) =>
        e.id === id ? { ...e, ...data, updatedAt: new Date() } : e
      ),
    }))
  },

  deleteEvaluation: (id) => {
    set((state) => ({
      evaluations: state.evaluations.filter((e) => e.id !== id),
    }))
  },

  // ================================
  // MATCH REPORTS
  // ================================

  addMatchReport: (reportData) => {
    const now = new Date()
    const newReport: MatchReport = {
      ...reportData,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    }
    set((state) => ({
      matchReports: [...state.matchReports, newReport],
    }))
  },

  updateMatchReport: (id, data) => {
    set((state) => ({
      matchReports: state.matchReports.map((r) =>
        r.id === id ? { ...r, ...data, updatedAt: new Date() } : r
      ),
    }))
  },

  deleteMatchReport: (id) => {
    set((state) => ({
      matchReports: state.matchReports.filter((r) => r.id !== id),
    }))
  },

  // ================================
  // COACH SALARY CONFIG
  // ================================

  updateCoachSalaryConfig: (coachId, config) => {
    set((state) => ({
      coachSalaryConfigs: state.coachSalaryConfigs.map((c) =>
        c.coachId === coachId ? { ...c, ...config } : c
      ),
    }))
  },
}),
    {
      name: 'sjam-data-store',
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
      // Only persist data, not action functions
      partialize: (state) => ({
        club: state.club,
        courts: state.courts,
        tariffs: state.tariffs,
        players: state.players,
        coaches: state.coaches,
        groups: state.groups,
        enrollments: state.enrollments,
        payments: state.payments,
        attendance: state.attendance,
        activities: state.activities,
        privateLessons: state.privateLessons,
        invitations: state.invitations,
        events: state.events,
        eventPayments: state.eventPayments,
        evaluations: state.evaluations,
        matchReports: state.matchReports,
        coachSalaryConfigs: state.coachSalaryConfigs,
      }) as DataState,
    },
  )
)
