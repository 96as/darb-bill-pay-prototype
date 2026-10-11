"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, CalendarClock, Info, Layers, Send, Zap, Landmark } from "lucide-react";
import { Amount } from "@/components/darb/amount";
import { ConfirmDialog } from "@/components/darb/confirm-dialog";
import { Notice } from "@/components/darb/notice";
import { Panel, PanelHeader } from "@/components/darb/panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { quotePayment, quoteSadadPayment } from "@/lib/domain/rails";
import type { Payment, Rail, RailQuote } from "@/lib/domain/types";
import { fmt } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { api } from "@/lib/ui/api";
import { formatClock, formatDate, formatDateTime, formatDayDate, formatSAR } from "@/lib/ui/format";
import { useApiAction } from "@/lib/ui/use-api-action";
import { useGateMessage } from "@/lib/ui/use-gate-message";
import { cn } from "@/lib/utils";
import { PaymentSection } from "@/components/darb/payment-section";
import { useBill } from "./bill-context";

const RAIL_ICON: Record<Rail, typeof Zap> = { instant: Zap, sarie: ArrowRightLeft, sadad: Landmark };

/** Rail, send time and arrival (BP-09). The quote always comes from lib/domain/rails.ts. */
function QuoteBox({ quote, today, className }: { quote: Pick<RailQuote, "rail" | "sendAt" | "arrivalDate" | "reason">; today: string; className?: string }) {
  const { t, lang } = useI18n();
  const Icon = RAIL_ICON[quote.rail];
  const reason = (t.billDetail.railReasons as Record<string, string>)[quote.reason];
  return (
    <div className={cn("rounded-lg border bg-background-secondary", className)}>
      <dl className="divide-y px-3 text-sm">
        <div className="flex items-center justify-between gap-4 py-2">
          <dt className="text-muted-foreground">{t.billDetail.submit.rail}</dt>
          <dd className="flex items-center gap-1.5 font-medium">
            <Icon className="size-3.5 shrink-0 text-primary" aria-hidden />
            {t.billDetail.rails[quote.rail]}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-2">
          <dt className="text-muted-foreground">{t.billDetail.submit.leaves}</dt>
          <dd className="font-medium tabular-nums">{formatClock(quote.sendAt, lang)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-2">
          <dt className="text-muted-foreground">{t.billDetail.submit.arrival}</dt>
          <dd className="font-medium tabular-nums">
            {formatDayDate(quote.arrivalDate, lang)}
            {quote.arrivalDate === today ? <span className="font-normal text-muted-foreground"> · {t.billDetail.submit.today}</span> : null}
          </dd>
        </div>
      </dl>
      {reason ? (
        <p className="flex items-start gap-1.5 border-t px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          {reason}
        </p>
      ) : null}
    </div>
  );
}

function useQuote(payDate: string) {
  const { view } = useBill();
  const { bill, now } = view;
  return useMemo(() => {
    try {
      if (!payDate || bill.total <= 0) return null;
      return bill.kind === "sadad"
        ? quoteSadadPayment(payDate, new Date(now))
        : quotePayment(bill.total, payDate, new Date(now));
    } catch {
      return null;
    }
  }, [bill.kind, bill.total, now, payDate]);
}

function CancelBillButton({ label }: { label: string }) {
  const { t } = useI18n();
  const { view } = useBill();
  const { run } = useApiAction();
  if (!view.cancelGate.ok) return null;
  return (
    <ConfirmDialog
      trigger={<Button variant="ghost" size="lg" className="text-muted-foreground" />}
      title={t.billDetail.scheduled.cancelTitle}
      description={t.billDetail.scheduled.cancelBody}
      confirmLabel={label}
      cancelLabel={t.billDetail.scheduled.keep}
      destructive
      onConfirm={() => run(() => api.post(`/api/bills/${view.bill.id}/cancel`), { success: t.billDetail.scheduled.cancelled })}
    >
      {label}
    </ConfirmDialog>
  );
}

/** Draft: choose pay date and funding account, see rail + arrival live, submit (BP-08, BP-09, BP-18). */
function SubmitPanel() {
  const { t, lang } = useI18n();
  const { view } = useBill();
  const { bill, today, accounts } = view;
  const [payDate, setPayDate] = useState(bill.payDate && bill.payDate >= today ? bill.payDate : today);
  const [accountId, setAccountId] = useState(bill.fundingAccountId || "main");
  const quote = useQuote(payDate);
  const { run, pending } = useApiAction();
  const gateMessage = useGateMessage();

  const blocker =
    bill.duplicateOf
      ? t.billDetail.submit.duplicateOpen
      : bill.kind === "supplier" && !bill.supplierId
        ? t.billDetail.submit.needsSupplier
        : bill.needsReview.length > 0
          ? t.billDetail.submit.needsReview
          : payDate < today
            ? t.billDetail.submit.pastDate
            : !view.submitGate.ok
              ? gateMessage(view.submitGate) ?? null
              : null;

  const items = accounts.map((a) => ({
    value: a.id,
    label: `${lang === "ar" ? a.nameAr : a.name} · ${formatSAR(a.balance, lang)}`,
  }));
  const account = accounts.find((a) => a.id === accountId);

  return (
    <Panel>
      <PanelHeader title={t.billDetail.submit.title} description={t.billDetail.submit.description} />
      <div className="space-y-4 px-5 pb-5">
        <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
          <div className="grid gap-1.5">
            <label htmlFor="pay-date" className="text-xs text-muted-foreground">
              {t.billDetail.submit.payDate}
            </label>
            <Input
              id="pay-date"
              type="date"
              min={today}
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
              className="h-9 bg-background"
            />
          </div>
          <div className="grid gap-1.5">
            <label id="funding-label" className="text-xs text-muted-foreground">
              {t.billDetail.submit.fundingAccount}
            </label>
            <Select items={items} value={accountId} onValueChange={(v) => v && setAccountId(String(v))}>
              <SelectTrigger aria-labelledby="funding-label" className="h-9 w-full min-w-0 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {quote ? <QuoteBox quote={quote} today={today} /> : null}
        {account && account.balance < bill.total ? (
          <p className="text-xs text-warning-foreground">
            {fmt(t.billDetail.submit.accountBalance, { amount: formatSAR(account.balance, lang) })}
          </p>
        ) : null}
        {blocker ? (
          <p className="flex items-start gap-1.5 text-xs text-warning-foreground">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            {blocker}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="lg"
            className="px-4"
            disabled={Boolean(blocker) || pending}
            onClick={() =>
              run(() => api.post(`/api/bills/${bill.id}/submit`, { payDate, fundingAccountId: accountId }), {
                success: t.billDetail.submit.submitted,
              })
            }
          >
            <Send aria-hidden className="rtl:-scale-x-100" />
            {t.billDetail.submit.submit}
          </Button>
          {bill.kind === "supplier" ? (
            <Link href={`/bills/runs/new?bills=${bill.id}`} className={cn(buttonVariants({ variant: "pill", size: "lg" }), "px-4")}>
              <Layers aria-hidden />
              {t.billDetail.submit.addToRun}
            </Link>
          ) : null}
          <span className="ms-auto">
            <CancelBillButton label={t.billDetail.draftCancel} />
          </span>
        </div>
      </div>
    </Panel>
  );
}

/** Awaiting approval: approver sees the real rail and arrival first, then Approve / Reject (BP-08, BP-17). */
function ApprovalPanel() {
  const { t, lang } = useI18n();
  const { view } = useBill();
  const { bill, today, submittedBy, approvalGate } = view;
  const quote = useQuote(bill.payDate ?? today);
  const gateMessage = useGateMessage();
  const { run, pending } = useApiAction();
  return (
    <Panel className="border-warning-foreground/30">
      <PanelHeader
        title={t.billDetail.approval.title}
        description={fmt(t.billDetail.approval.description, {
          name: submittedBy ? (lang === "ar" ? submittedBy.nameAr : submittedBy.name) : "—",
          date: bill.submittedAt ? formatDateTime(bill.submittedAt, lang) : "—",
        })}
      />
      <div className="space-y-4 px-5 pb-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <span className="text-muted-foreground">{t.billDetail.submit.payDate}</span>
          <span className="font-medium">{bill.payDate ? formatDate(bill.payDate, lang) : "—"}</span>
        </div>
        {quote ? <QuoteBox quote={quote} today={today} /> : null}
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="lg"
            disabled={!approvalGate.ok || pending}
            onClick={() => run(() => api.post(`/api/bills/${bill.id}/approve`), { success: t.billDetail.approval.approved })}
          >
            {t.billDetail.approval.approve}
          </Button>
          <Button
            size="lg"
            variant="outline"
            disabled={!approvalGate.ok || pending}
            onClick={() => run(() => api.post(`/api/bills/${bill.id}/reject`), { success: t.billDetail.approval.rejected })}
          >
            {t.billDetail.approval.reject}
          </Button>
        </div>
        {!approvalGate.ok ? (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            {gateMessage(approvalGate)}
          </p>
        ) : null}
        <div className="flex justify-end">
          <CancelBillButton label={t.billDetail.draftCancel} />
        </div>
      </div>
    </Panel>
  );
}

function paymentQuote(payment: Payment): Pick<RailQuote, "rail" | "sendAt" | "arrivalDate" | "reason"> {
  return {
    rail: payment.rail,
    sendAt: payment.quote?.sendAt ?? payment.sentAt ?? payment.scheduledFor,
    arrivalDate: payment.quote?.arrivalDate ?? payment.expectedArrival,
    reason: payment.quote?.reason ?? "",
  };
}

/** Scheduled: the stored payment is the truth (rail, send time, arrival); cancellable until sent (BP-18). */
function ScheduledPanel() {
  const { t, lang } = useI18n();
  const { view } = useBill();
  const { bill, payment, today } = view;
  return (
    <Panel className="border-information-foreground/25">
      <PanelHeader
        title={t.billDetail.scheduled.title}
        description={bill.payDate ? `${t.billDetail.submit.payDate}: ${formatDate(bill.payDate, lang)}` : undefined}
        action={<CalendarClock className="size-5 text-information-foreground" aria-hidden />}
      />
      <div className="space-y-4 px-5 pb-5">
        {payment ? <QuoteBox quote={paymentQuote(payment)} today={today} /> : null}
        {payment?.status === "held" && payment.holdReason ? (
          <Notice tone="warning">
            {fmt(t.billDetail.scheduled.held, { reason: t.billDetail.scheduled.holdReasons[payment.holdReason] })}
          </Notice>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Amount value={bill.total} className="text-lg font-medium" currencyClassName="text-sm font-normal text-muted-foreground" />
          {view.cancelGate.ok ? (
            <CancelBillButton label={t.billDetail.scheduled.cancel} />
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

/** Paid / scheduled / failed: the shared PaymentSection (notice EN/AR, accounting entry, confirmation download). */
export function BillPaymentSection({ className }: { className?: string }) {
  const { lang } = useI18n();
  const { view } = useBill();
  if (!view.paymentSection) return null;
  const { payment, notice, accountingEntries, supplier } = view.paymentSection;
  return (
    <PaymentSection
      bill={view.bill}
      payment={payment}
      notice={notice}
      accountingEntries={accountingEntries}
      supplier={supplier}
      lang={lang}
      className={className}
    />
  );
}

/** Fallback when a paid bill has no payment record (e.g. imported history). */
function PaymentSectionSlot() {
  const { t, lang } = useI18n();
  const { view } = useBill();
  const { payment } = view;
  return (
    <Panel>
      <PanelHeader title={t.billDetail.paid.title} description={t.billDetail.paid.placeholder} />
      {payment ? (
        <dl className="mx-5 mb-5 divide-y rounded-lg border px-3 text-sm">
          {payment.transferRef ? (
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-muted-foreground">{t.billDetail.paid.transferRef}</dt>
              <dd dir="ltr" className="font-mono text-xs">{payment.transferRef}</dd>
            </div>
          ) : null}
          {payment.sentAt ? (
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-muted-foreground">{t.billDetail.paid.sentAt}</dt>
              <dd className="tabular-nums">{formatDateTime(payment.sentAt, lang)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 py-2">
            <dt className="text-muted-foreground">{t.billDetail.submit.rail}</dt>
            <dd>{t.billDetail.rails[payment.rail]}</dd>
          </div>
        </dl>
      ) : null}
    </Panel>
  );
}

/** What can happen next, by status. */
export function BillActions() {
  const { view } = useBill();
  switch (view.bill.status) {
    case "draft":
      return <SubmitPanel />;
    case "awaiting_approval":
      return <ApprovalPanel />;
    case "scheduled":
      return <ScheduledPanel />;
    case "paid":
      // The full PaymentSection renders above the columns; this is only the fallback without a payment.
      return view.paymentSection ? null : <PaymentSectionSlot />;
    default:
      return null;
  }
}
