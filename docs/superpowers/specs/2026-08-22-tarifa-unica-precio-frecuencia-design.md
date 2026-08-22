# Tarifa como única fuente de precio y frecuencia — Diseño

**Fecha:** 2026-08-22
**Estado:** aprobado, pendiente de plan de implementación

## Contexto

El usuario reportó un bug en el asistente de traspaso de temporada (`RenewGroupsDialog.tsx`): al cambiar la tarifa de un alumno en la tabla a una anual, el precio se queda con el valor de la tarifa anterior (p. ej. sigue mostrando 45 €/mes en vez de los ~400 € anuales de la nueva tarifa).

**Causa raíz**, confirmada en el código: `updateStudent(group.id, student.playerId, { tariffId: e.target.value })` (línea 273-275 de `RenewGroupsDialog.tsx`) solo actualiza `tariffId` — nunca toca `customPrice` ni `billingFrequency`. Esto es posible porque el diseño actual trata **Tarifa**, **Precio** y **Frecuencia** como tres campos independientes en la fila de cada alumno, cuando en realidad cada `Tariff` ya tiene su propio `price` y `billingFrequency` fijos (`src/types/index.ts:110-115`) — no son conceptos independientes.

El mismo patrón (una Tarifa fija inicialmente la frecuencia, pero luego un selector de "Frecuencia de facturación" aparte permite cambiarla sin ninguna relación con la tarifa elegida) existe también en:
- `src/pages/GroupDetailPage.tsx` (diálogo de alta de alumno, líneas 723-742 fija la frecuencia al elegir tarifa; líneas 820-828 la vuelven a ofrecer como selector independiente).
- `src/components/shared/MoveEnrollmentDialog.tsx` (líneas 183-194 fijan la frecuencia al elegir tarifa; líneas 228-235 la vuelven a ofrecer aparte).

El usuario confirmó que quiere corregir los tres sitios a la vez, para que queden consistentes entre sí.

## Decisión (validada con el usuario)

**Principio único**: una vez se elige una Tarifa, su frecuencia y su precio son los suyos — no se vuelven a ofrecer como campos sueltos editables que puedan desincronizarse. Si el admin quiere otra frecuencia, elige otra tarifa (una ya configurada con esa frecuencia). El precio de la tarifa se sigue pudiendo *anular* explícitamente (descuento, precio especial), pero eso ya funciona hoy correctamente en `GroupDetailPage.tsx`/`MoveEnrollmentDialog.tsx` (radio buttons "Precio tarifa" / "Descuento %" / "Precio especial") y no se toca.

Se confirmó además que el "mes de anclaje" a nivel de grupo (para alumnos nuevos que se matriculen después de un traspaso) **no existe como campo real en ningún sitio de la app** — `Group` no tiene `billingAnchorMonth` en su tipo (`src/types/index.ts`), y `generateMonthlyReceipts.ts` siempre lo deriva de `group.startDate` cuando una matrícula no tiene su propio anclaje. El campo `billingAnchorMonth` que hoy se envía en `groupData` al traspasar (`RenewGroupsDialog.tsx`, hardcodeado a `1`) es un valor muerto que nunca se lee — no es un hueco a rellenar, así que **no se añade ningún campo de anclaje a nivel de grupo**.

## Arquitectura

### 1. `src/pages/GroupDetailPage.tsx` (alta de alumno)

- Eliminar el bloque "Billing frequency" completo (líneas 820-828: `<Label>Frecuencia de facturación</Label>` + `<Select>`).
- El bloque "Anchor month" (líneas 830-853) se mantiene igual — sigue condicionado a `selectedBillingFrequency === 'quarterly' || 'annual'`, que ahora solo puede tomar esos valores si la tarifa elegida los tiene (ya lo hace: línea 738, `setSelectedBillingFrequency(tariff.billingFrequency)`).
- Añadir, dentro del bloque `{selectedTariffId && (...)}` que ya existe (líneas 745-818, el de precio/descuento), justo antes o junto al `<Label>Precio</Label>`, un texto de solo lectura mostrando la frecuencia derivada:
  ```tsx
  <p className="text-xs text-muted-foreground">
    Frecuencia: <span className="font-medium text-foreground">{billingFrequencyLabel(selectedBillingFrequency)}</span>
  </p>
  ```
- `billingFrequencyLabel` ya está importado en este archivo (línea 25).
- Quitar `BILLING_FREQUENCIES` del import de `@/constants` (línea 21) — queda sin uso tras este cambio (verificar con grep antes de borrar, por si se usa en otra parte del archivo).
- No se toca `handleAddPlayer`, `resetAddForm`, ni el estado `selectedBillingFrequency`/`selectedAnchorMonth` — siguen existiendo y comportándose igual, solo deja de haber un control de UI que los desincronice de la tarifa.

### 2. `src/components/shared/MoveEnrollmentDialog.tsx` (traslado entre grupos)

Mismo patrón:
- Eliminar el bloque "Frecuencia de facturación" (líneas 228-235).
- Añadir el texto de solo lectura de la frecuencia derivada, dentro del bloque `{selectedTariffId && (...)}` existente (líneas 197-226), cerca de la etiqueta "Precio":
  ```tsx
  <p className="text-xs text-muted-foreground">
    Frecuencia: <span className="font-medium text-foreground">{billingFrequencyLabel(selectedBillingFrequency)}</span>
  </p>
  ```
- Añadir `import { billingFrequencyLabel } from '@/lib/billing-utils'` (no existe todavía en este archivo).
- Quitar `BILLING_FREQUENCIES` del import de `@/constants` (línea 9) tras confirmar que queda sin uso.
- El bloque de "Mes de inicio del ciclo trimestral" / "Mes de pago anual" (líneas 237-246) se mantiene igual.

### 3. `src/components/shared/RenewGroupsDialog.tsx` (traspaso de temporada)

**a) Bloque de valores por defecto del grupo (líneas 192-229):**

Sustituir los campos `Precio` (Input) + `Frecuencia de facturación` (Select) por un único selector de Tarifa:
```tsx
<div>
  <Label>Tarifa por defecto</Label>
  <Select
    options={tariffs.filter((t) => t.isActive).map((t) => ({
      value: t.id,
      label: `${t.name} (${formatCurrency(t.price)})`,
    }))}
    value={draft.defaultTariffId}
    onChange={(e) => {
      const tariffId = e.target.value
      const tariff = tariffs.find((t) => t.id === tariffId)
      updateDraft(group.id, {
        defaultTariffId: tariffId,
        defaultTariffPrice: tariff?.price ?? 0,
        billingFrequency: tariff?.billingFrequency ?? 'monthly',
      })
    }}
  />
</div>
```
Las fechas de inicio/fin siguen igual, solo cambia el `grid-cols-2` a acomodar 3 celdas (Tarifa, Fecha inicio, Fecha fin) en vez de 4.

`GroupDraft` pierde su propósito de exponer `defaultTariffPrice`/`billingFrequency` como editables directamente — se mantienen como campos internos del draft (los sigue necesitando `handleConfirm` para construir `groupData`), pero ahora se derivan de `defaultTariffId` en el `onChange` de arriba, nunca se editan sueltos. `defaultTariffId` debe añadirse al estado inicial del draft (hoy no existe — se inicializa a partir de `g.defaultTariffId` del grupo viejo, igual que ya se hace para `defaultTariffPrice`/`billingFrequency`).

`billingAnchorMonth` desaparece del `GroupDraft` y de lo que se envía en `groupData` en `handleConfirm` (era un valor muerto, ver Contexto).

**b) Tabla de alumnos (líneas 241-323):**

- Columna "Frecuencia" (líneas 291-301, el `<Select>` de `BILLING_OPTIONS`) se elimina como columna editable independiente. En su lugar, se muestra la frecuencia derivada de la tarifa de esa fila como texto, dentro de la misma celda donde antes iba el Select:
  ```tsx
  <td className="p-1.5 text-slate-600">
    {billingFrequencyLabel(student.billingFrequency)}
  </td>
  ```
  (el campo `student.billingFrequency` se sigue guardando en el `StudentDraft` — solo deja de ser editable por su cuenta; se actualiza automáticamente cuando cambia `tariffId`, ver siguiente punto).

- El `onChange` del Select de "Tarifa" (líneas 270-278) pasa de solo actualizar `tariffId` a actualizar también `customPrice` y `billingFrequency` a partir de la tarifa recién elegida:
  ```tsx
  onChange={(e) => {
    const tariffId = e.target.value
    const tariff = tariffs.find((t) => t.id === tariffId)
    updateStudent(group.id, student.playerId, {
      tariffId,
      customPrice: tariff?.price ?? 0,
      billingFrequency: tariff?.billingFrequency ?? 'monthly',
    })
  }}
  ```
  Esto es exactamente el fix del bug reportado: cambiar de tarifa ahora sincroniza precio y frecuencia en el mismo gesto, en vez de dejar el precio de la tarifa anterior.

- La columna "Precio" (líneas 280-290) se mantiene editable tal cual — sigue siendo un override manual (para descuentos puntuales), simplemente ahora arranca siempre con el valor correcto de la tarifa recién elegida en vez de arrastrar un valor obsoleto.

- La columna "Anclaje" (líneas 302-316) se mantiene con la misma condición (`quarterly`/`annual`), pero se corrige para mostrar nombres de mes en vez de números — hoy usa `Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))` (línea 310), se sustituye por `MONTHS.map((m) => ({ value: String(m.value), label: m.label }))`, igual que ya hacen `GroupDetailPage.tsx`/`MoveEnrollmentDialog.tsx`. Requiere añadir `MONTHS` al import de `@/constants` (hoy este archivo no lo importa).

- Añadir `import { billingFrequencyLabel } from '@/lib/billing-utils'`.
- `BILLING_OPTIONS` (constante local del archivo, líneas 43-48) deja de usarse en la tabla de alumnos, pero se sigue necesitando en ningún otro sitio de este archivo tras el cambio — comprobar con grep si queda algún uso; si no queda ninguno, eliminar la constante.

## Fuera de alcance

- No se toca `generateMonthlyReceipts.ts` ni `firestoreSync.ts` (generación de recibos) — siguen funcionando igual, ya que consumen `billingFrequency`/`customPrice` de la matrícula, no de la UI.
- No se toca el mecanismo de "Precio tarifa / Descuento % / Precio especial" de `GroupDetailPage.tsx`/`MoveEnrollmentDialog.tsx` — ya funciona correctamente y no es parte del bug.
- No se añade ningún campo de anclaje a nivel de grupo en `RenewGroupsDialog.tsx` (ver Decisión) — sería un campo sin ningún efecto real, inconsistente con `GroupsPage.tsx`.
- No se toca la fórmula de precio en sí (ya se corrigió en una sesión anterior, "importe fijo por ciclo") — este spec es exclusivamente sobre que Tarifa sea la única fuente de precio+frecuencia en estos tres diálogos.

## Verificación manual

1. `npm run build` y `npm test` en verde.
2. **Alta de alumno** (`GroupDetailPage.tsx`): abrir "Añadir alumno", elegir una tarifa mensual → confirmar que ya no aparece un selector de frecuencia aparte, solo el texto "Frecuencia: Mensual". Cambiar a una tarifa anual → el texto cambia a "Frecuencia: Anual" y aparece el selector de mes de anclaje con nombres de mes.
3. **Traslado** (`MoveEnrollmentDialog.tsx`): mismo comportamiento que el punto 2, en el flujo de "Usar tarifa del grupo destino".
4. **Traspaso de temporada** (`RenewGroupsDialog.tsx`):
   - Arriba: confirmar que aparece un único selector "Tarifa por defecto" (no Precio+Frecuencia sueltos), y que cambiar la tarifa actualiza el precio/frecuencia internos usados al confirmar.
   - Abajo: en la tabla, cambiar la tarifa de un alumno de una mensual a una anual → confirmar que el Precio de esa fila cambia inmediatamente al precio de la tarifa anual (no se queda en el valor mensual anterior), que la columna de frecuencia muestra "Anual", y que aparece el selector de anclaje con nombres de mes (Enero, Febrero...) en vez de números.
   - Confirmar el traspaso y comprobar que la matrícula nueva del alumno queda con el `billingFrequency`/`customPrice`/`billingAnchorMonth` correctos (coincidentes con la tarifa elegida en la fila).
5. Confirmar que ningún archivo queda con imports sin usar (`BILLING_FREQUENCIES`, `BILLING_OPTIONS`) tras los cambios.
