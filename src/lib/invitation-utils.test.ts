import { describe, it, expect } from 'vitest'
import { isInvitationLive } from '@/lib/invitation-utils'
import type { Invitation } from '@/types'

const NOW = new Date('2026-07-16T12:00:00Z')

function makeInvitation(overrides: Partial<Invitation> = {}): Invitation {
  return {
    id: 'i1',
    email: 'hugo@example.com',
    status: 'pendiente',
    expiresAt: new Date('2026-07-20T12:00:00Z'),
    ...overrides,
  } as Invitation
}

describe('isInvitationLive', () => {
  it('es true si está pendiente y no ha caducado', () => {
    expect(isInvitationLive(makeInvitation(), NOW)).toBe(true)
  })

  it('es false si ha caducado aunque siga pendiente', () => {
    expect(isInvitationLive(makeInvitation({ expiresAt: new Date('2026-07-10T12:00:00Z') }), NOW)).toBe(false)
  })

  it('es false si ya fue aceptada', () => {
    expect(isInvitationLive(makeInvitation({ status: 'aceptada' }), NOW)).toBe(false)
  })

  it('acepta expiresAt como string ISO (rehidratado de localStorage)', () => {
    const inv = makeInvitation({ expiresAt: '2026-07-20T12:00:00Z' as unknown as Date })
    expect(isInvitationLive(inv, NOW)).toBe(true)
  })
})
