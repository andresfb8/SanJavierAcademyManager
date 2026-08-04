# Histórico de métricas de Inteligencia del Club — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guardar un snapshot mensual (automático + botón manual) de todas las métricas de "Inteligencia del Club" y añadir una pestaña "Histórico" que compara el periodo actual con el anterior, mes a mes o trimestre a trimestre, con detalle de tendencia por métrica.

**Architecture:** Una Cloud Function (programada + *callable*) calcula y guarda un documento `MetricSnapshot` por club y mes en Firestore, reutilizando (portadas a Node.js) las funciones puras ya existentes en el frontend (`computeCourtUtilization`, `computeCoachStats`, `getPeriodStart`). El frontend añade un módulo puro de agregación (mensual→trimestral) y una pestaña nueva que lee los snapshots vía el store ya sincronizado en tiempo real.

**Tech Stack:** React 19 + TypeScript, Zustand, Firebase Firestore + Cloud Functions (Node.js v2), Recharts, Vitest.

---

### Task 1: Tipos, reglas de seguridad y sincronización realtime

**Files:**
- Modify: `src/types/index.ts`
- Modify: `firestore.rules`
- Modify: `src/lib/realtimeSync.ts`
- Modify: `src/stores/dataStore.ts`

- [ ] **Paso 1: Añadir el tipo `MetricSnapshot`**

En `src/types/index.ts`, tras la interfaz `Season`, añadir:

```ts
// --- Snapshot mensual de metricas de Inteligencia del Club ---
export interface MetricSnapshot {
  id: string              // `${clubId}_${YYYY-MM}`
  clubId: string
  year: number
  month: number            // 1-12
  generatedAt: Date
  generatedBy: 'scheduled' | 'manual'

  // Acumulables: desglose completo, no solo el "ganador"
  revenueByGroup: Record<string, number>
  groupNames: Record<string, string>
  churnByGroup: Record<string, number>
  newPlayersCount: number
  attendanceByDayOfWeek: Record<number, number>
  paymentsGenerated: number
  paymentsPaid: number

  // De estado: valor ya final del mes
  underutilizedSlotsCount: number
  atRiskPlayersCount: number
  avgReviewQuality: number | null
  coachStats: Array<{
    coachId: string
    coachName: string
    rph: number
    retentionPct: number | null
    hours: number
  }>
}
```

- [ ] **Paso 2: Añadir la slice al store**

En `src/stores/dataStore.ts`, añadir `metricSnapshots: MetricSnapshot[]` a la interfaz `DataState` (junto a `seasons: Season[]`) y `metricSnapshots: [],` al estado inicial (junto a `seasons: [],`). Añadir `MetricSnapshot` al import de tipos existente. Esta colección es de **solo lectura** desde el cliente (la escriben las Cloud Functions con Admin SDK) — no hace falta ninguna acción CRUD en el store, solo el slice para que el listener realtime lo puebla.

- [ ] **Paso 3: Reglas de Firestore**

En `firestore.rules`, tras el bloque `match /seasons/{seasonId}`, añadir:

```javascript
    match /metricSnapshots/{snapshotId} {
      allow read: if isAuthenticated() && (isAdmin() || belongsToClub());
      allow write: if false; // Solo Cloud Functions (Admin SDK) escriben aqui
    }
```

- [ ] **Paso 4: Registrar la colección en realtime sync**

En `src/lib/realtimeSync.ts`, añadir `{ name: 'metricSnapshots', stateKey: 'metricSnapshots' }` al array `COLLECTIONS`, tras `{ name: 'seasons', stateKey: 'seasons' }`. Confirmar (leyendo, sin modificar) que el filtro de `jugador`/`tutor` y el de `entrenador` (líneas ~96-111) no incluyen esta colección — no hace falta añadirla a ningún allow-list, es intencionalmente invisible para esos roles.

- [ ] **Paso 5: Build**

Run: `npm run build`
Expected: sin errores de TypeScript.

- [ ] **Paso 6: Commit**

```bash
git add src/types/index.ts src/stores/dataStore.ts firestore.rules src/lib/realtimeSync.ts
git commit -m "feat: tipo MetricSnapshot, reglas y sincronizacion realtime"
```

---

### Task 2: Portar las funciones de cálculo puras a Cloud Functions

**Files:**
- Create: `functions/src/analytics/court-utilization.ts`
- Create: `functions/src/analytics/coach-stats.ts`
- Create: `functions/src/analytics/period.ts`

**Contexto:** Cloud Functions es un proyecto TypeScript separado (`functions/tsconfig.json`, sin acceso al alias `@/` del frontend). El proyecto ya tiene el patrón de duplicar módulos puros del frontend a `functions/src/` con los tipos inlineados en vez de importados (ver `functions/src/billing/billing-utils.ts`, copia adaptada de `src/lib/billing-utils.ts`). Aquí se replica el mismo patrón para los 3 módulos usados por el snapshot: `computeCourtUtilization`, `computeCoachStats`, `getPeriodStart`. La lógica es idéntica a la versión frontend — solo cambian las interfaces de tipos (inlineadas, sin importar de `@/types`) y no se usa `Timestamp` aquí (la conversión de `Timestamp` a `Date` se hace en la Tarea 3, antes de llamar a estas funciones).

- [ ] **Paso 1: Crear `functions/src/analytics/period.ts`**

```ts
export type AnalyticsPeriod = "month" | "quarter" | "year";

export function getPeriodStart(period: AnalyticsPeriod, now: Date = new Date()): Date {
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "quarter") return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  return new Date(now.getFullYear(), 0, 1);
}
```

- [ ] **Paso 2: Crear `functions/src/analytics/court-utilization.ts`**

```ts
interface ScheduleSlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface Court {
  id: string;
  name: string;
  isActive: boolean;
}

interface Group {
  id: string;
  name: string;
  courtId: string;
  schedule: ScheduleSlot[];
  maxCapacity: number;
  currentEnrollment: number;
  isActive: boolean;
}

interface PrivateLesson {
  courtId: string;
  date: Date;
  startTime: string;
  endTime: string;
}

const OCCUPANCY_LOW_THRESHOLD = 0.4;
const OCCUPANCY_HIGH_THRESHOLD = 0.7;
const PRIVATE_LESSON_LOOKBACK_DAYS = 42;

export type CourtSlotStatusValue = "vacio" | "ocasional" | "bajo" | "medio" | "lleno";

export interface CourtSlotStatus {
  courtId: string;
  courtName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  status: CourtSlotStatusValue;
  occupancyPct: number | null;
  groupName?: string;
}

interface WeekBucket {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function getWeekBuckets(groups: Group[]): WeekBucket[] {
  const seen = new Map<string, WeekBucket>();
  for (const group of groups) {
    if (!group.isActive) continue;
    for (const slot of group.schedule) {
      const key = `${slot.dayOfWeek}|${slot.startTime}|${slot.endTime}`;
      if (!seen.has(key)) {
        seen.set(key, { dayOfWeek: slot.dayOfWeek, startTime: slot.startTime, endTime: slot.endTime });
      }
    }
  }
  return Array.from(seen.values());
}

function findGroupForSlot(groups: Group[], courtId: string, bucket: WeekBucket): Group | undefined {
  return groups.find(
    (g) =>
      g.isActive &&
      g.courtId === courtId &&
      g.schedule.some((s) => s.dayOfWeek === bucket.dayOfWeek && s.startTime === bucket.startTime && s.endTime === bucket.endTime),
  );
}

function hasRecentPrivateLesson(privateLessons: PrivateLesson[], courtId: string, bucket: WeekBucket, now: Date): boolean {
  const cutoff = new Date(now.getTime() - PRIVATE_LESSON_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  return privateLessons.some((lesson) => {
    if (lesson.courtId !== courtId) return false;
    if (lesson.date < cutoff || lesson.date > now) return false;
    if (lesson.date.getDay() !== bucket.dayOfWeek) return false;
    return timesOverlap(lesson.startTime, lesson.endTime, bucket.startTime, bucket.endTime);
  });
}

function statusForOccupancy(pct: number): CourtSlotStatusValue {
  if (pct < OCCUPANCY_LOW_THRESHOLD) return "bajo";
  if (pct < OCCUPANCY_HIGH_THRESHOLD) return "medio";
  return "lleno";
}

export function computeCourtUtilization(
  courts: Court[],
  groups: Group[],
  privateLessons: PrivateLesson[],
  now: Date = new Date(),
): CourtSlotStatus[] {
  const activeCourts = courts.filter((c) => c.isActive);
  const buckets = getWeekBuckets(groups);
  const results: CourtSlotStatus[] = [];

  for (const court of activeCourts) {
    for (const bucket of buckets) {
      const group = findGroupForSlot(groups, court.id, bucket);
      if (group) {
        const pct = group.maxCapacity > 0 ? group.currentEnrollment / group.maxCapacity : 0;
        results.push({
          courtId: court.id,
          courtName: court.name,
          dayOfWeek: bucket.dayOfWeek,
          startTime: bucket.startTime,
          endTime: bucket.endTime,
          status: statusForOccupancy(pct),
          occupancyPct: Math.round(pct * 100),
          groupName: group.name,
        });
      } else {
        const occasional = hasRecentPrivateLesson(privateLessons, court.id, bucket, now);
        results.push({
          courtId: court.id,
          courtName: court.name,
          dayOfWeek: bucket.dayOfWeek,
          startTime: bucket.startTime,
          endTime: bucket.endTime,
          status: occasional ? "ocasional" : "vacio",
          occupancyPct: null,
        });
      }
    }
  }

  return results;
}

export function getUnderutilizedSlots(slots: CourtSlotStatus[]): CourtSlotStatus[] {
  return slots.filter((s) => s.status === "vacio" || s.status === "bajo");
}
```

(Nota: se omite el `.sort()` final que sí tiene la versión frontend — aquí solo se necesita el recuento total para `underutilizedSlotsCount`, no el orden de peor a mejor, así que se simplifica. Si una tarea futura quisiera guardar también el detalle de las peores franjas en el snapshot, se puede añadir el `.sort()` de vuelta.)

- [ ] **Paso 3: Crear `functions/src/analytics/coach-stats.ts`**

```ts
interface ScheduleSlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface Coach {
  id: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
}

interface Group {
  id: string;
  name: string;
  coachId: string;
  schedule: ScheduleSlot[];
  isActive: boolean;
}

interface Payment {
  groupId?: string;
  amount: number;
  status: string;
  paidDate?: Date;
  dueDate: Date;
}

interface Enrollment {
  groupId: string;
  enrollmentDate: Date;
  isActive: boolean;
}

interface AttendanceRecord {
  groupId: string;
  coachId: string;
  date: Date;
}

export interface CoachStats {
  coachId: string;
  coachName: string;
  rph: number;
  retentionPct: number | null;
  hours: number;
}

function slotMinutes(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

function findSlotForDate(group: Group, date: Date): ScheduleSlot | undefined {
  const dayOfWeek = date.getDay();
  return group.schedule.find((s) => s.dayOfWeek === dayOfWeek) ?? group.schedule[0];
}

export function computeCoachStats(
  coaches: Coach[],
  groups: Group[],
  payments: Payment[],
  enrollments: Enrollment[],
  attendance: AttendanceRecord[],
  periodStart: Date,
  weeksInPeriod: number,
  now: Date = new Date(),
): CoachStats[] {
  const coachGroupIds: Record<string, string[]> = {};
  groups.forEach((g) => {
    if (!coachGroupIds[g.coachId]) coachGroupIds[g.coachId] = [];
    coachGroupIds[g.coachId].push(g.id);
  });

  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  return coaches
    .filter((c) => c.isActive)
    .map((coach) => {
      const groupIds = coachGroupIds[coach.id] ?? [];

      const revenue = payments
        .filter((p) => p.status === "pagado" && p.groupId && groupIds.includes(p.groupId) && (p.paidDate ?? p.dueDate) >= periodStart)
        .reduce((sum, p) => sum + p.amount, 0);

      const coachAttendance = attendance.filter((r) => r.coachId === coach.id && r.date >= periodStart);
      const hoursFromAttendance = coachAttendance.reduce((sum, record) => {
        const group = groups.find((g) => g.id === record.groupId);
        if (!group) return sum;
        const slot = findSlotForDate(group, record.date);
        if (!slot) return sum;
        return sum + slotMinutes(slot.startTime, slot.endTime) / 60;
      }, 0);

      const hoursFromSchedule = groups
        .filter((g) => g.coachId === coach.id && g.isActive)
        .reduce((sum, g) => sum + g.schedule.reduce((s, slot) => s + slotMinutes(slot.startTime, slot.endTime) / 60, 0) * weeksInPeriod, 0);

      const hours = hoursFromAttendance > 0 ? hoursFromAttendance : hoursFromSchedule;
      const rph = hours > 0 ? revenue / hours : 0;

      const eligibleEnrollments = enrollments.filter((e) => groupIds.includes(e.groupId) && e.enrollmentDate <= threeMonthsAgo);
      const retained = eligibleEnrollments.filter((e) => e.isActive).length;
      const retentionPct = eligibleEnrollments.length > 0 ? Math.round((retained / eligibleEnrollments.length) * 100) : null;

      return {
        coachId: coach.id,
        coachName: `${coach.firstName} ${coach.lastName}`,
        rph,
        retentionPct,
        hours: Math.round(hours * 10) / 10,
      };
    })
    .filter((s) => s.rph > 0 || s.hours > 0 || s.retentionPct !== null);
}
```

- [ ] **Paso 4: Build de functions**

Run: `npm --prefix functions run build`
Expected: sin errores de TypeScript. (Este proyecto no tiene tests automatizados configurados — `functions/package.json` no define script `test` — así que la verificación de esta tarea es solo el build, igual que ya ocurre con `functions/src/billing/billing-utils.ts`.)

- [ ] **Paso 5: Commit**

```bash
git add functions/src/analytics/period.ts functions/src/analytics/court-utilization.ts functions/src/analytics/coach-stats.ts
git commit -m "feat: portar computeCourtUtilization, computeCoachStats y getPeriodStart a Cloud Functions"
```

---

### Task 3: Cloud Function `generateMetricSnapshot` (programada + manual)

**Files:**
- Create: `functions/src/analytics/generateMetricSnapshot.ts`
- Modify: `functions/src/index.ts`

**Contexto:** Sigue exactamente el patrón de `functions/src/billing/generateMonthlyReceipts.ts` (función núcleo compartida + wrapper `onSchedule` + wrapper `onCall`, iteración sobre todos los clubes vía `db.collection("clubs").get()` cuando no se especifica uno).

- [ ] **Paso 1: Crear `functions/src/analytics/generateMetricSnapshot.ts`**

```ts
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { computeCourtUtilization, getUnderutilizedSlots } from "./court-utilization";
import { computeCoachStats } from "./coach-stats";
import { getPeriodStart } from "./period";

function toDate(v: unknown): Date {
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  return new Date(v as string);
}

async function generateSnapshotForClub(
  db: FirebaseFirestore.Firestore,
  clubId: string,
  year: number,
  month: number,
  generatedBy: "scheduled" | "manual",
): Promise<void> {
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 1); // exclusivo: primer dia del mes siguiente
  const now = new Date();

  const [
    groupsSnap,
    courtsSnap,
    coachesSnap,
    paymentsSnap,
    enrollmentsSnap,
    attendanceSnap,
    privateLessonsSnap,
    reviewsSnap,
  ] = await Promise.all([
    db.collection("groups").where("clubId", "==", clubId).get(),
    db.collection("courts").where("clubId", "==", clubId).get(),
    db.collection("coaches").where("clubId", "==", clubId).get(),
    db.collection("payments").where("clubId", "==", clubId).get(),
    db.collection("enrollments").where("clubId", "==", clubId).get(),
    db.collection("attendance").where("clubId", "==", clubId).get(),
    db.collection("privateLessons").where("clubId", "==", clubId).get(),
    db.collection("classReviews").where("clubId", "==", clubId).get(),
  ]);

  const groups = groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
  const courts = courtsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
  const coaches = coachesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
  const payments = paymentsSnap.docs.map((d) => {
    const data = d.data();
    return { ...data, paidDate: data.paidDate ? toDate(data.paidDate) : undefined, dueDate: toDate(data.dueDate) };
  }) as any[];
  const enrollments = enrollmentsSnap.docs.map((d) => {
    const data = d.data();
    return { ...data, enrollmentDate: toDate(data.enrollmentDate), unenrollmentDate: data.unenrollmentDate ? toDate(data.unenrollmentDate) : undefined };
  }) as any[];
  const attendance = attendanceSnap.docs.map((d) => {
    const data = d.data();
    return { ...data, date: toDate(data.date) };
  }) as any[];
  const privateLessons = privateLessonsSnap.docs.map((d) => {
    const data = d.data();
    return { ...data, date: toDate(data.date) };
  }) as any[];
  const reviews = reviewsSnap.docs.map((d) => d.data()) as any[];

  // ── Ingresos y bajas por grupo (acumulables) ──────────────────────
  const revenueByGroup: Record<string, number> = {};
  const groupNames: Record<string, string> = {};
  groups.forEach((g) => { groupNames[g.id] = g.name; });
  payments
    .filter((p) => p.status === "pagado" && p.groupId && p.paidDate && p.paidDate >= periodStart && p.paidDate < periodEnd)
    .forEach((p) => { revenueByGroup[p.groupId] = (revenueByGroup[p.groupId] ?? 0) + p.amount; });

  const churnByGroup: Record<string, number> = {};
  enrollments
    .filter((e) => e.unenrollmentDate && e.unenrollmentDate >= periodStart && e.unenrollmentDate < periodEnd)
    .forEach((e) => { churnByGroup[e.groupId] = (churnByGroup[e.groupId] ?? 0) + 1; });

  const newPlayersCount = enrollments.filter(
    (e) => e.enrollmentDate >= periodStart && e.enrollmentDate < periodEnd && e.isActive,
  ).length;

  const attendanceByDayOfWeek: Record<number, number> = {};
  attendance
    .filter((r) => r.date >= periodStart && r.date < periodEnd)
    .forEach((r) => {
      const dow = r.date.getDay();
      const presents = (r.records ?? []).filter((e: { status: string }) => e.status === "presente").length;
      attendanceByDayOfWeek[dow] = (attendanceByDayOfWeek[dow] ?? 0) + presents;
    });

  const periodPayments = payments.filter((p) => p.billingMonth === month && p.billingYear === year);
  const paymentsGenerated = periodPayments.length;
  const paymentsPaid = periodPayments.filter((p) => p.status === "pagado").length;

  // ── Metricas de estado ─────────────────────────────────────────────
  const utilization = computeCourtUtilization(courts, groups, privateLessons, periodEnd);
  const underutilizedSlotsCount = getUnderutilizedSlots(utilization).length;

  const atRiskPlayersCount = (() => {
    const absenceCount: Record<string, number> = {};
    attendance
      .filter((r) => r.date >= periodStart && r.date < periodEnd)
      .forEach((r) => {
        (r.records ?? []).forEach((entry: { playerId: string; status: string }) => {
          if (entry.status !== "ausente") return;
          absenceCount[entry.playerId] = (absenceCount[entry.playerId] ?? 0) + 1;
        });
      });
    return Object.values(absenceCount).filter((c) => c >= 3).length;
  })();

  const monthReviews = reviews.filter((r) => (r.date as string).startsWith(`${year}-${String(month).padStart(2, "0")}`));
  const avgReviewQuality = monthReviews.length > 0
    ? Math.round((monthReviews.reduce((sum, r) => sum + r.quality, 0) / monthReviews.length) * 10) / 10
    : null;

  const weeksInPeriod = 4; // snapshot siempre mensual
  const coachStats = computeCoachStats(coaches, groups, payments, enrollments, attendance, periodStart, weeksInPeriod, periodEnd);

  const snapshot = {
    clubId,
    year,
    month,
    generatedAt: Timestamp.now(),
    generatedBy,
    revenueByGroup,
    groupNames,
    churnByGroup,
    newPlayersCount,
    attendanceByDayOfWeek,
    paymentsGenerated,
    paymentsPaid,
    underutilizedSlotsCount,
    atRiskPlayersCount,
    avgReviewQuality,
    coachStats,
  };

  const snapshotId = `${clubId}_${year}-${String(month).padStart(2, "0")}`;
  await db.collection("metricSnapshots").doc(snapshotId).set(snapshot, { merge: true });
  logger.info(`Snapshot generado: ${snapshotId}`);
}

async function generateSnapshots(year?: number, month?: number, clubId?: string): Promise<{ processed: number; errors: number }> {
  const db = getFirestore();
  const now = new Date();
  // Por defecto, el mes que ACABA de cerrar (mes actual - 1)
  const targetDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const targetYear = year ?? targetDate.getFullYear();
  const targetMonth = month ?? targetDate.getMonth() + 1;

  let clubIds: string[];
  if (clubId) {
    clubIds = [clubId];
  } else {
    const clubsSnap = await db.collection("clubs").get();
    clubIds = clubsSnap.docs.map((d) => d.id);
  }

  let processed = 0;
  let errors = 0;
  for (const currentClubId of clubIds) {
    try {
      await generateSnapshotForClub(db, currentClubId, targetYear, targetMonth, clubId ? "manual" : "scheduled");
      processed++;
    } catch (err) {
      errors++;
      logger.error(`Error generando snapshot para club ${currentClubId}:`, err);
    }
  }
  return { processed, errors };
}

export const generateMetricSnapshotScheduled = onSchedule(
  {
    schedule: "0 3 1 * *",
    timeZone: "Europe/Madrid",
    region: "europe-west1",
    retryCount: 3,
    memory: "512MiB",
    timeoutSeconds: 540,
  },
  async (_event) => {
    logger.info("Generacion programada de snapshots de metricas iniciada.");
    const result = await generateSnapshots();
    logger.info("Generacion programada de snapshots de metricas finalizada.", result);
  },
);

export const generateMetricSnapshotCallable = onCall(
  {
    region: "europe-west1",
    memory: "512MiB",
    timeoutSeconds: 540,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes estar autenticado para ejecutar esta funcion.");
    }
    const { clubId, year, month } = request.data as { clubId: string; year?: number; month?: number };
    if (!clubId) {
      throw new HttpsError("invalid-argument", "Falta clubId.");
    }
    const now = new Date();
    const targetYear = year ?? now.getFullYear();
    const targetMonth = month ?? now.getMonth() + 1;
    const db = getFirestore();
    await generateSnapshotForClub(db, clubId, targetYear, targetMonth, "manual");
    return { success: true };
  },
);
```

- [ ] **Paso 2: Exportar en `functions/src/index.ts`**

Añadir, tras el bloque de "Invoicing functions":

```ts
// ---------------------------------------------------------------------------
// Analytics functions
// ---------------------------------------------------------------------------
export {
  generateMetricSnapshotScheduled,
  generateMetricSnapshotCallable,
} from "./analytics/generateMetricSnapshot";
```

- [ ] **Paso 3: Build**

Run: `npm --prefix functions run build`
Expected: sin errores de TypeScript.

- [ ] **Paso 4: Commit**

```bash
git add functions/src/analytics/generateMetricSnapshot.ts functions/src/index.ts
git commit -m "feat: cloud function para generar snapshots mensuales de metricas"
```

---

### Task 4: Módulo de agregación mensual → trimestral (frontend)

**Files:**
- Create: `src/lib/metric-aggregation.ts`
- Test: `src/lib/metric-aggregation.test.ts`

**Contexto:** Dado un array de `MetricSnapshot` (1 para "mes", 3 para "trimestre"), produce una vista agregada única con el mismo shape "de respuesta" que usan las tarjetas de KPIs hoy (nombre del grupo ganador, día ganador, etc.), recalculado sobre el total agregado — no promediando "ganadores" sueltos.

- [ ] **Paso 1: Escribir los tests**

```ts
// src/lib/metric-aggregation.test.ts
import { describe, it, expect } from 'vitest'
import { aggregateSnapshots } from '@/lib/metric-aggregation'
import type { MetricSnapshot } from '@/types'

function makeSnapshot(overrides: Partial<MetricSnapshot> = {}): MetricSnapshot {
  return {
    id: 'club-1_2026-06',
    clubId: 'club-1',
    year: 2026,
    month: 6,
    generatedAt: new Date('2026-07-01'),
    generatedBy: 'scheduled',
    revenueByGroup: { 'g1': 100 },
    groupNames: { g1: 'Grupo 1', g2: 'Grupo 2' },
    churnByGroup: { 'g1': 1 },
    newPlayersCount: 3,
    attendanceByDayOfWeek: { 1: 10, 3: 5 },
    paymentsGenerated: 10,
    paymentsPaid: 8,
    underutilizedSlotsCount: 4,
    atRiskPlayersCount: 2,
    avgReviewQuality: 4.0,
    coachStats: [{ coachId: 'c1', coachName: 'Ana', rph: 40, retentionPct: 80, hours: 10 }],
    ...overrides,
  }
}

describe('aggregateSnapshots', () => {
  it('con un solo snapshot, devuelve sus valores tal cual', () => {
    const result = aggregateSnapshots([makeSnapshot()])
    expect(result.mostProfitableGroup).toEqual({ groupId: 'g1', groupName: 'Grupo 1', revenue: 100 })
    expect(result.newPlayersCount).toBe(3)
    expect(result.underutilizedSlotsCount).toBe(4)
  })

  it('suma los ingresos por grupo entre varios meses y recalcula el ganador', () => {
    const s1 = makeSnapshot({ revenueByGroup: { g1: 100, g2: 50 } })
    const s2 = makeSnapshot({ revenueByGroup: { g1: 20, g2: 200 } })
    const result = aggregateSnapshots([s1, s2])
    // g1: 120, g2: 250 -> gana g2 en el trimestre, aunque g1 ganara el primer mes
    expect(result.mostProfitableGroup).toEqual({ groupId: 'g2', groupName: 'Grupo 2', revenue: 250 })
  })

  it('suma alumnos nuevos entre meses', () => {
    const s1 = makeSnapshot({ newPlayersCount: 3 })
    const s2 = makeSnapshot({ newPlayersCount: 5 })
    const result = aggregateSnapshots([s1, s2])
    expect(result.newPlayersCount).toBe(8)
  })

  it('suma asistencia por dia de la semana y recalcula el dia con mas asistencia', () => {
    const s1 = makeSnapshot({ attendanceByDayOfWeek: { 1: 10, 3: 5 } })
    const s2 = makeSnapshot({ attendanceByDayOfWeek: { 1: 2, 3: 20 } })
    const result = aggregateSnapshots([s1, s2])
    // dia 1: 12, dia 3: 25 -> gana el 3 en el trimestre
    expect(result.bestDayOfWeek).toBe(3)
  })

  it('calcula la tasa de cobro sobre el total de pagos generados/pagados, no promediando porcentajes', () => {
    const s1 = makeSnapshot({ paymentsGenerated: 10, paymentsPaid: 10 }) // 100%
    const s2 = makeSnapshot({ paymentsGenerated: 90, paymentsPaid: 0 })  // 0%
    const result = aggregateSnapshots([s1, s2])
    // promedio simple de 100%/0% seria 50%, pero el correcto es 10/100 = 10%
    expect(result.collectionRatePct).toBe(10)
  })

  it('promedia las metricas de estado (franjas infrautilizadas, calidad, retencion, €/h)', () => {
    const s1 = makeSnapshot({ underutilizedSlotsCount: 4, avgReviewQuality: 4.0 })
    const s2 = makeSnapshot({ underutilizedSlotsCount: 8, avgReviewQuality: 3.0 })
    const result = aggregateSnapshots([s1, s2])
    expect(result.underutilizedSlotsCount).toBe(6)
    expect(result.avgReviewQuality).toBe(3.5)
  })

  it('ignora avgReviewQuality nulo al promediar en vez de tratarlo como 0', () => {
    const s1 = makeSnapshot({ avgReviewQuality: 4.0 })
    const s2 = makeSnapshot({ avgReviewQuality: null })
    const result = aggregateSnapshots([s1, s2])
    expect(result.avgReviewQuality).toBe(4.0)
  })

  it('promedia rph/retentionPct/hours por coach a traves de los snapshots', () => {
    const s1 = makeSnapshot({ coachStats: [{ coachId: 'c1', coachName: 'Ana', rph: 40, retentionPct: 80, hours: 10 }] })
    const s2 = makeSnapshot({ coachStats: [{ coachId: 'c1', coachName: 'Ana', rph: 60, retentionPct: 60, hours: 20 }] })
    const result = aggregateSnapshots([s1, s2])
    const ana = result.coachStats.find(c => c.coachId === 'c1')
    expect(ana).toMatchObject({ rph: 50, retentionPct: 70, hours: 15 })
  })

  it('devuelve null en mostProfitableGroup si no hay ingresos en ningun mes', () => {
    const result = aggregateSnapshots([makeSnapshot({ revenueByGroup: {} })])
    expect(result.mostProfitableGroup).toBeNull()
  })
})
```

- [ ] **Paso 2: Ejecutar los tests para confirmar que fallan**

Run: `npm test -- metric-aggregation`
Expected: FAIL con "Cannot find module '@/lib/metric-aggregation'"

- [ ] **Paso 3: Implementar `src/lib/metric-aggregation.ts`**

```ts
import type { MetricSnapshot } from '@/types'

export interface AggregatedMetrics {
  mostProfitableGroup: { groupId: string; groupName: string; revenue: number } | null
  mostChurnGroup: { groupId: string; groupName: string; count: number } | null
  newPlayersCount: number
  bestDayOfWeek: number | null
  bestDayCount: number
  collectionRatePct: number | null
  paymentsGenerated: number
  paymentsPaid: number
  underutilizedSlotsCount: number
  atRiskPlayersCount: number
  avgReviewQuality: number | null
  coachStats: Array<{
    coachId: string
    coachName: string
    rph: number
    retentionPct: number | null
    hours: number
  }>
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/**
 * Combina 1 (mes) o 3 (trimestre) MetricSnapshot en una unica vista agregada.
 * Las metricas acumulables se suman y se recalcula el "ganador" sobre el
 * total; las metricas de estado se promedian. Puro, sin dependencias de
 * React ni del store, para poder testearse de forma aislada.
 */
export function aggregateSnapshots(snapshots: MetricSnapshot[]): AggregatedMetrics {
  // ── Grupo mas rentable (suma de revenueByGroup) ───────────────────
  const revenueByGroup: Record<string, number> = {}
  const groupNames: Record<string, string> = {}
  snapshots.forEach(s => {
    Object.assign(groupNames, s.groupNames)
    Object.entries(s.revenueByGroup).forEach(([groupId, amount]) => {
      revenueByGroup[groupId] = (revenueByGroup[groupId] ?? 0) + amount
    })
  })
  const revenueEntries = Object.entries(revenueByGroup).sort((a, b) => b[1] - a[1])
  const mostProfitableGroup = revenueEntries.length > 0
    ? { groupId: revenueEntries[0][0], groupName: groupNames[revenueEntries[0][0]] ?? 'Grupo desconocido', revenue: revenueEntries[0][1] }
    : null

  // ── Grupo con mas bajas (suma de churnByGroup) ────────────────────
  const churnByGroup: Record<string, number> = {}
  snapshots.forEach(s => {
    Object.entries(s.churnByGroup).forEach(([groupId, count]) => {
      churnByGroup[groupId] = (churnByGroup[groupId] ?? 0) + count
    })
  })
  const churnEntries = Object.entries(churnByGroup).sort((a, b) => b[1] - a[1])
  const mostChurnGroup = churnEntries.length > 0
    ? { groupId: churnEntries[0][0], groupName: groupNames[churnEntries[0][0]] ?? 'Grupo desconocido', count: churnEntries[0][1] }
    : null

  // ── Alumnos nuevos (suma) ──────────────────────────────────────────
  const newPlayersCount = snapshots.reduce((sum, s) => sum + s.newPlayersCount, 0)

  // ── Dia con mas asistencia (suma de attendanceByDayOfWeek) ────────
  const attendanceByDay: Record<number, number> = {}
  snapshots.forEach(s => {
    Object.entries(s.attendanceByDayOfWeek).forEach(([dow, count]) => {
      const day = Number(dow)
      attendanceByDay[day] = (attendanceByDay[day] ?? 0) + count
    })
  })
  const dayEntries = Object.entries(attendanceByDay).sort((a, b) => b[1] - a[1])
  const bestDayOfWeek = dayEntries.length > 0 ? Number(dayEntries[0][0]) : null
  const bestDayCount = dayEntries.length > 0 ? dayEntries[0][1] : 0

  // ── Tasa de cobro (sobre el total generado/pagado, no promedio de %) ──
  const paymentsGenerated = snapshots.reduce((sum, s) => sum + s.paymentsGenerated, 0)
  const paymentsPaid = snapshots.reduce((sum, s) => sum + s.paymentsPaid, 0)
  const collectionRatePct = paymentsGenerated > 0 ? Math.round((paymentsPaid / paymentsGenerated) * 100) : null

  // ── Metricas de estado (promedio) ──────────────────────────────────
  const underutilizedSlotsCount = Math.round(average(snapshots.map(s => s.underutilizedSlotsCount)))
  const atRiskPlayersCount = Math.round(average(snapshots.map(s => s.atRiskPlayersCount)))
  const qualityValues = snapshots.map(s => s.avgReviewQuality).filter((v): v is number => v !== null)
  const avgReviewQuality = qualityValues.length > 0 ? Math.round(average(qualityValues) * 10) / 10 : null

  // ── Coaches: promedio de rph/retentionPct/hours por coachId ───────
  const coachAccum: Record<string, { coachName: string; rph: number[]; retentionPct: number[]; hours: number[] }> = {}
  snapshots.forEach(s => {
    s.coachStats.forEach(c => {
      if (!coachAccum[c.coachId]) coachAccum[c.coachId] = { coachName: c.coachName, rph: [], retentionPct: [], hours: [] }
      coachAccum[c.coachId].rph.push(c.rph)
      if (c.retentionPct !== null) coachAccum[c.coachId].retentionPct.push(c.retentionPct)
      coachAccum[c.coachId].hours.push(c.hours)
    })
  })
  const coachStats = Object.entries(coachAccum).map(([coachId, data]) => ({
    coachId,
    coachName: data.coachName,
    rph: Math.round(average(data.rph) * 100) / 100,
    retentionPct: data.retentionPct.length > 0 ? Math.round(average(data.retentionPct)) : null,
    hours: Math.round(average(data.hours) * 10) / 10,
  }))

  return {
    mostProfitableGroup,
    mostChurnGroup,
    newPlayersCount,
    bestDayOfWeek,
    bestDayCount,
    collectionRatePct,
    paymentsGenerated,
    paymentsPaid,
    underutilizedSlotsCount,
    atRiskPlayersCount,
    avgReviewQuality,
    coachStats,
  }
}
```

- [ ] **Paso 4: Ejecutar los tests para confirmar que pasan**

Run: `npm test -- metric-aggregation`
Expected: PASS, 8 tests.

- [ ] **Paso 5: Build y suite completa**

Run: `npm run build`
Expected: sin errores.

Run: `npm test`
Expected: los 51 tests anteriores + los 8 nuevos, todos en verde.

- [ ] **Paso 6: Commit**

```bash
git add src/lib/metric-aggregation.ts src/lib/metric-aggregation.test.ts
git commit -m "feat: agregacion mensual a trimestral de metric snapshots"
```

---

### Task 5: Componente de gráfico de tendencia (`MetricTrendChart.tsx`)

**Files:**
- Create: `src/components/shared/analytics/MetricTrendChart.tsx`

**Contexto:** Gráfico de barras de una sola serie (un valor numérico por mes disponible), siguiendo el patrón Recharts ya usado en `src/components/financials/AnnualFinancialSummary.tsx` (barras con esquinas redondeadas, `CartesianGrid`, `Tooltip`). Un único color (`#2563eb`, azul ya usado en el resto de la app) — es una sola serie, no necesita más.

- [ ] **Paso 1: Crear el componente**

```tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export interface TrendPoint {
  label: string   // ej. "Mar 2026"
  value: number
}

interface MetricTrendChartProps {
  title: string
  points: TrendPoint[]
  valueFormatter?: (value: number) => string
}

export function MetricTrendChart({ title, points, valueFormatter }: MetricTrendChartProps) {
  const format = valueFormatter ?? ((v: number) => `${v}`)

  if (points.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        No hay histórico suficiente para mostrar la tendencia de "{title}".
      </div>
    )
  }

  return (
    <div>
      <p className="text-sm font-medium text-foreground mb-3">{title} — últimos {points.length} meses</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={points} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(value: number) => format(value)} />
          <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Paso 2: Build**

Run: `npm run build`
Expected: sin errores de TypeScript.

- [ ] **Paso 3: Commit**

```bash
git add src/components/shared/analytics/MetricTrendChart.tsx
git commit -m "feat: componente de grafico de tendencia para el historico de metricas"
```

---

### Task 6: Pestaña "Histórico" (`HistoryTab.tsx`)

**Files:**
- Create: `src/components/shared/analytics/HistoryTab.tsx`

**Contexto:** Tabla de comparación general (periodo actual vs anterior) + detalle por métrica al hacer clic + botón manual de generación + aviso de histórico insuficiente. Usa `aggregateSnapshots` (Task 4) y `getPeriodStart`/`AnalyticsPeriod` (`src/lib/period.ts`, ya existente).

- [ ] **Paso 1: Crear el componente**

```tsx
import { useMemo, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { useDataStore } from '@/stores/dataStore'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/hooks/use-toast'
import { functions } from '@/lib/firebase'
import { formatCurrency } from '@/lib/utils'
import { aggregateSnapshots, type AggregatedMetrics } from '@/lib/metric-aggregation'
import { MetricTrendChart, type TrendPoint } from './MetricTrendChart'
import type { MetricSnapshot } from '@/types'

type ComparisonPeriod = 'month' | 'quarter'

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

interface MetricRow {
  key: string
  label: string
  format: (m: AggregatedMetrics) => string
  rawValue: (m: AggregatedMetrics) => number | null
  higherIsBetter: boolean | null // null = no aplica comparacion de color (ej. texto libre)
}

const METRIC_ROWS: MetricRow[] = [
  {
    key: 'revenue',
    label: 'Ingresos del grupo top',
    format: m => m.mostProfitableGroup ? `${formatCurrency(m.mostProfitableGroup.revenue)} (${m.mostProfitableGroup.groupName})` : 'Sin datos',
    rawValue: m => m.mostProfitableGroup?.revenue ?? null,
    higherIsBetter: true,
  },
  {
    key: 'newPlayers',
    label: 'Alumnos nuevos',
    format: m => `${m.newPlayersCount}`,
    rawValue: m => m.newPlayersCount,
    higherIsBetter: true,
  },
  {
    key: 'churn',
    label: 'Bajas del grupo con más abandonos',
    format: m => m.mostChurnGroup ? `${m.mostChurnGroup.count} (${m.mostChurnGroup.groupName})` : 'Sin bajas',
    rawValue: m => m.mostChurnGroup?.count ?? null,
    higherIsBetter: false,
  },
  {
    key: 'collectionRate',
    label: 'Tasa de cobro',
    format: m => m.collectionRatePct !== null ? `${m.collectionRatePct}%` : 'Sin datos',
    rawValue: m => m.collectionRatePct,
    higherIsBetter: true,
  },
  {
    key: 'bestDay',
    label: 'Día con más asistencia',
    format: m => m.bestDayOfWeek !== null ? DAY_NAMES[m.bestDayOfWeek] : 'Sin datos',
    rawValue: m => m.bestDayCount,
    higherIsBetter: null,
  },
  {
    key: 'underutilized',
    label: 'Franjas infrautilizadas (media)',
    format: m => `${m.underutilizedSlotsCount}`,
    rawValue: m => m.underutilizedSlotsCount,
    higherIsBetter: false,
  },
  {
    key: 'atRisk',
    label: 'Alumnos en riesgo (media)',
    format: m => `${m.atRiskPlayersCount}`,
    rawValue: m => m.atRiskPlayersCount,
    higherIsBetter: false,
  },
  {
    key: 'quality',
    label: 'Calidad media cuestionarios',
    format: m => m.avgReviewQuality !== null ? `${m.avgReviewQuality}/5` : 'Sin datos',
    rawValue: m => m.avgReviewQuality,
    higherIsBetter: true,
  },
]

function monthsBack(count: number, from: Date = new Date()): { year: number; month: number }[] {
  const result: { year: number; month: number }[] = []
  const cursor = new Date(from.getFullYear(), from.getMonth() - 1, 1) // el mes actual aun no ha cerrado
  for (let i = 0; i < count; i++) {
    result.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 })
    cursor.setMonth(cursor.getMonth() - 1)
  }
  return result.reverse()
}

function findSnapshot(snapshots: MetricSnapshot[], year: number, month: number): MetricSnapshot | undefined {
  return snapshots.find(s => s.year === year && s.month === month)
}

export function HistoryTab() {
  const { metricSnapshots } = useDataStore()
  const { user } = useAuthStore()
  const [comparisonPeriod, setComparisonPeriod] = useState<ComparisonPeriod>('month')
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const monthsNeeded = comparisonPeriod === 'month' ? 2 : 6 // mes vs mes: 2 meses; trimestre vs trimestre: 6 meses
  const recentMonths = useMemo(() => monthsBack(monthsNeeded), [monthsNeeded])

  const currentSnapshots = useMemo(() => {
    const months = comparisonPeriod === 'month' ? recentMonths.slice(-1) : recentMonths.slice(-3)
    return months.map(({ year, month }) => findSnapshot(metricSnapshots, year, month)).filter((s): s is MetricSnapshot => !!s)
  }, [metricSnapshots, recentMonths, comparisonPeriod])

  const previousSnapshots = useMemo(() => {
    const months = comparisonPeriod === 'month' ? recentMonths.slice(0, 1) : recentMonths.slice(0, 3)
    return months.map(({ year, month }) => findSnapshot(metricSnapshots, year, month)).filter((s): s is MetricSnapshot => !!s)
  }, [metricSnapshots, recentMonths, comparisonPeriod])

  const hasEnoughHistory = currentSnapshots.length > 0 && previousSnapshots.length > 0

  const current = useMemo(() => aggregateSnapshots(currentSnapshots), [currentSnapshots])
  const previous = useMemo(() => aggregateSnapshots(previousSnapshots), [previousSnapshots])

  const trendPoints = useMemo((): TrendPoint[] => {
    if (!selectedMetric) return []
    const row = METRIC_ROWS.find(r => r.key === selectedMetric)
    if (!row) return []
    const allMonths = monthsBack(12)
    return allMonths
      .map(({ year, month }) => {
        const snap = findSnapshot(metricSnapshots, year, month)
        if (!snap) return null
        const agg = aggregateSnapshots([snap])
        const value = row.rawValue(agg)
        if (value === null) return null
        return { label: `${MONTH_SHORT[month]} ${year}`, value }
      })
      .filter((p): p is TrendPoint => p !== null)
  }, [selectedMetric, metricSnapshots])

  const handleGenerate = async () => {
    if (!user?.clubId) return
    setGenerating(true)
    try {
      const fn = httpsCallable(functions, 'generateMetricSnapshotCallable')
      const now = new Date()
      await fn({ clubId: user.clubId, year: now.getFullYear(), month: now.getMonth() + 1 })
      toast.success('Snapshot generado')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido'
      toast.error(`Error al generar el snapshot: ${message}`)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          Comparación con el periodo inmediatamente anterior.
        </p>
        <div className="flex items-center gap-2">
          <Select
            className="w-36 h-8 text-xs"
            value={comparisonPeriod}
            onChange={e => setComparisonPeriod(e.target.value as ComparisonPeriod)}
            options={[
              { value: 'month', label: 'Mes vs mes' },
              { value: 'quarter', label: 'Trimestre vs trimestre' },
            ]}
          />
          <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating}>
            {generating ? 'Generando...' : 'Generar snapshot de este mes'}
          </Button>
        </div>
      </div>

      {!hasEnoughHistory ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Aún no hay suficiente histórico para comparar. Vuelve cuando se hayan cerrado al menos {comparisonPeriod === 'month' ? '2 meses' : '2 trimestres'}.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2">Métrica</th>
                  <th className="py-2">Periodo actual</th>
                  <th className="py-2">Periodo anterior</th>
                  <th className="py-2">Cambio</th>
                </tr>
              </thead>
              <tbody>
                {METRIC_ROWS.map(row => {
                  const currentVal = row.rawValue(current)
                  const previousVal = row.rawValue(previous)
                  const delta = currentVal !== null && previousVal !== null ? currentVal - previousVal : null
                  const isGood = delta !== null && row.higherIsBetter !== null
                    ? (row.higherIsBetter ? delta > 0 : delta < 0)
                    : null
                  return (
                    <tr
                      key={row.key}
                      className="border-b last:border-0 cursor-pointer hover:bg-accent/40"
                      onClick={() => setSelectedMetric(row.key)}
                    >
                      <td className="py-2 font-medium">{row.label}</td>
                      <td className="py-2">{row.format(current)}</td>
                      <td className="py-2 text-muted-foreground">{row.format(previous)}</td>
                      <td className="py-2">
                        {delta === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className={isGood === null ? 'text-muted-foreground' : isGood ? 'text-emerald-600' : 'text-red-600'}>
                            {delta > 0 ? '▲' : delta < 0 ? '▼' : '='} {Math.abs(delta)}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {selectedMetric && (
        <Card>
          <CardContent className="p-5">
            <MetricTrendChart
              title={METRIC_ROWS.find(r => r.key === selectedMetric)?.label ?? ''}
              points={trendPoints}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

const MONTH_SHORT: Record<number, string> = {
  1: 'Ene', 2: 'Feb', 3: 'Mar', 4: 'Abr', 5: 'May', 6: 'Jun',
  7: 'Jul', 8: 'Ago', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dic',
}
```

- [ ] **Paso 2: Confirmar que `functions` está exportado desde `src/lib/firebase.ts`**

Leer `src/lib/firebase.ts` — si no exporta ya una instancia de `Functions` (`import { getFunctions } from 'firebase/functions'`), añadirla:

```ts
import { getFunctions } from 'firebase/functions'
// ...
export const functions = getFunctions(app, 'europe-west1')
```

(Usar la misma región que las Cloud Functions, `europe-west1`, definida en la Tarea 3 — si el archivo ya inicializa `app` con otro nombre de variable, usar ese.)

- [ ] **Paso 3: Build**

Run: `npm run build`
Expected: sin errores de TypeScript.

- [ ] **Paso 4: Commit**

```bash
git add src/components/shared/analytics/HistoryTab.tsx src/lib/firebase.ts
git commit -m "feat: pestana Historico con comparacion general y detalle de tendencia"
```

---

### Task 7: Registrar la pestaña en `AnalyticsPage.tsx`

**Files:**
- Modify: `src/pages/AnalyticsPage.tsx`

- [ ] **Paso 1: Añadir el tipo de pestaña y el import**

Cambiar:
```ts
import { CoachRankingTab } from '@/components/shared/analytics/CoachRankingTab'
import { useClassReviewsQuery } from '@/hooks/useQueries'

type Tab = 'kpis' | 'riesgo' | 'cuestionarios' | 'ranking'

const VALID_TABS: Tab[] = ['kpis', 'riesgo', 'cuestionarios', 'ranking']
```
por:
```ts
import { CoachRankingTab } from '@/components/shared/analytics/CoachRankingTab'
import { HistoryTab } from '@/components/shared/analytics/HistoryTab'
import { useClassReviewsQuery } from '@/hooks/useQueries'

type Tab = 'kpis' | 'riesgo' | 'cuestionarios' | 'ranking' | 'historico'

const VALID_TABS: Tab[] = ['kpis', 'riesgo', 'cuestionarios', 'ranking', 'historico']
```

- [ ] **Paso 2: Añadir el icono al import de `lucide-react`**

Cambiar:
```ts
import { TrendingUp, AlertTriangle, Star, Trophy } from 'lucide-react'
```
por:
```ts
import { TrendingUp, AlertTriangle, Star, Trophy, History } from 'lucide-react'
```

- [ ] **Paso 3: Añadir el `TabsTrigger` y el `TabsContent`**

Cambiar el `TabsList` de `grid-cols-2 sm:grid-cols-4` a `grid-cols-2 sm:grid-cols-5` (para acomodar la 5ª pestaña), y añadir, tras el `TabsTrigger` de "ranking":

```tsx
            <TabsTrigger value="historico" className="flex items-center gap-1.5 text-xs py-2">
              <History className="h-3.5 w-3.5 hidden sm:block" />
              Histórico
            </TabsTrigger>
```

Y tras el `TabsContent` de "ranking":

```tsx
          <TabsContent value="historico">
            <HistoryTab />
          </TabsContent>
```

- [ ] **Paso 4: Build**

Run: `npm run build`
Expected: sin errores de TypeScript.

- [ ] **Paso 5: Verificación manual**

Run: `npm run dev`, abrir `/analitica`, confirmar que aparece la 5ª pestaña "Histórico" y que muestra el aviso de "histórico insuficiente" (no hay snapshots en desarrollo todavía).

- [ ] **Paso 6: Commit**

```bash
git add src/pages/AnalyticsPage.tsx
git commit -m "feat: registrar la pestana Historico en AnalyticsPage"
```

---

## Verificación final

1. `npm run build` y `npm test` (frontend) sin errores — deben pasar los 51 tests anteriores + los 8 nuevos de `metric-aggregation.test.ts` = 59 tests.
2. `npm --prefix functions run build` sin errores.
3. Manual (requiere emuladores Firebase o entorno de desarrollo con Cloud Functions desplegadas): pulsar "Generar snapshot de este mes" en la pestaña Histórico; confirmar que se crea el documento en `metricSnapshots`. Repetir para un mes simulado adicional (puede requerir invocar la función *callable* con `year`/`month` distintos manualmente, p. ej. desde la consola de Firebase o un script temporal) y confirmar que la tabla de comparación general aparece con ambos meses y las flechas de cambio con el color correcto según si esa métrica mejora o empeora al subir.
4. Cambiar a "Trimestre vs trimestre" con al menos 6 snapshots mensuales disponibles (2 trimestres); confirmar que las métricas acumulables muestran la suma de 3 meses y las de estado el promedio.
5. Hacer clic en una fila de la tabla; confirmar que aparece el gráfico de tendencia con los meses disponibles.
