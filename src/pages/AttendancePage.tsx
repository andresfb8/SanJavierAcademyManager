import { useState, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
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
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  UserPlus,
  Calendar,
  Users,
  ClipboardList,
  Save,
  Download,
} from 'lucide-react'
import { formatDate, generateId } from '@/lib/utils'
import * as XLSX from 'xlsx'
import type { AttendanceEntry, AttendanceStatus } from '@/types'

// ==========================================
// AttendancePage - Registro de Asistencia
// ==========================================

export default function AttendancePage() {
  const { groups, players, enrollments, attendance, addAttendanceRecord } =
    useDataStore()

  // --- Seleccion de grupo y fecha ---
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })

  // --- Registros de asistencia en edicion ---
  const [entries, setEntries] = useState<AttendanceEntry[]>([])
  const [entriesInitialized, setEntriesInitialized] = useState(false)

  // --- Dialog de recuperacion ---
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false)
  const [selectedRecoveryPlayerId, setSelectedRecoveryPlayerId] = useState('')

  // --- Estado de guardado ---
  const [saved, setSaved] = useState(false)

  // --- Dialog de exportacion ---
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [exportDateFrom, setExportDateFrom] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().split('T')[0]
  })
  const [exportDateTo, setExportDateTo] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [exportSelectedGroupIds, setExportSelectedGroupIds] = useState<string[]>([])
  const [exportPlayerId, setExportPlayerId] = useState('')

  // ===================
  // DATOS DERIVADOS
  // ===================

  const activeGroups = useMemo(
    () => groups.filter((g) => g.isActive),
    [groups]
  )

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
        const recordDate =
          a.date instanceof Date
            ? a.date.toISOString().split('T')[0]
            : new Date(a.date).toISOString().split('T')[0]
        return a.groupId === selectedGroupId && recordDate === selectedDate
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

  // Cuando cambia el grupo o la fecha, reinicializar las entries
  const initializeEntries = () => {
    if (!selectedGroupId) {
      setEntries([])
      setEntriesInitialized(false)
      return
    }

    const newEntries: AttendanceEntry[] = enrolledPlayers.map((p) => ({
      playerId: p.id,
      playerName: p.name,
      status: 'presente' as AttendanceStatus,
      isRecovery: false,
    }))

    setEntries(newEntries)
    setEntriesInitialized(true)
    setSaved(false)
  }

  // Cambiar grupo
  const handleGroupChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const groupId = e.target.value
    setSelectedGroupId(groupId)
    setEntriesInitialized(false)
    setSaved(false)
  }

  // Cambiar fecha
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value)
    setEntriesInitialized(false)
    setSaved(false)
  }

  // Cargar hoja de asistencia
  const handleLoadSheet = () => {
    initializeEntries()
  }

  // Cambiar estado de asistencia de un jugador
  const handleStatusChange = (playerId: string, status: AttendanceStatus) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.playerId === playerId ? { ...entry, status } : entry
      )
    )
  }

  // Cambiar nota de un jugador
  const handleNoteChange = (playerId: string, notes: string) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.playerId === playerId ? { ...entry, notes: notes || undefined } : entry
      )
    )
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
  }

  // Guardar registro de asistencia
  const handleSave = () => {
    if (!selectedGroup || entries.length === 0) return

    addAttendanceRecord({
      groupId: selectedGroup.id,
      groupName: selectedGroup.name,
      date: new Date(selectedDate + 'T00:00:00'),
      records: entries,
      coachId: selectedGroup.coachId,
    })

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
    const worksheet = XLSX.utils.json_to_sheet(rows)

    // Set column widths
    worksheet['!cols'] = [
      { wch: 12 }, // Fecha
      { wch: 25 }, // Grupo
      { wch: 25 }, // Jugador
      { wch: 14 }, // Estado
      { wch: 14 }, // Recuperacion
      { wch: 30 }, // Notas
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Asistencia')

    const fileName = `asistencia_export_${exportDateFrom}_${exportDateTo}.xlsx`
    XLSX.writeFile(workbook, fileName)

    setShowExportDialog(false)
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

  // ===================
  // RENDER
  // ===================

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Asistencia"
        subtitle="Registro de asistencia de los grupos"
        actions={
          <Button variant="outline" size="sm" onClick={handleOpenExportDialog}>
            <Download className="h-4 w-4 mr-1" />
            Exportar
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* ============================== */}
        {/* SELECTOR DE GRUPO Y FECHA      */}
        {/* ============================== */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Pasar lista
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <Label>Grupo</Label>
                <Select
                  options={groupOptions}
                  placeholder="Seleccionar grupo..."
                  value={selectedGroupId}
                  onChange={handleGroupChange}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={handleDateChange}
                />
              </div>
              <div>
                <Button
                  onClick={handleLoadSheet}
                  disabled={!selectedGroupId || !selectedDate}
                  className="w-full"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Cargar hoja
                </Button>
              </div>
            </div>

            {/* Aviso si ya existe registro */}
            {existingRecord && (
              <div className="mt-4 flex items-center gap-2 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span>
                  Ya existe un registro de asistencia para este grupo en la
                  fecha seleccionada ({formatDate(new Date(existingRecord.date))}
                  ). Si guardas se creara un nuevo registro.
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ============================== */}
        {/* HOJA DE ASISTENCIA             */}
        {/* ============================== */}
        {entriesInitialized && selectedGroup && (
          <>
            {/* Info del grupo */}
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary" className="text-sm px-3 py-1">
                <Users className="h-4 w-4 mr-1" />
                {selectedGroup.name}
              </Badge>
              <Badge variant="outline" className="text-sm px-3 py-1">
                <Calendar className="h-4 w-4 mr-1" />
                {formatDate(new Date(selectedDate + 'T00:00:00'))}
              </Badge>
              <Badge variant="outline" className="text-sm px-3 py-1">
                Entrenador: {selectedGroup.coachName}
              </Badge>
              {entries.length > 0 && (
                <div className="ml-auto flex gap-2">
                  <Badge variant="success">{presentCount} Presentes</Badge>
                  <Badge variant="destructive">{absentCount} Ausentes</Badge>
                  <Badge variant="warning">{justifiedCount} Justificados</Badge>
                </div>
              )}
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Jugadores ({entries.length})
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRecoveryDialog(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Anadir recuperacion
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {entries.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No hay jugadores inscritos en este grupo.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {/* Cabecera */}
                    <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b">
                      <div className="col-span-4">Jugador</div>
                      <div className="col-span-5">Estado</div>
                      <div className="col-span-3">Notas</div>
                    </div>

                    {/* Filas de jugadores */}
                    {entries.map((entry) => (
                      <div
                        key={`${entry.playerId}-${entry.isRecovery ? 'rec' : 'reg'}`}
                        className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-center px-4 py-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                      >
                        {/* Nombre */}
                        <div className="col-span-4 flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {entry.playerName}
                          </span>
                          {entry.isRecovery && (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 border-blue-200">
                              Recuperacion
                            </Badge>
                          )}
                        </div>

                        {/* Botones de estado */}
                        <div className="col-span-5 flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleStatusChange(entry.playerId, 'presente')
                            }
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                              entry.status === 'presente'
                                ? 'bg-green-100 text-green-700 border-green-300 shadow-sm'
                                : 'bg-background text-muted-foreground border-border hover:bg-green-50 hover:text-green-600'
                            }`}
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            Presente
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleStatusChange(entry.playerId, 'ausente')
                            }
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                              entry.status === 'ausente'
                                ? 'bg-red-100 text-red-700 border-red-300 shadow-sm'
                                : 'bg-background text-muted-foreground border-border hover:bg-red-50 hover:text-red-600'
                            }`}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Ausente
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleStatusChange(entry.playerId, 'justificado')
                            }
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                              entry.status === 'justificado'
                                ? 'bg-yellow-100 text-yellow-700 border-yellow-300 shadow-sm'
                                : 'bg-background text-muted-foreground border-border hover:bg-yellow-50 hover:text-yellow-600'
                            }`}
                          >
                            <AlertCircle className="h-3.5 w-3.5" />
                            Justificado
                          </button>
                        </div>

                        {/* Notas + boton quitar recuperacion */}
                        <div className="col-span-3 flex items-center gap-2">
                          <Input
                            placeholder="Notas..."
                            value={entry.notes ?? ''}
                            onChange={(e) =>
                              handleNoteChange(entry.playerId, e.target.value)
                            }
                            className="h-8 text-xs"
                          />
                          {entry.isRecovery && (
                            <button
                              type="button"
                              onClick={() => handleRemoveRecovery(entry.playerId)}
                              className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                              title="Quitar recuperacion"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Boton guardar */}
                {entries.length > 0 && (
                  <div className="mt-6 flex items-center justify-between border-t pt-4">
                    <div className="text-sm text-muted-foreground">
                      {presentCount} presentes, {absentCount} ausentes,{' '}
                      {justifiedCount} justificados
                      {recoveryCount > 0 && ` (${recoveryCount} recuperaciones)`}
                    </div>
                    <Button
                      onClick={handleSave}
                      disabled={saved}
                      className="min-w-[160px]"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {saved ? 'Guardado' : 'Guardar asistencia'}
                    </Button>
                  </div>
                )}

                {saved && (
                  <div className="mt-3 flex items-center gap-2 rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
                    <CheckCircle className="h-5 w-5 flex-shrink-0" />
                    <span>
                      Asistencia guardada correctamente. Los creditos de
                      recuperacion se han actualizado automaticamente.
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ============================== */}
            {/* HISTORIAL DE ASISTENCIAS       */}
            {/* ============================== */}
            {recentRecords.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Ultimos registros de asistencia
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {/* Cabecera */}
                    <div className="grid grid-cols-5 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b">
                      <div>Fecha</div>
                      <div className="text-center">Presentes</div>
                      <div className="text-center">Ausentes</div>
                      <div className="text-center">Justificados</div>
                      <div className="text-center">Total</div>
                    </div>

                    {recentRecords.map((record) => {
                      const rPresent = record.records.filter(
                        (r) => r.status === 'presente'
                      ).length
                      const rAbsent = record.records.filter(
                        (r) => r.status === 'ausente'
                      ).length
                      const rJustified = record.records.filter(
                        (r) => r.status === 'justificado'
                      ).length
                      const rTotal = record.records.length

                      return (
                        <div
                          key={record.id}
                          className="grid grid-cols-5 gap-4 items-center px-4 py-2.5 rounded-md border hover:bg-accent/30 transition-colors"
                        >
                          <div className="text-sm font-medium">
                            {formatDate(new Date(record.date))}
                          </div>
                          <div className="text-center">
                            <Badge variant="success">{rPresent}</Badge>
                          </div>
                          <div className="text-center">
                            <Badge variant="destructive">{rAbsent}</Badge>
                          </div>
                          <div className="text-center">
                            <Badge variant="warning">{rJustified}</Badge>
                          </div>
                          <div className="text-center text-sm text-muted-foreground">
                            {rTotal}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Estado vacio: cuando no se ha cargado la hoja aun */}
        {!entriesInitialized && selectedGroupId && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ClipboardList className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Pulsa "Cargar hoja" para comenzar</p>
            <p className="text-sm mt-1">
              Selecciona un grupo y fecha y luego carga la hoja de asistencia
            </p>
          </div>
        )}

        {!selectedGroupId && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Users className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Selecciona un grupo</p>
            <p className="text-sm mt-1">
              Elige un grupo del desplegable para registrar la asistencia
            </p>
          </div>
        )}
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
    </div>
  )
}
