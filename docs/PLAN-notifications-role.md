# Plan de Implementación: Filtrado de Notificaciones por Rol

## 1. Visión General

Actualmente, el componente `NotificationBell.tsx` genera las mismas notificaciones (como cobros pendientes) para todos los usuarios, ignorando los permisos de su rol. El objetivo es filtrar la creación de notificaciones para que los entrenadores (y roles sin acceso financiero) no vean notificaciones de pagos, y solo vean alertas relevantes a su función (asistencia pendiente en sus grupos, eventos a los que pueden acceder, etc.).

## 2. Tipo de Proyecto

**WEB** (Uso de `frontend-specialist`).

## 3. Criterios de Éxito

- Los entrenadores no recibirán notificaciones relacionadas con recibos o pagos pendientes.
- Los entrenadores solo recibirán avisos de asistencia pendiente para los grupos que ellos imparten.
- Los directores/coordinadores seguirán viéndolo todo.

## 4. Estructura de Archivos

- **[MODIFICAR]** `src/components/shared/NotificationBell.tsx` - Implementar filtraje basado en el rol/permisos del usuario logueado.

## 5. Desglose de Tareas

### Tarea 1: Aplicar Filtro de Permisos a las Notificaciones

- **Agente:** `frontend-specialist` | **Skill:** `frontend-design`
- **INPUT:** `NotificationBell.tsx`, `authStore.ts`
- **ACCIÓN:**
  1. Importar `useAuthStore` y `hasPermission` en `NotificationBell.tsx`.
  2. Obtener el `user` actual.
  3. Modificar la lógica de "Pagos pendientes": solo evaluar `payments` si `hasPermission(user.role, 'payments', 'read')` es verdadero.
  4. (Opcional pero recomendado) Modificar "Grupos sin asistencia": en el caso de los entrenadores (detectado por su `role` y `coachId`), mostrar alertas solo de los grupos donde ellos figuren como formadores (`g.coachId === currentCoachId`).
- **OUTPUT:** Componente de notificaciones reactivo al nivel de autorización.
- **VERIFY:** Entrar como entrenador y validar que el listado de notificaciones ya no incluye cobros pendientes.

## ✅ FASE X: VERIFICACIÓN

- Seguridad: Los datos financieros no "gotean" en la UI de entrenadores a través de las notificaciones.
- Compilación: `npm run build` sin errores.
