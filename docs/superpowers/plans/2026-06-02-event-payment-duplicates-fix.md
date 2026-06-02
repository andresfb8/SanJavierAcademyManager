# Event Payment Duplicates Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate duplicate event payments caused by a stale migration `useEffect`, and clean up already-created duplicates in Firestore.

**Architecture:** Two independent changes — (1) delete the offending `useEffect` from `EventDetailPage`, (2) a one-shot Firebase Admin script that deduplicates existing `eventPayments` documents in Firestore by cancelling all but the canonical payment per `(eventId, playerId)` pair.

**Tech Stack:** React/TypeScript (frontend fix), Firebase Admin SDK via `firebase-admin` (cleanup script), `tsx` to run the script.

---

## File Map

| File | Action |
|------|--------|
| `src/pages/EventDetailPage.tsx` | Modify — delete migration `useEffect` block |
| `scripts/cleanup-event-payment-duplicates.ts` | Create — one-shot Firestore deduplication script |

---

### Task 1: Remove migration `useEffect` from EventDetailPage

**Files:**
- Modify: `src/pages/EventDetailPage.tsx:190-207`

- [ ] **Step 1: Delete the migration `useEffect` block**

Open `src/pages/EventDetailPage.tsx`. Delete lines 190-207 (the comment + the entire `useEffect`):

```
  // Auto-crear pagos faltantes para asistentes sin pago (migración de eventos antiguos)
  useEffect(() => {
    if (!event) return
    for (let i = 0; i < event.attendeePlayerIds.length; i++) {
      const pid = event.attendeePlayerIds[i]
      const hasPayment = thisEventPayments.some((ep) => ep.playerId === pid && ep.status !== 'cancelado')
      if (!hasPayment) {
        addEventPayment({
          eventId: event.id,
          eventName: event.name,
          playerId: pid,
          playerName: event.attendeePlayerNames[i] || 'Asistente',
          amount: event.price,
          status: 'pendiente',
        })
      }
    }
  }, [event?.id, event?.attendeePlayerIds.length]) // eslint-disable-line react-hooks/exhaustive-deps
```

The result around that area should look like this (the `handleMarkPaid` function followed directly by `handleAddGuest`):

```tsx
  const handleMarkPaid = (paymentId: string) => {
    const method = paymentMethods[paymentId] || 'efectivo'
    markEventPaymentPaid(paymentId, method as 'transferencia' | 'efectivo' | 'domiciliacion' | 'tarjeta')
  }

  const handleAddGuest = () => {
```

- [ ] **Step 2: Check if `useEffect` import is still needed**

Search for other `useEffect` usages in `src/pages/EventDetailPage.tsx`:

```bash
grep -n "useEffect" src/pages/EventDetailPage.tsx
```

If the result is empty (no other usages), remove `useEffect` from the import on line 1:

Change:
```tsx
import { useState, useMemo, useEffect } from 'react'
```
To:
```tsx
import { useState, useMemo } from 'react'
```

If there are other `useEffect` usages, leave the import as-is.

- [ ] **Step 3: Verify TypeScript build passes**

```bash
npm run build
```

Expected: build completes with no TypeScript errors. The output should end with something like:
```
✓ built in Xs
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/EventDetailPage.tsx
git commit -m "fix: remove migration useEffect causing duplicate event payments"
```

---

### Task 2: Create Firestore deduplication script

**Files:**
- Create: `scripts/cleanup-event-payment-duplicates.ts`

- [ ] **Step 1: Create the cleanup script**

Create `scripts/cleanup-event-payment-duplicates.ts` with the following content:

```typescript
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
```

- [ ] **Step 2: Run the script (dry-run review first)**

Before running against production, check that the script compiles:

```bash
npx tsx --no-exec scripts/cleanup-event-payment-duplicates.ts 2>&1 | head -5
```

This should either show no output (good) or a syntax error if there's a TypeScript issue.

- [ ] **Step 3: Run the script against Firestore**

Make sure `FIREBASE_SERVICE_ACCOUNT` is set (or `GOOGLE_APPLICATION_CREDENTIALS` points to the service account JSON), then run:

```bash
npx tsx scripts/cleanup-event-payment-duplicates.ts
```

Expected output (example):
```
[cleanup] Fetching eventPayments for club: club-001
[cleanup] Total eventPayments found: 87
[cleanup] Groups with duplicates: 14
  [Minitorneo 22 mayo] José Maria Caballero: keep abc123 (pagado), cancel 2 duplicate(s)
  [Minitorneo 22 mayo] Angel Gonzalez: keep def456 (pagado), cancel 2 duplicate(s)
  ...
[cleanup] ✅ Done. Cancelled 28 duplicate payment(s) across 14 group(s).
```

If the output says "No duplicates found", the Firestore data was already clean.

- [ ] **Step 4: Verify in the app**

Open the app and navigate to the Minitorneo 22 mayo event. Check:
- The Asistentes table shows one payment per player
- No player appears more than once in Pagos → filter by "Evento"
- Players marked as Pagado in the event still show Pagado

- [ ] **Step 5: Commit**

```bash
git add scripts/cleanup-event-payment-duplicates.ts
git commit -m "chore: add one-shot script to cancel duplicate event payments in Firestore"
```
