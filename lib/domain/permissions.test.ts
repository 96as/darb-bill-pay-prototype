import { describe, expect, it } from "vitest";
import {
  canApproveBankChange,
  canApproveBill,
  canApproveRun,
  canDiscardDuplicate,
  recentBankChange,
  canCancel,
  canConfirmCloseMatch,
  canPrepare,
  canRejectBankChange,
  canWithdrawBankChange,
  closeMatchTarget,
  lastApprovedBankChange,
  materialChanges,
  materialEditRestartsApproval,
  supplierPaymentGate,
} from "./permissions";
import { FAISAL, NOURA, REEM, makeBankChange, makeBill, makePayment, makeRun, makeSupplier, matchCheck } from "./__fixtures__/builders";
import type { RuleResult } from "./result";

const code = (r: RuleResult) => (r.ok ? "ok" : r.code);
const paid = { supplierHasPaid: true };
const firstPayment = { supplierHasPaid: false };

describe("canPrepare (BP-17)", () => {
  it("lets preparers and approvers prepare", () => {
    expect(canPrepare(NOURA).ok).toBe(true);
    expect(canPrepare(FAISAL).ok).toBe(true);
    expect(code(canPrepare(undefined))).toBe("no_user");
  });
});

describe("supplierPaymentGate (BP-06, BP-07)", () => {
  it("passes a matched, screened supplier", () => {
    expect(supplierPaymentGate(makeSupplier()).ok).toBe(true);
  });

  it.each([
    ["iban_change_pending", makeSupplier({ pendingBankChange: makeBankChange() })],
    ["screening_pending", makeSupplier({ screening: { status: "pending", checkedAt: "" } })],
    ["screening_blocked", makeSupplier({ screening: { status: "blocked", checkedAt: "" } })],
    ["name_check_failed", makeSupplier({ nameCheck: matchCheck({ result: "no_match" }) })],
    ["name_check_unconfirmed", makeSupplier({ nameCheck: matchCheck({ result: "close_match" }) })],
  ])("blocks with %s", (expected, supplier) => {
    expect(code(supplierPaymentGate(supplier))).toBe(expected);
  });

  it("passes a close match once an approver confirmed it", () => {
    const s = makeSupplier({ nameCheck: matchCheck({ result: "close_match", confirmedBy: REEM.id, confirmedAt: "x" }) });
    expect(supplierPaymentGate(s).ok).toBe(true);
  });
});

describe("canApproveBill (BP-08, BP-17, BP-06)", () => {
  const bill = makeBill();
  const supplier = makeSupplier();

  it("lets an approver who is not a maker approve", () => {
    expect(canApproveBill(FAISAL, bill, supplier, paid)).toEqual({ ok: true });
    expect(canApproveBill(REEM, bill, supplier, firstPayment)).toEqual({ ok: true });
  });

  it("refuses preparers and missing users", () => {
    expect(code(canApproveBill(NOURA, makeBill({ createdBy: FAISAL.id }), supplier, paid))).toBe("not_approver");
    expect(code(canApproveBill(undefined, bill, supplier, paid))).toBe("no_user");
  });

  it("refuses bills that are not awaiting approval", () => {
    expect(code(canApproveBill(FAISAL, makeBill({ status: "draft" }), supplier, paid))).toBe("not_awaiting_approval");
  });

  it("refuses the creator, an editor and a different submitter", () => {
    expect(code(canApproveBill(FAISAL, makeBill({ createdBy: FAISAL.id }), supplier, paid))).toBe("creator_cannot_approve");
    expect(code(canApproveBill(FAISAL, makeBill({ editedBy: [REEM.id, FAISAL.id] }), supplier, paid))).toBe("editor_cannot_approve");
    expect(code(canApproveBill(FAISAL, makeBill({ submittedBy: FAISAL.id }), supplier, paid))).toBe("submitter_cannot_approve");
  });

  it("allows the creator when maker-checker is off (one-person company)", () => {
    const own = makeBill({ createdBy: FAISAL.id, submittedBy: FAISAL.id });
    const ownSupplier = makeSupplier({ createdBy: FAISAL.id });
    expect(canApproveBill(FAISAL, own, ownSupplier, { supplierHasPaid: false, makerChecker: false }).ok).toBe(true);
  });

  it("applies the supplier gate", () => {
    expect(code(canApproveBill(FAISAL, bill, makeSupplier({ pendingBankChange: makeBankChange() }), paid))).toBe("iban_change_pending");
    expect(code(canApproveBill(FAISAL, bill, makeSupplier({ nameCheck: matchCheck({ result: "no_match" }) }), paid))).toBe("name_check_failed");
    expect(code(canApproveBill(FAISAL, bill, undefined, paid))).toBe("supplier_missing");
    expect(code(canApproveBill(FAISAL, bill, makeSupplier({ id: "other" }), paid))).toBe("supplier_missing");
    expect(code(canApproveBill(FAISAL, makeBill({ supplierId: undefined }), supplier, paid))).toBe("supplier_not_linked");
  });

  it("first payment: not whoever added the supplier", () => {
    const addedByFaisal = makeSupplier({ createdBy: FAISAL.id });
    expect(code(canApproveBill(FAISAL, bill, addedByFaisal, firstPayment))).toBe("supplier_creator_cannot_approve_first_payment");
    expect(canApproveBill(FAISAL, bill, addedByFaisal, paid).ok).toBe(true);
    expect(canApproveBill(REEM, bill, addedByFaisal, firstPayment).ok).toBe(true);
  });

  it("first payment: not whoever requested the last approved IBAN change", () => {
    const changed = makeSupplier({
      bankChanges: [
        makeBankChange({ id: "old", requestedBy: REEM.id, status: "approved", decidedBy: FAISAL.id, decidedAt: "2026-10-01T00:00:00.000Z" }),
        makeBankChange({ id: "new", requestedBy: FAISAL.id, status: "approved", decidedBy: REEM.id, decidedAt: "2026-10-15T00:00:00.000Z" }),
        makeBankChange({ id: "rej", requestedBy: REEM.id, status: "rejected", decidedAt: "2026-10-16T00:00:00.000Z" }),
      ],
    });
    expect(lastApprovedBankChange(changed)?.id).toBe("new");
    expect(code(canApproveBill(FAISAL, bill, changed, firstPayment))).toBe("iban_changer_cannot_approve_first_payment");
    expect(canApproveBill(REEM, bill, changed, firstPayment).ok).toBe(true);
  });

  it("SADAD bills skip the supplier checks but keep maker-checker", () => {
    const sadad = makeBill({
      kind: "sadad",
      source: "sadad",
      supplierId: undefined,
      sadad: { billerName: "National Power Utility (demo biller)", billerNameAr: "", billerCode: "901", billNumber: "1002387745" },
    });
    expect(canApproveBill(FAISAL, sadad, undefined, firstPayment).ok).toBe(true);
    expect(code(canApproveBill(FAISAL, { ...sadad, createdBy: FAISAL.id }, undefined, paid))).toBe("creator_cannot_approve");
  });
});

describe("canApproveRun (BP-10)", () => {
  const supplierA = makeSupplier({ id: "s_a", nameEn: "Green Oasis Landscaping Est.", createdBy: REEM.id });
  const supplierB = makeSupplier({ id: "s_b" });
  const bills = [
    makeBill({ id: "b_1", supplierId: "s_b" }),
    makeBill({ id: "b_2", supplierId: "s_a", invoiceNumber: "GOL-2026-1003", total: 805_000 }),
    makeBill({ id: "b_3", supplierId: "s_a", invoiceNumber: "GOL-2026-0917", total: 1_250_000 }),
  ];
  const run = makeRun({ billIds: ["b_1", "b_2", "b_3"] });
  const suppliers = { s_a: supplierA, s_b: supplierB };

  it("lets a non-maker approver approve the run", () => {
    expect(canApproveRun(FAISAL, run, bills, suppliers, ["s_a"])).toEqual({ ok: true });
    expect(canApproveRun(FAISAL, run, bills, new Map(Object.entries(suppliers)), new Set(["s_a"])).ok).toBe(true);
  });

  it("refuses the run's creator, editors and submitter", () => {
    expect(code(canApproveRun(FAISAL, makeRun({ ...run, createdBy: FAISAL.id }), bills, suppliers, []))).toBe("run_creator_cannot_approve");
    expect(code(canApproveRun(FAISAL, makeRun({ ...run, editedBy: [FAISAL.id] }), bills, suppliers, []))).toBe("run_editor_cannot_approve");
    expect(code(canApproveRun(FAISAL, makeRun({ ...run, submittedBy: FAISAL.id }), bills, suppliers, []))).toBe("run_submitter_cannot_approve");
  });

  it("refuses preparers and runs not awaiting approval", () => {
    expect(code(canApproveRun(NOURA, run, bills, suppliers, []))).toBe("not_approver");
    expect(code(canApproveRun(FAISAL, makeRun({ ...run, status: "draft" }), bills, suppliers, []))).toBe("run_not_awaiting_approval");
  });

  it("names the bill that fails a bill-level check", () => {
    const r = canApproveRun(FAISAL, run, [bills[0], { ...bills[1], editedBy: [FAISAL.id] }, bills[2]], suppliers, ["s_a"]);
    expect(r).toMatchObject({ ok: false, code: "editor_cannot_approve", billId: "b_2" });
    expect(r.ok ? "" : r.message).toMatch(/^GOL-2026-1003: /);
  });

  it("applies the first-payment rule per supplier", () => {
    // Reem added supplier A, which has never been paid: Reem cannot approve; Faisal can.
    expect(canApproveRun(REEM, run, bills, suppliers, []) ).toMatchObject({ ok: false, code: "supplier_creator_cannot_approve_first_payment", billId: "b_2" });
    expect(canApproveRun(REEM, run, bills, suppliers, ["s_a"]).ok).toBe(true);
  });

  it("blocks the whole run while a supplier's IBAN change is pending (BP-07)", () => {
    const blocked = { ...suppliers, s_b: makeSupplier({ pendingBankChange: makeBankChange() }) };
    expect(canApproveRun(FAISAL, run, bills, blocked, ["s_a", "s_b"])).toMatchObject({ ok: false, code: "iban_change_pending", billId: "b_1" });
  });

  it("skips cancelled bills, and refuses an empty run or a missing bill", () => {
    const withCancelled = [{ ...bills[0], status: "cancelled" as const, editedBy: [FAISAL.id] }, bills[1], bills[2]];
    expect(canApproveRun(FAISAL, run, withCancelled, suppliers, ["s_a"]).ok).toBe(true);
    expect(code(canApproveRun(FAISAL, makeRun({ billIds: [] }), bills, suppliers, []))).toBe("run_empty");
    expect(canApproveRun(FAISAL, makeRun({ billIds: ["b_1", "b_zzz"] }), bills, suppliers, [])).toMatchObject({ code: "run_bill_missing", billId: "b_zzz" });
  });
});

describe("canApproveBankChange (BP-07)", () => {
  it("needs a second user", () => {
    const s = makeSupplier({ pendingBankChange: makeBankChange({ requestedBy: FAISAL.id }) });
    expect(code(canApproveBankChange(FAISAL, s))).toBe("requester_cannot_approve");
    expect(canApproveBankChange(REEM, s).ok).toBe(true);
    expect(canApproveBankChange(FAISAL, s, { makerChecker: false }).ok).toBe(true);
  });

  it("needs an approver and a pending change", () => {
    const s = makeSupplier({ pendingBankChange: makeBankChange() });
    expect(code(canApproveBankChange(NOURA, s))).toBe("not_approver");
    expect(code(canApproveBankChange(FAISAL, makeSupplier()))).toBe("no_pending_change");
  });

  it("needs the new account's name check to pass", () => {
    const noMatch = makeSupplier({ pendingBankChange: makeBankChange({ nameCheck: matchCheck({ result: "no_match" }) }) });
    const close = makeSupplier({ pendingBankChange: makeBankChange({ nameCheck: matchCheck({ result: "close_match" }) }) });
    const closeOk = makeSupplier({
      pendingBankChange: makeBankChange({ nameCheck: matchCheck({ result: "close_match", confirmedBy: REEM.id }) }),
    });
    expect(code(canApproveBankChange(FAISAL, noMatch))).toBe("name_check_failed");
    expect(code(canApproveBankChange(FAISAL, close))).toBe("name_check_unconfirmed");
    expect(canApproveBankChange(FAISAL, closeOk).ok).toBe(true);
  });
});

describe("canRejectBankChange / canWithdrawBankChange (BP-07)", () => {
  it("any approver other than the requester can reject, whatever the name check says", () => {
    for (const nameCheck of [matchCheck({ result: "no_match" }), matchCheck({ result: "close_match" }), matchCheck()]) {
      const s = makeSupplier({ pendingBankChange: makeBankChange({ requestedBy: NOURA.id, nameCheck }) });
      expect(canRejectBankChange(FAISAL, s).ok).toBe(true);
      expect(canRejectBankChange(REEM, s).ok).toBe(true);
    }
  });

  it("the requester cannot reject but can withdraw; others cannot withdraw", () => {
    const s = makeSupplier({ pendingBankChange: makeBankChange({ requestedBy: FAISAL.id, nameCheck: matchCheck({ result: "close_match" }) }) });
    expect(code(canRejectBankChange(FAISAL, s))).toBe("requester_cannot_reject");
    expect(canRejectBankChange(FAISAL, s, { makerChecker: false }).ok).toBe(true);
    expect(canWithdrawBankChange(FAISAL, s).ok).toBe(true);
    expect(code(canWithdrawBankChange(REEM, s))).toBe("not_requester");
    const byNoura = makeSupplier({ pendingBankChange: makeBankChange({ requestedBy: NOURA.id }) });
    expect(canWithdrawBankChange(NOURA, byNoura).ok).toBe(true); // a preparer can withdraw their own request
  });

  it("a preparer cannot reject; nothing to act on without a pending change", () => {
    const s = makeSupplier({ pendingBankChange: makeBankChange({ requestedBy: FAISAL.id }) });
    expect(code(canRejectBankChange(NOURA, s))).toBe("not_approver");
    expect(code(canRejectBankChange(REEM, makeSupplier()))).toBe("no_pending_change");
    expect(code(canWithdrawBankChange(NOURA, makeSupplier()))).toBe("no_pending_change");
    expect(code(canWithdrawBankChange(undefined, s))).toBe("no_user");
  });
});

describe("canConfirmCloseMatch (BP-06)", () => {
  it("targets the pending change first, then the supplier", () => {
    const both = makeSupplier({
      nameCheck: matchCheck({ result: "close_match" }),
      pendingBankChange: makeBankChange({ nameCheck: matchCheck({ result: "close_match" }) }),
    });
    expect(closeMatchTarget(both)).toBe("pending_change");
    expect(closeMatchTarget(makeSupplier({ nameCheck: matchCheck({ result: "close_match" }) }))).toBe("supplier");
    expect(closeMatchTarget(makeSupplier())).toBeNull();
  });

  it("needs an approver who did not enter that IBAN", () => {
    const s = makeSupplier({ createdBy: FAISAL.id, nameCheck: matchCheck({ result: "close_match" }) });
    expect(code(canConfirmCloseMatch(NOURA, s))).toBe("not_approver");
    expect(code(canConfirmCloseMatch(FAISAL, s))).toBe("maker_cannot_confirm");
    expect(canConfirmCloseMatch(REEM, s).ok).toBe(true);
    expect(code(canConfirmCloseMatch(REEM, makeSupplier()))).toBe("nothing_to_confirm");
  });

  it("for a pending change, the requester cannot confirm", () => {
    const s = makeSupplier({ pendingBankChange: makeBankChange({ requestedBy: REEM.id, nameCheck: matchCheck({ result: "close_match" }) }) });
    expect(code(canConfirmCloseMatch(REEM, s))).toBe("maker_cannot_confirm");
    expect(canConfirmCloseMatch(FAISAL, s).ok).toBe(true);
  });
});

describe("canCancel (BP-18)", () => {
  it("allows draft, awaiting approval, scheduled and failed bills until sent", () => {
    for (const status of ["draft", "awaiting_approval", "scheduled", "failed"] as const) {
      expect(canCancel(makeBill({ status })).ok).toBe(true);
    }
    expect(canCancel(makeBill({ status: "scheduled" }), makePayment({ status: "scheduled" })).ok).toBe(true);
    expect(canCancel(makeBill({ status: "scheduled" }), makePayment({ status: "held", holdReason: "short_balance" })).ok).toBe(true);
  });

  it("refuses once sent, paid or cancelled", () => {
    expect(code(canCancel(makeBill({ status: "scheduled" }), makePayment({ status: "sent" })))).toBe("payment_sent");
    expect(code(canCancel(makeBill({ status: "scheduled" }), makePayment({ status: "settled" })))).toBe("payment_sent");
    expect(code(canCancel(makeBill({ status: "paid" })))).toBe("already_paid");
    expect(code(canCancel(makeBill({ status: "cancelled" })))).toBe("already_cancelled");
  });
});

describe("canDiscardDuplicate (BP-04)", () => {
  it("only a draft flagged as a duplicate", () => {
    expect(canDiscardDuplicate(makeBill({ status: "draft", duplicateOf: "b_x" })).ok).toBe(true);
    expect(code(canDiscardDuplicate(makeBill({ status: "draft" })))).toBe("not_duplicate");
    expect(code(canDiscardDuplicate(makeBill({ status: "awaiting_approval", duplicateOf: "b_x" })))).toBe("not_draft");
    expect(code(canCancel(makeBill({ status: "discarded" })))).toBe("already_discarded");
  });
});

describe("recentBankChange", () => {
  const now = new Date("2026-10-15T13:10:00.000Z");
  const withChange = (decidedAt: string) =>
    makeSupplier({ bankChanges: [makeBankChange({ status: "approved", decidedBy: REEM.id, decidedAt })] });
  it("returns the last approved change within 30 days", () => {
    expect(recentBankChange(withChange("2026-10-15T13:00:00.000Z"), now)?.decidedBy).toBe(REEM.id);
    expect(recentBankChange(withChange("2026-09-15T13:10:00.000Z"), now)).toBeDefined(); // exactly 30 days
    expect(recentBankChange(withChange("2026-09-15T13:09:59.000Z"), now)).toBeUndefined();
    expect(recentBankChange(withChange("2026-10-01T00:00:00.000Z"), now, 7)).toBeUndefined();
    expect(recentBankChange(makeSupplier(), now)).toBeUndefined();
    expect(recentBankChange(makeSupplier({ bankChanges: [makeBankChange({ status: "rejected", decidedAt: "2026-10-15T00:00:00.000Z" })] }), now)).toBeUndefined();
  });
});

describe("material edits restart approval (BP-08)", () => {
  const before = { total: 4_500_000, subtotal: 3_913_043, vat: 586_957, supplierId: "s_b", payDate: "2026-10-15", dueDate: "2026-11-12", iban: "SA6710000000020315550044" };

  it("detects amount, supplier, IBAN and date changes", () => {
    expect(materialChanges(before, { ...before, total: 4_500_100 })).toEqual(["total"]);
    expect(materialChanges(before, { ...before, supplierId: "s_a" })).toEqual(["supplier"]);
    expect(materialChanges(before, { ...before, iban: "SA2045000000001234567001" })).toEqual(["iban"]);
    expect(materialChanges(before, { ...before, payDate: "2026-10-18" })).toEqual(["payDate"]);
    expect(materialChanges(before, { ...before, dueDate: "2026-11-30" })).toEqual(["dueDate"]);
    expect(materialChanges(before, { ...before, vat: 586_956, subtotal: 3_913_044 })).toEqual(["subtotal", "vat"]);
    expect(materialEditRestartsApproval(before, { ...before, total: 1 })).toBe(true);
  });

  it("ignores formatting-only IBAN differences and non-material fields", () => {
    expect(materialEditRestartsApproval(before, { ...before, iban: "sa67 1000 0000 0203 1555 0044" })).toBe(false);
    expect(materialEditRestartsApproval(before, { ...before })).toBe(false);
  });

  it("uses the SADAD biller or the typed name when there is no supplier id", () => {
    const sadad = { total: 324_055, sadad: { billerName: "", billerNameAr: "", billerCode: "901", billNumber: "1002387745" } };
    expect(materialChanges(sadad, { ...sadad, sadad: { ...sadad.sadad, billNumber: "1002387746" } })).toEqual(["supplier"]);
    expect(materialChanges({ total: 1, supplierName: "Acme" }, { total: 1, supplierName: " acme " })).toEqual([]);
    expect(materialChanges({ total: 1, supplierName: "Acme" }, { total: 1, supplierName: "Other" })).toEqual(["supplier"]);
  });
});
