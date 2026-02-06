import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  colorMap?: Record<string, string>
  className?: string
}

const defaultColorMap: Record<string, string> = {
  activo: 'bg-green-100 text-green-800',
  lista_espera: 'bg-yellow-100 text-yellow-800',
  baja: 'bg-red-100 text-red-800',
  presente: 'bg-green-100 text-green-800',
  ausente: 'bg-red-100 text-red-800',
  justificado: 'bg-yellow-100 text-yellow-800',
  pendiente: 'bg-yellow-100 text-yellow-800',
  pagado: 'bg-green-100 text-green-800',
  cancelado: 'bg-gray-100 text-gray-800',
  iniciacion: 'bg-green-100 text-green-800',
  intermedio: 'bg-blue-100 text-blue-800',
  avanzado: 'bg-purple-100 text-purple-800',
  competicion: 'bg-red-100 text-red-800',
  menores: 'bg-yellow-100 text-yellow-800',
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

export function StatusBadge({ status, colorMap, className }: StatusBadgeProps) {
  const colors = colorMap || defaultColorMap
  const colorClass = colors[status] || 'bg-gray-100 text-gray-800'
  const label = labelMap[status] || status

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        colorClass,
        className
      )}
    >
      {label}
    </span>
  )
}
