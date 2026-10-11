// Runs and the scheduler (BP-08, BP-10, BP-17, BP-18, PL-04).
import { describe, expect, it } from "vitest";
import { approveRun, createRun, getRun, rejectRun, submitRun } from "./runs";
import { approveBill, cancelBill, createManualBill, submitBill, updateBill, billsSummary, getBillDetail } from "./bills";
import { addSupplier } from "./suppliers";
import { runScheduler } from "./scheduler";
import { cancelPayment, paymentConfirmation, renderConfirmationHtml } from "./payments";
import { SEED_IDS } from "../seed";
import { RETURNED_IBAN } from "@/lib/mocks/rail";
import {
  FAISAL,
  NOURA,
  REEM,
  advance,
  balanceOf,
  billOf,
  demoRun,
  expectCode,
  paymentOf,
  setup,
} from "../test-helpers";

describe("approving a run", () => {
  it("pays the instant bills now and schedules the SARIE one; one payment per bill with a unique key", async () => {
    const ctx = setup();
    const { run, einvoice, photo, saved } = await demoRun(ctx);
    const view = approveRun(ctx, run.id, FAISAL);
    expect(view.run).toMatchObject({ status: "approved", approvals: [{ userId: FAISAL }] });
    expect(view.scheduler.sent.length).toBe(2);
    expect(billOf(ctx, photo.id).status).toBe("paid");
    expect(billOf(ctx, saved.id).status).toBe("paid");
    expect(billOf(ctx, einvoice.id).status).toBe("scheduled");
    expect(billOf(ctx, einvoice.id).approvals[0]).toMatchObject({ userId: FAISAL, runId: run.id, ibanSnapshot: "SA6710000000020315550044" });
    const keys = ctx.store.payments.filter((p) => p.runId === run.id).map((p) => p.requestKey);
    expect(keys.sort()).toEqual([`pay_${einvoice.id}`, `pay_${photo.id}`, `pay_${saved.id}`].sort());
    expect(balanceOf(ctx)).toBe(18_000_000 - 805_000 - 1_250_000);
    // Accounting: payables for all three (BP-15), payments for the two sent (BP-14).
    const entries = ctx.store.accounting.filter((e) => [einvoice.id, photo.id, saved.id].includes(e.billId));
    expect(entries.filter((e) => e.kind === "payable")).toHaveLength(3);
    expect(entries.filter((e) => e.kind === "payment").map((e) => e.billId).sort()).toEqual([photo.id, saved.id].sort());
    expect(entries.find((e) => e.kind === "payable" && e.billId === photo.id)?.status).toBe("paid");
    expect(entries.find((e) => e.kind === "payment" && e.billId === photo.id)).toMatchObject({ attachmentName: "GOL-2026-1003-photo.jpg", vat: 105_000 });

    advance(ctx, "2026-10-18", "09:00");
    expect(billOf(ctx, einvoice.id).status).toBe("paid");
    expect(ctx.store.runs[0].status).toBe("completed");
    expect(getRun(ctx, run.id).items.every((i) => i.displayStatus === "paid")).toBe(true);
  });

  it("each payment succeeds or fails on its own: a returned payment goes back to the balance and alerts the admin", async () => {
    const ctx = setup();
    const lifts = addSupplier(ctx, { nameEn: "Desert Lifts Co.", vatNumber: "310123456700003", iban: RETURNED_IBAN, noticeEmail: "ap@desertlifts.example" }, NOURA);
    const { bill: liftBill } = createManualBill(ctx, { supplierId: lifts.id, invoiceNumber: "DL-77", dueDate: "2026-10-20", total: 500_000 }, NOURA);
    const { run } = createRun(ctx, { name: "Mixed", payDate: "2026-10-15", billIds: [liftBill.id, SEED_IDS.bills.savedDraft] }, NOURA);
    submitRun(ctx, run.id, NOURA);
    const { scheduler } = approveRun(ctx, run.id, REEM);
    expect(scheduler.returned).toEqual([paymentOf(ctx, liftBill.id)!.id]);
    expect(paymentOf(ctx, liftBill.id)).toMatchObject({ status: "returned" });
    expect(billOf(ctx, liftBill.id).status).toBe("failed");
    expect(billOf(ctx, SEED_IDS.bills.savedDraft).status).toBe("paid");
    expect(balanceOf(ctx)).toBe(18_000_000 - 1_250_000); // the returned 5,000 is not lost
    expect(ctx.store.alerts.find((a) => a.kind === "payment_returned")).toMatchObject({ to: NOURA });
    expect(ctx.store.notices.some((n) => n.billId === liftBill.id)).toBe(false);
  });
});

describe("bill detail checks", () => {
  it("a draft bill inside a draft run cannot be submitted on its own", async () => {
    const ctx = setup();
    const { einvoice } = await demoRun(ctx, { submit: false });
    expect(getBillDetail(ctx, einvoice.id).checks.submit).toMatchObject({ ok: false, code: "in_run" });
    await expectCode(() => submitBill(ctx, einvoice.id, NOURA, { payDate: "2026-10-15" }), "in_run");
  });
});

describe("short balance (BP-10)", () => {
  it("pays in due-date order, holds the rest to 09:00 next working day, and alerts the admin", async () => {
    const ctx = setup();
    const { run, photo, saved } = await demoRun(ctx);
    ctx.store.accounts[0].balance = 1_500_000; // 15,000: covers the 12,500 bill (due 14 Oct), not also the 8,050 (due 25 Oct)
    approveRun(ctx, run.id, FAISAL);
    expect(billOf(ctx, saved.id).status).toBe("paid");
    expect(paymentOf(ctx, photo.id)).toMatchObject({ status: "held", holdReason: "short_balance", scheduledFor: "2026-10-18T06:00:00.000Z", expectedArrival: "2026-10-18" });
    // The approval quote is what was promised on screen; the retry moves expectedArrival only.
    expect(paymentOf(ctx, photo.id)!.quote).toMatchObject({ rail: "instant", arrivalDate: "2026-10-15" });
    expect(balanceOf(ctx)).toBe(250_000);
    expect(ctx.store.alerts.find((a) => a.kind === "short_balance" && a.to === NOURA)?.message).toMatch(/retry on 2026-10-18 at 09:00/);

    // Topped up over the weekend: Sunday 09:00 both the held one and the SARIE one go.
    ctx.store.accounts[0].balance += 10_000_000;
    advance(ctx, "2026-10-18", "09:00");
    expect(billOf(ctx, photo.id).status).toBe("paid");
    // When the two differ, expectedArrival and the notice follow the latest (send-time) quote.
    expect(paymentOf(ctx, photo.id)).toMatchObject({ expectedArrival: "2026-10-18", sentQuote: { arrivalDate: "2026-10-18" }, quote: { arrivalDate: "2026-10-15" } });
    expect(ctx.store.notices.find((n) => n.billId === photo.id)!.bodyEn).toContain("Expected arrival: Sunday 18 October 2026");
    expect(ctx.store.runs[0].status).toBe("completed");
  });

  it("alerts the finance admin the day before a pay date when scheduled payments exceed the balance", async () => {
    const ctx = setup();
    const { run } = await demoRun(ctx, { payDate: "2026-10-18" });
    approveRun(ctx, run.id, FAISAL);
    expect(ctx.store.payments.filter((p) => p.runId === run.id).every((p) => p.status === "scheduled")).toBe(true);
    ctx.store.accounts[0].balance = 5_000_000; // 50,000 < 65,550 due Sunday
    advance(ctx, "2026-10-16", "12:00"); // Friday: not yet
    expect(ctx.store.alerts.some((a) => a.kind === "short_balance")).toBe(false);
    advance(ctx, "2026-10-17", "10:00"); // Saturday, the day before
    const alerts = ctx.store.alerts.filter((a) => a.kind === "short_balance");
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ to: NOURA });
    expect(alerts[0].message).toContain("2026-10-18");
    expect(alerts[0].message).toContain("15,550.00 SAR");
    advance(ctx, "2026-10-17", "18:00"); // no duplicate alert
    expect(ctx.store.alerts.filter((a) => a.kind === "short_balance")).toHaveLength(1);
  });
});

describe("never pay twice", () => {
  it("running the scheduler again sends nothing and debits nothing", async () => {
    const ctx = setup();
    const { run } = await demoRun(ctx);
    approveRun(ctx, run.id, FAISAL);
    const ledger = ctx.store.railLedger.length;
    const balance = balanceOf(ctx);
    expect(runScheduler(ctx).sent).toEqual([]);
    expect(runScheduler(ctx).sent).toEqual([]);
    expect(ctx.store.railLedger.length).toBe(ledger);
    expect(balanceOf(ctx)).toBe(balance);
  });

  it("a retried send with the same key is answered from the ledger and not debited again", async () => {
    const ctx = setup();
    const { run, photo } = await demoRun(ctx);
    approveRun(ctx, run.id, FAISAL);
    const payment = paymentOf(ctx, photo.id)!;
    const balance = balanceOf(ctx);
    // Pretend the app lost the outcome and re-queued the payment.
    Object.assign(payment, { status: "scheduled" });
    billOf(ctx, photo.id).status = "scheduled";
    runScheduler(ctx);
    expect(ctx.store.railLedger.filter((r) => r.requestKey === payment.requestKey)).toHaveLength(1);
    expect(balanceOf(ctx)).toBe(balance);
  });
});

describe("limits (BP-18)", () => {
  it("checks the per-payment limit at submit", async () => {
    const ctx = setup();
    const { bill } = createManualBill(ctx, { supplierId: SEED_IDS.supplierA, invoiceNumber: "GOL-BIG", total: 10_000_001 }, NOURA);
    await expectCode(() => submitBill(ctx, bill.id, NOURA, { payDate: "2026-10-15" }), "per_payment_limit");
  });

  it("checks the daily limit for the pay date at approval", async () => {
    const ctx = setup();
    const { bill } = createManualBill(ctx, { supplierId: SEED_IDS.supplierA, invoiceNumber: "GOL-BIG", dueDate: "2026-10-30", total: 9_000_000 }, NOURA);
    submitBill(ctx, bill.id, NOURA, { payDate: "2026-10-15" });
    approveBill(ctx, bill.id, FAISAL);
    const { run } = await demoRun(ctx); // 65,550 more on the same day > 150,000
    const err = await expectCode(() => approveRun(ctx, run.id, REEM), "daily_limit");
    expect(err.httpStatus).toBe(422);
  });
});

describe("cancel until sent (BP-18)", () => {
  it("cancels a scheduled SARIE payment before Sunday; it never leaves", async () => {
    const ctx = setup();
    const { run, einvoice } = await demoRun(ctx);
    approveRun(ctx, run.id, FAISAL);
    const payment = paymentOf(ctx, einvoice.id)!;
    cancelPayment(ctx, payment.id, NOURA);
    expect(payment.status).toBe("cancelled");
    expect(billOf(ctx, einvoice.id)).toMatchObject({ status: "cancelled", cancelledBy: NOURA });
    advance(ctx, "2026-10-18", "09:00");
    expect(ctx.store.railLedger.some((r) => r.requestKey === payment.requestKey)).toBe(false);
    expect(ctx.store.runs[0].status).toBe("completed");
  });

  it("refuses once paid", async () => {
    const ctx = setup();
    const { run, photo } = await demoRun(ctx);
    approveRun(ctx, run.id, FAISAL);
    await expectCode(() => cancelBill(ctx, photo.id, NOURA), "already_paid");
  });
});

describe("funding from a subwallet (BP-18)", () => {
  it("debits the chosen subwallet and shows scheduled vs available", async () => {
    const ctx = setup();
    const { run, photo, einvoice } = await demoRun(ctx, { funding: {} });
    // Move the photo bill to the maintenance subwallet before approval (an edit by the preparer).
    updateBill(ctx, photo.id, { fundingAccountId: "w_maintenance" }, NOURA);
    approveRun(ctx, run.id, FAISAL);
    expect(balanceOf(ctx, "w_maintenance")).toBe(4_000_000 - 805_000);
    expect(balanceOf(ctx, "main")).toBe(18_000_000 - 1_250_000);
    const summary = billsSummary(ctx);
    expect(summary.accounts.find((a) => a.id === "main")).toMatchObject({ scheduled: 4_500_000, available: 18_000_000 - 1_250_000 - 4_500_000 });
    expect(summary.owedBySupplier.find((g) => g.key === "sadad:901")).toMatchObject({ kind: "sadad", total: 324_055 });
    expect(paymentOf(ctx, einvoice.id)?.fundingAccountId).toBe("main");
  });
});

describe("maker-checker (BP-08, BP-17)", () => {
  it("a preparer can approve nothing", async () => {
    const ctx = setup();
    const { run } = await demoRun(ctx);
    await expectCode(() => approveRun(ctx, run.id, NOURA), "not_approver");
    await expectCode(() => approveBill(ctx, SEED_IDS.bills.sadad, NOURA), "not_approver");
  });

  it("the run's creator cannot approve it", async () => {
    const ctx = setup();
    const { einvoice, photo } = await demoRun(ctx, { submit: false }).then(async (d) => {
      rejectOrDelete(ctx, d.run.id);
      return d;
    });
    const { run } = createRun(ctx, { name: "Faisal's run", payDate: "2026-10-15", billIds: [einvoice.id, photo.id] }, FAISAL);
    submitRun(ctx, run.id, FAISAL);
    await expectCode(() => approveRun(ctx, run.id, FAISAL), "run_creator_cannot_approve");
    expect(approveRun(ctx, run.id, REEM).run.status).toBe("approved");
  });

  it("editing the amount of an approved bill restarts approval; the editor cannot approve it", async () => {
    const ctx = setup();
    const { run, einvoice } = await demoRun(ctx);
    approveRun(ctx, run.id, FAISAL);
    const first = paymentOf(ctx, einvoice.id)!;
    const result = updateBill(ctx, einvoice.id, { total: 4_400_000, subtotal: 3_826_087, vat: 573_913 }, FAISAL);
    expect(result.approvalRestarted).toBe(true);
    expect(first.status).toBe("cancelled");
    expect(billOf(ctx, einvoice.id)).toMatchObject({ status: "awaiting_approval", approvals: [], editedBy: [FAISAL] });
    expect(ctx.store.runs[0]).toMatchObject({ status: "awaiting_approval", approvals: [] });
    await expectCode(() => approveRun(ctx, run.id, FAISAL), "editor_cannot_approve");
    approveRun(ctx, run.id, REEM);
    const second = paymentOf(ctx, einvoice.id)!;
    expect(second).toMatchObject({ amount: 4_400_000, requestKey: `pay_${einvoice.id}_2`, status: "scheduled" });
    const updated = ctx.store.audit.find((e) => e.action === "bill.updated")!;
    expect(updated).toMatchObject({ actorId: FAISAL, before: { total: 4_500_000 }, after: { total: 4_400_000, approvalRestarted: true } });
  });

  it("a non-material edit (invoice number) does not restart approval", async () => {
    const ctx = setup();
    const { run, einvoice } = await demoRun(ctx);
    approveRun(ctx, run.id, FAISAL);
    expect(updateBill(ctx, einvoice.id, { supplierCr: "1010932185" }, NOURA).changed).toEqual([]);
    expect(updateBill(ctx, einvoice.id, { invoiceNumber: "INV-2026-0451-A" }, NOURA).approvalRestarted).toBe(false);
    expect(billOf(ctx, einvoice.id).status).toBe("scheduled");
  });

  it("an approver can send a run back to draft", async () => {
    const ctx = setup();
    const { run, einvoice } = await demoRun(ctx);
    rejectRun(ctx, run.id, REEM, "Wrong pay date");
    expect(ctx.store.runs[0]).toMatchObject({ status: "draft", rejection: { by: REEM, reason: "Wrong pay date" } });
    expect(billOf(ctx, einvoice.id).status).toBe("draft");
    await expectCode(() => rejectRun(ctx, run.id, NOURA), "not_approver");
  });
});

describe("SADAD in the same flow (BP-12)", () => {
  it("is approved like any bill and paid on its pay date over SADAD", () => {
    const ctx = setup();
    const { payment } = approveBill(ctx, SEED_IDS.bills.sadad, FAISAL);
    expect(payment).toMatchObject({ rail: "sadad", status: "scheduled", scheduledFor: "2026-10-25T06:00:00.000Z", expectedArrival: "2026-10-25" });
    advance(ctx, "2026-10-25", "09:00");
    expect(payment.status).toBe("settled");
    expect(billOf(ctx, SEED_IDS.bills.sadad).status).toBe("paid");
    const confirmation = paymentConfirmation(ctx, SEED_IDS.bills.sadad);
    expect(confirmation).toMatchObject({ payee: { billerCode: "901" }, amountText: "3,240.55 SAR", rail: "sadad" });
    const html = renderConfirmationHtml(confirmation);
    expect(html).toContain(payment.transferRef!);
    expect(html).not.toMatch(/<script/i);
  });

  it("refuses a confirmation for an unpaid bill", async () => {
    const ctx = setup();
    await expectCode(() => paymentConfirmation(ctx, SEED_IDS.bills.savedDraft), "not_paid");
  });
});

/** Takes the demo run out of the way so its bills can join another run. */
function rejectOrDelete(ctx: ReturnType<typeof setup>, runId: string) {
  const run = ctx.store.runs.find((r) => r.id === runId)!;
  for (const id of run.billIds) delete billOf(ctx, id).runId;
  ctx.store.runs = ctx.store.runs.filter((r) => r.id !== runId);
}
