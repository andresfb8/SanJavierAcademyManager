# Fix: traspaso de temporada no traspasa todos los grupos/alumnos — Diseño

**Fecha:** 2026-08-28
**Estado:** aprobado, pendiente de plan de implementación
**Rama:** `claude/fix-traspasos-temporada`

## Contexto

El usuario reportó que el traspaso de temporada (`RenewGroupsDialog.tsx`) "no funciona bien del
todo": no siempre se traspasan todos los grupos/alumnos, no se pueden elegir todas las tarifas
por alumno, y algunos alumnos no se pueden traspasar porque "su cuota no coincide".

## Investigación (causa raíz)

Los tres síntomas tienen una causa raíz común más dos problemas relacionados, todos
verificados leyendo el código (no son hipótesis):

1. **Las tarifas se pueden borrar de verdad aunque sigan en uso.** `deleteTariff`
   (`src/stores/dataStore.ts:605-610`) elimina la tarifa de Firestore y del estado sin comprobar
   si alguna matrícula activa o algún grupo activo la sigue referenciando. El diálogo de
   confirmación en `SettingsPage.tsx:793` dice *"Esta tarifa dejará de estar disponible para
   nuevas asignaciones"* — dando a entender que las asignaciones existentes no se tocan, cosa que
   el código no cumple. Ya existe una forma segura de retirar una tarifa (el toggle
   Activa/Inactiva del formulario de edición); "Eliminar" es un botón aparte y destructivo, sin
   ese aviso.

2. **Un alumno con tarifa borrada tumba el traspaso de TODO su grupo.** En `renewGroup`
   (`src/stores/dataStore.ts:1265-1288`), las nuevas matrículas se construyen con un `.map()`
   síncrono que hace `throw new Error('Tarifa no encontrada para X')` si la tarifa de un alumno
   ya no existe. El `throw` ocurre antes de escribir nada en Firestore, así que aborta el
   traspaso del grupo entero (todos sus alumnos, rotos o no) — no solo el de ese alumno.
   `renewGroups` (plural) captura el fallo por grupo y sigue con el resto de grupos del lote, así
   que unos grupos se traspasan y otros no, sin que el usuario sepa de antemano cuáles ni por qué.

3. **El diálogo no avisa antes de intentarlo.** `RenewGroupsDialog.tsx` no valida nada antes de
   dejar pulsar "Confirmar traspaso" — el primer indicio de un alumno roto es el fallo del lote
   completo tras confirmar.

4. **El selector de tarifa por alumno excluye las tarifas de "cuotas" a propósito**
   (`RenewGroupsDialog.tsx:308-314`), salvo que sea la que el alumno ya tenía asignada. El
   selector de tarifa por defecto del grupo (mismo diálogo, líneas 219-235) sí permite cualquier
   tarifa activa — la restricción solo existe a nivel de alumno, es inconsistente y es la causa
   directa de "no puedo elegir todas las tarifas".

   Se investigó si abrir este selector a tarifas de cuotas podría generar facturación incorrecta
   (ya hay un problema conocido y documentado: elegir una tarifa de cuotas escribía el total de
   temporada como si fuera un importe recurrente). Se confirmó que `Enrollment` no tiene su
   propio calendario de cuotas (`src/types/index.ts:274-291` no incluye `installmentPrices`) —
   la facturación de cuotas siempre usa `group.installmentPrices` (el calendario del grupo),
   nunca nada a nivel de matrícula individual. Por tanto, permitir elegir una tarifa de cuotas
   por alumno es seguro siempre que el precio individual (`customPrice`) no se rellene con el
   total de la tarifa — exactamente el mismo patrón que ya usa el propio diálogo al cargar los
   datos iniciales (`RenewGroupsDialog.tsx:70-76`, comentario incluido).

## Decisiones de diseño (validadas con el usuario)

1. **Se arreglan los tres problemas a la vez** (no solo el aviso antes de confirmar).
2. **Borrar una tarifa en uso se bloquea del todo** — no hay opción de "avisar pero borrar
   igual". Si hay alumnos o grupos activos usándola, no se puede borrar; se sugiere desactivarla.
3. **El traspaso avisa y bloquea antes de confirmar**, alumno a alumno — no se traspasa parcial
   y se informa después. El usuario decide, para cada alumno con tarifa rota, si le asigna una
   tarifa nueva o lo desmarca de la lista antes de poder confirmar.
4. **El selector de tarifa por alumno pasa a ofrecer todas las tarifas activas** (igual que el de
   tarifa por defecto del grupo), incluidas las de cuotas — con el precio individual gestionado
   igual que ya hace el resto del diálogo para cuotas (sin materializar el total como importe
   recurrente).

## Arquitectura

### 1. `src/lib/tariff-utils.ts` (nuevo, testeado con Vitest)

Lógica pura para saber si una tarifa está en uso, sin dependencias de React — mismo patrón que
`src/lib/billing-utils.ts`.

```ts
export function isTariffInUse(tariffId: string, enrollments: Enrollment[], groups: Group[]): boolean
```
`true` si alguna matrícula con `isActive: true` tiene `tariffId === tariffId`, o algún grupo con
`isActive: true` tiene `defaultTariffId === tariffId`.

```ts
export function tariffUsageCount(tariffId: string, enrollments: Enrollment[], groups: Group[]): { enrollmentCount: number; groupCount: number }
```
Cuenta cuántas matrículas activas y cuántos grupos activos la usan (para el mensaje de error).

### 2. `SettingsPage.tsx` — bloquear el borrado de tarifas en uso

- Añadir `enrollments` y `groups` a la desestructuración de `useDataStore()` (no estaban).
- En el `onClick` del botón "Eliminar" de cada tarifa (línea 525): si
  `isTariffInUse(tariff.id, enrollments, groups)`, mostrar
  `toast.error(...)` con el recuento (p.ej. "No se puede eliminar: la usan 3 alumno(s) y 1
  grupo(s). Desactívala en su lugar (Editar → Activa/Inactiva) si no quieres que se siga
  usando.") y **no** abrir el diálogo de confirmación (`setDeleteTariffId` no se llama). Si no
  está en uso, comportamiento actual sin cambios.

### 3. `RenewGroupsDialog.tsx` — validación antes de confirmar

Derivaciones nuevas (inline, `useMemo` en el componente — lógica de composición específica de
este diálogo sobre sus propios tipos `GroupDraft`/`StudentDraft`, no se extrae a `lib/`):

- Por grupo: `defaultTariffInvalid = !tariffs.some(t => t.id === draft.defaultTariffId)`.
- Por alumno: inválido si `draft.includeStudents && student.included &&
  !tariffs.some(t => t.id === student.tariffId)`.
- `hasBlockingIssues`: `true` si algún grupo tiene `defaultTariffInvalid` o algún alumno inválido
  en cualquier grupo.

UI:
- Cabecera de cada grupo: si tiene algún problema, badge de aviso junto al nombre (p.ej. "⚠ 2
  alumno(s) con tarifa no válida" o "⚠ tarifa por defecto no válida").
- Selector de tarifa por defecto del grupo: si `defaultTariffInvalid`, borde/aro en rojo y texto
  de ayuda "Esta tarifa ya no existe — elige otra".
- Fila de alumno inválido: fondo con tinte rojo/ámbar y texto junto al selector "Tarifa no
  disponible — elige otra o desmárcalo".
- Botón "Confirmar traspaso": `disabled` mientras `hasBlockingIssues` sea `true` (además de
  mientras `submitting`), con un mensaje visible encima explicando cuántos casos quedan por
  resolver y cómo resolverlos (elegir otra tarifa o desmarcar al alumno).
- En cuanto el usuario arregla todos los casos (cambia la tarifa o desmarca al alumno), el aviso
  desaparece y el botón se habilita — sin recargar el diálogo.

### 4. `RenewGroupsDialog.tsx` — tarifas de cuotas seleccionables por alumno

- El selector de tarifa por alumno (líneas 296-316) pasa a usar `activeTariffs` (todas las
  tarifas activas) en vez de la lista restringida `activeIndividualTariffs` + caso especial. Se
  elimina el `useMemo` de `activeIndividualTariffs` (líneas 54-57), que queda sin uso.
- El `onChange` del selector pasa a fijar `customPrice` igual que ya hace el resto del diálogo
  para cuotas: si la tarifa elegida es de tipo `installments`, `customPrice` se deja `undefined`
  (no se materializa el total de temporada); si no, se fija a `tariff.price` como hoy.
- La celda de "Precio" de la tabla: cuando `student.billingFrequency === 'installments'`, se
  sustituye el `<Input>` editable por un texto fijo "Según cuotas del grupo" (mismo patrón que ya
  usa la celda "Anclaje" para mostrar "—" cuando no aplica), en vez de un campo numérico en
  blanco que parece un dato que falta.

## Fuera de alcance

- Reclasificar tarifas de cuotas existentes ni tocar `Tariff.price`/`installmentPrices`.
- Cambios en `GroupDetailPage.tsx` o `MoveEnrollmentDialog.tsx` (mencionados en la memoria del
  problema de tarifa única precio/frecuencia) — este fix es solo sobre `RenewGroupsDialog.tsx` y
  el borrado de tarifas en `SettingsPage.tsx`.
- Aislar el fallo por alumno dentro de `renewGroup` (traspasar los alumnos válidos aunque uno
  falle) — el usuario prefirió bloquear y avisar antes, no traspasar parcialmente. La causa raíz
  (borrado sin comprobar uso) queda cerrada con el punto 2 de arquitectura, así que este escenario
  debería dejar de producirse para tarifas borradas a partir de ahora; datos ya rotos de antes de
  este fix seguirán bloqueando el grupo hasta que se resuelvan manualmente en el propio diálogo
  (que es exactamente lo que ahora permite hacer antes de confirmar).
- Migración/limpieza de datos ya inconsistentes (alumnos con `tariffId` apuntando a una tarifa ya
  borrada de antes de este fix) — el nuevo aviso en el diálogo es precisamente la herramienta
  para detectarlos y corregirlos caso a caso, no hace falta un script aparte.

## Verificación manual

1. Crear una tarifa, asignarla a un alumno activo, intentar borrarla desde Configuración → debe
   bloquearse con un mensaje claro; desactivarla (no borrarla) debe seguir funcionando.
2. Borrar una tarifa que no está en uso por nadie → debe seguir funcionando igual que hoy.
3. Con datos de prueba que tengan un alumno con `tariffId` apuntando a una tarifa inexistente
   (o crear el escenario borrando una tarifa a través de Firestore directamente para simular
   datos ya rotos, ya que tras el punto 1 no debería volver a ocurrir por la UI): abrir el
   traspaso de su grupo → debe verse el aviso en esa fila y el grupo, y "Confirmar traspaso" debe
   estar deshabilitado.
4. Elegir otra tarifa para ese alumno → el aviso de esa fila desaparece; si era el único
   problema, el botón se habilita.
5. Desmarcar (excluir) a un alumno con tarifa rota en vez de reasignarle una → también debe
   desbloquear el botón.
6. Elegir una tarifa de cuotas para un alumno individualmente (que la tarifa del grupo no sea de
   cuotas) → el campo de precio debe mostrar "Según cuotas del grupo" en vez de un número, y el
   traspaso debe completarse sin error.
7. Confirmar un traspaso de varios grupos donde todos los alumnos tienen tarifas válidas → sigue
   funcionando exactamente igual que hoy (caso feliz, sin regresión).
8. `npm run build` y `npm test` sin errores.
