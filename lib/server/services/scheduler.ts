// Payment scheduler (PL-04, BP-09, BP-10). Runs after approvals and whenever the demo clock moves.
// A payment leaves only if: it is approved and due, its supplier passes every gate with the IBAN that was
// approved, its rail is open, and its funding account covers it (due-date order). Never sent twice.
import type { Bill, Payment } from "@/lib/domain/types";
import { supplierPaymentGate } from "@/lib/domain/permissions";
import { railAndArrival, sadadQuote } from "@/lib/domain/rails";
import { planRunExecution, retryAt, shortfallByAccount } from "@/lib/domain/run-plan";
import { addDays, riyadhDate } from "@/lib/domain/time";
import { assertTransition } from "@/lib/domain/status";
import { formatSAR } from "@/lib/domain/money";
import { normalizeIban, maskIban } from "@/lib/domain/iban";
import type { Ctx } from "../context";
import { financeAdminIds, getAccount, today } from "../context";
import { audit } from "../audit";
import { billLabel, findSupplier, notify } from "./common";
import { buildSupplierNotice } from "./notices";

export interface SchedulerReport {
  sent: string[];
  returned: string[];
  failed: string[];
  held: { paymentId: string; reason: NonNullable<Payment["holdReason"]> }[];
  /** Payments whose rail is closed now; they moved to the next window. */
  waiting: string[];
}

const SYSTEM = "system";

function isDue(p: Payment, now: Date): boolean {
  const retryable = p.status === "held" && (p.holdReason === "short_balance" || p.holdReason === "daily_limit");
  return (p.status === "scheduled" || retryable) && Date.parse(p.scheduledFor) <= now.getTime();
}

function hold(ctx: Ctx, p: Payment, reason: NonNullable<Payment["holdReason"]>, report: SchedulerReport, extra: Partial<Payment> = {}) {
  const before = { status: p.status, holdReason: p.holdReason, scheduledFor: p.scheduledFor };
  p.status = "held";
  p.holdReason = reason;
  Object.assign(p, extra);
  audit(ctx, SYSTEM, "payment.held", { type: "payment", id: p.id }, before, { status: "held", holdReason: reason, scheduledFor: p.scheduledFor });
  report.held.push({ paymentId: p.id, reason });
}

/** Why a supplier payment must not leave now, if any reason. */
function supplierHoldReason(ctx: Ctx, bill: Bill, p: Payment): NonNullable<Payment["holdReason"]> | undefined {
  const supplier = findSupplier(ctx, p.supplierId ?? bill.supplierId);
  if (!supplier) return "supplier_check";
  const gate = supplierPaymentGate(supplier);
  if (!gate.ok) return gate.code === "iban_change_pending" ? "iban_change" : "supplier_check";
  const approvedIban = bill.approvals.at(-1)?.ibanSnapshot;
  const current = normalizeIban(supplier.iban);
  if (!approvedIban || normalizeIban(approvedIban) !== current) return "supplier_check";
  if (!p.iban || normalizeIban(p.iban) !== current) return "supplier_check";
  return undefined;
}

/** BP-10: the day before a pay date, warn the finance admin if the scheduled payments exceed the balance. */
function dayBeforeAlerts(ctx: Ctx): void {
  const tomorrow = addDays(today(ctx), 1);
  const pending = ctx.store.payments.filter(
    (p) => (p.status === "scheduled" || (p.status === "held" && p.holdReason !== "iban_change")) && riyadhDate(p.scheduledFor) <= tomorrow,
  );
  const accountsTomorrow = new Set(pending.filter((p) => riyadhDate(p.scheduledFor) === tomorrow).map((p) => p.fundingAccountId));
  if (accountsTomorrow.size === 0) return;
  const balances = Object.fromEntries(ctx.store.accounts.map((a) => [a.id, a.balance]));
  for (const [accountId, gap] of Object.entries(shortfallByAccount(pending, balances))) {
    if (!accountsTomorrow.has(accountId)) continue;
    const account = getAccount(ctx, accountId);
    notify(
      ctx,
      financeAdminIds(ctx),
      "short_balance",
      `Payments scheduled for ${tomorrow} from ${account.name} exceed its balance by ${formatSAR(gap)}. Top up today, or some payments will wait for the next working day.`,
      `الدفعات المجدولة في ${tomorrow} من ${account.nameAr} تتجاوز الرصيد بمبلغ ${formatSAR(gap, "ar")}. اشحن الرصيد اليوم، وإلا ستنتظر بعض الدفعات يوم العمل التالي.`,
      { dedupe: true },
    );
  }
}

function send(ctx: Ctx, p: Payment, bill: Bill, report: SchedulerReport): void {
  const account = getAccount(ctx, p.fundingAccountId);
  const before = { status: p.status, holdReason: p.holdReason };
  let result;
  try {
    result = ctx.mocks.rail.send(
      {
        requestKey: p.requestKey,
        amount: p.amount,
        rail: p.rail,
        iban: p.iban,
        sadad: bill.sadad ? { billerCode: bill.sadad.billerCode, billNumber: bill.sadad.billNumber } : undefined,
      },
      ctx.store,
      ctx.now,
    );
  } catch (err) {
    p.status = "failed";
    p.failureReason = err instanceof Error ? err.message : String(err);
    p.attempts += 1;
    assertTransition(bill.status, "failed");
    bill.status = "failed";
    audit(ctx, SYSTEM, "payment.failed", { type: "payment", id: p.id }, before, { status: "failed", reason: p.failureReason });
    notify(ctx, financeAdminIds(ctx), "payment_failed", `Payment for ${billLabel(bill)} failed: ${p.failureReason}`, `تعذّر إرسال دفعة ${billLabel(bill, "ar")}.`);
    report.failed.push(p.id);
    return;
  }

  p.attempts += 1;
  p.transferRef = result.transferRef;
  p.sentAt = result.at;
  delete p.holdReason;

  if (result.status === "returned") {
    // BP-10: a returned payment goes back to the balance (never debited net) and alerts the admin.
    p.status = "returned";
    p.failureReason = "Returned by the beneficiary bank (mock)";
    assertTransition(bill.status, "failed");
    bill.status = "failed";
    audit(ctx, SYSTEM, "payment.returned", { type: "payment", id: p.id }, before, {
      status: "returned",
      transferRef: p.transferRef,
      iban: p.iban ? maskIban(p.iban) : undefined,
    });
    notify(
      ctx,
      financeAdminIds(ctx),
      "payment_returned",
      `Payment for ${billLabel(bill)} was returned by the supplier's bank. The money is back in ${account.name}.`,
      `أعاد بنك المورّد دفعة ${billLabel(bill, "ar")}. عاد المبلغ إلى ${account.nameAr}.`,
    );
    report.returned.push(p.id);
    return;
  }

  if (!result.duplicate) account.balance -= p.amount;
  // p.quote stays the approval quote (what the screens showed); the send-time quote is kept beside it.
  const sentQuote = p.rail === "sadad" ? sadadQuote(new Date(result.at)) : railAndArrival(p.amount, new Date(result.at));
  p.status = "settled"; // BUILD-NOTES 7: settlement is instant in the mock
  p.settledAt = result.at;
  p.sentQuote = sentQuote;
  p.expectedArrival = sentQuote.arrivalDate;
  assertTransition(bill.status, "paid");
  bill.status = "paid";
  audit(ctx, SYSTEM, "payment.sent", { type: "payment", id: p.id }, before, {
    status: "settled",
    rail: p.rail,
    transferRef: p.transferRef,
    sentAt: p.sentAt,
    expectedArrival: p.expectedArrival,
    fundingAccountId: p.fundingAccountId,
    iban: p.iban,
  });
  audit(ctx, SYSTEM, "bill.paid", { type: "bill", id: bill.id }, { status: "scheduled" }, { status: "paid", paymentId: p.id });

  const supplier = findSupplier(ctx, p.supplierId);
  if (supplier) {
    const notice = buildSupplierNotice(ctx, bill, p, supplier);
    if (notice) ctx.mocks.notices.send(ctx.store, notice);
  }
  ctx.mocks.accounting.syncPayable(ctx.store, bill, ctx.now);
  ctx.mocks.accounting.syncPayment(ctx.store, bill, p, ctx.now);
  ctx.mocks.accounting.markPayablePaid(ctx.store, bill.id);
  report.sent.push(p.id);
}

function completeRuns(ctx: Ctx): void {
  for (const run of ctx.store.runs) {
    if (run.status !== "approved") continue;
    const bills = ctx.store.bills.filter((b) => run.billIds.includes(b.id));
    if (bills.every((b) => b.status === "paid" || b.status === "failed" || b.status === "cancelled")) {
      run.status = "completed";
      audit(ctx, SYSTEM, "run.completed", { type: "run", id: run.id }, { status: "approved" }, { status: "completed" });
    }
  }
}

export function runScheduler(ctx: Ctx): SchedulerReport {
  const report: SchedulerReport = { sent: [], returned: [], failed: [], held: [], waiting: [] };
  dayBeforeAlerts(ctx);

  type Ready = { payment: Payment; bill: Bill; amount: number; fundingAccountId: string; dueDate?: string };
  const ready: Ready[] = [];
  for (const p of ctx.store.payments.filter((x) => isDue(x, ctx.now))) {
    const bill = ctx.store.bills.find((b) => b.id === p.billId);
    if (!bill || bill.status === "cancelled") {
      p.status = "cancelled";
      continue;
    }
    // Never send without a live approval (an edit or IBAN change clears it).
    if (bill.status !== "scheduled" || bill.approvals.length === 0) {
      hold(ctx, p, "supplier_check", report);
      continue;
    }
    if (bill.kind === "supplier") {
      const reason = supplierHoldReason(ctx, bill, p);
      if (reason) {
        hold(ctx, p, reason, report);
        continue;
      }
    }
    const quote = p.rail === "sadad" ? sadadQuote(ctx.now) : railAndArrival(p.amount, ctx.now);
    if (Date.parse(quote.sendAt) > ctx.now.getTime()) {
      // SARIE closed (after cut-off or weekend): wait for the next window.
      Object.assign(p, { status: "scheduled", scheduledFor: quote.sendAt, expectedArrival: quote.arrivalDate });
      delete p.holdReason;
      report.waiting.push(p.id);
      continue;
    }
    ready.push({ payment: p, bill, amount: p.amount, fundingAccountId: p.fundingAccountId, dueDate: bill.dueDate });
  }

  const balances = Object.fromEntries(ctx.store.accounts.map((a) => [a.id, a.balance]));
  const plan = planRunExecution(ready, balances);
  for (const r of plan.send) send(ctx, r.payment, r.bill, report);

  if (plan.hold.length > 0) {
    // BP-10: the rest retry at 09:00 on the next working day.
    const retry = retryAt(today(ctx));
    for (const r of plan.hold) {
      const quote = r.payment.rail === "sadad" ? sadadQuote(retry) : railAndArrival(r.payment.amount, retry);
      hold(ctx, r.payment, "short_balance", report, { scheduledFor: quote.sendAt, expectedArrival: quote.arrivalDate });
    }
    const total = plan.hold.reduce((s, r) => s + r.amount, 0);
    notify(
      ctx,
      financeAdminIds(ctx),
      "short_balance",
      `${plan.hold.length} payment(s) totalling ${formatSAR(total)} are on hold for a short balance; they retry on ${riyadhDate(retry)} at 09:00.`,
      `${plan.hold.length} دفعة بإجمالي ${formatSAR(total, "ar")} معلّقة لعدم كفاية الرصيد، وستُعاد المحاولة في ${riyadhDate(retry)} الساعة 09:00.`,
      { dedupe: true },
    );
  }

  completeRuns(ctx);
  return report;
}
