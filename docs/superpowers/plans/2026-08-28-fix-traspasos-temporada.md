# Fix traspaso de temporada (tarifas rotas) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Impedir que se puedan borrar tarifas todavía en uso, avisar y bloquear la confirmación
del traspaso de temporada mientras algún alumno tenga una tarifa que ya no existe, y permitir
elegir tarifas de cuotas por alumno en el traspaso (hoy solo se puede a nivel de grupo).

**Architecture:** Lógica pura y testeable en `src/lib/tariff-utils.ts` (nuevo, sin dependencias de
React, siguiendo el patrón de `src/lib/billing-utils.ts`), consumida por `SettingsPage.tsx` para
bloquear el borrado. La validación del traspaso vive inline en `RenewGroupsDialog.tsx` (no se
extrae a `lib/`, es composición específica de los tipos locales `GroupDraft`/`StudentDraft` del
propio diálogo, mismo criterio ya usado en este proyecto para derivaciones ligadas a una sola
página/diálogo).

**Tech Stack:** React 19 + TypeScript, Zustand (`useDataStore`), Vitest, Tailwind v4.

**Diseño de referencia:** `docs/superpowers/specs/2026-08-28-fix-traspasos-temporada-design.md`

---

## Task 1: `isTariffInUse` (`src/lib/tariff-utils.ts`)

**Files:**
- Create: `src/lib/tariff-utils.ts`
- Test: `src/lib/tariff-utils.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/lib/tariff-utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isTariffInUse } from '@/lib/tariff-utils'
import type { Enrollment, Group } from '@/types'

function makeEnrollment(overrides: Partial<Enrollment> = {}): Enrollment {
  return {
    id: 'e1',
    playerId: 'p1',
    playerName: 'Jugador',
    groupId: 'g1',
    groupName: 'Grupo 1',
    tariffId: 't1',
    tariffName: 'Tarifa 1',
    enrollmentDate: new Date('2026-01-01'),
    isActive: true,
    ...overrides,
  }
}

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 'g1',
    name: 'Grupo 1',
    level: 'intermedio',
    coachId: 'c1',
    coachName: 'Coach',
    courtId: 'ct1',
    courtName: 'Pista 1',
    schedule: [],
    maxCapacity: 8,
    currentEnrollment: 4,
    defaultTariffId: 't1',
    defaultTariffPrice: 50,
    billingFrequency: 'monthly',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    isActive: true,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  }
}

describe('isTariffInUse', () => {
  it('true si una matricula activa usa la tarifa', () => {
    const enrollments = [makeEnrollment({ tariffId: 't1', isActive: true })]
    expect(isTariffInUse('t1', enrollments, [])).toBe(true)
  })

  it('true si un grupo activo la tiene como tarifa por defecto', () => {
    const groups = [makeGroup({ defaultTariffId: 't1', isActive: true })]
    expect(isTariffInUse('t1', [], groups)).toBe(true)
  })

  it('false si solo la usan matriculas o grupos inactivos', () => {
    const enrollments = [makeEnrollment({ tariffId: 't1', isActive: false })]
    const groups = [makeGroup({ defaultTariffId: 't1', isActive: false })]
    expect(isTariffInUse('t1', enrollments, groups)).toBe(false)
  })

  it('false si nadie la usa', () => {
    const enrollments = [makeEnrollment({ tariffId: 'otra', isActive: true })]
    const groups = [makeGroup({ defaultTariffId: 'otra', isActive: true })]
    expect(isTariffInUse('t1', enrollments, groups)).toBe(false)
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que fallan**

Run: `npm test -- tariff-utils.test.ts`
Expected: FAIL — el módulo `@/lib/tariff-utils` no existe.

- [ ] **Step 3: Implementar**

Crear `src/lib/tariff-utils.ts`:

```ts
import type { Enrollment, Group } from '@/types'

/** `true` si alguna matricula activa o algun grupo activo sigue usando esta tarifa. */
export function isTariffInUse(tariffId: string, enrollments: Enrollment[], groups: Group[]): boolean {
  const usedByEnrollment = enrollments.some((e) => e.isActive && e.tariffId === tariffId)
  const usedByGroup = groups.some((g) => g.isActive && g.defaultTariffId === tariffId)
  return usedByEnrollment || usedByGroup
}
```

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npm test -- tariff-utils.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/tariff-utils.ts src/lib/tariff-utils.test.ts
git commit -m "feat: añadir isTariffInUse en tariff-utils"
```

---

## Task 2: `tariffUsageCount` (`src/lib/tariff-utils.ts`)

**Files:**
- Modify: `src/lib/tariff-utils.ts`
- Modify: `src/lib/tariff-utils.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `src/lib/tariff-utils.test.ts`:

```ts
import { tariffUsageCount } from '@/lib/tariff-utils'

describe('tariffUsageCount', () => {
  it('cuenta matriculas y grupos activos por separado', () => {
    const enrollments = [
      makeEnrollment({ id: 'e1', tariffId: 't1', isActive: true }),
      makeEnrollment({ id: 'e2', tariffId: 't1', isActive: true }),
      makeEnrollment({ id: 'e3', tariffId: 't1', isActive: false }),
    ]
    const groups = [
      makeGroup({ id: 'g1', defaultTariffId: 't1', isActive: true }),
      makeGroup({ id: 'g2', defaultTariffId: 't1', isActive: false }),
    ]
    expect(tariffUsageCount('t1', enrollments, groups)).toEqual({ enrollmentCount: 2, groupCount: 1 })
  })

  it('devuelve ceros si nadie la usa', () => {
    expect(tariffUsageCount('t1', [], [])).toEqual({ enrollmentCount: 0, groupCount: 0 })
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- tariff-utils.test.ts`
Expected: FAIL — `tariffUsageCount` no existe.

- [ ] **Step 3: Implementar**

Añadir a `src/lib/tariff-utils.ts`:

```ts
export interface TariffUsageCount {
  enrollmentCount: number
  groupCount: number
}

/** Cuantas matriculas activas y cuantos grupos activos usan esta tarifa, para mensajes de error. */
export function tariffUsageCount(tariffId: string, enrollments: Enrollment[], groups: Group[]): TariffUsageCount {
  return {
    enrollmentCount: enrollments.filter((e) => e.isActive && e.tariffId === tariffId).length,
    groupCount: groups.filter((g) => g.isActive && g.defaultTariffId === tariffId).length,
  }
}
```

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npm test -- tariff-utils.test.ts`
Expected: PASS (6 tests en total en este archivo)

- [ ] **Step 5: Commit**

```bash
git add src/lib/tariff-utils.ts src/lib/tariff-utils.test.ts
git commit -m "feat: añadir tariffUsageCount en tariff-utils"
```

---

## Task 3: Bloquear el borrado de tarifas en uso (`SettingsPage.tsx`)

**Files:**
- Modify: `src/pages/SettingsPage.tsx`

- [ ] **Step 1: Leer el archivo actual**

Confirma que la línea 1-16 de imports y la desestructuración de `useDataStore()` (línea 31-35)
coinciden con lo descrito abajo antes de editar.

- [ ] **Step 2: Añadir los imports necesarios**

Añadir junto a los imports existentes de `src/pages/SettingsPage.tsx`:

```tsx
import { toast } from '@/hooks/use-toast'
import { isTariffInUse, tariffUsageCount } from '@/lib/tariff-utils'
```

- [ ] **Step 3: Añadir `enrollments` y `groups` a la desestructuración de `useDataStore()`**

Reemplazar:

```tsx
  const {
    club, courts, tariffs,
    updateClub, addCourt, updateCourt, deleteCourt,
    addTariff, updateTariff, deleteTariff,
  } = useDataStore()
```

por:

```tsx
  const {
    club, courts, tariffs, enrollments, groups,
    updateClub, addCourt, updateCourt, deleteCourt,
    addTariff, updateTariff, deleteTariff,
  } = useDataStore()
```

- [ ] **Step 4: Bloquear el borrado en el botón "Eliminar" de cada tarifa**

Reemplazar:

```tsx
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTariffId(tariff.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
```

por:

```tsx
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => {
                                if (isTariffInUse(tariff.id, enrollments, groups)) {
                                  const { enrollmentCount, groupCount } = tariffUsageCount(tariff.id, enrollments, groups)
                                  const parts = []
                                  if (enrollmentCount > 0) parts.push(`${enrollmentCount} alumno(s)`)
                                  if (groupCount > 0) parts.push(`${groupCount} grupo(s)`)
                                  toast.error(
                                    `No se puede eliminar "${tariff.name}": la usan ${parts.join(' y ')}. Desactívala en su lugar (Editar → Activa/Inactiva) si no quieres que se siga usando.`,
                                    7000
                                  )
                                  return
                                }
                                setDeleteTariffId(tariff.id)
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
```

- [ ] **Step 5: Verificar build**

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/pages/SettingsPage.tsx
git commit -m "fix: bloquear el borrado de tarifas todavia en uso"
```

---

## Task 4: Validar y avisar antes de confirmar el traspaso (`RenewGroupsDialog.tsx`)

**Files:**
- Modify: `src/components/shared/RenewGroupsDialog.tsx`

- [ ] **Step 1: Leer el archivo actual**

Confirma que el contenido coincide con lo descrito abajo (líneas aproximadas: imports 1-14,
`activeIndividualTariffs` en 54-57, `drafts` useState 62-103, render de grupos 199-361, footer
364-371) antes de editar. Si no coincide, pregunta antes de improvisar.

- [ ] **Step 2: Importar `cn`**

Añadir a los imports:

```tsx
import { cn } from '@/lib/utils'
```

- [ ] **Step 3: Añadir el resumen de validación**

Insertar, justo después del bloque `const [submitting, setSubmitting] = useState(false)`:

```tsx
  const validationSummary = useMemo(() => {
    let invalidStudentCount = 0
    let invalidGroupCount = 0
    for (const group of groups) {
      const draft = drafts[group.id]
      const defaultTariffInvalid = !tariffs.some((t) => t.id === draft.defaultTariffId)
      const groupInvalidStudents = draft.includeStudents
        ? draft.students.filter((s) => s.included && !tariffs.some((t) => t.id === s.tariffId)).length
        : 0
      invalidStudentCount += groupInvalidStudents
      if (defaultTariffInvalid || groupInvalidStudents > 0) invalidGroupCount += 1
    }
    return { invalidStudentCount, invalidGroupCount, hasBlockingIssues: invalidGroupCount > 0 }
  }, [groups, drafts, tariffs])
```

- [ ] **Step 4: Mostrar el aviso en la cabecera de cada grupo con problemas**

Reemplazar:

```tsx
          {groups.map((group) => {
            const draft = drafts[group.id]
            const isOpen = expanded[group.id]

            return (
              <div key={group.id} className="border rounded-lg">
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-2 p-3 text-left font-medium"
                  onClick={() => setExpanded((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
                >
                  <span className="min-w-0 truncate">{group.name}</span>
                  {isOpen ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
                </button>
```

por:

```tsx
          {groups.map((group) => {
            const draft = drafts[group.id]
            const isOpen = expanded[group.id]
            const defaultTariffInvalid = !tariffs.some((t) => t.id === draft.defaultTariffId)
            const invalidStudentIds = new Set(
              draft.includeStudents
                ? draft.students
                    .filter((s) => s.included && !tariffs.some((t) => t.id === s.tariffId))
                    .map((s) => s.playerId)
                : []
            )
            const groupHasIssue = defaultTariffInvalid || invalidStudentIds.size > 0

            return (
              <div key={group.id} className={cn('border rounded-lg', groupHasIssue && 'border-red-300')}>
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-2 p-3 text-left font-medium"
                  onClick={() => setExpanded((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
                >
                  <span className="min-w-0 truncate flex items-center gap-2">
                    {group.name}
                    {groupHasIssue && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 shrink-0">
                        {defaultTariffInvalid
                          ? 'Tarifa por defecto no válida'
                          : `${invalidStudentIds.size} alumno(s) con tarifa no válida`}
                      </span>
                    )}
                  </span>
                  {isOpen ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
                </button>
```

- [ ] **Step 5: Marcar el selector de tarifa por defecto cuando es inválido**

Reemplazar:

```tsx
                      <div>
                        <Label>Tarifa por defecto</Label>
                        <Select
                          options={activeTariffs.map((t) => ({
                            value: t.id,
                            label: `${t.name} (${formatCurrency(t.price)})`,
                          }))}
                          value={draft.defaultTariffId}
                          onChange={(e) => {
                            const tariffId = e.target.value
                            const tariff = tariffs.find((t) => t.id === tariffId)
                            updateDraft(group.id, {
                              defaultTariffId: tariffId,
                              defaultTariffPrice: tariff?.price ?? 0,
                              billingFrequency: tariff?.billingFrequency ?? 'monthly',
                              installmentPrices: tariff?.installmentPrices,
                            })
                          }}
                        />
                      </div>
```

por:

```tsx
                      <div>
                        <Label>Tarifa por defecto</Label>
                        <Select
                          className={cn(defaultTariffInvalid && 'border-red-400 ring-1 ring-red-300')}
                          options={activeTariffs.map((t) => ({
                            value: t.id,
                            label: `${t.name} (${formatCurrency(t.price)})`,
                          }))}
                          value={draft.defaultTariffId}
                          onChange={(e) => {
                            const tariffId = e.target.value
                            const tariff = tariffs.find((t) => t.id === tariffId)
                            updateDraft(group.id, {
                              defaultTariffId: tariffId,
                              defaultTariffPrice: tariff?.price ?? 0,
                              billingFrequency: tariff?.billingFrequency ?? 'monthly',
                              installmentPrices: tariff?.installmentPrices,
                            })
                          }}
                        />
                        {defaultTariffInvalid && (
                          <p className="text-xs text-red-600 mt-1">Esta tarifa ya no existe — elige otra.</p>
                        )}
                      </div>
```

- [ ] **Step 6: Marcar la fila de cada alumno inválido**

Reemplazar:

```tsx
                              {draft.students.map((student) => (
                                <tr key={student.playerId} className="border-t">
                                  <td className="p-1.5">
```

por:

```tsx
                              {draft.students.map((student) => {
                                const studentInvalid = invalidStudentIds.has(student.playerId)
                                return (
                                <tr key={student.playerId} className={cn('border-t', studentInvalid && 'bg-red-50')}>
                                  <td className="p-1.5">
```

Y reemplazar el cierre de esa fila:

```tsx
                                </tr>
                              ))}
                            </tbody>
```

por:

```tsx
                                </tr>
                                )
                              })}
                            </tbody>
```

Y, dentro de la celda de la tarifa (justo después del `<Select ... disabled={!student.included} />` de la
tarifa del alumno, antes de cerrar `</td>`), añadir el aviso:

```tsx
                                    {studentInvalid && (
                                      <p className="text-[10px] text-red-600 mt-0.5">Tarifa no disponible — elige otra o desmárcalo.</p>
                                    )}
```

(Esta línea va inmediatamente después del `<Select .../>` que ya existe en la celda `<td className="p-1.5">` de "Tarifa", antes de su `</td>` de cierre — es la celda que hoy termina justo antes de la celda de "Precio".)

- [ ] **Step 7: Bloquear el botón de confirmar mientras haya problemas**

Reemplazar:

```tsx
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Traspasando...' : `Confirmar traspaso de ${groups.length} grupo(s)`}
          </Button>
        </DialogFooter>
```

por:

```tsx
        {validationSummary.hasBlockingIssues && (
          <p className="text-xs text-red-600 -mb-1">
            {validationSummary.invalidStudentCount > 0
              ? `Resuelve ${validationSummary.invalidStudentCount} alumno(s) con tarifa no válida antes de continuar: elige otra tarifa o desmárcalos.`
              : 'Alguno de los grupos tiene una tarifa por defecto no válida — elige otra antes de continuar.'}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={submitting || validationSummary.hasBlockingIssues}>
            {submitting ? 'Traspasando...' : `Confirmar traspaso de ${groups.length} grupo(s)`}
          </Button>
        </DialogFooter>
```

- [ ] **Step 8: Verificar build**

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 9: Commit**

```bash
git add src/components/shared/RenewGroupsDialog.tsx
git commit -m "fix: avisar y bloquear el traspaso mientras haya alumnos con tarifa no valida"
```

---

## Task 5: Tarifas de cuotas seleccionables por alumno (`RenewGroupsDialog.tsx`)

**Files:**
- Modify: `src/components/shared/RenewGroupsDialog.tsx`

- [ ] **Step 1: Quitar el `useMemo` de `activeIndividualTariffs` (queda sin uso tras este cambio)**

Eliminar:

```tsx
  const activeIndividualTariffs = useMemo(
    () => activeTariffs.filter((t) => t.billingFrequency !== 'installments'),
    [activeTariffs]
  )
```

- [ ] **Step 2: Abrir el selector de tarifa por alumno a todas las tarifas activas**

Reemplazar:

```tsx
                                  <td className="p-1.5">
                                    <Select
                                      className="h-7 min-w-[170px] text-xs"
                                      value={student.tariffId}
                                      onChange={(e) => {
                                        const tariffId = e.target.value
                                        const tariff = tariffs.find((t) => t.id === tariffId)
                                        updateStudent(group.id, student.playerId, {
                                          tariffId,
                                          customPrice: tariff?.price ?? 0,
                                          billingFrequency: tariff?.billingFrequency ?? 'monthly',
                                        })
                                      }}
                                      options={(() => {
                                        const currentTariff = tariffs.find((t) => t.id === student.tariffId)
                                        const rowTariffs = currentTariff?.billingFrequency === 'installments'
                                          ? [...activeIndividualTariffs, currentTariff]
                                          : activeIndividualTariffs
                                        return rowTariffs.map((t) => ({ value: t.id, label: t.name }))
                                      })()}
                                      disabled={!student.included}
                                    />
                                    {studentInvalid && (
                                      <p className="text-[10px] text-red-600 mt-0.5">Tarifa no disponible — elige otra o desmárcalo.</p>
                                    )}
                                  </td>
```

por:

```tsx
                                  <td className="p-1.5">
                                    <Select
                                      className={cn('h-7 min-w-[170px] text-xs', studentInvalid && 'border-red-400 ring-1 ring-red-300')}
                                      value={student.tariffId}
                                      onChange={(e) => {
                                        const tariffId = e.target.value
                                        const tariff = tariffs.find((t) => t.id === tariffId)
                                        const freq = tariff?.billingFrequency ?? 'monthly'
                                        updateStudent(group.id, student.playerId, {
                                          tariffId,
                                          customPrice: freq === 'installments' ? undefined : (tariff?.price ?? 0),
                                          billingFrequency: freq,
                                        })
                                      }}
                                      options={activeTariffs.map((t) => ({ value: t.id, label: t.name }))}
                                      disabled={!student.included}
                                    />
                                    {studentInvalid && (
                                      <p className="text-[10px] text-red-600 mt-0.5">Tarifa no disponible — elige otra o desmárcalo.</p>
                                    )}
                                  </td>
```

(Nota: este `Select` ya venía con la marca visual roja `studentInvalid && ...` añadida en la Tarea
4 — aquí se combina con el resto de cambios de esta celda: opciones ampliadas a `activeTariffs` y
el `onChange` que ya no materializa el precio de cuotas.)

- [ ] **Step 3: No mostrar un campo de precio editable para alumnos en cuotas**

Reemplazar:

```tsx
                                  <td className="p-1.5">
                                    <Input
                                      type="number"
                                      className="h-7 min-w-[70px] text-xs"
                                      value={student.customPrice ?? ''}
                                      onChange={(e) => {
                                        const raw = e.target.value
                                        updateStudent(group.id, student.playerId, {
                                          customPrice: raw === '' ? undefined : (parseFloat(raw) || 0),
                                        })
                                      }}
                                      disabled={!student.included}
                                    />
                                  </td>
```

por:

```tsx
                                  <td className="p-1.5">
                                    {student.billingFrequency === 'installments' ? (
                                      <span className="text-slate-400 text-[11px]">Según cuotas del grupo</span>
                                    ) : (
                                      <Input
                                        type="number"
                                        className="h-7 min-w-[70px] text-xs"
                                        value={student.customPrice ?? ''}
                                        onChange={(e) => {
                                          const raw = e.target.value
                                          updateStudent(group.id, student.playerId, {
                                            customPrice: raw === '' ? undefined : (parseFloat(raw) || 0),
                                          })
                                        }}
                                        disabled={!student.included}
                                      />
                                    )}
                                  </td>
```

- [ ] **Step 4: Verificar build**

Run: `npm run build`
Expected: sin errores. Confirma que no queda ninguna referencia a `activeIndividualTariffs`
(búscalo en el archivo).

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/RenewGroupsDialog.tsx
git commit -m "feat: permitir tarifas de cuotas por alumno en el traspaso de temporada"
```

---

## Task 6: Verificación final

**Files:** (ninguno — solo verificación)

- [ ] **Step 1: Suite completa de tests**

Run: `npm test`
Expected: todos los tests pasan, incluidos los 6 nuevos de `tariff-utils.test.ts`.

- [ ] **Step 2: Build de producción**

Run: `npm run build`
Expected: sin errores ni warnings de TypeScript.

- [ ] **Step 3: Repaso de código (checklist del spec, sección "Verificación manual")**

Lee `RenewGroupsDialog.tsx` y `SettingsPage.tsx` completos y confirma por lectura de código
(no hay navegador disponible en este entorno):

1. `SettingsPage.tsx`: el botón "Eliminar" de una tarifa llama a `isTariffInUse` antes de abrir
   el diálogo de confirmación; si está en uso, muestra `toast.error` con el recuento y no llama
   a `setDeleteTariffId`.
2. `RenewGroupsDialog.tsx`: `validationSummary` se recalcula correctamente cuando cambian
   `drafts` (cambiar la tarifa de un alumno o desmarcarlo debe actualizar el aviso sin recargar
   el diálogo).
3. El botón "Confirmar traspaso" tiene `disabled={submitting || validationSummary.hasBlockingIssues}`.
4. El selector de tarifa por alumno usa `activeTariffs` (todas las activas) y ya no existe
   `activeIndividualTariffs` en el archivo.
5. Cuando `billingFrequency === 'installments'` para un alumno, la celda de precio muestra el
   texto fijo, no un `<Input>`.
6. Ningún caso feliz (grupos sin alumnos con tarifas rotas) cambia de comportamiento: sigue
   siendo posible confirmar y traspasar normalmente.

- [ ] **Step 4: Confirmar que no queda nada sin commitear**

Run: `git status --short`
Expected: sin cambios pendientes.
