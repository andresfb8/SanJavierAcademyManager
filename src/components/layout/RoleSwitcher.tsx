import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'

const ROLE_LABELS: Record<UserRole, string> = {
  director:    'Director',
  coordinador: 'Coordinador',
  entrenador:  'Entrenador',
  jugador:     'Jugador',
  tutor:       'Tutor',
}

/**
 * Pill-switcher de rol activo. Solo se renderiza si el usuario tiene
 * más de un rol asignado (roles.length > 1).
 *
 * Cambia user.activeRole y persiste la preferencia en localStorage.
 */
export function RoleSwitcher() {
  const { user, setActiveRole } = useAuthStore()

  // Ocultar si tiene un solo rol o no hay usuario
  if (!user || user.roles.length <= 1) return null

  return (
    <div className="px-3 pb-3 pt-1">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 mb-2">
        Vista activa
      </p>
      <div className="flex gap-1">
        {user.roles.map((role) => (
          <button
            key={role}
            onClick={() => setActiveRole(role)}
            className={cn(
              'flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold capitalize transition-all duration-200 active:scale-95',
              user.activeRole === role
                ? 'bg-primary text-white shadow-sm'
                : 'text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground'
            )}
          >
            {ROLE_LABELS[role] ?? role}
          </button>
        ))}
      </div>
    </div>
  )
}
