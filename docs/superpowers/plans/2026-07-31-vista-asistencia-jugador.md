# Vista de asistencia de solo lectura para jugador/tutor — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un jugador o tutor que entre en `/asistencia` vea únicamente el historial de sus propias clases (fecha, grupo, estado), en vez del editor de gestión de asistencia que hoy ven por defecto (con acceso a todos los grupos del club).

**Architecture:** Una función pura `getMyAttendanceForMonth` filtra/ordena los registros de asistencia de un alumno para un mes/año dado; un componente nuevo `MyAttendanceView` la consume junto con un selector de mes/año; `AttendancePage.tsx` añade un guard de rol que renderiza este componente en vez del editor cuando el rol activo es `jugador`/`tutor`. Sin cambios de rutas ni de Firestore rules (ya cierran la escritura correctamente).

**Tech Stack:** React 19 + TypeScript, Zustand, React Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-31-vista-asistencia-jugador-design.md`

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/lib/attendance-utils.ts` | Crear | Función pura de filtrado/ordenación por alumno+mes+año |
| `src/lib/attendance-utils.test.ts` | Crear | Tests de la función pura |
| `src/components/attendance/MyAttendanceView.tsx` | Crear | Selector de mes/año + lista de clases del alumno |
| `src/pages/AttendancePage.tsx` | Modificar | Guard de rol: jugador/tutor ven `MyAttendanceView` |

### Nota de diseño respecto al spec

El spec mencionaba cruzar con `enrollments` "para no arrastrar registros de grupos ajenos". Al revisar `AttendanceEntry`/`AttendanceRecord` esto no hace falta: un registro de asistencia solo contiene una entrada por alumno que realmente participó en esa clase (incluidas las recuperaciones en grupos donde no está matriculado — que el alumno **debe** poder ver como parte de su asistencia). Filtrar por `entry.playerId === studentId` dentro de cada `AttendanceRecord` ya es exacto y más simple; no se necesita `enrollments` en absoluto. El plan implementa esta versión simplificada.

---

### Task 1: Función pura `getMyAttendanceForMonth` (TDD)

**Files:**
- Create: `src/lib/attendance-utils.ts`
- Create: `src/lib/attendance-utils.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/lib/attendance-utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getMyAttendanceForMonth } from '@/lib/attendance-utils'
import type { AttendanceRecord } from '@/types'

function makeRecord(overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: 'r1',
    groupId: 'g1',
    groupName: 'Grupo Intermedio',
    date: new Date('2026-07-10T10:00:00'),
    records: [
      { playerId: 'p1', playerName: 'Ana', status: 'presente', isRecovery: false },
    ],
    coachId: 'c1',
    createdAt: new Date('2026-07-10T10:00:00'),
    ...overrides,
  }
}

describe('getMyAttendanceForMonth', () => {
  it('incluye un registro del alumno en el mes/año pedidos', () => {
    const rows = getMyAttendanceForMonth([makeRecord()], 'p1', 7, 2026)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      recordId: 'r1',
      groupName: 'Grupo Intermedio',
      status: 'presente',
    })
  })

  it('ignora registros de otro mes', () => {
    const rows = getMyAttendanceForMonth([makeRecord()], 'p1', 8, 2026)
    expect(rows).toHaveLength(0)
  })

  it('ignora registros de otro año', () => {
    const rows = getMyAttendanceForMonth([makeRecord()], 'p1', 7, 2025)
    expect(rows).toHaveLength(0)
  })

  it('ignora registros donde el alumno no participó', () => {
    const record = makeRecord({
      records: [{ playerId: 'otro', playerName: 'Luis', status: 'presente', isRecovery: false }],
    })
    const rows = getMyAttendanceForMonth([record], 'p1', 7, 2026)
    expect(rows).toHaveLength(0)
  })

  it('incluye recuperaciones en grupos donde el alumno no está matriculado', () => {
    const record = makeRecord({
      groupId: 'otro-grupo',
      groupName: 'Grupo Avanzado',
      records: [{ playerId: 'p1', playerName: 'Ana', status: 'presente', isRecovery: true }],
    })
    const rows = getMyAttendanceForMonth([record], 'p1', 7, 2026)
    expect(rows).toHaveLength(1)
    expect(rows[0].groupName).toBe('Grupo Avanzado')
  })

  it('ordena de más reciente a más antiguo', () => {
    const older = makeRecord({ id: 'r-old', date: new Date('2026-07-02T10:00:00') })
    const newer = makeRecord({ id: 'r-new', date: new Date('2026-07-20T10:00:00') })
    const rows = getMyAttendanceForMonth([older, newer], 'p1', 7, 2026)
    expect(rows.map((r) => r.recordId)).toEqual(['r-new', 'r-old'])
  })

  it('acepta date como string ISO (rehidratado de localStorage)', () => {
    const record = makeRecord({ date: '2026-07-15T10:00:00' as unknown as Date })
    const rows = getMyAttendanceForMonth([record], 'p1', 7, 2026)
    expect(rows).toHaveLength(1)
  })

  it('devuelve vacío si no hay registros', () => {
    expect(getMyAttendanceForMonth([], 'p1', 7, 2026)).toEqual([])
  })
})
```

- [ ] **Step 2: Ejecutar los tests y comprobar que fallan**

Run: `npm test -- attendance-utils`
Expected: FAIL — `getMyAttendanceForMonth` no existe en `@/lib/attendance-utils`.

- [ ] **Step 3: Implementar la función**

Crear `src/lib/attendance-utils.ts`:

```ts
import type { AttendanceRecord, AttendanceStatus } from '@/types'

export interface MyAttendanceRow {
  recordId: string
  date: Date
  groupName: string
  status: AttendanceStatus
}

/**
 * Historial de clases de un alumno en un mes/año concreto, más reciente
 * primero. Filtra por participación real del alumno en cada registro
 * (`records.find`), no por matrícula en el grupo: así se incluyen también
 * las recuperaciones en grupos donde el alumno no está inscrito.
 *
 * `record.date` está tipado Date pero `attendance` se persiste en
 * localStorage (partialize del store), así que tras rehidratar puede
 * llegar como string ISO — de ahí la coerción con `new Date(...)`.
 */
export function getMyAttendanceForMonth(
  attendance: AttendanceRecord[],
  studentId: string,
  month: number, // 1-12
  year: number
): MyAttendanceRow[] {
  const rows: MyAttendanceRow[] = []

  for (const record of attendance) {
    const date = new Date(record.date)
    if (date.getMonth() + 1 !== month || date.getFullYear() !== year) continue

    const entry = record.records.find((r) => r.playerId === studentId)
    if (!entry) continue

    rows.push({
      recordId: record.id,
      date,
      groupName: record.groupName,
      status: entry.status,
    })
  }

  return rows.sort((a, b) => b.date.getTime() - a.date.getTime())
}
```

- [ ] **Step 4: Ejecutar los tests y comprobar que pasan**

Run: `npm test -- attendance-utils`
Expected: PASS — 7 tests.

- [ ] **Step 5: Comprobar que el resto de la suite sigue en verde**

Run: `npm test`
Expected: PASS — 30 tests (23 existentes + 7 nuevos).

- [ ] **Step 6: Commit**

```bash
git add src/lib/attendance-utils.ts src/lib/attendance-utils.test.ts
git commit -m "feat: add getMyAttendanceForMonth helper for player attendance view"
```

---

### Task 2: Componente `MyAttendanceView`

**Files:**
- Create: `src/components/attendance/MyAttendanceView.tsx`

- [ ] **Step 1: Crear el componente**

Crear `src/components/attendance/MyAttendanceView.tsx`:

```tsx
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/shared/EmptyState'
import { useEffectiveStudent } from '@/hooks/usePlayerData'
import { useAttendanceQuery } from '@/hooks/useQueries'
import { getMyAttendanceForMonth } from '@/lib/attendance-utils'
import { MONTHS } from '@/constants'
import { formatDate } from '@/lib/utils'
import { ClipboardCheck } from 'lucide-react'
import type { AttendanceStatus } from '@/types'

const currentYear = new Date().getFullYear()
const YEAR_OPTIONS = [currentYear - 1, currentYear, currentYear + 1].map((y) => ({
  value: String(y),
  label: String(y),
}))

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  presente: 'bg-green-100 text-green-700 border-green-300',
  ausente: 'bg-red-100 text-red-700 border-red-300',
  justificado: 'bg-yellow-100 text-yellow-700 border-yellow-300',
}

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  presente: 'Presente',
  ausente: 'Ausente',
  justificado: 'Justificado',
}

/**
 * Historial de asistencia de solo lectura para jugador/tutor. Muestra las
 * clases del alumno efectivo (hijo activo si es tutor) para el mes/año
 * seleccionados, sin acceso al editor de gestión de asistencia.
 */
export function MyAttendanceView() {
  const { studentId } = useEffectiveStudent()
  const { data: attendance = [] } = useAttendanceQuery()

  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())

  const rows = studentId
    ? getMyAttendanceForMonth(attendance, studentId, selectedMonth, selectedYear)
    : []

  const monthLabel = MONTHS.find((m) => m.value === selectedMonth)?.label ?? ''

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex gap-3">
        <Select
          options={MONTHS.map((m) => ({ value: String(m.value), label: m.label }))}
          value={String(selectedMonth)}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
          className="flex-1"
        />
        <Select
          options={YEAR_OPTIONS}
          value={String(selectedYear)}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="w-28"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Sin clases registradas"
          description={`No hay registro de asistencia en ${monthLabel} ${selectedYear}.`}
        />
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Card key={row.recordId}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{row.groupName}</p>
                  <p className="text-sm text-muted-foreground">{formatDate(row.date)}</p>
                </div>
                <span
                  className={`text-xs font-medium px-3 py-1.5 rounded-md border ${STATUS_STYLES[row.status]}`}
                >
                  {STATUS_LABELS[row.status]}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
```

Nota: `MONTHS` (de `@/constants`) tiene `value: number`; `Select` espera `options: {value: string, label: string}[]` — por eso se mapea con `String(m.value)`, siguiendo el mismo patrón ya usado en `GroupDetailPage.tsx`.

- [ ] **Step 2: Comprobar que compila**

Run: `npm run build`
Expected: `✓ built` sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/attendance/MyAttendanceView.tsx
git commit -m "feat: add MyAttendanceView component for read-only attendance history"
```

---

### Task 3: Guard de rol en `AttendancePage.tsx`

**Files:**
- Modify: `src/pages/AttendancePage.tsx`

- [ ] **Step 1: Importar el componente nuevo**

En `src/pages/AttendancePage.tsx`, junto al resto de imports (cerca de la línea 41-42):

```ts
import { AttendanceCalendar } from '@/components/attendance/AttendanceCalendar'
import { useNextClass } from '@/hooks/useNextClass'
```

Añadir debajo:

```ts
import { MyAttendanceView } from '@/components/attendance/MyAttendanceView'
```

- [ ] **Step 2: Declarar el flag de rol**

Encontrar (línea 73-75):

```ts
  const activeRole = user?.activeRole ?? user?.role
  const isEntrenador = activeRole === 'entrenador'
  const isAdmin = activeRole === 'director' || activeRole === 'coordinador'
```

Añadir debajo:

```ts
  const isPlayerOrTutor = activeRole === 'jugador' || activeRole === 'tutor'
```

- [ ] **Step 3: Añadir el early return**

Encontrar el inicio del primer `return` condicional del componente (línea ~529):

```tsx
  if (pageView === 'sheet' && sheetGroup) {
```

Insertar justo encima (después de todos los hooks del componente, que ya han corrido en este punto — mismo patrón que los `if` de `pageView` que le siguen):

```tsx
  if (isPlayerOrTutor) {
    return (
      <div>
        <Header title="Mi Asistencia" subtitle="Historial de tus clases" />
        <div className="p-4 sm:p-6">
          <MyAttendanceView />
        </div>
      </div>
    )
  }

  if (pageView === 'sheet' && sheetGroup) {
```

No cambiar nada más en el archivo — el resto de la lógica (`activeGroups`, `pageView`, el editor de asistencia, exportación, etc.) sigue existiendo igual para entrenador/admin, simplemente nunca se renderiza para jugador/tutor porque el `return` de este guard corta antes.

- [ ] **Step 4: Comprobar que compila**

Run: `npm run build`
Expected: `✓ built` sin errores.

- [ ] **Step 5: Comprobar que los tests siguen en verde**

Run: `npm test`
Expected: PASS — 30 tests.

- [ ] **Step 6: Commit**

```bash
git add src/pages/AttendancePage.tsx
git commit -m "fix: jugador y tutor ven su historial de asistencia, no el editor de gestion"
```

---

## Verificación manual final

Requiere `npm run dev`, con datos de asistencia ya generados para al menos un alumno (registros de meses distintos, alguno con estado `ausente`/`justificado`, y si es posible una recuperación en otro grupo).

1. **Jugador:** iniciar sesión con una cuenta de rol `jugador` → ir a `/asistencia` (directamente y también desde la tarjeta "Mi Asistencia" del dashboard) → debe verse la lista de sus clases del mes actual con el estado correcto, **sin** selector de grupo ni posibilidad de pasar lista.
2. **Cambiar de mes:** usar el selector de mes/año → la lista se actualiza a las clases de ese mes; un mes sin registros muestra el estado vacío ("Sin clases registradas en {mes} {año}").
3. **Recuperación:** si el alumno tiene una recuperación registrada en un grupo donde no está matriculado, debe aparecer igualmente en la lista con el nombre de ese grupo.
4. **Tutor:** iniciar sesión con una cuenta de `tutor` con un hijo activo → la lista corresponde al hijo seleccionado en el `ChildSwitcher`; cambiar de hijo actualiza la lista al hijo nuevo.
5. **Regresión entrenador/admin:** iniciar sesión con `entrenador`, `director` o `coordinador` → `/asistencia` sigue mostrando el editor de gestión exactamente igual que antes (selector de grupo, pasar lista, exportar, etc.), sin ningún cambio de comportamiento.
