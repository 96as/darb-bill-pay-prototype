// Turning audit events into readable rows (activity log, bill timeline).
import type { AuditEvent, StoreData } from "@/lib/domain/types";
import type { Dict } from "@/lib/i18n";

export interface AuditRow {
  id: string;
  at: string;
  actorId: string;
  actor: { name: string; nameAr: string };
  action: string;
  entity: AuditEvent["entity"];
  /** Where the entity lives in the app, if it has a page. */
  href?: string;
  /** Short label for the entity, e.g. the invoice number or supplier name. */
  entityLabel?: string;
  changes: AuditChange[];
}

export interface AuditChange {
  key: string;
  before?: string;
  after?: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function show(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

/** Keys whose value differs between before and after (top level only). */
export function diffChanges(before: unknown, after: unknown): AuditChange[] {
  if (!isRecord(before) && !isRecord(after)) {
    const b = show(before);
    const a = show(after);
    return b === a ? [] : [{ key: "value", before: b, after: a }];
  }
  const b = isRecord(before) ? before : {};
  const a = isRecord(after) ? after : {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  return keys
    .map((key) => ({ key, before: show(b[key]), after: show(a[key]) }))
    .filter((c) => c.before !== c.after);
}

function entityInfo(store: StoreData, entity: AuditEvent["entity"]): { href?: string; label?: string } {
  switch (entity.type) {
    case "bill": {
      const bill = store.bills.find((b) => b.id === entity.id);
      return { href: `/bills/${entity.id}`, label: bill ? bill.sadad?.billNumber ?? bill.invoiceNumber : entity.id };
    }
    case "supplier": {
      const s = store.suppliers.find((x) => x.id === entity.id);
      return { href: `/bills/suppliers/${entity.id}`, label: s?.nameEn ?? entity.id };
    }
    case "run": {
      const run = store.runs.find((r) => r.id === entity.id);
      return { href: `/bills/runs/${entity.id}`, label: run?.name ?? entity.id };
    }
    case "payment": {
      const p = store.payments.find((x) => x.id === entity.id);
      const bill = p ? store.bills.find((b) => b.id === p.billId) : undefined;
      return { href: p ? `/bills/${p.billId}` : undefined, label: p?.transferRef ?? bill?.invoiceNumber ?? entity.id };
    }
    case "email": {
      const e = store.emails.find((x) => x.id === entity.id);
      return { href: "/bills/inbox", label: e?.subject ?? entity.id };
    }
    default:
      return {};
  }
}

export function toAuditRows(store: StoreData, events: readonly AuditEvent[]): AuditRow[] {
  return events.map((e) => {
    const user = store.users.find((u) => u.id === e.actorId);
    const actor =
      e.actorId === "system" ? { name: "System", nameAr: "النظام" } : user ? { name: user.name, nameAr: user.nameAr } : { name: e.actorId, nameAr: e.actorId };
    const info = entityInfo(store, e.entity);
    return {
      id: e.id,
      at: e.at,
      actorId: e.actorId,
      actor,
      action: e.action,
      entity: e.entity,
      href: info.href,
      entityLabel: info.label,
      changes: diffChanges(e.before, e.after),
    };
  });
}

/** "bill.duplicate_flagged" → dictionary label, else "Bill duplicate flagged". */
export function actionLabel(t: Dict, action: string): string {
  const known = t.activity.actions[action];
  if (known) return known;
  const [entity, verb = ""] = action.split(".");
  const words = `${entity} ${verb.replace(/_/g, " ")}`.trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
