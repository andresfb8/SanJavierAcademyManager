import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EvaluationForm } from '@/components/shared/EvaluationForm'
import { EvaluationDetailView } from '@/components/shared/EvaluationDetailView'
import { MatchReportForm } from '@/components/shared/MatchReportForm'
import { MatchReportDetailView } from '@/components/shared/MatchReportDetailView'
import { useDataStore } from '@/stores/dataStore'
import { FileText, Plus, Search, Eye, Trash2, Star, Swords, Users } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Evaluation, MatchReport } from '@/types'

// ==========================================
// EvaluacionesPage - Informes y evaluaciones
// ==========================================
// Ruta: /informes

export default function EvaluacionesPage() {
  const navigate = useNavigate()
  const {
    evaluations,
    matchReports,
    coaches,
    addEvaluation,
    deleteEvaluation,
    addMatchReport,
    deleteMatchReport,
  } = useDataStore()

  // Tab activo
  const [activeTab, setActiveTab] = useState('evaluaciones')

  // --- Estado UI: Evaluaciones ---
  const [search, setSearch] = useState('')
  const [coachFilter, setCoachFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [viewingEvaluation, setViewingEvaluation] = useState<Evaluation | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // --- Estado UI: Match Reports ---
  const [mrSearch, setMrSearch] = useState('')
  const [mrCoachFilter, setMrCoachFilter] = useState('')
  const [showMatchReportForm, setShowMatchReportForm] = useState(false)
  const [viewingMatchReport, setViewingMatchReport] = useState<MatchReport | null>(null)
  const [mrDeleteConfirmId, setMrDeleteConfirmId] = useState<string | null>(null)

  // Evaluaciones filtradas
  const filteredEvaluations = useMemo(() => {
    return evaluations
      .filter((ev) => {
        const matchesSearch =
          search === '' ||
          ev.playerName.toLowerCase().includes(search.toLowerCase()) ||
          ev.coachName.toLowerCase().includes(search.toLowerCase())
        const matchesCoach = coachFilter === '' || ev.coachId === coachFilter
        return matchesSearch && matchesCoach
      })
      .sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )
  }, [evaluations, search, coachFilter])

  // Match reports filtrados
  const filteredMatchReports = useMemo(() => {
    return matchReports
      .filter((mr) => {
        const matchesSearch =
          mrSearch === '' ||
          mr.title.toLowerCase().includes(mrSearch.toLowerCase()) ||
          mr.coachName.toLowerCase().includes(mrSearch.toLowerCase()) ||
          mr.playerNames.some((name) =>
            name.toLowerCase().includes(mrSearch.toLowerCase())
          )
        const matchesCoach = mrCoachFilter === '' || mr.coachId === mrCoachFilter
        return matchesSearch && matchesCoach
      })
      .sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )
  }, [matchReports, mrSearch, mrCoachFilter])

  // --- Handlers: Evaluaciones ---
  const handleSaveEvaluation = (
    data: Omit<Evaluation, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    addEvaluation(data)
    setShowForm(false)
  }

  const handleDeleteEvaluation = () => {
    if (deleteConfirmId) {
      deleteEvaluation(deleteConfirmId)
      setDeleteConfirmId(null)
    }
  }

  // --- Handlers: Match Reports ---
  const handleSaveMatchReport = (
    data: Omit<MatchReport, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    addMatchReport(data)
    setShowMatchReportForm(false)
  }

  const handleDeleteMatchReport = () => {
    if (mrDeleteConfirmId) {
      deleteMatchReport(mrDeleteConfirmId)
      setMrDeleteConfirmId(null)
    }
  }

  // ===========================================
  // Vistas de detalle / formulario (full page)
  // ===========================================

  // Detalle de evaluacion
  if (viewingEvaluation) {
    return (
      <div>
        <Header title="Detalle de evaluacion" />
        <div className="p-3 sm:p-6">
          <EvaluationDetailView
            evaluation={viewingEvaluation}
            onClose={() => setViewingEvaluation(null)}
          />
        </div>
      </div>
    )
  }

  // Formulario de evaluacion
  if (showForm) {
    return (
      <div>
        <Header title="Nueva evaluacion" />
        <div className="p-3 sm:p-6">
          <EvaluationForm
            onClose={() => setShowForm(false)}
            onSave={handleSaveEvaluation}
          />
        </div>
      </div>
    )
  }

  // Detalle de informe de partido
  if (viewingMatchReport) {
    return (
      <div>
        <Header title="Detalle de informe de partido" />
        <div className="p-3 sm:p-6">
          <MatchReportDetailView
            report={viewingMatchReport}
            onClose={() => setViewingMatchReport(null)}
          />
        </div>
      </div>
    )
  }

  // Formulario de informe de partido
  if (showMatchReportForm) {
    return (
      <div>
        <Header title="Nuevo informe de partido" />
        <div className="p-3 sm:p-6">
          <MatchReportForm
            onClose={() => setShowMatchReportForm(false)}
            onSave={handleSaveMatchReport}
          />
        </div>
      </div>
    )
  }

  // ===========================================
  // Vista principal con tabs
  // ===========================================
  return (
    <div>
      <Header
        title="Informes y Evaluaciones"
        subtitle={`${evaluations.length} evaluacion${evaluations.length !== 1 ? 'es' : ''} · ${matchReports.length} informe${matchReports.length !== 1 ? 's' : ''} de partido`}
        actions={
          activeTab === 'evaluaciones' ? (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Nueva evaluacion</span>
            </Button>
          ) : (
            <Button size="sm" onClick={() => setShowMatchReportForm(true)}>
              <Plus className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Nuevo informe de partido</span>
            </Button>
          )
        }
      />

      <div className="p-3 sm:p-6 space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="evaluaciones">
              <Star className="h-4 w-4 mr-1.5" />
              Evaluaciones
            </TabsTrigger>
            <TabsTrigger value="partidos">
              <Swords className="h-4 w-4 mr-1.5" />
              Partidos
            </TabsTrigger>
          </TabsList>

          {/* ============================== */}
          {/* TAB: Evaluaciones              */}
          {/* ============================== */}
          <TabsContent value="evaluaciones">
            <div className="space-y-4">
              {/* Filtros */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por jugador o evaluador..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select
                  options={[
                    { value: '', label: 'Todos los evaluadores' },
                    ...coaches.map((c) => ({
                      value: c.id,
                      label: `${c.firstName} ${c.lastName}`,
                    })),
                  ]}
                  value={coachFilter}
                  onChange={(e) => setCoachFilter(e.target.value)}
                  className="w-full sm:w-56"
                />
              </div>

              {/* Tabla */}
              {filteredEvaluations.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No hay evaluaciones"
                  description="Crea la primera evaluacion para empezar a hacer seguimiento del progreso de los jugadores"
                  action={{
                    label: 'Nueva evaluacion',
                    onClick: () => setShowForm(true),
                  }}
                />
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Jugador</TableHead>
                            <TableHead>Evaluador</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead className="text-center">Media global</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredEvaluations.map((ev) => {
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
                                  {ev.coachName}
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
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setViewingEvaluation(ev)}
                                    >
                                      <Eye className="h-3.5 w-3.5 mr-1" />
                                      Ver
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive hover:text-destructive"
                                      onClick={() => setDeleteConfirmId(ev.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ============================== */}
          {/* TAB: Partidos                  */}
          {/* ============================== */}
          <TabsContent value="partidos">
            <div className="space-y-4">
              {/* Filtros */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por titulo, jugador o evaluador..."
                    value={mrSearch}
                    onChange={(e) => setMrSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select
                  options={[
                    { value: '', label: 'Todos los evaluadores' },
                    ...coaches.map((c) => ({
                      value: c.id,
                      label: `${c.firstName} ${c.lastName}`,
                    })),
                  ]}
                  value={mrCoachFilter}
                  onChange={(e) => setMrCoachFilter(e.target.value)}
                  className="w-full sm:w-56"
                />
              </div>

              {/* Tabla */}
              {filteredMatchReports.length === 0 ? (
                <EmptyState
                  icon={Swords}
                  title="No hay informes de partido"
                  description="Crea el primer informe de partido para registrar el analisis de los partidos de tus jugadores"
                  action={{
                    label: 'Nuevo informe de partido',
                    onClick: () => setShowMatchReportForm(true),
                  }}
                />
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Titulo</TableHead>
                            <TableHead>Jugadores</TableHead>
                            <TableHead>Evaluador</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredMatchReports.map((mr) => (
                            <TableRow key={mr.id}>
                              <TableCell>
                                <span className="text-sm font-medium">
                                  {mr.title}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm flex items-center gap-1">
                                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                  {mr.playerNames.length}
                                </span>
                              </TableCell>
                              <TableCell className="text-sm">
                                {mr.coachName}
                              </TableCell>
                              <TableCell className="text-sm">
                                {formatDate(new Date(mr.date))}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setViewingMatchReport(mr)}
                                  >
                                    <Eye className="h-3.5 w-3.5 mr-1" />
                                    Ver
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => setMrDeleteConfirmId(mr.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Confirmacion de eliminacion: Evaluacion */}
      <ConfirmDialog
        open={!!deleteConfirmId}
        onOpenChange={() => setDeleteConfirmId(null)}
        title="Eliminar evaluacion"
        description="Esta accion eliminara la evaluacion de forma permanente. Esta accion no se puede deshacer."
        variant="destructive"
        confirmLabel="Eliminar"
        onConfirm={handleDeleteEvaluation}
      />

      {/* Confirmacion de eliminacion: Informe de partido */}
      <ConfirmDialog
        open={!!mrDeleteConfirmId}
        onOpenChange={() => setMrDeleteConfirmId(null)}
        title="Eliminar informe de partido"
        description="Esta accion eliminara el informe de partido de forma permanente. Esta accion no se puede deshacer."
        variant="destructive"
        confirmLabel="Eliminar"
        onConfirm={handleDeleteMatchReport}
      />
    </div>
  )
}
