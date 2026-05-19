import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { logger } from "firebase-functions/v2";

// ── Recordatorios de clase para alumnos ───────────────────────────────────────
// Corre cada hora. Para cada clase próxima, comprueba si el alumno ha respondido.
// Si no lo ha hecho, envía una notificación push según el milestone (48h, 24h, 3h).
// Una vez enviado el milestone, lo registra en 'remindersSent' para no repetirlo.

const MILESTONES: Array<{ key: string; minH: number; maxH: number; label: string }> = [
  { key: "48h", minH: 47, maxH: 49, label: "en 2 días" },
  { key: "24h", minH: 23, maxH: 25, label: "mañana" },
  { key: "3h",  minH: 2.5, maxH: 3.5, label: "en 3 horas" },
]

export const classRemindersScheduled = onSchedule(
  {
    schedule: "every 60 minutes",
    timeZone: "Europe/Madrid",
    region: "europe-west1",
    memory: "512MiB",
    timeoutSeconds: 300,
  },
  async () => {
    const db = getFirestore()
    const messaging = getMessaging()
    const now = new Date()

    // 1. Obtener todos los grupos activos
    const groupsSnap = await db
      .collection("groups")
      .where("isActive", "==", true)
      .get()

    if (groupsSnap.empty) return

    let totalSent = 0

    for (const groupDoc of groupsSnap.docs) {
      const group = groupDoc.data()
      const groupId = groupDoc.id
      const schedule: Array<{ dayOfWeek: number; startTime: string; endTime: string }> =
        group.schedule ?? []

      // 2. Calcular próximas clases de este grupo en las próximas 50h
      const upcomingClasses: Array<{ classDate: Date; dateStr: string; startTime: string; hoursUntil: number }> = []

      for (let daysAhead = 0; daysAhead <= 3; daysAhead++) {
        const target = new Date(now)
        target.setDate(target.getDate() + daysAhead)
        const targetDay = target.getDay()

        for (const slot of schedule) {
          if (slot.dayOfWeek !== targetDay) continue
          const [h, m] = slot.startTime.split(":").map(Number)
          const classDate = new Date(target)
          classDate.setHours(h, m, 0, 0)
          const hoursUntil = (classDate.getTime() - now.getTime()) / 3_600_000
          if (hoursUntil < 0 || hoursUntil > 50) continue

          upcomingClasses.push({
            classDate,
            dateStr: classDate.toISOString().split("T")[0],
            startTime: slot.startTime,
            hoursUntil,
          })
        }
      }

      if (upcomingClasses.length === 0) continue

      // 3. Obtener matrículas activas del grupo
      const enrollmentsSnap = await db
        .collection("enrollments")
        .where("groupId", "==", groupId)
        .where("isActive", "==", true)
        .get()

      if (enrollmentsSnap.empty) continue

      const playerIds = enrollmentsSnap.docs.map((d) => d.data().playerId as string)

      // 4. Por cada clase próxima, comprobar milestones
      for (const cls of upcomingClasses) {
        const milestone = MILESTONES.find(
          (m) => cls.hoursUntil >= m.minH && cls.hoursUntil < m.maxH
        )
        if (!milestone) continue

        // Saltar si la clase está cancelada
        const cancelledSnap = await db
          .collection("cancelledClasses")
          .where("groupId", "==", groupId)
          .where("date", "==", cls.dateStr)
          .limit(1)
          .get()
        if (!cancelledSnap.empty) continue

        // 5. Para cada alumno inscrito
        for (const playerId of playerIds) {
          try {
            // a) ¿Ya respondió? (tiene attendanceNotice para este grupo+fecha)
            const noticeSnap = await db
              .collection("attendanceNotices")
              .where("playerId", "==", playerId)
              .where("groupId", "==", groupId)
              .limit(1)
              .get()

            const hasResponse = noticeSnap.docs.some((d) => {
              const date = d.data().date
              const noticeDate = date instanceof Timestamp ? date.toDate() : new Date(date)
              return noticeDate.toISOString().split("T")[0] === cls.dateStr
            })

            if (hasResponse) continue

            // b) ¿Ya enviamos este milestone?
            const reminderDocId = `${playerId}_${groupId}_${cls.dateStr}_${milestone.key}`
            const reminderRef = db.collection("remindersSent").doc(reminderDocId)
            const reminderSnap = await reminderRef.get()
            if (reminderSnap.exists) continue

            // c) Buscar usuario vinculado al jugador
            const usersSnap = await db
              .collection("users")
              .where("linkedPlayerId", "==", playerId)
              .limit(1)
              .get()

            if (usersSnap.empty) continue

            const userDoc = usersSnap.docs[0].data()
            const fcmTokens: string[] = userDoc.fcmTokens ?? []
            if (fcmTokens.length === 0) continue

            // d) Enviar notificación push
            const title = `🎾 Clase ${milestone.label}`
            const body =
              milestone.key === "48h"
                ? `Tienes clase de ${group.name} en 2 días a las ${cls.startTime.slice(0, 5)}. ¿Asistirás?`
                : milestone.key === "24h"
                ? `Mañana tienes clase de ${group.name} a las ${cls.startTime.slice(0, 5)}. ¿Asistirás?`
                : `Tu clase de ${group.name} empieza en 3 horas (${cls.startTime.slice(0, 5)}). Avisa si no puedes.`

            const result = await messaging.sendEachForMulticast({
              tokens: fcmTokens,
              notification: { title, body },
              data: {
                url: "/asistencia",
                tag: `class-reminder-${groupId}-${cls.dateStr}`,
                type: "class_reminder",
                groupId,
                classDate: cls.dateStr,
              },
              webpush: {
                notification: {
                  title,
                  body,
                  icon: "/pwa-192x192.png",
                  badge: "/pwa-64x64.png",
                  tag: `class-reminder-${groupId}-${cls.dateStr}`,
                },
                fcmOptions: { link: "/asistencia" },
              },
            })

            if (result.successCount > 0) {
              // e) Marcar milestone como enviado
              await reminderRef.set({
                sentAt: Timestamp.now(),
                playerId,
                groupId,
                classDate: cls.dateStr,
                milestone: milestone.key,
              })
              totalSent++
            }

            // f) Limpiar tokens inválidos
            const invalidTokens: string[] = []
            result.responses.forEach((resp, idx) => {
              if (
                !resp.success &&
                resp.error?.code === "messaging/registration-token-not-registered"
              ) {
                invalidTokens.push(fcmTokens[idx])
              }
            })
            if (invalidTokens.length > 0) {
              await db
                .collection("users")
                .doc(usersSnap.docs[0].id)
                .update({
                  fcmTokens: fcmTokens.filter((t) => !invalidTokens.includes(t)),
                })
            }
          } catch (err) {
            logger.warn(
              `[classReminders] Error procesando alumno ${playerId} en grupo ${groupId}:`,
              err
            )
          }
        }
      }
    }

    logger.info(`[classReminders] Ciclo completado. Recordatorios enviados: ${totalSent}`)
  }
)
