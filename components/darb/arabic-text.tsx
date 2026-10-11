import { cn } from "@/lib/utils";

/**
 * Arabic text from invoices, suppliers, billers. Always right-to-left (even in the
 * English UI) and set in Cairo. `dir` isolates it from the surrounding text direction.
 */
export function ArabicText({
  children,
  className,
  as: Tag = "span",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "span" | "p" | "div";
}) {
  return (
    <Tag lang="ar" dir="rtl" className={cn("font-arabic", className)}>
      {children}
    </Tag>
  );
}
