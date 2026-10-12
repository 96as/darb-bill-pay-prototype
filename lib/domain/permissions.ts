// Maker-checker and money-movement gates (PRD 3 platform rules, BP-06, BP-07, BP-08, BP-17). Pure checks.
import type { BankChangeRequest, Bill, Payment, PaymentRun, Supplier, User } from "./types";
import { allow, deny, type RuleResult } from "./result";
import { normalizeIban } from "./iban";

export type SupplierGateCode =
  | "iban_change_pending"
  | "screening_pending"
  | "screening_blocked"
  | "name_check_failed"
  | "name_check_unconfirmed";

export type PermissionCode =
  | SupplierGateCode
  | "no_user"
  | "not_approver"
  | "not_awaiting_approval"
  | "creator_cannot_approve"
  | "editor_cannot_approve"
  | "submitter_cannot_approve"
  | "supplier_not_linked"
  | "supplier_missing"
  | "supplier_creator_cannot_approve_first_payment"
  | "iban_changer_cannot_approve_first_payment"
  | "run_not_awaiting_approval"
  | "run_empty"
  | "run_bill_missing"
  | "run_creator_cannot_approve"
  | "run_editor_cannot_approve"
  | "run_submitter_cannot_approve"
  | "no_pending_change"
  | "requester_cannot_approve"
  | "requester_cannot_reject"
  | "not_requester"
  | "nothing_to_confirm"
  | "maker_cannot_confirm"
  | "already_cancelled"
  | "already_paid"
  | "payment_sent";

export type PermissionResult = RuleResult<PermissionCode>;

export interface MakerCheckerOptions {
  /** Company switch (PRD 3: on by default; a one-person company may turn it off). Defaults to true. */
  makerChecker?: boolean;
}

export interface ApproveBillOptions extends MakerCheckerOptions {
  /**
   * Whether a payment has already been sent to this supplier. Pass false for the first payment
   * (recommended: "first payment to the supplier's current IBAN", so an IBAN change re-arms the rule).
   */
  supplierHasPaid: boolean;
}

const makerCheckerOn = (opts?: MakerCheckerOptions) => opts?.makerChecker ?? true;

function requireApprover(user: User | undefined, what: string): PermissionResult {
  if (!user) return deny("no_user", "No user is acting");
  // BP-17: a user who can only prepare cannot approve or pay.
  if (user.role !== "approver") return deny("not_approver", `Only an approver can ${what}`);
  return allow();
}

/** BP-17: preparers and approvers can create, edit and submit bills. */
export function canPrepare(user: User | undefined): PermissionResult {
  return user ? allow() : deny("no_user", "No user is acting");
}

/** Whether payments to this supplier may be approved or sent right now (BP-06, BP-07). */
export function supplierPaymentGate(supplier: Supplier): RuleResult<SupplierGateCode> {
  // BP-07: an open IBAN change pauses every payment to the supplier.
  if (supplier.pendingBankChange) {
    return deny("iban_change_pending", `${supplier.nameEn}'s IBAN change is waiting for approval; payments are paused`);
  }
  // BP-06: payee screening must clear before the first payment.
  if (supplier.screening.status === "blocked") return deny("screening_blocked", `${supplier.nameEn} did not pass payee screening`);
  if (supplier.screening.status !== "cleared") return deny("screening_pending", `Payee screening for ${supplier.nameEn} has not cleared yet`);
  // BP-06: match proceeds, close match needs an approver's confirmation, no match blocks.
  const check = supplier.nameCheck;
  if (check.result === "no_match") return deny("name_check_failed", `The account name does not match ${supplier.nameEn}`);
  if (check.result === "close_match" && !check.confirmedBy) {
    return deny("name_check_unconfirmed", `The account name is a close match for ${supplier.nameEn}; an approver must confirm it`);
  }
  return allow();
}

/** The most recent approved IBAN change, by decision time. */
export function lastApprovedBankChange(supplier: Supplier): BankChangeRequest | undefined {
  return supplier.bankChanges
    .filter((c) => c.status === "approved")
    .reduce<BankChangeRequest | undefined>((last, c) => (!last || (c.decidedAt ?? "") >= (last.decidedAt ?? "") ? c : last), undefined);
}

/** Bill-level checks shared by single-bill and run approval (role and status are checked by the callers). */
function checkBillMakersAndSupplier(
  user: User,
  bill: Bill,
  supplier: Supplier | undefined,
  opts: ApproveBillOptions,
): PermissionResult {
  // PRD 3 / BP-08: whoever creates, edits or submits a bill cannot approve it alone.
  if (makerCheckerOn(opts)) {
    if (bill.createdBy === user.id) return deny("creator_cannot_approve", "You created this bill, so someone else must approve it");
    if (bill.editedBy.includes(user.id)) return deny("editor_cannot_approve", "You edited this bill, so someone else must approve it");
    if (bill.submittedBy === user.id) return deny("submitter_cannot_approve", "You submitted this bill, so someone else must approve it");
  }
  if (bill.kind !== "supplier") return allow(); // SADAD bills pay a biller, not a saved supplier.

  if (!bill.supplierId) return deny("supplier_not_linked", "Save the supplier and its IBAN before approving this bill");
  if (!supplier || supplier.id !== bill.supplierId) return deny("supplier_missing", "The bill's supplier was not found");
  const gate = supplierPaymentGate(supplier);
  if (!gate.ok) return gate;

  // BP-06 / BUILD-NOTES 5: the first payment needs someone other than who added the supplier or changed its IBAN.
  if (makerCheckerOn(opts) && !opts.supplierHasPaid) {
    if (supplier.createdBy === user.id) {
      return deny("supplier_creator_cannot_approve_first_payment", `You added ${supplier.nameEn}, so someone else must approve its first payment`);
    }
    if (lastApprovedBankChange(supplier)?.requestedBy === user.id) {
      return deny("iban_changer_cannot_approve_first_payment", `You changed ${supplier.nameEn}'s IBAN, so someone else must approve its first payment`);
    }
  }
  return allow();
}

/** BP-08: approval releases the payment. */
export function canApproveBill(
  user: User | undefined,
  bill: Bill,
  supplier: Supplier | undefined,
  opts: ApproveBillOptions,
): PermissionResult {
  const role = requireApprover(user, "approve bills");
  if (!role.ok || !user) return role;
  if (bill.status !== "awaiting_approval") return deny("not_awaiting_approval", "This bill is not waiting for approval");
  return checkBillMakersAndSupplier(user, bill, supplier, opts);
}

type Lookup<T> = ReadonlyMap<string, T> | Readonly<Record<string, T>>;
const get = <T>(m: Lookup<T>, id: string): T | undefined =>
  m instanceof Map ? m.get(id) : (m as Readonly<Record<string, T>>)[id];

/**
 * BP-10: one approval for the whole run. The run's makers are excluded, and every (non-cancelled) bill
 * in it must pass the same checks as a single bill. A denial names the bill via `billId`.
 */
export function canApproveRun(
  user: User | undefined,
  run: PaymentRun,
  bills: readonly Bill[],
  suppliersById: Lookup<Supplier>,
  paidSupplierIds: ReadonlySet<string> | readonly string[],
  opts?: MakerCheckerOptions,
): PermissionResult {
  const role = requireApprover(user, "approve payment runs");
  if (!role.ok || !user) return role;
  if (run.status !== "awaiting_approval") return deny("run_not_awaiting_approval", "This run is not waiting for approval");
  if (makerCheckerOn(opts)) {
    if (run.createdBy === user.id) return deny("run_creator_cannot_approve", "You created this run, so someone else must approve it");
    if (run.editedBy.includes(user.id)) return deny("run_editor_cannot_approve", "You edited this run, so someone else must approve it");
    if (run.submittedBy === user.id) return deny("run_submitter_cannot_approve", "You submitted this run, so someone else must approve it");
  }

  const paid = paidSupplierIds instanceof Set ? paidSupplierIds : new Set(paidSupplierIds as readonly string[]);
  const byId = new Map(bills.map((b) => [b.id, b]));
  let active = 0;
  for (const id of run.billIds) {
    const bill = byId.get(id);
    if (!bill) return deny("run_bill_missing", `Bill ${id} in this run was not found`, id);
    if (bill.status === "cancelled") continue;
    active++;
    const supplier = bill.supplierId ? get(suppliersById, bill.supplierId) : undefined;
    const supplierHasPaid = bill.supplierId ? paid.has(bill.supplierId) : true;
    const r = checkBillMakersAndSupplier(user, bill, supplier, { ...opts, supplierHasPaid });
    if (!r.ok) return deny(r.code, `${bill.invoiceNumber || bill.supplierName}: ${r.message}`, bill.id);
  }
  if (active === 0) return deny("run_empty", "This run has no bills to pay");
  return allow();
}

/** BP-07: an IBAN change needs a second user and a passing name check on the new account. */
export function canApproveBankChange(user: User | undefined, supplier: Supplier, opts?: MakerCheckerOptions): PermissionResult {
  const role = requireApprover(user, "approve IBAN changes");
  if (!role.ok || !user) return role;
  const change = supplier.pendingBankChange;
  if (!change || change.status !== "pending") return deny("no_pending_change", "There is no IBAN change waiting for approval");
  if (makerCheckerOn(opts) && change.requestedBy === user.id) {
    return deny("requester_cannot_approve", "You requested this IBAN change, so someone else must approve it");
  }
  if (change.nameCheck.result === "no_match") return deny("name_check_failed", "The new account name does not match the supplier");
  if (change.nameCheck.result === "close_match" && !change.nameCheck.confirmedBy) {
    return deny("name_check_unconfirmed", "The new account name is a close match; an approver must confirm it first");
  }
  return allow();
}

/**
 * An approver turns down someone else's IBAN change, whatever its name check says (no match, unconfirmed
 * close match…): rejecting never moves money, so it is always safe. The requester withdraws instead.
 */
export function canRejectBankChange(user: User | undefined, supplier: Supplier, opts?: MakerCheckerOptions): PermissionResult {
  const role = requireApprover(user, "reject IBAN changes");
  if (!role.ok || !user) return role;
  const change = supplier.pendingBankChange;
  if (!change || change.status !== "pending") return deny("no_pending_change", "There is no IBAN change waiting for approval");
  if (makerCheckerOn(opts) && change.requestedBy === user.id) {
    return deny("requester_cannot_reject", "You asked for this change; withdraw it instead");
  }
  return allow();
}

/** The requester (any role) can withdraw their own pending IBAN change. Separate from reject so the audit says which. */
export function canWithdrawBankChange(user: User | undefined, supplier: Supplier): PermissionResult {
  if (!user) return deny("no_user", "No user is acting");
  const change = supplier.pendingBankChange;
  if (!change || change.status !== "pending") return deny("no_pending_change", "There is no IBAN change waiting for approval");
  if (change.requestedBy !== user.id) return deny("not_requester", "Only the person who asked for this change can withdraw it");
  return allow();
}

/** Which close-match name check is waiting for confirmation: the open IBAN change's first, else the supplier's. */
export function closeMatchTarget(supplier: Supplier): "pending_change" | "supplier" | null {
  const pending = supplier.pendingBankChange?.nameCheck;
  if (pending?.result === "close_match" && !pending.confirmedBy) return "pending_change";
  if (supplier.nameCheck.result === "close_match" && !supplier.nameCheck.confirmedBy) return "supplier";
  return null;
}

/** BP-06: a close match needs an approver's confirmation, and not from whoever entered that IBAN. */
export function canConfirmCloseMatch(user: User | undefined, supplier: Supplier, opts?: MakerCheckerOptions): PermissionResult {
  const role = requireApprover(user, "confirm a close name match");
  if (!role.ok || !user) return role;
  const target = closeMatchTarget(supplier);
  if (!target) return deny("nothing_to_confirm", "There is no close name match to confirm");
  const maker = target === "pending_change" ? supplier.pendingBankChange?.requestedBy : supplier.createdBy;
  if (makerCheckerOn(opts) && maker === user.id) {
    return deny("maker_cannot_confirm", "You entered this IBAN, so someone else must confirm the name match");
  }
  return allow();
}

/**
 * BP-18 / BUILD-NOTES 13: a bill can be cancelled until its payment is sent.
 * Draft, awaiting approval, scheduled and failed bills qualify; paid and cancelled do not.
 */
export function canCancel(bill: Bill, payment?: Payment): PermissionResult {
  if (bill.status === "cancelled") return deny("already_cancelled", "This bill is already cancelled");
  if (bill.status === "paid") return deny("already_paid", "This bill is already paid");
  if (payment && (payment.status === "sent" || payment.status === "settled")) {
    return deny("payment_sent", "The payment has already been sent and can no longer be cancelled");
  }
  return allow();
}

// ---------- Material edits (PL-01, BP-08) ----------

export type MaterialField = "total" | "subtotal" | "vat" | "supplier" | "iban" | "payDate" | "dueDate";

export type MaterialSnapshot = Pick<Bill, "total"> &
  Partial<Pick<Bill, "subtotal" | "vat" | "supplierId" | "supplierName" | "payDate" | "dueDate" | "sadad">> & {
    /** The payee IBAN the approval covered (supplier IBAN at the time). */
    iban?: string;
  };

/** Fields whose change restarts approval: "editing amount, supplier, IBAN or date restarts approval" (BP-08). */
export function materialChanges(before: MaterialSnapshot, after: MaterialSnapshot): MaterialField[] {
  const changed: MaterialField[] = [];
  if (before.total !== after.total) changed.push("total");
  if (before.subtotal !== after.subtotal) changed.push("subtotal");
  if (before.vat !== after.vat) changed.push("vat");
  if (supplierKey(before) !== supplierKey(after)) changed.push("supplier");
  if (normIban(before.iban) !== normIban(after.iban)) changed.push("iban");
  if (before.payDate !== after.payDate) changed.push("payDate");
  if (before.dueDate !== after.dueDate) changed.push("dueDate");
  return changed;
}

export function materialEditRestartsApproval(before: MaterialSnapshot, after: MaterialSnapshot): boolean {
  return materialChanges(before, after).length > 0;
}

/** Supplier identity: the saved supplier id, else the SADAD biller + bill number, else the typed name. */
function supplierKey(s: MaterialSnapshot): string {
  if (s.supplierId) return `id:${s.supplierId}`;
  if (s.sadad) return `sadad:${s.sadad.billerCode}:${s.sadad.billNumber}`;
  return `name:${(s.supplierName ?? "").trim().toLowerCase()}`;
}

const normIban = (iban?: string) => (iban ? normalizeIban(iban) : "");
