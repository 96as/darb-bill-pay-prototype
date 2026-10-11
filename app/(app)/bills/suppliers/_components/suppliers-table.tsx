"use client";

import Link from "next/link";
import { PauseCircle, Plus, Users } from "lucide-react";
import { Amount } from "@/components/darb/amount";
import { EmptyState } from "@/components/darb/empty-state";
import { MockBadge } from "@/components/darb/mock-badge";
import { NameCheckBadge } from "@/components/darb/name-check-badge";
import { Panel, PanelHeader } from "@/components/darb/panel";
import { SupplierName } from "@/components/darb/supplier-name";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { plural } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import type { SupplierRow } from "../data";

export function AddSupplierButton() {
  const { t } = useI18n();
  return (
    <Link href="/bills/suppliers/new" className={cn(buttonVariants({ size: "lg" }), "px-4")}>
      <Plus aria-hidden />
      {t.suppliers.add}
    </Link>
  );
}

const edges = "px-3 first:ps-5 last:pe-5 xl:px-4 xl:first:ps-5 xl:last:pe-5";
const head = `h-10 ${edges} text-xs font-medium text-muted-foreground`;
const cell = `${edges} py-3`;

/** Saved suppliers (BP-05..07): names EN+AR, VAT, masked IBAN + bank, name check, paused status. */
export function SuppliersTable({ rows }: { rows: SupplierRow[] }) {
  const { t, lang } = useI18n();
  return (
    <Panel>
      <PanelHeader
        title={t.suppliers.title}
        description={t.suppliers.description}
        action={<MockBadge tooltip={t.suppliers.nameCheckTooltip} />}
      />
      {rows.length === 0 ? (
        <EmptyState icon={Users} title={t.suppliers.empty} description={t.suppliers.emptyDescription} className="border-t" />
      ) : (
        <Table className="border-t">
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn(head, "w-[30%]")}>{t.suppliers.columns.name}</TableHead>
              <TableHead className={cn(head, "hidden lg:table-cell")}>{t.suppliers.columns.vat}</TableHead>
              <TableHead className={head}>{t.suppliers.columns.iban}</TableHead>
              <TableHead className={head}>{t.suppliers.columns.nameCheck}</TableHead>
              <TableHead className={head}>{t.suppliers.columns.status}</TableHead>
              <TableHead className={cn(head, "text-end")}>{t.suppliers.columns.owed}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className="relative cursor-pointer">
                <TableCell className={cn(cell, "max-w-0 min-w-48")}>
                  <Link
                    href={`/bills/suppliers/${row.id}`}
                    className="block outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset"
                  >
                    <SupplierName nameEn={row.nameEn} nameAr={row.nameAr} />
                  </Link>
                </TableCell>
                <TableCell className={cn(cell, "hidden tabular-nums lg:table-cell")}>
                  <span dir="ltr">{row.vatNumber}</span>
                </TableCell>
                <TableCell className={cell}>
                  <div dir="ltr" className="w-fit tabular-nums">{row.ibanMasked}</div>
                  <div className="text-xs text-muted-foreground">{lang === "ar" ? row.bank.nameAr : row.bank.name}</div>
                </TableCell>
                <TableCell className={cell}>
                  <NameCheckBadge result={row.nameCheck} confirmed={row.nameCheckConfirmed} />
                </TableCell>
                <TableCell className={cn(cell, "whitespace-normal")}>
                  {row.paused ? (
                    <span className="inline-flex max-w-64 items-start gap-1.5 rounded-lg bg-warning px-2.5 py-1 text-xs font-medium text-warning-foreground">
                      <PauseCircle className="mt-px size-3.5 shrink-0" aria-hidden />
                      {t.suppliers.paused}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">{t.suppliers.active}</span>
                  )}
                </TableCell>
                <TableCell className={cn(cell, "text-end")}>
                  <Amount value={row.owed} className="font-medium" />
                  <div className="text-xs text-muted-foreground">{plural(lang, t.bills.owed.bills, row.openBills)}</div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}
