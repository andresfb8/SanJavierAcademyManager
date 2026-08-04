# Agenda y métricas no distinguen grupos finalizados — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la Agenda y las métricas de ocupación de pistas/horas de coach dejen de contar grupos cuya `endDate` ya pasó, derivándolo automáticamente en vez de depender de que alguien desactive el grupo a mano.

**Architecture:** Un helper puro compartido `isGroupCurrentlyActive(group, date)` (portado también a Cloud Functions) sustituye las comprobaciones de `group.isActive` en `AgendaPage.tsx`, `court-utilization.ts` y `coach-stats.ts` (frontend y functions) allí donde importa si el grupo sigue dando clase HOY, sin tocar la atribución de ingresos/retención históricos. Un badge "Finalizado" avisa al admin en la ficha del grupo.

**Tech Stack:** React 19 + TypeScript, Vitest, Firebase Cloud Functions (Node.js v2).

---

### Task 1: Helper `isGroupCurrentlyActive`/`isGroupStale`

**Files:**
- Create: `src/lib/group-utils.ts`
- Test: `src/lib/group-utils.test.ts`
- Create: `functions/src/analytics/group-utils.ts`

- [ ] **Paso 1: Escribir los tests (frontend)**

```ts
// src/lib/group-utils.test.ts
import { describe, it, expect } from 'vitest'
import { isGroupCurrentlyActive, isGroupStale } from '@/lib/group-utils'

function makeGroup(overrides: { isActive?: boolean; startDate?: Date; endDate?: Date } = {}) {
  return {
    isActive: true,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-06-30'),
    ...overrides,
  }
}

describe('isGroupCurrentlyActive', () => {
  it('es true si la fecha cae dentro del rango y el grupo esta activo', () => {
    expect(isGroupCurrentlyActive(makeGroup(), new Date('2026-03-15'))).toBe(true)
  })

  it('es true en el primer dia del rango (inclusive)', () => {
    expect(isGroupCurrentlyActive(makeGroup(), new Date('2026-01-01'))).toBe(true)
  })

  it('es true en el ultimo dia del rango (inclusive)', () => {
    expect(isGroupCurrentlyActive(makeGroup(), new Date('2026-06-30'))).toBe(true)
  })

  it('es false si la fecha es posterior a endDate', () => {
    expect(isGroupCurrentlyActive(makeGroup(), new Date('2026-07-01'))).toBe(false)
  })

  it('es false si la fecha es anterior a startDate', () => {
    expect(isGroupCurrentlyActive(makeGroup(), new Date('2025-12-31'))).toBe(false)
  })

  it('es false si isActive es false aunque la fecha caiga dentro del rango', () => {
    expect(isGroupCurrentlyActive(makeGroup({ isActive: false }), new Date('2026-03-15'))).toBe(false)
  })

  it('ignora la hora del dia, solo compara la fecha', () => {
    const group = makeGroup({ endDate: new Date('2026-06-30T08:00:00') })
    expect(isGroupCurrentlyActive(group, new Date('2026-06-30T23:59:00'))).toBe(true)
  })
})

describe('isGroupStale', () => {
  it('es true si isActive sigue en true pero ya paso endDate', () => {
    expect(isGroupStale(makeGroup(), new Date('2026-07-01'))).toBe(true)
  })

  it('es false si el grupo ya esta desactivado (nada que avisar)', () => {
    expect(isGroupStale(makeGroup({ isActive: false }), new Date('2026-07-01'))).toBe(false)
  })

  it('es false si todavia no ha pasado endDate', () => {
    expect(isGroupStale(makeGroup(), new Date('2026-03-15'))).toBe(false)
  })
})
```

- [ ] **Paso 2: Ejecutar los tests para confirmar que fallan**

Run: `npm test -- group-utils`
Expected: FAIL con "Cannot find module '@/lib/group-utils'"

- [ ] **Paso 3: Implementar `src/lib/group-utils.ts`**

```ts
import type { Group } from '@/types'

function toDateOnly(d: Date | string): Date {
  const date = d instanceof Date ? d : new Date(d)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/**
 * Un grupo esta vigente en una fecha si isActive es true Y la fecha cae
 * dentro de [startDate, endDate] (inclusive, comparando solo la fecha, sin
 * hora). Se deriva automaticamente de las fechas del grupo en vez de
 * depender de que alguien lo desactive manualmente al terminar su
 * temporada.
 */
export function isGroupCurrentlyActive(
  group: Pick<Group, 'isActive' | 'startDate' | 'endDate'>,
  date: Date
): boolean {
  if (!group.isActive) return false
  const day = toDateOnly(date)
  return day >= toDateOnly(group.startDate) && day <= toDateOnly(group.endDate)
}

/** Ha pasado la fecha de fin pero el grupo sigue marcado como activo. */
export function isGroupStale(group: Pick<Group, 'isActive' | 'endDate'>, now: Date): boolean {
  return group.isActive && toDateOnly(now) > toDateOnly(group.endDate)
}
```

- [ ] **Paso 4: Ejecutar los tests para confirmar que pasan**

Run: `npm test -- group-utils`
Expected: PASS, 10 tests.

- [ ] **Paso 5: Portar a Cloud Functions**

Crear `functions/src/analytics/group-utils.ts`:

```ts
interface GroupDates {
  isActive: boolean;
  startDate: Date;
  endDate: Date;
}

function toDateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function isGroupCurrentlyActive(group: GroupDates, date: Date): boolean {
  if (!group.isActive) return false;
  const day = toDateOnly(date);
  return day >= toDateOnly(group.startDate) && day <= toDateOnly(group.endDate);
}
```

(No se porta `isGroupStale` a functions — solo se usa para el badge de UI en el frontend, no en el cálculo de snapshots.)

- [ ] **Paso 6: Build y suite completa**

Run: `npm run build && npm --prefix functions run build`
Expected: sin errores.

Run: `npm test`
Expected: los 60 tests anteriores + los 10 nuevos = 70, todos en verde.

- [ ] **Paso 7: Commit**

```bash
git add src/lib/group-utils.ts src/lib/group-utils.test.ts functions/src/analytics/group-utils.ts
git commit -m "feat: helper isGroupCurrentlyActive/isGroupStale para derivar vigencia de grupos por fecha"
```

---

### Task 2: `AgendaPage.tsx` deja de mostrar grupos finalizados

**Files:**
- Modify: `src/pages/AgendaPage.tsx`

- [ ] **Paso 1: Leer el archivo actual para confirmar el estado exacto**

Leer `src/pages/AgendaPage.tsx` líneas 209-241 (`blocksByCourt`) para confirmar que el código sigue igual que en el spec.

- [ ] **Paso 2: Añadir el import**

```ts
import { isGroupCurrentlyActive } from '@/lib/group-utils'
```

- [ ] **Paso 3: Sustituir el filtro de grupos**

Cambiar:
```ts
    // 1. Grupos
    for (const group of groups) {
      if (!group.isActive) continue
      for (const slot of group.schedule) {
```
por:
```ts
    // 1. Grupos
    for (const group of groups) {
      if (!isGroupCurrentlyActive(group, selectedDate)) continue
      for (const slot of group.schedule) {
```

- [ ] **Paso 4: Build**

Run: `npm run build`
Expected: sin errores de TypeScript.

- [ ] **Paso 5: Verificación manual**

Run: `npm run dev`, crear temporalmente un grupo de prueba con `endDate` de ayer y horario para hoy (o editar uno existente desde `GroupsPage.tsx`); confirmar que ya no aparece en `/agenda` para hoy. Revertir el cambio de prueba después.

- [ ] **Paso 6: Commit**

```bash
git add src/pages/AgendaPage.tsx
git commit -m "fix: la agenda ya no muestra clases de grupos con la temporada finalizada"
```

---

### Task 3: `court-utilization.ts` (frontend y functions) usa el helper

**Files:**
- Modify: `src/lib/court-utilization.ts`
- Test: `src/lib/court-utilization.test.ts`
- Modify: `functions/src/analytics/court-utilization.ts`

**Contexto:** `getWeekBuckets` y `findGroupForSlot` filtran hoy por `group.isActive`. Ambas funciones ya reciben (o pueden recibir) la fecha de referencia `now`, que `computeCourtUtilization` ya calcula/recibe como parámetro.

- [ ] **Paso 1: Escribir el test que falla**

Añadir a `src/lib/court-utilization.test.ts`, dentro de `describe('computeCourtUtilization', ...)`:

```ts
  it('no cuenta un grupo cuya endDate ya paso, aunque isActive siga en true', () => {
    const courts = [makeCourt({ id: 'court-1' }), makeCourt({ id: 'court-2' })]
    const groups = [makeGroup({
      courtId: 'court-1',
      isActive: true,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-07-01'), // ya paso respecto a NOW (2026-08-01)
    })]
    const result = computeCourtUtilization(courts, groups, [], NOW)
    // el grupo finalizado no genera ninguna franja: no hay buckets porque
    // getWeekBuckets tambien debe ignorarlo al construir el universo de franjas
    expect(result).toHaveLength(0)
  })
```

- [ ] **Paso 2: Ejecutar el test para confirmar que falla**

Run: `npm test -- court-utilization`
Expected: FAIL (el grupo finalizado sigue generando una franja "vacia"/"lleno" porque hoy no se comprueba la fecha).

- [ ] **Paso 3: Leer `src/lib/court-utilization.ts` actual y añadir el import**

```ts
import { isGroupCurrentlyActive } from '@/lib/group-utils'
```

- [ ] **Paso 4: Actualizar `getWeekBuckets` y `findGroupForSlot`**

Cambiar:
```ts
function getWeekBuckets(groups: Group[]): WeekBucket[] {
  const seen = new Map<string, WeekBucket>()
  for (const group of groups) {
    if (!group.isActive) continue
```
por (recibe `now` como parámetro nuevo):
```ts
function getWeekBuckets(groups: Group[], now: Date): WeekBucket[] {
  const seen = new Map<string, WeekBucket>()
  for (const group of groups) {
    if (!isGroupCurrentlyActive(group, now)) continue
```

Cambiar:
```ts
function findGroupForSlot(groups: Group[], courtId: string, bucket: WeekBucket): Group | undefined {
  return groups.find(g =>
    g.isActive &&
    g.courtId === courtId &&
```
por:
```ts
function findGroupForSlot(groups: Group[], courtId: string, bucket: WeekBucket, now: Date): Group | undefined {
  return groups.find(g =>
    isGroupCurrentlyActive(g, now) &&
    g.courtId === courtId &&
```

- [ ] **Paso 5: Actualizar las llamadas dentro de `computeCourtUtilization`**

Cambiar:
```ts
  const activeCourts = courts.filter(c => c.isActive)
  const buckets = getWeekBuckets(groups)
  const results: CourtSlotStatus[] = []

  for (const court of activeCourts) {
    for (const bucket of buckets) {
      const group = findGroupForSlot(groups, court.id, bucket)
```
por:
```ts
  const activeCourts = courts.filter(c => c.isActive)
  const buckets = getWeekBuckets(groups, now)
  const results: CourtSlotStatus[] = []

  for (const court of activeCourts) {
    for (const bucket of buckets) {
      const group = findGroupForSlot(groups, court.id, bucket, now)
```

- [ ] **Paso 6: Ejecutar el test para confirmar que pasa**

Run: `npm test -- court-utilization`
Expected: PASS.

- [ ] **Paso 7: Aplicar el mismo cambio en `functions/src/analytics/court-utilization.ts`**

Repetir los Pasos 3-5 en el archivo portado: añadir `import { isGroupCurrentlyActive } from "./group-utils";`, cambiar `getWeekBuckets`/`findGroupForSlot` de la misma forma (sintaxis TS con `;`), y actualizar las llamadas en `computeCourtUtilization`.

- [ ] **Paso 8: Build y suite completa**

Run: `npm run build && npm --prefix functions run build`
Expected: sin errores.

Run: `npm test`
Expected: 70 tests anteriores + 1 nuevo = 71, todos en verde.

- [ ] **Paso 9: Commit**

```bash
git add src/lib/court-utilization.ts src/lib/court-utilization.test.ts functions/src/analytics/court-utilization.ts
git commit -m "fix: franjas infrautilizadas ya no cuenta grupos con la temporada finalizada"
```

---

### Task 4: `coach-stats.ts` (frontend y functions) usa el helper solo en la estimacion por horario

**Files:**
- Modify: `src/lib/coach-stats.ts`
- Test: `src/lib/coach-stats.test.ts`
- Modify: `functions/src/analytics/coach-stats.ts`

**Contexto:** Solo se cambia el filtro de `hoursFromSchedule` (la estimación de respaldo cuando no hay asistencia registrada). `coachGroupIds` (usado para atribuir ingresos y retención ya ocurridos) NO se toca — un pago real del pasado sigue siendo real independientemente de si el grupo sigue vigente hoy.

- [ ] **Paso 1: Escribir el test que falla**

Añadir a `src/lib/coach-stats.test.ts`, dentro de `describe('computeCoachStats', ...)`:

```ts
  it('no estima horas por horario de un grupo cuya endDate ya paso (sin asistencia registrada)', () => {
    const coaches = [makeCoach()]
    const groups = [makeGroup({
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-07-01'), // ya paso respecto a NOW (2026-08-15)
    })]
    // Una matricula elegible para retencion, para que el coach no quede
    // excluido del todo por el filtro final de computeCoachStats (que
    // descarta entradas con rph=0, hours=0 y retentionPct=null a la vez) -
    // asi se puede comprobar especificamente que `hours` es 0.
    const enrollments: Enrollment[] = [
      { id: 'e1', playerId: 'p1', playerName: 'A', groupId: 'group-1', groupName: 'Iniciación', tariffId: 't1', tariffName: 'Mensual', enrollmentDate: new Date('2026-01-01'), isActive: true },
    ]
    // Sin registros de attendance -> se usaria el fallback hoursFromSchedule
    const stats = computeCoachStats(coaches, groups, [], enrollments, [], PERIOD_START, 4, NOW)
    // El grupo finalizado no aporta horas estimadas (hours=0, por tanto
    // rph=0 segun la formula existente), pero el coach sigue apareciendo
    // porque tiene retencion calculable.
    expect(stats).toHaveLength(1)
    expect(stats[0].hours).toBe(0)
    expect(stats[0].rph).toBe(0)
    expect(stats[0].retentionPct).toBe(100)
  })
```

- [ ] **Paso 2: Ejecutar el test para confirmar que falla**

Run: `npm test -- coach-stats`
Expected: FAIL (hoy el grupo finalizado sigue contando en `hoursFromSchedule` porque solo mira `g.isActive`).

- [ ] **Paso 3: Leer `src/lib/coach-stats.ts` actual y añadir el import**

```ts
import { isGroupCurrentlyActive } from '@/lib/group-utils'
```

- [ ] **Paso 4: Actualizar el filtro de `hoursFromSchedule`**

Cambiar:
```ts
      // Respaldo: estimar a partir del horario si no hay asistencia registrada
      const hoursFromSchedule = groups
        .filter(g => g.coachId === coach.id && g.isActive)
        .reduce((sum, g) => {
```
por:
```ts
      // Respaldo: estimar a partir del horario si no hay asistencia registrada
      const hoursFromSchedule = groups
        .filter(g => g.coachId === coach.id && isGroupCurrentlyActive(g, now))
        .reduce((sum, g) => {
```

(No tocar `coachGroupIds` ni el resto de la función — ingresos y retención siguen atribuyendose por `coachId`, independientemente de la vigencia actual del grupo.)

- [ ] **Paso 5: Ejecutar el test para confirmar que pasa**

Run: `npm test -- coach-stats`
Expected: PASS.

- [ ] **Paso 6: Aplicar el mismo cambio en `functions/src/analytics/coach-stats.ts`**

Repetir los Pasos 3-4 en el archivo portado, con `import { isGroupCurrentlyActive } from "./group-utils";` y la sintaxis TS de ese proyecto.

- [ ] **Paso 7: Build y suite completa**

Run: `npm run build && npm --prefix functions run build`
Expected: sin errores.

Run: `npm test`
Expected: 71 tests anteriores + 1 nuevo = 72, todos en verde.

- [ ] **Paso 8: Commit**

```bash
git add src/lib/coach-stats.ts src/lib/coach-stats.test.ts functions/src/analytics/coach-stats.ts
git commit -m "fix: no estimar horas de coach por horario de grupos con la temporada finalizada"
```

---

### Task 5: Badge "Finalizado" en `GroupsPage.tsx` y `GroupDetailPage.tsx`

**Files:**
- Modify: `src/pages/GroupsPage.tsx`
- Modify: `src/pages/GroupDetailPage.tsx`

- [ ] **Paso 1: Añadir el import en ambos archivos**

```ts
import { isGroupStale } from '@/lib/group-utils'
```

- [ ] **Paso 2: `GroupsPage.tsx` — vista de tarjetas**

Leer el archivo actual para confirmar el estado exacto alrededor de la línea 433 (puede haber cambiado ligeramente). Cambiar:

```tsx
                        <div className="mt-1">
                          <StatusBadge status={group.level} />
                        </div>
```
por:
```tsx
                        <div className="mt-1 flex items-center gap-1.5">
                          <StatusBadge status={group.level} />
                          {isGroupStale(group, new Date()) && (
                            <Badge variant="destructive" className="text-[10px]">Finalizado</Badge>
                          )}
                        </div>
```

- [ ] **Paso 3: `GroupsPage.tsx` — vista de lista**

Cambiar:
```tsx
                          <td className="p-3 align-top">
                            <StatusBadge status={group.level} />
                          </td>
```
por:
```tsx
                          <td className="p-3 align-top">
                            <div className="flex items-center gap-1.5">
                              <StatusBadge status={group.level} />
                              {isGroupStale(group, new Date()) && (
                                <Badge variant="destructive" className="text-[10px]">Finalizado</Badge>
                              )}
                            </div>
                          </td>
```

- [ ] **Paso 4: `GroupDetailPage.tsx`**

Leer el archivo actual para confirmar el estado exacto alrededor de la línea 418. Cambiar:

```tsx
                  <p className="text-lg font-semibold">{group.coachName}</p>
                  <StatusBadge status={group.level} className="mt-1" />
```
por:
```tsx
                  <p className="text-lg font-semibold">{group.coachName}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <StatusBadge status={group.level} />
                    {isGroupStale(group, new Date()) && (
                      <Badge variant="destructive" className="text-[10px]">Finalizado</Badge>
                    )}
                  </div>
```

Confirmar que `Badge` ya está importado en `GroupDetailPage.tsx` (ya se usa en otros puntos del archivo, ver spec) — si no lo estuviera, añadir `import { Badge } from '@/components/ui/badge'`.

- [ ] **Paso 5: Build**

Run: `npm run build`
Expected: sin errores de TypeScript.

- [ ] **Paso 6: Verificación manual**

Run: `npm run dev`. Con el grupo de prueba (endDate de ayer, isActive:true) creado en la Tarea 2, confirmar que aparece el badge "Finalizado" en `/grupos` (tarjetas y lista) y en su ficha de detalle. Revertir el grupo de prueba.

- [ ] **Paso 7: Commit**

```bash
git add src/pages/GroupsPage.tsx src/pages/GroupDetailPage.tsx
git commit -m "feat: badge Finalizado para grupos cuya temporada ya termino"
```

---

## Verificación final

1. `npm run build`, `npm test` (72 tests) y `npm --prefix functions run build` sin errores.
2. Repetir el escenario manual completo: grupo con `endDate` pasada e `isActive:true` → no aparece en Agenda, no cuenta en franjas infrautilizadas, no aporta horas estimadas al ranking de coaches (si no tiene asistencia registrada en el periodo), y muestra el badge "Finalizado" en `GroupsPage`/`GroupDetailPage`.
3. Confirmar que un grupo normal (dentro de su rango de fechas) sigue funcionando exactamente igual que antes en los 4 puntos anteriores — no debe haber regresión para grupos vigentes.
