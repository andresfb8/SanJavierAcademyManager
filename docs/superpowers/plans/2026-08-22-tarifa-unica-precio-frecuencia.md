# Tarifa como única fuente de precio y frecuencia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En los tres diálogos donde se elige tarifa para un alumno (alta, traslado, traspaso de temporada), eliminar el selector de "Frecuencia de facturación" independiente — la frecuencia y el precio pasan a venir siempre de la tarifa elegida, corrigiendo el bug donde cambiar la tarifa de un alumno en el traspaso no actualizaba su precio.

**Architecture:** En `GroupDetailPage.tsx` y `MoveEnrollmentDialog.tsx`, se quita el `<Select>` de frecuencia y se sustituye por un texto de solo lectura derivado de la tarifa ya seleccionada (el estado interno no cambia, solo deja de exponerse como editable). En `RenewGroupsDialog.tsx`, el bloque de valores por defecto del grupo pasa de Precio+Frecuencia sueltos a un único selector de Tarifa, y en la tabla de alumnos, el `onChange` del selector de Tarifa por fila pasa a actualizar también `customPrice`/`billingFrequency` a la vez (antes solo actualizaba `tariffId`), además de mostrar nombres de mes en vez de números en el anclaje.

**Tech Stack:** React 19 + TypeScript, Zustand, Vitest.

---

## Task 1: `GroupDetailPage.tsx` — quitar el selector de frecuencia independiente

**Files:**
- Modify: `src/pages/GroupDetailPage.tsx`

Leer el archivo primero para confirmar el contenido exacto actual antes de editar (los números de línea pueden haber cambiado ligeramente).

- [ ] **Step 1: Añadir el texto de frecuencia derivada dentro del bloque de precio**

Buscar el bloque que empieza con `{/* Discount mode */}` (contiene el `<Label>Precio</Label>` y los radio buttons de "Precio tarifa"/"Descuento %"/"Precio especial", dentro de `{selectedTariffId && (...)}`). Justo después de la línea `<Label>Precio</Label>` y antes del `<div className="space-y-2">` que contiene los radio buttons, añadir:

```tsx
                <p className="text-xs text-muted-foreground">
                  Frecuencia: <span className="font-medium text-foreground">{billingFrequencyLabel(selectedBillingFrequency)}</span>
                </p>
```

`billingFrequencyLabel` ya está importado en este archivo (`import { billingFrequencyLabel } from '@/lib/billing-utils'`).

- [ ] **Step 2: Eliminar el bloque "Billing frequency"**

Buscar y eliminar por completo este bloque (el comentario `{/* Billing frequency */}` y su contenido):
```tsx
            {/* Billing frequency */}
            <div className="space-y-2">
              <Label>Frecuencia de facturación</Label>
              <Select
                options={BILLING_FREQUENCIES.map((f) => ({ value: f.value, label: f.label }))}
                value={selectedBillingFrequency}
                onChange={(e) => setSelectedBillingFrequency(e.target.value as BillingFrequency)}
              />
            </div>
```

No tocar el bloque `{/* Anchor month — only for quarterly or annual */}` que viene justo después — se mantiene exactamente igual.

- [ ] **Step 3: Quitar `BILLING_FREQUENCIES` del import si queda sin uso**

Ejecutar: `grep -n "BILLING_FREQUENCIES" "src/pages/GroupDetailPage.tsx"`
Esperado: ninguna coincidencia tras el paso 2.

Si no hay coincidencias, editar la línea de import (actualmente `import { DAYS_OF_WEEK, PLAYER_LEVELS, BILLING_FREQUENCIES, MONTHS } from '@/constants'`) para quitar `BILLING_FREQUENCIES`:
```ts
import { DAYS_OF_WEEK, PLAYER_LEVELS, MONTHS } from '@/constants'
```

- [ ] **Step 4: Verificar que compila**

Run: `npm run build`
Expected: sin errores de TypeScript, sin warning de import sin usar.

- [ ] **Step 5: Commit**

```bash
git add src/pages/GroupDetailPage.tsx
git commit -m "fix: la frecuencia de facturacion al matricular viene siempre de la tarifa elegida"
```

---

## Task 2: `MoveEnrollmentDialog.tsx` — mismo cambio

**Files:**
- Modify: `src/components/shared/MoveEnrollmentDialog.tsx`

Leer el archivo primero para confirmar el contenido exacto actual.

- [ ] **Step 1: Añadir el import de `billingFrequencyLabel`**

Añadir esta línea junto a los demás imports (por ejemplo, tras `import { formatCurrency } from '@/lib/utils'`):
```ts
import { billingFrequencyLabel } from '@/lib/billing-utils'
```

- [ ] **Step 2: Añadir el texto de frecuencia derivada**

Dentro del bloque `{selectedTariffId && (...)}` (el que contiene `<Label>Precio</Label>` y los radio buttons de descuento), justo después de `<Label>Precio</Label>` y antes de los radio buttons, añadir:

```tsx
                      <p className="text-xs text-muted-foreground">
                        Frecuencia: <span className="font-medium text-foreground">{billingFrequencyLabel(selectedBillingFrequency)}</span>
                      </p>
```

- [ ] **Step 3: Eliminar el bloque "Frecuencia de facturación"**

Buscar y eliminar por completo:
```tsx
                  <div className="space-y-2">
                    <Label>Frecuencia de facturación</Label>
                    <Select
                      options={BILLING_FREQUENCIES.map(f => ({ value: f.value, label: f.label }))}
                      value={selectedBillingFrequency}
                      onChange={e => setSelectedBillingFrequency(e.target.value as BillingFrequency)}
                    />
                  </div>
```

No tocar el bloque de "Mes de inicio del ciclo trimestral" / "Mes de pago anual" que viene justo después — se mantiene igual.

- [ ] **Step 4: Quitar `BILLING_FREQUENCIES` del import si queda sin uso**

Ejecutar: `grep -n "BILLING_FREQUENCIES" "src/components/shared/MoveEnrollmentDialog.tsx"`
Esperado: ninguna coincidencia tras el paso 3.

Editar la línea de import (actualmente `import { BILLING_FREQUENCIES, MONTHS } from '@/constants'`):
```ts
import { MONTHS } from '@/constants'
```

- [ ] **Step 5: Verificar que compila**

Run: `npm run build`
Expected: sin errores de TypeScript.

- [ ] **Step 6: Commit**

```bash
git add src/components/shared/MoveEnrollmentDialog.tsx
git commit -m "fix: la frecuencia de facturacion al trasladar viene siempre de la tarifa elegida"
```

---

## Task 3: `RenewGroupsDialog.tsx` — tarifa única a nivel de grupo y sincronización precio/frecuencia por alumno

**Files:**
- Modify: `src/components/shared/RenewGroupsDialog.tsx`

Este es el archivo con el bug reportado por el usuario. Leer el archivo completo primero para confirmar el contenido exacto actual — los pasos siguientes referencian el contenido tal como está documentado en el spec, pero pueden haber pequeñas diferencias de formato.

- [ ] **Step 1: Actualizar los imports**

El bloque de imports actual es:
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
Cambiarlo a:
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
import { formatCurrency } from '@/lib/utils'
import { billingFrequencyLabel } from '@/lib/billing-utils'
import { MONTHS } from '@/constants'
import type { Group, BillingFrequency } from '@/types'
```

- [ ] **Step 2: Eliminar la constante `BILLING_OPTIONS`**

Eliminar por completo:
```ts
const BILLING_OPTIONS = [
  { value: 'monthly', label: 'Mensual' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'annual', label: 'Anual' },
  { value: 'installments', label: 'Cuotas' },
]
```
(Se sustituye por `MONTHS` para el anclaje y `billingFrequencyLabel` para el texto de frecuencia — ningún uso restante de `BILLING_OPTIONS` tras las siguientes ediciones.)

- [ ] **Step 3: Quitar el campo muerto `billingAnchorMonth` de `GroupDraft`**

`defaultTariffId` ya existe en `GroupDraft` y en su construcción inicial — no hace falta añadirlo. Lo que sí hay que quitar es `billingAnchorMonth` (era un valor muerto que nunca se lee, ver spec), tanto de la interfaz como de la construcción inicial del draft.

La interfaz actual es:
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
  students: StudentDraft[]
}
```
Quitar la línea `billingAnchorMonth: number`:
```ts
interface GroupDraft {
  name: string
  defaultTariffId: string
  defaultTariffPrice: number
  billingFrequency: BillingFrequency
  startDate: string
  endDate: string
  includeStudents: boolean
  students: StudentDraft[]
}
```

El estado inicial de `drafts` (dentro del `useState<Record<string, GroupDraft>>(() => ...)`) construye cada draft así:
```ts
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
```
Quitar la línea `billingAnchorMonth: 1,`:
```ts
        return [
          g.id,
          {
            name: g.name,
            defaultTariffId: g.defaultTariffId,
            defaultTariffPrice: g.defaultTariffPrice,
            billingFrequency: g.billingFrequency,
            startDate: season ? toDateInput(season.startDate) : '',
            endDate: season ? toDateInput(season.endDate) : '',
            includeStudents: true,
            students,
          },
        ]
```

- [ ] **Step 4: Quitar `billingAnchorMonth` de `groupData` en `handleConfirm`**

Buscar dentro de `handleConfirm`, el objeto `groupData` construido por cada `group`:
```ts
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
```
Quitar las líneas de `billingAnchorMonth` (la propiedad completa, las 4 líneas):
```ts
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
            startDate: new Date(draft.startDate),
            endDate: new Date(draft.endDate),
          },
```

- [ ] **Step 5: Verificar que compila tras los pasos 1-4**

Run: `npm run build`
Expected: sin errores de TypeScript. `renewGroup`'s `groupData.billingAnchorMonth` es opcional (`billingAnchorMonth?: number`), así que omitirlo es válido.

- [ ] **Step 6: Sustituir el bloque de Precio+Frecuencia del grupo por un selector de Tarifa**

Buscar el bloque `<div className="grid grid-cols-2 gap-3">` que contiene los 4 campos (Precio, Frecuencia de facturación, Fecha de inicio, Fecha de fin):
```tsx
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Precio</Label>
                        <Input
                          type="number"
                          value={draft.defaultTariffPrice}
                          onChange={(e) =>
                            updateDraft(group.id, { defaultTariffPrice: parseFloat(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div>
                        <Label>Frecuencia de facturación</Label>
                        <Select
                          options={BILLING_OPTIONS}
                          value={draft.billingFrequency}
                          onChange={(e) =>
                            updateDraft(group.id, { billingFrequency: e.target.value as BillingFrequency })
                          }
                        />
                      </div>
                      <div>
                        <Label>Fecha de inicio</Label>
                        <Input
                          type="date"
                          value={draft.startDate}
                          onChange={(e) => updateDraft(group.id, { startDate: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Fecha de fin</Label>
                        <Input
                          type="date"
                          value={draft.endDate}
                          onChange={(e) => updateDraft(group.id, { endDate: e.target.value })}
                        />
                      </div>
                    </div>
```
Reemplazarlo por:
```tsx
                    <div className="space-y-3">
                      <div>
                        <Label>Tarifa por defecto</Label>
                        <Select
                          options={tariffs.filter((t) => t.isActive).map((t) => ({
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
                            })
                          }}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Fecha de inicio</Label>
                          <Input
                            type="date"
                            value={draft.startDate}
                            onChange={(e) => updateDraft(group.id, { startDate: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Fecha de fin</Label>
                          <Input
                            type="date"
                            value={draft.endDate}
                            onChange={(e) => updateDraft(group.id, { endDate: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
```

- [ ] **Step 7: Sincronizar precio y frecuencia al cambiar la tarifa de un alumno**

Buscar, dentro de la tabla de alumnos, la celda "Tarifa" (columna con el `<Select>` que llama a `updateStudent(group.id, student.playerId, { tariffId: e.target.value })`):
```tsx
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
```
Cambiar el `onChange` para que también actualice `customPrice` y `billingFrequency`:
```tsx
                                  <td className="p-1.5">
                                    <Select
                                      className="h-7 text-xs"
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
                                      options={tariffs.filter((t) => t.isActive).map((t) => ({ value: t.id, label: t.name }))}
                                      disabled={!student.included}
                                    />
                                  </td>
```
Este es el fix directo del bug reportado: cambiar de tarifa ahora sincroniza precio y frecuencia en el mismo gesto.

- [ ] **Step 8: Sustituir la columna "Frecuencia" editable por texto derivado**

Buscar la celda de Frecuencia (el `<Select>` con `options={BILLING_OPTIONS}` dentro de la tabla, distinto del de anclaje):
```tsx
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
```
Reemplazarla por:
```tsx
                                  <td className="p-1.5 text-slate-600">
                                    {billingFrequencyLabel(student.billingFrequency)}
                                  </td>
```

- [ ] **Step 9: Mostrar nombres de mes en el anclaje**

Buscar la celda de "Anclaje":
```tsx
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
```
Cambiar solo la línea de `options` para usar `MONTHS`:
```tsx
                                  <td className="p-1.5">
                                    {(student.billingFrequency === 'quarterly' || student.billingFrequency === 'annual') ? (
                                      <Select
                                        className="h-7 text-xs"
                                        value={String(student.billingAnchorMonth)}
                                        onChange={(e) =>
                                          updateStudent(group.id, student.playerId, { billingAnchorMonth: parseInt(e.target.value, 10) })
                                        }
                                        options={MONTHS.map((m) => ({ value: String(m.value), label: m.label }))}
                                        disabled={!student.included}
                                      />
                                    ) : (
                                      <span className="text-slate-300">—</span>
                                    )}
                                  </td>
```

- [ ] **Step 10: Actualizar la cabecera de la tabla si hace falta**

Revisar la fila `<thead>` de la tabla (columnas: `Alumno`, `Tarifa`, `Precio`, `Frecuencia`, `Anclaje`) — los encabezados se mantienen igual, la columna "Frecuencia" simplemente ahora muestra texto en vez de un select, no hace falta cambiar el `<th>`.

- [ ] **Step 11: Verificar que compila**

Run: `npm run build`
Expected: sin errores de TypeScript.

- [ ] **Step 12: Ejecutar el conjunto de tests**

Run: `npm test`
Expected: todos los tests pasan.

- [ ] **Step 13: Verificación manual**

Con el dev server corriendo (si no hay ya uno, `npm run dev`):

1. Abrir el asistente de traspaso de temporada para un grupo con alumnos matriculados.
2. Confirmar que arriba aparece un único selector "Tarifa por defecto" (no Precio+Frecuencia sueltos).
3. En la tabla de alumnos, cambiar la tarifa de un alumno de una mensual a una anual — confirmar que el Precio de esa fila cambia inmediatamente al precio de la tarifa anual, que la columna "Frecuencia" muestra "Anual" (texto, no selector), y que aparece el selector de "Anclaje" con nombres de mes.
4. Confirmar el traspaso y verificar en Firestore (o en la vista de Grupos/Pagos tras el traspaso) que la matrícula nueva de ese alumno tiene el `billingFrequency`/`customPrice`/`billingAnchorMonth` correctos, coincidentes con la tarifa anual elegida.

- [ ] **Step 14: Commit**

```bash
git add src/components/shared/RenewGroupsDialog.tsx
git commit -m "fix: sincronizar precio y frecuencia al cambiar de tarifa en el traspaso de temporada"
```

---

## Self-Review Notes

- **Cobertura del spec:** Sección 1 (`GroupDetailPage.tsx`) → Tarea 1. Sección 2 (`MoveEnrollmentDialog.tsx`) → Tarea 2. Sección 3a (tarifa única del grupo) y 3b (tabla de alumnos, incluido el fix del bug y los nombres de mes) → Tarea 3. La decisión de no añadir anclaje a nivel de grupo → Tarea 3, Steps 3-4 (se elimina el campo muerto en vez de añadir uno nuevo).
- **Consistencia de tipos:** `GroupDraft` pierde `billingAnchorMonth` de su interfaz (Task 3, Step 3) y de su único punto de construcción (mismo step) y de su único punto de consumo en `handleConfirm` (Step 4) — los tres sitios se actualizan a la vez, sin dejar una referencia colgante. `StudentDraft` no cambia de forma (sigue teniendo `customPrice`/`billingFrequency`/`billingAnchorMonth`), solo cambia CÓMO se les asigna valor.
- **Nada de placeholders** — cada paso de código tiene el bloque completo, antes y después, para los tres archivos.
