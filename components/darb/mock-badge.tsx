"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** Small dashed chip marking anything mocked in the prototype (lib/mocks). */
export function MockBadge({ tooltip, className }: { tooltip?: string; className?: string }) {
  const t = useT();
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            className={cn(
              "inline-flex h-5 cursor-help items-center rounded-md border border-dashed border-muted-foreground/50 px-1.5 text-[11px] font-medium text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              className,
            )}
          />
        }
      >
        {t.common.mock}
      </TooltipTrigger>
      <TooltipContent>{tooltip ?? t.common.mockTooltip}</TooltipContent>
    </Tooltip>
  );
}
