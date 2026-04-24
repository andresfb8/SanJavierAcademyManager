# PLAN: Transformación a App Móvil (Capacitor + PWA)

Este plan detalla los pasos para convertir la plataforma web actual en una aplicación móvil funcional para Android e iOS, priorizando la facilidad de mantenimiento y la implementación de notificaciones push.

## Estrategia Seleccionada: Enfoque Híbrido (Capacitor)
Utilizaremos **Capacitor** porque permite mantener una única base de código (React) y generar binarios nativos para las tiendas, además de facilitar la implementación de notificaciones push de forma robusta.

---

## Fase 1: Auditoría y Optimización UI (Responsividad al 100%)
Antes de empaquetar la app, debemos asegurar que la interfaz sea cómoda para dedos y pantallas pequeñas.

- [ ] **Revisión de Tablas:** Convertir tablas anchas (como pagos o grupos) en "Card Views" o listas colapsables en pantallas móviles.
- [ ] **Navegación Móvil:** Implementar un `Bottom Navigation Bar` para las secciones principales (Dashboard, Pagos, Grupos) que solo se muestre en móviles.
- [ ] **Modales y Diálogos:** Ajustar los diálogos para que ocupen el 100% del ancho en móviles (tipo "Drawer" o pantalla completa).
- [ ] **Touch Targets:** Asegurar que todos los botones tengan al menos 44x44px de área de clic.

## Fase 2: Configuración de Capacitor
- [ ] Instalar `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` e `@capacitor/ios`.
- [ ] Configurar `capacitor.config.ts` con el ID del paquete (ej. `com.sanjavier.academy`).
- [ ] Generar los assets (iconos y splash screens) para Android e iOS.
- [ ] Crear el workflow de construcción: `npm run build` -> `npx cap sync`.

## Fase 3: Sistema de Notificaciones Push (Firebase)
Dado que ya usas Firebase, integraremos FCM de forma nativa.

- [ ] **Configuración nativa:** Añadir `google-services.json` (Android) y `GoogleService-Info.plist` (iOS) a los proyectos nativos.
- [ ] **Plugin de Notificaciones:** Instalar `@capacitor/push-notifications`.
- [ ] **Lógica en React:** 
    - Crear un hook `usePushNotifications` para solicitar permisos y registrar el token del dispositivo en el perfil del usuario en Firestore.
    - Manejar la recepción de notificaciones cuando la app está abierta y cerrada.

## Fase 4: Preparación PWA (Opcional pero Recomendado)
Mantener una versión PWA permite que los usuarios que no quieran descargar la app de la tienda puedan usarla con notificaciones.

- [ ] Configurar un `manifest.json` y Service Worker con `vite-plugin-pwa`.
- [ ] Asegurar que el soporte de Web Push esté sincronizado con el sistema de Capacitor.

## Fase 5: Verificación y Despliegue
- [ ] **Pruebas en Simuladores:** Verificar layouts en iPhone 15 y Android Pixel 8.
- [ ] **Pruebas de Push:** Enviar notificaciones de prueba desde el panel de Firebase.
- [ ] **Generación de Binarios:** Crear el `.apk` / `.aab` para Android e iOS (Xcode).

---

## Preguntas Abiertas / Decisiones Pendientes
1. **Identidad de App:** ¿Tienes ya los iconos y el logo en alta resolución para generar los splash screens?
2. **Cuentas de Desarrollador:** ¿Cuentas ya con acceso a Google Play Console ($25 pago único) y Apple Developer Program ($99/año)? Son requisitos obligatorios para subir a las tiendas.

## Próximos Pasos
Una vez aprobado este plan, podemos comenzar con la **Fase 1 (Optimización UI)** directamente en el código actual.
