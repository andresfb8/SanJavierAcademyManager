import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { logger } from "firebase-functions/v2";

// ── Notificación al cancelar una clase ───────────────────────────────────────
// Cuando el entrenador cancela una clase, notifica a todos los alumnos inscritos.

const DAYS_ES = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];

export const onCancelledClassCreated = onDocumentCreated(
  { document: "cancelledClasses/{classId}", region: "europe-west1" },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const { groupId, groupName, date, reason } = data as {
      groupId: string;
      groupName: string;
      date: string; // YYYY-MM-DD
      reason?: string;
    };

    const db = getFirestore();
    const messaging = getMessaging();

    // Formatear fecha legible
    const dateObj = new Date(date + "T12:00:00");
    const dayName = DAYS_ES[dateObj.getDay()];
    const dayNum = dateObj.getDate();
    const monthNum = dateObj.getMonth() + 1;
    const dateLabel = `${dayName} ${dayNum}/${monthNum}`;

    // Obtener alumnos inscritos activos
    const enrollmentsSnap = await db
      .collection("enrollments")
      .where("groupId", "==", groupId)
      .where("isActive", "==", true)
      .get();

    if (enrollmentsSnap.empty) return;

    const playerIds = enrollmentsSnap.docs.map((d) => d.data().playerId as string);
    const tokens: string[] = [];
    const userDocMap: Map<string, string[]> = new Map();

    for (const playerId of playerIds) {
      const [directSnap, tutorSnap] = await Promise.all([
        db.collection("users").where("linkedPlayerId", "==", playerId).limit(3).get(),
        db.collection("users").where("linkedPlayerIds", "array-contains", playerId).limit(3).get(),
      ]);

      [...directSnap.docs, ...tutorSnap.docs].forEach((doc) => {
        const fcmTokens: string[] = doc.data().fcmTokens ?? [];
        tokens.push(...fcmTokens);
        userDocMap.set(doc.id, fcmTokens);
      });
    }

    if (tokens.length === 0) return;

    const title = `❌ Clase cancelada`;
    const reasonSuffix = reason ? ` — ${reason}` : "";
    const body = `${groupName} del ${dateLabel} ha sido cancelada${reasonSuffix}.`;

    const result = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: { url: "/asistencia", type: "class_cancelled", groupId, date },
      webpush: {
        notification: { title, body, icon: "/pwa-192x192.png", badge: "/pwa-64x64.png", tag: `cancelled-${groupId}-${date}`, requireInteraction: false },
        fcmOptions: { link: "/asistencia" },
      },
    });

    // Limpiar tokens inválidos
    const invalidTokens = new Set<string>();
    result.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error?.code === "messaging/registration-token-not-registered") {
        invalidTokens.add(tokens[idx]);
      }
    });
    if (invalidTokens.size > 0) {
      for (const [docId, docTokens] of userDocMap.entries()) {
        const filtered = docTokens.filter((t) => !invalidTokens.has(t));
        if (filtered.length !== docTokens.length) {
          await db.collection("users").doc(docId).update({ fcmTokens: filtered });
        }
      }
    }

    logger.info(`[onCancelledClass] Notificación enviada a ${result.successCount} dispositivos. Grupo: ${groupId}, Fecha: ${date}`);
  }
);
