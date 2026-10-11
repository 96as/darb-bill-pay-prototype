"use client";

import type { DisplayStatus } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** Token colours per status (see "Look and feel": Paid = success, Awaiting = warning, Failed/Overdue = error, Scheduled = information, Draft/Cancelled = muted). */
const STATUS_STYLES: Record<DisplayStatus, string> = {
  paid: "bg-success-surface text-success",
  awaiting_approval: "bg-warning text-warning-foreground",
  failed: "bg-error text-error-foreground",
  overdue: "bg-error text-error-foreground",
  scheduled: "bg-information text-information-foreground",
  draft: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status, className }: { status: DisplayStatus; className?: string }) {
  const t = useT();
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        STATUS_STYLES[status],
        className,
      )}
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
      {t.status[status]}
    </span>
  );
}
