"use client";

import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Halalas } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Amount } from "./amount";

/**
 * Darb "Need review" card: title, muted subtitle, amount, then Approve (primary) and
 * Decline (outline) side by side. Used in the Bills page "Needs your approval" panel
 * and, later, the mobile approval view.
 */
export function ApprovalCard({
  avatar,
  title,
  subtitle,
  amount,
  meta,
  onApprove,
  onDecline,
  disabled,
  note,
  className,
}: {
  avatar?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  amount: Halalas;
  /** Extra line under the amount, e.g. a status badge or due date. */
  meta?: React.ReactNode;
  onApprove?: () => void;
  onDecline?: () => void;
  /** The acting user cannot approve (prepare-only role or maker-checker). */
  disabled?: boolean;
  /** Why it is disabled. */
  note?: React.ReactNode;
  className?: string;
}) {
  const t = useT();
  return (
    <article className={cn("flex flex-col gap-3 rounded-xl border bg-card p-4", className)}>
      <div className="flex items-start gap-3">
        {avatar}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium">{title}</h3>
          {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Amount value={amount} className="text-lg font-medium" currencyClassName="text-sm font-normal text-muted-foreground" />
        {meta}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button size="lg" onClick={onApprove} disabled={disabled}>
          {t.bills.approvals.approve}
        </Button>
        <Button size="lg" variant="outline" onClick={onDecline} disabled={disabled}>
          {t.bills.approvals.decline}
        </Button>
      </div>
      {disabled && note ? (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>{note}</span>
        </p>
      ) : null}
    </article>
  );
}
