import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import type { ClasesOutletContext } from '@/components/layout/ClasesLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useDataStore } from '@/stores/dataStore'
import { useAuthStore } from '@/stores/authStore'
import {
  Search,
  CalendarPlus,
  Calendar,
  Clock,
  MapPin,
  Users,
  X,
} from 'lucide-react'
import { formatCurrency, normalizeText } from '@/lib/utils'
import { EVENT_TYPES } from '@/constants'
import type { EventType } from '@/types'
import { checkEventConflicts, formatConflictMessage } from '@/lib/schedule-conflicts'
import { isSameDay } from '@/lib/agenda-utils'
import { EventsMiniCalendar } from '@/components/agenda/EventsMiniCalendar'

export default function EventsPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { setPrimaryAction } = useOutletContext<ClasesOutletContext>()
  const {
    club,
    seasons,
    events,
    groups,
    coaches,
    courts,
    players,
    eventPayments,
    addEvent,
    addEventPayment,
    updateEventPayment,
  } = useDataStore()

  const isEntrenador = user?.role === 'entrenador'
  const currentCoach = useMemo(
    () => coaches.find((c) => c.userId === user?.id),
    [coaches, user?.id]
  )

  const [search, setSearch] = useState('')
  const [coachFilter, setCoachFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date())
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null)

  // New event dialog
  const [eventDialogOpen, setEventDialogOpen] = useState(false)
  const [evName, setEvName] = useState('')
  const [evType, setEvType] = useState<EventType>('mini_torneo')
  const [evDate, setEvDate] = useState('')
  const [evStartTime, setEvStartTime] = useState('09:00')
  const [evEndTime, setEvEndTime] = useState('12:00')
  const [evCourtIds, setEvCourtIds] = useState<string[]>([])
  const [evCoachIds, setEvCoachIds] = useState<string[]>([])
  const [evPlayerIds, setEvPlayerIds] = useState<string[]>([])
  const [evPrice, setEvPrice] = useState('')
  const [evDescription, setEvDescription] = useState('')
  const [evMaxCapacity, setEvMaxCapacity] = useState('')
  const [evGuestNames, setEvGuestNames] = useState<string[]>([])
  const [evGuestInput, setEvGuestInput] = useState('')
  const [eventPlayerSearch, setEventPlayerSearch] = useState('')
  const [evAttendeePrices, setEvAttendeePrices] = useState<Record<string, string>>({})

  const activeCourts = useMemo(() => {
    return courts
      .filter((c) => c.isActive)
      .sort((a, b) => {
        const orderA = a.order ?? 9999
        const orderB = b.order ?? 9999
        if (orderA !== orderB) return orderA - orderB
        return a.name.localeCompare(b.name)
      })
  }, [courts])
  const activeCoaches = useMemo(
    () => coaches.filter((c) => c.isActive).sort((a, b) => a.lastName.localeCompare(b.lastName)),
    [coaches]
  )
  const activePlayers = useMemo(
    () => players.filter((p) => p.status === 'activo').sort((a, b) => a.lastName.localeCompare(b.lastName)),
    [players]
  )

  const filteredEventPlayers = useMemo(() => {
    if (!eventPlayerSearch.trim()) return activePlayers
    const q = normalizeText(eventPlayerSearch)
    return activePlayers.filter((p) => {
      const fullName = normalizeText(`${p.firstName} ${p.lastName}`)
      const reverseName = normalizeText(`${p.lastName} ${p.firstName}`)
      const dni = p.dni?.toLowerCase() || ''
      return fullName.includes(q) || reverseName.includes(q) || dni.includes(q)
    })
  }, [activePlayers, eventPlayerSearch])

  const activeSeason = club ? seasons.find((s) => s.id === club.activeSeasonId) : undefined

  const visibleEvents = useMemo(() => {
    const active = events.filter((e) => e.isActive)
    if (isEntrenador && currentCoach) {
      return active.filter((e) => e.coachIds?.includes(currentCoach.id))
    }
    return active
  }, [events, isEntrenador, currentCoach])

  const filteredEvents = useMemo(() => {
    const q = normalizeText(search)
    return visibleEvents
      .filter((ev) => {
        if (search) {
          const matchesName = normalizeText(ev.name).includes(q)
          const matchesCoach = normalizeText(ev.coachNames.join(' ')).includes(q)
          const matchesCourt = normalizeText(ev.courtNames.join(' ')).includes(q)
          if (!matchesName && !matchesCoach && !matchesCourt) return false
        }
        if (coachFilter && !ev.coachNames.some((n) => normalizeText(n).includes(normalizeText(coachFilter)))) {
          return false
        }
        const evDateValue = ev.date instanceof Date ? ev.date : new Date(ev.date)
        if (dateFrom) {
          const from = new Date(dateFrom + 'T00:00:00')
          const d = new Date(evDateValue); d.setHours(0, 0, 0, 0)
          if (d < from) return false
        }
        if (dateTo) {
          const to = new Date(dateTo + 'T23:59:59')
          const d = new Date(evDateValue); d.setHours(23, 59, 59, 999)
          if (d > to) return false
        }
        if (selectedCalendarDate && !isSameDay(evDateValue, selectedCalendarDate)) return false
        return true
      })
      // Ascendente (el mas proximo primero) -- es una lista de "que viene",
      // no un historial. Deliberadamente al reves que PrivateLessonsPage,
      // cuya tabla es un registro de clases ya dadas y por eso ordena
      // descendente (la mas reciente primero).
      .sort((a, b) => {
        const da = a.date instanceof Date ? a.date : new Date(a.date)
        const db = b.date instanceof Date ? b.date : new Date(b.date)
        return da.getTime() - db.getTime()
      })
  }, [visibleEvents, search, coachFilter, dateFrom, dateTo, selectedCalendarDate])

  const eventDatesInMonth = useMemo(() => {
    const y = calendarMonth.getFullYear()
    const m = calendarMonth.getMonth()
    return visibleEvents
      .map((e) => (e.date instanceof Date ? e.date : new Date(e.date)))
      .filter((d) => d.getFullYear() === y && d.getMonth() === m)
  }, [visibleEvents, calendarMonth])

  const incomeByEventType = useMemo(() => {
    const seasonEvents = visibleEvents.filter((e) => {
      if (!activeSeason) return true
      const d = e.date instanceof Date ? e.date : new Date(e.date)
      return d >= activeSeason.startDate && d <= activeSeason.endDate
    })
    return EVENT_TYPES.map((t) => ({
      ...t,
      total: seasonEvents
        .filter((e) => e.type === t.value)
        .reduce((sum, e) => sum + e.price * e.attendeePlayerIds.length, 0),
    }))
  }, [visibleEvents, activeSeason])

  const totalSeasonIncome = incomeByEventType.reduce((sum, t) => sum + t.total, 0)
  const maxCategoryIncome = Math.max(1, ...incomeByEventType.map((t) => t.total))

  function goToPreviousMonth() {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
    setSelectedCalendarDate(null)
  }
  function goToNextMonth() {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
    setSelectedCalendarDate(null)
  }

  function openNewEventDialog() {
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    setEvName('')
    setEvType('mini_torneo')
    setEvDate(`${y}-${m}-${d}`)
    setEvStartTime('09:00')
    setEvEndTime('12:00')
    setEvCourtIds([])
    setEvCoachIds([])
    setEvPlayerIds([])
    setEvPrice('')
    setEvDescription('')
    setEvMaxCapacity('')
    setEvGuestNames([])
    setEvGuestInput('')
    setEventPlayerSearch('')
    setEvAttendeePrices({})
    setEventDialogOpen(true)
  }

  function handleSaveEvent() {
    if (!evName || evCourtIds.length === 0) return

    const eventDate = new Date(evDate + 'T00:00:00')
    const conflicts = checkEventConflicts(
      eventDate,
      evStartTime,
      evEndTime,
      evCourtIds,
      groups,
      events
    )

    if (conflicts.length > 0) {
      const message = formatConflictMessage(conflicts)
      const confirmed = window.confirm(
        `${message}\n\n¿Deseas crear el evento de todas formas?`
      )
      if (!confirmed) return
    }

    setEventDialogOpen(false)
    const selectedCoaches = coaches.filter((c) => evCoachIds.includes(c.id))
    const selectedPlayers = players.filter((p) => evPlayerIds.includes(p.id))
    const selectedCourts = activeCourts.filter((c) => evCourtIds.includes(c.id))
    const eventPrice = parseFloat(evPrice) || 0
    const guestIds = evGuestNames.map((_, i) => `guest-${Date.now()}-${i}`)

    const attendeePrices: Record<string, number> = {}

    for (const pid of evPlayerIds) {
      const customPrice = evAttendeePrices[pid]
      attendeePrices[pid] = customPrice ? parseFloat(customPrice) : eventPrice
    }

    for (let i = 0; i < evGuestNames.length; i++) {
      const gid = guestIds[i]
      const tmpGid = `guest-tmp-${i}`
      const customPrice = evAttendeePrices[tmpGid]
      attendeePrices[gid] = customPrice ? parseFloat(customPrice) : eventPrice
    }

    const eventId = addEvent({
      name: evName,
      type: evType,
      date: new Date(evDate + 'T00:00:00'),
      startTime: evStartTime,
      endTime: evEndTime,
      courtIds: evCourtIds,
      courtNames: selectedCourts.map((c) => c.name),
      coachIds: evCoachIds,
      coachNames: selectedCoaches.map((c) => `${c.firstName} ${c.lastName}`),
      attendeePlayerIds: [...evPlayerIds, ...guestIds],
      attendeePlayerNames: [...selectedPlayers.map((p) => `${p.firstName} ${p.lastName}`), ...evGuestNames],
      price: eventPrice,
      attendeePrices,
      vatRate: (club?.defaultVatRateEvents ?? 21),
      maxCapacity: evMaxCapacity ? parseInt(evMaxCapacity) : undefined,
      description: evDescription || undefined,
      guestNames: evGuestNames.length > 0 ? evGuestNames : undefined,
      isActive: true,
    })

    for (const pid of evPlayerIds) {
      const player = selectedPlayers.find(p => p.id === pid)
      if (!player) continue
      const existing = eventPayments.find(
        p => p.eventId === eventId && p.playerId === pid && p.status !== 'cancelado'
      )
      if (existing) {
        if (existing.amount !== attendeePrices[pid]) {
          updateEventPayment(existing.id, { amount: attendeePrices[pid] })
        }
      } else {
        addEventPayment({
          eventId,
          eventName: evName,
          playerId: pid,
          playerName: `${player.firstName} ${player.lastName}`,
          amount: attendeePrices[pid],
          status: 'pendiente',
        })
      }
    }

    for (let i = 0; i < evGuestNames.length; i++) {
      const gid = guestIds[i]
      const existing = eventPayments.find(
        p => p.eventId === eventId && p.playerId === gid && p.status !== 'cancelado'
      )
      if (existing) {
        if (existing.amount !== attendeePrices[gid]) {
          updateEventPayment(existing.id, { amount: attendeePrices[gid] })
        }
      } else {
        addEventPayment({
          eventId,
          eventName: evName,
          playerId: gid,
          playerName: evGuestNames[i],
          amount: attendeePrices[gid],
          status: 'pendiente',
        })
      }
    }
  }

  function toggleEvCourt(id: string) {
    setEvCourtIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }
  function toggleEvCoach(id: string) {
    setEvCoachIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }
  function toggleEvPlayer(id: string) {
    setEvPlayerIds((prev) => {
      const isSelected = prev.includes(id)
      if (isSelected) {
        const next = prev.filter((x) => x !== id)
        const nextPrices = { ...evAttendeePrices }
        delete nextPrices[id]
        setEvAttendeePrices(nextPrices)
        return next
      } else {
        return [...prev, id]
      }
    })
  }
  function addEvGuest() {
    const name = evGuestInput.trim()
    if (!name) return
    setEvGuestNames((prev) => [...prev, name])
    setEvGuestInput('')
  }
  function removeEvGuest(index: number) {
    setEvGuestNames((prev) => prev.filter((_, i) => i !== index))
  }

  useEffect(() => {
    setPrimaryAction({ label: 'Nuevo evento', icon: CalendarPlus, onClick: openNewEventDialog })
    return () => setPrimaryAction(null)
    // openNewEventDialog solo toca setState y constantes derivadas de `new
    // Date()`/activeCourts/activeCoaches en el momento de la llamada, no de
    // cierre — no hace falta re-registrar la accion cuando cambian esos
    // datos, a diferencia del caso de AgendaPage (que si dependia de un
    // valor de cierre como `selectedDate`).
  }, [setPrimaryAction])

  return (
    <div>
      <div className="p-6 space-y-4">
        {/* Filtros existentes, fila secundaria (no estan en el mock) */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, entrenador o pista..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
          <Select
            options={[
              { value: '', label: 'Todos los entrenadores' },
              ...activeCoaches.map((c) => ({ value: `${c.firstName} ${c.lastName}`, label: `${c.firstName} ${c.lastName}` })),
            ]}
            value={coachFilter}
            onChange={(e) => setCoachFilter(e.target.value)}
            className="h-8 text-xs w-full sm:w-48"
          />
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-xs w-full sm:w-36" title="Desde" />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-xs w-full sm:w-36" title="Hasta" />
        </div>

        <div className="flex flex-col lg:flex-row gap-4">
          {/* Columna izquierda: lista de tarjetas de evento */}
          <div className="flex-1 min-w-0 space-y-3">
            {filteredEvents.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No hay eventos que coincidan con los filtros.</p>
                </CardContent>
              </Card>
            ) : (
              filteredEvents.map((event) => {
                const eventDate = event.date instanceof Date ? event.date : new Date(event.date)
                const day = eventDate.getDate()
                const monthShort = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(eventDate).replace('.', '').toUpperCase()
                const typeInfo = EVENT_TYPES.find((t) => t.value === event.type)
                const courtLabel = event.courtIds.length === 1 ? (event.courtNames[0] ?? '--') : `${event.courtIds.length} pistas`
                const coachLabel = event.coachNames.length > 0 ? event.coachNames.join(', ') : 'Equipo técnico'
                const isFull = event.maxCapacity !== undefined && event.attendeePlayerIds.length >= event.maxCapacity

                return (
                  <Card
                    key={event.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/eventos/${event.id}`)}
                  >
                    <CardContent className="flex items-center gap-4 py-4">
                      <div className="text-center shrink-0 w-14">
                        <p className="text-2xl font-bold leading-none">{day}</p>
                        <p className="text-xs font-medium text-muted-foreground">{monthShort}</p>
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{event.name}</span>
                          <Badge className={`text-[10px] ${typeInfo?.color ?? 'bg-gray-100 text-gray-800'}`}>
                            {typeInfo?.label ?? event.type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{event.startTime} - {event.endTime}</span>
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{courtLabel}</span>
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{coachLabel}</span>
                        </div>
                        {event.maxCapacity !== undefined && (
                          <div className="flex items-center gap-2 pt-1">
                            <Progress value={event.attendeePlayerIds.length} max={event.maxCapacity} className="h-1.5 w-32" />
                            <span className="text-xs text-muted-foreground">{event.attendeePlayerIds.length}/{event.maxCapacity} plazas</span>
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0 space-y-1">
                        <p className="font-semibold text-sm">{event.price === 0 ? 'Gratis' : formatCurrency(event.price)}</p>
                        <Badge variant={isFull ? 'secondary' : 'success'} className="text-[10px]">
                          {isFull ? 'Completo' : 'Inscripción abierta'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>

          {/* Columna derecha: calendario + ingresos */}
          <div className="lg:w-80 shrink-0 space-y-3">
            <EventsMiniCalendar
              month={calendarMonth}
              eventDates={eventDatesInMonth}
              eventsThisMonthCount={eventDatesInMonth.length}
              selectedDate={selectedCalendarDate}
              onSelectDate={setSelectedCalendarDate}
              onPreviousMonth={goToPreviousMonth}
              onNextMonth={goToNextMonth}
            />
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold">Ingresos por eventos</h3>
                  <span className="text-xs text-muted-foreground">Temporada</span>
                </div>
                <div className="space-y-3">
                  {incomeByEventType.map((t) => (
                    <div key={t.value}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span>{t.label}</span>
                        <span className="font-medium">{formatCurrency(t.total)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(t.total / maxCategoryIncome) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg bg-primary/10 px-3 py-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-primary">Total temporada</span>
                  <span className="font-bold text-primary">{formatCurrency(totalSeasonIncome)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* New event dialog */}
      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent className="max-w-xl sm:max-w-xl md:max-w-2xl lg:max-w-3xl max-h-[90vh]">
          <DialogHeader><DialogTitle>Nuevo evento</DialogTitle></DialogHeader>
          <div className="space-y-4">
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
              {activePlayers.length > 0 && (
                <Input
                  placeholder="Buscar jugador por nombre, apellido o DNI..."
                  value={eventPlayerSearch}
                  onChange={(e) => setEventPlayerSearch(e.target.value)}
                />
              )}
              <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-1">
                {filteredEventPlayers.map((player) => (
                  <label key={player.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer text-sm">
                    <Checkbox checked={evPlayerIds.includes(player.id)} onCheckedChange={() => toggleEvPlayer(player.id)} /><span>{player.lastName}, {player.firstName}</span>
                  </label>
                ))}
              </div>
              {evPlayerIds.length > 0 && <p className="text-xs text-muted-foreground">{evPlayerIds.length} asistente{evPlayerIds.length !== 1 ? 's' : ''}</p>}
              {eventPlayerSearch && filteredEventPlayers.length === 0 && <p className="text-xs text-muted-foreground">No se encontraron jugadores</p>}
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
                    <Badge key={i} variant="secondary" className="flex items-center gap-1">{name}<button onClick={() => removeEvGuest(i)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button></Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-3">
              <Label>Precios personalizados (opcional)</Label>
              <div className="rounded-md border p-3 space-y-3 bg-muted/20">
                {(evPlayerIds.length > 0 || evGuestNames.length > 0) ? (
                  <>
                    {evPlayerIds.map(pid => {
                      const player = players.find(p => p.id === pid)
                      if (!player) return null
                      return (
                        <div key={pid} className="flex items-center justify-between gap-4">
                          <span className="text-sm truncate flex-1">{player.firstName} {player.lastName}</span>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              className="h-8 w-24 text-right"
                              placeholder={evPrice || "0.00"}
                              value={evAttendeePrices[pid] || ''}
                              onChange={(e) => setEvAttendeePrices(prev => ({ ...prev, [pid]: e.target.value }))}
                            />
                            <span className="text-xs text-muted-foreground">€</span>
                          </div>
                        </div>
                      )
                    })}
                    {evGuestNames.map((name, i) => {
                      const tmpGid = `guest-tmp-${i}`
                      return (
                        <div key={tmpGid} className="flex items-center justify-between gap-4">
                          <span className="text-sm truncate flex-1">{name} (Invitado)</span>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              className="h-8 w-24 text-right"
                              placeholder={evPrice || "0.00"}
                              value={evAttendeePrices[tmpGid] || ''}
                              onChange={(e) => setEvAttendeePrices(prev => ({ ...prev, [tmpGid]: e.target.value }))}
                            />
                            <span className="text-xs text-muted-foreground">€</span>
                          </div>
                        </div>
                      )
                    })}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-2">Selecciona asistentes para personalizar sus precios</p>
                )}
              </div>
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
