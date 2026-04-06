import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useDataStore } from '@/stores/dataStore'
import { useAuthStore } from '@/stores/authStore'
import {
  ArrowLeft,
  Users,
  Clock,
  MapPin,
  User,
  Euro,
  UserPlus,
  UserMinus,
  Calendar,
  FileText,
  CheckCircle,
  Edit2,
  Trash2,
} from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import { EVENT_TYPES, PAYMENT_METHODS } from '@/constants'
import type { EventType } from '@/types'
import { usePaymentsQuery, useEventPaymentsQuery, usePrivateLessonPaymentsQuery, useAttendanceQuery, useActivitiesQuery, useEvaluationsQuery, useMatchReportsQuery, useInvoicesQuery } from '@/hooks/useQueries'


// ==========================================
// EventDetailPage - Detalle de evento
// ==========================================
// Ruta: /eventos/:id

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { events, players, coaches, courts, updateEvent, deleteEvent, addEventPayment, updateEventPayment, markEventPaymentPaid } = useDataStore()
  const { data: eventPayments = [] } = useEventPaymentsQuery()


  const { user } = useAuthStore()
  const isEntrenador = user?.role === 'entrenador'
  const currentCoachId = useMemo(() => {
    if (!isEntrenador || !user?.id) return null
    return coaches.find(c => c.userId === user.id)?.id ?? null
  }, [isEntrenador, user?.id, coaches])

  // Estado para anadir asistente
  const [selectedPlayerId, setSelectedPlayerId] = useState('')
  // Estado para invitados
  const [guestNameInput, setGuestNameInput] = useState('')
  // Estado para metodo de pago al marcar pagado
  const [paymentMethods, setPaymentMethods] = useState<Record<string, string>>({})
  // Estado para edicion y eliminacion
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState<EventType>('mini_torneo')
  const [editDate, setEditDate] = useState('')
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')
  const [editCourtIds, setEditCourtIds] = useState<string[]>([])
  const [editCoachIds, setEditCoachIds] = useState<string[]>([])
  const [editPrice, setEditPrice] = useState('')
  const [editMaxCapacity, setEditMaxCapacity] = useState('')
  const [editDescription, setEditDescription] = useState('')

  // ===================
  // DATOS DERIVADOS
  // ===================

  const event = useMemo(() => events.find((e) => e.id === id), [events, id])

  const thisEventPayments = useMemo(
    () => eventPayments.filter((ep) => ep.eventId === id),
    [eventPayments, id]
  )

  const attendeeIds = useMemo(
    () => new Set(event?.attendeePlayerIds ?? []),
    [event?.attendeePlayerIds]
  )

  const availablePlayers = useMemo(
    () => players.filter((p) => p.status === 'activo' && !attendeeIds.has(p.id)),
    [players, attendeeIds]
  )

  const eventTypeInfo = useMemo(
    () => EVENT_TYPES.find((t) => t.value === event?.type),
    [event?.type]
  )

  const totalCobrado = useMemo(
    () =>
      thisEventPayments
        .filter((ep) => ep.status === 'pagado')
        .reduce((sum, ep) => sum + ep.amount, 0),
    [thisEventPayments]
  )

  const totalPendiente = useMemo(
    () =>
      thisEventPayments
        .filter((ep) => ep.status === 'pendiente')
        .reduce((sum, ep) => sum + ep.amount, 0),
    [thisEventPayments]
  )

  const isCoachWithoutAccess = isEntrenador && (!event || !event.coachIds.includes(currentCoachId ?? ''))

  // ===================
  // HANDLERS
  // ===================

  const handleAddAttendee = () => {
    if (!event || !selectedPlayerId) return
    const player = players.find((p) => p.id === selectedPlayerId)
    if (!player) return

    const playerName = `${player.firstName} ${player.lastName}`

    updateEvent(event.id, {
      attendeePlayerIds: [...event.attendeePlayerIds, player.id],
      attendeePlayerNames: [...event.attendeePlayerNames, playerName],
    })

    addEventPayment({
      eventId: event.id,
      eventName: event.name,
      playerId: player.id,
      playerName,
      amount: event.price,
      status: 'pendiente',
    })

    setSelectedPlayerId('')
  }

  const handleRemoveAttendee = (playerId: string) => {
    if (!event) return
    const playerIndex = event.attendeePlayerIds.indexOf(playerId)
    if (playerIndex === -1) return

    const newPlayerIds = event.attendeePlayerIds.filter((pid) => pid !== playerId)
    const newPlayerNames = event.attendeePlayerNames.filter((_, i) => i !== playerIndex)

    updateEvent(event.id, {
      attendeePlayerIds: newPlayerIds,
      attendeePlayerNames: newPlayerNames,
    })

    const payment = thisEventPayments.find((ep) => ep.playerId === playerId && ep.status !== 'cancelado')
    if (payment) {
      updateEventPayment(payment.id, { status: 'cancelado' })
    }
  }

  const handleMarkPaid = (paymentId: string) => {
    const method = paymentMethods[paymentId] || 'efectivo'
    markEventPaymentPaid(paymentId, method as 'transferencia' | 'efectivo' | 'domiciliacion' | 'tarjeta')
  }

  // Auto-crear pagos faltantes para asistentes sin pago (migración de eventos antiguos)
  useEffect(() => {
    if (!event) return
    for (let i = 0; i < event.attendeePlayerIds.length; i++) {
      const pid = event.attendeePlayerIds[i]
      const hasPayment = thisEventPayments.some((ep) => ep.playerId === pid && ep.status !== 'cancelado')
      if (!hasPayment) {
        addEventPayment({
          eventId: event.id,
          eventName: event.name,
          playerId: pid,
          playerName: event.attendeePlayerNames[i] || 'Asistente',
          amount: event.price,
          status: 'pendiente',
        })
      }
    }
  }, [event?.id, event?.attendeePlayerIds.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddGuest = () => {
    if (!event || !guestNameInput.trim()) return
    const guestName = guestNameInput.trim()
    const guestId = `guest-${Date.now()}`

    updateEvent(event.id, {
      attendeePlayerIds: [...event.attendeePlayerIds, guestId],
      attendeePlayerNames: [...event.attendeePlayerNames, guestName],
    })

    addEventPayment({
      eventId: event.id,
      eventName: event.name,
      playerId: guestId,
      playerName: guestName,
      amount: event.price,
      status: 'pendiente',
    })

    setGuestNameInput('')
  }

  const activeCourts = useMemo(() => courts.filter((c) => c.isActive), [courts])
  const activeCoaches = useMemo(
    () => coaches.filter((c) => c.isActive).sort((a, b) => a.lastName.localeCompare(b.lastName)),
    [coaches]
  )

  const openEditDialog = () => {
    if (!event) return
    const d = event.date instanceof Date ? event.date : new Date(event.date)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    setEditName(event.name)
    setEditType(event.type)
    setEditDate(`${y}-${m}-${day}`)
    setEditStartTime(event.startTime)
    setEditEndTime(event.endTime)
    setEditCourtIds([...event.courtIds])
    setEditCoachIds([...event.coachIds])
    setEditPrice(String(event.price))
    setEditMaxCapacity(event.maxCapacity !== undefined ? String(event.maxCapacity) : '')
    setEditDescription(event.description ?? '')
    setEditDialogOpen(true)
  }

  const handleSaveEdit = () => {
    if (!event || !editName || editCourtIds.length === 0) return
    const selectedCourts = activeCourts.filter((c) => editCourtIds.includes(c.id))
    const selectedCoaches = activeCoaches.filter((c) => editCoachIds.includes(c.id))
    updateEvent(event.id, {
      name: editName,
      type: editType,
      date: new Date(editDate + 'T00:00:00'),
      startTime: editStartTime,
      endTime: editEndTime,
      courtIds: editCourtIds,
      courtNames: selectedCourts.map((c) => c.name),
      coachIds: editCoachIds,
      coachNames: selectedCoaches.map((c) => `${c.firstName} ${c.lastName}`),
      price: parseFloat(editPrice) || 0,
      maxCapacity: editMaxCapacity ? parseInt(editMaxCapacity) : undefined,
      description: editDescription || undefined,
    })
    setEditDialogOpen(false)
  }

  const handleDelete = () => {
    if (!event) return
    deleteEvent(event.id)
    navigate('/eventos')
  }

  function toggleEditCourt(courtId: string) {
    setEditCourtIds((prev) => prev.includes(courtId) ? prev.filter((id) => id !== courtId) : [...prev, courtId])
  }
  function toggleEditCoach(coachId: string) {
    setEditCoachIds((prev) => prev.includes(coachId) ? prev.filter((id) => id !== coachId) : [...prev, coachId])
  }

  // ===================
  // GUARDAS
  // ===================

  if (!event) {
    return (
      <div>
        <Header title="Detalle del evento" />
        <div className="p-6">
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <p className="text-lg text-muted-foreground">Evento no encontrado</p>
            <Button variant="outline" onClick={() => navigate('/agenda')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a agenda
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ===================
  // RENDER
  // ===================

  return (
    <div>
      <Header
        title={event.name}
        subtitle={`${eventTypeInfo?.label ?? event.type} · ${formatDate(new Date(event.date))}`}
        actions={
          <div className="flex items-center gap-2">
            {!isCoachWithoutAccess && (
              <>
                <Button variant="outline" size="sm" onClick={openEditDialog}>
                  <Edit2 className="h-4 w-4 mr-1" />
                  Editar
                </Button>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteDialogOpen(true)}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Eliminar
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate('/agenda')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* ============================== */}
        {/* INFORMACION DEL EVENTO         */}
        {/* ============================== */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Informacion del evento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Tipo</p>
                <Badge className={eventTypeInfo?.color ?? 'bg-gray-100 text-gray-800'}>
                  {eventTypeInfo?.label ?? event.type}
                </Badge>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Fecha y hora</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {formatDate(new Date(event.date))} · {event.startTime} - {event.endTime}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Pistas</p>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {event.courtNames.length > 0 ? event.courtNames.join(', ') : 'Sin pistas'}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Entrenadores</p>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {event.coachNames.length > 0 ? event.coachNames.join(', ') : 'Sin entrenadores'}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Precio por asistente</p>
                <div className="flex items-center gap-2">
                  <Euro className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-bold">{formatCurrency(event.price)}</span>
                </div>
              </div>

              {event.maxCapacity !== undefined && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Capacidad maxima</p>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{event.maxCapacity} plazas</span>
                  </div>
                </div>
              )}

              {event.description && (
                <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                  <p className="text-sm text-muted-foreground">Descripcion</p>
                  <p className="text-sm">{event.description}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ============================== */}
        {/* ASISTENTES                     */}
        {/* ============================== */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" />
              Asistentes ({event.attendeePlayerIds.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Anadir asistente */}
            {!isCoachWithoutAccess && (
              <div className="flex items-end gap-3 mb-3 pb-3 border-b">
                <div className="flex-1">
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                    Anadir asistente
                  </label>
                  {availablePlayers.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      No hay jugadores disponibles para anadir.
                    </p>
                  ) : (
                    <Select
                      options={availablePlayers.map((p) => ({
                        value: p.id,
                        label: `${p.firstName} ${p.lastName}`,
                      }))}
                      placeholder="Seleccionar jugador..."
                      value={selectedPlayerId}
                      onChange={(e) => setSelectedPlayerId(e.target.value)}
                    />
                  )}
                </div>
                <Button
                  onClick={handleAddAttendee}
                  disabled={!selectedPlayerId || availablePlayers.length === 0}
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  Añadir
                </Button>
              </div>
            )}

            {/* Anadir invitado por nombre */}
            {!isCoachWithoutAccess && (
              <div className="flex items-end gap-3 mb-4 pb-4 border-b">
                <div className="flex-1">
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                    Añadir invitado (por nombre)
                  </label>
                  <Input
                    placeholder="Nombre del invitado..."
                    value={guestNameInput}
                    onChange={(e) => setGuestNameInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddGuest() } }}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={handleAddGuest}
                  disabled={!guestNameInput.trim()}
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  Invitado
                </Button>
              </div>
            )}

            {/* Tabla de asistentes */}
            {event.attendeePlayerIds.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-3">
                <Users className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No hay asistentes registrados</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jugador</TableHead>
                    <TableHead>Estado pago</TableHead>
                    <TableHead>Importe</TableHead>
                    {!isCoachWithoutAccess && <TableHead className="text-right">Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {event.attendeePlayerIds.map((playerId, index) => {
                    const playerName = event.attendeePlayerNames[index] || 'Jugador desconocido'
                    const payment = thisEventPayments.find(
                      (ep) => ep.playerId === playerId && ep.status !== 'cancelado'
                    )
                    const isPaid = payment?.status === 'pagado'

                    return (
                      <TableRow key={playerId}>
                        <TableCell>
                          {playerId.startsWith('guest-') ? (
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-medium shrink-0">
                                {playerName.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                              </div>
                              <span className="font-medium text-sm text-muted-foreground">{playerName}</span>
                              <Badge variant="outline" className="text-[10px]">Invitado</Badge>
                            </div>
                          ) : (
                            <button
                              className="flex items-center gap-3 text-left hover:underline"
                              onClick={() => navigate(`/jugadores/${playerId}`)}
                            >
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0">
                                {playerName.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                              </div>
                              <span className="font-medium text-sm">{playerName}</span>
                            </button>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 items-start">
                            <StatusBadge status={payment?.status ?? 'pendiente'} />
                            {isPaid && payment?.paymentMethod && (
                              <Badge variant="outline" className="text-[10px] font-normal px-1 py-0 h-4 uppercase text-muted-foreground">
                                {PAYMENT_METHODS.find((m) => m.value === payment.paymentMethod)?.label || payment.paymentMethod}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">
                            {formatCurrency(payment?.amount ?? event.price)}
                          </span>
                        </TableCell>
                        {!isCoachWithoutAccess && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {!isPaid && payment && (
                                <div className="flex items-center gap-1">
                                  <Select
                                    className="w-36 h-8 text-xs"
                                    options={PAYMENT_METHODS.map((m) => ({
                                      value: m.value,
                                      label: m.label,
                                    }))}
                                    value={paymentMethods[payment.id] || 'efectivo'}
                                    onChange={(e) =>
                                      setPaymentMethods((prev) => ({
                                        ...prev,
                                        [payment.id]: e.target.value,
                                      }))
                                    }
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleMarkPaid(payment.id)}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Pagado
                                  </Button>
                                </div>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleRemoveAttendee(playerId)}
                              >
                                <UserMinus className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* ============================== */}
        {/* RESUMEN ESTADISTICAS           */}
        {/* ============================== */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total asistentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {event.attendeePlayerIds.length}
                {event.maxCapacity !== undefined && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {' '}/ {event.maxCapacity}
                  </span>
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Total cobrado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalCobrado)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Total pendiente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-yellow-600">{formatCurrency(totalPendiente)}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogo de edicion */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg sm:max-w-lg md:max-w-xl">
          <DialogHeader><DialogTitle>Editar evento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Nombre</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Tipo</Label><Select value={editType} onChange={(e) => setEditType(e.target.value as EventType)} options={EVENT_TYPES.map((t) => ({ value: t.value, label: t.label }))} /></div>
            <div className="space-y-1.5"><Label>Fecha</Label><Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Hora inicio</Label><Input type="time" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Hora fin</Label><Input type="time" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Pistas</Label>
              <div className="max-h-32 overflow-y-auto rounded-md border p-2 space-y-1">
                {activeCourts.map((court) => (
                  <label key={court.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer text-sm">
                    <Checkbox checked={editCourtIds.includes(court.id)} onCheckedChange={() => toggleEditCourt(court.id)} /><span>{court.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Entrenadores</Label>
              <div className="max-h-32 overflow-y-auto rounded-md border p-2 space-y-1">
                {activeCoaches.map((coach) => (
                  <label key={coach.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer text-sm">
                    <Checkbox checked={editCoachIds.includes(coach.id)} onCheckedChange={() => toggleEditCoach(coach.id)} /><span>{coach.firstName} {coach.lastName}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Precio (&euro;)</Label><Input type="number" min="0" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Capacidad max.</Label><Input type="number" min="1" value={editMaxCapacity} onChange={(e) => setEditMaxCapacity(e.target.value)} placeholder="Sin limite" /></div>
            </div>
            <div className="space-y-1.5"><Label>Descripcion</Label><Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Descripcion (opcional)" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={!editName || editCourtIds.length === 0}>Guardar cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogo de confirmacion de eliminacion */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Eliminar evento"
        description="¿Estas seguro de que deseas eliminar este evento? Esta accion no se puede deshacer."
        variant="destructive"
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
      />
    </div>
  )
}
