"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { isISODate } from "@/lib/domain/time";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const toDisplay = (iso: string) => (isISODate(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

/** "1510202" → "15/10/202": slashes are inserted as the user types digits. */
function formatTyping(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** "15/10/2026" → "2026-10-15", or null while incomplete or not a real date. */
function toIso(text: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  return isISODate(iso) ? iso : null;
}

export interface DateInputProps {
  id?: string;
  /** ISO date "YYYY-MM-DD", or "" for none. */
  value: string;
  /** Called with an ISO date once the typed date is complete and valid, or "" when cleared. */
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  "aria-describedby"?: string;
  "aria-labelledby"?: string;
}

/**
 * Date field in DD/MM/YYYY (Latin digits, both languages) with an Arabic or English placeholder,
 * typable from the keyboard, plus a calendar button that opens the browser's date picker
 * (a hidden <input type="date"> via showPicker()). The value in and out is always ISO "YYYY-MM-DD".
 */
export function DateInput({
  id,
  value,
  onChange,
  min,
  max,
  disabled,
  required,
  className,
  ...aria
}: DateInputProps) {
  const { t, lang, dir } = useI18n();
  const pickerRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(toDisplay(value));

  // Follow outside changes (picker, reset, URL) without fighting partial typing.
  useEffect(() => {
    if (toIso(text) !== value && !(value === "" && text !== "" && toIso(text) === null)) setText(toDisplay(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the value changes from outside
  }, [value]);

  const complete = text.length === 10;
  const invalid = complete && toIso(text) === null;

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        dir="ltr"
        inputMode="numeric"
        autoComplete="off"
        placeholder={lang === "ar" ? "يوم/شهر/سنة" : "DD/MM/YYYY"}
        value={text}
        disabled={disabled}
        required={required}
        aria-invalid={invalid || undefined}
        aria-describedby={aria["aria-describedby"]}
        aria-labelledby={aria["aria-labelledby"]}
        onChange={(e) => {
          const next = formatTyping(e.target.value);
          setText(next);
          if (next === "") onChange("");
          else {
            const iso = toIso(next);
            if (iso) onChange(iso);
          }
        }}
        // The field itself is LTR (digits); the calendar button sits at the page's end side.
        className={cn("h-9 bg-background tabular-nums", dir === "rtl" ? "pr-3 pl-9 text-right" : "pr-9 pl-3")}
      />
      <button
        type="button"
        disabled={disabled}
        aria-label={t.ui.openCalendar}
        onClick={() => {
          const el = pickerRef.current;
          if (!el) return;
          try {
            el.showPicker();
          } catch {
            el.focus();
            el.click();
          }
        }}
        className="absolute end-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
      >
        <CalendarDays className="size-4" aria-hidden />
      </button>
      {/* The native picker only; never shown, never focused by Tab. */}
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          setText(toDisplay(e.target.value));
          onChange(e.target.value);
        }}
        className="pointer-events-none absolute end-0 bottom-0 size-px opacity-0"
      />
    </div>
  );
}
