// Bill statuses (PL-01, BP-11). Overdue is derived, never stored (BUILD-NOTES 10).
import type { Bill, BillStatus, DisplayStatus, ISODate } from "./types";

/** Statuses that can show Overdue: the bill is still unpaid and not cancelled. */
const CAN_BE_OVERDUE: ReadonlySet<BillStatus> = new Set(["draft", "awaiting_approval", "scheduled", "failed"]);

/** Overdue replaces the status when the due date (Riyadh) is before today. */
export function displayStatus(bill: Pick<Bill, "status" | "dueDate">, today: ISODate): DisplayStatus {
  return isOverdue(bill, today) ? "overdue" : bill.status;
}

export function isOverdue(bill: Pick<Bill, "status" | "dueDate">, today: ISODate): boolean {
  return !!bill.dueDate && bill.dueDate < today && CAN_BE_OVERDUE.has(bill.status);
}

/**
 * Allowed bill status moves.
 * - draft → awaiting_approval (submit) | cancelled
 * - awaiting_approval → scheduled (approved) | draft (rejected, or a material edit restarts approval) | cancelled
 * - scheduled → paid (sent; BUILD-NOTES 7) | failed | awaiting_approval or draft (material edit or IBAN change
 *   restarts approval, BP-08) | cancelled (until sent, BP-18)
 * - paid → failed (payment returned after sending, BP-10)
 * - failed → scheduled (retry) | draft (fix and resubmit) | cancelled
 * - draft → discarded only for a flagged duplicate (checked by canDiscardDuplicate); discarded is final.
 * - cancelled is final.
 */
export const BILL_TRANSITIONS: Readonly<Record<BillStatus, readonly BillStatus[]>> = {
  draft: ["awaiting_approval", "cancelled", "discarded"],
  awaiting_approval: ["scheduled", "draft", "cancelled"],
  scheduled: ["paid", "failed", "awaiting_approval", "draft", "cancelled"],
  paid: ["failed"],
  failed: ["scheduled", "draft", "cancelled"],
  cancelled: [],
  discarded: [],
};

export function canTransition(from: BillStatus, to: BillStatus): boolean {
  return BILL_TRANSITIONS[from].includes(to);
}

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: BillStatus,
    readonly to: BillStatus,
  ) {
    super(`A bill cannot move from ${from} to ${to}`);
    this.name = "InvalidTransitionError";
  }
}

/** Throws InvalidTransitionError for a move not in BILL_TRANSITIONS (staying in the same status is not a move). */
export function assertTransition(from: BillStatus, to: BillStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}
