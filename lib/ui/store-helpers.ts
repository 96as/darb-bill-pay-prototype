// Read-side helpers over StoreData for server components (pure; no I/O).
// Permission hints call lib/domain/permissions so the UI and the server use the same rules;
// the API stays the authority.
import { normalizeIban } from "@/lib/domain/iban";
import { canApproveBankChange, canApproveBill, canCancel, canConfirmCloseMatch } from "@/lib/domain/permissions";
import type { RuleResult } from "@/lib/domain/result";
import type { Bill, Payment, StoreData, Supplier, User } from "@/lib/domain/types";

/** Serialisable outcome of a permission check, for client components. */
export interface Gate {
  ok: boolean;
  code?: string;
  message?: string;
}

export const toGate = (r: RuleResult): Gate => (r.ok ? { ok: true } : { ok: false, code: r.code, message: r.message });

export function actingUser(store: StoreData): User | undefined {
  return store.users.find((u) => u.id === store.session.userId);
}

export function userName(store: StoreData, id: string | undefined): { name: string; nameAr: string } | undefined {
  if (!id) return undefined;
  if (id === "system") return { name: "System", nameAr: "النظام" };
  const u = store.users.find((x) => x.id === id);
  return u ? { name: u.name, nameAr: u.nameAr } : { name: id, nameAr: id };
}

/** First-payment rule input: has a payment already left for this supplier's current IBAN? */
export function supplierHasPaid(store: StoreData, supplier: Supplier | undefined): boolean {
  if (!supplier) return false;
  const iban = normalizeIban(supplier.iban);
  return store.payments.some(
    (p) =>
      p.supplierId === supplier.id &&
      (p.status === "sent" || p.status === "settled") &&
      (!p.iban || normalizeIban(p.iban) === iban),
  );
}

export function supplierOf(store: StoreData, bill: Pick<Bill, "supplierId">): Supplier | undefined {
  return bill.supplierId ? store.suppliers.find((s) => s.id === bill.supplierId) : undefined;
}

export function paymentOf(store: StoreData, bill: Pick<Bill, "id" | "paymentId">): Payment | undefined {
  return (
    (bill.paymentId ? store.payments.find((p) => p.id === bill.paymentId) : undefined) ??
    store.payments.find((p) => p.billId === bill.id && p.status !== "cancelled")
  );
}

const opts = (store: StoreData) => ({ makerChecker: store.company.makerChecker });

export function billApprovalGate(store: StoreData, bill: Bill): Gate {
  const supplier = supplierOf(store, bill);
  return toGate(
    canApproveBill(actingUser(store), bill, supplier, { ...opts(store), supplierHasPaid: supplierHasPaid(store, supplier) }),
  );
}

export function billCancelGate(store: StoreData, bill: Bill): Gate {
  return toGate(canCancel(bill, paymentOf(store, bill)));
}

export function bankChangeGate(store: StoreData, supplier: Supplier): Gate {
  return toGate(canApproveBankChange(actingUser(store), supplier, opts(store)));
}

/**
 * Turning down a pending IBAN change: any approver other than the requester, whatever the name check says.
 * (The requester withdraws instead.) TODO: use canRejectBankChange from lib/domain/permissions once it lands.
 */
export function rejectChangeGate(store: StoreData, supplier: Supplier): Gate {
  const user = actingUser(store);
  const change = supplier.pendingBankChange;
  if (!change) return { ok: false, code: "no_pending_change", message: "There is no IBAN change waiting for approval" };
  if (!user) return { ok: false, code: "no_user", message: "No user is acting" };
  if (makerOn(store) && change.requestedBy === user.id) {
    return { ok: false, code: "requester_cannot_approve", message: "You requested this IBAN change, so someone else must decide on it" };
  }
  if (user.role !== "approver") return { ok: false, code: "not_approver", message: "Only an approver can turn down an IBAN change" };
  return { ok: true };
}

/** The requester may withdraw their own pending change. */
export function withdrawChangeGate(store: StoreData, supplier: Supplier): Gate {
  const change = supplier.pendingBankChange;
  return change && change.requestedBy === store.session.userId ? { ok: true } : { ok: false, code: "not_requester" };
}

const makerOn = (store: StoreData) => store.company.makerChecker !== false;

export function confirmMatchGate(store: StoreData, supplier: Supplier): Gate {
  return toGate(canConfirmCloseMatch(actingUser(store), supplier, opts(store)));
}
