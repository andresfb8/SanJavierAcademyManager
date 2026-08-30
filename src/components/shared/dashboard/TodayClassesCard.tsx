import { useNavigate } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export interface TodayClassRow {
  id: string
  time: string
  name: string
  meta: string
  attendanceLabel: string
}

interface TodayClassesCardProps {
  rows: TodayClassRow[]
}

export function TodayClassesCard({ rows }: TodayClassesCardProps) {
  const navigate = useNavigate()

  return (
    <Card className="overflow-hidden rounded-[2rem] border-none bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between px-6 pb-3 pt-6">
        <CardTitle className="text-sm font-bold text-foreground">Clases de hoy</CardTitle>
        <button
          onClick={() => navigate('/agenda')}
          className="text-xs font-medium text-primary hover:underline"
        >
          Ver agenda
        </button>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {rows.length === 0 ? (
          <div className="py-8 text-center">
            <CalendarDays className="mx-auto mb-2 h-8 w-8 text-slate-200" />
            <p className="text-sm font-medium text-slate-400">Libre hoy</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.id} className="flex items-center gap-4 rounded-2xl bg-slate-50/30 p-3">
                <div className="w-12 shrink-0 text-center">
                  <span className="text-xs font-black text-slate-500">{row.time}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm font-bold text-slate-700">{row.name}</h4>
                  <p className="truncate text-[11px] font-medium text-slate-400">{row.meta}</p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-slate-500">{row.attendanceLabel}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
