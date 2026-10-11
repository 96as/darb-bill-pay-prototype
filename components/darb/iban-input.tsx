"use client";

import { CircleCheck, CircleX, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatIban, isValidSaudiIban, normalizeIban, saudiBankFromIban } from "@/lib/domain/iban";
import { fmt } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export type IbanState = "empty" | "incomplete" | "invalid" | "valid";

/** Client-side hint only (BP-05: the server refuses an IBAN that fails its checksum). */
export function ibanState(raw: string): IbanState {
  const iban = normalizeIban(raw);
  if (!iban) return "empty";
  if (isValidSaudiIban(iban)) return "valid";
  if (iban.length < 24 && /^S?A?\d*$/.test(iban)) return "incomplete";
  return "invalid";
}

/** IBAN field with a live checksum and bank hint, grouped in fours, always left-to-right. */
export function IbanInput({
  id,
  value,
  onChange,
  disabled,
  className,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  describedBy?: string;
}) {
  const { t, lang } = useI18n();
  const state = ibanState(value);
  const bank = state === "valid" ? saudiBankFromIban(value) : null;
  const hintId = `${id}-hint`;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Input
        id={id}
        dir="ltr"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        placeholder={t.suppliers.form.ibanPlaceholder}
        value={value}
        disabled={disabled}
        aria-invalid={state === "invalid" ? true : undefined}
        aria-describedby={[hintId, describedBy].filter(Boolean).join(" ")}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => state === "valid" && onChange(formatIban(value))}
        className={cn("h-9 bg-background font-mono tracking-wide", state === "valid" && "border-success/50")}
      />
      <p
        id={hintId}
        aria-live="polite"
        className={cn(
          "flex items-center gap-1.5 text-xs",
          state === "valid" ? "text-success" : state === "invalid" ? "text-error-foreground" : "text-muted-foreground",
        )}
      >
        {state === "valid" ? (
          <CircleCheck className="size-3.5 shrink-0" aria-hidden />
        ) : state === "invalid" ? (
          <CircleX className="size-3.5 shrink-0" aria-hidden />
        ) : (
          <Info className="size-3.5 shrink-0" aria-hidden />
        )}
        {state === "valid"
          ? bank
            ? fmt(t.suppliers.form.ibanValid, { bank: lang === "ar" ? bank.nameAr : bank.name })
            : t.suppliers.form.ibanValidUnknownBank
          : state === "invalid"
            ? t.suppliers.form.ibanInvalid
            : t.suppliers.form.ibanIncomplete}
      </p>
    </div>
  );
}
