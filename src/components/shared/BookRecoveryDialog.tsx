import { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SearchableSelect } from '@/components/shared/SearchableSelect'
import { useDataStore } from '@/stores/dataStore'
import { toast } from '@/hooks/use-toast'
import { RefreshCw, Info } from 'lucide-react'
import type { AttendanceRecord } from '@/types'

interface SlotInfo {
  groupId: string
  groupName: string
  coachId: string
  date: Date
}

interface BookRecoveryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  slot: SlotInfo | null
  /** Registro de asistencia ya existente para ese grupo+fecha, si lo hay. */
  existingRecord?: AttendanceRecord
}

/**
 * Reserva una recuperación (admin/entrenador) en un hueco libre: elige un jugador
 * con crédito, no matriculado en el grupo ni ya presente en la clase.
 */
export function BookRecoveryDialog({ open, onOpenChange, slot, existingRecord }: BookRecoveryDialogProps) {
  const { players, enrollments, bookRecovery } = useDataStore()
  const [selectedId, setSelectedId] = useState('')

  const eligiblePlayers = useMemo(() => {
    if (!slot) return []
    const enrolledIds = new Set(
      enrollments.filter((e) => e.groupId === slot.groupId && e.isActive).map((e) => e.playerId)
    )
    const inRecord = new Set(existingRecord?.records.map((r) => r.playerId) ?? [])
    return players
      .filter(
        (p) =>
          p.status === 'activo' &&
          (p.recoveryCredits || 0) > 0 &&
          !enrolledIds.has(p.id) &&
          !inRecord.has(p.id)
      )
      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
  }, [players, enrollments, slot, existingRecord])

  const options = useMemo(
    () =>
      eligiblePlayers.map((p) => ({
        value: p.id,
        label: `${p.firstName} ${p.lastName} · ${p.recoveryCredits} crédito${p.recoveryCredits !== 1 ? 's' : ''}`,
      })),
    [eligiblePlayers]
  )

  function handleClose() {
    setSelectedId('')
    onOpenChange(false)
  }

  function handleConfirm() {
    if (!slot || !selectedId) return
    const player = players.find((p) => p.id === selectedId)
    if (!player) return

    bookRecovery({
      groupId: slot.groupId,
      groupName: slot.groupName,
      date: slot.date,
      coachId: slot.coachId,
      player: {
        id: player.id,
        firstName: player.firstName,
        lastName: player.lastName,
        recoveryCredits: player.recoveryCredits || 0,
      },
      existingRecord,
    })
    toast.success(`${player.firstName} ${player.lastName} reservado para recuperar en ${slot.groupName}`)
    handleClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-blue-600" />
            Reservar recuperación
          </DialogTitle>
          <DialogDescription>
            {slot ? `${slot.groupName} · ${slot.date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {eligiblePlayers.length === 0 ? (
            <div className="flex items-start gap-2 rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm text-slate-500">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <span>No hay jugadores con créditos de recuperación disponibles para este hueco.</span>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Jugador a recuperar</label>
                <SearchableSelect
                  options={options}
                  value={selectedId}
                  onChange={setSelectedId}
                  placeholder="Selecciona un jugador con crédito..."
                  searchPlaceholder="Buscar jugador..."
                />
              </div>
              <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Se marcará al jugador como presente por recuperación y se descontará 1 crédito.</span>
              </div>
              <div>
                <Badge variant="secondary" className="text-[11px]">
                  {eligiblePlayers.length} jugador{eligiblePlayers.length !== 1 ? 'es' : ''} elegible{eligiblePlayers.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!selectedId}>
            Reservar recuperación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
