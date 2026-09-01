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
