# Finanzas Fase F2 (Pagos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `PaymentsPage.tsx` (vista Mensual) a la topbar compartida de `FinanzasLayout`, añadir KPIs y filtros que faltan (Vencido, Método de pago, Devueltos), cerrar el enlace `/finanzas/pagos?estado=vencido` pendiente de la Fase F1, y ampliar la selección múltiple a cualquier fila con acciones en lote (marcar cobrado, recordatorio WhatsApp masivo).

**Architecture:** Cambios quirúrgicos sobre archivos existentes — ninguna reconstrucción. `finance-analytics.ts` gana una función pura nueva (`paymentsKpis`) y una línea modificada en `attentionItems`. `FinanzasLayout.tsx` gana una rama de `subtitle`. `PaymentsPage.tsx` (vista Mensual únicamente — Anual y Morosidad no se tocan) pierde su `<Header>` propio, gana `useOutletContext`, reordena sus filtros, sustituye su fila de KPIs, y amplía la selección de filas. `WhatsAppNotificationDialog.tsx` gana soporte para una cola de destinatarios (uno o varios), manteniendo compatibilidad con su único uso actual (aviso individual por fila).

**Tech Stack:** React 19 + TypeScript, Zustand (`useDataStore`), TanStack Table, React Router (`useOutletContext`, `useSearchParams`), Vitest.

---

## Task 1: `paymentsKpis` en `finance-analytics.ts`

**Files:**
- Modify: `src/lib/finance-analytics.ts` (insertar tras `collectionBreakdown`, antes de `export interface AttentionItem` — línea 385 actual)
- Test: `src/lib/finance-analytics.test.ts`

`collectionBreakdown` no sirve para los KPIs de Pagos porque filtra a `source === 'cuota' | 'manual'`; Pagos necesita **todas** las fuentes (igual que `attentionItems`).

- [ ] **Step 1: Escribir el test que falla**

Añadir en `src/lib/finance-analytics.test.ts`, después del bloque `describe('collectionBreakdown', ...)` (línea 575 actual, antes de `function makeInvoice`):

```ts
describe('paymentsKpis', () => {
  const now = new Date(2026, 7, 28)

  it('separa cobrado, pendiente (futuro) y vencido (pasado), de todas las fuentes', () => {
    const payments: NormalizedPayment[] = [
      { id: 'a', source: 'evento', playerId: 'p1', playerName: 'A', concept: 'Evento', amount: 100, status: 'pagado', billingMonth: 8, billingYear: 2026 },
      { id: 'b', source: 'clase_particular', playerId: 'p2', playerName: 'B', concept: 'Clase', amount: 50, status: 'pendiente', billingMonth: 8, billingYear: 2026, dueDate: new Date(2026, 8, 5) },
      { id: 'c', source: 'cuota', playerId: 'p3', playerName: 'C', concept: 'Cuota', amount: 30, status: 'pendiente', billingMonth: 8, billingYear: 2026, dueDate: new Date(2026, 7, 1) },
    ]
    const result = paymentsKpis(payments, new Set(['2026-8']), now)
    expect(result.paidAmount).toBe(100)
    expect(result.paidCount).toBe(1)
    expect(result.pendingAmount).toBe(50)
    expect(result.pendingCount).toBe(1)
    expect(result.overdueAmount).toBe(30)
    expect(result.overdueCount).toBe(1)
  })

  it('ignora pagos fuera de monthKeys', () => {
    const payments: NormalizedPayment[] = [
      { id: 'a', source: 'cuota', playerId: 'p1', playerName: 'A', concept: 'Cuota', amount: 999, status: 'pagado', billingMonth: 5, billingYear: 2026 },
    ]
    const result = paymentsKpis(payments, new Set(['2026-8']), now)
    expect(result.paidAmount).toBe(0)
    expect(result.paidCount).toBe(0)
  })

  it('un pendiente sin dueDate cuenta como pendiente, no vencido', () => {
    const payments: NormalizedPayment[] = [
      { id: 'a', source: 'cuota', playerId: 'p1', playerName: 'A', concept: 'Cuota', amount: 40, status: 'pendiente', billingMonth: 8, billingYear: 2026 },
    ]
    const result = paymentsKpis(payments, new Set(['2026-8']), now)
    expect(result.pendingAmount).toBe(40)
    expect(result.overdueAmount).toBe(0)
  })

  it('un cancelado no cuenta en ningun bucket', () => {
    const payments: NormalizedPayment[] = [
      { id: 'a', source: 'cuota', playerId: 'p1', playerName: 'A', concept: 'Cuota', amount: 40, status: 'cancelado', billingMonth: 8, billingYear: 2026 },
    ]
    const result = paymentsKpis(payments, new Set(['2026-8']), now)
    expect(result.paidAmount + result.pendingAmount + result.overdueAmount).toBe(0)
  })
})
```

Y añadir `paymentsKpis` al import existente de `finance-analytics` en la cabecera del test file (junto a `collectionBreakdown`, `attentionItems`, etc.).

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `npm test -- finance-analytics.test.ts`
Expected: FAIL — `paymentsKpis is not defined` / `ReferenceError`.

- [ ] **Step 3: Implementar `paymentsKpis`**

En `src/lib/finance-analytics.ts`, insertar justo después del cierre de `collectionBreakdown` (línea 383, `}`) y antes de `export interface AttentionItem`:

```ts
export interface PaymentsKpis {
  paidAmount: number
  paidCount: number
  pendingAmount: number
  pendingCount: number
  overdueAmount: number
  overdueCount: number
}

/**
 * KPIs de la pagina de Pagos: cobrado/pendiente/vencido dentro de
 * `monthKeys`, sobre TODAS las fuentes de pago (a diferencia de
 * `collectionBreakdown`, que se limita a cuota/manual para el Resumen).
 */
export function paymentsKpis(
  payments: NormalizedPayment[],
  monthKeys: Set<string>,
  now: Date = new Date()
): PaymentsKpis {
  let paidAmount = 0, paidCount = 0, pendingAmount = 0, pendingCount = 0, overdueAmount = 0, overdueCount = 0
  for (const p of payments) {
    if (!monthKeys.has(monthKeyOf(p))) continue
    if (p.status === 'pagado') {
      paidAmount += p.amount
      paidCount++
    } else if (p.status === 'pendiente') {
      if (p.dueDate && new Date(p.dueDate) < now) {
        overdueAmount += p.amount
        overdueCount++
      } else {
        pendingAmount += p.amount
        pendingCount++
      }
    }
  }
  return { paidAmount, paidCount, pendingAmount, pendingCount, overdueAmount, overdueCount }
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `npm test -- finance-analytics.test.ts`
Expected: PASS (todos los tests, incluidos los 4 nuevos de `paymentsKpis`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance-analytics.ts src/lib/finance-analytics.test.ts
git commit -m "feat: añadir paymentsKpis para los KPIs de la pagina de Pagos"
```

---

## Task 2: Enlazar "Requiere tu atención" con el filtro Vencido

**Files:**
- Modify: `src/lib/finance-analytics.ts:414`
- Test: `src/lib/finance-analytics.test.ts`

- [ ] **Step 1: Actualizar el test existente para el nuevo href**

En `src/lib/finance-analytics.test.ts`, dentro de `describe('attentionItems', ...)`, en el test `'incluye un aviso de recibos vencidos con el importe y los dias del mas antiguo'`, añadir la aserción del `href`:

```ts
  it('incluye un aviso de recibos vencidos con el importe y los dias del mas antiguo', () => {
    const payments: NormalizedPayment[] = [
      { id: 'a', source: 'cuota', playerId: 'p1', playerName: 'A', concept: 'Cuota', amount: 100, status: 'pendiente', billingMonth: 7, billingYear: 2026, dueDate: new Date(2026, 6, 27) },
    ]
    const items = attentionItems(payments, [], [], now)
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('1 recibo vencido')
    expect(items[0].subtitle).toContain('32 días')
    expect(items[0].href).toBe('/finanzas/pagos?estado=vencido')
  })
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `npm test -- finance-analytics.test.ts -t "recibos vencidos"`
Expected: FAIL — `expected '/finanzas/pagos' to be '/finanzas/pagos?estado=vencido'`.

- [ ] **Step 3: Cambiar el href**

En `src/lib/finance-analytics.ts:414`, dentro de `attentionItems`:

```ts
      href: '/finanzas/pagos',
```

cambiar a:

```ts
      href: '/finanzas/pagos?estado=vencido',
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `npm test -- finance-analytics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance-analytics.ts src/lib/finance-analytics.test.ts
git commit -m "fix: enlazar el aviso de recibos vencidos con el filtro Vencido de Pagos"
```

---

## Task 3: `FinanzasLayout.tsx` — subtítulo de la pestaña Pagos

**Files:**
- Modify: `src/components/layout/FinanzasLayout.tsx:61-71`

No hay test unitario para este componente hoy; se verifica en vivo en la Task 4 (al migrar `PaymentsPage.tsx`, el subtítulo se hace visible).

- [ ] **Step 1: Extraer `pagosCount` y añadir `isPagos`**

En `src/components/layout/FinanzasLayout.tsx`, sustituir el bloque:

```ts
  const isResumen = location.pathname === '/finanzas/resumen'
```

por:

```ts
  const isResumen = location.pathname === '/finanzas/resumen'
  const isPagos = location.pathname === '/finanzas/pagos'
```

Y sustituir:

```ts
  const tabs: FinanzasTab[] = [
    { name: 'Resumen', href: '/finanzas/resumen' },
    { name: 'Pagos', href: '/finanzas/pagos', count: payments.filter((p) => billingMonthInActiveSeason(p.billingYear, p.billingMonth)).length },
    { name: 'Facturas', href: '/finanzas/facturas', count: invoices.filter((i) => i.status !== 'cancelled' && inActiveSeason(i.invoiceDate)).length },
    { name: 'Ingresos y gastos', href: '/finanzas/ingresos-gastos' },
    { name: 'Análisis', href: '/finanzas/analisis' },
  ]

  const subtitle = isResumen
    ? `Resumen de ${MONTHS.find((m) => m.value === selectedMonth)?.label.toLowerCase()} ${selectedYear}${activeSeason ? ` · temporada ${activeSeason.name}` : ''}`
    : undefined
```

por:

```ts
  const pagosCount = payments.filter((p) => billingMonthInActiveSeason(p.billingYear, p.billingMonth)).length

  const tabs: FinanzasTab[] = [
    { name: 'Resumen', href: '/finanzas/resumen' },
    { name: 'Pagos', href: '/finanzas/pagos', count: pagosCount },
    { name: 'Facturas', href: '/finanzas/facturas', count: invoices.filter((i) => i.status !== 'cancelled' && inActiveSeason(i.invoiceDate)).length },
    { name: 'Ingresos y gastos', href: '/finanzas/ingresos-gastos' },
    { name: 'Análisis', href: '/finanzas/analisis' },
  ]

  const subtitle = isResumen
    ? `Resumen de ${MONTHS.find((m) => m.value === selectedMonth)?.label.toLowerCase()} ${selectedYear}${activeSeason ? ` · temporada ${activeSeason.name}` : ''}`
    : isPagos
      ? `Pagos · ${MONTHS.find((m) => m.value === now.getMonth() + 1)?.label.toLowerCase()} ${now.getFullYear()} · ${pagosCount} recibos de la temporada`
      : undefined
```

- [ ] **Step 2: Verificar el build**

Run: `npm run build`
Expected: Compila sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/FinanzasLayout.tsx
git commit -m "feat: subtitulo de la pestana Pagos en FinanzasLayout"
```

---

## Task 4: Migrar `PaymentsPage.tsx` a la topbar de `FinanzasLayout`

**Files:**
- Modify: `src/pages/PaymentsPage.tsx`

Quita el `<Header>` propio de la vista Mensual y registra "Registrar cobro" como acción primaria del topbar compartido, igual patrón que `ResumenPage.tsx`. El botón "Nuevo pago" del toolbar desaparece (pasa a ser la acción primaria). Este cambio afecta a las 3 vistas (Mensual/Anual/Morosidad) porque el `<Header>` es único para las tres — se sustituye por un bloque de título simple solo para Anual/Morosidad (que no tienen topbar propio en el mock, pero deben seguir mostrando su selector de vista y controles).

- [ ] **Step 1: Añadir imports necesarios**

En `src/pages/PaymentsPage.tsx`, sustituir la línea 1-3:

```ts
import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
```

por:

```ts
import { useState, useMemo, useEffect } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'
```

Y añadir, junto al resto de imports de tipos (tras la línea `import type { WhatsAppPayload } from '@/components/shared/WhatsAppNotificationDialog'`):

```ts
import type { FinanzasOutletContext } from '@/components/layout/FinanzasLayout'
```

- [ ] **Step 2: Registrar la acción primaria**

Dentro de `export default function PaymentsPage() {`, justo después de la desestructuración de `useDataStore()` (tras la línea que cierra `} = useDataStore()`), añadir:

```ts
  const { setPrimaryAction } = useOutletContext<FinanzasOutletContext>()
```

Y, después de la declaración de `const [manualDialogOpen, setManualDialogOpen] = useState(false)` (línea 164 actual), añadir:

```ts

  useEffect(() => {
    setPrimaryAction({ label: 'Registrar cobro', icon: Plus, onClick: () => setManualDialogOpen(true) })
    return () => setPrimaryAction(null)
  }, [setPrimaryAction])
```

- [ ] **Step 3: Sustituir el `<Header>` por un bloque de título simple**

Sustituir el bloque (líneas 889-960 actuales):

```tsx
  return (
    <div>
      <Header
        title="Pagos y Facturacion"
        subtitle={
          viewMode === 'mensual'
            ? `${selectedMonthLabel} ${selectedYear} · ${totalRecibos} recibos`
            : viewMode === 'anual'
              ? `Resumen anual ${selectedYear}`
              : `${pendingByPlayer.length} alumnos con deudas`
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportXLSX}>
              <Download className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Exportar XLSX</span>
            </Button>
            {viewMode === 'mensual' && (
              <>
                <Button variant="outline" size="sm" onClick={handleExportSepaXML} title="Exportar XML para domiciliación SEPA">
                  <Download className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">XML SEPA</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSepaImportOpen(true)} title="Importar respuestas del banco para conciliar" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                  <UploadCloud className="h-4 w-4 md:mr-1" />
                  <span className="hidden md:inline">Conciliar SEPA</span>
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setWhatsappCSVOpen(true)} 
                  title="Envío masivo WhatsApp CSV"
                  className="gap-1 border-green-300 text-green-700 hover:bg-green-50"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">WhatsApp CSV</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setManualDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Nuevo pago</span>
                </Button>
                {selectedPaymentIds.size > 0 && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setShowGenerateInvoiceDialog(true)}
                    className="gap-1"
                  >
                    <Receipt className="h-4 w-4" />
                    <span className="hidden sm:inline">Generar factura ({selectedPaymentIds.size})</span>
                    <span className="sm:hidden">{selectedPaymentIds.size}</span>
                  </Button>
                )}
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={handleBulkGenerateInvoices} 
                  title="Generar facturas de todos los cobros que aún no tienen factura"
                  className="gap-1 border-primary/20 hover:border-primary/40 text-primary"
                >
                  <Receipt className="h-4 w-4" />
                  <span className="hidden sm:inline">Facturar Pendientes</span>
                </Button>
                <Button size="sm" onClick={handleGenerateReceipts} title="Generar recibos de cuotas mensuales">
                  <FileText className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Generar cuotas</span>
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="p-6 space-y-6">
```

por:

```tsx
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExportXLSX}>
            <Download className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Exportar XLSX</span>
          </Button>
          {viewMode === 'mensual' && (
            <>
              <Button variant="outline" size="sm" onClick={handleExportSepaXML} title="Exportar XML para domiciliación SEPA">
                <Download className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">XML SEPA</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSepaImportOpen(true)} title="Importar respuestas del banco para conciliar" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                <UploadCloud className="h-4 w-4 md:mr-1" />
                <span className="hidden md:inline">Conciliar SEPA</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWhatsappCSVOpen(true)}
                title="Envío masivo WhatsApp CSV"
                className="gap-1 border-green-300 text-green-700 hover:bg-green-50"
              >
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline">WhatsApp CSV</span>
              </Button>
              {selectedPaymentIds.size > 0 && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowGenerateInvoiceDialog(true)}
                  className="gap-1"
                >
                  <Receipt className="h-4 w-4" />
                  <span className="hidden sm:inline">Generar factura ({selectedPaymentIds.size})</span>
                  <span className="sm:hidden">{selectedPaymentIds.size}</span>
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkGenerateInvoices}
                title="Generar facturas de todos los cobros que aún no tienen factura"
                className="gap-1 border-primary/20 hover:border-primary/40 text-primary"
              >
                <Receipt className="h-4 w-4" />
                <span className="hidden sm:inline">Facturar Pendientes</span>
              </Button>
              <Button size="sm" onClick={handleGenerateReceipts} title="Generar recibos de cuotas mensuales">
                <FileText className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Generar cuotas</span>
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
```

Nota: `selectedMonthLabel` y `totalRecibos` (línea 859, 263 actuales) dejan de usarse en el título — se mantienen en el archivo porque `totalRecibos` sigue usándose en la tarjeta KPI "Total recibos" (Task 6 la sustituye) y `selectedMonthLabel` puede quedar sin uso; si el compilador de TypeScript (`noUnusedLocals`) falla por `selectedMonthLabel` sin usar, eliminar esa línea (859).

- [ ] **Step 4: Verificar el build**

Run: `npm run build`
Expected: Compila sin errores. Si falla por `selectedMonthLabel` no usado, eliminar su declaración (`const selectedMonthLabel = ...`).

- [ ] **Step 5: Verificación en vivo**

Con el servidor de desarrollo (`npm run dev`), entrar en `/finanzas/pagos` y confirmar: la topbar compartida de Finanzas muestra el subtítulo "Pagos · <mes> <año> · N recibos de la temporada" (Task 3) y el botón "Registrar cobro" abre `AddManualPaymentDialog`; el resto de botones (Exportar XLSX, XML SEPA, Conciliar SEPA, WhatsApp CSV, Generar factura, Facturar Pendientes, Generar cuotas) siguen funcionando igual que antes, ahora en una fila propia bajo la topbar.

- [ ] **Step 6: Commit**

```bash
git add src/pages/PaymentsPage.tsx
git commit -m "feat: migrar PaymentsPage a la topbar compartida de FinanzasLayout"
```

---

## Task 5: Filtro "Vencido" + enlace desde "Requiere tu atención"

**Files:**
- Modify: `src/pages/PaymentsPage.tsx`

- [ ] **Step 1: Leer el query param `estado` al montar**

Tras el bloque de `useEffect` añadido en la Task 4 (registro de `setPrimaryAction`), añadir:

```ts

  const [searchParams] = useSearchParams()

  useEffect(() => {
    const estado = searchParams.get('estado')
    if (estado === 'vencido') setStatusFilter('vencido')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
```

(Se ejecuta solo al montar — a propósito, para no sobreescribir el filtro si el usuario lo cambia después manualmente y la URL no se actualiza.)

- [ ] **Step 2: Extender el filtro de estado para admitir "vencido"**

En el `useMemo` de `filteredPayments` (línea 200-217 actuales), sustituir:

```ts
      const matchesStatus = statusFilter === '' || p.status === statusFilter
```

por:

```ts
      const matchesStatus =
        statusFilter === ''
          ? true
          : statusFilter === 'vencido'
            ? p.status === 'pendiente' && !!p.dueDate && new Date(p.dueDate) < now
            : p.status === statusFilter
```

Y añadir `now` a las dependencias del `useMemo` — como `now` ya está declarado como `const now = new Date()` fuera de cualquier `useMemo` (línea 143), se recalcula en cada render, así que basta con referenciarlo; no hace falta añadirlo al array de dependencias de `filteredPayments` (mismo patrón que el resto del archivo, que ya usa variables de nivel de componente sin listarlas todas).

- [ ] **Step 3: Añadir "Vencido" a las opciones del select de Estado**

En el bloque de filtros de la vista Mensual (línea ~1099-1107 actuales), sustituir:

```tsx
              <Select
                options={[
                  { value: '', label: 'Todos los estados' },
                  ...PAYMENT_STATUSES.map((s) => ({ value: s.value, label: s.label })),
                ]}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-48"
              />
```

por:

```tsx
              <Select
                options={[
                  { value: '', label: 'Todos los estados' },
                  { value: 'pendiente', label: 'Pendiente' },
                  { value: 'vencido', label: 'Vencido' },
                  { value: 'pagado', label: 'Pagado' },
                  { value: 'cancelado', label: 'Cancelado' },
                ]}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-48"
              />
```

(Se enumeran a mano en vez de mapear `PAYMENT_STATUSES` para poder insertar "Vencido" justo después de "Pendiente", en vez de al final de la lista.)

- [ ] **Step 4: Mostrar "Vencido" en el chip de Estado de la tabla**

`StatusBadge` ya soporta la clave `'vencido'` (rojo, label "Vencido" — ver `src/components/shared/StatusBadge.tsx:28,47`). Hoy la columna Estado le pasa directamente `payment.status`, que en Firestore nunca vale `'vencido'` (es un estado derivado solo de UI). Sustituir, en la definición de columnas (línea ~464-467 actuales):

```ts
      {
        accessorKey: 'status',
        header: ({ column }) => <SortableHeader column={column}>Estado</SortableHeader>,
        cell: ({ getValue }) => <StatusBadge status={getValue<string>()} />,
      },
```

por:

```ts
      {
        accessorKey: 'status',
        header: ({ column }) => <SortableHeader column={column}>Estado</SortableHeader>,
        cell: ({ row }) => {
          const payment = row.original
          const displayStatus =
            payment.status === 'pendiente' && payment.dueDate && new Date(payment.dueDate) < now
              ? 'vencido'
              : payment.status
          return <StatusBadge status={displayStatus} />
        },
      },
```

- [ ] **Step 5: Verificar el build**

Run: `npm run build`
Expected: Compila sin errores.

- [ ] **Step 6: Verificación en vivo**

En el Resumen (`/finanzas/resumen`), con al menos un recibo vencido, hacer clic en el aviso "Requiere tu atención" correspondiente y confirmar que navega a `/finanzas/pagos?estado=vencido` con el filtro Estado ya en "Vencido" y la tabla mostrando solo esos recibos, con el chip de Estado en rojo mostrando "Vencido". Cambiar manualmente el filtro a "Pendiente" y confirmar que los recibos vencidos (dueDate pasado) no aparecen ahí — el estado real en Firestore sigue siendo `pendiente`, así que "Vencido" y "Pendiente" son subconjuntos disjuntos solo a nivel de UI.

- [ ] **Step 7: Commit**

```bash
git add src/pages/PaymentsPage.tsx
git commit -m "feat: filtro y chip Vencido en Pagos, enlazado desde Requiere tu atencion"
```

---

## Task 6: Sustituir la fila de KPIs por Cobrado/Pendiente/Vencido/Devueltos

**Files:**
- Modify: `src/pages/PaymentsPage.tsx`

- [ ] **Step 1: Importar `paymentsKpis` y calcular los KPIs**

Añadir `paymentsKpis` al import de `finance-analytics` — como `PaymentsPage.tsx` no importa hoy nada de `finance-analytics.ts`, añadir una línea nueva junto al resto de imports de `@/lib/...`:

```ts
import { paymentsKpis } from '@/lib/finance-analytics'
```

Sustituir el bloque de cálculo de KPIs (líneas 234-263 actuales: `ingresosMes`, `ingresosMesAnterior`, `ingresosTrend`, `pendienteCobro`, `tasaCobro`, `totalRecibos`) por:

```ts
  const monthKeys = useMemo(() => new Set([`${selectedYear}-${selectedMonth}`]), [selectedYear, selectedMonth])

  const kpis = useMemo(
    () => paymentsKpis(currentMonthAllPayments, monthKeys, now),
    [currentMonthAllPayments, monthKeys]
  )

  const devueltosDelMes = useMemo(() => {
    return allBasePayments.filter(
      (p) =>
        p.category === 'otro' &&
        p.concept === 'Recargo por devolución SEPA' &&
        p.billingMonth === selectedMonth &&
        p.billingYear === selectedYear
    )
  }, [allBasePayments, selectedMonth, selectedYear])

  const devueltosAmount = devueltosDelMes.reduce((sum, p) => sum + Number(p.amount || 0), 0)
```

`currentMonthAllPayments` y `now` ya existen en el archivo sin cambios; `allBasePayments` también ya existe (viene de `useDataStore()`, ver línea 120).

Nota: `ingresosMesAnterior`/`previousMonthAllPayments`/`ingresosTrend` quedaban usados solo por la tarjeta "Ingresos del mes" que se sustituye en el Step 2 — si el compilador marca `previousMonthAllPayments` como no usado tras este cambio, eliminar también su declaración (líneas 226-232 actuales).

- [ ] **Step 2: Sustituir las 4 tarjetas KPI de la vista Mensual**

Sustituir el bloque (líneas 964-995 actuales):

```tsx
        {viewMode === 'mensual' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Ingresos del mes"
              value={formatCurrency(ingresosMes)}
              icon={DollarSign}
              trend={{
                value: ingresosTrend,
                label: 'vs mes anterior',
              }}
              iconClassName="bg-green-100 text-green-700"
            />
            <StatCard
              title="Pendiente de cobro"
              value={formatCurrency(pendienteCobro)}
              icon={AlertCircle}
              iconClassName="bg-yellow-100 text-yellow-700"
            />
            <StatCard
              title="Tasa de cobro"
              value={`${tasaCobro}%`}
              icon={TrendingUp}
              iconClassName="bg-blue-100 text-blue-700"
            />
            <StatCard
              title="Total recibos"
              value={totalRecibos}
              icon={FileText}
              iconClassName="bg-purple-100 text-purple-700"
            />
          </div>
        )}
```

por:

```tsx
        {viewMode === 'mensual' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Cobrado"
              value={formatCurrency(kpis.paidAmount)}
              icon={DollarSign}
              iconClassName="bg-green-100 text-green-700"
            />
            <StatCard
              title="Pendiente"
              value={formatCurrency(kpis.pendingAmount)}
              icon={FileText}
              iconClassName="bg-blue-100 text-blue-700"
            />
            <StatCard
              title="Vencido"
              value={formatCurrency(kpis.overdueAmount)}
              icon={AlertCircle}
              iconClassName="bg-red-100 text-red-700"
            />
            <StatCard
              title="Devueltos"
              value={devueltosDelMes.length}
              icon={RotateCcw}
              iconClassName="bg-amber-100 text-amber-700"
            />
          </div>
        )}
```

`RotateCcw` ya está importado (línea 34 actual, usado por el botón "Deshacer"). `TrendingUp` deja de usarse en este bloque pero sigue haciendo falta para las tarjetas de la vista Anual (línea 1015 actual) — no se toca el import.

- [ ] **Step 3: Verificar el build**

Run: `npm run build`
Expected: Compila sin errores.

- [ ] **Step 4: Verificación en vivo**

En `/finanzas/pagos`, vista Mensual, confirmar que las 4 tarjetas muestran Cobrado/Pendiente/Vencido/Devueltos, y que "Vencido" coincide con el número de recibos que aparecen al filtrar Estado=Vencido (Task 5) para el mismo mes/año seleccionados en la página.

- [ ] **Step 5: Commit**

```bash
git add src/pages/PaymentsPage.tsx
git commit -m "feat: KPIs Cobrado/Pendiente/Vencido/Devueltos en Pagos"
```

---

## Task 7: Filtro "Método de pago" + reordenar filtros secundarios

**Files:**
- Modify: `src/pages/PaymentsPage.tsx`

- [ ] **Step 1: Añadir el estado y el predicado del filtro Método**

Junto a `const [categoryFilter, setCategoryFilter] = useState<string>('')` (línea 161 actual), añadir:

```ts
  const [methodFilter, setMethodFilter] = useState<string>('')
```

En el `useMemo` de `filteredPayments`, añadir el predicado y su combinación:

```ts
      const matchesCategory = categoryFilter === '' || p.source === categoryFilter
      const matchesMethod = methodFilter === '' || p.paymentMethod === methodFilter
```

y en el `return` del `filter`:

```ts
      return matchesSearch && matchesStatus && matchesGroup && matchesCategory && matchesMethod && matchesMonth && matchesYear && matchesSeason
```

y en el array de dependencias del `useMemo`:

```ts
  }, [allPayments, search, statusFilter, groupFilter, categoryFilter, methodFilter, selectedMonth, selectedYear, seasonFilter, groups])
```

- [ ] **Step 2: Reordenar la fila de filtros — Método en la fila principal, Categoría/Temporada en una fila secundaria**

Sustituir el bloque de filtros de la vista Mensual (líneas 1088-1136 actuales):

```tsx
          {viewMode === 'mensual' && (
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por jugador o concepto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                options={[
                  { value: '', label: 'Todos los estados' },
                  { value: 'pendiente', label: 'Pendiente' },
                  { value: 'vencido', label: 'Vencido' },
                  { value: 'pagado', label: 'Pagado' },
                  { value: 'cancelado', label: 'Cancelado' },
                ]}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-48"
              />
              <Select
                options={[
                  { value: '', label: 'Todos los grupos' },
                  ...groupOptions,
                ]}
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="w-full sm:w-48"
              />
              <Select
                options={[
                  { value: '', label: 'Todas las temporadas' },
                  ...seasons.map((s) => ({ value: s.id, label: s.name })),
                ]}
                value={seasonFilter}
                onChange={(e) => setSeasonFilter(e.target.value)}
                className="w-full sm:w-48"
              />
              <Select
                options={[
                  { value: '', label: 'Todas las categorias' },
                  ...PAYMENT_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
                ]}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full sm:w-48"
              />
            </div>
          )}
```

por:

```tsx
          {viewMode === 'mensual' && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por jugador o concepto..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select
                  options={[
                    { value: '', label: 'Todos los estados' },
                    { value: 'pendiente', label: 'Pendiente' },
                    { value: 'vencido', label: 'Vencido' },
                    { value: 'pagado', label: 'Pagado' },
                    { value: 'cancelado', label: 'Cancelado' },
                  ]}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full sm:w-48"
                />
                <Select
                  options={[
                    { value: '', label: 'Todos los metodos' },
                    ...PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label })),
                  ]}
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className="w-full sm:w-48"
                />
                <Select
                  options={[
                    { value: '', label: 'Todos los grupos' },
                    ...groupOptions,
                  ]}
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                  className="w-full sm:w-48"
                />
              </div>
              <div className="flex flex-col sm:flex-row flex-wrap gap-3 text-muted-foreground">
                <Select
                  options={[
                    { value: '', label: 'Todas las categorias' },
                    ...PAYMENT_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
                  ]}
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full sm:w-44 text-sm"
                />
                <Select
                  options={[
                    { value: '', label: 'Todas las temporadas' },
                    ...seasons.map((s) => ({ value: s.id, label: s.name })),
                  ]}
                  value={seasonFilter}
                  onChange={(e) => setSeasonFilter(e.target.value)}
                  className="w-full sm:w-44 text-sm"
                />
              </div>
            </div>
          )}
```

(Los selectores de Mes/Año existentes en la fila superior — compartida con las vistas Anual/Morosidad, líneas 1068-1084 actuales — no se tocan: moverlos rompería esas dos vistas, que el alcance de esta fase deja intactas.)

- [ ] **Step 3: Verificar el build**

Run: `npm run build`
Expected: Compila sin errores.

- [ ] **Step 4: Verificación en vivo**

En `/finanzas/pagos`, confirmar que aparece el nuevo filtro "Todos los metodos" en la fila principal, que filtra correctamente por método de pago (ej. seleccionar "Transferencia bancaria" y comprobar que solo aparecen recibos con ese método), y que Categoría/Temporada siguen funcionando igual, ahora en una fila secundaria con texto más tenue.

- [ ] **Step 5: Commit**

```bash
git add src/pages/PaymentsPage.tsx
git commit -m "feat: filtro por metodo de pago en Pagos, categoria/temporada a fila secundaria"
```

---

## Task 8: `WhatsAppNotificationDialog` — soporte para varios destinatarios

**Files:**
- Modify: `src/components/shared/WhatsAppNotificationDialog.tsx`

Hoy el diálogo abre exactamente un enlace `wa.me` por invocación (`payload: WhatsAppPayload | null`). Se cambia a una cola: acepta uno o varios `WhatsAppPayload` y, tras cada envío, avanza al siguiente hasta agotar la lista. El único uso actual (aviso individual por fila, en dos sitios de `PaymentsPage.tsx`) sigue funcionando sin cambios porque pasa un array de un elemento.

- [ ] **Step 1: Cambiar la prop de `payload` a `payloads`**

Sustituir el archivo completo `src/components/shared/WhatsAppNotificationDialog.tsx`:

```tsx
// ==========================================
// WhatsApp Notification Dialog
// ==========================================
// Editable pre-send dialog that opens a wa.me deep link. Accepts one or
// several recipients — after each send it advances to the next one until
// the queue is exhausted.

import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { MessageCircle, Phone } from 'lucide-react'

export interface WhatsAppPayload {
    /** Recipient phone number (with or without international prefix) */
    phone: string
    /** Pre-filled message template */
    message: string
    /** Display name shown in the dialog */
    recipientName: string
}

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    payloads: WhatsAppPayload[]
}

// Normalise phone: strips spaces/dashes, adds +34 if no leading +
function formatPhone(raw: string): string {
    const cleaned = raw.replace(/[\s\-().]/g, '')
    if (!cleaned) return ''
    if (cleaned.startsWith('+')) return cleaned
    if (cleaned.startsWith('00')) return '+' + cleaned.slice(2)
    return '+34' + cleaned
}

export function WhatsAppNotificationDialog({ open, onOpenChange, payloads }: Props) {
    const [index, setIndex] = useState(0)
    const [message, setMessage] = useState('')

    const payload = payloads[index] ?? null

    // Reset the queue position and message every time the dialog opens
    useEffect(() => {
        if (open) setIndex(0)
    }, [open])

    useEffect(() => {
        if (payload) setMessage(payload.message)
    }, [payload])

    const phone = payload ? formatPhone(payload.phone) : ''
    const isPhoneValid = phone.length >= 10
    const isLast = index >= payloads.length - 1

    const handleSend = () => {
        if (!isPhoneValid) return
        const url = `https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(message)}`
        window.open(url, '_blank', 'noopener,noreferrer')
        if (isLast) {
            onOpenChange(false)
        } else {
            setIndex((i) => i + 1)
        }
    }

    const handleSkip = () => {
        if (isLast) {
            onOpenChange(false)
        } else {
            setIndex((i) => i + 1)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5 text-green-500" />
                        Enviar aviso por WhatsApp
                        {payloads.length > 1 && (
                            <span className="text-sm font-normal text-muted-foreground ml-auto">
                                {index + 1} de {payloads.length}
                            </span>
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        Revisa y edita el mensaje antes de abrirlo en WhatsApp.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Phone */}
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium">{payload?.recipientName}</span>
                        <span className="text-muted-foreground ml-auto font-mono">
                            {isPhoneValid ? phone : <span className="text-destructive">Sin teléfono válido</span>}
                        </span>
                    </div>

                    {/* Editable message */}
                    <div className="space-y-1.5">
                        <Label htmlFor="wa-message">Mensaje</Label>
                        <textarea
                            id="wa-message"
                            rows={6}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                        />
                        <p className="text-xs text-muted-foreground">{message.length} caracteres</p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    {payloads.length > 1 && !isPhoneValid && (
                        <Button variant="outline" onClick={handleSkip}>
                            Saltar
                        </Button>
                    )}
                    <Button
                        onClick={handleSend}
                        disabled={!isPhoneValid || !message.trim()}
                        className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                    >
                        <MessageCircle className="h-4 w-4" />
                        {isLast ? 'Abrir en WhatsApp' : 'Abrir y siguiente'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
```

- [ ] **Step 2: Actualizar los dos usos existentes en `PaymentsPage.tsx`**

En `src/pages/PaymentsPage.tsx`, cambiar el estado de:

```ts
  const [whatsAppPayload, setWhatsAppPayload] = useState<WhatsAppPayload | null>(null)
```

a:

```ts
  const [whatsAppPayloads, setWhatsAppPayloads] = useState<WhatsAppPayload[]>([])
```

En los dos sitios que llaman a `setWhatsAppPayload({ phone, message: msg, recipientName: ... })` (dentro de la columna `actions` de la tabla principal, y en la vista Morosidad), sustituir por:

```ts
                    setWhatsAppPayloads([{ phone, message: msg, recipientName: payment.playerName }])
```

y, en la vista Morosidad:

```ts
                                setWhatsAppPayloads([{ phone, message: msg, recipientName: row.playerName }])
```

Y en el render del diálogo, al final del archivo:

```tsx
      {/* WhatsApp Notification Dialog */}
      <WhatsAppNotificationDialog
        open={whatsAppPayloads.length > 0}
        onOpenChange={(open) => { if (!open) setWhatsAppPayloads([]) }}
        payloads={whatsAppPayloads}
      />
```

- [ ] **Step 3: Verificar el build**

Run: `npm run build`
Expected: Compila sin errores.

- [ ] **Step 4: Verificación en vivo**

En `/finanzas/pagos`, hacer clic en el icono de WhatsApp de una fila pendiente y confirmar que el diálogo se abre igual que antes (sin el contador "1 de N", porque solo hay 1 destinatario) y que "Abrir en WhatsApp" sigue cerrando el diálogo tras un único envío.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/WhatsAppNotificationDialog.tsx src/pages/PaymentsPage.tsx
git commit -m "feat: WhatsAppNotificationDialog admite una cola de varios destinatarios"
```

---

## Task 9: Selección múltiple ampliada a cualquier fila + acciones en lote

**Files:**
- Modify: `src/pages/PaymentsPage.tsx`

- [ ] **Step 1: Ampliar qué filas son seleccionables**

Sustituir (líneas 375-390 actuales):

```ts
  const handleToggleAll = () => {
    // Solo pagos pagados sin factura pueden ser seleccionados
    const selectablePayments = filteredPayments.filter(
      (p) => p.status === 'pagado' && !p.invoiceId
    )

    if (selectedPaymentIds.size === selectablePayments.length) {
      setSelectedPaymentIds(new Set())
    } else {
      setSelectedPaymentIds(new Set(selectablePayments.map((p) => p.id)))
    }
  }

  const selectableCount = filteredPayments.filter(
    (p) => p.status === 'pagado' && !p.invoiceId
  ).length
```

por:

```ts
  const handleToggleAll = () => {
    // Cualquier fila visible es seleccionable
    if (selectedPaymentIds.size === filteredPayments.length) {
      setSelectedPaymentIds(new Set())
    } else {
      setSelectedPaymentIds(new Set(filteredPayments.map((p) => p.id)))
    }
  }

  const selectableCount = filteredPayments.length

  const selectedPayments = useMemo(
    () => filteredPayments.filter((p) => selectedPaymentIds.has(p.id)),
    [filteredPayments, selectedPaymentIds]
  )

  const canMarkPaid = selectedPayments.some((p) => p.status === 'pendiente')

  const canRemind = selectedPayments.some(
    (p) => p.status === 'pendiente' && !!(players.find((pl) => pl.id === p.playerId)?.phone ?? players.find((pl) => pl.id === p.playerId)?.guardian?.phone)
  )

  const canInvoice = selectedPayments.some((p) => p.status === 'pagado' && !p.invoiceId)
```

- [ ] **Step 2: Quitar la restricción de la celda de checkbox por fila**

Sustituir (líneas 404-416 actuales):

```ts
        cell: ({ row }) => {
          const payment = row.original
          const isSelectable = payment.status === 'pagado' && !payment.invoiceId
          if (!isSelectable) return null

          return (
            <Checkbox
              checked={selectedPaymentIds.has(payment.id)}
              onCheckedChange={() => handleTogglePayment(payment.id)}
              aria-label="Seleccionar pago"
            />
          )
        },
```

por:

```ts
        cell: ({ row }) => {
          const payment = row.original
          return (
            <Checkbox
              checked={selectedPaymentIds.has(payment.id)}
              onCheckedChange={() => handleTogglePayment(payment.id)}
              aria-label="Seleccionar pago"
            />
          )
        },
```

- [ ] **Step 3: Añadir los handlers de las acciones en lote**

Junto a `handleBulkGenerateInvoices` (línea 349-361 actuales), añadir:

```ts
  const handleBulkMarkPaid = () => {
    const targets = selectedPayments.filter((p) => p.status === 'pendiente')
    if (targets.length === 0) return
    if (!window.confirm(`¿Marcar como cobrados ${targets.length} recibo${targets.length === 1 ? '' : 's'} por transferencia?`)) return

    targets.forEach((payment) => {
      if (payment.source === 'evento') {
        markEventPaymentPaid(payment.id, 'transferencia')
      } else if (payment.source === 'clase_particular') {
        markPrivateLessonPaymentPaid(payment.id, 'transferencia')
      } else {
        markPaymentPaid(payment.id, 'transferencia')
      }
    })
    setSelectedPaymentIds(new Set())
  }

  const handleBulkRemind = () => {
    const targets = selectedPayments.filter((p) => p.status === 'pendiente')
    const payloads: WhatsAppPayload[] = targets
      .map((payment) => {
        const player = players.find((pl) => pl.id === payment.playerId)
        const phone = player?.phone ?? player?.guardian?.phone ?? ''
        if (!phone) return null
        return {
          phone,
          message: getWhatsAppReminderMessage(payment.playerId, payment.playerName),
          recipientName: payment.playerName,
        }
      })
      .filter((p): p is WhatsAppPayload => p !== null)

    if (payloads.length === 0) return
    setWhatsAppPayloads(payloads)
  }
```

- [ ] **Step 4: Sustituir la barra de acciones del toolbar por una barra de selección contextual**

En el bloque de acciones de la vista Mensual (dentro del `<div className="flex items-center gap-2 flex-wrap">` creado en la Task 4), sustituir:

```tsx
              {selectedPaymentIds.size > 0 && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowGenerateInvoiceDialog(true)}
                  className="gap-1"
                >
                  <Receipt className="h-4 w-4" />
                  <span className="hidden sm:inline">Generar factura ({selectedPaymentIds.size})</span>
                  <span className="sm:hidden">{selectedPaymentIds.size}</span>
                </Button>
              )}
```

por:

```tsx
              {selectedPaymentIds.size > 0 && (
                <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-2 py-1">
                  <span className="text-xs text-muted-foreground px-1">{selectedPaymentIds.size} seleccionados</span>
                  {canMarkPaid && (
                    <Button variant="outline" size="sm" onClick={handleBulkMarkPaid} className="gap-1">
                      <CheckCircle className="h-4 w-4" />
                      <span className="hidden sm:inline">Marcar como cobrado</span>
                    </Button>
                  )}
                  {canRemind && (
                    <Button variant="outline" size="sm" onClick={handleBulkRemind} className="gap-1 text-green-700 border-green-300 hover:bg-green-50">
                      <MessageCircle className="h-4 w-4" />
                      <span className="hidden sm:inline">Enviar recordatorio</span>
                    </Button>
                  )}
                  {canInvoice && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setShowGenerateInvoiceDialog(true)}
                      className="gap-1"
                    >
                      <Receipt className="h-4 w-4" />
                      <span className="hidden sm:inline">Emitir factura</span>
                    </Button>
                  )}
                </div>
              )}
```

- [ ] **Step 5: `GenerateInvoiceDialog` sigue recibiendo solo los preseleccionados facturables**

`GenerateInvoiceDialog` recibe `preSelectedPaymentIds={Array.from(selectedPaymentIds)}` (línea 1482 actual, sin cambios) — como la selección ahora puede incluir filas no facturables (pendientes/vencidas), verificar que `GenerateInvoiceDialog` ya filtra internamente a pagos `pagado && !invoiceId` antes de generar. Si no lo hace, añadir ese filtro al array pasado:

```tsx
        preSelectedPaymentIds={Array.from(selectedPaymentIds).filter((id) => {
          const p = allPayments.find((pp) => pp.id === id)
          return p?.status === 'pagado' && !p.invoiceId
        })}
```

Comprobar primero abriendo `src/components/invoices/GenerateInvoiceDialog.tsx` y buscando cómo usa `preSelectedPaymentIds` — si ya filtra por `status === 'pagado' && !invoiceId` internamente, no aplicar este cambio (evitar doble filtrado redundante).

- [ ] **Step 6: Verificar el build**

Run: `npm run build`
Expected: Compila sin errores.

- [ ] **Step 7: Verificación en vivo**

En `/finanzas/pagos`: seleccionar una mezcla de filas pendientes y pagadas; confirmar que aparecen "Marcar como cobrado" y, si alguna pendiente tiene teléfono, "Enviar recordatorio"; confirmar que "Emitir factura" solo aparece si hay alguna pagada sin factura entre las seleccionadas. Ejecutar "Marcar como cobrado" sobre varias pendientes y confirmar que todas pasan a Pagado. Ejecutar "Enviar recordatorio" sobre varias pendientes con teléfono y confirmar que el diálogo de WhatsApp muestra "1 de N" y avanza al siguiente destinatario tras cada envío.

- [ ] **Step 8: Commit**

```bash
git add src/pages/PaymentsPage.tsx
git commit -m "feat: seleccion multiple de cualquier fila con acciones en lote en Pagos"
```

---

## Task 10: Verificación final

**Files:** ninguno (solo comandos)

- [ ] **Step 1: Suite completa**

Run: `npm test`
Expected: Todos los tests pasan (incluidos los añadidos en las Tasks 1-2).

- [ ] **Step 2: Build de frontend y funciones**

Run: `npm run build`
Run: `npm --prefix functions run build`
Expected: Ambos compilan sin errores (Cloud Functions no se tocan en este plan, pero se verifica que nada se rompió).

- [ ] **Step 3: Recorrido manual completo**

Con `npm run dev`, en `/finanzas/pagos`:
1. Confirmar que Anual y Morosidad siguen funcionando exactamente igual que antes de este plan (toggle, selectores, tabla de morosos, aviso WhatsApp individual).
2. En Mensual: KPIs Cobrado/Pendiente/Vencido/Devueltos correctos para el mes seleccionado.
3. Filtro Estado con "Vencido" funcionando; filtro Método de pago funcionando; Categoría/Temporada en fila secundaria funcionando.
4. Selección múltiple de filas mixtas con las 3 acciones en lote condicionales.
5. Entrada desde "Requiere tu atención" del Resumen con `?estado=vencido` preseleccionando el filtro.
6. Botón "Registrar cobro" del topbar abre el diálogo de nuevo pago manual.

- [ ] **Step 4: Commit final (si quedó algo suelto)**

```bash
git status
```

Si hay cambios sin commitear, revisarlos y hacer un commit final describiéndolos.

---

## Fuera de alcance (recordatorio)

- Estados "Devuelto"/"Emitido" como estados reales del ciclo SEPA — no se tocan.
- Paginación de la tabla — no se añade.
- Vistas Anual y Morosidad — sin cambios de comportamiento (solo se ven afectadas indirectamente por perder el `<Header>` compartido en la Task 4, que se sustituye por un bloque de título equivalente).
