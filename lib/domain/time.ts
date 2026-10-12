// Asia/Riyadh calendar helpers. Instants are UTC Dates; calendar days are ISODate strings ("YYYY-MM-DD").
// Riyadh is UTC+3 with no DST, but we go through TZDate so results never depend on the process TZ.
import { TZDate } from "@date-fns/tz";
import type { ISODate, ISODateTime } from "./types";

export const RIYADH_TZ = "Asia/Riyadh";

export type Instant = Date | ISODateTime | number;

/** 0 = Sunday … 6 = Saturday (same as Date#getDay). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface RiyadhParts {
  year: number;
  /** 1-12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: Weekday;
  date: ISODate;
  /** "HH:mm" */
  time: string;
}

function toDate(instant: Instant): Date {
  const d = instant instanceof Date ? new Date(instant.getTime()) : new Date(instant);
  if (Number.isNaN(d.getTime())) throw new RangeError(`Invalid instant: ${String(instant)}`);
  return d;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export function riyadhParts(instant: Instant): RiyadhParts {
  const t = new TZDate(toDate(instant).getTime(), RIYADH_TZ);
  const year = t.getFullYear();
  const month = t.getMonth() + 1;
  const day = t.getDate();
  const hour = t.getHours();
  const minute = t.getMinutes();
  return {
    year,
    month,
    day,
    hour,
    minute,
    second: t.getSeconds(),
    weekday: t.getDay() as Weekday,
    date: `${year}-${pad2(month)}-${pad2(day)}`,
    time: `${pad2(hour)}:${pad2(minute)}`,
  };
}

/** Riyadh calendar date of an instant. */
export function riyadhDate(instant: Instant): ISODate {
  return riyadhParts(instant).date;
}

/** Today in Riyadh for the given clock (never reads the system clock). */
export const todayRiyadh = (now: Instant): ISODate => riyadhDate(now);

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Splits and validates "YYYY-MM-DD" (rejects 2026-02-30). */
export function parseISODate(date: ISODate): { year: number; month: number; day: number } {
  const m = ISO_DATE.exec(date);
  if (!m) throw new RangeError(`Invalid date: "${date}"`);
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    throw new RangeError(`Invalid date: "${date}"`);
  }
  return { year, month, day };
}

export function isISODate(s: unknown): s is ISODate {
  if (typeof s !== "string") return false;
  try {
    parseISODate(s);
    return true;
  } catch {
    return false;
  }
}

/** The instant at a Riyadh wall-clock time on a Riyadh date: atRiyadh("2026-10-18", "09:00") → 2026-10-18T06:00:00Z. */
export function atRiyadh(date: ISODate, time: string = "00:00"): Date {
  const { year, month, day } = parseISODate(date);
  const m = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!m) throw new RangeError(`Invalid time: "${time}"`);
  const [hh, mm, ss] = [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
  if (hh > 23 || mm > 59 || ss > 59) throw new RangeError(`Invalid time: "${time}"`);
  return new Date(new TZDate(year, month - 1, day, hh, mm, ss, RIYADH_TZ).getTime());
}

// Calendar arithmetic on ISODate strings is pure date math (no time zone involved).

export function addDays(date: ISODate, days: number): ISODate {
  const { year, month, day } = parseISODate(date);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Whole days from a to b (b - a). */
export function diffDays(a: ISODate, b: ISODate): number {
  const pa = parseISODate(a);
  const pb = parseISODate(b);
  return Math.round((Date.UTC(pb.year, pb.month - 1, pb.day) - Date.UTC(pa.year, pa.month - 1, pa.day)) / 86_400_000);
}

/** Days paid before the due date (positive = early, 0 = on the day, negative = late). The UI warns above 3. */
export function daysEarly(payDate: ISODate, dueDate: ISODate): number {
  return diffDays(payDate, dueDate);
}

export function weekdayOf(date: ISODate): Weekday {
  const { year, month, day } = parseISODate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() as Weekday;
}

const asDate = (d: ISODate | Date): ISODate => (d instanceof Date ? riyadhDate(d) : d);

/** Saudi banking days are Sunday to Thursday. Public holidays are not modelled (BUILD-NOTES 3). A Date is read in Riyadh. */
export function isBankingDay(date: ISODate | Date): boolean {
  return weekdayOf(asDate(date)) <= 4;
}

/** The first banking day strictly after `date`. */
export function nextBankingDay(date: ISODate | Date): ISODate {
  let d = addDays(asDate(date), 1);
  while (!isBankingDay(d)) d = addDays(d, 1);
  return d;
}

/** The working week is the banking week (Sun-Thu); retries use this (BP-10). */
export function nextWorkingDay(date: ISODate | Date): ISODate {
  return nextBankingDay(date);
}

const WEEKDAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const WEEKDAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"] as const;

/** "Sunday" / "Sun" / "الأحد". A Date is read in Riyadh. */
export function weekdayName(date: ISODate | Date, locale: string = "en", opts: { short?: boolean } = {}): string {
  const wd = weekdayOf(asDate(date));
  if (locale.toLowerCase().startsWith("ar")) return WEEKDAYS_AR[wd];
  const name = WEEKDAYS_EN[wd];
  return opts.short ? name.slice(0, 3) : name;
}
