import { saudiBankFromIban } from "@/lib/domain/iban";
import type { AuditEvent } from "@/lib/domain/types";
import { toAuditRows, type AuditRow } from "@/lib/ui/audit";
import { readStore } from "../../store";

import { ACTIVITY_FILTERS, type ActivityFilter } from "./filters";

export { ACTIVITY_FILTERS, parseActivityFilter, type ActivityFilter } from "./filters";

/** Saudi bank codes known to lib/domain/iban.ts, for translating bank names in the log. */
const BANK_CODES = ["05", "10", "15", "20", "30", "45", "55", "60", "65", "80"];

export interface ActivityView {
  filter: ActivityFilter;
  rows: AuditRow[];
  counts: Record<ActivityFilter, number>;
  /** Ids (users, suppliers, accounts, bills, payments, company) and bank names → display names, EN and AR. */
  names: Record<string, { name: string; nameAr: string }>;
}

/** The full audit trail (PRD 3: who, when, before and after), newest first. */
export async function loadActivityView(filter: ActivityFilter): Promise<ActivityView> {
  const store = await readStore();
  // Newest first; events in the same instant keep their recorded order (ids are sequential: ev_9 < ev_12).
  const order = new Map(store.audit.map((e, i) => [e.id, i]));
  const all = [...store.audit].sort((a, b) => b.at.localeCompare(a.at) || (order.get(b.id) ?? 0) - (order.get(a.id) ?? 0));
  const counts = Object.fromEntries(
    ACTIVITY_FILTERS.map((f) => [f, f === "all" ? all.length : all.filter((e) => e.entity.type === f).length]),
  ) as Record<ActivityFilter, number>;
  const events: AuditEvent[] = filter === "all" ? all : all.filter((e) => e.entity.type === filter);
  const names: ActivityView["names"] = {};
  const put = (id: string | undefined, name: string, nameAr?: string) => {
    if (id) names[id] = { name, nameAr: nameAr || name };
  };
  for (const u of store.users) put(u.id, u.name, u.nameAr);
  for (const sup of store.suppliers) put(sup.id, sup.nameEn, sup.nameAr);
  for (const a of store.accounts) put(a.id, a.name, a.nameAr);
  for (const b of store.bills) put(b.id, b.sadad?.billNumber ?? b.invoiceNumber);
  for (const p of store.payments) put(p.id, p.transferRef ?? p.id);
  put(store.company.id, store.company.name, store.company.nameAr);
  for (const code of BANK_CODES) {
    const bank = saudiBankFromIban(`SA00${code}`);
    if (bank) put(bank.name, bank.name, bank.nameAr);
  }
  return { filter, rows: toAuditRows(store, events), counts, names };
}
