"use client";

import { KeyRound } from "lucide-react";
import { fmt } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { formatDate, riyadhDate } from "@/lib/ui/format";
import { cn } from "@/lib/utils";

export interface BankChangeSummary {
  changedAt: string;
  requester?: { name: string; nameAr: string };
  approver?: { name: string; nameAr: string };
}

/** "Bank details changed on {date} · requested by {name}, approved by {name}" — shown before releasing money. */
export function BankChangeLine({ change, className }: { change: BankChangeSummary; className?: string }) {
  const { t, lang } = useI18n();
  const name = (p?: { name: string; nameAr: string }) => (p ? (lang === "ar" ? p.nameAr : p.name) : "—");
  return (
    <p
      className={cn(
        "flex items-start gap-1.5 rounded-lg bg-warning/70 px-3 py-2 text-xs text-warning-foreground",
        className,
      )}
    >
      <KeyRound className="mt-px size-3.5 shrink-0" aria-hidden />
      {fmt(t.billDetail.approval.bankChanged, {
        date: formatDate(riyadhDate(change.changedAt), lang),
        requester: name(change.requester),
        approver: name(change.approver),
      })}
    </p>
  );
}
