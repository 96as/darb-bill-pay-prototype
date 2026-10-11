"use client";

import Link from "next/link";
import { Activity, ArrowLeft, CalendarCheck, Inbox, Users, type LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/darb/empty-state";
import { Panel } from "@/components/darb/panel";
import { buttonVariants } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { BillsSectionHeader } from "./bills-section-header";

const ICONS: Record<ComingNextSection, LucideIcon> = {
  inbox: Inbox,
  suppliers: Users,
  runs: CalendarCheck,
  activity: Activity,
};

export type ComingNextSection = "inbox" | "suppliers" | "runs" | "activity";

/** Placeholder for Bills tabs that are built in later steps. */
export function ComingNext({ section }: { section: ComingNextSection }) {
  const t = useT();
  const icon = ICONS[section];
  return (
    <div className="mx-auto max-w-screen-2xl space-y-6">
      <BillsSectionHeader />
      <Panel>
        <EmptyState
          icon={icon}
          title={t.common.comingNext}
          description={t.common.comingNextDescription}
          action={
            <Link href="/bills" className={buttonVariants({ variant: "pill", size: "lg", className: "px-4" })}>
              <ArrowLeft aria-hidden className="rtl:rotate-180" />
              {t.common.backToBills}
            </Link>
          }
          className="py-16"
        />
      </Panel>
    </div>
  );
}
