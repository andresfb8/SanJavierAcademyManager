import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";

// ---------------------------------------------------------------------------
// Trigger: se ha creado un documento de usuario (alta desde invitacion)
//
// Cuando un entrenador/coordinador activa su invitacion, el cliente escribe
// `coachId` en su propio documento `users/{userId}` (lo puede crear el mismo,
// las reglas se lo permiten), pero NO tiene permiso para escribir en
// `coaches/{coachId}` (esa coleccion exige isAdmin()). Esta funcion, con
// privilegios de administrador, hace ese enlace automaticamente, para que el
// entrenador vea sus grupos/asistencia/particulares asignados desde el
// primer login sin depender del boton manual "Sincronizar cuentas" de
// Personas > Entrenadores.
// ---------------------------------------------------------------------------
export const onUserCreated = onDocumentCreated(
  {
    document: "users/{userId}",
    region: "europe-west1",
  },
  async (event) => {
    const user = event.data?.data();
    if (!user) return;

    const coachId: string | undefined = user.coachId;
    if (!coachId) return;

    const { userId } = event.params;
    const db = getFirestore();
    const coachRef = db.collection("coaches").doc(coachId);
    const coachSnap = await coachRef.get();

    if (!coachSnap.exists) {
      logger.warn(
        `[onUserCreated] No se encontro el coach ${coachId} para el usuario ${userId}.`,
      );
      return;
    }

    if (coachSnap.data()?.userId) {
      logger.info(
        `[onUserCreated] El coach ${coachId} ya tenia userId asignado, no se sobreescribe.`,
      );
      return;
    }

    await coachRef.update({ userId });
    logger.info(`[onUserCreated] Enlazado coach ${coachId} con el usuario ${userId}.`);
  },
);
