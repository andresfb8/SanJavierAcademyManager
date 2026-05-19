import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { logger } from "firebase-functions/v2";

// ── Recordatorio día 15: recibos pendientes del mes ───────────────────────────
// Si el día 15 del mes hay recibos sin pagar, avisa al alumno/tutor.

const MONTH_NAMES = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
];

export const paymentReminderDay15 = onSchedule(
  {
    schedule: "0 9 15 * *",
    timeZone: "Europe/Madrid",
    region: "europe-west1",
    memory: "512MiB",
    timeoutSeconds: 300,
  },
  async () => {
    const db = getFirestore();
    const messaging = getMessaging();
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Obtener recibos pendientes del mes actual
    const paymentsSnap = await db
      .collection("payments")
      .where("status", "==", "pendiente")
      .where("billingMonth", "==", currentMonth)
      .where("billingYear", "==", currentYear)
      .get();

    if (paymentsSnap.empty) {
      logger.info("[paymentReminder] No hay recibos pendientes este mes.");
      return;
    }

    // Agrupar por playerId
    const pendingByPlayer: Record<string, { count: number; total: number }> = {};
    paymentsSnap.docs.forEach((doc) => {
      const { playerId, amount } = doc.data();
      if (!pendingByPlayer[playerId]) pendingByPlayer[playerId] = { count: 0, total: 0 };
      pendingByPlayer[playerId].count++;
      pendingByPlayer[playerId].total += amount ?? 0;
    });

    const monthLabel = MONTH_NAMES[currentMonth - 1];
    let totalSent = 0;

    for (const [playerId, { count, total }] of Object.entries(pendingByPlayer)) {
      // Comprobar si ya enviamos el recordatorio del día 15 para este mes
      const reminderDocId = `${playerId}_${currentMonth}_${currentYear}_day15`;
      const reminderRef = db.collection("remindersSent").doc(reminderDocId);
      const reminderSnap = await reminderRef.get();
      if (reminderSnap.exists) continue;

      // Buscar usuarios vinculados
      const [directSnap, tutorSnap] = await Promise.all([
        db.collection("users").where("linkedPlayerId", "==", playerId).limit(5).get(),
        db.collection("users").where("linkedPlayerIds", "array-contains", playerId).limit(5).get(),
      ]);

      const tokens: string[] = [];
      [...directSnap.docs, ...tutorSnap.docs].forEach((doc) => {
        tokens.push(...(doc.data().fcmTokens ?? []));
      });

      if (tokens.length === 0) continue;

      const amountStr = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(total);
      const title = `⚠ Recibo${count > 1 ? "s" : ""} pendiente${count > 1 ? "s" : ""}`;
      const body =
        count === 1
          ? `Tienes 1 recibo pendiente de ${monthLabel} por ${amountStr}. Revisa tus pagos.`
          : `Tienes ${count} recibos pendientes de ${monthLabel} por ${amountStr} en total. Revisa tus pagos.`;

      const result = await messaging.sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: { url: "/pagos", type: "payment_reminder", billingMonth: String(currentMonth), billingYear: String(currentYear) },
        webpush: {
          notification: { title, body, icon: "/pwa-192x192.png", badge: "/pwa-64x64.png", tag: `payment-reminder-${currentMonth}-${currentYear}` },
          fcmOptions: { link: "/pagos" },
        },
      });

      if (result.successCount > 0) {
        await reminderRef.set({
          sentAt: Timestamp.now(),
          playerId,
          billingMonth: currentMonth,
          billingYear: currentYear,
          milestone: "day15",
        });
        totalSent++;
      }
    }

    logger.info(`[paymentReminder] Recordatorios enviados a ${totalSent} jugadores.`);
  }
);
