// Firebase Messaging Service Worker
// Gestiona notificaciones push cuando la app está en background o cerrada.
//
// Este archivo se sirve tal cual desde /public — Vite no lo procesa ni
// sustituye variables de entorno en él, así que la apiKey va literal.
// No es un secreto: es la misma clave pública ya embebida en el bundle
// principal de la app (identifica el proyecto Firebase; el control de
// acceso lo dan las Reglas de Seguridad y las restricciones de la key
// en Google Cloud Console, no su confidencialidad).

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyCHK_Al4Sh6bqjiTXLuY84QO3A-rUR-oW8',
  authDomain: 'san-javieracademy-manager.firebaseapp.com',
  projectId: 'san-javieracademy-manager',
  storageBucket: 'san-javieracademy-manager.firebasestorage.app',
  messagingSenderId: '557815904781',
  appId: '1:557815904781:web:ab141e4f43a74cf67cf344',
})

const messaging = firebase.messaging()

// Notificaciones recibidas con la app en background o cerrada
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon, badge, data } = payload.notification ?? {}

  const options = {
    body: body || '',
    icon: icon || '/pwa-192x192.png',
    badge: badge || '/pwa-64x64.png',
    data: payload.data || {},
    tag: payload.data?.tag || 'sj-notification',  // agrupa por tipo
    renotify: true,
    vibrate: [200, 100, 200],
  }

  self.registration.showNotification(title || 'San Javier Academy', options)
})

// Al hacer clic en la notificación, abre/enfoca la app
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const urlToOpen = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const existing = windowClients.find((c) => c.url.includes(self.location.origin))
      if (existing) {
        existing.focus()
        existing.navigate(urlToOpen)
      } else {
        clients.openWindow(urlToOpen)
      }
    })
  )
})
