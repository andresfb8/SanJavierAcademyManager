# Facturación: usar la tarifa de cada matrícula, no la del grupo

## Contexto

Investigando por qué 6 de los 8 grupos "Escuela Menores" no tenían ningún
recibo generado para septiembre 2026, se encontró la causa real: la
generación de recibos exige que `group.installmentPrices['2026-09']`
exista (una copia congelada del calendario de la tarifa, tomada el día
en que se asignó al grupo); en esos 6 grupos esa copia no incluye
septiembre, aunque la tarifa en sí ya lo tenga. Pulsar "Generar cuotas"
no crea nada porque el código salta la matrícula en silencio cuando esa
clave falta (`src/lib/firestoreSync.ts:411-416`).

Al mirar el código con más detalle apareció un problema más amplio y ya
existente: **cada matrícula (`Enrollment`) guarda su propia tarifa desde
hace tiempo** (`tariffId`, `tariffName`, `customPrice?`,
`billingFrequency?`), pero **la generación de recibos nunca la lee** —
usa siempre el precio/calendario del grupo (`group.defaultTariffPrice` /
`group.installmentPrices`). Esto afecta a las 4 frecuencias de
facturación, no solo a cuotas: cualquier alumno con una tarifa distinta
a la del grupo, sin haber marcado "Precio especial" a mano, se factura
con el importe equivocado (el del grupo, no el suyo).

Se confirmó con datos reales de `main` que:
- `Enrollment.tariffId` ya está correctamente asignado por alumno en
  toda la base de datos actual (verificado en varios grupos de menores
  con tarifas mixtas dentro del mismo grupo).
- Las tarifas de cuotas en uso (`Escuela Menores Federada 2026/2027`,
  `Cuota Interescuelas 2026/2027`) sí tienen septiembre configurado.
- `RenewGroupsDialog.tsx` (traspaso de temporada) y
  `MoveEnrollmentDialog.tsx` (mover a otro grupo, ya arreglado hoy en
  otro commit) ya permiten elegir la tarifa por alumno y nunca escriben
  nada en el grupo — el dato individual siempre ha sido correcto.

**Decisión de alcance (ya acordada con el usuario):**
- Arreglo mínimo: la generación de recibos pasa a leer siempre la
  tarifa individual de la matrícula. El campo de tarifa del grupo
  (`defaultTariffId`/`defaultTariffPrice`/`billingFrequency`/
  `installmentPrices`) **no se elimina** — se queda como valor por
  defecto al añadir un alumno nuevo a ese grupo, que es lo único para lo
  que ya se usaba en la práctica.
- Cubre las 4 frecuencias de facturación (mensual/trimestral/anual/
  cuotas), no solo cuotas.
- No hace falta migrar ni revisar los grupos existentes uno a uno: el
  arreglo vive en el código de generación, no en los datos — cada
  matrícula ya tiene el dato correcto guardado.
- Fuera de alcance: eliminar los campos de tarifa del grupo; unificar
  los dos sistemas de generación (cliente vs función programada) en uno
  solo; auditar recibos de meses pasados ya generados con importe
  incorrecto en grupos con tarifas mixtas; los pagos manuales de "Cuota
  parcial" ya existentes (se revisan aparte, después de desplegar).

## Diseño

### 1. Función pura compartida: `resolveEnrollmentAmount`

Nueva función en `src/lib/billing-utils.ts` (que ya tiene test suite),
con tests TDD. Sustituye la lógica de "calcular importe" repetida hoy en
3 sitios del cliente.

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
 * `null` significa "no se puede facturar este mes" (tarifa sin precio
 * para ese mes en cuotas, o tarifa sin precio base en el resto de
 * frecuencias) — el caller debe saltar la matricula, no caer de vuelta
 * a ningun precio de grupo.
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

`billingKey` sigue el formato ya usado por los 4 sitios de generación:
`` `${year}-${String(month).padStart(2, '0')}` `` (p. ej. `"2026-09"`).

### 2. `src/lib/firestoreSync.ts` — `generateMonthlyReceiptsAtomic`

Se añade un `tariffsMap` junto al `groupsMap` ya existente (mismo
patrón: una query a la colección `tariffs` filtrada por `clubId`, sin
filtrar por `isActive` — una matrícula antigua debe poder seguir
resolviendo su tarifa aunque ya no esté activa para altas nuevas).

Se sustituye el bloque de comprobación de mes (líneas 410-416) y el de
cálculo de importe (líneas 439-446) por: resolver
`tariffsMap.get(enrollment.tariffId)`; si no existe, saltar la matrícula
con un `console.warn` (mismo criterio que "grupo no encontrado" unas
líneas antes); si existe, llamar a `resolveEnrollmentAmount(...)` y
saltar si devuelve `null`.

`group` se sigue usando para todo lo demás (nombre, frecuencia de
fallback para matrículas antiguas sin `billingFrequency` propio, fecha
de fin de ciclo) — solo el importe deja de venir del grupo.

### 3. `functions/src/billing/generateMonthlyReceipts.ts`

Mismo cambio reflejado: nueva interfaz `Tariff` (espejo de la del
cliente), `tariffsMap` cargado junto a `groupsMap` en `processClub`,
mismo reemplazo del cálculo de importe. Se añade `resolveEnrollmentAmount`
a `functions/src/billing/billing-utils.ts`, con un comentario que remite
a `src/lib/billing-utils.ts` como la versión con tests — `functions/` no
tiene infraestructura de test hoy, no se añade solo para esto.

### 4. `src/stores/dataStore.ts` — `generateScheduledInstallments`

Esta función solo existe para `billingFrequency === 'installments'` (el
botón "Generar" de la ficha del alumno, para cuotas sueltas). Cambia de
iterar `Object.entries(group.installmentPrices)` a iterar
`Object.entries(tariff.installmentPrices)`, donde `tariff =
get().tariffs.find(t => t.id === enrollment.tariffId)`. Si no hay
tariff o no es de cuotas, se devuelve `0` igual que hoy.

### 5. `src/pages/PlayerProfilePage.tsx` — `ungeneratedInstallments`

Mismo cambio: añadir `tariffs` a la desestructuración de
`useDataStore()` (no está hoy), y resolver el calendario desde
`tariffs.find(t => t.id === enrollment.tariffId)?.installmentPrices` en
vez de `group.installmentPrices`.

### 6. Arreglos de visualización (mismo bug, en pantalla)

- `GroupDetailPage.tsx:542`: `const price = enrollment.customPrice ??
  tariffs.find(t => t.id === enrollment.tariffId)?.price ??
  group.defaultTariffPrice` (el `?? group.defaultTariffPrice` final es
  solo defensivo, para el caso de tarifa borrada). Además, cuando la
  frecuencia resuelta de la matrícula es `installments`, la columna
  "Precio" pasa a mostrar "Según cuotas" en vez de un importe único —
  mismo criterio ya usado en el diálogo "Añadir jugador" de esta misma
  página y en `MoveEnrollmentDialog.tsx`, porque un cuota varía mes a
  mes y mostrar un solo número ahí ya era engañoso incluso antes de este
  bug.
- `PlayerProfilePage.tsx:840`: mismo cambio de fuente de precio
  (`enrollment.customPrice ?? tariffs.find(...)?.price ??
  group?.defaultTariffPrice ?? 0`), sin el tratamiento especial de
  "Según cuotas" (esta vista no tiene una columna de frecuencia visible
  al lado, se deja el número tal cual — coherente con el resto de esa
  tarjeta).

## Verificación

- Tests TDD para `resolveEnrollmentAmount` en `billing-utils.test.ts`
  (los 4 casos: monthly con tariffPrice, installments con clave
  presente, installments con clave ausente → `null`, customPrice
  siempre gana a cualquier otra cosa).
- `npm run build` y `npm test` en cada paso.
- Verificación en vivo (Playwright contra los datos reales de `main`,
  sin escribir nada): reabrir la ficha de "Escuela Menores 4" y
  confirmar que la columna "Precio" ya no depende del grupo; pulsar
  "Generar cuotas" para septiembre 2026 y confirmar que esta vez sí
  crea recibos para los alumnos que faltaban, con el importe correcto
  de su propia tarifa.
- La función programada (`generateMonthlyReceiptsScheduled`) no se
  puede probar en vivo sin desplegarla — se verifica por lectura
  cuidadosa comparando línea a línea con la versión del cliente ya
  probada, igual que se hizo en el arreglo anterior de este mismo
  archivo (comentario existente: "igual que ya hace
  src/lib/firestoreSync.ts").

## Despliegue

- El arreglo de `firestoreSync.ts` (botón "Generar cuotas") se activa
  con el próximo `firebase deploy --only hosting`.
- El arreglo de `generateMonthlyReceipts.ts` (cron del día 1) necesita
  `firebase deploy --only functions` aparte — sin ese paso, el cron
  seguiría teniendo el bug el mes que viene aunque el botón manual ya
  esté arreglado. Se pedirá confirmación explícita antes de desplegar
  nada, dado que esto son cambios reales de facturación en producción.

## Fuera de alcance / riesgos conocidos

- Los recibos de meses pasados ya generados con el importe del grupo en
  vez del de la tarifa individual (si los hay, en grupos con tarifas
  mixtas) no se corrigen aquí — sería una tarea de auditoría de datos
  aparte.
- Los pagos manuales de "Cuota parcial" ya creados a mano (p. ej. Jairo
  Aguilar García, 370€ en septiembre) no se tocan; se recomienda
  revisarlos después de generar los recibos que faltan, por si el
  importe atípico esconde un intento de parche manual que ahora
  duplicaría al generar automáticamente.
- Backfill de septiembre: una vez desplegado, pulsar "Generar cuotas"
  para septiembre 2026 generará los recibos que faltan a los ~26
  alumnos afectados. Esto crea obligaciones de pago reales — se pedirá
  confirmación antes de pulsarlo, igual que la vez anterior.
