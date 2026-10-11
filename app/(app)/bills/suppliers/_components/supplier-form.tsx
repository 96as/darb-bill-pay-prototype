"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building, CircleCheck, Landmark, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { IbanInput, ibanState } from "@/components/darb/iban-input";
import { MockBadge } from "@/components/darb/mock-badge";
import { NameCheckBadge } from "@/components/darb/name-check-badge";
import { Notice } from "@/components/darb/notice";
import { PageHeader } from "@/components/darb/page-header";
import { Panel, PanelHeader } from "@/components/darb/panel";
import { SourceChip } from "@/components/darb/source-chip";
import { ShellTitleOverride } from "@/components/darb/shell/shell-title";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatIban, normalizeIban } from "@/lib/domain/iban";
import type { Supplier } from "@/lib/domain/types";
import { isValidSaudiVat } from "@/lib/domain/vat";
import { fmt } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { api, errorMessage } from "@/lib/ui/api";
import { cn } from "@/lib/utils";
import type { NewSupplierView } from "../data";

type FormKey = "nameEn" | "nameAr" | "vatNumber" | "crNumber" | "iban" | "noticeEmail" | "noticeMobile";

function Field({
  id,
  label,
  chip,
  error,
  help,
  children,
  className,
}: {
  id: string;
  label: string;
  chip?: React.ReactNode;
  error?: string;
  help?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <label htmlFor={id} className="flex min-h-5 items-center justify-between gap-2 text-xs text-muted-foreground">
        {label}
        {chip}
      </label>
      {children}
      {error ? <p className="text-xs text-error-foreground">{error}</p> : help ? <p className="text-xs text-muted-foreground">{help}</p> : null}
    </div>
  );
}

/** Add supplier (BP-05, BP-06): prefilled from the e-invoice, IBAN checksum hint, then name check + screening (mock). */
export function SupplierForm({ view }: { view: NewSupplierView }) {
  const { t } = useI18n();
  const router = useRouter();
  const prefill = view.fromBill?.prefill ?? {};
  const fromEInvoice = view.fromBill?.extraction === "e_invoice";
  const [form, setForm] = useState<Record<FormKey, string>>({
    nameEn: prefill.nameEn ?? "",
    nameAr: prefill.nameAr ?? "",
    vatNumber: prefill.vatNumber ?? "",
    crNumber: prefill.crNumber ?? "",
    iban: prefill.iban ? formatIban(prefill.iban) : "",
    noticeEmail: "",
    noticeMobile: "",
  });
  const [errors, setErrors] = useState<Partial<Record<FormKey | "notice", string>>>({});
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState<Supplier | null>(null);

  const set = (key: FormKey) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  /** "From e-invoice" while the value is still the one read from the invoice. */
  const chip = (key: keyof typeof prefill) =>
    fromEInvoice && prefill[key] && normalize(key, form[key as FormKey]) === normalize(key, prefill[key]!) ? (
      <SourceChip kind="e_invoice" />
    ) : fromEInvoice && prefill[key] ? (
      <SourceChip kind="edited" />
    ) : undefined;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    if (!form.nameEn.trim()) next.nameEn = t.suppliers.form.required;
    if (!form.vatNumber.trim()) next.vatNumber = t.suppliers.form.required;
    else if (!isValidSaudiVat(form.vatNumber)) next.vatNumber = t.suppliers.form.vatHelp;
    if (ibanState(form.iban) !== "valid") next.iban = form.iban ? t.suppliers.form.ibanInvalid : t.suppliers.form.required;
    if (!form.noticeEmail.trim() && !form.noticeMobile.trim()) next.notice = t.suppliers.form.noticeRequired;
    setErrors(next);
    if (Object.keys(next).length) return;
    setPending(true);
    try {
      const res = await api.post<{ supplier: Supplier }>("/api/payees", {
        nameEn: form.nameEn.trim(),
        nameAr: form.nameAr.trim() || undefined,
        vatNumber: form.vatNumber.trim(),
        crNumber: form.crNumber.trim() || undefined,
        iban: normalizeIban(form.iban),
        noticeEmail: form.noticeEmail.trim() || undefined,
        noticeMobile: form.noticeMobile.trim() || undefined,
        fromBillId: view.fromBill?.id,
      });
      setSaved(res.supplier);
      toast.success(t.suppliers.form.saved);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  const header = (
    <>
      <ShellTitleOverride
        crumbs={[
          { label: t.nav.bills, href: "/bills" },
          { label: t.suppliers.title, href: "/bills/suppliers" },
          { label: t.suppliers.form.title },
        ]}
      />
      <Link
        href={view.fromBill ? `/bills/${view.fromBill.id}` : "/bills/suppliers"}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {view.fromBill ? fmt(t.suppliers.form.fromBill, { number: view.fromBill.invoiceNumber }) : t.suppliers.title}
      </Link>
      <PageHeader title={t.suppliers.form.title} description={t.suppliers.form.description} />
    </>
  );

  if (saved) {
    return (
      <>
        {header}
        <Panel>
          <div className="flex flex-col items-center gap-3 px-6 pt-8 pb-4 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-success-surface text-success">
              <CircleCheck className="size-5" aria-hidden />
            </span>
            <div className="space-y-1">
              <h2 className="text-lg font-medium">{t.suppliers.form.resultTitle}</h2>
              <p className="text-sm text-muted-foreground">{t.suppliers.form.resultDescription}</p>
            </div>
          </div>
          <dl className="mx-5 divide-y rounded-lg border px-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <dt className="text-muted-foreground">{t.billDetail.supplier.nameCheck}</dt>
              <dd className="flex flex-wrap items-center justify-end gap-2">
                <NameCheckBadge result={saved.nameCheck.result} />
                <MockBadge tooltip={t.suppliers.nameCheckTooltip} />
              </dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <dt className="text-muted-foreground">{t.suppliers.detail.returnedName}</dt>
              <dd dir="ltr" className="font-mono text-xs">{saved.nameCheck.returnedName}</dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <dt className="text-muted-foreground">{t.suppliers.screening}</dt>
              <dd className={cn("inline-flex items-center gap-1.5", saved.screening.status === "cleared" ? "text-success" : "text-warning-foreground")}>
                <ShieldCheck className="size-4" aria-hidden />
                {t.suppliers.screeningStatus[saved.screening.status]}
              </dd>
            </div>
          </dl>
          {saved.nameCheck.result !== "match" ? (
            <div className="px-5 pt-4">
              <Notice tone={saved.nameCheck.result === "no_match" ? "error" : "warning"}>
                {t.permissions[saved.nameCheck.result === "no_match" ? "name_check_failed" : "name_check_unconfirmed"]}
              </Notice>
            </div>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2 px-5 py-5">
            <Link href={`/bills/suppliers/${saved.id}`} className={cn(buttonVariants({ variant: view.fromBill ? "outline" : "default", size: "lg" }), "px-4")}>
              {t.suppliers.form.viewSupplier}
            </Link>
            {view.fromBill ? (
              <Link href={`/bills/${view.fromBill.id}`} className={cn(buttonVariants({ size: "lg" }), "px-4")}>
                {t.suppliers.form.backToBill}
              </Link>
            ) : null}
          </div>
        </Panel>
      </>
    );
  }

  return (
    <>
      {header}
      {fromEInvoice ? <Notice tone="info">{t.suppliers.form.prefilledNote}</Notice> : null}
      <form onSubmit={submit} className="space-y-6" noValidate>
        <Panel>
          <PanelHeader title={t.suppliers.form.identity} action={<Building2 />} />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            <Field id="s-name-en" label={t.suppliers.form.nameEn} chip={chip("nameEn")} error={errors.nameEn}>
              <Input id="s-name-en" value={form.nameEn} onChange={set("nameEn")} className="h-9 bg-background" aria-invalid={errors.nameEn ? true : undefined} />
            </Field>
            <Field id="s-name-ar" label={t.suppliers.form.nameAr} chip={chip("nameAr")}>
              <Input id="s-name-ar" dir="rtl" lang="ar" value={form.nameAr} onChange={set("nameAr")} className="h-9 bg-background font-arabic" />
            </Field>
            <Field id="s-vat" label={t.suppliers.form.vat} chip={chip("vatNumber")} error={errors.vatNumber} help={t.suppliers.form.vatHelp}>
              <Input id="s-vat" dir="ltr" inputMode="numeric" value={form.vatNumber} onChange={set("vatNumber")} className="h-9 bg-background tabular-nums" aria-invalid={errors.vatNumber ? true : undefined} />
            </Field>
            <Field id="s-cr" label={t.suppliers.form.cr} chip={chip("crNumber")}>
              <Input id="s-cr" dir="ltr" inputMode="numeric" value={form.crNumber} onChange={set("crNumber")} className="h-9 bg-background tabular-nums" />
            </Field>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title={t.suppliers.form.bank} action={<Landmark className="size-4 text-muted-foreground" aria-hidden />} />
          <div className="grid gap-4 px-5 pb-5">
            <Field id="s-iban" label={t.suppliers.form.iban} chip={chip("iban")} error={errors.iban}>
              <IbanInput id="s-iban" value={form.iban} onChange={(iban) => setForm((f) => ({ ...f, iban }))} />
            </Field>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title={t.suppliers.form.notice} description={t.suppliers.form.noticeHelp} action={<Mail className="size-4 text-muted-foreground" aria-hidden />} />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            <Field id="s-email" label={t.suppliers.form.noticeEmail}>
              <Input id="s-email" type="email" dir="ltr" value={form.noticeEmail} onChange={set("noticeEmail")} className="h-9 bg-background" />
            </Field>
            <Field id="s-mobile" label={t.suppliers.form.noticeMobile}>
              <Input id="s-mobile" type="tel" dir="ltr" placeholder="+966 5x xxx xxxx" value={form.noticeMobile} onChange={set("noticeMobile")} className="h-9 bg-background" />
            </Field>
            {errors.notice ? <p className="text-xs text-error-foreground sm:col-span-2">{errors.notice}</p> : null}
          </div>
        </Panel>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link href={view.fromBill ? `/bills/${view.fromBill.id}` : "/bills/suppliers"} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "px-4")}>
            {t.ui.cancel}
          </Link>
          <Button type="submit" size="lg" className="px-4" disabled={pending}>
            <ShieldCheck aria-hidden />
            {pending ? t.ui.saving : t.suppliers.form.save}
          </Button>
        </div>
      </form>
    </>
  );
}

function Building2() {
  return <Building className="size-4 text-muted-foreground" aria-hidden />;
}

function normalize(key: string, value: string): string {
  return key === "iban" ? normalizeIban(value) : value.trim();
}
