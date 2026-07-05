import { describe, expect, it } from "vitest";
import { toDateOnlyKey, dateOnlyKeyToDate, toDateOnly, startOfUtcDay, endOfUtcDay } from "./dateOnly";

describe("dateOnly", () => {
  it("extracts the UTC calendar date regardless of time-of-day", () => {
    expect(toDateOnlyKey(new Date("2026-07-05T23:59:59.999Z"))).toBe("2026-07-05");
    expect(toDateOnlyKey(new Date("2026-07-05T00:00:00.000Z"))).toBe("2026-07-05");
  });

  it("does not shift the date for instants that would cross a local day boundary", () => {
    // This instant is 2026-07-05 in UTC, but would read as 2026-07-04 under local
    // getters (getFullYear/getMonth/getDate) in any negative-UTC-offset timezone —
    // exactly the class of bug being guarded against here.
    const nearMidnightUtc = new Date("2026-07-05T00:30:00.000Z");
    expect(toDateOnlyKey(nearMidnightUtc)).toBe("2026-07-05");
  });

  it("round-trips a day key back to a UTC-midnight Date", () => {
    const date = dateOnlyKeyToDate("2026-07-05");
    expect(date.toISOString()).toBe("2026-07-05T00:00:00.000Z");
  });

  it("toDateOnly floors any instant to UTC midnight of its own calendar date", () => {
    const floored = toDateOnly(new Date("2026-07-05T14:23:10.000Z"));
    expect(floored.toISOString()).toBe("2026-07-05T00:00:00.000Z");
  });

  it("startOfUtcDay / endOfUtcDay bracket the same calendar day", () => {
    const start = startOfUtcDay(new Date("2026-07-05T14:23:10.000Z"));
    const end = endOfUtcDay(new Date("2026-07-05T14:23:10.000Z"));
    expect(start.toISOString()).toBe("2026-07-05T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-05T23:59:59.999Z");
  });
});
