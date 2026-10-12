import { formatIban, maskIban, saudiBankFromIban } from "@/lib/domain/iban";
import type {
  BankChangeRequest,
  DisplayStatus,
  Halalas,
  ISODate,
  NameCheck,
  Role,
  ScreeningStatus,
  StoreData,
  Supplier,
} from "@/lib/domain/types";
import { riyadhDate } from "@/lib/ui/format";
import { displayStatus } from "@/lib/ui/status";
import { makeCtx } from "@/lib/server/context";
import { supplierChecks } from "@/lib/server/services";
import { actingUser, toGate, userName, type Gate } from "@/lib/ui/store-helpers";
import { readStore } from "../../store";

type Person = { name: string; nameAr: string };

const isOpen = (s: DisplayStatus) => s !== "paid" && s !== "cancelled" && s !== "discarded";

function bankName(iban: string, saved?: string) {
  const bank = saudiBankFromIban(iban);
  return { name: saved || bank?.name || "", nameAr: bank?.nameAr || saved || "" };
}

function owedFor(store: StoreData, supplier: Supplier, today: ISODate) {
  const open = store.bills.filter((b) => b.supplierId === supplier.id && isOpen(displayStatus(b, today)));
  return { total: open.reduce((sum, b) => sum + b.total, 0), count: open.length };
}

// ---------- List ----------

export interface SupplierRow {
  id: string;
  nameEn: string;
  nameAr: string;
  vatNumber: string;
  ibanMasked: string;
  bank: { name: string; nameAr: string };
  nameCheck: NameCheck["result"];
  nameCheckConfirmed: boolean;
  paused: boolean;
  owed: Halalas;
  openBills: number;
}

export async function loadSuppliersView(): Promise<{ rows: SupplierRow[] }> {
  const store = await readStore();
  const today = riyadhDate(store.clock.now);
  const rows = store.suppliers
    .map((s) => {
      const owed = owedFor(store, s, today);
      return {
        id: s.id,
        nameEn: s.nameEn,
        nameAr: s.nameAr,
        vatNumber: s.vatNumber,
        ibanMasked: maskIban(s.iban),
        bank: bankName(s.iban, s.bankName),
        nameCheck: s.nameCheck.result,
        nameCheckConfirmed: Boolean(s.nameCheck.confirmedBy),
        paused: Boolean(s.pendingBankChange),
        owed: owed.total,
        openBills: owed.count,
      };
    })
    .sort((a, b) => a.nameEn.localeCompare(b.nameEn));
  return { rows };
}

// ---------- New (prefilled from a bill's e-invoice) ----------

export interface NewSupplierView {
  fromBill?: {
    id: string;
    invoiceNumber: string;
    extraction: "e_invoice" | "ocr" | "manual";
    prefill: { nameEn?: string; nameAr?: string; vatNumber?: string; crNumber?: string; iban?: string; noticeEmail?: string };
  };
}

export async function loadNewSupplierView(fromBillId?: string): Promise<NewSupplierView> {
  if (!fromBillId) return {};
  const store = await readStore();
  const bill = store.bills.find((b) => b.id === fromBillId);
  if (!bill || bill.kind !== "supplier") return {};
  // supplierEmail (the XML contact email) is optional: older bills and stores don't have it.
  const s = bill.suggestedSupplier as (NonNullable<typeof bill.suggestedSupplier> & { supplierEmail?: string }) | undefined;
  return {
    fromBill: {
      id: bill.id,
      invoiceNumber: bill.invoiceNumber,
      extraction: bill.extraction,
      prefill: {
        nameEn: s?.supplierName ?? bill.supplierName,
        nameAr: s?.supplierNameAr ?? bill.supplierNameAr,
        vatNumber: s?.supplierVat ?? bill.supplierVat,
        crNumber: s?.supplierCr ?? bill.supplierCr,
        iban: s?.supplierIban,
        noticeEmail: typeof s?.supplierEmail === "string" && s.supplierEmail.trim() ? s.supplierEmail.trim() : undefined,
      },
    },
  };
}

// ---------- Detail ----------

export interface BankChangeRow {
  id: string;
  oldIban: string;
  newIban: string;
  newBank: string;
  newBankAr: string;
  status: BankChangeRequest["status"];
  requestedBy?: Person;
  requestedAt: string;
  decidedBy?: Person;
  decidedAt?: string;
  nameCheck: NameCheck;
  confirmedBy?: Person;
}

export interface SupplierBillRow {
  id: string;
  invoiceNumber: string;
  dueDate?: ISODate;
  total: Halalas;
  status: DisplayStatus;
}

export interface SupplierDetailView {
  supplier: {
    id: string;
    nameEn: string;
    nameAr: string;
    vatNumber: string;
    crNumber: string;
    iban: string;
    ibanFormatted: string;
    bank: { name: string; nameAr: string };
    noticeEmail?: string;
    noticeMobile?: string;
    createdBy?: Person;
    createdAt: string;
    prefilledFromEInvoice: boolean;
    nameCheck: NameCheck & { confirmedByName?: Person };
    screening: ScreeningStatus;
  };
  pending?: BankChangeRow;
  history: BankChangeRow[];
  bills: SupplierBillRow[];
  owed: Halalas;
  actingRole?: Role;
  approveChangeGate: Gate;
  /** Reject is its own gate: any approver but the requester, regardless of the name check. */
  rejectChangeGate: Gate;
  /** The requester sees "Withdraw request" instead of Reject. */
  withdrawChangeGate: Gate;
  confirmMatchGate: Gate;
}

function changeRow(store: StoreData, c: BankChangeRequest): BankChangeRow {
  return {
    id: c.id,
    oldIban: formatIban(c.oldIban),
    newIban: formatIban(c.newIban),
    newBank: c.newBankName || saudiBankFromIban(c.newIban)?.name || "",
    newBankAr: saudiBankFromIban(c.newIban)?.nameAr || c.newBankName || "",
    status: c.status,
    requestedBy: userName(store, c.requestedBy),
    requestedAt: c.requestedAt,
    decidedBy: userName(store, c.decidedBy),
    decidedAt: c.decidedAt,
    nameCheck: c.nameCheck,
    confirmedBy: userName(store, c.nameCheck.confirmedBy),
  };
}

export async function loadSupplierDetail(id: string): Promise<SupplierDetailView | null> {
  const store = await readStore();
  const s = store.suppliers.find((x) => x.id === id);
  if (!s) return null;
  const today = riyadhDate(store.clock.now);
  const bills = store.bills
    .filter((b) => b.supplierId === s.id)
    .map((b) => ({ id: b.id, invoiceNumber: b.invoiceNumber, dueDate: b.dueDate, total: b.total, status: displayStatus(b, today) }))
    .sort((a, b) => (b.dueDate ?? "").localeCompare(a.dueDate ?? ""));
  const pending = s.pendingBankChange ? changeRow(store, s.pendingBankChange) : undefined;
  const checks = supplierChecks(makeCtx(store), s, store.session.userId);
  const history = s.bankChanges
    .filter((c) => c.id !== s.pendingBankChange?.id)
    .map((c) => changeRow(store, c))
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  return {
    supplier: {
      id: s.id,
      nameEn: s.nameEn,
      nameAr: s.nameAr,
      vatNumber: s.vatNumber,
      crNumber: s.crNumber,
      iban: s.iban,
      ibanFormatted: formatIban(s.iban),
      bank: bankName(s.iban, s.bankName),
      noticeEmail: s.noticeEmail,
      noticeMobile: s.noticeMobile,
      createdBy: userName(store, s.createdBy),
      createdAt: s.createdAt,
      prefilledFromEInvoice: Boolean(s.prefilledFromEInvoice),
      nameCheck: { ...s.nameCheck, confirmedByName: userName(store, s.nameCheck.confirmedBy) },
      screening: s.screening.status,
    },
    pending,
    history,
    bills,
    owed: owedFor(store, s, today).total,
    actingRole: actingUser(store)?.role,
    // Same rule results as GET /api/payees/{id} → checks (lib/server/services supplierChecks).
    approveChangeGate: toGate(checks.approveChange),
    rejectChangeGate: toGate(checks.rejectChange),
    withdrawChangeGate: toGate(checks.withdrawChange),
    confirmMatchGate: toGate(checks.confirmMatch),
  };
}
