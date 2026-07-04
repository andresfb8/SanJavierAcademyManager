import { doc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { generateId } from '@/lib/utils'
import { useDataStore } from '@/stores/dataStore'
import type { Invitation, UserRole } from '@/types'

export interface CreateInvitationParams {
  email: string
  role: UserRole
  clubId: string
  createdBy: string
  linkedPlayerId?: string
  linkedPlayerIds?: string[]
}

/**
 * Crea una invitación (store local + Firestore) y devuelve el enlace de activación.
 * Lógica compartida entre la invitación individual (UsersPage) y la masiva de tutores.
 */
export async function createInvitation(
  params: CreateInvitationParams
): Promise<{ token: string; activationUrl: string }> {
  const token = generateId()
  const activationUrl = `${window.location.origin}/activar/${token}`

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

  useDataStore.getState().addInvitation({ ...invitationData, id: token } as Invitation)

  await setDoc(doc(db, 'invitations', token), invitationData)

  return { token, activationUrl }
}
