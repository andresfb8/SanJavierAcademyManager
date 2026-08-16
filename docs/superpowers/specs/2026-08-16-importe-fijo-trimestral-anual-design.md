# Importe fijo por ciclo (trimestral/anual) — Diseño

**Fecha:** 2026-08-16
**Estado:** aprobado, pendiente de plan de implementación
**Corrige a:** [2026-07-21-importe-por-periodo-facturacion-design.md](2026-07-21-importe-por-periodo-facturacion-design.md) — aquella pieza introdujo `cuota base × cycleLength` para que trimestral/anual no se infracobraran. Este spec revierte esa multiplicación: el admin quiere introducir directamente el importe total del ciclo, no una cuota mensual que el sistema multiplica.

## Contexto

`SettingsPage.tsx` (commit `8537896`, rama `claude/fix-tarifas-trimestral-anual`) arregló un bug real (el campo de precio no se mostraba para trimestral/anual) pero asumió el modelo `cuota base × cycleLength`. El usuario ha corregido esa asunción explícitamente:

> "en la cuota anual, no quiero que se haga una multiplicacion por 12 meses. simplemente hay una cuota para cubrir toda la temporada."

Y confirmó que lo mismo aplica a trimestral: importe fijo por trimestre, introducido directamente — no `precio mensual × 3`.

## Decisión

El precio de una tarifa/matrícula trimestral o anual **es el importe exacto que se cobra en cada recibo de ese ciclo**, tal como se introduce. Se elimina toda multiplicación por `cycleLength` en cálculo de importes. `cycleLength()` se conserva únicamente como utilidad para saber cuántos meses cubre un ciclo (necesario para el aviso de ciclo incompleto, ver más abajo) — dejando de usarse para multiplicar precio en ningún sitio.

**No hace falta migrar datos de tarifas.** `handleSaveTariff` en `SettingsPage.tsx` ya guarda `tariffForm.price` tal cual, sin multiplicar — el problema estaba solo en la fórmula de facturación (`generateMonthlyReceipts.ts` / `firestoreSync.ts`) y en los textos de ayuda de la UI, que hacían pensar en "precio mensual base". Sí hay que avisar al usuario de que **revise las tarifas trimestrales/anuales que haya creado desde el `8537896`**, por si introdujo una cuota mensual pensando que el sistema la multiplicaría — ese dato quedaría ahora infracobrado.

## Arquitectura

### 1. Fórmula de facturación — se elimina la multiplicación

**`functions/src/billing/generateMonthlyReceipts.ts:250`**, cambia de:
```ts
const amount = enrollment.customPrice ?? (group.defaultTariffPrice * cycleLength(freq));
```
a:
```ts
const amount = enrollment.customPrice ?? group.defaultTariffPrice;
```
`cycleLength` deja de importarse para esto (se sigue importando para el punto 3).

**`src/lib/firestoreSync.ts:434-445`**, el bloque:
```ts
let baseAmount: number
if (freq === 'installments' && group.installmentPrices) {
  const billingKey = `${year}-${String(month).padStart(2, '0')}`
  baseAmount = group.installmentPrices[billingKey] ?? group.defaultTariffPrice
} else {
  baseAmount = group.defaultTariffPrice * cycleLength(freq)
}
const amount = enrollment.customPrice ?? baseAmount
```
pasa a:
```ts
let baseAmount: number
if (freq === 'installments' && group.installmentPrices) {
  const billingKey = `${year}-${String(month).padStart(2, '0')}`
  baseAmount = group.installmentPrices[billingKey] ?? group.defaultTariffPrice
} else {
  baseAmount = group.defaultTariffPrice
}
const amount = enrollment.customPrice ?? baseAmount
```

### 2. Aviso de ciclo incompleto

**Problema identificado:** ninguno de los dos caminos de generación comprueba si el ciclo completo (3 o 12 meses) cabe dentro del tiempo restante del grupo — solo comprueban que el *mes de facturación* no sea posterior a `endDate` (`generateMonthlyReceipts.ts:186-197`). Así, un trimestre que empieza a facturarse con solo 2 meses de temporada restante se cobra igual por el importe completo, sin ningún aviso.

**Decisión (confirmada con el usuario):** el recibo se sigue generando por el importe configurado (no se prorratea ni se omite automáticamente) pero se marca de forma visible para que el admin decida si ajustar el importe manualmente.

**Cálculo:** dado `group.endDate`, el mes de facturación (`billingMonth`/`billingYear`) y `cycleLength(freq)`, calcular cuántos meses quedan desde el mes de facturación (inclusive) hasta el mes de `endDate` (inclusive). Si ese número es menor que `cycleLength(freq)`, el ciclo es incompleto.

```ts
function remainingMonthsInGroup(groupEnd: Date, billingMonth: number, billingYear: number): number {
  const endMonthsTotal = groupEnd.getFullYear() * 12 + (groupEnd.getMonth() + 1)
  const billingMonthsTotal = billingYear * 12 + billingMonth
  return endMonthsTotal - billingMonthsTotal + 1
}
```
Aplica solo cuando `freq` es `'quarterly'` o `'annual'` y `group.endDate` existe. Si `remainingMonthsInGroup(...) < cycleLength(freq)`, el ciclo es incompleto.

**Aplicar en ambos caminos** (`generateMonthlyReceipts.ts` tras calcular `amount`/`concept`, y el bloque equivalente en `firestoreSync.ts`):
- Si el ciclo es incompleto, añadir al `concept` del pago el sufijo: `` ⚠ el grupo finaliza antes de cubrir el ${billingFrequencyLabel(freq).toLowerCase()} completo, revisa el importe`` (usar `billingFrequencyLabel` ya existente en `billing-utils.ts`, portado a `functions/src/billing/billing-utils.ts` si no está ya).
- Registrar `logger.warn(...)` (Cloud Function) / `console.warn(...)` (generación manual) con el detalle: club, grupo, alumno, importe, meses restantes.
- No se modifica `amount`: se cobra el importe configurado tal cual.

### 3. Edición de importe de un recibo (nuevo)

Hoy no existe forma de editar el `amount`/`concept` de un pago ya generado — solo borrar y crear uno manual. Se añade un diálogo de edición en `PaymentsPage.tsx`:

- Botón "Editar" junto a las acciones existentes de cada fila de pago (junto a "Deshacer cobro"/"Eliminar"), disponible tanto para pagos `pendiente` como `pagado`.
- Diálogo con dos campos: `amount` (number, obligatorio, > 0) y `concept` (text, obligatorio) — precargados con los valores actuales del pago.
- Al guardar, actualiza el documento del pago (`payments/{id}` en Firestore, vía `updateDoc`) con los nuevos `amount`/`concept`. No toca `status`, `billingMonth`/`billingYear`, `enrollmentId` ni ningún otro campo.
- El texto del diálogo de "deshacer cobro" (`PaymentsPage.tsx:640`, *"...Volverá a estar pendiente y podrás borrarlo o editarlo si corresponde."*) ya no es engañoso una vez esto existe — no requiere cambio de texto, pasa a ser cierto.
- No se restringe a pagos con el aviso del punto 2: cualquier pago autogenerado o manual se puede editar así.

### 4. UI de tarifas y matriculación — se quita el framing "× cycleLength"

**`src/pages/SettingsPage.tsx`:**
- Línea 621: la etiqueta condicional `'Precio mensual base *'` para trimestral/anual pasa a **`'Precio *'`** (igual que mensual, sin distinción — el campo ya no representa una base mensual).
- Líneas 627-632 (bloque de ayuda "Se facturará X cada trimestre... (3 × Y)") se sustituyen por un texto fijo, sin cálculo: `"Importe fijo que se cobrará cada ${billingFrequencyLabel(tariffForm.billingFrequency).toLowerCase()}."`
- Líneas 533-538 (tarjeta de listado de tarifas, "Facturación trimestral (X cada trimestre)") pasan a: `"Facturación ${billingFrequencyLabel(tariff.billingFrequency).toLowerCase()} — ${formatCurrency(tariff.price)}"` (sin multiplicación).
- Se elimina el import de `cycleLength` (línea 14) si ya no se usa en el archivo tras estos cambios.

**`src/pages/GroupDetailPage.tsx`:**
- Línea 135: `periodBasePrice = selectedTariffPrice * cycleLength(selectedBillingFrequency)` pasa a `periodBasePrice = selectedTariffPrice` (el precio de la tarifa ya es el importe del periodo).
- Línea 158: mismo cambio, `tariffPeriodPrice = tariff.price` (sin `* cycleLength`).
- Líneas 817-822 (ayuda "Base del periodo: X por trimestre (3 × Y)") se eliminan — ya no aporta nada útil una vez el precio no se deriva de una base mensual; el "Precio final" (línea 808-816, ya existente) es suficiente.
- Se elimina el import de `cycleLength` si queda sin uso.

**`src/components/shared/MoveEnrollmentDialog.tsx`:** mismo patrón que `GroupDetailPage.tsx` — línea 48 (`periodBasePrice`), línea 91 (`tariffPeriodPrice`), líneas 226-231 (texto de ayuda) — idénticos cambios.

**`src/components/shared/RenewGroupsDialog.tsx`:** línea 69, `computedPrice = (tariff?.price ?? g.defaultTariffPrice) * cycleLength(freq)` pasa a `computedPrice = tariff?.price ?? g.defaultTariffPrice` — el precio precargado por alumno ya no se multiplica.

### 5. Tests

**`src/lib/billing-utils.test.ts`:** el segundo `describe` (líneas 22-34, *"importe por periodo (base × cycleLength...)"*) documentaba la fórmula ahora incorrecta — se elimina por completo (no describe comportamiento de `cycleLength` en sí, solo la multiplicación que ya no ocurre). El primer `describe` (`cycleLength` devuelve 1/3/12/1) se mantiene sin cambios — la función sigue existiendo con la misma tabla, solo cambia dónde se usa.

**Nuevos tests** (mismo archivo o uno nuevo `src/lib/billing-utils.test.ts` ampliado) para `remainingMonthsInGroup` (o el nombre que reciba en `billing-utils.ts`, portado a ambas copias):
- Grupo termina en el mismo mes que se factura → 1 mes restante.
- Grupo termina 2 meses después del mes de facturación → 3 meses restantes.
- Trimestral con 2 meses restantes → ciclo incompleto (`2 < 3`).
- Anual con 12 meses restantes exactos → ciclo completo (`12 < 12` es falso).

No se testea la generación de recibos end-to-end (Firestore/Admin SDK) ni el diálogo de edición de pago — se verifican manualmente, siguiendo la convención ya usada en el spec de origen.

## Archivos

| Archivo | Acción |
|---|---|
| `functions/src/billing/generateMonthlyReceipts.ts` | Quitar `× cycleLength` del importe; añadir aviso de ciclo incompleto en `concept` + `logger.warn` |
| `src/lib/firestoreSync.ts` | Mismo cambio de importe + aviso en la generación manual |
| `functions/src/billing/billing-utils.ts` | Añadir `remainingMonthsInGroup` (o equivalente) |
| `src/lib/billing-utils.ts` | Añadir `remainingMonthsInGroup` (copia idéntica) |
| `src/lib/billing-utils.test.ts` | Eliminar tests de multiplicación; añadir tests de `remainingMonthsInGroup` |
| `src/pages/SettingsPage.tsx` | Quitar framing "× cycleLength"; label y ayuda de precio simplificados |
| `src/pages/GroupDetailPage.tsx` | Quitar `× cycleLength` de `periodBasePrice`/`tariffPeriodPrice`; quitar ayuda "Base del periodo" |
| `src/components/shared/MoveEnrollmentDialog.tsx` | Mismo cambio que `GroupDetailPage.tsx` |
| `src/components/shared/RenewGroupsDialog.tsx` | Quitar `× cycleLength` de `computedPrice` |
| `src/pages/PaymentsPage.tsx` | Nuevo diálogo de edición de `amount`/`concept` de un pago |

## Fuera de alcance

- No se toca `SeasonPaymentDialog`/`registerSeasonPayment` (pago de temporada por adelantado) — sigue siendo un importe introducido a mano, no afectado por esta fórmula.
- No se migran datos existentes automáticamente — se avisa al usuario para que revise sus tarifas trimestrales/anuales creadas desde el `8537896`.
- No se añade proración automática ni bloqueo de generación cuando el ciclo es incompleto — solo el aviso descrito en el punto 2.
- `isBillingMonth` y el resto de la maquinaria de frecuencias (idempotencia por enrollment+mes+año, plazos) no cambian.

## Verificación manual

1. `npm run build`, `npm --prefix functions run build` y `npm test` en verde.
2. Crear una tarifa **trimestral** con precio 120 €. Confirmar que la ayuda dice "Importe fijo que se cobrará cada trimestre", sin multiplicación.
3. Matricular a un alumno con esa tarifa. Generar el recibo del mes ancla → debe ser **120 €**, no 360 €.
4. Repetir con una tarifa **anual** de 500 € → recibo de **500 €**, no 6000 €.
5. Crear un grupo cuyo `endDate` caiga 2 meses después del próximo mes de facturación trimestral de un alumno. Generar recibos de ese mes → el recibo se crea por el importe configurado, con el aviso `⚠` en el concepto, y aparece un `console.warn`/`logger.warn`.
6. Desde `PaymentsPage.tsx`, editar el importe de ese recibo con el aviso → se guarda el nuevo importe y concepto correctamente.
7. Un alumno **mensual** existente sigue generando el mismo importe de siempre (sin regresión).
