import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** First letter of the first word, e.g. "Noura Al-Harbi" → "N", "شركة …" → "ش". */
export function initialOf(name: string): string {
  return Array.from(name.trim())[0]?.toUpperCase() ?? "?";
}

/** Round avatar with an initial (or an icon). `solid` = primary blue (user avatar), `soft` = list rows. */
export function InitialAvatar({
  name,
  icon: Icon,
  tone = "soft",
  size = "md",
  className,
}: {
  name: string;
  icon?: LucideIcon;
  tone?: "solid" | "soft" | "muted";
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-medium select-none",
        size === "sm" ? "size-8 text-xs" : "size-9 text-sm",
        tone === "solid" && "bg-primary text-primary-foreground",
        tone === "soft" && "bg-primary-surface text-primary",
        tone === "muted" && "bg-muted text-muted-foreground",
        className,
      )}
    >
      {Icon ? <Icon className="size-4" /> : initialOf(name)}
    </span>
  );
}
