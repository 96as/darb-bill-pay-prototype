"use client";

import Link from "next/link";
import { BadgeCheck, Landmark, PauseCircle, Plus, UserPlus } from "lucide-react";
import { ArabicText } from "@/components/darb/arabic-text";
import { InitialAvatar } from "@/components/darb/initial-avatar";
import { MockBadge } from "@/components/darb/mock-badge";
import { NameCheckBadge } from "@/components/darb/name-check-badge";
import { Panel, PanelHeader, ViewAllLink } from "@/components/darb/panel";
import { SourceChip } from "@/components/darb/source-chip";
import { SupplierName } from "@/components/darb/supplier-name";
import { buttonVariants } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { useBill } from "./bill-context";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-center gap-2">{children}</span>
    </div>
  );
}

/** Who gets paid: the matched supplier (BP-05), a new supplier to add, or the SADAD biller (BP-12). */
export function BillSupplier() {
  const { t, lang } = useI18n();
  const { view } = useBill();
  const { bill, supplier, suggested } = view;

  if (bill.kind === "sadad" && bill.sadad) {
    return (
      <Panel>
        <PanelHeader title={t.billDetail.supplier.sadadTitle} />
        <div className="flex items-center gap-3 px-5 pb-5">
          <InitialAvatar name={bill.sadad.billerName} icon={Landmark} />
          <SupplierName nameEn={bill.sadad.billerName} nameAr={bill.sadad.billerNameAr} className="text-sm" />
        </div>
      </Panel>
    );
  }

  if (supplier) {
    return (
      <Panel>
        <PanelHeader
          title={t.billDetail.supplier.title}
          action={<ViewAllLink href={`/bills/suppliers/${supplier.id}`}>{t.billDetail.supplier.view}</ViewAllLink>}
        />
        <div className="space-y-3 px-5 pb-5">
          <div className="flex items-start gap-3">
            <InitialAvatar name={lang === "ar" ? supplier.nameAr : supplier.nameEn} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <SupplierName nameEn={supplier.nameEn} nameAr={supplier.nameAr} className="text-sm" />
              {supplier.matchedByVat ? (
                <span className="inline-flex h-6 items-center gap-1 rounded-full bg-success-surface px-2.5 text-xs font-medium text-success">
                  <BadgeCheck className="size-3.5" aria-hidden />
                  {t.billDetail.supplier.matchedByVat}
                </span>
              ) : null}
            </div>
          </div>
          {supplier.paused ? (
            <p className="flex items-start gap-2 rounded-lg bg-warning/70 px-3 py-2 text-xs text-warning-foreground">
              <PauseCircle className="mt-px size-3.5 shrink-0" aria-hidden />
              {t.suppliers.paused}
            </p>
          ) : null}
          <div className="divide-y rounded-lg border px-3">
            <Row label={t.billDetail.fields.supplierVat}>
              <span dir="ltr" className="tabular-nums">{supplier.vatNumber}</span>
            </Row>
            <Row label={t.billDetail.supplier.iban}>
              <span dir="ltr" className="tabular-nums">{supplier.ibanMasked}</span>
              <span className="text-muted-foreground">· {lang === "ar" ? supplier.bankNameAr : supplier.bankName}</span>
            </Row>
            <Row label={t.billDetail.supplier.nameCheck}>
              <NameCheckBadge result={supplier.nameCheck.result} confirmed={Boolean(supplier.nameCheck.confirmedBy)} />
              <MockBadge tooltip={t.suppliers.nameCheckTooltip} />
            </Row>
            <Row label={t.suppliers.screening}>
              <span className={cn("text-sm", supplier.screening === "cleared" ? "text-success" : "text-warning-foreground")}>
                {t.suppliers.screeningStatus[supplier.screening]}
              </span>
            </Row>
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel className="border-warning-foreground/30">
      <PanelHeader title={t.billDetail.supplier.title} />
      <div className="space-y-4 px-5 pb-5">
        <div className="flex items-start gap-3 rounded-lg bg-warning/60 px-3 py-3">
          <UserPlus className="mt-0.5 size-4 shrink-0 text-warning-foreground" aria-hidden />
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{t.billDetail.supplier.newSupplier}</p>
            <p className="text-xs text-foreground/75">{t.billDetail.supplier.newSupplierHelp}</p>
          </div>
        </div>
        {suggested ? (
          <div className="divide-y rounded-lg border px-3">
            {suggested.name ? (
              <Row label={t.suppliers.form.nameEn}>
                <span className="truncate">{suggested.name}</span>
              </Row>
            ) : null}
            {suggested.nameAr ? (
              <Row label={t.suppliers.form.nameAr}>
                <ArabicText className="truncate">{suggested.nameAr}</ArabicText>
              </Row>
            ) : null}
            {suggested.vat ? (
              <Row label={t.billDetail.fields.supplierVat}>
                <span dir="ltr" className="tabular-nums">{suggested.vat}</span>
              </Row>
            ) : null}
            {suggested.ibanMasked ? (
              <Row label={t.billDetail.supplier.ibanFromInvoice}>
                <span dir="ltr" className="tabular-nums">{suggested.ibanMasked}</span>
                {suggested.bankName ? (
                  <span className="text-muted-foreground">· {lang === "ar" ? suggested.bankNameAr : suggested.bankName}</span>
                ) : null}
                {bill.extraction === "e_invoice" ? <SourceChip kind="e_invoice" /> : null}
              </Row>
            ) : null}
          </div>
        ) : null}
        <Link href={`/bills/suppliers/new?fromBill=${bill.id}`} className={cn(buttonVariants({ size: "lg" }), "w-full")}>
          <Plus aria-hidden />
          {t.billDetail.supplier.addSupplier}
        </Link>
      </div>
    </Panel>
  );
}
