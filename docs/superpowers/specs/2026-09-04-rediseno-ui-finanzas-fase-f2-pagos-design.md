# Rediseño de interfaz — Módulo Finanzas, Fase F2 (Pagos)

## Contexto

Segunda fase de terminar Finanzas (tras la F1, Resumen). Mockup de
referencia en `san javier.pen`, frame `WlxVY` ("09 · Finanzas / Pagos").
Hoy `PaymentsPage.tsx` ya es una página rica y funcional (filtros,
selección múltiple para facturar, exportación XLSX/SEPA, conciliación),
pero vive fuera de `FinanzasLayout`, con su propio `<Header>` suelto, sin
las pestañas compartidas del resto de Finanzas.

Investigación previa confirmó que casi todo lo que pide el mock ya
existe en el código (ver sección "Ya existe" más abajo) — este cambio es
sobre todo de reorganización visual y de cerrar 2-3 huecos funcionales
concretos, no una reconstrucción.

**Decisiones de alcance ya acordadas con el usuario:**
- Las vistas **Anual** y **Morosidad** (con su toggle actual) se dejan
  intactas — el mock solo cubre la vista "Mensual" de Pagos. Anual se
  revisará cuando llegue la Fase F5 (Análisis), que sí tiene mock propio
  para un gráfico de 12 meses.
- Los estados **"Devuelto"** y **"Emitido"** del mock (ciclo de vida de
  una remesa SEPA: emitida → cobrada o devuelta) se dejan fuera de esta
  fase — son features nuevas de verdad, no una restyling. Si se
  abordan, se hacen juntas en una fase propia.
- El estado **"Vencido"** SÍ se incluye: es un estado derivado (pendiente
  + `dueDate` pasado), sin cambio de modelo de datos, y ya es un
  concepto de primera clase en el Resumen (Fase F1: KPI "Morosidad",
  tarjeta "Requiere tu atención"). Esta fase completa el enlace que la
  F1 dejó pendiente: los avisos de "recibos vencidos" del Resumen
  apuntan a `/finanzas/pagos` pero hoy no hay ninguna forma de filtrar
  por vencido ahí — esta fase lo añade.

## Ya existe (no se reconstruye)

- Filtros: Estado, Grupo, Temporada, Categoría, Mes, Año.
- Selección múltiple → "Generar factura (N)" (solo filas pagadas sin
  factura).
- Botones: Exportar XLSX, XML SEPA, Conciliar SEPA, WhatsApp CSV, Nuevo
  pago (ahora `AddManualPaymentDialog` extraído), Facturar Pendientes,
  Generar cuotas.
- Acciones por fila: marcar pagado, deshacer, editar, eliminar, aviso
  WhatsApp individual.

## Diseño

### 1. Migrar a `FinanzasLayout`

`PaymentsPage.tsx` deja de renderizar su propio `<Header>` y usa
`useOutletContext<FinanzasOutletContext>()` para registrar su acción
primaria, igual que `ResumenPage.tsx`:

```tsx
useEffect(() => {
  setPrimaryAction({ label: 'Registrar cobro', icon: Plus, onClick: () => setManualDialogOpen(true) })
  return () => setPrimaryAction(null)
}, [setPrimaryAction])
```

reutilizando el mismo `AddManualPaymentDialog` ya usado en Resumen y en
el botón "Nuevo pago" actual — se retira el botón "Nuevo pago" del
toolbar (ahora es la acción primaria del topbar, no un botón más de la
fila de controles).

### 2. Subtítulo y contador de la pestaña "Pagos" en `FinanzasLayout`

`FinanzasLayout.tsx` extiende su `subtitle` (hoy solo definido para
Resumen) para la pestaña Pagos:

```ts
const subtitle = isResumen
  ? `Resumen de ${...}`
  : isPagos
    ? `Pagos · ${MONTHS.find(m => m.value === now.getMonth() + 1)?.label.toLowerCase()} ${now.getFullYear()} · ${pagosCount} recibos de la temporada`
    : undefined
```

reutilizando `pagosCount`, el mismo número ya calculado para el badge
de la pestaña "Pagos (N)" (temporada activa) — no hace falta traer
ningún dato nuevo desde `PaymentsPage.tsx`.

### 3. KPIs (Stat Strip) — 4 tarjetas `StatCard`, sobre el mes seleccionado en la página

Nueva función en `finance-analytics.ts`, `paymentsKpis`, que NO reutiliza
`collectionBreakdown` (esa función filtra a `source === 'cuota' |
'manual'`; aquí se necesita **todas** las fuentes, igual que
`attentionItems`):

```ts
export interface PaymentsKpis {
  paidAmount: number; paidCount: number
  pendingAmount: number; pendingCount: number
  overdueAmount: number; overdueCount: number
}

export function paymentsKpis(
  payments: NormalizedPayment[],
  monthKeys: Set<string>,
  now: Date = new Date()
): PaymentsKpis {
  let paidAmount = 0, paidCount = 0, pendingAmount = 0, pendingCount = 0, overdueAmount = 0, overdueCount = 0
  for (const p of payments) {
    if (!monthKeys.has(monthKeyOf(p))) continue
    if (p.status === 'pagado') { paidAmount += p.amount; paidCount++ }
    else if (p.status === 'pendiente') {
      if (p.dueDate && new Date(p.dueDate) < now) { overdueAmount += p.amount; overdueCount++ }
      else { pendingAmount += p.amount; pendingCount++ }
    }
  }
  return { paidAmount, paidCount, pendingAmount, pendingCount, overdueAmount, overdueCount }
}
```

(`monthKeyOf` ya es una función privada del archivo — se reutiliza tal
cual, no se exporta a propósito, igual que dentro del propio archivo.)

- **Cobrado**: `paidAmount` / `paidCount` recibos.
- **Pendiente**: `pendingAmount` / `pendingCount` recibos.
- **Vencido**: `overdueAmount` / `overdueCount` recibos.
- **Devueltos**: NO viene de `paymentsKpis` — se cuenta aparte,
  filtrando `payments` (los `Payment` base, no normalizados) por
  `category === 'otro'` y `concept === 'Recargo por devolución SEPA'`
  dentro del mes seleccionado. Es la única huella real que deja hoy una
  devolución SEPA (ver Fase de Devuelto/Emitido, fuera de alcance). El
  KPI muestra el número de recargos de ese tipo ese mes, con el importe
  total como subtítulo.

### 4. Filtros — fila principal + fila secundaria

Fila principal (igual jerarquía visual que el mock): Buscador, Estado
(añadir "Vencido" como opción — ver punto 5), **Método de pago** (nuevo:
filtra por `payment.paymentMethod`, dato que ya existe pero hoy no es
filtrable), Grupo.

Fila secundaria (igual criterio que Grupos/Eventos: subordinada,
`text-muted-foreground`): Categoría, Temporada, Mes, Año — los 4 filtros
que ya existen y siguen existiendo, solo bajados de jerarquía visual
porque no están en el mock.

### 5. "Vencido" como opción del filtro Estado

`statusFilter` (hoy `'' | PaymentStatus`) pasa a admitir también
`'vencido'` como valor especial de UI (no es un `PaymentStatus` real):

```ts
const matchesStatus =
  !statusFilter ? true
  : statusFilter === 'vencido' ? (p.status === 'pendiente' && p.dueDate && new Date(p.dueDate) < new Date())
  : p.status === statusFilter
```

Las opciones del select pasan a ser: Todos los estados, Pendiente,
Vencido, Pagado, Cancelado (orden pensado para poner Vencido junto a
Pendiente, ya que es un subconjunto suyo).

### 6. Enlace real desde "Requiere tu atención" del Resumen

`attentionItems` en `finance-analytics.ts` ya construye
`href: '/finanzas/pagos'` para el aviso de vencidos (Fase F1). Se
extiende a `/finanzas/pagos?estado=vencido`, y `PaymentsPage.tsx` lee ese
query param al montar para preseleccionar `statusFilter = 'vencido'` —
cierra el hueco que la F1 dejó documentado como pendiente.

### 7. Selección múltiple y acciones en lote

Hoy el checkbox de una fila solo existe si `status === 'pagado' &&
!invoiceId` (para poder facturar). Se cambia a: **cualquier fila es
seleccionable**. La barra de selección (`Selection Bar` del mock) pasa a
mostrar cada acción solo si aplica a la mezcla de filas seleccionadas:

- **Marcar como cobrado**: visible si hay alguna fila seleccionada con
  `status === 'pendiente'`. Al confirmar, recorre esas filas llamando a
  `markPaymentPaid`/`markEventPaymentPaid`/`markPrivateLessonPaymentPaid`
  según `source`, igual patrón que ya usa `handleProcessConciliation`.
- **Enviar recordatorio**: visible si hay alguna fila pendiente/vencida
  con teléfono conocido. Reutiliza `WhatsAppNotificationDialog` ya
  usado para el aviso individual, pasándole la lista completa
  seleccionada en vez de un solo pago.
- **Emitir factura**: comportamiento actual sin cambios (solo filas
  pagadas sin factura).

### 8. Tabla

Columnas del mock (Jugador+grupo, Concepto, Vencimiento, Método,
Importe, Estado, Acciones) ya se corresponden 1:1 con las columnas
actuales de `PaymentsPage.tsx` — solo cambia el estilo del chip de
Estado para incluir el color de "Vencido" (mismo ámbar/rojo que ya usa
el Resumen para overdue) y se quita cualquier resto visual de
"Devuelto"/"Emitido" del mock (esas filas se muestran con su estado real
actual: Pendiente).

## Fuera de alcance (decisiones ya tomadas)

- Estados "Devuelto"/"Emitido" como estados reales del ciclo SEPA.
- Paginación de la tabla (el mock la muestra; no se añade en esta fase
  salvo que se pida explícitamente — el volumen actual de recibos por
  mes no lo requiere todavía).
- Vistas Anual y Morosidad — sin tocar.

## Verificación

- Tests para `paymentsKpis` (todas las fuentes, no solo cuota/manual;
  vencido vs pendiente por `dueDate`).
- Build + suite completa.
- Verificación en vivo: aplicar el filtro Estado=Vencido y confirmar que
  coincide con el nº de "recibos vencidos" mostrado en el Resumen para
  el mismo mes; seleccionar varias filas pendientes y confirmar que
  "Marcar como cobrado" las marca todas; entrar desde el aviso de
  "Requiere tu atención" del Resumen y confirmar que Pagos abre ya
  filtrado por Vencido.
