import { Card, CardContent } from '@/components/ui/card'
import { Clock } from 'lucide-react'
import type { Court } from '@/types'
import { START_HOUR, END_HOUR, LEVEL_COLORS, type GridBlock } from '@/lib/agenda-utils'

const ENTRY_HEIGHT = 22
const MIN_ROW_HEIGHT = 32

interface WeekCellEntry {
  courtOrder: number
  courtName: string
  block: GridBlock
}

function getWeekCellEntries(
  blocksByCourt: Record<string, GridBlock[]>,
  courts: Court[],
  hourSlotIdx: number
): WeekCellEntry[] {
  const entries: WeekCellEntry[] = []
  courts.forEach((court, i) => {
    const blocks = blocksByCourt[court.id] ?? []
    const block = blocks.find((b) => b.startSlot === hourSlotIdx)
    if (block) entries.push({ courtOrder: i + 1, courtName: court.name, block })
  })
  return entries
}

function getBlockClasses(block: GridBlock): string {
  if (block.type === 'group') {
    const colors = LEVEL_COLORS[block.level ?? ''] ?? LEVEL_COLORS.iniciacion
    return `${colors.bg} ${colors.text} border ${colors.border}`
  }
  if (block.type === 'private') return 'bg-amber-50 text-amber-800 border border-amber-300'
  return 'bg-teal-50 text-teal-800 border border-teal-400'
}

function getBlockLabel(block: GridBlock): string {
  if (block.type === 'group') return block.groupName ?? ''
  if (block.type === 'private') return `Particular${block.playerNames?.[0] ? ': ' + block.playerNames[0] : ''}`
  return block.eventName ?? ''
}

const DAY_HEADER_FORMAT = new Intl.DateTimeFormat('es-ES', { weekday: 'short' })

export interface WeekGridProps {
  /** 6 fechas, Lunes a Sábado, en orden. */
  weekDays: Date[]
  /** Pistas a mostrar (ya filtradas por el filtro de Pista si corresponde), en orden estable. */
  activeCourts: Court[]
  /** Un elemento por cada fecha de `weekDays`, en el mismo orden. */
  blocksByCourtByDay: Record<string, GridBlock[]>[]
  /** Se llama al hacer clic en cualquier bloque o cabecera de dia. */
  onSelectDay: (date: Date) => void
}

export function WeekGrid({ weekDays, activeCourts, blocksByCourtByDay, onSelectDay }: WeekGridProps) {
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

  if (activeCourts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No hay pistas activas configuradas.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <div className="grid min-w-[700px]" style={{ gridTemplateColumns: '70px repeat(6, 1fr)' }}>
            <div className="sticky top-0 z-10 border-b border-r bg-muted/50 px-2 py-3 text-xs font-medium text-muted-foreground flex items-center justify-center">
              <Clock className="h-3.5 w-3.5" />
            </div>
            {weekDays.map((day) => (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => onSelectDay(day)}
                className="sticky top-0 z-10 border-b border-l px-2 py-3 text-center hover:bg-muted/70 transition-colors cursor-pointer"
              >
                <p className="text-xs font-semibold uppercase text-muted-foreground">{DAY_HEADER_FORMAT.format(day)}</p>
                <p className="text-sm font-bold">{day.getDate()}</p>
              </button>
            ))}

            {hours.map((h) => {
              const hourSlotIdx = (h - START_HOUR) * 2
              const entriesPerDay = weekDays.map((_, dayIdx) =>
                getWeekCellEntries(blocksByCourtByDay[dayIdx], activeCourts, hourSlotIdx)
              )
              const maxEntries = Math.max(1, ...entriesPerDay.map((e) => e.length))
              const rowHeight = Math.max(MIN_ROW_HEIGHT, maxEntries * ENTRY_HEIGHT + 8)

              return (
                <div key={`row-${h}`} className="contents">
                  <div
                    className="border-t border-r px-2 flex items-start justify-end pt-1 text-xs font-mono text-muted-foreground"
                    style={{ height: rowHeight }}
                  >
                    {String(h).padStart(2, '0')}:00
                  </div>
                  {weekDays.map((day, dayIdx) => {
                    const entries = entriesPerDay[dayIdx]
                    return (
                      <div
                        key={`${day.toISOString()}-${h}`}
                        className="border-t border-l px-1 py-1 space-y-0.5 hover:bg-muted/20 cursor-pointer transition-colors"
                        style={{ height: rowHeight }}
                        onClick={() => onSelectDay(day)}
                      >
                        {entries.map(({ courtOrder, courtName, block }) => (
                          <div
                            key={`${block.type}-${block.id}`}
                            title={courtName}
                            className={`rounded px-1 text-[10px] leading-tight truncate ${getBlockClasses(block)}`}
                            style={{ height: ENTRY_HEIGHT - 2 }}
                          >
                            <span className="font-semibold">P{courtOrder}</span> {getBlockLabel(block)}
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
