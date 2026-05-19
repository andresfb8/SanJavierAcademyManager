// Firebase Messaging Service Worker
// Gestiona notificaciones push cuando la app está en background o cerrada.
//
// IMPORTANTE: Completa el campo apiKey con el valor de tu archivo .env
// (VITE_FIREBASE_API_KEY). Los demás valores ya están configurados.

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: self.__FIREBASE_API_KEY__ || 'REPLACE_WITH_YOUR_API_KEY',
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
