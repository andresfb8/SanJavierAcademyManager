import type { Invitation } from '@/types'

/** Enlace de activación de una invitación. Único formato en toda la app. */
export function buildActivationUrl(token: string): string {
  return `${window.location.origin}/activar/${token}`
}

/**
 * Una invitación sirve solo si sigue pendiente y no ha caducado. `status` no se
 * recalcula solo, así que una invitación vieja sigue diciendo 'pendiente':
 * hay que comprobar también la fecha o se reparten enlaces muertos.
 *
 * `expiresAt` está tipado Date pero llega como string ISO tras rehidratar el
 * store desde localStorage, de ahí la coerción.
 */
export function isInvitationLive(inv: Invitation, now: Date = new Date()): boolean {
  return inv.status === 'pendiente' && new Date(inv.expiresAt).getTime() > now.getTime()
}
