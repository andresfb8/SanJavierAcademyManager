# Importe por periodo en facturación — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que las inscripciones trimestrales/anuales generen recibos por el importe total del periodo (cuota base × meses del ciclo), no por la cuota mensual pelada, manteniendo `customPrice` como override editable.

**Architecture:** Un helper puro `cycleLength(frequency)` (duplicado en frontend y Cloud Functions, como ya ocurre con `isBillingMonth`) que da el número de meses de cada frecuencia. Se inserta como multiplicador en el cálculo de `amount` de los dos caminos de generación de recibos existentes, y se refleja como preview en los dos diálogos de alta/traslado de inscripción.

**Tech Stack:** React 19 + TypeScript, Zustand, Firebase Firestore (client SDK + Admin SDK), Firebase Cloud Functions v2, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-21-importe-por-periodo-facturacion-design.md`

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/lib/billing-utils.ts` | Modificar | Añadir `cycleLength` (frontend) |
| `functions/src/billing/billing-utils.ts` | Modificar | Añadir `cycleLength` (Cloud Functions, copia idéntica) |
| `src/lib/billing-utils.test.ts` | Crear | Tests de `cycleLength` |
| `functions/src/billing/generateMonthlyReceipts.ts` | Modificar | Multiplicar `amount` por `cycleLength(freq)` |
| `src/lib/firestoreSync.ts` | Modificar | Mismo cambio en `generateMonthlyReceiptsAtomic` |
| `src/pages/GroupDetailPage.tsx` | Modificar | Preview de precio por periodo + texto de ayuda |
| `src/components/shared/MoveEnrollmentDialog.tsx` | Modificar | Mismo preview |

### Nota importante sobre `installments` en la Cloud Function

`functions/src/billing/generateMonthlyReceipts.ts` calcula hoy el importe de **todas** las frecuencias con `group.defaultTariffPrice`, incluida `installments` — a diferencia de `src/lib/firestoreSync.ts`, que para `installments` ya usa `group.installmentPrices[billingKey]` como base. Esto es un **bug preexistente en la Cloud Function**, fuera del alcance de este plan (el spec dice explícitamente que plazos no se toca). Como `cycleLength('installments')` es 1, insertar la multiplicación no lo agrava ni lo corrige — el comportamiento de cada archivo para `installments` se mantiene exactamente como está hoy. **No lo arregles** al tocar estas líneas; limítate a insertar el multiplicador preservando el `baseAmount` tal cual existe en cada archivo.

---

### Task 1: Helper `cycleLength` (frontend) con TDD

**Files:**
- Modify: `src/lib/billing-utils.ts`
- Create: `src/lib/billing-utils.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/billing-utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { cycleLength } from '@/lib/billing-utils'

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

describe('importe por periodo (base x cycleLength, misma fórmula que usan firestoreSync.ts y generateMonthlyReceipts.ts)', () => {
  it('mensual: 45 x 1 = 45', () => {
    expect(45 * cycleLength('monthly')).toBe(45)
  })

  it('trimestral: 45 x 3 = 135', () => {
    expect(45 * cycleLength('quarterly')).toBe(135)
  })

  it('anual: 45 x 12 = 540', () => {
    expect(45 * cycleLength('annual')).toBe(540)
  })
})
```

- [ ] **Step 2: Ejecutar el test y comprobar que falla**

Run: `npm test -- billing-utils`
Expected: FAIL — `cycleLength` no existe en `@/lib/billing-utils`.

- [ ] **Step 3: Implementar `cycleLength`**

En `src/lib/billing-utils.ts`, añadir al final del archivo (después de `billingFrequencyLabel`):

```ts
/** Nº de meses que cubre un recibo de esta frecuencia. */
export function cycleLength(frequency: BillingFrequency): number {
  switch (frequency) {
    case 'monthly':      return 1
    case 'quarterly':    return 3
    case 'annual':       return 12
    case 'installments': return 1   // plazos usa su propio precio por mes, no se multiplica
  }
}
```

- [ ] **Step 4: Ejecutar el test y comprobar que pasa**

Run: `npm test -- billing-utils`
Expected: PASS — 4 tests.

- [ ] **Step 5: Comprobar que el resto de la suite sigue en verde**

Run: `npm test`
Expected: PASS — 20 tests (16 existentes + 4 nuevos).

- [ ] **Step 6: Commit**

```bash
git add src/lib/billing-utils.ts src/lib/billing-utils.test.ts
git commit -m "feat: add cycleLength helper for per-period billing amounts"
```

---

### Task 2: Helper `cycleLength` en Cloud Functions (copia idéntica)

**Files:**
- Modify: `functions/src/billing/billing-utils.ts`

No lleva test propio: es una copia idéntica de la Task 1 en el entorno de Cloud Functions (Node/Admin SDK, sin Vitest configurado ahí), siguiendo el mismo patrón que `isBillingMonth` ya tiene duplicado en ambos sitios.

- [ ] **Step 1: Añadir `cycleLength`**

En `functions/src/billing/billing-utils.ts`, el archivo completo queda así:

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
```

- [ ] **Step 2: Compilar las Cloud Functions**

Run: `npm --prefix functions run build`
Expected: sin errores de TypeScript.

- [ ] **Step 3: Commit**

```bash
git add functions/src/billing/billing-utils.ts
git commit -m "feat: add cycleLength helper to Cloud Functions billing-utils"
```

---

### Task 3: Aplicar `cycleLength` en la Cloud Function de recibos

**Files:**
- Modify: `functions/src/billing/generateMonthlyReceipts.ts:5` (import), `:247` (cálculo del importe)

- [ ] **Step 1: Importar `cycleLength`**

En `functions/src/billing/generateMonthlyReceipts.ts:5`, cambiar:

```ts
import { isBillingMonth } from "./billing-utils";
```

por:

```ts
import { isBillingMonth, cycleLength } from "./billing-utils";
```

- [ ] **Step 2: Multiplicar el importe por el ciclo**

En `functions/src/billing/generateMonthlyReceipts.ts:247`, cambiar:

```ts
    const amount = enrollment.customPrice ?? group.defaultTariffPrice;
```

por:

```ts
    // Trimestral/anual generan menos recibos pero por el total del periodo
    // (cuota base x meses del ciclo); customPrice, si está definido, es
    // siempre el importe exacto del recibo y no se multiplica.
    const amount = enrollment.customPrice ?? (group.defaultTariffPrice * cycleLength(freq));
```

No toques nada más en esta función — en particular, deja `group.defaultTariffPrice` como base también para `installments` (ver la nota de "installments en la Cloud Function" al principio de este plan; es un bug preexistente fuera de alcance, y `cycleLength('installments')` es 1 así que no cambia el resultado).

- [ ] **Step 3: Compilar las Cloud Functions**

Run: `npm --prefix functions run build`
Expected: sin errores de TypeScript.

- [ ] **Step 4: Commit**

```bash
git add functions/src/billing/generateMonthlyReceipts.ts
git commit -m "fix: cobrar el total del periodo en recibos trimestrales/anuales (Cloud Function)"
```

---

### Task 4: Aplicar `cycleLength` en la generación manual (frontend)

**Files:**
- Modify: `src/lib/firestoreSync.ts:27` (import), `:434-443` (cálculo del importe)

- [ ] **Step 1: Importar `cycleLength`**

En `src/lib/firestoreSync.ts:27`, cambiar:

```ts
import { isBillingMonth } from './billing-utils'
```

por:

```ts
import { isBillingMonth, cycleLength } from './billing-utils'
```

- [ ] **Step 2: Multiplicar el importe por el ciclo**

En `src/lib/firestoreSync.ts:434-443`, el bloque actual es:

```ts
      // Calcular importe: customPrice tiene prioridad
      // Para plazos: usar el precio específico del mes (YYYY-MM), para mensual: usar precio base del grupo
      let baseAmount: number
      if (freq === 'installments' && group.installmentPrices) {
        const billingKey = `${year}-${String(month).padStart(2, '0')}`
        baseAmount = group.installmentPrices[billingKey] ?? group.defaultTariffPrice
      } else {
        baseAmount = group.defaultTariffPrice
      }
      const amount = enrollment.customPrice ?? baseAmount
```

Cambiar a:

```ts
      // Calcular importe: customPrice tiene prioridad
      // Para plazos: usar el precio específico del mes (YYYY-MM) sin multiplicar.
      // Para mensual/trimestral/anual: precio base del grupo x meses del ciclo
      // (trimestral/anual generan menos recibos pero por el total del periodo).
      let baseAmount: number
      if (freq === 'installments' && group.installmentPrices) {
        const billingKey = `${year}-${String(month).padStart(2, '0')}`
        baseAmount = group.installmentPrices[billingKey] ?? group.defaultTariffPrice
      } else {
        baseAmount = group.defaultTariffPrice * cycleLength(freq)
      }
      const amount = enrollment.customPrice ?? baseAmount
```

Nota: para `installments`, `baseAmount` sigue viniendo de `installmentPrices` (o el fallback a `defaultTariffPrice` sin multiplicar) exactamente como hoy — la rama `else` es la única que gana el multiplicador, y solo aplica a mensual/trimestral/anual.

- [ ] **Step 3: Comprobar que compila**

Run: `npm run build`
Expected: `✓ built` sin errores.

- [ ] **Step 4: Comprobar que los tests siguen en verde**

Run: `npm test`
Expected: PASS — 20 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/firestoreSync.ts
git commit -m "fix: cobrar el total del periodo en recibos trimestrales/anuales (generacion manual)"
```

---

### Task 5: Preview del precio por periodo en `GroupDetailPage`

**Files:**
- Modify: `src/pages/GroupDetailPage.tsx:25` (import), `:131-145` (cálculo de precio), `:154-165` (`finalCustomPrice`), `:747` (etiqueta), `:798-806` (bloque de precio final), `:833-841` (texto de ayuda)

- [ ] **Step 1: Importar `cycleLength`**

En `src/pages/GroupDetailPage.tsx:25`, cambiar:

```ts
import { billingFrequencyLabel } from '@/lib/billing-utils'
```

por:

```ts
import { billingFrequencyLabel, cycleLength } from '@/lib/billing-utils'
```

- [ ] **Step 2: Calcular el precio base del periodo**

En `src/pages/GroupDetailPage.tsx:131-145`, el bloque actual es:

```ts
  const selectedTariffPrice = tariffs.find((t) => t.id === selectedTariffId)?.price ?? 0
  const computedFinalPrice = useMemo(() => {
    if (discountMode === 'percentage') {
      const pct = parseFloat(discountPercentage)
      if (!isNaN(pct) && pct > 0 && pct <= 100) {
        return Math.round(selectedTariffPrice * (1 - pct / 100) * 100) / 100
      }
      return selectedTariffPrice
    }
    if (discountMode === 'fixed_price') {
      const parsed = parseFloat(customPrice)
      return !isNaN(parsed) && parsed >= 0 ? parsed : selectedTariffPrice
    }
    return selectedTariffPrice
  }, [discountMode, discountPercentage, customPrice, selectedTariffPrice])
```

Cambiar a:

```ts
  const selectedTariffPrice = tariffs.find((t) => t.id === selectedTariffId)?.price ?? 0
  // Precio de referencia del periodo completo: cuota mensual x meses del ciclo
  // seleccionado. Los descuentos operan sobre este total, no sobre el mes.
  const periodBasePrice = selectedTariffPrice * cycleLength(selectedBillingFrequency)
  const computedFinalPrice = useMemo(() => {
    if (discountMode === 'percentage') {
      const pct = parseFloat(discountPercentage)
      if (!isNaN(pct) && pct > 0 && pct <= 100) {
        return Math.round(periodBasePrice * (1 - pct / 100) * 100) / 100
      }
      return periodBasePrice
    }
    if (discountMode === 'fixed_price') {
      const parsed = parseFloat(customPrice)
      return !isNaN(parsed) && parsed >= 0 ? parsed : periodBasePrice
    }
    return periodBasePrice
  }, [discountMode, discountPercentage, customPrice, periodBasePrice])
```

- [ ] **Step 3: Calcular `finalCustomPrice` sobre el precio del periodo**

En `src/pages/GroupDetailPage.tsx:154-165`, el bloque actual es:

```ts
    let finalCustomPrice: number | undefined
    if (discountMode === 'percentage') {
      const pct = parseFloat(discountPercentage)
      if (!isNaN(pct) && pct > 0 && pct <= 100) {
        finalCustomPrice = Math.round(tariff.price * (1 - pct / 100) * 100) / 100
      }
    } else if (discountMode === 'fixed_price') {
      const parsed = parseFloat(customPrice)
      if (!isNaN(parsed) && parsed >= 0) {
        finalCustomPrice = parsed
      }
    }
```

Cambiar a:

```ts
    const tariffPeriodPrice = tariff.price * cycleLength(selectedBillingFrequency)
    let finalCustomPrice: number | undefined
    if (discountMode === 'percentage') {
      const pct = parseFloat(discountPercentage)
      if (!isNaN(pct) && pct > 0 && pct <= 100) {
        finalCustomPrice = Math.round(tariffPeriodPrice * (1 - pct / 100) * 100) / 100
      }
    } else if (discountMode === 'fixed_price') {
      const parsed = parseFloat(customPrice)
      if (!isNaN(parsed) && parsed >= 0) {
        finalCustomPrice = parsed
      }
    }
```

Nota: cuando `discountMode === 'none'`, `finalCustomPrice` queda `undefined` — igual que hoy — y la generación de recibos calculará el importe ella misma con `cycleLength` (Task 3/4). Solo cuando hay descuento se guarda un `customPrice` explícito, y debe ser ya el total del periodo.

Más abajo en el mismo handler (`handleAddPlayer`), la línea `amount: (finalCustomPrice ?? tariff.price).toString()` dentro de `setPartialReceiptData` (~línea 205) debe usar `tariffPeriodPrice` en vez de `tariff.price`:

```ts
    if (needsPartialReceipt) {
      setPartialReceiptData({
        enrollmentId,
        amount: (finalCustomPrice ?? tariffPeriodPrice).toString()
      })
    }
```

- [ ] **Step 4: Actualizar la etiqueta "Precio tarifa"**

En `src/pages/GroupDetailPage.tsx:747`, cambiar:

```tsx
                    Precio tarifa ({formatCurrency(selectedTariffPrice)})
```

por:

```tsx
                    Precio tarifa ({formatCurrency(periodBasePrice)})
```

- [ ] **Step 5: Añadir el texto de ayuda para trimestral/anual**

En `src/pages/GroupDetailPage.tsx`, el bloque del precio final (líneas 798-806) es:

```tsx
                <div className="rounded-md bg-muted/50 p-3 text-sm">
                  <span className="text-muted-foreground">Precio final: </span>
                  <span className="font-semibold">{formatCurrency(computedFinalPrice)}</span>
                  {discountMode === 'percentage' && discountPercentage && (
                    <span className="text-muted-foreground ml-1">
                      (-{discountPercentage}%)
                    </span>
                  )}
                </div>
```

Añadir justo debajo (dentro del mismo `div` padre que engloba el bloque de precio, antes de su cierre):

```tsx
                <div className="rounded-md bg-muted/50 p-3 text-sm">
                  <span className="text-muted-foreground">Precio final: </span>
                  <span className="font-semibold">{formatCurrency(computedFinalPrice)}</span>
                  {discountMode === 'percentage' && discountPercentage && (
                    <span className="text-muted-foreground ml-1">
                      (-{discountPercentage}%)
                    </span>
                  )}
                </div>
                {(selectedBillingFrequency === 'quarterly' || selectedBillingFrequency === 'annual') && (
                  <p className="text-xs text-muted-foreground">
                    Se cobrará {formatCurrency(computedFinalPrice)} por {billingFrequencyLabel(selectedBillingFrequency).toLowerCase()}
                    {' '}({cycleLength(selectedBillingFrequency)} × {formatCurrency(selectedTariffPrice)})
                  </p>
                )}
```

- [ ] **Step 6: Comprobar que compila**

Run: `npm run build`
Expected: `✓ built` sin errores.

- [ ] **Step 7: Comprobar visualmente**

Run: `npm run dev`, ir a un grupo → Añadir jugador → seleccionar una tarifa y frecuencia "Anual". Verificar que "Precio tarifa" y "Precio final" muestran el total anual (12 × precio mensual), y que aparece el texto "Se cobrará X € por anual (12 × Y €)".

- [ ] **Step 8: Commit**

```bash
git add src/pages/GroupDetailPage.tsx
git commit -m "feat: mostrar precio por periodo en el alta de inscripcion (GroupDetailPage)"
```

---

### Task 6: Preview del precio por periodo en `MoveEnrollmentDialog`

**Files:**
- Modify: `src/components/shared/MoveEnrollmentDialog.tsx:11` (import), `:44-58` (cálculo de precio), `:87-96` (`finalCustomPrice`), `:199` (etiqueta), `:216-220` (texto de ayuda)

- [ ] **Step 1: Importar `cycleLength`**

En `src/components/shared/MoveEnrollmentDialog.tsx`, cambiar:

```ts
import type { BillingFrequency } from '@/types'
```

por:

```ts
import type { BillingFrequency } from '@/types'
import { cycleLength, billingFrequencyLabel } from '@/lib/billing-utils'
```

- [ ] **Step 2: Calcular el precio base del periodo**

En `src/components/shared/MoveEnrollmentDialog.tsx:44-58`, el bloque actual es:

```ts
  const selectedTariffPrice = selectedTariff?.price ?? 0

  const computedFinalPrice = useMemo(() => {
    if (discountMode === 'percentage') {
      const pct = parseFloat(discountPercentage)
      if (!isNaN(pct) && pct > 0 && pct <= 100) {
        return Math.round(selectedTariffPrice * (1 - pct / 100) * 100) / 100
      }
    }
    if (discountMode === 'fixed_price') {
      const parsed = parseFloat(customPrice)
      if (!isNaN(parsed) && parsed >= 0) return parsed
    }
    return selectedTariffPrice
  }, [discountMode, discountPercentage, customPrice, selectedTariffPrice])
```

Cambiar a:

```ts
  const selectedTariffPrice = selectedTariff?.price ?? 0
  // Precio de referencia del periodo completo: cuota mensual x meses del ciclo
  // seleccionado. Los descuentos operan sobre este total, no sobre el mes.
  const periodBasePrice = selectedTariffPrice * cycleLength(selectedBillingFrequency)

  const computedFinalPrice = useMemo(() => {
    if (discountMode === 'percentage') {
      const pct = parseFloat(discountPercentage)
      if (!isNaN(pct) && pct > 0 && pct <= 100) {
        return Math.round(periodBasePrice * (1 - pct / 100) * 100) / 100
      }
    }
    if (discountMode === 'fixed_price') {
      const parsed = parseFloat(customPrice)
      if (!isNaN(parsed) && parsed >= 0) return parsed
    }
    return periodBasePrice
  }, [discountMode, discountPercentage, customPrice, periodBasePrice])
```

- [ ] **Step 3: Calcular `finalCustomPrice` sobre el precio del periodo**

En `src/components/shared/MoveEnrollmentDialog.tsx:87-96`, el bloque actual (dentro de `handleConfirm`, rama `tariffOption === 'new'`) es:

```ts
        const tariff = tariffs.find(t => t.id === selectedTariffId)
        if (!tariff) return
        let finalCustomPrice: number | undefined
        if (discountMode === 'percentage') {
          const pct = parseFloat(discountPercentage)
          if (!isNaN(pct) && pct > 0 && pct <= 100) {
            finalCustomPrice = Math.round(tariff.price * (1 - pct / 100) * 100) / 100
          }
        } else if (discountMode === 'fixed_price') {
          const parsed = parseFloat(customPrice)
          if (!isNaN(parsed) && parsed >= 0) finalCustomPrice = parsed
        }
```

Cambiar a:

```ts
        const tariff = tariffs.find(t => t.id === selectedTariffId)
        if (!tariff) return
        const tariffPeriodPrice = tariff.price * cycleLength(selectedBillingFrequency)
        let finalCustomPrice: number | undefined
        if (discountMode === 'percentage') {
          const pct = parseFloat(discountPercentage)
          if (!isNaN(pct) && pct > 0 && pct <= 100) {
            finalCustomPrice = Math.round(tariffPeriodPrice * (1 - pct / 100) * 100) / 100
          }
        } else if (discountMode === 'fixed_price') {
          const parsed = parseFloat(customPrice)
          if (!isNaN(parsed) && parsed >= 0) finalCustomPrice = parsed
        }
```

- [ ] **Step 4: Actualizar la etiqueta "Precio tarifa"**

En `src/components/shared/MoveEnrollmentDialog.tsx:199`, cambiar:

```tsx
                          Precio tarifa ({formatCurrency(selectedTariffPrice)})
```

por:

```tsx
                          Precio tarifa ({formatCurrency(periodBasePrice)})
```

- [ ] **Step 5: Añadir el texto de ayuda para trimestral/anual**

En `src/components/shared/MoveEnrollmentDialog.tsx:216-220`, el bloque actual es:

```tsx
                      {discountMode !== 'none' && (
                        <p className="text-xs text-muted-foreground">
                          Precio final: <span className="font-medium">{formatCurrency(computedFinalPrice)}</span>
                        </p>
                      )}
```

Cambiar a:

```tsx
                      {discountMode !== 'none' && (
                        <p className="text-xs text-muted-foreground">
                          Precio final: <span className="font-medium">{formatCurrency(computedFinalPrice)}</span>
                        </p>
                      )}
                      {(selectedBillingFrequency === 'quarterly' || selectedBillingFrequency === 'annual') && (
                        <p className="text-xs text-muted-foreground">
                          Se cobrará {formatCurrency(computedFinalPrice)} por {billingFrequencyLabel(selectedBillingFrequency).toLowerCase()}
                          {' '}({cycleLength(selectedBillingFrequency)} × {formatCurrency(selectedTariffPrice)})
                        </p>
                      )}
```

- [ ] **Step 6: Comprobar que compila**

Run: `npm run build`
Expected: `✓ built` sin errores.

- [ ] **Step 7: Comprobar que los tests siguen en verde**

Run: `npm test`
Expected: PASS — 20 tests.

- [ ] **Step 8: Commit**

```bash
git add src/components/shared/MoveEnrollmentDialog.tsx
git commit -m "feat: mostrar precio por periodo en el traslado de inscripcion"
```

---

## Verificación manual final

Requiere `npm run dev` y una cuenta de director, con al menos una tarifa mensual creada (p. ej. 45 €).

1. **Alta anual sin descuento:** Grupo → Añadir jugador → tarifa 45 €, frecuencia "Anual". El precio final debe mostrar 540,00 € y el texto "Se cobrará 540,00 € por anual (12 × 45,00 €)". Inscribir. Generar recibos manualmente (Pagos → Generar recibos) en el mes ancla → debe crear un recibo de **540,00 €**. En los otros 11 meses, generar recibos no debe crear nada para ese alumno.
2. **Alta trimestral sin descuento:** misma tarifa, frecuencia "Trimestral", ancla septiembre. El precio final debe mostrar 135,00 €. Generar recibos en septiembre, diciembre, marzo y junio → recibo de **135,00 €** cada vez; en los demás meses, ninguno.
3. **Alta anual con descuento del 10%:** precio final debe mostrar 486,00 € (10% sobre 540). El recibo generado debe ser de 486,00 €.
4. **Regresión mensual:** un alta mensual sigue mostrando y cobrando 45,00 € cada mes.
5. **Regresión plazos:** un grupo con `installmentPrices` configurado sigue cobrando el precio de cada mes tal cual, sin multiplicar.
6. **Traslado de grupo:** repetir el punto 1 pero usando "Mover a otro grupo" con tarifa nueva y frecuencia anual — mismo resultado.
7. **Cloud Function programada:** si es posible probar en el emulador (`firebase emulators:start`), invocar la función callable de generación y confirmar que el importe anual/trimestral también sale multiplicado ahí.
