"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Info } from "lucide-react";
import { Amount } from "@/components/darb/amount";
import { ConfirmRelease, earliestArrival } from "@/components/darb/confirm-release";
import { useApiAction } from "@/components/darb/payment-actions";
import { RunStatusBadge } from "@/components/darb/payment-badges";
import { formatDayDate, formatInstant, permissionMessage } from "@/components/darb/payment-format";
import { rejectHint, runApprovalHint } from "@/components/darb/payment-rules";
import { formatSAR } from "@/lib/domain/money";
import { fmt, plural } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import type { RunDetailView } from "@/app/(app)/bills/runs/data";
import { ApprovalOutcome, ApproveBar } from "./approval-actions";
import { MobileBillCard } from "./mobile-bill-card";
import { useMobileDemo, useMobileUnblock } from "./mobile-shell";

/** /m/runs/{id}: approve a whole run with each invoice beside its amount (demo step 5; BP-08, BP-10, BP-17). */
export function MobileRunApproval({ view }: { view: RunDetailView }) {
  const { t, lang } = useI18n();
  const m = t.payments.mobile;
  const { actingUser } = useMobileDemo();
  const { run: call, busy } = useApiAction();
  const { run } = view;
  const path = `/api/payment-runs/${encodeURIComponent(run.id)}`;

  const active = view.items.filter((i) => i.bill.status !== "cancelled");
  const awaiting = run.status === "awaiting_approval";
  const hint = awaiting ? runApprovalHint(actingUser.id, run, view.approval) : null;
  const note =
    hint && !hint.ok
      ? hint.code === "not_approver"
        ? m.prepareOnly
        : permissionMessage(hint, t, lang, { bills: view.approval.bills, suppliers: view.approval.suppliers })
      : null;
  const released = run.status === "approved" || run.status === "completed";
  const unblockFor = useMobileUnblock();
  const deniedSupplier = hint && !hint.ok && hint.billId ? view.items.find((i) => i.bill.id === hint.billId)?.bill.supplierId : undefined;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const accounts = [...new Set(active.map((i) => i.payment?.fundingAccountId ?? i.bill.fundingAccountId))]
    .map((id) => view.accounts.find((a) => a.id === id))
    .map((a, i) => (a ? (lang === "ar" ? a.nameAr : a.name) : String(i)))
    .join(lang === "ar" ? " و" : " + ");
  const submitter = run.submittedBy ? view.people[run.submittedBy] : undefined;

  return (
    <div className="flex flex-1 flex-col">
      <div className="space-y-4 px-4 pt-3 pb-4">
        <Link href="/m" className="-ms-1 inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
          {m.myActions}
        </Link>

        <section className="rounded-2xl border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <h1 className="min-w-0 text-base leading-snug font-medium">{run.name}</h1>
            <RunStatusBadge status={run.status} className="shrink-0" />
          </div>
          <Amount
            value={view.total}
            className="mt-2 block text-3xl leading-tight font-medium tracking-tight"
            currencyClassName="text-base font-normal text-muted-foreground"
          />
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">{m.payDate}</dt>
              <dd className="font-medium">{formatDayDate(run.payDate, lang)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t.payments.runs.columns.bills}</dt>
              <dd className="font-medium">{plural(lang, t.payments.bills, active.length)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">{t.payments.newRun.columns.fundFrom}</dt>
              <dd className="font-medium">{accounts}</dd>
            </div>
          </dl>
          {submitter && run.submittedAt ? (
            <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
              {fmt(m.submittedBy, { name: lang === "ar" ? submitter.nameAr : submitter.name })} ·{" "}
              {formatInstant(run.submittedAt, lang)}
            </p>
          ) : null}
        </section>

        {released ? <ApprovalOutcome items={active} approval={run.approvals.at(-1)} people={view.people} /> : null}
        {!awaiting && !released ? (
          <p className="flex items-start gap-1.5 rounded-xl bg-muted px-3 py-2.5 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            {fmt(m.statusNote, { status: t.payments.runStatus[run.status] })}
          </p>
        ) : null}

        <div className="space-y-3">
          {view.items.map((item) => (
            <MobileBillCard key={item.bill.id} item={item} payDate={item.payDate} />
          ))}
        </div>

        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          {awaiting ? t.payments.newRun.independence : m.independence}
        </p>
      </div>

      {awaiting ? (
        <ApproveBar
          approveLabel={plural(lang, m.approveN, active.length, { amount: formatSAR(view.total, lang) })}
          declineTitle={m.declineRunTitle}
          gate={hint ?? { ok: true }}
          declineGate={hint ? rejectHint(hint) : { ok: true }}
          reason={note}
          unblock={hint ? unblockFor(hint, deniedSupplier) : undefined}
          busy={busy !== null}
          onApprove={() => setConfirmOpen(true)}
          onDecline={() => call("reject", `${path}/reject`, {}, { success: m.declinedToast })}
        />
      ) : null}
      {awaiting ? (
        <ConfirmRelease
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          total={view.total}
          count={active.length}
          earliestArrival={earliestArrival(active.map((i) => i.quote))}
          pending={busy === "approve"}
          onConfirm={async () => {
            const done = await call("approve", `${path}/approve`, {}, { success: m.approvedToast });
            if (done) setConfirmOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
