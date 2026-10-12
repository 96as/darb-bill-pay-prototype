"use client";

import Link from "next/link";
import { CircleCheck, Landmark, Layers } from "lucide-react";
import { ApprovalCard } from "@/components/darb/approval-card";
import { EmptyState } from "@/components/darb/empty-state";
import { InitialAvatar } from "@/components/darb/initial-avatar";
import { Panel, PanelHeader } from "@/components/darb/panel";
import { StatusBadge } from "@/components/darb/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { fmt, plural } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { api } from "@/lib/ui/api";
import { formatDate } from "@/lib/ui/format";
import { useApiAction } from "@/lib/ui/use-api-action";
import { useUnblock } from "@/components/darb/use-unblock";
import type { ApprovalItem } from "../data";

function BillApproval({ item }: { item: ApprovalItem }) {
  const { t, lang } = useI18n();
  const unblockFor = useUnblock();
  const { run, pending } = useApiAction();
  const name = lang === "ar" && item.nameAr ? item.nameAr : item.name;
  const ref = item.kind === "sadad" ? fmt(t.bills.approvals.sadadBill, { number: item.reference }) : item.reference;
  const due = item.dueDate ? fmt(t.bills.approvals.due, { date: formatDate(item.dueDate, lang) }) : null;
  return (
    <ApprovalCard
      href={item.href}
      avatar={item.kind === "sadad" ? <InitialAvatar name={item.name} icon={Landmark} /> : <InitialAvatar name={name} />}
      title={<span lang={lang === "ar" && item.nameAr ? "ar" : undefined}>{name}</span>}
      subtitle={[ref, due].filter(Boolean).join(" · ")}
      amount={item.total}
      meta={<StatusBadge status="awaiting_approval" />}
      gate={item.gate}
      unblock={unblockFor(item.gate, { billId: item.id, supplierId: item.supplierId })}
      pending={pending}
      onApprove={() =>
        run(() => api.post(`/api/bills/${item.id}/approve`), { success: t.bills.approvals.approvedToast })
      }
      onDecline={() =>
        run(() => api.post(`/api/bills/${item.id}/reject`), { success: t.bills.approvals.rejectedToast })
      }
    />
  );
}

function RunApproval({ item }: { item: ApprovalItem }) {
  const { t, lang } = useI18n();
  const unblockFor = useUnblock();
  return (
    <ApprovalCard
      href={item.href}
      avatar={<InitialAvatar name={item.name} icon={Layers} />}
      title={item.name}
      subtitle={[
        item.payDate ? fmt(t.bills.approvals.run, { date: formatDate(item.payDate, lang) }) : null,
        plural(lang, t.bills.approvals.runBills, item.billCount ?? 0),
      ]
        .filter(Boolean)
        .join(" · ")}
      amount={item.total}
      meta={<StatusBadge status="awaiting_approval" />}
      gate={item.gate}
      unblock={unblockFor(item.gate)}
      actions={
        <Link href={item.href} className={buttonVariants({ size: "lg", variant: item.gate.ok ? "default" : "outline" })}>
          {t.bills.approvals.reviewRun}
        </Link>
      }
    />
  );
}

/**
 * "Needs your approval" (Darb "My actions" pattern): bills (Approve / Decline call the API)
 * and payment runs (approved on the run screen). The hint comes from lib/domain/permissions.
 */
export function ApprovalsPanel({ items }: { items: ApprovalItem[] }) {
  const { t } = useI18n();
  return (
    <Panel className="flex flex-col">
      <PanelHeader title={t.bills.approvals.title} description={t.bills.approvals.description} />
      {items.length === 0 ? (
        <EmptyState icon={CircleCheck} title={t.bills.approvals.empty} className="py-8" />
      ) : (
        <div className="grid gap-3 px-5 pb-5">
          {items.map((item) =>
            item.type === "run" ? <RunApproval key={item.id} item={item} /> : <BillApproval key={item.id} item={item} />,
          )}
        </div>
      )}
    </Panel>
  );
}
