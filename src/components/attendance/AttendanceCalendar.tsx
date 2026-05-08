/**
 * src/components/attendance/AttendanceCalendar.tsx
 *
 * Calendario mensual con 3 estados por día:
 *   🟢 Verde  — hay clase programada Y ya existe registro de asistencia
 *   🟠 Naranja — hay clase programada PERO no hay registro (pendiente)
 *   ⬜ Gris   — no hay clase ese día según el schedule del grupo
 */
import { useState, useMemo } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAttendanceQuery } from '@/hooks/useQueries'
import type { Group } from '@/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function toISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

type DayStatus = 'no_class' | 'pending' | 'recorded'

interface DayInfo {
  date: Date
  iso: string
  status: DayStatus
  isCurrentMonth: boolean
  isToday: boolean
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface AttendanceCalendarProps {
  group: Group
  onDayClick: (date: string, status: DayStatus) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AttendanceCalendar({ group, onDayClick }: AttendanceCalendarProps) {
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })

  const { data: attendance = [] } = useAttendanceQuery()

  // Registros de asistencia de este grupo (set de fechas ISO)
  const recordedDates = useMemo(() => {
    const s = new Set<string>()
    attendance
      .filter((a) => a.groupId === group.id)
      .forEach((a) => s.add(toISODate(a.date instanceof Date ? a.date : new Date(a.date))))
    return s
  }, [attendance, group.id])

  // Schedule: días de la semana con clase (ISO: 1=lunes…7=domingo)
  const scheduleDays = useMemo(
    () => new Set(group.schedule.map((s) => s.dayOfWeek)),
    [group.schedule]
  )

  const todayISO = toISODate(new Date())

  // Build calendar grid (6 weeks × 7 days)
  const days = useMemo<DayInfo[]>(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()

    const firstDay = new Date(year, month, 1)
    // Adjust to Monday-start: 0=Mon … 6=Sun
    let startOffset = firstDay.getDay() - 1
    if (startOffset < 0) startOffset = 6

    const result: DayInfo[] = []
    const start = new Date(firstDay)
    start.setDate(start.getDate() - startOffset)

    for (let i = 0; i < 42; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const iso = toISODate(d)
      const isCurrentMonth = d.getMonth() === month
      const isToday = iso === todayISO

      // dayOfWeek as ISO (1=Mon…7=Sun)
      const dow = d.getDay() || 7
      const hasClass = scheduleDays.has(dow)
      const hasRecord = recordedDates.has(iso)

      let status: DayStatus
      if (!hasClass) {
        status = 'no_class'
      } else if (hasRecord) {
        status = 'recorded'
      } else {
        status = 'pending'
      }

      result.push({ date: d, iso, status, isCurrentMonth, isToday })
    }
    return result
  }, [viewDate, scheduleDays, recordedDates, todayISO])

  const navigateMonth = (delta: number) => {
    setViewDate((prev) => {
      const d = new Date(prev)
      d.setMonth(d.getMonth() + delta)
      return d
    })
  }

  const monthLabel = viewDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  const weekDayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

  // Legend counts for this month
  const currentMonthDays = days.filter((d) => d.isCurrentMonth)
  const pendingCount = currentMonthDays.filter((d) => d.status === 'pending').length
  const recordedCount = currentMonthDays.filter((d) => d.status === 'recorded').length

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <button
          onClick={() => navigateMonth(-1)}
          className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-slate-600" />
        </button>
        <span className="text-sm font-black text-slate-800 capitalize">{monthLabel}</span>
        <button
          onClick={() => navigateMonth(1)}
          className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
        >
          <ChevronRight className="h-4 w-4 text-slate-600" />
        </button>
      </div>

      {/* Week day headers */}
      <div className="grid grid-cols-7 border-b border-slate-50">
        {weekDayLabels.map((label) => (
          <div
            key={label}
            className="py-2 text-center text-[10px] font-black text-slate-400 uppercase tracking-wider"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const isClickable = day.status !== 'no_class' && day.isCurrentMonth
          const isFuture = day.iso > todayISO

          return (
            <button
              key={day.iso}
              disabled={!isClickable || isFuture}
              onClick={() => onDayClick(day.iso, day.status)}
              className={cn(
                'aspect-square flex flex-col items-center justify-center relative transition-all',
                !day.isCurrentMonth && 'opacity-25',
                isClickable && !isFuture && 'cursor-pointer hover:scale-105',
                !isClickable || isFuture ? 'cursor-default' : '',
                day.isToday && 'ring-2 ring-primary ring-inset rounded-xl'
              )}
            >
              {/* Status dot */}
              {day.status !== 'no_class' && day.isCurrentMonth && (
                <div
                  className={cn(
                    'absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full',
                    day.status === 'recorded'
                      ? 'bg-emerald-500'
                      : isFuture
                      ? 'bg-slate-300'
                      : 'bg-orange-400'
                  )}
                />
              )}

              {/* Day number */}
              <span
                className={cn(
                  'text-[13px] font-bold',
                  !day.isCurrentMonth && 'text-slate-300',
                  day.isCurrentMonth && day.status === 'recorded' && 'text-emerald-700',
                  day.isCurrentMonth && day.status === 'pending' && !isFuture && 'text-orange-600',
                  day.isCurrentMonth && day.status === 'no_class' && 'text-slate-400',
                  day.isToday && 'text-primary font-black'
                )}
              >
                {day.date.getDate()}
              </span>

              {/* Status icon for class days */}
              {day.isCurrentMonth && day.status !== 'no_class' && (
                <span className="text-[8px] font-black mt-0.5">
                  {day.status === 'recorded' ? (
                    <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
                  ) : !isFuture ? (
                    <AlertCircle className="h-2.5 w-2.5 text-orange-400" />
                  ) : null}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 px-5 py-3 border-t border-slate-50 bg-slate-50/60">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="text-[11px] font-semibold text-slate-500">
            Registrada ({recordedCount})
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-orange-400" />
          <span className="text-[11px] font-semibold text-slate-500">
            Pendiente ({pendingCount})
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="text-[11px] font-semibold text-slate-500">Sin clase</span>
        </div>
      </div>
    </div>
  )
}
