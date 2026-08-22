# Correcciones de facturación para tarifas de cuotas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir tres problemas reales en cómo se facturan las tarifas de tipo "Cuotas" (installments): un cálculo de importe incorrecto en la Cloud Function programada, la pérdida del calendario de cuotas al traspasar un grupo de temporada, y la posibilidad de elegir una tarifa de cuotas para un alumno individual (configuración que nunca puede facturarse).

**Architecture:** Task A corrige una fórmula puntual en la Cloud Function para que coincida con la ya correcta del camino cliente. Task B añade `installmentPrices` al contrato de `renewGroup` y lo copia en el asistente de traspaso. Task C excluye las tarifas de cuotas de los selectores de tarifa por alumno en los tres diálogos afectados, sin tocar los selectores de tarifa a nivel de grupo (donde las cuotas sí funcionan).

**Tech Stack:** Firebase Cloud Functions v2 (TypeScript, CommonJS), React 19 + TypeScript, Zustand.

---

## Task A: Corregir el cálculo de importe de cuotas en la Cloud Function

**Files:**
- Modify: `functions/src/billing/generateMonthlyReceipts.ts`

Este archivo es Cloud Functions (Admin SDK), sin suite de tests automatizados — sigue la convención ya establecida en este mismo archivo (el aviso de ciclo incompleto, añadido en una sesión anterior, tampoco tiene test directo). Se verifica con build + revisión manual.

- [ ] **Step 1: Leer el archivo para confirmar el contenido exacto actual**

Leer `functions/src/billing/generateMonthlyReceipts.ts` completo antes de editar — los números de línea de abajo son los de la versión actual conocida, pero conviene confirmar que no han cambiado.

- [ ] **Step 2: Sustituir el cálculo de importe**

Buscar (dentro de la función que procesa cada matrícula, en el bloque comentado `// Calculate amount and concept`):
```ts
    // -----------------------------------------------------------------------
    // Calculate amount and concept
    // -----------------------------------------------------------------------
    // El importe de un ciclo trimestral/anual es el que se ha configurado
    // directamente en la tarifa/matrícula (no se multiplica por meses del
    // ciclo); customPrice, si está definido, manda sobre el precio del grupo.
    const amount = enrollment.customPrice ?? group.defaultTariffPrice;
    let concept = `Cuota ${monthName} ${billingYear} - ${group.name}`;
```
Reemplazar por:
```ts
    // -----------------------------------------------------------------------
    // Calculate amount and concept
    // -----------------------------------------------------------------------
    // El importe de un ciclo trimestral/anual es el que se ha configurado
    // directamente en la tarifa/matrícula (no se multiplica por meses del
    // ciclo); customPrice, si está definido, manda sobre el precio del grupo.
    // Para plazos: usar el precio específico del mes (YYYY-MM) del grupo,
    // igual que ya hace src/lib/firestoreSync.ts — antes esta función
    // ignoraba installmentPrices y cobraba el precio total de la tarifa.
    const billingKey = `${billingYear}-${String(billingMonth).padStart(2, "0")}`;
    const baseAmount = freq === "installments" && group.installmentPrices
      ? (group.installmentPrices[billingKey] ?? group.defaultTariffPrice)
      : group.defaultTariffPrice;
    const amount = enrollment.customPrice ?? baseAmount;
    let concept = `Cuota ${monthName} ${billingYear} - ${group.name}`;
```

No tocar nada más en el archivo — el resto del cálculo (aviso de ciclo incompleto, construcción del `concept`, el `batch.set`) sigue exactamente igual.

- [ ] **Step 3: Verificar que compila**

Run: `npm --prefix functions run build`
Expected: sin errores de TypeScript.

- [ ] **Step 4: Verificación manual del razonamiento**

Confirmar leyendo el código que la nueva fórmula es idéntica, campo a campo, a la de `src/lib/firestoreSync.ts` (líneas ~439-446: `if (freq === 'installments' && group.installmentPrices) { baseAmount = group.installmentPrices[billingKey] ?? group.defaultTariffPrice } else { baseAmount = group.defaultTariffPrice }`) — misma prioridad, mismo fallback, mismo uso de `customPrice` por encima de todo.

- [ ] **Step 5: Commit**

```bash
git add functions/src/billing/generateMonthlyReceipts.ts
git commit -m "fix: la funcion programada de recibos cobra el importe correcto de cada cuota"
```

---

## Task B: Copiar `installmentPrices` al traspasar un grupo de temporada

**Files:**
- Modify: `src/stores/dataStore.ts`
- Modify: `src/components/shared/RenewGroupsDialog.tsx`

- [ ] **Step 1: Añadir `installmentPrices` a la firma de `renewGroup` en `dataStore.ts`**

Leer `src/stores/dataStore.ts` para confirmar el contenido exacto de la firma de `renewGroup` (buscar `renewGroup: (params: {`). Actualmente:
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
```
Añadir `installmentPrices?: Record<string, number>` justo después de `billingAnchorMonth?: number`:
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
      installmentPrices?: Record<string, number>
      startDate: Date
      endDate: Date
    }
```

No hace falta ningún otro cambio en `dataStore.ts` — la implementación de `renewGroup` construye `newGroup: Group = { ...groupData, id: newGroupId, seasonId, renewedFromGroupId: oldGroupId, currentEnrollment: studentsToInclude.length, isActive: true, createdAt: now }` mediante spread, así que el campo se copiará automáticamente al añadirlo al tipo de `groupData`.

- [ ] **Step 2: Verificar que compila tras el Step 1**

Run: `npm run build`
Expected: sin errores de TypeScript (el campo es opcional, así que los llamadores existentes que no lo pasan siguen siendo válidos).

- [ ] **Step 3: Añadir `installmentPrices` a `GroupDraft` en `RenewGroupsDialog.tsx`**

Leer `src/components/shared/RenewGroupsDialog.tsx` para confirmar el contenido exacto. La interfaz `GroupDraft` actual:
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
Añadir el campo:
```ts
interface GroupDraft {
  name: string
  defaultTariffId: string
  defaultTariffPrice: number
  billingFrequency: BillingFrequency
  installmentPrices?: Record<string, number>
  startDate: string
  endDate: string
  includeStudents: boolean
  students: StudentDraft[]
}
```

- [ ] **Step 4: Inicializar `installmentPrices` desde el grupo viejo**

Buscar la construcción inicial del draft (dentro del `useState<Record<string, GroupDraft>>(() => ...)`):
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
Añadir `installmentPrices: g.installmentPrices,`:
```ts
        return [
          g.id,
          {
            name: g.name,
            defaultTariffId: g.defaultTariffId,
            defaultTariffPrice: g.defaultTariffPrice,
            billingFrequency: g.billingFrequency,
            installmentPrices: g.installmentPrices,
            startDate: season ? toDateInput(season.startDate) : '',
            endDate: season ? toDateInput(season.endDate) : '',
            includeStudents: true,
            students,
          },
        ]
```
Así, si el admin no toca el selector de tarifa, el grupo nuevo conserva el calendario de cuotas del grupo viejo tal cual.

- [ ] **Step 5: Actualizar `installmentPrices` cuando se cambia la tarifa por defecto**

Buscar el `onChange` del selector "Tarifa por defecto":
```tsx
                          onChange={(e) => {
                            const tariffId = e.target.value
                            const tariff = tariffs.find((t) => t.id === tariffId)
                            updateDraft(group.id, {
                              defaultTariffId: tariffId,
                              defaultTariffPrice: tariff?.price ?? 0,
                              billingFrequency: tariff?.billingFrequency ?? 'monthly',
                            })
                          }}
```
Añadir `installmentPrices: tariff?.installmentPrices,`:
```tsx
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
```

- [ ] **Step 6: Incluir `installmentPrices` en `groupData` dentro de `handleConfirm`**

Buscar el objeto `groupData` construido en `handleConfirm`:
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
Añadir `installmentPrices: draft.installmentPrices,`:
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
            installmentPrices: draft.installmentPrices,
            startDate: new Date(draft.startDate),
            endDate: new Date(draft.endDate),
          },
```

- [ ] **Step 7: Verificar que compila**

Run: `npm run build`
Expected: sin errores de TypeScript.

- [ ] **Step 8: Ejecutar el conjunto de tests**

Run: `npm test`
Expected: todos los tests pasan.

- [ ] **Step 9: Verificación manual**

Con el dev server corriendo (si no hay ya uno, `npm run dev`):
1. Confirmar por lectura del código que un grupo con tarifa de cuotas, traspasado SIN tocar el selector de tarifa, produce un `groupData.installmentPrices` igual al `installmentPrices` del grupo viejo.
2. Si es posible probarlo en vivo: traspasar un grupo de cuotas real y comprobar en Firestore (colección `groups`) que el grupo nuevo tiene `installmentPrices` poblado.

- [ ] **Step 10: Commit**

```bash
git add src/stores/dataStore.ts src/components/shared/RenewGroupsDialog.tsx
git commit -m "fix: conservar el calendario de cuotas al traspasar un grupo de temporada"
```

---

## Task C: Excluir tarifas de cuotas de los selectores de tarifa por alumno

**Files:**
- Modify: `src/pages/GroupDetailPage.tsx`
- Modify: `src/components/shared/MoveEnrollmentDialog.tsx`
- Modify: `src/components/shared/RenewGroupsDialog.tsx`

- [ ] **Step 1: `GroupDetailPage.tsx` — filtrar el selector de tarifa del diálogo "Añadir alumno"**

Leer el archivo para confirmar el contenido exacto. Buscar el bloque `{/* Select Tariff */}`:
```tsx
            {/* Select Tariff */}
            <div className="space-y-2">
              <Label>Tarifa *</Label>
              <Select
                options={tariffs.filter((t) => t.isActive).map((t) => ({
                  value: t.id,
                  label: `${t.name} (${formatCurrency(t.price)})`,
                }))}
```
Cambiar el filtro para excluir cuotas:
```tsx
            {/* Select Tariff */}
            <div className="space-y-2">
              <Label>Tarifa *</Label>
              <Select
                options={tariffs.filter((t) => t.isActive && t.billingFrequency !== 'installments').map((t) => ({
                  value: t.id,
                  label: `${t.name} (${formatCurrency(t.price)})`,
                }))}
```
No tocar el resto de este bloque, ni el selector de "Cambiar tarifa del grupo" (`newTariffId`, más abajo en el archivo, dentro de un diálogo distinto) — ese es a nivel de grupo y debe seguir permitiendo tarifas de cuotas sin cambios.

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: sin errores de TypeScript.

- [ ] **Step 3: Commit**

```bash
git add src/pages/GroupDetailPage.tsx
git commit -m "fix: no permitir elegir una tarifa de cuotas para un alumno individual al matricular"
```

- [ ] **Step 4: `MoveEnrollmentDialog.tsx` — filtrar `activeTariffs`**

Leer el archivo para confirmar el contenido exacto. Buscar:
```ts
  const activeTariffs = tariffs.filter(t => t.isActive)
```
Cambiar a:
```ts
  const activeTariffs = tariffs.filter(t => t.isActive && t.billingFrequency !== 'installments')
```
Esta es la única declaración de `activeTariffs` en el archivo y se usa solo para el selector de tarifa de la matrícula que se traslada — no hay ningún selector de tarifa a nivel de grupo en este diálogo, así que no hace falta una segunda variable.

- [ ] **Step 5: Verificar que compila**

Run: `npm run build`
Expected: sin errores de TypeScript.

- [ ] **Step 6: Commit**

```bash
git add src/components/shared/MoveEnrollmentDialog.tsx
git commit -m "fix: no permitir elegir una tarifa de cuotas al trasladar un alumno"
```

- [ ] **Step 7: `RenewGroupsDialog.tsx` — añadir una lista de tarifas filtrada solo para el selector por alumno**

Leer el archivo para confirmar el contenido exacto. Buscar la declaración de `activeTariffs`:
```ts
  const activeTariffs = useMemo(() => tariffs.filter((t) => t.isActive), [tariffs])
```
Añadir justo después una segunda variable derivada:
```ts
  const activeTariffs = useMemo(() => tariffs.filter((t) => t.isActive), [tariffs])
  const activeIndividualTariffs = useMemo(
    () => activeTariffs.filter((t) => t.billingFrequency !== 'installments'),
    [activeTariffs]
  )
```

- [ ] **Step 8: Usar la nueva lista en el selector de tarifa por alumno**

Buscar, dentro de la tabla de alumnos, el `<Select>` de la columna "Tarifa":
```tsx
                                      options={activeTariffs.map((t) => ({ value: t.id, label: t.name }))}
```
Cambiar a:
```tsx
                                      options={activeIndividualTariffs.map((t) => ({ value: t.id, label: t.name }))}
```
No tocar el selector "Tarifa por defecto" (a nivel de grupo, más arriba en el mismo archivo) — ese sigue usando `activeTariffs` sin cambios, porque las cuotas sí son válidas como tarifa de grupo.

- [ ] **Step 9: Verificar que compila**

Run: `npm run build`
Expected: sin errores de TypeScript.

- [ ] **Step 10: Ejecutar el conjunto de tests**

Run: `npm test`
Expected: todos los tests pasan.

- [ ] **Step 11: Verificación manual**

Con el dev server corriendo:
1. Abrir "Añadir alumno" en un grupo (`GroupDetailPage.tsx`) — confirmar que las tarifas de tipo "Cuotas" no aparecen en el selector de tarifa.
2. Abrir "Mover a otro grupo" para una matrícula, elegir "Usar tarifa del grupo destino" — confirmar lo mismo.
3. Abrir el asistente de traspaso de temporada — confirmar que el selector "Tarifa por defecto" (arriba) SÍ sigue mostrando tarifas de cuotas, pero el selector de tarifa de cada fila de la tabla de alumnos NO las muestra.
4. Confirmar que "Cambiar tarifa del grupo" (dentro de `GroupDetailPage.tsx`) y la creación/edición de grupo (`GroupsPage.tsx`) siguen mostrando tarifas de cuotas con normalidad.

- [ ] **Step 12: Commit**

```bash
git add src/components/shared/RenewGroupsDialog.tsx
git commit -m "fix: no permitir elegir una tarifa de cuotas por alumno en el traspaso de temporada"
```

---

## Self-Review Notes

- **Cobertura del spec:** Sección A → Task A. Sección B → Task B. Sección C (los tres diálogos) → Task C, Steps 1-3 (GroupDetailPage), 4-6 (MoveEnrollmentDialog), 7-12 (RenewGroupsDialog).
- **Consistencia de tipos:** `groupData.installmentPrices?: Record<string, number>` se declara en `dataStore.ts` (Task B, Step 1) con el mismo tipo que `Tariff.installmentPrices`/`Group.installmentPrices` ya usan en `src/types/index.ts`, y se consume con el mismo nombre en `RenewGroupsDialog.tsx` (Task B, Steps 3-6) sin ninguna conversión. `activeIndividualTariffs` (Task C, Step 7) se deriva de `activeTariffs` (ya existente), no introduce una tercera fuente de verdad para "tarifas activas".
- **Nada de placeholders** — cada paso de código tiene el bloque completo, antes y después, para los cinco archivos.
- **Orden de tareas**: A y B son independientes entre sí. C también es independiente de A y B (no comparte código), pero conviene hacerlo después por ser el cambio más visible/de UI, dejando los dos fixes de backend (A, B) verificados primero.
