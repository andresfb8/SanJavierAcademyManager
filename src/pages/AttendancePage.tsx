import { useState, useMemo, useEffect } from 'react'
import { useSearchParams, useOutletContext, useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import type { ClasesOutletContext } from '@/components/layout/ClasesLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { useDataStore } from '@/stores/dataStore'
import { useAuthStore } from '@/stores/authStore'
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  UserPlus,
  Users,
  Save,
  Download,
  RotateCcw,
  Phone,
  Share2,
  MoreHorizontal,
  History,
  Smartphone,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { downloadXlsx } from '@/lib/excel'
import type { AttendanceEntry, AttendanceStatus } from '@/types'
import { usePaymentsQuery, useEventPaymentsQuery, usePrivateLessonPaymentsQuery, useAttendanceQuery, useActivitiesQuery, useEvaluationsQuery, useMatchReportsQuery, useInvoicesQuery } from '@/hooks/useQueries'
import { QuickAttendanceSheet } from '@/components/attendance/QuickAttendanceSheet'
import { AttendanceCalendar } from '@/components/attendance/AttendanceCalendar'
import { useNextClass } from '@/hooks/useNextClass'
import { MyAttendanceView } from '@/components/attendance/MyAttendanceView'
import { DaySessionList } from '@/components/agenda/DaySessionList'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import { isSameDay } from '@/lib/agenda-utils'
import { getSessionsForDate, getGroupAttendanceByWeek } from '@/lib/attendance-utils'

// ==========================================
// AttendancePage - Registro de Asistencia
// ==========================================

function toISODate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date)
  if (isNaN(d.getTime())) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function AttendancePage() {
  const { user } = useAuthStore()
  const { groups, players, enrollments, addAttendanceRecord, updateAttendanceRecord, coaches, attendanceNotices, privateLessons } = useDataStore()
  const { data: attendance = [] } = useAttendanceQuery()
  const clasesContext = useOutletContext<ClasesOutletContext | undefined>()
  const navigate = useNavigate()

  // ── Vista: 'selector' | 'sheet' | 'calendar' ────────────────────────────
  type PageView = 'selector' | 'sheet' | 'calendar'
  const [pageView, setPageView] = useState<PageView>('selector')

  // --- Seleccion de grupo y fecha ---
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })

  const activeRole = user?.activeRole ?? user?.role
  const isEntrenador = activeRole === 'entrenador'
  const isAdmin = activeRole === 'director' || activeRole === 'coordinador'
  const isPlayerOrTutor = activeRole === 'jugador' || activeRole === 'tutor'

  // --- Registros de asistencia en edición ---
  const [entries, setEntries] = useState<AttendanceEntry[]>([])
  const [entriesInitialized, setEntriesInitialized] = useState(false)

  // --- Estado de guardado ---
  const [saved, setSaved] = useState(false)

  // --- Dialogs ---
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false)
  const [selectedRecoveryPlayerId, setSelectedRecoveryPlayerId] = useState('')
  const [showOneOffDialog, setShowOneOffDialog] = useState(false)
  const [selectedOneOffPlayerId, setSelectedOneOffPlayerId] = useState('')
  const [oneOffPrice, setOneOffPrice] = useState('15')
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [exportDateFrom, setExportDateFrom] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().split('T')[0]
  })
  const [exportDateTo, setExportDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [exportSelectedGroupIds, setExportSelectedGroupIds] = useState<string[]>([])
  const [exportPlayerId, setExportPlayerId] = useState('')

  const currentCoach = useMemo(
    () => coaches.find((c) => c.userId === user?.id || c.id === user?.linkedCoachId),
    [coaches, user?.id, user?.linkedCoachId]
  )

  // ── Auto-detección de clase próxima (solo entrenadores) ─────────────────
  const nextClass = useNextClass(currentCoach?.id ?? '')

  // ── URL params (acceso directo) ──────────────────────────────────────────
  const [searchParams] = useSearchParams()
  const urlGroupId = searchParams.get('groupId')
  const urlDate = searchParams.get('fecha')

  // ── Grupos visibles según rol activo ────────────────────────────────────
  const activeGroups = useMemo(() => {
    const allActive = groups.filter((g) => g.isActive)
    if (isAdmin) return allActive
    // entrenador: solo sus grupos
    if (isEntrenador && currentCoach) {
      return allActive.filter((g) => g.coachId === currentCoach.id)
    }
    return allActive
  }, [groups, isEntrenador, isAdmin, currentCoach])

  // Mismo criterio que `activeGroups`: un entrenador solo ve sus propias
  // clases particulares en la lista del dia, no las de otros companeros.
  const visiblePrivateLessons = useMemo(() => {
    if (isEntrenador && currentCoach) {
      return privateLessons.filter((l) => l.coachId === currentCoach.id)
    }
    return privateLessons
  }, [privateLessons, isEntrenador, currentCoach])

  const daySessions = useMemo(
    () => getSessionsForDate(new Date(selectedDate + 'T00:00:00'), activeGroups, visiblePrivateLessons, attendance),
    [selectedDate, activeGroups, visiblePrivateLessons, attendance]
  )

  const selectedSession = useMemo(
    () => daySessions.find((s) => s.type === 'group' && s.id === selectedGroupId) ?? null,
    [daySessions, selectedGroupId]
  )

  const dayAttendanceSummary = useMemo(() => {
    const groupSessions = daySessions.filter((s) => s.type === 'group')
    const closedSessions = groupSessions.filter((s) => s.hasRecord)
    if (closedSessions.length === 0) return { average: null, closedCount: 0 }

    let present = 0
    let total = 0
    for (const session of closedSessions) {
      const record = attendance.find(
        (a) => a.groupId === session.id && isSameDay(new Date(a.date), new Date(selectedDate + 'T00:00:00'))
      )
      if (!record) continue
      for (const entry of record.records) {
        total++
        if (entry.status === 'presente') present++
      }
    }
    return {
      average: total > 0 ? Math.round((present / total) * 100) : null,
      closedCount: closedSessions.length,
    }
  }, [daySessions, attendance, selectedDate])

  const weeklyAttendance = useMemo(() => {
    if (!selectedGroupId) return []
    return getGroupAttendanceByWeek(attendance, selectedGroupId, new Date(selectedDate + 'T00:00:00'))
  }, [attendance, selectedGroupId, selectedDate])

  // ── Auto-navegación por URL params ──────────────────────────────────────
  // Ya no salta a pageView 'sheet' — el layout maestro-detalle muestra la
  // sesion seleccionada directamente en la pantalla principal.
  useEffect(() => {
    if (urlGroupId) {
      setSelectedGroupId(urlGroupId)
      if (urlDate) setSelectedDate(urlDate)
    }
  }, [urlGroupId, urlDate])

  // ── Auto-deteccion de clase proxima (entrenador, 2h ventana) ────────────
  // Sustituye al antiguo banner "Clase proxima" — la sesion se auto-
  // selecciona y aparece resaltada con el badge "Ahora" en DaySessionList.
  useEffect(() => {
    if (nextClass && !urlGroupId && !selectedGroupId) {
      const todayISO = new Date().toISOString().split('T')[0]
      setSelectedGroupId(nextClass.group.id)
      setSelectedDate(todayISO)
    }
  }, [nextClass, urlGroupId, selectedGroupId])

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) ?? null,
    [groups, selectedGroupId]
  )

  // Jugadores inscritos activos en el grupo seleccionado
  const enrolledPlayers = useMemo(() => {
    if (!selectedGroupId) return []
    const activeEnrollments = enrollments.filter(
      (e) => e.groupId === selectedGroupId && e.isActive
    )
    return activeEnrollments
      .map((e) => {
        const player = players.find((p) => p.id === e.playerId)
        return player
          ? { id: player.id, name: `${player.firstName} ${player.lastName}` }
          : null
      })
      .filter(Boolean) as { id: string; name: string }[]
  }, [selectedGroupId, enrollments, players])

  // Jugadores disponibles para recuperacion:
  // tienen recoveryCredits > 0 y NO estan inscritos en este grupo
  const recoveryEligiblePlayers = useMemo(() => {
    if (!selectedGroupId) return []
    const enrolledIds = new Set(
      enrollments
        .filter((e) => e.groupId === selectedGroupId && e.isActive)
        .map((e) => e.playerId)
    )
    // Tambien excluir los que ya estan en las entries como recuperacion
    const alreadyAddedRecoveryIds = new Set(
      entries.filter((e) => e.isRecovery).map((e) => e.playerId)
    )
    return players.filter(
      (p) =>
        p.status === 'activo' &&
        p.recoveryCredits > 0 &&
        !enrolledIds.has(p.id) &&
        !alreadyAddedRecoveryIds.has(p.id)
    )
  }, [selectedGroupId, enrollments, players, entries])

  // Comprobar si ya existe un registro de asistencia para grupo+fecha
  const existingRecord = useMemo(() => {
    if (!selectedGroupId || !selectedDate) return null
    return (
      attendance.find((a) => {
        const d = toISODate(a.date)
        return a.groupId === selectedGroupId && d === selectedDate
      }) ?? null
    )
  }, [selectedGroupId, selectedDate, attendance])

  // Historial: ultimos 5 registros de asistencia del grupo
  const recentRecords = useMemo(() => {
    if (!selectedGroupId) return []
    return attendance
      .filter((a) => a.groupId === selectedGroupId)
      .sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      .slice(0, 5)
  }, [selectedGroupId, attendance])

  // Opciones de jugadores para el filtro de exportacion
  const allPlayerOptions = useMemo(() => {
    return players
      .filter((p) => p.status === 'activo')
      .map((p) => ({
        value: p.id,
        label: `${p.firstName} ${p.lastName}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [players])

  // ===================
  // HANDLERS
  // ===================

  // Al seleccionar una sesion (cambia selectedGroupId o selectedDate), se
  // carga su hoja de asistencia automaticamente — ya no hace falta un boton
  // "Cargar hoja" manual. Deliberadamente NO se incluyen `existingRecord`/
  // `enrolledPlayers` en las dependencias (mismo patron ya usado en
  // QuickAttendanceSheet.tsx): solo debe re-inicializar cuando cambia la
  // sesion elegida, no cada vez que las entries en curso provocan un
  // recalculo de esos memos.
  useEffect(() => {
    if (!selectedGroupId) {
      setEntries([])
      setEntriesInitialized(false)
      return
    }
    if (existingRecord) {
      setEntries(existingRecord.records)
    } else {
      setEntries(
        enrolledPlayers.map((p) => ({
          playerId: p.id,
          playerName: p.name,
          status: 'presente' as AttendanceStatus,
          isRecovery: false,
        }))
      )
    }
    setEntriesInitialized(true)
    setSaved(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId, selectedDate])

  // Cambiar estado de asistencia de un jugador
  const handleStatusChange = (playerId: string, status: AttendanceStatus) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.playerId === playerId ? { ...entry, status } : entry
      )
    )
    if (saved) setSaved(false)
  }

  // Cambiar nota de un jugador
  const handleNoteChange = (playerId: string, notes: string) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.playerId === playerId ? { ...entry, notes: notes || undefined } : entry
      )
    )
    if (saved) setSaved(false)
  }

  // Anadir jugador de recuperacion
  const handleAddRecovery = () => {
    if (!selectedRecoveryPlayerId) return
    const player = players.find((p) => p.id === selectedRecoveryPlayerId)
    if (!player) return

    // Encontrar el grupo original del jugador (su inscripcion activa)
    const originalEnrollment = enrollments.find(
      (e) => e.playerId === player.id && e.isActive && e.groupId !== selectedGroupId
    )

    const newEntry: AttendanceEntry = {
      playerId: player.id,
      playerName: `${player.firstName} ${player.lastName}`,
      status: 'presente',
      isRecovery: true,
      originalGroupId: originalEnrollment?.groupId,
    }

    setEntries((prev) => [...prev, newEntry])
    setSelectedRecoveryPlayerId('')
    setShowRecoveryDialog(false)
  }

  // Quitar jugador de recuperacion de la lista
  const handleRemoveRecovery = (playerId: string) => {
    setEntries((prev) => prev.filter((e) => !(e.playerId === playerId && e.isRecovery)))
    if (saved) setSaved(false)
  }

  // Marcar todos como presentes
  const handleMarkAllPresent = () => {
    setEntries((prev) => prev.map((e) => ({ ...e, status: 'presente' })))
    if (saved) setSaved(false)
  }

  // Anadir clase suelta
  const handleAddOneOff = () => {
    if (!selectedOneOffPlayerId || !oneOffPrice) return
    const player = players.find((p) => p.id === selectedOneOffPlayerId)
    if (!player) return

    const price = parseFloat(oneOffPrice)
    if (isNaN(price)) return

    const newEntry: AttendanceEntry = {
      playerId: player.id,
      playerName: `${player.firstName} ${player.lastName}`,
      status: 'presente',
      isRecovery: false,
      isOneOff: true,
      oneOffPrice: price,
    }

    setEntries((prev) => [...prev, newEntry])
    setSelectedOneOffPlayerId('')
    setShowOneOffDialog(false)
    if (saved) setSaved(false)
  }

  // Guardar registro de asistencia
  const handleSave = () => {
    if (!selectedGroup || entries.length === 0) return

    if (existingRecord) {
      // Update the existing record instead of creating a duplicate
      updateAttendanceRecord(existingRecord.id, { records: entries })
    } else {
      addAttendanceRecord({
        groupId: selectedGroup.id,
        groupName: selectedGroup.name,
        date: new Date(selectedDate + 'T00:00:00'),
        records: entries,
        coachId: selectedGroup.coachId,
      })
    }

    setSaved(true)
  }

  // --- Exportacion ---

  const handleToggleExportGroup = (groupId: string, checked: boolean) => {
    setExportSelectedGroupIds((prev) =>
      checked ? [...prev, groupId] : prev.filter((id) => id !== groupId)
    )
  }

  const handleSelectAllGroups = () => {
    if (exportSelectedGroupIds.length === activeGroups.length) {
      setExportSelectedGroupIds([])
    } else {
      setExportSelectedGroupIds(activeGroups.map((g) => g.id))
    }
  }

  const handleExport = () => {
    // Translate status to display text
    const statusLabels: Record<string, string> = {
      presente: 'Presente',
      ausente: 'Ausente',
      justificado: 'Justificado',
    }

    // Filter attendance records by date range
    const fromDate = new Date(exportDateFrom + 'T00:00:00')
    const toDate = new Date(exportDateTo + 'T23:59:59')

    const filteredRecords = attendance.filter((record) => {
      const recordDate =
        record.date instanceof Date
          ? record.date
          : new Date(record.date)
      if (recordDate < fromDate || recordDate > toDate) return false

      // Filter by groups if any are selected
      if (exportSelectedGroupIds.length > 0 && !exportSelectedGroupIds.includes(record.groupId)) {
        return false
      }

      return true
    })

    // Flatten records into rows
    const rows: {
      Fecha: string
      Grupo: string
      Jugador: string
      Estado: string
      Recuperacion: string
      Notas: string
    }[] = []

    for (const record of filteredRecords) {
      const recordDate =
        record.date instanceof Date
          ? record.date
          : new Date(record.date)
      const dateStr = formatDate(recordDate)

      for (const entry of record.records) {
        // Filter by player if specified
        if (exportPlayerId && entry.playerId !== exportPlayerId) continue

        rows.push({
          Fecha: dateStr,
          Grupo: record.groupName,
          Jugador: entry.playerName,
          Estado: statusLabels[entry.status] ?? entry.status,
          Recuperacion: entry.isRecovery ? 'Si' : 'No',
          Notas: entry.notes ?? '',
        })
      }
    }

    // Sort by date then group then player
    rows.sort((a, b) => {
      if (a.Fecha !== b.Fecha) return a.Fecha.localeCompare(b.Fecha)
      if (a.Grupo !== b.Grupo) return a.Grupo.localeCompare(b.Grupo)
      return a.Jugador.localeCompare(b.Jugador)
    })

    // Generate Excel
    const fileName = `asistencia_export_${exportDateFrom}_${exportDateTo}.xlsx`
    downloadXlsx(rows, 'Asistencia', fileName)

    setShowExportDialog(false)
  }

  const handleNotifyFreeSlots = () => {
    if (!selectedGroup) return
    const absences = entries.filter(e => e.status === 'ausente' || e.status === 'justificado').length
    if (absences === 0) {
      alert("No hay huecos libres registrados (marca alumnos como ausentes o justificados primero)")
      return
    }
    const dayName = new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long' })
    const message = `🎾 *Hueco Libre para Recuperación*\n\n¡Hola! Tenemos ${absences} hueco(s) disponible(s) hoy ${dayName} en el grupo *${selectedGroup.name}* (${selectedGroup.schedule}).\n\nSi quieres aprovechar tu crédito de recuperación, ¡avísanos ahora! 🚀`
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
  }

  const handleOpenExportDialog = () => {
    // Reset export filters when opening
    setExportSelectedGroupIds([])
    setExportPlayerId('')
    setShowExportDialog(true)
  }

  // ===================
  // CONTADORES RESUMEN
  // ===================

  const presentCount = entries.filter((e) => e.status === 'presente').length
  const absentCount = entries.filter((e) => e.status === 'ausente').length
  const justifiedCount = entries.filter((e) => e.status === 'justificado').length
  const recoveryCount = entries.filter((e) => e.isRecovery).length

  // ===================
  // OPCIONES DE SELECT
  // ===================

  const groupOptions = activeGroups.map((g) => ({
    value: g.id,
    label: `${g.name} (${g.coachName})`,
  }))

  const recoveryPlayerOptions = recoveryEligiblePlayers.map((p) => ({
    value: p.id,
    label: `${p.firstName} ${p.lastName} (${p.recoveryCredits} cr.)`,
  }))

  const allActivePlayersOptions = players
    .filter((p) => p.status === 'activo')
    .map((p) => ({
      value: p.id,
      label: `${p.firstName} ${p.lastName}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))

  // ===================
  // RENDER
  // ===================


  // ===================
  // RENDER
  // ===================

  // ── Vista QuickAttendanceSheet ───────────────────────────────────────────
  const sheetGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) ?? null,
    [groups, selectedGroupId]
  )

  // Asistencia no tiene accion primaria propia (ver spec de diseño). Este
  // efecto se declara antes de los `return` condicionales de abajo (vistas
  // jugador/tutor, sheet, calendar) para no violar las Rules of Hooks: como
  // `pageView` cambia durante la vida del componente, colocarlo despues de
  // esos returns haria que se dejase de invocar en algunos renders.
  useEffect(() => {
    clasesContext?.setPrimaryAction(null)
    return () => clasesContext?.setPrimaryAction(null)
  }, [clasesContext])

  // Jugador/tutor: solo lectura de su propio historial, sin acceso al
  // editor de gestión (no deben poder ver ni marcar la asistencia de otros).
  if (isPlayerOrTutor) {
    return (
      <div>
        <Header title="Mi Asistencia" subtitle="Historial de tus clases" />
        <div className="p-4 sm:p-6">
          <MyAttendanceView />
        </div>
      </div>
    )
  }

  if (pageView === 'sheet' && sheetGroup) {
    return (
      <div className="flex flex-col h-full">
        <QuickAttendanceSheet
          group={sheetGroup}
          date={selectedDate}
          onBack={() => setPageView('selector')}
        />
      </div>
    )
  }

  // ── Vista Calendar ───────────────────────────────────────────────────────
  if (pageView === 'calendar' && sheetGroup) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Historial de Asistencia" subtitle={sheetGroup.name} />
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <AttendanceCalendar
            group={sheetGroup}
            onDayClick={(date, status) => {
              setSelectedDate(date)
              if (status === 'pending' || status === 'recorded') {
                setPageView('sheet')
              }
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 sm:p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Columna izquierda: navegacion de dia + lista de sesiones */}
          <div className="lg:w-80 shrink-0">
            <DaySessionList
              sessions={daySessions}
              selectedDate={selectedDate}
              selectedGroupId={selectedGroupId}
              dayAverageAttendance={dayAttendanceSummary.average}
              closedSessionsCount={dayAttendanceSummary.closedCount}
              onSelectGroup={(groupId) => setSelectedGroupId(groupId)}
              onSelectPrivate={(privateLessonId) => navigate(`/clases-particulares/${privateLessonId}`)}
              onPreviousDay={() => {
                const d = new Date(selectedDate + 'T00:00:00')
                d.setDate(d.getDate() - 1)
                setSelectedDate(d.toISOString().split('T')[0])
              }}
              onNextDay={() => {
                const d = new Date(selectedDate + 'T00:00:00')
                d.setDate(d.getDate() + 1)
                setSelectedDate(d.toISOString().split('T')[0])
              }}
              onDateChange={(value) => setSelectedDate(value)}
            />
          </div>

          {/* Columna derecha: panel de detalle de la sesion seleccionada */}
          <div className="flex-1 min-w-0">
            {entriesInitialized && selectedGroup && selectedSession ? (
              <Card>
                <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-base">{selectedGroup.name}</CardTitle>
                        {selectedSession.hasRecord ? (
                          <Badge className="bg-slate-100 text-slate-600 border-none text-[10px]">Cerrada</Badge>
                        ) : isSameDay(new Date(selectedDate + 'T00:00:00'), new Date()) ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-none text-[10px]">En curso</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700 border-none text-[10px]">Pendiente</Badge>
                        )}
                        <StatusBadge status={selectedGroup.level} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {selectedSession.startTime} - {selectedSession.endTime} · {selectedGroup.courtName} · {selectedGroup.coachName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="text-xs">
                        {selectedGroup.currentEnrollment}/{selectedGroup.maxCapacity}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleMarkAllPresent}
                        className="text-green-600 border-green-200 hover:bg-green-50 rounded-full"
                      >
                        <CheckCircle className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Todos presentes</span>
                      </Button>
                      <Button onClick={handleSave} disabled={saved} className="min-w-[130px]">
                        <Save className="h-4 w-4 mr-2" />
                        {saved ? 'Guardado' : 'Guardar'}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setShowRecoveryDialog(true)}>
                            <RotateCcw className="h-4 w-4 mr-2" /> Añadir recuperación
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setShowOneOffDialog(true)}>
                            <UserPlus className="h-4 w-4 mr-2" /> Añadir clase suelta
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleNotifyFreeSlots}>
                            <Share2 className="h-4 w-4 mr-2" /> Notificar hueco libre
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setPageView('calendar')}>
                            <History className="h-4 w-4 mr-2" /> Ver historial completo
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setPageView('sheet')}>
                            <Smartphone className="h-4 w-4 mr-2" /> Vista de pase rápido
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={handleOpenExportDialog}>
                            <Download className="h-4 w-4 mr-2" /> Exportar a Excel
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-6">
                  {entries.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No hay jugadores inscritos en este grupo.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {entries.map((entry) => {
                        const player = players.find((p) => p.id === entry.playerId)
                        const notice = attendanceNotices.find(
                          (n) =>
                            n.playerId === entry.playerId &&
                            n.groupId === selectedGroupId &&
                            toISODate(n.date) === selectedDate
                        )
                        return (
                          <div
                            key={`${entry.playerId}-${entry.isRecovery ? 'rec' : 'reg'}`}
                            className="relative rounded-xl border bg-card p-3 space-y-2"
                          >
                            {(entry.isRecovery || entry.isOneOff || notice || player?.medicalNotes) && (
                              <div className="absolute -top-2 -right-2 flex gap-1">
                                {entry.isRecovery && (
                                  <span className="h-5 px-1.5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold flex items-center" title="Recuperación">R</span>
                                )}
                                {entry.isOneOff && (
                                  <span className="h-5 px-1.5 rounded-full bg-orange-100 text-orange-700 text-[9px] font-bold flex items-center" title="Clase suelta">S</span>
                                )}
                                {notice && (
                                  <span
                                    className={`h-5 px-1.5 rounded-full text-[9px] font-bold flex items-center animate-pulse ${notice.type === 'absent' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}
                                    title={notice.notes}
                                  >
                                    {notice.type === 'absent' ? '!' : '✓'}
                                  </span>
                                )}
                                {player?.medicalNotes && (
                                  <span className="h-5 w-5 rounded-full bg-red-100 text-red-700 flex items-center justify-center" title={player.medicalNotes}>
                                    <AlertCircle className="h-3 w-3" />
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <div
                                className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                  entry.status === 'presente'
                                    ? 'bg-green-100 text-green-700'
                                    : entry.status === 'ausente'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-yellow-100 text-yellow-700'
                                }`}
                              >
                                {entry.playerName.charAt(0)}
                              </div>
                              <span className="text-sm font-medium truncate">{entry.playerName}</span>
                            </div>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => handleStatusChange(entry.playerId, 'presente')}
                                className={`flex-1 flex items-center justify-center py-1.5 rounded-md border ${
                                  entry.status === 'presente'
                                    ? 'bg-green-100 text-green-700 border-green-300'
                                    : 'bg-background text-muted-foreground border-border hover:bg-green-50'
                                }`}
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStatusChange(entry.playerId, 'ausente')}
                                className={`flex-1 flex items-center justify-center py-1.5 rounded-md border ${
                                  entry.status === 'ausente'
                                    ? 'bg-red-100 text-red-700 border-red-300'
                                    : 'bg-background text-muted-foreground border-border hover:bg-red-50'
                                }`}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStatusChange(entry.playerId, 'justificado')}
                                className={`flex-1 flex items-center justify-center py-1.5 rounded-md border ${
                                  entry.status === 'justificado'
                                    ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
                                    : 'bg-background text-muted-foreground border-border hover:bg-yellow-50'
                                }`}
                              >
                                <AlertCircle className="h-3.5 w-3.5" />
                              </button>
                              {player?.phone && (
                                <a
                                  href={`https://wa.me/${player.phone.replace(/\s+/g, '')}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center justify-center px-1.5 rounded-md text-green-600 hover:bg-green-50 shrink-0"
                                  title="WhatsApp"
                                >
                                  <Phone className="h-3.5 w-3.5" />
                                </a>
                              )}
                              {entry.isRecovery && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRecovery(entry.playerId)}
                                  className="text-muted-foreground hover:text-destructive shrink-0 px-1"
                                  title="Quitar recuperación"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                            <Input
                              placeholder="Notas..."
                              value={entry.notes ?? ''}
                              onChange={(e) => handleNoteChange(entry.playerId, e.target.value)}
                              className="h-7 text-[11px]"
                            />
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {saved && (
                    <div className="flex items-center gap-2 rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
                      <CheckCircle className="h-5 w-5 flex-shrink-0" />
                      <span>
                        Asistencia guardada correctamente. Los créditos de recuperación se han actualizado automáticamente.
                      </span>
                    </div>
                  )}

                  {weeklyAttendance.some((p) => p.rate !== null) && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Asistencia del grupo — últimas 8 semanas</h3>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={weeklyAttendance}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="weekLabel" tick={{ fontSize: 11 }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={32} />
                          <Tooltip
                            formatter={(value: any) => (value == null ? 'Sin datos' : `${value}%`)}
                          />
                          <Bar dataKey="rate" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <EmptyState
                icon={Users}
                title="Selecciona una sesión"
                description="Elige una sesión de la lista para pasar o revisar su asistencia."
              />
            )}
          </div>
        </div>
      </div>

      {/* ============================== */}
      {/* DIALOG: ANADIR RECUPERACION    */}
      {/* ============================== */}
      <Dialog open={showRecoveryDialog} onOpenChange={setShowRecoveryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anadir recuperacion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Selecciona un jugador de otro grupo que tenga creditos de
              recuperacion disponibles para asistir a esta clase.
            </p>
            {recoveryPlayerOptions.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  No hay jugadores disponibles con creditos de recuperacion.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Jugador</Label>
                <Select
                  options={recoveryPlayerOptions}
                  placeholder="Seleccionar jugador..."
                  value={selectedRecoveryPlayerId}
                  onChange={(e) => setSelectedRecoveryPlayerId(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRecoveryDialog(false)
                setSelectedRecoveryPlayerId('')
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddRecovery}
              disabled={!selectedRecoveryPlayerId}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Anadir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================== */}
      {/* DIALOG: EXPORTAR ASISTENCIA    */}
      {/* ============================== */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exportar asistencia</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <p className="text-sm text-muted-foreground">
              Configura los filtros para exportar los registros de asistencia a
              un archivo Excel.
            </p>

            {/* Rango de fechas */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha desde</Label>
                <Input
                  type="date"
                  value={exportDateFrom}
                  onChange={(e) => setExportDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha hasta</Label>
                <Input
                  type="date"
                  value={exportDateTo}
                  onChange={(e) => setExportDateTo(e.target.value)}
                />
              </div>
            </div>

            {/* Grupos - multi-select con checkboxes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Grupos</Label>
                <button
                  type="button"
                  onClick={handleSelectAllGroups}
                  className="text-xs text-primary hover:underline"
                >
                  {exportSelectedGroupIds.length === activeGroups.length
                    ? 'Deseleccionar todos'
                    : 'Seleccionar todos'}
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-1">
                {activeGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No hay grupos activos.
                  </p>
                ) : (
                  activeGroups.map((group) => (
                    <label
                      key={group.id}
                      className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-accent/50 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={exportSelectedGroupIds.includes(group.id)}
                        onCheckedChange={(checked) =>
                          handleToggleExportGroup(group.id, checked)
                        }
                      />
                      <span className="text-sm">{group.name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {group.coachName}
                      </span>
                    </label>
                  ))
                )}
              </div>
              {exportSelectedGroupIds.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Sin seleccion = todos los grupos
                </p>
              )}
            </div>

            {/* Jugador (filtro opcional) */}
            <div className="space-y-2">
              <Label>Jugador (opcional)</Label>
              <Select
                options={allPlayerOptions}
                placeholder="Todos los jugadores"
                value={exportPlayerId}
                onChange={(e) => setExportPlayerId(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowExportDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleExport}
              disabled={!exportDateFrom || !exportDateTo}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ============================== */}
      {/* DIALOG: ANADIR CLASE SUELTA    */}
      {/* ============================== */}
      <Dialog open={showOneOffDialog} onOpenChange={setShowOneOffDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir clase suelta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Selecciona un jugador para añadirlo puntualmente a esta clase. 
              Se generará un cobro pendiente automáticamente.
            </p>
            <div className="space-y-2">
              <Label>Jugador</Label>
              <Select
                options={allActivePlayersOptions}
                placeholder="Seleccionar jugador..."
                value={selectedOneOffPlayerId}
                onChange={(e) => setSelectedOneOffPlayerId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Precio de la sesión (€)</Label>
              <Input
                type="number"
                value={oneOffPrice}
                onChange={(e) => setOneOffPrice(e.target.value)}
                placeholder="Ej: 15"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowOneOffDialog(false)
                setSelectedOneOffPlayerId('')
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddOneOff}
              disabled={!selectedOneOffPlayerId || !oneOffPrice}
            >
              Añadir a la lista
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
