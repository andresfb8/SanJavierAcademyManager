import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDataStore } from '@/stores/dataStore'
import { EVALUATION_STRUCTURE } from '@/constants'
import { ArrowLeft, Save, Star } from 'lucide-react'
import type { Evaluation } from '@/types'

// ==========================================
// EvaluationForm - Formulario de evaluacion
// ==========================================

interface EvaluationFormProps {
  onClose: () => void
  onSave: (
    data: Omit<Evaluation, 'id' | 'createdAt' | 'updatedAt'>
  ) => void
  editEvaluation?: Evaluation
}

export function EvaluationForm({
  onClose,
  onSave,
  editEvaluation,
}: EvaluationFormProps) {
  const { players, coaches } = useDataStore()

  // Estado del formulario
  const [selectedPlayerId, setSelectedPlayerId] = useState(
    editEvaluation?.playerId ?? ''
  )
  const [selectedCoachId, setSelectedCoachId] = useState(
    editEvaluation?.coachId ?? ''
  )
  const [evaluationDate, setEvaluationDate] = useState(
    editEvaluation
      ? new Date(editEvaluation.date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  )

  // Scores: criterionKey -> score
  const [scores, setScores] = useState<Record<string, number>>(() => {
    if (!editEvaluation) return {}
    const initial: Record<string, number> = {}
    for (const block of editEvaluation.blocks) {
      for (const score of block.scores) {
        initial[score.criterionKey] = score.score
      }
    }
    return initial
  })

  // Comments: blockKey -> comment
  const [comments, setComments] = useState<Record<string, string>>(() => {
    if (!editEvaluation) return {}
    const initial: Record<string, string> = {}
    for (const block of editEvaluation.blocks) {
      if (block.comment) initial[block.blockKey] = block.comment
    }
    return initial
  })

  const [finalComment, setFinalComment] = useState(
    editEvaluation?.finalComment ?? ''
  )

  // Helpers
  const activePlayers = useMemo(
    () => players.filter((p) => p.status === 'activo'),
    [players]
  )

  const activeCoaches = useMemo(
    () => coaches.filter((c) => c.isActive),
    [coaches]
  )

  const setScore = (key: string, value: number) => {
    setScores((prev) => ({ ...prev, [key]: Math.min(10, Math.max(1, value)) }))
  }

  const setComment = (blockKey: string, value: string) => {
    setComments((prev) => ({ ...prev, [blockKey]: value }))
  }

  // Calcular media de un conjunto de criterios
  const getAverage = (criterionKeys: string[]) => {
    const validScores = criterionKeys
      .map((k) => scores[k])
      .filter((s) => s !== undefined && s > 0)
    if (validScores.length === 0) return 0
    return validScores.reduce((a, b) => a + b, 0) / validScores.length
  }

  // Media global
  const overallAverage = useMemo(() => {
    const allScores = Object.values(scores).filter((s) => s > 0)
    if (allScores.length === 0) return 0
    return allScores.reduce((a, b) => a + b, 0) / allScores.length
  }, [scores])

  const avgColor =
    overallAverage >= 7
      ? 'text-green-600'
      : overallAverage >= 5
        ? 'text-yellow-600'
        : overallAverage > 0
          ? 'text-red-600'
          : 'text-muted-foreground'

  // Guardar
  const handleSave = () => {
    if (!selectedPlayerId || !selectedCoachId || !evaluationDate) return

    const player = players.find((p) => p.id === selectedPlayerId)
    const coach = coaches.find((c) => c.id === selectedCoachId)
    if (!player || !coach) return

    // Construir bloques
    const blocks: Evaluation['blocks'] = []

    for (const blockDef of EVALUATION_STRUCTURE) {
      if (blockDef.subBlocks) {
        for (const sub of blockDef.subBlocks) {
          const blockKey = `${blockDef.key}_${sub.key}`
          const blockScores = sub.criteria
            .map((c) => ({
              criterionKey: c.key,
              score: scores[c.key] || 0,
            }))
            .filter((s) => s.score > 0)

          const avg = getAverage(sub.criteria.map((c) => c.key))

          blocks.push({
            blockKey,
            scores: blockScores,
            average: Math.round(avg * 100) / 100,
            comment: comments[blockKey] || undefined,
          })
        }
      } else if (blockDef.criteria) {
        const blockKey = blockDef.key
        const blockScores = blockDef.criteria
          .map((c) => ({
            criterionKey: c.key,
            score: scores[c.key] || 0,
          }))
          .filter((s) => s.score > 0)

        const avg = getAverage(blockDef.criteria.map((c) => c.key))

        blocks.push({
          blockKey,
          scores: blockScores,
          average: Math.round(avg * 100) / 100,
          comment: comments[blockKey] || undefined,
        })
      }
    }

    onSave({
      playerId: selectedPlayerId,
      playerName: `${player.firstName} ${player.lastName}`,
      coachId: selectedCoachId,
      coachName: `${coach.firstName} ${coach.lastName}`,
      date: new Date(evaluationDate + 'T00:00:00'),
      blocks,
      overallAverage: Math.round(overallAverage * 100) / 100,
      finalComment: finalComment || undefined,
    })
  }

  const filledCount = Object.values(scores).filter((s) => s > 0).length
  const totalCriteria = EVALUATION_STRUCTURE.reduce((sum, b) => {
    if (b.subBlocks) return sum + b.subBlocks.reduce((s2, sb) => s2 + sb.criteria.length, 0)
    return sum + (b.criteria?.length ?? 0)
  }, 0)

  // Render inputs para criterios
  const renderCriteria = (
    criteria: { key: string; label: string }[],
    blockKey: string
  ) => {
    const avg = getAverage(criteria.map((c) => c.key))
    const avgC =
      avg >= 7
        ? 'text-green-600'
        : avg >= 5
          ? 'text-yellow-600'
          : avg > 0
            ? 'text-red-600'
            : 'text-muted-foreground'

    return (
      <div className="space-y-3">
        <div className="grid gap-2">
          {criteria.map((criterion) => (
            <div
              key={criterion.key}
              className="flex items-center gap-3 py-1"
            >
              <span className="text-sm flex-1 min-w-0 truncate">
                {criterion.label}
              </span>
              <Input
                type="number"
                min={1}
                max={10}
                step={1}
                value={scores[criterion.key] || ''}
                onChange={(e) =>
                  setScore(criterion.key, parseInt(e.target.value) || 0)
                }
                className="w-16 h-8 text-center text-sm"
                placeholder="-"
              />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">
            Media del bloque
          </span>
          <span className={`text-sm font-bold ${avgC}`}>
            {avg > 0 ? avg.toFixed(1) : '-'}
          </span>
        </div>
        <div>
          <Label className="text-xs">Comentario</Label>
          <Textarea
            value={comments[blockKey] || ''}
            onChange={(e) => setComment(blockKey, e.target.value)}
            placeholder="Observaciones sobre este bloque..."
            rows={2}
            className="mt-1"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={onClose} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
          <h2 className="text-xl font-bold">
            {editEvaluation ? 'Editar evaluacion' : 'Nueva evaluacion'}
          </h2>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2">
            <Star className={`h-5 w-5 ${avgColor}`} />
            <span className={`text-2xl font-bold ${avgColor}`}>
              {overallAverage > 0 ? overallAverage.toFixed(1) : '-'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {filledCount}/{totalCriteria} criterios
          </p>
        </div>
      </div>

      {/* Seleccion jugador / entrenador / fecha */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Jugador *</Label>
              <Select
                options={activePlayers.map((p) => ({
                  value: p.id,
                  label: `${p.firstName} ${p.lastName}`,
                }))}
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                placeholder="Seleccionar jugador..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Evaluador *</Label>
              <Select
                options={activeCoaches.map((c) => ({
                  value: c.id,
                  label: `${c.firstName} ${c.lastName}`,
                }))}
                value={selectedCoachId}
                onChange={(e) => setSelectedCoachId(e.target.value)}
                placeholder="Seleccionar entrenador..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha *</Label>
              <Input
                type="date"
                value={evaluationDate}
                onChange={(e) => setEvaluationDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs por bloques */}
      <Tabs defaultValue="tecnico">
        <TabsList>
          <TabsTrigger value="tecnico">Tecnico</TabsTrigger>
          <TabsTrigger value="tactico">Tactico</TabsTrigger>
          <TabsTrigger value="fisico_mental">Fisico/Mental</TabsTrigger>
        </TabsList>

        {/* Tab Tecnico */}
        <TabsContent value="tecnico">
          <div className="space-y-4">
            {EVALUATION_STRUCTURE[0].subBlocks?.map((sub) => {
              const blockKey = `tecnico_${sub.key}`
              return (
                <Card key={blockKey}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">
                      {sub.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {renderCriteria(sub.criteria, blockKey)}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* Tab Tactico */}
        <TabsContent value="tactico">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                {EVALUATION_STRUCTURE[1].label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderCriteria(
                EVALUATION_STRUCTURE[1].criteria ?? [],
                'tactico'
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Fisico/Mental */}
        <TabsContent value="fisico_mental">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                {EVALUATION_STRUCTURE[2].label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderCriteria(
                EVALUATION_STRUCTURE[2].criteria ?? [],
                'fisico_mental'
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Comentario final */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Comentario final
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={finalComment}
            onChange={(e) => setFinalComment(e.target.value)}
            placeholder="Resumen general de la evaluacion, puntos fuertes, areas de mejora..."
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Acciones */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={!selectedPlayerId || !selectedCoachId || !evaluationDate}
        >
          <Save className="h-4 w-4 mr-1" />
          {editEvaluation ? 'Guardar cambios' : 'Crear evaluacion'}
        </Button>
      </div>
    </div>
  )
}
