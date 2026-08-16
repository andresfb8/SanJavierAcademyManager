# Importe fijo por ciclo (trimestral/anual) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El precio de una tarifa/matrícula trimestral o anual pasa a ser el importe fijo que se cobra en cada recibo (introducido directamente), en vez de una cuota mensual multiplicada por `cycleLength`. Se añade un aviso visible cuando un ciclo trimestral/anual no cabe completo antes del fin del grupo, y un diálogo para editar el importe de un recibo ya generado.

**Architecture:** Se elimina `* cycleLength(freq)` de las dos rutas de generación de recibos (`functions/src/billing/generateMonthlyReceipts.ts` y `src/lib/firestoreSync.ts`) y de los cuatro sitios de la UI que mostraban ese cálculo como vista previa. Se añade una función pura `remainingMonthsInGroup` (portada a ambas copias de `billing-utils.ts`) que ambas rutas de generación usan para decidir si anexar un aviso al `concept` del pago. Se añade un diálogo de edición en `PaymentsPage.tsx` reusando la acción `updatePayment` ya existente en el store.

**Tech Stack:** React 19 + TypeScript, Zustand, Firebase Cloud Functions v2 (Node.js/TypeScript, CommonJS), Vitest.

---

## Task 1: `remainingMonthsInGroup` + `billingFrequencyLabel` en Cloud Functions, con tests

**Files:**
- Modify: `src/lib/billing-utils.ts`
- Modify: `functions/src/billing/billing-utils.ts`
- Modify: `src/lib/billing-utils.test.ts`

- [ ] **Step 1: Escribir los tests que fallan para `remainingMonthsInGroup`**

Editar `src/lib/billing-utils.test.ts` — sustituir el segundo `describe` (líneas 22-34, el de "importe por periodo (base x cycleLength...)") por el contenido completo de abajo. El primer `describe` (`cycleLength`, líneas 4-20) no se toca.

```ts
import { describe, it, expect } from 'vitest'
import { cycleLength, remainingMonthsInGroup } from '@/lib/billing-utils'

describe('cycleLength', () => {
  it('mensual cubre 1 mes', () => {
    expect(cycleLength('monthly')).toBe(1)
  })

  it('trimestral cubre 3 meses', () => {
    expect(cycleLength('quarterly')).toBe(3)
  })

  it('anual cubre 12 meses', () => {
    expect(cycleLength('annual')).toBe(12)
  })

  it('plazos cubre 1 mes (usa su propio precio por mes, no se multiplica)', () => {
    expect(cycleLength('installments')).toBe(1)
  })
})

describe('remainingMonthsInGroup', () => {
  it('el grupo termina el mismo mes que se factura -> 1 mes restante', () => {
    const groupEnd = new Date(2026, 8, 15) // 15 septiembre 2026 (mes 9, índice 8)
    expect(remainingMonthsInGroup(groupEnd, 9, 2026)).toBe(1)
  })

  it('el grupo termina 2 meses despues del mes de facturacion -> 3 meses restantes', () => {
    const groupEnd = new Date(2026, 10, 30) // noviembre 2026 (mes 11)
    expect(remainingMonthsInGroup(groupEnd, 9, 2026)).toBe(3)
  })

  it('el grupo termina el año siguiente -> cuenta cruzando el cambio de año', () => {
    const groupEnd = new Date(2027, 1, 28) // febrero 2027 (mes 2)
    expect(remainingMonthsInGroup(groupEnd, 12, 2026)).toBe(3) // dic, ene, feb
  })

  it('trimestral con 2 meses restantes -> ciclo incompleto', () => {
    const groupEnd = new Date(2026, 9, 31) // octubre 2026 (mes 10)
    const remaining = remainingMonthsInGroup(groupEnd, 9, 2026) // sep, oct = 2
    expect(remaining).toBe(2)
    expect(remaining < cycleLength('quarterly')).toBe(true)
  })

  it('anual con 12 meses restantes exactos -> ciclo completo', () => {
    const groupEnd = new Date(2027, 7, 31) // agosto 2027 (mes 8)
    const remaining = remainingMonthsInGroup(groupEnd, 9, 2026) // sep 2026 .. ago 2027 = 12
    expect(remaining).toBe(12)
    expect(remaining < cycleLength('annual')).toBe(false)
  })
})
```

- [ ] **Step 2: Ejecutar los tests y comprobar que fallan**

Run: `npm test -- billing-utils`
Expected: FAIL — `remainingMonthsInGroup` no existe en `@/lib/billing-utils`.

- [ ] **Step 3: Implementar `remainingMonthsInGroup` en `src/lib/billing-utils.ts`**

Añadir al final del archivo (después de `cycleLength`):

```ts
/**
 * Nº de meses restantes de un grupo, contando desde el mes de facturación
 * (inclusive) hasta el mes en que termina el grupo (inclusive).
 * Ej: grupo termina en septiembre, se factura en septiembre -> 1.
 * Ej: grupo termina en noviembre, se factura en septiembre -> 3 (sep, oct, nov).
 */
export function remainingMonthsInGroup(
  groupEnd: Date,
  billingMonth: number, // 1-12
  billingYear: number,
): number {
  const endMonthsTotal = groupEnd.getFullYear() * 12 + (groupEnd.getMonth() + 1)
  const billingMonthsTotal = billingYear * 12 + billingMonth
  return endMonthsTotal - billingMonthsTotal + 1
}
```

- [ ] **Step 4: Ejecutar los tests y comprobar que pasan**

Run: `npm test -- billing-utils`
Expected: PASS — todos los tests de `cycleLength` y `remainingMonthsInGroup` en verde.

- [ ] **Step 5: Portar `remainingMonthsInGroup` y `billingFrequencyLabel` a Cloud Functions**

`functions/src/billing/billing-utils.ts` no tiene `billingFrequencyLabel` (se necesita en la Tarea 2 para el texto del aviso). Reemplazar el contenido completo del archivo por:

```ts
type BillingFrequency = "monthly" | "quarterly" | "annual" | "installments";

/**
 * Returns true if billingMonth is a payment month for the given frequency/anchor.
 * See src/lib/billing-utils.ts for full documentation.
 */
export function isBillingMonth(
  frequency: BillingFrequency,
  anchorMonth: number,
  billingMonth: number,
): boolean {
  switch (frequency) {
    case "monthly":
      return true;
    case "quarterly":
      return ((billingMonth - anchorMonth + 12) % 12) % 3 === 0;
    case "annual":
      return billingMonth === anchorMonth;
    case "installments":
      return true;
  }
}

/**
 * Nº de meses que cubre un recibo de esta frecuencia.
 * See src/lib/billing-utils.ts for full documentation.
 */
export function cycleLength(frequency: BillingFrequency): number {
  switch (frequency) {
    case "monthly":
      return 1;
    case "quarterly":
      return 3;
    case "annual":
      return 12;
    case "installments":
      return 1; // plazos usa su propio precio por mes, no se multiplica
  }
}

/** Short display label for a billing frequency. */
export function billingFrequencyLabel(freq: BillingFrequency): string {
  switch (freq) {
    case "monthly":
      return "Mensual";
    case "quarterly":
      return "Trimestral";
    case "annual":
      return "Anual";
    case "installments":
      return "Plazos";
  }
}

/**
 * Nº de meses restantes de un grupo, contando desde el mes de facturación
 * (inclusive) hasta el mes en que termina el grupo (inclusive).
 * See src/lib/billing-utils.ts for full documentation.
 */
export function remainingMonthsInGroup(
  groupEnd: Date,
  billingMonth: number,
  billingYear: number,
): number {
  const endMonthsTotal = groupEnd.getFullYear() * 12 + (groupEnd.getMonth() + 1);
  const billingMonthsTotal = billingYear * 12 + billingMonth;
  return endMonthsTotal - billingMonthsTotal + 1;
}
```

- [ ] **Step 6: Verificar que compila el proyecto de functions**

Run: `npm --prefix functions run build`
Expected: sin errores de TypeScript.

- [ ] **Step 7: Commit**

```bash
git add src/lib/billing-utils.ts functions/src/billing/billing-utils.ts src/lib/billing-utils.test.ts
git commit -m "feat: añadir remainingMonthsInGroup para detectar ciclos de facturación incompletos"
```

---

## Task 2: Quitar la multiplicación en la generación de recibos + aviso de ciclo incompleto

**Files:**
- Modify: `functions/src/billing/generateMonthlyReceipts.ts`
- Modify: `src/lib/firestoreSync.ts`

- [ ] **Step 1: Editar `functions/src/billing/generateMonthlyReceipts.ts`**

Cambiar el import (línea 5):

```ts
import { isBillingMonth, cycleLength, remainingMonthsInGroup, billingFrequencyLabel } from "./billing-utils";
```

Sustituir el bloque de cálculo de importe y concepto (líneas 244-251):

```ts
    // -----------------------------------------------------------------------
    // Calculate amount and concept
    // -----------------------------------------------------------------------
    // Trimestral/anual generan menos recibos pero por el total del periodo
    // (cuota base x meses del ciclo); customPrice, si está definido, está
    // siempre el importe exacto del recibo y no se multiplica.
    const amount = enrollment.customPrice ?? (group.defaultTariffPrice * cycleLength(freq));
    const concept = `Cuota ${monthName} ${billingYear} - ${group.name}`;
```

por:

```ts
    // -----------------------------------------------------------------------
    // Calculate amount and concept
    // -----------------------------------------------------------------------
    // El importe de un ciclo trimestral/anual es el que se ha configurado
    // directamente en la tarifa/matrícula (no se multiplica por meses del
    // ciclo); customPrice, si está definido, manda sobre el precio del grupo.
    const amount = enrollment.customPrice ?? group.defaultTariffPrice;
    let concept = `Cuota ${monthName} ${billingYear} - ${group.name}`;

    // Aviso de ciclo incompleto: si el ciclo (trimestral/anual) no cabe
    // completo antes de que el grupo termine, se cobra igualmente el importe
    // configurado pero se marca para que el admin decida si ajustarlo.
    if ((freq === "quarterly" || freq === "annual") && group.endDate) {
      const groupEnd = group.endDate.toDate();
      const remaining = remainingMonthsInGroup(groupEnd, billingMonth, billingYear);
      if (remaining < cycleLength(freq)) {
        concept += ` ⚠ el grupo finaliza antes de cubrir el ${billingFrequencyLabel(freq).toLowerCase()} completo, revisa el importe`;
        logger.warn(
          `Club ${clubId}: ciclo ${freq} incompleto para matrícula ${enrollment.id} ` +
          `(alumno ${enrollment.playerName}, grupo ${group.name}): quedan ${remaining} ` +
          `mes(es) pero el ciclo cubre ${cycleLength(freq)}. Importe cobrado: ${amount}.`,
        );
      }
    }
```

- [ ] **Step 2: Verificar que compila**

Run: `npm --prefix functions run build`
Expected: sin errores de TypeScript.

- [ ] **Step 3: Editar `src/lib/firestoreSync.ts`**

Cambiar el import (línea 27):

```ts
import { isBillingMonth, remainingMonthsInGroup, cycleLength, billingFrequencyLabel } from './billing-utils'
```

El `groupsMap` (líneas 368-377) necesita ahora también `endDate` — ampliar:

```ts
    const groupsMap = new Map<string, { defaultTariffPrice: number; billingFrequency: string; startDate: any; endDate: any; installmentPrices?: Record<string, number> }>()
    for (const groupDoc of groupsSnap.docs) {
      const g = groupDoc.data()
      groupsMap.set(groupDoc.id, {
        defaultTariffPrice: g.defaultTariffPrice ?? 0,
        billingFrequency: g.billingFrequency ?? 'monthly',
        startDate: g.startDate,
        endDate: g.endDate,
        installmentPrices: g.installmentPrices,
      })
    }
```

Sustituir el bloque de cálculo de importe (líneas 434-459, desde el comentario "Calcular importe" hasta antes de "Límite de batch"):

```ts
      // Calcular importe: customPrice tiene prioridad
      // Para plazos: usar el precio específico del mes (YYYY-MM) sin multiplicar.
      // Para mensual/trimestral/anual: el importe configurado directamente en
      // el grupo/tarifa (no se multiplica por meses del ciclo).
      let baseAmount: number
      if (freq === 'installments' && group.installmentPrices) {
        const billingKey = `${year}-${String(month).padStart(2, '0')}`
        baseAmount = group.installmentPrices[billingKey] ?? group.defaultTariffPrice
      } else {
        baseAmount = group.defaultTariffPrice
      }
      const amount = enrollment.customPrice ?? baseAmount

      // Crear pago
      const paymentId = generateId()
      const dueDate = new Date(year, month - 1, 5) // Día 5 del mes

      let concept = `${MONTHS[month - 1].label} ${year} - ${enrollment.groupName} · Cuota Socio`

      // Aviso de ciclo incompleto: mismo criterio que generateMonthlyReceipts.ts
      if ((freq === 'quarterly' || freq === 'annual') && group.endDate) {
        const groupEndDate = group.endDate instanceof Date ? group.endDate : new Date((group.endDate as any).toDate?.() ?? group.endDate)
        const remaining = remainingMonthsInGroup(groupEndDate, month, year)
        if (remaining < cycleLength(freq)) {
          concept += ` ⚠ el grupo finaliza antes de cubrir el ${billingFrequencyLabel(freq).toLowerCase()} completo, revisa el importe`
          console.warn(
            `[generateReceipts] Ciclo ${freq} incompleto para matrícula ${enrollDoc.id} ` +
            `(grupo ${enrollment.groupName}): quedan ${remaining} mes(es) pero el ciclo cubre ${cycleLength(freq)}. Importe cobrado: ${amount}.`
          )
        }
      }

      batch.set(doc(db, 'payments', paymentId), {
        id: paymentId,
        clubId,
        playerId: enrollment.playerId,
        playerName: enrollment.playerName,
        enrollmentId: enrollDoc.id,
        groupId: enrollment.groupId,
        groupName: enrollment.groupName,
        concept,
        amount,
        status: 'pendiente',
        category: 'cuota',
        billingMonth: month,
        billingYear: year,
        dueDate: Timestamp.fromDate(dueDate),
        autogenerated: true,
        createdAt: serverTimestamp(),
      })
```

- [ ] **Step 4: Verificar que compila el frontend**

Run: `npm run build`
Expected: sin errores de TypeScript.

- [ ] **Step 5: Commit**

```bash
git add functions/src/billing/generateMonthlyReceipts.ts src/lib/firestoreSync.ts
git commit -m "fix: no multiplicar el importe trimestral/anual por meses del ciclo; avisar si el ciclo no cabe en el grupo"
```

---

## Task 3: Quitar el framing "× cycleLength" de `SettingsPage.tsx`

**Files:**
- Modify: `src/pages/SettingsPage.tsx`

- [ ] **Step 1: Simplificar la etiqueta y el texto de ayuda del precio (líneas 619-634)**

Reemplazar:

```tsx
            {(tariffForm.billingFrequency === 'monthly' || tariffForm.billingFrequency === 'quarterly' || tariffForm.billingFrequency === 'annual') && (
              <div className="space-y-2">
                <Label>{tariffForm.billingFrequency === 'monthly' ? 'Precio mensual *' : 'Precio mensual base *'}</Label>
                <Input
                  type="number" min={0} step={0.01}
                  value={tariffForm.price}
                  onChange={(e) => setTariffForm({ ...tariffForm, price: Number(e.target.value) })}
                />
                {tariffForm.billingFrequency !== 'monthly' && (
                  <p className="text-xs text-muted-foreground">
                    Se facturará {formatCurrency(tariffForm.price * cycleLength(tariffForm.billingFrequency))} cada {billingFrequencyLabel(tariffForm.billingFrequency).toLowerCase()}
                    {' '}({cycleLength(tariffForm.billingFrequency)} × {formatCurrency(tariffForm.price)})
                  </p>
                )}
              </div>
            )}
```

por:

```tsx
            {(tariffForm.billingFrequency === 'monthly' || tariffForm.billingFrequency === 'quarterly' || tariffForm.billingFrequency === 'annual') && (
              <div className="space-y-2">
                <Label>Precio *</Label>
                <Input
                  type="number" min={0} step={0.01}
                  value={tariffForm.price}
                  onChange={(e) => setTariffForm({ ...tariffForm, price: Number(e.target.value) })}
                />
                {tariffForm.billingFrequency !== 'monthly' && (
                  <p className="text-xs text-muted-foreground">
                    Importe fijo que se cobrará cada {billingFrequencyLabel(tariffForm.billingFrequency).toLowerCase()}.
                  </p>
                )}
              </div>
            )}
```

- [ ] **Step 2: Simplificar la tarjeta de listado de tarifas (líneas 530-538)**

Reemplazar:

```tsx
                          {tariff.billingFrequency === 'monthly' && (
                            <p className="text-sm text-muted-foreground">Facturación mensual</p>
                          )}
                          {(tariff.billingFrequency === 'quarterly' || tariff.billingFrequency === 'annual') && (
                            <p className="text-sm text-muted-foreground">
                              Facturación {billingFrequencyLabel(tariff.billingFrequency).toLowerCase()}
                              {' '}({formatCurrency(tariff.price * cycleLength(tariff.billingFrequency))} cada {tariff.billingFrequency === 'annual' ? 'año' : 'trimestre'})
                            </p>
                          )}
```

por:

```tsx
                          {tariff.billingFrequency === 'monthly' && (
                            <p className="text-sm text-muted-foreground">Facturación mensual</p>
                          )}
                          {(tariff.billingFrequency === 'quarterly' || tariff.billingFrequency === 'annual') && (
                            <p className="text-sm text-muted-foreground">
                              Facturación {billingFrequencyLabel(tariff.billingFrequency).toLowerCase()} — {formatCurrency(tariff.price)}
                            </p>
                          )}
```

- [ ] **Step 3: Quitar el import de `cycleLength` si queda sin uso**

Buscar si `cycleLength` sigue usado en el archivo:

Run: `grep -n "cycleLength" "src/pages/SettingsPage.tsx"`
Expected: ninguna coincidencia tras los cambios anteriores.

Si no hay coincidencias, editar la línea 14:

```ts
import { cycleLength, billingFrequencyLabel } from '@/lib/billing-utils'
```

por:

```ts
import { billingFrequencyLabel } from '@/lib/billing-utils'
```

- [ ] **Step 4: Verificar que compila**

Run: `npm run build`
Expected: sin errores de TypeScript (en particular, ningún "declared but never used" de `cycleLength`).

- [ ] **Step 5: Commit**

```bash
git add src/pages/SettingsPage.tsx
git commit -m "fix: el precio trimestral/anual de una tarifa es el importe fijo, sin multiplicar por meses del ciclo"
```

---

## Task 4: Quitar el framing "× cycleLength" de `GroupDetailPage.tsx` y `MoveEnrollmentDialog.tsx`

**Files:**
- Modify: `src/pages/GroupDetailPage.tsx`
- Modify: `src/components/shared/MoveEnrollmentDialog.tsx`

- [ ] **Step 1: `GroupDetailPage.tsx` — quitar la multiplicación de `periodBasePrice` (línea 135)**

Reemplazar:

```ts
  const selectedTariffPrice = tariffs.find((t) => t.id === selectedTariffId)?.price ?? 0
  // Precio de referencia del periodo completo: cuota mensual x meses del ciclo
  // seleccionado. Los descuentos operan sobre este total, no sobre el mes.
  const periodBasePrice = selectedTariffPrice * cycleLength(selectedBillingFrequency)
```

por:

```ts
  const selectedTariffPrice = tariffs.find((t) => t.id === selectedTariffId)?.price ?? 0
  // Precio de referencia del periodo completo: el precio de la tarifa ya es
  // el importe del ciclo (no se multiplica). Los descuentos operan sobre él.
  const periodBasePrice = selectedTariffPrice
```

- [ ] **Step 2: `GroupDetailPage.tsx` — quitar la multiplicación de `tariffPeriodPrice` (línea 158)**

Reemplazar:

```ts
    const tariffPeriodPrice = tariff.price * cycleLength(selectedBillingFrequency)
```

por:

```ts
    const tariffPeriodPrice = tariff.price
```

- [ ] **Step 3: `GroupDetailPage.tsx` — quitar el texto de ayuda "Base del periodo" (líneas 817-822)**

Reemplazar:

```tsx
                {(selectedBillingFrequency === 'quarterly' || selectedBillingFrequency === 'annual') && (
                  <p className="text-xs text-muted-foreground">
                    Base del periodo: {formatCurrency(periodBasePrice)} por {billingFrequencyLabel(selectedBillingFrequency).toLowerCase()}
                    {' '}({cycleLength(selectedBillingFrequency)} × {formatCurrency(selectedTariffPrice)})
                  </p>
                )}
```

por: (eliminar el bloque completo — el "Precio final" ya mostrado justo encima es suficiente, ya no hay nada que explicar sobre una multiplicación)

- [ ] **Step 4: `GroupDetailPage.tsx` — quitar el import de `cycleLength` si queda sin uso**

Run: `grep -n "cycleLength" "src/pages/GroupDetailPage.tsx"`
Expected: ninguna coincidencia.

Editar la línea 25:

```ts
import { billingFrequencyLabel, cycleLength } from '@/lib/billing-utils'
```

por:

```ts
import { billingFrequencyLabel } from '@/lib/billing-utils'
```

(si `billingFrequencyLabel` tampoco se usa ya en ningún otro sitio del archivo, comprobarlo con `grep -n "billingFrequencyLabel" "src/pages/GroupDetailPage.tsx"` antes de quitar también ese import — mantenerlo si aparece en otra parte del archivo.)

- [ ] **Step 5: `MoveEnrollmentDialog.tsx` — mismos tres cambios**

Línea 45-48, reemplazar:

```ts
  const selectedTariffPrice = selectedTariff?.price ?? 0
  // Precio de referencia del periodo completo: cuota mensual x meses del ciclo
  // seleccionado. Los descuentos operan sobre este total, no sobre el mes.
  const periodBasePrice = selectedTariffPrice * cycleLength(selectedBillingFrequency)
```

por:

```ts
  const selectedTariffPrice = selectedTariff?.price ?? 0
  // Precio de referencia del periodo completo: el precio de la tarifa ya es
  // el importe del ciclo (no se multiplica). Los descuentos operan sobre él.
  const periodBasePrice = selectedTariffPrice
```

Línea 91, reemplazar:

```ts
        const tariffPeriodPrice = tariff.price * cycleLength(selectedBillingFrequency)
```

por:

```ts
        const tariffPeriodPrice = tariff.price
```

Líneas 226-231, reemplazar:

```tsx
                      {(selectedBillingFrequency === 'quarterly' || selectedBillingFrequency === 'annual') && (
                        <p className="text-xs text-muted-foreground">
                          Base del periodo: {formatCurrency(periodBasePrice)} por {billingFrequencyLabel(selectedBillingFrequency).toLowerCase()}
                          {' '}({cycleLength(selectedBillingFrequency)} × {formatCurrency(selectedTariffPrice)})
                        </p>
                      )}
```

por: (eliminar el bloque completo)

- [ ] **Step 6: `MoveEnrollmentDialog.tsx` — quitar el import de `cycleLength` si queda sin uso**

Run: `grep -n "cycleLength" "src/components/shared/MoveEnrollmentDialog.tsx"`
Expected: ninguna coincidencia.

Editar la línea 12:

```ts
import { cycleLength, billingFrequencyLabel } from '@/lib/billing-utils'
```

por:

```ts
import { billingFrequencyLabel } from '@/lib/billing-utils'
```

(igual que en el paso 4, comprobar con grep si `billingFrequencyLabel` sigue usado en el archivo antes de decidir si se mantiene ese import.)

- [ ] **Step 7: Verificar que compila**

Run: `npm run build`
Expected: sin errores de TypeScript.

- [ ] **Step 8: Commit**

```bash
git add src/pages/GroupDetailPage.tsx src/components/shared/MoveEnrollmentDialog.tsx
git commit -m "fix: el precio de matriculación/traslado trimestral-anual ya no se multiplica por meses del ciclo"
```

---

## Task 5: Quitar la multiplicación en `RenewGroupsDialog.tsx`

**Files:**
- Modify: `src/components/shared/RenewGroupsDialog.tsx`

- [ ] **Step 1: Quitar `× cycleLength` de `computedPrice` (línea 69)**

Reemplazar:

```ts
          const computedPrice = (tariff?.price ?? g.defaultTariffPrice) * cycleLength(freq)
```

por:

```ts
          const computedPrice = tariff?.price ?? g.defaultTariffPrice
```

- [ ] **Step 2: Quitar el import de `cycleLength` si queda sin uso**

Run: `grep -n "cycleLength" "src/components/shared/RenewGroupsDialog.tsx"`
Expected: ninguna coincidencia.

Editar la línea 11:

```ts
import { cycleLength } from '@/lib/billing-utils'
```

Eliminar esa línea de import por completo (no queda ningún otro símbolo de `billing-utils` usado en este archivo, según la búsqueda anterior — comprobarlo con el mismo grep antes de borrar la línea).

- [ ] **Step 3: Verificar que compila**

Run: `npm run build`
Expected: sin errores de TypeScript.

- [ ] **Step 4: Ejecutar los tests de `dataStore`/`renewGroup` si existen para este flujo**

Run: `npm test`
Expected: todos los tests en verde (sin regresiones en los tests de `renewGroup` de la rama `claude/tarifas-individuales-renovacion`).

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/RenewGroupsDialog.tsx
git commit -m "fix: el precio precargado por alumno al renovar temporada ya no se multiplica por meses del ciclo"
```

---

## Task 6: Diálogo de edición de importe/concepto de un recibo en `PaymentsPage.tsx`

**Files:**
- Modify: `src/pages/PaymentsPage.tsx`

- [ ] **Step 1: Añadir el import del icono `Pencil` y el estado del diálogo**

En el bloque de imports de `lucide-react` (líneas 18-38), añadir `Pencil` a la lista:

```ts
import {
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Search,
  FileText,
  CreditCard,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  BarChart3,
  TableIcon,
  Plus,
  Receipt,
  RotateCcw,
  Trash2,
  Pencil,
  MessageCircle,
  UploadCloud,
} from 'lucide-react'
```

Junto a la declaración de `paymentToMark` (línea 149), añadir el estado del diálogo de edición:

```ts
  const [paymentToMark, setPaymentToMark] = useState<NormalizedPayment | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('transferencia')
  const [paymentToEdit, setPaymentToEdit] = useState<NormalizedPayment | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editConcept, setEditConcept] = useState('')
```

- [ ] **Step 2: Añadir `updatePayment` al destructuring de `useDataStore`**

Buscar la línea donde se desestructura `useDataStore()` en este archivo (contiene `markPaymentPaid`, `deletePayment`, etc.) y añadir `updatePayment` a esa lista si no está ya:

Run: `grep -n "deletePayment," "src/pages/PaymentsPage.tsx"`

Esa línea forma parte de una desestructuración de `useDataStore()`. Añadir `updatePayment,` en esa misma lista (junto a `deletePayment,`).

- [ ] **Step 3: Añadir los handlers de edición**

Después de `handleDeletePayment` (línea 655, justo antes de `handleGenerateReceipts`), añadir:

```ts
  const openEditPaymentDialog = (payment: NormalizedPayment) => {
    setPaymentToEdit(payment)
    setEditAmount(String(payment.amount))
    setEditConcept(payment.concept)
  }

  const handleSaveEditPayment = () => {
    if (!paymentToEdit) return
    const amount = parseFloat(editAmount)
    if (isNaN(amount) || amount <= 0 || !editConcept.trim()) return
    updatePayment(paymentToEdit.id, { amount, concept: editConcept.trim() })
    setPaymentToEdit(null)
  }
```

- [ ] **Step 4: Añadir el botón "Editar" en la columna de acciones**

En la definición de la columna `actions` (líneas 545-605), añadir un botón de edición en ambas ramas (`pendiente` y `pagado`), antes del botón de "Eliminar"/"Deshacer":

Para la rama `pendiente` (después del botón "Marcar pagado", líneas 569-576, antes del botón de eliminar en la línea 577):

```tsx
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEditPaymentDialog(payment)}
                  title="Editar importe/concepto"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
```

Para la rama `pagado` (líneas 588-599), añadir el mismo botón junto al de "Deshacer":

```tsx
          } else if (payment.status === 'pagado') {
            return (
              <div className="flex items-center gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEditPaymentDialog(payment)}
                  title="Editar importe/concepto"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRevertPaidStatus(payment)}
                  title="Deshacer pago y marcar como pendiente"
                >
                  <RotateCcw className="h-4 w-4 md:mr-1" />
                  <span className="hidden md:inline">Deshacer</span>
                </Button>
              </div>
            )
          }
```

- [ ] **Step 5: Añadir el diálogo de edición**

Después del diálogo "Mark as Paid Dialog" (líneas 1354-1403, buscar el `</Dialog>` de cierre de ese bloque), añadir:

```tsx
      {/* Edit Payment Dialog */}
      <Dialog open={!!paymentToEdit} onOpenChange={(open) => { if (!open) setPaymentToEdit(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar recibo</DialogTitle>
          </DialogHeader>

          {paymentToEdit && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Jugador</span>
                  <span className="font-medium">{paymentToEdit.playerName}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Concepto</Label>
                <Input value={editConcept} onChange={(e) => setEditConcept(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Importe (€)</Label>
                <Input
                  type="number" min={0} step={0.01}
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentToEdit(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEditPayment} disabled={!editConcept.trim() || isNaN(parseFloat(editAmount)) || parseFloat(editAmount) <= 0}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

- [ ] **Step 6: Verificar que compila**

Run: `npm run build`
Expected: sin errores de TypeScript.

- [ ] **Step 7: Verificación manual en local**

Run: `npm run dev` (si no hay ya un servidor corriendo)

1. Ir a Pagos, localizar un recibo pendiente, pulsar el icono de lápiz.
2. Cambiar el importe y el concepto, guardar.
3. Confirmar que la tabla refleja el nuevo importe/concepto.
4. Repetir con un recibo ya marcado como pagado.

- [ ] **Step 8: Commit**

```bash
git add src/pages/PaymentsPage.tsx
git commit -m "feat: permitir editar importe y concepto de un recibo ya generado"
```

---

## Task 7: Aviso sobre datos existentes + verificación final de la rama completa

**Files:** ninguno (tarea de verificación, sin cambios de código)

- [ ] **Step 1: Ejecutar el build y los tests completos**

Run: `npm run build && npm --prefix functions run build && npm test`
Expected: los tres comandos terminan sin errores.

- [ ] **Step 2: Buscar tarifas trimestrales/anuales existentes que puedan estar mal configuradas**

Esta es una comprobación manual, no de código: desde `SettingsPage.tsx` en local (o producción, sin modificar nada), revisar cada tarifa con frecuencia trimestral o anual creada después del commit `8537896` (17 de agosto en adelante) y confirmar con el usuario si el precio guardado es la cuota mensual (que había que multiplicar) o ya el importe fijo del ciclo. Si es una cuota mensual, corregirla manualmente al importe real del ciclo.

- [ ] **Step 3: Reportar al usuario**

Antes de cerrar la rama, informar explícitamente: "Revisa tus tarifas trimestrales/anuales creadas desde el 8537896 — el precio guardado ahora se cobra tal cual, sin multiplicar."

---

## Self-Review Notes

- **Cobertura del spec:** Sección 1 (modelo de precio) → Tareas 1, 2. Sección 2 (aviso de ciclo incompleto) → Tareas 1, 2. Sección 3 (edición de importe) → Tarea 6. Sección 4 (UI de tarifas/matriculación) → Tareas 3, 4, 5. Sección 5 (aviso de dato en riesgo) → Tarea 7.
- **Consistencia de tipos:** `remainingMonthsInGroup(groupEnd: Date, billingMonth: number, billingYear: number): number` se define igual en `src/lib/billing-utils.ts` y `functions/src/billing/billing-utils.ts`, y se llama con la misma firma en `generateMonthlyReceipts.ts` y `firestoreSync.ts`. `updatePayment(id: string, data: Partial<Payment>)` ya existe en `dataStore.ts:228` — Task 6 lo reutiliza sin cambiar su firma.
- **Nada de placeholders** — cada paso de código tiene el bloque completo a escribir.
