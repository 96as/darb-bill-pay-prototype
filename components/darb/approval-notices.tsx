"use client";

import { Landmark, UserPlus } from "lucide-react";
import type { ISODateTime } from "@/lib/domain/types";
import { riyadhDate } from "@/lib/domain/time";
import { fmt } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { formatPlainDate } from "./payment-format";

type Person = { name: string; nameAr: string };

export interface ApprovalNoticeData {
  /** No payment has left for this supplier's current IBAN yet. */
  firstPayment?: boolean;
  supplierAddedBy?: Person;
  /** Last approved IBAN change within 30 days (RunView item / BillDetail `bankChange`). */
  bankChange?: {
    changedAt: ISODateTime;
    requestedByName?: Person | string;
    approvedByName?: Person | string;
  };
}

/**
 * What an approver should notice before releasing money to a supplier: a recent bank-details change
 * (who asked, who approved) and a first payment. Warning tone; renders nothing when neither applies.
 */
export function ApprovalNotices({ data, className }: { data: ApprovalNoticeData; className?: string }) {
  const { t, lang } = useI18n();
  const name = (p?: Person | string) => (!p ? "—" : typeof p === "string" ? p : lang === "ar" ? p.nameAr : p.name);
  const lines: { icon: typeof Landmark; text: string; key: string }[] = [];
  if (data.bankChange) {
    lines.push({
      key: "bank",
      icon: Landmark,
      text: fmt(t.payments.bankChanged, {
        date: formatPlainDate(riyadhDate(data.bankChange.changedAt), lang),
        requester: name(data.bankChange.requestedByName),
        approver: name(data.bankChange.approvedByName),
      }),
    });
  }
  if (data.firstPayment) {
    lines.push({ key: "first", icon: UserPlus, text: fmt(t.payments.firstPayment, { name: name(data.supplierAddedBy) }) });
  }
  if (lines.length === 0) return null;
  return (
    <ul className={cn("space-y-1", className)}>
      {lines.map(({ key, icon: Icon, text }) => (
        <li key={key} className="flex items-start gap-1.5 rounded-lg bg-warning px-2.5 py-1.5 text-xs whitespace-normal text-warning-foreground">
          <Icon className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}
