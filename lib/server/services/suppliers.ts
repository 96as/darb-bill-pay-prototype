// Supplier registry (PL-02, BP-05..07): add with IBAN checksum + name check + screening; IBAN-change lock.
import type { BankChangeRequest, Supplier } from "@/lib/domain/types";
import { isValidSaudiIban, maskIban, normalizeIban, saudiBankFromIban } from "@/lib/domain/iban";
import { isValidCr, isValidSaudiVat, normalizeDigits } from "@/lib/domain/vat";
import {
  canApproveBankChange,
  canConfirmCloseMatch,
  canPrepare,
  canRejectBankChange,
  canWithdrawBankChange,
  closeMatchTarget,
} from "@/lib/domain/permissions";
import type { RuleResult } from "@/lib/domain/result";
import type { Ctx } from "../context";
import { approverIds, getUser } from "../context";
import { conflict, ensure, invalid } from "../errors";
import { audit } from "../audit";
import { newId } from "../ids";
import { getBill, getSupplier, notify, paidToCurrentIban, unsentPayment } from "./common";
import { restartApproval } from "./workflow";

export interface AddSupplierInput {
  nameEn: string;
  nameAr?: string;
  vatNumber: string;
  crNumber?: string;
  iban: string;
  noticeEmail?: string;
  noticeMobile?: string;
  /** The draft bill whose e-invoice prefilled this form (BP-05: "prefilledFromEInvoice"). */
  fromBillId?: string;
}

function validIban(raw: string): string {
  const iban = normalizeIban(raw ?? "");
  // BP-05: an IBAN failing its checksum is refused.
  if (!isValidSaudiIban(iban)) throw invalid("invalid_iban", "This IBAN is not valid. Check the 24 characters starting with SA");
  return iban;
}

const bankName = (iban: string) => saudiBankFromIban(iban)?.name ?? "Unknown bank";

export function addSupplier(ctx: Ctx, input: AddSupplierInput, actorId: string): Supplier {
  const user = getUser(ctx, actorId);
  ensure(canPrepare(user));
  const nameEn = input.nameEn?.trim();
  if (!nameEn) throw invalid("missing_name", "The supplier name is required");
  const iban = validIban(input.iban);
  const vatNumber = normalizeDigits(input.vatNumber ?? "");
  if (!isValidSaudiVat(vatNumber)) throw invalid("invalid_vat", "VAT number must be 15 digits, starting and ending with 3");
  const crNumber = input.crNumber ? normalizeDigits(input.crNumber) : "";
  if (crNumber && !isValidCr(crNumber)) throw invalid("invalid_cr", "CR number must be 10 digits");
  const noticeEmail = input.noticeEmail?.trim() || undefined;
  const noticeMobile = input.noticeMobile?.trim() || undefined;
  if (noticeEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(noticeEmail)) throw invalid("invalid_email", "The notice email is not valid");
  if (!noticeEmail && !noticeMobile) throw invalid("notice_contact_required", "Add a notice email or mobile for the supplier");
  const existing = ctx.store.suppliers.find((s) => s.vatNumber === vatNumber);
  if (existing) throw conflict("supplier_exists", `${existing.nameEn} is already saved with this VAT number`);
  const fromBill = input.fromBillId ? getBill(ctx, input.fromBillId) : undefined;

  const supplier: Supplier = {
    id: newId(ctx.store, "s"),
    nameEn,
    nameAr: input.nameAr?.trim() || nameEn,
    vatNumber,
    crNumber,
    iban,
    bankName: bankName(iban),
    ...(noticeEmail ? { noticeEmail } : {}),
    ...(noticeMobile ? { noticeMobile } : {}),
    createdBy: actorId,
    createdAt: ctx.now.toISOString(),
    ...(fromBill?.extraction === "e_invoice" ? { prefilledFromEInvoice: true } : {}),
    nameCheck: ctx.mocks.nameCheck.check(iban, nameEn, ctx.now),
    screening: { status: "pending", checkedAt: ctx.now.toISOString() },
    bankChanges: [],
  };
  supplier.screening = ctx.mocks.screening.screen(supplier, ctx.now);
  ctx.store.suppliers.push(supplier);
  audit(ctx, actorId, "supplier.created", { type: "supplier", id: supplier.id }, undefined, {
    nameEn,
    vatNumber,
    crNumber,
    iban,
    bankName: supplier.bankName,
    nameCheck: supplier.nameCheck,
    screening: supplier.screening.status,
    prefilledFromEInvoice: supplier.prefilledFromEInvoice ?? false,
  });

  // BP-05: open bills with this VAT number are matched to the new supplier.
  for (const bill of ctx.store.bills) {
    if (bill.supplierId || bill.kind !== "supplier" || bill.supplierVat !== vatNumber) continue;
    if (bill.status === "paid" || bill.status === "cancelled") continue;
    bill.supplierId = supplier.id;
    audit(ctx, "system", "bill.supplier_linked", { type: "bill", id: bill.id }, { supplierId: null }, { supplierId: supplier.id });
  }
  return supplier;
}

/**
 * BP-07: an IBAN change pauses payments to the supplier until a second user approves it. Unsent payments are
 * held, approvals of its bills are cleared (they were given for the old IBAN), approvers are alerted.
 */
export function requestBankChange(ctx: Ctx, supplierId: string, newIbanRaw: string, actorId: string): Supplier {
  const user = getUser(ctx, actorId);
  ensure(canPrepare(user));
  const supplier = getSupplier(ctx, supplierId);
  if (supplier.pendingBankChange) throw conflict("change_pending", "An IBAN change for this supplier is already waiting for approval");
  const newIban = validIban(newIbanRaw);
  if (newIban === normalizeIban(supplier.iban)) throw invalid("same_iban", "This is already the supplier's IBAN");

  const change: BankChangeRequest = {
    id: newId(ctx.store, "bc"),
    oldIban: supplier.iban,
    newIban,
    newBankName: bankName(newIban),
    requestedBy: actorId,
    requestedAt: ctx.now.toISOString(),
    nameCheck: ctx.mocks.nameCheck.check(newIban, supplier.nameEn, ctx.now),
    status: "pending",
  };
  supplier.pendingBankChange = change;

  for (const bill of ctx.store.bills) {
    if (bill.supplierId !== supplier.id) continue;
    const payment = unsentPayment(ctx, bill.id);
    if (bill.status === "scheduled" || bill.approvals.length > 0 || payment) restartApproval(ctx, bill, actorId, "iban_change");
  }
  // Any other unsent payment to this supplier is held too (belt and braces).
  for (const p of ctx.store.payments) {
    if (p.supplierId === supplier.id && (p.status === "scheduled" || p.status === "held") && p.holdReason !== "iban_change") {
      p.status = "held";
      p.holdReason = "iban_change";
    }
  }

  audit(ctx, actorId, "supplier.bank_change_requested", { type: "supplier", id: supplier.id }, { iban: change.oldIban, bankName: supplier.bankName }, {
    iban: newIban,
    bankName: change.newBankName,
    requestedBy: actorId,
    requestedAt: change.requestedAt,
    nameCheck: change.nameCheck,
  });
  notify(
    ctx,
    approverIds(ctx).filter((id) => id !== actorId),
    "iban_change",
    `${user.name} asked to change ${supplier.nameEn}'s IBAN to ${maskIban(newIban)} (${change.newBankName}). Payments to this supplier are paused until a second person approves.`,
    `طلب ${user.nameAr} تغيير آيبان ${supplier.nameAr} إلى ${maskIban(newIban)} (${change.newBankName}). الدفعات لهذا المورّد متوقفة حتى يوافق شخص آخر.`,
  );
  return supplier;
}

export function approveBankChange(ctx: Ctx, supplierId: string, actorId: string): Supplier {
  const user = getUser(ctx, actorId);
  const supplier = getSupplier(ctx, supplierId);
  ensure(canApproveBankChange(user, supplier, { makerChecker: ctx.store.company.makerChecker }));
  const change = supplier.pendingBankChange!;
  const before = { iban: supplier.iban, bankName: supplier.bankName, nameCheck: supplier.nameCheck };
  change.status = "approved";
  change.decidedBy = actorId;
  change.decidedAt = ctx.now.toISOString();
  supplier.iban = change.newIban;
  supplier.bankName = change.newBankName;
  supplier.nameCheck = change.nameCheck;
  supplier.bankChanges.push(change);
  delete supplier.pendingBankChange;
  // Both users and times are logged (BP-07).
  audit(ctx, actorId, "supplier.bank_change_approved", { type: "supplier", id: supplier.id }, before, {
    iban: supplier.iban,
    bankName: supplier.bankName,
    requestedBy: change.requestedBy,
    requestedAt: change.requestedAt,
    approvedBy: actorId,
    approvedAt: change.decidedAt,
  });
  return supplier;
}

/**
 * Turns down a pending IBAN change. The requester (any role) WITHDRAWS it ("supplier.bank_change_withdrawn");
 * any other approver REJECTS it, whatever the name check says ("supplier.bank_change_rejected"). Either way the
 * IBAN stays as it was; bills paused by the request still need a fresh approval, then pay the old IBAN.
 */
export function rejectBankChange(ctx: Ctx, supplierId: string, actorId: string): Supplier {
  const user = getUser(ctx, actorId);
  const supplier = getSupplier(ctx, supplierId);
  const withdraw = canWithdrawBankChange(user, supplier).ok;
  if (!withdraw) ensure(canRejectBankChange(user, supplier, { makerChecker: ctx.store.company.makerChecker }));
  const change = supplier.pendingBankChange!;
  change.status = "rejected";
  change.decidedBy = actorId;
  change.decidedAt = ctx.now.toISOString();
  supplier.bankChanges.push(change);
  delete supplier.pendingBankChange;
  audit(
    ctx,
    actorId,
    withdraw ? "supplier.bank_change_withdrawn" : "supplier.bank_change_rejected",
    { type: "supplier", id: supplier.id },
    { pendingIban: change.newIban, nameCheck: change.nameCheck.result },
    {
      iban: supplier.iban,
      requestedBy: change.requestedBy,
      requestedAt: change.requestedAt,
      ...(withdraw ? { withdrawnBy: actorId, withdrawnAt: change.decidedAt } : { rejectedBy: actorId, rejectedAt: change.decidedAt }),
    },
  );
  return supplier;
}

/** What the acting user may do with this supplier's IBAN change and name check (for enabling buttons). */
export interface SupplierChecks {
  approveChange: RuleResult;
  rejectChange: RuleResult;
  withdrawChange: RuleResult;
  confirmMatch: RuleResult;
}

export function supplierChecks(ctx: Ctx, supplier: Supplier, userId: string): SupplierChecks {
  const user = ctx.store.users.find((u) => u.id === userId);
  const opts = { makerChecker: ctx.store.company.makerChecker };
  return {
    approveChange: canApproveBankChange(user, supplier, opts),
    rejectChange: canRejectBankChange(user, supplier, opts),
    withdrawChange: canWithdrawBankChange(user, supplier),
    confirmMatch: canConfirmCloseMatch(user, supplier, opts),
  };
}

/** BP-06: a close name match needs an approver's confirmation before money moves. */
export function confirmCloseMatch(ctx: Ctx, supplierId: string, actorId: string): Supplier {
  const user = getUser(ctx, actorId);
  const supplier = getSupplier(ctx, supplierId);
  ensure(canConfirmCloseMatch(user, supplier, { makerChecker: ctx.store.company.makerChecker }));
  const target = closeMatchTarget(supplier)!;
  const check = target === "pending_change" ? supplier.pendingBankChange!.nameCheck : supplier.nameCheck;
  check.confirmedBy = actorId;
  check.confirmedAt = ctx.now.toISOString();
  audit(ctx, actorId, "supplier.name_check_confirmed", { type: "supplier", id: supplier.id }, { result: "close_match" }, {
    target,
    returnedName: check.returnedName,
    confirmedBy: actorId,
    confirmedAt: check.confirmedAt,
  });
  return supplier;
}

export interface SupplierRow {
  supplier: Supplier;
  paidToCurrentIban: boolean;
  openBills: number;
  owed: number;
}

export function listSuppliers(ctx: Ctx): SupplierRow[] {
  return ctx.store.suppliers.map((s) => supplierRow(ctx, s)).sort((a, b) => a.supplier.nameEn.localeCompare(b.supplier.nameEn));
}

export function supplierRow(ctx: Ctx, supplier: Supplier): SupplierRow {
  const open = ctx.store.bills.filter((b) => b.supplierId === supplier.id && b.status !== "paid" && b.status !== "cancelled");
  return {
    supplier,
    paidToCurrentIban: paidToCurrentIban(ctx, supplier),
    openBills: open.length,
    owed: open.reduce((s, b) => s + b.total, 0),
  };
}
