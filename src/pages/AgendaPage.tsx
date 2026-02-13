import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useDataStore } from '@/stores/dataStore'
import { ChevronLeft, ChevronRight, Plus, Clock, Users, MapPin, CalendarPlus, Star, X, Edit2, Trash2, Euro } from 'lucide-react'
import { DAYS_OF_WEEK, PLAYER_LEVELS, EVENT_TYPES } from '@/constants'
import { formatCurrency } from '@/lib/utils'
import type { PrivateLesson, EventType } from '@/types'

// ==========================================
// Constantes de la agenda
// ==========================================

const START_HOUR = 8
const END_HOUR = 22
const SLOT_HEIGHT = 48

function generateTimeSlots(): string[] {
  const slots: string[] = []
  for (let h = START_HOUR; h < END_HOUR; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  return slots
}

const TIME_SLOTS = generateTimeSlots()

const LEVEL_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  iniciacion: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-800' },
  intermedio: { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-800' },
  avanzado: { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-800' },
  competicion: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-800' },
  menores: { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-800' },
}

function timeToSlotIndex(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h - START_HOUR) * 2 + (m >= 30 ? 1 : 0)
}

function formatDateLong(date: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(date)
}

function toInputDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// ==========================================
// Tipo interno para bloques en la grilla
// ==========================================

interface GridBlock {
  type: 'group' | 'private' | 'event'
  id: string
  startSlot: number
  endSlot: number
  groupName?: string
  level?: string
  levelLabel?: string
  coachName?: string
  enrollment?: number
  maxCapacity?: number
  playerNames?: string[]
  price?: number
  notes?: string
  eventName?: string
  eventType?: string
  eventTypeLabel?: string
}

// ==========================================
// Componente principal
// ==========================================

export default function AgendaPage() {
  const navigate = useNavigate()
  const { groups, courts, coaches, players, privateLessons, addPrivateLesson, updatePrivateLesson, deletePrivateLesson, events, addEvent, addEventPayment } = useDataStore()

  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [dialogOpen, setDialogOpen] = useState(false)

  // Formulario clase particular
  const [formDate, setFormDate] = useState(toInputDate(new Date()))
  const [formCourtId, setFormCourtId] = useState('')
  const [formCoachId, setFormCoachId] = useState('')
  const [formPlayerIds, setFormPlayerIds] = useState<string[]>([])
  const [formStartTime, setFormStartTime] = useState('09:00')
  const [formEndTime, setFormEndTime] = useState('10:00')
  const [formPrice, setFormPrice] = useState('')
  const [formNotes, setFormNotes] = useState('')

  // Invitados clase particular
  const [formGuestNames, setFormGuestNames] = useState<string[]>([])
  const [formGuestInput, setFormGuestInput] = useState('')

  // Formulario evento
  const [eventDialogOpen, setEventDialogOpen] = useState(false)
  const [evName, setEvName] = useState('')
  const [evType, setEvType] = useState<EventType>('mini_torneo')
  const [evDate, setEvDate] = useState(toInputDate(new Date()))
  const [evStartTime, setEvStartTime] = useState('09:00')
  const [evEndTime, setEvEndTime] = useState('12:00')
  const [evCourtIds, setEvCourtIds] = useState<string[]>([])
  const [evCoachIds, setEvCoachIds] = useState<string[]>([])
  const [evPlayerIds, setEvPlayerIds] = useState<string[]>([])
  const [evPrice, setEvPrice] = useState('')
  const [evDescription, setEvDescription] = useState('')
  const [evMaxCapacity, setEvMaxCapacity] = useState('')

  // Invitados evento
  const [evGuestNames, setEvGuestNames] = useState<string[]>([])
  const [evGuestInput, setEvGuestInput] = useState('')

  // Dialogo detalle/edicion clase particular
  const [lessonDetailOpen, setLessonDetailOpen] = useState(false)
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)
  const [lessonEditMode, setLessonEditMode] = useState(false)
  const [deleteLessonDialogOpen, setDeleteLessonDialogOpen] = useState(false)
  const [editLessonDate, setEditLessonDate] = useState('')
  const [editLessonCourtId, setEditLessonCourtId] = useState('')
  const [editLessonCoachId, setEditLessonCoachId] = useState('')
  const [editLessonStartTime, setEditLessonStartTime] = useState('')
  const [editLessonEndTime, setEditLessonEndTime] = useState('')
  const [editLessonPrice, setEditLessonPrice] = useState('')
  const [editLessonNotes, setEditLessonNotes] = useState('')
  const [editLessonIsPaid, setEditLessonIsPaid] = useState(false)

  const activeCourts = useMemo(() => courts.filter((c) => c.isActive), [courts])
  const selectedDayOfWeek = selectedDate.getDay()

  const blocksByCourt = useMemo(() => {
    const map: Record<string, GridBlock[]> = {}
    for (const court of activeCourts) { map[court.id] = [] }

    // 1. Grupos
    for (const group of groups) {
      if (!group.isActive) continue
      for (const slot of group.schedule) {
        if (slot.dayOfWeek !== selectedDayOfWeek) continue
        if (!map[group.courtId]) continue
        const levelInfo = PLAYER_LEVELS.find((l) => l.value === group.level)
        map[group.courtId].push({
          type: 'group', id: group.id,
          startSlot: timeToSlotIndex(slot.startTime), endSlot: timeToSlotIndex(slot.endTime),
          groupName: group.name, level: group.level, levelLabel: levelInfo?.label ?? group.level,
          coachName: group.coachName, enrollment: group.currentEnrollment, maxCapacity: group.maxCapacity,
        })
      }
    }

    // 2. Clases particulares
    for (const lesson of privateLessons) {
      const lessonDate = lesson.date instanceof Date ? lesson.date : new Date(lesson.date)
      if (!isSameDay(lessonDate, selectedDate)) continue
      if (!map[lesson.courtId]) continue
      map[lesson.courtId].push({
        type: 'private', id: lesson.id,
        startSlot: timeToSlotIndex(lesson.startTime), endSlot: timeToSlotIndex(lesson.endTime),
        coachName: lesson.coachName, playerNames: lesson.playerNames, price: lesson.price, notes: lesson.notes,
      })
    }

    // 3. Eventos
    for (const event of events) {
      if (!event.isActive) continue
      const eventDate = event.date instanceof Date ? event.date : new Date(event.date)
      if (!isSameDay(eventDate, selectedDate)) continue
      const typeInfo = EVENT_TYPES.find((t) => t.value === event.type)
      for (const courtId of event.courtIds) {
        if (!map[courtId]) continue
        map[courtId].push({
          type: 'event', id: event.id,
          startSlot: timeToSlotIndex(event.startTime), endSlot: timeToSlotIndex(event.endTime),
          eventName: event.name, eventType: event.type, eventTypeLabel: typeInfo?.label ?? event.type,
          coachName: event.coachNames.join(', '), playerNames: event.attendeePlayerNames, price: event.price,
        })
      }
    }

    return map
  }, [groups, privateLessons, events, activeCourts, selectedDate, selectedDayOfWeek])

  function goToPreviousDay() { setSelectedDate((prev) => { const d = new Date(prev); d.setDate(d.getDate() - 1); return d }) }
  function goToNextDay() { setSelectedDate((prev) => { const d = new Date(prev); d.setDate(d.getDate() + 1); return d }) }
  function goToToday() { setSelectedDate(new Date()) }

  const dayLabel = useMemo(() => {
    const info = DAYS_OF_WEEK.find((d) => d.value === selectedDayOfWeek)
    return info?.label ?? ''
  }, [selectedDayOfWeek])

  function openNewLessonDialog() {
    setFormDate(toInputDate(selectedDate)); setFormCourtId(activeCourts[0]?.id ?? '')
    setFormCoachId(coaches.filter((c) => c.isActive)[0]?.id ?? ''); setFormPlayerIds([])
    setFormStartTime('09:00'); setFormEndTime('10:00'); setFormPrice(''); setFormNotes('')
    setFormGuestNames([]); setFormGuestInput('')
    setDialogOpen(true)
  }

  function openNewEventDialog() {
    setEvName(''); setEvType('mini_torneo'); setEvDate(toInputDate(selectedDate))
    setEvStartTime('09:00'); setEvEndTime('12:00'); setEvCourtIds([]); setEvCoachIds([])
    setEvPlayerIds([]); setEvPrice(''); setEvDescription(''); setEvMaxCapacity('')
    setEvGuestNames([]); setEvGuestInput('')
    setEventDialogOpen(true)
  }

  function togglePlayer(playerId: string) {
    setFormPlayerIds((prev) => prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId])
  }
  function toggleEvCourt(courtId: string) {
    setEvCourtIds((prev) => prev.includes(courtId) ? prev.filter((id) => id !== courtId) : [...prev, courtId])
  }
  function toggleEvCoach(coachId: string) {
    setEvCoachIds((prev) => prev.includes(coachId) ? prev.filter((id) => id !== coachId) : [...prev, coachId])
  }
  function toggleEvPlayer(playerId: string) {
    setEvPlayerIds((prev) => prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId])
  }

  // Helpers invitados clase particular
  function addFormGuest() {
    const name = formGuestInput.trim()
    if (!name) return
    setFormGuestNames((prev) => [...prev, name])
    setFormGuestInput('')
  }
  function removeFormGuest(index: number) {
    setFormGuestNames((prev) => prev.filter((_, i) => i !== index))
  }

  // Helpers invitados evento
  function addEvGuest() {
    const name = evGuestInput.trim()
    if (!name) return
    setEvGuestNames((prev) => [...prev, name])
    setEvGuestInput('')
  }
  function removeEvGuest(index: number) {
    setEvGuestNames((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSaveLesson() {
    if (!formCourtId || !formCoachId || (formPlayerIds.length === 0 && formGuestNames.length === 0)) return
    const coach = coaches.find((c) => c.id === formCoachId)
    const court = activeCourts.find((c) => c.id === formCourtId)
    const selectedPlayers = players.filter((p) => formPlayerIds.includes(p.id))
    const guestIds = formGuestNames.map((_, i) => `guest-${Date.now()}-${i}`)
    const lessonData: Omit<PrivateLesson, 'id' | 'createdAt'> = {
      playerIds: [...formPlayerIds, ...guestIds],
      playerNames: [...selectedPlayers.map((p) => `${p.firstName} ${p.lastName}`), ...formGuestNames],
      coachId: formCoachId, coachName: coach ? `${coach.firstName} ${coach.lastName}` : '',
      courtId: formCourtId, courtName: court?.name ?? '',
      date: new Date(formDate + 'T00:00:00'), startTime: formStartTime, endTime: formEndTime,
      price: parseFloat(formPrice) || 0, isPaid: false, notes: formNotes || undefined,
    }
    addPrivateLesson(lessonData)
    setDialogOpen(false)
  }

  function handleSaveEvent() {
    if (!evName || evCourtIds.length === 0) return
    const selectedCoaches = coaches.filter((c) => evCoachIds.includes(c.id))
    const selectedPlayers = players.filter((p) => evPlayerIds.includes(p.id))
    const selectedCourts = activeCourts.filter((c) => evCourtIds.includes(c.id))
    const eventPrice = parseFloat(evPrice) || 0
    const evGuestIds = evGuestNames.map((_, i) => `guest-${Date.now()}-${i}`)
    const eventId = addEvent({
      name: evName, type: evType, date: new Date(evDate + 'T00:00:00'),
      startTime: evStartTime, endTime: evEndTime,
      courtIds: evCourtIds, courtNames: selectedCourts.map((c) => c.name),
      coachIds: evCoachIds, coachNames: selectedCoaches.map((c) => `${c.firstName} ${c.lastName}`),
      attendeePlayerIds: [...evPlayerIds, ...evGuestIds],
      attendeePlayerNames: [...selectedPlayers.map((p) => `${p.firstName} ${p.lastName}`), ...evGuestNames],
      price: eventPrice, maxCapacity: evMaxCapacity ? parseInt(evMaxCapacity) : undefined,
      description: evDescription || undefined, isActive: true,
    })
    // Crear pagos solo para jugadores reales (no invitados)
    for (const p of selectedPlayers) {
      addEventPayment({
        eventId,
        eventName: evName,
        playerId: p.id,
        playerName: `${p.firstName} ${p.lastName}`,
        amount: eventPrice,
        status: 'pendiente',
      })
    }
    setEventDialogOpen(false)
  }

  const selectedLesson = useMemo(
    () => selectedLessonId ? privateLessons.find((l) => l.id === selectedLessonId) : null,
    [privateLessons, selectedLessonId]
  )

  function openLessonDetail(lessonId: string) {
    const lesson = privateLessons.find((l) => l.id === lessonId)
    if (!lesson) return
    setSelectedLessonId(lessonId)
    setLessonEditMode(false)
    const d = lesson.date instanceof Date ? lesson.date : new Date(lesson.date)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    setEditLessonDate(`${y}-${m}-${day}`)
    setEditLessonCourtId(lesson.courtId)
    setEditLessonCoachId(lesson.coachId)
    setEditLessonStartTime(lesson.startTime)
    setEditLessonEndTime(lesson.endTime)
    setEditLessonPrice(String(lesson.price))
    setEditLessonNotes(lesson.notes ?? '')
    setEditLessonIsPaid(lesson.isPaid)
    setLessonDetailOpen(true)
  }

  function handleSaveLessonEdit() {
    if (!selectedLessonId || !editLessonCourtId || !editLessonCoachId) return
    const coach = coaches.find((c) => c.id === editLessonCoachId)
    const court = activeCourts.find((c) => c.id === editLessonCourtId)
    updatePrivateLesson(selectedLessonId, {
      date: new Date(editLessonDate + 'T00:00:00'),
      courtId: editLessonCourtId,
      courtName: court?.name ?? '',
      coachId: editLessonCoachId,
      coachName: coach ? `${coach.firstName} ${coach.lastName}` : '',
      startTime: editLessonStartTime,
      endTime: editLessonEndTime,
      price: parseFloat(editLessonPrice) || 0,
      notes: editLessonNotes || undefined,
      isPaid: editLessonIsPaid,
    })
    setLessonDetailOpen(false)
  }

  function handleDeleteLesson() {
    if (!selectedLessonId) return
    deletePrivateLesson(selectedLessonId)
    setDeleteLessonDialogOpen(false)
    setLessonDetailOpen(false)
  }

  function handleToggleLessonPaid() {
    if (!selectedLessonId) return
    const newPaid = !editLessonIsPaid
    setEditLessonIsPaid(newPaid)
    updatePrivateLesson(selectedLessonId, { isPaid: newPaid })
  }

  const activePlayers = useMemo(
    () => players.filter((p) => p.status === 'activo').sort((a, b) => a.lastName.localeCompare(b.lastName)),
    [players]
  )
  const activeCoaches = useMemo(
    () => coaches.filter((c) => c.isActive).sort((a, b) => a.lastName.localeCompare(b.lastName)),
    [coaches]
  )
  const isToday = isSameDay(selectedDate, new Date())

  return (
    <div>
      <Header
        title="Agenda"
        subtitle="Vista diaria de pistas y horarios"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={openNewEventDialog} className="gap-1" size="sm">
              <CalendarPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Nuevo evento</span>
            </Button>
            <Button onClick={openNewLessonDialog} className="gap-1" size="sm">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nueva clase particular</span>
            </Button>
          </div>
        }
      />

      <div className="p-3 sm:p-6 space-y-4">
        {/* Navegacion de fecha */}
        <Card>
          <CardContent className="py-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={goToPreviousDay}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" onClick={goToNextDay}><ChevronRight className="h-4 w-4" /></Button>
                {!isToday && <Button variant="outline" size="sm" onClick={goToToday}>Hoy</Button>}
              </div>
              <div className="text-center">
                <h2 className="text-base sm:text-lg font-semibold capitalize">{formatDateLong(selectedDate)}</h2>
                <p className="text-sm text-muted-foreground">{dayLabel}</p>
              </div>
              <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                <div className="flex items-center gap-1"><div className="h-3 w-3 rounded-sm bg-blue-100 border border-blue-300" />Grupo</div>
                <div className="flex items-center gap-1"><div className="h-3 w-3 rounded-sm bg-amber-100 border border-amber-300" />Particular</div>
                <div className="flex items-center gap-1"><div className="h-3 w-3 rounded-sm bg-teal-100 border border-teal-300" />Evento</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grilla horaria */}
        {activeCourts.length === 0 ? (
          <Card><CardContent className="py-12 text-center"><MapPin className="h-10 w-10 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">No hay pistas activas configuradas.</p></CardContent></Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <div className="grid min-w-[800px]" style={{ gridTemplateColumns: `80px repeat(${activeCourts.length}, 1fr)` }}>
                  <div className="sticky top-0 z-10 border-b border-r bg-muted/50 px-2 py-3 text-xs font-medium text-muted-foreground flex items-center justify-center">
                    <Clock className="h-3.5 w-3.5 mr-1" />Hora
                  </div>
                  {activeCourts.map((court) => (
                    <div key={court.id} className="sticky top-0 z-10 border-b bg-muted/50 px-3 py-3 text-center">
                      <p className="text-sm font-semibold truncate">{court.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{court.type === 'indoor' ? 'Cubierta' : 'Exterior'} &middot; {court.surface}</p>
                    </div>
                  ))}

                  {TIME_SLOTS.map((time, slotIdx) => {
                    const isFullHour = time.endsWith(':00')
                    return (
                      <div key={`row-${time}`} className="contents">
                        <div className={`border-r px-2 flex items-start justify-end pt-1 text-xs font-mono text-muted-foreground ${isFullHour ? 'border-t' : 'border-t border-dashed'}`} style={{ height: SLOT_HEIGHT }}>
                          {isFullHour ? time : ''}
                        </div>
                        {activeCourts.map((court) => {
                          const blocks = blocksByCourt[court.id] ?? []
                          const startingBlock = blocks.find((b) => b.startSlot === slotIdx)
                          const coveredByBlock = blocks.find((b) => b.startSlot < slotIdx && b.endSlot > slotIdx)

                          if (coveredByBlock) {
                            return <div key={`${court.id}-${time}`} className={`${isFullHour ? 'border-t' : 'border-t border-dashed'} pointer-events-none`} style={{ height: SLOT_HEIGHT }} />
                          }

                          if (startingBlock) {
                            const spanSlots = startingBlock.endSlot - startingBlock.startSlot
                            const blockHeight = spanSlots * SLOT_HEIGHT

                            if (startingBlock.type === 'group') {
                              const colors = LEVEL_COLORS[startingBlock.level ?? ''] ?? LEVEL_COLORS.iniciacion
                              return (
                                <div key={`${court.id}-${time}`} className={`${isFullHour ? 'border-t' : 'border-t border-dashed'} relative`} style={{ height: SLOT_HEIGHT }}>
                                  <div className={`absolute inset-x-1 top-1 rounded-lg border-l-4 ${colors.bg} ${colors.border} p-2 overflow-hidden z-[1] shadow-sm cursor-pointer hover:shadow-md transition-shadow`} style={{ height: blockHeight - 8 }} onClick={() => navigate(`/clases/${startingBlock.id}/${toInputDate(selectedDate)}`)}>
                                    <div className="flex items-start justify-between gap-1">
                                      <p className={`text-sm font-semibold ${colors.text} truncate`}>{startingBlock.groupName}</p>
                                      <Badge className={`text-[10px] shrink-0 ${PLAYER_LEVELS.find((l) => l.value === startingBlock.level)?.color ?? ''}`}>{startingBlock.levelLabel}</Badge>
                                    </div>
                                    <div className="mt-1 space-y-0.5">
                                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />{startingBlock.coachName}</p>
                                      <p className="text-xs text-muted-foreground">{startingBlock.enrollment}/{startingBlock.maxCapacity} alumnos</p>
                                    </div>
                                  </div>
                                </div>
                              )
                            }

                            if (startingBlock.type === 'event') {
                              return (
                                <div key={`${court.id}-${time}`} className={`${isFullHour ? 'border-t' : 'border-t border-dashed'} relative`} style={{ height: SLOT_HEIGHT }}>
                                  <div className="absolute inset-x-1 top-1 rounded-lg border-l-4 bg-teal-50 border-teal-400 p-2 overflow-hidden z-[1] shadow-sm cursor-pointer hover:shadow-md transition-shadow" style={{ height: blockHeight - 8 }} onClick={() => navigate(`/eventos/${startingBlock.id}`)}>
                                    <div className="flex items-start justify-between gap-1">
                                      <p className="text-sm font-semibold text-teal-800 truncate">{startingBlock.eventName}</p>
                                      <Badge className="text-[10px] shrink-0 bg-teal-100 text-teal-800">{startingBlock.eventTypeLabel}</Badge>
                                    </div>
                                    <div className="mt-1 space-y-0.5">
                                      {startingBlock.coachName && <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />{startingBlock.coachName}</p>}
                                      {startingBlock.playerNames && startingBlock.playerNames.length > 0 && <p className="text-xs text-muted-foreground">{startingBlock.playerNames.length} asistentes</p>}
                                      {startingBlock.price !== undefined && startingBlock.price > 0 && <p className="text-xs font-medium text-teal-700">{formatCurrency(startingBlock.price)}</p>}
                                    </div>
                                  </div>
                                </div>
                              )
                            }

                            return (
                              <div key={`${court.id}-${time}`} className={`${isFullHour ? 'border-t' : 'border-t border-dashed'} relative`} style={{ height: SLOT_HEIGHT }}>
                                <div className="absolute inset-x-1 top-1 rounded-lg border-l-4 bg-amber-50 border-amber-400 p-2 overflow-hidden z-[1] shadow-sm cursor-pointer hover:shadow-md transition-shadow" style={{ height: blockHeight - 8 }} onClick={() => openLessonDetail(startingBlock.id)}>
                                  <p className="text-sm font-semibold text-amber-800">Clase Particular</p>
                                  <div className="mt-1 space-y-0.5">
                                    <p className="text-xs text-muted-foreground truncate">{startingBlock.playerNames?.join(', ')}</p>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />{startingBlock.coachName}</p>
                                    {startingBlock.price !== undefined && startingBlock.price > 0 && <p className="text-xs font-medium text-amber-700">{formatCurrency(startingBlock.price)}</p>}
                                  </div>
                                </div>
                              </div>
                            )
                          }

                          return (
                            <div key={`${court.id}-${time}`} className={`${isFullHour ? 'border-t' : 'border-t border-dashed'} hover:bg-muted/30 cursor-pointer transition-colors`} style={{ height: SLOT_HEIGHT }}
                              onClick={() => {
                                setFormStartTime(time)
                                const [h, m] = time.split(':').map(Number)
                                const endH = Math.min(h + 1, END_HOUR)
                                setFormEndTime(`${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
                                setFormDate(toInputDate(selectedDate)); setFormCourtId(court.id)
                                setFormCoachId(activeCoaches[0]?.id ?? ''); setFormPlayerIds([]); setFormPrice(''); setFormNotes('')
                                setFormGuestNames([]); setFormGuestInput('')
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

        {/* Resumen del dia */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card><CardContent className="py-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100"><Users className="h-5 w-5 text-blue-600" /></div><div><p className="text-2xl font-bold">{Object.values(blocksByCourt).reduce((acc, blocks) => acc + blocks.filter((b) => b.type === 'group').length, 0)}</p><p className="text-sm text-muted-foreground">Grupos con clase</p></div></div></CardContent></Card>
          <Card><CardContent className="py-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100"><Clock className="h-5 w-5 text-amber-600" /></div><div><p className="text-2xl font-bold">{Object.values(blocksByCourt).reduce((acc, blocks) => acc + blocks.filter((b) => b.type === 'private').length, 0)}</p><p className="text-sm text-muted-foreground">Clases particulares</p></div></div></CardContent></Card>
          <Card><CardContent className="py-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100"><Star className="h-5 w-5 text-teal-600" /></div><div><p className="text-2xl font-bold">{Object.values(blocksByCourt).reduce((acc, blocks) => acc + blocks.filter((b) => b.type === 'event').length, 0)}</p><p className="text-sm text-muted-foreground">Eventos</p></div></div></CardContent></Card>
          <Card><CardContent className="py-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100"><MapPin className="h-5 w-5 text-green-600" /></div><div><p className="text-2xl font-bold">{activeCourts.length}</p><p className="text-sm text-muted-foreground">Pistas activas</p></div></div></CardContent></Card>
        </div>
      </div>

      {/* Dialogo: Nueva clase particular */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nueva clase particular</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Fecha</Label><Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Pista</Label><Select value={formCourtId} onChange={(e) => setFormCourtId(e.target.value)} options={activeCourts.map((c) => ({ value: c.id, label: c.name }))} placeholder="Seleccionar pista" /></div>
            <div className="space-y-1.5"><Label>Entrenador</Label><Select value={formCoachId} onChange={(e) => setFormCoachId(e.target.value)} options={activeCoaches.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }))} placeholder="Seleccionar entrenador" /></div>
            <div className="space-y-1.5">
              <Label>Jugadores</Label>
              <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-1">
                {activePlayers.length === 0 ? <p className="text-sm text-muted-foreground text-center py-2">No hay jugadores activos</p> : activePlayers.map((player) => (
                  <label key={player.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer text-sm">
                    <Checkbox checked={formPlayerIds.includes(player.id)} onCheckedChange={() => togglePlayer(player.id)} />
                    <span>{player.lastName}, {player.firstName}</span>
                    <Badge className={`ml-auto text-[10px] ${PLAYER_LEVELS.find((l) => l.value === player.level)?.color ?? ''}`}>{PLAYER_LEVELS.find((l) => l.value === player.level)?.label ?? player.level}</Badge>
                  </label>
                ))}
              </div>
              {formPlayerIds.length > 0 && <p className="text-xs text-muted-foreground">{formPlayerIds.length} jugador{formPlayerIds.length !== 1 ? 'es' : ''} seleccionado{formPlayerIds.length !== 1 ? 's' : ''}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Invitados</Label>
              <div className="flex gap-2">
                <Input value={formGuestInput} onChange={(e) => setFormGuestInput(e.target.value)} placeholder="Nombre del invitado" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFormGuest() } }} />
                <Button variant="outline" size="sm" onClick={addFormGuest} disabled={!formGuestInput.trim()}>Añadir</Button>
              </div>
              {formGuestNames.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {formGuestNames.map((name, i) => (
                    <Badge key={i} variant="secondary" className="flex items-center gap-1">
                      {name}
                      <button onClick={() => removeFormGuest(i)} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Hora inicio</Label><Input type="time" value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Hora fin</Label><Input type="time" value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)} /></div>
            </div>
            <div className="space-y-1.5"><Label>Precio (&euro;)</Label><Input type="number" min="0" step="0.01" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} placeholder="0.00" /></div>
            <div className="space-y-1.5"><Label>Notas</Label><Input value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Notas adicionales (opcional)" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveLesson} disabled={!formCourtId || !formCoachId || (formPlayerIds.length === 0 && formGuestNames.length === 0)}>Guardar clase</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogo: Detalle/Edicion clase particular */}
      <Dialog open={lessonDetailOpen} onOpenChange={setLessonDetailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{lessonEditMode ? 'Editar clase particular' : 'Clase particular'}</DialogTitle></DialogHeader>
          {selectedLesson && !lessonEditMode && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Jugadores</p>
                  <p className="text-sm font-medium">{selectedLesson.playerNames.join(', ')}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Entrenador</p>
                  <p className="text-sm font-medium">{selectedLesson.coachName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Pista</p>
                  <p className="text-sm font-medium">{selectedLesson.courtName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Horario</p>
                  <p className="text-sm font-medium">{selectedLesson.startTime} - {selectedLesson.endTime}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Precio</p>
                  <p className="text-sm font-bold">{formatCurrency(selectedLesson.price)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Estado pago</p>
                  <Badge className={editLessonIsPaid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>{editLessonIsPaid ? 'Pagado' : 'Pendiente'}</Badge>
                </div>
              </div>
              {selectedLesson.notes && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Notas</p>
                  <p className="text-sm">{selectedLesson.notes}</p>
                </div>
              )}
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" size="sm" onClick={handleToggleLessonPaid}>
                  <Euro className="h-4 w-4 mr-1" />
                  {editLessonIsPaid ? 'Marcar pendiente' : 'Marcar pagado'}
                </Button>
                <div className="flex gap-2 ml-auto">
                  <Button variant="outline" size="sm" onClick={() => setLessonEditMode(true)}>
                    <Edit2 className="h-4 w-4 mr-1" />Editar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setDeleteLessonDialogOpen(true)}>
                    <Trash2 className="h-4 w-4 mr-1" />Eliminar
                  </Button>
                </div>
              </DialogFooter>
            </div>
          )}
          {lessonEditMode && (
            <div className="space-y-4">
              <div className="space-y-1.5"><Label>Fecha</Label><Input type="date" value={editLessonDate} onChange={(e) => setEditLessonDate(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Pista</Label><Select value={editLessonCourtId} onChange={(e) => setEditLessonCourtId(e.target.value)} options={activeCourts.map((c) => ({ value: c.id, label: c.name }))} /></div>
              <div className="space-y-1.5"><Label>Entrenador</Label><Select value={editLessonCoachId} onChange={(e) => setEditLessonCoachId(e.target.value)} options={activeCoaches.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }))} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Hora inicio</Label><Input type="time" value={editLessonStartTime} onChange={(e) => setEditLessonStartTime(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Hora fin</Label><Input type="time" value={editLessonEndTime} onChange={(e) => setEditLessonEndTime(e.target.value)} /></div>
              </div>
              <div className="space-y-1.5"><Label>Precio (&euro;)</Label><Input type="number" min="0" step="0.01" value={editLessonPrice} onChange={(e) => setEditLessonPrice(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Notas</Label><Input value={editLessonNotes} onChange={(e) => setEditLessonNotes(e.target.value)} placeholder="Notas (opcional)" /></div>
              <div className="flex items-center gap-2">
                <Checkbox checked={editLessonIsPaid} onCheckedChange={(v) => setEditLessonIsPaid(!!v)} />
                <Label>Pagado</Label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setLessonEditMode(false)}>Cancelar</Button>
                <Button onClick={handleSaveLessonEdit}>Guardar cambios</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmar eliminacion clase particular */}
      <ConfirmDialog
        open={deleteLessonDialogOpen}
        onOpenChange={setDeleteLessonDialogOpen}
        title="Eliminar clase particular"
        description="¿Estas seguro de que deseas eliminar esta clase particular? Esta accion no se puede deshacer."
        variant="destructive"
        confirmLabel="Eliminar"
        onConfirm={handleDeleteLesson}
      />

      {/* Dialogo: Nuevo evento */}
      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nuevo evento</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-1.5"><Label>Nombre del evento</Label><Input value={evName} onChange={(e) => setEvName(e.target.value)} placeholder="Ej: Mini Torneo Navidad" /></div>
            <div className="space-y-1.5"><Label>Tipo</Label><Select value={evType} onChange={(e) => setEvType(e.target.value as EventType)} options={EVENT_TYPES.map((t) => ({ value: t.value, label: t.label }))} /></div>
            <div className="space-y-1.5"><Label>Fecha</Label><Input type="date" value={evDate} onChange={(e) => setEvDate(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Hora inicio</Label><Input type="time" value={evStartTime} onChange={(e) => setEvStartTime(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Hora fin</Label><Input type="time" value={evEndTime} onChange={(e) => setEvEndTime(e.target.value)} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Pistas</Label>
              <div className="max-h-32 overflow-y-auto rounded-md border p-2 space-y-1">
                {activeCourts.map((court) => (
                  <label key={court.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer text-sm">
                    <Checkbox checked={evCourtIds.includes(court.id)} onCheckedChange={() => toggleEvCourt(court.id)} /><span>{court.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Entrenadores</Label>
              <div className="max-h-32 overflow-y-auto rounded-md border p-2 space-y-1">
                {activeCoaches.map((coach) => (
                  <label key={coach.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer text-sm">
                    <Checkbox checked={evCoachIds.includes(coach.id)} onCheckedChange={() => toggleEvCoach(coach.id)} /><span>{coach.firstName} {coach.lastName}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Asistentes</Label>
              <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-1">
                {activePlayers.map((player) => (
                  <label key={player.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer text-sm">
                    <Checkbox checked={evPlayerIds.includes(player.id)} onCheckedChange={() => toggleEvPlayer(player.id)} /><span>{player.lastName}, {player.firstName}</span>
                  </label>
                ))}
              </div>
              {evPlayerIds.length > 0 && <p className="text-xs text-muted-foreground">{evPlayerIds.length} asistente{evPlayerIds.length !== 1 ? 's' : ''}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Invitados</Label>
              <div className="flex gap-2">
                <Input value={evGuestInput} onChange={(e) => setEvGuestInput(e.target.value)} placeholder="Nombre del invitado" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEvGuest() } }} />
                <Button variant="outline" size="sm" onClick={addEvGuest} disabled={!evGuestInput.trim()}>Añadir</Button>
              </div>
              {evGuestNames.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {evGuestNames.map((name, i) => (
                    <Badge key={i} variant="secondary" className="flex items-center gap-1">
                      {name}
                      <button onClick={() => removeEvGuest(i)} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Precio (&euro;)</Label><Input type="number" min="0" step="0.01" value={evPrice} onChange={(e) => setEvPrice(e.target.value)} placeholder="0.00" /></div>
              <div className="space-y-1.5"><Label>Capacidad max.</Label><Input type="number" min="1" value={evMaxCapacity} onChange={(e) => setEvMaxCapacity(e.target.value)} placeholder="Sin limite" /></div>
            </div>
            <div className="space-y-1.5"><Label>Descripcion</Label><Input value={evDescription} onChange={(e) => setEvDescription(e.target.value)} placeholder="Descripcion del evento (opcional)" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveEvent} disabled={!evName || evCourtIds.length === 0}>Guardar evento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
