# Rediseño de "Franjas infrautilizadas" (Pieza A) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sustituir la métrica actual "¿Qué franja está infrautilizada?" (basada solo en matrícula/capacidad del primer horario de cada grupo) por un cálculo real de ocupación de pistas por franja horaria semanal, mostrado como mapa de calor + lista de peores franjas.

**Architecture:** Un módulo puro nuevo (`src/lib/court-utilization.ts`) calcula el estado de cada combinación pista × franja horaria a partir de `groups`, `courts` y `privateLessons` (sin dependencias de React/Zustand, testeable con Vitest). `KPIsTab.tsx` lo consume para renderizar el mapa de calor + lista; `IntelligenceCards.tsx` lo consume para un contador simple, eliminando la duplicación de cálculo que existía entre ambos.

**Tech Stack:** React 19 + TypeScript, Zustand, Tailwind CSS v4, Vitest.

---

### Task 1: Módulo puro `computeCourtUtilization`

**Files:**
- Create: `src/lib/court-utilization.ts`
- Test: `src/lib/court-utilization.test.ts`

**Contexto:** `Group.schedule` es un array de `ScheduleSlot { dayOfWeek, startTime, endTime }` (`src/types/index.ts:201-205`). `Court` tiene `id, name, isActive` (`src/types/index.ts:56-64`). `PrivateLesson` tiene `courtId, date, startTime, endTime` (`src/types/index.ts:360-375`). El cálculo: para cada pista activa y cada franja horaria que algún grupo activo usa en el club (día+hora+duración), determina si ESA pista concreta tiene un grupo ahí; si no, revisa si hubo una clase particular en esa pista+día+hora en las últimas 6 semanas.

- [ ] **Paso 1: Escribir los tests (fallarán porque el módulo no existe)**

```ts
// src/lib/court-utilization.test.ts
import { describe, it, expect } from 'vitest'
import { computeCourtUtilization, getUnderutilizedSlots } from '@/lib/court-utilization'
import type { Court, Group, PrivateLesson } from '@/types'

const NOW = new Date('2026-08-01T12:00:00Z') // sábado

function makeCourt(overrides: Partial<Court> = {}): Court {
  return {
    id: 'court-1',
    name: 'Pista 1',
    type: 'indoor',
    surface: 'cristal',
    isActive: true,
    ...overrides,
  }
}

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 'group-1',
    name: 'Iniciación Lunes',
    level: 'iniciacion',
    coachId: 'coach-1',
    coachName: 'Coach',
    courtId: 'court-1',
    courtName: 'Pista 1',
    schedule: [{ dayOfWeek: 1, startTime: '18:00', endTime: '19:00' }],
    maxCapacity: 8,
    currentEnrollment: 8,
    defaultTariffId: 't1',
    defaultTariffPrice: 40,
    billingFrequency: 'monthly',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    isActive: true,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  }
}

function makePrivateLesson(overrides: Partial<PrivateLesson> = {}): PrivateLesson {
  return {
    id: 'pl-1',
    playerIds: ['p1'],
    playerNames: ['Jugador'],
    coachId: 'coach-1',
    coachName: 'Coach',
    courtId: 'court-2',
    date: new Date('2026-07-20T00:00:00Z'), // lunes, dentro de las ultimas 6 semanas respecto a NOW
    startTime: '18:00',
    endTime: '19:00',
    price: 30,
    isPaid: true,
    createdAt: new Date('2026-07-20'),
    ...overrides,
  }
}

describe('computeCourtUtilization', () => {
  it('marca una pista con grupo lleno como "lleno"', () => {
    const courts = [makeCourt()]
    const groups = [makeGroup({ currentEnrollment: 8, maxCapacity: 8 })]
    const result = computeCourtUtilization(courts, groups, [], NOW)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ status: 'lleno', occupancyPct: 100, groupName: 'Iniciación Lunes' })
  })

  it('marca un grupo con menos del 40% como "bajo"', () => {
    const courts = [makeCourt()]
    const groups = [makeGroup({ currentEnrollment: 2, maxCapacity: 8 })]
    const result = computeCourtUtilization(courts, groups, [], NOW)
    expect(result[0].status).toBe('bajo')
    expect(result[0].occupancyPct).toBe(25)
  })

  it('marca un grupo entre 40% y 70% como "medio"', () => {
    const courts = [makeCourt()]
    const groups = [makeGroup({ currentEnrollment: 4, maxCapacity: 8 })]
    const result = computeCourtUtilization(courts, groups, [], NOW)
    expect(result[0].status).toBe('medio')
    expect(result[0].occupancyPct).toBe(50)
  })

  it('incluye TODOS los horarios de un grupo, no solo el primero', () => {
    const courts = [makeCourt()]
    const groups = [makeGroup({
      schedule: [
        { dayOfWeek: 1, startTime: '18:00', endTime: '19:00' },
        { dayOfWeek: 3, startTime: '18:00', endTime: '19:00' },
      ],
    })]
    const result = computeCourtUtilization(courts, groups, [], NOW)
    expect(result).toHaveLength(2)
    expect(result.map(r => r.dayOfWeek).sort()).toEqual([1, 3])
  })

  it('marca como "vacio" una pista sin grupo en una franja que otra pista si usa', () => {
    const courts = [makeCourt({ id: 'court-1', name: 'Pista 1' }), makeCourt({ id: 'court-2', name: 'Pista 2' })]
    const groups = [makeGroup({ courtId: 'court-1' })] // solo pista 1 tiene grupo lunes 18:00
    const result = computeCourtUtilization(courts, groups, [], NOW)
    const court2Slot = result.find(r => r.courtId === 'court-2')
    expect(court2Slot).toMatchObject({ status: 'vacio', occupancyPct: null })
  })

  it('marca como "ocasional" una franja vacia con una clase particular reciente en esa pista/dia/hora', () => {
    const courts = [makeCourt({ id: 'court-1' }), makeCourt({ id: 'court-2' })]
    const groups = [makeGroup({ courtId: 'court-1' })]
    const privateLessons = [makePrivateLesson({ courtId: 'court-2', date: new Date('2026-07-20T00:00:00Z') })]
    const result = computeCourtUtilization(courts, groups, privateLessons, NOW)
    const court2Slot = result.find(r => r.courtId === 'court-2')
    expect(court2Slot?.status).toBe('ocasional')
  })

  it('ignora clases particulares de hace mas de 6 semanas', () => {
    const courts = [makeCourt({ id: 'court-1' }), makeCourt({ id: 'court-2' })]
    const groups = [makeGroup({ courtId: 'court-1' })]
    const privateLessons = [makePrivateLesson({ courtId: 'court-2', date: new Date('2026-05-01T00:00:00Z') })]
    const result = computeCourtUtilization(courts, groups, privateLessons, NOW)
    const court2Slot = result.find(r => r.courtId === 'court-2')
    expect(court2Slot?.status).toBe('vacio')
  })

  it('ignora pistas inactivas', () => {
    const courts = [makeCourt({ id: 'court-1', isActive: true }), makeCourt({ id: 'court-2', isActive: false })]
    const groups = [makeGroup({ courtId: 'court-1' })]
    const result = computeCourtUtilization(courts, groups, [], NOW)
    expect(result.every(r => r.courtId !== 'court-2')).toBe(true)
  })
})

describe('getUnderutilizedSlots', () => {
  it('incluye franjas vacias y con poca gente, excluye ocasional/medio/lleno', () => {
    const courts = [makeCourt({ id: 'court-1' }), makeCourt({ id: 'court-2' })]
    const groups = [
      makeGroup({ id: 'g1', courtId: 'court-1', schedule: [{ dayOfWeek: 1, startTime: '18:00', endTime: '19:00' }], currentEnrollment: 2, maxCapacity: 8 }),
      makeGroup({ id: 'g2', courtId: 'court-2', schedule: [{ dayOfWeek: 3, startTime: '19:00', endTime: '20:00' }], currentEnrollment: 8, maxCapacity: 8 }),
    ]
    const utilization = computeCourtUtilization(courts, groups, [], NOW)
    const underutilized = getUnderutilizedSlots(utilization)
    expect(underutilized.some(s => s.status === 'lleno')).toBe(false)
    expect(underutilized.some(s => s.status === 'bajo')).toBe(true)
  })
})
```

- [ ] **Paso 2: Ejecutar los tests para confirmar que fallan**

Run: `npm test -- court-utilization`
Expected: FAIL con "Cannot find module '@/lib/court-utilization'"

- [ ] **Paso 3: Implementar `src/lib/court-utilization.ts`**

```ts
import type { Court, Group, PrivateLesson } from '@/types'

const OCCUPANCY_LOW_THRESHOLD = 0.4
const OCCUPANCY_HIGH_THRESHOLD = 0.7
const PRIVATE_LESSON_LOOKBACK_DAYS = 42

export type CourtSlotStatusValue = 'vacio' | 'ocasional' | 'bajo' | 'medio' | 'lleno'

export interface CourtSlotStatus {
  courtId: string
  courtName: string
  dayOfWeek: number
  startTime: string
  endTime: string
  status: CourtSlotStatusValue
  occupancyPct: number | null
  groupName?: string
}

interface WeekBucket {
  dayOfWeek: number
  startTime: string
  endTime: string
}

function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d)
}

function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd
}

function getWeekBuckets(groups: Group[]): WeekBucket[] {
  const seen = new Map<string, WeekBucket>()
  for (const group of groups) {
    if (!group.isActive) continue
    for (const slot of group.schedule) {
      const key = `${slot.dayOfWeek}|${slot.startTime}|${slot.endTime}`
      if (!seen.has(key)) {
        seen.set(key, { dayOfWeek: slot.dayOfWeek, startTime: slot.startTime, endTime: slot.endTime })
      }
    }
  }
  return Array.from(seen.values())
}

function findGroupForSlot(groups: Group[], courtId: string, bucket: WeekBucket): Group | undefined {
  return groups.find(g =>
    g.isActive &&
    g.courtId === courtId &&
    g.schedule.some(s => s.dayOfWeek === bucket.dayOfWeek && s.startTime === bucket.startTime && s.endTime === bucket.endTime)
  )
}

function hasRecentPrivateLesson(
  privateLessons: PrivateLesson[],
  courtId: string,
  bucket: WeekBucket,
  now: Date
): boolean {
  const cutoff = new Date(now.getTime() - PRIVATE_LESSON_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  return privateLessons.some(lesson => {
    if (lesson.courtId !== courtId) return false
    const lessonDate = toDate(lesson.date)
    if (lessonDate < cutoff || lessonDate > now) return false
    if (lessonDate.getDay() !== bucket.dayOfWeek) return false
    return timesOverlap(lesson.startTime, lesson.endTime, bucket.startTime, bucket.endTime)
  })
}

function statusForOccupancy(pct: number): CourtSlotStatusValue {
  if (pct < OCCUPANCY_LOW_THRESHOLD) return 'bajo'
  if (pct < OCCUPANCY_HIGH_THRESHOLD) return 'medio'
  return 'lleno'
}

/**
 * Calcula el estado de ocupacion de cada pista activa en cada franja horaria
 * semanal que al menos un grupo activo usa en el club. Puro: no lee stores ni
 * hace I/O, para poder testearse de forma aislada.
 */
export function computeCourtUtilization(
  courts: Court[],
  groups: Group[],
  privateLessons: PrivateLesson[],
  now: Date = new Date()
): CourtSlotStatus[] {
  const activeCourts = courts.filter(c => c.isActive)
  const buckets = getWeekBuckets(groups)
  const results: CourtSlotStatus[] = []

  for (const court of activeCourts) {
    for (const bucket of buckets) {
      const group = findGroupForSlot(groups, court.id, bucket)
      if (group) {
        const pct = group.maxCapacity > 0 ? group.currentEnrollment / group.maxCapacity : 0
        results.push({
          courtId: court.id,
          courtName: court.name,
          dayOfWeek: bucket.dayOfWeek,
          startTime: bucket.startTime,
          endTime: bucket.endTime,
          status: statusForOccupancy(pct),
          occupancyPct: Math.round(pct * 100),
          groupName: group.name,
        })
      } else {
        const occasional = hasRecentPrivateLesson(privateLessons, court.id, bucket, now)
        results.push({
          courtId: court.id,
          courtName: court.name,
          dayOfWeek: bucket.dayOfWeek,
          startTime: bucket.startTime,
          endTime: bucket.endTime,
          status: occasional ? 'ocasional' : 'vacio',
          occupancyPct: null,
        })
      }
    }
  }

  return results.sort((a, b) => {
    const rank = (s: CourtSlotStatus) => {
      if (s.status === 'vacio') return 0
      if (s.status === 'bajo') return 1
      if (s.status === 'ocasional') return 2
      if (s.status === 'medio') return 3
      return 4
    }
    const ra = rank(a)
    const rb = rank(b)
    if (ra !== rb) return ra - rb
    return (a.occupancyPct ?? -1) - (b.occupancyPct ?? -1)
  })
}

/** Franjas que cuentan como "infrautilizadas": vacias o con poca gente (rojo). */
export function getUnderutilizedSlots(slots: CourtSlotStatus[]): CourtSlotStatus[] {
  return slots.filter(s => s.status === 'vacio' || s.status === 'bajo')
}
```

- [ ] **Paso 4: Ejecutar los tests para confirmar que pasan**

Run: `npm test -- court-utilization`
Expected: PASS, 9 tests.

- [ ] **Paso 5: Build y suite completa**

Run: `npm run build`
Expected: sin errores.

Run: `npm test`
Expected: los 31 tests anteriores + los nuevos de `court-utilization.test.ts`, todos en verde.

- [ ] **Paso 6: Commit**

```bash
git add src/lib/court-utilization.ts src/lib/court-utilization.test.ts
git commit -m "feat: calculo puro de ocupacion real de pistas por franja horaria"
```

---

### Task 2: `KPIsTab.tsx` — mapa de calor + lista de peores franjas

**Files:**
- Modify: `src/components/shared/analytics/KPIsTab.tsx`

**Contexto:** Sustituye el bloque `underutilized`/`underutilizedAnswer`/`underutilizedDetail` (líneas 22-42 actuales) y la primera entrada del array `cards` (líneas 129-133) por una sección separada con mapa de calor + lista, usando `computeCourtUtilization`. Las otras 5 tarjetas de `cards` NO se tocan en esta tarea.

- [ ] **Paso 1: Leer el archivo completo actual**

Leer `src/components/shared/analytics/KPIsTab.tsx` en su estado actual para confirmar los nombres exactos de variables antes de editar (puede haber cambiado ligeramente desde que se escribió este plan).

- [ ] **Paso 2: Añadir el import del módulo nuevo y leer `courts`/`privateLessons` del store**

Cambiar:
```ts
import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { useDataStore } from '@/stores/dataStore'
import { formatCurrency } from '@/lib/utils'
```
por:
```ts
import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { useDataStore } from '@/stores/dataStore'
import { formatCurrency } from '@/lib/utils'
import { computeCourtUtilization, getUnderutilizedSlots, type CourtSlotStatus } from '@/lib/court-utilization'
```

Cambiar la desestructuración del store:
```ts
const { groups, enrollments, payments, attendance } = useDataStore()
```
por:
```ts
const { groups, enrollments, payments, attendance, courts, privateLessons } = useDataStore()
```

- [ ] **Paso 3: Sustituir el bloque de cálculo de franjas infrautilizadas**

Eliminar por completo:
```ts
  // ── Franjas infrautilizadas ────────────────────────────────────────
  const underutilized = useMemo(() => {
    return groups
      .filter(g => g.isActive && g.maxCapacity > 0 && g.currentEnrollment / g.maxCapacity < 0.6)
      .sort((a, b) => (a.currentEnrollment / a.maxCapacity) - (b.currentEnrollment / b.maxCapacity))
  }, [groups])

  const underutilizedAnswer = useMemo(() => {
    if (underutilized.length === 0) return 'Todos los grupos bien ocupados'
    const g = underutilized[0]
    const slot = g.schedule[0]
    if (!slot) return `${g.name}`
    return `${DAY_NAMES[slot.dayOfWeek]} ${slot.startTime}`
  }, [underutilized])

  const underutilizedDetail = useMemo(() => {
    if (underutilized.length === 0) return 'No hay franjas con menos del 60% de ocupación'
    const g = underutilized[0]
    const pct = Math.round((g.currentEnrollment / g.maxCapacity) * 100)
    return `${pct}% ocupación · ${g.currentEnrollment}/${g.maxCapacity} plazas · ${underutilized.length} grupo${underutilized.length > 1 ? 's' : ''} total`
  }, [underutilized])
```

Sustituir por:
```ts
  // ── Ocupación real de pistas ────────────────────────────────────────
  const utilization = useMemo(
    () => computeCourtUtilization(courts, groups, privateLessons),
    [courts, groups, privateLessons]
  )
  const underutilizedSlots = useMemo(() => getUnderutilizedSlots(utilization), [utilization])
  const activeCourts = useMemo(() => courts.filter(c => c.isActive), [courts])
  const heatmapRows = useMemo(() => {
    const seen = new Map<string, { dayOfWeek: number; startTime: string; endTime: string }>()
    utilization.forEach(s => {
      const key = `${s.dayOfWeek}|${s.startTime}|${s.endTime}`
      if (!seen.has(key)) seen.set(key, { dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime })
    })
    return Array.from(seen.values()).sort((a, b) =>
      a.dayOfWeek !== b.dayOfWeek ? a.dayOfWeek - b.dayOfWeek : a.startTime.localeCompare(b.startTime)
    )
  }, [utilization])

  const STATUS_STYLES: Record<CourtSlotStatus['status'], string> = {
    vacio: 'bg-red-500 text-white',
    bajo: 'bg-red-500 text-white',
    ocasional: 'bg-slate-300 text-slate-700',
    medio: 'bg-amber-400 text-slate-900',
    lleno: 'bg-emerald-500 text-white',
  }

  const slotLabel = (slot: CourtSlotStatus): string => {
    if (slot.status === 'vacio') return 'Vacío'
    if (slot.status === 'ocasional') return 'Ocasional'
    return `${slot.occupancyPct}%`
  }

  const slotCell = (courtId: string, row: { dayOfWeek: number; startTime: string; endTime: string }) =>
    utilization.find(
      s => s.courtId === courtId && s.dayOfWeek === row.dayOfWeek && s.startTime === row.startTime && s.endTime === row.endTime
    )
```

(Nota: los hooks `useMemo` deben mantenerse arriba en el cuerpo del componente junto a los demás; los objetos `STATUS_STYLES`/función `slotLabel`/`slotCell` no son hooks y pueden declararse justo debajo, dentro del componente, ya que dependen de `utilization` en closure — no hace falta memoizarlos, son baratos.)

- [ ] **Paso 4: Quitar la primera entrada de `cards` (la de franjas infrautilizadas)**

Cambiar el array `cards` para que empiece directamente por "¿Cuál es el grupo más rentable?" (eliminar el objeto `{ label: '¿Qué franja está infrautilizada?', ... }` que hoy es el primero).

- [ ] **Paso 5: Añadir la nueva sección de mapa de calor + lista, antes de la rejilla de tarjetas**

Cambiar el `return` final:
```tsx
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Preguntas clave respondidas automáticamente con los datos del club.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {cards.map((card, i) => (
```
por:
```tsx
  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardContent className="p-5 space-y-4">
          <div>
            <p className="text-sm font-medium text-foreground">Ocupación de pistas por franja</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {underutilizedSlots.length > 0
                ? `${underutilizedSlots.length} franja${underutilizedSlots.length > 1 ? 's' : ''} infrautilizada${underutilizedSlots.length > 1 ? 's' : ''}`
                : 'Todas las franjas bien aprovechadas'}
            </p>
          </div>

          {activeCourts.length > 0 && heatmapRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="text-left p-1 text-muted-foreground font-medium">Franja</th>
                    {activeCourts.map(court => (
                      <th key={court.id} className="p-1 text-muted-foreground font-medium">{court.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmapRows.map((row, i) => (
                    <tr key={i}>
                      <td className="p-1 text-left whitespace-nowrap">{DAY_NAMES[row.dayOfWeek]} {row.startTime}</td>
                      {activeCourts.map(court => {
                        const slot = slotCell(court.id, row)
                        return (
                          <td key={court.id} className="p-1">
                            {slot && (
                              <div className={`rounded px-1.5 py-1 text-center font-semibold ${STATUS_STYLES[slot.status]}`}>
                                {slotLabel(slot)}
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {underutilizedSlots.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Peores franjas</p>
              {underutilizedSlots.slice(0, 10).map((slot, i) => (
                <p key={i} className="text-xs text-foreground">
                  <span className="font-medium">{slot.courtName} · {DAY_NAMES[slot.dayOfWeek]} {slot.startTime}</span>
                  {' — '}
                  {slot.status === 'vacio'
                    ? 'Vacío, sin nada agendado'
                    : `Grupo "${slot.groupName}" al ${slot.occupancyPct}% de aforo`}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Preguntas clave respondidas automáticamente con los datos del club.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {cards.map((card, i) => (
```
(el resto del `.map` y cierre del componente no cambia).

- [ ] **Paso 6: Build**

Run: `npm run build`
Expected: sin errores de TypeScript.

- [ ] **Paso 7: Verificación manual**

Run: `npm run dev`, abrir `/analitica` (pestaña KPIs), confirmar que se ve el mapa de calor con colores y la lista de peores franjas debajo, y que las otras 5 tarjetas de preguntas siguen apareciendo igual que antes.

- [ ] **Paso 8: Commit**

```bash
git add src/components/shared/analytics/KPIsTab.tsx
git commit -m "feat: mapa de calor y lista de franjas infrautilizadas en KPIsTab"
```

---

### Task 3: `IntelligenceCards.tsx` — usar el módulo compartido

**Files:**
- Modify: `src/components/shared/analytics/IntelligenceCards.tsx`

- [ ] **Paso 1: Leer el archivo completo actual**

Confirmar el estado exacto de las líneas 24-37 (bloque `underutilizedSlots`/`underutilizedSummary`) y de la entrada `cards[0]` (líneas ~130-141) antes de editar.

- [ ] **Paso 2: Añadir el import y leer `courts`/`privateLessons` del store**

Añadir tras los imports existentes:
```ts
import { computeCourtUtilization, getUnderutilizedSlots } from '@/lib/court-utilization'
```

Cambiar:
```ts
const { groups, attendance, payments, coaches, enrollments } = useDataStore()
```
por:
```ts
const { groups, attendance, payments, coaches, enrollments, courts, privateLessons } = useDataStore()
```

- [ ] **Paso 3: Sustituir el bloque de cálculo**

Eliminar:
```ts
  // ── KPIs: Franjas infrautilizadas ────────────────────────────────
  const underutilizedSlots = useMemo(() => {
    const activeGroups = groups.filter(g => g.isActive)
    return activeGroups.filter(g => g.maxCapacity > 0 && g.currentEnrollment / g.maxCapacity < 0.6)
  }, [groups])

  const underutilizedSummary = useMemo(() => {
    if (underutilizedSlots.length === 0) return 'Todos los grupos bien ocupados'
    const example = underutilizedSlots[0]
    const slot = example.schedule[0]
    if (!slot) return `${underutilizedSlots.length} grupos`
    const pct = Math.round((example.currentEnrollment / example.maxCapacity) * 100)
    return `${DAY_NAMES[slot.dayOfWeek]} ${slot.startTime} · ${pct}% ocupación`
  }, [underutilizedSlots])
```

Sustituir por:
```ts
  // ── KPIs: Franjas infrautilizadas ────────────────────────────────
  const underutilizedCount = useMemo(() => {
    const utilization = computeCourtUtilization(courts, groups, privateLessons)
    return getUnderutilizedSlots(utilization).length
  }, [courts, groups, privateLessons])
```

- [ ] **Paso 4: Actualizar la tarjeta que usa estos valores**

Cambiar dentro del array `cards`:
```ts
      value: underutilizedSlots.length > 0
        ? `${underutilizedSlots.length} franja${underutilizedSlots.length > 1 ? 's' : ''} infrautilizada${underutilizedSlots.length > 1 ? 's' : ''}`
        : 'Ocupación óptima',
      sub: underutilizedSummary,
```
por:
```ts
      value: underutilizedCount > 0
        ? `${underutilizedCount} franja${underutilizedCount > 1 ? 's' : ''} infrautilizada${underutilizedCount > 1 ? 's' : ''}`
        : 'Ocupación óptima',
      sub: underutilizedCount > 0 ? 'Revisa el mapa de ocupación de pistas' : 'Todas las franjas bien aprovechadas',
```

- [ ] **Paso 5: Quitar `DAY_NAMES` si ha quedado sin uso**

Buscar `DAY_NAMES` en el archivo (`grep -n "DAY_NAMES" src/components/shared/analytics/IntelligenceCards.tsx`). Si tras los cambios anteriores ya no se usa en ningún otro sitio del archivo, eliminar la línea `const DAY_NAMES = [...]` (evita un error de variable no usada).

- [ ] **Paso 6: Build**

Run: `npm run build`
Expected: sin errores de TypeScript (ni de variable no usada).

- [ ] **Paso 7: Verificación manual**

Run: `npm run dev`, confirmar en el dashboard que la tarjeta "KPIs del Club" muestra el mismo número de franjas infrautilizadas que la pestaña completa (Task 2), y que el enlace sigue navegando a `/analitica?tab=kpis`.

- [ ] **Paso 8: Commit**

```bash
git add src/components/shared/analytics/IntelligenceCards.tsx
git commit -m "refactor: IntelligenceCards usa el calculo compartido de ocupacion de pistas"
```

---

## Verificación final

1. `npm run build` sin errores.
2. `npm test` — todos los tests existentes más los nuevos de `court-utilization.test.ts` en verde.
3. Manual: con al menos 2 pistas y varios grupos con horarios distintos (alguno con más de un horario semanal), confirmar en `/analitica` (pestaña KPIs) que el mapa de calor muestra celdas para todos los horarios de todos los grupos, que una pista sin grupo en una franja usada por otra pista aparece en rojo "Vacío", y que tras registrar una clase particular reciente en esa pista+franja pasa a "Ocasional" (gris) y desaparece de la lista de peores franjas.
4. Confirmar que el contador de `IntelligenceCards` en el dashboard coincide con el número de la pestaña completa.
