// Mock accounting sync (BP-14, BP-15): an Odoo-style journal entry per payable and per payment.
import type { AccountingEntry, Bill, Payment, StoreData } from "@/lib/domain/types";
import { newId } from "@/lib/server/ids";

export const ACCOUNTING_SYSTEM = "Accounting system (mock)";

export interface AccountingSync {
  /** BP-15 (P1): an approved bill becomes a payable. */
  syncPayable(store: StoreData, bill: Bill, now: Date): AccountingEntry;
  /** BP-14: the payment, carrying the invoice file, number, supplier and VAT. */
  syncPayment(store: StoreData, bill: Bill, payment: Payment, now: Date): AccountingEntry;
  /** BP-15: the payable is marked paid when Darb's payment settles. */
  markPayablePaid(store: StoreData, billId: string): AccountingEntry | undefined;
}

const payeeName = (bill: Bill) => bill.sadad?.billerName ?? bill.supplierName;

function accountLabel(store: StoreData, accountId: string): string {
  const account = store.accounts.find((a) => a.id === accountId);
  return account?.kind === "subwallet" ? `Darb subwallet: ${account.name}` : "Darb balance";
}

export function createMockAccounting(): AccountingSync {
  return {
    syncPayable(store, bill, now) {
      const existing = store.accounting.find((e) => e.kind === "payable" && e.billId === bill.id);
      if (existing) return existing;
      const vat = bill.vat ?? 0;
      const lines =
        bill.kind === "sadad"
          ? [
              { account: "Utilities expense", debit: bill.total, credit: 0 },
              { account: "Accounts payable", debit: 0, credit: bill.total },
            ]
          : [
              { account: "Expenses", debit: bill.total - vat, credit: 0 },
              { account: "VAT input 15%", debit: vat, credit: 0 },
              { account: "Accounts payable", debit: 0, credit: bill.total },
            ];
      const entry: AccountingEntry = {
        id: newId(store, "acc"),
        kind: "payable",
        billId: bill.id,
        system: ACCOUNTING_SYSTEM,
        supplierName: payeeName(bill),
        invoiceNumber: bill.sadad?.billNumber ?? bill.invoiceNumber,
        vat: bill.vat,
        total: bill.total,
        attachmentName: bill.file?.name,
        status: "synced",
        createdAt: now.toISOString(),
        lines,
      };
      store.accounting.push(entry);
      return entry;
    },

    syncPayment(store, bill, payment, now) {
      const existing = store.accounting.find((e) => e.kind === "payment" && e.paymentId === payment.id);
      if (existing) return existing;
      const entry: AccountingEntry = {
        id: newId(store, "acc"),
        kind: "payment",
        billId: bill.id,
        paymentId: payment.id,
        system: ACCOUNTING_SYSTEM,
        supplierName: payeeName(bill),
        invoiceNumber: bill.sadad?.billNumber ?? bill.invoiceNumber,
        vat: bill.vat,
        total: payment.amount,
        attachmentName: bill.file?.name,
        status: "synced",
        createdAt: now.toISOString(),
        lines: [
          { account: "Accounts payable", debit: payment.amount, credit: 0 },
          { account: accountLabel(store, payment.fundingAccountId), debit: 0, credit: payment.amount },
        ],
      };
      store.accounting.push(entry);
      return entry;
    },

    markPayablePaid(store, billId) {
      const payable = store.accounting.find((e) => e.kind === "payable" && e.billId === billId);
      if (payable) payable.status = "paid";
      return payable;
    },
  };
}
