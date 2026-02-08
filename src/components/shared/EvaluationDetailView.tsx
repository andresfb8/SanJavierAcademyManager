import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EVALUATION_STRUCTURE } from '@/constants'
import { ArrowLeft, User, Calendar, Star, MessageSquare } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Evaluation } from '@/types'

// ==========================================
// EvaluationDetailView - Vista detalle evaluacion
// ==========================================

interface EvaluationDetailViewProps {
  evaluation: Evaluation
  onClose: () => void
}

function ScoreBar({ score, label }: { score: number; label: string }) {
  const pct = (score / 10) * 100
  const color =
    score >= 7
      ? 'bg-green-500'
      : score >= 5
        ? 'bg-yellow-500'
        : 'bg-red-500'

  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-sm w-56 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-semibold w-8 text-right">{score}</span>
    </div>
  )
}

export function EvaluationDetailView({
  evaluation,
  onClose,
}: EvaluationDetailViewProps) {
  const avgColor =
    evaluation.overallAverage >= 7
      ? 'bg-green-100 text-green-800 border-green-300'
      : evaluation.overallAverage >= 5
        ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
        : 'bg-red-100 text-red-800 border-red-300'

  // Agrupar bloques del evaluation con las definiciones
  const blockSummaries = useMemo(() => {
    const summaries: { label: string; average: number }[] = []
    for (const block of evaluation.blocks) {
      // Buscar label del bloque
      let label = block.blockKey
      for (const def of EVALUATION_STRUCTURE) {
        if (def.subBlocks) {
          for (const sub of def.subBlocks) {
            if (`${def.key}_${sub.key}` === block.blockKey) {
              label = `${def.label} - ${sub.label}`
            }
          }
        }
        if (def.key === block.blockKey) {
          label = def.label
        }
      }
      summaries.push({ label, average: block.average })
    }
    return summaries
  }, [evaluation.blocks])

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex items-start justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={onClose} className="mb-3">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver a evaluaciones
          </Button>
          <h2 className="text-xl font-bold mb-1">Evaluacion de {evaluation.playerName}</h2>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              Evaluador: {evaluation.coachName}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {formatDate(new Date(evaluation.date))}
            </span>
          </div>
        </div>
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-3 ${avgColor}`}
        >
          <Star className="h-5 w-5" />
          <div>
            <p className="text-2xl font-bold">{evaluation.overallAverage.toFixed(1)}</p>
            <p className="text-xs">Media global</p>
          </div>
        </div>
      </div>

      {/* Resumen de bloques */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {blockSummaries.map((bs) => {
          const c =
            bs.average >= 7
              ? 'border-green-200 bg-green-50'
              : bs.average >= 5
                ? 'border-yellow-200 bg-yellow-50'
                : 'border-red-200 bg-red-50'
          return (
            <div key={bs.label} className={`rounded-lg border p-3 ${c}`}>
              <p className="text-xs text-muted-foreground truncate">{bs.label}</p>
              <p className="text-lg font-bold mt-0.5">{bs.average.toFixed(1)}</p>
            </div>
          )
        })}
      </div>

      {/* Bloques detallados */}
      {EVALUATION_STRUCTURE.map((blockDef) => {
        if (blockDef.subBlocks) {
          // Bloque con sub-bloques (tecnico)
          return (
            <Card key={blockDef.key}>
              <CardHeader>
                <CardTitle className="text-base">{blockDef.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {blockDef.subBlocks.map((sub) => {
                  const blockKey = `${blockDef.key}_${sub.key}`
                  const evalBlock = evaluation.blocks.find(
                    (b) => b.blockKey === blockKey
                  )
                  if (!evalBlock) return null

                  return (
                    <div key={blockKey}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold">{sub.label}</h4>
                        <span className="text-sm font-bold text-muted-foreground">
                          Media: {evalBlock.average.toFixed(1)}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        {sub.criteria.map((criterion) => {
                          const scoreEntry = evalBlock.scores.find(
                            (s) => s.criterionKey === criterion.key
                          )
                          return (
                            <ScoreBar
                              key={criterion.key}
                              label={criterion.label}
                              score={scoreEntry?.score ?? 0}
                            />
                          )
                        })}
                      </div>
                      {evalBlock.comment && (
                        <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md p-2">
                          <MessageSquare className="h-4 w-4 shrink-0 mt-0.5" />
                          <span>{evalBlock.comment}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )
        }

        // Bloque sin sub-bloques (tactico, fisico_mental)
        const evalBlock = evaluation.blocks.find(
          (b) => b.blockKey === blockDef.key
        )
        if (!evalBlock) return null

        return (
          <Card key={blockDef.key}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{blockDef.label}</CardTitle>
                <span className="text-sm font-bold text-muted-foreground">
                  Media: {evalBlock.average.toFixed(1)}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-0.5">
                {blockDef.criteria?.map((criterion) => {
                  const scoreEntry = evalBlock.scores.find(
                    (s) => s.criterionKey === criterion.key
                  )
                  return (
                    <ScoreBar
                      key={criterion.key}
                      label={criterion.label}
                      score={scoreEntry?.score ?? 0}
                    />
                  )
                })}
              </div>
              {evalBlock.comment && (
                <div className="mt-3 flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md p-2">
                  <MessageSquare className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{evalBlock.comment}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}

      {/* Comentario final */}
      {evaluation.finalComment && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Comentario final
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{evaluation.finalComment}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
