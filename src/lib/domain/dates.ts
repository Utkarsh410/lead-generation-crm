// Date helpers. Task due dates are calendar dates (YYYY-MM-DD) interpreted in the
// user's business timezone, so "today" never drifts because the server runs in UTC.

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

export function appTimezone(): string {
  return process.env.LEADOS_TIMEZONE || DEFAULT_TIMEZONE;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Calendar date (YYYY-MM-DD) of `now` in `timeZone`. */
export function todayInTimezone(timeZone: string = appTimezone(), now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDays(isoDate: string, days: number): string {
  if (!isIsoDate(isoDate)) throw new Error(`Invalid date: ${isoDate}`);
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export type DueBucket = "overdue" | "today" | "upcoming";

export function dueBucket(dueDate: string, today: string): DueBucket {
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "today";
  return "upcoming";
}

/** Calendar date of an ISO timestamp in the business timezone. */
export function dateInTimezone(timestamp: string | Date, timeZone: string = appTimezone()): string {
  return todayInTimezone(timeZone, typeof timestamp === "string" ? new Date(timestamp) : timestamp);
}

/** Monday (YYYY-MM-DD) of the week containing `isoDate`. */
export function startOfWeek(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  return addDays(isoDate, -day);
}
