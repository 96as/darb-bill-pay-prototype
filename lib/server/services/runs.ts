// Payment runs (PL-04, BP-10; BUILD-NOTES 1): bills under one pay date and one approval; each payment
// then succeeds or fails on its own.
import type { Bill, DisplayStatus, Halalas, ISODate, Payment, PaymentRun, RailQuote, Supplier } from "@/lib/domain/types";
import { canApproveRun, canPrepare } from "@/lib/domain/permissions";
import { checkDaily, checkPerPayment } from "@/lib/domain/limits";
import { assertTransition, displayStatus } from "@/lib/domain/status";
import { isISODate } from "@/lib/domain/time";
import type { Ctx } from "../context";
import { approverIds, getAccount, getUser, today } from "../context";
import { conflict, ensure, invalid } from "../errors";
import { audit, auditFor } from "../audit";
import { newId } from "../ids";
import { committedForDay, findSupplier, getBill, getRunById, latestPayment, notify, paidSupplierIds, quoteFor, quoteOfPayment } from "./common";
import { approveAndSchedule, assertSubmittable, requireApproverRole } from "./workflow";
import { runScheduler, type SchedulerReport } from "./scheduler";
import { formatSAR } from "@/lib/domain/money";

export interface BillQuote {
  billId: string;
  amount: Halalas;
  rail: RailQuote["rail"];
  sendAt: string;
  arrivalDate: ISODate;
  sameDay: boolean;
  reason: string;
  fundingAccountId: string;
}

const toBillQuote = (bill: Bill, q: RailQuote, fundingAccountId = bill.fundingAccountId): BillQuote => ({
  billId: bill.id,
  amount: bill.total,
  rail: q.rail,
  sendAt: q.sendAt,
  arrivalDate: q.arrivalDate,
  sameDay: q.sameDay,
  reason: q.reason,
  fundingAccountId,
});

function checkPayDate(ctx: Ctx, payDate: unknown): ISODate {
  if (!isISODate(payDate)) throw invalid("invalid_pay_date", "Choose a pay date (YYYY-MM-DD)");
  if (payDate < today(ctx)) throw invalid("pay_date_in_past", "The pay date cannot be in the past");
  return payDate;
}

/** BP-09: what the run screen shows before submitting — rail and expected arrival per bill. */
export function quoteBills(ctx: Ctx, billIds: string[], payDate: ISODate, funding: Record<string, string> = {}): BillQuote[] {
  const day = checkPayDate(ctx, payDate);
  return billIds.map((id) => {
    const bill = getBill(ctx, id);
    return toBillQuote(bill, quoteFor(ctx, bill, day), funding[id] ?? bill.fundingAccountId);
  });
}

export interface CreateRunInput {
  name: string;
  payDate: ISODate;
  billIds: string[];
  /** Per-bill funding account (main or a subwallet, BP-18); defaults to the bill's. */
  funding?: Record<string, string>;
}

export function createRun(ctx: Ctx, input: CreateRunInput, actorId: string): { run: PaymentRun; quotes: BillQuote[] } {
  const user = getUser(ctx, actorId);
  ensure(canPrepare(user));
  const payDate = checkPayDate(ctx, input.payDate);
  const ids = [...new Set(input.billIds ?? [])];
  if (ids.length === 0) throw invalid("run_empty", "Add at least one bill to the run");
  const bills = ids.map((id) => getBill(ctx, id));
  for (const bill of bills) {
    if (bill.status !== "draft") throw conflict("not_draft", `${bill.invoiceNumber} is not a draft`);
    if (bill.runId) throw conflict("in_run", `${bill.invoiceNumber} is already in a payment run`);
    const account = input.funding?.[bill.id] ?? bill.fundingAccountId;
    getAccount(ctx, account);
    assertSubmittable(ctx, bill, payDate, account);
  }
  const run: PaymentRun = {
    id: newId(ctx.store, "run"),
    name: input.name?.trim() || `Payment run ${payDate}`,
    payDate,
    billIds: ids,
    status: "draft",
    createdBy: actorId,
    createdAt: ctx.now.toISOString(),
    editedBy: [],
    approvals: [],
  };
  ctx.store.runs.push(run);
  for (const bill of bills) {
    bill.runId = run.id;
    bill.payDate = payDate;
    bill.fundingAccountId = input.funding?.[bill.id] ?? bill.fundingAccountId;
  }
  audit(ctx, actorId, "run.created", { type: "run", id: run.id }, undefined, { name: run.name, payDate, billIds: ids, funding: input.funding });
  return { run, quotes: bills.map((b) => toBillQuote(b, quoteFor(ctx, b, payDate))) };
}

export function submitRun(ctx: Ctx, runId: string, actorId: string): RunView {
  const user = getUser(ctx, actorId);
  ensure(canPrepare(user));
  const run = getRunById(ctx, runId);
  if (run.status !== "draft") throw conflict("not_draft", "Only a draft run can be submitted");
  const bills = run.billIds.map((id) => getBill(ctx, id)).filter((b) => b.status !== "cancelled");
  if (bills.length === 0) throw invalid("run_empty", "This run has no bills to pay");
  checkPayDate(ctx, run.payDate);
  for (const bill of bills) assertSubmittable(ctx, bill, run.payDate, bill.fundingAccountId);
  const at = ctx.now.toISOString();
  for (const bill of bills) {
    assertTransition(bill.status, "awaiting_approval");
    bill.status = "awaiting_approval";
    bill.submittedBy = actorId;
    bill.submittedAt = at;
    bill.approvals = [];
    delete bill.rejection;
  }
  run.status = "awaiting_approval";
  run.submittedBy = actorId;
  run.submittedAt = at;
  run.approvals = [];
  delete run.rejection;
  const total = bills.reduce((s, b) => s + b.total, 0);
  audit(ctx, actorId, "run.submitted", { type: "run", id: run.id }, { status: "draft" }, { status: "awaiting_approval", total, billIds: bills.map((b) => b.id) });
  notify(
    ctx,
    approverIds(ctx).filter((id) => id !== actorId),
    "approval_needed",
    `Payment run "${run.name}" (${bills.length} bills, ${formatSAR(total)}) is waiting for your approval.`,
    `دفعة "${run.name}" (${bills.length} فواتير، ${formatSAR(total, "ar")}) بانتظار موافقتك.`,
  );
  return getRun(ctx, run.id);
}

/**
 * BP-10 + BP-08: one approval releases every bill in the run. Each bill gets an Approval (with runId and the
 * IBAN it was given for) and its own payment with a unique request key. Then the scheduler runs.
 */
export function approveRun(ctx: Ctx, runId: string, actorId: string): RunView & { scheduler: SchedulerReport } {
  const user = getUser(ctx, actorId);
  const run = getRunById(ctx, runId);
  const pending = run.billIds.map((id) => getBill(ctx, id)).filter((b) => b.status === "awaiting_approval");
  const suppliers = new Map<string, Supplier>(ctx.store.suppliers.map((s) => [s.id, s]));
  ensure(
    canApproveRun(user, { ...run, billIds: pending.map((b) => b.id) }, pending, suppliers, paidSupplierIds(ctx), {
      makerChecker: ctx.store.company.makerChecker,
    }),
  );
  const limits = ctx.store.company.limits;
  for (const bill of pending) ensure(checkPerPayment(bill.total, limits), 422);
  const total = pending.reduce((s, b) => s + b.total, 0);
  ensure(checkDaily(committedForDay(ctx, run.payDate, new Set(pending.map((b) => b.id))), total, limits), 422);

  run.approvals.push({ userId: actorId, at: ctx.now.toISOString(), runId: run.id });
  run.status = "approved";
  delete run.rejection;
  for (const bill of pending) approveAndSchedule(ctx, bill, user, run.id);
  audit(ctx, actorId, "run.approved", { type: "run", id: run.id }, { status: "awaiting_approval" }, { status: "approved", total, billIds: pending.map((b) => b.id) });
  const scheduler = runScheduler(ctx);
  return { ...getRun(ctx, run.id), scheduler };
}

export function rejectRun(ctx: Ctx, runId: string, actorId: string, reason?: string): RunView {
  const user = getUser(ctx, actorId);
  requireApproverRole(user, "reject payment runs");
  const run = getRunById(ctx, runId);
  if (run.status !== "awaiting_approval") throw conflict("run_not_awaiting_approval", "This run is not waiting for approval");
  const rejection = { by: actorId, at: ctx.now.toISOString(), ...(reason?.trim() ? { reason: reason.trim() } : {}) };
  for (const bill of run.billIds.map((id) => getBill(ctx, id))) {
    if (bill.status !== "awaiting_approval") continue;
    assertTransition(bill.status, "draft");
    bill.status = "draft";
    bill.approvals = [];
    bill.rejection = rejection;
  }
  run.status = "draft";
  run.approvals = [];
  run.rejection = rejection;
  audit(ctx, actorId, "run.rejected", { type: "run", id: run.id }, { status: "awaiting_approval" }, { status: "draft", reason: rejection.reason });
  return getRun(ctx, run.id);
}

export interface RunItem {
  bill: Bill;
  displayStatus: DisplayStatus;
  supplier?: Pick<Supplier, "id" | "nameEn" | "nameAr" | "bankName" | "iban">;
  payment?: Payment;
  /** Same numbers the run screen showed (quoteBills) until the payment exists; then the payment's own. */
  quote: BillQuote;
}

export interface RunView {
  run: PaymentRun;
  items: RunItem[];
  totals: { amount: Halalas; count: number; byAccount: Record<string, Halalas> };
  audit: ReturnType<typeof auditFor>;
}

/** GET /payment-runs/{id}: status of each payment in a run, with rail and arrival per bill. */
export function getRun(ctx: Ctx, runId: string): RunView {
  const run = getRunById(ctx, runId);
  const day = today(ctx);
  const items: RunItem[] = run.billIds.map((id) => {
    const bill = getBill(ctx, id);
    const payment = latestPayment(ctx, bill);
    const supplier = findSupplier(ctx, bill.supplierId);
    const live = payment && payment.status !== "cancelled" ? quoteOfPayment(payment) : quoteFor(ctx, bill, run.payDate < day ? day : run.payDate);
    return {
      bill,
      displayStatus: displayStatus(bill, day),
      ...(supplier ? { supplier: { id: supplier.id, nameEn: supplier.nameEn, nameAr: supplier.nameAr, bankName: supplier.bankName, iban: supplier.iban } } : {}),
      ...(payment ? { payment } : {}),
      quote: toBillQuote(bill, live, payment?.fundingAccountId ?? bill.fundingAccountId),
    };
  });
  const active = items.filter((i) => i.bill.status !== "cancelled");
  const byAccount: Record<string, Halalas> = {};
  for (const i of active) byAccount[i.quote.fundingAccountId] = (byAccount[i.quote.fundingAccountId] ?? 0) + i.bill.total;
  return {
    run,
    items,
    totals: { amount: active.reduce((s, i) => s + i.bill.total, 0), count: active.length, byAccount },
    audit: auditFor(ctx, "run", run.id),
  };
}

export function listRuns(ctx: Ctx): { run: PaymentRun; total: Halalas; count: number }[] {
  return [...ctx.store.runs]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((run) => {
      const bills = run.billIds.map((id) => ctx.store.bills.find((b) => b.id === id)).filter((b): b is Bill => !!b && b.status !== "cancelled");
      return { run, total: bills.reduce((s, b) => s + b.total, 0), count: bills.length };
    });
}
