import type { AppUser, Invitation, Player } from '@/types'
import { isInvitationLive } from '@/lib/invitation-utils'

/** Estado de acceso de un jugador al portal, deducido de users + invitations. */
export type PortalStatus = 'activo' | 'invitado' | 'sin_acceso'

function normalizeEmail(email?: string): string {
  return (email ?? '').trim().toLowerCase()
}

/**
 * Deduce el estado del portal de un jugador. No hay campo persistido: la verdad
 * está en si existe un usuario vinculado (activo) o una invitación pendiente
 * y vigente que lo cubre (invitado).
 *
 * Una invitación "cubre" al jugador si lo enlaza por id (`linkedPlayerId` /
 * `linkedPlayerIds`) o si va dirigida a su propio email. El enlace por id es
 * imprescindible: las invitaciones de tutor se envían al email del guardián,
 * no al del jugador, y enlazan a los hijos por id — por eso la rama `activo`
 * (una vez aceptada la invitación y creado el usuario) y la rama `invitado`
 * (mientras está pendiente) deben ser simétricas en cómo enlazan al jugador.
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

  const hasPendingInvitation = invitations.some((inv) => {
    if (!isInvitationLive(inv, now)) return false
    // Invitación de tutor: va al email del guardián pero enlaza a los hijos por id.
    if (inv.linkedPlayerId === player.id) return true
    if (inv.linkedPlayerIds?.includes(player.id)) return true
    // Invitación directa al alumno: casa por su email.
    return email !== '' && normalizeEmail(inv.email) === email
  })

  return hasPendingInvitation ? 'invitado' : 'sin_acceso'
}

/**
 * Jugadores candidatos a una invitación en bloque al portal: activos, no
 * menores de edad (los menores se invitan por la vía del tutor, con su
 * propio email, no por aquí), con email propio, y sin cuenta ni invitación
 * pendiente todavía.
 */
export function getInvitablePlayers(
  players: Player[],
  users: AppUser[],
  invitations: Invitation[],
  now: Date = new Date()
): Player[] {
  return players.filter(
    (p) =>
      p.status === 'activo' &&
      !p.isMinor &&
      !!p.email?.trim() &&
      getPlayerPortalStatus(p, users, invitations, now) === 'sin_acceso'
  )
}
