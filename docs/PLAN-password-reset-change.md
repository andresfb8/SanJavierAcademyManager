# Plan de Implementación: Recuperación y Cambio de Contraseña

## 1. Visión General

El objetivo es permitir a los entrenadores (y personal en general) recuperar el acceso a sus cuentas si olvidan la contraseña (Opción A) y proporcionarles una vía para cambiar su contraseña actual una vez que han iniciado sesión (Opción C).

## 2. Tipo de Proyecto

**WEB** (Uso de `frontend-specialist`, `backend-specialist` y `security-auditor`).

## 3. Criterios de Éxito

- Un usuario no logueado puede solicitar un email de recuperación de contraseña desde la pantalla de login.
- El usuario recibe el correo oficial de Firebase y el enlace funciona.
- Un usuario logueado puede abrir una ventana para cambiar su contraseña actual, requiriendo re-autenticación por seguridad.

## 4. Stack Tecnológico

- **Firebase Auth:** Para el envío del correo de reseteo y el cambio seguro de contraseña (`sendPasswordResetEmail`, `updatePassword`, `reauthenticateWithCredential`).
- **Zustand (`authStore`):** Para centralizar la lógica de autenticación.
- **shadcn/ui (Radix):** `Dialog`, `Input`, `Form` para la interfaz de usuario.

## 5. Estructura de Archivos

- **[MODIFICAR]** `src/stores/authStore.ts` - Añadir métodos `resetPassword` y `changePassword`.
- **[MODIFICAR]** `src/pages/LoginPage.tsx` - Añadir enlace y diálogo de "Olvidé mi contraseña".
- **[MODIFICAR]** `src/components/layout/Sidebar.tsx` - Añadir botón/opción "Cambiar Contraseña" en la zona inferior de perfil.
- **[NUEVO]** `src/components/auth/ChangePasswordDialog.tsx` - Componente del formulario para cambio de contraseña.
- **[NUEVO]** `src/components/auth/ForgotPasswordDialog.tsx` - Componente del formulario para recuperación (opcional, puede integrarse directo en LoginPage).

## 6. Desglose de Tareas

### Tarea 1: Lógica Backend (Zustand & Firebase)

- **Agente:** `backend-specialist` | **Skill:** `api-patterns`
- **INPUT:** `authStore.ts`
- **ACCIÓN:**
  1. Exportar e importar `sendPasswordResetEmail`, `EmailAuthProvider`, `reauthenticateWithCredential` y `updatePassword` de Firebase Auth.
  2. Implementar `resetPassword(email: string)`.
  3. Implementar `changePassword(currentPass: string, newPass: string)` manejando la re-autenticación necesaria usando `auth.currentUser`.
- **OUTPUT:** Funciones accesibles en el store.
- **VERIFY:** Comprobar que TypeScript compila sin errores.

### Tarea 2: Interfaz "Olvidé mi contraseña" (Opción A)

- **Agente:** `frontend-specialist` | **Skill:** `frontend-design`
- **INPUT:** `LoginPage.tsx`
- **ACCIÓN:**
  1. Añadir un botón tipo link ("¿Has olvidado tu contraseña?").
  2. Al hacer clic, abre un `Dialog` pidiendo el email.
  3. Al enviar, llama a `resetPassword` y muestra un `toast` de confirmación.
- **OUTPUT:** UI funcional en el Login.
- **VERIFY:** Pulsar botón, poner email falso, verificar manejo de error o toast de éxito.

### Tarea 3: Interfaz "Cambiar Contraseña" (Opción C)

- **Agente:** `frontend-specialist` | **Skill:** `frontend-design`
- **INPUT:** `Sidebar.tsx`
- **ACCIÓN:**
  1. Crear un nuevo componente `ChangePasswordDialog.tsx` con formulario (Contraseña actual, Nueva contraseña, Confirmar nueva).
  2. Integrarlo en el `Sidebar.tsx` (por ejemplo, junto al botón de cerrar sesión o en un dropdown del usuario).
  3. Conectar el formulario al store y mostrar toast de éxito o error (ej. credencial incorrecta).
- **OUTPUT:** Capacidad de cambiar contraseña con sesión iniciada.
- **VERIFY:** Introducir la contraseña actual correcta y una nueva, comprobar que Firebase modifique los datos y no salte error de seguridad.

## ✅ FASE X: VERIFICACIÓN

- Seguridad: El cambio de contraseña exige la actual (re-autenticación robusta).
- UX: Existen loaders e indicadores de carga durante la espera de operaciones.
- Compilación: `npm run build` pasa limpiamente.
