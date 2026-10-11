import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** White bordered card used for page sections (Darb dashboard cards: 12px radius, 1px border). */
export function Panel({ className, ...props }: React.ComponentProps<"section">) {
  return <section className={cn("rounded-xl border bg-card", className)} {...props} />;
}

export function PanelHeader({
  title,
  description,
  action,
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Right side of the header, e.g. <ViewAllLink />. */
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-5 pt-5 pb-4", className)}>
      <div className="flex min-w-0 flex-auto items-start justify-between gap-4">
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-base leading-snug font-medium">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {/* Extra controls (e.g. filters) wrap under the title on narrow cards. */}
      {children}
    </div>
  );
}

/** "View all →" in primary blue for card headers. The arrow flips in RTL. */
export function ViewAllLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-primary hover:underline hover:underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {children}
      <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
    </Link>
  );
}
