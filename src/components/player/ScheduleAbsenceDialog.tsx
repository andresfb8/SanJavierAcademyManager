import { useState, useMemo } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Group, AttendanceNotice } from '@/types'
import { CalendarDays, Info, HelpCircle, XCircle } from 'lucide-react'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

interface UpcomingClass {
  group: Group
  date: Date
  dateStr: string
  hoursUntil: number
  getsRecovery: boolean
}

function getUpcomingClasses(groups: Group[], daysAhead = 30): UpcomingClass[] {
  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const end = new Date(today)
  end.setDate(end.getDate() + daysAhead)

  const result: UpcomingClass[] = []
  for (const group of groups) {
    for (const slot of group.schedule) {
      const d = new Date(today)
      while (d <= end) {
        if (d.getDay() === slot.dayOfWeek) {
          const [h, m] = slot.startTime.split(':').map(Number)
          const classDateTime = new Date(d)
          classDateTime.setHours(h, m, 0, 0)
          if (classDateTime > now) {
            const hoursUntil = (classDateTime.getTime() - now.getTime()) / 3_600_000
            result.push({
              group,
              date: new Date(d),
              dateStr: d.toISOString().split('T')[0],
              hoursUntil,
              getsRecovery: hoursUntil >= 24,
            })
          }
        }
        d.setDate(d.getDate() + 1)
      }
    }
  }
  return result.sort((a, b) => a.date.getTime() - b.date.getTime())
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  myGroups: Group[]
  existingNotices: AttendanceNotice[]
  studentId: string
  playerName: string
  onAdd: (notice: Omit<AttendanceNotice, 'id' | 'createdAt'>) => void
  onDelete: (id: string) => void
}

export function ScheduleAbsenceDialog({
  open, onOpenChange, myGroups, existingNotices, studentId, playerName, onAdd, onDelete,
}: Props) {
  const [note, setNote] = useState('')
  const [selected, setSelected] = useState<UpcomingClass | null>(null)
  const [selectedType, setSelectedType] = useState<'absent' | 'uncertain'>('absent')

  const upcomingClasses = useMemo(() => getUpcomingClasses(myGroups, 30), [myGroups])

  const existingSet = useMemo(() => {
    const s = new Set<string>()
    existingNotices.forEach((n) => {
      if (n.playerId === studentId && n.type === 'absent') {
        s.add(`${n.groupId}__${new Date(n.date instanceof Date ? n.date : n.date).toISOString().split('T')[0]}`)
      }
    })
    return s
  }, [existingNotices, studentId])

  function getNoticeForClass(uc: UpcomingClass): AttendanceNotice | undefined {
    return existingNotices.find(
      (n) =>
        n.playerId === studentId &&
        (n.type === 'absent' || n.type === 'uncertain') &&
        n.groupId === uc.group.id &&
        new Date(n.date instanceof Date ? n.date : n.date).toISOString().split('T')[0] === uc.dateStr,
    )
  }

  function handleToggle(uc: UpcomingClass) {
    const existing = getNoticeForClass(uc)
    if (existing) {
      onDelete(existing.id)
    } else {
      setSelected(uc)
    }
  }

  function handleConfirm() {
    if (!selected) return
    onAdd({
      playerId: studentId,
      playerName,
      groupId: selected.group.id,
      date: selected.date,
      type: selectedType,
      notes: note.trim() || undefined,
    })
    setSelected(null)
    setNote('')
    setSelectedType('absent')
  }

  function handleClose() {
    setSelected(null)
    setNote('')
    onOpenChange(false)
  }

  const formatDayDate = (date: Date) => {
    const day = DAYS[date.getDay()]
    const d = String(date.getDate()).padStart(2, '0')
    const m = String(date.getMonth() + 1).padStart(2, '0')
    return `${day} ${d}/${m}`
  }

  if (selected) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar ausencia</DialogTitle>
            <DialogDescription>
              {selected.group.name} · {formatDayDate(selected.date)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Selección de tipo */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedType('absent')}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center transition-all',
                  selectedType === 'absent'
                    ? 'border-rose-400 bg-rose-50 text-rose-700'
                    : 'border-slate-200 hover:border-slate-300 text-slate-500'
                )}
              >
                <XCircle className="h-5 w-5" />
                <span className="text-xs font-semibold">No asisto</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedType('uncertain')}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center transition-all',
                  selectedType === 'uncertain'
                    ? 'border-amber-400 bg-amber-50 text-amber-700'
                    : 'border-slate-200 hover:border-slate-300 text-slate-500'
                )}
              >
                <HelpCircle className="h-5 w-5" />
                <span className="text-xs font-semibold">En duda</span>
              </button>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-500">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Tu entrenador recibirá este aviso para organizar la clase.</span>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nota para tu entrenador (opcional)</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                rows={2}
                placeholder="Ej: Tengo un compromiso familiar..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setSelected(null); setSelectedType('absent') }}>Atrás</Button>
            <Button onClick={handleConfirm}>Confirmar aviso</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Mis avisos de asistencia</DialogTitle>
          <DialogDescription>
            Toca una clase para enviar un aviso. Toca de nuevo para cancelarlo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto py-1 pr-1">
          {upcomingClasses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No tienes clases programadas en los próximos 30 días.
            </p>
          ) : (
            upcomingClasses.map((uc) => {
              const existingNotice = getNoticeForClass(uc)
              const hasNotice = !!existingNotice
              const isUncertain = existingNotice?.type === 'uncertain'
              return (
                <button
                  key={`${uc.group.id}-${uc.dateStr}`}
                  onClick={() => handleToggle(uc)}
                  className={cn(
                    'w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all',
                    isUncertain
                      ? 'bg-amber-50 border-amber-200 hover:bg-amber-100'
                      : hasNotice
                      ? 'bg-red-50 border-red-200 hover:bg-red-100'
                      : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-black',
                      isUncertain ? 'bg-amber-100 text-amber-500' : hasNotice ? 'bg-red-100 text-red-500' : 'bg-slate-100 text-slate-400',
                    )}>
                      <CalendarDays className="h-4 w-4" />
                    </div>
                    <div>
                      <p className={cn('text-sm font-bold leading-tight', isUncertain ? 'text-amber-700' : hasNotice ? 'text-red-700' : 'text-slate-800')}>
                        {uc.group.name}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {formatDayDate(uc.date)} · {uc.group.schedule.find(s => s.dayOfWeek === uc.date.getDay())?.startTime}
                      </p>
                    </div>
                  </div>
                  {isUncertain ? (
                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 shrink-0">En duda</Badge>
                  ) : hasNotice ? (
                    <Badge variant="destructive" className="text-[10px] shrink-0">No asisto</Badge>
                  ) : null}
                </button>
              )
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} className="w-full">Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
