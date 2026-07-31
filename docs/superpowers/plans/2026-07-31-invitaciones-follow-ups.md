# Follow-ups de la unificación de invitaciones — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Corregir los 4 follow-ups pendientes (no bloqueantes) descubiertos en la revisión de código de la unificación de activación de cuentas (mergeada 2026-07-21, ver memoria `activacion-cuentas-unificada`). El follow-up #1 (CoachesPage roto) ya se resolvió; quedan estos 4.

**Architecture:** Cuatro correcciones independientes y acotadas sobre archivos ya existentes (`src/lib/invitations.ts`, `src/stores/authStore.ts`, `src/pages/ActivateInvitationPage.tsx`, y los call-sites que crean invitaciones). No se crean colecciones ni mecanismos nuevos — se reutiliza `deleteInvitation` (ya existe en `dataStore.ts`) y `isInvitationLive` (ya existe en `invitation-utils.ts`).

**Tech Stack:** React 19 + TypeScript, Zustand, Firebase Firestore, Vitest.

---

### Task 1: Rollback de invitación local si falla el `setDoc` en Firestore

**Files:**
- Modify: `src/lib/invitations.ts` (función `createInvitation`)

**Contexto:** Hoy `createInvitation` llama a `useDataStore.getState().addInvitation(...)` (inserción optimista en el store local) **antes** de `await setDoc(doc(db, 'invitations', token), invitationData)`. Si el `setDoc` falla (offline, permisos, cuota), no hay rollback: la invitación queda "fantasma" en el store local (aparece en la pestaña "Invitaciones" de UsersPage, es copiable, cuenta en stats) pero no existe en Firestore, así que `/activar/{token}` dará 404 para siempre.

Además, `addInvitation` en `dataStore.ts` ya hace su propio `syncDoc('invitations', ...)` fire-and-forget además del `setDoc` explícito de `createInvitation` — hay doble escritura al mismo documento. Para no tocar `addInvitation` (usado en otros sitios) ni introducir una segunda fuente de reintentos, la corrección se limita a: hacer el `setDoc` explícito la única escritura remota que se espera, y revertir la inserción local si falla.

- [ ] **Paso 1: Leer la función completa actual**

Leer `src/lib/invitations.ts` completo antes de tocar nada, para confirmar la firma exacta de `createInvitation`, el nombre exacto de la variable `token`, y el orden actual de las líneas (`addInvitation` seguido de `setDoc`).

- [ ] **Paso 2: Envolver el `setDoc` en try/catch con rollback**

Reordenar así (usando los nombres reales que aparezcan en el archivo — este es el patrón, no un diff literal si los nombres difieren):

```ts
useDataStore.getState().addInvitation({ ...invitationData, id: token } as Invitation)

try {
  await setDoc(doc(db, 'invitations', token), invitationData)
} catch (error) {
  useDataStore.getState().deleteInvitation(token)
  throw error
}
```

`deleteInvitation` ya existe en `src/stores/dataStore.ts` (elimina del store local y de Firestore). Al usarlo aquí como rollback, si el `setDoc` original falló porque no hay red/permisos, es esperable que el `deleteFirestoreDoc` interno de `deleteInvitation` también falle silenciosamente o no encuentre el doc — está bien, lo importante es que el estado local se limpie. No añadir manejo especial para ese caso.

No cambiar la firma pública de `createInvitation` ni el comportamiento de éxito (debe seguir devolviendo lo mismo que hoy cuando todo va bien).

- [ ] **Paso 3: Verificar que el error se sigue propagando a los call-sites**

Los call-sites (`UsersPage.tsx`, `CoachesPage.tsx`, `BulkTutorInviteDialog.tsx`) ya capturan el error de `createInvitation` en sus propios `try/catch` para mostrar un toast — confirmar (leyendo esos 3 archivos) que siguen funcionando igual, ya que solo cambia que ahora, además del toast de error, el estado local queda limpio.

- [ ] **Paso 4: Build**

Run: `npm run build`
Expected: sin errores de TypeScript.

- [ ] **Paso 5: Commit**

```bash
git add src/lib/invitations.ts
git commit -m "fix: revertir invitacion local si falla la escritura en Firestore"
```

---

### Task 2: `clearDataStore` debe limpiar también `users`

**Files:**
- Modify: `src/stores/authStore.ts` (función `clearDataStore`, líneas ~49-69)

**Contexto:** `clearDataStore()` resetea `courts, tariffs, players, coaches, groups, enrollments, privateLessons, invitations, events, coachSalaryConfigs, attendanceNotices, vouchers, attendance, payments, evaluations, matchReports, invoices` pero **no** `users`. `getPlayerPortalStatus()` (`src/lib/player-portal-status.ts`) calcula el estado "Portal Activo" leyendo `users`. En un navegador compartido, tras cerrar sesión, `users` queda con datos del club anterior en memoria hasta que el nuevo listener lo sobrescriba — pudiendo mostrar "Portal Activo" incorrecto brevemente o de forma persistente si el timing falla.

- [ ] **Paso 1: Leer `clearDataStore` completa**

Leer `src/stores/authStore.ts` líneas 40-75 (aprox) para confirmar la lista exacta de claves que se resetean hoy y el tipo por defecto de cada una (todas deberían ser `[]`).

- [ ] **Paso 2: Añadir `users: []` al objeto que se pasa a `setState`**

Añadir la clave `users: []` junto a las demás, respetando el orden/estilo existente (alfabético o el que siga el archivo).

- [ ] **Paso 3: Build**

Run: `npm run build`
Expected: sin errores de TypeScript (confirmar que `users` es efectivamente una clave válida de `DataStoreState` — ya confirmado en `dataStore.ts:106`).

- [ ] **Paso 4: Commit**

```bash
git add src/stores/authStore.ts
git commit -m "fix: limpiar users al cerrar sesion para evitar Portal Activo obsoleto"
```

---

### Task 3: Invalidar invitaciones anteriores al reinvitar al mismo destinatario

**Files:**
- Modify: `src/lib/invitations.ts` (función `createInvitation`)

**Contexto:** Reinvitar (crear una nueva invitación para el mismo jugador/entrenador/tutor) no invalida la(s) invitación(es) anterior(es) para el mismo destinatario. Si un admin corrige un email con errata y reinvita, el enlace viejo (con el email/token erróneo) sigue siendo válido y usable. `deleteInvitation(id)` ya existe y funciona (borra del store local y de Firestore). La corrección se centraliza dentro de `createInvitation` (que ya es, según su propio comentario, "el único punto que persiste invitaciones") en vez de duplicarla en cada call-site.

- [ ] **Paso 1: Leer `CreateInvitationParams` y el cuerpo de `createInvitation`**

Confirmar los campos disponibles para identificar "mismo destinatario": `email`, `linkedPlayerId`, `linkedPlayerIds`, `coachId` (leer `src/lib/invitations.ts` completo, incluida la interfaz de parámetros).

- [ ] **Paso 2: Antes de crear la nueva invitación, buscar y borrar las anteriores del mismo destinatario**

Al principio de `createInvitation`, tras validar los parámetros de entrada pero antes de generar el `token` nuevo, añadir una búsqueda sobre `useDataStore.getState().invitations` (el array ya está en el store) que identifique invitaciones previas para el mismo destinatario, usando esta prioridad de coincidencia (usar la primera que aplique según qué parámetros trae la llamada):
  - Si `params.coachId` está presente: coincide cualquier invitación existente con el mismo `coachId`.
  - Si `params.linkedPlayerId` está presente: coincide cualquier invitación existente con el mismo `linkedPlayerId`.
  - Si `params.linkedPlayerIds` está presente: coincide cualquier invitación existente cuyo `linkedPlayerIds` tenga intersección no vacía con `params.linkedPlayerIds`.
  - En cualquier otro caso: coincide por `email` normalizado (mismo `.toLowerCase().trim()`).

  Solo debe invalidarse una invitación previa si sigue "viva" o pendiente (no hace falta filtrar por estado — invalidar también una ya aceptada/expirada no causa daño, simplemente no debería ser necesario en la práctica, pero no añadir esa complejidad: borrar todas las que coincidan por destinatario es más simple y correcto).

  Para cada invitación encontrada, llamar a `useDataStore.getState().deleteInvitation(match.id)` antes de proceder a crear la nueva.

- [ ] **Paso 3: Build**

Run: `npm run build`
Expected: sin errores de TypeScript.

- [ ] **Paso 4: Commit**

```bash
git add src/lib/invitations.ts
git commit -m "fix: invalidar invitaciones anteriores del mismo destinatario al reinvitar"
```

---

### Task 4: `ActivateInvitationPage` debe usar `isInvitationLive` en vez de lógica inline

**Files:**
- Modify: `src/pages/ActivateInvitationPage.tsx`

**Contexto:** El componente calcula la caducidad/vigencia de la invitación de forma inline (`inv.status === 'expirada' || inv.expiresAt < new Date()`), duplicando y divergiendo de `isInvitationLive` (`src/lib/invitation-utils.ts`), que trata como "no viva" cualquier estado distinto de `'pendiente'` (no solo `'expirada'`), además de comparar con `new Date(inv.expiresAt).getTime()`.

- [ ] **Paso 1: Leer `ActivateInvitationPage.tsx` completo**

Confirmar el bloque exacto de validación (líneas ~59-66 aprox.) y los mensajes de error mostrados para cada caso (`'aceptada'` → "ya fue utilizada", expirada → mensaje de caducidad).

- [ ] **Paso 2: Importar `isInvitationLive` y sustituir la condición de expiración**

```ts
import { isInvitationLive } from '@/lib/invitation-utils'
```

Mantener el `if (inv.status === 'aceptada') { ...mensaje "ya fue utilizada"... return }` explícito tal cual (mensaje específico, no lo cubre `isInvitationLive`). Sustituir la condición `inv.status === 'expirada' || inv.expiresAt < new Date()` por `!isInvitationLive(inv)`, conservando el mismo mensaje de error que ya se muestra para el caso de caducidad/no-vigencia.

- [ ] **Paso 3: Build**

Run: `npm run build`
Expected: sin errores de TypeScript.

- [ ] **Paso 4: Commit**

```bash
git add src/pages/ActivateInvitationPage.tsx
git commit -m "fix: usar isInvitationLive en ActivateInvitationPage en vez de logica inline"
```

---

## Verificación final (tras las 4 tareas)

1. `npm run build` sin errores.
2. `npm test` — deben seguir pasando los 31 tests existentes (ninguna de estas tareas añade tests nuevos porque son fixes puntuales sobre lógica ya cubierta indirectamente o no cubierta por los tests de `invitation-utils.test.ts`; si el reviewer de calidad considera que Task 3 merece un test unitario para la función de "buscar coincidencia de destinatario", puede sugerirlo, pero no es requisito de este plan).
3. Revisión manual (si es posible en dev/emuladores): crear una invitación, forzar un fallo de red simulado no es práctico manualmente — confiar en la revisión de código para Task 1. Para Task 3: invitar dos veces al mismo jugador y confirmar que solo queda una invitación viva en la pestaña "Invitaciones" de UsersPage.
