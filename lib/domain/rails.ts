// Promise C: the arrival date shown before approval is the real one (PRD 3 "Rails", BP-09).
// THE single place that decides rail, send time and arrival date.
import type { Halalas, ISODate, RailQuote } from "./types";
import { assertHalalas } from "./money";
import { atRiyadh, isBankingDay, nextBankingDay, parseISODate, riyadhDate, riyadhParts } from "./time";

/** Instant payments (sarie) carry up to SAR 20,000.00 inclusive, 24/7 (BUILD-NOTES 4). */
export const INSTANT_MAX: Halalas = 2_000_000;
/** SARIE window, Riyadh time, Sun-Thu: 09:00 to 15:58 inclusive (15:58:59 in, 15:59:00 out). */
export const SARIE_OPEN = "09:00";
export const SARIE_CUTOFF = "15:58";

export type RailReason =
  | "instant_24_7"
  | "sarie_in_window"
  | "sarie_before_open"
  | "sarie_after_cutoff"
  | "sarie_weekend"
  | "sadad_24_7";

export function railFor(amount: Halalas): "instant" | "sarie" {
  assertPositive(amount);
  return amount <= INSTANT_MAX ? "instant" : "sarie";
}

/**
 * Rail, actual send time and arrival date for a supplier payment that is ready to leave at `sendAt`.
 * `sameDay` is true when it arrives on the Riyadh day it was asked to leave.
 */
export function railAndArrival(amount: Halalas, sendAt: Date): RailQuote {
  if (railFor(amount) === "instant") return quote("instant", sendAt, sendAt, "instant_24_7");
  const { at, reason } = sarieSendTime(sendAt);
  return quote("sarie", sendAt, at, reason);
}

/** When a SARIE payment requested at `requested` actually leaves. */
export function sarieSendTime(requested: Date): { at: Date; reason: RailReason } {
  const p = riyadhParts(requested);
  const minute = p.hour * 60 + p.minute; // seconds ignored: 15:58:59 is still 15:58
  if (!isBankingDay(p.date)) return { at: atRiyadh(nextBankingDay(p.date), SARIE_OPEN), reason: "sarie_weekend" };
  if (minute < minuteOfDay(SARIE_OPEN)) return { at: atRiyadh(p.date, SARIE_OPEN), reason: "sarie_before_open" };
  if (minute > minuteOfDay(SARIE_CUTOFF)) {
    return { at: atRiyadh(nextBankingDay(p.date), SARIE_OPEN), reason: "sarie_after_cutoff" };
  }
  return { at: new Date(requested.getTime()), reason: "sarie_in_window" };
}

const minuteOfDay = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** SADAD bills: 24/7, paid the same day (BUILD-NOTES 4). */
export function sadadQuote(sendAt: Date): RailQuote {
  return quote("sadad", sendAt, sendAt, "sadad_24_7");
}

/**
 * When an approved payment is released (BUILD-NOTES 2): at approval (`now`) if its pay date is today
 * or past, else 09:00 Riyadh on the pay date. The rail may then move it later.
 */
export function plannedSendAt(payDate: ISODate, now: Date): Date {
  parseISODate(payDate); // throws on a malformed date rather than mis-comparing strings
  return payDate <= riyadhDate(now) ? new Date(now.getTime()) : atRiyadh(payDate, SARIE_OPEN);
}

/** What the app shows before submitting/approving a supplier payment (BP-09). */
export function quotePayment(amount: Halalas, payDate: ISODate, now: Date): RailQuote {
  return railAndArrival(amount, plannedSendAt(payDate, now));
}

export function quoteSadadPayment(payDate: ISODate, now: Date): RailQuote {
  return sadadQuote(plannedSendAt(payDate, now));
}

function quote(rail: RailQuote["rail"], requested: Date, at: Date, reason: RailReason): RailQuote {
  const arrivalDate = riyadhDate(at);
  return {
    rail,
    sendAt: at.toISOString(),
    arrivalDate,
    sameDay: arrivalDate === riyadhDate(requested),
    reason,
  };
}

function assertPositive(amount: Halalas): void {
  assertHalalas(amount);
  if (amount <= 0) throw new RangeError(`Payment amount must be positive, got ${amount}`);
}
