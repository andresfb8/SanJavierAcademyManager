// ==========================================
// AttendanceStatusButtons Component
// ==========================================
// Botones reutilizables para cambiar el estado de asistencia
// Extraído de AttendancePage para consistencia en toda la app

import { CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import type { AttendanceStatus } from '@/types'

interface AttendanceStatusButtonsProps {
  currentStatus: AttendanceStatus
  onStatusChange: (status: AttendanceStatus) => void
  size?: 'sm' | 'md'
  disabled?: boolean
}

export function AttendanceStatusButtons({
  currentStatus,
  onStatusChange,
  size = 'md',
  disabled = false,
}: AttendanceStatusButtonsProps) {
  const isSmall = size === 'sm'

  const baseClasses = `
    flex items-center gap-1 sm:gap-1.5
    ${isSmall ? 'px-2 py-1' : 'px-2 sm:px-3 py-1.5'}
    rounded-md text-xs font-medium transition-colors border
  `

  return (
    <div className="flex gap-1.5 sm:gap-2 flex-wrap">
      {/* Presente */}
      <button
        type="button"
        onClick={() => onStatusChange('presente')}
        disabled={disabled}
        className={`${baseClasses} ${
          currentStatus === 'presente'
            ? 'bg-green-100 text-green-700 border-green-300 shadow-sm'
            : 'bg-background text-muted-foreground border-border hover:bg-green-50 hover:text-green-600'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <CheckCircle className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Presente</span>
      </button>

      {/* Ausente */}
      <button
        type="button"
        onClick={() => onStatusChange('ausente')}
        disabled={disabled}
        className={`${baseClasses} ${
          currentStatus === 'ausente'
            ? 'bg-red-100 text-red-700 border-red-300 shadow-sm'
            : 'bg-background text-muted-foreground border-border hover:bg-red-50 hover:text-red-600'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <XCircle className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Ausente</span>
      </button>

      {/* Justificado */}
      <button
        type="button"
        onClick={() => onStatusChange('justificado')}
        disabled={disabled}
        className={`${baseClasses} ${
          currentStatus === 'justificado'
            ? 'bg-yellow-100 text-yellow-700 border-yellow-300 shadow-sm'
            : 'bg-background text-muted-foreground border-border hover:bg-yellow-50 hover:text-yellow-600'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <AlertCircle className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Justificado</span>
      </button>
    </div>
  )
}
