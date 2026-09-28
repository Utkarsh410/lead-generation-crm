// Display helpers safe for both server and client components.

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const dateYearFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

/** "12 Oct" for YYYY-MM-DD calendar dates. */
export function formatDay(isoDate: string | null | undefined, withYear = false): string {
  if (!isoDate) return "—";
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return "—";
  return (withYear ? dateYearFmt : dateFmt).format(d);
}

/** "12 Oct, 3:30 pm" for timestamps (shown in IST). */
export function formatDateTime(ts: string | null | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "—" : dateTimeFmt.format(d);
}

export function formatTimestampDay(ts: string | null | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "—" : dateFmt.format(d);
}

/** Relative wording for a due date vs today: "Today", "Tomorrow", "3 days overdue", "in 4 days". */
export function relativeDue(dueDate: string, today: string): string {
  const diff = Math.round((Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${-diff} days overdue`;
  return `in ${diff} days`;
}

export function relativeAgo(ts: string | null | undefined, now: Date = new Date()): string {
  if (!ts) return "—";
  const ms = now.getTime() - new Date(ts).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) {
    const hours = Math.floor(ms / 3_600_000);
    return hours <= 0 ? "just now" : `${hours}h ago`;
  }
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return formatTimestampDay(ts);
}
