"use client";

import { CircleCheck, Landmark } from "lucide-react";
import { ApprovalCard } from "@/components/darb/approval-card";
import { EmptyState } from "@/components/darb/empty-state";
import { InitialAvatar } from "@/components/darb/initial-avatar";
import { Panel, PanelHeader } from "@/components/darb/panel";
import { StatusBadge } from "@/components/darb/status-badge";
import { useDemoState } from "@/components/darb/shell/demo-state";
import { fmt } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { formatDate } from "@/lib/ui/format";
import type { ApprovalItem } from "../data";

/**
 * "Needs your approval" (Darb "My actions" pattern). Whether the acting user may approve
 * follows decision 5: approver role, and not a maker of the bill.
 * Approve/Decline are not wired yet (POST /bills/{id}/approve lands with the services).
 */
export function ApprovalsPanel({ items }: { items: ApprovalItem[] }) {
  const { t, lang } = useI18n();
  const { actingUser } = useDemoState();

  return (
    <Panel className="flex flex-col">
      <PanelHeader title={t.bills.approvals.title} description={t.bills.approvals.description} />
      {items.length === 0 ? (
        <EmptyState icon={CircleCheck} title={t.bills.approvals.empty} className="py-8" />
      ) : (
        <div className="grid gap-3 px-5 pb-5">
          {items.map((item) => {
            const isPreparer = actingUser.role !== "approver";
            const isMaker = item.makers.includes(actingUser.id);
            const name = lang === "ar" && item.nameAr ? item.nameAr : item.name;
            const ref = item.kind === "sadad"
              ? fmt(t.bills.approvals.sadadBill, { number: item.invoiceNumber })
              : item.invoiceNumber;
            const due = item.dueDate ? fmt(t.bills.approvals.due, { date: formatDate(item.dueDate, lang) }) : null;
            return (
              <ApprovalCard
                key={item.id}
                avatar={
                  item.kind === "sadad"
                    ? <InitialAvatar name={item.name} icon={Landmark} />
                    : <InitialAvatar name={item.name} />
                }
                title={<span lang={lang === "ar" && item.nameAr ? "ar" : undefined}>{name}</span>}
                subtitle={[ref, due].filter(Boolean).join(" · ")}
                amount={item.total}
                meta={<StatusBadge status="awaiting_approval" />}
                disabled={isPreparer || isMaker}
                note={isPreparer ? t.bills.approvals.preparerNote : isMaker ? t.bills.approvals.ownNote : undefined}
              />
            );
          })}
        </div>
      )}
    </Panel>
  );
}
