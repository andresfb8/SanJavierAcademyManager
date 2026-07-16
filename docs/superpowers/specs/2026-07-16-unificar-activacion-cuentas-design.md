# Unificar la activación de cuentas — Diseño

**Fecha:** 2026-07-16
**Estado:** aprobado, pendiente de plan de implementación

## Contexto

Hoy conviven **dos flujos de activación** para dar acceso al portal, con mecanismos distintos:

| | Flujo A (Usuarios) | Flujo B (ficha del jugador) |
|---|---|---|
| Entrada | Usuarios → Invitaciones → Invitar | Botón "Invitar al portal" en PlayersPage |
| Mecanismo | colección `invitations` (+ `createInvitation`) | campo `player.invitationToken` |
| Enlace | `/activar/{token}` | `/activar-cuenta?token=&email=` |
| Entrega | copiar enlace a mano (sin email) | email automático (Brevo) |
| Alta | `signupFromInvitation` | `signupPlayer` |
| Estado | funciona | **roto** |

El flujo B tiene tres defectos confirmados en el código:

1. **No funciona para un alumno nuevo.** `ActivateAccountPage` resuelve al jugador desde el store (`players.find(...)`), pero `players` solo se puebla estando autenticado (las reglas exigen login). En el dispositivo del alumno el store está vacío → `player` es `undefined` → el formulario se pinta igual ("Bienvenido, Alumno") pero al enviar, `if (!player || !email) return` no hace nada. Callejón sin salida silencioso.
2. **Falso positivo de email.** `sendEmail` sale con un `console.warn` si falta `VITE_BREVO_API_KEY`, pero `invitePlayer` muestra igualmente "Se ha enviado el acceso".
3. **La insignia "Activo" nunca se marca.** Al activar se hace `updatePlayer(id, { invitationStatus: 'active' })` siendo rol `jugador`, y las reglas solo permiten a ese rol tocar campos de contacto (`hasOnly(['phone','email','address','city','postalCode','updatedAt'])`). La escritura se deniega en silencio.

Además `signupPlayer` hardcodea `clubId: 'club-001'`.

**Objetivo:** que los dos puntos de entrada funcionen bien, ambos con email automático, sin mantener dos mecanismos en paralelo.

## Decisiones tomadas con el usuario

1. **Los enlaces ya enviados pueden caducar.** No hace falta una Cloud Function que resuelva tokens antiguos con el Admin SDK; basta con un aviso claro.
2. **Ambos puntos de entrada:** email automático + enlace copiable como alternativa.
3. **El estado del portal se deduce** de `users` + `invitations`, no se guarda en el jugador.

## Arquitectura: un mecanismo, dos puntos de entrada

Se conserva la colección `invitations` (lectura pública por token, caducidad de 7 días, soporte de roles y `linkedPlayerIds`) como **único** mecanismo. El flujo B no se parchea: se reconvierte para usar la misma tubería.

```
Ficha jugador [Invitar]  ─┐
                          ├─→ createInvitation() → invitations/{token} (7 días)
Usuarios [Invitar]       ─┘        ↓
                            email Brevo → /activar/{token}
                                   ↓
                            el alumno establece su contraseña
                                   ↓
                            signupFromInvitation() → Auth + users/{uid}
                                   ↓
                            invitación 'aceptada' → portal
```

Una sola página de activación (`/activar/:token`, ya existente y correcta) y una sola función de alta (`signupFromInvitation`, que ya escribe `role`, `roles`, `clubId`, `linkedPlayerId`/`linkedPlayerIds`).

## Cambios por componente

| Archivo | Acción |
|---|---|
| `src/lib/emailService.ts` | Generalizar `sendPlayerInvitation` → `sendInvitationEmail(dest, url, rol)`; que el fallo de envío sea observable por el llamante |
| `src/stores/dataStore.ts` | Reescribir `invitePlayer` / `bulkInvitePlayers` sobre `createInvitation` + email |
| `src/lib/player-portal-status.ts` | **Crear** helper puro `getPlayerPortalStatus` |
| `src/pages/PlayersPage.tsx` | Filtro, insignias y botón consumen el helper; columna/acción solo para admin |
| `src/pages/UsersPage.tsx` | Enviar email además de generar el enlace copiable |
| `src/components/shared/BulkTutorInviteDialog.tsx` | Ídem para tutores |
| `src/pages/ActivateAccountPage.tsx` | Sustituir el formulario por un aviso de enlace no válido |
| `src/stores/authStore.ts` | Eliminar `signupPlayer` (queda sin uso; arrastra el `clubId` hardcodeado) |
| `src/types/index.ts` | Marcar `invitationToken` / `invitationStatus` como deprecados (se mantienen por compatibilidad, se dejan de escribir) |

### `sendInvitationEmail`

Reutiliza el HTML actual parametrizando el destinatario, la URL de activación y el rol (el texto cambia entre alumno y tutor). **Contrato nuevo:** si falta `VITE_BREVO_API_KEY`, `sendEmail` **lanza excepción** en lugar de salir con un `console.warn` — coherente con lo que ya hace ante un error de la API de Brevo. Así el llamante no puede anunciar un envío que no ocurrió.

### `invitePlayer` / `bulkInvitePlayers`

Dejan de generar token propio y de escribir en el jugador. Pasan a:
1. `createInvitation({ email, role: 'jugador', clubId, createdBy, linkedPlayerId })`.
2. `sendInvitationEmail(...)` con `/activar/{token}`.
3. Aviso que refleje la realidad: enviado, o creado-pero-no-enviado con el enlace para copiar.

### `getPlayerPortalStatus` (función pura, nueva)

```ts
type PortalStatus = 'activo' | 'invitado' | 'sin_acceso'
getPlayerPortalStatus(player, users, invitations, now?): PortalStatus
```

- `activo`: existe un usuario activo con `linkedPlayerId === player.id` o `linkedPlayerIds` que lo incluya.
- `invitado`: existe una invitación `pendiente` y sin caducar que **o bien lo enlaza por id** (`linkedPlayerId` / `linkedPlayerIds`) **o bien va dirigida a su email**.
- `sin_acceso`: ninguna de las dos.

Precedencia: `activo` gana sobre `invitado`. Emails comparados normalizados (trim + minúsculas).

**Por qué el enlace por id y no solo el email:** las invitaciones de tutor se envían al email del **guardián** (`player.guardian.email`) y enlazan a los hijos por `linkedPlayerIds`. Si `invitado` mirase solo el email del jugador, un menor con invitación de tutor pendiente aparecería como `sin_acceso` justo durante la ventana en la que la insignia importa — y pasaría a `activo` al aceptarse, porque esa rama sí mira los enlaces. Las dos ramas deben ser simétricas.

Un jugador sin email propio (caso habitual en menores) puede por tanto ser `invitado` si una invitación lo enlaza por id.

**Nota sobre `expiresAt`:** está tipado `Date`, pero `invitations` se persiste en localStorage vía el `partialize` del store, así que tras rehidratar llega como string ISO. La coerción `new Date(inv.expiresAt)` es obligatoria y debe quedar cubierta por un test para que nadie la "simplifique".

### Manejo de errores

- **Brevo falla o no está configurado:** la invitación ya existe; se muestra el enlace copiable con un aviso honesto. Nunca un "enviado" falso.
- **Enlace caducado / ya usado:** ya lo cubre `ActivateInvitationPage`.
- **Enlace legacy `/activar-cuenta`:** aviso claro + botón a login.

## Tests

El proyecto **no tiene framework de tests**. Se añade **Vitest** (script `test`, configuración mínima sobre la de Vite ya existente).

Se testea **solo `getPlayerPortalStatus`**, por ser pura y gobernar filtro, insignias y acción. El resto del cambio es pegamento con Firestore/red: mockearlo daría poca señal a mucho coste.

Casos:
- usuario vinculado por `linkedPlayerId` → `activo`
- usuario vinculado por `linkedPlayerIds` (tutor) → `activo`
- usuario vinculado pero `isActive: false` → no cuenta como `activo`
- invitación pendiente y vigente → `invitado`
- invitación pendiente pero caducada → `sin_acceso`
- invitación `aceptada` sin usuario → `sin_acceso`
- usuario vinculado + invitación pendiente → `activo` (precedencia)
- email con distinta capitalización/espacios → casa igual
- jugador sin email → `sin_acceso`

## Alcance excluido (YAGNI)

- Cloud Function para resolver tokens antiguos (decidido: los enlaces viejos caducan).
- Sincronizar `invitations` a entrenadores: la columna/acción de portal pasa a ser solo de admin.
- Tests de la capa Firestore/email.

## Verificación manual

1. `npm run build` sin errores y `npm test` en verde.
2. **Ficha del jugador:** invitar a un alumno con email → llega el correo → abrir enlace → establecer contraseña → entra a su portal → la lista lo marca **Activo**.
3. **Usuarios:** invitar a un jugador → llega el correo y además el enlace es copiable.
4. **Tutor:** invitación masiva a un tutor con 2 hijos → activa → ve el selector de hijo.
5. **Sin Brevo:** quitar temporalmente `VITE_BREVO_API_KEY` → el aviso debe decir que no se envió y ofrecer el enlace (nunca "enviado").
6. **Legacy:** abrir un `/activar-cuenta?token=x&email=y` → aviso claro, sin formulario muerto.
