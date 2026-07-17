import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

import { StatusBadge } from '@/components/shared/StatusBadge'
import { PlayerFormDialog, type PlayerFormData } from '@/components/shared/PlayerFormDialog'
import { PlayerSelfEditDialog } from '@/components/player/PlayerSelfEditDialog'
import { SeasonPaymentDialog } from '@/components/shared/SeasonPaymentDialog'
import { useDataStore } from '@/stores/dataStore'
import { ArrowLeft, Mail, Phone, MapPin, CreditCard, Calendar, Activity, Users, AlertCircle, Edit as EditIcon, FileText, Star, Eye, Plus, Minus, RotateCcw, Send, CheckCircle2, CalendarRange } from 'lucide-react'
import { cn, formatDate, formatCurrency, calculateAge, isMinor as checkIsMinor } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { EvaluationDetailView } from '@/components/shared/EvaluationDetailView'
import type { Evaluation } from '@/types'
import { useMatchReportsQuery, useInvoicesQuery } from '@/hooks/useQueries'
import { useAuthStore } from '@/stores/authStore'
import { getPlayerPortalStatus } from '@/lib/player-portal-status'


// =========================================
// Helper: InfoRow
// =========================================

function InfoRow({ label, value, icon: Icon }: { label: string; value: string | React.ReactNode; icon?: any }) {
  return (
    <div className="flex items-start gap-3 py-2">
      {Icon && <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{typeof value === 'string' ? value || '—' : value}</p>
      </div>
    </div>
  )
}

// =========================================
// Label maps
// =========================================

const handLabels: Record<string, string> = {
  derecha: 'Derecha',
  izquierda: 'Izquierda',
}

const positionLabels: Record<string, string> = {
  drive: 'Drive',
  reves: 'Revés',
  ambos: 'Ambos',
}

const guardianRelLabels: Record<string, string> = {
  padre: 'Padre',
  madre: 'Madre',
  tutor: 'Tutor legal',
}

const paymentMethodLabels: Record<string, string> = {
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
  domiciliacion: 'Domiciliación',
  tarjeta: 'Tarjeta',
}

const attendanceStatusLabels: Record<string, string> = {
  presente: 'Presente',
  ausente: 'Ausente',
  justificado: 'Justificado',
}

// =========================================
// Main Component
// =========================================

export default function PlayerProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    players,
    enrollments,
    groups,
    updatePlayer,
    invitePlayer,
    payments: allBasePayments,
    attendance,
    evaluations,
    generateScheduledInstallments,
    users,
    invitations,
  } = useDataStore()
  const { user, isDataLoading } = useAuthStore()
  const activeRole = user?.activeRole ?? user?.role

  // Invitar al portal es cosa de admin (mismo criterio que isAdmin() en las rules).
  // Además, con rol de BD entrenador no se sincronizan `invitations` ni `users`,
  // así que el estado derivado no sería fiable para ellos.
  const isAdmin = activeRole === 'director' || activeRole === 'coordinador'

  const payments = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return allBasePayments.filter(p => p.billingYear === currentYear || p.billingYear === currentYear - 1)
  }, [allBasePayments])


  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showSeasonPaymentDialog, setShowSeasonPaymentDialog] = useState(false)
  const [viewingEvaluation, setViewingEvaluation] = useState<Evaluation | null>(null)

  const player = useMemo(() => players.find((p) => p.id === id), [players, id])

  const portalStatus = useMemo(
    () => (player ? getPlayerPortalStatus(player, users, invitations) : 'sin_acceso'),
    [player, users, invitations]
  )

  // Player payments
  const playerPayments = useMemo(() => {
    if (!player) return []
    return payments
      .filter((p) => p.playerId === player.id)
      .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())
  }, [payments, player])

  // Pending debt
  const totalDebt = useMemo(() => {
    return playerPayments
      .filter((p) => p.status === 'pendiente')
      .reduce((sum, p) => sum + p.amount, 0)
  }, [playerPayments])

  // Active enrollments
  const activeEnrollments = useMemo(() => {
    if (!player) return []
    return enrollments.filter((e) => e.playerId === player.id && e.isActive)
  }, [enrollments, player])

  // Installments programadas pero aún no generadas como recibo
  const ungeneratedInstallments = useMemo(() => {
    if (!player) return []
    const result: { enrollmentId: string; groupName: string; key: string; year: number; month: number; amount: number }[] = []
    const existingKeys = new Set(
      allBasePayments
        .filter((p) => p.playerId === player.id)
        .map((p) => `${p.enrollmentId}__${p.billingYear}-${String(p.billingMonth).padStart(2, '0')}`)
    )
    for (const enrollment of activeEnrollments) {
      const group = groups.find((g) => g.id === enrollment.groupId)
      if (!group || group.billingFrequency !== 'installments' || !group.installmentPrices) continue
      Object.entries(group.installmentPrices)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([key, amount]) => {
          const lookupKey = `${enrollment.id}__${key}`
          if (existingKeys.has(lookupKey)) return
          const [yearStr, monthStr] = key.split('-')
          result.push({
            enrollmentId: enrollment.id,
            groupName: enrollment.groupName,
            key,
            year: parseInt(yearStr),
            month: parseInt(monthStr),
            amount: enrollment.customPrice ?? amount,
          })
        })
    }
    return result
  }, [player, allBasePayments, activeEnrollments, groups])

  // All enrollments for groups tab
  const playerEnrollments = useMemo(() => {
    if (!player) return []
    return enrollments.filter((e) => e.playerId === player.id && e.isActive)
  }, [enrollments, player])

  // Attendance records where this player appears
  const playerAttendance = useMemo(() => {
    if (!player) return []
    const results: {
      date: Date
      groupName: string
      status: string
      isRecovery: boolean
      notes?: string
    }[] = []

    for (const record of attendance) {
      for (const entry of record.records) {
        if (entry.playerId === player.id) {
          results.push({
            date: record.date,
            groupName: record.groupName,
            status: entry.status,
            isRecovery: entry.isRecovery,
            notes: entry.notes,
          })
        }
      }
    }

    return results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [attendance, player])

  // Attendance rate
  const attendanceRate = useMemo(() => {
    if (playerAttendance.length === 0) return null
    const present = playerAttendance.filter((a) => a.status === 'presente').length
    return Math.round((present / playerAttendance.length) * 100)
  }, [playerAttendance])

  // Recovery credit history (derived from attendance records)
  const recoveryCreditHistory = useMemo(() => {
    if (!player) return []
    const movements: {
      date: Date
      groupName: string
      type: 'earned' | 'used'
      balance: number
    }[] = []

    // Collect all credit movements from attendance sorted by date ASC
    const allMovements: { date: Date; groupName: string; type: 'earned' | 'used' }[] = []

    for (const record of attendance) {
      for (const entry of record.records) {
        if (entry.playerId !== player.id) continue
        if (entry.status === 'justificado') {
          allMovements.push({
            date: record.date instanceof Date ? record.date : new Date(record.date),
            groupName: record.groupName,
            type: 'earned',
          })
        }
        if (entry.isRecovery) {
          allMovements.push({
            date: record.date instanceof Date ? record.date : new Date(record.date),
            groupName: record.groupName,
            type: 'used',
          })
        }
      }
    }

    // Sort by date ascending to calculate running balance
    allMovements.sort((a, b) => a.date.getTime() - b.date.getTime())

    let balance = 0
    for (const m of allMovements) {
      balance += m.type === 'earned' ? 1 : -1
      balance = Math.max(0, balance)
      movements.push({ ...m, balance })
    }

    // Return in reverse chronological order (newest first)
    return movements.reverse()
  }, [attendance, player])

  // Mask IBAN: show only last 4 digits
  const maskedIban = useMemo(() => {
    if (!player) return '—'
    const iban = player.iban.replace(/\s/g, '')
    if (iban.length < 4) return '****'
    return '**** **** **** **** **** ' + iban.slice(-4)
  }, [player])

  // Player evaluations
  const playerEvaluations = useMemo(() => {
    if (!player) return []
    return evaluations
      .filter((e) => e.playerId === player.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [evaluations, player])

  // Handle edit submit
  const handleEditSubmit = (formData: PlayerFormData) => {
    if (!player) return
    const birthDate = new Date(formData.birthDate)
    const playerIsMinor = checkIsMinor(birthDate)

    updatePlayer(player.id, {
      firstName: formData.firstName,
      lastName: formData.lastName,
      dni: formData.dni,
      birthDate,
      email: formData.email,
      phone: formData.phone,
      address: formData.address,
      city: formData.city,
      postalCode: formData.postalCode,
      level: formData.level,
      dominantHand: formData.dominantHand,
      position: formData.position,
      previousExperience: formData.previousExperience || undefined,
      medicalNotes: formData.medicalNotes || undefined,
      bankAccountHolder: formData.bankAccountHolder,
      iban: formData.iban,
      status: formData.status,
      isMinor: playerIsMinor,
      guardian: playerIsMinor ? {
        firstName: formData.guardianFirstName,
        lastName: formData.guardianLastName,
        dni: formData.guardianDni,
        phone: formData.guardianPhone,
        email: formData.guardianEmail,
        relationship: formData.guardianRelationship,
      } : undefined,
      notes: formData.notes || undefined,
    })
    setShowEditDialog(false)
  }

  // =========================================
  // Not found
  // =========================================

  if (isDataLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Cargando perfil...</p>
        </div>
      </div>
    )
  }

  if (!player) {
    return (
      <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
        <Header title="Perfil del Jugador" />
        <Card className="border-none shadow-sm rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-slate-400" />
            </div>
            <h2 className="text-lg font-semibold">Jugador no encontrado</h2>
            <p className="text-sm text-muted-foreground mb-2">
              El jugador que buscas no existe o ha sido eliminado.
            </p>
            {user?.linkedPlayerId === id ? (
              <p className="text-xs text-rose-500 mb-6 bg-rose-50 px-3 py-1 rounded-md">
                Error de vinculación: Tu usuario apunta al ID <b>{id}</b> pero no existe en la base de datos. Contacta con tu academia.
              </p>
            ) : (
              <p className="text-xs text-slate-400 mb-6">ID buscado: {id}</p>
            )}
            <Button variant="outline" onClick={() => navigate(activeRole === 'jugador' || activeRole === 'tutor' ? '/' : '/jugadores')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {activeRole === 'jugador' || activeRole === 'tutor' ? 'Volver al Inicio' : 'Volver a jugadores'}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // =========================================
  // Render
  // =========================================

  return (
    <div>
      {/* Header */}
      <Header
        title={`${player.firstName} ${player.lastName}`}
        subtitle={`DNI: ${player.dni}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={player.status} />
            {isAdmin && player.email && (
              <Button
                variant={portalStatus === 'activo' ? "ghost" : "outline"}
                size="sm"
                className={cn(
                  "gap-2",
                  portalStatus === 'activo' && "text-emerald-600 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-700"
                )}
                onClick={() => invitePlayer(player.id)}
                disabled={portalStatus === 'activo'}
              >
                {portalStatus === 'activo' ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {portalStatus === 'activo' ? 'Acceso activo' : portalStatus === 'invitado' ? 'Reenviar invitación' : 'Invitar al portal'}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
              <EditIcon className="h-4 w-4 mr-1" />
              Editar
            </Button>
            {activeRole !== 'jugador' && activeRole !== 'tutor' && (
              <Button variant="outline" size="sm" onClick={() => navigate('/jugadores')}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Volver
              </Button>
            )}
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Deuda pendiente */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Deuda pendiente</p>
                  <p className={`text-lg font-bold ${totalDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(totalDebt)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Grupos activos */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Grupos activos</p>
                  <p className="text-lg font-bold">{activeEnrollments.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Creditos de recuperacion */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100 text-yellow-600">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Créditos de recuperación</p>
                  <p className="text-lg font-bold">{player.recoveryCredits}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tasa de asistencia */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tasa de asistencia</p>
                  <p className="text-lg font-bold">
                    {attendanceRate !== null ? `${attendanceRate}%` : 'Sin datos'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="personal">
          <TabsList>
            <TabsTrigger value="personal">Datos Personales</TabsTrigger>
            <TabsTrigger value="facturacion">Facturación</TabsTrigger>
            <TabsTrigger value="asistencia">Asistencia</TabsTrigger>
            <TabsTrigger value="grupos">Grupos</TabsTrigger>
            <TabsTrigger value="informes">Informes</TabsTrigger>
          </TabsList>

          {/* ================================ */}
          {/* TAB: Datos Personales            */}
          {/* ================================ */}
          <TabsContent value="personal">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Datos personales */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Información personal</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <InfoRow label="Nombre completo" value={`${player.firstName} ${player.lastName}`} />
                  <InfoRow label="DNI" value={player.dni} />
                  <InfoRow
                    label="Fecha de nacimiento"
                    value={`${formatDate(player.birthDate)} (${calculateAge(player.birthDate)} años)`}
                    icon={Calendar}
                  />
                  <InfoRow label="Email" value={player.email} icon={Mail} />
                  <InfoRow label="Teléfono" value={player.phone} icon={Phone} />
                  <InfoRow label="Dirección" value={player.address} icon={MapPin} />
                  <InfoRow label="Ciudad" value={player.city} />
                  <InfoRow label="Código postal" value={player.postalCode} />
                  <InfoRow label="Talla de ropa" value={player.clothingSize || '\u2014'} />
                </CardContent>
              </Card>

              {/* Datos deportivos */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Información deportiva</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <InfoRow label="Nivel" value={<StatusBadge status={player.level} />} />
                  <InfoRow label="Mano dominante" value={handLabels[player.dominantHand] || player.dominantHand} />
                  <InfoRow label="Posición" value={positionLabels[player.position] || player.position} />
                  <InfoRow label="Experiencia previa" value={player.previousExperience || '—'} />
                  <InfoRow label="Notas médicas" value={player.medicalNotes || '—'} icon={AlertCircle} />
                </CardContent>
              </Card>

              {/* Tutor (si es menor) */}
              {player.isMinor && player.guardian && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Tutor / Representante legal</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <InfoRow
                      label="Parentesco"
                      value={guardianRelLabels[player.guardian.relationship] || player.guardian.relationship}
                    />
                    <InfoRow
                      label="Nombre completo"
                      value={`${player.guardian.firstName} ${player.guardian.lastName}`}
                    />
                    <InfoRow label="DNI" value={player.guardian.dni} />
                    <InfoRow label="Teléfono" value={player.guardian.phone} icon={Phone} />
                    <InfoRow label="Email" value={player.guardian.email} icon={Mail} />
                  </CardContent>
                </Card>
              )}

              {/* Datos bancarios */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Datos bancarios</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <InfoRow label="Titular de la cuenta" value={player.bankAccountHolder} icon={CreditCard} />
                  <InfoRow label="IBAN" value={maskedIban} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ================================ */}
          {/* TAB: Facturacion                 */}
          {/* ================================ */}
          <TabsContent value="facturacion" className="space-y-4">
            {/* Pagos programados pendientes de generar (solo para tarifas por plazos) */}
            {activeRole !== 'jugador' && activeRole !== 'tutor' && ungeneratedInstallments.length > 0 && (
              <Card className="border-amber-200 bg-amber-50/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <CalendarRange className="h-4 w-4 text-amber-600" />
                      Pagos de la temporada sin generar
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {ungeneratedInstallments.length} cuota{ungeneratedInstallments.length > 1 ? 's' : ''} definidas en la tarifa que aún no tienen recibo.
                      Genéralos para poder marcarlos como pagados cuando el padre abone la temporada completa.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 border-amber-300 bg-white hover:bg-amber-50"
                    onClick={() => {
                      const enrollmentIds = [...new Set(ungeneratedInstallments.map((i) => i.enrollmentId))]
                      let total = 0
                      enrollmentIds.forEach((eid) => { total += generateScheduledInstallments(eid) })
                      toast.success(`${total} recibo${total !== 1 ? 's' : ''} generado${total !== 1 ? 's' : ''}. Márcalos como pagados desde aquí o desde Pagos.`)
                    }}
                  >
                    Generar todos
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-amber-100/60">
                          <th className="p-3 text-left text-xs font-medium text-amber-700">Mes</th>
                          <th className="p-3 text-left text-xs font-medium text-amber-700">Grupo</th>
                          <th className="p-3 text-right text-xs font-medium text-amber-700">Importe</th>
                          <th className="p-3 text-right text-xs font-medium text-amber-700"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {ungeneratedInstallments.map((item) => (
                          <tr key={`${item.enrollmentId}-${item.key}`} className="border-b last:border-0">
                            <td className="p-3 text-sm text-slate-700">
                              {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][item.month - 1]} {item.year}
                            </td>
                            <td className="p-3 text-sm text-muted-foreground">{item.groupName}</td>
                            <td className="p-3 text-sm text-right font-medium">{formatCurrency(item.amount)}</td>
                            <td className="p-3 text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs h-7 text-amber-700 hover:text-amber-900 hover:bg-amber-100"
                                onClick={() => {
                                  generateScheduledInstallments(item.enrollmentId)
                                  toast.success(`Cuota de ${['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][item.month - 1]} ${item.year} creada como pendiente.`)
                                }}
                              >
                                Generar
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Historial de pagos</CardTitle>
                {activeRole !== 'jugador' && activeRole !== 'tutor' && (
                  <Button variant="outline" size="sm" onClick={() => setShowSeasonPaymentDialog(true)}>
                    <CalendarRange className="h-4 w-4 mr-1" />
                    Pago libre
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {playerPayments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <CreditCard className="h-10 w-10 mb-3" />
                    <p className="text-sm">No hay pagos registrados</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground">Concepto</th>
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground">Grupo</th>
                          <th className="p-3 text-right text-sm font-medium text-muted-foreground">Importe</th>
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground">Estado</th>
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden md:table-cell">Fecha vencimiento</th>
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden md:table-cell">Fecha pago</th>
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden lg:table-cell">Método</th>
                        </tr>
                      </thead>
                      <tbody>
                        {playerPayments.map((payment) => (
                          <tr key={payment.id} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="p-3 text-sm">{payment.concept}</td>
                            <td className="p-3 text-sm text-muted-foreground">{payment.groupName}</td>
                            <td className="p-3 text-sm font-medium text-right">{formatCurrency(payment.amount)}</td>
                            <td className="p-3">
                              <StatusBadge status={payment.status} />
                            </td>
                            <td className="p-3 text-sm text-muted-foreground hidden md:table-cell">
                              {formatDate(payment.dueDate)}
                            </td>
                            <td className="p-3 text-sm text-muted-foreground hidden md:table-cell">
                              {payment.paidDate ? formatDate(payment.paidDate) : '—'}
                            </td>
                            <td className="p-3 text-sm text-muted-foreground hidden lg:table-cell">
                              {payment.paymentMethod ? paymentMethodLabels[payment.paymentMethod] || payment.paymentMethod : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================================ */}
          {/* TAB: Asistencia                  */}
          {/* ================================ */}
          <TabsContent value="asistencia">
            <div className="space-y-6">
              {/* Registro de asistencia */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Registro de asistencia</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {playerAttendance.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Activity className="h-10 w-10 mb-3" />
                      <p className="text-sm">No hay registros de asistencia</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="p-3 text-left text-sm font-medium text-muted-foreground">Fecha</th>
                            <th className="p-3 text-left text-sm font-medium text-muted-foreground">Grupo</th>
                            <th className="p-3 text-left text-sm font-medium text-muted-foreground">Estado</th>
                            <th className="p-3 text-left text-sm font-medium text-muted-foreground">Recuperación</th>
                            <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden md:table-cell">Notas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {playerAttendance.map((record, index) => (
                            <tr key={index} className="border-b hover:bg-muted/30 transition-colors">
                              <td className="p-3 text-sm">{formatDate(record.date)}</td>
                              <td className="p-3 text-sm text-muted-foreground">{record.groupName}</td>
                              <td className="p-3">
                                <StatusBadge status={record.status} />
                              </td>
                              <td className="p-3 text-sm">
                                {record.isRecovery ? (
                                  <Badge variant="outline" className="text-xs">
                                    Recuperación
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="p-3 text-sm text-muted-foreground hidden md:table-cell">
                                {record.notes || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Historial de créditos de recuperación */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <RotateCcw className="h-4 w-4" />
                      Historial de créditos de recuperación
                    </CardTitle>
                    <Badge variant="outline" className="text-xs font-semibold">
                      Saldo actual: {player.recoveryCredits}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {recoveryCreditHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <RotateCcw className="h-10 w-10 mb-3 opacity-40" />
                      <p className="text-sm">No hay movimientos de créditos</p>
                      <p className="text-xs mt-1">Los créditos se generan con faltas justificadas y se gastan en clases de recuperación</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="p-3 text-left text-sm font-medium text-muted-foreground">Fecha</th>
                            <th className="p-3 text-left text-sm font-medium text-muted-foreground">Grupo</th>
                            <th className="p-3 text-left text-sm font-medium text-muted-foreground">Movimiento</th>
                            <th className="p-3 text-center text-sm font-medium text-muted-foreground">Saldo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recoveryCreditHistory.map((movement, index) => (
                            <tr key={index} className="border-b hover:bg-muted/30 transition-colors">
                              <td className="p-3 text-sm">{formatDate(movement.date)}</td>
                              <td className="p-3 text-sm text-muted-foreground">{movement.groupName}</td>
                              <td className="p-3">
                                {movement.type === 'earned' ? (
                                  <div className="flex items-center gap-1.5">
                                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100">
                                      <Plus className="h-3 w-3 text-green-600" />
                                    </div>
                                    <span className="text-sm text-green-700 font-medium">+1 Falta justificada</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100">
                                      <Minus className="h-3 w-3 text-blue-600" />
                                    </div>
                                    <span className="text-sm text-blue-700 font-medium">−1 Clase de recuperación</span>
                                  </div>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                <Badge
                                  variant="outline"
                                  className={`text-xs font-bold ${movement.balance > 0
                                    ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                    : 'bg-gray-50 text-gray-500 border-gray-200'
                                    }`}
                                >
                                  {movement.balance}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ================================ */}
          {/* TAB: Grupos                      */}
          {/* ================================ */}
          <TabsContent value="grupos">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Inscripciones</CardTitle>
              </CardHeader>
              <CardContent>
                {playerEnrollments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Users className="h-10 w-10 mb-3" />
                    <p className="text-sm">No hay inscripciones registradas</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {playerEnrollments.map((enrollment) => {
                      const group = groups.find((g) => g.id === enrollment.groupId)
                      const price = enrollment.customPrice ?? group?.defaultTariffPrice ?? 0

                      return (
                        <div
                          key={enrollment.id}
                          className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/30 transition-colors"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{enrollment.groupName}</p>
                              {enrollment.isActive ? (
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                  Activa
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs bg-gray-50 text-gray-500 border-gray-200">
                                  Inactiva
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Tarifa: {enrollment.tariffName} &middot; {formatCurrency(price)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Inscrito: {formatDate(enrollment.enrollmentDate)}
                              {enrollment.unenrollmentDate && ` — Baja: ${formatDate(enrollment.unenrollmentDate)}`}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/grupos/${enrollment.groupId}`)}
                          >
                            Ver grupo
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================================ */}
          {/* TAB: Informes                    */}
          {/* ================================ */}
          <TabsContent value="informes">
            {viewingEvaluation ? (
              <EvaluationDetailView
                evaluation={viewingEvaluation}
                onClose={() => setViewingEvaluation(null)}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Evaluaciones e informes</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {playerEvaluations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <FileText className="h-10 w-10 mb-3" />
                      <p className="text-sm">No hay evaluaciones registradas</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="p-3 text-left text-sm font-medium text-muted-foreground">Fecha</th>
                            <th className="p-3 text-left text-sm font-medium text-muted-foreground">Evaluador</th>
                            <th className="p-3 text-center text-sm font-medium text-muted-foreground">Media global</th>
                            <th className="p-3 text-right text-sm font-medium text-muted-foreground">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {playerEvaluations.map((evaluation) => {
                            const avgColor =
                              evaluation.overallAverage >= 7
                                ? 'text-green-600'
                                : evaluation.overallAverage >= 5
                                  ? 'text-yellow-600'
                                  : 'text-red-600'
                            return (
                              <tr key={evaluation.id} className="border-b hover:bg-muted/30 transition-colors">
                                <td className="p-3 text-sm font-medium">
                                  {formatDate(new Date(evaluation.date))}
                                </td>
                                <td className="p-3 text-sm text-muted-foreground">
                                  {evaluation.coachName}
                                </td>
                                <td className="p-3 text-center">
                                  <span className={`text-sm font-bold ${avgColor}`}>
                                    <Star className="h-3.5 w-3.5 inline mr-1" />
                                    {evaluation.overallAverage.toFixed(1)}
                                  </span>
                                </td>
                                <td className="p-3 text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setViewingEvaluation(evaluation)}
                                  >
                                    <Eye className="h-3.5 w-3.5 mr-1" />
                                    Ver informe
                                  </Button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Season Payment Dialog — solo para staff */}
      {activeRole !== 'jugador' && activeRole !== 'tutor' && (
        <SeasonPaymentDialog
          open={showSeasonPaymentDialog}
          onOpenChange={setShowSeasonPaymentDialog}
          playerId={player.id}
          playerName={`${player.firstName} ${player.lastName}`}
        />
      )}

      {/* Edit Dialog — restringido para jugador/tutor, completo para staff */}
      {activeRole === 'jugador' || activeRole === 'tutor' ? (
        <PlayerSelfEditDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          player={player}
        />
      ) : (
        <PlayerFormDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          player={player}
          onSubmit={handleEditSubmit}
        />
      )}
    </div>
  )
}
