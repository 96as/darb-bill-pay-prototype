// Admin-set money limits (BP-18; BUILD-NOTES 12: per-payment at submit, daily total for the pay date at approval).
import type { Halalas, Limits } from "./types";
import { allow, deny, type RuleResult } from "./result";
import { assertHalalas, formatSAR, sumHalalas } from "./money";

export type LimitCode = "per_payment_limit" | "daily_limit";

/** Amount ≤ per-payment limit (equal is allowed). */
export function checkPerPayment(amount: Halalas, limits: Pick<Limits, "perPayment">): RuleResult<LimitCode> {
  assertHalalas(amount);
  if (amount <= limits.perPayment) return allow();
  return deny("per_payment_limit", `${formatSAR(amount)} is above the per-payment limit of ${formatSAR(limits.perPayment)}`);
}

/**
 * Existing approved/scheduled amounts for the day plus this one stay within the daily limit (equal is allowed).
 * `existingForDay` is either the day's running total or the list of amounts.
 */
export function checkDaily(
  existingForDay: Halalas | readonly Halalas[],
  amount: Halalas,
  limits: Pick<Limits, "daily">,
): RuleResult<LimitCode> {
  assertHalalas(amount);
  const existing = typeof existingForDay === "number" ? existingForDay : sumHalalas(existingForDay);
  if (existing + amount <= limits.daily) return allow();
  const left = Math.max(0, limits.daily - existing);
  return deny(
    "daily_limit",
    `${formatSAR(amount)} would exceed the daily limit of ${formatSAR(limits.daily)} (${formatSAR(left)} left for that day)`,
  );
}

/** What is still available under the daily limit. */
export function dailyRemaining(existingForDay: Halalas | readonly Halalas[], limits: Pick<Limits, "daily">): Halalas {
  const existing = typeof existingForDay === "number" ? existingForDay : sumHalalas(existingForDay);
  return Math.max(0, limits.daily - existing);
}
