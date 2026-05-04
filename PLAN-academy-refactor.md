# Plan de Refactorización: Academy Manager (Soft UI & Vouchers)

## Visión General
Refactorización integral de la plataforma de gestión deportiva dividida en 4 fases:
1. Rediseño visual global usando "Soft UI" / "Bento Card".
2. Mejoras en el panel de profesor (Dashboard de Clases y Asistencia).
3. Sistema de confirmación de alumnos (Lógica 48h).
4. Sistema de Bonos (Vouchers) para gestión de huecos libres.

## 🛑 Socratic Gate (Preguntas Estratégicas)
Antes de comenzar la implementación, necesitamos aclarar los siguientes puntos críticos:

> [!IMPORTANT]
> **Por favor, responde a estas preguntas para continuar con el desarrollo:**
> 1. **Confirmación 48h:** Una vez que el alumno pulsa "Sí, asistiré" o "No podré ir", ¿puede cambiar de opinión si aún está dentro del plazo de 48h?
> 2. **Huecos Libres:** Al liberarse una plaza (cuando alguien pulsa "No podré ir"), ¿el hueco se asigna por orden de llegada (first-come, first-served) o hay un sistema de lista de espera?
> 3. **Gestión de Bonos:** ¿El pago de los bonos se gestionará a través de la plataforma (ej. Stripe) o el administrador los creará manualmente tras recibir el pago externamente?

## Tipo de Proyecto
WEB (React, TypeScript, Tailwind CSS, Firebase)

## Criterios de Éxito
- La UI refleja un diseño "Soft UI" con esquinas redondeadas y sombras difusas (bg-slate-50, bg-white, shadow-sm).
- El profesor puede ver un resumen claro de asistencia y gestionar a los alumnos rápidamente.
- El alumno recibe alertas 48h antes de su clase para confirmar/cancelar asistencia.
- El sistema de bonos permite descontar clases automáticamente al unirse a huecos libres.

## Estructura de Archivos (Nuevos)
- `src/lib/api/vouchers.ts`
- `src/pages/VouchersPage.tsx`
- `src/pages/CoachDashboard.tsx` (opcional, evaluar refactor de `CoachProfilePage.tsx`)

---

## Desglose de Tareas

### FASE 1: Rediseño Visual Global (Estilo Soft UI)
- **Tarea 1.1:** Actualizar `MainLayout.tsx` para usar `bg-slate-50` como fondo global. Configurar Bottom Navigation Bar para móvil.
  - *Agente/Habilidad:* `frontend-specialist` / `frontend-design`
  - *Verificación:* Renderizado en móvil muestra navbar inferior, desktop mantiene sidebar.
- **Tarea 1.2:** Modificar `card.tsx` y `button.tsx` para incorporar bordes `rounded-2xl`/`rounded-full` y sombras difusas.
  - *Agente/Habilidad:* `frontend-specialist` / `shadcn`
  - *Verificación:* Todos los botones y tarjetas de la app adoptan el nuevo estilo.
- **Tarea 1.3:** Actualizar `StatusBadge.tsx` y `Sidebar.tsx` con la nueva paleta de colores pastel y resaltados.
  - *Agente/Habilidad:* `frontend-specialist` / `ui-tokens`
  - *Verificación:* Estados muestran colores pastel; menú activo se resalta correctamente.

### FASE 2: Funcionalidades de Profesor y Administrador
- **Tarea 2.1:** Implementar vista "Tus próximas clases (Hoy)" en `CoachProfilePage.tsx` con tarjetas interactivas y botones rápidos (Pasar Lista, Traspasar, Cancelar, Bloquear).
  - *Agente/Habilidad:* `frontend-specialist` / `react-patterns`
  - *Verificación:* Los botones rápidos ejecutan las acciones esperadas en la base de datos o abren los modales correspondientes.
- **Tarea 2.2:** Añadir "Resumen Visual de Asistencia" (Bloques Verde, Rojo, Amarillo) en `AttendanceStatusButtons.tsx`.
  - *Agente/Habilidad:* `frontend-specialist` / `react-component-performance`
  - *Verificación:* Contadores reflejan en tiempo real el estado de asistencia de los alumnos.
- **Tarea 2.3:** Crear estructura base para vista de "Huecos Libres" mostrando lista de clases disponibles y botón "Unirme".
  - *Agente/Habilidad:* `frontend-specialist` / `ui-page`
  - *Verificación:* La vista carga correctamente los datos mock/reales de clases con plazas > 0.

### FASE 3: Sistema de Confirmación del Alumno
- **Tarea 3.1:** Actualizar `PlayerDashboard.tsx` para destacar la "Próxima Clase" y añadir lógica de cálculo de 48h.
  - *Agente/Habilidad:* `frontend-specialist` / `fp-pragmatic`
  - *Verificación:* UI cambia mostrando botones de confirmación solo si `claseTime - currentTime <= 48h`.
- **Tarea 3.2:** Implementar lógica de botones "Sí, asistiré" y "No podré ir", con integración a `ConfirmDialog.tsx` y actualización a estado `CANCELLED`.
  - *Agente/Habilidad:* `frontend-specialist` / `react-patterns`
  - *Verificación:* Cancelar libera plaza y actualiza el contador en tiempo real.

### FASE 4: Sistema de Bonos de Clases (Vouchers)
- **Tarea 4.1:** Crear modelo de datos Firestore y funciones CRUD en `src/lib/api/vouchers.ts`.
  - *Agente/Habilidad:* `backend-specialist` / `database-design`
  - *Verificación:* Pruebas unitarias/manuales de creación, actualización y consumo de bonos.
- **Tarea 4.2:** Desarrollar `VouchersPage.tsx` para administradores (StatCards, tabla de bonos, modal de creación).
  - *Agente/Habilidad:* `frontend-specialist` / `ui-page`
  - *Verificación:* Administrador puede visualizar estadísticas y crear nuevos bonos.
- **Tarea 4.3:** Integrar lógica de consumo de bonos en la reserva de "Huecos Libres" (batch update en Firestore).
  - *Agente/Habilidad:* `backend-specialist` / `firebase`
  - *Verificación:* Reservar resta una clase del bono y añade al alumno a la sesión simultáneamente.

---

## ✅ PHASE X: VERIFICACIÓN FINAL
- [ ] Lint & Type Check
- [ ] Revisión de Diseño (Soft UI implementado)
- [ ] Pruebas funcionales de Flujo Alumno y Profesor
- [ ] Build exitoso
