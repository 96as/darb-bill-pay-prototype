import { CircleAlert, Info, OctagonAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type NoticeTone = "info" | "warning" | "error" | "muted";

const TONES: Record<NoticeTone, { box: string; icon: string; Icon: LucideIcon }> = {
  info: { box: "border-information-foreground/20 bg-information", icon: "text-information-foreground", Icon: Info },
  warning: { box: "border-warning-foreground/25 bg-warning/70", icon: "text-warning-foreground", Icon: TriangleAlert },
  error: { box: "border-error-foreground/25 bg-error", icon: "text-error-foreground", Icon: OctagonAlert },
  muted: { box: "border-border bg-muted/60", icon: "text-muted-foreground", Icon: CircleAlert },
};

/**
 * Page-level banner in the status token colours (info / warning / error / muted),
 * with an optional row of actions. Uses logical spacing so it flips in Arabic.
 */
export function Notice({
  tone = "info",
  title,
  children,
  actions,
  icon,
  className,
}: {
  tone?: NoticeTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  const style = TONES[tone];
  const Icon = icon ?? style.Icon;
  return (
    <div
      role={tone === "error" || tone === "warning" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-xl border px-4 py-3 text-sm", style.box, className)}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", style.icon)} aria-hidden />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="space-y-0.5">
          {title ? <p className="font-medium text-foreground">{title}</p> : null}
          {children ? <div className="text-foreground/80">{children}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
