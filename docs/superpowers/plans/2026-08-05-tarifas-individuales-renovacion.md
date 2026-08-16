# Tarifas individuales en la renovación de temporada — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el asistente de traspaso de temporada conserve (y permita editar) la tarifa, precio, frecuencia de facturación y mes de anclaje de cada alumno individualmente, en vez de imponer la configuración única del grupo a todos los alumnos transferidos.

**Architecture:** `renewGroup` (store) cambia de recibir una lista plana de IDs a recibir un array de configuración por alumno (`includedStudents`), y construye cada matrícula nueva con los valores propios de esa fila. `RenewGroupsDialog.tsx` sustituye la lista de checkboxes por una tabla editable por alumno, precargada desde la matrícula vieja de cada uno.

**Tech Stack:** React 19 + TypeScript, Zustand, Firebase Firestore.

---

### Task 1: `renewGroup` recibe configuración por alumno

**Files:**
- Modify: `src/stores/dataStore.ts`

**Contexto:** `renewGroup` está en `DataState` (firma, ~línea 175-196) y su implementación (~línea 1158-1284). Hoy recibe `includedPlayerIds: string[]` y aplica `groupData.billingFrequency`/`tariff.name` (los del grupo) a todas las matrículas nuevas por igual. Pasa a recibir `includedStudents`, con la configuración propia de cada alumno.

- [ ] **Paso 1: Leer el estado actual completo**

Leer `src/stores/dataStore.ts` líneas 175-200 (firma en `DataState`) y líneas 1158-1284 (implementación) para confirmar que coinciden con el código citado en este plan — puede haber cambiado ligeramente desde que se escribió.

- [ ] **Paso 2: Cambiar la firma en `DataState`**

Cambiar:
```ts
  renewGroup: (params: {
    oldGroupId: string
    seasonId: string
    groupData: {
      name: string
      level: PlayerLevel
      coachId: string
      coachName: string
      courtId: string
      courtName: string
      schedule: ScheduleSlot[]
      maxCapacity: number
      defaultTariffId: string
      defaultTariffPrice: number
      billingFrequency: BillingFrequency
      billingAnchorMonth?: number
      startDate: Date
      endDate: Date
    }
    includeStudents: boolean
    includedPlayerIds: string[]
  }) => Promise<{ newGroupId: string }>
```
por:
```ts
  renewGroup: (params: {
    oldGroupId: string
    seasonId: string
    groupData: {
      name: string
      level: PlayerLevel
      coachId: string
      coachName: string
      courtId: string
      courtName: string
      schedule: ScheduleSlot[]
      maxCapacity: number
      defaultTariffId: string
      defaultTariffPrice: number
      billingFrequency: BillingFrequency
      billingAnchorMonth?: number
      startDate: Date
      endDate: Date
    }
    includeStudents: boolean
    includedStudents: Array<{
      playerId: string
      tariffId: string
      customPrice?: number
      billingFrequency: BillingFrequency
      billingAnchorMonth?: number
    }>
  }) => Promise<{ newGroupId: string }>
```

(`renewGroups` no cambia — su tipo ya se deriva de `Parameters<DataState['renewGroup']>[0]`, así que hereda el cambio automáticamente.)

- [ ] **Paso 3: Actualizar la implementación**

Cambiar:
```ts
      renewGroup: async ({ oldGroupId, seasonId, groupData, includeStudents, includedPlayerIds }) => {
        const clubId = getClubId()
        if (!clubId) throw new Error('No clubId found')

        const oldGroup = get().groups.find((g) => g.id === oldGroupId)
        if (!oldGroup) throw new Error('Grupo no encontrado')

        const tariff = get().tariffs.find((t) => t.id === groupData.defaultTariffId)
        if (!tariff) throw new Error('Tarifa no encontrada')

        const now = new Date()
        const newGroupId = generateId()

        const activeEnrollments = get().enrollments.filter(
          (e) => e.groupId === oldGroupId && e.isActive
        )
        const includedEnrollments = includeStudents
          ? activeEnrollments.filter((e) => includedPlayerIds.includes(e.playerId))
          : []

        const newGroup: Group = {
          ...groupData,
          id: newGroupId,
          seasonId,
          renewedFromGroupId: oldGroupId,
          currentEnrollment: includedEnrollments.length,
          isActive: true,
          createdAt: now,
        }

        const newEnrollments: Enrollment[] = includedEnrollments.map((e) => ({
          id: generateId(),
          playerId: e.playerId,
          playerName: e.playerName,
          groupId: newGroupId,
          groupName: newGroup.name,
          tariffId: tariff.id,
          tariffName: tariff.name,
          billingFrequency: groupData.billingFrequency,
          billingAnchorMonth: groupData.billingAnchorMonth,
          enrollmentDate: now,
          isActive: true,
        }))
```
por:
```ts
      renewGroup: async ({ oldGroupId, seasonId, groupData, includeStudents, includedStudents }) => {
        const clubId = getClubId()
        if (!clubId) throw new Error('No clubId found')

        const oldGroup = get().groups.find((g) => g.id === oldGroupId)
        if (!oldGroup) throw new Error('Grupo no encontrado')

        if (!get().tariffs.some((t) => t.id === groupData.defaultTariffId)) {
          throw new Error('Tarifa no encontrada')
        }

        const now = new Date()
        const newGroupId = generateId()

        const activeEnrollments = get().enrollments.filter(
          (e) => e.groupId === oldGroupId && e.isActive
        )
        const studentsToInclude = includeStudents ? includedStudents : []

        const newGroup: Group = {
          ...groupData,
          id: newGroupId,
          seasonId,
          renewedFromGroupId: oldGroupId,
          currentEnrollment: studentsToInclude.length,
          isActive: true,
          createdAt: now,
        }

        const newEnrollments: Enrollment[] = studentsToInclude.map((student) => {
          const oldEnrollment = activeEnrollments.find((e) => e.playerId === student.playerId)
          if (!oldEnrollment) {
            throw new Error(`Matricula no encontrada para el alumno ${student.playerId}`)
          }
          const studentTariff = get().tariffs.find((t) => t.id === student.tariffId)
          if (!studentTariff) {
            throw new Error(`Tarifa no encontrada para ${oldEnrollment.playerName}`)
          }
          return {
            id: generateId(),
            playerId: student.playerId,
            playerName: oldEnrollment.playerName,
            groupId: newGroupId,
            groupName: newGroup.name,
            tariffId: studentTariff.id,
            tariffName: studentTariff.name,
            customPrice: student.customPrice,
            billingFrequency: student.billingFrequency,
            billingAnchorMonth: student.billingAnchorMonth,
            enrollmentDate: now,
            isActive: true,
          }
        })
```

- [ ] **Paso 4: Actualizar la referencia a `includedPlayerIdSet` (jugadores excluidos → lista de espera)**

Cambiar:
```ts
          // 5. Jugadores excluidos sin otras matriculas activas: pasan a lista_espera
          const includedPlayerIdSet = new Set(includedEnrollments.map((e) => e.playerId))
```
por:
```ts
          // 5. Jugadores excluidos sin otras matriculas activas: pasan a lista_espera
          const includedPlayerIdSet = new Set(studentsToInclude.map((s) => s.playerId))
```

(El resto de la función — `closedEnrollments`, `archivedOldGroup`, el `writeBatch`, el bucle de excluidos, `addActivity` — no cambia.)

- [ ] **Paso 5: Build**

Run: `npm run build`
Expected: FALLA — `src/components/shared/RenewGroupsDialog.tsx` sigue llamando a `renewGroups` con la forma antigua (`includedPlayerIds`). Esto es esperado, se corrige en la Tarea 2.

- [ ] **Paso 6: Commit**

```bash
git add src/stores/dataStore.ts
git commit -m "feat: renewGroup acepta configuracion de tarifa/frecuencia por alumno"
```

---

### Task 2: `RenewGroupsDialog.tsx` — tabla editable por alumno

**Files:**
- Modify: `src/components/shared/RenewGroupsDialog.tsx`

**Contexto:** Sustituye `GroupDraft.includedPlayerIds: Set<string>` por `GroupDraft.students: StudentDraft[]`, precargado desde la matrícula vieja de cada alumno. La tabla de alumnos gana columnas de tarifa/precio/frecuencia/anclaje editables.

- [ ] **Paso 1: Leer el estado actual completo**

Leer `src/components/shared/RenewGroupsDialog.tsx` entero para confirmar el estado exacto — puede haber cambiado ligeramente desde que se escribió este plan.

- [ ] **Paso 2: Añadir los imports necesarios**

Cambiar:
```ts
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useDataStore } from '@/stores/dataStore'
import { toast } from '@/hooks/use-toast'
import type { Group, BillingFrequency } from '@/types'
```
por:
```ts
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useDataStore } from '@/stores/dataStore'
import { toast } from '@/hooks/use-toast'
import { cycleLength } from '@/lib/billing-utils'
import type { Group, BillingFrequency } from '@/types'
```

- [ ] **Paso 3: Sustituir `GroupDraft` y añadir `StudentDraft`**

Cambiar:
```ts
interface GroupDraft {
  name: string
  defaultTariffId: string
  defaultTariffPrice: number
  billingFrequency: BillingFrequency
  billingAnchorMonth: number
  startDate: string
  endDate: string
  includeStudents: boolean
  includedPlayerIds: Set<string>
}
```
por:
```ts
interface StudentDraft {
  playerId: string
  playerName: string
  included: boolean
  tariffId: string
  customPrice: number
  billingFrequency: BillingFrequency
  billingAnchorMonth: number
}

interface GroupDraft {
  name: string
  defaultTariffId: string
  defaultTariffPrice: number
  billingFrequency: BillingFrequency
  billingAnchorMonth: number
  startDate: string
  endDate: string
  includeStudents: boolean
  students: StudentDraft[]
}
```

- [ ] **Paso 4: Leer `tariffs` del store y precargar `students` desde la matrícula vieja**

Cambiar:
```ts
export function RenewGroupsDialog({ open, onOpenChange, seasonId, groups, onDone }: RenewGroupsDialogProps) {
  const { seasons, enrollments, renewGroups } = useDataStore()
  const season = seasons.find((s) => s.id === seasonId)

  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(groups.map((g) => [g.id, true]))
  )
  const [drafts, setDrafts] = useState<Record<string, GroupDraft>>(() =>
    Object.fromEntries(
      groups.map((g) => {
        const activePlayerIds = enrollments
          .filter((e) => e.groupId === g.id && e.isActive)
          .map((e) => e.playerId)
        return [
          g.id,
          {
            name: g.name,
            defaultTariffId: g.defaultTariffId,
            defaultTariffPrice: g.defaultTariffPrice,
            billingFrequency: g.billingFrequency,
            billingAnchorMonth: 1,
            startDate: season ? toDateInput(season.startDate) : '',
            endDate: season ? toDateInput(season.endDate) : '',
            includeStudents: true,
            includedPlayerIds: new Set(activePlayerIds),
          },
        ]
      })
    )
  )
```
por:
```ts
export function RenewGroupsDialog({ open, onOpenChange, seasonId, groups, onDone }: RenewGroupsDialogProps) {
  const { seasons, enrollments, tariffs, renewGroups } = useDataStore()
  const season = seasons.find((s) => s.id === seasonId)

  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(groups.map((g) => [g.id, true]))
  )
  const [drafts, setDrafts] = useState<Record<string, GroupDraft>>(() =>
    Object.fromEntries(
      groups.map((g) => {
        const activeEnrollmentsForGroup = enrollments.filter((e) => e.groupId === g.id && e.isActive)
        const students: StudentDraft[] = activeEnrollmentsForGroup.map((e) => {
          const freq = e.billingFrequency ?? g.billingFrequency
          const tariff = tariffs.find((t) => t.id === e.tariffId)
          const computedPrice = (tariff?.price ?? g.defaultTariffPrice) * cycleLength(freq)
          return {
            playerId: e.playerId,
            playerName: e.playerName,
            included: true,
            tariffId: e.tariffId,
            customPrice: e.customPrice ?? computedPrice,
            billingFrequency: freq,
            billingAnchorMonth: e.billingAnchorMonth ?? 1,
          }
        })
        return [
          g.id,
          {
            name: g.name,
            defaultTariffId: g.defaultTariffId,
            defaultTariffPrice: g.defaultTariffPrice,
            billingFrequency: g.billingFrequency,
            billingAnchorMonth: 1,
            startDate: season ? toDateInput(season.startDate) : '',
            endDate: season ? toDateInput(season.endDate) : '',
            includeStudents: true,
            students,
          },
        ]
      })
    )
  )
```

- [ ] **Paso 5: Sustituir `togglePlayer` por `updateStudent`**

Cambiar:
```ts
  const togglePlayer = (groupId: string, playerId: string) => {
    setDrafts((prev) => {
      const draft = prev[groupId]
      const next = new Set(draft.includedPlayerIds)
      if (next.has(playerId)) next.delete(playerId)
      else next.add(playerId)
      return { ...prev, [groupId]: { ...draft, includedPlayerIds: next } }
    })
  }
```
por:
```ts
  const updateStudent = (groupId: string, playerId: string, patch: Partial<StudentDraft>) => {
    setDrafts((prev) => {
      const draft = prev[groupId]
      return {
        ...prev,
        [groupId]: {
          ...draft,
          students: draft.students.map((s) => (s.playerId === playerId ? { ...s, ...patch } : s)),
        },
      }
    })
  }
```

- [ ] **Paso 6: Actualizar `handleConfirm`**

Cambiar:
```ts
  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      const items = groups.map((group) => {
        const draft = drafts[group.id]
        return {
          oldGroupId: group.id,
          seasonId,
          groupData: {
            name: draft.name,
            level: group.level,
            coachId: group.coachId,
            coachName: group.coachName,
            courtId: group.courtId,
            courtName: group.courtName,
            schedule: group.schedule,
            maxCapacity: group.maxCapacity,
            defaultTariffId: draft.defaultTariffId,
            defaultTariffPrice: draft.defaultTariffPrice,
            billingFrequency: draft.billingFrequency,
            billingAnchorMonth:
              draft.billingFrequency === 'quarterly' || draft.billingFrequency === 'annual'
                ? draft.billingAnchorMonth
                : undefined,
            startDate: new Date(draft.startDate),
            endDate: new Date(draft.endDate),
          },
          includeStudents: draft.includeStudents,
          includedPlayerIds: Array.from(draft.includedPlayerIds),
        }
      })
      await renewGroups(items)
```
por:
```ts
  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      const items = groups.map((group) => {
        const draft = drafts[group.id]
        return {
          oldGroupId: group.id,
          seasonId,
          groupData: {
            name: draft.name,
            level: group.level,
            coachId: group.coachId,
            coachName: group.coachName,
            courtId: group.courtId,
            courtName: group.courtName,
            schedule: group.schedule,
            maxCapacity: group.maxCapacity,
            defaultTariffId: draft.defaultTariffId,
            defaultTariffPrice: draft.defaultTariffPrice,
            billingFrequency: draft.billingFrequency,
            billingAnchorMonth:
              draft.billingFrequency === 'quarterly' || draft.billingFrequency === 'annual'
                ? draft.billingAnchorMonth
                : undefined,
            startDate: new Date(draft.startDate),
            endDate: new Date(draft.endDate),
          },
          includeStudents: draft.includeStudents,
          includedStudents: draft.students
            .filter((s) => s.included)
            .map((s) => ({
              playerId: s.playerId,
              tariffId: s.tariffId,
              customPrice: s.customPrice,
              billingFrequency: s.billingFrequency,
              billingAnchorMonth:
                s.billingFrequency === 'quarterly' || s.billingFrequency === 'annual'
                  ? s.billingAnchorMonth
                  : undefined,
            })),
        }
      })
      await renewGroups(items)
```

- [ ] **Paso 7: Sustituir la lista de checkboxes por la tabla editable**

Cambiar:
```tsx
                    {draft.includeStudents && (
                      <div className="space-y-1 max-h-40 overflow-y-auto border rounded p-2">
                        {activeEnrollments.map((e) => (
                          <label key={e.playerId} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={draft.includedPlayerIds.has(e.playerId)}
                              onCheckedChange={() => togglePlayer(group.id, e.playerId)}
                            />
                            {e.playerName}
                          </label>
                        ))}
                        {activeEnrollments.length === 0 && (
                          <p className="text-xs text-slate-400">Sin alumnos matriculados actualmente.</p>
                        )}
                      </div>
                    )}
```
por:
```tsx
                    {draft.includeStudents && (
                      <div className="max-h-64 overflow-y-auto border rounded">
                        {draft.students.length === 0 ? (
                          <p className="text-xs text-slate-400 p-2">Sin alumnos matriculados actualmente.</p>
                        ) : (
                          <table className="w-full text-xs">
                            <thead className="bg-slate-50 sticky top-0">
                              <tr className="text-left text-slate-500">
                                <th className="p-1.5 w-6"></th>
                                <th className="p-1.5">Alumno</th>
                                <th className="p-1.5">Tarifa</th>
                                <th className="p-1.5 w-20">Precio</th>
                                <th className="p-1.5 w-28">Frecuencia</th>
                                <th className="p-1.5 w-16">Anclaje</th>
                              </tr>
                            </thead>
                            <tbody>
                              {draft.students.map((student) => (
                                <tr key={student.playerId} className="border-t">
                                  <td className="p-1.5">
                                    <Checkbox
                                      checked={student.included}
                                      onCheckedChange={(checked) =>
                                        updateStudent(group.id, student.playerId, { included: checked === true })
                                      }
                                    />
                                  </td>
                                  <td className="p-1.5">{student.playerName}</td>
                                  <td className="p-1.5">
                                    <Select
                                      className="h-7 text-xs"
                                      value={student.tariffId}
                                      onChange={(e) =>
                                        updateStudent(group.id, student.playerId, { tariffId: e.target.value })
                                      }
                                      options={tariffs.filter((t) => t.isActive).map((t) => ({ value: t.id, label: t.name }))}
                                      disabled={!student.included}
                                    />
                                  </td>
                                  <td className="p-1.5">
                                    <Input
                                      type="number"
                                      className="h-7 text-xs"
                                      value={student.customPrice}
                                      onChange={(e) =>
                                        updateStudent(group.id, student.playerId, { customPrice: parseFloat(e.target.value) || 0 })
                                      }
                                      disabled={!student.included}
                                    />
                                  </td>
                                  <td className="p-1.5">
                                    <Select
                                      className="h-7 text-xs"
                                      value={student.billingFrequency}
                                      onChange={(e) =>
                                        updateStudent(group.id, student.playerId, { billingFrequency: e.target.value as BillingFrequency })
                                      }
                                      options={BILLING_OPTIONS}
                                      disabled={!student.included}
                                    />
                                  </td>
                                  <td className="p-1.5">
                                    {(student.billingFrequency === 'quarterly' || student.billingFrequency === 'annual') ? (
                                      <Select
                                        className="h-7 text-xs"
                                        value={String(student.billingAnchorMonth)}
                                        onChange={(e) =>
                                          updateStudent(group.id, student.playerId, { billingAnchorMonth: parseInt(e.target.value, 10) })
                                        }
                                        options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
                                        disabled={!student.included}
                                      />
                                    ) : (
                                      <span className="text-slate-300">—</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
```

- [ ] **Paso 8: Quitar la referencia a `activeEnrollments` si ha quedado sin uso**

Buscar `activeEnrollments` en el archivo tras los cambios anteriores. La línea `const activeEnrollments = enrollments.filter((e) => e.groupId === group.id && e.isActive)` (dentro del `.map` de renderizado) ya no se usa (la tabla ahora usa `draft.students`) — eliminarla si el build marca la variable como no usada.

- [ ] **Paso 9: Build**

Run: `npm run build`
Expected: sin errores de TypeScript.

- [ ] **Paso 10: Verificación manual**

Run: `npm run dev`. Crear un grupo con dos alumnos: uno con tarifa mensual y otro con tarifa trimestral (ancla en septiembre). Abrir "Temporadas" → seleccionar el grupo → "Traspasar seleccionados" → confirmar que la tabla muestra a cada alumno con su tarifa/precio/frecuencia/anclaje correctos precargados. Cambiar la frecuencia de uno de ellos y confirmar el traspaso. Verificar en `GroupDetailPage.tsx` del grupo nuevo que las matrículas resultantes reflejan lo esperado (el alumno sin tocar conserva lo suyo, el modificado refleja el cambio).

- [ ] **Paso 11: Commit**

```bash
git add src/components/shared/RenewGroupsDialog.tsx
git commit -m "feat: tabla editable de tarifa/frecuencia por alumno en el asistente de traspaso"
```

---

## Verificación final

1. `npm run build` y `npm test` sin errores (no se añaden tests nuevos — `renewGroup` es una acción de store sin tests dedicados, consistente con el resto de acciones de `dataStore.ts`; `RenewGroupsDialog.tsx` es un componente sin test dedicado, igual que el resto de diálogos de este directorio).
2. Repetir el escenario manual completo del Paso 10 de la Tarea 2.
3. Confirmar que matricular a un alumno nuevo (fuera del asistente) en un grupo ya traspasado sigue proponiendo la tarifa/frecuencia del grupo por defecto, sin cambios de comportamiento.
