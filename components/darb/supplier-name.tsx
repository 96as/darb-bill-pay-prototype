"use client";

import { useLang } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { ArabicText } from "./arabic-text";

/**
 * Bilingual supplier/biller name. English UI: English name, Arabic below (RTL).
 * Arabic UI: Arabic name first, English below (LTR).
 * The second line is `w-fit` so it sits under the first line's start edge while
 * keeping its own direction.
 */
export function SupplierName({
  nameEn,
  nameAr,
  className,
}: {
  nameEn: string;
  nameAr?: string;
  className?: string;
}) {
  const lang = useLang();
  if (!nameAr) return <div className={cn("truncate font-medium", className)}>{nameEn}</div>;
  if (lang === "ar") {
    return (
      <div className={cn("min-w-0", className)}>
        <ArabicText as="div" className="truncate font-medium">{nameAr}</ArabicText>
        <div dir="ltr" lang="en" className="w-fit max-w-full truncate text-xs text-muted-foreground">
          {nameEn}
        </div>
      </div>
    );
  }
  return (
    <div className={cn("min-w-0", className)}>
      <div className="truncate font-medium">{nameEn}</div>
      <ArabicText as="div" className="w-fit max-w-full truncate text-xs text-muted-foreground">
        {nameAr}
      </ArabicText>
    </div>
  );
}
