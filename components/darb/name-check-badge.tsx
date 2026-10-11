"use client";

import { CircleCheck, CircleHelp, CircleX } from "lucide-react";
import type { NameCheck } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const STYLES: Record<NameCheck["result"], string> = {
  match: "bg-success-surface text-success",
  close_match: "bg-warning text-warning-foreground",
  no_match: "bg-error text-error-foreground",
};

/** Name-check result (BP-06): Match = success, Close match = warning, No match = error. */
export function NameCheckBadge({ result, confirmed, className }: { result: NameCheck["result"]; confirmed?: boolean; className?: string }) {
  const t = useT();
  const Icon = result === "match" ? CircleCheck : result === "close_match" ? CircleHelp : CircleX;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        confirmed && result === "close_match" ? STYLES.match : STYLES[result],
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {t.billDetail.nameCheck[result]}
    </span>
  );
}
