// Glue between the UI and the domain rules for payments. Pure; usable from server and client.
// Rails: never re-implemented here — every rail/arrival comes from lib/domain/rails.ts (Promise C).
import { normalizeIban } from "@/lib/domain/iban";
import { canApproveBill, canApproveRun, supplierPaymentGate } from "@/lib/domain/permissions";
import { quotePayment, quoteSadadPayment } from "@/lib/domain/rails";
import type { RuleResult } from "@/lib/domain/result";
import type { Bill, ISODate, ISODateTime, Payment, PaymentRun, RailQuote, Supplier, User } from "@/lib/domain/types";

/** Rail, send time and arrival for a bill paid on `payDate`, as of the demo clock `now` (BP-09). */
export function previewQuote(bill: Pick<Bill, "kind" | "total">, payDate: ISODate, now: Date | ISODateTime): RailQuote {
  const at = typeof now === "string" ? new Date(now) : now;
  return bill.kind === "sadad" ? quoteSadadPayment(payDate, at) : quotePayment(bill.total, payDate, at);
}

/**
 * Once a payment exists, its stored quote (or its rail, send time and expected arrival) is the truth.
 * Reason words: when the arrival is not the pay date, the quote at the approval instant (same rails
 * function) explains the move ("After 3:58 PM cut-off") as long as it agrees with what was stored;
 * otherwise the stored reason.
 */
export function quoteFromPayment(
  payment: Payment,
  bill: Pick<Bill, "kind" | "total">,
  payDate: ISODate | undefined,
  approvedAt: ISODateTime | undefined,
): RailQuote {
  const stored: RailQuote = payment.quote ?? {
    rail: payment.rail,
    sendAt: payment.sentAt ?? payment.scheduledFor,
    arrivalDate: payment.expectedArrival,
    sameDay: payDate ? payment.expectedArrival === payDate : true,
    reason: "",
  };
  if (!payDate || !approvedAt || (stored.reason && stored.arrivalDate === payDate)) return stored;
  try {
    const atApproval = previewQuote(bill, payDate, approvedAt);
    if (atApproval.rail === stored.rail && atApproval.arrivalDate === stored.arrivalDate) {
      return { ...stored, reason: atApproval.reason };
    }
  } catch {
    // keep the stored reason
  }
  return stored;
}

/** Payment statuses that mean money left (BUILD-NOTES 7: "paid" = sent on its rail). */
export const isPaymentOut = (p: Pick<Payment, "status">) => p.status === "sent" || p.status === "settled";

/**
 * Suppliers that have already been paid to their current IBAN, so a further payment is not a
 * "first payment" (BP-06; an IBAN change re-arms the rule, as recommended in permissions.ts).
 */
export function paidSupplierIds(payments: readonly Payment[], suppliers: readonly Supplier[]): string[] {
  const ibanById = new Map(suppliers.map((s) => [s.id, normalizeIban(s.iban)]));
  const ids = new Set<string>();
  for (const p of payments) {
    if (!p.supplierId || !isPaymentOut(p)) continue;
    const current = ibanById.get(p.supplierId);
    if (!p.iban || !current || normalizeIban(p.iban) === current) ids.add(p.supplierId);
  }
  return [...ids];
}

/** Everything the approval hint needs; serialisable so it can be passed to client components. */
export interface ApprovalContext {
  users: User[];
  bills: Bill[];
  suppliers: Supplier[];
  paidSupplierIds: string[];
  makerChecker: boolean;
}

const supplierRecord = (suppliers: readonly Supplier[]) => Object.fromEntries(suppliers.map((s) => [s.id, s]));

/** Client-side mirror of the server's run approval check, for hints only (the server decides). */
export function runApprovalHint(userId: string, run: PaymentRun, ctx: ApprovalContext): RuleResult {
  const user = ctx.users.find((u) => u.id === userId);
  return canApproveRun(user, run, ctx.bills, supplierRecord(ctx.suppliers), ctx.paidSupplierIds, {
    makerChecker: ctx.makerChecker,
  });
}

/** Client-side mirror of the server's single-bill approval check (SADAD and standalone bills). */
export function billApprovalHint(userId: string, bill: Bill, ctx: ApprovalContext): RuleResult {
  const user = ctx.users.find((u) => u.id === userId);
  const supplier = bill.supplierId ? ctx.suppliers.find((s) => s.id === bill.supplierId) : undefined;
  return canApproveBill(user, bill, supplier, {
    makerChecker: ctx.makerChecker,
    supplierHasPaid: bill.supplierId ? ctx.paidSupplierIds.includes(bill.supplierId) : true,
  });
}

export { supplierPaymentGate };
