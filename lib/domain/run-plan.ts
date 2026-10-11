// Short balance at send time (BP-10; BUILD-NOTES 11). Pure planning; the scheduler applies the result.
import type { Halalas, ISODate } from "./types";
import { atRiyadh, nextWorkingDay } from "./time";
import { SARIE_OPEN } from "./rails";

export interface PlannablePayment {
  amount: Halalas;
  fundingAccountId: string;
  /** Due date of the bill behind the payment; payments without one go last. */
  dueDate?: ISODate;
}

export interface RunPlan<P extends PlannablePayment> {
  /** Send now, in this order. */
  send: P[];
  /** Hold and retry on the next working day. */
  hold: P[];
  /** Balance left per account after the sends. */
  remainingByAccount: Record<string, Halalas>;
}

/**
 * Decides which payments of a run go now when the balance may be short.
 *
 * Choice: walk the payments in due-date order (earliest first; ties and missing due dates keep input
 * order, missing last) and send each one its funding account still covers. A payment that does not fit
 * is held, and the walk continues, so a later, smaller payment that still fits is paid. This pays the
 * most bills on time without ever overdrawing; the held ones retry on the next working day.
 * Accounts not in `balanceByAccount` have a balance of 0.
 */
export function planRunExecution<P extends PlannablePayment>(
  payments: readonly P[],
  balanceByAccount: Readonly<Record<string, Halalas>>,
): RunPlan<P> {
  const remaining: Record<string, Halalas> = { ...balanceByAccount };
  const send: P[] = [];
  const hold: P[] = [];
  for (const p of byDueDate(payments)) {
    const available = remaining[p.fundingAccountId] ?? 0;
    if (p.amount <= available) {
      send.push(p);
      remaining[p.fundingAccountId] = available - p.amount;
    } else {
      hold.push(p);
    }
  }
  return { send, hold, remainingByAccount: remaining };
}

function byDueDate<P extends PlannablePayment>(payments: readonly P[]): P[] {
  return payments
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const da = a.p.dueDate ?? "9999-12-31";
      const db = b.p.dueDate ?? "9999-12-31";
      return da < db ? -1 : da > db ? 1 : a.i - b.i;
    })
    .map(({ p }) => p);
}

/** Held payments retry on the next working day (Sun-Thu) … */
export function retryDate(today: ISODate): ISODate {
  return nextWorkingDay(today);
}

/** … at 09:00 Riyadh. */
export function retryAt(today: ISODate): Date {
  return atRiyadh(retryDate(today), SARIE_OPEN);
}

/**
 * The day-before check (BP-10: "the admin is alerted the day before"): per account, how much the
 * scheduled payments exceed the balance. Only short accounts are returned.
 */
export function shortfallByAccount(
  payments: readonly Pick<PlannablePayment, "amount" | "fundingAccountId">[],
  balanceByAccount: Readonly<Record<string, Halalas>>,
): Record<string, Halalas> {
  const due: Record<string, Halalas> = {};
  for (const p of payments) due[p.fundingAccountId] = (due[p.fundingAccountId] ?? 0) + p.amount;
  const short: Record<string, Halalas> = {};
  for (const [account, total] of Object.entries(due)) {
    const gap = total - (balanceByAccount[account] ?? 0);
    if (gap > 0) short[account] = gap;
  }
  return short;
}
