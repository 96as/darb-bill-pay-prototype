"use client";

import Link from "next/link";
import { CopyX, FileText, Landmark, Mail, PenLine, ReceiptText, SearchX, Upload, type LucideIcon } from "lucide-react";
import { Amount } from "@/components/darb/amount";
import { EmptyState } from "@/components/darb/empty-state";
import { Panel, PanelHeader } from "@/components/darb/panel";
import { SourceChip } from "@/components/darb/source-chip";
import { StatusBadge } from "@/components/darb/status-badge";
import { SupplierName } from "@/components/darb/supplier-name";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmt, plural } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { formatDate } from "@/lib/ui/format";
import { cn } from "@/lib/utils";
import type { BillRow, BillsView } from "../data";
import { BillsFilters } from "./bills-filters";

const SOURCE_ICONS: Record<BillRow["source"], LucideIcon> = {
  email: Mail,
  upload: Upload,
  manual: PenLine,
  sadad: Landmark,
  seed: FileText,
};

// First/last columns line up with the card header (px-5); tighter gutters below xl.
const edges = "px-3 first:ps-5 last:pe-5 xl:px-4 xl:first:ps-5 xl:last:pe-5";
const head = `h-10 ${edges} text-xs font-medium text-muted-foreground`;
const cell = `${edges} py-3`;

function SourceLabel({ row, iconOnly }: { row: BillRow; iconOnly?: boolean }) {
  const { t } = useI18n();
  const Icon = SOURCE_ICONS[row.source];
  const label = t.bills.sources[row.source];
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground" title={iconOnly ? label : undefined}>
      <Icon className={iconOnly ? "size-3.5 shrink-0" : "size-4 shrink-0"} aria-hidden />
      <span className={iconOnly ? "sr-only" : undefined}>{label}</span>
    </span>
  );
}

/** "From e-invoice" for ZATCA XML bills, "Check fields" for OCR bills with fields to review. */
function SourceChips({ row, className }: { row: BillRow; className?: string }) {
  const { t } = useI18n();
  const chip =
    row.extraction === "e_invoice" ? (
      <SourceChip kind="e_invoice" className="relative z-10" />
    ) : row.extraction === "ocr" && row.needsReviewCount > 0 ? (
      <SourceChip kind="check" label={t.bills.checkFields} className="relative z-10" />
    ) : null;
  if (!chip && !row.duplicate) return null;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {chip}
      {row.duplicate ? (
        <span className="inline-flex h-5 items-center gap-1 rounded-full bg-error px-2 text-[11px] font-medium whitespace-nowrap text-error-foreground">
          <CopyX className="size-3" aria-hidden />
          {t.bills.duplicateChip}
        </span>
      ) : null}
    </span>
  );
}

/** Bills table (BP-11, BP-12): supplier, invoice no., source, due date, amount, status. */
export function BillsTableCard({ view }: { view: Pick<BillsView, "rows" | "totalCount" | "filters"> }) {
  const { t, lang } = useI18n();
  const filtered = Boolean(view.filters.status || view.filters.dueBefore);
  const countLabel = filtered
    ? `${view.rows.length} / ${plural(lang, t.bills.list.count, view.totalCount)}`
    : plural(lang, t.bills.list.count, view.totalCount);

  return (
    <Panel>
      <PanelHeader title={t.bills.list.title} description={countLabel} className="items-end">
        <BillsFilters filters={view.filters} />
      </PanelHeader>
      {view.rows.length === 0 ? (
        <div className="border-t">
          {filtered ? (
            <EmptyState icon={SearchX} title={t.bills.list.noMatchTitle} description={t.bills.list.noMatchDescription} />
          ) : (
            <EmptyState icon={ReceiptText} title={t.bills.list.emptyTitle} description={t.bills.list.emptyDescription} />
          )}
        </div>
      ) : (
        <Table className="border-t">
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn(head, "w-[34%]")}>{t.bills.columns.supplier}</TableHead>
              <TableHead className={head}>{t.bills.columns.invoiceNo}</TableHead>
              <TableHead className={cn(head, "hidden xl:table-cell")}>{t.bills.columns.source}</TableHead>
              <TableHead className={head}>{t.bills.columns.dueDate}</TableHead>
              <TableHead className={cn(head, "text-end")}>{t.bills.columns.amount}</TableHead>
              <TableHead className={head}>{t.bills.columns.status}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.rows.map((row) => (
              <TableRow key={row.id} data-bill-id={row.id} className="relative cursor-pointer">
                <TableCell className={cn(cell, "max-w-0 min-w-44")}>
                  {/* The link covers the whole row (after:inset-0); chips sit above it for their tooltips. */}
                  <Link
                    href={`/bills/${row.id}`}
                    className="block outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset"
                  >
                    <SupplierName nameEn={row.supplierName} nameAr={row.supplierNameAr} />
                  </Link>
                </TableCell>
                <TableCell className={cell}>
                  <div className="flex items-center gap-1.5 tabular-nums">
                    {/* Below xl the Source column folds into this cell: icon here, chip underneath. */}
                    <span className="xl:hidden">
                      <SourceLabel row={row} iconOnly />
                    </span>
                    <span dir="ltr">{row.invoiceNumber}</span>
                  </div>
                  {row.billerCode ? (
                    <div className="text-xs text-muted-foreground">{fmt(t.bills.biller, { code: row.billerCode })}</div>
                  ) : null}
                  <SourceChips row={row} className="mt-1 xl:hidden" />
                </TableCell>
                <TableCell className={cn(cell, "hidden xl:table-cell")}>
                  <div className="flex flex-col items-start gap-1">
                    <SourceLabel row={row} />
                    <SourceChips row={row} />
                  </div>
                </TableCell>
                <TableCell
                  className={cn(cell, "tabular-nums", row.displayStatus === "overdue" && "text-error-foreground")}
                >
                  {row.dueDate ? formatDate(row.dueDate, lang) : <span className="text-muted-foreground">{t.bills.noDueDate}</span>}
                </TableCell>
                <TableCell className={cn(cell, "text-end font-medium")}>
                  <Amount value={row.total} />
                </TableCell>
                <TableCell className={cell}>
                  <StatusBadge status={row.displayStatus} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}
