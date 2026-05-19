import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { registerFCMToken, onForegroundMessage } from '@/lib/notifications'
import { toast } from '@/hooks/use-toast'

// Registra el service worker de FCM y solicita permiso de notificaciones.
// Llamar una sola vez al montar App cuando el usuario está autenticado.

export function useNotificationSetup() {
  const { user, isAuthenticated } = useAuthStore()
  const registeredRef = useRef(false)

  // ── Registrar token FCM tras login ──────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !user?.id || registeredRef.current) return
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return

    async function setup() {
      // Registrar el SW de FCM explícitamente
      try {
        await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' })
      } catch (err) {
        console.warn('[FCM] Error registrando SW:', err)
        return
      }

      // Pedir permiso si aún no se ha hecho
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return
      }

      if (Notification.permission !== 'granted') return

      await registerFCMToken(user!.id)
      registeredRef.current = true
    }

    setup()
  }, [isAuthenticated, user?.id])

  // ── Mostrar notificaciones en foreground como toast ──────────────────────
  useEffect(() => {
    if (!isAuthenticated) return

    let unsubscribe: (() => void) | null = null

    onForegroundMessage(({ title, body }) => {
      toast.info(`${title}: ${body}`)
    }).then((unsub) => {
      unsubscribe = unsub
    })

    return () => {
      unsubscribe?.()
    }
  }, [isAuthenticated])
}
