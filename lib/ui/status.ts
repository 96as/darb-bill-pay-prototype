// Display status comes from the domain rule (lib/domain/status.ts, BUILD-NOTES 10).
import { displayStatus } from "@/lib/domain/status";
import type { DisplayStatus } from "@/lib/domain/types";

/** @deprecated name kept for existing imports; same as lib/domain displayStatus. */
export const toDisplayStatus = displayStatus;
export { displayStatus };

export const DISPLAY_STATUSES: DisplayStatus[] = [
  "draft",
  "awaiting_approval",
  "scheduled",
  "overdue",
  "paid",
  "failed",
  "cancelled",
  "discarded",
];

export function isDisplayStatus(value: unknown): value is DisplayStatus {
  return typeof value === "string" && (DISPLAY_STATUSES as string[]).includes(value);
}
