import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useDataStore } from '@/stores/dataStore'
import { ArrowLeft, Mail, Phone, MapPin, CreditCard, Calendar, Activity, Users, AlertCircle } from 'lucide-react'
import { formatDate, formatCurrency, calculateAge } from '@/lib/utils'

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
  const { players, enrollments, payments, groups, attendance } = useDataStore()

  const player = useMemo(() => players.find((p) => p.id === id), [players, id])

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

  // All enrollments for groups tab
  const playerEnrollments = useMemo(() => {
    if (!player) return []
    return enrollments.filter((e) => e.playerId === player.id)
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

  // Mask IBAN: show only last 4 digits
  const maskedIban = useMemo(() => {
    if (!player) return '—'
    const iban = player.iban.replace(/\s/g, '')
    if (iban.length < 4) return '****'
    return '**** **** **** **** **** ' + iban.slice(-4)
  }, [player])

  // =========================================
  // Not found
  // =========================================

  if (!player) {
    return (
      <div>
        <Header title="Perfil del jugador" />
        <div className="p-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <AlertCircle className="h-12 w-12 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Jugador no encontrado</h2>
              <p className="text-sm text-muted-foreground">
                El jugador que buscas no existe o ha sido eliminado.
              </p>
              <Button variant="outline" onClick={() => navigate('/jugadores')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver a jugadores
              </Button>
            </CardContent>
          </Card>
        </div>
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
            <Button variant="outline" size="sm" onClick={() => navigate('/jugadores')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver
            </Button>
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
                  <p className="text-xs text-muted-foreground">Cr&eacute;ditos de recuperaci&oacute;n</p>
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
            <TabsTrigger value="facturacion">Facturaci&oacute;n</TabsTrigger>
            <TabsTrigger value="asistencia">Asistencia</TabsTrigger>
            <TabsTrigger value="grupos">Grupos</TabsTrigger>
          </TabsList>

          {/* ================================ */}
          {/* TAB: Datos Personales            */}
          {/* ================================ */}
          <TabsContent value="personal">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Datos personales */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Informaci&oacute;n personal</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <InfoRow label="Nombre completo" value={`${player.firstName} ${player.lastName}`} />
                  <InfoRow label="DNI" value={player.dni} />
                  <InfoRow
                    label="Fecha de nacimiento"
                    value={`${formatDate(player.birthDate)} (${calculateAge(player.birthDate)} a\u00f1os)`}
                    icon={Calendar}
                  />
                  <InfoRow label="Email" value={player.email} icon={Mail} />
                  <InfoRow label="Tel\u00e9fono" value={player.phone} icon={Phone} />
                  <InfoRow label="Direcci\u00f3n" value={player.address} icon={MapPin} />
                  <InfoRow label="Ciudad" value={player.city} />
                  <InfoRow label="C\u00f3digo postal" value={player.postalCode} />
                </CardContent>
              </Card>

              {/* Datos deportivos */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Informaci&oacute;n deportiva</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <InfoRow label="Nivel" value={<StatusBadge status={player.level} />} />
                  <InfoRow label="Mano dominante" value={handLabels[player.dominantHand] || player.dominantHand} />
                  <InfoRow label="Posici\u00f3n" value={positionLabels[player.position] || player.position} />
                  <InfoRow label="Experiencia previa" value={player.previousExperience || '—'} />
                  <InfoRow label="Notas m\u00e9dicas" value={player.medicalNotes || '—'} icon={AlertCircle} />
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
                    <InfoRow label="Tel\u00e9fono" value={player.guardian.phone} icon={Phone} />
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
          <TabsContent value="facturacion">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Historial de pagos</CardTitle>
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
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden lg:table-cell">M&eacute;todo</th>
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
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground">Recuperaci&oacute;n</th>
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
                                  Recuperaci&oacute;n
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
                              {enrollment.unenrollmentDate && ` \u2014 Baja: ${formatDate(enrollment.unenrollmentDate)}`}
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
        </Tabs>
      </div>
    </div>
  )
}
