import { HttpError } from "./http";

// API months are "YYYY-MM". The database stores the first of the month
// ("YYYY-MM-01") in `date` columns. Both sort correctly as plain strings.

export const monthStart = (month: string) => `${month}-01`;

// "Current month" follows the server's timezone (the TZ env var).
export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function isMonth(value: string): boolean {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  return !!m && Number(m[1]) >= 2000 && Number(m[1]) <= 2100;
}

export function parseMonth(value: string): string {
  if (!isMonth(value)) {
    throw new HttpError(400, "Month must be in YYYY-MM format");
  }
  return value;
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

// Validates a calendar date string "YYYY-MM-DD" (rejects e.g. 2026-02-30).
export function parseDate(value: unknown): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T00:00:00Z`);
    if (
      !Number.isNaN(d.getTime()) &&
      d.toISOString().slice(0, 10) === value &&
      isMonth(value.slice(0, 7))
    ) {
      return value;
    }
  }
  throw new HttpError(400, "Date must be a valid date in YYYY-MM-DD format");
}

// Today's date as "YYYY-MM-DD" in the server's timezone.
export function currentDate(now: Date = new Date()): string {
  return `${currentMonth(now)}-${String(now.getDate()).padStart(2, "0")}`;
}
