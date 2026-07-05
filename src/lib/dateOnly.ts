// Postgres @db.Date columns are timezone-less; Prisma reads/writes them as JS Date
// instants pinned to UTC midnight. Every place that buckets or constructs a
// measurementDate must go through these helpers so "which calendar day is this"
// is computed the same way on the read and write side — using local Date getters
// (getFullYear/getMonth/getDate) instead would silently misbucket entries whenever
// the process's timezone offset isn't 0, which most cloud hosts default to anyway.
//
// This picks UTC as a neutral, internally-consistent default. It does NOT answer
// "what counts as a valid measurement day" (e.g. should a institution's midnight-to-
// midnight Israel day count instead) — that's an open product question. If it's
// ever answered as "institution-local day", swap the UTC getters/constructors below
// for Intl-timezone-aware equivalents in this one place.

export function toDateOnlyKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateOnlyKeyToDate(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function toDateOnly(date: Date): Date {
  return dateOnlyKeyToDate(toDateOnlyKey(date));
}

export function startOfUtcDay(date: Date): Date {
  return toDateOnly(date);
}

export function endOfUtcDay(date: Date): Date {
  const end = toDateOnly(date);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}
