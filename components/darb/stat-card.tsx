import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * White bordered stat card (Darb dashboard): small muted label with an icon,
 * big value, muted sublabel, optional action (e.g. a primary button) at the bottom.
 */
export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  action,
  tone = "default",
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  icon?: LucideIcon;
  action?: React.ReactNode;
  /** "warning" tints the sublabel, e.g. when scheduled payments exceed the balance. */
  tone?: "default" | "warning";
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-3 rounded-xl border bg-card p-5", className)}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {Icon ? (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-surface text-primary">
            <Icon className="size-3.5" aria-hidden />
          </span>
        ) : null}
        <h2 className="text-sm font-normal">{label}</h2>
      </div>
      <div className="text-2xl leading-none font-medium tracking-tight">{value}</div>
      {sublabel ? (
        <p
          className={cn(
            "text-xs",
            tone === "warning" ? "text-warning-foreground" : "text-muted-foreground",
          )}
        >
          {sublabel}
        </p>
      ) : null}
      {action ? <div className="mt-auto pt-1">{action}</div> : null}
    </section>
  );
}
