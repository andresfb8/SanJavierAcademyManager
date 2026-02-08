import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
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
import { useDataStore } from '@/stores/dataStore'
import { FileText, Plus, Search, Eye, Trash2, Star } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Evaluation } from '@/types'

// ==========================================
// EvaluacionesPage - Informes y evaluaciones
// ==========================================
// Ruta: /informes

export default function EvaluacionesPage() {
  const navigate = useNavigate()
  const {
    evaluations,
    coaches,
    addEvaluation,
    deleteEvaluation,
  } = useDataStore()

  // Estado UI
  const [search, setSearch] = useState('')
  const [coachFilter, setCoachFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [viewingEvaluation, setViewingEvaluation] = useState<Evaluation | null>(
    null
  )
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

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

  // Handlers
  const handleSaveEvaluation = (
    data: Omit<Evaluation, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    addEvaluation(data)
    setShowForm(false)
  }

  const handleDelete = () => {
    if (deleteConfirmId) {
      deleteEvaluation(deleteConfirmId)
      setDeleteConfirmId(null)
    }
  }

  // Si estamos viendo una evaluacion en detalle
  if (viewingEvaluation) {
    return (
      <div>
        <Header title="Detalle de evaluacion" />
        <div className="p-6">
          <EvaluationDetailView
            evaluation={viewingEvaluation}
            onClose={() => setViewingEvaluation(null)}
          />
        </div>
      </div>
    )
  }

  // Si estamos creando
  if (showForm) {
    return (
      <div>
        <Header title="Nueva evaluacion" />
        <div className="p-6">
          <EvaluationForm
            onClose={() => setShowForm(false)}
            onSave={handleSaveEvaluation}
          />
        </div>
      </div>
    )
  }

  // Vista principal: lista de evaluaciones
  return (
    <div>
      <Header
        title="Informes y Evaluaciones"
        subtitle={`${evaluations.length} evaluacion${evaluations.length !== 1 ? 'es' : ''}`}
        actions={
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nueva evaluacion
          </Button>
        }
      />

      <div className="p-6 space-y-4">
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
            </CardContent>
          </Card>
        )}
      </div>

      {/* Confirmacion de eliminacion */}
      <ConfirmDialog
        open={!!deleteConfirmId}
        onOpenChange={() => setDeleteConfirmId(null)}
        title="Eliminar evaluacion"
        description="Esta accion eliminara la evaluacion de forma permanente. Esta accion no se puede deshacer."
        variant="destructive"
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
      />
    </div>
  )
}
