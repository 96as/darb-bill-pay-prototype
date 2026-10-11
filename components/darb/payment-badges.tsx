"use client";

import { Landmark, ReceiptText, Zap, type LucideIcon } from "lucide-react";
import type { Payment, PaymentStatus, Rail, RunStatus } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

// Same pill as StatusBadge (components/darb/status-badge.tsx), for run and payment statuses.
const pill = "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap";
const dot = <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />;

const RUN_STYLES: Record<RunStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  awaiting_approval: "bg-warning text-warning-foreground",
  approved: "bg-information text-information-foreground",
  completed: "bg-success-surface text-success",
  cancelled: "bg-muted text-muted-foreground",
};

export function RunStatusBadge({ status, className }: { status: RunStatus; className?: string }) {
  const t = useT();
  return (
    <span data-status={status} className={cn(pill, RUN_STYLES[status], className)}>
      {dot}
      {t.payments.runStatus[status]}
    </span>
  );
}

const PAYMENT_STYLES: Record<PaymentStatus, string> = {
  scheduled: "bg-information text-information-foreground",
  held: "bg-warning text-warning-foreground",
  sent: "bg-success-surface text-success",
  settled: "bg-success-surface text-success",
  failed: "bg-error text-error-foreground",
  returned: "bg-error text-error-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

/** Payment status; "Held" carries its reason (short balance, IBAN change, …) under the badge. */
export function PaymentStatusBadge({
  payment,
  className,
}: {
  payment?: Pick<Payment, "status" | "holdReason" | "failureReason">;
  className?: string;
}) {
  const t = useT();
  if (!payment) {
    return <span className={cn(pill, "bg-muted text-muted-foreground", className)}>{t.payments.paymentStatus.none}</span>;
  }
  const detail =
    payment.status === "held" && payment.holdReason
      ? t.payments.holdReasons[payment.holdReason]
      : (payment.status === "failed" || payment.status === "returned") && payment.failureReason
        ? payment.failureReason
        : null;
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span data-status={payment.status} className={cn(pill, PAYMENT_STYLES[payment.status], className)}>
        {dot}
        {t.payments.paymentStatus[payment.status]}
      </span>
      {detail ? <span className="max-w-48 text-xs whitespace-normal text-muted-foreground">{detail}</span> : null}
    </span>
  );
}

const RAIL_ICONS: Record<Rail, LucideIcon> = { instant: Zap, sarie: Landmark, sadad: ReceiptText };

/** Outlined chip naming the rail: "Instant payment (sarie)" / "SARIE" / "SADAD". */
export function RailChip({ rail, className }: { rail: Rail; className?: string }) {
  const t = useT();
  const Icon = RAIL_ICONS[rail];
  return (
    <span
      data-rail={rail}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border bg-background px-2.5 text-xs font-medium whitespace-nowrap",
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0 text-primary" aria-hidden />
      {t.payments.rails[rail]}
    </span>
  );
}
