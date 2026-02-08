import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useDataStore } from '@/stores/dataStore'
import { PLAYER_LEVELS, DAYS_OF_WEEK } from '@/constants'
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

export default function ClassDetailPage() {
  const { groupId, date } = useParams<{ groupId: string; date: string }>()
  const navigate = useNavigate()

  const { groups, players, enrollments, attendance } = useDataStore()

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
        const recordDate =
          a.date instanceof Date
            ? a.date.toISOString().split('T')[0]
            : new Date(a.date).toISOString().split('T')[0]
        return a.groupId === groupId && recordDate === date
      }) ?? null
    )
  }, [groupId, date, attendance])

  // Inscripciones activas del grupo
  const activeEnrollments = useMemo(() => {
    if (!groupId) return []
    return enrollments.filter((e) => e.groupId === groupId && e.isActive)
  }, [groupId, enrollments])

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

  // Jugadores con creditos de recuperacion que NO estan en este grupo
  const recoveryEligiblePlayers = useMemo(() => {
    if (!groupId) return []
    const enrolledIds = new Set(activeEnrollments.map((e) => e.playerId))
    return players.filter(
      (p) =>
        p.status === 'activo' &&
        p.recoveryCredits > 0 &&
        !enrolledIds.has(p.id)
    )
  }, [groupId, activeEnrollments, players])

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

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Nivel</p>
                {levelInfo && (
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${levelInfo.color}`}>
                    {levelInfo.label}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Pista</p>
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{group.courtName}</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Entrenador</p>
                <div className="flex items-center gap-1.5">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{group.coachName}</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Horario</p>
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
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Inscripciones</p>
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
                  <span>Asistencia registrada para esta fecha.</span>
                </div>
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
                      <TableRow key={`${entry.playerId}-${entry.isRecovery ? 'rec' : 'reg'}`}>
                        <TableCell className="font-medium">
                          <button
                            type="button"
                            className="text-primary hover:underline text-left"
                            onClick={() => navigate(`/jugadores/${entry.playerId}`)}
                          >
                            {entry.playerName}
                          </button>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={entry.status} />
                        </TableCell>
                        <TableCell>
                          {entry.isRecovery ? (
                            <Badge variant="default" className="bg-blue-100 text-blue-700 border-blue-200">
                              Si
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">No</span>
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
        {/* SECCION RECUPERACION           */}
        {/* ============================== */}
        {!existingAttendance && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Jugadores con creditos de recuperacion
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  Los jugadores con creditos de recuperacion pueden asistir a
                  esta clase como recuperacion de una ausencia justificada.
                  Para anadirlos, ve a la pagina de Asistencia y utiliza la
                  opcion "Anadir recuperacion" al pasar lista.
                </span>
              </div>

              {recoveryEligiblePlayers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay jugadores con creditos de recuperacion disponibles.
                </p>
              ) : (
                <div className="space-y-2">
                  {recoveryEligiblePlayers.map((player) => {
                    const playerLevel = PLAYER_LEVELS.find((l) => l.value === player.level)
                    return (
                      <div
                        key={player.id}
                        className="flex items-center justify-between rounded-md border px-4 py-2.5 hover:bg-accent/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            className="text-sm font-medium text-primary hover:underline"
                            onClick={() => navigate(`/jugadores/${player.id}`)}
                          >
                            {player.firstName} {player.lastName}
                          </button>
                          {playerLevel && (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${playerLevel.color}`}>
                              {playerLevel.label}
                            </span>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {player.recoveryCredits} credito{player.recoveryCredits !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
                  const playerLevel = PLAYER_LEVELS.find((l) => l.value === player.level)
                  return (
                    <div
                      key={player.id}
                      className="flex items-center justify-between rounded-md border px-4 py-2.5 hover:bg-accent/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="text-sm font-medium text-primary hover:underline text-left"
                          onClick={() => navigate(`/jugadores/${player.id}`)}
                        >
                          {player.firstName} {player.lastName}
                        </button>
                        {playerLevel && (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${playerLevel.color}`}>
                            {playerLevel.label}
                          </span>
                        )}
                      </div>
                      {player.recoveryCredits > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <RefreshCw className="h-3 w-3 mr-1" />
                          {player.recoveryCredits} credito{player.recoveryCredits !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
