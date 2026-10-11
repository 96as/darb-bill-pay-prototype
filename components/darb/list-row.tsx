import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Darb list row: round avatar at the start, title + muted sub line, trailing value
 * (usually an <Amount />) aligned to the end, chevron. Renders a link when `href` is set.
 */
export function ListRow({
  avatar,
  title,
  subtitle,
  trailing,
  trailingSub,
  href,
  className,
}: {
  avatar?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  trailingSub?: React.ReactNode;
  href?: string;
  className?: string;
}) {
  const body = (
    <>
      {avatar}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{title}</div>
        {subtitle ? <div className="truncate text-xs text-muted-foreground">{subtitle}</div> : null}
      </div>
      {trailing ? (
        <div className="shrink-0 text-end">
          <div className="text-sm font-medium">{trailing}</div>
          {trailingSub ? <div className="text-xs text-muted-foreground">{trailingSub}</div> : null}
        </div>
      ) : null}
      {href ? <ChevronRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden /> : null}
    </>
  );
  const classes = cn("flex items-center gap-3 px-5 py-3", className);
  return href ? (
    <Link
      href={href}
      className={cn(classes, "transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none")}
    >
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
