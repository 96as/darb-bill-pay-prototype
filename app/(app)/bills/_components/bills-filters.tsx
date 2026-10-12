"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/darb/date-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/lib/i18n/client";
import { DISPLAY_STATUSES } from "@/lib/ui/status";
import { cn } from "@/lib/utils";
import type { BillsFilters as Filters } from "../data";

const ALL = "all";

/** Status select + due-before date. Filters live in the URL (?status=&due_before=), like GET /bills. */
export function BillsFilters({ filters, className }: { filters: Filters; className?: string }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const items = [
    { value: ALL, label: t.bills.list.allStatuses },
    ...DISPLAY_STATUSES.map((status) => ({ value: status, label: t.status[status] })),
  ];

  function apply(next: Filters) {
    const params = new URLSearchParams();
    if (next.status) params.set("status", next.status);
    if (next.dueBefore) params.set("due_before", next.dueBefore);
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  const hasFilters = Boolean(filters.status || filters.dueBefore);

  return (
    <div
      className={cn("flex flex-wrap items-end gap-3 transition-opacity", pending && "opacity-60", className)}
      aria-busy={pending}
    >
      <div className="grid gap-1.5">
        <label id="bills-status-label" className="text-xs text-muted-foreground">
          {t.bills.list.filterStatus}
        </label>
        <Select
          items={items}
          value={filters.status ?? ALL}
          onValueChange={(value) =>
            apply({ ...filters, status: value && value !== ALL ? (value as Filters["status"]) : undefined })
          }
        >
          <SelectTrigger aria-labelledby="bills-status-label" className="h-9 w-48 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="bills-due-before" className="text-xs text-muted-foreground">
          {t.bills.list.dueBefore}
        </label>
        <DateInput
          id="bills-due-before"
          value={filters.dueBefore ?? ""}
          onChange={(iso) => apply({ ...filters, dueBefore: iso || undefined })}
          className="w-44"
        />
      </div>
      {hasFilters ? (
        <Button variant="ghost" size="lg" onClick={() => apply({})} className="text-muted-foreground">
          <X aria-hidden />
          {t.bills.list.clearFilters}
        </Button>
      ) : null}
    </div>
  );
}
