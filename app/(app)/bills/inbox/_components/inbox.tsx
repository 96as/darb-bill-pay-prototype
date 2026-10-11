"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Inbox, Mail, Paperclip, Play, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Amount } from "@/components/darb/amount";
import { EmptyState } from "@/components/darb/empty-state";
import { InitialAvatar } from "@/components/darb/initial-avatar";
import { MockBadge } from "@/components/darb/mock-badge";
import { Panel, PanelHeader } from "@/components/darb/panel";
import { SourceChip } from "@/components/darb/source-chip";
import { StatusBadge } from "@/components/darb/status-badge";
import { SupplierName } from "@/components/darb/supplier-name";
import { UploadDropzone, fileIconFor } from "@/components/darb/upload-invoice";
import { Button } from "@/components/ui/button";
import { fmt, plural } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { api } from "@/lib/ui/api";
import { formatDateTime } from "@/lib/ui/format";
import { useApiAction } from "@/lib/ui/use-api-action";
import { cn } from "@/lib/utils";
import type { InboxBill, InboxEmail } from "../data";

/** The company's bills inbox address (BP-02), with copy button. Email delivery is mocked. */
export function InboxAddressCard({ address }: { address: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the address is still selectable */
    }
  }
  return (
    <Panel>
      <PanelHeader
        title={t.inbox.addressTitle}
        description={t.inbox.addressHelp}
        action={<MockBadge label={t.inbox.mockEmail} tooltip={t.inbox.mockEmailTooltip} />}
      />
      <div className="flex flex-wrap items-center gap-2 px-5 pb-5">
        <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border bg-background-secondary px-3">
          <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span dir="ltr" className="truncate font-mono text-sm select-all">
            {address}
          </span>
        </div>
        <Button variant="outline" size="lg" onClick={copy} aria-live="polite">
          {copied ? <Check aria-hidden className="text-success" /> : <Copy aria-hidden />}
          {copied ? t.ui.copied : t.ui.copy}
        </Button>
      </div>
    </Panel>
  );
}

function DraftRow({ bill }: { bill: InboxBill }) {
  const { t } = useI18n();
  return (
    <li>
      <Link
        href={`/bills/${bill.id}`}
        className="flex items-start gap-4 rounded-lg border bg-background px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <div className="min-w-0 flex-1">
          <SupplierName nameEn={bill.supplierName} nameAr={bill.supplierNameAr} className="text-sm" />
        </div>
        <div className="flex shrink-0 flex-col items-start gap-1">
          <span dir="ltr" className="text-sm tabular-nums">
            {bill.invoiceNumber}
          </span>
          {bill.extraction === "e_invoice" ? (
            <SourceChip kind="e_invoice" />
          ) : bill.extraction === "ocr" ? (
            <SourceChip
              kind={bill.needsReviewCount > 0 ? "check" : "ocr"}
              label={bill.needsReviewCount > 0 ? t.inbox.checkFieldsOcr : undefined}
            />
          ) : null}
          {bill.duplicate ? <span className="text-xs font-medium text-error-foreground">{t.bills.duplicateChip}</span> : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Amount value={bill.total} className="text-sm font-medium" />
          <StatusBadge status={bill.status} />
        </div>
      </Link>
    </li>
  );
}

function EmailItem({ email }: { email: InboxEmail }) {
  const { t, lang } = useI18n();
  const { run, pending } = useApiAction();
  const processed = Boolean(email.processedAt);
  const count = email.attachments.length;

  async function process() {
    await run(() => api.post<{ bills?: unknown[] }>(`/api/inbox/${email.id}/process`), {
      onSuccess: (res) => {
        const created = Array.isArray(res?.bills) ? res.bills.length : count;
        toast.success(plural(lang, t.inbox.processedToast, created));
      },
    });
  }

  return (
    <li className={cn("space-y-4 px-5 py-5", !processed && "bg-primary-surface/30")}>
      <div className="flex flex-wrap items-start gap-3">
        <InitialAvatar name={email.from} icon={Mail} />
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium" dir="ltr">
              {email.subject}
            </p>
            {!processed ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] leading-none font-medium text-primary-foreground">
                {t.inbox.newBadge}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {t.inbox.from} <span dir="ltr">{email.from}</span> · {fmt(t.inbox.received, { time: formatDateTime(email.receivedAt, lang) })}
          </p>
        </div>
        {processed && email.processedAt ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-success">
            <Check className="size-3.5" aria-hidden />
            {fmt(t.inbox.processedAt, { time: formatDateTime(email.processedAt, lang) })}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 ps-12">
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Paperclip className="size-3.5" aria-hidden />
          {plural(lang, t.inbox.attachments, count)}
        </span>
        {email.attachments.map((a) => {
          const Icon = fileIconFor(a.filename);
          return (
            <span
              key={a.filename}
              className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-lg border bg-background px-2 text-xs"
              dir="ltr"
            >
              <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{a.filename}</span>
            </span>
          );
        })}
      </div>

      {processed ? (
        <div className="space-y-2 ps-12">
          <p className="text-xs font-medium text-muted-foreground">{t.inbox.draftsCreated}</p>
          <ul className="grid gap-2">
            {email.bills.map((bill) => (
              <DraftRow key={bill.id} bill={bill} />
            ))}
          </ul>
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <UserCheck className="size-3.5" aria-hidden />
            {fmt(t.inbox.senderSaved, { email: email.from })}
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 ps-12">
          <Button size="lg" className="px-4" onClick={process} disabled={pending || count === 0}>
            <Play aria-hidden className="rtl:rotate-180" />
            {pending ? t.inbox.processing : plural(lang, t.inbox.process, count)}
          </Button>
          <p className="max-w-md text-xs text-muted-foreground">{t.inbox.processHint}</p>
        </div>
      )}
    </li>
  );
}

/** Received emails (BP-02): unprocessed ones can be processed; processed ones list their drafts. */
export function InboxEmails({ emails }: { emails: InboxEmail[] }) {
  const { t } = useI18n();
  return (
    <Panel>
      <PanelHeader title={t.inbox.emailsTitle} description={t.inbox.emailsDescription} />
      {emails.length === 0 ? (
        <EmptyState icon={Inbox} title={t.inbox.empty} description={t.inbox.emptyDescription} className="border-t" />
      ) : (
        <ul className="divide-y border-t">
          {emails.map((email) => (
            <EmailItem key={email.id} email={email} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Upload drop zone (BP-01). */
export function InboxUpload() {
  const { t } = useI18n();
  return (
    <Panel className="h-fit">
      <PanelHeader title={t.inbox.uploadTitle} description={t.inbox.uploadDescription} />
      <div className="px-5 pb-5">
        <UploadDropzone />
      </div>
    </Panel>
  );
}
