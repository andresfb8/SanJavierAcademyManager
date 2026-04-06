// ==========================================
// AttendanceQuickDialog Component
// ==========================================
// Modal rápido para gestionar asistencia desde la Agenda
// sin necesidad de navegar a ClassDetailPage

import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, ExternalLink, Users } from 'lucide-react'
import { AttendanceStatusButtons } from './AttendanceStatusButtons'
import { useDataStore } from '@/stores/dataStore'
import type { AttendanceEntry, AttendanceStatus } from '@/types'

function toISODate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date)
  if (isNaN(d.getTime())) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

interface AttendanceQuickDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groupId: string
  groupName: string
  date: string // YYYY-MM-DD format
  onNavigateToDetail?: () => void
}

import { useAttendanceQuery } from '@/hooks/useQueries'

export function AttendanceQuickDialog({
  open,
  onOpenChange,
  groupId,
  groupName,
  date,
  onNavigateToDetail,
}: AttendanceQuickDialogProps) {
  const { groups, enrollments, players, addAttendanceRecord, updateAttendanceRecord } = useDataStore()
  const { data: attendance = [] } = useAttendanceQuery(groupId)

  const [entries, setEntries] = useState<AttendanceEntry[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  // Obtener el grupo
  const group = useMemo(() => groups.find(g => g.id === groupId), [groups, groupId])

  // Obtener jugadores inscritos en este grupo
  const enrolledPlayers = useMemo(() => {
    const activeEnrollments = enrollments.filter(
      e => e.groupId === groupId && e.isActive
    )
    return activeEnrollments
      .map(enrollment => {
        const player = players.find(p => p.id === enrollment.playerId)
        return player ? {
          id: player.id,
          name: `${player.firstName} ${player.lastName}`,
        } : null
      })
      .filter(Boolean) as Array<{ id: string; name: string }>
  }, [enrollments, groupId, players])

  // Buscar attendance record existente para esta fecha
  const existingAttendance = useMemo(() => {
    return attendance.find(a => {
      const d = toISODate(a.date)
      return a.groupId === groupId && d === date
    })
  }, [attendance, groupId, date])

  // Inicializar entries cuando se abre el diálogo
  useEffect(() => {
    if (open) {
      setError('')
      if (existingAttendance) {
        // Cargar attendance existente
        setEntries(existingAttendance.records)
      } else {
        // Inicializar con jugadores inscritos como "presente"
        const initialEntries: AttendanceEntry[] = enrolledPlayers.map(player => ({
          playerId: player.id,
          playerName: player.name,
          status: 'presente' as AttendanceStatus,
          isRecovery: false,
          notes: '',
        }))
        setEntries(initialEntries)
      }
    }
  }, [open, existingAttendance, enrolledPlayers])

  // Handler para cambiar status de un jugador
  const handleStatusChange = (playerId: string, status: AttendanceStatus) => {
    setEntries(prev =>
      prev.map(entry =>
        entry.playerId === playerId ? { ...entry, status } : entry
      )
    )
  }

  // Handler para cambiar notas de un jugador
  const handleNotesChange = (playerId: string, notes: string) => {
    setEntries(prev =>
      prev.map(entry =>
        entry.playerId === playerId ? { ...entry, notes } : entry
      )
    )
  }

  // Calcular resumen de asistencia
  const stats = useMemo(() => {
    return {
      present: entries.filter(e => e.status === 'presente').length,
      absent: entries.filter(e => e.status === 'ausente').length,
      justified: entries.filter(e => e.status === 'justificado').length,
    }
  }, [entries])

  // Guardar asistencia
  const handleSave = async () => {
    if (!group) {
      setError('No se encontró el grupo')
      return
    }

    if (entries.length === 0) {
      setError('No hay jugadores para registrar')
      return
    }

    setIsSaving(true)
    setError('')

    try {
      if (existingAttendance) {
        // Actualizar record existente
        await updateAttendanceRecord(existingAttendance.id, {
          records: entries,
        })
      } else {
        // Crear nuevo record
        await addAttendanceRecord({
          groupId,
          groupName,
          date: new Date(date + 'T00:00:00'),
          records: entries,
          coachId: group.coachId,
        })
      }

      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar asistencia')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Asistencia: {groupName}
          </DialogTitle>
          <DialogDescription>
            {new Date(date + 'T00:00:00').toLocaleDateString('es-ES', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
            {group && ` • ${group.coachName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info */}
          {enrolledPlayers.length > 0 && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-sm text-muted-foreground">
                {enrolledPlayers.length} jugador{enrolledPlayers.length !== 1 ? 'es' : ''} inscrito{enrolledPlayers.length !== 1 ? 's' : ''} en este grupo
              </p>
            </div>
          )}

          {/* Lista de jugadores */}
          {entries.length > 0 ? (
            <div className="space-y-3">
              {entries.map((entry) => (
                <div
                  key={entry.playerId}
                  className="rounded-lg border p-3 space-y-2 bg-card"
                >
                  {/* Nombre y badge de recuperación */}
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{entry.playerName}</p>
                    {entry.isRecovery && (
                      <Badge variant="secondary" className="text-xs">
                        Recuperación
                      </Badge>
                    )}
                  </div>

                  {/* Botones de estado */}
                  <AttendanceStatusButtons
                    currentStatus={entry.status}
                    onStatusChange={(status) => handleStatusChange(entry.playerId, status)}
                    size="sm"
                  />

                  {/* Notas */}
                  <Input
                    placeholder="Notas (opcional)..."
                    value={entry.notes || ''}
                    onChange={(e) => handleNotesChange(entry.playerId, e.target.value)}
                    className="text-sm"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              <p>No hay jugadores inscritos en este grupo</p>
            </div>
          )}

          {/* Resumen */}
          {entries.length > 0 && (
            <div className="rounded-lg bg-muted/50 p-3 flex items-center gap-4">
              <p className="text-sm font-medium">Resumen:</p>
              <div className="flex gap-3 text-sm">
                <span className="text-green-600 font-medium">{stats.present}P</span>
                <span className="text-red-600 font-medium">{stats.absent}A</span>
                <span className="text-yellow-600 font-medium">{stats.justified}J</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>

          {onNavigateToDetail && (
            <Button
              type="button"
              variant="outline"
              onClick={onNavigateToDetail}
              disabled={isSaving}
              className="gap-2"
            >
              Ver detalles <ExternalLink className="h-4 w-4" />
            </Button>
          )}

          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || entries.length === 0}
          >
            {isSaving ? 'Guardando...' : existingAttendance ? 'Actualizar' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
