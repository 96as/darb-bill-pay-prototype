"use client";

import Link from "next/link";
import { ArrowLeft, Landmark } from "lucide-react";
import { Amount } from "@/components/darb/amount";
import { InitialAvatar } from "@/components/darb/initial-avatar";
import { StatusBadge } from "@/components/darb/status-badge";
import { SupplierName } from "@/components/darb/supplier-name";
import { ShellTitleOverride } from "@/components/darb/shell/shell-title";
import { fmt } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { formatDate } from "@/lib/ui/format";
import { useBill } from "./bill-context";

export function BillHeader() {
  const { t, lang } = useI18n();
  const { view } = useBill();
  const { bill, status } = view;
  const name = bill.sadad?.billerName ?? bill.supplierName;
  const nameAr = bill.sadad?.billerNameAr ?? bill.supplierNameAr;
  const reference =
    bill.kind === "sadad" && bill.sadad
      ? fmt(t.billDetail.sadadNo, { number: bill.sadad.billNumber })
      : fmt(t.billDetail.invoiceNo, { number: bill.invoiceNumber });

  return (
    <div className="space-y-4">
      <ShellTitleOverride
        crumbs={[{ label: t.nav.bills, href: "/bills" }, { label: bill.sadad?.billNumber ?? bill.invoiceNumber }]}
      />
      <Link href="/bills" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {t.billDetail.back}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {bill.kind === "sadad" ? <InitialAvatar name={name} icon={Landmark} /> : <InitialAvatar name={lang === "ar" && nameAr ? nameAr : name} />}
          <div className="min-w-0">
            <h1 className="sr-only">{reference}</h1>
            <SupplierName nameEn={name} nameAr={nameAr} className="text-xl [&>div:first-child]:text-xl [&>div:first-child]:font-medium" />
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              <span dir="ltr">{reference}</span>
              {bill.dueDate ? <span>· {t.bills.columns.dueDate} {formatDate(bill.dueDate, lang)}</span> : null}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Amount value={bill.total} className="text-2xl font-medium" currencyClassName="text-base font-normal text-muted-foreground" />
          <StatusBadge status={status} />
        </div>
      </div>
    </div>
  );
}
