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
import { SearchableSelect } from '@/components/shared/SearchableSelect'
import { useDataStore } from '@/stores/dataStore'
import { useAuthStore } from '@/stores/authStore'
import { deleteFirestoreDoc } from '@/lib/firestoreSync'
import {
  ArrowLeft,
  Users,
  Clock,
  MapPin,
  User,
  Euro,
  Calendar,
  FileText,
  CheckCircle,
  Edit2,
  Trash2,
  StickyNote,
  UserPlus,
} from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import { PAYMENT_METHODS, PLAYER_LEVELS } from '@/constants'
import { usePaymentsQuery, useEventPaymentsQuery, usePrivateLessonPaymentsQuery, useAttendanceQuery, useActivitiesQuery, useEvaluationsQuery, useMatchReportsQuery, useInvoicesQuery } from '@/hooks/useQueries'


// ==========================================
// PrivateLessonDetailPage — Detalle de clase particular
// ==========================================
// Ruta: /clases-particulares/:id

export default function PrivateLessonDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { privateLessons, coaches, courts, players, updatePrivateLesson, deletePrivateLesson, markPrivateLessonPaymentPaid, addPrivateLessonPayment } = useDataStore()
  const { data: privateLessonPayments = [], isFetched } = usePrivateLessonPaymentsQuery()


  const isAdmin = user?.role === 'director' || user?.role === 'coordinador'

  // Auto-migrate legacy lessons: if there are players but no individual payments, create them
  const lesson = useMemo(
    () => privateLessons.find((l) => l.id === id),
    [privateLessons, id]
  )
  const lessonPayments = useMemo(
    () => privateLessonPayments.filter((p) => p.lessonId === id),
    [privateLessonPayments, id]
  )

  // Migration, cleanup and repair effect
  useEffect(() => {
    if (!lesson || !isFetched) return
    
    // 1. MIGRATION: If there are players but no individual payments, create them
    if (lesson.playerIds.length > 0 && lessonPayments.length === 0) {
      const lessonDate = lesson.date instanceof Date ? lesson.date : new Date(lesson.date)
      const perPlayer = lesson.price / Math.max(lesson.playerIds.length, 1)
      
      // Safety: Only add if perPlayer is a valid positive number
      if (perPlayer >= 0) {
        for (let i = 0; i < lesson.playerIds.length; i++) {
          addPrivateLessonPayment({
            lessonId: lesson.id,
            lessonDate,
            playerId: lesson.playerIds[i],
            playerName: lesson.playerNames[i] || 'Jugador',
            amount: perPlayer || 0,
            status: lesson.isPaid ? 'pagado' : 'pendiente',
          })
        }
      }
      return
    }

    // 2. CLEANUP & REPAIR: Handle duplicates and 0€ prices
    const playerPaymentsMap: Record<string, typeof lessonPayments> = {}
    lessonPayments.forEach(p => {
      if (!playerPaymentsMap[p.playerId]) playerPaymentsMap[p.playerId] = []
      playerPaymentsMap[p.playerId].push(p)
    })

    const perPlayerCalculated = lesson.price / Math.max(lesson.playerIds.length, 1)

    Object.entries(playerPaymentsMap).forEach(([playerId, payments]) => {
      // DUPLICATE REMOVAL
      if (payments.length > 1) {
        const sorted = [...payments].sort((a, b) => {
          if (a.status === 'pagado' && b.status !== 'pagado') return -1
          if (b.status === 'pagado' && a.status !== 'pagado') return 1
          const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime()
          const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime()
          return dateB - dateA
        })

        const [toKeep, ...toDelete] = sorted
        toDelete.forEach(p => {
          deleteFirestoreDoc('privateLessonPayments', p.id)
        })
        
        // After cleanup, check if the one we kept needs a price repair
        if (toKeep.amount === 0 && perPlayerCalculated > 0) {
          useDataStore.getState().updatePrivateLessonPayment(toKeep.id, { amount: perPlayerCalculated })
        }
      } 
      // PRICE REPAIR (for non-duplicates with 0€)
      else if (payments.length === 1) {
        const p = payments[0]
        if (p.amount === 0 && perPlayerCalculated > 0) {
          useDataStore.getState().updatePrivateLessonPayment(p.id, { amount: perPlayerCalculated })
        }
      }
    })
  }, [lesson?.id, isFetched, lessonPayments.length, lesson?.price]) // eslint-disable-line react-hooks/exhaustive-deps

  const [paymentMethods, setPaymentMethods] = useState<Record<string, string>>({})

  // Añadir jugadores/invitados post-creacion
  const [addPlayerId, setAddPlayerId] = useState('')
  const [guestNameInput, setGuestNameInput] = useState('')

  // Dialogs
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Campos del formulario de edicion
  const [editDate, setEditDate] = useState('')
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')
  const [editCourtId, setEditCourtId] = useState('')
  const [editCoachId, setEditCoachId] = useState('')
  const [editPlayerIds, setEditPlayerIds] = useState<string[]>([])
  const [editPrice, setEditPrice] = useState('')
  const [editNotes, setEditNotes] = useState('')

  // ===================
  // DATOS DERIVADOS
  // ===================


  const activeCourts = useMemo(() => courts.filter((c) => c.isActive), [courts])
  const activeCoaches = useMemo(
    () =>
      coaches
        .filter((c) => c.isActive)
        .sort((a, b) => a.lastName.localeCompare(b.lastName)),
    [coaches]
  )
  const activePlayers = useMemo(
    () =>
      players
        .filter((p) => p.status === 'activo')
        .sort((a, b) => a.lastName.localeCompare(b.lastName)),
    [players]
  )

  const totalCobrado = useMemo(
    () =>
      lessonPayments
        .filter((p) => p.status === 'pagado')
        .reduce((sum, p) => sum + p.amount, 0),
    [lessonPayments]
  )

  const totalPendiente = useMemo(
    () =>
      lessonPayments
        .filter((p) => p.status === 'pendiente')
        .reduce((sum, p) => sum + p.amount, 0),
    [lessonPayments]
  )

  // ===================
  // HANDLERS
  // ===================

  const handleMarkPaid = (paymentId: string) => {
    const method = (paymentMethods[paymentId] || 'efectivo') as
      | 'transferencia'
      | 'efectivo'
      | 'domiciliacion'
      | 'tarjeta'
    markPrivateLessonPaymentPaid(paymentId, method)
  }

  const openEditDialog = () => {
    if (!lesson) return
    const d = lesson.date instanceof Date ? lesson.date : new Date(lesson.date)
    setEditDate(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    )
    setEditStartTime(lesson.startTime)
    setEditEndTime(lesson.endTime)
    setEditCourtId(lesson.courtId)
    setEditCoachId(lesson.coachId)
    setEditPlayerIds(lesson.playerIds.filter((pid) => !pid.startsWith('guest-')))
    setEditPrice(String(lesson.price))
    setEditNotes(lesson.notes ?? '')
    setEditDialogOpen(true)
  }

  const handleSaveEdit = () => {
    if (!lesson || !editCourtId || !editCoachId) return
    const selectedCourt = activeCourts.find((c) => c.id === editCourtId)
    const selectedCoach = activeCoaches.find((c) => c.id === editCoachId)
    const selectedPlayers = activePlayers.filter((p) => editPlayerIds.includes(p.id))

    // Mantener invitados originales
    const guestIds = lesson.playerIds.filter((pid) => pid.startsWith('guest-'))
    const guestNames = guestIds.map((gid) => {
      const idx = lesson.playerIds.indexOf(gid)
      return lesson.playerNames[idx] || ''
    })

    updatePrivateLesson(lesson.id, {
      date: new Date(editDate + 'T00:00:00'),
      startTime: editStartTime,
      endTime: editEndTime,
      courtId: editCourtId,
      courtName: selectedCourt?.name ?? '',
      coachId: editCoachId,
      coachName: selectedCoach
        ? `${selectedCoach.firstName} ${selectedCoach.lastName}`
        : '',
      playerIds: [...editPlayerIds, ...guestIds],
      playerNames: [
        ...selectedPlayers.map((p) => `${p.firstName} ${p.lastName}`),
        ...guestNames,
      ],
      price: parseFloat(editPrice) || 0,
      notes: editNotes || undefined,
    })
    setEditDialogOpen(false)
  }

  const handleDelete = () => {
    if (!lesson) return
    deletePrivateLesson(lesson.id)
    navigate('/eventos')
  }

  function toggleEditPlayer(playerId: string) {
    setEditPlayerIds((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId]
    )
  }

  const handleAddPlayer = () => {
    if (!lesson || !addPlayerId) return
    if (lesson.playerIds.includes(addPlayerId)) return
    const player = activePlayers.find((p) => p.id === addPlayerId)
    if (!player) return
    const playerName = `${player.firstName} ${player.lastName}`
    const newCount = lesson.playerIds.length + 1
    const perPlayer = lesson.price / newCount
    updatePrivateLesson(lesson.id, {
      playerIds: [...lesson.playerIds, addPlayerId],
      playerNames: [...lesson.playerNames, playerName],
    })
    addPrivateLessonPayment({
      lessonId: lesson.id,
      lessonDate: lesson.date instanceof Date ? lesson.date : new Date(lesson.date),
      playerId: addPlayerId,
      playerName,
      amount: perPlayer,
      status: 'pendiente',
    })
    setAddPlayerId('')
  }

  const handleAddGuest = () => {
    if (!lesson || !guestNameInput.trim()) return
    const guestName = guestNameInput.trim()
    const guestId = `guest-${Date.now()}`
    const newCount = lesson.playerIds.length + 1
    const perPlayer = lesson.price / newCount
    updatePrivateLesson(lesson.id, {
      playerIds: [...lesson.playerIds, guestId],
      playerNames: [...lesson.playerNames, guestName],
    })
    addPrivateLessonPayment({
      lessonId: lesson.id,
      lessonDate: lesson.date instanceof Date ? lesson.date : new Date(lesson.date),
      playerId: guestId,
      playerName: guestName,
      amount: perPlayer,
      status: 'pendiente',
    })
    setGuestNameInput('')
  }

  // ===================
  // GUARDAS
  // ===================

  if (!lesson) {
    return (
      <div>
        <Header title="Detalle de la clase" />
        <div className="p-6 flex flex-col items-center justify-center py-20 space-y-4">
          <p className="text-lg text-muted-foreground">Clase particular no encontrada</p>
          <Button variant="outline" onClick={() => navigate('/eventos')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Eventos
          </Button>
        </div>
      </div>
    )
  }

  const lessonDate = lesson.date instanceof Date ? lesson.date : new Date(lesson.date)
  const playerCount = lesson.playerIds.length

  // ===================
  // RENDER
  // ===================

  return (
    <div>
      <Header
        title="Clase Particular"
        subtitle={`${lesson.playerNames.join(', ')} · ${formatDate(lessonDate)}`}
        actions={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={openEditDialog}>
                <Edit2 className="h-4 w-4 mr-1" />
                Editar
              </Button>
            )}
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Eliminar
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate('/eventos')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Informacion de la clase */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Informacion de la clase
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Fecha y hora</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {formatDate(lessonDate)} · {lesson.startTime} - {lesson.endTime}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Pista</p>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {lesson.courtName || 'Sin pista'}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Entrenador</p>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {lesson.coachName || 'Sin entrenador'}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Precio por jugador</p>
                <div className="flex items-center gap-2">
                  <Euro className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-bold">
                    {formatCurrency(playerCount > 0 ? lesson.price / playerCount : lesson.price)}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Precio total</p>
                <div className="flex items-center gap-2">
                  <Euro className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-bold">{formatCurrency(lesson.price)}</span>
                </div>
              </div>

              {lesson.notes && (
                <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                  <p className="text-sm text-muted-foreground">Notas</p>
                  <div className="flex items-start gap-2">
                    <StickyNote className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <p className="text-sm">{lesson.notes}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Jugadores y pagos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" />
              Jugadores ({playerCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {playerCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-3">
                <Users className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  No hay jugadores en esta clase
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jugador</TableHead>
                    <TableHead>Estado pago</TableHead>
                    <TableHead>Importe</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lesson.playerIds.map((playerId, index) => {
                    const playerName =
                      lesson.playerNames[index] || 'Jugador desconocido'
                    const isGuest = playerId.startsWith('guest-')
                    const payment = lessonPayments.find(
                      (p) => p.playerId === playerId
                    )
                    const isPaid = payment?.status === 'pagado'

                    return (
                      <TableRow key={playerId}>
                        <TableCell>
                          {isGuest ? (
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-medium shrink-0">
                                {playerName
                                  .split(' ')
                                  .map((n) => n[0])
                                  .slice(0, 2)
                                  .join('')}
                              </div>
                              <span className="font-medium text-sm text-muted-foreground">
                                {playerName}
                              </span>
                              <Badge variant="outline" className="text-[10px]">
                                Invitado
                              </Badge>
                            </div>
                          ) : (
                            <button
                              className="flex items-center gap-3 text-left hover:underline"
                              onClick={() => navigate(`/jugadores/${playerId}`)}
                            >
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0">
                                {playerName
                                  .split(' ')
                                  .map((n) => n[0])
                                  .slice(0, 2)
                                  .join('')}
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
                            {payment
                              ? formatCurrency(payment.amount)
                              : formatCurrency(
                                lesson.price / Math.max(playerCount, 1)
                              )}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {!isPaid && payment && (
                            <div className="flex items-center justify-end gap-1">
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
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>

          {/* Añadir jugadores/invitados */}
          {isAdmin && (
            <div className="border-t px-6 py-4 space-y-3">
              <p className="text-sm font-medium flex items-center gap-2"><UserPlus className="h-4 w-4" />Añadir participante</p>
              {/* Jugador registrado */}
              <div className="flex gap-2">
                <SearchableSelect
                  className="flex-1"
                  options={activePlayers
                    .filter((p) => !lesson.playerIds.includes(p.id))
                    .map((p) => ({
                      value: p.id,
                      label: `${p.lastName}, ${p.firstName}${p.dni ? ` - ${p.dni}` : ''}`
                    }))}
                  value={addPlayerId}
                  onChange={setAddPlayerId}
                  placeholder="Seleccionar jugador registrado..."
                  searchPlaceholder="Buscar por nombre, apellido o DNI..."
                  emptyMessage="No se encontraron jugadores disponibles"
                />
                <Button variant="outline" size="sm" onClick={handleAddPlayer} disabled={!addPlayerId}>
                  Añadir
                </Button>
              </div>
              {/* Invitado por nombre */}
              <div className="flex gap-2">
                <Input
                  value={guestNameInput}
                  onChange={(e) => setGuestNameInput(e.target.value)}
                  placeholder="Nombre del invitado..."
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddGuest() } }}
                />
                <Button variant="outline" size="sm" onClick={handleAddGuest} disabled={!guestNameInput.trim()}>
                  Invitado
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Resumen estadisticas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total jugadores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{playerCount}</p>
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
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(totalCobrado)}
              </p>
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
              <p className="text-2xl font-bold text-yellow-600">
                {formatCurrency(totalPendiente)}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogo de edicion */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg sm:max-w-lg md:max-w-xl lg:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar clase particular</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Hora inicio</Label>
                <Input
                  type="time"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Hora fin</Label>
                <Input
                  type="time"
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Pista</Label>
              <Select
                value={editCourtId}
                onChange={(e) => setEditCourtId(e.target.value)}
                options={activeCourts.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Seleccionar pista"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Entrenador</Label>
              <Select
                value={editCoachId}
                onChange={(e) => setEditCoachId(e.target.value)}
                options={activeCoaches.map((c) => ({
                  value: c.id,
                  label: `${c.firstName} ${c.lastName}`,
                }))}
                placeholder="Seleccionar entrenador"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Jugadores</Label>
              <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-1">
                {activePlayers.map((player) => (
                  <label
                    key={player.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={editPlayerIds.includes(player.id)}
                      onCheckedChange={() => toggleEditPlayer(player.id)}
                    />
                    <span>
                      {player.lastName}, {player.firstName}
                    </span>
                    <Badge
                      className={`ml-auto text-[10px] ${PLAYER_LEVELS.find((l) => l.value === player.level)?.color ?? ''}`}
                    >
                      {PLAYER_LEVELS.find((l) => l.value === player.level)?.label ??
                        player.level}
                    </Badge>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Precio total (&euro;)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Input
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Notas adicionales (opcional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={!editCourtId || !editCoachId}
            >
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogo de confirmacion de eliminacion */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Eliminar clase particular"
        description="Esta accion eliminara la clase y todos sus pagos asociados. No se puede deshacer."
        variant="destructive"
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
      />
    </div>
  )
}
