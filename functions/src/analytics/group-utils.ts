interface GroupDates {
  isActive: boolean;
  startDate: Date;
  endDate: Date;
}

function toDateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function isGroupCurrentlyActive(group: GroupDates, date: Date): boolean {
  if (!group.isActive) return false;
  const day = toDateOnly(date);
  return day >= toDateOnly(group.startDate) && day <= toDateOnly(group.endDate);
}
