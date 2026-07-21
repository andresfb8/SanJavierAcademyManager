import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { isBillingMonth, cycleLength } from "./billing-utils";

// ---------------------------------------------------------------------------
// Spanish month names (1-indexed: index 0 unused)
// ---------------------------------------------------------------------------
const MONTH_NAMES: Record<number, string> = {
  1: "Enero",
  2: "Febrero",
  3: "Marzo",
  4: "Abril",
  5: "Mayo",
  6: "Junio",
  7: "Julio",
  8: "Agosto",
  9: "Septiembre",
  10: "Octubre",
  11: "Noviembre",
  12: "Diciembre",
};

// ---------------------------------------------------------------------------
// Interfaces (mirroring the Firestore data model)
// ---------------------------------------------------------------------------
interface Enrollment {
  id: string;
  playerId: string;
  playerName: string;
  groupId: string;
  groupName: string;
  tariffId: string;
  tariffName: string;
  customPrice?: number;
  billingFrequency?: "monthly" | "quarterly" | "annual" | "installments";
  billingAnchorMonth?: number;
  enrollmentDate: Timestamp;
  unenrollmentDate?: Timestamp;
  isActive: boolean;
}

interface Group {
  id: string;
  name: string;
  defaultTariffId: string;
  defaultTariffPrice: number;
  billingFrequency: "monthly" | "quarterly" | "annual" | "installments";
  installmentMonths?: number[];
  installmentPrices?: Record<string, number>;
  startDate?: Timestamp;
  endDate?: Timestamp;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Core billing logic (shared by scheduled + callable)
// ---------------------------------------------------------------------------
async function generateReceipts(
  targetMonth?: number,
  targetYear?: number,
  clubId?: string,
): Promise<{ created: number; skipped: number; errors: number }> {
  const db = getFirestore();

  const now = new Date();
  const billingMonth = targetMonth ?? now.getMonth() + 1; // 1-12
  const billingYear = targetYear ?? now.getFullYear();
  const monthName = MONTH_NAMES[billingMonth];

  // Due date: 1st of the billing month
  const dueDate = Timestamp.fromDate(
    new Date(billingYear, billingMonth - 1, 1),
  );

  let totalCreated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  // Determine which clubs to process
  let clubIds: string[];
  if (clubId) {
    clubIds = [clubId];
  } else {
    const clubsSnap = await db.collection("clubs").get();
    clubIds = clubsSnap.docs.map((doc) => doc.id);
  }

  logger.info(
    `Generating receipts for ${monthName} ${billingYear} ` +
    `across ${clubIds.length} club(s)`,
  );

  for (const currentClubId of clubIds) {
    try {
      await processClub(
        db,
        currentClubId,
        billingMonth,
        billingYear,
        monthName,
        dueDate,
        (created, skipped) => {
          totalCreated += created;
          totalSkipped += skipped;
        },
      );
    } catch (err) {
      totalErrors++;
      logger.error(`Error processing club ${currentClubId}:`, err);
    }
  }

  logger.info(
    `Receipt generation complete: ` +
    `${totalCreated} created, ${totalSkipped} skipped, ${totalErrors} errors`,
  );

  return { created: totalCreated, skipped: totalSkipped, errors: totalErrors };
}

// ---------------------------------------------------------------------------
// Process a single club
// ---------------------------------------------------------------------------
async function processClub(
  db: FirebaseFirestore.Firestore,
  clubId: string,
  billingMonth: number,
  billingYear: number,
  monthName: string,
  dueDate: Timestamp,
  onProgress: (created: number, skipped: number) => void,
): Promise<void> {
  let created = 0;
  let skipped = 0;

  // Pre-fetch all groups for this club into a map for fast lookup
  const groupsSnap = await db.collection("groups").where("clubId", "==", clubId).get();
  const groupsMap = new Map<string, Group>();
  for (const doc of groupsSnap.docs) {
    groupsMap.set(doc.id, { id: doc.id, ...doc.data() } as Group);
  }

  // Fetch all active enrollments
  const enrollmentsSnap = await db
    .collection("enrollments")
    .where("clubId", "==", clubId)
    .where("isActive", "==", true)
    .get();

  if (enrollmentsSnap.empty) {
    logger.info(`Club ${clubId}: no active enrollments, skipping.`);
    onProgress(0, 0);
    return;
  }

  // Process in batches of 500 (Firestore batch write limit)
  const BATCH_SIZE = 500;
  let batch = db.batch();
  let batchCount = 0;

  for (const enrollDoc of enrollmentsSnap.docs) {
    const enrollment = {
      id: enrollDoc.id,
      ...enrollDoc.data(),
    } as Enrollment;

    const group = groupsMap.get(enrollment.groupId);
    if (!group) {
      logger.warn(
        `Club ${clubId}: group ${enrollment.groupId} not found ` +
        `for enrollment ${enrollment.id}, skipping.`,
      );
      skipped++;
      continue;
    }

    // Skip inactive groups
    if (!group.isActive) {
      skipped++;
      continue;
    }

    // Skip if the billing period starts after the group's end date
    if (group.endDate) {
      const billingPeriodStart = new Date(billingYear, billingMonth - 1, 1);
      const groupEnd = group.endDate.toDate();
      if (billingPeriodStart > groupEnd) {
        logger.info(
          `Club ${clubId}: group ${group.id} ended on ${groupEnd.toISOString().split("T")[0]}, ` +
          `skipping payment for ${billingMonth}/${billingYear}.`,
        );
        skipped++;
        continue;
      }
    }

    // -----------------------------------------------------------------------
    // Billing frequency check — reads from enrollment, falls back to group
    // -----------------------------------------------------------------------
    const freq = enrollment.billingFrequency ?? group.billingFrequency;
    const anchor = enrollment.billingAnchorMonth ?? (
      group.startDate
        ? group.startDate.toDate().getMonth() + 1
        : 9  // fallback: September (typical season start)
    );

    if (!isBillingMonth(freq, anchor, billingMonth)) {
      skipped++;
      continue;
    }

    // For installments: verify the specific month is configured
    if (freq === "installments") {
      // Support both legacy installmentMonths (number[]) and installmentPrices (Record<YYYY-MM, number>)
      const billingKey = `${billingYear}-${String(billingMonth).padStart(2, "0")}`;
      const inPrices = group.installmentPrices?.[billingKey] !== undefined;
      const inMonths = (group.installmentMonths ?? []).includes(billingMonth);
      if (!inPrices && !inMonths) {
        skipped++;
        continue;
      }
    }

    // -----------------------------------------------------------------------
    // Idempotency check: skip if payment already exists for this
    // enrollment + month + year combination
    // -----------------------------------------------------------------------
    const existingPayment = await db
      .collection("payments")
      .where("clubId", "==", clubId)
      .where("enrollmentId", "==", enrollment.id)
      .where("billingMonth", "==", billingMonth)
      .where("billingYear", "==", billingYear)
      .limit(1)
      .get();

    if (!existingPayment.empty) {
      skipped++;
      continue;
    }

    // -----------------------------------------------------------------------
    // Calculate amount and concept
    // -----------------------------------------------------------------------
    // Trimestral/anual generan menos recibos pero por el total del periodo
    // (cuota base x meses del ciclo); customPrice, si está definido, es
    // siempre el importe exacto del recibo y no se multiplica.
    const amount = enrollment.customPrice ?? (group.defaultTariffPrice * cycleLength(freq));
    const concept = `Cuota ${monthName} ${billingYear} - ${group.name}`;

    // Create the payment document
    const paymentRef = db.collection("payments").doc();

    batch.set(paymentRef, {
      clubId,
      playerId: enrollment.playerId,
      playerName: enrollment.playerName,
      groupId: enrollment.groupId,
      groupName: enrollment.groupName ?? group.name,
      enrollmentId: enrollment.id,
      concept,
      amount,
      status: "pendiente",
      billingMonth,
      billingYear,
      dueDate,
      autogenerated: true,
      createdAt: FieldValue.serverTimestamp(),
    });

    created++;
    batchCount++;

    // Commit batch if we reach the limit
    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  // Commit any remaining writes
  if (batchCount > 0) {
    await batch.commit();
  }

  logger.info(
    `Club ${clubId}: ${created} receipts created, ${skipped} skipped.`,
  );

  onProgress(created, skipped);
}

// ---------------------------------------------------------------------------
// Scheduled function: runs on the 1st of each month at 02:00 Europe/Madrid
// ---------------------------------------------------------------------------
export const generateMonthlyReceiptsScheduled = onSchedule(
  {
    schedule: "0 2 1 * *",
    timeZone: "Europe/Madrid",
    region: "europe-west1",
    retryCount: 3,
    memory: "512MiB",
    timeoutSeconds: 540,
  },
  async (_event) => {
    logger.info("Scheduled monthly receipt generation started.");
    const result = await generateReceipts();
    logger.info("Scheduled monthly receipt generation finished.", result);
  },
);

// ---------------------------------------------------------------------------
// Callable function: allows manual triggering from the admin UI
// ---------------------------------------------------------------------------
export const generateMonthlyReceiptsCallable = onCall(
  {
    region: "europe-west1",
    memory: "512MiB",
    timeoutSeconds: 540,
  },
  async (request) => {
    // Verify the caller is authenticated
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Debes estar autenticado para ejecutar esta funcion.",
      );
    }

    const { month, year, clubId } = request.data as {
      month?: number;
      year?: number;
      clubId?: string;
    };

    // Validate month if provided
    if (month !== undefined && (month < 1 || month > 12)) {
      throw new HttpsError(
        "invalid-argument",
        "El mes debe estar entre 1 y 12.",
      );
    }

    // Validate year if provided
    if (year !== undefined && (year < 2020 || year > 2100)) {
      throw new HttpsError(
        "invalid-argument",
        "El anio proporcionado no es valido.",
      );
    }

    logger.info(
      `Manual receipt generation triggered by user ${request.auth.uid}`,
      { month, year, clubId },
    );

    const result = await generateReceipts(month, year, clubId);

    return {
      success: true,
      message:
        `Generacion completada: ${result.created} recibos creados, ` +
        `${result.skipped} omitidos, ${result.errors} errores.`,
      ...result,
    };
  },
);
