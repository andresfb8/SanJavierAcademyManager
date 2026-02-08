import { useMemo } from 'react'
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
} from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'

// ==========================================
// CoachProfilePage - Perfil del entrenador
// ==========================================
// Ruta: /entrenadores/:id

export default function CoachProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const {
    coaches,
    groups,
    evaluations,
    coachSalaryConfigs,
    privateLessons,
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

  const estimatedSalary = useMemo(() => {
    if (!salaryConfig) return 0
    return (
      coachGroups.length * salaryConfig.ratePerGroup +
      monthlyPrivateLessons.length * salaryConfig.ratePerPrivateLesson +
      salaryConfig.bonuses
    )
  }, [salaryConfig, coachGroups.length, monthlyPrivateLessons.length])

  // Guarda
  if (!coach) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Entrenador no encontrado" />
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <p className="text-muted-foreground mb-4">
            No se ha encontrado el entrenador solicitado.
          </p>
          <Button variant="outline" onClick={() => navigate('/entrenadores')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Entrenadores
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header
        title={`${coach.firstName} ${coach.lastName}`}
        subtitle={coach.specialization || 'Entrenador'}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate('/entrenadores')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Info personal */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-6">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-semibold">
                  {coach.firstName[0]}{coach.lastName[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-xl font-bold">{coach.firstName} {coach.lastName}</h2>
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

        {/* Tabs */}
        <Tabs defaultValue="grupos">
          <TabsList>
            <TabsTrigger value="grupos">
              <Users className="h-4 w-4 mr-1.5" />
              Grupos ({coachGroups.length})
            </TabsTrigger>
            <TabsTrigger value="evaluaciones">
              <FileText className="h-4 w-4 mr-1.5" />
              Evaluaciones ({coachEvaluations.length})
            </TabsTrigger>
            <TabsTrigger value="salario">
              <CreditCard className="h-4 w-4 mr-1.5" />
              Salario
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
                    <p className="text-4xl font-bold text-primary">
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
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="rounded-lg border p-4">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                            Tarifa por grupo
                          </p>
                          <p className="text-lg font-semibold">
                            {formatCurrency(salaryConfig.ratePerGroup)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {coachGroups.length} grupo{coachGroups.length !== 1 ? 's' : ''} ={' '}
                            {formatCurrency(coachGroups.length * salaryConfig.ratePerGroup)}
                          </p>
                        </div>
                        <div className="rounded-lg border p-4">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                            Tarifa clase particular
                          </p>
                          <p className="text-lg font-semibold">
                            {formatCurrency(salaryConfig.ratePerPrivateLesson)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {monthlyPrivateLessons.length} clase{monthlyPrivateLessons.length !== 1 ? 's' : ''} este mes ={' '}
                            {formatCurrency(monthlyPrivateLessons.length * salaryConfig.ratePerPrivateLesson)}
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
                      No se ha configurado el salario para este entrenador. Edita el
                      entrenador desde la pagina de Entrenadores para configurar las tarifas.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
