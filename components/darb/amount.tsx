"use client";

import type { Halalas } from "@/lib/domain/types";
import { useLang } from "@/lib/i18n/client";
import { currencyLabel, formatHalalas } from "@/lib/ui/format";
import { cn } from "@/lib/utils";

/**
 * Money the way Darb's app shows it: "45,000.00 SAR" (tabular numbers).
 * Right-align it in tables with `text-end` on the cell.
 */
export function Amount({
  value,
  className,
  currencyClassName,
}: {
  value: Halalas;
  className?: string;
  /** Style the currency label separately, e.g. smaller and muted in stat cards. */
  currencyClassName?: string;
}) {
  const lang = useLang();
  return (
    <span className={cn("tabular-nums whitespace-nowrap", className)}>
      {formatHalalas(value)}
      {" "}
      <span className={currencyClassName}>{currencyLabel(lang)}</span>
    </span>
  );
}
