"use client";

import { FlaskConical } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** Small amber chip: "Demo · Prototype — mocked integrations" (long text on wide screens, always in the tooltip). */
export function DemoChip({ className }: { className?: string }) {
  const t = useT();
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            className={cn(
              "inline-flex h-6 cursor-default items-center gap-1.5 rounded-full bg-warning px-2.5 text-xs font-medium whitespace-nowrap text-warning-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              className,
            )}
          />
        }
      >
        <FlaskConical className="size-3.5" aria-hidden />
        <span>{t.shell.demo}</span>
        <span className="hidden font-normal 2xl:inline">· {t.shell.prototypeNote}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-72">
        {t.shell.prototypeNote}. {t.shell.prototypeTooltip}
      </TooltipContent>
    </Tooltip>
  );
}
