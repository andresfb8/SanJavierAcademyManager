import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react'
import { isSessionHappeningNow, type DaySession } from '@/lib/attendance-utils'
import { isSameDay } from '@/lib/agenda-utils'

export interface DaySessionListProps {
  sessions: DaySession[]
  /** Fecha seleccionada, formato 'YYYY-MM-DD'. */
  selectedDate: string
  selectedGroupId: string
  dayAverageAttendance: number | null
  closedSessionsCount: number
  onSelectGroup: (groupId: string) => void
  onSelectPrivate: (privateLessonId: string) => void
  onPreviousDay: () => void
  onNextDay: () => void
  onDateChange: (value: string) => void
}

export function DaySessionList({
  sessions, selectedDate, selectedGroupId, dayAverageAttendance, closedSessionsCount,
  onSelectGroup, onSelectPrivate, onPreviousDay, onNextDay, onDateChange,
}: DaySessionListProps) {
  const isToday = isSameDay(new Date(selectedDate + 'T00:00:00'), new Date())
  const groupSessionsCount = sessions.filter((s) => s.type === 'group').length

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="icon" onClick={onPreviousDay}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              className="h-9 w-[150px] text-sm text-center cursor-pointer"
              value={selectedDate}
              onChange={(e) => { if (e.target.value) onDateChange(e.target.value) }}
            />
            <Button variant="outline" size="icon" onClick={onNextDay}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 px-4">
              No hay sesiones este día.
            </p>
          ) : (
            <div className="divide-y">
              {sessions.map((session) => {
                if (session.type === 'private') {
                  return (
                    <button
                      key={`private-${session.id}`}
                      type="button"
                      onClick={() => onSelectPrivate(session.id)}
                      className="w-full text-left px-4 py-3 hover:bg-accent/30 transition-colors"
                    >
                      <p className="text-sm font-medium truncate">{session.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {session.startTime} · {session.coachName}
                      </p>
                    </button>
                  )
                }

                const isSelected = session.id === selectedGroupId
                const isNow = isToday && !session.hasRecord && isSessionHappeningNow(session.startTime, session.endTime)

                return (
                  <button
                    key={`group-${session.id}`}
                    type="button"
                    onClick={() => onSelectGroup(session.id)}
                    className={`w-full text-left px-4 py-3 transition-colors ${isSelected ? 'bg-primary/10' : 'hover:bg-accent/30'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{session.name}</p>
                      {session.hasRecord ? (
                        <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                      ) : isNow ? (
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-none shrink-0">Ahora</Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground shrink-0">Pendiente</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {session.startTime} · {session.coachName}
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
        {groupSessionsCount > 0 && (
          <div className="border-t px-4 py-3 grid grid-cols-2 gap-2 text-center">
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Asist. media</p>
              <p className="text-lg font-black">
                {dayAverageAttendance === null ? 'Sin datos' : `${dayAverageAttendance}%`}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Cerradas</p>
              <p className="text-lg font-black">{closedSessionsCount}/{sessions.length}</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
