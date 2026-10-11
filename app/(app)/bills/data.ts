import type { Bill, DisplayStatus, Halalas, ISODate, StoreData } from "@/lib/domain/types";
import { riyadhDate } from "@/lib/ui/format";
import { isDisplayStatus, toDisplayStatus } from "@/lib/ui/status";
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
  kind: Bill["kind"];
  name: string;
  nameAr?: string;
  invoiceNumber: string;
  dueDate?: ISODate;
  total: Halalas;
  submittedBy?: { name: string; nameAr: string };
  /** Users who created, edited or submitted it; they cannot approve alone (maker-checker). */
  makers: string[];
}

export interface BillsView {
  now: string;
  today: ISODate;
  balances: {
    main: Halalas;
    subwallets: Halalas;
    scheduled: Halalas;
    scheduledCount: number;
    /** Main balance minus scheduled payments from it (BP-18). */
    available: Halalas;
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

const isOpen = (status: DisplayStatus) => status !== "paid" && status !== "cancelled";

export async function loadBillsView(filters: BillsFilters = {}): Promise<BillsView> {
  const store: StoreData = await readStore();
  const today = riyadhDate(store.clock.now);

  const main = store.accounts.find((a) => a.kind === "main")?.balance ?? 0;
  const subwallets = store.accounts.filter((a) => a.kind === "subwallet").reduce((sum, a) => sum + a.balance, 0);
  const pending = store.payments.filter(
    (p) => (p.status === "scheduled" || p.status === "held") && p.fundingAccountId === "main",
  );
  const scheduled = pending.reduce((sum, p) => sum + p.amount, 0);

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
    dueDate: bill.dueDate,
    total: bill.total,
    displayStatus: toDisplayStatus(bill, today),
  }));

  const rows = allRows
    .filter((row) => !filters.status || row.displayStatus === filters.status)
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
  const approvals: ApprovalItem[] = store.bills
    .filter((bill) => bill.status === "awaiting_approval" && !bill.runId)
    .map((bill) => {
      const submitter = bill.submittedBy ? userById.get(bill.submittedBy) : undefined;
      return {
        id: bill.id,
        kind: bill.kind,
        name: bill.sadad?.billerName ?? bill.supplierName,
        nameAr: bill.sadad?.billerNameAr ?? bill.supplierNameAr,
        invoiceNumber: bill.sadad?.billNumber ?? bill.invoiceNumber,
        dueDate: bill.dueDate,
        total: bill.total,
        submittedBy: submitter ? { name: submitter.name, nameAr: submitter.nameAr } : undefined,
        makers: unique([bill.createdBy, ...bill.editedBy, bill.submittedBy].filter((id): id is string => !!id)),
      };
    });

  return {
    now: store.clock.now,
    today,
    balances: { main, subwallets, scheduled, scheduledCount: pending.length, available: main - scheduled },
    filters,
    rows,
    totalCount: allRows.length,
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

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
