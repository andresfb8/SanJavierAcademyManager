import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { logger } from "firebase-functions/v2";

// ── Trigger: nuevo aviso de asistencia ────────────────────────────────────────
// Cuando un alumno envía un aviso (presente/ausente), notifica al entrenador
// del grupo en cuestión.

export const onAttendanceNoticeCreated = onDocumentCreated(
  {
    document: "attendanceNotices/{noticeId}",
    region: "europe-west1",
  },
  async (event) => {
    const notice = event.data?.data();
    if (!notice) return;

    const db = getFirestore();
    const messaging = getMessaging();

    const { groupId, playerName, type, notes } = notice as {
      groupId: string;
      playerName: string;
      type: "absent" | "present" | "uncertain";
      notes?: string;
    };

    // 1. Obtener el grupo para saber el entrenador
    const groupSnap = await db.collection("groups").doc(groupId).get();
    if (!groupSnap.exists) return;

    const group = groupSnap.data()!;
    const coachId: string = group.coachId;
    if (!coachId) return;

    // 2. Obtener el coach para sacar su userId o email
    const coachSnap = await db.collection("coaches").doc(coachId).get();
    if (!coachSnap.exists) return;

    const coach = coachSnap.data()!;
    const coachUserId: string | undefined = coach.userId;
    const coachEmail: string | undefined = coach.email;

    // 3. Encontrar el usuario del entrenador por userId o email
    let userDoc: FirebaseFirestore.DocumentData | null = null;
    let userDocId: string | null = null;

    if (coachUserId) {
      const snap = await db.collection("users").doc(coachUserId).get();
      if (snap.exists) {
        userDoc = snap.data()!;
        userDocId = snap.id;
      }
    }

    if (!userDoc && coachEmail) {
      const snap = await db
        .collection("users")
        .where("email", "==", coachEmail.toLowerCase())
        .limit(1)
        .get();
      if (!snap.empty) {
        userDoc = snap.docs[0].data();
        userDocId = snap.docs[0].id;
      }
    }

    if (!userDoc || !userDocId) {
      logger.info(`[onAttendanceNotice] No se encontró usuario para el entrenador ${coachId}`);
      return;
    }

    // 4. Obtener tokens FCM del entrenador
    const fcmTokens: string[] = userDoc.fcmTokens ?? [];
    if (fcmTokens.length === 0) {
      logger.info(`[onAttendanceNotice] Entrenador ${coachId} no tiene tokens FCM registrados`);
      return;
    }

    // 5. Construir mensaje
    const title =
      type === "absent" ? `⚠ No asiste: ${playerName}`
      : type === "uncertain" ? `❓ En duda: ${playerName}`
      : `✓ Confirmación: ${playerName}`;
    const body =
      type === "absent"
        ? `${playerName} no podrá asistir a ${group.name}${notes ? ` — ${notes}` : ""}`
        : type === "uncertain"
        ? `${playerName} está en duda para ${group.name}${notes ? ` — ${notes}` : ""}`
        : `${playerName} ha confirmado su asistencia a ${group.name}`;
    const isAbsent = type === "absent";

    // 6. Enviar a todos los dispositivos del entrenador
    const results = await messaging.sendEachForMulticast({
      tokens: fcmTokens,
      notification: { title, body },
      data: {
        url: "/asistencia",
        tag: `attendance-notice-${groupId}`,
        type: "attendance_notice",
        groupId,
      },
      webpush: {
        notification: {
          title,
          body,
          icon: "/pwa-192x192.png",
          badge: "/pwa-64x64.png",
          tag: `attendance-notice-${groupId}`,
          requireInteraction: isAbsent, // Ausencias requieren acción del entrenador
        },
        fcmOptions: { link: "/asistencia" },
      },
    });

    // 7. Limpiar tokens inválidos de Firestore
    const invalidTokens: string[] = [];
    results.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error?.code === "messaging/registration-token-not-registered") {
        invalidTokens.push(fcmTokens[idx]);
      }
    });

    if (invalidTokens.length > 0) {
      await db.collection("users").doc(userDocId).update({
        fcmTokens: fcmTokens.filter((t) => !invalidTokens.includes(t)),
      });
    }

    logger.info(
      `[onAttendanceNotice] Notificación enviada a ${results.successCount}/${fcmTokens.length} dispositivos del entrenador ${coachId}`
    );
  }
);
