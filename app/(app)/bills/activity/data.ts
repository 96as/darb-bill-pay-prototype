import type { AuditEvent } from "@/lib/domain/types";
import { toAuditRows, type AuditRow } from "@/lib/ui/audit";
import { readStore } from "../../store";

import { ACTIVITY_FILTERS, type ActivityFilter } from "./filters";

export { ACTIVITY_FILTERS, parseActivityFilter, type ActivityFilter } from "./filters";

export interface ActivityView {
  filter: ActivityFilter;
  rows: AuditRow[];
  counts: Record<ActivityFilter, number>;
  /** User ids → names, to show "requestedBy u_noura" as a name. */
  people: Record<string, { name: string; nameAr: string }>;
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
  const people = Object.fromEntries(store.users.map((u) => [u.id, { name: u.name, nameAr: u.nameAr }]));
  return { filter, rows: toAuditRows(store, events), counts, people };
}
