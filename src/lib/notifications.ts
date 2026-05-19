import { getToken, onMessage, type Messaging } from 'firebase/messaging'
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import { db, messagingPromise } from '@/lib/firebase'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined

// ── Registrar token FCM del dispositivo actual ──────────────────────────────

export async function registerFCMToken(userId: string): Promise<string | null> {
  if (!VAPID_KEY) {
    console.warn('[FCM] VITE_FIREBASE_VAPID_KEY no configurada. Las notificaciones push no funcionarán.')
    return null
  }

  const messaging = await messagingPromise
  if (!messaging) return null

  try {
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.getRegistration(
        '/firebase-messaging-sw.js'
      ),
    })

    if (token) {
      await updateDoc(doc(db, 'users', userId), {
        fcmTokens: arrayUnion(token),
      })
    }

    return token ?? null
  } catch (err) {
    // El usuario denegó el permiso o el navegador no lo soporta
    console.warn('[FCM] No se pudo obtener token:', err)
    return null
  }
}

// ── Eliminar token al cerrar sesión ─────────────────────────────────────────

export async function unregisterFCMToken(userId: string): Promise<void> {
  const messaging = await messagingPromise
  if (!messaging || !VAPID_KEY) return

  try {
    const token = await getToken(messaging, { vapidKey: VAPID_KEY })
    if (token) {
      await updateDoc(doc(db, 'users', userId), {
        fcmTokens: arrayRemove(token),
      })
    }
  } catch {
    // No crítico — el token expirará solo
  }
}

// ── Escuchar mensajes con la app en primer plano ─────────────────────────────
// Llama a este handler en el componente raíz para mostrar toasts en foreground.

export async function onForegroundMessage(
  handler: (payload: { title: string; body: string; url?: string }) => void
): Promise<(() => void) | null> {
  const messaging = await messagingPromise
  if (!messaging) return null

  const unsubscribe = onMessage(messaging as Messaging, (payload) => {
    const title = payload.notification?.title ?? 'San Javier Academy'
    const body = payload.notification?.body ?? ''
    const url = payload.data?.url
    handler({ title, body, url })
  })

  return unsubscribe
}
