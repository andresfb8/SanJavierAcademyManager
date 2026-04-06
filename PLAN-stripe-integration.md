# Integración de Pagos Recurrentes (Stripe Billing)

## Goal

Implementar Stripe Billing para automatizar el cobro mensual por tarjeta de los alumnos suscritos, gestionando recibos, reintentos y sincronización con Firestore de forma 100% automática.

## Contexto

- **Volumen**: ~100 alumnos/mes a ~45€/mes.
- **Método**: Solo tarjeta.
- **Arquitectura**: React (Frontend) + Firebase Cloud Functions (Backend/Webhooks) + Firestore (Base de datos).

## Tasks

- [ ] Task 1: Crear proyecto/cuenta en Stripe y obtener API Keys (Public, Secret, Webhook Secret). → Verify: API Keys test añadidas al config local/`.env` de las Cloud Functions.
- [ ] Task 2: Modificar modelo de datos en Firestore (añadir `stripeCustomerId` y `stripeSubscriptionId` a `players`). → Verify: Modelo TypeScript de `Player` actualizado.
- [ ] Task 3: Crear función backend `createCheckoutSession` para iniciar suscripción. → Verify: Llama a Stripe API y devuelve URL de checkout (200 OK).
- [ ] Task 4: Crear flujo de UI en Pestaña "Pagos" (Botón "Suscribirse") mediante `@stripe/stripe-js` (Checkout Redirect). → Verify: Te redirige a la pasarela de pago de Stripe.
- [ ] Task 5: Implementar Webhook Handler (`stripeWebhook`) en Cloud Functions para escuchar eventos `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`. → Verify: Webhook procesa y actualiza el estado de `players` y crea registros en `payments`.
- [ ] Task 6: Crear un panel administrativo (Dashboard Web) simple para ver el estado de las suscripciones (Activa/Cancelada/Fallada). → Verify: La lista de suscripciones refleja la realidad de Stripe.

## Done When

- [ ] Un alumno o admin (en nombre del alumno) puede iniciar una suscripción desde la app.
- [ ] Stripe genera el cargo automático cada mes sin intervención manual.
- [ ] El pago periódico en Stripe crea automáticamente un registro "pagado" en la tabla de cobros de la academia (sincronía en tiempo real).
