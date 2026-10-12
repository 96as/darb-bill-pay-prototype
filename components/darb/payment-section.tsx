import { Collapsible } from "@base-ui/react/collapsible";
import { Calculator, ChevronDown, CircleCheck, Clock, Download, Mail, MessageSquare, Paperclip, ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { formatAmount, formatSAR } from "@/lib/domain/money";
import type { AccountingEntry, Bill, Halalas, Payment, Supplier, SupplierNotice } from "@/lib/domain/types";
import { fmt, getDict, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { MockBadge } from "./mock-badge";
import { PaymentStatusBadge, RailChip } from "./payment-badges";
import { billReference, formatArrival, formatInstant, payeeName } from "./payment-format";
import { isPaymentOut } from "./payment-rules";

/** Downloadable payment confirmation for a paid bill (BP-14), served by app/api. */
export const confirmationUrl = (billId: string) => `/api/payments/${encodeURIComponent(billId)}/confirmation`;

export interface PaymentSectionProps {
  bill: Bill;
  payment: Payment;
  /** The supplier notice, once the payment has been sent (BP-13). */
  notice?: SupplierNotice;
  /** Accounting entries for this bill (payable and/or payment, BP-14/BP-15). */
  accountingEntries: AccountingEntry[];
  supplier?: Supplier;
  lang: Lang;
  className?: string;
}

/**
 * What happened after a bill was paid (demo step 6; BP-13..15):
 * (a) the bilingual notice the supplier received (mock email/SMS, no bank details),
 * (b) the transaction synced to the accounting system (mock, Odoo-style journal),
 * (c) the payment confirmation download.
 * No hooks: renders from a server or a client component.
 */
export function PaymentSection({ bill, payment, notice, accountingEntries, supplier, lang, className }: PaymentSectionProps) {
  const t = getDict(lang);
  const s = t.payments.section;
  const out = isPaymentOut(payment);

  return (
    <div className={cn("space-y-4", className)} data-payment-id={payment.id}>
      {/* Payment strip + (c) confirmation download */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl border bg-card px-5 py-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-medium">{s.title}</h3>
            <PaymentStatusBadge payment={payment} />
            <RailChip rail={payment.rail} />
          </div>
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <Fact label={t.payments.detail.columns.amount}>
              <Money value={payment.amount} lang={lang} />
            </Fact>
            <Fact label={t.payments.detail.columns.arrival}>{formatArrival(payment.expectedArrival, lang)}</Fact>
            {payment.transferRef ? (
              <Fact label={s.transferRef}>
                <span dir="ltr" className="font-mono text-[13px]">{payment.transferRef}</span>
              </Fact>
            ) : null}
          </dl>
        </div>
        {out ? (
          <a
            href={confirmationUrl(bill.id)}
            download
            className={buttonVariants({ variant: "pill", size: "lg", className: "px-4" })}
          >
            <Download aria-hidden />
            {s.download}
          </a>
        ) : null}
      </div>

      <SupplierNoticeCard bill={bill} payment={payment} notice={notice} supplier={supplier} lang={lang} />
      <AccountingCard entries={accountingEntries} lang={lang} transferRef={payment.transferRef} />
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

function Money({ value, lang }: { value: Halalas; lang: Lang }) {
  return <span className="tabular-nums whitespace-nowrap">{formatSAR(value, lang)}</span>;
}

function CardHeader({
  icon: Icon,
  title,
  description,
  aside,
}: {
  icon: typeof Mail;
  title: string;
  description?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-surface text-primary">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 space-y-0.5">
          <h3 className="text-base leading-snug font-medium">{title}</h3>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {aside}
    </div>
  );
}

// ---------- (a) What the supplier received ----------

function SupplierNoticeCard({
  bill,
  payment,
  notice,
  supplier,
  lang,
}: {
  bill: Bill;
  payment: Payment;
  notice?: SupplierNotice;
  supplier?: Supplier;
  lang: Lang;
}) {
  const t = getDict(lang);
  const s = t.payments.section;
  const channel = notice?.channel ?? (supplier?.noticeEmail ? "email" : supplier?.noticeMobile ? "sms" : "email");
  const Icon = channel === "sms" ? MessageSquare : Mail;
  const to = notice?.to ?? supplier?.noticeEmail ?? supplier?.noticeMobile;
  const waiting = payment.status === "scheduled" || payment.status === "held";

  const summary = notice
    ? fmt(s.noticeSummary, {
        channel: channel === "sms" ? s.channelSms : s.channelEmail,
        to: notice.to,
        time: formatInstant(notice.sentAt, lang),
      })
    : !to
      ? s.noContact
      : waiting
        ? fmt(s.notifyWhenLeaves, { sendAt: formatInstant(payment.scheduledFor, lang) })
        : `${payeeName(bill, lang, supplier)} · ${billReference(bill, t)}`;

  return (
    <section className="rounded-xl border bg-card" aria-label={s.noticeTitle}>
      <Disclosure
        icon={Icon}
        title={s.noticeTitle}
        summary={summary}
        aside={<MockBadge label={channel === "sms" ? s.deliverySms : s.deliveryEmail} tooltip={s.mockTooltip} />}
        panelClassName="space-y-4 border-t px-5 py-4"
      >
        {notice ? (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">{s.to}</dt>
              <dd dir="ltr" className="w-fit max-w-full truncate font-medium">{notice.to}</dd>
            </dl>
            <div className="grid gap-3 lg:grid-cols-2">
              <NoticeBody label={s.english} subjectLabel={getDict("en").payments.section.subject} subject={notice.subjectEn} body={notice.bodyEn} lang="en" />
              <NoticeBody label={s.arabic} subjectLabel={getDict("ar").payments.section.subject} subject={notice.subjectAr} body={notice.bodyAr} lang="ar" />
            </div>
          </>
        ) : (
          <p className="flex items-start gap-2 rounded-lg bg-information px-3 py-2.5 text-sm text-information-foreground">
            <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {!to
                ? s.noContact
                : waiting
                  ? fmt(s.notifyWhenLeaves, { sendAt: formatInstant(payment.scheduledFor, lang) })
                  : s.notifyAfterSend}
              {to ? (
                <>
                  {" "}
                  <span className="text-muted-foreground">
                    {s.to}: <span dir="ltr">{to}</span>
                  </span>
                </>
              ) : null}
            </span>
          </p>
        )}
        <p className="flex items-center gap-1.5 text-xs font-medium text-success">
          <ShieldCheck className="size-4 shrink-0" aria-hidden />
          {s.noBankDetails}
        </p>
      </Disclosure>
    </section>
  );
}

/**
 * Expandable block, closed by default: a full-width button (aria-expanded, aria-controls via Base UI)
 * with icon, title and a one-line summary; the vertical chevron reads the same in RTL.
 * `aside` (e.g. a Mock badge) sits outside the button so it stays its own focus stop.
 */
function Disclosure({
  icon: Icon,
  title,
  summary,
  aside,
  panelClassName,
  children,
  compact,
}: {
  icon?: typeof Mail;
  title: React.ReactNode;
  summary?: React.ReactNode;
  aside?: React.ReactNode;
  panelClassName?: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <Collapsible.Root>
      <div className={cn("flex items-start gap-3 px-5", compact ? "py-3" : "py-4")}>
        <Collapsible.Trigger className="group/disclosure flex min-w-0 flex-1 items-start gap-3 rounded-md text-start outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          {Icon ? (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-surface text-primary">
              <Icon className="size-4" aria-hidden />
            </span>
          ) : null}
          <span className="min-w-0 flex-1">
            <span className={cn("block leading-snug font-medium", compact ? "text-sm" : "text-base")}>{title}</span>
            {summary ? <span className="mt-0.5 block truncate text-sm text-muted-foreground">{summary}</span> : null}
          </span>
          <ChevronDown
            className="mt-1.5 size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]/disclosure:rotate-180"
            aria-hidden
          />
        </Collapsible.Trigger>
        {aside ? <div className="shrink-0 pt-1">{aside}</div> : null}
      </div>
      <Collapsible.Panel className={panelClassName}>{children}</Collapsible.Panel>
    </Collapsible.Root>
  );
}

/** One language of the notice, as an email card. Arabic is RTL in Cairo, whatever the UI language. */
function NoticeBody({
  label,
  subjectLabel,
  subject,
  body,
  lang,
}: {
  label: string;
  subjectLabel: string;
  subject: string;
  body: string;
  lang: "en" | "ar";
}) {
  return (
    <article
      lang={lang}
      dir={lang === "ar" ? "rtl" : "ltr"}
      className={cn("flex flex-col rounded-lg border bg-background-secondary", lang === "ar" && "font-arabic")}
    >
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <p className="min-w-0 text-sm">
          <span className="text-muted-foreground">{subjectLabel}: </span>
          <span className="font-medium">{subject}</span>
        </p>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{label}</span>
      </div>
      <p className="px-4 py-3 text-sm leading-relaxed whitespace-pre-line">{body}</p>
    </article>
  );
}

// ---------- (b) Accounting system (mock) ----------

const ENTRY_ORDER: Record<AccountingEntry["kind"], number> = { payable: 0, payment: 1 };

function AccountingCard({ entries, lang, transferRef }: { entries: AccountingEntry[]; lang: Lang; transferRef?: string }) {
  const t = getDict(lang);
  const s = t.payments.section;
  const sorted = [...entries].sort(
    (a, b) => ENTRY_ORDER[a.kind] - ENTRY_ORDER[b.kind] || a.createdAt.localeCompare(b.createdAt),
  );
  return (
    <section className="rounded-xl border bg-card" aria-label={s.accountingTitle}>
      <CardHeader
        icon={Calculator}
        title={s.accountingTitle}
        description={s.accountingDescription}
        aside={<MockBadge tooltip={s.accountingTooltip} />}
      />
      {sorted.length === 0 ? (
        <p className="border-t px-5 py-4 text-sm text-muted-foreground">{s.noEntries}</p>
      ) : (
        sorted.map((entry) => <AccountingEntryView key={entry.id} entry={entry} lang={lang} transferRef={transferRef} />)
      )}
    </section>
  );
}

function AccountingEntryView({ entry, lang, transferRef }: { entry: AccountingEntry; lang: Lang; transferRef?: string }) {
  const t = getDict(lang);
  const s = t.payments.section;
  const debit = entry.lines.reduce((sum, l) => sum + l.debit, 0);
  const credit = entry.lines.reduce((sum, l) => sum + l.credit, 0);
  const num = (h: Halalas) => (h === 0 ? "" : formatAmount(h));
  const th = "h-9 px-3 text-xs font-medium text-muted-foreground first:ps-4 last:pe-4";
  const td = "px-3 py-2 first:ps-4 last:pe-4";

  const summary =
    entry.kind === "payable"
      ? fmt(s.payableSummary, { amount: formatSAR(entry.total, lang), status: s.accStatus[entry.status] })
      : fmt(s.paymentSummary, { ref: transferRef ?? formatSAR(entry.total, lang) });

  return (
    <div className="border-t" data-entry-kind={entry.kind}>
      <Disclosure
        compact
        title={s.entryKind[entry.kind]}
        summary={<bdi>{summary}</bdi>}
        aside={
          <span
            className={cn(
              "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium",
              entry.status === "paid" ? "bg-success-surface text-success" : "bg-information text-information-foreground",
            )}
          >
            <CircleCheck className="size-3.5" aria-hidden />
            {s.accStatus[entry.status]}
          </span>
        }
        panelClassName="space-y-4 px-5 pb-4"
      >
      <p className="text-xs text-muted-foreground">
        <bdi>{entry.system}</bdi> · {formatInstant(entry.createdAt, lang)}
      </p>
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
        <Field label={s.fields.supplier}>
          <bdi>{entry.supplierName}</bdi>
        </Field>
        <Field label={s.fields.invoiceNo}>
          <span dir="ltr">{entry.invoiceNumber}</span>
        </Field>
        <Field label={s.fields.vat}>{entry.vat !== undefined ? <Money value={entry.vat} lang={lang} /> : "—"}</Field>
        <Field label={s.fields.total}>
          <Money value={entry.total} lang={lang} />
        </Field>
        <Field label={s.fields.attachment}>
          {entry.attachmentName ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span dir="ltr" className="truncate">{entry.attachmentName}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{s.noAttachment}</span>
          )}
        </Field>
        <Field label={s.fields.status}>{s.accStatus[entry.status]}</Field>
      </dl>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="border-b">
              <th className={cn(th, "text-start")}>{s.journal.account}</th>
              <th className={cn(th, "text-end")}>{s.journal.debit}</th>
              <th className={cn(th, "text-end")}>{s.journal.credit}</th>
            </tr>
          </thead>
          <tbody>
            {entry.lines.map((line, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className={td}>
                  <bdi>{line.account}</bdi>
                </td>
                <td className={cn(td, "text-end tabular-nums")}>{num(line.debit)}</td>
                <td className={cn(td, "text-end tabular-nums")}>{num(line.credit)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-muted/40 font-medium">
            <tr>
              <td className={td}>{s.journal.total}</td>
              <td className={cn(td, "text-end tabular-nums")}>{formatAmount(debit)}</td>
              <td className={cn(td, "text-end tabular-nums")}>{formatAmount(credit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      </Disclosure>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate font-medium">{children}</dd>
    </div>
  );
}
