# Fix: Event Payment Duplicates

**Date:** 2026-06-02  
**Status:** Approved

## Problem

`EventDetailPage` contains a migration `useEffect` (lines 191-207) that auto-creates payments for attendees without one. Its dependency array is `[event?.id, event?.attendeePlayerIds.length]` — it does NOT include `thisEventPayments`.

This causes a race condition in two scenarios:

1. **Adding an attendee**: `handleAddAttendee` creates a payment and updates the event. The array length change triggers `useEffect`. But `thisEventPayments` hasn't refreshed from Firestore yet, so `hasPayment` is false for the new player → a second duplicate payment is created.
2. **Cold cache page load**: On first visit, React Query returns `[]` while fetching. The effect fires immediately and creates payments for all attendees, even though they already exist in Firestore.

Result: players end up with 1 paid payment + N pending duplicates, which appear as multiple "Pendiente" rows in the PaymentsPage.

## Solution

### Part 1 — Remove the migration `useEffect`

Delete lines 191-207 in `src/pages/EventDetailPage.tsx` entirely.

All events already have their payments created, so the migration is no longer needed. The `handleAddAttendee` handler already has a correct guard (`alreadyHasPayment` check) that will continue to work.

### Part 2 — Cleanup script for existing duplicates

Create `scripts/cleanup-event-payment-duplicates.ts` that runs once to fix already-corrupted data.

**Algorithm:**
1. Fetch all `eventPayments` documents for the club from Firestore
2. Group by `(eventId, playerId)`
3. For each group with more than 1 non-cancelled payment:
   - If any payment has `status: 'pagado'` → that one is canonical; mark all others `cancelado`
   - If all are `pendiente` → keep the one with the latest `createdAt`; mark all others `cancelado`
4. Write updates to Firestore in batches
5. Print a summary: events affected, players affected, duplicates cancelled

**Run once:**
```bash
npx tsx scripts/cleanup-event-payment-duplicates.ts
```

## Files Changed

- `src/pages/EventDetailPage.tsx` — remove `useEffect` block (lines 191-207)
- `scripts/cleanup-event-payment-duplicates.ts` — new one-time cleanup script

## Out of Scope

- No changes to the payments list UI
- No changes to how `handleAddAttendee` works (it already guards correctly)
- No changes to Firestore rules or indexes
