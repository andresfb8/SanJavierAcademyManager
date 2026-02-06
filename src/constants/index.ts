import type { PlayerLevel, PlayerStatus, AttendanceStatus, PaymentStatus, PaymentMethod, UserRole, CourtType, CourtSurface, BillingFrequency, GuardianRelationship, DominantHand, PlayerPosition } from '@/types'

// --- Niveles ---
export const PLAYER_LEVELS: { value: PlayerLevel; label: string; color: string }[] = [
  { value: 'iniciacion', label: 'Iniciación', color: 'bg-green-100 text-green-800' },
  { value: 'intermedio', label: 'Intermedio', color: 'bg-blue-100 text-blue-800' },
  { value: 'avanzado', label: 'Avanzado', color: 'bg-purple-100 text-purple-800' },
  { value: 'competicion', label: 'Competición', color: 'bg-red-100 text-red-800' },
  { value: 'menores', label: 'Menores', color: 'bg-yellow-100 text-yellow-800' },
]

// --- Estados de Jugador ---
export const PLAYER_STATUSES: { value: PlayerStatus; label: string; color: string }[] = [
  { value: 'activo', label: 'Activo', color: 'bg-green-100 text-green-800' },
  { value: 'lista_espera', label: 'Lista de espera', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'baja', label: 'Baja', color: 'bg-red-100 text-red-800' },
]

// --- Estados de Asistencia ---
export const ATTENDANCE_STATUSES: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: 'presente', label: 'Presente', color: 'bg-green-100 text-green-800' },
  { value: 'ausente', label: 'Ausente', color: 'bg-red-100 text-red-800' },
  { value: 'justificado', label: 'Justificado', color: 'bg-yellow-100 text-yellow-800' },
]

// --- Estados de Pago ---
export const PAYMENT_STATUSES: { value: PaymentStatus; label: string; color: string }[] = [
  { value: 'pendiente', label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'pagado', label: 'Pagado', color: 'bg-green-100 text-green-800' },
  { value: 'cancelado', label: 'Cancelado', color: 'bg-gray-100 text-gray-800' },
]

// --- Métodos de Pago ---
export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'transferencia', label: 'Transferencia bancaria' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'domiciliacion', label: 'Domiciliación bancaria' },
  { value: 'tarjeta', label: 'Tarjeta' },
]

// --- Roles ---
export const USER_ROLES: { value: UserRole; label: string }[] = [
  { value: 'director', label: 'Director' },
  { value: 'coordinador', label: 'Coordinador' },
  { value: 'entrenador', label: 'Entrenador' },
  { value: 'jugador', label: 'Jugador' },
  { value: 'tutor', label: 'Padre/Madre/Tutor' },
]

// --- Tipos de Pista ---
export const COURT_TYPES: { value: CourtType; label: string }[] = [
  { value: 'indoor', label: 'Indoor (Cubierta)' },
  { value: 'outdoor', label: 'Outdoor (Exterior)' },
]

export const COURT_SURFACES: { value: CourtSurface; label: string }[] = [
  { value: 'cristal', label: 'Cristal' },
  { value: 'muro', label: 'Muro' },
  { value: 'cesped', label: 'Césped artificial' },
]

// --- Frecuencia de Facturación ---
export const BILLING_FREQUENCIES: { value: BillingFrequency; label: string }[] = [
  { value: 'monthly', label: 'Mensual' },
  { value: 'installments', label: 'Por plazos' },
]

// --- Parentesco ---
export const GUARDIAN_RELATIONSHIPS: { value: GuardianRelationship; label: string }[] = [
  { value: 'padre', label: 'Padre' },
  { value: 'madre', label: 'Madre' },
  { value: 'tutor', label: 'Tutor legal' },
]

// --- Mano dominante ---
export const DOMINANT_HANDS: { value: DominantHand; label: string }[] = [
  { value: 'derecha', label: 'Derecha' },
  { value: 'izquierda', label: 'Izquierda' },
]

// --- Posición ---
export const PLAYER_POSITIONS: { value: PlayerPosition; label: string }[] = [
  { value: 'drive', label: 'Drive' },
  { value: 'reves', label: 'Revés' },
  { value: 'ambos', label: 'Ambos' },
]

// --- Días de la semana ---
export const DAYS_OF_WEEK = [
  { value: 1, label: 'Lunes', short: 'Lun' },
  { value: 2, label: 'Martes', short: 'Mar' },
  { value: 3, label: 'Miércoles', short: 'Mié' },
  { value: 4, label: 'Jueves', short: 'Jue' },
  { value: 5, label: 'Viernes', short: 'Vie' },
  { value: 6, label: 'Sábado', short: 'Sáb' },
  { value: 0, label: 'Domingo', short: 'Dom' },
]

// --- Meses ---
export const MONTHS = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
]

// --- Configuración por defecto ---
export const DEFAULT_MAX_CAPACITY = 4
export const CANCELLATION_DEADLINE_DAY = 5
export const RECOVERY_EXPIRY_DAYS = 30
