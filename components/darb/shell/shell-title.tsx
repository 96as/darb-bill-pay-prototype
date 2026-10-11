"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { Dict } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  href?: string;
}

type Setter = (crumbs: Crumb[] | null) => void;
const ShellTitleContext = createContext<{ crumbs: Crumb[] | null; setCrumbs: Setter } | null>(null);

export function ShellTitleProvider({ children }: { children: React.ReactNode }) {
  const [crumbs, setCrumbs] = useState<Crumb[] | null>(null);
  return <ShellTitleContext.Provider value={{ crumbs, setCrumbs }}>{children}</ShellTitleContext.Provider>;
}

/**
 * Page title slot: a page can render `<ShellTitleOverride crumbs={[...]} />` (e.g. a bill
 * detail page: Bills › GOL-2026-0917). Without it the title comes from the URL.
 */
export function ShellTitleOverride({ crumbs }: { crumbs: Crumb[] }) {
  const ctx = useContext(ShellTitleContext);
  const key = JSON.stringify(crumbs);
  useEffect(() => {
    ctx?.setCrumbs(JSON.parse(key) as Crumb[]);
    return () => ctx?.setCrumbs(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the crumbs change
  }, [key]);
  return null;
}

const BILLS_SECTIONS: Record<string, keyof Dict["billsNav"]> = {
  inbox: "inbox",
  suppliers: "suppliers",
  runs: "runs",
  activity: "activity",
};

function crumbsFromPath(pathname: string, t: Dict): Crumb[] {
  const [first, second] = pathname.split("/").filter(Boolean);
  if (first !== "bills") return [];
  const crumbs: Crumb[] = [{ label: t.nav.bills, href: "/bills" }];
  if (second && BILLS_SECTIONS[second]) crumbs.push({ label: t.billsNav[BILLS_SECTIONS[second]] });
  return crumbs;
}

export function ShellTitle({ className }: { className?: string }) {
  const t = useT();
  const pathname = usePathname();
  const ctx = useContext(ShellTitleContext);
  const crumbs = ctx?.crumbs ?? crumbsFromPath(pathname, t);
  if (crumbs.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${i}`} className={cn("flex items-center gap-1.5", last ? "min-w-0" : "shrink-0")}>
              {i > 0 ? <ChevronRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden /> : null}
              {last || !crumb.href ? (
                <span aria-current={last ? "page" : undefined} className="max-w-64 truncate font-medium">
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.href} className="truncate text-muted-foreground hover:text-foreground">
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
