"use client";

import Link from "next/link";
import { CalendarCheck, ChevronRight } from "lucide-react";
import { Amount } from "@/components/darb/amount";
import { EmptyState } from "@/components/darb/empty-state";
import { Panel, PanelHeader } from "@/components/darb/panel";
import { RunStatusBadge } from "@/components/darb/payment-badges";
import { formatDayDate } from "@/components/darb/payment-format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { plural } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import type { RunRow } from "../data";
import { NewRunLink } from "./new-run-link";

// Same gutters as the bills table: first/last columns line up with the card header (px-5).
const edges = "px-3 first:ps-5 last:pe-5 xl:px-4 xl:first:ps-5 xl:last:pe-5";
const head = `h-10 ${edges} text-xs font-medium text-muted-foreground`;
const cell = `${edges} py-3`;

export function RunsTable({ rows }: { rows: RunRow[] }) {
  const { t, lang } = useI18n();
  const p = t.payments.runs;
  return (
    <Panel>
      <PanelHeader title={p.listTitle} description={plural(lang, p.count, rows.length)} />
      {rows.length === 0 ? (
        <div className="border-t">
          <EmptyState
            icon={CalendarCheck}
            title={p.emptyTitle}
            description={p.emptyDescription}
            action={<NewRunLink />}
            className="py-16"
          />
        </div>
      ) : (
        <Table className="border-t">
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn(head, "w-[32%]")}>{p.columns.name}</TableHead>
              <TableHead className={head}>{p.columns.payDate}</TableHead>
              <TableHead className={cn(head, "text-end")}>{p.columns.bills}</TableHead>
              <TableHead className={cn(head, "text-end")}>{p.columns.total}</TableHead>
              <TableHead className={head}>{p.columns.status}</TableHead>
              <TableHead className={head}>{p.columns.createdBy}</TableHead>
              <TableHead className={cn(head, "w-10")}>
                <span className="sr-only">{p.columns.name}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} data-run-id={row.id} className="relative">
                <TableCell className={cn(cell, "max-w-0 min-w-56")}>
                  <Link
                    href={`/bills/runs/${row.id}`}
                    className="block truncate font-medium outline-none after:absolute after:inset-0 focus-visible:underline"
                  >
                    {row.name}
                  </Link>
                </TableCell>
                <TableCell className={cn(cell, "tabular-nums")}>{formatDayDate(row.payDate, lang)}</TableCell>
                <TableCell className={cn(cell, "text-end tabular-nums")}>{row.billCount}</TableCell>
                <TableCell className={cn(cell, "text-end font-medium")}>
                  <Amount value={row.total} />
                </TableCell>
                <TableCell className={cell}>
                  <RunStatusBadge status={row.status} />
                </TableCell>
                <TableCell className={cn(cell, "text-muted-foreground")}>
                  {row.createdBy ? (lang === "ar" ? row.createdBy.nameAr : row.createdBy.name) : "—"}
                </TableCell>
                <TableCell className={cell}>
                  <ChevronRight className="size-4 text-muted-foreground rtl:rotate-180" aria-hidden />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}
