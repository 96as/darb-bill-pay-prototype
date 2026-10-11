// Test builders for domain objects, using the seed people from docs/BUILD-NOTES.md.
import type { BankChangeRequest, Bill, NameCheck, Payment, PaymentRun, Supplier, User } from "../types";

const user = (id: string, name: string, role: User["role"]): User => ({
  id,
  name,
  nameAr: name,
  title: "",
  titleAr: "",
  role,
  email: `${id}@sahab-fm.example`,
});

export const NOURA = user("u_noura", "Noura Al-Harbi", "preparer");
export const FAISAL = user("u_faisal", "Faisal Al-Otaibi", "approver");
export const REEM = user("u_reem", "Reem Al-Qahtani", "approver");

const T = "2026-10-15T10:00:00.000Z";

export const matchCheck = (over: Partial<NameCheck> = {}): NameCheck => ({
  result: "match",
  returnedName: "COOL BREEZE HVAC CONTRACTING CO",
  checkedAt: T,
  ...over,
});

export function makeSupplier(over: Partial<Supplier> = {}): Supplier {
  return {
    id: "s_b",
    nameEn: "Cool Breeze HVAC Contracting Co.",
    nameAr: "شركة النسيم البارد للمقاولات والتكييف",
    vatNumber: "310387452600003",
    crNumber: "1010932185",
    iban: "SA6710000000020315550044",
    bankName: "Saudi National Bank",
    createdBy: NOURA.id,
    createdAt: T,
    nameCheck: matchCheck(),
    screening: { status: "cleared", checkedAt: T },
    bankChanges: [],
    ...over,
  };
}

export function makeBankChange(over: Partial<BankChangeRequest> = {}): BankChangeRequest {
  return {
    id: "bc_1",
    oldIban: "SA6710000000020315550044",
    newIban: "SA2045000000001234567001",
    newBankName: "SAB",
    requestedBy: NOURA.id,
    requestedAt: T,
    nameCheck: matchCheck(),
    status: "pending",
    ...over,
  };
}

export function makeBill(over: Partial<Bill> = {}): Bill {
  return {
    id: "b_1",
    kind: "supplier",
    source: "email",
    extraction: "e_invoice",
    supplierId: "s_b",
    supplierName: "Cool Breeze HVAC Contracting Co.",
    supplierVat: "310387452600003",
    invoiceNumber: "INV-2026-0451",
    invoiceUuid: "6f1c9a52-3b7e-4d21-9c88-0a4e5b2d7f13",
    issueDate: "2026-10-13",
    dueDate: "2026-11-12",
    subtotal: 3_913_043,
    vat: 586_957,
    total: 4_500_000,
    fieldSources: {},
    needsReview: [],
    status: "awaiting_approval",
    payDate: "2026-10-15",
    fundingAccountId: "main",
    createdBy: NOURA.id,
    createdAt: T,
    editedBy: [],
    submittedBy: NOURA.id,
    submittedAt: T,
    approvals: [],
    ...over,
  };
}

export function makeRun(over: Partial<PaymentRun> = {}): PaymentRun {
  return {
    id: "r_1",
    name: "October run",
    payDate: "2026-10-15",
    billIds: ["b_1"],
    status: "awaiting_approval",
    createdBy: NOURA.id,
    createdAt: T,
    editedBy: [],
    submittedBy: NOURA.id,
    submittedAt: T,
    approvals: [],
    ...over,
  };
}

export function makePayment(over: Partial<Payment> = {}): Payment {
  return {
    id: "p_1",
    billId: "b_1",
    supplierId: "s_b",
    requestKey: "rk_1",
    amount: 4_500_000,
    fundingAccountId: "main",
    rail: "sarie",
    scheduledFor: "2026-10-18T06:00:00.000Z",
    expectedArrival: "2026-10-18",
    status: "scheduled",
    attempts: 0,
    ...over,
  };
}
