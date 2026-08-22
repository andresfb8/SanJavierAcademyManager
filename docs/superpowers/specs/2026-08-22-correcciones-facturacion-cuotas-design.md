# Correcciones de facturación para tarifas de cuotas — Diseño

**Fecha:** 2026-08-22
**Estado:** aprobado, pendiente de plan de implementación

## Contexto

Durante la revisión de la sesión anterior (tarifa como única fuente de precio/frecuencia) se investigó cómo funcionan las tarifas de tipo "Cuotas" (`billingFrequency: 'installments'`) en toda la app, y se encontraron tres problemas reales, de gravedad decreciente:

**A. Bug activo en la Cloud Function de facturación** (`functions/src/billing/generateMonthlyReceipts.ts:250`): el cálculo de importe es `enrollment.customPrice ?? group.defaultTariffPrice` para **todas** las frecuencias — nunca lee `group.installmentPrices`. El camino manual/cliente (`src/lib/firestoreSync.ts:439-446`) sí lo hace correctamente. Si esta función programada está desplegada (confirmado: se exporta desde `functions/src/index.ts:13-15`) y hay algún grupo con tarifa de cuotas — el usuario confirmó que lo hay — cada mes se cobraría el total de la temporada en vez de la cuota mensual correspondiente, salvo que `customPrice` esté fijado a mano en cada matrícula (normalmente no lo está). El usuario revisará por su cuenta en la app si ya se han generado recibos incorrectos.

**B. El traspaso de temporada rompe los grupos de cuotas**: `RenewGroupsDialog.tsx` nunca copia `installmentPrices` al grupo nuevo — el tipo que espera `renewGroup` en el store (`src/stores/dataStore.ts:177-204`) ni siquiera tiene ese campo. A diferencia de crear/editar un grupo (`GroupsPage.tsx:275,290,307`, `GroupDetailPage.tsx:266`), que sí copian `tariff.installmentPrices` al grupo. Un grupo de cuotas traspasado a una temporada nueva se queda sin calendario de pagos — su facturación por cuotas deja de generar recibos.

**C. Configuración inerte por alumno**: `Enrollment` no tiene ningún campo para guardar un calendario de cuotas propio — las cuotas solo existen a nivel de `Group.installmentPrices`. Confirmado en la investigación: si se elige una tarifa de cuotas para UN alumno suelto (distinta de la tarifa del grupo) en `GroupDetailPage.tsx` (alta), `MoveEnrollmentDialog.tsx` (traslado) o `RenewGroupsDialog.tsx` (traspaso, tabla de alumnos), **nunca se genera ningún recibo para ese alumno** — ni por el camino cliente ni por la Cloud Function ni por la generación manual de plazos pendientes (`src/stores/dataStore.ts:1589-1635`, `src/pages/PlayerProfilePage.tsx:142-169`), porque todos esos caminos leen `group.installmentPrices`, no nada por matrícula. Los tres diálogos permiten elegir esa tarifa como si fuera válida, sin ningún aviso.

## Decisión (validada con el usuario)

Arreglar los tres, en este orden de prioridad (A primero por ser el de mayor impacto económico potencial):

**A.** Corregir el cálculo de importe en la Cloud Function para que coincida exactamente con la lógica ya correcta de `firestoreSync.ts`.

**B.** Añadir `installmentPrices` al tipo de `groupData` que espera `renewGroup`, y copiarlo en `RenewGroupsDialog.tsx` desde la tarifa elegida (o desde el grupo viejo, si no se toca el selector).

**C.** En vez de intentar dar soporte a un calendario de cuotas por alumno individual (cambio de modelo de datos mayor, fuera de alcance), **excluir las tarifas de cuotas de los selectores de tarifa por alumno** en los tres diálogos — siguen apareciendo con normalidad en los selectores de tarifa **de grupo** (`GroupsPage.tsx`, `GroupDetailPage.tsx`'s "Cambiar tarifa del grupo", y el "Tarifa por defecto" de `RenewGroupsDialog.tsx`), que es el único sitio donde de verdad funcionan.

## Arquitectura

### A. `functions/src/billing/generateMonthlyReceipts.ts`

Sustituir (línea 250):
```ts
const amount = enrollment.customPrice ?? group.defaultTariffPrice;
```
por:
```ts
const billingKey = `${billingYear}-${String(billingMonth).padStart(2, "0")}`;
const baseAmount = freq === "installments" && group.installmentPrices
  ? (group.installmentPrices[billingKey] ?? group.defaultTariffPrice)
  : group.defaultTariffPrice;
const amount = enrollment.customPrice ?? baseAmount;
```
(El bloque anterior, líneas 214-224, ya calcula un `billingKey` equivalente dentro del `if (freq === "installments")` que decide si generar el recibo — ese `const` está limitado a ese bloque; aquí se recalcula la misma cadena, igual que hace `firestoreSync.ts:441` con su propio `billingKey` local. No merece la pena una refactorización mayor para compartir la variable — es una operación trivial y mantiene el archivo consistente con su propio estilo actual.)

Nada más cambia en este archivo. El resto de la lógica (aviso de ciclo incompleto, concepto, batch) sigue igual.

### B. `src/stores/dataStore.ts` + `src/components/shared/RenewGroupsDialog.tsx`

**`dataStore.ts`**: añadir `installmentPrices?: Record<string, number>` al tipo de `groupData` en la firma de `renewGroup` (junto a `billingAnchorMonth?: number`, línea 192):
```ts
      billingFrequency: BillingFrequency
      billingAnchorMonth?: number
      installmentPrices?: Record<string, number>
      startDate: Date
      endDate: Date
```
No hace falta ningún otro cambio en `dataStore.ts` — `newGroup: Group = { ...groupData, ... }` (línea ~1250) ya construye el grupo nuevo por spread, así que el campo se copia automáticamente en cuanto está en `groupData`.

**`RenewGroupsDialog.tsx`**:
- `GroupDraft` gana `installmentPrices?: Record<string, number>`.
- En la construcción inicial del draft (dentro del `useState`), añadir `installmentPrices: g.installmentPrices` — así, si el admin no toca el selector de tarifa, el grupo nuevo conserva el calendario de cuotas del grupo viejo tal cual.
- En el `onChange` del selector "Tarifa por defecto" (línea 192-200), añadir `installmentPrices: tariff?.installmentPrices` al `updateDraft(...)`:
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
- En `handleConfirm`, añadir `installmentPrices: draft.installmentPrices` al objeto `groupData`.

### C. Excluir tarifas de cuotas de los selectores por alumno

**`GroupDetailPage.tsx`** (diálogo "Añadir alumno", línea 727): cambiar
```ts
options={tariffs.filter((t) => t.isActive).map((t) => ({
```
por
```ts
options={tariffs.filter((t) => t.isActive && t.billingFrequency !== 'installments').map((t) => ({
```
No se toca el selector de "Cambiar tarifa del grupo" (`newTariffId`, ~línea 978) — ese es a nivel de grupo y debe seguir permitiendo tarifas de cuotas.

**`MoveEnrollmentDialog.tsx`** (línea 43): cambiar
```ts
const activeTariffs = tariffs.filter(t => t.isActive)
```
por
```ts
const activeTariffs = tariffs.filter(t => t.isActive && t.billingFrequency !== 'installments')
```
(Esta variable solo se usa para el selector de tarifa de la matrícula que se traslada — no hay ningún selector de tarifa de grupo en este diálogo, así que no hace falta una segunda lista.)

**`RenewGroupsDialog.tsx`**: la variable `activeTariffs` (línea 52) se usa en DOS sitios — el selector de grupo ("Tarifa por defecto", que debe seguir incluyendo cuotas) y el selector por alumno (que no debe incluirlas). Añadir una segunda variable derivada:
```ts
const activeTariffs = useMemo(() => tariffs.filter((t) => t.isActive), [tariffs])
const activeIndividualTariffs = useMemo(
  () => activeTariffs.filter((t) => t.billingFrequency !== 'installments'),
  [activeTariffs]
)
```
Y cambiar el `options` del selector por alumno (línea 274) de `activeTariffs.map(...)` a `activeIndividualTariffs.map(...)`. El selector de "Tarifa por defecto" (línea 187) sigue usando `activeTariffs` sin cambios.

## Fuera de alcance

- No se añade ningún mecanismo para que una matrícula individual tenga su propio calendario de cuotas distinto al de su grupo — sería un cambio de modelo de datos mayor (añadir `installmentPrices`/`installmentMonths` a `Enrollment`, y enseñar a los tres generadores de recibos a leerlo), no justificado por ahora.
- No se revisan ni corrigen datos ya existentes en producción (recibos ya generados incorrectamente por el bug A, grupos ya traspasados sin `installmentPrices` por el bug B) — el usuario lo revisará por su cuenta; si encuentra daño real, será una tarea aparte de corrección de datos.
- No se toca `functions/src/billing/generateMonthlyReceipts.ts`'s legado `installmentMonths` (array, distinto de `installmentPrices`) — sigue funcionando igual que hoy para la comprobación de "es este mes de facturación", solo se corrige el cálculo del importe.

## Verificación manual

1. `npm run build`, `npm --prefix functions run build` y `npm test` en verde.
2. **A**: con un grupo de cuotas con `installmentPrices` configurado, generar recibos (vía la función callable/el botón "Generar recibos") para un mes con un importe de cuota específico distinto del precio total de la tarifa — confirmar que el recibo se genera por el importe de ESE mes, no por el total de la tarifa.
3. **B**: traspasar un grupo cuya tarifa es de cuotas a una temporada nueva sin tocar el selector de tarifa — confirmar que el grupo nuevo conserva `installmentPrices` (se puede comprobar generando recibos para ese grupo tras el traspaso, o inspeccionando el documento en Firestore).
4. **C**: en los tres diálogos (alta, traslado, traspaso — tabla de alumnos), confirmar que las tarifas de tipo "Cuotas" ya no aparecen como opción al elegir tarifa para UN alumno. Confirmar que sí siguen apareciendo al crear/editar un grupo (`GroupsPage.tsx`), al "Cambiar tarifa del grupo" (`GroupDetailPage.tsx`), y en el selector "Tarifa por defecto" del traspaso de temporada.
