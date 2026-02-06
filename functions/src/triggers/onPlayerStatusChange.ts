import {
  onDocumentUpdated,
  FirestoreEvent,
  Change,
  QueryDocumentSnapshot,
} from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------
interface Player {
  id: string;
  firstName: string;
  lastName: string;
  status: "activo" | "lista_espera" | "baja";
  cancellationDate?: Timestamp;
}

// ---------------------------------------------------------------------------
// Firestore trigger: fires when any player document is updated
// ---------------------------------------------------------------------------
export const onPlayerStatusChange = onDocumentUpdated(
  {
    document: "clubs/{clubId}/players/{playerId}",
    region: "europe-west1",
  },
  async (
    event: FirestoreEvent<
      Change<QueryDocumentSnapshot> | undefined,
      { clubId: string; playerId: string }
    >,
  ) => {
    const change = event.data;
    if (!change) {
      logger.warn("No data in event, skipping.");
      return;
    }

    const before = change.before.data() as Player;
    const after = change.after.data() as Player;

    // Only react when status changes TO 'baja'
    if (before.status === after.status || after.status !== "baja") {
      return;
    }

    const { clubId, playerId } = event.params;

    logger.info(
      `Player ${playerId} in club ${clubId} changed status ` +
      `from "${before.status}" to "baja". Applying cancellation rules.`,
    );

    const db = getFirestore();
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();

    // -------------------------------------------------------------------
    // 1. Set cancellationDate on the player document
    // -------------------------------------------------------------------
    await change.after.ref.update({
      cancellationDate: FieldValue.serverTimestamp(),
    });

    // -------------------------------------------------------------------
    // 2. Cancel pending payments based on the day-5 rule
    // -------------------------------------------------------------------
    await cancelPendingPayments(
      db,
      clubId,
      playerId,
      currentDay,
      currentMonth,
      currentYear,
    );

    // -------------------------------------------------------------------
    // 3. Deactivate all enrollments for this player
    // -------------------------------------------------------------------
    await deactivateEnrollments(db, clubId, playerId);

    logger.info(
      `Cancellation rules fully applied for player ${playerId} ` +
      `in club ${clubId}.`,
    );
  },
);

// ---------------------------------------------------------------------------
// Cancel pending payments according to the day-5 rule
//
// - If current day <= 5: cancel ALL pending payments for the current month
//   and all future months.
// - If current day > 5: keep current month payments as-is, only cancel
//   pending payments for future months.
// ---------------------------------------------------------------------------
async function cancelPendingPayments(
  db: FirebaseFirestore.Firestore,
  clubId: string,
  playerId: string,
  currentDay: number,
  currentMonth: number,
  currentYear: number,
): Promise<void> {
  // Fetch all pending payments for this player
  const paymentsSnap = await db
    .collection(`clubs/${clubId}/payments`)
    .where("playerId", "==", playerId)
    .where("status", "==", "pendiente")
    .get();

  if (paymentsSnap.empty) {
    logger.info(`No pending payments found for player ${playerId}.`);
    return;
  }

  const BATCH_SIZE = 500;
  let batch = db.batch();
  let batchCount = 0;
  let cancelledCount = 0;

  for (const paymentDoc of paymentsSnap.docs) {
    const payment = paymentDoc.data();
    const paymentMonth: number = payment.billingMonth;
    const paymentYear: number = payment.billingYear;

    const shouldCancel = shouldCancelPayment(
      currentDay,
      currentMonth,
      currentYear,
      paymentMonth,
      paymentYear,
    );

    if (shouldCancel) {
      batch.update(paymentDoc.ref, {
        status: "cancelado",
        notes: buildCancellationNote(currentDay, paymentMonth, paymentYear),
      });
      cancelledCount++;
      batchCount++;

      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  logger.info(
    `Cancelled ${cancelledCount} pending payment(s) for player ${playerId}.`,
  );
}

// ---------------------------------------------------------------------------
// Determine whether a payment should be cancelled
// ---------------------------------------------------------------------------
function shouldCancelPayment(
  currentDay: number,
  currentMonth: number,
  currentYear: number,
  paymentMonth: number,
  paymentYear: number,
): boolean {
  const isFutureMonth =
    paymentYear > currentYear ||
    (paymentYear === currentYear && paymentMonth > currentMonth);

  const isCurrentMonth =
    paymentYear === currentYear && paymentMonth === currentMonth;

  // Day <= 5: cancel current month AND all future months
  if (currentDay <= 5) {
    return isCurrentMonth || isFutureMonth;
  }

  // Day > 5: only cancel future months (keep current month as-is)
  return isFutureMonth;
}

// ---------------------------------------------------------------------------
// Build a human-readable cancellation note
// ---------------------------------------------------------------------------
function buildCancellationNote(
  currentDay: number,
  paymentMonth: number,
  paymentYear: number,
): string {
  const dateStr = new Date().toLocaleDateString("es-ES");
  if (currentDay <= 5) {
    return (
      `Cancelado automaticamente por baja del jugador (dia ${currentDay}, ` +
      `antes del dia 5). Pago de ${paymentMonth}/${paymentYear}. ` +
      `Fecha: ${dateStr}.`
    );
  }
  return (
    `Cancelado automaticamente por baja del jugador. ` +
    `Pago futuro de ${paymentMonth}/${paymentYear}. ` +
    `Fecha: ${dateStr}.`
  );
}

// ---------------------------------------------------------------------------
// Deactivate all enrollments for a player
// ---------------------------------------------------------------------------
async function deactivateEnrollments(
  db: FirebaseFirestore.Firestore,
  clubId: string,
  playerId: string,
): Promise<void> {
  const enrollmentsSnap = await db
    .collection(`clubs/${clubId}/enrollments`)
    .where("playerId", "==", playerId)
    .where("isActive", "==", true)
    .get();

  if (enrollmentsSnap.empty) {
    logger.info(`No active enrollments found for player ${playerId}.`);
    return;
  }

  const BATCH_SIZE = 500;
  let batch = db.batch();
  let batchCount = 0;

  for (const enrollDoc of enrollmentsSnap.docs) {
    batch.update(enrollDoc.ref, {
      isActive: false,
      unenrollmentDate: FieldValue.serverTimestamp(),
    });
    batchCount++;

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  logger.info(
    `Deactivated ${enrollmentsSnap.size} enrollment(s) for player ${playerId}.`,
  );
}
