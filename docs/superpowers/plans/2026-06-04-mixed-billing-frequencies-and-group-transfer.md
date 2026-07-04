# Mixed Billing Frequencies + Group Transfer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow students in the same group to have monthly, quarterly, or annual billing frequencies, and let admins move students between groups atomically without duplicating payments.

**Architecture:** Billing frequency moves from Group-level to Enrollment-level. A new pure `isBillingMonth()` helper determines whether to generate a payment for a given enrollment in a given month. The move-enrollment action wraps old-enrollment deactivation + new-enrollment creation in a single Firestore transaction. Backward compatibility is handled by falling back to `group.billingFrequency` for enrollments that predate this change.

**Tech Stack:** React 19 + TypeScript, Zustand, Firebase Firestore (client SDK + Admin SDK), Firebase Cloud Functions v2, Tailwind CSS v4, Lucide React icons, shadcn/ui components.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/types/index.ts` | Modify | Expand `BillingFrequency` union; add fields to `Enrollment` |
| `src/constants/index.ts` | Modify | Add quarterly + annual to `BILLING_FREQUENCIES` |
| `src/lib/billing-utils.ts` | **Create** | Pure `isBillingMonth()` helper (frontend) |
| `functions/src/billing/billing-utils.ts` | **Create** | Same pure helper (Cloud Functions) |
| `src/lib/firestoreSync.ts` | Modify | Update billing check; add `moveEnrollmentAtomic` |
| `src/stores/dataStore.ts` | Modify | Update `addEnrollment` defaults; add `moveEnrollment` action |
| `functions/src/billing/generateMonthlyReceipts.ts` | Modify | Update `Enrollment`+`Group` interfaces; use enrollment billing freq |
| `src/pages/GroupDetailPage.tsx` | Modify | Frequency column; frequency picker in add-player dialog; move button |
| `src/components/shared/MoveEnrollmentDialog.tsx` | **Create** | 2-step move-student dialog |

---

### Task 1: Expand types and constants

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/constants/index.ts`

- [ ] **Step 1: Expand `BillingFrequency` and add fields to `Enrollment`**

In `src/types/index.ts`, line 67, change:
```typescript
export type BillingFrequency = 'monthly' | 'installments'
```
to:
```typescript
export type BillingFrequency = 'monthly' | 'quarterly' | 'annual' | 'installments'
```

In the same file, after line 231 (`customPrice?: number`), add two new optional fields to `Enrollment`:
```typescript
export interface Enrollment {
  id: string
  playerId: string
  playerName: string
  groupId: string
  groupName: string
  tariffId: string
  tariffName: string
  customPrice?: number
  billingFrequency?: BillingFrequency   // per-enrollment; falls back to group.billingFrequency if absent
  billingAnchorMonth?: number           // 1-12; required when billingFrequency is 'quarterly' or 'annual'
  enrollmentDate: Date
  unenrollmentDate?: Date
  isActive: boolean
}
```

- [ ] **Step 2: Add quarterly and annual to BILLING_FREQUENCIES**

In `src/constants/index.ts`, lines 93-96, change:
```typescript
export const BILLING_FREQUENCIES: { value: BillingFrequency; label: string }[] = [
  { value: 'monthly', label: 'Mensual' },
  { value: 'installments', label: 'Por plazos' },
]
```
to:
```typescript
export const BILLING_FREQUENCIES: { value: BillingFrequency; label: string }[] = [
  { value: 'monthly',      label: 'Mensual' },
  { value: 'quarterly',    label: 'Trimestral' },
  { value: 'annual',       label: 'Anual' },
  { value: 'installments', label: 'Por plazos' },
]
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```
Expected: no TypeScript errors, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/constants/index.ts
git commit -m "feat: expand BillingFrequency with quarterly and annual; add billing fields to Enrollment"
```

---

### Task 2: Create `isBillingMonth` helper

**Files:**
- Create: `src/lib/billing-utils.ts`
- Create: `functions/src/billing/billing-utils.ts`

- [ ] **Step 1: Create frontend helper**

Create `src/lib/billing-utils.ts`:

```typescript
import type { BillingFrequency } from '@/types'

/**
 * Returns true if billingMonth is a payment month for the given frequency/anchor.
 *
 * - monthly: always true
 * - quarterly: true when (billingMonth - anchorMonth) mod 3 === 0  (mod 12 arithmetic)
 *   Example: anchorMonth=9 → payment months: 9, 12, 3, 6
 * - annual: true only when billingMonth === anchorMonth
 * - installments: always returns true — caller must additionally check
 *   group.installmentPrices[YYYY-MM] exists and is > 0
 */
export function isBillingMonth(
  frequency: BillingFrequency,
  anchorMonth: number,   // 1-12
  billingMonth: number,  // 1-12
): boolean {
  switch (frequency) {
    case 'monthly':
      return true
    case 'quarterly':
      return ((billingMonth - anchorMonth + 12) % 12) % 3 === 0
    case 'annual':
      return billingMonth === anchorMonth
    case 'installments':
      return true
  }
}

/** Short display label for a billing frequency. */
export function billingFrequencyLabel(freq: BillingFrequency): string {
  switch (freq) {
    case 'monthly':      return 'Mensual'
    case 'quarterly':    return 'Trimestral'
    case 'annual':       return 'Anual'
    case 'installments': return 'Plazos'
  }
}
```

- [ ] **Step 2: Create Cloud Functions helper (identical logic, no frontend imports)**

Create `functions/src/billing/billing-utils.ts`:

```typescript
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
```

- [ ] **Step 3: Verify builds**

```bash
npm run build
npm --prefix functions run build
```
Expected: both succeed with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/billing-utils.ts functions/src/billing/billing-utils.ts
git commit -m "feat: add isBillingMonth helper for quarterly/annual billing logic"
```

---

### Task 3: Update client-side payment generation (`firestoreSync.ts`)

**Files:**
- Modify: `src/lib/firestoreSync.ts`

- [ ] **Step 1: Import the new helper**

At the top of `src/lib/firestoreSync.ts`, add to the existing imports:
```typescript
import { isBillingMonth } from './billing-utils'
```

- [ ] **Step 2: Replace the billing frequency check block**

Find this block in `src/lib/firestoreSync.ts` (around lines 395-401):
```typescript
      // Respetar frecuencia de facturación: si es por plazos, solo generar en los meses configurados
      if (group.billingFrequency === 'installments') {
        const billingKey = `${year}-${String(month).padStart(2, '0')}`
        if (!group.installmentPrices || !group.installmentPrices[billingKey]) {
          continue // Este mes-año no es un plazo de este grupo
        }
      }
```

Replace it with:
```typescript
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
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```
Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/firestoreSync.ts
git commit -m "feat: read billing frequency from enrollment in client-side payment generation"
```

---

### Task 4: Update Cloud Function payment generation

**Files:**
- Modify: `functions/src/billing/generateMonthlyReceipts.ts`

- [ ] **Step 1: Update imports and local interfaces**

At the top of `functions/src/billing/generateMonthlyReceipts.ts`, add import after the existing imports:
```typescript
import { isBillingMonth } from "./billing-utils";
```

Update the local `Enrollment` interface (around lines 27-39) to:
```typescript
interface Enrollment {
  id: string;
  playerId: string;
  playerName: string;
  groupId: string;
  groupName: string;
  tariffId: string;
  tariffName: string;
  customPrice?: number;
  billingFrequency?: "monthly" | "quarterly" | "annual" | "installments";
  billingAnchorMonth?: number;
  enrollmentDate: Timestamp;
  unenrollmentDate?: Timestamp;
  isActive: boolean;
}
```

Update the local `Group` interface (around lines 41-49) to:
```typescript
interface Group {
  id: string;
  name: string;
  defaultTariffId: string;
  defaultTariffPrice: number;
  billingFrequency: "monthly" | "quarterly" | "annual" | "installments";
  installmentMonths?: number[];
  installmentPrices?: Record<string, number>;
  startDate?: Timestamp;
  isActive: boolean;
}
```

- [ ] **Step 2: Replace the billing frequency check block**

Find this block in `processClub` (around lines 176-183):
```typescript
    // -----------------------------------------------------------------------
    // Billing frequency check
    // -----------------------------------------------------------------------
    if (group.billingFrequency === "installments") {
      const installmentMonths = group.installmentMonths ?? [];
      if (!installmentMonths.includes(billingMonth)) {
        // Current month is not an installment month for this group
        skipped++;
        continue;
      }
    }
    // If "monthly", always generate.
```

Replace with:
```typescript
    // -----------------------------------------------------------------------
    // Billing frequency check — reads from enrollment, falls back to group
    // -----------------------------------------------------------------------
    const freq = enrollment.billingFrequency ?? group.billingFrequency;
    const anchor = enrollment.billingAnchorMonth ?? (
      group.startDate
        ? group.startDate.toDate().getMonth() + 1
        : 9  // fallback: September (typical season start)
    );

    if (!isBillingMonth(freq, anchor, billingMonth)) {
      skipped++;
      continue;
    }

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

- [ ] **Step 3: Verify functions build**

```bash
npm --prefix functions run build
```
Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add functions/src/billing/generateMonthlyReceipts.ts
git commit -m "feat: read billing frequency from enrollment in Cloud Function payment generation"
```

---

### Task 5: Update `addEnrollment` in dataStore

**Files:**
- Modify: `src/stores/dataStore.ts`

- [ ] **Step 1: Add `billingFrequency` default in `addEnrollment`**

Find this line in `addEnrollment` (around line 772):
```typescript
        const newEnrollment: Enrollment = { ...enrollmentData, id: generateId() }
```

Change to:
```typescript
        const newEnrollment: Enrollment = {
          billingFrequency: 'monthly',  // default for backward compat
          ...enrollmentData,
          id: generateId(),
        }
```

- [ ] **Step 2: Add `moveEnrollment` to the `DataState` interface**

Find the `DataState` interface in `src/stores/dataStore.ts`. Locate where `addEnrollment` is declared and add after it (or near other enrollment actions):
```typescript
  moveEnrollment: (
    currentEnrollmentId: string,
    destinationGroupId: string,
    newEnrollmentData: Pick<Enrollment, 'tariffId' | 'tariffName' | 'customPrice' | 'billingFrequency' | 'billingAnchorMonth' | 'playerId' | 'playerName'>
  ) => Promise<void>
```

- [ ] **Step 3: Implement `moveEnrollment` in the store**

Find the `addEnrollment` implementation block and after the closing of that action (after the `generatePartialReceipt` action or nearby), add the following implementation. Place it alongside other enrollment-related actions:

```typescript
      moveEnrollment: async (currentEnrollmentId, destinationGroupId, newEnrollmentData) => {
        const clubId = getClubId()
        if (!clubId) throw new Error('No clubId found')

        const currentEnrollment = get().enrollments.find(e => e.id === currentEnrollmentId)
        if (!currentEnrollment) throw new Error('Inscripción no encontrada')

        const destinationGroup = get().groups.find(g => g.id === destinationGroupId)
        if (!destinationGroup) throw new Error('Grupo destino no encontrado')

        const newEnrollmentId = generateId()
        const now = new Date()

        try {
          await moveEnrollmentAtomic(
            currentEnrollmentId,
            currentEnrollment.groupId,
            newEnrollmentId,
            {
              ...newEnrollmentData,
              groupId: destinationGroupId,
              groupName: destinationGroup.name,
              enrollmentDate: now,
              isActive: true,
              billingFrequency: newEnrollmentData.billingFrequency ?? 'monthly',
            },
            destinationGroupId,
            clubId
          )

          // Update local state optimistically
          set((state) => ({
            enrollments: state.enrollments
              .map(e => e.id === currentEnrollmentId
                ? { ...e, isActive: false, unenrollmentDate: now }
                : e
              )
              .concat({
                id: newEnrollmentId,
                groupId: destinationGroupId,
                groupName: destinationGroup.name,
                enrollmentDate: now,
                isActive: true,
                billingFrequency: newEnrollmentData.billingFrequency ?? 'monthly',
                ...newEnrollmentData,
              }),
            groups: state.groups.map(g => {
              if (g.id === currentEnrollment.groupId) return { ...g, currentEnrollment: g.currentEnrollment - 1 }
              if (g.id === destinationGroupId) return { ...g, currentEnrollment: g.currentEnrollment + 1 }
              return g
            }),
          }))

          const { userId, userName } = getCurrentUser()
          get().addActivity({
            type: 'enrollment_created',
            description: `${newEnrollmentData.playerName} trasladado a ${destinationGroup.name}`,
            relatedEntityId: newEnrollmentId,
            userId,
            userName,
          })

          queryClient.invalidateQueries({ queryKey: ['enrollments'] })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Error desconocido'
          toast.error(`Error al trasladar: ${message}`)
          throw error
        }
      },
```

- [ ] **Step 4: Add `moveEnrollmentAtomic` import**

At the top of `src/stores/dataStore.ts`, find the import from `@/lib/firestoreSync` and add `moveEnrollmentAtomic` to it (it will be created in Task 6):
```typescript
import { ..., moveEnrollmentAtomic } from '@/lib/firestoreSync'
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```
Expected: no TypeScript errors. (Task 6 will implement `moveEnrollmentAtomic` — if the import causes an error before Task 6, comment it out temporarily and restore after Task 6.)

- [ ] **Step 6: Commit**

```bash
git add src/stores/dataStore.ts
git commit -m "feat: add billingFrequency default to addEnrollment and implement moveEnrollment action"
```

---

### Task 6: Add `moveEnrollmentAtomic` to firestoreSync

**Files:**
- Modify: `src/lib/firestoreSync.ts`

- [ ] **Step 1: Add `moveEnrollmentAtomic` function**

At the end of `src/lib/firestoreSync.ts` (after `syncEnrollmentWithGroupCounter` and `updateEnrollmentStatus`), add:

```typescript
// Mueve una matrícula de un grupo a otro en una transacción atómica.
// Desactiva la matrícula actual y crea una nueva en el grupo destino.
export async function moveEnrollmentAtomic(
  oldEnrollmentId: string,
  oldGroupId: string,
  newEnrollmentId: string,
  newEnrollmentData: Record<string, unknown>,
  newGroupId: string,
  clubId: string
): Promise<void> {
  return runTransaction(db, async (transaction) => {
    const newGroupRef = doc(db, 'groups', newGroupId)
    const newGroupSnap = await transaction.get(newGroupRef)

    if (!newGroupSnap.exists()) {
      throw new Error('Grupo destino no encontrado')
    }

    const newGroupData = newGroupSnap.data()
    if ((newGroupData.currentEnrollment ?? 0) >= (newGroupData.maxCapacity ?? 0)) {
      throw new Error('El grupo destino está lleno')
    }

    const oldGroupRef = doc(db, 'groups', oldGroupId)
    const oldEnrollmentRef = doc(db, 'enrollments', oldEnrollmentId)
    const newEnrollmentRef = doc(db, 'enrollments', newEnrollmentId)

    // Deactivate old enrollment
    transaction.update(oldEnrollmentRef, {
      isActive: false,
      unenrollmentDate: serverTimestamp(),
    })

    // Decrement old group counter
    transaction.update(oldGroupRef, {
      currentEnrollment: increment(-1),
    })

    // Create new enrollment
    transaction.set(newEnrollmentRef, toFirestore({ ...newEnrollmentData, clubId }))

    // Increment new group counter
    transaction.update(newGroupRef, {
      currentEnrollment: increment(1),
    })
  }).catch((error) => {
    console.error(`[Firestore] moveEnrollmentAtomic failed: ${error}`)
    throw error
  })
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/firestoreSync.ts
git commit -m "feat: add moveEnrollmentAtomic transaction helper"
```

---

### Task 7: Add frequency picker to GroupDetailPage "Add player" dialog

**Files:**
- Modify: `src/pages/GroupDetailPage.tsx`

- [ ] **Step 1: Add new state variables for billing frequency**

In the state section of `GroupDetailPage` (around line 38 after `discountPercentage`), add:
```typescript
  const [selectedBillingFrequency, setSelectedBillingFrequency] = useState<BillingFrequency>('monthly')
  const [selectedAnchorMonth, setSelectedAnchorMonth] = useState<number>(
    group ? new Date(group.startDate).getMonth() + 1 : 9
  )
```

Add required imports at the top of the file:
```typescript
import type { BillingFrequency } from '@/types'
import { BILLING_FREQUENCIES, MONTHS } from '@/constants'
import { billingFrequencyLabel } from '@/lib/billing-utils'
```

(Note: `MONTHS` is already imported via `DAYS_OF_WEEK` in the existing import from `@/constants` — add `BILLING_FREQUENCIES` to that import.)

- [ ] **Step 2: Update `resetAddForm` to reset frequency fields**

Find `resetAddForm` (around line 90) and add:
```typescript
  const resetAddForm = () => {
    setSelectedPlayerId('')
    setSelectedTariffId('')
    setCustomPrice('')
    setDiscountMode('none')
    setDiscountPercentage('')
    setSelectedBillingFrequency('monthly')
    setSelectedAnchorMonth(group ? new Date(group.startDate).getMonth() + 1 : 9)
  }
```

- [ ] **Step 3: Auto-fill frequency when tariff is selected**

Find the tariff selector onChange (around line 571):
```typescript
                onChange={(e) => setSelectedTariffId(e.target.value)}
```
Change to:
```typescript
                onChange={(e) => {
                  const tariffId = e.target.value
                  setSelectedTariffId(tariffId)
                  const tariff = tariffs.find(t => t.id === tariffId)
                  if (tariff) {
                    setSelectedBillingFrequency(tariff.billingFrequency)
                  }
                }}
```

- [ ] **Step 4: Add frequency picker and anchor month selector in the dialog**

After the discount mode section (after the closing `}` of `{selectedTariffId && ( ... )}`, around line 673), add a new section:

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

            {/* Anchor month — only for quarterly or annual */}
            {(selectedBillingFrequency === 'quarterly' || selectedBillingFrequency === 'annual') && (
              <div className="space-y-2">
                <Label>
                  {selectedBillingFrequency === 'quarterly'
                    ? 'Mes de inicio del ciclo trimestral'
                    : 'Mes de pago anual'}
                </Label>
                <Select
                  options={MONTHS.map((m) => ({ value: String(m.value), label: m.label }))}
                  value={String(selectedAnchorMonth)}
                  onChange={(e) => setSelectedAnchorMonth(Number(e.target.value))}
                />
                {selectedBillingFrequency === 'quarterly' && (
                  <p className="text-xs text-muted-foreground">
                    Los pagos se generarán en {
                      [0, 3, 6, 9]
                        .map(offset => MONTHS.find(m => m.value === ((selectedAnchorMonth - 1 + offset) % 12) + 1)?.label)
                        .join(', ')
                    }
                  </p>
                )}
              </div>
            )}
```

- [ ] **Step 5: Pass frequency fields to `addEnrollment` call**

Find the `handleAddPlayer` function's `addEnrollment` call (around line 136):
```typescript
    const { needsPartialReceipt, enrollmentId } = await addEnrollment({
      playerId: player.id,
      playerName: `${player.firstName} ${player.lastName}`,
      groupId: group.id,
      groupName: group.name,
      tariffId: tariff.id,
      tariffName: tariff.name,
      customPrice: finalCustomPrice,
      enrollmentDate: new Date(),
      isActive: true,
    })
```

Change to:
```typescript
    const { needsPartialReceipt, enrollmentId } = await addEnrollment({
      playerId: player.id,
      playerName: `${player.firstName} ${player.lastName}`,
      groupId: group.id,
      groupName: group.name,
      tariffId: tariff.id,
      tariffName: tariff.name,
      customPrice: finalCustomPrice,
      billingFrequency: selectedBillingFrequency,
      billingAnchorMonth: (selectedBillingFrequency === 'quarterly' || selectedBillingFrequency === 'annual')
        ? selectedAnchorMonth
        : undefined,
      enrollmentDate: new Date(),
      isActive: true,
    })
```

- [ ] **Step 6: Verify build**

```bash
npm run build
```
Expected: no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/GroupDetailPage.tsx
git commit -m "feat: add billing frequency picker to add-player dialog in GroupDetailPage"
```

---

### Task 8: Add frequency column and move button to enrollment table

**Files:**
- Modify: `src/pages/GroupDetailPage.tsx`

- [ ] **Step 1: Add the `ArrowRightLeft` icon to imports**

Find the import line (around line 18):
```typescript
import { ArrowLeft, Users, Clock, MapPin, User, CreditCard, UserPlus, UserMinus, Calendar, FileDown, BookOpen, Pencil } from 'lucide-react'
```
Add `ArrowRightLeft`:
```typescript
import { ArrowLeft, Users, Clock, MapPin, User, CreditCard, UserPlus, UserMinus, Calendar, FileDown, BookOpen, Pencil, ArrowRightLeft } from 'lucide-react'
```

- [ ] **Step 2: Add move enrollment state**

In the state section (near `removeEnrollmentId`), add:
```typescript
  const [moveEnrollmentId, setMoveEnrollmentId] = useState<string | null>(null)
```

- [ ] **Step 3: Add "Frecuencia" column header to the enrollment table**

Find the table header row (around line 456):
```tsx
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden md:table-cell">Tarifa</th>
```
After it, add:
```tsx
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden lg:table-cell">Frecuencia</th>
```

- [ ] **Step 4: Add frequency cell in table body**

Find the cell that renders tariff name (around line 489):
```tsx
                              <td className="p-3 hidden md:table-cell">
                                <span className="text-sm">{enrollment.tariffName}</span>
                              </td>
```
After it, add:
```tsx
                              <td className="p-3 hidden lg:table-cell">
                                <span className="text-sm text-muted-foreground">
                                  {billingFrequencyLabel(enrollment.billingFrequency ?? group.billingFrequency)}
                                </span>
                              </td>
```

- [ ] **Step 5: Add "Mover grupo" button next to the remove button**

Find the actions cell in the table (around line 505):
```tsx
                              <td className="p-3 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setRemoveEnrollmentId(enrollment.id)}
                                >
                                  <UserMinus className="h-4 w-4" />
                                </Button>
                              </td>
```

Replace with:
```tsx
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground hover:text-foreground"
                                    onClick={() => setMoveEnrollmentId(enrollment.id)}
                                    title="Mover a otro grupo"
                                  >
                                    <ArrowRightLeft className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => setRemoveEnrollmentId(enrollment.id)}
                                  >
                                    <UserMinus className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
```

- [ ] **Step 6: Mount `MoveEnrollmentDialog` at the bottom of the page**

Find where other dialogs are rendered (after the ConfirmDialog at the end of the file) and add:
```tsx
      {/* Move enrollment dialog */}
      {moveEnrollmentId && (
        <MoveEnrollmentDialog
          enrollmentId={moveEnrollmentId}
          currentGroupId={group.id}
          onClose={() => setMoveEnrollmentId(null)}
        />
      )}
```

Also add the import at the top of the file:
```typescript
import { MoveEnrollmentDialog } from '@/components/shared/MoveEnrollmentDialog'
```

- [ ] **Step 7: Verify build**

```bash
npm run build
```
Expected: This may show an error about `MoveEnrollmentDialog` not existing yet — that is expected and will be resolved in Task 9. Comment out the import and usage temporarily if it blocks the build, then restore in Task 9.

- [ ] **Step 8: Commit**

```bash
git add src/pages/GroupDetailPage.tsx
git commit -m "feat: add frequency column and move-to-group button to enrollment table"
```

---

### Task 9: Create `MoveEnrollmentDialog` component

**Files:**
- Create: `src/components/shared/MoveEnrollmentDialog.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/shared/MoveEnrollmentDialog.tsx`:

```tsx
import { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/shared/SearchableSelect'
import { useDataStore } from '@/stores/dataStore'
import { BILLING_FREQUENCIES, MONTHS } from '@/constants'
import { formatCurrency } from '@/lib/utils'
import type { BillingFrequency } from '@/types'

interface Props {
  enrollmentId: string
  currentGroupId: string
  onClose: () => void
}

export function MoveEnrollmentDialog({ enrollmentId, currentGroupId, onClose }: Props) {
  const { groups, enrollments, tariffs, moveEnrollment } = useDataStore()

  const enrollment = enrollments.find(e => e.id === enrollmentId)

  // Step 1: choose destination group
  const [destinationGroupId, setDestinationGroupId] = useState('')
  // Step 2: choose tariff option
  const [tariffOption, setTariffOption] = useState<'keep' | 'new'>('keep')
  const [selectedTariffId, setSelectedTariffId] = useState('')
  const [discountMode, setDiscountMode] = useState<'none' | 'percentage' | 'fixed_price'>('none')
  const [discountPercentage, setDiscountPercentage] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [selectedBillingFrequency, setSelectedBillingFrequency] = useState<BillingFrequency>('monthly')
  const [selectedAnchorMonth, setSelectedAnchorMonth] = useState<number>(9)
  const [loading, setLoading] = useState(false)

  const step = destinationGroupId ? 2 : 1

  const availableGroups = useMemo(
    () => groups.filter(g => g.isActive && g.id !== currentGroupId),
    [groups, currentGroupId]
  )

  const destinationGroup = groups.find(g => g.id === destinationGroupId)
  const activeTariffs = tariffs.filter(t => t.isActive)

  const selectedTariff = tariffs.find(t => t.id === selectedTariffId)
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

  // When destination group is chosen, prefill "new tariff" fields with group defaults
  const handleSelectDestination = (groupId: string) => {
    setDestinationGroupId(groupId)
    const destGroup = groups.find(g => g.id === groupId)
    if (destGroup) {
      setSelectedTariffId(destGroup.defaultTariffId)
      setSelectedBillingFrequency(destGroup.billingFrequency)
      setSelectedAnchorMonth(new Date(destGroup.startDate).getMonth() + 1)
    }
  }

  const handleConfirm = async () => {
    if (!enrollment || !destinationGroupId) return
    setLoading(true)
    try {
      let finalData: Parameters<typeof moveEnrollment>[2]

      if (tariffOption === 'keep') {
        finalData = {
          playerId: enrollment.playerId,
          playerName: enrollment.playerName,
          tariffId: enrollment.tariffId,
          tariffName: enrollment.tariffName,
          customPrice: enrollment.customPrice,
          billingFrequency: enrollment.billingFrequency ?? 'monthly',
          billingAnchorMonth: enrollment.billingAnchorMonth,
        }
      } else {
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
        finalData = {
          playerId: enrollment.playerId,
          playerName: enrollment.playerName,
          tariffId: tariff.id,
          tariffName: tariff.name,
          customPrice: finalCustomPrice,
          billingFrequency: selectedBillingFrequency,
          billingAnchorMonth:
            selectedBillingFrequency === 'quarterly' || selectedBillingFrequency === 'annual'
              ? selectedAnchorMonth
              : undefined,
        }
      }

      await moveEnrollment(enrollmentId, destinationGroupId, finalData)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  if (!enrollment) return null

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Mover a otro grupo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <p className="text-sm text-muted-foreground">
            Alumno: <span className="font-medium text-foreground">{enrollment.playerName}</span>
          </p>

          {/* Step 1: select destination group */}
          <div className="space-y-2">
            <Label>Grupo destino *</Label>
            <SearchableSelect
              options={availableGroups.map(g => ({
                value: g.id,
                label: `${g.name} (${g.currentEnrollment}/${g.maxCapacity})`,
              }))}
              value={destinationGroupId}
              onChange={handleSelectDestination}
              placeholder="Seleccionar grupo..."
              searchPlaceholder="Buscar grupo..."
              emptyMessage="No hay otros grupos activos"
            />
          </div>

          {/* Step 2: tariff option */}
          {step === 2 && destinationGroup && (
            <div className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <Label>Tarifa</Label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="tariffOption"
                      checked={tariffOption === 'keep'}
                      onChange={() => setTariffOption('keep')}
                      className="accent-primary"
                    />
                    Mantener tarifa actual ({enrollment.tariffName})
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="tariffOption"
                      checked={tariffOption === 'new'}
                      onChange={() => setTariffOption('new')}
                      className="accent-primary"
                    />
                    Usar tarifa del grupo destino
                  </label>
                </div>
              </div>

              {tariffOption === 'new' && (
                <>
                  <div className="space-y-2">
                    <Label>Tarifa *</Label>
                    <Select
                      options={activeTariffs.map(t => ({
                        value: t.id,
                        label: `${t.name} (${formatCurrency(t.price)})`,
                      }))}
                      value={selectedTariffId}
                      onChange={(e) => {
                        setSelectedTariffId(e.target.value)
                        const t = tariffs.find(t => t.id === e.target.value)
                        if (t) setSelectedBillingFrequency(t.billingFrequency)
                      }}
                    />
                  </div>

                  {selectedTariffId && (
                    <div className="space-y-2">
                      <Label>Precio</Label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="radio" name="dm" checked={discountMode === 'none'} onChange={() => setDiscountMode('none')} className="accent-primary" />
                          Precio tarifa ({formatCurrency(selectedTariffPrice)})
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="radio" name="dm" checked={discountMode === 'percentage'} onChange={() => setDiscountMode('percentage')} className="accent-primary" />
                          Descuento %
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="radio" name="dm" checked={discountMode === 'fixed_price'} onChange={() => setDiscountMode('fixed_price')} className="accent-primary" />
                          Precio especial
                        </label>
                      </div>
                      {discountMode === 'percentage' && (
                        <Input type="number" step="1" min="1" max="100" placeholder="% de descuento" value={discountPercentage} onChange={e => setDiscountPercentage(e.target.value)} />
                      )}
                      {discountMode === 'fixed_price' && (
                        <Input type="number" step="0.01" min="0" placeholder="Precio final (€)" value={customPrice} onChange={e => setCustomPrice(e.target.value)} />
                      )}
                      {discountMode !== 'none' && (
                        <p className="text-xs text-muted-foreground">
                          Precio final: <span className="font-medium">{formatCurrency(computedFinalPrice)}</span>
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Frecuencia de facturación</Label>
                    <Select
                      options={BILLING_FREQUENCIES.map(f => ({ value: f.value, label: f.label }))}
                      value={selectedBillingFrequency}
                      onChange={e => setSelectedBillingFrequency(e.target.value as BillingFrequency)}
                    />
                  </div>

                  {(selectedBillingFrequency === 'quarterly' || selectedBillingFrequency === 'annual') && (
                    <div className="space-y-2">
                      <Label>{selectedBillingFrequency === 'quarterly' ? 'Mes de inicio del ciclo trimestral' : 'Mes de pago anual'}</Label>
                      <Select
                        options={MONTHS.map(m => ({ value: String(m.value), label: m.label }))}
                        value={String(selectedAnchorMonth)}
                        onChange={e => setSelectedAnchorMonth(Number(e.target.value))}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={!destinationGroupId || loading}
          >
            {loading ? 'Moviendo...' : 'Confirmar traslado'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Restore the import + usage in GroupDetailPage if commented out in Task 8**

If you commented out the `MoveEnrollmentDialog` import and JSX in Task 8, restore them now.

- [ ] **Step 3: Verify build**

```bash
npm run build
```
Expected: full clean build with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/MoveEnrollmentDialog.tsx src/pages/GroupDetailPage.tsx
git commit -m "feat: add MoveEnrollmentDialog component for transferring students between groups"
```

---

## Verification Steps

After all tasks are complete:

1. **Build check**: `npm run build && npm --prefix functions run build` — both must pass with zero errors.

2. **Existing monthly enrollments unaffected**: Open any group with monthly students. Confirm the "Frecuencia" column shows "Mensual" for existing enrollments. Confirm the payment generation logic (run manually from admin if available) still generates one payment per month for these students.

3. **New quarterly enrollment**: Add a student to a group with frequency "Trimestral" and anchor month = 9 (Septiembre). The helper text should show "Los pagos se generarán en Septiembre, Diciembre, Marzo, Junio". Navigate to Pagos and confirm no payment was created (payment generation only runs on the 1st of the month). Verify in Firestore that `enrollment.billingFrequency = 'quarterly'` and `enrollment.billingAnchorMonth = 9`.

4. **New annual enrollment**: Add a student with frequency "Anual" and anchor month = 9. In Firestore, confirm `billingFrequency = 'annual'`, `billingAnchorMonth = 9`.

5. **Move student — keep tariff**: Click the `ArrowRightLeft` button on a student row. Select a destination group, choose "Mantener tarifa actual", confirm. Verify: original enrollment shows `isActive: false` in Firestore, new enrollment created in destination group, `currentEnrollment` counter correct on both groups, no new payments created.

6. **Move student — new tariff**: Click move, select destination group, choose "Usar tarifa del grupo destino", pick quarterly with a specific anchor month. Confirm. Verify new enrollment has the new tariff and billing frequency in Firestore.

7. **Capacity check**: Try to move a student to a full group (currentEnrollment === maxCapacity). Confirm an error toast is shown and no data is changed.
