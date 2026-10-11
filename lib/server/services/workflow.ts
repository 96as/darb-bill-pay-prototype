// Approval workflow steps shared by bills, runs and suppliers.
import type { Bill, ISODate, Payment, User } from "@/lib/domain/types";
import { assertTransition } from "@/lib/domain/status";
import { checkPerPayment } from "@/lib/domain/limits";
import { isISODate } from "@/lib/domain/time";
import type { Ctx } from "../context";
import { approverIds, getAccount, today } from "../context";
import { ServiceError, conflict, ensure, invalid } from "../errors";
import { audit } from "../audit";
import { newId } from "../ids";
import { billLabel, findSupplier, getRunById, notify, quoteFor, unsentPayment } from "./common";

const FIELD_LABEL: Record<string, string> = {
  supplierName: "supplier name",
  supplierNameAr: "Arabic supplier name",
  supplierVat: "VAT number",
  supplierCr: "CR number",
  invoiceNumber: "invoice number",
  invoiceUuid: "invoice ID",
  issueDate: "issue date",
  dueDate: "due date",
  subtotal: "subtotal",
  vat: "VAT",
  total: "total",
};

export function requireApproverRole(user: User, what: string): void {
  if (user.role !== "approver") throw new ServiceError("not_approver", `Only an approver can ${what}`, 403);
}

/** Everything a bill needs before it can go for approval (BP-03, BP-04, BP-05, BP-08, BP-18). */
export function assertSubmittable(ctx: Ctx, bill: Bill, payDate: ISODate | undefined, fundingAccountId: string): void {
  if (bill.duplicateOf) {
    throw conflict("duplicate_unresolved", "This bill looks like a duplicate. Cancel it, or dismiss the duplicate warning first");
  }
  if (bill.needsReview.length > 0) {
    throw invalid("needs_review", `Check these fields first: ${bill.needsReview.map((f) => FIELD_LABEL[f] ?? f).join(", ")}`);
  }
  if (!(bill.total > 0)) throw invalid("missing_total", "The bill has no total");
  if (!bill.invoiceNumber.trim()) throw invalid("missing_invoice_number", "The bill has no invoice number");
  if (bill.kind === "supplier" && !bill.supplierId) {
    throw invalid("supplier_not_linked", "Add the supplier (with its IBAN) before submitting this bill");
  }
  if (!payDate || !isISODate(payDate)) throw invalid("invalid_pay_date", "Choose a pay date");
  if (payDate < today(ctx)) throw invalid("pay_date_in_past", "The pay date cannot be in the past");
  getAccount(ctx, fundingAccountId);
  ensure(checkPerPayment(bill.total, ctx.store.company.limits), 422);
}

/** Unique per payment of a bill: "pay_<billId>", then "pay_<billId>_2"… A retry of the same payment reuses its key. */
export function nextRequestKey(ctx: Ctx, billId: string): string {
  const n = ctx.store.payments.filter((p) => p.billId === billId).length;
  return n === 0 ? `pay_${billId}` : `pay_${billId}_${n + 1}`;
}

/**
 * Records the approval, moves the bill to scheduled and creates its payment (or re-arms the one held by an
 * IBAN change, which never left). Then the payable goes to the accounting system (BP-15).
 */
export function approveAndSchedule(ctx: Ctx, bill: Bill, user: User, runId?: string): Payment {
  const supplier = bill.kind === "supplier" ? findSupplier(ctx, bill.supplierId) : undefined;
  const payDate = bill.payDate ?? today(ctx);
  bill.approvals.push({
    userId: user.id,
    at: ctx.now.toISOString(),
    ...(runId ? { runId } : {}),
    ...(supplier ? { ibanSnapshot: supplier.iban } : {}),
  });
  assertTransition(bill.status, "scheduled");
  bill.status = "scheduled";
  delete bill.rejection;

  const quote = quoteFor(ctx, bill, payDate);
  let payment = unsentPayment(ctx, bill.id);
  if (payment && payment.amount !== bill.total) {
    payment.status = "cancelled";
    payment = undefined;
  }
  if (!payment) {
    payment = {
      id: newId(ctx.store, "pay"),
      billId: bill.id,
      ...(runId ? { runId } : {}),
      ...(supplier ? { supplierId: supplier.id } : {}),
      requestKey: nextRequestKey(ctx, bill.id),
      amount: bill.total,
      fundingAccountId: bill.fundingAccountId,
      rail: quote.rail,
      scheduledFor: quote.sendAt,
      expectedArrival: quote.arrivalDate,
      status: "scheduled",
      attempts: 0,
    };
    ctx.store.payments.push(payment);
  }
  Object.assign(payment, {
    rail: quote.rail,
    scheduledFor: quote.sendAt,
    expectedArrival: quote.arrivalDate,
    quote,
    fundingAccountId: bill.fundingAccountId,
    status: "scheduled",
  });
  delete payment.holdReason;
  if (supplier) payment.iban = supplier.iban;
  if (runId) payment.runId = runId;
  bill.paymentId = payment.id;

  ctx.mocks.accounting.syncPayable(ctx.store, bill, ctx.now);
  audit(ctx, user.id, "bill.approved", { type: "bill", id: bill.id }, { status: "awaiting_approval" }, {
    status: "scheduled",
    payDate,
    runId,
    ibanSnapshot: supplier?.iban,
    rail: quote.rail,
    sendAt: quote.sendAt,
    arrivalDate: quote.arrivalDate,
  });
  return payment;
}

/**
 * Maker-checker restart (BP-08, BP-07): clears approvals; a scheduled bill goes back to awaiting approval.
 * Its unsent payment is cancelled after an edit, or held (never sent) during an IBAN change; a run it belongs
 * to needs approval again.
 */
export function restartApproval(ctx: Ctx, bill: Bill, actorId: string, reason: "edit" | "iban_change"): void {
  const before = { status: bill.status, approvals: bill.approvals };
  const payment = unsentPayment(ctx, bill.id);
  if (payment) {
    const paymentBefore = { status: payment.status, holdReason: payment.holdReason };
    if (reason === "iban_change") {
      payment.status = "held";
      payment.holdReason = "iban_change";
      audit(ctx, actorId, "payment.held", { type: "payment", id: payment.id }, paymentBefore, { status: "held", holdReason: "iban_change" });
    } else {
      payment.status = "cancelled";
      audit(ctx, actorId, "payment.cancelled", { type: "payment", id: payment.id }, paymentBefore, { status: "cancelled", reason: "bill_edited" });
    }
  }
  bill.approvals = [];
  if (bill.status === "scheduled") {
    assertTransition("scheduled", "awaiting_approval");
    bill.status = "awaiting_approval";
  }
  if (bill.runId) {
    const run = getRunById(ctx, bill.runId);
    if (run.status === "approved" || run.status === "awaiting_approval") {
      run.status = "awaiting_approval";
      run.approvals = [];
    }
  }
  audit(ctx, actorId, "bill.approval_restarted", { type: "bill", id: bill.id }, before, { status: bill.status, approvals: [], reason });
  notify(
    ctx,
    approverIds(ctx),
    "approval_needed",
    `${billLabel(bill)} needs approval again (${reason === "edit" ? "it was edited" : "the supplier's IBAN changed"}).`,
    `${billLabel(bill, "ar")} تحتاج موافقة جديدة (${reason === "edit" ? "تم تعديلها" : "تغيّر الآيبان للمورّد"}).`,
  );
}
