"use client";

import { CalendarClock, Scale, Wallet } from "lucide-react";
import { Amount } from "@/components/darb/amount";
import { StatCard } from "@/components/darb/stat-card";
import { fmt, plural } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { formatSAR } from "@/lib/ui/format";
import type { BillsView } from "../data";
import { NewPaymentRunButton } from "./bills-actions";

const bigAmount = { className: "text-2xl font-medium", currencyClassName: "text-base font-normal text-muted-foreground" };

/** Three Darb-style stat cards: main balance (+ New payment run), scheduled payments, available after scheduled (BP-18). */
export function BillsStats({ balances }: { balances: BillsView["balances"] }) {
  const { t, lang } = useI18n();
  const short = balances.available < 0;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        icon={Wallet}
        label={t.bills.stats.mainBalance}
        value={<Amount value={balances.main} {...bigAmount} />}
        sublabel={fmt(t.bills.stats.mainBalanceSub, { amount: formatSAR(balances.subwallets, lang) })}
        action={<NewPaymentRunButton className="px-4" />}
      />
      <StatCard
        icon={CalendarClock}
        label={t.bills.stats.scheduled}
        value={<Amount value={balances.scheduled} {...bigAmount} />}
        sublabel={plural(lang, t.bills.stats.scheduledSub, balances.scheduledCount)}
      />
      <StatCard
        icon={Scale}
        label={t.bills.stats.available}
        value={<Amount value={balances.available} {...bigAmount} />}
        sublabel={
          short
            ? fmt(t.bills.stats.shortBy, { amount: formatSAR(-balances.available, lang) })
            : t.bills.stats.availableSub
        }
        tone={short ? "warning" : "default"}
        className="sm:col-span-2 lg:col-span-1"
      />
    </div>
  );
}
