"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/darb/page-header";
import type { Dict } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const TABS: { key: keyof Omit<Dict["billsNav"], "label">; href: string }[] = [
  { key: "bills", href: "/bills" },
  { key: "inbox", href: "/bills/inbox" },
  { key: "suppliers", href: "/bills/suppliers" },
  { key: "runs", href: "/bills/runs" },
  { key: "activity", href: "/bills/activity" },
];

/** Bills sub-nav: in-page tabs under the page header (Bills · Inbox · Suppliers · Payment runs · Activity). */
export function BillsSubnav() {
  const t = useT();
  const pathname = usePathname();
  return (
    <nav aria-label={t.billsNav.label} className="border-b">
      <ul className="-mb-px flex gap-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab) => {
          const active = tab.href === "/bills" ? pathname === "/bills" : pathname.startsWith(tab.href);
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 items-center border-b-2 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:text-foreground",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                {t.billsNav[tab.key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Page header for every Bills screen + the section tabs. */
export function BillsSectionHeader({ actions }: { actions?: React.ReactNode }) {
  const t = useT();
  return (
    <div className="space-y-4">
      <PageHeader title={t.bills.title} description={t.bills.description} actions={actions} />
      <BillsSubnav />
    </div>
  );
}
