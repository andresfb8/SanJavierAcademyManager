// ==========================================
// San Javier Academy Manager - Tipos de Datos
// ==========================================

// --- VAT / IVA ---
export type VatRate = 0 | 10 | 21

// --- Club ---
export interface Club {
  id: string
  name: string
  address: string
  phone: string
  email: string
  logo?: string
  openingTime: string
  closingTime: string
  seasonStart: Date
  seasonEnd: Date
  // SEPA Direct Debit configuration
  iban?: string        // IBAN del club para domiciliación SEPA
  bic?: string         // BIC/SWIFT del banco del club
  creditorId?: string  // Identificador de acreedor SEPA (ES + sufijo + NIF)
  // Invoicing / Facturación
  nif?: string         // NIF del club (G73567539)
  legalName?: string   // Razón social oficial
  fiscalAddress?: string  // Domicilio fiscal
  invoiceSeriesFC?: number  // Contador facturas corrientes (FC-YYYY-001) - deprecated, usar invoiceCounters
  invoiceSeriesFR?: number  // Contador facturas rectificativas (FR-YYYY-001) - deprecated, usar invoiceCounters
  invoiceCounters?: {
    [year: number]: {
      FC?: number
      FR?: number
    }
  }
  // Default VAT rates for different service types
  defaultVatRateTariffs?: VatRate      // IVA por defecto para tarifas/cuotas (default: 0)
  defaultVatRateEvents?: VatRate       // IVA por defecto para eventos (default: 21)
  defaultVatRatePrivateLessons?: VatRate  // IVA por defecto para clases particulares (default: 21)
  defaultVatRateOther?: VatRate        // IVA por defecto para otras ventas (default: 21)
  createdAt: Date
}

// --- Configuración Global ---
export interface Holiday {
  id: string
  date: Date
  description?: string
  createdAt: Date
}

// --- Pista ---
export type CourtType = 'indoor' | 'outdoor'
export type CourtSurface = 'cristal' | 'muro' | 'cesped'

export interface Court {
  id: string
  name: string
  type: CourtType
  surface: CourtSurface
  isActive: boolean
  order?: number // Campo para ordenar la agenda y selectores
  notes?: string
}

// --- Tarifa ---
export type BillingFrequency = 'monthly' | 'quarterly' | 'annual' | 'installments'

export interface Tariff {
  id: string
  name: string
  /** For monthly: the monthly fee. For installments: auto-calculated sum of all installmentPrices. */
  price: number
  billingFrequency: BillingFrequency
  /** First month of the installment plan (day is always 1). Installments only. */
  installmentStartDate?: Date
  /** Last month of the installment plan (day is always 1). Installments only. */
  installmentEndDate?: Date
  /** Prices keyed by 'YYYY-MM'. Only months with an entry will generate a payment. */
  installmentPrices?: Record<string, number>
  description?: string
  vatRate: VatRate     // Tipo de IVA aplicable (0, 10, 21)
  isActive: boolean
  createdAt: Date
}

// --- Usuario ---
export type UserRole = 'director' | 'coordinador' | 'entrenador' | 'jugador' | 'tutor'

export interface AppUser {
  id: string
  email: string
  displayName: string
  role: UserRole           // mantener para compatibilidad con código existente
  roles: UserRole[]        // todos los roles asignados a este usuario
  activeRole: UserRole     // rol activo en este momento (persiste en localStorage)
  clubId: string
  linkedPlayerId?: string
  linkedPlayerIds?: string[]
  linkedCoachId?: string   // vincula con colección coaches
  isActive: boolean
  createdAt: Date
  fcmTokens?: string[]     // tokens FCM para push notifications (uno por dispositivo)
}

// --- Jugador ---
export type PlayerLevel = 'iniciacion' | 'intermedio' | 'avanzado' | 'competicion' | 'menores'
export type PlayerStatus = 'activo' | 'lista_espera' | 'baja'
export type DominantHand = 'derecha' | 'izquierda'
export type PlayerPosition = 'drive' | 'reves' | 'ambos'
export type GuardianRelationship = 'padre' | 'madre' | 'tutor'
export type ClothingSize = '4' | '6' | '8' | '10' | '12' | '14' | '16' | 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | '3XL'

export interface Guardian {
  firstName: string
  lastName: string
  dni: string
  phone: string
  email: string
  relationship: GuardianRelationship
}

export interface Player {
  id: string
  // Datos personales
  firstName: string
  lastName: string
  dni: string
  birthDate: Date
  email: string
  phone: string
  address: string
  city: string
  postalCode: string
  photo?: string
  // Datos deportivos
  level: PlayerLevel
  dominantHand: DominantHand
  position: PlayerPosition
  clothingSize?: ClothingSize
  licenseNumber?: string
  previousExperience?: string
  medicalNotes?: string
  // Datos bancarios
  bankAccountHolder: string
  iban: string
  // Estado
  status: PlayerStatus
  registrationDate: Date
  cancellationDate?: Date
  // Menor de edad
  isMinor: boolean
  guardian?: Guardian
  // Recuperaciones
  recoveryCredits: number
  // Metadata
  notes?: string
  // Invitation & Portal fields
  /** @deprecated Flujo antiguo de activación. Ya no se escribe ni se lee: el
   *  acceso se gestiona con la colección `invitations`. Se mantiene por
   *  compatibilidad con documentos existentes en Firestore. */
  invitationToken?: string
  /** @deprecated Ya no se escribe ni se lee. El estado del portal se deduce con
   *  `getPlayerPortalStatus()` a partir de `users` + `invitations`. */
  invitationStatus?: 'pending' | 'sent' | 'active'
  /** @deprecated Sin lectores ni escritores. */
  portalUid?: string
  /** @deprecated Sin lectores ni escritores. */
  inviteCode?: string
  userId?: string
  createdAt: Date
  updatedAt: Date
}

// --- Entrenador ---
export type StaffRole = 'entrenador' | 'coordinador' | 'director'

export interface Coach {
  id: string
  firstName: string
  lastName: string
  dni: string
  email: string
  phone: string
  address?: string
  hireDate: Date
  isActive: boolean
  specialization?: string
  certifications?: string
  photo?: string
  userId?: string
  staffRole?: StaffRole
  notes?: string
  createdAt: Date
}

// --- Grupo ---
export interface ScheduleSlot {
  dayOfWeek: number
  startTime: string
  endTime: string
}

export interface Group {
  id: string
  name: string
  level: PlayerLevel
  coachId: string
  coachName: string
  courtId: string
  courtName: string
  schedule: ScheduleSlot[]
  maxCapacity: number
  currentEnrollment: number
  defaultTariffId: string
  defaultTariffPrice: number
  billingFrequency: BillingFrequency
  /** Prices keyed by 'YYYY-MM', copied from the tariff for fast payment generation. */
  installmentPrices?: Record<string, number>
  startDate: Date
  endDate: Date
  isActive: boolean
  createdAt: Date
}

// --- Inscripción ---
export interface Enrollment {
  id: string
  playerId: string
  playerName: string
  groupId: string
  groupName: string
  tariffId: string
  tariffName: string
  customPrice?: number
  billingFrequency?: BillingFrequency   // per-enrollment; falls back to group.billingFrequency if absent
  billingAnchorMonth?: number           // 1-12; required when billingFrequency is 'quarterly' or 'annual'
  enrollmentDate: Date
  unenrollmentDate?: Date
  isActive: boolean
  // Lista de espera: una entrada en cola es un enrollment con isActive:false + isWaitlist:true.
  isWaitlist?: boolean
  waitlistPosition?: number             // 1-based; orden en la cola del grupo
}

// --- Asistencia ---
export type AttendanceStatus = 'presente' | 'ausente' | 'justificado'

export interface AttendanceEntry {
  playerId: string
  playerName: string
  status: AttendanceStatus
  isRecovery: boolean
  isOneOff?: boolean
  oneOffPrice?: number
  originalGroupId?: string
  notes?: string
}

export interface AttendanceRecord {
  id: string
  groupId: string
  groupName: string
  date: Date
  records: AttendanceEntry[]
  coachId: string
  createdAt: Date
}

// --- Avisos de Asistencia (Pupil Notices) ---
export type NoticeType = 'absent' | 'present' | 'uncertain'

// --- Clase cancelada ---
export interface CancelledClass {
  id: string
  clubId: string
  groupId: string
  groupName: string
  date: string        // 'YYYY-MM-DD'
  reason?: string
  cancelledBy: string // userId del entrenador
  createdAt: Date
}

export interface AttendanceNotice {
  id: string
  playerId: string
  playerName: string
  groupId: string
  date: Date
  type: NoticeType
  notes?: string
  createdAt: Date
}

// --- Bonos (Vouchers) ---
export type VoucherType = '1_class' | '5_classes' | '10_classes' | 'monthly'
export type VoucherStatus = 'active' | 'exhausted' | 'expired' | 'pending_payment'

export interface Voucher {
  id: string
  playerId: string
  playerName: string
  type: VoucherType
  totalClasses: number
  usedClasses: number
  price: number
  status: VoucherStatus
  paymentMethod?: PaymentMethod
  paymentId?: string
  expiresAt?: Date
  createdAt: Date
}

// --- Pago ---
export type PaymentStatus = 'pendiente' | 'pagado' | 'cancelado'
export type PaymentMethod = 'transferencia' | 'efectivo' | 'domiciliacion' | 'tarjeta'
export type PaymentCategory = 'cuota' | 'evento' | 'clase_particular' | 'manual' | 'otro'

export interface Payment {
  id: string
  playerId: string
  playerName: string
  groupId?: string
  groupName?: string
  enrollmentId?: string
  concept: string
  category?: PaymentCategory
  amount: number
  vatRate?: VatRate    // Tipo de IVA (heredado de tarifa, default 10)
  status: PaymentStatus
  billingMonth: number
  billingYear: number
  dueDate: Date
  paidDate?: Date
  paymentMethod?: PaymentMethod
  invoiceId?: string   // ID de factura si está facturado
  notes?: string
  autogenerated: boolean
  registeredBy?: string
  createdAt: Date
}

// --- Clase Particular ---
export interface PrivateLesson {
  id: string
  playerIds: string[]
  playerNames: string[]
  coachId: string
  coachName: string
  courtId: string
  courtName: string
  date: Date
  startTime: string
  endTime: string
  price: number
  isPaid: boolean
  notes?: string
  createdAt: Date
}

// --- Actividad ---
export type ActivityType =
  | 'player_created'
  | 'player_updated'
  | 'player_deleted'
  | 'player_cancelled'
  | 'payment_received'
  | 'payment_created'
  | 'payment_cancelled'
  | 'group_created'
  | 'group_updated'
  | 'group_deleted'
  | 'coach_created'
  | 'coach_updated'
  | 'coach_deleted'
  | 'enrollment_created'
  | 'enrollment_deleted'
  | 'attendance_recorded'
  | 'recovery_used'
  | 'waitlist_spot_available'
  | 'evaluation_created'
  | 'evaluation_updated'
  | 'evaluation_deleted'
  | 'event_created'
  | 'event_updated'
  | 'event_deleted'
  | 'lesson_created'
  | 'lesson_updated'
  | 'lesson_deleted'
  | 'match_report_created'
  | 'match_report_updated'
  | 'match_report_deleted'
  | 'invitation_sent'
  | 'invoice_created'
  | 'invoice_issued'
  | 'invoice_paid'
  | 'invoice_cancelled'
  | 'system_action'


export interface Activity {
  id: string
  type: ActivityType
  description: string
  relatedEntityId?: string
  userId: string
  userName?: string
  createdAt: Date
}

// --- Invitación ---
export type InvitationStatus = 'pendiente' | 'aceptada' | 'expirada'

export interface Invitation {
  id: string
  email: string
  role: UserRole
  linkedPlayerId?: string
  linkedPlayerIds?: string[]
  clubId: string
  status: InvitationStatus
  token: string
  createdBy: string
  coachId?: string
  createdAt: Date
  expiresAt: Date
  acceptedAt?: Date
}

// --- Evento (mini torneos, clinics, etc.) ---
export type EventType = 'mini_torneo' | 'clinic' | 'exhibicion' | 'social'

// Gasto individual de un evento (material, premios, alquiler, etc.)
export interface EventExpense {
  id: string
  description: string
  amount: number
}

export interface AcademyEvent {
  id: string
  name: string
  type: EventType
  date: Date
  startTime: string
  endTime: string
  courtIds: string[]
  courtNames: string[]
  coachIds: string[]
  coachNames: string[]
  attendeePlayerIds: string[]
  attendeePlayerNames: string[]
  attendeePrices?: Record<string, number> // Individual prices for attendees
  price: number
  vatRate: VatRate     // Tipo de IVA (default 21 para eventos)
  maxCapacity?: number
  description?: string
  guestNames?: string[]
  expenses?: EventExpense[]   // Lista de gastos del evento para calcular beneficio neto
  isActive: boolean
  createdAt: Date
}

// --- Pago de Evento ---
export interface EventPayment {
  id: string
  eventId: string
  eventName: string
  playerId: string
  playerName: string
  amount: number
  vatRate?: VatRate    // Tipo de IVA (heredado de evento)
  status: PaymentStatus
  paymentMethod?: PaymentMethod
  paidDate?: Date
  invoiceId?: string   // ID de factura si está facturado
  registeredBy?: string
  createdAt: Date
}

// --- Pago de Clase Particular ---
export interface PrivateLessonPayment {
  id: string
  lessonId: string
  lessonDate: Date
  playerId: string
  playerName: string
  amount: number
  vatRate?: VatRate    // Tipo de IVA (default 21 para clases particulares)
  status: PaymentStatus
  paymentMethod?: PaymentMethod
  paidDate?: Date
  invoiceId?: string   // ID de factura si está facturado
  registeredBy?: string
  createdAt: Date
}

// --- Evaluación / Informe ---
export interface EvaluationScore {
  criterionKey: string
  score: number
}

export interface EvaluationBlock {
  blockKey: string
  scores: EvaluationScore[]
  average: number
  comment?: string
}

export interface Evaluation {
  id: string
  playerId: string
  playerName: string
  coachId: string
  coachName: string
  date: Date
  blocks: EvaluationBlock[]
  overallAverage: number
  finalComment?: string
  createdAt: Date
  updatedAt: Date
}

// --- Informe de Partido ---
export interface MatchReport {
  id: string
  title: string
  date: Date
  playerIds: string[]
  playerNames: string[]
  coachId: string
  coachName: string
  // Sections
  tacticsComment: string       // Táctica
  decisionMakingComment: string // Toma de decisiones
  mentalComment: string         // Aspecto mental
  generalComment?: string       // Comentario general
  createdAt: Date
  updatedAt: Date
}

export interface CoachSalaryConfig {
  coachId: string
  ratePerGroupAdults: number
  ratePerGroupMinors: number
  privateLessonPaymentType: 'fixed' | 'percentage'
  privateLessonRate: number
  eventPaymentType: 'fixed' | 'percentage'
  eventRate: number
  bonuses: number
  notes?: string
}

// --- Generación de Recibos ---
export type ReceiptGenerationStatus = 'pending' | 'completed' | 'failed'

export interface ReceiptGeneration {
  id: string // Format: `${clubId}-${year}-${month}`
  clubId: string
  year: number
  month: number
  generatedAt: Date
  generatedBy: string // userId
  receiptCount: number
  status: ReceiptGenerationStatus
}

// --- Facturación / Invoicing ---
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'cancelled'
export type InvoiceSeries = 'FC' | 'FR' // FC = Factura Corriente, FR = Factura Rectificativa

export interface InvoiceLineItem {
  description: string      // "Cuota mensual Grupo Intermedio - Enero 2024"
  quantity: number         // 1
  unitPrice: number       // 50.00 (sin IVA)
  vatRate: VatRate        // 10
  subtotal: number        // 50.00
  vatAmount: number       // 5.00
  total: number           // 55.00
  paymentId?: string      // Referencia al pago (Payment, EventPayment o PrivateLessonPayment)
  paymentType?: 'payment' | 'eventPayment' | 'privateLessonPayment'
}

export interface Invoice {
  id: string
  invoiceNumber: string    // "FC-2024-001"
  series: InvoiceSeries    // FC o FR
  invoiceDate: Date
  dueDate?: Date

  // Cliente
  playerId: string
  playerName: string
  customerNif?: string     // NIF/DNI del cliente
  customerAddress?: string
  customerEmail?: string   // Email del cliente
  customerPhone?: string   // Teléfono del cliente

  // Líneas de factura
  lineItems: InvoiceLineItem[]

  // Totales
  subtotal: number         // Base imponible total
  totalVat: number         // Total IVA
  total: number            // Total factura (subtotal + totalVat)

  // Resumen por tipo de IVA (para el PDF)
  vatBreakdown: {
    [key in VatRate]?: {
      base: number
      vat: number
    }
  }

  // Estado
  status: InvoiceStatus
  paymentIds: string[]     // IDs de pagos incluidos en esta factura

  // Metadata
  notes?: string
  createdAt: Date
  createdBy: string        // userId
}

// --- Transacciones Financieras del Club (P&L) ---
export type TransactionType = 'ingreso' | 'gasto'
export type TransactionCategory = 'alquiler' | 'suministros' | 'material' | 'reparaciones' | 'publicidad' | 'limpieza' | 'nomina' | 'otro'

export interface ClubTransaction {
  id: string
  clubId: string
  type: TransactionType
  category: TransactionCategory
  concept: string
  amount: number
  date: Date
  registeredBy?: string // userId del usuario que la registró
  relatedId?: string    // Ej: coachId para vincular la nómina a un entrenador
  notes?: string
  createdAt: Date
}

// --- Cuestionario Post-Entrenamiento ---
export interface ClassReview {
  id: string
  groupId: string
  coachId: string
  playerId: string
  playerName: string
  date: string          // YYYY-MM-DD (fecha de la clase)
  punctual: boolean     // ¿El coach fue puntual?
  usedPhone: boolean    // ¿Usó el móvil en pista?
  quality: number       // 1-5 estrellas
  comment?: string
  submittedAt: Date
}

