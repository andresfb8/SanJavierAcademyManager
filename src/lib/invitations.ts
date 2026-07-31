import { doc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { generateId } from '@/lib/utils'
import { useDataStore } from '@/stores/dataStore'
import { buildActivationUrl } from '@/lib/invitation-utils'
import type { Invitation, UserRole } from '@/types'

export interface CreateInvitationParams {
  email: string
  role: UserRole
  clubId: string
  createdBy: string
  linkedPlayerId?: string
  linkedPlayerIds?: string[]
  coachId?: string
}

/**
 * Crea una invitación (store local + Firestore) y devuelve el enlace de activación.
 * Único punto que persiste invitaciones: lo usan la invitación individual y masiva
 * (UsersPage / tutores) y el alta de personal (CoachesPage).
 */
export async function createInvitation(
  params: CreateInvitationParams
): Promise<{ token: string; activationUrl: string }> {
  const existingInvitations = useDataStore.getState().invitations

  let priorInvitations: Invitation[] = []
  if (params.coachId) {
    priorInvitations = existingInvitations.filter(
      (inv) => inv.coachId === params.coachId
    )
  } else if (params.linkedPlayerId) {
    priorInvitations = existingInvitations.filter(
      (inv) => inv.linkedPlayerId === params.linkedPlayerId
    )
  } else if (params.linkedPlayerIds && params.linkedPlayerIds.length > 0) {
    priorInvitations = existingInvitations.filter(
      (inv) =>
        inv.linkedPlayerIds &&
        inv.linkedPlayerIds.some((id) => params.linkedPlayerIds!.includes(id))
    )
  } else {
    const normalizedEmail = params.email.trim().toLowerCase()
    priorInvitations = existingInvitations.filter(
      (inv) => inv.email.trim().toLowerCase() === normalizedEmail
    )
  }

  for (const prior of priorInvitations) {
    useDataStore.getState().deleteInvitation(prior.id)
  }

  const token = generateId()
  const activationUrl = buildActivationUrl(token)

  const now = new Date()
  const expiresAt = new Date(now)
  expiresAt.setDate(expiresAt.getDate() + 7)

  const invitationData: Omit<Invitation, 'id'> = {
    email: params.email.trim().toLowerCase(),
    role: params.role,
    clubId: params.clubId,
    status: 'pendiente',
    token,
    createdBy: params.createdBy,
    createdAt: now,
    expiresAt,
  }

  if (params.linkedPlayerId) {
    invitationData.linkedPlayerId = params.linkedPlayerId
  }
  if (params.linkedPlayerIds && params.linkedPlayerIds.length > 0) {
    invitationData.linkedPlayerIds = [...params.linkedPlayerIds]
  }
  if (params.coachId) {
    invitationData.coachId = params.coachId
  }

  useDataStore.getState().addInvitation({ ...invitationData, id: token } as Invitation)

  try {
    await setDoc(doc(db, 'invitations', token), invitationData)
  } catch (error) {
    useDataStore.getState().deleteInvitation(token)
    throw error
  }

  return { token, activationUrl }
}
