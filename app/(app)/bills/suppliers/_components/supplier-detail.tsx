"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, KeyRound, PauseCircle, Phone } from "lucide-react";
import { toast } from "sonner";
import { Amount } from "@/components/darb/amount";
import { ArabicText } from "@/components/darb/arabic-text";
import { EmptyState } from "@/components/darb/empty-state";
import { IbanInput, ibanState } from "@/components/darb/iban-input";
import { InitialAvatar } from "@/components/darb/initial-avatar";
import { MockBadge } from "@/components/darb/mock-badge";
import { NameCheckBadge } from "@/components/darb/name-check-badge";
import { GateReason, GatedButton } from "@/components/darb/gated-button";
import { Notice } from "@/components/darb/notice";
import { useUnblock } from "@/components/darb/use-unblock";
import { Panel, PanelHeader } from "@/components/darb/panel";
import { SourceChip } from "@/components/darb/source-chip";
import { StatusBadge } from "@/components/darb/status-badge";
import { ShellTitleOverride } from "@/components/darb/shell/shell-title";
import { Button } from "@/components/ui/button";
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
import { normalizeIban } from "@/lib/domain/iban";
import { fmt, plural } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { api } from "@/lib/ui/api";
import { formatDate, formatDateTime } from "@/lib/ui/format";
import { useApiAction } from "@/lib/ui/use-api-action";
import { cn } from "@/lib/utils";
import type { BankChangeRow, SupplierDetailView } from "../data";

type Person = { name: string; nameAr: string } | undefined;

function usePerson() {
  const { lang } = useI18n();
  return (p: Person) => (p ? (lang === "ar" ? p.nameAr : p.name) : "—");
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 flex-wrap items-center justify-end gap-2">{children}</dd>
    </div>
  );
}

/** Request an IBAN change (BP-07): payments pause until a second person approves. */
function ChangeBankDialog({ supplierId, disabled }: { supplierId: string; disabled: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [iban, setIban] = useState("");
  const { run, pending } = useApiAction();
  const valid = ibanState(iban) === "valid";
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setIban("");
      }}
    >
      <DialogTrigger render={<Button variant="pill" size="lg" className="px-4" disabled={disabled} />}>
        <KeyRound aria-hidden />
        {t.suppliers.detail.changeBank}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!valid) return;
            await run(() => api.patch(`/api/payees/${supplierId}/bank-account`, { iban: normalizeIban(iban) }), {
              success: t.suppliers.detail.requested,
              onSuccess: () => setOpen(false),
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{t.suppliers.detail.changeTitle}</DialogTitle>
            <DialogDescription className="sr-only">{t.suppliers.detail.changeWarning}</DialogDescription>
          </DialogHeader>
          <Notice tone="warning" icon={Phone}>
            {t.suppliers.detail.changeWarning}
          </Notice>
          <div className="grid gap-1.5">
            <label htmlFor="new-iban" className="text-xs text-muted-foreground">
              {t.suppliers.detail.newIban}
            </label>
            <IbanInput id="new-iban" value={iban} onChange={setIban} />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>{t.ui.cancel}</DialogClose>
            <Button type="submit" disabled={!valid || pending}>
              {pending ? t.ui.working : t.suppliers.detail.requestChange}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function IbanCompare({ from, to, toBank }: { from: string; to: string; toBank: string }) {
  const { t } = useI18n();
  return (
    <div className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      <div className="rounded-lg border bg-background px-3 py-2">
        <p className="text-xs text-muted-foreground">{t.suppliers.detail.currentIban}</p>
        <p dir="ltr" className="font-mono text-sm break-all text-muted-foreground line-through decoration-muted-foreground/40">
          {from}
        </p>
      </div>
      <ArrowRight className="mx-auto size-4 rotate-90 text-muted-foreground sm:rotate-0 rtl:sm:rotate-180" aria-hidden />
      <div className="rounded-lg border border-warning-foreground/40 bg-background px-3 py-2">
        <p className="text-xs text-muted-foreground">
          {t.suppliers.detail.newIbanLabel} · {toBank}
        </p>
        <p dir="ltr" className="font-mono text-sm font-medium break-all">
          {to}
        </p>
      </div>
    </div>
  );
}

/**
 * Pending IBAN change (BP-07): old → new, who asked and when, name check of the new account, then
 * Confirm name match (close match) → Approve / Reject. The requester can withdraw. No dead ends:
 * every disabled button says why and offers the action that unblocks it.
 */
function PendingChange({ view }: { view: SupplierDetailView }) {
  const { t, lang } = useI18n();
  const person = usePerson();
  const unblockFor = useUnblock();
  const { run, pending } = useApiAction();
  const change = view.pending!;
  const id = view.supplier.id;
  const supplierName = lang === "ar" ? view.supplier.nameAr : view.supplier.nameEn;
  const closeMatchOpen = change.nameCheck.result === "close_match" && !change.nameCheck.confirmedBy;
  const isRequester = view.withdrawChangeGate.ok;
  const decisionReasonId = useId();

  const confirmMatch = () =>
    run(() => api.post(`/api/payees/${id}/name-check/confirm`), { success: t.suppliers.detail.confirmedToast });

  /** Approve, then say whether any of this supplier's bills must be approved again (they were paused by the change). */
  async function approve() {
    await run(
      async () => {
        await api.post(`/api/payees/${id}/bank-account/approve`);
        const res = await api.get<{ rows: { bill: { supplierId?: string; status: string; approvals: unknown[] } }[] }>("/api/bills");
        return res.rows.filter(
          (r) => r.bill.supplierId === id && r.bill.status === "awaiting_approval" && r.bill.approvals.length === 0,
        ).length;
      },
      {
        onSuccess: (count) =>
          toast.success(count > 0 ? plural(lang, t.suppliers.detail.approvedToastBills, count) : t.suppliers.detail.approvedToast),
      },
    );
  }

  // Approve's reason: unconfirmed close match → "Confirm name match" (when this user may confirm), else switch user.
  const approveUnblock = unblockFor(view.approveChangeGate, {
    supplierId: id,
    confirmMatch: view.confirmMatchGate.ok ? confirmMatch : undefined,
  });

  return (
    <section className="space-y-4 rounded-xl border border-warning-foreground/30 bg-warning/50 p-5" aria-labelledby="pending-change-title">
      <div className="flex items-start gap-3">
        <PauseCircle className="mt-0.5 size-5 shrink-0 text-warning-foreground" aria-hidden />
        <div className="space-y-0.5">
          <h2 id="pending-change-title" className="font-medium">
            {t.suppliers.detail.pendingTitle}
          </h2>
          <p className="text-sm text-foreground/80">
            {fmt(t.suppliers.detail.pendingBody, { name: person(change.requestedBy), date: formatDateTime(change.requestedAt, lang) })}
          </p>
        </div>
      </div>
      <IbanCompare from={change.oldIban} to={change.newIban} toBank={lang === "ar" ? change.newBankAr : change.newBank} />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">{t.suppliers.detail.newNameCheck}</span>
        <NameCheckBadge result={change.nameCheck.result} confirmed={Boolean(change.nameCheck.confirmedBy)} />
        {change.nameCheck.confirmedBy ? (
          <span className="text-xs text-muted-foreground">
            {fmt(t.billDetail.nameCheck.confirmed, { name: person(change.confirmedBy) })}
          </span>
        ) : null}
        <MockBadge tooltip={t.suppliers.nameCheckTooltip} />
      </div>

      {closeMatchOpen ? (
        // Close match: the approver compares the two names, then confirms (BP-06).
        <div className="space-y-3 rounded-lg border border-warning-foreground/30 bg-background/80 p-4">
          <p className="text-sm font-medium">{t.suppliers.detail.compareNames}</p>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border bg-background px-3 py-2">
              <dt className="text-xs text-muted-foreground">{t.suppliers.detail.supplierLabel}</dt>
              <dd className="text-sm font-medium">{supplierName}</dd>
            </div>
            <div className="rounded-lg border bg-background px-3 py-2">
              <dt className="text-xs text-muted-foreground">{t.suppliers.detail.returnedName}</dt>
              <dd dir="ltr" className="w-fit font-mono text-sm font-medium">
                {change.nameCheck.returnedName}
              </dd>
            </div>
          </dl>
          <GatedButton
            gate={view.confirmMatchGate}
            unblock={unblockFor(view.confirmMatchGate, { supplierId: id })}
            pending={pending}
            size="lg"
            className="px-4"
            onClick={confirmMatch}
          >
            {t.suppliers.detail.confirmMatch}
          </GatedButton>
        </div>
      ) : null}

      {view.actingRole === "approver" && !isRequester ? (
        // PRD fraud mitigation: advise calling the supplier on a known number before approving.
        <Notice tone="warning" icon={Phone} className="bg-background/70">
          {fmt(t.suppliers.detail.callBeforeApproving, { name: supplierName })}
        </Notice>
      ) : null}

      <div className="space-y-2">
        <div className="flex flex-wrap items-start gap-2">
          <GatedButton
            gate={view.approveChangeGate}
            showReason={false}
            describedBy={decisionReasonId}
            pending={pending}
            size="lg"
            className="px-4"
            onClick={approve}
          >
            {t.suppliers.detail.approveChange}
          </GatedButton>
          {isRequester ? (
            <Button
              size="lg"
              variant="outline"
              className="bg-background px-4"
              disabled={pending}
              onClick={() => run(() => api.post(`/api/payees/${id}/bank-account/reject`), { success: t.suppliers.detail.withdrawnToast })}
            >
              {t.suppliers.detail.withdrawChange}
            </Button>
          ) : (
            <GatedButton
              gate={view.rejectChangeGate}
              unblock={unblockFor(view.rejectChangeGate, { supplierId: id })}
              pending={pending}
              size="lg"
              variant="outline"
              className="bg-background px-4"
              onClick={() => run(() => api.post(`/api/payees/${id}/bank-account/reject`), { success: t.suppliers.detail.rejectedToast })}
            >
              {t.suppliers.detail.rejectChange}
            </GatedButton>
          )}
        </div>
        <GateReason id={decisionReasonId} gate={view.approveChangeGate} unblock={approveUnblock} />
      </div>
    </section>
  );
}

function HistoryItem({ change }: { change: BankChangeRow }) {
  const { t, lang } = useI18n();
  const person = usePerson();
  const tone =
    change.status === "approved" ? "bg-success-surface text-success" : change.status === "rejected" ? "bg-error text-error-foreground" : "bg-warning text-warning-foreground";
  return (
    <li className="space-y-2 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span dir="ltr" className="font-mono text-xs">
          {change.oldIban} → {change.newIban}
        </span>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", tone)}>{t.suppliers.detail.changeStatus[change.status]}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {fmt(t.suppliers.detail.requestedBy, { name: person(change.requestedBy) })} · <span className="tabular-nums">{formatDateTime(change.requestedAt, lang)}</span>
        {change.decidedAt ? (
          <>
            <br />
            {fmt(t.suppliers.detail.decidedBy, {
              status: t.suppliers.detail.changeStatus[change.status],
              name: person(change.decidedBy),
            })}{" "}
            · <span className="tabular-nums">{formatDateTime(change.decidedAt, lang)}</span>
          </>
        ) : null}
      </p>
    </li>
  );
}

/** Supplier page (BP-05..07). */
export function SupplierDetail({ view }: { view: SupplierDetailView }) {
  const { t, lang } = useI18n();
  const person = usePerson();
  const unblockFor = useUnblock();
  const { run, pending } = useApiAction();
  const { supplier } = view;
  const paused = Boolean(view.pending);
  const nc = supplier.nameCheck;
  const history = [...(view.pending ? [view.pending] : []), ...view.history];

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6">
      <ShellTitleOverride
        crumbs={[
          { label: t.nav.bills, href: "/bills" },
          { label: t.suppliers.title, href: "/bills/suppliers" },
          { label: lang === "ar" ? supplier.nameAr : supplier.nameEn },
        ]}
      />
      <Link href="/bills/suppliers" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {t.suppliers.title}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <InitialAvatar name={lang === "ar" ? supplier.nameAr : supplier.nameEn} />
          <div className="min-w-0">
            <h1 className="text-2xl leading-tight font-medium">{lang === "ar" ? <ArabicText>{supplier.nameAr}</ArabicText> : supplier.nameEn}</h1>
            {lang === "ar" ? (
              <p dir="ltr" className="w-fit text-sm text-muted-foreground">{supplier.nameEn}</p>
            ) : (
              <ArabicText as="p" className="w-fit text-sm text-muted-foreground">{supplier.nameAr}</ArabicText>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {paused ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning px-3 py-1 text-xs font-medium text-warning-foreground">
              <PauseCircle className="size-3.5" aria-hidden />
              {t.suppliers.paused}
            </span>
          ) : null}
          {/* While a change is pending there is nothing to start: the panel below is where it is decided. */}
          {paused ? null : <ChangeBankDialog supplierId={supplier.id} disabled={false} />}
        </div>
      </div>

      {view.pending ? <PendingChange view={view} /> : null}

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Panel>
          <PanelHeader
            title={t.suppliers.detail.details}
            description={fmt(t.suppliers.detail.addedBy, { name: person(supplier.createdBy), date: formatDate(supplier.createdAt.slice(0, 10), lang) })}
            action={supplier.prefilledFromEInvoice ? <SourceChip kind="e_invoice" label={t.suppliers.detail.prefilled} /> : undefined}
          />
          <dl className="mx-5 mb-5 divide-y rounded-lg border px-3">
            <Row label={t.suppliers.form.vat}>
              <span dir="ltr" className="tabular-nums">{supplier.vatNumber}</span>
            </Row>
            <Row label={t.suppliers.form.cr}>
              <span dir="ltr" className="tabular-nums">{supplier.crNumber || "—"}</span>
            </Row>
            <Row label={t.suppliers.form.iban}>
              <span dir="ltr" className="font-mono text-xs">{supplier.ibanFormatted}</span>
            </Row>
            <Row label={t.suppliers.detail.bank}>
              {lang === "ar" ? supplier.bank.nameAr : supplier.bank.name}
            </Row>
            <Row label={t.suppliers.detail.notice}>
              <span dir="ltr" className="text-end">
                {[supplier.noticeEmail, supplier.noticeMobile].filter(Boolean).join(" · ") || "—"}
              </span>
            </Row>
          </dl>
        </Panel>

        <Panel>
          <PanelHeader title={t.suppliers.detail.nameCheckTitle} action={<MockBadge tooltip={t.suppliers.nameCheckTooltip} />} />
          <dl className="mx-5 divide-y rounded-lg border px-3">
            <Row label={t.billDetail.supplier.nameCheck}>
              <NameCheckBadge result={nc.result} confirmed={Boolean(nc.confirmedBy)} />
            </Row>
            <Row label={t.suppliers.detail.returnedName}>
              <span dir="ltr" className="font-mono text-xs">{nc.returnedName}</span>
            </Row>
            <Row label={t.suppliers.detail.checked}>
              <span className="tabular-nums">{formatDateTime(nc.checkedAt, lang)}</span>
            </Row>
            {nc.confirmedBy ? (
              <Row label={t.suppliers.detail.confirmation}>{fmt(t.billDetail.nameCheck.confirmed, { name: person(nc.confirmedByName) })}</Row>
            ) : null}
            <Row label={t.suppliers.screening}>
              <span className={supplier.screening === "cleared" ? "text-success" : "text-warning-foreground"}>
                {t.suppliers.screeningStatus[supplier.screening]}
              </span>
            </Row>
          </dl>
          {nc.result === "close_match" && !nc.confirmedBy && !view.pending ? (
            // While an IBAN change is pending, its own name check is confirmed in the panel above.
            <div className="px-5 pt-4">
              <GatedButton
                gate={view.confirmMatchGate}
                unblock={unblockFor(view.confirmMatchGate, { supplierId: supplier.id })}
                pending={pending}
                size="lg"
                className="px-4"
                onClick={() => run(() => api.post(`/api/payees/${supplier.id}/name-check/confirm`), { success: t.suppliers.detail.confirmedToast })}
              >
                {t.suppliers.detail.confirmMatch}
              </GatedButton>
            </div>
          ) : null}
          <div className="h-5" />
        </Panel>

        <Panel>
          <PanelHeader title={t.suppliers.detail.historyTitle} description={t.suppliers.detail.historyDescription} />
          {history.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">{t.suppliers.detail.historyEmpty}</p>
          ) : (
            <ul className="divide-y border-t">
              {history.map((c) => (
                <HistoryItem key={c.id} change={c} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title={t.suppliers.detail.billsTitle}
            action={
              <div className="text-end">
                <p className="text-xs text-muted-foreground">{t.suppliers.detail.owed}</p>
                <Amount value={view.owed} className="text-lg font-medium" currencyClassName="text-sm font-normal text-muted-foreground" />
              </div>
            }
          />
          {view.bills.length === 0 ? (
            <EmptyState title={t.suppliers.detail.noBills} className="py-8" />
          ) : (
            <ul className="divide-y border-t">
              {view.bills.map((b) => (
                <li key={b.id}>
                  <Link href={`/bills/${b.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-muted/50">
                    <span dir="ltr" className="text-sm font-medium tabular-nums">{b.invoiceNumber}</span>
                    <span className="text-xs text-muted-foreground">{b.dueDate ? formatDate(b.dueDate, lang) : ""}</span>
                    <Amount value={b.total} className="ms-auto text-sm" />
                    <StatusBadge status={b.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
