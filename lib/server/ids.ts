// Deterministic ids: "<prefix>_<n>", one more than the highest n already used with that prefix.
import type { StoreData } from "@/lib/domain/types";

const COLLECTIONS = ["bills", "suppliers", "runs", "payments", "notices", "accounting", "alerts", "audit", "emails", "files"] as const;

export function newId(store: StoreData, prefix: string): string {
  const re = new RegExp(`^${prefix}_(\\d+)$`);
  let max = 0;
  for (const key of COLLECTIONS) {
    for (const item of store[key] as { id: string }[]) {
      const m = re.exec(item.id);
      if (m) max = Math.max(max, Number(m[1]));
    }
  }
  for (const s of store.suppliers) {
    for (const c of [...s.bankChanges, ...(s.pendingBankChange ? [s.pendingBankChange] : [])]) {
      const m = re.exec(c.id);
      if (m) max = Math.max(max, Number(m[1]));
    }
  }
  return `${prefix}_${max + 1}`;
}
