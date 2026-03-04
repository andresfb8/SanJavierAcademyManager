import { useMemo, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Select } from '@/components/ui/select'
import { useDataStore } from '@/stores/dataStore'
import { useAuthStore, hasPermission } from '@/stores/authStore'
import { PLAYER_LEVELS, DAYS_OF_WEEK, PAYMENT_METHODS } from '@/constants'
import type { AttendanceEntry, PaymentMethod, UserRole } from '@/types'
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  User,
  Clock,
  Users,
  ClipboardList,
  Info,
  RefreshCw,
  UserPlus,
  ChevronDown,
  ChevronRight,
  CreditCard,
  UserCheck,
  Search,
  CheckCircle2,
  Euro,
} from 'lucide-react'

// ==========================================
// ClassDetailPage - Detalle de clase de grupo
// ==========================================
// Ruta: /clases/:groupId/:date

/** Formatea una fecha como "Lunes, 6 de febrero de 2026" */
function formatDateLong(date: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

/** Toast de confirmacion temporal */
function SuccessToast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm font-medium text-green-800 shadow-lg">
        <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
        {message}
      </div>
    </div>
  )
}

function toISODate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date)
  if (isNaN(d.getTime())) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Seccion colapsable */
function CollapsibleSection({
  title,
  icon,
  isOpen,
  onToggle,
  children,
  badge,
}: {
  title: string
  icon: React.ReactNode
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
  badge?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-accent/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
          {badge}
        </div>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && <div className="border-t px-4 py-3">{children}</div>}
    </div>
  )
}

export default function ClassDetailPage() {
  const { groupId, date } = useParams<{ groupId: string; date: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const canEditPayments = hasPermission(user?.role as UserRole, 'payments', 'write')

  const {
    groups,
    players,
    enrollments,
    attendance,
    payments,
    markPaymentPaid,
    addAttendanceRecord,
    updateAttendanceRecord,
    addEventPayment,
  } = useDataStore()

  // ===================
  // STATE - Pagos
  // ===================
  const [paymentMethods, setPaymentMethods] = useState<Record<string, string>>({})

  // ===================
  // STATE - Anadir jugadores
  // ===================
  const [openSection, setOpenSection] = useState<
    'recovery' | 'paid' | 'guest' | null
  >(null)
  const [paidSearchTerm, setPaidSearchTerm] = useState('')
  const [paidAmount, setPaidAmount] = useState('')
  const [guestName, setGuestName] = useState('')
  const [guestAmount, setGuestAmount] = useState('')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // ===================
  // DATOS DERIVADOS
  // ===================

  const group = useMemo(
    () => groups.find((g) => g.id === groupId) ?? null,
    [groups, groupId]
  )

  const classDate = useMemo(() => {
    if (!date) return null
    const parsed = new Date(date + 'T00:00:00')
    return isNaN(parsed.getTime()) ? null : parsed
  }, [date])

  const classDayOfWeek = useMemo(() => {
    if (!classDate) return null
    return classDate.getDay()
  }, [classDate])

  const dayName = useMemo(() => {
    if (classDayOfWeek === null) return ''
    const day = DAYS_OF_WEEK.find((d) => d.value === classDayOfWeek)
    return day?.label ?? ''
  }, [classDayOfWeek])

  const scheduleForDay = useMemo(() => {
    if (!group || classDayOfWeek === null) return null
    return group.schedule.find((s) => s.dayOfWeek === classDayOfWeek) ?? null
  }, [group, classDayOfWeek])

  const levelInfo = useMemo(() => {
    if (!group) return null
    return PLAYER_LEVELS.find((l) => l.value === group.level) ?? null
  }, [group])

  // Registro de asistencia existente para este grupo + fecha
  const existingAttendance = useMemo(() => {
    if (!groupId || !date) return null
    return (
      attendance.find((a) => {
        const d = toISODate(a.date)
        return a.groupId === groupId && d === date
      }) ?? null
    )
  }, [groupId, date, attendance])

  // Inscripciones activas del grupo
  const activeEnrollments = useMemo(() => {
    if (!groupId) return []
    return enrollments.filter((e) => e.groupId === groupId && e.isActive)
  }, [groupId, enrollments])

  // IDs de jugadores inscritos en este grupo
  const enrolledPlayerIds = useMemo(() => {
    return new Set(activeEnrollments.map((e) => e.playerId))
  }, [activeEnrollments])

  // IDs de jugadores que ya estan en la asistencia de hoy (para evitar duplicados)
  const attendancePlayerIds = useMemo(() => {
    if (!existingAttendance) return new Set<string>()
    return new Set(existingAttendance.records.map((r) => r.playerId))
  }, [existingAttendance])

  // Jugadores inscritos con datos completos
  const enrolledPlayers = useMemo(() => {
    return activeEnrollments
      .map((enrollment) => {
        const player = players.find((p) => p.id === enrollment.playerId)
        if (!player) return null
        return {
          id: player.id,
          firstName: player.firstName,
          lastName: player.lastName,
          level: player.level,
          recoveryCredits: player.recoveryCredits,
        }
      })
      .filter(Boolean) as {
        id: string
        firstName: string
        lastName: string
        level: string
        recoveryCredits: number
      }[]
  }, [activeEnrollments, players])

  // Pagos del mes actual para este grupo
  const currentMonthPayments = useMemo(() => {
    if (!groupId) return []
    const now = new Date()
    const month = now.getMonth() + 1
    const year = now.getFullYear()
    return payments.filter(
      (p) => p.groupId === groupId && p.billingMonth === month && p.billingYear === year && p.status !== 'cancelado'
    )
  }, [payments, groupId])

  const paymentSummary = useMemo(() => {
    const paid = currentMonthPayments.filter((p) => p.status === 'pagado')
    const pending = currentMonthPayments.filter((p) => p.status === 'pendiente')
    return {
      paidCount: paid.length,
      pendingCount: pending.length,
      totalPaid: paid.reduce((s, p) => s + p.amount, 0),
      totalPending: pending.reduce((s, p) => s + p.amount, 0),
      total: currentMonthPayments.length,
    }
  }, [currentMonthPayments])

  function handleMarkGroupPaymentPaid(paymentId: string) {
    const method = (paymentMethods[paymentId] || 'efectivo') as PaymentMethod
    markPaymentPaid(paymentId, method)
  }

  // Jugadores con creditos de recuperacion que NO estan en este grupo y NO estan ya en la asistencia
  const recoveryEligiblePlayers = useMemo(() => {
    if (!groupId) return []
    return players.filter(
      (p) =>
        p.status === 'activo' &&
        p.recoveryCredits > 0 &&
        !enrolledPlayerIds.has(p.id) &&
        !attendancePlayerIds.has(p.id)
    )
  }, [groupId, enrolledPlayerIds, attendancePlayerIds, players])

  // Jugadores activos que NO estan en este grupo y NO estan ya en la asistencia (para pago extra)
  const availablePlayersForPaid = useMemo(() => {
    if (!groupId) return []
    const filtered = players.filter(
      (p) =>
        p.status === 'activo' &&
        !enrolledPlayerIds.has(p.id) &&
        !attendancePlayerIds.has(p.id)
    )
    if (!paidSearchTerm.trim()) return filtered
    const term = paidSearchTerm.toLowerCase()
    return filtered.filter(
      (p) =>
        p.firstName.toLowerCase().includes(term) ||
        p.lastName.toLowerCase().includes(term) ||
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(term)
    )
  }, [groupId, enrolledPlayerIds, attendancePlayerIds, players, paidSearchTerm])

  // ===================
  // TOAST HELPER
  // ===================

  const showToast = useCallback((message: string) => {
    setToastMessage(message)
    setTimeout(() => setToastMessage(null), 3000)
  }, [])

  // ===================
  // ADD PLAYER HELPERS
  // ===================

  /** Anade una entrada a la asistencia (existente o nueva) */
  const addEntryToAttendance = useCallback(
    (entry: AttendanceEntry) => {
      if (!groupId || !date || !group) return

      if (existingAttendance) {
        // Anadir al registro existente
        updateAttendanceRecord(existingAttendance.id, {
          records: [...existingAttendance.records, entry],
        })
      } else {
        // Crear nuevo registro de asistencia
        addAttendanceRecord({
          groupId,
          groupName: group.name,
          date: new Date(date + 'T00:00:00'),
          records: [entry],
          coachId: group.coachId,
        })
      }
    },
    [groupId, date, group, existingAttendance, updateAttendanceRecord, addAttendanceRecord]
  )

  /** Opcion 1: Anadir jugador con credito de recuperacion */
  const handleAddWithRecovery = useCallback(
    (playerId: string, playerName: string) => {
      const entry: AttendanceEntry = {
        playerId,
        playerName,
        status: 'presente',
        isRecovery: true,
        notes: 'Clase de recuperacion',
      }

      if (existingAttendance) {
        // updateAttendanceRecord now handles credit synchronization automatically
        updateAttendanceRecord(existingAttendance.id, {
          records: [...existingAttendance.records, entry],
        })
      } else {
        // addAttendanceRecord also handles credits automatically (isRecovery -> -1)
        addAttendanceRecord({
          groupId: groupId!,
          groupName: group!.name,
          date: new Date(date! + 'T00:00:00'),
          records: [entry],
          coachId: group!.coachId,
        })
      }

      showToast(`${playerName} anadido con credito de recuperacion`)
    },
    [
      existingAttendance,
      groupId,
      date,
      group,
      updateAttendanceRecord,
      addAttendanceRecord,
      showToast,
    ]
  )

  /** Opcion 2: Anadir jugador con pago extra */
  const handleAddWithPayment = useCallback(
    (playerId: string, playerName: string) => {
      const amount = parseFloat(paidAmount)
      if (isNaN(amount) || amount <= 0) return

      const entry: AttendanceEntry = {
        playerId,
        playerName,
        status: 'presente',
        isRecovery: false,
        notes: `Pago extra: ${amount.toFixed(2)} EUR`,
      }

      addEntryToAttendance(entry)

      // Crear registro de pago de evento
      addEventPayment({
        eventId: `class-extra-${groupId}-${date}`,
        eventName: `Clase extra - ${group!.name} (${date})`,
        playerId,
        playerName,
        amount,
        status: 'pendiente',
      })

      setPaidAmount('')
      setPaidSearchTerm('')
      showToast(`${playerName} anadido con pago de ${amount.toFixed(2)} EUR`)
    },
    [paidAmount, groupId, date, group, addEntryToAttendance, addEventPayment, showToast]
  )

  /** Opcion 3: Anadir jugador invitado */
  const handleAddGuest = useCallback(() => {
    const name = guestName.trim()
    if (!name) return

    const guestId = `guest-${Date.now()}`
    const amount = parseFloat(guestAmount) || 0

    const entry: AttendanceEntry = {
      playerId: guestId,
      playerName: name,
      status: 'presente',
      isRecovery: false,
      notes: amount > 0 ? `Invitado - Pago: ${amount.toFixed(2)} EUR` : 'Invitado',
    }

    addEntryToAttendance(entry)

    // Si hay importe, crear un registro de pago
    if (amount > 0) {
      addEventPayment({
        eventId: `class-extra-${groupId}-${date}`,
        eventName: `Clase extra - ${group!.name} (${date})`,
        playerId: guestId,
        playerName: name,
        amount,
        status: 'pendiente',
      })
    }

    setGuestName('')
    setGuestAmount('')
    showToast(`Invitado "${name}" anadido a la clase`)
  }, [guestName, guestAmount, groupId, date, group, addEntryToAttendance, addEventPayment, showToast])

  // ===================
  // GUARDAS
  // ===================

  if (!group) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Clase no encontrada" />
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <p className="text-muted-foreground mb-4">
            No se ha encontrado el grupo solicitado.
          </p>
          <Button variant="outline" onClick={() => navigate('/agenda')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Agenda
          </Button>
        </div>
      </div>
    )
  }

  if (!classDate) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Fecha no valida" />
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <p className="text-muted-foreground mb-4">
            La fecha proporcionada no es valida.
          </p>
          <Button variant="outline" onClick={() => navigate('/agenda')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Agenda
          </Button>
        </div>
      </div>
    )
  }

  // ===================
  // RENDER
  // ===================

  return (
    <div className="flex flex-col h-full">
      <Header
        title={group.name}
        subtitle={`${dayName} ${formatDateLong(classDate)} - ${group.coachName}`}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate('/agenda')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Agenda
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* ============================== */}
        {/* INFORMACION DEL GRUPO          */}
        {/* ============================== */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Informacion de la clase
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Nivel
                </p>
                {levelInfo && (
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${levelInfo.color}`}
                  >
                    {levelInfo.label}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Pista
                </p>
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{group.courtName}</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Entrenador
                </p>
                <div className="flex items-center gap-1.5">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{group.coachName}</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Horario
                </p>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {scheduleForDay
                      ? `${scheduleForDay.startTime} - ${scheduleForDay.endTime}`
                      : 'Sin horario este dia'}
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Inscripciones
                </p>
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {group.currentEnrollment} / {group.maxCapacity}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ============================== */}
        {/* SECCION DE ASISTENCIA          */}
        {/* ============================== */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Asistencia
            </CardTitle>
          </CardHeader>
          <CardContent>
            {existingAttendance ? (
              <>
                <div className="mb-4 flex items-center gap-2 rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
                  <Info className="h-4 w-4 flex-shrink-0" />
                  <span>
                    Asistencia registrada para esta fecha
                    ({existingAttendance.records.length} jugador
                    {existingAttendance.records.length !== 1 ? 'es' : ''}).
                  </span>
                </div>

                {/* Tabla responsive: oculta en movil, visible en sm+ */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Jugador</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Recuperacion</TableHead>
                        <TableHead>Notas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {existingAttendance.records.map((entry) => (
                        <TableRow
                          key={`${entry.playerId}-${entry.isRecovery ? 'rec' : 'reg'}`}
                        >
                          <TableCell className="font-medium">
                            {entry.playerId.startsWith('guest-') ? (
                              <span className="text-muted-foreground">
                                {entry.playerName}
                                <Badge
                                  variant="outline"
                                  className="ml-2 text-[10px]"
                                >
                                  Invitado
                                </Badge>
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="text-primary hover:underline text-left"
                                onClick={() =>
                                  navigate(`/jugadores/${entry.playerId}`)
                                }
                              >
                                {entry.playerName}
                              </button>
                            )}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={entry.status} />
                          </TableCell>
                          <TableCell>
                            {entry.isRecovery ? (
                              <Badge
                                variant="default"
                                className="bg-blue-100 text-blue-700 border-blue-200"
                              >
                                Si
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">
                                No
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {entry.notes || '-'}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Lista movil: visible solo en pantallas pequenas */}
                <div className="sm:hidden space-y-2">
                  {existingAttendance.records.map((entry) => (
                    <div
                      key={`mob-${entry.playerId}-${entry.isRecovery ? 'rec' : 'reg'}`}
                      className="rounded-md border p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        {entry.playerId.startsWith('guest-') ? (
                          <span className="text-sm font-medium text-muted-foreground">
                            {entry.playerName}
                            <Badge
                              variant="outline"
                              className="ml-2 text-[10px]"
                            >
                              Invitado
                            </Badge>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="text-sm font-medium text-primary hover:underline text-left"
                            onClick={() =>
                              navigate(`/jugadores/${entry.playerId}`)
                            }
                          >
                            {entry.playerName}
                          </button>
                        )}
                        <StatusBadge status={entry.status} />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {entry.isRecovery && (
                          <Badge
                            variant="default"
                            className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]"
                          >
                            Recuperacion
                          </Badge>
                        )}
                        {entry.notes && <span>{entry.notes}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <ClipboardList className="h-10 w-10 mb-3 opacity-50" />
                <p className="text-sm font-medium">
                  No se ha registrado asistencia para esta fecha.
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => navigate('/asistencia')}
                >
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Ir a Asistencia
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ============================== */}
        {/* JUGADORES INSCRITOS            */}
        {/* ============================== */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5" />
              Jugadores inscritos ({enrolledPlayers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {enrolledPlayers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No hay jugadores inscritos en este grupo.
              </p>
            ) : (
              <div className="space-y-2">
                {enrolledPlayers.map((player) => {
                  const playerLevel = PLAYER_LEVELS.find(
                    (l) => l.value === player.level
                  )
                  return (
                    <div
                      key={player.id}
                      className="flex items-center justify-between rounded-md border px-3 sm:px-4 py-2.5 hover:bg-accent/30 transition-colors"
                    >
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <button
                          type="button"
                          className="text-sm font-medium text-primary hover:underline text-left truncate"
                          onClick={() => navigate(`/jugadores/${player.id}`)}
                        >
                          {player.firstName} {player.lastName}
                        </button>
                        {playerLevel && (
                          <span
                            className={`hidden sm:inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 ${playerLevel.color}`}
                          >
                            {playerLevel.label}
                          </span>
                        )}
                      </div>
                      {player.recoveryCredits > 0 && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          <RefreshCw className="h-3 w-3 mr-1" />
                          {player.recoveryCredits} credito
                          {player.recoveryCredits !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ============================== */}
        {/* ESTADO DE PAGOS DEL MES        */}
        {/* ============================== */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Euro className="h-5 w-5" />
              Estado de pagos del mes
              {paymentSummary.total > 0 && (
                <Badge
                  variant="outline"
                  className={paymentSummary.pendingCount === 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}
                >
                  {paymentSummary.paidCount}/{paymentSummary.total} pagados
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentMonthPayments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                <Euro className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No hay recibos generados para este mes.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Resumen */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border p-3 text-center">
                    <p className="text-xs text-muted-foreground">Cobrado</p>
                    <p className="text-lg font-bold text-green-600">{paymentSummary.totalPaid.toFixed(2)} &euro;</p>
                  </div>
                  <div className="rounded-md border p-3 text-center">
                    <p className="text-xs text-muted-foreground">Pendiente</p>
                    <p className="text-lg font-bold text-yellow-600">{paymentSummary.totalPending.toFixed(2)} &euro;</p>
                  </div>
                </div>

                {/* Lista de pagos por alumno */}
                <div className="space-y-2">
                  {currentMonthPayments.map((payment) => {
                    const isPaid = payment.status === 'pagado'
                    return (
                      <div key={payment.id} className="flex items-center justify-between rounded-md border px-3 py-2.5 gap-2">
                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            className="text-sm font-medium text-primary hover:underline text-left truncate block"
                            onClick={() => navigate(`/jugadores/${payment.playerId}`)}
                          >
                            {payment.playerName}
                          </button>
                          <p className="text-xs text-muted-foreground">{payment.amount.toFixed(2)} &euro;</p>
                        </div>
                        {isPaid ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge className="bg-green-100 text-green-800">Pagado</Badge>
                            {payment.paymentMethod && (
                              <span className="text-[10px] text-muted-foreground capitalize">{payment.paymentMethod}</span>
                            )}
                          </div>
                        ) : canEditPayments ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <Select
                              className="w-32 h-8 text-xs"
                              options={PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label }))}
                              value={paymentMethods[payment.id] || 'efectivo'}
                              onChange={(e) => setPaymentMethods((prev) => ({ ...prev, [payment.id]: e.target.value }))}
                            />
                            <Button variant="outline" size="sm" onClick={() => handleMarkGroupPaymentPaid(payment.id)}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Pagado
                            </Button>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-300">Pendiente</Badge>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ============================== */}
        {/* ANADIR JUGADORES A ESTA CLASE  */}
        {/* ============================== */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Anadir jugadores a esta clase
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* ---- Opcion 1: Con credito de recuperacion ---- */}
            <CollapsibleSection
              title="Con credito de recuperacion"
              icon={<RefreshCw className="h-4 w-4 text-blue-600" />}
              isOpen={openSection === 'recovery'}
              onToggle={() =>
                setOpenSection((prev) =>
                  prev === 'recovery' ? null : 'recovery'
                )
              }
              badge={
                recoveryEligiblePlayers.length > 0 ? (
                  <Badge
                    variant="secondary"
                    className="ml-2 text-[10px] px-1.5 py-0"
                  >
                    {recoveryEligiblePlayers.length}
                  </Badge>
                ) : undefined
              }
            >
              {recoveryEligiblePlayers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">
                  No hay jugadores con creditos de recuperacion disponibles.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-2.5 text-xs text-blue-800">
                    <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>
                      Al anadir un jugador con credito de recuperacion, se le
                      descontara 1 credito y aparecera como presente en la
                      asistencia.
                    </span>
                  </div>
                  {recoveryEligiblePlayers.map((player) => {
                    const playerLevel = PLAYER_LEVELS.find(
                      (l) => l.value === player.level
                    )
                    return (
                      <div
                        key={player.id}
                        className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-accent/30 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <button
                            type="button"
                            className="text-sm font-medium text-primary hover:underline text-left truncate"
                            onClick={() => navigate(`/jugadores/${player.id}`)}
                          >
                            {player.firstName} {player.lastName}
                          </button>
                          {playerLevel && (
                            <span
                              className={`hidden sm:inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 ${playerLevel.color}`}
                            >
                              {playerLevel.label}
                            </span>
                          )}
                          <Badge
                            variant="secondary"
                            className="text-[10px] shrink-0"
                          >
                            {player.recoveryCredits} credito
                            {player.recoveryCredits !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 ml-2 text-blue-700 border-blue-300 hover:bg-blue-50"
                          onClick={() =>
                            handleAddWithRecovery(
                              player.id,
                              `${player.firstName} ${player.lastName}`
                            )
                          }
                        >
                          <RefreshCw className="h-3.5 w-3.5 mr-1" />
                          <span className="hidden sm:inline">
                            Anadir con credito
                          </span>
                          <span className="sm:hidden">Anadir</span>
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </CollapsibleSection>

            {/* ---- Opcion 2: Pago extra ---- */}
            <CollapsibleSection
              title="Pago extra"
              icon={<CreditCard className="h-4 w-4 text-emerald-600" />}
              isOpen={openSection === 'paid'}
              onToggle={() =>
                setOpenSection((prev) => (prev === 'paid' ? null : 'paid'))
              }
            >
              <div className="space-y-3">
                {/* Buscador */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar jugador por nombre..."
                    value={paidSearchTerm}
                    onChange={(e) => setPaidSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Campo de importe */}
                <div className="flex items-center gap-2">
                  <Euro className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Importe (EUR)"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className="max-w-[200px]"
                  />
                </div>

                {/* Lista de jugadores */}
                {availablePlayersForPaid.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-3">
                    {paidSearchTerm.trim()
                      ? 'No se encontraron jugadores con ese nombre.'
                      : 'No hay jugadores disponibles para anadir.'}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[280px] overflow-y-auto">
                    {availablePlayersForPaid.map((player) => {
                      const playerLevel = PLAYER_LEVELS.find(
                        (l) => l.value === player.level
                      )
                      const amount = parseFloat(paidAmount)
                      const isValidAmount = !isNaN(amount) && amount > 0
                      return (
                        <div
                          key={player.id}
                          className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-accent/30 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <button
                              type="button"
                              className="text-sm font-medium text-primary hover:underline text-left truncate"
                              onClick={() =>
                                navigate(`/jugadores/${player.id}`)
                              }
                            >
                              {player.firstName} {player.lastName}
                            </button>
                            {playerLevel && (
                              <span
                                className={`hidden sm:inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 ${playerLevel.color}`}
                              >
                                {playerLevel.label}
                              </span>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0 ml-2 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                            disabled={!isValidAmount}
                            onClick={() =>
                              handleAddWithPayment(
                                player.id,
                                `${player.firstName} ${player.lastName}`
                              )
                            }
                          >
                            <CreditCard className="h-3.5 w-3.5 mr-1" />
                            <span className="hidden sm:inline">
                              Anadir con pago
                            </span>
                            <span className="sm:hidden">Pago</span>
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </CollapsibleSection>

            {/* ---- Opcion 3: Invitado ---- */}
            <CollapsibleSection
              title="Invitado"
              icon={<UserCheck className="h-4 w-4 text-orange-600" />}
              isOpen={openSection === 'guest'}
              onToggle={() =>
                setOpenSection((prev) => (prev === 'guest' ? null : 'guest'))
              }
            >
              <div className="space-y-3">
                <div className="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 p-2.5 text-xs text-orange-800">
                  <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  <span>
                    Para jugadores que no estan registrados en el sistema.
                    Se anadiran directamente a la asistencia de esta clase.
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Nombre del invitado"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                    />
                  </div>
                  <div className="w-full sm:w-[160px]">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Importe (opcional)"
                      value={guestAmount}
                      onChange={(e) => setGuestAmount(e.target.value)}
                    />
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="text-orange-700 border-orange-300 hover:bg-orange-50"
                  disabled={!guestName.trim()}
                  onClick={handleAddGuest}
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Anadir invitado
                  {guestAmount && parseFloat(guestAmount) > 0
                    ? ` (${parseFloat(guestAmount).toFixed(2)} EUR)`
                    : ' (sin cargo)'}
                </Button>
              </div>
            </CollapsibleSection>
          </CardContent>
        </Card>
      </div>

      {/* Toast de confirmacion */}
      {toastMessage && <SuccessToast message={toastMessage} />}
    </div>
  )
}
