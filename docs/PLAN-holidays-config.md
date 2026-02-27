# Plan de Desarrollo: Configuración de Días Festivos

## Overview

El objetivo es permitir a los administradores de la academia definir "Días Festivos" específicos desde el módulo de Configuración. Estos días actuarán como un aviso visual en la plataforma, informando a los entrenadores (y deshabilitando temporalmente o saltando) clases en la planificación metodológica y, posiblemente, en la lista de asistencia, pero sin bloquear el sistema de forma estricta (solo de carácter informativo/visual).

## Project Type

**WEB** (Uso del `frontend-specialist`, `backend-specialist`, y `database-architect`).

## Success Criteria

- [ ] La pestaña "Configuración" (o similar) cuenta con una sección para añadir/eliminar festivos mediante un date picker.
- [ ] Los festivos se guardan en la base de datos asociados a una fecha específica (día/mes/año).
- [ ] Al visualizar la pestaña de Planificación de un grupo, las sesiones que coinciden con un festivo se marcan visualmente como "Festivo" y la sesión metodológica correspondiente se "Salte" (pierde su lugar o se omite visualmente).
- [ ] En las pantallas de pase de asistencia / Agenda, los festivos aparecen claramente indicados con un aviso visual para que el entrenador esté al tanto.

## Tech Stack

- Frontend: React / Tailwind CSS / Lucide Icons.
- Storage: Firebase Firestore (Colección dedicada `settings_holidays` o integrado en un documento global de configuración).
- Componentes: Date picker de la UI actual para selección de días.

## File Structure

- `src/types/settings.ts` (Nuevo o Modificado: definir la interfaz `Holiday`).
- `src/lib/settings-service.ts` (Nuevo o Modificado: CRUD para acceder a la configuración de la academia).
- `src/pages/SettingsPage.tsx` (Añadir la sección de Festivos).
- `src/components/settings/HolidaysManager.tsx` (Componente de UI para añadir y listar festivos).
- `src/components/groups/GroupTrainingPlanTab.tsx` (Modificar la lógica de `calculateSessionDates` para cruzar las fechas contra la lista global de festivos).

## Task Breakdown

### Fase 1: Backend & Settings UI

- **Task 1:** Definir la estructura de datos para un `Holiday` en `/types` y crear el servicio Firebase `getHolidays`, `addHoliday`, `deleteHoliday`.
  - **Agent/Skill:** `backend-specialist` (`api-patterns`).
  - **INPUT→OUTPUT→VERIFY:** Interfaz TypeScript → Funciones en `settings-service.ts` → Verificar que se puede crear y leer un documento en Firestore.
- **Task 2:** Crear la UI en `SettingsPage.tsx` con un calendario (Date Picker) y una tabla/lista mostrando los días ya guardados. Permitir crear y borrar.
  - **Agent/Skill:** `frontend-specialist` (`frontend-design`, `react-best-practices`).
  - **INPUT→OUTPUT→VERIFY:** Servicio de Holidays → Componente `HolidaysManager` → Botones funcionan y actualizan estado local + base de datos.

### Fase 2: Integración Metodológica (Saltar Clases)

- **Task 3:** Modificar `calculateSessionDates` en `session-record-service.ts` para que acepte un arreglo de fechas Festivas y las etiquete en el mapeo de la sesión.
  - **Agent/Skill:** `backend-specialist` (`nodejs-best-practices`).
  - **INPUT→OUTPUT→VERIFY:** Data actual de `calculateSessionDates` → Nueva lógica de cálculo → Las sesiones que caen en día festivo devuelven `isHoliday: true` y posiblemente omiten el parámetro de esa clase.
- **Task 4:** Actualizar la UI en `GroupTrainingPlanTab.tsx` para renderizar una tarjeta distinta o con un color especial (Aviso Visual) cuando una fecha corresponde a un festivo.
  - **Agent/Skill:** `frontend-specialist` (`tailwind-patterns`).
  - **INPUT→OUTPUT→VERIFY:** Parámetro `isHoliday` → Tarjeta roja/naranja de "Día Festivo" en UI → Verificación visual en localhost.

### Fase 3: Integración Agenda y Asistencia (Opcional, TBD)

- **Task 5:** Modificar `AgendaPage.tsx` o vistas relacionadas para que, si el día mostrado es festivo, se pinte un banner o badge indicando "Día Festivo".
  - **Agent/Skill:** `frontend-specialist` (`web-design-guidelines`).
  - **INPUT→OUTPUT→VERIFY:** Revisión visual de renderizado en Agenda.

## Phase X: Verification

- [ ] Listado de festivos carga y se añade correctamente usando DatePicker.
- [ ] Festivos se eliminan de la lista global de Settings.
- [ ] Una sesión de la plantilla que cae en 25/Dic (ejemplo) se omite o marca como festivo y el currículum de ese día se pierde/saltea.
- [ ] Pantalla no se bloquea duramente para otras acciones.
- [ ] Ejecutar `npm run typecheck` sin errores de compilación de Typescript.
