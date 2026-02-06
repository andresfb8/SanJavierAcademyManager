import { useState, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { useDataStore } from '@/stores/dataStore'
import { ChevronLeft, ChevronRight, Plus, Clock, Users, MapPin } from 'lucide-react'
import { DAYS_OF_WEEK, PLAYER_LEVELS } from '@/constants'
import { generateId, formatCurrency } from '@/lib/utils'
import type { PrivateLesson } from '@/types'

// ==========================================
// Constantes de la agenda
// ==========================================

const START_HOUR = 8
const END_HOUR = 22
const SLOT_HEIGHT = 48 // px por franja de 30 min

/** Genera las franjas horarias de 30 min entre START_HOUR y END_HOUR */
function generateTimeSlots(): string[] {
  const slots: string[] = []
  for (let h = START_HOUR; h < END_HOUR; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  return slots
}

const TIME_SLOTS = generateTimeSlots()

/** Colores por nivel para los bloques de grupo */
const LEVEL_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  iniciacion: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-800' },
  intermedio: { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-800' },
  avanzado: { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-800' },
  competicion: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-800' },
  menores: { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-800' },
}

/** Convierte "HH:MM" a un indice dentro de TIME_SLOTS (posicion relativa) */
function timeToSlotIndex(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h - START_HOUR) * 2 + (m >= 30 ? 1 : 0)
}

/** Formatea una fecha como "Lunes, 6 de febrero de 2026" */
function formatDateLong(date: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

/** Formatea fecha como YYYY-MM-DD para inputs */
function toInputDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Compara dos fechas ignorando la hora */
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// ==========================================
// Tipo interno para bloques en la grilla
// ==========================================

interface GridBlock {
  type: 'group' | 'private'
  id: string
  startSlot: number
  endSlot: number
  // Datos grupo
  groupName?: string
  level?: string
  levelLabel?: string
  coachName?: string
  enrollment?: number
  maxCapacity?: number
  // Datos clase particular
  playerNames?: string[]
  price?: number
  notes?: string
}

// ==========================================
// Componente principal
// ==========================================

export default function AgendaPage() {
  const { groups, courts, coaches, players, privateLessons, addPrivateLesson } = useDataStore()

  // --- Estado de navegacion ---
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [dialogOpen, setDialogOpen] = useState(false)

  // --- Estado del formulario de clase particular ---
  const [formDate, setFormDate] = useState(toInputDate(new Date()))
  const [formCourtId, setFormCourtId] = useState('')
  const [formCoachId, setFormCoachId] = useState('')
  const [formPlayerIds, setFormPlayerIds] = useState<string[]>([])
  const [formStartTime, setFormStartTime] = useState('09:00')
  const [formEndTime, setFormEndTime] = useState('10:00')
  const [formPrice, setFormPrice] = useState('')
  const [formNotes, setFormNotes] = useState('')

  // --- Pistas activas ---
  const activeCourts = useMemo(() => courts.filter((c) => c.isActive), [courts])

  // --- Dia de la semana seleccionado (JS getDay: 0=Dom) ---
  const selectedDayOfWeek = selectedDate.getDay()

  // --- Bloques por pista ---
  const blocksByCourt = useMemo(() => {
    const map: Record<string, GridBlock[]> = {}

    for (const court of activeCourts) {
      map[court.id] = []
    }

    // 1. Grupos que tienen sesion en el dia seleccionado
    for (const group of groups) {
      if (!group.isActive) continue

      for (const slot of group.schedule) {
        if (slot.dayOfWeek !== selectedDayOfWeek) continue
        if (!map[group.courtId]) continue

        const levelInfo = PLAYER_LEVELS.find((l) => l.value === group.level)

        map[group.courtId].push({
          type: 'group',
          id: group.id,
          startSlot: timeToSlotIndex(slot.startTime),
          endSlot: timeToSlotIndex(slot.endTime),
          groupName: group.name,
          level: group.level,
          levelLabel: levelInfo?.label ?? group.level,
          coachName: group.coachName,
          enrollment: group.currentEnrollment,
          maxCapacity: group.maxCapacity,
        })
      }
    }

    // 2. Clases particulares en la fecha seleccionada
    for (const lesson of privateLessons) {
      const lessonDate = lesson.date instanceof Date ? lesson.date : new Date(lesson.date)
      if (!isSameDay(lessonDate, selectedDate)) continue
      if (!map[lesson.courtId]) continue

      map[lesson.courtId].push({
        type: 'private',
        id: lesson.id,
        startSlot: timeToSlotIndex(lesson.startTime),
        endSlot: timeToSlotIndex(lesson.endTime),
        coachName: lesson.coachName,
        playerNames: lesson.playerNames,
        price: lesson.price,
        notes: lesson.notes,
      })
    }

    return map
  }, [groups, privateLessons, activeCourts, selectedDate, selectedDayOfWeek])

  // --- Navegacion de dias ---
  function goToPreviousDay() {
    setSelectedDate((prev) => {
      const d = new Date(prev)
      d.setDate(d.getDate() - 1)
      return d
    })
  }

  function goToNextDay() {
    setSelectedDate((prev) => {
      const d = new Date(prev)
      d.setDate(d.getDate() + 1)
      return d
    })
  }

  function goToToday() {
    setSelectedDate(new Date())
  }

  // --- Nombre del dia ---
  const dayLabel = useMemo(() => {
    const info = DAYS_OF_WEEK.find((d) => d.value === selectedDayOfWeek)
    return info?.label ?? ''
  }, [selectedDayOfWeek])

  // --- Abrir dialogo para nueva clase particular ---
  function openNewLessonDialog() {
    setFormDate(toInputDate(selectedDate))
    setFormCourtId(activeCourts[0]?.id ?? '')
    setFormCoachId(coaches.filter((c) => c.isActive)[0]?.id ?? '')
    setFormPlayerIds([])
    setFormStartTime('09:00')
    setFormEndTime('10:00')
    setFormPrice('')
    setFormNotes('')
    setDialogOpen(true)
  }

  // --- Toggle de jugador en multiselect ---
  function togglePlayer(playerId: string) {
    setFormPlayerIds((prev) =>
      prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId]
    )
  }

  // --- Guardar clase particular ---
  function handleSaveLesson() {
    if (!formCourtId || !formCoachId || formPlayerIds.length === 0) return

    const coach = coaches.find((c) => c.id === formCoachId)
    const court = activeCourts.find((c) => c.id === formCourtId)
    const selectedPlayers = players.filter((p) => formPlayerIds.includes(p.id))

    const lessonData: Omit<PrivateLesson, 'id' | 'createdAt'> = {
      playerIds: formPlayerIds,
      playerNames: selectedPlayers.map((p) => `${p.firstName} ${p.lastName}`),
      coachId: formCoachId,
      coachName: coach ? `${coach.firstName} ${coach.lastName}` : '',
      courtId: formCourtId,
      courtName: court?.name ?? '',
      date: new Date(formDate + 'T00:00:00'),
      startTime: formStartTime,
      endTime: formEndTime,
      price: parseFloat(formPrice) || 0,
      isPaid: false,
      notes: formNotes || undefined,
    }

    addPrivateLesson(lessonData)
    setDialogOpen(false)
  }

  // --- Jugadores activos para el selector ---
  const activePlayers = useMemo(
    () => players.filter((p) => p.status === 'activo').sort((a, b) => a.lastName.localeCompare(b.lastName)),
    [players]
  )

  // --- Entrenadores activos para el selector ---
  const activeCoaches = useMemo(
    () => coaches.filter((c) => c.isActive).sort((a, b) => a.lastName.localeCompare(b.lastName)),
    [coaches]
  )

  // --- Verificar si hoy ---
  const isToday = isSameDay(selectedDate, new Date())

  // ==========================================
  // Render
  // ==========================================

  return (
    <div>
      <Header
        title="Agenda"
        subtitle="Vista diaria de pistas y horarios"
        actions={
          <Button onClick={openNewLessonDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            Nueva clase particular
          </Button>
        }
      />

      <div className="p-6 space-y-4">
        {/* ============================== */}
        {/* Navegacion de fecha */}
        {/* ============================== */}
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={goToPreviousDay}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={goToNextDay}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                {!isToday && (
                  <Button variant="outline" size="sm" onClick={goToToday}>
                    Hoy
                  </Button>
                )}
              </div>

              <div className="text-center">
                <h2 className="text-lg font-semibold capitalize">{formatDateLong(selectedDate)}</h2>
                <p className="text-sm text-muted-foreground">{dayLabel}</p>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-sm bg-blue-100 border border-blue-300" />
                  Grupo
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-sm bg-amber-100 border border-amber-300" />
                  Particular
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ============================== */}
        {/* Grilla horaria */}
        {/* ============================== */}
        {activeCourts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MapPin className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No hay pistas activas configuradas.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <div
                  className="grid min-w-[800px]"
                  style={{
                    gridTemplateColumns: `80px repeat(${activeCourts.length}, 1fr)`,
                  }}
                >
                  {/* --- Cabecera: columna de hora + columnas de pistas --- */}
                  <div className="sticky top-0 z-10 border-b border-r bg-muted/50 px-2 py-3 text-xs font-medium text-muted-foreground flex items-center justify-center">
                    <Clock className="h-3.5 w-3.5 mr-1" />
                    Hora
                  </div>
                  {activeCourts.map((court) => (
                    <div
                      key={court.id}
                      className="sticky top-0 z-10 border-b bg-muted/50 px-3 py-3 text-center"
                    >
                      <p className="text-sm font-semibold truncate">{court.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {court.type === 'indoor' ? 'Cubierta' : 'Exterior'} &middot; {court.surface}
                      </p>
                    </div>
                  ))}

                  {/* --- Filas de franjas horarias --- */}
                  {TIME_SLOTS.map((time, slotIdx) => {
                    const isFullHour = time.endsWith(':00')
                    return (
                      <div key={`row-${time}`} className="contents">
                        {/* Celda de hora */}
                        <div
                          className={`border-r px-2 flex items-start justify-end pt-1 text-xs font-mono text-muted-foreground ${
                            isFullHour ? 'border-t' : 'border-t border-dashed'
                          }`}
                          style={{ height: SLOT_HEIGHT }}
                        >
                          {isFullHour ? time : ''}
                        </div>

                        {/* Celdas de pistas */}
                        {activeCourts.map((court) => {
                          const blocks = blocksByCourt[court.id] ?? []

                          // Comprobar si un bloque COMIENZA en esta franja
                          const startingBlock = blocks.find((b) => b.startSlot === slotIdx)

                          // Comprobar si esta franja esta ocupada por un bloque que empezo antes
                          const coveredByBlock = blocks.find(
                            (b) => b.startSlot < slotIdx && b.endSlot > slotIdx
                          )

                          // Si esta franja esta cubierta por un bloque que empezo antes, no renderizar nada
                          if (coveredByBlock) {
                            return (
                              <div
                                key={`${court.id}-${time}`}
                                className={`${isFullHour ? 'border-t' : 'border-t border-dashed'}`}
                                style={{ height: SLOT_HEIGHT }}
                              />
                            )
                          }

                          // Si un bloque comienza aqui, renderizar el bloque
                          if (startingBlock) {
                            const spanSlots = startingBlock.endSlot - startingBlock.startSlot
                            const blockHeight = spanSlots * SLOT_HEIGHT

                            if (startingBlock.type === 'group') {
                              const colors = LEVEL_COLORS[startingBlock.level ?? ''] ?? LEVEL_COLORS.iniciacion

                              return (
                                <div
                                  key={`${court.id}-${time}`}
                                  className={`${isFullHour ? 'border-t' : 'border-t border-dashed'} relative`}
                                  style={{ height: SLOT_HEIGHT }}
                                >
                                  <div
                                    className={`absolute inset-x-1 top-1 rounded-lg border-l-4 ${colors.bg} ${colors.border} p-2 overflow-hidden z-[1] shadow-sm`}
                                    style={{ height: blockHeight - 8 }}
                                  >
                                    <div className="flex items-start justify-between gap-1">
                                      <p className={`text-sm font-semibold ${colors.text} truncate`}>
                                        {startingBlock.groupName}
                                      </p>
                                      <Badge className={`text-[10px] shrink-0 ${PLAYER_LEVELS.find((l) => l.value === startingBlock.level)?.color ?? ''}`}>
                                        {startingBlock.levelLabel}
                                      </Badge>
                                    </div>
                                    <div className="mt-1 space-y-0.5">
                                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Users className="h-3 w-3" />
                                        {startingBlock.coachName}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {startingBlock.enrollment}/{startingBlock.maxCapacity} alumnos
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )
                            }

                            // Clase particular
                            return (
                              <div
                                key={`${court.id}-${time}`}
                                className={`${isFullHour ? 'border-t' : 'border-t border-dashed'} relative`}
                                style={{ height: SLOT_HEIGHT }}
                              >
                                <div
                                  className="absolute inset-x-1 top-1 rounded-lg border-l-4 bg-amber-50 border-amber-400 p-2 overflow-hidden z-[1] shadow-sm"
                                  style={{ height: blockHeight - 8 }}
                                >
                                  <p className="text-sm font-semibold text-amber-800">
                                    Clase Particular
                                  </p>
                                  <div className="mt-1 space-y-0.5">
                                    <p className="text-xs text-muted-foreground truncate">
                                      {startingBlock.playerNames?.join(', ')}
                                    </p>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Users className="h-3 w-3" />
                                      {startingBlock.coachName}
                                    </p>
                                    {startingBlock.price !== undefined && startingBlock.price > 0 && (
                                      <p className="text-xs font-medium text-amber-700">
                                        {formatCurrency(startingBlock.price)}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          }

                          // Franja vacia
                          return (
                            <div
                              key={`${court.id}-${time}`}
                              className={`${
                                isFullHour ? 'border-t' : 'border-t border-dashed'
                              } hover:bg-muted/30 cursor-pointer transition-colors`}
                              style={{ height: SLOT_HEIGHT }}
                              onClick={() => {
                                setFormStartTime(time)
                                // Calcular hora de fin: +1 hora
                                const [h, m] = time.split(':').map(Number)
                                const endH = Math.min(h + 1, END_HOUR)
                                setFormEndTime(`${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
                                setFormDate(toInputDate(selectedDate))
                                setFormCourtId(court.id)
                                setFormCoachId(activeCoaches[0]?.id ?? '')
                                setFormPlayerIds([])
                                setFormPrice('')
                                setFormNotes('')
                                setDialogOpen(true)
                              }}
                            />
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ============================== */}
        {/* Resumen del dia */}
        {/* ============================== */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {Object.values(blocksByCourt).reduce(
                      (acc, blocks) => acc + blocks.filter((b) => b.type === 'group').length,
                      0
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">Grupos con clase</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {Object.values(blocksByCourt).reduce(
                      (acc, blocks) => acc + blocks.filter((b) => b.type === 'private').length,
                      0
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">Clases particulares</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                  <MapPin className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeCourts.length}</p>
                  <p className="text-sm text-muted-foreground">Pistas activas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ============================== */}
      {/* Dialogo: Nueva clase particular */}
      {/* ============================== */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva clase particular</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Fecha */}
            <div className="space-y-1.5">
              <Label htmlFor="lesson-date">Fecha</Label>
              <Input
                id="lesson-date"
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>

            {/* Pista */}
            <div className="space-y-1.5">
              <Label htmlFor="lesson-court">Pista</Label>
              <Select
                id="lesson-court"
                value={formCourtId}
                onChange={(e) => setFormCourtId(e.target.value)}
                options={activeCourts.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Seleccionar pista"
              />
            </div>

            {/* Entrenador */}
            <div className="space-y-1.5">
              <Label htmlFor="lesson-coach">Entrenador</Label>
              <Select
                id="lesson-coach"
                value={formCoachId}
                onChange={(e) => setFormCoachId(e.target.value)}
                options={activeCoaches.map((c) => ({
                  value: c.id,
                  label: `${c.firstName} ${c.lastName}`,
                }))}
                placeholder="Seleccionar entrenador"
              />
            </div>

            {/* Jugadores (multiselect con checkboxes) */}
            <div className="space-y-1.5">
              <Label>Jugadores</Label>
              <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-1">
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
                        checked={formPlayerIds.includes(player.id)}
                        onCheckedChange={() => togglePlayer(player.id)}
                      />
                      <span>
                        {player.lastName}, {player.firstName}
                      </span>
                      <Badge className={`ml-auto text-[10px] ${PLAYER_LEVELS.find((l) => l.value === player.level)?.color ?? ''}`}>
                        {PLAYER_LEVELS.find((l) => l.value === player.level)?.label ?? player.level}
                      </Badge>
                    </label>
                  ))
                )}
              </div>
              {formPlayerIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {formPlayerIds.length} jugador{formPlayerIds.length !== 1 ? 'es' : ''} seleccionado{formPlayerIds.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            {/* Horario */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="lesson-start">Hora inicio</Label>
                <Input
                  id="lesson-start"
                  type="time"
                  value={formStartTime}
                  onChange={(e) => setFormStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lesson-end">Hora fin</Label>
                <Input
                  id="lesson-end"
                  type="time"
                  value={formEndTime}
                  onChange={(e) => setFormEndTime(e.target.value)}
                />
              </div>
            </div>

            {/* Precio */}
            <div className="space-y-1.5">
              <Label htmlFor="lesson-price">Precio (&euro;)</Label>
              <Input
                id="lesson-price"
                type="number"
                min="0"
                step="0.01"
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>

            {/* Notas */}
            <div className="space-y-1.5">
              <Label htmlFor="lesson-notes">Notas</Label>
              <Input
                id="lesson-notes"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Notas adicionales (opcional)"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveLesson}
              disabled={!formCourtId || !formCoachId || formPlayerIds.length === 0}
            >
              Guardar clase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
