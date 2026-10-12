"use client";

import { useState } from "react";
import { CircleCheck } from "lucide-react";
import { GatedButton, GateReason, type GateLike, type Unblock } from "@/components/darb/gated-button";
import { Amount } from "@/components/darb/amount";
import { PaymentStatusBadge } from "@/components/darb/payment-badges";
import { formatArrival, formatInstant, payeeName } from "@/components/darb/payment-format";
import { Button } from "@/components/ui/button";
import type { Approval } from "@/lib/domain/types";
import { fmt, plural } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import type { Person, RunBillItem } from "@/app/(app)/bills/runs/data";
import { BottomSheet } from "./bottom-sheet";

/**
 * Sticky bottom bar: Decline (outline) + Approve (primary). When Approve is blocked, one reason under
 * the bar says why and offers the action that unblocks it (e.g. "Switch user").
 * `onApprove` should open the Confirm and release sheet, not approve directly.
 */
export function ApproveBar({
  approveLabel,
  declineTitle,
  gate,
  declineGate = gate,
  reason,
  unblock,
  busy,
  onApprove,
  onDecline,
}: {
  approveLabel: string;
  declineTitle: string;
  gate: GateLike;
  /** Decline is gated separately (role and maker-checker only); defaults to `gate`. */
  declineGate?: GateLike;
  /** The reason in the UI language (falls back to the gate's own text). */
  reason?: string | null;
  unblock?: Unblock;
  busy: boolean;
  onApprove: () => void;
  onDecline: () => void;
}) {
  const reasonId = "mobile-approve-reason";
  const { t } = useI18n();
  const m = t.payments.mobile;
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      {/* --demo-fab-clearance: room for a floating demo button at the bottom of the viewport (0 by default). */}
      <div className="sticky bottom-0 z-10 mt-auto border-t bg-background/95 px-3 pt-3 pb-[calc(max(0.75rem,env(safe-area-inset-bottom))+var(--demo-fab-clearance,0px))] backdrop-blur">
        {!gate.ok ? (
          <GateReason
            id={reasonId}
            gate={reason ? { ok: false, message: reason } : gate}
            unblock={unblock}
            className="mb-2.5"
          />
        ) : null}
        <div className="flex gap-2">
          <GatedButton
            gate={declineGate}
            showReason={false}
            describedBy={reasonId}
            pending={busy}
            variant="outline"
            size="lg"
            className="h-11 px-3.5"
            onClick={() => setConfirm(true)}
          >
            {m.decline}
          </GatedButton>
          <GatedButton
            gate={gate}
            showReason={false}
            describedBy={reasonId}
            pending={busy}
            size="lg"
            className="h-11 min-w-0 flex-1 px-2"
            wrapperClassName="flex-1"
            onClick={onApprove}
          >
            <span className="truncate">{approveLabel}</span>
          </GatedButton>
        </div>
      </div>
      <BottomSheet open={confirm} onOpenChange={setConfirm} title={declineTitle} description={m.declineDescription}>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button variant="outline" size="lg" className="h-11" onClick={() => setConfirm(false)}>
            {t.payments.cancel}
          </Button>
          <Button
            variant="destructive"
            size="lg"
            className="h-11"
            onClick={() => {
              setConfirm(false);
              onDecline();
            }}
          >
            {m.declineConfirm}
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}

/** After approval: what happened to each bill (paid now / scheduled for Sun 18 Oct / held). */
export function ApprovalOutcome({
  items,
  approval,
  people,
}: {
  items: RunBillItem[];
  approval?: Approval;
  people: Record<string, Person>;
}) {
  const { t, lang } = useI18n();
  const m = t.payments.mobile;
  const released = items.filter((i) => i.payment && i.payment.status !== "cancelled");
  const approver = approval ? people[approval.userId] : undefined;

  const outcome = (item: RunBillItem) => {
    const p = item.payment;
    if (!p) return "";
    switch (p.status) {
      case "sent":
      case "settled": {
        // "Paid now" when it left at approval; otherwise when it left (e.g. SARIE on Sunday 09:00).
        const leftAtApproval =
          !approval || !p.sentAt || Math.abs(Date.parse(p.sentAt) - Date.parse(approval.at)) < 5 * 60_000;
        return leftAtApproval
          ? fmt(m.outcomePaidNow, { date: formatArrival(p.expectedArrival, lang) })
          : fmt(m.outcomeSentAt, { time: formatInstant(p.sentAt!, lang), date: formatArrival(p.expectedArrival, lang) });
      }
      case "scheduled":
        return fmt(m.outcomeScheduled, { date: formatArrival(p.expectedArrival, lang) });
      case "held":
        return fmt(m.outcomeHeld, { reason: p.holdReason ? t.payments.holdReasons[p.holdReason] : t.payments.paymentStatus.held });
      case "cancelled":
        return m.outcomeCancelled;
      default:
        return p.failureReason ? `${m.outcomeFailed}: ${p.failureReason}` : m.outcomeFailed;
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-success/20 bg-success-surface" aria-live="polite">
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <CircleCheck className="mt-0.5 size-6 shrink-0 text-success" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-base font-medium text-success">{m.approvedTitle}</h2>
          <p className="text-sm text-foreground">{plural(lang, m.approvedRun, released.length)}</p>
          {approval ? (
            <p className="text-xs text-muted-foreground">
              {fmt(m.approvedBy, {
                name: approver ? (lang === "ar" ? approver.nameAr : approver.name) : approval.userId,
                time: formatInstant(approval.at, lang),
              })}
            </p>
          ) : null}
        </div>
      </div>
      <ul className="divide-y border-t bg-card">
        {items.map((item) => (
          <li key={item.bill.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{payeeName(item.bill, lang, item.supplier)}</p>
              <p className="truncate text-xs text-muted-foreground">{outcome(item)}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Amount value={item.bill.total} className="text-sm font-medium" />
              <PaymentStatusBadge payment={item.payment ? { status: item.payment.status } : undefined} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
