import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { computeCourtUtilization, getUnderutilizedSlots } from "./court-utilization";
import { computeCoachStats } from "./coach-stats";

// ---------------------------------------------------------------------------
// Interfaces (mirroring the Firestore data model; superset of the fields
// needed by court-utilization.ts and coach-stats.ts, since the same `groups`
// array is passed to both)
// ---------------------------------------------------------------------------
interface ScheduleSlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface Group {
  id: string;
  name: string;
  coachId: string;
  courtId: string;
  schedule: ScheduleSlot[];
  maxCapacity: number;
  currentEnrollment: number;
  isActive: boolean;
  startDate: Date;
  endDate: Date;
}

interface Court {
  id: string;
  name: string;
  isActive: boolean;
}

interface Coach {
  id: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
}

interface Payment {
  groupId?: string;
  amount: number;
  status: string;
  billingMonth: number;
  billingYear: number;
  paidDate?: Date;
  dueDate: Date;
}

interface Enrollment {
  groupId: string;
  enrollmentDate: Date;
  unenrollmentDate?: Date;
  isActive: boolean;
}

interface AttendanceEntry {
  playerId: string;
  status: string;
}

interface AttendanceRecord {
  groupId: string;
  coachId: string;
  date: Date;
  records: AttendanceEntry[];
}

interface PrivateLesson {
  courtId: string;
  date: Date;
  startTime: string;
  endTime: string;
}

interface ClassReview {
  date: string;
  quality: number;
}

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

  const groups = groupsSnap.docs.map((d) => {
    const data = d.data();
    return { id: d.id, ...data, startDate: toDate(data.startDate), endDate: toDate(data.endDate) };
  }) as Group[];
  const courts = courtsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Court[];
  const coaches = coachesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Coach[];
  const payments = paymentsSnap.docs.map((d) => {
    const data = d.data();
    return { ...data, paidDate: data.paidDate ? toDate(data.paidDate) : undefined, dueDate: toDate(data.dueDate) };
  }) as Payment[];
  const enrollments = enrollmentsSnap.docs.map((d) => {
    const data = d.data();
    return { ...data, enrollmentDate: toDate(data.enrollmentDate), unenrollmentDate: data.unenrollmentDate ? toDate(data.unenrollmentDate) : undefined };
  }) as Enrollment[];
  const attendance = attendanceSnap.docs.map((d) => {
    const data = d.data();
    return { ...data, date: toDate(data.date) };
  }) as AttendanceRecord[];
  const privateLessons = privateLessonsSnap.docs.map((d) => {
    const data = d.data();
    return { ...data, date: toDate(data.date) };
  }) as PrivateLesson[];
  const reviews = reviewsSnap.docs.map((d) => d.data()) as ClassReview[];

  // ── Ingresos y bajas por grupo (acumulables) ──────────────────────
  const revenueByGroup: Record<string, number> = {};
  const groupNames: Record<string, string> = {};
  groups.forEach((g) => { groupNames[g.id] = g.name; });
  payments
    .filter((p) => p.status === "pagado" && p.groupId && p.paidDate && p.paidDate >= periodStart && p.paidDate < periodEnd)
    .forEach((p) => { revenueByGroup[p.groupId!] = (revenueByGroup[p.groupId!] ?? 0) + p.amount; });

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
  // Sin merge: el snapshot es una recomputacion completa desde cero cada vez,
  // asi que se sobreescribe entero para no dejar campos obsoletos si el
  // esquema cambia entre dos regeneraciones del mismo mes.
  await db.collection("metricSnapshots").doc(snapshotId).set(snapshot);
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
