# Importe por periodo en facturación (trimestral/anual) — Diseño

**Fecha:** 2026-07-21
**Estado:** aprobado, pendiente de plan de implementación
**Contexto mayor:** primera de dos piezas de "renovación de temporada". Esta (Pieza A) es independiente y se implementa primero; la Pieza B (temporada como entidad + asistente de renovación) tendrá su propio spec. Ver la sección final.

## Contexto

El sistema de frecuencias de facturación mixtas (mensual/trimestral/anual/plazos) ya está implementado y en producción: cada `Enrollment` tiene su `billingFrequency` + `billingAnchorMonth`, y el helper `isBillingMonth` ([src/lib/billing-utils.ts](../../../src/lib/billing-utils.ts)) decide en qué meses se genera recibo. Los dos caminos de generación lo aplican de forma consistente: la generación manual ([firestoreSync.ts `generateMonthlyReceiptsAtomic`](../../../src/lib/firestoreSync.ts)) y la Cloud Function programada ([functions/src/billing/generateMonthlyReceipts.ts](../../../functions/src/billing/generateMonthlyReceipts.ts)).

**El problema:** `isBillingMonth` controla *cuándo* se cobra, pero no *cuánto*. El importe hoy es:

```ts
const amount = enrollment.customPrice ?? group.defaultTariffPrice   // (o precio de plazo para 'installments')
```

Es decir, una inscripción trimestral o anual genera menos recibos pero **por el mismo precio mensual, sin multiplicar**. Consecuencia: un alumno anual con la tarifa mensual por defecto paga **una sola mensualidad por todo el año**, y un trimestral paga 4 mensualidades en vez de 12 — se infracobra sin ninguna señal. Para que cuadre, hoy el admin tiene que meter a mano el total del periodo en `customPrice`, y no hay ningún aviso ni guardarraíl que lo recuerde.

## Decisión (validada con el usuario)

El importe de cada recibo se calcula automáticamente como **cuota base × meses del ciclo**, y es **editable** (para descuentos, p.ej. pago anual con rebaja). La multiplicación ocurre en la **generación de recibos**, no en un campo guardado, para que el precio mensual siga siendo la única fuente de verdad y el arreglo cubra también las inscripciones que hoy no tienen `customPrice`.

## Arquitectura

### 1. Helper `cycleLength` (fuente única de la tabla)

En `src/lib/billing-utils.ts` **y** `functions/src/billing/billing-utils.ts` (copias idénticas, como ya ocurre con `isBillingMonth`), añadir:

```ts
/** Nº de meses que cubre un recibo de esta frecuencia. */
export function cycleLength(frequency: BillingFrequency): number {
  switch (frequency) {
    case 'monthly':      return 1
    case 'quarterly':    return 3
    case 'annual':       return 12
    case 'installments': return 1   // plazos usa su propio precio por mes
  }
}
```

### 2. Cálculo del importe en la generación

En **ambos** caminos, sustituir el cálculo del importe por:

```ts
const amount = enrollment.customPrice ?? (baseAmount * cycleLength(freq))
```

- `baseAmount` es lo que ya se usa hoy: `group.defaultTariffPrice` en mensual/trimestral/anual, y el precio del mes (`installmentPrices[YYYY-MM]`) en plazos.
- Para `installments`, `cycleLength` es 1, así que el comportamiento no cambia.
- `customPrice`, cuando está definido, **manda** y ya representa el importe exacto del recibo (ver semántica abajo).

Aplicar en:
- `functions/src/billing/generateMonthlyReceipts.ts` (~línea 247, `const amount = ...`).
- `src/lib/firestoreSync.ts` (`generateMonthlyReceiptsAtomic`, ~línea 443, `const amount = ...`).

### 3. Semántica de `customPrice`

`customPrice` pasa a significar, de forma consistente, **"el importe exacto de cada recibo"** (el total del periodo), no "la cuota mensual personalizada". Cuando está vacío, la generación multiplica; cuando está, se cobra tal cual. Es un cambio de interpretación, no de tipo (sigue siendo `number?`).

Implicación en la UI (siguiente punto): los descuentos y el precio fijo operan sobre el total del periodo, no sobre el mes.

**Compatibilidad con inscripciones existentes:** para las **mensuales** (la inmensa mayoría) `cycleLength` es 1, así que la semántica no cambia. Solo cambia para trimestrales/anuales con un `customPrice` ya guardado; pero como hasta ahora esa era la única forma de cobrar bien (el importe se cobraba tal cual por ocurrencia), un admin que quisiera el importe correcto ya habría metido ahí el total del periodo — que es justo lo que la nueva semántica interpreta. No hace falta migración; el riesgo se limita al caso improbable de un `customPrice` puesto como cuota mensual en una inscripción trimestral/anual, que ya estaba infracobrando.

### 4. UI del precio en los diálogos de alta y traslado

En `src/pages/GroupDetailPage.tsx` (diálogo de añadir alumno) y `src/components/shared/MoveEnrollmentDialog.tsx`:

- El precio de referencia mostrado (`computedFinalPrice` / equivalente) pasa a ser **`tarifaBase × cycleLength(frecuenciaSeleccionada)`** en lugar de la cuota mensual pelada.
- Los modos de descuento existentes (`percentage` / `fixed_price`) operan sobre ese total del periodo. El `finalCustomPrice` que se guarda en `customPrice` es el total del periodo tras el descuento.
- Añadir un texto de ayuda cuando la frecuencia es trimestral/anual, del tipo: **"Se cobrará 540,00 € por año (12 × 45,00 €)"** — deja explícito de dónde sale el importe y que es editable.
- Reutilizar `billingFrequencyLabel` para el texto de la frecuencia.

### 5. Coherencia con lo ya existente

- `SeasonPaymentDialog` / `registerSeasonPayment` (pago de temporada por adelantado, importe total introducido a mano) **no se toca**: es un flujo distinto (registrar un cobro ya hecho que cubre un rango de meses), no la generación periódica.
- El resto de la maquinaria (`isBillingMonth`, idempotencia por enrollment+mes+año, plazos) queda igual.

## Archivos

| Archivo | Acción |
|---|---|
| `src/lib/billing-utils.ts` | Añadir `cycleLength` |
| `functions/src/billing/billing-utils.ts` | Añadir `cycleLength` (copia idéntica) |
| `src/lib/billing-utils.test.ts` | **Crear** tests de `cycleLength` |
| `functions/src/billing/generateMonthlyReceipts.ts` | Importe = `customPrice ?? base × cycleLength(freq)` |
| `src/lib/firestoreSync.ts` | Mismo cambio en `generateMonthlyReceiptsAtomic` |
| `src/pages/GroupDetailPage.tsx` | Preview de precio por periodo + texto de ayuda |
| `src/components/shared/MoveEnrollmentDialog.tsx` | Mismo preview |

## Tests

Vitest (ya existe en el proyecto). Se testea la lógica pura:

- `cycleLength`: 1/3/12/1 para monthly/quarterly/annual/installments.
- Importe resultante por frecuencia (función pura auxiliar o comprobación directa): con `customPrice` vacío → `base × ciclo`; con `customPrice` definido → ese valor; plazos → precio del mes sin multiplicar.

Casos concretos:
- Mensual, base 45, sin customPrice → 45.
- Trimestral, base 45, sin customPrice → 135.
- Anual, base 45, sin customPrice → 540.
- Anual, base 45, customPrice 500 → 500 (override).
- Plazos, precio del mes 60 → 60 (cycleLength 1, sin multiplicar).

No se testea la generación end-to-end (Firestore/Admin SDK); se verifica manualmente.

## Verificación manual

1. `npm run build`, `npm --prefix functions run build` y `npm test` en verde.
2. Dar de alta a un alumno **anual** con tarifa mensual 45 € y sin precio personalizado. Generar recibos del mes ancla → el recibo debe ser **540 €**, no 45 €. Los demás meses no generan recibo.
3. Alta **trimestral** → recibo de **135 €** en los meses del ciclo.
4. Alta anual con descuento del 10% → recibo de **486 €** (10% sobre 540).
5. Un alumno **mensual** existente sigue generando **45 €** cada mes (sin regresión).
6. Un grupo con **plazos** sigue cobrando el precio del mes configurado, sin multiplicar.

## Pieza B (sub-proyecto siguiente, spec aparte)

**Temporada como entidad + asistente de renovación**, con la Opción 1 acordada (aprovechar `isActive`):
- `Group`/`Enrollment` ganan `seasonYear`; el club apunta a `activeSeasonLabel`. Una temporada en borrador = grupos/inscripciones clonados con `isActive:false` + su `seasonYear` (no aparecen en el día a día ni se facturan).
- Asistente: clonar grupos activos → crear inscripciones borrador en el grupo equivalente (continuidad, sin motor de promoción) con frecuencia arrastrada, ancla = inicio de temporada e importe automático (Pieza A) → revisar (mover/no renovar/lista de espera, reutilizando lo existente) → **activar temporada** en una transacción que da de baja la anterior.
- **Riesgo a resolver en su spec:** borradores y lista de espera son ambos `isActive:false`; hay que distinguirlos (por `seasonYear` e `isWaitlist`) para que ni se facturen ni se mezclen.

La renovación es donde cada inscripción nueva recibe frecuencia/ancla/precio de la temporada siguiente; la Pieza A garantiza que ese precio se cobre correctamente. Por eso A va primero.
