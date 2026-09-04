# Fase F2 (Pagos) — Fidelidad al mock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reestructurar la vista Mensual de `PaymentsPage.tsx` para que su layout coincida con el mock (`WlxVY`, "09 · Finanzas / Pagos"): una sola fila de filtros con estilo "chip" + acciones, un menú "Más acciones" para lo que el mock no muestra, y la barra de selección dentro de la tabla en vez de en el toolbar superior. Ningún comportamiento de negocio cambia — solo dónde y cómo se presenta.

**Architecture:** Un componente visual nuevo (`FilterChipSelect`, envoltorio de `Select` existente) más una reescritura localizada de tres bloques JSX ya existentes en `PaymentsPage.tsx` (el toolbar superior, el bloque de filtros, y el contenedor de la tabla). Anual y Morosidad no cambian de comportamiento, solo conservan su botón "Exportar XLSX" en el toolbar superior.

**Tech Stack:** React 19 + TypeScript, shadcn/ui (`DropdownMenu`, `Select`), Tailwind.

---

## Task 1: Componente `FilterChipSelect`

**Files:**
- Create: `src/components/shared/FilterChipSelect.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

interface FilterChipSelectProps {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export function FilterChipSelect({ label, options, value, onChange, className }: FilterChipSelectProps) {
  return (
    <div className={cn('flex h-9 items-center gap-1.5 rounded-full border border-input bg-background pl-3 pr-2.5', className)}>
      <span className="text-xs text-muted-foreground shrink-0">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full appearance-none bg-transparent border-0 p-0 pr-1 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-0"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 pointer-events-none" />
    </div>
  )
}
```

- [ ] **Step 2: Verificar el build**

Run: `npm run build`
Expected: Compila sin errores (el componente no se usa todavía en ningún sitio — eso es normal, no es dead code, se conecta en la Task 2).

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/FilterChipSelect.tsx
git commit -m "feat: FilterChipSelect, envoltorio visual tipo chip sobre el Select existente"
```

(Attribution: append `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` as a trailing line in the commit message.)

## Context

Este es el Task 1 de un ajuste de fidelidad visual sobre la Fase F2 (Pagos) ya implementada, para que coincida con el mock de referencia (`san javier.pen`, frame "09 · Finanzas / Pagos"). El mock usa un estilo de filtro tipo `Campo: Valor ⌄` (una píldora con borde). Se decidió NO construir un dropdown propio nuevo, sino envolver el `Select` HTML ya usado en toda la app (`src/components/ui/select.tsx`) con un contenedor que añade el label fijo y el chevron — así el comportamiento de filtrado no cambia en ningún sitio, solo la presentación en Pagos. El `Select` compartido no se toca en absoluto, para no afectar a Grupos/Eventos/Jugadores/etc.

---

## Task 2: Fila única de filtros + acciones (sustituye el toolbar y los 2 filtros)

**Files:**
- Modify: `src/pages/PaymentsPage.tsx`

- [ ] **Step 1: Añadir los imports necesarios**

En la cabecera de imports de `src/pages/PaymentsPage.tsx`, añadir `MoreHorizontal` a la lista ya importada de `lucide-react`:

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
  MoreHorizontal,
} from 'lucide-react'
```

Y añadir, junto al resto de imports de `@/components/...`:

```ts
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { FilterChipSelect } from '@/components/shared/FilterChipSelect'
```

- [ ] **Step 2: Quitar el selector de Mes de la fila superior (view toggle), solo para Mensual**

En la fila "View mode toggle + Year selector (always visible)", eliminar el bloque del selector de Mes (se traslada al nuevo bloque de filtros del Step 4):

Sustituir:

```tsx
            {/* Year selector (always shown) */}
            <Select
              options={availableYears.map((y) => ({ value: String(y), label: String(y) }))}
              value={String(selectedYear)}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full sm:w-32"
            />

            {/* Month selector only in monthly view */}
            {viewMode === 'mensual' && (
              <Select
                options={MONTHS.map((m) => ({ value: String(m.value), label: m.label }))}
                value={String(selectedMonth)}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full sm:w-40"
              />
            )}
          </div>
```

por:

```tsx
            {/* Year selector (always shown) */}
            <Select
              options={availableYears.map((y) => ({ value: String(y), label: String(y) }))}
              value={String(selectedYear)}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full sm:w-32"
            />
          </div>
```

- [ ] **Step 3: Simplificar el toolbar superior — solo Exportar XLSX para Anual/Morosidad**

Sustituir el bloque completo (el `<div className="flex flex-wrap items-center gap-3 px-6 pt-6">` de la Task 4 de la fase anterior, con todo su contenido):

```tsx
      <div className="flex flex-wrap items-center gap-3 px-6 pt-6">
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
```

por:

```tsx
      {viewMode !== 'mensual' && (
        <div className="flex flex-wrap items-center gap-3 px-6 pt-6">
          <Button variant="outline" size="sm" onClick={handleExportXLSX}>
            <Download className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Exportar XLSX</span>
          </Button>
        </div>
      )}
```

(Todo lo que se retira de aquí — XML SEPA, Conciliar SEPA, WhatsApp CSV, Facturar Pendientes, Generar cuotas, y la barra de selección — se reconstruye en los Steps 4-5 de esta task y en la Task 3. No se pierde ningún handler ni funcionalidad, solo cambia dónde se renderiza.)

- [ ] **Step 4: Sustituir el bloque de filtros de la vista Mensual por la fila única del mock**

Sustituir (el bloque completo "Monthly view filters", las 2 filas actuales):

```tsx
          {/* Monthly view filters */}
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
              <div className="flex flex-col sm:flex-row sm:items-center flex-wrap gap-3 pt-1 text-muted-foreground">
                <Select
                  options={[
                    { value: '', label: 'Todas las categorias' },
                    ...PAYMENT_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
                  ]}
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="h-8 w-full text-xs sm:w-44"
                />
                <Select
                  options={[
                    { value: '', label: 'Todas las temporadas' },
                    ...seasons.map((s) => ({ value: s.id, label: s.name })),
                  ]}
                  value={seasonFilter}
                  onChange={(e) => setSeasonFilter(e.target.value)}
                  className="h-8 w-full text-xs sm:w-44"
                />
              </div>
            </div>
          )}
```

por:

```tsx
          {/* Monthly view filters + actions (fiel al mock: una sola fila) */}
          {viewMode === 'mensual' && (
            <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por jugador o concepto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <FilterChipSelect
                label="Estado"
                options={[
                  { value: '', label: 'Todos' },
                  { value: 'pendiente', label: 'Pendiente' },
                  { value: 'vencido', label: 'Vencido' },
                  { value: 'pagado', label: 'Pagado' },
                  { value: 'cancelado', label: 'Cancelado' },
                ]}
                value={statusFilter}
                onChange={setStatusFilter}
              />
              <FilterChipSelect
                label="Método"
                options={[
                  { value: '', label: 'Todos' },
                  ...PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label })),
                ]}
                value={methodFilter}
                onChange={setMethodFilter}
              />
              <FilterChipSelect
                label="Mes"
                options={MONTHS.map((m) => ({ value: String(m.value), label: m.label }))}
                value={String(selectedMonth)}
                onChange={(v) => setSelectedMonth(Number(v))}
              />
              <FilterChipSelect
                label="Grupo"
                options={[
                  { value: '', label: 'Todos' },
                  ...groupOptions,
                ]}
                value={groupFilter}
                onChange={setGroupFilter}
              />
              <div className="flex-1" />
              <Button size="sm" onClick={handleGenerateReceipts} title="Generar recibos de cuotas mensuales">
                <FileText className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Generar recibos</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportXLSX}>
                <Download className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Exportar</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Más acciones">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuItem onClick={() => setWhatsappCSVOpen(true)}>
                    <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportSepaXML}>
                    <Download className="h-4 w-4 mr-2" /> XML SEPA
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSepaImportOpen(true)}>
                    <UploadCloud className="h-4 w-4 mr-2" /> Conciliar SEPA
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleBulkGenerateInvoices}>
                    <Receipt className="h-4 w-4 mr-2" /> Facturar Pendientes
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 space-y-2" onClick={(e) => e.stopPropagation()}>
                    <Select
                      options={[
                        { value: '', label: 'Todas las categorias' },
                        ...PAYMENT_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
                      ]}
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="w-full"
                    />
                    <Select
                      options={[
                        { value: '', label: 'Todas las temporadas' },
                        ...seasons.map((s) => ({ value: s.id, label: s.name })),
                      ]}
                      value={seasonFilter}
                      onChange={(e) => setSeasonFilter(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
```

Nota: el `onClick={(e) => e.stopPropagation()}` en el `<div>` que envuelve los dos `Select` dentro del menú es intencional — evita que un click dentro de esos selects se interprete como "click fuera" y cierre el `DropdownMenu` antes de que el usuario pueda elegir una opción.

- [ ] **Step 5: Verificar el build**

Run: `npm run build`
Expected: Compila sin errores.

- [ ] **Step 6: Verificación en vivo**

En `/finanzas/pagos`, vista Mensual: confirmar que la fila de filtros muestra Buscador, Estado/Método/Mes/Grupo como píldoras "Campo: Valor ⌄", y a la derecha "Generar recibos", "Exportar" y el botón "Más". Abrir "Más" y confirmar que WhatsApp CSV/XML SEPA/Conciilar SEPA/Facturar Pendientes siguen funcionando igual que antes, y que los selects de Categoría/Temporada dentro del menú permiten elegir una opción sin que el menú se cierre solo. Cambiar a Anual/Morosidad y confirmar que siguen mostrando su botón "Exportar XLSX" igual que siempre.

- [ ] **Step 7: Commit**

```bash
git add src/pages/PaymentsPage.tsx
git commit -m "feat: fila unica de filtros y menu de mas acciones en Pagos, fiel al mock"
```

(Attribution: append `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` as a trailing line in the commit message.)

## Context

Este task reordena visualmente controles que YA EXISTEN y funcionan (ningún handler nuevo, ningún filtro nuevo) — solo cambia su agrupación y presentación para que coincida con la única fila de filtros+acciones del mock. `handleExportXLSX`, `handleExportSepaXML`, `handleGenerateReceipts`, `handleBulkGenerateInvoices`, `setWhatsappCSVOpen`, `setSepaImportOpen` son todos handlers ya existentes sin cambios. El selector de Mes se traslada desde la fila compartida con Anual/Morosidad (donde ya solo se mostraba en Mensual) hasta esta fila — su comportamiento (`selectedMonth`/`setSelectedMonth`) no cambia. La selección múltiple (`canMarkPaid`/`canRemind`/`canInvoice`/`handleBulkMarkPaid`/`handleBulkRemind`) NO se toca en este task — su JSX se retira de aquí porque ya no vive en el toolbar superior, y se vuelve a insertar en la Task 3 dentro de la tabla.

---

## Task 3: Barra de selección dentro de la tabla

**Files:**
- Modify: `src/pages/PaymentsPage.tsx`

- [ ] **Step 1: Calcular el importe total seleccionado**

Junto a la declaración de `selectedPayments` (ya existente de la fase anterior), añadir:

```ts
  const selectedAmount = selectedPayments.reduce((sum, p) => sum + p.amount, 0)
```

- [ ] **Step 2: Insertar la barra de selección en la tabla**

Dentro del bloque de la vista Mensual, sustituir:

```tsx
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
```

por:

```tsx
            ) : (
              <Card>
                <CardContent className="p-0">
                  {selectedPaymentIds.size > 0 && (
                    <div className="flex flex-wrap items-center gap-3 border-b bg-accent/40 px-4 py-2.5">
                      <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm font-medium">
                        {selectedPaymentIds.size} recibo{selectedPaymentIds.size === 1 ? '' : 's'} seleccionado{selectedPaymentIds.size === 1 ? '' : 's'} · {formatCurrency(selectedAmount)}
                      </span>
                      <div className="flex-1" />
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
                  <Table>
```

(El resto del `<Table>...</Table>` no cambia — solo se añade la barra justo antes de él, dentro del mismo `CardContent`. El caso `filteredPayments.length === 0` de más arriba, que muestra el estado vacío en una `Card` distinta, no lleva barra de selección porque no puede haber filas seleccionadas si no hay filas.)

- [ ] **Step 3: Verificar el build**

Run: `npm run build`
Expected: Compila sin errores.

- [ ] **Step 4: Verificación en vivo**

En `/finanzas/pagos`, seleccionar varias filas y confirmar que la barra "N recibos seleccionados · X €" aparece dentro de la tabla, justo encima de la cabecera de columnas (no en la parte de arriba de la página), con los mismos 3 botones condicionales de antes funcionando igual (marcar cobrado, recordatorio, factura). Confirmar que el importe mostrado coincide con la suma real de los importes seleccionados.

- [ ] **Step 5: Commit**

```bash
git add src/pages/PaymentsPage.tsx
git commit -m "feat: mover la barra de seleccion de Pagos dentro de la tabla, fiel al mock"
```

(Attribution: append `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` as a trailing line in the commit message.)

## Context

`selectedPayments`, `canMarkPaid`, `canRemind`, `canInvoice`, `handleBulkMarkPaid`, `handleBulkRemind` ya existen (de la fase anterior) y no cambian de lógica — este task solo mueve DÓNDE se renderiza la barra que los usa: del toolbar superior (retirado en la Task 2) a dentro de la tabla, como en el mock. `formatCurrency` ya está importado en el archivo.

---

## Task 4: Verificación final

**Files:** ninguno (solo comandos)

- [ ] **Step 1: Suite completa**

Run: `npm test`
Expected: Todos los tests pasan (este ajuste no toca ninguna función testeada — solo JSX de `PaymentsPage.tsx` y un componente visual nuevo sin tests).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Compila sin errores.

- [ ] **Step 3: Recorrido manual comparando con el mock**

Con `npm run dev`, abrir `/finanzas/pagos` y comparar visualmente con el frame `WlxVY` del `san javier.pen`:
1. Una sola fila de filtros con las 4 píldoras (Estado/Método/Mes/Grupo) + Generar recibos + Exportar + Más.
2. El menú "Más" contiene WhatsApp CSV, XML SEPA, Conciliar SEPA, Facturar Pendientes, y los selects de Categoría/Temporada sin que se cierre el menú al usarlos.
3. Seleccionar filas y confirmar que la barra de selección aparece dentro de la tabla, no arriba.
4. Anual y Morosidad siguen mostrando su botón "Exportar XLSX" y funcionando exactamente igual que antes de este ajuste.

## Fuera de alcance

- Ningún comportamiento de negocio cambia (KPIs, filtro Vencido, selección múltiple, WhatsApp en cola) — solo su presentación/ubicación.
- No se construye un dropdown propio para los filtros.
- El riesgo de que un `<select>` nativo dentro de `DropdownMenuContent` cierre el menú prematuramente ya se mitigó con `stopPropagation` en el Step 4 de la Task 2 — si en la verificación en vivo se detecta que aun así ocurre en algún navegador, ese es el punto a revisar primero.
