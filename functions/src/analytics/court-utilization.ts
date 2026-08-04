import { isGroupCurrentlyActive } from "./group-utils";

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
  startDate: Date;
  endDate: Date;
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

function getWeekBuckets(groups: Group[], now: Date): WeekBucket[] {
  const seen = new Map<string, WeekBucket>();
  for (const group of groups) {
    if (!isGroupCurrentlyActive(group, now)) continue;
    for (const slot of group.schedule) {
      const key = `${slot.dayOfWeek}|${slot.startTime}|${slot.endTime}`;
      if (!seen.has(key)) {
        seen.set(key, { dayOfWeek: slot.dayOfWeek, startTime: slot.startTime, endTime: slot.endTime });
      }
    }
  }
  return Array.from(seen.values());
}

function findGroupForSlot(groups: Group[], courtId: string, bucket: WeekBucket, now: Date): Group | undefined {
  return groups.find(
    (g) =>
      isGroupCurrentlyActive(g, now) &&
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
  const buckets = getWeekBuckets(groups, now);
  const results: CourtSlotStatus[] = [];

  for (const court of activeCourts) {
    for (const bucket of buckets) {
      const group = findGroupForSlot(groups, court.id, bucket, now);
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
