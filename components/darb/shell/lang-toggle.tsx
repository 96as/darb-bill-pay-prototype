"use client";

import type { Lang } from "@/lib/i18n/config";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const OPTIONS: { lang: Lang; label: string }[] = [
  { lang: "en", label: "EN" },
  { lang: "ar", label: "عربي" },
];

/** EN / عربي segmented toggle. */
export function LangToggle({
  lang,
  onChange,
  className,
}: {
  lang: Lang;
  onChange: (lang: Lang) => void;
  className?: string;
}) {
  const t = useT();
  return (
    <div
      role="group"
      aria-label={t.shell.language}
      className={cn("inline-flex h-8 items-center rounded-lg border bg-background p-0.5", className)}
    >
      {OPTIONS.map((option) => {
        const active = option.lang === lang;
        return (
          <button
            key={option.lang}
            type="button"
            lang={option.lang}
            aria-pressed={active}
            onClick={() => !active && onChange(option.lang)}
            className={cn(
              "h-full rounded-md px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              option.lang === "ar" && "font-arabic",
              active ? "bg-primary-surface text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
