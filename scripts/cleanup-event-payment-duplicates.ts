/**
 * scripts/cleanup-event-payment-duplicates.ts
 *
 * One-shot script to cancel duplicate eventPayments in Firestore.
 *
 * A duplicate is any non-cancelled payment for the same (eventId, playerId)
 * when more than one exists. Deduplication rule:
 *   - Keep the one with status 'pagado' (if any).
 *   - If all are 'pendiente', keep the one with the latest createdAt.
 *   - Mark all others as 'cancelado'.
 *
 * Usage: npx tsx scripts/cleanup-event-payment-duplicates.ts
 * Requires: FIREBASE_SERVICE_ACCOUNT env var (JSON string) or GOOGLE_APPLICATION_CREDENTIALS.
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

if (getApps().length === 0) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  if (serviceAccount) {
    initializeApp({ credential: cert(JSON.parse(serviceAccount)) })
  } else {
    initializeApp()
  }
}

const db = getFirestore()
const CLUB_ID = 'club-001'

interface EventPaymentDoc {
  id: string
  eventId: string
  playerId: string
  playerName?: string
  eventName?: string
  status: string
  createdAt: Timestamp | Date | null
}

async function cleanupDuplicates() {
  console.log('[cleanup] Fetching eventPayments for club:', CLUB_ID)

  const snap = await db
    .collection('eventPayments')
    .where('clubId', '==', CLUB_ID)
    .get()

  console.log(`[cleanup] Total eventPayments found: ${snap.size}`)

  // Group non-cancelled payments by (eventId, playerId)
  const groups = new Map<string, EventPaymentDoc[]>()

  for (const doc of snap.docs) {
    const data = doc.data() as Omit<EventPaymentDoc, 'id'>
    if (data.status === 'cancelado') continue

    const key = `${data.eventId}__${data.playerId}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push({ ...data, id: doc.id })
  }

  const duplicateGroups = [...groups.values()].filter((g) => g.length > 1)
  console.log(`[cleanup] Groups with duplicates: ${duplicateGroups.length}`)

  if (duplicateGroups.length === 0) {
    console.log('[cleanup] ✅ No duplicates found. Nothing to do.')
    return
  }

  let totalCancelled = 0
  const BATCH_SIZE = 400
  let batch = db.batch()
  let opsInBatch = 0

  const flushBatch = async () => {
    if (opsInBatch > 0) {
      await batch.commit()
      batch = db.batch()
      opsInBatch = 0
    }
  }

  for (const group of duplicateGroups) {
    // Sort: paid first, then by createdAt descending
    const sorted = [...group].sort((a, b) => {
      if (a.status === 'pagado' && b.status !== 'pagado') return -1
      if (b.status === 'pagado' && a.status !== 'pagado') return 1
      // Both same status: sort by createdAt desc (latest first)
      const tsA = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : a.createdAt ? new Date(a.createdAt).getTime() : 0
      const tsB = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : b.createdAt ? new Date(b.createdAt).getTime() : 0
      return tsB - tsA
    })

    const canonical = sorted[0]
    const duplicates = sorted.slice(1)

    console.log(
      `  [${canonical.eventName ?? canonical.eventId}] ${canonical.playerName ?? canonical.playerId}:` +
      ` keep ${canonical.id} (${canonical.status}), cancel ${duplicates.length} duplicate(s)`
    )

    for (const dup of duplicates) {
      batch.update(db.collection('eventPayments').doc(dup.id), { status: 'cancelado' })
      opsInBatch++
      totalCancelled++

      if (opsInBatch >= BATCH_SIZE) {
        await flushBatch()
      }
    }
  }

  await flushBatch()

  console.log(`\n[cleanup] ✅ Done. Cancelled ${totalCancelled} duplicate payment(s) across ${duplicateGroups.length} group(s).`)
}

cleanupDuplicates().catch((err) => {
  console.error('[cleanup] ❌ Error:', err)
  process.exit(1)
})
