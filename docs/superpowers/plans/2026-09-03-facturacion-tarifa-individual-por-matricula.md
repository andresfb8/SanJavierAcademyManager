# Facturación por Tarifa Individual de Matrícula Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que los 5 sitios de código que calculan el importe a
facturar (o a mostrar) usen siempre la tarifa individual de la matrícula
(`enrollment.tariffId`), nunca el precio/calendario del grupo, según
`docs/superpowers/specs/2026-09-03-facturacion-tarifa-individual-por-matricula-design.md`.

**Architecture:** Una función pura nueva y testeada,
`resolveEnrollmentAmount`, en `src/lib/billing-utils.ts`, reutilizada por
los 3 sitios de generación del cliente; la misma lógica reflejada (sin
tests, `functions/` no tiene infraestructura de test) en
`functions/src/billing/billing-utils.ts` para la función programada. Dos
arreglos adicionales de visualización que comparten la misma causa.

**Tech Stack:** React 19 + TypeScript, Zustand, Firebase Firestore +
Cloud Functions (Node 18), Vitest.

---

## Task 1: `resolveEnrollmentAmount` en `billing-utils.ts` (cliente + funciones)

**Files:**
- Modify: `src/lib/billing-utils.ts`
- Modify: `src/lib/billing-utils.test.ts`
- Modify: `functions/src/billing/billing-utils.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `src/lib/billing-utils.test.ts`, junto al import existente en
la línea 2 (añadir `resolveEnrollmentAmount`):

```ts
import { cycleLength, remainingMonthsInGroup, stripCycleWarning, buildInstallmentMonthKeys, resolveEnrollmentAmount } from '@/lib/billing-utils'
```

Añadir al final del archivo:

```ts
describe('resolveEnrollmentAmount', () => {
  it('devuelve el precio de la tarifa para frecuencias no-installments', () => {
    expect(resolveEnrollmentAmount({ billingFrequency: 'monthly', tariffPrice: 45 }, '2026-09')).toBe(45)
  })

  it('devuelve el precio del mes concreto para installments', () => {
    expect(resolveEnrollmentAmount(
      { billingFrequency: 'installments', tariffInstallmentPrices: { '2026-09': 90 } },
      '2026-09'
    )).toBe(90)
  })

  it('devuelve null si installments no tiene precio para ese mes', () => {
    expect(resolveEnrollmentAmount(
      { billingFrequency: 'installments', tariffInstallmentPrices: { '2026-11': 120 } },
      '2026-09'
    )).toBeNull()
  })

  it('devuelve null si una frecuencia no-installments no tiene tariffPrice', () => {
    expect(resolveEnrollmentAmount({ billingFrequency: 'monthly' }, '2026-09')).toBeNull()
  })

  it('customPrice gana siempre, incluso sobre installments', () => {
    expect(resolveEnrollmentAmount(
      { billingFrequency: 'installments', customPrice: 70, tariffInstallmentPrices: { '2026-09': 90 } },
      '2026-09'
    )).toBe(70)
  })

  it('customPrice de 0 tambien gana (no se trata como falsy)', () => {
    expect(resolveEnrollmentAmount(
      { billingFrequency: 'monthly', customPrice: 0, tariffPrice: 45 },
      '2026-09'
    )).toBe(0)
  })
})
```

- [ ] **Step 2: Ejecutar los tests y verificar que fallan**

Run: `npm test -- billing-utils`
Expected: FAIL — `resolveEnrollmentAmount is not a function`.

- [ ] **Step 3: Implementar `resolveEnrollmentAmount` en `src/lib/billing-utils.ts`**

Añadir al final del archivo:

```ts
export interface EnrollmentAmountInput {
  billingFrequency: BillingFrequency
  customPrice?: number
  tariffPrice?: number
  tariffInstallmentPrices?: Record<string, number>
}

/**
 * Importe a facturar a una matricula para `billingKey` ("YYYY-MM"),
 * resuelto siempre a partir de SU PROPIA tarifa (nunca la del grupo).
 * `null` significa "no se puede facturar este mes" (tarifa de cuotas sin
 * precio para ese mes, o tarifa sin precio base en el resto de
 * frecuencias) — el caller debe saltar la matricula, no caer de vuelta a
 * ningun precio de grupo (ese era exactamente el bug que esta funcion
 * sustituye: usar group.defaultTariffPrice/installmentPrices en vez de
 * la tarifa individual de cada matricula).
 */
export function resolveEnrollmentAmount(
  input: EnrollmentAmountInput,
  billingKey: string
): number | null {
  if (input.customPrice !== undefined) return input.customPrice
  if (input.billingFrequency === 'installments') {
    return input.tariffInstallmentPrices?.[billingKey] ?? null
  }
  return input.tariffPrice ?? null
}
```

- [ ] **Step 4: Ejecutar los tests y verificar que pasan**

Run: `npm test -- billing-utils`
Expected: PASS — los 6 tests nuevos, más los ya existentes en el archivo.

- [ ] **Step 5: Reflejar la función en `functions/src/billing/billing-utils.ts`**

Añadir al final del archivo (no lleva tests — `functions/` no tiene
infraestructura de test hoy, y esta guía no la añade solo para esto):

```ts
export interface EnrollmentAmountInput {
  billingFrequency: BillingFrequency;
  customPrice?: number;
  tariffPrice?: number;
  tariffInstallmentPrices?: Record<string, number>;
}

/**
 * Importe a facturar a una matricula para `billingKey` ("YYYY-MM").
 * Espejo exacto de resolveEnrollmentAmount en src/lib/billing-utils.ts
 * (esa version SI tiene tests) — mantener ambas sincronizadas si se
 * cambia una.
 */
export function resolveEnrollmentAmount(
  input: EnrollmentAmountInput,
  billingKey: string,
): number | null {
  if (input.customPrice !== undefined) return input.customPrice;
  if (input.billingFrequency === "installments") {
    return input.tariffInstallmentPrices?.[billingKey] ?? null;
  }
  return input.tariffPrice ?? null;
}
```

- [ ] **Step 6: Verificar que compila (cliente y funciones)**

Run: `npm run build`
Expected: sin errores.

Run: `npm --prefix functions run build`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/lib/billing-utils.ts src/lib/billing-utils.test.ts functions/src/billing/billing-utils.ts
git commit -m "feat: anadir resolveEnrollmentAmount, la tarifa de la matricula manda sobre la del grupo"
```

---

## Task 2: `src/lib/firestoreSync.ts` — `generateMonthlyReceiptsAtomic`

**Files:**
- Modify: `src/lib/firestoreSync.ts`

- [ ] **Step 1: Añadir el import de `resolveEnrollmentAmount`**

En `src/lib/firestoreSync.ts`, línea 27, cambiar:

```ts
import { isBillingMonth, remainingMonthsInGroup, cycleLength, billingFrequencyLabel } from './billing-utils'
```

por:

```ts
import { isBillingMonth, remainingMonthsInGroup, cycleLength, billingFrequencyLabel, resolveEnrollmentAmount } from './billing-utils'
```

- [ ] **Step 2: Cargar un `tariffsMap` junto al `groupsMap`**

Localizar el bloque que carga `groupsMap` (líneas 364-378):

```ts
    // Pre-cargar grupos para obtener precio y frecuencia de facturación
    const groupsSnap = await getDocs(
      query(collection(db, 'groups'), where('clubId', '==', clubId))
    )
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

Añadir justo después:

```ts
    // Pre-cargar tarifas: la tarifa de la matricula manda siempre sobre
    // el precio del grupo (ver resolveEnrollmentAmount en billing-utils.ts).
    // No se filtra por isActive: una matricula antigua debe poder seguir
    // resolviendo su tarifa aunque ya no este disponible para altas nuevas.
    const tariffsSnap = await getDocs(
      query(collection(db, 'tariffs'), where('clubId', '==', clubId))
    )
    const tariffsMap = new Map<string, { price: number; installmentPrices?: Record<string, number> }>()
    for (const tariffDoc of tariffsSnap.docs) {
      const t = tariffDoc.data()
      tariffsMap.set(tariffDoc.id, {
        price: t.price ?? 0,
        installmentPrices: t.installmentPrices,
      })
    }
```

- [ ] **Step 3: Sustituir la comprobación de mes y el cálculo de importe por `resolveEnrollmentAmount`**

Localizar el bloque completo (líneas 388-446, dentro del `for (const
enrollDoc of enrollmentsSnap.docs)`):

```ts
    for (const enrollDoc of enrollmentsSnap.docs) {
      const enrollment = enrollDoc.data()

      // Obtener datos del grupo para precio y frecuencia
      const group = groupsMap.get(enrollment.groupId)
      if (!group) {
        console.warn(`[generateReceipts] Group ${enrollment.groupId} not found for enrollment ${enrollDoc.id}, skipping`)
        continue
      }

      // Respetar frecuencia de facturación por matrícula (con fallback al grupo para matrículas antiguas)
      const freq = enrollment.billingFrequency ?? group.billingFrequency
      const anchor = enrollment.billingAnchorMonth ?? (
        group.startDate instanceof Date
          ? group.startDate.getMonth() + 1
          : new Date((group.startDate as any).toDate?.() ?? group.startDate).getMonth() + 1
      )

      if (!isBillingMonth(freq, anchor, month)) {
        continue
      }

      // For installments: additionally verify the specific month exists in the group's price map
      if (freq === 'installments') {
        const billingKey = `${year}-${String(month).padStart(2, '0')}`
        if (!group.installmentPrices || !group.installmentPrices[billingKey]) {
          continue
        }
      }

      // Verificación server-side de duplicado
      const existingPayment = await getDocs(
        query(
          collection(db, 'payments'),
          where('clubId', '==', clubId),
          where('enrollmentId', '==', enrollDoc.id),
          where('billingMonth', '==', month),
          where('billingYear', '==', year),
          limit(1)
        )
      )

      if (!existingPayment.empty) {
        console.info(`[generateReceipts] Payment already exists for enrollment ${enrollDoc.id}`)
        continue // Ya existe
      }

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
```

Sustituir por:

```ts
    for (const enrollDoc of enrollmentsSnap.docs) {
      const enrollment = enrollDoc.data()

      // Obtener datos del grupo para frecuencia de fallback y fin de ciclo
      const group = groupsMap.get(enrollment.groupId)
      if (!group) {
        console.warn(`[generateReceipts] Group ${enrollment.groupId} not found for enrollment ${enrollDoc.id}, skipping`)
        continue
      }

      // La tarifa de la matricula manda siempre sobre la del grupo.
      const tariff = tariffsMap.get(enrollment.tariffId)
      if (!tariff) {
        console.warn(`[generateReceipts] Tariff ${enrollment.tariffId} not found for enrollment ${enrollDoc.id}, skipping`)
        continue
      }

      // Respetar frecuencia de facturación por matrícula (con fallback al grupo para matrículas antiguas)
      const freq = enrollment.billingFrequency ?? group.billingFrequency
      const anchor = enrollment.billingAnchorMonth ?? (
        group.startDate instanceof Date
          ? group.startDate.getMonth() + 1
          : new Date((group.startDate as any).toDate?.() ?? group.startDate).getMonth() + 1
      )

      if (!isBillingMonth(freq, anchor, month)) {
        continue
      }

      const billingKey = `${year}-${String(month).padStart(2, '0')}`
      const amount = resolveEnrollmentAmount(
        {
          billingFrequency: freq,
          customPrice: enrollment.customPrice,
          tariffPrice: tariff.price,
          tariffInstallmentPrices: tariff.installmentPrices,
        },
        billingKey
      )
      if (amount === null) {
        continue
      }

      // Verificación server-side de duplicado
      const existingPayment = await getDocs(
        query(
          collection(db, 'payments'),
          where('clubId', '==', clubId),
          where('enrollmentId', '==', enrollDoc.id),
          where('billingMonth', '==', month),
          where('billingYear', '==', year),
          limit(1)
        )
      )

      if (!existingPayment.empty) {
        console.info(`[generateReceipts] Payment already exists for enrollment ${enrollDoc.id}`)
        continue // Ya existe
      }
```

(el resto de la función — creación del `payment`, aviso de ciclo
incompleto, batch commit — sigue usando la variable `amount` ya
calculada, sin cambios).

- [ ] **Step 4: Verificar que compila**

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 5: Verificar que los tests existentes siguen pasando**

Run: `npm test`
Expected: PASS — esta función no tiene tests directos (depende de
Firestore en vivo), pero no debe romper nada del resto de la suite.

- [ ] **Step 6: Commit**

```bash
git add src/lib/firestoreSync.ts
git commit -m "fix: generar recibos con la tarifa de la matricula, no la del grupo (cliente)"
```

---

## Task 3: `functions/src/billing/generateMonthlyReceipts.ts`

**Files:**
- Modify: `functions/src/billing/generateMonthlyReceipts.ts`

- [ ] **Step 1: Añadir el import y la interfaz `Tariff`**

En la línea 5, cambiar:

```ts
import { isBillingMonth, cycleLength, remainingMonthsInGroup, billingFrequencyLabel } from "./billing-utils";
```

por:

```ts
import { isBillingMonth, cycleLength, remainingMonthsInGroup, billingFrequencyLabel, resolveEnrollmentAmount } from "./billing-utils";
```

Añadir, junto a la interfaz `Group` existente (línea 44-55):

```ts
interface Tariff {
  id: string;
  price: number;
  installmentPrices?: Record<string, number>;
}
```

- [ ] **Step 2: Cargar un `tariffsMap` en `processClub`**

Localizar (línea 138-143):

```ts
  // Pre-fetch all groups for this club into a map for fast lookup
  const groupsSnap = await db.collection("groups").where("clubId", "==", clubId).get();
  const groupsMap = new Map<string, Group>();
  for (const doc of groupsSnap.docs) {
    groupsMap.set(doc.id, { id: doc.id, ...doc.data() } as Group);
  }
```

Añadir justo después:

```ts
  // Pre-fetch all tariffs: la tarifa de la matricula manda siempre sobre
  // el precio del grupo (ver resolveEnrollmentAmount en billing-utils.ts).
  // No se filtra por isActive: una matricula antigua debe poder seguir
  // resolviendo su tarifa aunque ya no este disponible para altas nuevas.
  const tariffsSnap = await db.collection("tariffs").where("clubId", "==", clubId).get();
  const tariffsMap = new Map<string, Tariff>();
  for (const doc of tariffsSnap.docs) {
    tariffsMap.set(doc.id, { id: doc.id, ...doc.data() } as Tariff);
  }
```

- [ ] **Step 3: Resolver la tarifa de la matrícula y sustituir la comprobación de mes/cálculo de importe**

Localizar, dentro del `for (const enrollDoc of enrollmentsSnap.docs)`,
justo después del bloque `if (!group) { ... skipped++; continue; }`
(línea 169-177) y antes de `// Skip inactive groups` (línea 179):

Insertar ahí:

```ts
    // La tarifa de la matricula manda siempre sobre la del grupo.
    const tariff = tariffsMap.get(enrollment.tariffId);
    if (!tariff) {
      logger.warn(
        `Club ${clubId}: tariff ${enrollment.tariffId} not found ` +
        `for enrollment ${enrollment.id}, skipping.`,
      );
      skipped++;
      continue;
    }
```

Luego, localizar el bloque de comprobación de installments (líneas
214-224):

```ts
    // For installments: verify the specific month is configured
    if (freq === "installments") {
      // Support both legacy installmentMonths (number[]) and installmentPrices (Record<YYYY-MM, number>)
      const billingKey = `${billingYear}-${String(billingMonth).padStart(2, "0")}`;
      const inPrices = group.installmentPrices?.[billingKey] !== undefined;
      const inMonths = (group.installmentMonths ?? []).includes(billingMonth);
      if (!inPrices && !inMonths) {
        skipped++;
        continue;
      }
    }
```

y el bloque de cálculo de importe (líneas 244-257):

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

Sustituir AMBOS bloques anteriores por uno solo (colocarlo donde estaba
el primero de los dos, es decir donde estaba la comprobación de
installments; borrar por completo el bloque de "Calculate amount"
posterior salvo la línea `let concept = ...`, que se mantiene):

```ts
    // Resolver el importe a partir de LA TARIFA DE LA MATRICULA (nunca la
    // del grupo) — ver resolveEnrollmentAmount en billing-utils.ts. null
    // significa que esta matricula no se puede facturar este mes (p.ej.
    // cuotas sin precio configurado para este mes en su propia tarifa).
    const billingKey = `${billingYear}-${String(billingMonth).padStart(2, "0")}`;
    const amount = resolveEnrollmentAmount(
      {
        billingFrequency: freq,
        customPrice: enrollment.customPrice,
        tariffPrice: tariff.price,
        tariffInstallmentPrices: tariff.installmentPrices,
      },
      billingKey,
    );
    if (amount === null) {
      skipped++;
      continue;
    }

    // -----------------------------------------------------------------------
    // Calculate concept
    // -----------------------------------------------------------------------
    let concept = `Cuota ${monthName} ${billingYear} - ${group.name}`;
```

(el resto del cuerpo del bucle — aviso de ciclo incompleto,
`batch.set(...)`, commits — sigue usando `amount`/`concept` sin cambios;
`group.installmentMonths`/legacy ya no se usa en ningún sitio de este
archivo tras este cambio — puede quedar en la interfaz `Group` sin
usarse, no hace falta borrarla, es un campo legacy documentado como tal).

- [ ] **Step 4: Verificar que compila**

Run: `npm --prefix functions run build`
Expected: sin errores. Si TypeScript avisa de `group.installmentMonths`
ahora sin uso en este archivo, es solo una interfaz de datos (no una
variable local) y no debería generar error — confirmar que el build
pasa igualmente.

- [ ] **Step 5: Commit**

```bash
git add functions/src/billing/generateMonthlyReceipts.ts
git commit -m "fix: generar recibos con la tarifa de la matricula, no la del grupo (funcion programada)"
```

---

## Task 4: `generateScheduledInstallments` (dataStore) y `ungeneratedInstallments` (PlayerProfilePage)

**Files:**
- Modify: `src/stores/dataStore.ts`
- Modify: `src/pages/PlayerProfilePage.tsx`

- [ ] **Step 1: Arreglar `generateScheduledInstallments` en `dataStore.ts`**

Localizar (líneas 1607-1625):

```ts
      generateScheduledInstallments: (enrollmentId) => {
        const state = get()
        const enrollment = state.enrollments.find((e) => e.id === enrollmentId)
        if (!enrollment) return 0
        const group = state.groups.find((g) => g.id === enrollment.groupId)
        if (!group || group.billingFrequency !== 'installments' || !group.installmentPrices) return 0

        const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
        const { userName } = getCurrentUser()

        // Meses que ya tienen recibo para esta matrícula
        const existingKeys = new Set(
          state.payments
            .filter((p) => p.enrollmentId === enrollmentId)
            .map((p) => `${p.billingYear}-${String(p.billingMonth).padStart(2, '0')}`)
        )

        let created = 0
        Object.entries(group.installmentPrices)
```

Sustituir por:

```ts
      generateScheduledInstallments: (enrollmentId) => {
        const state = get()
        const enrollment = state.enrollments.find((e) => e.id === enrollmentId)
        if (!enrollment) return 0
        const group = state.groups.find((g) => g.id === enrollment.groupId)
        if (!group) return 0
        const freq = enrollment.billingFrequency ?? group.billingFrequency
        if (freq !== 'installments') return 0
        // La tarifa de la matricula manda siempre sobre la del grupo.
        const tariff = state.tariffs.find((t) => t.id === enrollment.tariffId)
        if (!tariff || !tariff.installmentPrices) return 0

        const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
        const { userName } = getCurrentUser()

        // Meses que ya tienen recibo para esta matrícula
        const existingKeys = new Set(
          state.payments
            .filter((p) => p.enrollmentId === enrollmentId)
            .map((p) => `${p.billingYear}-${String(p.billingMonth).padStart(2, '0')}`)
        )

        let created = 0
        Object.entries(tariff.installmentPrices)
```

(el resto de la función — `.sort(...)`, `.forEach(...)`, creación del
pago con `amount: enrollment.customPrice ?? amount` — no cambia; ya
usaba correctamente `customPrice` con prioridad, solo iteraba la fuente
equivocada).

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 3: Añadir `tariffs` a `useDataStore()` en `PlayerProfilePage.tsx`**

Localizar (líneas 82-94):

```ts
  const {
    players,
    enrollments,
    groups,
    updatePlayer,
    invitePlayer,
    payments: allBasePayments,
    attendance,
    evaluations,
    generateScheduledInstallments,
    users,
    invitations,
  } = useDataStore()
```

Añadir `tariffs,` (por ejemplo justo después de `groups,`):

```ts
  const {
    players,
    enrollments,
    groups,
    tariffs,
    updatePlayer,
    invitePlayer,
    payments: allBasePayments,
    attendance,
    evaluations,
    generateScheduledInstallments,
    users,
    invitations,
  } = useDataStore()
```

- [ ] **Step 4: Arreglar `ungeneratedInstallments`**

Localizar (líneas 142-170):

```ts
  const ungeneratedInstallments = useMemo(() => {
    if (!player) return []
    const result: { enrollmentId: string; groupName: string; key: string; year: number; month: number; amount: number }[] = []
    const existingKeys = new Set(
      allBasePayments
        .filter((p) => p.playerId === player.id)
        .map((p) => `${p.enrollmentId}__${p.billingYear}-${String(p.billingMonth).padStart(2, '0')}`)
    )
    for (const enrollment of activeEnrollments) {
      const group = groups.find((g) => g.id === enrollment.groupId)
      if (!group || group.billingFrequency !== 'installments' || !group.installmentPrices) continue
      Object.entries(group.installmentPrices)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([key, amount]) => {
          const lookupKey = `${enrollment.id}__${key}`
          if (existingKeys.has(lookupKey)) return
          const [yearStr, monthStr] = key.split('-')
          result.push({
            enrollmentId: enrollment.id,
            groupName: enrollment.groupName,
            key,
            year: parseInt(yearStr),
            month: parseInt(monthStr),
            amount: enrollment.customPrice ?? amount,
          })
        })
    }
    return result
  }, [player, allBasePayments, activeEnrollments, groups])
```

Sustituir por:

```ts
  const ungeneratedInstallments = useMemo(() => {
    if (!player) return []
    const result: { enrollmentId: string; groupName: string; key: string; year: number; month: number; amount: number }[] = []
    const existingKeys = new Set(
      allBasePayments
        .filter((p) => p.playerId === player.id)
        .map((p) => `${p.enrollmentId}__${p.billingYear}-${String(p.billingMonth).padStart(2, '0')}`)
    )
    for (const enrollment of activeEnrollments) {
      const group = groups.find((g) => g.id === enrollment.groupId)
      if (!group) continue
      const freq = enrollment.billingFrequency ?? group.billingFrequency
      if (freq !== 'installments') continue
      // La tarifa de la matricula manda siempre sobre la del grupo.
      const tariff = tariffs.find((t) => t.id === enrollment.tariffId)
      if (!tariff || !tariff.installmentPrices) continue
      Object.entries(tariff.installmentPrices)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([key, amount]) => {
          const lookupKey = `${enrollment.id}__${key}`
          if (existingKeys.has(lookupKey)) return
          const [yearStr, monthStr] = key.split('-')
          result.push({
            enrollmentId: enrollment.id,
            groupName: enrollment.groupName,
            key,
            year: parseInt(yearStr),
            month: parseInt(monthStr),
            amount: enrollment.customPrice ?? amount,
          })
        })
    }
    return result
  }, [player, allBasePayments, activeEnrollments, groups, tariffs])
```

- [ ] **Step 5: Verificar que compila**

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 6: Verificar que los tests existentes siguen pasando**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/stores/dataStore.ts src/pages/PlayerProfilePage.tsx
git commit -m "fix: generar cuotas sueltas con la tarifa de la matricula, no la del grupo"
```

---

## Task 5: Arreglos de visualización (columna "Precio")

**Files:**
- Modify: `src/pages/GroupDetailPage.tsx`
- Modify: `src/pages/PlayerProfilePage.tsx`

- [ ] **Step 1: Arreglar la columna "Precio" de la tabla de matrículas**

(el import existente de `billingFrequencyLabel` en la línea 25 de
`GroupDetailPage.tsx` no necesita cambiar — este arreglo no usa
`resolveEnrollmentAmount`, solo reordena qué precio mostrar en JSX)

Localizar (líneas 540-579):

```tsx
                        {groupEnrollments.map((enrollment) => {
                          const player = players.find((p) => p.id === enrollment.playerId)
                          const price = enrollment.customPrice ?? group.defaultTariffPrice
                          return (
```

y, más abajo en el mismo bloque:

```tsx
                              <td className="p-3 hidden lg:table-cell">
                                <span className="text-sm text-muted-foreground">
                                  {billingFrequencyLabel(enrollment.billingFrequency ?? group.billingFrequency)}
                                </span>
                              </td>
                              <td className="p-3 hidden sm:table-cell">
                                <span className="text-sm font-medium">
                                  {formatCurrency(price)}
                                </span>
                                {enrollment.customPrice !== undefined && (
                                  <span className="ml-1.5 text-xs text-muted-foreground">(personalizado)</span>
                                )}
                              </td>
```

Sustituir el primer fragmento por:

```tsx
                        {groupEnrollments.map((enrollment) => {
                          const player = players.find((p) => p.id === enrollment.playerId)
                          const freq = enrollment.billingFrequency ?? group.billingFrequency
                          const enrollmentTariff = tariffs.find((t) => t.id === enrollment.tariffId)
                          // Solo se usa cuando NO hay customPrice y la frecuencia no es
                          // cuotas (para cuotas el importe varia mes a mes, ver mas abajo).
                          const price = enrollmentTariff?.price ?? group.defaultTariffPrice
                          return (
```

y el segundo fragmento por:

```tsx
                              <td className="p-3 hidden lg:table-cell">
                                <span className="text-sm text-muted-foreground">
                                  {billingFrequencyLabel(freq)}
                                </span>
                              </td>
                              <td className="p-3 hidden sm:table-cell">
                                {enrollment.customPrice !== undefined ? (
                                  <>
                                    <span className="text-sm font-medium">
                                      {formatCurrency(enrollment.customPrice)}
                                    </span>
                                    <span className="ml-1.5 text-xs text-muted-foreground">(personalizado)</span>
                                  </>
                                ) : freq === 'installments' ? (
                                  <span className="text-sm text-muted-foreground">Según cuotas</span>
                                ) : (
                                  <span className="text-sm font-medium">
                                    {formatCurrency(price)}
                                  </span>
                                )}
                              </td>
```

- [ ] **Step 2: Arreglar el precio en la pestaña "Grupos" de `PlayerProfilePage.tsx`**

Localizar (línea 838-840):

```tsx
                    {playerEnrollments.map((enrollment) => {
                      const group = groups.find((g) => g.id === enrollment.groupId)
                      const price = enrollment.customPrice ?? group?.defaultTariffPrice ?? 0
```

Sustituir por:

```tsx
                    {playerEnrollments.map((enrollment) => {
                      const group = groups.find((g) => g.id === enrollment.groupId)
                      const enrollmentTariff = tariffs.find((t) => t.id === enrollment.tariffId)
                      const price = enrollment.customPrice ?? enrollmentTariff?.price ?? group?.defaultTariffPrice ?? 0
```

(`tariffs` ya está disponible en este archivo desde el Task 4, Step 3 —
no hace falta añadirlo de nuevo).

- [ ] **Step 3: Verificar que compila**

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 4: Verificar que los tests existentes siguen pasando**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/GroupDetailPage.tsx src/pages/PlayerProfilePage.tsx
git commit -m "fix: mostrar el precio de la tarifa individual de cada matricula, no la del grupo"
```

---

## Verificación final (fuera de los tasks, antes de desplegar)

Estos pasos los ejecuta la sesión orquestadora tras completar las 5
tareas, no un subagente — implican datos reales de `main` y una
decisión de despliegue que requiere confirmación explícita del usuario:

1. Verificación en vivo (Playwright, sin escribir nada): abrir la ficha
   de "Escuela Menores 4" y confirmar que la columna "Precio" de sus 4
   matrículas ya no depende de `group.defaultTariffPrice` (debe mostrar
   "Según cuotas" para las de tipo Plazos).
2. Preguntar al usuario si se despliega (`firebase deploy --only
   hosting,functions`) antes de tocar producción — el fix de
   `firestoreSync.ts` solo tiene efecto tras desplegar hosting, y el de
   `generateMonthlyReceipts.ts` solo tras desplegar functions.
3. Tras desplegar (si el usuario lo confirma), pulsar "Generar cuotas"
   para septiembre 2026 y confirmar que esta vez sí genera recibos para
   los alumnos que antes se saltaba, con el importe de su propia tarifa
   (90€ para Escuela Menores Federada/Cuota Interescuelas en
   septiembre).
4. Recordar al usuario revisar los pagos manuales de "Cuota parcial" ya
   existentes (p. ej. Jairo Aguilar García, 370€) por si la generación
   automática les crea ahora un recibo duplicado de septiembre.
