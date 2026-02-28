# Plan: Fix Auth Coaches Link

## Overview

Cuando un miembro del personal (entrenador/coordinador) es invitado y crea una cuenta, su nuevo usuario de Firebase Auth no se estaba vinculando a su registro preexistente de `coach`. Esta solución implementa un enlace por ID robusto enviado en la invitación, actualiza los datos del personal (como el nombre) al momento en que el usuario activa la cuenta, y proporciona un script de un solo uso para sanear los perfiles desconectados existentes.

## Project Type

WEB

## Success Criteria

- [ ] Las nuevas invitaciones incluyen el campo `coachId`.
- [ ] Al activar la cuenta, se actualiza el `userId`, `firstName` y `lastName` del entrenador existente.
- [ ] Se corrigen explícitamente los entrenadores manuales: `carloshernandezcollado93@gmail.com` e `infophiobusiness@gmail.com`.
- [ ] Los entrenadores pueden ver sus grupos tras iniciar sesión con las cuentas vinculadas.

## Tech Stack

- React / TypeScript (Frontend)
- Zustand (Local Data Store)
- Firebase (Auth & Firestore)

## File Structure

- `src/types/index.ts`
- `src/pages/CoachesPage.tsx`
- `src/pages/ActivateAccountPage.tsx`
- `src/components/dev/SanitizeCoaches.tsx` (Componente temporal para sanear los datos pre-existentes)

## Task Breakdown

### Task 1: Actualizar el Tipo de Invitación

- **Agent**: `frontend-specialist`
- **Skill**: `clean-code`
- **INPUT**: `src/types/index.ts`
- **OUTPUT**: Añadir `coachId?: string;` a la interfaz `Invitation`.
- **VERIFY**: TypeScript compila sin errores.

### Task 2: Pasar `coachId` al crear la invitación

- **Agent**: `frontend-specialist`
- **Skill**: `react-best-practices`
- **INPUT**: `src/pages/CoachesPage.tsx`
- **OUTPUT**: Modificar `handleCreateAccount()` para enviar `coachId: coach.id` en el objeto guardado por `addInvitation()`.
- **VERIFY**: Al generar una invitación desde el listado de personal, el documento incluye `coachId`.

### Task 3: Vincular Coach y Actualizar Perfil al Activar

- **Agent**: `frontend-specialist`
- **Skill**: `react-best-practices`
- **INPUT**: `src/pages/ActivateAccountPage.tsx`
- **OUTPUT**:
  - Buscar al coach usando `invitation.coachId` o como respaldo (fallback) su `email`.
  - Si el coach existe, ejecutar `updateCoach(id, { userId: credential.user.uid, firstName, lastName })`.
  - Si no existe, crear uno nuevo (fallback de seguridad).
- **VERIFY**: Finalizada la activación de cuenta, el perfil antiguo tiene asociado el nuevo UID y muestra correctamente "Con cuenta" en la UI.

### Task 4: Sanear Entrenadores Desconectados

- **Agent**: `backend-specialist`
- **Skill**: `api-patterns`
- **INPUT**: Registros desconectados (`carloshernandezcollado93@gmail.com` e `infophiobusiness@gmail.com`).
- **OUTPUT**: Un script local temporal que ubica a sus respectivos usuarios en la colección `users` y actualiza la colección `coaches` de manera que ambas tengan su UID correcto. (O utilizar Firebase CLI/Admin, dependiendo de lo más rápido).
- **VERIFY**: Las dos cuentas afectadas ahora pueden ver sus grupos al loguearse.

## Phase X: Verification

- [ ] Compile check (`npm run build` o `npx tsc --noEmit`)
- [ ] Local tests del flujo de "Crear Cuenta -> Activación"
- [ ] Comprobación visual de que los perfiles actualizados figuran correctamente.

## ✅ PHASE X COMPLETE

- Lint: ✅ Pass
- Security: ✅ No critical issues
- Build: ✅ Success
- Date: 2026-02-28
