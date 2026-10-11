// Server-side view models for payment runs (desktop /bills/runs and the mobile approval view /m).
// The only data access is readStore() (app/(app)/store.ts, the shared swap point).
import { supplierPaymentGate } from "@/lib/domain/permissions";
import { riyadhDate } from "@/lib/domain/time";
import type {
  AccountingEntry,
  Bill,
  FundingAccount,
  Halalas,
  ISODate,
  ISODateTime,
  Limits,
  Payment,
  PaymentRun,
  RailQuote,
  StoreData,
  Supplier,
  SupplierNotice,
} from "@/lib/domain/types";
import {
  paidSupplierIds,
  previewQuote,
  quoteFromPayment,
  type ApprovalContext,
} from "@/components/darb/payment-rules";
import { makeCtx } from "@/lib/server/context";
import { billsSummary } from "@/lib/server/services";
import { readStore } from "../../store";

async function loadStore(): Promise<StoreData> {
  return readStore();
}

export interface Person {
  name: string;
  nameAr: string;
}

const PENDING: ReadonlySet<Payment["status"]> = new Set(["scheduled", "held"]);
const COUNTS_FOR_LIMIT: ReadonlySet<Payment["status"]> = new Set(["scheduled", "held", "sent", "settled"]);

function peopleOf(store: StoreData): Record<string, Person> {
  return Object.fromEntries(store.users.map((u) => [u.id, { name: u.name, nameAr: u.nameAr }]));
}

function approvalContext(store: StoreData, bills: Bill[]): ApprovalContext {
  return {
    users: store.users,
    bills,
    suppliers: store.suppliers,
    paidSupplierIds: paidSupplierIds(store.payments, store.suppliers),
    makerChecker: store.company.makerChecker,
  };
}

const runBills = (store: StoreData, run: PaymentRun) =>
  run.billIds.map((id) => store.bills.find((b) => b.id === id)).filter((b): b is Bill => !!b);

const activeTotal = (bills: Bill[]) => bills.filter((b) => b.status !== "cancelled").reduce((sum, b) => sum + b.total, 0);

/** Scheduled (not yet sent) payments per funding account (BP-18 "scheduled vs available"). */
function scheduledByAccount(payments: Payment[]): Record<string, Halalas> {
  const out: Record<string, Halalas> = {};
  for (const p of payments) if (PENDING.has(p.status)) out[p.fundingAccountId] = (out[p.fundingAccountId] ?? 0) + p.amount;
  return out;
}

// ---------- /bills/runs ----------

export interface RunRow {
  id: string;
  name: string;
  payDate: ISODate;
  billCount: number;
  total: Halalas;
  status: PaymentRun["status"];
  createdBy?: Person;
  createdAt: ISODateTime;
}

export async function loadRunsList(): Promise<{ rows: RunRow[] }> {
  const store = await loadStore();
  const people = peopleOf(store);
  const rows = store.runs
    .map((run) => {
      const bills = runBills(store, run);
      return {
        id: run.id,
        name: run.name,
        payDate: run.payDate,
        billCount: bills.filter((b) => b.status !== "cancelled").length,
        total: activeTotal(bills),
        status: run.status,
        createdBy: people[run.createdBy],
        createdAt: run.createdAt,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { rows };
}

// ---------- /bills/runs/new ----------

export type NotReadyReason = "needs_supplier" | "needs_review" | "duplicate" | "in_run";

export interface CandidateBill {
  bill: Bill;
  supplier?: Supplier;
  /** Supplier gate (BP-06/07): set when payments to this supplier are paused; the bill can't be added. */
  gate?: { code: string; message: string };
}

export interface NewRunView {
  now: ISODateTime;
  today: ISODate;
  candidates: CandidateBill[];
  notReady: { bill: Bill; reason: NotReadyReason }[];
  accounts: FundingAccount[];
  scheduledByAccount: Record<string, Halalas>;
  /** Payments already counted against the daily limit, by pay date (BUILD-NOTES 12). */
  committedByDate: Record<ISODate, Halalas>;
  limits: Limits;
  preselected: string[];
}

function notReadyReason(bill: Bill): NotReadyReason | null {
  if (bill.runId) return "in_run";
  if (bill.duplicateOf) return "duplicate";
  if (bill.kind === "supplier" && !bill.supplierId) return "needs_supplier";
  if (bill.needsReview.length > 0) return "needs_review";
  return null;
}

/** Draft bills ready for a run: supplier linked (or SADAD), not a duplicate, nothing left to review, not in a run. */
export async function loadNewRunView(preselect: string[]): Promise<NewRunView> {
  const store = await loadStore();
  const now = store.clock.now;
  const drafts = store.bills.filter((b) => b.status === "draft");
  const candidates: CandidateBill[] = [];
  const notReady: NewRunView["notReady"] = [];
  for (const bill of drafts) {
    const reason = notReadyReason(bill);
    if (reason) {
      notReady.push({ bill, reason });
      continue;
    }
    const supplier = bill.supplierId ? store.suppliers.find((s) => s.id === bill.supplierId) : undefined;
    const gate = supplier ? supplierPaymentGate(supplier) : undefined;
    candidates.push({ bill, supplier, gate: gate && !gate.ok ? { code: gate.code, message: gate.message } : undefined });
  }
  candidates.sort((a, b) => (a.bill.dueDate ?? "9999").localeCompare(b.bill.dueDate ?? "9999"));

  const payDateOf = new Map(store.bills.map((b) => [b.id, b.payDate]));
  const committedByDate: Record<ISODate, Halalas> = {};
  for (const p of store.payments) {
    if (!COUNTS_FOR_LIMIT.has(p.status)) continue;
    const day = payDateOf.get(p.billId) ?? riyadhDate(p.scheduledFor);
    committedByDate[day] = (committedByDate[day] ?? 0) + p.amount;
  }

  const allowed = new Set(candidates.filter((c) => !c.gate).map((c) => c.bill.id));
  return {
    now,
    today: riyadhDate(now),
    candidates,
    notReady,
    accounts: store.accounts,
    scheduledByAccount: scheduledByAccount(store.payments),
    committedByDate,
    limits: store.company.limits,
    preselected: preselect.filter((id) => allowed.has(id)),
  };
}

// ---------- /bills/runs/{id} and /m/runs/{id} ----------

export interface RunBillItem {
  bill: Bill;
  supplier?: Supplier;
  payment?: Payment;
  /** From lib/domain/rails.ts: a preview at the demo clock before approval, the stored payment after. */
  quote: RailQuote;
  notice?: SupplierNotice;
  accounting: AccountingEntry[];
  /** No payment has left for this supplier's current IBAN yet (BP-06). */
  firstPayment: boolean;
  supplierAddedBy?: Person;
}

export interface RunDetailView {
  now: ISODateTime;
  today: ISODate;
  run: PaymentRun;
  items: RunBillItem[];
  total: Halalas;
  accounts: FundingAccount[];
  people: Record<string, Person>;
  approval: ApprovalContext;
}

function billItem(store: StoreData, bill: Bill, payDate: ISODate, approvedAt: ISODateTime | undefined, paid: string[]): RunBillItem {
  const people = peopleOf(store);
  const supplier = bill.supplierId ? store.suppliers.find((s) => s.id === bill.supplierId) : undefined;
  const payment =
    (bill.paymentId ? store.payments.find((p) => p.id === bill.paymentId) : undefined) ??
    [...store.payments].reverse().find((p) => p.billId === bill.id);
  const quote = payment
    ? quoteFromPayment(payment, bill, payDate, approvedAt ?? bill.approvals.at(-1)?.at)
    : previewQuote(bill, payDate, store.clock.now);
  return {
    bill,
    supplier,
    payment,
    quote,
    notice: payment ? store.notices.find((n) => n.paymentId === payment.id) : undefined,
    accounting: store.accounting.filter((e) => e.billId === bill.id),
    firstPayment: bill.kind === "supplier" && !!supplier && !paid.includes(supplier.id),
    supplierAddedBy: supplier ? people[supplier.createdBy] : undefined,
  };
}

export async function loadRunDetail(id: string): Promise<RunDetailView | null> {
  const store = await loadStore();
  const run = store.runs.find((r) => r.id === id);
  if (!run) return null;
  const bills = runBills(store, run);
  const paid = paidSupplierIds(store.payments, store.suppliers);
  const approvedAt = run.approvals.at(-1)?.at;
  return {
    now: store.clock.now,
    today: riyadhDate(store.clock.now),
    run,
    items: bills.map((bill) => billItem(store, bill, run.payDate, approvedAt, paid)),
    total: activeTotal(bills),
    accounts: store.accounts,
    people: peopleOf(store),
    approval: approvalContext(store, bills),
  };
}

// ---------- /m/bills/{id} (single-bill approval, e.g. SADAD) ----------

export interface BillApprovalView {
  now: ISODateTime;
  today: ISODate;
  item: RunBillItem;
  payDate: ISODate;
  run?: Pick<PaymentRun, "id" | "name">;
  accounts: FundingAccount[];
  people: Record<string, Person>;
  approval: ApprovalContext;
}

export async function loadBillApproval(id: string): Promise<BillApprovalView | null> {
  const store = await loadStore();
  const bill = store.bills.find((b) => b.id === id);
  if (!bill) return null;
  const today = riyadhDate(store.clock.now);
  const run = bill.runId ? store.runs.find((r) => r.id === bill.runId) : undefined;
  const payDate = run?.payDate ?? (bill.payDate && bill.payDate > today ? bill.payDate : today);
  const paid = paidSupplierIds(store.payments, store.suppliers);
  return {
    now: store.clock.now,
    today,
    item: billItem(store, bill, payDate, undefined, paid),
    payDate,
    run: run ? { id: run.id, name: run.name } : undefined,
    accounts: store.accounts,
    people: peopleOf(store),
    approval: approvalContext(store, [bill]),
  };
}

// ---------- /m (My actions) ----------

export interface MobileHomeView {
  now: ISODateTime;
  today: ISODate;
  /** Main balance (BP-18), plus what is waiting for approval across accounts (bills and runs). */
  balances: { main: Halalas; scheduled: Halalas; available: Halalas; pendingApproval: Halalas };
  runs: { run: PaymentRun; total: Halalas; billCount: number; submittedBy?: Person }[];
  bills: { bill: Bill; submittedBy?: Person }[];
  people: Record<string, Person>;
  approval: ApprovalContext;
}

export async function loadMobileHome(): Promise<MobileHomeView> {
  const store = await loadStore();
  const people = peopleOf(store);
  const summary = billsSummary(makeCtx(store));
  const main = summary.accounts.find((a) => a.kind === "main");
  const awaitingRuns = store.runs.filter((r) => r.status === "awaiting_approval");
  const runBillList = awaitingRuns.flatMap((r) => runBills(store, r));
  const standalone = store.bills.filter((b) => b.status === "awaiting_approval" && !b.runId);
  return {
    now: store.clock.now,
    today: riyadhDate(store.clock.now),
    balances: {
      main: main?.balance ?? 0,
      scheduled: main?.scheduled ?? 0,
      available: main?.available ?? 0,
      pendingApproval: summary.totals.pendingApproval,
    },
    runs: awaitingRuns.map((run) => {
      const bills = runBills(store, run);
      return {
        run,
        total: activeTotal(bills),
        billCount: bills.filter((b) => b.status !== "cancelled").length,
        submittedBy: run.submittedBy ? people[run.submittedBy] : undefined,
      };
    }),
    bills: standalone.map((bill) => ({ bill, submittedBy: bill.submittedBy ? people[bill.submittedBy] : undefined })),
    people,
    approval: approvalContext(store, [...runBillList, ...standalone]),
  };
}

// ---------- /m layout ----------

export async function loadMobileShell() {
  const store = await loadStore();
  return {
    users: store.users.map(({ id, name, nameAr, title, titleAr, role }) => ({ id, name, nameAr, title, titleAr, role })),
    actingUserId: store.session.userId,
  };
}
