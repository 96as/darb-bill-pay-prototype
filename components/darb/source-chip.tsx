"use client";

import { FileCode, TriangleAlert } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * Where a value came from.
 * - "e_invoice": read from the ZATCA XML → "From e-invoice" (information colours, FileCode icon).
 * - "check": read by OCR, needs a person → "Check this field" (warning colours).
 */
export function SourceChip({
  kind,
  label,
  tooltip,
  className,
}: {
  kind: "e_invoice" | "check";
  label?: string;
  tooltip?: string;
  className?: string;
}) {
  const t = useT();
  const isEInvoice = kind === "e_invoice";
  const Icon = isEInvoice ? FileCode : TriangleAlert;
  const text = label ?? (isEInvoice ? t.common.fromEInvoice : t.common.checkThisField);
  const help = tooltip ?? (isEInvoice ? t.common.fromEInvoiceTooltip : t.common.checkThisFieldTooltip);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            className={cn(
              "inline-flex h-5 cursor-default items-center gap-1 rounded-full px-2 text-[11px] font-medium whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              isEInvoice
                ? "bg-information text-information-foreground"
                : "bg-warning text-warning-foreground",
              className,
            )}
          />
        }
      >
        <Icon className="size-3 shrink-0" aria-hidden />
        {text}
      </TooltipTrigger>
      <TooltipContent>{help}</TooltipContent>
    </Tooltip>
  );
}
