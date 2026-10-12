"use client";

import Link from "next/link";
import { CircleCheck, FileCode, Pencil, ScanText } from "lucide-react";
import { ConfirmDialog } from "@/components/darb/confirm-dialog";
import { Notice } from "@/components/darb/notice";
import { Button } from "@/components/ui/button";
import { fmt } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { api } from "@/lib/ui/api";
import { formatDateTime } from "@/lib/ui/format";
import { useApiAction } from "@/lib/ui/use-api-action";
import { isEditable, useBill } from "./bill-context";

/** Banners at the top of a bill: cancelled, duplicate (BP-04), reading source (BP-03), paused supplier (BP-07). */
export function BillBanners() {
  const { t, lang } = useI18n();
  const { view, setEditing } = useBill();
  const { bill, duplicateOf, supplier } = view;
  const { run, pending } = useApiAction();
  const open = bill.status !== "cancelled" && bill.status !== "paid" && bill.status !== "discarded";

  const banners: React.ReactNode[] = [];

  if (bill.status === "cancelled") {
    banners.push(
      <Notice key="cancelled" tone="muted" title={t.billDetail.banners.cancelledTitle}>
        {fmt(t.billDetail.banners.cancelled, {
          name: view.cancelledBy ? (lang === "ar" ? view.cancelledBy.nameAr : view.cancelledBy.name) : "—",
          date: bill.cancelledAt ? formatDateTime(bill.cancelledAt, lang) : "—",
        })}
      </Notice>,
    );
  }

  if (bill.status === "discarded") {
    banners.push(
      <Notice key="discarded" tone="muted" title={t.billDetail.banners.discardedTitle}>
        {fmt(t.billDetail.banners.discardedBody, {
          name: view.discardedBy ? (lang === "ar" ? view.discardedBy.nameAr : view.discardedBy.name) : "—",
          date: bill.discardedAt ? formatDateTime(bill.discardedAt, lang) : "—",
        })}
      </Notice>,
    );
  }

  if (bill.duplicateOf && open) {
    const reason =
      bill.duplicateReason === "invoice_uuid" ? t.billDetail.banners.reasonUuid : t.billDetail.banners.reasonNumber;
    banners.push(
      <Notice
        key="duplicate"
        tone="error"
        title={t.billDetail.banners.duplicateTitle}
        actions={
          <>
            {duplicateOf ? (
              <Link href={`/bills/${duplicateOf.id}`} className="text-sm font-medium text-primary hover:underline hover:underline-offset-4">
                {t.billDetail.banners.viewOriginal}
              </Link>
            ) : null}
            <span className="ms-auto flex flex-wrap gap-2">
              <ConfirmDialog
                trigger={<Button variant="destructive" />}
                title={t.billDetail.banners.discard}
                description={fmt(t.billDetail.banners.duplicate, { invoice: duplicateOf?.invoiceNumber ?? bill.invoiceNumber, reason })}
                confirmLabel={t.billDetail.banners.discard}
                cancelLabel={t.ui.cancel}
                destructive
                onConfirm={() => run(() => api.post(`/api/bills/${bill.id}/discard`), { success: t.billDetail.banners.discarded })}
              >
                {t.billDetail.banners.discard}
              </ConfirmDialog>
              <Button
                variant="outline"
                className="bg-background"
                disabled={pending}
                onClick={() => run(() => api.post(`/api/bills/${bill.id}/dismiss-duplicate`), { success: t.billDetail.banners.dismissed })}
              >
                {t.billDetail.banners.notDuplicate}
              </Button>
            </span>
          </>
        }
      >
        {fmt(t.billDetail.banners.duplicate, {
          invoice: duplicateOf ? `${duplicateOf.invoiceNumber} · ${duplicateOf.supplierName}` : bill.invoiceNumber,
          reason,
        })}
      </Notice>,
    );
  }

  if (bill.rejection && bill.status === "draft") {
    banners.push(
      <Notice key="rejected" tone="warning" title={t.billDetail.approval.rejected}>
        {bill.rejection.reason ?? formatDateTime(bill.rejection.at, lang)}
      </Notice>,
    );
  }

  if (bill.extraction === "e_invoice") {
    const fromXmlFile = bill.file?.mime === "application/xml";
    banners.push(
      <Notice key="einvoice" tone="info" icon={FileCode} title={t.billDetail.banners.eInvoiceTitle}>
        {fromXmlFile ? t.billDetail.banners.eInvoiceXml : t.billDetail.banners.eInvoice}
      </Notice>,
    );
  }

  if (bill.extraction === "ocr" && (bill.needsReview.length === 0 || !open)) {
    banners.push(
      <Notice key="ocr-done" tone="muted" icon={ScanText} title={t.billDetail.banners.ocrTitle}>
        {t.billDetail.banners.ocrChecked}
      </Notice>,
    );
  }

  if (bill.extraction === "ocr" && bill.needsReview.length > 0 && open) {
    banners.push(
      <Notice
        key="ocr"
        tone="warning"
        icon={ScanText}
        title={t.billDetail.banners.ocrTitle}
        actions={
          isEditable(view) ? (
            <>
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  // PATCH {reviewed: [fields]} clears the OCR flags; edits go through "Edit fields".
                  run(() => api.patch(`/api/bills/${bill.id}`, { reviewed: bill.needsReview }), {
                    success: t.billDetail.banners.markedChecked,
                  })
                }
              >
                <CircleCheck aria-hidden />
                {t.billDetail.banners.markChecked}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="bg-background"
                onClick={() => {
                  setEditing(true);
                  document.getElementById("bill-fields")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                <Pencil aria-hidden />
                {t.billDetail.banners.editFields}
              </Button>
            </>
          ) : undefined
        }
      >
        {t.billDetail.banners.ocr}
      </Notice>,
    );
  }

  if (supplier?.paused && open) {
    banners.push(
      <Notice key="paused" tone="warning" title={t.billDetail.banners.pausedTitle}>
        {t.billDetail.banners.paused}{" "}
        <Link href={`/bills/suppliers/${supplier.id}`} className="font-medium text-primary hover:underline">
          {t.billDetail.supplier.view}
        </Link>
      </Notice>,
    );
  }

  return banners.length ? <div className="space-y-3">{banners}</div> : null;
}
