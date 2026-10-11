"use client";

import { useState } from "react";
import { Info, Pencil, TriangleAlert } from "lucide-react";
import { ArabicText } from "@/components/darb/arabic-text";
import { Panel, PanelHeader } from "@/components/darb/panel";
import { SourceChip } from "@/components/darb/source-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sar, totalsAgree } from "@/lib/domain/money";
import { isISODate } from "@/lib/domain/time";
import type { Bill, BillFieldKey, Halalas } from "@/lib/domain/types";
import { useI18n } from "@/lib/i18n/client";
import { api } from "@/lib/ui/api";
import { formatDate, formatHalalas, formatSAR } from "@/lib/ui/format";
import { useApiAction } from "@/lib/ui/use-api-action";
import { cn } from "@/lib/utils";
import { isEditable, useBill } from "./bill-context";

type Kind = "text" | "arabic" | "date" | "amount" | "mono";
interface FieldDef {
  key: BillFieldKey | "billerName" | "billerCode" | "billNumber";
  kind: Kind;
  editable: boolean;
}

const SUPPLIER_FIELDS: FieldDef[] = [
  { key: "supplierName", kind: "text", editable: true },
  { key: "supplierNameAr", kind: "arabic", editable: true },
  { key: "supplierVat", kind: "mono", editable: true },
  { key: "supplierCr", kind: "mono", editable: true },
  { key: "invoiceNumber", kind: "mono", editable: true },
  { key: "invoiceUuid", kind: "mono", editable: false },
  { key: "issueDate", kind: "date", editable: true },
  { key: "dueDate", kind: "date", editable: true },
  { key: "subtotal", kind: "amount", editable: true },
  { key: "vat", kind: "amount", editable: true },
  { key: "total", kind: "amount", editable: true },
];

const SADAD_FIELDS: FieldDef[] = [
  { key: "billerName", kind: "text", editable: false },
  { key: "billerCode", kind: "mono", editable: false },
  { key: "billNumber", kind: "mono", editable: false },
  { key: "issueDate", kind: "date", editable: false },
  { key: "dueDate", kind: "date", editable: true },
  { key: "total", kind: "amount", editable: false },
];

function rawValue(bill: Bill, key: FieldDef["key"]): string | number | undefined {
  if (key === "billerName") return bill.sadad?.billerName;
  if (key === "billerCode") return bill.sadad?.billerCode;
  if (key === "billNumber") return bill.sadad?.billNumber;
  return bill[key] as string | number | undefined;
}

const toInput = (kind: Kind, v: string | number | undefined) =>
  v === undefined ? "" : kind === "amount" ? formatHalalas(v as Halalas) : String(v);

/** Fields card: each value with where it came from (BP-03), editable while draft or awaiting approval. */
export function BillFields() {
  const { t, lang } = useI18n();
  const { view, editing, setEditing } = useBill();
  const { bill } = view;
  const defs = (bill.kind === "sadad" ? SADAD_FIELDS : SUPPLIER_FIELDS).filter(
    (d) => d.key !== "invoiceUuid" || bill.invoiceUuid,
  );
  const editable = isEditable(view);
  const { run, pending } = useApiAction();
  const [form, setForm] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const label = (key: FieldDef["key"]) => t.billDetail.fields[key];

  function startEdit() {
    setForm(Object.fromEntries(defs.map((d) => [d.key, toInput(d.kind, rawValue(bill, d.key))])));
    setErrors({});
    setEditing(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const patch: Record<string, string | number> = {};
    const nextErrors: Record<string, string> = {};
    for (const d of defs) {
      if (!d.editable) continue;
      const input = (form[d.key] ?? "").trim();
      const before = rawValue(bill, d.key);
      if (d.kind === "amount") {
        if (!input) continue;
        try {
          const value = sar(input);
          if (value !== before) patch[d.key] = value;
        } catch {
          nextErrors[d.key] = t.billDetail.fields.invalidAmount;
        }
      } else if (d.kind === "date") {
        if (input && !isISODate(input)) nextErrors[d.key] = t.billDetail.fields.invalidAmount;
        else if (input !== (before ?? "")) patch[d.key] = input;
      } else if (input !== String(before ?? "")) {
        patch[d.key] = input;
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (Object.keys(patch).length === 0) return setEditing(false);
    await run(() => api.patch(`/api/bills/${bill.id}`, patch), {
      success: t.billDetail.fields.saved,
      onSuccess: () => setEditing(false),
    });
  }

  const mismatch =
    bill.subtotal !== undefined && bill.vat !== undefined && !totalsAgree(bill.subtotal, bill.vat, bill.total);

  return (
    <Panel id="bill-fields">
      <PanelHeader
        title={t.billDetail.fields.title}
        action={
          editable && !editing ? (
            <Button variant="pill" onClick={startEdit}>
              <Pencil aria-hidden />
              {t.billDetail.fields.edit}
            </Button>
          ) : undefined
        }
      />
      {editing ? (
        <form onSubmit={save} className="space-y-4 px-5 pb-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {defs.map((d) => {
              const id = `field-${d.key}`;
              const review = bill.needsReview.includes(d.key as BillFieldKey);
              return (
                <div key={d.key} className={cn("grid gap-1.5", (d.kind === "text" || d.kind === "arabic" || d.key === "invoiceUuid") && "sm:col-span-2")}>
                  <label htmlFor={id} className="flex items-center gap-2 text-xs text-muted-foreground">
                    {label(d.key)}
                    {review ? <SourceChip kind="check" label={t.ui.ocrCheck} /> : null}
                  </label>
                  <Input
                    id={id}
                    type={d.kind === "date" ? "date" : "text"}
                    inputMode={d.kind === "amount" ? "decimal" : undefined}
                    dir={d.kind === "arabic" ? "rtl" : d.kind === "mono" || d.kind === "amount" ? "ltr" : undefined}
                    lang={d.kind === "arabic" ? "ar" : undefined}
                    value={form[d.key] ?? ""}
                    disabled={!d.editable || pending}
                    aria-invalid={errors[d.key] ? true : undefined}
                    onChange={(e) => setForm((f) => ({ ...f, [d.key]: e.target.value }))}
                    className={cn(
                      "h-9 bg-background",
                      d.kind === "amount" && "text-end tabular-nums",
                      d.kind === "arabic" && "font-arabic",
                      review && "border-warning-foreground/60",
                    )}
                  />
                  {errors[d.key] ? <p className="text-xs text-error-foreground">{errors[d.key]}</p> : null}
                </div>
              );
            })}
          </div>
          {bill.status === "awaiting_approval" ? (
            <p className="flex items-start gap-1.5 text-xs text-warning-foreground">
              <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
              {t.billDetail.fields.restartsApproval}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="lg" onClick={() => setEditing(false)} disabled={pending}>
              {t.ui.cancel}
            </Button>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? t.ui.saving : t.billDetail.fields.save}
            </Button>
          </div>
        </form>
      ) : (
        <dl className="divide-y border-t">
          {defs.map((d) => {
            const value = rawValue(bill, d.key);
            const source = bill.fieldSources[d.key as BillFieldKey];
            const review = bill.needsReview.includes(d.key as BillFieldKey);
            return (
              <div
                key={d.key}
                className={cn(
                  "grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 px-5 py-2.5",
                  review && "relative bg-warning/40 before:absolute before:inset-y-0 before:start-0 before:w-0.5 before:bg-warning-foreground",
                )}
              >
                <dt className="pt-0.5 text-sm text-muted-foreground">{label(d.key)}</dt>
                <dd className="min-w-0 pt-0.5">
                  <span className={cn("min-w-0 text-sm", d.kind === "amount" && "font-medium tabular-nums", d.key === "total" && "text-base")}>
                    {value === undefined || value === "" ? (
                      <span className="text-muted-foreground">{t.billDetail.fields.empty}</span>
                    ) : d.kind === "amount" ? (
                      formatSAR(value as Halalas, lang)
                    ) : d.kind === "date" ? (
                      formatDate(String(value), lang)
                    ) : d.kind === "arabic" ? (
                      <ArabicText className="break-words">{value}</ArabicText>
                    ) : (
                      <span dir="ltr" className={cn(d.key === "invoiceUuid" ? "break-all" : "break-words", d.kind === "mono" && "tabular-nums")}>
                        {value}
                      </span>
                    )}
                  </span>
                </dd>
                <dd className="flex justify-end pt-0.5">
                  {source === "xml" ? (
                    <SourceChip kind="e_invoice" />
                  ) : source === "ocr" ? (
                    <SourceChip kind={review ? "check" : "ocr"} label={review ? t.ui.ocrCheck : undefined} />
                  ) : source === "manual" ? (
                    <SourceChip kind="edited" />
                  ) : null}
                </dd>
              </div>
            );
          })}
          {mismatch ? (
            <p className="flex items-center gap-1.5 px-5 py-2.5 text-xs text-warning-foreground">
              <TriangleAlert className="size-3.5" aria-hidden />
              {t.billDetail.fields.totalsMismatch}
            </p>
          ) : null}
          {bill.warnings?.length ? (
            // Reader notes from the invoice reader (English, from the server).
            <ul className="space-y-1 bg-muted/40 px-5 py-3 text-xs text-muted-foreground">
              {bill.warnings.map((w) => (
                <li key={w} className="flex items-start gap-1.5">
                  <Info className="mt-px size-3.5 shrink-0" aria-hidden />
                  <span lang="en">{w}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </dl>
      )}
    </Panel>
  );
}
