"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { useApiAction } from "@/components/darb/payment-actions";
import { formatDayDate, formatInstant, payeeName, permissionMessage } from "@/components/darb/payment-format";
import { billApprovalHint } from "@/components/darb/payment-rules";
import { StatusBadge } from "@/components/darb/status-badge";
import { formatSAR } from "@/lib/domain/money";
import { displayStatus } from "@/lib/domain/status";
import { fmt } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import type { BillApprovalView } from "@/app/(app)/bills/runs/data";
import { ApprovalOutcome, ApproveBar } from "./approval-actions";
import { MobileBillCard } from "./mobile-bill-card";
import { useMobileDemo } from "./mobile-shell";

/** /m/bills/{id}: single-bill approval (SADAD bills and bills outside a run), same card as runs. */
export function MobileBillApproval({ view }: { view: BillApprovalView }) {
  const { t, lang } = useI18n();
  const m = t.payments.mobile;
  const { actingUser } = useMobileDemo();
  const { run: call, busy } = useApiAction();
  const { item } = view;
  const { bill } = item;
  const path = `/api/bills/${encodeURIComponent(bill.id)}`;

  const awaiting = bill.status === "awaiting_approval" && !view.run;
  const hint = awaiting ? billApprovalHint(actingUser.id, bill, view.approval) : null;
  const note =
    hint && !hint.ok
      ? hint.code === "not_approver"
        ? m.prepareOnly
        : permissionMessage(hint, t, lang, { bills: [bill], suppliers: view.approval.suppliers })
      : null;
  const released = Boolean(item.payment);
  const account = view.accounts.find((a) => a.id === (item.payment?.fundingAccountId ?? bill.fundingAccountId));
  const submitter = bill.submittedBy ? view.people[bill.submittedBy] : undefined;

  return (
    <div className="flex flex-1 flex-col">
      <div className="space-y-4 px-4 pt-3 pb-4">
        <Link href="/m" className="-ms-1 inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
          {m.myActions}
        </Link>

        <section className="rounded-2xl border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <h1 className="min-w-0 text-base leading-snug font-medium">{payeeName(bill, lang, item.supplier)}</h1>
            <StatusBadge status={displayStatus(bill, view.today)} className="shrink-0" />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">{m.payDate}</dt>
              <dd className="font-medium">{formatDayDate(view.payDate, lang)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t.payments.newRun.columns.fundFrom}</dt>
              <dd className="font-medium">{account ? (lang === "ar" ? account.nameAr : account.name) : "—"}</dd>
            </div>
          </dl>
          {submitter && bill.submittedAt ? (
            <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
              {fmt(m.submittedBy, { name: lang === "ar" ? submitter.nameAr : submitter.name })} ·{" "}
              {formatInstant(bill.submittedAt, lang)}
            </p>
          ) : null}
        </section>

        {released ? <ApprovalOutcome items={[item]} approval={bill.approvals.at(-1)} people={view.people} /> : null}

        {view.run ? (
          <Link
            href={`/m/runs/${encodeURIComponent(view.run.id)}`}
            className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm font-medium"
          >
            <span className="min-w-0 flex-1 truncate">{view.run.name}</span>
            <ChevronRight className="size-4 text-muted-foreground rtl:rotate-180" aria-hidden />
          </Link>
        ) : null}

        <MobileBillCard item={item} payDate={view.payDate} />

        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          {m.independence}
        </p>
      </div>

      {awaiting ? (
        <ApproveBar
          approveLabel={fmt(m.approveOne, { amount: formatSAR(bill.total, lang) })}
          declineTitle={m.declineBillTitle}
          disabled={!hint?.ok}
          note={note}
          busy={busy !== null}
          onApprove={() => call("approve", `${path}/approve`, {}, { success: m.approvedToast })}
          onDecline={() => call("reject", `${path}/reject`, {}, { success: m.declinedToast })}
        />
      ) : null}
    </div>
  );
}
