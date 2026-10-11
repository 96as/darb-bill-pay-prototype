"use client";

import { Landmark, Wallet } from "lucide-react";
import { Amount } from "@/components/darb/amount";
import { ArabicText } from "@/components/darb/arabic-text";
import { EmptyState } from "@/components/darb/empty-state";
import { InitialAvatar } from "@/components/darb/initial-avatar";
import { ListRow } from "@/components/darb/list-row";
import { Panel, PanelHeader, ViewAllLink } from "@/components/darb/panel";
import { fmt, plural } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { formatShortDate } from "@/lib/ui/format";
import type { BillsView } from "../data";

/** Owed per supplier (BP-11), SADAD billers included (BP-12). Darb list rows. */
export function OwedPanel({ owed }: { owed: BillsView["owed"] }) {
  const { t, lang } = useI18n();

  const summary = (billCount: number, overdueCount: number) =>
    [
      plural(lang, t.bills.owed.bills, billCount),
      overdueCount > 0 ? fmt(t.bills.owed.overdue, { count: overdueCount }) : null,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <Panel className="flex flex-col">
      <PanelHeader
        title={t.bills.owed.title}
        description={t.bills.owed.description}
        action={<ViewAllLink href="/bills/suppliers">{t.common.viewAll}</ViewAllLink>}
      />
      {owed.suppliers.length === 0 ? (
        <EmptyState icon={Wallet} title={t.bills.owed.empty} className="py-8" />
      ) : (
        <>
          <div className="mx-5 mb-2 flex items-center justify-between gap-3 rounded-lg bg-background-secondary px-4 py-3">
            <div>
              <p className="text-xs text-muted-foreground">{t.bills.owed.total}</p>
              <p className="text-xs text-muted-foreground">{summary(owed.billCount, owed.overdueCount)}</p>
            </div>
            <Amount
              value={owed.total}
              className="text-lg font-medium"
              currencyClassName="text-sm font-normal text-muted-foreground"
            />
          </div>
          <ul className="divide-y pb-2">
            {owed.suppliers.map((s) => {
              const name = lang === "ar" && s.nameAr ? <ArabicText>{s.nameAr}</ArabicText> : s.name;
              const next = s.nextDue ? fmt(t.bills.owed.nextDue, { date: formatShortDate(s.nextDue, lang) }) : null;
              return (
                <li key={s.key}>
                  <ListRow
                    href="/bills/suppliers"
                    avatar={
                      s.kind === "sadad"
                        ? <InitialAvatar name={s.name} icon={Landmark} />
                        : <InitialAvatar name={lang === "ar" && s.nameAr ? s.nameAr : s.name} />
                    }
                    title={name}
                    subtitle={[summary(s.billCount, s.overdueCount), next].filter(Boolean).join(" · ")}
                    trailing={<Amount value={s.total} />}
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Panel>
  );
}
