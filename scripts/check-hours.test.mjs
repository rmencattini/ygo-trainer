import { describe, expect, it } from "vitest";
import { isWorkingTime, parseDaysOff, swissHolidays } from "./check-hours.mjs";

// Times in UTC; Zurich is UTC+2 in summer (CEST), UTC+1 in winter (CET).
describe("isWorkingTime", () => {
  it("blocks a weekday at 10:00 Zurich", () => {
    expect(isWorkingTime(new Date("2026-10-08T08:00:00Z"))).toBe(true);
  });
  it("allows a weekday from 18:00 Zurich", () => {
    expect(isWorkingTime(new Date("2026-10-08T16:00:00Z"))).toBe(false);
  });
  it("blocks 17:59 and allows 07:59 Zurich", () => {
    expect(isWorkingTime(new Date("2026-10-08T15:59:00Z"))).toBe(true);
    expect(isWorkingTime(new Date("2026-10-08T05:59:00Z"))).toBe(false);
  });
  it("uses winter time after the DST switch", () => {
    // Mon 2 Nov 2026, 08:30 CET = 07:30 UTC
    expect(isWorkingTime(new Date("2026-11-02T07:30:00Z"))).toBe(true);
    expect(isWorkingTime(new Date("2026-11-02T06:30:00Z"))).toBe(false);
  });
  it("allows weekends", () => {
    expect(isWorkingTime(new Date("2026-10-10T10:00:00Z"))).toBe(false);
  });
  it("allows Swiss public holidays", () => {
    expect(isWorkingTime(new Date("2026-08-01T10:00:00Z"))).toBe(false); // Sat anyway
    expect(isWorkingTime(new Date("2027-08-02T10:00:00Z"))).toBe(true); // Mon after
    expect(isWorkingTime(new Date("2026-12-25T10:00:00Z"))).toBe(false); // Fri, Christmas
  });
  it("allows your own days off", () => {
    const daysOff = new Set(["2026-10-09"]);
    expect(isWorkingTime(new Date("2026-10-09T08:00:00Z"), daysOff)).toBe(
      false,
    );
    expect(isWorkingTime(new Date("2026-10-08T08:00:00Z"), daysOff)).toBe(true);
  });
});

describe("parseDaysOff", () => {
  it("reads one date per line, skipping blanks and # comments", () => {
    const text =
      "# holidays\n2026-10-09\n\n  2026-10-12  # long weekend\nnot a date\n";
    expect([...parseDaysOff(text)]).toEqual(["2026-10-09", "2026-10-12"]);
  });
});

describe("swissHolidays", () => {
  it("computes Easter-based days for 2026", () => {
    const h = swissHolidays(2026);
    for (const d of ["2026-04-03", "2026-04-06", "2026-05-14", "2026-05-25"]) {
      expect(h.has(d)).toBe(true);
    }
  });
});
