"use client";

import { FileText, Mail, PenLine, Upload, Landmark, type LucideIcon } from "lucide-react";
import { Panel, PanelHeader } from "@/components/darb/panel";
import type { Bill } from "@/lib/domain/types";
import { useI18n } from "@/lib/i18n/client";
import { actionLabel } from "@/lib/ui/audit";
import { formatDateTime, formatFileSize } from "@/lib/ui/format";
import { useBill } from "./bill-context";

const SOURCE_ICONS: Record<Bill["source"], LucideIcon> = {
  email: Mail,
  upload: Upload,
  manual: PenLine,
  sadad: Landmark,
  seed: FileText,
};

/** Sender (BP-02), file, source and this bill's audit trail. */
export function BillMeta() {
  const { t, lang } = useI18n();
  const { view } = useBill();
  const { bill, events } = view;
  const SourceIcon = SOURCE_ICONS[bill.source];

  return (
    <Panel>
      <PanelHeader title={t.billDetail.meta.title} />
      <dl className="mx-5 divide-y rounded-lg border px-3 text-sm">
        {bill.senderEmail ? (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
            <dt className="text-muted-foreground">{t.billDetail.meta.sender}</dt>
            <dd className="text-end">
              <span dir="ltr" className="block">{bill.senderEmail}</span>
              <span className="block text-xs text-muted-foreground">{t.billDetail.meta.senderHelp}</span>
            </dd>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
          <dt className="text-muted-foreground">{t.billDetail.meta.source}</dt>
          <dd className="inline-flex items-center gap-1.5">
            <SourceIcon className="size-4 text-muted-foreground" aria-hidden />
            {t.bills.sources[bill.source]}
          </dd>
        </div>
        {bill.file ? (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
            <dt className="text-muted-foreground">{t.billDetail.meta.file}</dt>
            <dd className="min-w-0 truncate" dir="ltr">
              {bill.file.name}
              {bill.file.size ? <span className="text-muted-foreground"> · {formatFileSize(bill.file.size)}</span> : null}
            </dd>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
          <dt className="text-muted-foreground">{t.billDetail.meta.created}</dt>
          <dd className="tabular-nums">{formatDateTime(bill.createdAt, lang)}</dd>
        </div>
      </dl>
      <div className="px-5 pt-5 pb-5">
        <h3 className="mb-3 text-sm font-medium">{t.billDetail.meta.timeline}</h3>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.billDetail.meta.noEvents}</p>
        ) : (
          <ol className="relative space-y-4 before:absolute before:inset-y-1 before:start-[5px] before:w-px before:bg-border">
            {events.map((e) => (
              <li key={e.id} className="relative ps-6">
                <span aria-hidden className="absolute start-0 top-1.5 size-[11px] rounded-full border-2 border-background bg-primary ring-1 ring-primary/30" />
                <p className="text-sm font-medium">{actionLabel(t, e.action)}</p>
                <p className="text-xs text-muted-foreground">
                  {lang === "ar" ? e.actor.nameAr : e.actor.name} · <span className="tabular-nums">{formatDateTime(e.at, lang)}</span>
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Panel>
  );
}
