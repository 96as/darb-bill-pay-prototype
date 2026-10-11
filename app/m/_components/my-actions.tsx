"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarCheck, CircleCheck, Landmark, Monitor } from "lucide-react";
import { Amount } from "@/components/darb/amount";
import { ApprovalCard } from "@/components/darb/approval-card";
import { EmptyState } from "@/components/darb/empty-state";
import { InitialAvatar } from "@/components/darb/initial-avatar";
import { useApiAction } from "@/components/darb/payment-actions";
import { billReference, formatArrival, formatPlainDate, payeeName, permissionMessage } from "@/components/darb/payment-format";
import { billApprovalHint, runApprovalHint } from "@/components/darb/payment-rules";
import type { RuleResult } from "@/lib/domain/result";
import { fmt, plural } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import type { MobileHomeView } from "@/app/(app)/bills/runs/data";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "./bottom-sheet";
import { useMobileDemo } from "./mobile-shell";

/** /m "My actions": balance, then runs and bills waiting for approval (Darb "Need review" cards). */
export function MyActions({ view }: { view: MobileHomeView }) {
  const { t, lang } = useI18n();
  const m = t.payments.mobile;
  const { actingUser } = useMobileDemo();
  const { run: call, busy } = useApiAction();
  const [declining, setDeclining] = useState<{ url: string; title: string } | null>(null);
  const count = view.runs.length + view.bills.length;

  const noteFor = (hint: RuleResult) =>
    hint.ok
      ? undefined
      : hint.code === "not_approver"
        ? m.prepareOnly
        : permissionMessage(hint, t, lang, { bills: view.approval.bills, suppliers: view.approval.suppliers });

  return (
    <div className="space-y-5 px-4 py-4">
      <h1 className="text-xl font-medium">{m.myActions}</h1>

      <section className="rounded-2xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">{m.balanceTitle}</p>
        <Amount
          value={view.balances.available}
          className="mt-1 block text-3xl leading-tight font-medium tracking-tight"
          currencyClassName="text-base font-normal text-muted-foreground"
        />
        <p className="mt-0.5 text-xs text-muted-foreground">{m.balanceSub}</p>
        <dl className="mt-4 grid gap-2 border-t pt-3 text-sm">
          {[
            { label: m.mainBalance, value: view.balances.main },
            { label: m.scheduled, value: view.balances.scheduled },
            { label: m.awaitingApproval, value: view.balances.pendingApproval, strong: view.balances.pendingApproval > 0 },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className={row.strong ? "font-medium text-warning-foreground" : "font-medium"}>
                <Amount value={row.value} />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-medium">
          {m.needReview}
          {count > 0 ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-surface px-1.5 text-xs text-primary">
              {count}
            </span>
          ) : null}
        </h2>

        {count === 0 ? (
          <div className="rounded-2xl border bg-card">
            <EmptyState icon={CircleCheck} title={m.nothingTitle} description={m.nothingDescription} className="py-10" />
          </div>
        ) : null}

        {view.runs.map(({ run, total, billCount }) => {
          const hint = runApprovalHint(actingUser.id, run, view.approval);
          const href = `/m/runs/${encodeURIComponent(run.id)}`;
          const path = `/api/payment-runs/${encodeURIComponent(run.id)}`;
          return (
            <ApprovalCard
              key={run.id}
              avatar={<InitialAvatar name={run.name} icon={CalendarCheck} />}
              title={run.name}
              href={href}
              subtitle={fmt(m.runSubtitle, {
                bills: plural(lang, t.payments.bills, billCount),
                date: formatArrival(run.payDate, lang),
              })}
              amount={total}
              meta={<ReviewLink href={href} />}
              disabled={!hint.ok}
              pending={busy !== null}
              note={noteFor(hint)}
              onApprove={() => call(`run:${run.id}`, `${path}/approve`, {}, { success: m.approvedToast })}
              onDecline={() => setDeclining({ url: `${path}/reject`, title: m.declineRunTitle })}
            />
          );
        })}

        {view.bills.map(({ bill }) => {
          const hint = billApprovalHint(actingUser.id, bill, view.approval);
          const href = `/m/bills/${encodeURIComponent(bill.id)}`;
          const path = `/api/bills/${encodeURIComponent(bill.id)}`;
          const supplier = view.approval.suppliers.find((s) => s.id === bill.supplierId);
          return (
            <ApprovalCard
              key={bill.id}
              avatar={
                bill.kind === "sadad" ? (
                  <InitialAvatar name={bill.supplierName} icon={Landmark} />
                ) : (
                  <InitialAvatar name={payeeName(bill, lang, supplier)} />
                )
              }
              title={payeeName(bill, lang, supplier)}
              href={href}
              subtitle={
                bill.dueDate
                  ? fmt(m.billSubtitle, { ref: billReference(bill, t), date: formatPlainDate(bill.dueDate, lang) })
                  : billReference(bill, t)
              }
              amount={bill.total}
              meta={<ReviewLink href={href} />}
              disabled={!hint.ok}
              pending={busy !== null}
              note={noteFor(hint)}
              onApprove={() => call(`bill:${bill.id}`, `${path}/approve`, {}, { success: m.approvedToast })}
              onDecline={() => setDeclining({ url: `${path}/reject`, title: m.declineBillTitle })}
            />
          );
        })}
      </section>

      <Link
        href="/bills"
        className="flex items-center justify-center gap-1.5 py-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <Monitor className="size-4" aria-hidden />
        {m.desktopLink}
      </Link>

      <BottomSheet
        open={declining !== null}
        onOpenChange={(open) => !open && setDeclining(null)}
        title={declining?.title ?? ""}
        description={m.declineDescription}
      >
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button variant="outline" size="lg" className="h-11" onClick={() => setDeclining(null)}>
            {t.payments.cancel}
          </Button>
          <Button
            variant="destructive"
            size="lg"
            className="h-11"
            onClick={() => {
              const target = declining;
              setDeclining(null);
              if (target) void call("decline", target.url, {}, { success: m.declinedToast });
            }}
          >
            {m.declineConfirm}
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}

function ReviewLink({ href }: { href: string }) {
  const { t } = useI18n();
  return (
    <Link
      href={href}
      className="inline-flex h-7 items-center gap-1 rounded-full bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/15"
    >
      {t.payments.mobile.review}
      <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
    </Link>
  );
}
