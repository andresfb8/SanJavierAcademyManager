import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { useEffectiveStudent } from '@/hooks/usePlayerData'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'

/**
 * Selector de hijo activo para cuentas de tutor.
 * Solo se renderiza cuando el rol activo es 'tutor'; con un único hijo
 * muestra el nombre sin desplegable.
 */
export function ChildSwitcher() {
  const { user, setActiveChild } = useAuthStore()
  const players = useDataStore((s) => s.players)
  const { studentId, student } = useEffectiveStudent()

  const activeRole = user?.activeRole ?? user?.role
  if (activeRole !== 'tutor') return null

  const childIds = user?.linkedPlayerIds ?? []
  if (childIds.length === 0) return null

  const children = childIds
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p)

  const activeName = student
    ? `${student.firstName} ${student.lastName}`.trim()
    : 'Selecciona hijo'
  const activeInitial = student?.firstName?.charAt(0)?.toUpperCase() ?? '?'

  const pill = (
    <div className="flex items-center gap-2 rounded-full border border-border/60 bg-white px-3 py-1.5 shadow-sm">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-[11px] font-bold text-white shrink-0">
        {activeInitial}
      </span>
      <span className="text-sm font-semibold text-foreground truncate max-w-[10rem]">
        {activeName}
      </span>
      {children.length > 1 && <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
    </div>
  )

  if (children.length <= 1) return pill

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full transition-transform active:scale-95" title="Cambiar de hijo">
        {pill}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem]">
        <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
          Mis hijos
        </DropdownMenuLabel>
        {children.map((child) => {
          const isActive = child.id === studentId
          return (
            <DropdownMenuItem
              key={child.id}
              onClick={() => setActiveChild(child.id)}
              className={cn('gap-2', isActive && 'bg-accent/60')}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-[11px] font-bold text-white shrink-0">
                {child.firstName?.charAt(0)?.toUpperCase()}
              </span>
              <span className="flex-1 truncate">
                {`${child.firstName} ${child.lastName}`.trim()}
              </span>
              {isActive && <Check className="h-4 w-4 text-primary shrink-0" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
