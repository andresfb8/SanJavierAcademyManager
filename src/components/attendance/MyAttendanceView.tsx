import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/shared/EmptyState'
import { useEffectiveStudent } from '@/hooks/usePlayerData'
import { useAttendanceQuery } from '@/hooks/useQueries'
import { getMyAttendanceForMonth } from '@/lib/attendance-utils'
import { MONTHS } from '@/constants'
import { formatDate } from '@/lib/utils'
import { ClipboardCheck } from 'lucide-react'
import type { AttendanceStatus } from '@/types'

const currentYear = new Date().getFullYear()
const YEAR_OPTIONS = [currentYear - 1, currentYear, currentYear + 1].map((y) => ({
  value: String(y),
  label: String(y),
}))

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  presente: 'bg-green-100 text-green-700 border-green-300',
  ausente: 'bg-red-100 text-red-700 border-red-300',
  justificado: 'bg-yellow-100 text-yellow-700 border-yellow-300',
}

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  presente: 'Presente',
  ausente: 'Ausente',
  justificado: 'Justificado',
}

/**
 * Historial de asistencia de solo lectura para jugador/tutor. Muestra las
 * clases del alumno efectivo (hijo activo si es tutor) para el mes/año
 * seleccionados, sin acceso al editor de gestión de asistencia.
 */
export function MyAttendanceView() {
  const { studentId } = useEffectiveStudent()
  const { data: attendance = [] } = useAttendanceQuery()

  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())

  const rows = studentId
    ? getMyAttendanceForMonth(attendance, studentId, selectedMonth, selectedYear)
    : []

  const monthLabel = MONTHS.find((m) => m.value === selectedMonth)?.label ?? ''

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex gap-3">
        <Select
          options={MONTHS.map((m) => ({ value: String(m.value), label: m.label }))}
          value={String(selectedMonth)}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
          className="flex-1"
        />
        <Select
          options={YEAR_OPTIONS}
          value={String(selectedYear)}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="w-28"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Sin clases registradas"
          description={`No hay registro de asistencia en ${monthLabel} ${selectedYear}.`}
        />
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Card key={row.recordId}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{row.groupName}</p>
                  <p className="text-sm text-muted-foreground">{formatDate(row.date)}</p>
                </div>
                <span
                  className={`text-xs font-medium px-3 py-1.5 rounded-md border ${STATUS_STYLES[row.status]}`}
                >
                  {STATUS_LABELS[row.status]}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
