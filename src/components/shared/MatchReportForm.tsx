import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useDataStore } from '@/stores/dataStore'
import { PLAYER_LEVELS } from '@/constants'
import { ArrowLeft, Save } from 'lucide-react'
import type { MatchReport } from '@/types'

// ==========================================
// MatchReportForm - Formulario de informe de partido
// ==========================================

interface MatchReportFormProps {
  onClose: () => void
  onSave: (
    data: Omit<MatchReport, 'id' | 'createdAt' | 'updatedAt'>
  ) => void
  editReport?: MatchReport
}

export function MatchReportForm({
  onClose,
  onSave,
  editReport,
}: MatchReportFormProps) {
  const { players, coaches } = useDataStore()

  // Estado del formulario
  const [title, setTitle] = useState(editReport?.title ?? '')
  const [reportDate, setReportDate] = useState(
    editReport
      ? new Date(editReport.date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  )
  const [selectedCoachId, setSelectedCoachId] = useState(
    editReport?.coachId ?? ''
  )
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>(
    editReport?.playerIds ?? []
  )
  const [tacticsComment, setTacticsComment] = useState(
    editReport?.tacticsComment ?? ''
  )
  const [decisionMakingComment, setDecisionMakingComment] = useState(
    editReport?.decisionMakingComment ?? ''
  )
  const [mentalComment, setMentalComment] = useState(
    editReport?.mentalComment ?? ''
  )
  const [generalComment, setGeneralComment] = useState(
    editReport?.generalComment ?? ''
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

  const togglePlayer = (playerId: string) => {
    setSelectedPlayerIds((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId]
    )
  }

  // Validacion
  const isValid =
    title.trim() !== '' &&
    reportDate !== '' &&
    selectedCoachId !== '' &&
    selectedPlayerIds.length > 0 &&
    tacticsComment.trim() !== '' &&
    decisionMakingComment.trim() !== '' &&
    mentalComment.trim() !== ''

  // Guardar
  const handleSave = () => {
    if (!isValid) return

    const coach = coaches.find((c) => c.id === selectedCoachId)
    if (!coach) return

    const playerNames = selectedPlayerIds.map((pid) => {
      const p = players.find((pl) => pl.id === pid)
      return p ? `${p.firstName} ${p.lastName}` : ''
    }).filter(Boolean)

    onSave({
      title: title.trim(),
      date: new Date(reportDate + 'T00:00:00'),
      playerIds: selectedPlayerIds,
      playerNames,
      coachId: selectedCoachId,
      coachName: `${coach.firstName} ${coach.lastName}`,
      tacticsComment: tacticsComment.trim(),
      decisionMakingComment: decisionMakingComment.trim(),
      mentalComment: mentalComment.trim(),
      generalComment: generalComment.trim() || undefined,
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={onClose} className="mb-2">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver
        </Button>
        <h2 className="text-lg sm:text-xl font-bold">
          {editReport ? 'Editar informe de partido' : 'Nuevo informe de partido'}
        </h2>
      </div>

      {/* Datos generales */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Datos generales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Titulo *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Partido amistoso vs Club Murcia"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha *</Label>
              <Input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
              />
            </div>
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
        </CardContent>
      </Card>

      {/* Seleccion de jugadores */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Jugadores *
            {selectedPlayerIds.length > 0 && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({selectedPlayerIds.length} seleccionado{selectedPlayerIds.length !== 1 ? 's' : ''})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-1">
            {activePlayers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                No hay jugadores activos
              </p>
            ) : (
              activePlayers.map((player) => (
                <label
                  key={player.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer text-sm"
                >
                  <Checkbox
                    checked={selectedPlayerIds.includes(player.id)}
                    onCheckedChange={() => togglePlayer(player.id)}
                  />
                  <span>
                    {player.lastName}, {player.firstName}
                  </span>
                  <Badge
                    className={`ml-auto text-[10px] ${PLAYER_LEVELS.find((l) => l.value === player.level)?.color ?? ''}`}
                  >
                    {PLAYER_LEVELS.find((l) => l.value === player.level)?.label ?? player.level}
                  </Badge>
                </label>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Secciones de comentario */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Tactica *</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={tacticsComment}
            onChange={(e) => setTacticsComment(e.target.value)}
            placeholder="Analisis tactico del partido: estrategia empleada, posicionamiento, movimientos..."
            rows={4}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Toma de decisiones *</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={decisionMakingComment}
            onChange={(e) => setDecisionMakingComment(e.target.value)}
            placeholder="Analisis de la toma de decisiones: lectura del juego, seleccion de golpes, momentos clave..."
            rows={4}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Aspecto mental *</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={mentalComment}
            onChange={(e) => setMentalComment(e.target.value)}
            placeholder="Analisis del aspecto mental: actitud, concentracion, gestion de la presion..."
            rows={4}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Comentario general</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={generalComment}
            onChange={(e) => setGeneralComment(e.target.value)}
            placeholder="Observaciones generales, resumen del partido, areas de mejora..."
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Acciones */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={!isValid}>
          <Save className="h-4 w-4 mr-1" />
          {editReport ? 'Guardar cambios' : 'Crear informe'}
        </Button>
      </div>
    </div>
  )
}
