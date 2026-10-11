"use client";

import { Clock } from "lucide-react";
import type { ISODate, RailQuote } from "@/lib/domain/types";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { formatArrival, reasonLabel } from "./payment-format";

/**
 * Expected arrival ("Sun 18 Oct") with the rail reason in words. When the arrival is not the pay
 * date the reason is highlighted ("After 3:58 PM cut-off — next banking day").
 * `quote` must come from lib/domain/rails.ts (or a stored payment), never computed here.
 */
export function ExpectedArrival({
  quote,
  payDate,
  className,
}: {
  quote: Pick<RailQuote, "arrivalDate" | "reason">;
  payDate: ISODate;
  className?: string;
}) {
  const { t, lang } = useI18n();
  const differs = quote.arrivalDate !== payDate;
  const reason = reasonLabel(quote.reason, t);
  return (
    <div className={cn("min-w-0", className)}>
      <div className="font-medium whitespace-nowrap tabular-nums">{formatArrival(quote.arrivalDate, lang)}</div>
      {differs ? (
        <div className="mt-0.5 flex items-start gap-1 text-xs whitespace-normal text-warning-foreground">
          <Clock className="mt-px size-3 shrink-0" aria-hidden />
          <span>{reason || t.payments.newRun.notOnPayDate}</span>
        </div>
      ) : reason ? (
        <div className="mt-0.5 text-xs whitespace-normal text-muted-foreground">{reason}</div>
      ) : null}
    </div>
  );
}
