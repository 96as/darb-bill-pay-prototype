"use client";

import { FileCode, PenLine, ScanText, TriangleAlert } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export type SourceChipKind = "e_invoice" | "check" | "ocr" | "edited";

const STYLES: Record<SourceChipKind, string> = {
  e_invoice: "bg-information text-information-foreground",
  check: "bg-warning text-warning-foreground",
  ocr: "bg-muted text-muted-foreground",
  edited: "bg-muted text-muted-foreground",
};

/**
 * Where a value came from.
 * - "e_invoice": read from the ZATCA XML → "From e-invoice" (information colours, FileCode icon).
 * - "check": read by OCR, needs a person → "Check this field" (warning colours).
 * - "ocr": read by OCR and already checked → "OCR" (muted).
 * - "edited": typed or changed by a person → "Edited" (muted).
 */
export function SourceChip({
  kind,
  label,
  tooltip,
  className,
}: {
  kind: SourceChipKind;
  label?: string;
  tooltip?: string;
  className?: string;
}) {
  const t = useT();
  const Icon = { e_invoice: FileCode, check: TriangleAlert, ocr: ScanText, edited: PenLine }[kind];
  const text =
    label ?? { e_invoice: t.common.fromEInvoice, check: t.common.checkThisField, ocr: t.ui.ocr, edited: t.ui.edited }[kind];
  const help =
    tooltip ??
    {
      e_invoice: t.common.fromEInvoiceTooltip,
      check: t.common.checkThisFieldTooltip,
      ocr: t.ui.ocrTooltip,
      edited: t.ui.editedTooltip,
    }[kind];
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            className={cn(
              "inline-flex h-5 cursor-default items-center gap-1 rounded-full px-2 text-[11px] font-medium whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              STYLES[kind],
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
