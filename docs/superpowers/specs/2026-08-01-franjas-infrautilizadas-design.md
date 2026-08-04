# Rediseño de "Franjas infrautilizadas" (Pieza A) — Diseño

**Fecha:** 2026-08-01
**Estado:** aprobado, pendiente de plan de implementación

## Contexto

El panel "Inteligencia del Club" (`AnalyticsPage.tsx`, añadido 2026-07-04 sin spec) incluye una tarjeta "¿Qué franja está infrautilizada?" en `KPIsTab.tsx` (líneas 22-42), duplicada en `IntelligenceCards.tsx` (líneas 24-37, la vista resumen del dashboard). El usuario revisó esta métrica y no quedó convencido: el cálculo actual es

```ts
groups.filter(g => g.isActive && g.maxCapacity > 0 && g.currentEnrollment / g.maxCapacity < 0.6)
```

Esto no mide franjas horarias ni pistas — mide grupos con matrícula/capacidad por debajo del 60%, usando solo `schedule[0]` (el primer horario de cada grupo, ignorando el resto si el grupo tiene varios a la semana). No usa `courtId`/`courtName` (existentes en `Group` pero no leídos por ninguna analítica), no usa asistencia real, y no puede detectar una pista completamente libre a una hora dada porque solo itera grupos ya existentes — un hueco donde no hay ningún grupo agendado es invisible para este cálculo.

**Objetivo:** una métrica que refleje la ocupación real de las pistas por franja horaria de la semana, capaz de distinguir "no hay nada agendado ahí" de "hay un grupo pero va poco lleno", y usable para decidir dónde mover un grupo, cuándo ofrecer una clase nueva, o cuándo aceptar más particulares.

## Decisiones de diseño (validadas con el usuario, incluida validación visual)

1. **Se mide ocupación real de pistas por franja, no matrícula global de grupos.** Para cada combinación pista × franja horaria semanal, se determina un estado: vacío, grupo con poca gente, o bien ocupado.

2. **Cuentan como "ocupación" tanto los grupos regulares como las clases particulares recientes.** Un hueco sin grupo fijo pero con particulares frecuentes en las últimas 6 semanas no se considera vacío del todo (se marca "uso ocasional", sin entrar en el ranking de peores franjas).

3. **La rejilla de franjas se construye a partir de los horarios reales de los grupos** (`Group.schedule`, todas las entradas, no solo la primera) — no se fuerza una rejilla artificial de bloques de 1 hora. El universo de franjas analizadas es "todo bloque pista+día+hora que al menos un grupo activo usa hoy", ampliado con los huecos de esas mismas pistas en esos mismos días (para poder mostrarlos como vacíos si ningún grupo los usa).

4. **Umbrales de color:** vacío (sin grupo, sin uso ocasional reciente) → rojo, 0%. Grupo agendado con `matriculados/aforo < 40%` → rojo. `40-70%` → amarillo. `≥70%` → verde. "Infrautilizada" (la categoría que alimenta el ranking) = rojo, con dos motivos posibles: "vacío" o "grupo al X%".

5. **Presentación: mapa de calor + lista** (opción validada visualmente). Un mapa de calor semanal (filas = franjas, columnas = pistas, color según el estado anterior) como vista general, y debajo una lista de las 5-10 peores franjas concretas con su motivo, para saber qué hacer al respecto.

6. **Ubicación:** sustituye la tarjeta actual dentro de `KPIsTab.tsx` (pasa de ser una tarjeta de respuesta corta a una sección más grande dentro de la misma pestaña). La tarjeta resumen de `IntelligenceCards.tsx` (vista rápida del dashboard) se simplifica a un contador ("N franjas infrautilizadas") con enlace a la pestaña completa, importando el cálculo desde un módulo compartido en vez de duplicarlo — evita repetir aquí el mismo error de duplicación que ya existe hoy, aunque el resto de esa duplicación en el panel (coaches, retención) se trata aparte en la Pieza C.

## Arquitectura

### 1. Módulo de cálculo compartido

Nuevo archivo `src/lib/court-utilization.ts`, con una función pura `computeCourtUtilization(courts, groups, privateLessons, now)` que:
- Construye el conjunto de franjas: para cada grupo activo, cada entrada de `schedule` (día+hora+pista vía `courtId`), añade una franja `{ courtId, courtName, dayOfWeek, startTime, endTime, group }`.
- Para cada pista activa, añade también las franjas de las OTRAS pistas que sí tienen algo agendado en ese mismo día+hora, pero en esta pista concreta no hay grupo — estas se marcan como candidatas a "vacío" (así se detectan huecos reales sin inventar una rejilla horaria completa ajena a cómo opera el club: solo se comparan pistas entre sí en los bloques que el club ya usa para algo).
- Para cada franja sin grupo, revisa `privateLessons` de las últimas 6 semanas (`now - 42 días`) filtrando por `courtId` + mismo día de la semana + solape de hora; si hay ≥1, la franja se marca `usoOcasional: true` en vez de vacía.
- Devuelve un array de `CourtSlotStatus { courtId, courtName, dayOfWeek, startTime, endTime, status: 'vacio' | 'ocasional' | 'poco_lleno' | 'lleno', occupancyPct: number | null, groupName?: string }`, ordenado por `occupancyPct` ascendente (los `null`/vacíos primero).

Esta función no depende de React ni de Zustand — recibe los arrays ya leídos del store, para poder testearla con Vitest de forma aislada (patrón ya usado en `invitation-utils.ts`/`player-portal-status.ts`).

### 2. `KPIsTab.tsx`

Sustituye el bloque `underutilized`/`underutilizedAnswer`/`underutilizedDetail` (líneas 22-42) por una llamada a `computeCourtUtilization` (memoizada) y una nueva sección: mapa de calor (tabla con celdas coloreadas según `status`) + lista de las peores 5-10 franjas (`status !== 'lleno'`, priorizando `vacio` sobre `poco_lleno`).

### 3. `IntelligenceCards.tsx`

Sustituye el bloque `underutilizedSlots`/`underutilizedSummary` (líneas 24-37) por: `const { total } = useMemo(() => computeCourtUtilization(...), [...])`, mostrando solo `"${count} franjas infrautilizadas"` con el mismo enlace de navegación a la pestaña KPIs que ya existe hoy.

## Fuera de alcance

- El bug de cálculo de horas de coaches (`group.schedule.find(s => true)`), la deduplicación del resto de lógica del panel (€/hora, retención), y la homogeneización de rangos de tiempo entre tarjetas — son las Piezas B, C y D, cada una con su propio ciclo de diseño/plan/implementación.
- No se añade configuración de UI para cambiar los umbrales (40%/70%) ni la ventana de 6 semanas de particulares — quedan como constantes en `court-utilization.ts`, igual que el 60% actual está hardcodeado hoy (si en el futuro se pide hacerlos configurables, es una extensión aparte).
- No se filtra por temporada (`Season`) ni por rango de fechas seleccionable — la vista siempre refleja "la semana tipo actual" según los grupos activos de hoy.

## Verificación manual

1. Con al menos 2 pistas y varios grupos con horarios distintos (algunos con más de una franja semanal), abrir la pestaña KPIs y confirmar que el mapa de calor muestra celdas para TODAS las franjas de TODOS los horarios de cada grupo (no solo el primero).
2. Confirmar que una pista sin ningún grupo a una hora en la que otras pistas sí tienen grupo, aparece en rojo como "vacío".
3. Registrar una clase particular reciente (últimas 6 semanas) en una pista+hora que de otro modo estaría vacía; confirmar que pasa a "uso ocasional" y ya no aparece en la lista de peores franjas.
4. Confirmar que la tarjeta resumen del dashboard (`IntelligenceCards`) muestra el mismo recuento total que la pestaña completa (mismo módulo compartido, sin divergencia).
5. `npm run build` y `npm test` sin errores; añadir tests unitarios para `computeCourtUtilization` cubriendo: grupo con varios horarios, pista vacía, uso ocasional por particular, umbrales de color.
