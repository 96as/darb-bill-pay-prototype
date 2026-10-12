// Promise B: a changed IBAN can't move money (BP-05..08, PL-02).
import { describe, expect, it } from "vitest";
import { approveRun, createRun, submitRun } from "./runs";
import { addSupplier, approveBankChange, confirmCloseMatch, rejectBankChange, requestBankChange, supplierChecks } from "./suppliers";
import { getBillDetail } from "./bills";
import {
  FAISAL,
  IBAN_B,
  IBAN_B_NEW,
  IBAN_CLOSE,
  IBAN_NO_MATCH,
  NOURA,
  REEM,
  addSupplierB,
  advance,
  balanceOf,
  riyadh,
  billOf,
  demoRun,
  expectCode,
  paymentOf,
  processSeedEmail,
  setup,
} from "../test-helpers";

describe("adding a supplier (BP-05, BP-06)", () => {
  it("validates the IBAN checksum, VAT and contact, runs the name check and screening", async () => {
    const ctx = setup();
    const { einvoice } = await processSeedEmail(ctx);
    const base = { nameEn: "Cool Breeze HVAC Contracting Co.", vatNumber: "310387452600003", iban: IBAN_B, noticeEmail: "finance@coolbreeze-hvac.example" };
    await expectCode(() => addSupplier(ctx, { ...base, iban: "SA6710000000020315550045" }, NOURA), "invalid_iban");
    await expectCode(() => addSupplier(ctx, { ...base, vatNumber: "310387452600002" }, NOURA), "invalid_vat");
    await expectCode(() => addSupplier(ctx, { ...base, noticeEmail: undefined }, NOURA), "notice_contact_required");
    const b = addSupplierB(ctx, NOURA, IBAN_B, einvoice.id);
    expect(b).toMatchObject({
      bankName: "Saudi National Bank",
      createdBy: NOURA,
      prefilledFromEInvoice: true,
      nameCheck: { result: "match" },
      screening: { status: "cleared" },
    });
    expect(billOf(ctx, einvoice.id).supplierId).toBe(b.id);
    await expectCode(() => addSupplierB(ctx), "supplier_exists");
  });

  it("a close match needs an approver's confirmation before payment; no match blocks", async () => {
    const ctx = setup();
    const { run, einvoice } = await demoRun(ctx, { submit: false });
    // Re-point B to a close-match IBAN through an approved change, then check the gate.
    requestBankChange(ctx, ctx.store.suppliers[1].id, IBAN_CLOSE, NOURA);
    await expectCode(() => approveBankChange(ctx, ctx.store.suppliers[1].id, REEM), "name_check_unconfirmed");
    await expectCode(() => confirmCloseMatch(ctx, ctx.store.suppliers[1].id, NOURA), "not_approver");
    confirmCloseMatch(ctx, ctx.store.suppliers[1].id, REEM);
    approveBankChange(ctx, ctx.store.suppliers[1].id, FAISAL);
    submitRun(ctx, run.id, NOURA);
    approveRun(ctx, run.id, REEM);
    expect(paymentOf(ctx, einvoice.id)?.iban).toBe(IBAN_CLOSE);
  });
});

describe("IBAN change lock (BP-07)", () => {
  it("pauses payments: the run cannot be approved until a second user approves the change", async () => {
    const ctx = setup();
    const { run, einvoice, supplierB } = await demoRun(ctx);
    requestBankChange(ctx, supplierB.id, IBAN_B_NEW, NOURA);
    expect(supplierB.pendingBankChange).toMatchObject({ newIban: IBAN_B_NEW, newBankName: "SAB", requestedBy: NOURA, nameCheck: { result: "match" } });
    expect(supplierB.iban).toBe(IBAN_B); // unchanged until approved

    const err = await expectCode(() => approveRun(ctx, run.id, FAISAL), "iban_change_pending");
    expect(err.httpStatus).toBe(403);
    expect(ctx.store.alerts.filter((a) => a.kind === "iban_change").map((a) => a.to).sort()).toEqual([FAISAL, REEM]);

    // The requester cannot approve their own change (Noura is a preparer anyway).
    await expectCode(() => approveBankChange(ctx, supplierB.id, NOURA), "not_approver");
    approveBankChange(ctx, supplierB.id, REEM);
    expect(supplierB).toMatchObject({ iban: IBAN_B_NEW, bankName: "SAB" });
    expect(supplierB.pendingBankChange).toBeUndefined();
    expect(supplierB.bankChanges[0]).toMatchObject({ status: "approved", requestedBy: NOURA, decidedBy: REEM });

    // Both users and times are in the audit trail, with before/after IBAN.
    const requested = ctx.store.audit.find((e) => e.action === "supplier.bank_change_requested")!;
    const approved = ctx.store.audit.find((e) => e.action === "supplier.bank_change_approved")!;
    expect(requested).toMatchObject({ actorId: NOURA, before: { iban: IBAN_B }, after: { iban: IBAN_B_NEW } });
    expect(approved).toMatchObject({ actorId: REEM, before: { iban: IBAN_B }, after: { iban: IBAN_B_NEW, requestedBy: NOURA, approvedBy: REEM } });

    // After approval, the new IBAN is the one paid.
    approveRun(ctx, run.id, FAISAL);
    expect(paymentOf(ctx, einvoice.id)).toMatchObject({ iban: IBAN_B_NEW, status: "scheduled" });
    advance(ctx, "2026-10-18", "09:00");
    expect(paymentOf(ctx, einvoice.id)).toMatchObject({ iban: IBAN_B_NEW, status: "settled" });
    expect(billOf(ctx, einvoice.id).status).toBe("paid");
  });

  it("refuses a change to an account whose name does not match", async () => {
    const ctx = setup();
    const { supplierB } = await demoRun(ctx);
    requestBankChange(ctx, supplierB.id, IBAN_NO_MATCH, NOURA);
    await expectCode(() => approveBankChange(ctx, supplierB.id, REEM), "name_check_failed");
    rejectBankChange(ctx, supplierB.id, REEM);
    expect(supplierB.iban).toBe(IBAN_B);
    expect(supplierB.bankChanges[0]).toMatchObject({ status: "rejected", decidedBy: REEM });
  });

  it("an approver who requested the change can neither approve it nor the first payment to the new IBAN", async () => {
    const ctx = setup();
    const { run, supplierB } = await demoRun(ctx);
    requestBankChange(ctx, supplierB.id, IBAN_B_NEW, FAISAL);
    await expectCode(() => approveBankChange(ctx, supplierB.id, FAISAL), "requester_cannot_approve");
    approveBankChange(ctx, supplierB.id, REEM);
    const err = await expectCode(() => approveRun(ctx, run.id, FAISAL), "iban_changer_cannot_approve_first_payment");
    expect(err.message).toMatch(/INV-2026-0451/);
    expect(approveRun(ctx, run.id, REEM).run.status).toBe("approved");
  });

  it("the first payment needs someone other than whoever added the supplier (BP-06)", async () => {
    const ctx = setup();
    const { einvoice } = await processSeedEmail(ctx);
    addSupplierB(ctx, FAISAL); // an approver adds the supplier
    const { run } = createRun(ctx, { name: "B only", payDate: "2026-10-15", billIds: [einvoice.id] }, NOURA);
    submitRun(ctx, run.id, NOURA);
    await expectCode(() => approveRun(ctx, run.id, FAISAL), "supplier_creator_cannot_approve_first_payment");
    expect(approveRun(ctx, run.id, REEM).run.status).toBe("approved");
  });

  it("a payment scheduled before the change is held and never sent, even when the clock passes its send time", async () => {
    const ctx = setup();
    const { run, einvoice, supplierB } = await demoRun(ctx);
    approveRun(ctx, run.id, FAISAL); // Thu 16:10: SARIE 46,000 waits for Sun 09:00
    const payment = paymentOf(ctx, einvoice.id)!;
    expect(payment).toMatchObject({ status: "scheduled", iban: IBAN_B, scheduledFor: "2026-10-18T06:00:00.000Z" });
    const balanceBefore = balanceOf(ctx);

    requestBankChange(ctx, supplierB.id, IBAN_B_NEW, NOURA);
    expect(payment).toMatchObject({ status: "held", holdReason: "iban_change" });
    expect(billOf(ctx, einvoice.id)).toMatchObject({ status: "awaiting_approval", approvals: [] });
    expect(ctx.store.runs[0].status).toBe("awaiting_approval");

    advance(ctx, "2026-10-18", "10:00");
    advance(ctx, "2026-10-19", "10:00");
    expect(payment.status).toBe("held");
    expect(ctx.store.railLedger.some((r) => r.requestKey === payment.requestKey)).toBe(false);
    expect(balanceOf(ctx)).toBe(balanceBefore);

    // Approving the change alone does not release it: the bill needs a fresh approval for the new IBAN.
    approveBankChange(ctx, supplierB.id, REEM);
    advance(ctx, "2026-10-19", "11:00");
    expect(payment.status).toBe("held");
    expect(getBillDetail(ctx, einvoice.id).checks.approve).toMatchObject({ ok: false, code: "in_run" });

    approveRun(ctx, run.id, FAISAL); // Mon 11:00, SARIE open: sent right away, same request key, new IBAN
    expect(payment).toMatchObject({ status: "settled", iban: IBAN_B_NEW });
    expect(ctx.store.railLedger.filter((r) => r.requestKey === payment.requestKey)).toHaveLength(1);
    expect(ctx.store.payments.filter((p) => p.billId === einvoice.id)).toHaveLength(1);
    expect(balanceOf(ctx)).toBe(balanceBefore - 4_600_000);
  });

  it("a stale approval for the old IBAN can never send, even if the payment were re-armed by mistake", async () => {
    const ctx = setup();
    const { run, einvoice, supplierB } = await demoRun(ctx);
    approveRun(ctx, run.id, FAISAL);
    // Simulate a bug elsewhere: the IBAN changes under a scheduled payment without going through the lock.
    supplierB.iban = IBAN_B_NEW;
    advance(ctx, "2026-10-18", "09:00");
    expect(paymentOf(ctx, einvoice.id)).toMatchObject({ status: "held", holdReason: "supplier_check" });
    expect(ctx.store.railLedger.some((r) => r.requestKey === paymentOf(ctx, einvoice.id)!.requestKey)).toBe(false);
  });
});

// An IBAN the mock bank does not know returns a close match (BUILD-NOTES 6): the change must still be decidable.
const IBAN_UNKNOWN = "SA5210000000000012345678";
const codeOf = (r: { ok: boolean; code?: string }) => (r.ok ? "ok" : r.code);

describe("IBAN change to an unknown account (close match)", () => {
  async function requested(requester: string = NOURA) {
    const ctx = setup();
    const { run, einvoice, supplierB } = await demoRun(ctx);
    requestBankChange(ctx, supplierB.id, IBAN_UNKNOWN, requester);
    expect(supplierB.pendingBankChange?.nameCheck).toMatchObject({ result: "close_match", returnedName: "COOL BREEZE HVAC CONTRACTING" });
    return { ctx, run, einvoice, supplierB };
  }

  it.each([
    ["the confirmer (Faisal) approves", FAISAL],
    ["a second approver (Reem) approves", REEM],
  ])("an approver confirms the match, then %s; IBAN switches and every step is logged", async (_label, approver) => {
    const { ctx, supplierB } = await requested();
    const checks = (u: string) => Object.fromEntries(Object.entries(supplierChecks(ctx, supplierB, u)).map(([k, v]) => [k, codeOf(v)]));
    expect(checks(NOURA)).toEqual({ approveChange: "not_approver", rejectChange: "not_approver", withdrawChange: "ok", confirmMatch: "not_approver" });
    expect(checks(FAISAL)).toEqual({ approveChange: "name_check_unconfirmed", rejectChange: "ok", withdrawChange: "not_requester", confirmMatch: "ok" });

    await expectCode(() => confirmCloseMatch(ctx, supplierB.id, NOURA), "not_approver");
    await expectCode(() => approveBankChange(ctx, supplierB.id, NOURA), "not_approver");
    await expectCode(() => approveBankChange(ctx, supplierB.id, FAISAL), "name_check_unconfirmed");

    advance(ctx, "2026-10-15", "16:20");
    confirmCloseMatch(ctx, supplierB.id, FAISAL);
    expect(supplierB.pendingBankChange?.nameCheck).toMatchObject({ confirmedBy: FAISAL, confirmedAt: riyadh("2026-10-15", "16:20") });
    expect(codeOf(supplierChecks(ctx, supplierB, approver).approveChange)).toBe("ok");

    advance(ctx, "2026-10-15", "16:30");
    approveBankChange(ctx, supplierB.id, approver);
    expect(supplierB).toMatchObject({ iban: IBAN_UNKNOWN, bankName: "Saudi National Bank", nameCheck: { result: "close_match", confirmedBy: FAISAL } });
    expect(supplierB.pendingBankChange).toBeUndefined();

    const log = ctx.store.audit.filter((e) => e.entity.id === supplierB.id).map((e) => [e.action, e.actorId, e.at]);
    expect(log).toEqual(
      expect.arrayContaining([
        ["supplier.bank_change_requested", NOURA, riyadh("2026-10-15", "16:10")],
        ["supplier.name_check_confirmed", FAISAL, riyadh("2026-10-15", "16:20")],
        ["supplier.bank_change_approved", approver, riyadh("2026-10-15", "16:30")],
      ]),
    );
    const approved = ctx.store.audit.find((e) => e.action === "supplier.bank_change_approved")!;
    expect(approved).toMatchObject({ before: { iban: IBAN_B }, after: { iban: IBAN_UNKNOWN, requestedBy: NOURA, approvedBy: approver } });
  });

  it("an approver who requested the change cannot confirm its match (maker_cannot_confirm)", async () => {
    const { ctx, supplierB } = await requested(FAISAL);
    await expectCode(() => confirmCloseMatch(ctx, supplierB.id, FAISAL), "maker_cannot_confirm");
    confirmCloseMatch(ctx, supplierB.id, REEM);
    await expectCode(() => approveBankChange(ctx, supplierB.id, FAISAL), "requester_cannot_approve");
    approveBankChange(ctx, supplierB.id, REEM);
    expect(supplierB.iban).toBe(IBAN_UNKNOWN);
  });

  it("an approver can reject without confirming; the old IBAN stays and paused bills, once re-approved, pay it", async () => {
    const ctx = setup();
    const { run, einvoice, supplierB } = await demoRun(ctx);
    approveRun(ctx, run.id, FAISAL); // SARIE 46,000 scheduled for Sun 09:00
    const payment = paymentOf(ctx, einvoice.id)!;
    requestBankChange(ctx, supplierB.id, IBAN_UNKNOWN, NOURA);
    expect(payment).toMatchObject({ status: "held", holdReason: "iban_change" });

    rejectBankChange(ctx, supplierB.id, FAISAL);
    expect(supplierB.iban).toBe(IBAN_B);
    expect(supplierB.pendingBankChange).toBeUndefined();
    expect(supplierB.bankChanges.at(-1)).toMatchObject({ status: "rejected", newIban: IBAN_UNKNOWN, decidedBy: FAISAL });
    expect(ctx.store.audit.at(-1)).toMatchObject({ action: "supplier.bank_change_rejected", actorId: FAISAL, after: { iban: IBAN_B, rejectedBy: FAISAL } });

    // Still paused: the approval was cleared by the request, so nothing leaves on Sunday…
    advance(ctx, "2026-10-18", "09:00");
    expect(payment.status).toBe("held");
    // …until the run is approved again, and then it pays the old IBAN with the same request key.
    approveRun(ctx, run.id, FAISAL);
    expect(payment).toMatchObject({ status: "settled", iban: IBAN_B });
    expect(ctx.store.railLedger.filter((r) => r.requestKey === payment.requestKey)).toHaveLength(1);
  });

  it("the requester withdraws their own request; a preparer cannot reject someone else's (403)", async () => {
    const { ctx, supplierB } = await requested(NOURA);
    rejectBankChange(ctx, supplierB.id, NOURA);
    expect(ctx.store.audit.at(-1)).toMatchObject({ action: "supplier.bank_change_withdrawn", actorId: NOURA, after: { withdrawnBy: NOURA } });
    expect(supplierB.iban).toBe(IBAN_B);

    requestBankChange(ctx, supplierB.id, IBAN_UNKNOWN, FAISAL);
    const err = await expectCode(() => rejectBankChange(ctx, supplierB.id, NOURA), "not_approver");
    expect(err.httpStatus).toBe(403);
    expect(supplierB.pendingBankChange).toBeDefined();
    rejectBankChange(ctx, supplierB.id, REEM);
    expect(ctx.store.audit.at(-1)?.action).toBe("supplier.bank_change_rejected");
  });
});
