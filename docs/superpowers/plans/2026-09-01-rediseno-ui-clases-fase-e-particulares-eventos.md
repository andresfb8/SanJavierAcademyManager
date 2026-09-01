# Rediseño UI Clases — Fase E (Particulares y Eventos) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sustituir `src/pages/EventsActivitiesPage.tsx` (una página con selector interno Todos/Eventos/Particulares) por dos páginas nuevas e independientes — `EventsPage.tsx` (fiel al mock `f57Q4`) y `PrivateLessonsPage.tsx` (fiel al mock `MorHZ`) — cada una con su propio diseño visual, manteniendo intacta toda la lógica de creación de eventos/clases particulares.

**Architecture:** Un nuevo componente presentacional `src/components/agenda/EventsMiniCalendar.tsx` (mismo patrón que `WeekGrid.tsx`/`DaySessionList.tsx` de fases anteriores) para el calendario de `EventsPage`. Las dos páginas nuevas heredan, sin cambios de comportamiento, los diálogos de creación (`Nuevo evento` / `Nueva clase particular`) y sus handlers desde `EventsActivitiesPage.tsx`, cada una quedándose solo con la mitad que le corresponde. El botón de eliminar en línea desaparece de ambas listas — `EventDetailPage.tsx` y `PrivateLessonDetailPage.tsx` ya tienen su propio flujo de eliminación completo (confirmado en el archivo), así que no se pierde la funcionalidad, solo se accede desde la ficha en vez de desde la lista, igual que muestran los mocks (ninguno de los dos tiene una acción de eliminar visible en la lista).

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-09-01-rediseno-ui-clases-fase-e-particulares-eventos-design.md`

---

### Task 1: Crear `src/components/agenda/EventsMiniCalendar.tsx`

**Files:**
- Create: `src/components/agenda/EventsMiniCalendar.tsx`

Componente presentacional puro (sin `useDataStore`), mismo patrón que
`WeekGrid.tsx`/`DaySessionList.tsx`: recibe los datos ya calculados por
props. No se conecta a ninguna página todavía — eso ocurre en la Task 2.

- [ ] **Step 1: Crear el componente**

```tsx
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { isSameDay } from '@/lib/agenda-utils'

const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export interface EventsMiniCalendarProps {
  /** Cualquier fecha dentro del mes a mostrar. */
  month: Date
  /** Fechas (de cualquier dia del mes) que tienen al menos un evento activo. */
  eventDates: Date[]
  /** Total de eventos activos en el mes visible (puede haber varios el mismo dia). */
  eventsThisMonthCount: number
  /** Dia actualmente filtrado, o null si no hay filtro. */
  selectedDate: Date | null
  /** Se llama con la fecha pulsada, o null si se vuelve a pulsar el dia ya seleccionado (quitar filtro). */
  onSelectDate: (date: Date | null) => void
  onPreviousMonth: () => void
  onNextMonth: () => void
}

function getMonthGrid(month: Date): (Date | null)[] {
  const year = month.getFullYear()
  const m = month.getMonth()
  const firstDay = new Date(year, m, 1)
  const daysInMonth = new Date(year, m + 1, 0).getDate()
  // firstDay.getDay(): 0=Dom,...,6=Sab. La semana empieza en Lunes.
  const leadingBlanks = (firstDay.getDay() + 6) % 7
  const cells: (Date | null)[] = Array(leadingBlanks).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, m, d))
  }
  return cells
}

export function EventsMiniCalendar({
  month, eventDates, eventsThisMonthCount, selectedDate, onSelectDate, onPreviousMonth, onNextMonth,
}: EventsMiniCalendarProps) {
  const cells = getMonthGrid(month)
  const monthLabel = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(month)

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold capitalize">{monthLabel}</h3>
            <p className="text-xs text-muted-foreground">{eventsThisMonthCount} eventos</p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={onPreviousMonth}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={onNextMonth}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="text-[10px] font-medium text-muted-foreground py-1">{label}</div>
          ))}
          {cells.map((date, i) => {
            if (!date) return <div key={`blank-${i}`} />
            const hasEvent = eventDates.some((d) => isSameDay(d, date))
            const isSelected = selectedDate !== null && isSameDay(date, selectedDate)
            return (
              <button
                key={date.toISOString()}
                type="button"
                disabled={!hasEvent}
                onClick={() => onSelectDate(isSelected ? null : date)}
                className={`rounded-md py-1.5 text-xs transition-colors ${
                  isSelected
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : hasEvent
                    ? 'bg-primary/10 text-primary font-medium hover:bg-primary/20 cursor-pointer'
                    : 'text-muted-foreground cursor-default'
                }`}
              >
                {date.getDate()}
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: sin errores. El componente no se usa todavía desde ningún sitio.

- [ ] **Step 3: Commit**

```bash
git add src/components/agenda/EventsMiniCalendar.tsx
git commit -m "feat: componente EventsMiniCalendar para la vista de Eventos"
```

---

### Task 2: Crear `src/pages/EventsPage.tsx`

**Files:**
- Create: `src/pages/EventsPage.tsx`

Página nueva, fiel al mock `f57Q4`: lista de tarjetas de evento + columna
derecha con el calendario (Task 1) y el desglose de ingresos por tipo de
evento. El diálogo "Nuevo evento" y sus handlers se copian tal cual desde
`src/pages/EventsActivitiesPage.tsx` (líneas 109-125, 311-332, 389-501,
506-512 y 535-542 del archivo actual, y el bloque JSX de líneas 801-926) —
sin ningún cambio de comportamiento, solo se elimina todo lo relativo a
clases particulares (que pasa a `PrivateLessonsPage.tsx` en la Task 3).

- [ ] **Step 1: Crear el archivo completo**

```tsx
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
import { usePaymentsQuery, useEventPaymentsQuery, usePrivateLessonPaymentsQuery, useAttendanceQuery, useActivitiesQuery, useEvaluationsQuery, useMatchReportsQuery, useInvoicesQuery } from '@/hooks/useQueries'

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
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: sin errores. La página no está conectada al router todavía (eso
es la Task 4), es esperado que no se use desde ningún sitio aún.

- [ ] **Step 3: Commit**

```bash
git add src/pages/EventsPage.tsx
git commit -m "feat: crear EventsPage con tarjetas, calendario e ingresos por tipo"
```

---

### Task 3: Crear `src/pages/PrivateLessonsPage.tsx`

**Files:**
- Create: `src/pages/PrivateLessonsPage.tsx`

Página nueva, fiel al mock `MorHZ`: 4 KPIs + tabla a ancho completo. El
diálogo "Nueva clase particular" y sus handlers se copian tal cual desde
`src/pages/EventsActivitiesPage.tsx` (líneas 95-107, 292-309, 334-387,
503-505, 526-534) y el bloque JSX de líneas 744-799 — sin cambios de
comportamiento.

- [ ] **Step 1: Crear el archivo completo**

```tsx
import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import type { ClasesOutletContext } from '@/components/layout/ClasesLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { StatCard } from '@/components/shared/StatCard'
import { useDataStore } from '@/stores/dataStore'
import { useAuthStore } from '@/stores/authStore'
import {
  Search,
  Plus,
  CalendarClock,
  Euro,
  Users,
  MapPin,
  X,
} from 'lucide-react'
import { formatCurrency, formatDate, normalizeText } from '@/lib/utils'
import { PLAYER_LEVELS } from '@/constants'
import type { PrivateLesson, PrivateLessonPayment } from '@/types'
import { usePaymentsQuery, useEventPaymentsQuery, usePrivateLessonPaymentsQuery, useAttendanceQuery, useActivitiesQuery, useEvaluationsQuery, useMatchReportsQuery, useInvoicesQuery } from '@/hooks/useQueries'

type LessonStatus = 'pagada' | 'pendiente' | 'cancelada'

function getLessonStatus(lessonId: string, payments: PrivateLessonPayment[]): LessonStatus {
  const lessonPayments = payments.filter((p) => p.lessonId === lessonId)
  if (lessonPayments.length === 0) return 'pendiente'
  if (lessonPayments.every((p) => p.status === 'pagado')) return 'pagada'
  if (lessonPayments.every((p) => p.status === 'cancelado')) return 'cancelada'
  return 'pendiente'
}

export default function PrivateLessonsPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { setPrimaryAction } = useOutletContext<ClasesOutletContext>()
  const {
    privateLessons,
    coaches,
    courts,
    players,
    privateLessonPayments,
    addPrivateLesson,
    addPrivateLessonPayment,
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

  // New private lesson dialog
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false)
  const [formDate, setFormDate] = useState('')
  const [formCourtId, setFormCourtId] = useState('')
  const [formCoachId, setFormCoachId] = useState('')
  const [formPlayerIds, setFormPlayerIds] = useState<string[]>([])
  const [formStartTime, setFormStartTime] = useState('09:00')
  const [formEndTime, setFormEndTime] = useState('10:00')
  const [formPrice, setFormPrice] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formGuestNames, setFormGuestNames] = useState<string[]>([])
  const [formGuestInput, setFormGuestInput] = useState('')
  const [lessonPlayerSearch, setLessonPlayerSearch] = useState('')

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

  const filteredLessonPlayers = useMemo(() => {
    if (!lessonPlayerSearch.trim()) return activePlayers
    const q = normalizeText(lessonPlayerSearch)
    return activePlayers.filter((p) => {
      const fullName = normalizeText(`${p.firstName} ${p.lastName}`)
      const reverseName = normalizeText(`${p.lastName} ${p.firstName}`)
      const dni = p.dni?.toLowerCase() || ''
      return fullName.includes(q) || reverseName.includes(q) || dni.includes(q)
    })
  }, [activePlayers, lessonPlayerSearch])

  const visibleLessons = useMemo(() => {
    if (isEntrenador && currentCoach) {
      return privateLessons.filter((l) => l.coachId === currentCoach.id)
    }
    return privateLessons
  }, [privateLessons, isEntrenador, currentCoach])

  const filteredLessons = useMemo(() => {
    const q = normalizeText(search)
    return visibleLessons
      .filter((lesson) => {
        if (search) {
          const matchesName = normalizeText(lesson.playerNames.join(' ')).includes(q)
          const matchesCoach = normalizeText(lesson.coachName).includes(q)
          const matchesCourt = normalizeText(lesson.courtName).includes(q)
          if (!matchesName && !matchesCoach && !matchesCourt) return false
        }
        if (coachFilter && !normalizeText(lesson.coachName).includes(normalizeText(coachFilter))) return false
        const lessonDateValue = lesson.date instanceof Date ? lesson.date : new Date(lesson.date)
        if (dateFrom) {
          const from = new Date(dateFrom + 'T00:00:00')
          const d = new Date(lessonDateValue); d.setHours(0, 0, 0, 0)
          if (d < from) return false
        }
        if (dateTo) {
          const to = new Date(dateTo + 'T23:59:59')
          const d = new Date(lessonDateValue); d.setHours(23, 59, 59, 999)
          if (d > to) return false
        }
        return true
      })
      .sort((a, b) => {
        const da = a.date instanceof Date ? a.date : new Date(a.date)
        const db = b.date instanceof Date ? b.date : new Date(b.date)
        return db.getTime() - da.getTime()
      })
  }, [visibleLessons, search, coachFilter, dateFrom, dateTo])

  const monthStats = useMemo(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const lessonsThisMonth = visibleLessons.filter((l) => {
      const d = l.date instanceof Date ? l.date : new Date(l.date)
      return d.getFullYear() === y && d.getMonth() === m
    })
    const classesCount = lessonsThisMonth.length
    const totalBilled = lessonsThisMonth.reduce((sum, l) => sum + l.price, 0)
    const avgPerClass = classesCount > 0 ? totalBilled / classesCount : 0

    const studentCounts: Record<string, number> = {}
    for (const lesson of lessonsThisMonth) {
      for (const pid of lesson.playerIds) {
        if (pid.startsWith('guest-')) continue
        studentCounts[pid] = (studentCounts[pid] ?? 0) + 1
      }
    }
    const distinctStudents = Object.keys(studentCounts).length
    const recurringStudents = Object.values(studentCounts).filter((c) => c >= 2).length

    const courtCounts: Record<string, number> = {}
    for (const lesson of lessonsThisMonth) {
      courtCounts[lesson.courtName] = (courtCounts[lesson.courtName] ?? 0) + 1
    }
    let topCourt: string | null = null
    let topCourtCount = 0
    for (const [court, count] of Object.entries(courtCounts)) {
      if (count > topCourtCount) { topCourt = court; topCourtCount = count }
    }

    return { classesCount, totalBilled, avgPerClass, distinctStudents, recurringStudents, topCourt, topCourtCount }
  }, [visibleLessons])

  function openNewLessonDialog() {
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    setFormDate(`${y}-${m}-${d}`)
    setFormCourtId(activeCourts[0]?.id ?? '')
    setFormCoachId(activeCoaches[0]?.id ?? '')
    setFormPlayerIds([])
    setFormStartTime('09:00')
    setFormEndTime('10:00')
    setFormPrice('')
    setFormNotes('')
    setFormGuestNames([])
    setFormGuestInput('')
    setLessonPlayerSearch('')
    setLessonDialogOpen(true)
  }

  function handleSaveLesson() {
    if (!formCourtId || !formCoachId || (formPlayerIds.length === 0 && formGuestNames.length === 0)) return
    setLessonDialogOpen(false)
    const coach = coaches.find((c) => c.id === formCoachId)
    const court = activeCourts.find((c) => c.id === formCourtId)
    const selectedPlayers = players.filter((p) => formPlayerIds.includes(p.id))
    const guestIds = formGuestNames.map((_, i) => `guest-${Date.now()}-${i}`)
    const lessonData: Omit<PrivateLesson, 'id' | 'createdAt'> = {
      playerIds: [...formPlayerIds, ...guestIds],
      playerNames: [...selectedPlayers.map((p) => `${p.firstName} ${p.lastName}`), ...formGuestNames],
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
    const newLessonId = addPrivateLesson(lessonData)

    const totalPrice = parseFloat(formPrice) || 0
    const participantCount = formPlayerIds.length + formGuestNames.length
    const perPlayerAmount = participantCount > 0 ? totalPrice / participantCount : 0
    const lessonDate = new Date(formDate + 'T00:00:00')

    for (const pid of formPlayerIds) {
      const player = selectedPlayers.find((p) => p.id === pid)
      if (player) {
        addPrivateLessonPayment({
          lessonId: newLessonId,
          lessonDate,
          playerId: pid,
          playerName: `${player.firstName} ${player.lastName}`,
          amount: perPlayerAmount,
          status: 'pendiente',
        })
      }
    }
    for (let i = 0; i < formGuestNames.length; i++) {
      addPrivateLessonPayment({
        lessonId: newLessonId,
        lessonDate,
        playerId: guestIds[i],
        playerName: formGuestNames[i],
        amount: perPlayerAmount,
        status: 'pendiente',
      })
    }
  }

  function togglePlayer(id: string) {
    setFormPlayerIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }
  function addFormGuest() {
    const name = formGuestInput.trim()
    if (!name) return
    setFormGuestNames((prev) => [...prev, name])
    setFormGuestInput('')
  }
  function removeFormGuest(index: number) {
    setFormGuestNames((prev) => prev.filter((_, i) => i !== index))
  }

  useEffect(() => {
    setPrimaryAction({ label: 'Nueva clase particular', icon: Plus, onClick: openNewLessonDialog })
    return () => setPrimaryAction(null)
    // openNewLessonDialog solo toca setState y constantes derivadas de `new
    // Date()`/activeCourts/activeCoaches en el momento de la llamada, no de
    // cierre — no hace falta re-registrar la accion cuando cambian esos
    // datos.
  }, [setPrimaryAction])

  return (
    <div>
      <div className="p-6 space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Clases este mes"
            value={monthStats.classesCount}
            icon={CalendarClock}
            iconClassName="bg-blue-500/10 text-blue-600"
          />
          <StatCard
            title="Facturado"
            value={formatCurrency(monthStats.totalBilled)}
            description={monthStats.classesCount > 0 ? `${formatCurrency(monthStats.avgPerClass)}/clase media` : undefined}
            icon={Euro}
            iconClassName="bg-emerald-500/10 text-emerald-600"
          />
          <StatCard
            title="Alumnos recurrentes"
            value={monthStats.recurringStudents}
            description={`de ${monthStats.distinctStudents} distintos`}
            icon={Users}
            iconClassName="bg-purple-500/10 text-purple-600"
          />
          <StatCard
            title="Pista más usada"
            value={monthStats.topCourt ?? 'Sin datos'}
            description={monthStats.topCourt ? `${monthStats.topCourtCount} clases este mes` : undefined}
            icon={MapPin}
            iconClassName="bg-amber-500/10 text-amber-600"
          />
        </div>

        {/* Filtros existentes, fila secundaria (no estan en el mock) */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por alumno, entrenador o pista..."
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

        {/* Tabla */}
        {filteredLessons.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No hay clases particulares que coincidan con los filtros.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">Alumno</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden md:table-cell">Fecha y hora</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden lg:table-cell">Pista</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden md:table-cell">Entrenador</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">Importe</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLessons.map((lesson) => {
                      const status = getLessonStatus(lesson.id, privateLessonPayments)
                      const lessonDate = lesson.date instanceof Date ? lesson.date : new Date(lesson.date)
                      return (
                        <tr
                          key={lesson.id}
                          className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => navigate(`/clases-particulares/${lesson.id}`)}
                        >
                          <td className="p-3"><span className="font-medium text-sm">{lesson.playerNames.join(', ')}</span></td>
                          <td className="p-3 hidden md:table-cell"><span className="text-sm text-muted-foreground">{formatDate(lessonDate)} · {lesson.startTime}</span></td>
                          <td className="p-3 hidden lg:table-cell"><span className="text-sm text-muted-foreground">{lesson.courtName}</span></td>
                          <td className="p-3 hidden md:table-cell"><span className="text-sm text-muted-foreground">{lesson.coachName}</span></td>
                          <td className="p-3"><span className="text-sm font-medium">{formatCurrency(lesson.price)}</span></td>
                          <td className="p-3">
                            <Badge className={`text-xs ${
                              status === 'pagada' ? 'bg-green-100 text-green-800' :
                              status === 'cancelada' ? 'bg-gray-100 text-gray-600' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {status === 'pagada' ? 'Pagada' : status === 'cancelada' ? 'Cancelada' : 'Pendiente'}
                            </Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* New private lesson dialog */}
      <Dialog open={lessonDialogOpen} onOpenChange={setLessonDialogOpen}>
        <DialogContent className="max-w-xl sm:max-w-xl md:max-w-2xl lg:max-w-3xl max-h-[90vh]">
          <DialogHeader><DialogTitle>Nueva clase particular</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Fecha</Label><Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Pista</Label><Select value={formCourtId} onChange={(e) => setFormCourtId(e.target.value)} options={activeCourts.map((c) => ({ value: c.id, label: c.name }))} placeholder="Seleccionar pista" /></div>
            <div className="space-y-1.5"><Label>Entrenador</Label><Select value={formCoachId} onChange={(e) => setFormCoachId(e.target.value)} options={activeCoaches.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }))} placeholder="Seleccionar entrenador" /></div>
            <div className="space-y-1.5">
              <Label>Jugadores</Label>
              {activePlayers.length > 0 && (
                <Input
                  placeholder="Buscar jugador por nombre, apellido o DNI..."
                  value={lessonPlayerSearch}
                  onChange={(e) => setLessonPlayerSearch(e.target.value)}
                />
              )}
              <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-1">
                {activePlayers.length === 0 ? <p className="text-sm text-muted-foreground text-center py-2">No hay jugadores activos</p> : filteredLessonPlayers.map((player) => (
                  <label key={player.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer text-sm">
                    <Checkbox checked={formPlayerIds.includes(player.id)} onCheckedChange={() => togglePlayer(player.id)} />
                    <span>{player.lastName}, {player.firstName}</span>
                    <Badge className={`ml-auto text-[10px] ${PLAYER_LEVELS.find((l) => l.value === player.level)?.color ?? ''}`}>{PLAYER_LEVELS.find((l) => l.value === player.level)?.label ?? player.level}</Badge>
                  </label>
                ))}
              </div>
              {formPlayerIds.length > 0 && <p className="text-xs text-muted-foreground">{formPlayerIds.length} jugador{formPlayerIds.length !== 1 ? 'es' : ''} seleccionado{formPlayerIds.length !== 1 ? 's' : ''}</p>}
              {lessonPlayerSearch && filteredLessonPlayers.length === 0 && <p className="text-xs text-muted-foreground">No se encontraron jugadores</p>}
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
                    <Badge key={i} variant="secondary" className="flex items-center gap-1">{name}<button onClick={() => removeFormGuest(i)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button></Badge>
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
            <Button variant="outline" onClick={() => setLessonDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveLesson} disabled={!formCourtId || !formCoachId || (formPlayerIds.length === 0 && formGuestNames.length === 0)}>Guardar clase</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/pages/PrivateLessonsPage.tsx
git commit -m "feat: crear PrivateLessonsPage con KPIs y tabla de clases particulares"
```

---

### Task 4: Conectar las rutas y eliminar `EventsActivitiesPage.tsx`

**Files:**
- Modify: `src/AuthenticatedApp.tsx`
- Delete: `src/pages/EventsActivitiesPage.tsx`

- [ ] **Step 1: Cambiar los imports perezosos**

Cambiar:

```ts
const EventsActivitiesPage = lazy(() => import('@/pages/EventsActivitiesPage'))
```

por:

```ts
const PrivateLessonsPage = lazy(() => import('@/pages/PrivateLessonsPage'))
const EventsPage = lazy(() => import('@/pages/EventsPage'))
```

- [ ] **Step 2: Cambiar las rutas**

Cambiar:

```tsx
          <Route path="particulares" element={<EventsActivitiesPage initialTab="private" />} />
          <Route path="eventos" element={<EventsActivitiesPage initialTab="events" />} />
```

por:

```tsx
          <Route path="particulares" element={<PrivateLessonsPage />} />
          <Route path="eventos" element={<EventsPage />} />
```

- [ ] **Step 3: Eliminar el archivo antiguo**

```bash
git rm src/pages/EventsActivitiesPage.tsx
```

- [ ] **Step 4: Verificar que compila**

Run: `npm run build`
Expected: sin errores. Confirmar que no queda ninguna referencia a
`EventsActivitiesPage` en el repositorio:

Run: `grep -rn "EventsActivitiesPage" src/`
Expected: sin resultados.

Run: `npm test`
Expected: mismo resultado que el baseline (estas páginas no tienen tests
dedicados).

- [ ] **Step 5: Verificación manual en navegador**

1. `npm run dev`, sesión como `director`.
2. Ir a `/clases/particulares`: confirmar los 4 KPIs, la tabla con
   columnas Alumno/Fecha y hora/Pista/Entrenador/Importe/Estado, y que los
   filtros (buscador, entrenador, fechas) siguen funcionando. Pulsar
   "Nueva clase particular" y crear una clase de prueba — confirmar que
   aparece en la tabla y que los KPIs se actualizan. Hacer clic en una
   fila — confirma que navega a `/clases-particulares/:id`.
3. Ir a `/clases/eventos`: confirmar la lista de tarjetas, el calendario
   (con puntos en los días con eventos) y el desglose de ingresos por
   tipo. Pulsar un día con eventos en el calendario y confirmar que la
   lista se filtra a ese día; pulsar el mismo día otra vez para quitar el
   filtro. Pulsar "Nuevo evento" y crear uno de prueba — confirma que
   aparece en la lista y actualiza el calendario/ingresos. Hacer clic en
   una tarjeta — confirma que navega a `/eventos/:id`.
4. Repetir ambas páginas como `entrenador`: confirmar que solo se ven sus
   propios eventos/clases particulares.
5. Confirmar que se puede eliminar un evento/clase particular desde su
   ficha de detalle (`EventDetailPage`/`PrivateLessonDetailPage`) — ya que
   la acción de eliminar en línea se quitó de ambas listas.
6. Confirmar en la consola del navegador que no hay errores nuevos.

- [ ] **Step 6: Commit**

```bash
git add src/AuthenticatedApp.tsx
git commit -m "feat: enrutar Particulares y Eventos a sus paginas nuevas y retirar EventsActivitiesPage"
```

---

### Task 5: Verificación final

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Build y tests completos**

Run: `npm run build`
Expected: sin errores.

Run: `npm test`
Expected: todos los tests pasan, mismo conteo que el baseline.

- [ ] **Step 2: Comparación visual final contra los mocks**

Tomar capturas de `/clases/particulares` y `/clases/eventos` y compararlas
con los nodos `MorHZ`/`f57Q4` del mock — confirmar que el conjunto de
tarjetas/columnas/KPIs coincide, salvo las piezas explícitamente fuera de
alcance (Solicitudes pendientes, Tarifas de particulares, y el KPI de
ocupación de pista sustituido por "Pista más usada").

- [ ] **Step 3: Repetir el proceso de `subagent-driven-development`**

Tras completar las Tasks 1-4 (cada una con su implementador + revisor de
spec + revisor de calidad), dispatch un revisor final sobre el diff
completo de este plan. Después, usar
`superpowers:finishing-a-development-branch`.
