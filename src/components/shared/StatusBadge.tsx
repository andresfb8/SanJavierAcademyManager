import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  colorMap?: Record<string, string>
  className?: string
  label?: string
}

// Each entry: "dot-color bg text-color"
// Each entry: "dot-color bg text-color"
const defaultColorMap: Record<string, { dot: string; badge: string }> = {
  activo: { dot: 'bg-green-500', badge: 'bg-green-100 text-green-800 ring-green-600/10' },
  lista_espera: { dot: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-800 ring-yellow-600/10' },
  baja: { dot: 'bg-red-500', badge: 'bg-red-100 text-red-800 ring-red-600/10' },
  presente: { dot: 'bg-green-500', badge: 'bg-green-100 text-green-800 ring-green-600/10' },
  ausente: { dot: 'bg-red-500', badge: 'bg-red-100 text-red-800 ring-red-600/10' },
  justificado: { dot: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-800 ring-yellow-600/10' },
  pendiente: { dot: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-800 ring-yellow-600/10' },
  pagado: { dot: 'bg-green-500', badge: 'bg-green-100 text-green-800 ring-green-600/10' },
  cancelado: { dot: 'bg-red-500', badge: 'bg-red-100 text-red-800 ring-red-600/10' },
  iniciacion: { dot: 'bg-green-500', badge: 'bg-green-100 text-green-800 ring-green-600/10' },
  intermedio: { dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-800 ring-blue-600/10' },
  avanzado: { dot: 'bg-indigo-500', badge: 'bg-indigo-100 text-indigo-800 ring-indigo-600/10' },
  competicion: { dot: 'bg-red-500', badge: 'bg-red-100 text-red-800 ring-red-600/10' },
  menores: { dot: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-800 ring-yellow-600/10' },
  al_dia: { dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-800 ring-emerald-600/10' },
  vencido: { dot: 'bg-red-500', badge: 'bg-red-100 text-red-800 ring-red-600/10' },
}

const labelMap: Record<string, string> = {
  activo: 'Activo',
  lista_espera: 'Lista de espera',
  baja: 'Baja',
  presente: 'Presente',
  ausente: 'Ausente',
  justificado: 'Justificado',
  pendiente: 'Pendiente',
  pagado: 'Pagado',
  cancelado: 'Cancelado',
  iniciacion: 'Iniciación',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
  competicion: 'Competición',
  menores: 'Menores',
  al_dia: 'Al día',
  vencido: 'Vencido',
}

const fallback = { dot: 'bg-slate-400', badge: 'bg-slate-50 text-slate-600 ring-slate-200' }

export function StatusBadge({ status, colorMap, className, label }: StatusBadgeProps) {
  // colorMap prop stays backward-compatible: if plain string map passed, render legacy style
  if (colorMap) {
    const colorClass = colorMap[status] || 'bg-gray-100 text-gray-800'
    const label = labelMap[status] || status
    return (
      <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', colorClass, className)}>
        {label}
      </span>
    )
  }

  const styles = defaultColorMap[status] || fallback
  const resolvedLabel = label ?? labelMap[status] ?? status

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        styles.badge,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', styles.dot)} />
      {resolvedLabel}
    </span>
  )
}
