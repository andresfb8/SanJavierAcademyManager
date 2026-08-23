import { describe, it, expect } from 'vitest'
import { getPlayerPortalStatus, getInvitablePlayers } from '@/lib/player-portal-status'
import type { AppUser, Invitation, Player } from '@/types'

const NOW = new Date('2026-07-16T12:00:00Z')

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    firstName: 'Hugo',
    lastName: 'García',
    email: 'hugo@example.com',
    ...overrides,
  } as Player
}

function makeUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: 'u1',
    email: 'hugo@example.com',
    isActive: true,
    ...overrides,
  } as AppUser
}

function makeInvitation(overrides: Partial<Invitation> = {}): Invitation {
  return {
    id: 'i1',
    email: 'hugo@example.com',
    status: 'pendiente',
    expiresAt: new Date('2026-07-20T12:00:00Z'),
    ...overrides,
  } as Invitation
}

describe('getPlayerPortalStatus', () => {
  it('devuelve activo cuando existe un usuario vinculado por linkedPlayerId', () => {
    const users = [makeUser({ linkedPlayerId: 'p1' })]
    expect(getPlayerPortalStatus(makePlayer(), users, [], NOW)).toBe('activo')
  })

  it('devuelve activo cuando un tutor lo tiene en linkedPlayerIds', () => {
    const users = [makeUser({ id: 'u2', linkedPlayerIds: ['p9', 'p1'] })]
    expect(getPlayerPortalStatus(makePlayer(), users, [], NOW)).toBe('activo')
  })

  it('no cuenta como activo un usuario vinculado pero desactivado', () => {
    const users = [makeUser({ linkedPlayerId: 'p1', isActive: false })]
    expect(getPlayerPortalStatus(makePlayer(), users, [], NOW)).toBe('sin_acceso')
  })

  it('devuelve invitado con una invitación pendiente y vigente', () => {
    expect(getPlayerPortalStatus(makePlayer(), [], [makeInvitation()], NOW)).toBe('invitado')
  })

  it('devuelve sin_acceso si la invitación pendiente ha caducado', () => {
    const invitations = [makeInvitation({ expiresAt: new Date('2026-07-10T12:00:00Z') })]
    expect(getPlayerPortalStatus(makePlayer(), [], invitations, NOW)).toBe('sin_acceso')
  })

  it('devuelve sin_acceso si la invitación ya fue aceptada y no hay usuario', () => {
    const invitations = [makeInvitation({ status: 'aceptada' })]
    expect(getPlayerPortalStatus(makePlayer(), [], invitations, NOW)).toBe('sin_acceso')
  })

  it('activo tiene precedencia sobre invitado', () => {
    const users = [makeUser({ linkedPlayerId: 'p1' })]
    expect(getPlayerPortalStatus(makePlayer(), users, [makeInvitation()], NOW)).toBe('activo')
  })

  it('compara emails ignorando mayúsculas y espacios', () => {
    const player = makePlayer({ email: '  Hugo@Example.COM ' })
    const invitations = [makeInvitation({ email: 'hugo@example.com' })]
    expect(getPlayerPortalStatus(player, [], invitations, NOW)).toBe('invitado')
  })

  it('devuelve sin_acceso si el jugador no tiene email', () => {
    const player = makePlayer({ email: '' })
    expect(getPlayerPortalStatus(player, [], [makeInvitation()], NOW)).toBe('sin_acceso')
  })

  it('devuelve invitado con una invitación de tutor que lo enlaza en linkedPlayerIds', () => {
    const player = makePlayer({ email: '' })
    const invitations = [makeInvitation({ email: 'madre@example.com', linkedPlayerIds: ['p9', 'p1'] })]
    expect(getPlayerPortalStatus(player, [], invitations, NOW)).toBe('invitado')
  })

  it('devuelve invitado con una invitación que lo enlaza por linkedPlayerId', () => {
    const player = makePlayer({ email: 'otro@example.com' })
    const invitations = [makeInvitation({ email: 'madre@example.com', linkedPlayerId: 'p1' })]
    expect(getPlayerPortalStatus(player, [], invitations, NOW)).toBe('invitado')
  })

  it('acepta expiresAt como string ISO (rehidratado de localStorage)', () => {
    const invitations = [makeInvitation({ expiresAt: '2026-07-20T12:00:00Z' as unknown as Date })]
    expect(getPlayerPortalStatus(makePlayer(), [], invitations, NOW)).toBe('invitado')
  })
})

describe('getInvitablePlayers', () => {
  it('incluye a un jugador activo, no menor, con email, sin acceso al portal', () => {
    const player = makePlayer({ status: 'activo', isMinor: false })
    expect(getInvitablePlayers([player], [], [], NOW)).toEqual([player])
  })

  it('excluye a un jugador que no está activo (baja o lista de espera)', () => {
    const player = makePlayer({ status: 'baja', isMinor: false })
    expect(getInvitablePlayers([player], [], [], NOW)).toEqual([])
  })

  it('excluye a un menor de edad', () => {
    const player = makePlayer({ status: 'activo', isMinor: true })
    expect(getInvitablePlayers([player], [], [], NOW)).toEqual([])
  })

  it('excluye a un jugador sin email', () => {
    const player = makePlayer({ status: 'activo', isMinor: false, email: '' })
    expect(getInvitablePlayers([player], [], [], NOW)).toEqual([])
  })

  it('excluye a un jugador con email en blanco (solo espacios)', () => {
    const player = makePlayer({ status: 'activo', isMinor: false, email: '   ' })
    expect(getInvitablePlayers([player], [], [], NOW)).toEqual([])
  })

  it('excluye a un jugador que ya tiene cuenta de portal', () => {
    const player = makePlayer({ status: 'activo', isMinor: false })
    const users = [makeUser({ linkedPlayerId: 'p1' })]
    expect(getInvitablePlayers([player], users, [], NOW)).toEqual([])
  })

  it('excluye a un jugador con invitación pendiente y vigente', () => {
    const player = makePlayer({ status: 'activo', isMinor: false })
    const invitations = [makeInvitation()]
    expect(getInvitablePlayers([player], [], invitations, NOW)).toEqual([])
  })

  it('filtra dentro de una lista con varios jugadores', () => {
    const eligible = makePlayer({ id: 'p1', status: 'activo', isMinor: false })
    const minor = makePlayer({ id: 'p2', status: 'activo', isMinor: true })
    const inactive = makePlayer({ id: 'p3', status: 'baja', isMinor: false })
    expect(getInvitablePlayers([eligible, minor, inactive], [], [], NOW)).toEqual([eligible])
  })
})
