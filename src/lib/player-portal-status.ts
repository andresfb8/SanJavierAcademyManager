import type { AppUser, Invitation, Player } from '@/types'

/** Estado de acceso de un jugador al portal, deducido de users + invitations. */
export type PortalStatus = 'activo' | 'invitado' | 'sin_acceso'

function normalizeEmail(email?: string): string {
  return (email ?? '').trim().toLowerCase()
}

/**
 * Deduce el estado del portal de un jugador. No hay campo persistido: la verdad
 * está en si existe un usuario vinculado (activo) o una invitación pendiente
 * y vigente para su email (invitado).
 *
 * `activo` tiene precedencia sobre `invitado`.
 */
export function getPlayerPortalStatus(
  player: Player,
  users: AppUser[],
  invitations: Invitation[],
  now: Date = new Date()
): PortalStatus {
  const hasActiveUser = users.some(
    (u) =>
      u.isActive &&
      (u.linkedPlayerId === player.id || (u.linkedPlayerIds?.includes(player.id) ?? false))
  )
  if (hasActiveUser) return 'activo'

  const email = normalizeEmail(player.email)
  if (!email) return 'sin_acceso'

  const hasPendingInvitation = invitations.some(
    (inv) =>
      inv.status === 'pendiente' &&
      normalizeEmail(inv.email) === email &&
      new Date(inv.expiresAt).getTime() > now.getTime()
  )

  return hasPendingInvitation ? 'invitado' : 'sin_acceso'
}
