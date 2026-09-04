# Fase F2 (Pagos) — ajuste de fidelidad al mock

## Contexto

La Fase F2 (Pagos) ya está implementada y funcionando (ver
`2026-09-04-rediseno-ui-finanzas-fase-f2-pagos-design.md` y su plan). Al
comparar el resultado con el mock (`WlxVY`, "09 · Finanzas / Pagos") se
encontraron 5 desajustes estructurales, no solo de color/espaciado.
Este documento cubre solo esos ajustes — nada de lo ya construido
funcionalmente (KPIs, filtro Vencido, selección múltiple, WhatsApp en
cola) cambia de comportamiento, solo de ubicación/presentación visual.

**Decisiones ya acordadas con el usuario:**
- Los filtros mantienen el `<select>` HTML actual (`Select`), pero con
  una nueva presentación visual tipo "chip" (`Campo: Valor ⌄`) — no se
  construye un dropdown propio nuevo.
- Los 4 botones que el mock no muestra (XML SEPA, Conciliar SEPA,
  WhatsApp CSV, Facturar Pendientes) pasan a un menú "Más acciones".
- Los filtros Categoría y Temporada (añadidos en la fase anterior, sin
  equivalente en el mock) se mueven dentro de ese mismo menú, no se
  eliminan.

## Diseño

### 1. Nuevo componente `FilterChipSelect`

`src/components/shared/FilterChipSelect.tsx` — envuelve el `Select` ya
existente sin tocarlo, para no afectar a Grupos/Eventos/etc. Renderiza
un contenedor tipo píldora con el label fijo, el `<select>` transparente
sin borde propio, y un chevron:

```tsx
interface FilterChipSelectProps {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export function FilterChipSelect({ label, options, value, onChange, className }: FilterChipSelectProps) {
  return (
    <div className={cn("flex h-9 items-center gap-1.5 rounded-full border border-input bg-background pl-3 pr-2.5", className)}>
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

### 2. Una sola fila de filtros + botones (sustituye las 2 filas actuales)

Orden, de izquierda a derecha, igual que el mock: Buscador (input libre,
sin cambios), `FilterChipSelect` Estado (con "Vencido" ya incluido),
`FilterChipSelect` Método, `FilterChipSelect` Mes (el que hoy vive en la
fila superior compartida con Anual/Morosidad — se retira de ahí y se
mueve aquí, solo se renderiza en vista Mensual igual que hoy), `FilterChipSelect`
Grupo, un `Grow` (spacer), botón "Generar recibos" (mismo handler que
"Generar cuotas" de hoy, solo cambia la etiqueta visible), botón
"Exportar" (mismo handler que "Exportar XLSX" de hoy), y un botón
"Más" (icono `MoreHorizontal`) que abre un `DropdownMenu` con: XML SEPA,
Conciliar SEPA, WhatsApp CSV, Facturar Pendientes (como
`DropdownMenuItem`, cada uno con su handler actual sin cambios), un
`DropdownMenuSeparator`, y dentro del mismo contenido del menú (no como
`DropdownMenuItem`, para que el `<select>` nativo funcione con su propio
popup) los filtros Categoría y Temporada como `Select` normales con su
label encima.

El selector de Año permanece donde está hoy (fila superior, compartida
con Anual/Morosidad) — no se toca, porque esa fila no es específica de
esta fase.

### 3. Barra de selección dentro de la tabla, no en el toolbar

Se retira la barra condicional que hoy vive junto a los botones de
arriba. En su lugar, dentro del `<Card><CardContent className="p-0">`
que envuelve la tabla, justo antes de `<Table>`, se renderiza (solo si
`selectedPaymentIds.size > 0`):

```tsx
<div className="flex items-center gap-3 border-b bg-accent/40 px-4 py-2.5">
  <CheckCircle className="h-4 w-4 text-primary shrink-0" />
  <span className="text-sm font-medium">
    {selectedPaymentIds.size} recibo{selectedPaymentIds.size === 1 ? '' : 's'} seleccionado{selectedPaymentIds.size === 1 ? '' : 's'} · {formatCurrency(selectedAmount)}
  </span>
  <div className="flex-1" />
  {canMarkPaid && (...)}
  {canRemind && (...)}
  {canInvoice && (...)}
</div>
```

donde `selectedAmount = selectedPayments.reduce((s, p) => s + p.amount, 0)`
(nuevo, junto a `selectedPayments`). Los 3 botones son los mismos que ya
existen hoy (mismos handlers `handleBulkMarkPaid`/`handleBulkRemind`/
`setShowGenerateInvoiceDialog`), solo cambia dónde se renderizan.

### 4. Toolbar superior queda solo con lo que no es de esta página

Tras quitar Exportar/Generar cuotas/Nuevo pago/Selección de la fila de
arriba (todo se mueve a los puntos 2 y 3), esa fila de la Task 4 queda
vacía en vista Mensual — se elimina por completo para esta vista (el
`<div className="flex flex-wrap items-center gap-3 px-6 pt-6">` ya no
tiene contenido que mostrar en Mensual). Anual y Morosidad no tenían
más que el botón "Exportar XLSX" ahí — como ese botón se mueve dentro
de la fila de filtros solo para Mensual, Anual/Morosidad necesitan
conservar su propio "Exportar XLSX" en algún sitio: se deja en el mismo
`<div>` de arriba, pero ahora troceado a `viewMode !== 'mensual'`
(antes estaba fuera de cualquier condición de vista).

## Riesgo a verificar

Un `<select>` nativo dentro de `DropdownMenuContent` (Radix) puede
cerrarse prematuramente en algunos navegadores si el popup nativo del
select se interpreta como "click fuera". Si ocurre, la solución es
envolver esos dos selects en un `<div onClick={(e) => e.stopPropagation()}>`
dentro del `DropdownMenuContent` — dejarlo documentado como fallback si
la verificación en vivo lo detecta.

## Fuera de alcance

- Ningún comportamiento de negocio cambia (KPIs, filtro Vencido, lote,
  WhatsApp) — solo ubicación/presentación.
- No se construye un dropdown propio para los filtros — se usa el
  `Select` existente envuelto en `FilterChipSelect`.
- Vistas Anual/Morosidad no cambian salvo conservar su botón Exportar.
