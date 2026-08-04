import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { useDataStore } from '@/stores/dataStore'
import { useAuthStore } from '@/stores/authStore'
import { PLAYER_LEVELS } from '@/constants'
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Award,
  Users,
  Euro,
  FileText,
  CreditCard,
  Star,
  IdCard,
  Edit as EditIcon,
} from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import {
  useAttendanceQuery,
  useActivitiesQuery,
  useMatchReportsQuery,
  useInvoicesQuery
} from '@/hooks/useQueries'
import { calculateEventSalary } from '@/lib/salary-utils'
import { CoachSelfEditDialog } from '@/components/coach/CoachSelfEditDialog'
import { isGroupCurrentlyActive } from '@/lib/group-utils'

// ==========================================
// CoachProfilePage - Perfil del entrenador
// ==========================================
// Ruta: /entrenadores/:id

export default function CoachProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const activeRole = user?.activeRole ?? user?.role
  const [showEditDialog, setShowEditDialog] = useState(false)

  const {
    coaches,
    groups,
    coachSalaryConfigs,
    privateLessons,
    events,
    eventPayments,
    clubTransactions: allTransactions,
    evaluations
  } = useDataStore()

  const coach = useMemo(
    () => coaches.find((c) => c.id === id) ?? null,
    [coaches, id]
  )

  const coachGroups = useMemo(
    () => (id ? groups.filter((g) => g.coachId === id) : []),
    [groups, id]
  )

  const coachEvaluations = useMemo(
    () =>
      (id ? evaluations.filter((e) => e.coachId === id) : []).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    [evaluations, id]
  )

  const salaryConfig = useMemo(
    () => coachSalaryConfigs.find((c) => c.coachId === id) ?? null,
    [coachSalaryConfigs, id]
  )

  const monthlyPrivateLessons = useMemo(() => {
    if (!id) return []
    const now = new Date()
    return privateLessons.filter(
      (pl) =>
        pl.coachId === id &&
        new Date(pl.date).getMonth() === now.getMonth() &&
        new Date(pl.date).getFullYear() === now.getFullYear()
    )
  }, [privateLessons, id])

  const monthlyEvents = useMemo(() => {
    if (!id) return []
    const now = new Date()
    return events.filter(
      (ev) =>
        ev.coachIds.includes(id) &&
        new Date(ev.date).getMonth() === now.getMonth() &&
        new Date(ev.date).getFullYear() === now.getFullYear()
    )
  }, [events, id])

  const coachPayrolls = useMemo(() => {
    if (!id) return []
    return allTransactions
      .filter(t => t.category === 'nomina' && t.relatedId === id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [allTransactions, id])

  const estimatedSalary = useMemo(() => {
    if (!salaryConfig) return 0
    
    // 1. Group salary
    const adultGroupsCount = coachGroups.filter(g => g.level !== 'menores').length
    const minorsGroupsCount = coachGroups.filter(g => g.level === 'menores').length
    const groupsSalary = (adultGroupsCount * (salaryConfig.ratePerGroupAdults || 0)) + (minorsGroupsCount * (salaryConfig.ratePerGroupMinors || 0))

    // 2. Private lesson salary
    const lessonsSalary = monthlyPrivateLessons.reduce((acc, lesson) => {
       if (salaryConfig.privateLessonPaymentType === 'fixed') {
         return acc + (salaryConfig.privateLessonRate || 0)
       } else {
         return acc + (lesson.price * ((salaryConfig.privateLessonRate || 0) / 100))
       }
    }, 0)

    // 3. Events salary
    const eventsSalary = monthlyEvents.reduce((acc, ev) => {
      return acc + calculateEventSalary(ev, eventPayments, salaryConfig)
    }, 0)
    
    return groupsSalary + lessonsSalary + eventsSalary + (salaryConfig.bonuses || 0)
  }, [salaryConfig, coachGroups, monthlyPrivateLessons, monthlyEvents, eventPayments])

  // Guarda
  if (!coach) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Miembro no encontrado" />
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <p className="text-muted-foreground mb-4">
            No se ha encontrado el miembro solicitado.
          </p>
          <Button variant="outline" onClick={() => navigate('/entrenadores')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Personal
          </Button>
        </div>
      </div>
    )
  }

  // Un entrenador solo puede editar su propio perfil
  const isOwnProfile = useMemo(() => {
    if (!user || activeRole !== 'entrenador') return false
    const linked = coaches.find(c => c.userId === user.id || c.email?.toLowerCase() === user.email?.toLowerCase())
    return linked?.id === id
  }, [user, activeRole, coaches, id])

  return (
    <div>
      <Header
        title={`${coach.firstName} ${coach.lastName}`}
        subtitle={coach.specialization || 'Entrenador'}
        actions={
          <div className="flex items-center gap-2">
            {isOwnProfile && (
              <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
                <EditIcon className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Editar</span>
              </Button>
            )}
            {activeRole !== 'entrenador' && (
              <Button variant="outline" size="sm" onClick={() => navigate('/entrenadores')}>
                <ArrowLeft className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Volver</span>
              </Button>
            )}
          </div>
        }
      />

      <div className="p-3 sm:p-6 space-y-6">
        {/* Info personal */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
              <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
                <AvatarFallback className="bg-primary/10 text-primary text-xl sm:text-2xl font-semibold">
                  {coach.firstName[0]}{coach.lastName[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 w-full text-center sm:text-left">
                <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 mb-4">
                  <h2 className="text-lg sm:text-xl font-bold">{coach.firstName} {coach.lastName}</h2>
                  <Badge variant={coach.isActive ? 'success' : 'secondary'}>
                    {coach.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{coach.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{coach.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <IdCard className="h-4 w-4 text-muted-foreground" />
                    <span>{coach.dni || 'Sin DNI'}</span>
                  </div>
                  {coach.address && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{coach.address}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Contratado: {formatDate(coach.hireDate)}</span>
                  </div>
                  {coach.certifications && (
                    <div className="flex items-center gap-2 text-sm">
                      <Award className="h-4 w-4 text-muted-foreground" />
                      <span>{coach.certifications}</span>
                    </div>
                  )}
                </div>
                {coach.notes && (
                  <p className="mt-3 text-sm text-muted-foreground border-t pt-3">{coach.notes}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Clases de Hoy (Quick Actions Widget) */}
        {(() => {
          const now = new Date()
          const today = now.getDay()
          const todayGroups = coachGroups.filter(g =>
            isGroupCurrentlyActive(g, now) && g.schedule.some(s => s.dayOfWeek === today)
          ).sort((a, b) => {
            const timeA = a.schedule.find(s => s.dayOfWeek === today)?.startTime || '23:59'
            const timeB = b.schedule.find(s => s.dayOfWeek === today)?.startTime || '23:59'
            return timeA.localeCompare(timeB)
          })

          if (todayGroups.length === 0) return null

          return (
            <Card className="border-none shadow-xl shadow-primary/5 rounded-[2rem] bg-white overflow-hidden">
              <CardHeader className="pb-4 px-6 pt-6 bg-slate-50 border-b border-slate-100">
                <CardTitle className="text-base font-black uppercase tracking-wider text-primary/80 flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Clases de Hoy
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {todayGroups.map(group => {
                    const schedule = group.schedule.find(s => s.dayOfWeek === today)
                    if (!schedule) return null
                    
                    return (
                      <div key={group.id} className="p-4 sm:p-6 hover:bg-slate-50/50 transition-colors">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-700 flex flex-col items-center justify-center shrink-0">
                              <span className="text-sm font-black">{schedule.startTime.split(':')[0]}</span>
                              <span className="text-[10px] font-bold uppercase">{schedule.startTime.split(':')[1]}</span>
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-800">{group.name}</h3>
                              <p className="text-sm font-medium text-slate-500">
                                {schedule.startTime} - {schedule.endTime} · Pista {group.courtName}
                              </p>
                              <div className="flex gap-2 mt-2">
                                <Badge variant="secondary" className="text-[10px] uppercase font-bold">{group.level}</Badge>
                                <Badge variant="outline" className="text-[10px] uppercase font-bold text-emerald-600 border-emerald-200 bg-emerald-50">
                                  {group.currentEnrollment} / {group.maxCapacity} alumnos
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-2 md:mt-0">
                            <Button 
                              size="sm" 
                              className="rounded-full shadow-md hover:shadow-lg transition-all"
                              onClick={() => navigate(`/asistencia?groupId=${group.id}`)}
                            >
                              Pasar Lista
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )
        })()}

        {/* Tabs */}
        <Tabs defaultValue="grupos">
          <TabsList>
            <TabsTrigger value="grupos">
              <Users className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Grupos ({coachGroups.length})</span>
              <span className="sm:hidden text-xs">Grupos</span>
            </TabsTrigger>
            <TabsTrigger value="evaluaciones">
              <FileText className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Evaluaciones ({coachEvaluations.length})</span>
              <span className="sm:hidden text-xs">Eval.</span>
            </TabsTrigger>
            <TabsTrigger value="salario">
              <CreditCard className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Salario</span>
              <span className="sm:hidden text-xs">Salario</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab Grupos */}
          <TabsContent value="grupos">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Grupos asignados
                </CardTitle>
              </CardHeader>
              <CardContent>
                {coachGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Este entrenador no tiene grupos asignados.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Nivel</TableHead>
                        <TableHead>Pista</TableHead>
                        <TableHead className="text-center">Capacidad</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coachGroups.map((group) => {
                        const levelInfo = PLAYER_LEVELS.find((l) => l.value === group.level)
                        return (
                          <TableRow key={group.id}>
                            <TableCell>
                              <button
                                className="text-sm font-medium text-primary hover:underline"
                                onClick={() => navigate(`/grupos/${group.id}`)}
                              >
                                {group.name}
                              </button>
                            </TableCell>
                            <TableCell>
                              {levelInfo && (
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${levelInfo.color}`}>
                                  {levelInfo.label}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">{group.courtName}</TableCell>
                            <TableCell className="text-center text-sm">
                              {group.currentEnrollment} / {group.maxCapacity}
                            </TableCell>
                            <TableCell>
                              <Badge variant={group.isActive ? 'success' : 'secondary'}>
                                {group.isActive ? 'Activo' : 'Inactivo'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Evaluaciones */}
          <TabsContent value="evaluaciones">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Evaluaciones realizadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {coachEvaluations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Este entrenador no ha realizado evaluaciones.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Jugador</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-center">Media global</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coachEvaluations.map((ev) => {
                        const avgColor =
                          ev.overallAverage >= 7
                            ? 'text-green-600'
                            : ev.overallAverage >= 5
                              ? 'text-yellow-600'
                              : 'text-red-600'
                        return (
                          <TableRow key={ev.id}>
                            <TableCell>
                              <button
                                className="text-sm font-medium text-primary hover:underline"
                                onClick={() => navigate(`/jugadores/${ev.playerId}`)}
                              >
                                {ev.playerName}
                              </button>
                            </TableCell>
                            <TableCell className="text-sm">
                              {formatDate(new Date(ev.date))}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={`text-sm font-bold ${avgColor}`}>
                                <Star className="h-3.5 w-3.5 inline mr-1" />
                                {ev.overallAverage.toFixed(1)}
                              </span>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Salario */}
          <TabsContent value="salario">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Euro className="h-5 w-5" />
                    Salario mensual estimado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4">
                    <p className="text-3xl sm:text-4xl font-bold text-primary">
                      {formatCurrency(estimatedSalary)}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Estimacion para el mes actual
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Desglose
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {salaryConfig ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="rounded-lg border p-4">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                            Grupos
                          </p>
                          <p className="text-lg font-semibold">
                            {formatCurrency((coachGroups.filter(g => g.level !== 'menores').length * (salaryConfig.ratePerGroupAdults || 0)) + (coachGroups.filter(g => g.level === 'menores').length * (salaryConfig.ratePerGroupMinors || 0)))}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {coachGroups.filter(g => g.level !== 'menores').length} ad. ({formatCurrency(salaryConfig.ratePerGroupAdults || 0)})<br/>
                            {coachGroups.filter(g => g.level === 'menores').length} men. ({formatCurrency(salaryConfig.ratePerGroupMinors || 0)})
                          </p>
                        </div>
                        <div className="rounded-lg border p-4">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                            Clases Particulares
                          </p>
                          <p className="text-lg font-semibold">
                            {formatCurrency(monthlyPrivateLessons.reduce((acc, lesson) => {
                               return acc + (salaryConfig.privateLessonPaymentType === 'fixed' ? (salaryConfig.privateLessonRate || 0) : (lesson.price * ((salaryConfig.privateLessonRate || 0) / 100)))
                            }, 0))}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {monthlyPrivateLessons.length} este mes ({salaryConfig.privateLessonPaymentType === 'fixed' ? formatCurrency(salaryConfig.privateLessonRate || 0) + ' fijas' : (salaryConfig.privateLessonRate || 0) + '%'})
                          </p>
                        </div>
                        <div className="rounded-lg border p-4">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                            Eventos
                          </p>
                          <p className="text-lg font-semibold">
                            {formatCurrency(monthlyEvents.reduce((acc, ev) => {
                               return acc + calculateEventSalary(ev, eventPayments, salaryConfig)
                            }, 0))}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {monthlyEvents.length} este mes ({salaryConfig.eventPaymentType === 'fixed' ? formatCurrency(salaryConfig.eventRate || 0) + ' fijos' : (salaryConfig.eventRate || 0) + '%'})
                          </p>
                        </div>
                        <div className="rounded-lg border p-4">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                            Primas / Bonificaciones
                          </p>
                          <p className="text-lg font-semibold">
                            {formatCurrency(salaryConfig.bonuses)}
                          </p>
                        </div>
                      </div>
                      {salaryConfig.notes && (
                        <p className="text-sm text-muted-foreground border-t pt-3">
                          {salaryConfig.notes}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No se ha configurado el salario. Edita el perfil desde la pagina de Personal para configurar las tarifas.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Historial de Nóminas */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Historial de Nóminas (Cierres)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {coachPayrolls.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No hay registros de nóminas cerradas para este entrenador.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {coachPayrolls.map((payroll) => (
                        <div 
                          key={payroll.id} 
                          className="flex items-center justify-between p-3 rounded-lg border bg-slate-50/30"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                              <Calendar className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-800">
                                {payroll.concept}
                              </p>
                              <p className="text-xs text-slate-500">
                                Pagado el {formatDate(payroll.date)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-slate-900">
                              {formatCurrency(payroll.amount)}
                            </p>
                            <Badge variant="outline" className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 border-emerald-100">
                              Confirmado
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Dialog — solo para entrenador en su propio perfil */}
      {isOwnProfile && (
        <CoachSelfEditDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          coach={coach}
        />
      )}
    </div>
  )
}
