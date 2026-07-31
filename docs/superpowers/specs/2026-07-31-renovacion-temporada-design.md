# Renovación de temporada — Diseño

**Fecha:** 2026-07-31
**Estado:** aprobado, pendiente de plan de implementación

## Contexto

Tercer proyecto de la hoja de ruta 2026 (tras el portal de familias y recuperaciones/lista de espera). Hoy no existe ningún concepto de "temporada" operativo en los datos: `Club.seasonStart/seasonEnd` son solo fechas de configuración sin lógica asociada, y los grupos (`Group`) tienen sus propias `startDate/endDate` independientes. Las matrículas (`Enrollment`) son indefinidas hasta que se dan de baja manualmente.

**Objetivo:** dar a admin/coordinador una herramienta para cerrar una temporada y abrir la siguiente: traspasar grupos (con o sin sus alumnos matriculados) a una nueva temporada, en bloque, con la posibilidad de ajustar precio/frecuencia de facturación y excluir alumnos concretos antes de confirmar.

## Decisiones de diseño (validadas con el usuario, incluida validación visual)

1. **`Season` es una entidad formal pero puramente histórica** — solo `name`, `startDate`, `endDate`. Nada más en la aplicación depende de una "temporada activa"; sirve exclusivamente para etiquetar y consultar a qué temporada perteneció cada grupo.

2. **El traspaso es a nivel de grupo, no de propuesta individual por evaluaciones.** El admin elige uno o varios grupos existentes y los traspasa a la temporada siguiente, con sus alumnos matriculados (o sin ellos, si el grupo se reestructura). No hay recomendación automática de nivel basada en `Evaluation` — queda fuera de alcance.

3. **El grupo viejo se archiva; se crea un grupo nuevo.** Al traspasar, el grupo original queda `isActive:false` (visible en su histórico, sin poder recibir más matrículas), y se crea un grupo nuevo, copia editable del anterior, vinculado a la temporada destino. Esto preserva "cómo era el grupo en la temporada pasada" sin mutarlo.

4. **Las matrículas se cierran y se recrean, no se reapuntan.** Todas las matrículas activas del grupo viejo se cierran (`isActive:false`, `unenrollmentDate` = fecha del traspaso) cuando el grupo se archiva — se traspase o no cada alumno. Para los alumnos incluidos en el traspaso, se crea una matrícula nueva en el grupo nuevo. Esto evita que la facturación mensual siga generando cobros por una matrícula de un grupo ya archivado, y permite que el precio/frecuencia de facturación cambien de una temporada a otra sin arrastrar configuración vieja.

5. **Traspaso en bloque, con acordeón de una sola pantalla.** Se pueden seleccionar varios grupos a la vez desde la página "Temporadas"; el asistente de confirmación muestra todos los grupos seleccionados como secciones expandibles en una sola pantalla (no un wizard paso a paso), cada una pre-rellenada y editable.

6. **Cada grupo se puede traspasar con o sin alumnos.** Un interruptor por grupo en el asistente decide si el grupo nuevo nace con los alumnos matriculados (marcados por defecto, desmarcables individualmente para excluir bajas) o vacío (para grupos que se reestructuran completamente).

## Arquitectura

### 1. Modelo de datos

**Nuevo tipo `Season`** (`src/types/index.ts`):
```ts
export interface Season {
  id: string
  name: string
  startDate: Date
  endDate: Date
  createdAt: Date
}
```

**`Group` gana 3 campos opcionales:**
```ts
export interface Group {
  // ...existentes sin cambios...
  seasonId?: string           // temporada a la que pertenece; ausente = "sin temporada asignada" (grupos actuales)
  renewedFromGroupId?: string // si este grupo nació de un traspaso, el id del grupo viejo
  renewedToGroupId?: string   // si este grupo ya fue traspasado, el id del grupo nuevo
}
```

**`Enrollment`**: sin campos nuevos — se reutiliza el patrón existente (crear con `addEnrollment`, cerrar con el mismo mecanismo que ya usa `deactivateEnrollment`).

**`ActivityType`** gana `'season_group_renewed'` (+ etiqueta en `ACTIVITY_LABELS`, color opcional en `ACTIVITY_COLORS`, `ActivityLogPage.tsx`).

**Store (`src/stores/dataStore.ts`):**
- Nuevo slice `seasons: Season[]`, sincronizado por Firestore realtime (patrón ya existente para el resto de colecciones).
- `createSeason(name, startDate, endDate): Season` — crea y persiste una temporada.
- `renewGroup(params): { newGroup, closedEnrollments, newEnrollments }` — la acción central, por grupo:
  1. Crea el grupo nuevo con los campos editados en el asistente (nombre, nivel, entrenador, pista, horario, precio, frecuencia de facturación, fechas — por defecto las de la temporada destino), `seasonId = temporada destino`, `renewedFromGroupId = grupo viejo`, `isActive: true`.
  2. Marca el grupo viejo `isActive: false`, `renewedToGroupId = grupo nuevo`.
  3. Para cada matrícula activa del grupo viejo: la cierra (`isActive:false`, `unenrollmentDate` = fecha del traspaso).
  4. Para cada alumno incluido (según los checkboxes del asistente): crea una matrícula nueva en el grupo nuevo, con el precio/frecuencia del grupo nuevo (sin overrides por alumno en esta primera versión — igual que una alta de matrícula normal).
  5. Registra actividad `season_group_renewed` con referencia a ambos grupos.
- `renewGroups(selections[])` — recorre `renewGroup` para cada grupo seleccionado en el asistente (usado por el botón "Confirmar traspaso de N grupos").

### 2. Página "Temporadas" (`src/pages/SeasonsPage.tsx`, nueva)

- Ruta nueva en el menú (Sidebar), visible solo para `director`/`coordinador` (mismo patrón de guard que el resto de páginas de administración).
- Selector de temporada de **origen** (opciones: cada `Season` existente + "Sin temporada asignada" para los grupos actuales sin `seasonId`, que es el valor por defecto).
- Tabla de grupos activos de la temporada de origen seleccionada: grupo, nivel, nº de alumnos matriculados, estado (`Pendiente` si `renewedToGroupId` está vacío, `✓ Traspasado a <nombre temporada destino>` si no), con checkbox por fila (solo los `Pendiente` son seleccionables).
- Selector de temporada de **destino** + botón "+ Nueva temporada" (diálogo: nombre, fecha inicio, fecha fin) — reutilizable tanto para crear la temporada de origen la primera vez como la de destino.
- Botón "Traspasar seleccionados (N) →", deshabilitado si no hay temporada destino elegida o ningún grupo seleccionado, abre el asistente.

### 3. Asistente de traspaso (`src/components/shared/RenewGroupsDialog.tsx`, nuevo)

- Diálogo/sheet a pantalla completa con un acordeón: una sección expandible por grupo seleccionado.
- Cada sección, pre-rellenada con los datos del grupo viejo y editable:
  - Campos de grupo: nombre, nivel, entrenador, pista, horario, capacidad máxima, tarifa/precio, frecuencia de facturación, fecha inicio/fin (por defecto, las de la temporada destino).
  - Interruptor "Traspasar también a los alumnos matriculados" (activado por defecto).
  - Si está activado: lista de alumnos actualmente matriculados y activos en el grupo viejo, cada uno con checkbox (marcado por defecto), desmarcable para excluirlo del grupo nuevo.
- Botón final "Confirmar traspaso de N grupos" → llama a `renewGroups` con la selección final de cada sección, muestra toast de resultado, cierra el diálogo y refresca la tabla de la página Temporadas (los grupos recién traspasados pasan a `✓ Traspasado`).

### 4. Seguridad (firestore.rules)

`groups` y `enrollments` ya solo permiten escritura a admin (`isAdmin()`, [firestore.rules:120-134](../../../firestore.rules#L120)) — los nuevos campos (`seasonId`, `renewedFromGroupId`, `renewedToGroupId`) no requieren cambios de reglas, ya que se escriben en documentos ya cubiertos por esas reglas. La nueva colección `seasons` necesita sus propias reglas, siguiendo el mismo patrón que `groups`:

```javascript
match /seasons/{seasonId} {
  allow read: if isAuthenticated() && (isAdmin() || belongsToClub());
  allow create: if isAdmin() && (incomingBelongsToClub() || request.resource.data.clubId == null);
  allow update: if isAdmin() && (belongsToClub() || resource.data.clubId == null);
  allow delete: if isAdmin() && (belongsToClub() || resource.data.clubId == null);
}
```

## Fuera de alcance

- Ninguna propuesta automática de grupo por nivel/evaluaciones — el admin elige manualmente qué grupo(s) traspasar y con qué configuración.
- No se introduce el concepto de "temporada activa" en ningún otro punto de la app (facturación, informes, dashboards) — `Season` es puramente informativa/histórica por ahora.
- No se migran retroactivamente los grupos existentes a una `Season`; quedan en el cajón "Sin temporada asignada" hasta que se traspasen por primera vez.
- No hay overrides de precio por alumno dentro del asistente de traspaso — todos los alumnos incluidos en un grupo heredan el precio/frecuencia del grupo nuevo (igual que una matrícula normal ya permite ajustar después, individualmente, desde `GroupDetailPage`).
- No se toca la asistencia, evaluaciones ni informes de partido — quedan asociados al alumno y al grupo viejo (archivado) tal como estaban.

## Verificación manual

1. Crear una temporada "2026-2027" desde la página Temporadas.
2. Con la temporada de origen "Sin temporada asignada" (grupos actuales), seleccionar 2 grupos con alumnos matriculados y pulsar "Traspasar seleccionados".
3. En el asistente: cambiar el precio de un grupo, dejar el otro igual; desmarcar a un alumno en uno de los grupos. Confirmar.
4. Comprobar: aparecen 2 grupos nuevos activos vinculados a "2026-2027"; los 2 grupos viejos quedan `isActive:false` con estado "✓ Traspasado a 2026-2027" en la tabla; el alumno desmarcado no tiene matrícula activa en ningún grupo tras el traspaso; los alumnos incluidos tienen matrícula nueva en el grupo nuevo con el precio editado (si se cambió) y ninguna matrícula activa en el grupo viejo.
5. Repetir la consulta de la tabla con la temporada de origen "2026-2027" recién creada — debe estar vacía de grupos pendientes (los grupos nuevos pertenecen a esa temporada como destino, no como origen todavía).
6. `npm run build` y `npm test` sin errores.
