import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { isSameDay } from '@/lib/agenda-utils'

const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export interface EventsMiniCalendarProps {
  /** Cualquier fecha dentro del mes a mostrar. */
  month: Date
  /** Fechas (de cualquier dia del mes) que tienen al menos un evento activo. */
  eventDates: Date[]
  /** Total de eventos activos en el mes visible (puede haber varios el mismo dia). */
  eventsThisMonthCount: number
  /** Dia actualmente filtrado, o null si no hay filtro. */
  selectedDate: Date | null
  /** Se llama con la fecha pulsada, o null si se vuelve a pulsar el dia ya seleccionado (quitar filtro). */
  onSelectDate: (date: Date | null) => void
  onPreviousMonth: () => void
  onNextMonth: () => void
}

function getMonthGrid(month: Date): (Date | null)[] {
  const year = month.getFullYear()
  const m = month.getMonth()
  const firstDay = new Date(year, m, 1)
  const daysInMonth = new Date(year, m + 1, 0).getDate()
  // firstDay.getDay(): 0=Dom,...,6=Sab. La semana empieza en Lunes.
  const leadingBlanks = (firstDay.getDay() + 6) % 7
  const cells: (Date | null)[] = Array(leadingBlanks).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, m, d))
  }
  return cells
}

export function EventsMiniCalendar({
  month, eventDates, eventsThisMonthCount, selectedDate, onSelectDate, onPreviousMonth, onNextMonth,
}: EventsMiniCalendarProps) {
  const cells = getMonthGrid(month)
  const monthLabel = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(month)

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold capitalize">{monthLabel}</h3>
            <p className="text-xs text-muted-foreground">{eventsThisMonthCount} eventos</p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={onPreviousMonth}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={onNextMonth}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="text-[10px] font-medium text-muted-foreground py-1">{label}</div>
          ))}
          {cells.map((date, i) => {
            if (!date) return <div key={`blank-${i}`} />
            const hasEvent = eventDates.some((d) => isSameDay(d, date))
            const isSelected = selectedDate !== null && isSameDay(date, selectedDate)
            return (
              <button
                key={date.toISOString()}
                type="button"
                disabled={!hasEvent}
                onClick={() => onSelectDate(isSelected ? null : date)}
                className={`rounded-md py-1.5 text-xs transition-colors ${
                  isSelected
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : hasEvent
                    ? 'bg-primary/10 text-primary font-medium hover:bg-primary/20 cursor-pointer'
                    : 'text-muted-foreground cursor-default'
                }`}
              >
                {date.getDate()}
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
