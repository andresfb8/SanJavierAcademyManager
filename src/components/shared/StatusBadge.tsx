import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  colorMap?: Record<string, string>
  className?: string
}

// Each entry: "dot-color bg text-color"
// Each entry: "dot-color bg text-color"
const defaultColorMap: Record<string, { dot: string; badge: string }> = {
  activo: { dot: 'bg-emerald-500', badge: 'bg-emerald-50/50 text-emerald-700 ring-emerald-600/10' },
  lista_espera: { dot: 'bg-amber-500', badge: 'bg-amber-50/50 text-amber-700 ring-amber-600/10' },
  baja: { dot: 'bg-rose-500', badge: 'bg-rose-50/50 text-rose-700 ring-rose-600/10' },
  presente: { dot: 'bg-emerald-500', badge: 'bg-emerald-50/50 text-emerald-700 ring-emerald-600/10' },
  ausente: { dot: 'bg-rose-500', badge: 'bg-rose-50/50 text-rose-700 ring-rose-600/10' },
  justificado: { dot: 'bg-amber-500', badge: 'bg-amber-50/50 text-amber-700 ring-amber-600/10' },
  pendiente: { dot: 'bg-amber-500', badge: 'bg-amber-50/50 text-amber-700 ring-amber-600/10' },
  pagado: { dot: 'bg-emerald-500', badge: 'bg-emerald-50/50 text-emerald-700 ring-emerald-600/10' },
  cancelado: { dot: 'bg-slate-400', badge: 'bg-slate-50/50 text-slate-600 ring-slate-600/10' },
  iniciacion: { dot: 'bg-emerald-500', badge: 'bg-emerald-50/50 text-emerald-700 ring-emerald-600/10' },
  intermedio: { dot: 'bg-cyan-500', badge: 'bg-cyan-50/50 text-cyan-700 ring-cyan-600/10' },
  avanzado: { dot: 'bg-indigo-500', badge: 'bg-indigo-50/50 text-indigo-700 ring-indigo-600/10' },
  competicion: { dot: 'bg-rose-500', badge: 'bg-rose-50/50 text-rose-700 ring-rose-600/10' },
  menores: { dot: 'bg-amber-500', badge: 'bg-amber-50/50 text-amber-700 ring-amber-600/10' },
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
}

const fallback = { dot: 'bg-slate-400', badge: 'bg-slate-50 text-slate-600 ring-slate-200' }

export function StatusBadge({ status, colorMap, className }: StatusBadgeProps) {
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
  const label = labelMap[status] || status

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        styles.badge,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', styles.dot)} />
      {label}
    </span>
  )
}
