// TEMPORARY: derive the status shown in the UI. Swap for the domain helper
// (lib/domain statuses) when it lands. Rule from BUILD-NOTES decision 10:
// a bill that is not paid or cancelled and whose due date is before today (Riyadh) shows Overdue.
import type { Bill, DisplayStatus, ISODate } from "@/lib/domain/types";

export function toDisplayStatus(bill: Pick<Bill, "status" | "dueDate">, today: ISODate): DisplayStatus {
  if (bill.status === "paid" || bill.status === "cancelled") return bill.status;
  if (bill.dueDate && bill.dueDate < today) return "overdue";
  return bill.status;
}

export const DISPLAY_STATUSES: DisplayStatus[] = [
  "draft",
  "awaiting_approval",
  "scheduled",
  "overdue",
  "paid",
  "failed",
  "cancelled",
];

export function isDisplayStatus(value: unknown): value is DisplayStatus {
  return typeof value === "string" && (DISPLAY_STATUSES as string[]).includes(value);
}
