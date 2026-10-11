"use client";

import { Landmark, ReceiptText, UserPlus, Zap, type LucideIcon } from "lucide-react";
import { Amount } from "@/components/darb/amount";
import { InvoiceThumb } from "@/components/darb/invoice-preview";
import { billReference, formatArrival, formatPlainDate, reasonLabel } from "@/components/darb/payment-format";
import { SupplierName } from "@/components/darb/supplier-name";
import { maskIban } from "@/lib/domain/iban";
import type { ISODate, Rail } from "@/lib/domain/types";
import { fmt } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import type { RunBillItem } from "@/app/(app)/bills/runs/data";

const RAIL_ICONS: Record<Rail, LucideIcon> = { instant: Zap, sarie: Landmark, sadad: ReceiptText };

/**
 * One bill on the mobile approval view: the invoice beside its amount (BP-08 demo step 5).
 * Start: tappable invoice thumbnail. End: supplier (+ Arabic), invoice no., amount, rail + expected
 * arrival, masked IBAN; then a first-payment notice when the supplier has never been paid.
 */
export function MobileBillCard({ item, payDate, className }: { item: RunBillItem; payDate: ISODate; className?: string }) {
  const { t, lang } = useI18n();
  const m = t.payments.mobile;
  const { bill, supplier, quote } = item;
  const RailIcon = RAIL_ICONS[quote.rail];
  const differs = quote.arrivalDate !== payDate;
  const reason = reasonLabel(quote.reason, t);
  const addedBy = item.supplierAddedBy ? (lang === "ar" ? item.supplierAddedBy.nameAr : item.supplierAddedBy.name) : "";

  return (
    <article className={cn("rounded-2xl border bg-card p-3", className)} data-bill-id={bill.id}>
      <div className="flex gap-3">
        <InvoiceThumb bill={bill} size="md" />
        <div className="min-w-0 flex-1">
          <SupplierName
            nameEn={supplier?.nameEn ?? bill.sadad?.billerName ?? bill.supplierName}
            nameAr={supplier?.nameAr ?? bill.sadad?.billerNameAr ?? bill.supplierNameAr}
            className="text-sm"
          />
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            <span dir="ltr">{billReference(bill, t)}</span>
            {bill.dueDate ? ` · ${fmt(t.bills.approvals.due, { date: formatPlainDate(bill.dueDate, lang) })}` : null}
          </p>
          <Amount
            value={bill.total}
            className="mt-2 block text-xl leading-tight font-medium"
            currencyClassName="text-sm font-normal text-muted-foreground"
          />
          <p className="mt-1.5 flex items-start gap-1 text-xs">
            <RailIcon className="mt-px size-3.5 shrink-0 text-primary" aria-hidden />
            <span>
              <span className="font-medium">{t.payments.rails[quote.rail]}</span>
              {" · "}
              {fmt(t.payments.arrives, { date: formatArrival(quote.arrivalDate, lang) })}
            </span>
          </p>
          {differs && reason ? <p className="mt-0.5 text-xs text-warning-foreground">{reason}</p> : null}
          {supplier ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {fmt(m.iban, { iban: maskIban(supplier.iban) })} · {supplier.bankName}
            </p>
          ) : bill.sadad ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">{fmt(t.payments.biller, { code: bill.sadad.billerCode })}</p>
          ) : null}
        </div>
      </div>
      {item.firstPayment ? (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-warning px-2.5 py-2 text-xs text-warning-foreground">
          <UserPlus className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>{fmt(m.firstPayment, { name: addedBy })}</span>
        </p>
      ) : null}
    </article>
  );
}
