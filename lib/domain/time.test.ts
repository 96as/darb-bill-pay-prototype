import { describe, expect, it } from "vitest";
import {
  addDays,
  atRiyadh,
  diffDays,
  isBankingDay,
  isISODate,
  nextBankingDay,
  nextWorkingDay,
  parseISODate,
  riyadhDate,
  riyadhParts,
  todayRiyadh,
  weekdayName,
  weekdayOf,
} from "./time";

// Demo clock: Thu 15 Oct 2026, 16:10 Riyadh.
const DEMO_NOW = new Date("2026-10-15T13:10:00.000Z");

describe("Riyadh instants", () => {
  it("reads Riyadh wall-clock parts", () => {
    expect(riyadhParts(DEMO_NOW)).toEqual({
      year: 2026,
      month: 10,
      day: 15,
      hour: 16,
      minute: 10,
      second: 0,
      weekday: 4,
      date: "2026-10-15",
      time: "16:10",
    });
  });

  it("rolls the date at Riyadh midnight, not UTC midnight", () => {
    expect(riyadhDate("2026-10-15T20:59:59.999Z")).toBe("2026-10-15");
    expect(riyadhDate("2026-10-15T21:00:00.000Z")).toBe("2026-10-16");
    expect(riyadhDate("2026-10-15T00:30:00.000Z")).toBe("2026-10-15");
    expect(riyadhDate(Date.UTC(2026, 11, 31, 22))).toBe("2027-01-01");
    expect(todayRiyadh(DEMO_NOW)).toBe("2026-10-15");
  });

  it("builds instants from Riyadh wall-clock time", () => {
    expect(atRiyadh("2026-10-18", "09:00").toISOString()).toBe("2026-10-18T06:00:00.000Z");
    expect(atRiyadh("2026-10-15", "16:10").toISOString()).toBe(DEMO_NOW.toISOString());
    expect(atRiyadh("2026-10-15", "15:58:59").toISOString()).toBe("2026-10-15T12:58:59.000Z");
    expect(atRiyadh("2026-10-16").toISOString()).toBe("2026-10-15T21:00:00.000Z");
  });

  it("rejects bad input", () => {
    expect(() => atRiyadh("2026-10-18", "9:00")).toThrow(RangeError);
    expect(() => atRiyadh("2026-10-18", "24:00")).toThrow(RangeError);
    expect(() => atRiyadh("2026-02-30", "09:00")).toThrow(RangeError);
    expect(() => riyadhDate("not a date")).toThrow(RangeError);
  });
});

describe("calendar", () => {
  it("validates ISO dates", () => {
    expect(parseISODate("2026-10-15")).toEqual({ year: 2026, month: 10, day: 15 });
    expect(isISODate("2026-10-15")).toBe(true);
    expect(isISODate("2026-13-01")).toBe(false);
    expect(isISODate("2026-10-5")).toBe(false);
    expect(isISODate(undefined)).toBe(false);
  });

  it("adds and diffs days across months and years", () => {
    expect(addDays("2026-10-15", 3)).toBe("2026-10-18");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(diffDays("2026-10-15", "2026-11-12")).toBe(28);
    expect(diffDays("2026-10-15", "2026-10-14")).toBe(-1);
  });

  it("knows the demo week", () => {
    expect(weekdayOf("2026-10-15")).toBe(4);
    expect(weekdayName("2026-10-15")).toBe("Thursday");
    expect(weekdayName("2026-10-18", "en", { short: true })).toBe("Sun");
    expect(weekdayName("2026-10-18", "ar")).toBe("الأحد");
    expect(weekdayName(DEMO_NOW)).toBe("Thursday");
  });

  it("treats Sunday to Thursday as banking days", () => {
    const week = ["2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17"];
    expect(week.map((d) => isBankingDay(d))).toEqual([true, true, true, true, true, false, false]);
  });

  it("reads a Date in Riyadh when checking banking days", () => {
    // Thu 23:00 UTC is already Fri 02:00 in Riyadh.
    expect(isBankingDay(new Date("2026-10-15T23:00:00.000Z"))).toBe(false);
    expect(isBankingDay(new Date("2026-10-15T20:00:00.000Z"))).toBe(true);
  });

  it("finds the next banking/working day", () => {
    expect(nextBankingDay("2026-10-15")).toBe("2026-10-18"); // Thu → Sun
    expect(nextBankingDay("2026-10-16")).toBe("2026-10-18"); // Fri → Sun
    expect(nextBankingDay("2026-10-17")).toBe("2026-10-18"); // Sat → Sun
    expect(nextBankingDay("2026-10-14")).toBe("2026-10-15"); // Wed → Thu
    expect(nextWorkingDay("2026-10-15")).toBe("2026-10-18");
    expect(nextBankingDay(DEMO_NOW)).toBe("2026-10-18");
  });
});
