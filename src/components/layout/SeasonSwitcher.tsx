import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'

/**
 * Selector de temporada activa del club, visible solo para director/coordinador.
 * Cambiarla actualiza club.activeSeasonId para todo el club (no es por sesión).
 */
export function SeasonSwitcher() {
  const { user } = useAuthStore()
  const club = useDataStore((s) => s.club)
  const seasons = useDataStore((s) => s.seasons)
  const updateClub = useDataStore((s) => s.updateClub)

  const activeRole = user?.activeRole ?? user?.role
  if (activeRole !== 'director' && activeRole !== 'coordinador') return null
  if (seasons.length === 0) return null

  const activeSeason = seasons.find((s) => s.id === club?.activeSeasonId)
  const activeName = activeSeason?.name ?? 'Sin temporada'

  const pill = (
    <div className="flex items-center gap-2 rounded-full border border-border/60 bg-white px-3 py-1.5 shadow-sm">
      <span className="text-sm font-semibold text-foreground truncate max-w-[10rem]">
        {activeName}
      </span>
      {seasons.length > 1 && <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
    </div>
  )

  if (seasons.length <= 1) return pill

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full transition-transform active:scale-95" title="Cambiar de temporada">
        {pill}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[14rem]">
        <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
          Temporada activa
        </DropdownMenuLabel>
        {seasons.map((season) => {
          const isActive = season.id === club?.activeSeasonId
          return (
            <DropdownMenuItem
              key={season.id}
              onClick={() => updateClub({ activeSeasonId: season.id })}
              className={cn('gap-2', isActive && 'bg-accent/60')}
            >
              <span className="flex-1 truncate">{season.name}</span>
              {isActive && <Check className="h-4 w-4 text-primary shrink-0" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
