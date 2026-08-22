import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useDataStore } from '@/stores/dataStore'
import { useAuthStore } from '@/stores/authStore'
import {
  Search,
  CalendarPlus,
  Plus,
  Eye,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  MapPin,
  Users,
  X,
} from 'lucide-react'
import { formatCurrency, formatDate, normalizeText } from '@/lib/utils'
import { EVENT_TYPES, PLAYER_LEVELS } from '@/constants'
import type { EventType, PrivateLesson, PaymentMethod } from '@/types'
import { checkEventConflicts, formatConflictMessage } from '@/lib/schedule-conflicts'
import { usePaymentsQuery, useEventPaymentsQuery, usePrivateLessonPaymentsQuery, useAttendanceQuery, useActivitiesQuery, useEvaluationsQuery, useMatchReportsQuery, useInvoicesQuery } from '@/hooks/useQueries'


type TabValue = 'all' | 'events' | 'private'

interface UnifiedItem {
  type: 'event' | 'private'
  id: string
  name: string
  date: Date
  startTime: string
  endTime: string
  coachName: string
  courtName: string
  attendeeCount: number
  price: number
  typeBadge: string
  typeBadgeColor: string
  paymentMethod?: PaymentMethod | null
}

export default function EventsActivitiesPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const {
    club,
    events,
    privateLessons,
    groups,
    coaches,
    courts,
    players,
    eventPayments,
    privateLessonPayments,
    addPrivateLesson,
    addPrivateLessonPayment,
    deletePrivateLesson,
    addEvent,
    addEventPayment,
    updateEventPayment,
    deleteEvent
  } = useDataStore()


  const isEntrenador = user?.role === 'entrenador'
  const currentCoach = useMemo(
    () => coaches.find((c) => c.userId === user?.id),
    [coaches, user?.id]
  )

  const [activeTab, setActiveTab] = useState<TabValue>('all')
  const [search, setSearch] = useState('')
  const [coachFilter, setCoachFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'event' | 'private'; id: string } | null>(null)

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

  // Filtered players for lesson search
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

  // Filtered players for event search
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

  // Build unified items (filtrados por coach si es entrenador)
  const unifiedItems: UnifiedItem[] = useMemo(() => {
    const items: UnifiedItem[] = []

    const visibleEvents = isEntrenador && currentCoach
      ? events.filter((ev) => ev.coachIds?.includes(currentCoach.id))
      : events

    const visibleLessons = isEntrenador && currentCoach
      ? privateLessons.filter((l) => l.coachId === currentCoach.id)
      : privateLessons

    for (const ev of visibleEvents) {
      if (!ev.isActive) continue
      const typeInfo = EVENT_TYPES.find((t) => t.value === ev.type)
      items.push({
        type: 'event',
        id: ev.id,
        name: ev.name,
        date: ev.date instanceof Date ? ev.date : new Date(ev.date),
        startTime: ev.startTime,
        endTime: ev.endTime,
        coachName: ev.coachNames.join(', ') || '--',
        courtName: ev.courtNames.join(', ') || '--',
        attendeeCount: ev.attendeePlayerIds.length,
        price: ev.price,
        typeBadge: typeInfo?.label ?? ev.type,
        typeBadgeColor: typeInfo?.color ?? 'bg-gray-100 text-gray-800',
      })
    }

    for (const lesson of visibleLessons) {
      // Find a paid payment for this lesson to show its payment method
      const paidPayment = privateLessonPayments.find(
        (p) => p.lessonId === lesson.id && p.status === 'pagado'
      )
      items.push({
        type: 'private',
        id: lesson.id,
        name: `Clase: ${lesson.playerNames.join(', ')}`,
        date: lesson.date instanceof Date ? lesson.date : new Date(lesson.date),
        startTime: lesson.startTime,
        endTime: lesson.endTime,
        coachName: lesson.coachName || '--',
        courtName: lesson.courtName || '--',
        attendeeCount: lesson.playerNames.length,
        price: lesson.price,
        typeBadge: 'Clase particular',
        typeBadgeColor: 'bg-amber-100 text-amber-800',
        paymentMethod: paidPayment?.paymentMethod ?? null,
      })
    }

    // Sort by date descending
    items.sort((a, b) => b.date.getTime() - a.date.getTime())
    return items
  }, [events, privateLessons, isEntrenador, currentCoach])

  // Apply filters
  const filteredItems = useMemo(() => {
    const q = normalizeText(search)
    return unifiedItems.filter((item) => {
      if (activeTab === 'events' && item.type !== 'event') return false
      if (activeTab === 'private' && item.type !== 'private') return false

      if (search) {
        if (
          !normalizeText(item.name).includes(q) &&
          !normalizeText(item.coachName).includes(q) &&
          !normalizeText(item.courtName).includes(q)
        ) return false
      }

      if (coachFilter) {
        if (!normalizeText(item.coachName).includes(normalizeText(coachFilter))) return false
      }

      if (dateFrom) {
        const from = new Date(dateFrom + 'T00:00:00')
        const itemDate = new Date(item.date)
        itemDate.setHours(0, 0, 0, 0)
        if (itemDate < from) return false
      }
      if (dateTo) {
        const to = new Date(dateTo + 'T23:59:59')
        const itemDate = new Date(item.date)
        itemDate.setHours(23, 59, 59, 999)
        if (itemDate > to) return false
      }

      return true
    })
  }, [unifiedItems, activeTab, search, coachFilter, dateFrom, dateTo])

  const { totalClasses, totalIncome } = useMemo(() => {
    let classes = 0
    let income = 0
    for (const item of filteredItems) {
      classes++
      if (item.type === 'event') {
        income += (item.price * item.attendeeCount)
      } else {
        income += item.price
      }
    }
    return { totalClasses: classes, totalIncome: income }
  }, [filteredItems])

  const eventsCount = events.filter((e) => e.isActive).length
  const lessonsCount = privateLessons.length

  // Handlers
  function handleDelete() {
    if (!deleteTarget) return
    if (deleteTarget.type === 'event') {
      deleteEvent(deleteTarget.id)
    } else {
      deletePrivateLesson(deleteTarget.id)
    }
    setDeleteTarget(null)
  }

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

  function handleSaveLesson() {
    if (!formCourtId || !formCoachId || (formPlayerIds.length === 0 && formGuestNames.length === 0)) return
    // Close dialog immediately
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

    // Crear pagos individuales por participante
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

  function handleSaveEvent() {
    if (!evName || evCourtIds.length === 0) return

    // Verificar conflictos de horario con grupos y otros eventos
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

    // Close dialog immediately for instant UX feedback
    setEventDialogOpen(false)
    const selectedCoaches = coaches.filter((c) => evCoachIds.includes(c.id))
    const selectedPlayers = players.filter((p) => evPlayerIds.includes(p.id))
    const selectedCourts = activeCourts.filter((c) => evCourtIds.includes(c.id))
    const eventPrice = parseFloat(evPrice) || 0
    const guestIds = evGuestNames.map((_, i) => `guest-${Date.now()}-${i}`)
    
    // Mapear los precios de los asistentes
    const attendeePrices: Record<string, number> = {}
    
    // Jugadores registrados
    for (const pid of evPlayerIds) {
      const customPrice = evAttendeePrices[pid]
      attendeePrices[pid] = customPrice ? parseFloat(customPrice) : eventPrice
    }
    
    // Invitados
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
      attendeePrices, // Guardamos el mapa de precios específicos
      vatRate: (club?.defaultVatRateEvents ?? 21),
      maxCapacity: evMaxCapacity ? parseInt(evMaxCapacity) : undefined,
      description: evDescription || undefined,
      guestNames: evGuestNames.length > 0 ? evGuestNames : undefined,
      isActive: true,
    })

    // Crear o actualizar pagos para jugadores (evitar duplicados)
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

    // Crear o actualizar pagos para invitados (evitar duplicados)
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

  function togglePlayer(id: string) {
    setFormPlayerIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
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
  function addFormGuest() {
    const name = formGuestInput.trim()
    if (!name) return
    setFormGuestNames((prev) => [...prev, name])
    setFormGuestInput('')
  }
  function removeFormGuest(index: number) {
    setFormGuestNames((prev) => prev.filter((_, i) => i !== index))
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

  return (
    <div>
      <Header
        title="Eventos y Actividades"
        subtitle={`${eventsCount} eventos · ${lessonsCount} clases particulares`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={openNewEventDialog}>
              <CalendarPlus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Nuevo evento</span>
            </Button>
            <Button size="sm" onClick={openNewLessonDialog}>
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Nueva clase</span>
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
          <TabsList>
            <TabsTrigger value="all">Todos ({unifiedItems.length})</TabsTrigger>
            <TabsTrigger value="events">Eventos ({eventsCount})</TabsTrigger>
            <TabsTrigger value="private">Clases Particulares ({lessonsCount})</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, entrenador o pista..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            options={[
              { value: '', label: 'Todos los entrenadores' },
              ...activeCoaches.map((c) => ({ value: `${c.firstName} ${c.lastName}`, label: `${c.firstName} ${c.lastName}` })),
            ]}
            value={coachFilter}
            onChange={(e) => setCoachFilter(e.target.value)}
            className="w-full sm:w-48"
          />
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full sm:w-40"
            title="Desde"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full sm:w-40"
            title="Hasta"
          />
        </div>

        {/* Table */}
        {filteredItems.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No hay eventos o clases que coincidan con los filtros</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">Tipo</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">Nombre</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden md:table-cell">Fecha</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden lg:table-cell">Hora</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden md:table-cell">Entrenador</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden lg:table-cell">Pista</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">Asist.</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">Precio</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden xl:table-cell">Método de Pago</th>
                      <th className="p-3 text-right text-sm font-medium text-muted-foreground w-28">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => (
                      <tr key={`${item.type}-${item.id}`} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          <Badge className={`text-xs ${item.typeBadgeColor}`}>{item.typeBadge}</Badge>
                        </td>
                        <td className="p-3">
                          <span className="font-medium text-sm">{item.name}</span>
                        </td>
                        <td className="p-3 hidden md:table-cell">
                          <span className="text-sm text-muted-foreground">{formatDate(item.date)}</span>
                        </td>
                        <td className="p-3 hidden lg:table-cell">
                          <span className="text-sm text-muted-foreground">{item.startTime} - {item.endTime}</span>
                        </td>
                        <td className="p-3 hidden md:table-cell">
                          <span className="text-sm text-muted-foreground">{item.coachName}</span>
                        </td>
                        <td className="p-3 hidden lg:table-cell">
                          <span className="text-sm text-muted-foreground">{item.courtName}</span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1 text-sm">
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            {item.attendeeCount}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="text-sm font-medium">{formatCurrency(item.price)}</span>
                        </td>
                        <td className="p-3 hidden xl:table-cell">
                          {item.type === 'private' && item.paymentMethod ? (
                            <span className="text-sm text-foreground capitalize">
                              {{
                                transferencia: 'Transferencia',
                                efectivo: 'Efectivo',
                                domiciliacion: 'Domiciliación',
                                tarjeta: 'Tarjeta',
                              }[item.paymentMethod] ?? item.paymentMethod}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-1">
                            {item.type === 'event' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => navigate(`/eventos/${item.id}`)}
                                title="Ver detalle"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            {item.type === 'private' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => navigate(`/clases-particulares/${item.id}`)}
                                title="Ver detalle"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget({ type: item.type, id: item.id })}
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/50 font-medium border-t">
                    <tr>
                      <td colSpan={7} className="p-3 text-right">Totales:</td>
                      <td className="p-3">
                        <div className="flex flex-col">
                          <span>{formatCurrency(totalIncome)}</span>
                          <span className="text-xs text-muted-foreground">{totalClasses} actividades</span>
                        </div>
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title={deleteTarget?.type === 'event' ? 'Eliminar evento' : 'Eliminar clase particular'}
        description="Esta acción no se puede deshacer."
        variant="destructive"
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
      />

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
