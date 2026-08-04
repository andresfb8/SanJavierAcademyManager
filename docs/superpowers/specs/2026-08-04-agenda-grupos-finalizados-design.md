# Agenda y métricas no distinguen grupos finalizados — Diseño

**Fecha:** 2026-08-04
**Estado:** aprobado, pendiente de plan de implementación

## Contexto

El usuario reportó que la Agenda muestra hoy clases de grupos cuya temporada ya terminó. Investigación (depuración sistemática): `Group.startDate`/`endDate` no se comprueban en ningún sitio del código contra la fecha actual — son campos que solo se editan en el formulario de `GroupsPage.tsx` y nunca se leen para decidir si un grupo "sigue en curso". Lo único que determina si un grupo aparece en la agenda o cuenta en las métricas es `group.isActive`, un booleano puramente manual que nadie pone a `false` automáticamente cuando pasa la fecha de fin (salvo si el grupo pasó explícitamente por el asistente de "Renovación de temporada").

Esto afecta directamente a:
- **`AgendaPage.tsx`** (`blocksByCourt`, líneas 214-217): solo comprueba `group.isActive` y el día de la semana, nunca el rango de fechas del grupo — el síntoma reportado.
- **`src/lib/court-utilization.ts`** y su copia en `functions/src/analytics/court-utilization.ts`: `getWeekBuckets`/`findGroupForSlot` filtran por `g.isActive`, heredando el mismo hueco — un grupo fantasma infla "franjas infrautilizadas" con datos de ocupación obsoletos (Pieza A).
- **`src/lib/coach-stats.ts`** y su copia en `functions/src/analytics/coach-stats.ts`: el cálculo de horas de respaldo (`hoursFromSchedule`, usado cuando no hay asistencia registrada) filtra por `g.isActive`, pudiendo contar horas de un grupo que ya no da clase (Piezas B/C, y el snapshot del Histórico que reutiliza esta misma función).

## Decisiones de diseño (validadas con el usuario)

1. **Se deriva automáticamente de `startDate`/`endDate`, no de un proceso de desactivación manual ni de una tarea programada.** Un grupo se considera "vigente" en una fecha concreta si `group.isActive` es `true` **y** esa fecha cae dentro de `[startDate, endDate]` (inclusive, comparando solo la fecha, sin hora). Esto evita depender de que un admin recuerde desactivar el grupo el día que termina.

2. **Un único helper puro compartido**, `isGroupCurrentlyActive(group, date)`, se usa en todos los puntos afectados — evita repetir la misma comparación de fechas de formas ligeramente distintas en cada archivo.

3. **En `coach-stats.ts`, solo se filtra por vigencia el cálculo de respaldo por horario** (`hoursFromSchedule`), no la atribución de ingresos/retención histórica (`coachGroupIds`, usado para relacionar pagos y matrículas ya ocurridos con el coach). Un pago real del mes pasado sigue siendo un pago real, independientemente de si el grupo sigue vigente hoy — no debe desaparecer de las métricas históricas.

4. **Indicador visual "Finalizado"** en `GroupsPage.tsx` (tarjetas y lista) y `GroupDetailPage.tsx`: cuando `endDate` ya pasó pero `isActive` sigue en `true`, se muestra un badge adicional junto al de nivel/estado existente, para que el admin lo note y decida renovar o desactivar el grupo explícitamente. Este badge usa el mismo helper (`!isGroupCurrentlyActive(group, new Date()) && group.isActive`, es decir: "vigente según fechas dice que no, pero sigue marcado activo").

## Arquitectura

### 1. Helper compartido

`src/lib/group-utils.ts` (nuevo):

```ts
import type { Group } from '@/types'

function toDateOnly(d: Date | string): Date {
  const date = d instanceof Date ? d : new Date(d)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/**
 * Un grupo esta vigente en una fecha si isActive es true Y la fecha cae
 * dentro de [startDate, endDate] (inclusive, comparando solo la fecha).
 * No depende de que nadie desactive el grupo manualmente al terminar su
 * temporada.
 */
export function isGroupCurrentlyActive(group: Pick<Group, 'isActive' | 'startDate' | 'endDate'>, date: Date): boolean {
  if (!group.isActive) return false
  const day = toDateOnly(date)
  return day >= toDateOnly(group.startDate) && day <= toDateOnly(group.endDate)
}

/** Ha pasado la fecha de fin pero el grupo sigue marcado como activo. */
export function isGroupStale(group: Pick<Group, 'isActive' | 'endDate'>, now: Date): boolean {
  return group.isActive && toDateOnly(now) > toDateOnly(group.endDate)
}
```

Portado a `functions/src/analytics/group-utils.ts` con el mismo patrón de tipos inlineados ya usado para `court-utilization.ts`/`coach-stats.ts` en ese proyecto.

### 2. `AgendaPage.tsx`

En `blocksByCourt`, cambiar `if (!group.isActive) continue` por `if (!isGroupCurrentlyActive(group, selectedDate)) continue`.

### 3. `court-utilization.ts` (frontend y functions)

`getWeekBuckets` y `findGroupForSlot` reciben `now` como parámetro adicional (ya existe en `computeCourtUtilization`, se propaga hacia abajo) y sustituyen `g.isActive` por `isGroupCurrentlyActive(g, now)`.

### 4. `coach-stats.ts` (frontend y functions)

Solo el filtro de `hoursFromSchedule` cambia de `g.coachId === coach.id && g.isActive` a `g.coachId === coach.id && isGroupCurrentlyActive(g, now)`. `coachGroupIds` (usado para ingresos y retención) no se toca.

### 5. Badge "Finalizado"

En `GroupsPage.tsx` (ambas vistas) y `GroupDetailPage.tsx`, junto al `StatusBadge` de nivel ya existente: si `isGroupStale(group, new Date())`, mostrar `<Badge variant="destructive">Finalizado</Badge>` (o estilo equivalente ya usado en la app para estados de alerta).

## Fuera de alcance

- No se toca `ClassDetailPage.tsx` ni el registro de asistencia — un coach que necesite corregir asistencia de un grupo recién finalizado sigue pudiendo acceder a la ficha del grupo directamente, solo deja de aparecer en la vista de agenda del día.
- No se añade ninguna acción automática de archivado o desactivación — el fix es puramente de visualización/cálculo; seguir usando `isActive:true` en un grupo finalizado no rompe nada más, solo dejará de contar en agenda/métricas.
- No se retroalimenta este cambio hacia atrás en los snapshots de `MetricSnapshot` ya generados (si los hubiera) — solo afecta a cálculos futuros.

## Verificación manual

1. Crear un grupo con `endDate` de ayer, `isActive: true`, con horario para el día de la semana de hoy. Confirmar que YA NO aparece en la Agenda de hoy.
2. Confirmar que ese mismo grupo SÍ aparecía antes del fix (para descartar que ya estuviera oculto por otra razón).
3. En "Franjas infrautilizadas" (KPIs), confirmar que ese grupo finalizado ya no ocupa ninguna franja en el mapa de calor.
4. En "Ranking coaches", confirmar que las horas del coach de ese grupo ya no incluyen la estimación por horario de ese grupo (si no hay asistencia registrada para él en el periodo).
5. En `GroupsPage.tsx` y `GroupDetailPage.tsx`, confirmar que aparece el badge "Finalizado" en ese grupo.
6. `npm run build`, `npm test` y `npm --prefix functions run build` sin errores; añadir tests unitarios para `isGroupCurrentlyActive`/`isGroupStale` cubriendo: dentro de rango, antes de empezar, después de terminar, e inactivo aunque esté dentro de rango.
