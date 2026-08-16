# Tarifas individuales en la renovación de temporada — Diseño

**Fecha:** 2026-08-05
**Estado:** aprobado, pendiente de plan de implementación

## Contexto

El usuario preguntó cómo funciona la asignación de tarifas cuando un grupo mezcla alumnos con distinta frecuencia de facturación (mensual/trimestral/anual), y si eso se respeta al renovar la temporada. Investigación:

- **A nivel de matrícula, ya funciona bien hoy.** `Enrollment` guarda `tariffId`, `customPrice`, `billingFrequency` y `billingAnchorMonth` por alumno (no por grupo). `GroupDetailPage.tsx` permite elegir estos valores libremente al matricular a cada alumno. La generación de recibos (`functions/src/billing/generateMonthlyReceipts.ts`) itera por matrícula y usa `enrollment.billingFrequency ?? group.billingFrequency` — así que hoy mismo un grupo puede tener alumnos mensuales y trimestrales conviviendo, y cada uno se factura correctamente según su propio ciclo.

- **El hueco está en la renovación de temporada.** `RenewGroupsDialog.tsx` (el asistente de traspaso) define la tarifa/frecuencia **una sola vez por grupo** (`GroupDraft.billingFrequency`), y `renewGroup` (en `dataStore.ts`) aplica ese único valor a **todas** las matrículas nuevas del grupo, sin importar lo que cada alumno tuviera antes. Al traspasar, se pierde la distinción individual: si Ana pagaba mensual y Pedro trimestral, ambos quedan con la frecuencia que el admin haya puesto para el grupo nuevo.

## Decisiones de diseño (validadas con el usuario, incluida validación visual)

1. **Por defecto, se conserva lo que cada alumno ya tenía** (tarifa, precio, frecuencia, mes de anclaje) — no la del grupo. El admin puede cambiarlo individualmente si quiere.

2. **El asistente gana control total por alumno**, no solo de frecuencia: tarifa, precio y frecuencia (+ mes de anclaje si aplica), igual que ya se puede hacer en una matrícula normal desde `GroupDetailPage.tsx`.

3. **Formato: tabla compacta**, una fila por alumno con checkbox + tarifa + precio + frecuencia + anclaje en línea (opción validada visualmente, sobre la alternativa de "resumen + editar por alumno", que exigía un clic extra por alumno).

4. **Los campos de tarifa/frecuencia del grupo siguen existiendo, pero cambian de propósito**: dejan de imponerse a los alumnos transferidos y pasan a ser solo el valor por defecto para alumnos **nuevos** que se matriculen en el grupo después del traspaso (p. ej. si llega un alumno nuevo a mitad de temporada).

## Arquitectura

### 1. Store (`src/stores/dataStore.ts`)

`renewGroup` cambia su parámetro `includedPlayerIds: string[]` por:

```ts
includedStudents: Array<{
  playerId: string
  tariffId: string
  customPrice?: number
  billingFrequency: BillingFrequency
  billingAnchorMonth?: number
}>
```

La construcción de `newEnrollments` deja de usar `groupData.billingFrequency`/`tariff.name` (del grupo) para cada alumno, y en su lugar, por cada entrada de `includedStudents`, resuelve su **propio** `tariffId` (vía `get().tariffs.find(...)`, para obtener `tariffName`) y usa su propio `customPrice`/`billingFrequency`/`billingAnchorMonth`. El `playerName` se sigue tomando de la matrícula vieja del alumno (`activeEnrollments.find(e => e.playerId === student.playerId)`).

El resto de la función (archivar grupo viejo, cerrar matrículas viejas, `writeBatch` atómico, aviso de lista de espera para excluidos) no cambia — solo cambia de qué array se lee la lista de "quién se incluye y con qué configuración".

### 2. Asistente (`RenewGroupsDialog.tsx`)

`GroupDraft.includedPlayerIds: Set<string>` se sustituye por `students: StudentDraft[]`, con un elemento por cada matrícula activa del grupo viejo:

```ts
interface StudentDraft {
  playerId: string
  playerName: string
  included: boolean
  tariffId: string
  customPrice: number   // precio efectivo del periodo; siempre explicito, no se recalcula a partir de la tarifa
  billingFrequency: BillingFrequency
  billingAnchorMonth: number
}
```

Al abrir el asistente, cada `StudentDraft` se precarga desde la matrícula actual del alumno: `tariffId` = su tarifa actual, `billingFrequency` = la suya o la del grupo si no tiene una propia, `customPrice` = su `customPrice` si lo tiene, o si no, el precio calculado (`tarifa.price × cycleLength(su frecuencia)`) — de forma que el campo "Precio" del asistente siempre muestra un número concreto y editable, nunca en blanco.

La tabla de alumnos (dentro de cada grupo expandido) pasa de una lista de checkboxes con solo el nombre a una tabla con columnas: casilla · nombre · tarifa (select) · precio (input) · frecuencia (select) · mes de anclaje (select, solo visible si la frecuencia de esa fila es trimestral o anual).

`handleConfirm` construye `includedStudents` a partir de las filas con `included: true`, mapeando cada `StudentDraft` al shape que espera `renewGroup`.

## Fuera de alcance

- No se cambia cómo funciona la asignación de tarifas en una matrícula normal (`GroupDetailPage.tsx`) — ya funciona correctamente y no es el problema.
- No se toca la generación de recibos — ya factura correctamente por matrícula individual.
- No se añade validación cruzada de que el "Precio" introducido en el asistente coincida con `tarifa.price × cycleLength(frecuencia)` — el admin puede poner cualquier importe, igual que `customPrice` funciona hoy en una matrícula normal (es una anulación explícita, no se audita contra la tarifa).

## Verificación manual

1. Crear un grupo con dos alumnos: uno mensual (45€) y otro trimestral (120€, ancla en septiembre).
2. Abrir el asistente de traspaso para ese grupo hacia una temporada nueva. Confirmar que la tabla de alumnos precarga correctamente: alumno 1 con "Mensual · 45€", alumno 2 con "Trimestral · 120€ · Sep".
3. Sin tocar nada, confirmar el traspaso. Comprobar que las matrículas nuevas conservan la frecuencia/precio/anclaje de cada uno (no las del grupo).
4. Repetir cambiando manualmente la frecuencia de un alumno en el asistente (p. ej. pasar al mensual a trimestral); confirmar que la matrícula nueva refleja el cambio.
5. Matricular a un alumno nuevo en el grupo ya traspasado (fuera del asistente, desde `GroupDetailPage.tsx`); confirmar que el formulario de alta sigue proponiendo por defecto la tarifa/frecuencia del grupo (comportamiento sin cambios para alumnos nuevos).
6. `npm run build` y `npm test` sin errores; añadir/actualizar tests para `renewGroup` cubriendo alumnos con distinta frecuencia en el mismo traspaso.
