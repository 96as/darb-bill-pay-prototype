"use client";

import { useId } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Halalas } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Amount } from "./amount";
import { GateReason, type GateLike, type Unblock } from "./gated-button";

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
  pending,
  note,
  actions,
  href,
  gate,
  unblock,
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
  /** A request is in flight: both buttons are disabled. */
  pending?: boolean;
  /** Why it is disabled. */
  note?: React.ReactNode;
  /** Replaces the Approve/Decline pair (e.g. "Review run" for payment runs). */
  actions?: React.ReactNode;
  /** Makes the title a link (e.g. to the bill). */
  href?: string;
  /** Permission gate for Approve/Decline: when denied, both are disabled and the reason + unblock action show under them. */
  gate?: GateLike;
  unblock?: Unblock;
  className?: string;
}) {
  const t = useT();
  const reasonId = useId();
  const blocked = Boolean(disabled) || (gate ? !gate.ok : false);
  const describedBy = gate && !gate.ok ? reasonId : undefined;
  return (
    <article className={cn("flex flex-col gap-3 rounded-xl border bg-card p-4", className)}>
      <div className="flex items-start gap-3">
        {avatar}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium">
            {href ? (
              <Link href={href} className="hover:text-primary hover:underline hover:underline-offset-4">
                {title}
              </Link>
            ) : (
              title
            )}
          </h3>
          {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Amount value={amount} className="text-lg font-medium" currencyClassName="text-sm font-normal text-muted-foreground" />
        {meta}
      </div>
      {actions ?? (
        <div className="grid grid-cols-2 gap-2">
          <Button size="lg" onClick={onApprove} disabled={blocked || pending} aria-describedby={describedBy}>
            {t.bills.approvals.approve}
          </Button>
          <Button size="lg" variant="outline" onClick={onDecline} disabled={blocked || pending} aria-describedby={describedBy}>
            {t.bills.approvals.decline}
          </Button>
        </div>
      )}
      {gate && !gate.ok ? <GateReason id={reasonId} gate={gate} unblock={unblock} /> : null}
      {disabled && note && !(gate && !gate.ok) ? (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>{note}</span>
        </p>
      ) : null}
    </article>
  );
}
