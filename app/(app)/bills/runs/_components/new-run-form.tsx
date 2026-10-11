"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CircleAlert, Info, ListChecks, Send, TriangleAlert, Wallet } from "lucide-react";
import { Amount } from "@/components/darb/amount";
import { EmptyState } from "@/components/darb/empty-state";
import { PageHeader } from "@/components/darb/page-header";
import { Panel, PanelHeader } from "@/components/darb/panel";
import { useApiAction } from "@/components/darb/payment-actions";
import { RailChip } from "@/components/darb/payment-badges";
import { ExpectedArrival } from "@/components/darb/expected-arrival";
import {
  billReference,
  formatInstant,
  formatPlainDate,
  permissionMessage,
} from "@/components/darb/payment-format";
import { previewQuote } from "@/components/darb/payment-rules";
import { SupplierName } from "@/components/darb/supplier-name";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { checkDaily, checkPerPayment } from "@/lib/domain/limits";
import { formatSAR } from "@/lib/domain/money";
import { isISODate, weekdayName } from "@/lib/domain/time";
import type { FundingAccount, PaymentRun, RailQuote } from "@/lib/domain/types";
import { fmt, plural } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import type { CandidateBill, NewRunView } from "../data";

const edges = "px-3 first:ps-5 last:pe-5 xl:px-4 xl:first:ps-5 xl:last:pe-5";
const head = `h-10 ${edges} text-xs font-medium text-muted-foreground`;
const cell = `${edges} py-3 align-top`;

export function NewRunForm({ view }: { view: NewRunView }) {
  const { t, lang } = useI18n();
  const n = t.payments.newRun;
  const router = useRouter();
  const { run, busy } = useApiAction();

  const addable = view.candidates.filter((c) => !c.gate);
  const mainId = view.accounts.find((a) => a.kind === "main")?.id ?? view.accounts[0]?.id ?? "main";
  const defaultName = (date: string) => fmt(n.defaultName, { date: formatPlainDate(date, lang) });

  const [payDate, setPayDate] = useState(view.today);
  const [name, setName] = useState(() => defaultName(view.today));
  const [nameTouched, setNameTouched] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(view.preselected.length > 0 ? view.preselected : addable.map((c) => c.bill.id)),
  );
  const [funding, setFunding] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      view.candidates.map((c) => [
        c.bill.id,
        view.accounts.some((a) => a.id === c.bill.fundingAccountId) ? c.bill.fundingAccountId : mainId,
      ]),
    ),
  );

  const validPayDate = isISODate(payDate) && payDate >= view.today;
  const effectiveDate = validPayDate ? payDate : view.today;

  // Promise C: rail + arrival per bill from lib/domain/rails.ts, at the demo clock.
  const quotes = useMemo<Record<string, RailQuote>>(
    () => Object.fromEntries(view.candidates.map((c) => [c.bill.id, previewQuote(c.bill, effectiveDate, view.now)])),
    [view.candidates, view.now, effectiveDate],
  );

  const chosen = addable.filter((c) => selected.has(c.bill.id));
  const total = chosen.reduce((sum, c) => sum + c.bill.total, 0);
  const overLimit = chosen.filter((c) => !checkPerPayment(c.bill.total, view.limits).ok);
  const committed = view.committedByDate[effectiveDate] ?? 0;
  const daily = checkDaily(committed, total, view.limits);
  const accountsAfter = view.accounts.map((account) => {
    const scheduled = view.scheduledByAccount[account.id] ?? 0;
    const thisRun = chosen.filter((c) => funding[c.bill.id] === account.id).reduce((sum, c) => sum + c.bill.total, 0);
    return { account, scheduled, thisRun, after: account.balance - scheduled - thisRun };
  });

  const problem = !validPayDate ? n.payDatePast : !name.trim() ? n.needName : chosen.length === 0 ? n.pickOne : null;
  const canSave = !problem && busy === null;
  const canSubmit = canSave && overLimit.length === 0;

  const allChecked = addable.length > 0 && chosen.length === addable.length;
  const someChecked = chosen.length > 0 && !allChecked;

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function changePayDate(value: string) {
    setPayDate(value);
    if (!nameTouched && isISODate(value)) setName(defaultName(value));
  }

  async function save(submit: boolean) {
    const key = submit ? "submit" : "save";
    const body = {
      name: name.trim(),
      payDate,
      billIds: chosen.map((c) => c.bill.id),
      funding: Object.fromEntries(chosen.map((c) => [c.bill.id, funding[c.bill.id]])),
    };
    const created = await run<{ run: PaymentRun }>(key, "/api/payment-runs", body, {
      refresh: false,
      success: submit ? undefined : n.savedToast,
    });
    if (!created?.run) return;
    if (submit) {
      await run(key, `/api/payment-runs/${encodeURIComponent(created.run.id)}/submit`, {}, {
        refresh: false,
        success: n.submittedToast,
      });
    }
    router.push(`/bills/runs/${encodeURIComponent(created.run.id)}`);
  }

  const accountName = (a: FundingAccount) => (lang === "ar" ? a.nameAr : a.name);
  const accountItems = view.accounts.map((a) => ({ value: a.id, label: accountName(a) }));

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6">
      <div className="space-y-3">
        <Link
          href="/bills/runs"
          className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {n.back}
        </Link>
        <PageHeader title={n.title} description={n.description} />
      </div>

      {/* Name + one pay date */}
      <Panel className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        <div className="grid gap-1.5">
          <Label htmlFor="run-name">{n.name}</Label>
          <Input
            id="run-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameTouched(true);
            }}
            className="h-9 bg-background"
            aria-invalid={!name.trim() || undefined}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="run-pay-date">
            {n.payDate}
            {isISODate(payDate) ? (
              <span className="font-normal text-muted-foreground">· {weekdayName(payDate, lang)}</span>
            ) : null}
          </Label>
          <Input
            id="run-pay-date"
            type="date"
            min={view.today}
            value={payDate}
            onChange={(e) => changePayDate(e.target.value)}
            className="h-9 bg-background"
            aria-invalid={!validPayDate || undefined}
            aria-describedby="run-pay-date-hint"
          />
          <p id="run-pay-date-hint" className={cn("text-xs", validPayDate ? "text-muted-foreground" : "text-error-foreground")}>
            {validPayDate ? fmt(n.payDateHint, { now: formatInstant(view.now, lang) }) : n.payDatePast}
          </p>
        </div>
      </Panel>

      {/* Bills with rail + expected arrival */}
      <Panel>
        <PanelHeader
          title={n.billsTitle}
          description={
            addable.length > 0 ? fmt(n.selected, { count: chosen.length, total: addable.length }) : n.billsDescription
          }
        />
        {view.candidates.length === 0 ? (
          <div className="border-t">
            <EmptyState icon={ListChecks} title={n.emptyTitle} description={n.emptyDescription} />
          </div>
        ) : (
          <Table className="border-t">
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className={cn(head, "w-10")}>
                  <Checkbox
                    checked={allChecked}
                    indeterminate={someChecked}
                    disabled={addable.length === 0}
                    onCheckedChange={(on) => setSelected(on ? new Set(addable.map((c) => c.bill.id)) : new Set())}
                    aria-label={n.selectAll}
                  />
                </TableHead>
                <TableHead className={head}>{n.columns.supplier}</TableHead>
                <TableHead className={head}>
                  {n.columns.invoiceNo} · {n.columns.dueDate}
                </TableHead>
                <TableHead className={cn(head, "text-end")}>{n.columns.amount}</TableHead>
                <TableHead className={head}>{n.columns.fundFrom}</TableHead>
                <TableHead className={head}>{n.columns.rail}</TableHead>
                <TableHead className={head}>{n.columns.arrival}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.candidates.map((c) => (
                <CandidateRow
                  key={c.bill.id}
                  candidate={c}
                  quote={quotes[c.bill.id]}
                  payDate={effectiveDate}
                  today={view.today}
                  checked={selected.has(c.bill.id) && !c.gate}
                  onCheckedChange={(on) => toggle(c.bill.id, on)}
                  overLimit={!checkPerPayment(c.bill.total, view.limits).ok}
                  perPaymentLimit={view.limits.perPayment}
                  fundingSelect={
                    <Select
                      items={accountItems}
                      value={funding[c.bill.id]}
                      onValueChange={(value) => value && setFunding((f) => ({ ...f, [c.bill.id]: String(value) }))}
                      disabled={Boolean(c.gate)}
                    >
                      <SelectTrigger size="sm" className="w-40 bg-background" aria-label={n.columns.fundFrom}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false} align="start">
                        {view.accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {fmt(n.accountOption, { name: accountName(a), amount: formatSAR(a.balance, lang) })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  }
                />
              ))}
            </TableBody>
            <TableFooter className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableCell className={cn(edges, "py-3")} colSpan={3}>
                  {n.total} · {plural(lang, t.payments.bills, chosen.length)}
                </TableCell>
                <TableCell className={cn(edges, "py-3 text-end")}>
                  <Amount value={total} />
                </TableCell>
                <TableCell className={edges} colSpan={3} />
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </Panel>

      {/* Scheduled vs available per account, limits, actions */}
      <div className="grid gap-4 lg:grid-cols-3">
        {accountsAfter.map(({ account, scheduled, thisRun, after }) => (
          <AccountCard
            key={account.id}
            name={accountName(account)}
            balance={account.balance}
            scheduled={scheduled}
            thisRun={thisRun}
            after={after}
          />
        ))}

        <Panel className="flex flex-col gap-4 p-5 lg:col-start-3 lg:row-start-1">
          <div className="space-y-1">
            <h2 className="text-base font-medium">{n.summaryTitle}</h2>
            <Amount value={total} className="text-2xl font-medium" currencyClassName="text-base font-normal text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {plural(lang, t.payments.bills, chosen.length)} · {isISODate(effectiveDate) ? formatPlainDate(effectiveDate, lang) : ""}
            </p>
          </div>

          <dl className="grid gap-2 rounded-lg bg-background-secondary px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{n.limitsTitle} · {n.perPaymentLimit}</dt>
              <dd className="font-medium tabular-nums">{formatSAR(view.limits.perPayment, lang)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{n.dailyLimit}</dt>
              <dd className="font-medium tabular-nums">{formatSAR(view.limits.daily, lang)}</dd>
            </div>
            <dd className="text-xs text-muted-foreground">
              {fmt(n.dailyUsed, {
                used: formatSAR(committed + total, lang),
                limit: formatSAR(view.limits.daily, lang),
                date: formatPlainDate(effectiveDate, lang),
              })}
            </dd>
          </dl>

          {overLimit.map((c) => (
            <Warning key={c.bill.id} tone="error">
              {billReference(c.bill, t)}:{" "}
              {fmt(n.perPaymentOver, { amount: formatSAR(c.bill.total, lang), limit: formatSAR(view.limits.perPayment, lang) })}
            </Warning>
          ))}
          {!daily.ok ? (
            <Warning tone="warning">
              {fmt(n.dailyOver, { date: formatPlainDate(effectiveDate, lang), limit: formatSAR(view.limits.daily, lang) })}
            </Warning>
          ) : null}

          <div className="mt-auto space-y-3">
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-px size-3.5 shrink-0" aria-hidden />
              <span>{n.independence}</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="lg" disabled={!canSave} onClick={() => save(false)} title={problem ?? undefined}>
                {n.saveDraft}
              </Button>
              <Button size="lg" disabled={!canSubmit} onClick={() => save(true)} title={problem ?? undefined}>
                <Send aria-hidden className="rtl:-scale-x-100" />
                {n.submit}
              </Button>
            </div>
            {problem && busy === null ? <p className="text-xs text-muted-foreground">{problem}</p> : null}
          </div>
        </Panel>
      </div>

      {view.notReady.length > 0 ? <NotReadyPanel items={view.notReady} /> : null}
    </div>
  );
}

function CandidateRow({
  candidate,
  quote,
  payDate,
  today,
  checked,
  onCheckedChange,
  overLimit,
  perPaymentLimit,
  fundingSelect,
}: {
  candidate: CandidateBill;
  quote: RailQuote;
  payDate: string;
  today: string;
  checked: boolean;
  onCheckedChange: (on: boolean) => void;
  overLimit: boolean;
  perPaymentLimit: number;
  fundingSelect: React.ReactNode;
}) {
  const { t, lang } = useI18n();
  const n = t.payments.newRun;
  const { bill, supplier, gate } = candidate;
  const overdue = !!bill.dueDate && bill.dueDate < today;
  const gateText = gate
    ? permissionMessage(gate, t, lang, { bills: [bill], suppliers: supplier ? [supplier] : [] })
    : null;

  return (
    <TableRow data-bill-id={bill.id} data-state={checked ? "selected" : undefined} className="data-[state=selected]:bg-primary-surface/40">
      <TableCell className={cell}>
        <Checkbox
          checked={checked}
          disabled={Boolean(gate)}
          onCheckedChange={(on) => onCheckedChange(on)}
          aria-label={fmt(n.selectBill, { invoice: billReference(bill, t) })}
          className="mt-0.5"
        />
      </TableCell>
      <TableCell className={cn(cell, "w-full max-w-0 min-w-44")}>
        <SupplierName
          nameEn={supplier?.nameEn ?? bill.sadad?.billerName ?? bill.supplierName}
          nameAr={supplier?.nameAr ?? bill.sadad?.billerNameAr ?? bill.supplierNameAr}
          className={gate ? "opacity-60" : undefined}
        />
        {gateText ? (
          <p className="mt-1.5 flex items-start gap-1.5 text-xs whitespace-normal text-warning-foreground">
            <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>{gateText}</span>
          </p>
        ) : null}
      </TableCell>
      <TableCell className={cn(cell, "tabular-nums", gate && "opacity-60")}>
        <div dir="ltr" className="w-fit">{bill.sadad?.billNumber ?? bill.invoiceNumber}</div>
        <div className={cn("text-xs", overdue ? "text-error-foreground" : "text-muted-foreground")}>
          {bill.sadad ? `${fmt(t.payments.biller, { code: bill.sadad.billerCode })} · ` : null}
          {bill.dueDate ? formatPlainDate(bill.dueDate, lang) : "—"}
        </div>
      </TableCell>
      <TableCell className={cn(cell, "text-end font-medium", gate && "opacity-60")}>
        <Amount value={bill.total} />
        {overLimit ? (
          <p className="mt-1 text-xs font-normal whitespace-normal text-error-foreground">
            {fmt(n.perPaymentOver, { amount: formatSAR(bill.total, lang), limit: formatSAR(perPaymentLimit, lang) })}
          </p>
        ) : null}
      </TableCell>
      <TableCell className={cn(cell, "py-2.5")}>{fundingSelect}</TableCell>
      <TableCell className={cn(cell, gate && "opacity-60")}>
        <RailChip rail={quote.rail} />
      </TableCell>
      <TableCell className={cn(cell, "w-48 min-w-40 whitespace-normal", gate && "opacity-60")}>
        <ExpectedArrival quote={quote} payDate={payDate} />
      </TableCell>
    </TableRow>
  );
}

function AccountCard({
  name,
  balance,
  scheduled,
  thisRun,
  after,
}: {
  name: string;
  balance: number;
  scheduled: number;
  thisRun: number;
  after: number;
}) {
  const { t, lang } = useI18n();
  const n = t.payments.newRun;
  const short = after < 0;
  const used = balance > 0 ? Math.min(1, (scheduled + thisRun) / balance) : 1;
  return (
    <Panel className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-surface text-primary">
          <Wallet className="size-3.5" aria-hidden />
        </span>
        <h2 className="text-sm font-normal">
          {name} <span className="text-muted-foreground">· {n.accountsTitle}</span>
        </h2>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{n.availableAfter}</p>
        <Amount
          value={after}
          className={cn("text-2xl font-medium", short && "text-error-foreground")}
          currencyClassName="text-base font-normal text-muted-foreground"
        />
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className={cn("h-full rounded-full", short ? "bg-error-foreground" : "bg-primary")}
          style={{ width: `${Math.round(used * 100)}%` }}
        />
      </div>
      <dl className="grid gap-1.5 text-sm">
        <Row label={n.balance} value={formatSAR(balance, lang)} />
        <Row label={n.alreadyScheduled} value={formatSAR(scheduled, lang)} />
        <Row label={n.thisRun} value={formatSAR(thisRun, lang)} strong />
      </dl>
      {short ? (
        <Warning tone="warning">
          <span className="font-medium">{fmt(n.shortBy, { amount: formatSAR(-after, lang) })}.</span> {n.shortNote}
        </Warning>
      ) : null}
    </Panel>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("tabular-nums", strong && "font-medium")}>{value}</dd>
    </div>
  );
}

function Warning({ tone, children }: { tone: "warning" | "error"; children: React.ReactNode }) {
  const Icon = tone === "error" ? CircleAlert : TriangleAlert;
  return (
    <p
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-lg px-3 py-2 text-xs",
        tone === "error" ? "bg-error text-error-foreground" : "bg-warning text-warning-foreground",
      )}
    >
      <Icon className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function NotReadyPanel({ items }: { items: NewRunView["notReady"] }) {
  const { t, lang } = useI18n();
  const n = t.payments.newRun;
  return (
    <Panel>
      <PanelHeader title={`${n.notReadyTitle} (${items.length})`} description={n.notReadyDescription} />
      <ul className="divide-y border-t">
        {items.map(({ bill, reason }) => (
          <li key={bill.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
            <SupplierName
              nameEn={bill.sadad?.billerName ?? bill.supplierName}
              nameAr={bill.sadad?.billerNameAr ?? bill.supplierNameAr}
              className="min-w-48 flex-1"
            />
            <span dir="ltr" className="text-muted-foreground tabular-nums">{billReference(bill, t)}</span>
            <Amount value={bill.total} className="font-medium" />
            <span className="inline-flex h-6 items-center gap-1 rounded-full bg-warning px-2.5 text-xs font-medium text-warning-foreground">
              <TriangleAlert className="size-3" aria-hidden />
              {reason === "needs_review" ? plural(lang, n.notReady.needs_review, bill.needsReview.length) : n.notReady[reason]}
            </span>
            <Link href={`/bills/${encodeURIComponent(bill.id)}`} className="text-sm font-medium text-primary hover:underline">
              {n.openBill}
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
