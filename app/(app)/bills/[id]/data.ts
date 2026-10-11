import { maskIban, saudiBankFromIban } from "@/lib/domain/iban";
import type {
  AccountingEntry,
  Bill,
  DisplayStatus,
  FundingAccount,
  NameCheck,
  Payment,
  Role,
  ScreeningStatus,
  Supplier,
  SupplierNotice,
} from "@/lib/domain/types";
import { toAuditRows, type AuditRow } from "@/lib/ui/audit";
import { riyadhDate } from "@/lib/ui/format";
import { displayStatus } from "@/lib/ui/status";
import { actingUser, paymentOf, supplierOf, toGate, userName, type Gate } from "@/lib/ui/store-helpers";
import { makeCtx } from "@/lib/server/context";
import { getBillDetail } from "@/lib/server/services";
import { readStore } from "../../store";

export interface DetailSupplier {
  id: string;
  nameEn: string;
  nameAr: string;
  vatNumber: string;
  crNumber: string;
  ibanMasked: string;
  bankName: string;
  bankNameAr: string;
  nameCheck: NameCheck;
  screening: ScreeningStatus;
  /** An IBAN change is waiting for approval: payments are paused (BP-07). */
  paused: boolean;
  /** The bill's VAT number equals the saved supplier's (BP-05 matching). */
  matchedByVat: boolean;
}

export interface SuggestedSupplier {
  name?: string;
  nameAr?: string;
  vat?: string;
  cr?: string;
  ibanMasked?: string;
  bankName?: string;
  bankNameAr?: string;
}

export interface BillDetailView {
  now: string;
  today: string;
  bill: Bill;
  status: DisplayStatus;
  actingRole: Role | undefined;
  supplier?: DetailSupplier;
  suggested?: SuggestedSupplier;
  duplicateOf?: { id: string; invoiceNumber: string; supplierName: string };
  payment?: Payment;
  /** Props for the shared PaymentSection (notice EN/AR, accounting entry, confirmation), when a payment exists. */
  paymentSection?: { payment: Payment; notice?: SupplierNotice; accountingEntries: AccountingEntry[]; supplier?: Supplier };
  run?: { id: string; name: string };
  accounts: Pick<FundingAccount, "id" | "kind" | "name" | "nameAr" | "balance">[];
  submittedBy?: { name: string; nameAr: string };
  cancelledBy?: { name: string; nameAr: string };
  /** Rule results for the acting user from the service layer (getBillDetail().checks); the API re-checks. */
  submitGate: Gate;
  approvalGate: Gate;
  cancelGate: Gate;
  events: AuditRow[];
}

/** Everything the bill detail screen needs, or null when the bill doesn't exist. */
export async function loadBillDetail(id: string): Promise<BillDetailView | null> {
  const store = await readStore();
  const bill = store.bills.find((b) => b.id === id);
  if (!bill) return null;
  const today = riyadhDate(store.clock.now);
  const supplier = supplierOf(store, bill);
  const payment = paymentOf(store, bill);
  const original = bill.duplicateOf ? store.bills.find((b) => b.id === bill.duplicateOf) : undefined;
  const run = bill.runId ? store.runs.find((r) => r.id === bill.runId) : undefined;

  const checks = getBillDetail(makeCtx(store), bill.id).checks;
  const suggestedIban = bill.suggestedSupplier?.supplierIban;
  const events = store.audit
    .filter(
      (e) =>
        (e.entity.type === "bill" && e.entity.id === bill.id) ||
        (e.entity.type === "payment" && store.payments.some((p) => p.id === e.entity.id && p.billId === bill.id)),
    )
    .sort((a, b) => a.at.localeCompare(b.at));

  return {
    now: store.clock.now,
    today,
    bill,
    status: displayStatus(bill, today),
    actingRole: actingUser(store)?.role,
    supplier: supplier
      ? {
          id: supplier.id,
          nameEn: supplier.nameEn,
          nameAr: supplier.nameAr,
          vatNumber: supplier.vatNumber,
          crNumber: supplier.crNumber,
          ibanMasked: maskIban(supplier.iban),
          bankName: supplier.bankName || saudiBankFromIban(supplier.iban)?.name || "",
          bankNameAr: saudiBankFromIban(supplier.iban)?.nameAr || supplier.bankName || "",
          nameCheck: supplier.nameCheck,
          screening: supplier.screening.status,
          paused: Boolean(supplier.pendingBankChange),
          matchedByVat: Boolean(bill.supplierVat && bill.supplierVat === supplier.vatNumber),
        }
      : undefined,
    suggested:
      !supplier && bill.kind === "supplier"
        ? {
            name: bill.suggestedSupplier?.supplierName ?? bill.supplierName,
            nameAr: bill.suggestedSupplier?.supplierNameAr ?? bill.supplierNameAr,
            vat: bill.suggestedSupplier?.supplierVat ?? bill.supplierVat,
            cr: bill.suggestedSupplier?.supplierCr ?? bill.supplierCr,
            ibanMasked: suggestedIban ? maskIban(suggestedIban) : undefined,
            bankName: suggestedIban ? saudiBankFromIban(suggestedIban)?.name : undefined,
            bankNameAr: suggestedIban ? saudiBankFromIban(suggestedIban)?.nameAr : undefined,
          }
        : undefined,
    duplicateOf: original
      ? { id: original.id, invoiceNumber: original.invoiceNumber, supplierName: original.supplierName }
      : undefined,
    payment,
    paymentSection:
      payment && (bill.status === "paid" || bill.status === "scheduled" || bill.status === "failed")
        ? {
            payment,
            notice: store.notices.find((n) => n.paymentId === payment.id),
            accountingEntries: store.accounting.filter((a) => a.billId === bill.id),
            supplier,
          }
        : undefined,
    run: run ? { id: run.id, name: run.name } : undefined,
    accounts: store.accounts.map(({ id, kind, name, nameAr, balance }) => ({ id, kind, name, nameAr, balance })),
    submittedBy: userName(store, bill.submittedBy),
    cancelledBy: userName(store, bill.cancelledBy),
    submitGate: toGate(checks.submit),
    approvalGate: toGate(checks.approve),
    cancelGate: toGate(checks.cancel),
    events: toAuditRows(store, events),
  };
}
