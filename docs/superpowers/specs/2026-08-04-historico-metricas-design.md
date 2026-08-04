# Histórico de métricas de Inteligencia del Club — Diseño

**Fecha:** 2026-08-04
**Estado:** aprobado, pendiente de plan de implementación

## Contexto

El panel "Inteligencia del Club" (`AnalyticsPage.tsx` y sus 4 pestañas: `KPIsTab`, `RiskTab`, `ReviewsTab`, `CoachRankingTab`, recientemente revisado en las Piezas A-D) calcula todas sus métricas al vuelo, sobre los datos actuales. No existe ningún registro histórico: no se puede comparar "este mes" con "el mes pasado" para ninguna métrica. El usuario quiere poder comparar mes a mes / trimestre a trimestre, tanto de forma general (todas las métricas de un vistazo) como entrando al detalle de una métrica concreta.

## Decisiones de diseño (validadas con el usuario, incluida validación visual)

1. **Alcance: todas las métricas del panel**, no solo las 5 tarjetas de KPIs — también franjas infrautilizadas, alumnos en riesgo, calidad media de cuestionarios, y ranking de coaches (€/hora, retención, horas).

2. **Snapshots mensuales, generados automáticamente.** Una Cloud Function programada (mismo patrón que `generateMonthlyReceiptsScheduled`, [functions/src/billing/generateMonthlyReceipts.ts:299](../../../functions/src/billing/generateMonthlyReceipts.ts#L299)) se ejecuta el día 1 de cada mes y calcula/guarda el snapshot del mes que acaba de cerrar. Además, una función *callable* equivalente permite generar/regenerar el snapshot manualmente desde un botón en la UI (admin/coordinador) — útil si la programada falla o para previsualizar el mes en curso.

3. **Cada snapshot guarda el desglose completo, no solo el "resultado" mostrado.** Para poder agregar correctamente 3 meses en una vista trimestral (en vez de comparar "ganadores" sueltos, lo que podría dar un trimestre incorrecto), cada snapshot almacena los totales por grupo/día/coach que alimentan cada métrica, no solo la respuesta final ("Iniciación Lunes", "Martes", etc.).

4. **Agregación mensual → trimestral según el tipo de métrica:**
   - **Acumulables** (ingresos por grupo, bajas por grupo, alumnos nuevos, asistencias por día, pagos generados/cobrados): se suman los 3 desgloses mensuales y se recalcula el "ganador" sobre el total.
   - **De estado** (% franjas infrautilizadas, retención de coaches, calidad media, €/hora): se promedian los 3 valores mensuales.

5. **UI: pestaña nueva "Histórico"** dentro de `AnalyticsPage.tsx`, junto a las 4 existentes. Contiene: una tabla de comparación general (cada métrica con su valor del periodo actual, el periodo anterior, y una flecha de cambio coloreada según si esa métrica mejora o empeora al subir), con selectores de periodo (mes/trimestre) y de referencia de comparación (por defecto, el periodo inmediatamente anterior); y, al pulsar una fila, una vista de detalle con un gráfico de tendencia de los últimos meses disponibles para esa métrica.

6. **Sin relleno retroactivo.** El histórico empieza a poblarse desde el primer mes que se cierre tras desplegar esta funcionalidad. Antes de eso (o mientras haya menos de 2 meses de histórico para comparar), la pestaña muestra un aviso en vez de una tabla vacía o con datos parciales confusos.

## Arquitectura

### 1. Modelo de datos

**Nueva colección Firestore `metricSnapshots`**, un documento por club y mes, con id `{clubId}_{YYYY-MM}`:

```ts
export interface MetricSnapshot {
  id: string             // `${clubId}_${YYYY-MM}`
  clubId: string
  year: number
  month: number           // 1-12
  generatedAt: Date
  generatedBy: 'scheduled' | 'manual'

  // Acumulables (desglose completo, no solo el ganador)
  revenueByGroup: Record<string, number>          // groupId -> ingresos del mes
  groupNames: Record<string, string>               // groupId -> nombre (snapshot del nombre en ese momento)
  churnByGroup: Record<string, number>             // groupId -> nº de bajas del mes
  newPlayersCount: number
  attendanceByDayOfWeek: Record<number, number>    // 0-6 -> nº asistencias 'presente'
  paymentsGenerated: number
  paymentsPaid: number

  // De estado (valor ya final del mes, no desglose)
  underutilizedSlotsCount: number
  atRiskPlayersCount: number
  avgReviewQuality: number | null
  coachStats: Array<{ coachId: string; coachName: string; rph: number; retentionPct: number | null; hours: number }>
}
```

**Reutilización de cálculo:** la lógica de cada bloque reutiliza, adaptada a un rango de fechas fijo (el mes cerrado) en vez de "hasta ahora", las funciones puras ya existentes: `computeCourtUtilization`/`getUnderutilizedSlots` ([src/lib/court-utilization.ts](../../../src/lib/court-utilization.ts)) y `computeCoachStats` ([src/lib/coach-stats.ts](../../../src/lib/coach-stats.ts)) — ambas ya puras y sin dependencias de React, así que se pueden portar a Cloud Functions (Node.js) copiando el mismo archivo o extrayendo a un paquete compartido si el proyecto ya tiene ese mecanismo (a confirmar en el plan; si no existe, se duplica el archivo en `functions/src/`, siguiendo el patrón ya usado con `billing-utils.ts`, que también tiene su copia en frontend y en functions).

### 2. Cloud Functions (`functions/src/analytics/generateMetricSnapshot.ts`, nuevo)

- `generateMetricSnapshotScheduled`: `onSchedule`, `"0 3 1 * *"`, `Europe/Madrid` — calcula el snapshot del mes que acaba de terminar (mes actual - 1) para cada club, y hace `set` (no `create`) en `metricSnapshots/{clubId}_{YYYY-MM}` — idempotente, para que una reejecución no duplique ni falle.
- `generateMetricSnapshotCallable`: `onCall`, autenticado, recibe `{ clubId, year, month }` (por defecto el mes actual, para poder previsualizarlo antes de que cierre) y hace lo mismo bajo demanda.

### 3. UI: pestaña "Histórico" (`src/components/shared/analytics/HistoryTab.tsx`, nuevo)

- Lee `metricSnapshots` (nueva colección sincronizada vía `realtimeSync.ts`, solo visible a admin/coordinador igual que `seasons`).
- Selector de periodo (mes/trimestre) y de comparación (periodo anterior, único disponible en esta primera versión — sin comparación interanual todavía).
- Tabla de comparación general: una fila por métrica, con el valor agregado del periodo actual, el del periodo de comparación, y una flecha de cambio. Cada métrica sabe si "subir es bueno" o "subir es malo" (ej. alumnos en riesgo: subir es malo) para colorear la flecha correctamente.
- Al pulsar una fila: vista de detalle con un gráfico de tendencia (usando la skill `dataviz` al implementarlo, para mantener paleta/accesibilidad consistente con el resto de la app) de los últimos meses disponibles.
- Si hay menos de 2 snapshots disponibles para el club: aviso "Aún no hay suficiente histórico. Vuelve el [fecha del próximo cierre de mes]" en vez de la tabla.
- Botón "Generar snapshot de este mes" (admin/coordinador), que llama a `generateMetricSnapshotCallable` vía el SDK estándar de Firebase (`httpsCallable`, patrón nuevo en el frontend — hoy no hay ninguna función *callable* invocada desde el cliente, aunque sí existen del lado de functions).

### 4. Seguridad (firestore.rules)

`metricSnapshots` solo debe ser escrita por Cloud Functions (Admin SDK, sin reglas de seguridad de cliente aplicables) y por la función *callable* (que corre con privilegios de servidor) — el cliente nunca escribe directamente en esta colección. Reglas:

```javascript
match /metricSnapshots/{snapshotId} {
  allow read: if isAuthenticated() && (isAdmin() || belongsToClub());
  allow write: if false; // Solo Cloud Functions (Admin SDK) escriben aquí
}
```

## Fuera de alcance

- Comparación interanual (mismo mes/trimestre del año anterior) — solo comparación con el periodo inmediatamente anterior en esta primera versión.
- Relleno retroactivo de meses previos al despliegue.
- Snapshots semanales o diarios — solo granularidad mensual (el trimestre se deriva agregando 3 mensuales).
- Exportar el histórico a PDF/Excel — puede añadirse después reutilizando los generadores ya existentes en el proyecto.
- Alertas automáticas cuando una métrica empeora mucho respecto al mes anterior — posible extensión futura, no en esta versión.

## Verificación manual

1. Ejecutar manualmente `generateMetricSnapshotCallable` para el mes en curso (antes de que cierre) desde el botón de la UI; confirmar que se crea el documento en `metricSnapshots` con el desglose completo.
2. Repetir para un segundo mes (puede ser simulado en desarrollo); confirmar que la pestaña "Histórico" ya muestra la tabla de comparación con ambos meses y flechas de cambio coherentes (color correcto según si esa métrica mejora o empeora al subir).
3. Cambiar el selector a "Trimestre" con al menos 3 snapshots mensuales disponibles; confirmar que las métricas acumulables muestran la suma de los 3 meses y las de estado el promedio.
4. Entrar al detalle de una métrica (ej. "Tasa de cobro") y confirmar que el gráfico de tendencia muestra los meses disponibles correctamente.
5. Con menos de 2 snapshots, confirmar que se muestra el aviso de "histórico insuficiente" en vez de una tabla rota o vacía.
6. `npm run build` y `npm test` sin errores; `npm --prefix functions run build` sin errores.
