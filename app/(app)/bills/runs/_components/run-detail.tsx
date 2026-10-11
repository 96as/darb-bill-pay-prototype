"use client";

import { useState } from "react";
import Link from "next/link";
import { Collapsible } from "@base-ui/react/collapsible";
import { ArrowLeft, ChevronDown, Info, Send, Smartphone } from "lucide-react";
import { Amount } from "@/components/darb/amount";
import { ExpectedArrival } from "@/components/darb/expected-arrival";
import { InvoiceThumb } from "@/components/darb/invoice-preview";
import { PageHeader } from "@/components/darb/page-header";
import { Panel, PanelHeader } from "@/components/darb/panel";
import { useApiAction } from "@/components/darb/payment-actions";
import { PaymentStatusBadge, RailChip, RunStatusBadge } from "@/components/darb/payment-badges";
import { billReference, formatDayDate, formatInstant, permissionMessage } from "@/components/darb/payment-format";
import { runApprovalHint } from "@/components/darb/payment-rules";
import { PaymentSection } from "@/components/darb/payment-section";
import { useDemoState } from "@/components/darb/shell/demo-state";
import { ShellTitleOverride } from "@/components/darb/shell/shell-title";
import { StatusBadge } from "@/components/darb/status-badge";
import { SupplierName } from "@/components/darb/supplier-name";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatSAR } from "@/lib/domain/money";
import { displayStatus } from "@/lib/domain/status";
import type { Lang } from "@/lib/i18n";
import { fmt, plural } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import type { RunBillItem, RunDetailView } from "../data";

const edges = "px-3 first:ps-5 last:pe-5 xl:px-4 xl:first:ps-5 xl:last:pe-5";
const head = `h-10 ${edges} text-xs font-medium text-muted-foreground`;
const cell = `${edges} py-3 align-top`;

export function RunDetail({ view }: { view: RunDetailView }) {
  const { t, lang } = useI18n();
  const d = t.payments.detail;
  const { actingUserId } = useDemoState();
  const { run: call, busy } = useApiAction();
  const { run } = view;
  const runPath = `/api/payment-runs/${encodeURIComponent(run.id)}`;

  const person = (id?: string) => {
    if (!id) return undefined;
    const p = view.people[id];
    return p ? (lang === "ar" ? p.nameAr : p.name) : id;
  };
  const accountName = (id: string) => {
    const a = view.accounts.find((x) => x.id === id);
    return a ? (lang === "ar" ? a.nameAr : a.name) : id;
  };

  const awaiting = run.status === "awaiting_approval";
  const hint = awaiting ? runApprovalHint(actingUserId, run, view.approval) : null;
  const hintText =
    hint && !hint.ok
      ? permissionMessage(hint, t, lang, { bills: view.approval.bills, suppliers: view.approval.suppliers })
      : null;
  const fundingIds = [...new Set(view.items.map((i) => i.payment?.fundingAccountId ?? i.bill.fundingAccountId))];
  const lastApproval = run.approvals.at(-1);
  const withPayments = view.items.filter((i) => i.payment);
  const count = view.items.filter((i) => i.bill.status !== "cancelled").length;

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6">
      <ShellTitleOverride
        crumbs={[
          { label: t.nav.bills, href: "/bills" },
          { label: t.billsNav.runs, href: "/bills/runs" },
          { label: run.name },
        ]}
      />
      <div className="space-y-3">
        <Link
          href="/bills/runs"
          className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {d.back}
        </Link>
        <PageHeader
          title={
            <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
              {run.name}
              <RunStatusBadge status={run.status} />
            </span>
          }
          description={`${formatDayDate(run.payDate, lang)} · ${plural(lang, t.payments.bills, count)} · ${formatSAR(view.total, lang)}`}
          actions={
            <>
              <Link
                href={`/m/runs/${encodeURIComponent(run.id)}`}
                className={buttonVariants({ variant: "pill", size: "lg", className: "px-4" })}
              >
                <Smartphone aria-hidden />
                {d.openOnMobile}
              </Link>
              {run.status === "draft" ? (
                <Button
                  size="lg"
                  className="px-4"
                  disabled={busy !== null}
                  onClick={() => call("submit", `${runPath}/submit`, {}, { success: d.submittedToast })}
                >
                  <Send aria-hidden className="rtl:-scale-x-100" />
                  {d.submit}
                </Button>
              ) : null}
              {awaiting ? (
                <>
                  <RejectButton
                    disabled={!hint?.ok || busy !== null}
                    onConfirm={() => call("reject", `${runPath}/reject`, {}, { success: d.rejectedToast })}
                  />
                  <Button
                    size="lg"
                    className="px-4"
                    disabled={!hint?.ok || busy !== null}
                    onClick={() => call("approve", `${runPath}/approve`, {}, { success: d.approvedToast })}
                  >
                    {d.approve} · {formatSAR(view.total, lang)}
                  </Button>
                </>
              ) : null}
            </>
          }
        />
        {hintText ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground" role="note">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{hintText}</span>
          </p>
        ) : null}
      </div>

      {/* Who and when */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetaCard
          label={d.payDate}
          value={formatDayDate(run.payDate, lang)}
          sub={fmt(d.fromAccount, { account: fundingIds.map(accountName).join(" + ") })}
        />
        <MetaCard label={d.createdBy} value={person(run.createdBy)} sub={formatInstant(run.createdAt, lang)} />
        <MetaCard
          label={d.submittedBy}
          value={run.submittedBy ? person(run.submittedBy) : d.notSubmitted}
          sub={run.submittedAt ? formatInstant(run.submittedAt, lang) : undefined}
          muted={!run.submittedBy}
        />
        <MetaCard
          label={d.approval}
          value={lastApproval ? person(lastApproval.userId) : awaiting ? d.waitingApprover : "—"}
          sub={lastApproval ? formatInstant(lastApproval.at, lang) : undefined}
          muted={!lastApproval}
        />
      </div>

      {/* Bills: invoice, amount, rail, expected arrival, payment status, transfer ref */}
      <Panel>
        <PanelHeader title={d.billsTitle} description={plural(lang, t.payments.bills, count)} />
        <Table className="border-t">
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className={head}>{d.columns.invoice}</TableHead>
              <TableHead className={head}>{d.columns.supplier}</TableHead>
              <TableHead className={cn(head, "text-end")}>{d.columns.amount}</TableHead>
              <TableHead className={head}>{d.columns.rail}</TableHead>
              <TableHead className={head}>{d.columns.arrival}</TableHead>
              <TableHead className={head}>
                {d.columns.payment} · {d.columns.transferRef}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.items.map((item) => (
              <TableRow key={item.bill.id} data-bill-id={item.bill.id}>
                <TableCell className={cn(cell, "py-2.5")}>
                  <div className="flex items-start gap-3">
                    <InvoiceThumb bill={item.bill} size="sm" />
                    <Link
                      href={`/bills/${encodeURIComponent(item.bill.id)}`}
                      dir="ltr"
                      className="pt-0.5 tabular-nums hover:text-primary hover:underline"
                    >
                      {item.bill.sadad?.billNumber ?? item.bill.invoiceNumber}
                    </Link>
                  </div>
                </TableCell>
                <TableCell className={cn(cell, "w-full max-w-0 min-w-44")}>
                  <SupplierName
                    nameEn={item.supplier?.nameEn ?? item.bill.sadad?.billerName ?? item.bill.supplierName}
                    nameAr={item.supplier?.nameAr ?? item.bill.sadad?.billerNameAr ?? item.bill.supplierNameAr}
                  />
                </TableCell>
                <TableCell className={cn(cell, "text-end")}>
                  <Amount value={item.bill.total} className="font-medium" />
                  <div className="text-xs text-muted-foreground">
                    {accountName(item.payment?.fundingAccountId ?? item.bill.fundingAccountId)}
                  </div>
                </TableCell>
                <TableCell className={cell}>
                  <RailChip rail={item.quote.rail} />
                </TableCell>
                <TableCell className={cn(cell, "w-44 min-w-36 whitespace-normal")}>
                  <ExpectedArrival quote={item.quote} payDate={run.payDate} />
                </TableCell>
                <TableCell className={cell}>
                  {item.payment ? (
                    <PaymentStatusBadge payment={item.payment} />
                  ) : (
                    <StatusBadge status={displayStatus(item.bill, view.today)} />
                  )}
                  {item.payment?.transferRef ? (
                    <div dir="ltr" className="mt-1 w-fit font-mono text-xs text-muted-foreground" title={d.columns.transferRef}>
                      {item.payment.transferRef}
                    </div>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableCell className={cn(edges, "py-3")} colSpan={2}>
                {d.total}
              </TableCell>
              <TableCell className={cn(edges, "py-3 text-end")}>
                <Amount value={view.total} />
              </TableCell>
              <TableCell className={edges} colSpan={3} />
            </TableRow>
          </TableFooter>
        </Table>
        {run.status === "draft" || awaiting ? (
          <p className="flex items-start gap-2 border-t px-5 py-3 text-xs text-muted-foreground">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            {t.payments.newRun.independence}
          </p>
        ) : null}
      </Panel>

      {withPayments.length > 0 ? (
        <Panel>
          <PanelHeader title={d.paymentsTitle} description={d.paymentsDescription} />
          <ul className="border-t">
            {withPayments.map((item, i) => (
              <PaymentDisclosure
                key={item.bill.id}
                item={item}
                lang={lang}
                defaultOpen={i === withPayments.findIndex((x) => x.payment?.status === "sent" || x.payment?.status === "settled")}
              />
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}

function MetaCard({ label, value, sub, muted }: { label: string; value?: string; sub?: string; muted?: boolean }) {
  return (
    <section className="rounded-xl border bg-card px-5 py-4">
      <h2 className="text-xs font-normal text-muted-foreground">{label}</h2>
      <p className={cn("mt-1 truncate text-sm font-medium", muted && "font-normal text-muted-foreground")}>{value ?? "—"}</p>
      {sub ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p> : null}
    </section>
  );
}

function RejectButton({ disabled, onConfirm }: { disabled: boolean; onConfirm: () => void }) {
  const { t } = useI18n();
  const d = t.payments.detail;
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="lg" className="px-4" disabled={disabled} />}>
        {d.reject}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{d.rejectTitle}</DialogTitle>
          <DialogDescription>{d.rejectDescription}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{t.payments.cancel}</DialogClose>
          <Button
            variant="destructive"
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            {d.rejectConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One paid (or scheduled) bill: summary row that expands into its PaymentSection. */
function PaymentDisclosure({ item, lang, defaultOpen }: { item: RunBillItem; lang: Lang; defaultOpen: boolean }) {
  const { t } = useI18n();
  const payment = item.payment!;
  return (
    <li className="border-b last:border-0">
      <Collapsible.Root defaultOpen={defaultOpen}>
        <Collapsible.Trigger className="group/disclosure flex w-full items-center gap-3 px-5 py-3 text-start outline-none hover:bg-muted/50 focus-visible:bg-muted/50">
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]/disclosure:rotate-180"
            aria-hidden
          />
          <SupplierName
            nameEn={item.supplier?.nameEn ?? item.bill.sadad?.billerName ?? item.bill.supplierName}
            nameAr={item.supplier?.nameAr ?? item.bill.sadad?.billerNameAr ?? item.bill.supplierNameAr}
            className="min-w-0 flex-1 text-sm"
          />
          <span dir="ltr" className="hidden text-sm text-muted-foreground tabular-nums sm:inline">
            {billReference(item.bill, t)}
          </span>
          <Amount value={payment.amount} className="text-sm font-medium" />
          <PaymentStatusBadge payment={{ status: payment.status }} />
        </Collapsible.Trigger>
        <Collapsible.Panel className="bg-background-secondary px-5 py-5">
          <PaymentSection
            bill={item.bill}
            payment={payment}
            notice={item.notice}
            accountingEntries={item.accounting}
            supplier={item.supplier}
            lang={lang}
          />
        </Collapsible.Panel>
      </Collapsible.Root>
    </li>
  );
}
