import { canApproveRun } from "@/lib/domain/permissions";
import type { Bill, DisplayStatus, Halalas, ISODate, StoreData } from "@/lib/domain/types";
import { riyadhDate } from "@/lib/ui/format";
import { isDisplayStatus, displayStatus as toDisplayStatus } from "@/lib/ui/status";
import { actingUser, billApprovalGate, supplierHasPaid, toGate, userName, type Gate } from "@/lib/ui/store-helpers";
import { makeCtx } from "@/lib/server/context";
import { billsSummary, listBills } from "@/lib/server/services";
import { readStore } from "../store";

// ---------- View model for /bills (serialisable: passed to client components) ----------

export interface BillsFilters {
  status?: DisplayStatus;
  /** Due date strictly before this day (PRD: GET /bills?due_before=). */
  dueBefore?: ISODate;
}

export interface BillRow {
  id: string;
  kind: Bill["kind"];
  supplierName: string;
  supplierNameAr?: string;
  invoiceNumber: string;
  billerCode?: string;
  source: Bill["source"];
  extraction: Bill["extraction"];
  needsReviewCount: number;
  /** Flagged as a possible duplicate (BP-04) and not resolved yet. */
  duplicate: boolean;
  dueDate?: ISODate;
  total: Halalas;
  displayStatus: DisplayStatus;
}

export interface OwedSupplier {
  key: string;
  kind: Bill["kind"];
  name: string;
  nameAr?: string;
  total: Halalas;
  billCount: number;
  overdueCount: number;
  nextDue?: ISODate;
}

export interface ApprovalItem {
  id: string;
  /** A single bill, or a payment run (approved on the runs screen). */
  type: "bill" | "run";
  kind: Bill["kind"];
  href: string;
  supplierId?: string;
  name: string;
  nameAr?: string;
  /** Invoice / SADAD bill number for bills; run name for runs. */
  reference: string;
  dueDate?: ISODate;
  payDate?: ISODate;
  billCount?: number;
  total: Halalas;
  submittedBy?: { name: string; nameAr: string };
  /** Whether the acting user may approve (lib/domain/permissions); the API re-checks. */
  gate: Gate;
  /** Arrival if approved now (service quote via lib/domain/rails), for "Confirm and release". */
  arrivalDate?: ISODate;
  /** The supplier's IBAN changed recently (approved): shown as a warning before release. */
  bankChange?: { changedAt: string; requester?: { name: string; nameAr: string }; approver?: { name: string; nameAr: string } };
}

export interface BillsView {
  now: string;
  today: ISODate;
  balances: {
    main: Halalas;
    /** Scheduled (and held) payments from every account. */
    scheduled: Halalas;
    scheduledCount: number;
    /** Main balance minus scheduled payments from it (BP-18). */
    available: Halalas;
    subwallets: { id: string; name: string; nameAr: string; balance: Halalas; available: Halalas }[];
  };
  filters: BillsFilters;
  /** Bills after filters, sorted for the table. */
  rows: BillRow[];
  /** All bills, before filters. */
  totalCount: number;
  owed: { total: Halalas; billCount: number; overdueCount: number; suppliers: OwedSupplier[] };
  approvals: ApprovalItem[];
}

// ---------- Filters from the URL (?status=&due_before=, as in the PRD API sketch) ----------

export function parseBillsFilters(params: Record<string, string | string[] | undefined>): BillsFilters {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const status = first(params.status);
  const dueBefore = first(params.due_before);
  return {
    status: isDisplayStatus(status) ? status : undefined,
    dueBefore: dueBefore && /^\d{4}-\d{2}-\d{2}$/.test(dueBefore) ? dueBefore : undefined,
  };
}

// ---------- Loader (the page's only data access) ----------

const isOpen = (status: DisplayStatus) => status !== "paid" && status !== "cancelled" && status !== "discarded";

export async function loadBillsView(filters: BillsFilters = {}): Promise<BillsView> {
  const store: StoreData = await readStore();
  const today = riyadhDate(store.clock.now);

  // BP-18 balances come from the service layer (same numbers as GET /api/summary).
  const ctx = makeCtx(store);
  const summary = billsSummary(ctx);
  const serviceRows = new Map(listBills(ctx, { status: undefined }).map((r) => [r.bill.id, r]));
  const mainAccount = summary.accounts.find((a) => a.kind === "main");
  const scheduledCount = store.payments.filter((p) => p.status === "scheduled" || p.status === "held").length;

  const allRows: BillRow[] = store.bills.map((bill) => ({
    id: bill.id,
    kind: bill.kind,
    supplierName: bill.sadad?.billerName ?? bill.supplierName,
    supplierNameAr: bill.sadad?.billerNameAr ?? bill.supplierNameAr,
    invoiceNumber: bill.sadad?.billNumber ?? bill.invoiceNumber,
    billerCode: bill.sadad?.billerCode,
    source: bill.source,
    extraction: bill.extraction,
    needsReviewCount: bill.needsReview.length,
    duplicate: Boolean(bill.duplicateOf) && bill.status !== "cancelled" && bill.status !== "discarded",
    dueDate: bill.dueDate,
    total: bill.total,
    displayStatus: toDisplayStatus(bill, today),
  }));

  // Discarded duplicates are hidden unless asked for (?status=discarded), like GET /api/bills.
  const rows = allRows
    .filter((row) => (filters.status ? row.displayStatus === filters.status : row.displayStatus !== "discarded"))
    .filter((row) => !filters.dueBefore || (row.dueDate !== undefined && row.dueDate < filters.dueBefore))
    .sort(compareRows);

  // Owed per supplier (BP-11): open bills grouped by saved supplier, else VAT number, else SADAD biller.
  const groups = new Map<string, OwedSupplier>();
  for (const bill of store.bills) {
    const status = toDisplayStatus(bill, today);
    if (!isOpen(status)) continue;
    const supplier = bill.supplierId ? store.suppliers.find((s) => s.id === bill.supplierId) : undefined;
    const key = bill.supplierId
      ?? (bill.sadad ? `sadad:${bill.sadad.billerCode}` : bill.supplierVat ? `vat:${bill.supplierVat}` : `name:${bill.supplierName}`);
    const group = groups.get(key) ?? {
      key,
      kind: bill.kind,
      name: supplier?.nameEn ?? bill.sadad?.billerName ?? bill.supplierName,
      nameAr: supplier?.nameAr ?? bill.sadad?.billerNameAr ?? bill.supplierNameAr,
      total: 0,
      billCount: 0,
      overdueCount: 0,
    };
    group.total += bill.total;
    group.billCount += 1;
    if (status === "overdue") group.overdueCount += 1;
    if (bill.dueDate && (!group.nextDue || bill.dueDate < group.nextDue)) group.nextDue = bill.dueDate;
    groups.set(key, group);
  }
  const suppliers = [...groups.values()].sort((a, b) => b.total - a.total);

  const userById = new Map(store.users.map((u) => [u.id, u]));
  const submitterOf = (id?: string) => {
    const u = id ? userById.get(id) : undefined;
    return u ? { name: u.name, nameAr: u.nameAr } : undefined;
  };
  const billApprovals: ApprovalItem[] = store.bills
    .filter((bill) => bill.status === "awaiting_approval" && !bill.runId)
    .map((bill) => ({
      id: bill.id,
      type: "bill",
      kind: bill.kind,
      href: `/bills/${bill.id}`,
      supplierId: bill.supplierId,
      name: bill.sadad?.billerName ?? bill.supplierName,
      nameAr: bill.sadad?.billerNameAr ?? bill.supplierNameAr,
      reference: bill.sadad?.billNumber ?? bill.invoiceNumber,
      dueDate: bill.dueDate,
      payDate: bill.payDate,
      total: bill.total,
      submittedBy: submitterOf(bill.submittedBy),
      gate: billApprovalGate(store, bill),
      arrivalDate: serviceRows.get(bill.id)?.quote?.arrivalDate,
      bankChange: (() => {
        const change = serviceRows.get(bill.id)?.bankChange;
        return change
          ? { changedAt: change.changedAt, requester: userName(store, change.requestedBy), approver: userName(store, change.approvedBy) }
          : undefined;
      })(),
    }));
  const suppliersById = new Map(store.suppliers.map((s) => [s.id, s]));
  const paidSupplierIds = store.suppliers.filter((s) => supplierHasPaid(store, s)).map((s) => s.id);
  const runApprovals: ApprovalItem[] = store.runs
    .filter((run) => run.status === "awaiting_approval")
    .map((run) => {
      const bills = store.bills.filter((b) => run.billIds.includes(b.id) && b.status !== "cancelled");
      return {
        id: run.id,
        type: "run",
        kind: "supplier",
        href: `/bills/runs/${run.id}`,
        name: run.name,
        reference: run.name,
        payDate: run.payDate,
        billCount: bills.length,
        total: bills.reduce((sum, b) => sum + b.total, 0),
        submittedBy: submitterOf(run.submittedBy),
        gate: toGate(
          canApproveRun(actingUser(store), run, store.bills, suppliersById, paidSupplierIds, {
            makerChecker: store.company.makerChecker,
          }),
        ),
      };
    });
  const approvals = [...runApprovals, ...billApprovals];

  return {
    now: store.clock.now,
    today,
    balances: {
      main: mainAccount?.balance ?? 0,
      scheduled: summary.totals.scheduled,
      scheduledCount,
      available: mainAccount?.available ?? 0,
      subwallets: summary.accounts
        .filter((a) => a.kind === "subwallet")
        .map((a) => ({ id: a.id, name: a.name, nameAr: a.nameAr, balance: a.balance, available: a.available })),
    },
    filters,
    rows,
    totalCount: allRows.filter((r) => r.displayStatus !== "discarded").length,
    owed: {
      total: suppliers.reduce((sum, s) => sum + s.total, 0),
      billCount: suppliers.reduce((sum, s) => sum + s.billCount, 0),
      overdueCount: suppliers.reduce((sum, s) => sum + s.overdueCount, 0),
      suppliers,
    },
    approvals,
  };
}

/** Open bills first (soonest due first, no due date last), then paid/cancelled (latest first). */
function compareRows(a: BillRow, b: BillRow): number {
  const aOpen = isOpen(a.displayStatus);
  const bOpen = isOpen(b.displayStatus);
  if (aOpen !== bOpen) return aOpen ? -1 : 1;
  const ad = a.dueDate ?? "9999-12-31";
  const bd = b.dueDate ?? "9999-12-31";
  return aOpen ? ad.localeCompare(bd) : bd.localeCompare(ad);
}

