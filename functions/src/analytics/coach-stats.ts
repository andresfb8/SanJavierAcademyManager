import { isGroupCurrentlyActive } from "./group-utils";

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
  coachId: string;
  schedule: ScheduleSlot[];
  isActive: boolean;
  startDate: Date;
  endDate: Date;
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
        .filter((g) => g.coachId === coach.id && isGroupCurrentlyActive(g, now))
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
