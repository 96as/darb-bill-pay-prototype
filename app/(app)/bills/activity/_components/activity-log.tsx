"use client";

import Link from "next/link";
import { History } from "lucide-react";
import { EmptyState } from "@/components/darb/empty-state";
import { InitialAvatar } from "@/components/darb/initial-avatar";
import { Panel, PanelHeader } from "@/components/darb/panel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { maskIban } from "@/lib/domain/iban";
import type { DisplayStatus } from "@/lib/domain/types";
import { useI18n } from "@/lib/i18n/client";
import { actionLabel, type AuditChange } from "@/lib/ui/audit";
import { formatDate, formatDateTime, formatSAR, formatTime, riyadhDate } from "@/lib/ui/format";
import { cn } from "@/lib/utils";
import type { ActivityView } from "../data";
import { ACTIVITY_FILTERS } from "../filters";

const MONEY_KEYS = new Set(["total", "subtotal", "vat", "amount", "balance"]);
const STATUS_KEYS = new Set(["status"]);

function summarize(value: string): string | undefined {
  if (!/^[[{]/.test(value)) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.length <= 4 ? parsed.map(String).join(", ") : `${parsed.length} items`;
    if (parsed && typeof parsed === "object" && "result" in parsed) return String((parsed as { result: unknown }).result);
    return "…";
  } catch {
    return undefined;
  }
}

function useValue(people: ActivityView["people"]) {
  const { t, lang } = useI18n();
  return (key: string, value: string | undefined): string => {
    if (value === undefined) return "—";
    const person = people[value];
    if (person) return lang === "ar" ? person.nameAr : person.name;
    const summary = summarize(value);
    if (summary !== undefined) return summary;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return formatDateTime(value, lang);
    if (MONEY_KEYS.has(key) && /^-?\d+$/.test(value)) return formatSAR(Number(value), lang);
    if (/iban/i.test(key) && /^SA\d{22}$/.test(value)) return maskIban(value);
    if (STATUS_KEYS.has(key) && value in t.status) return t.status[value as DisplayStatus];
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value, lang);
    return value.length > 60 ? `${value.slice(0, 57)}…` : value;
  };
}

function Changes({ changes, people }: { changes: AuditChange[]; people: ActivityView["people"] }) {
  const show = useValue(people);
  if (changes.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <ul className="space-y-0.5 text-xs">
      {changes.slice(0, 4).map((c) => (
        <li key={c.key} className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-muted-foreground">{c.key}</span>
          {c.before !== undefined ? (
            <>
              <span dir="ltr" className="text-muted-foreground line-through decoration-muted-foreground/40">{show(c.key, c.before)}</span>
              <span aria-hidden className="text-muted-foreground rtl:-scale-x-100">→</span>
            </>
          ) : null}
          <span dir="ltr" className="font-medium">{show(c.key, c.after)}</span>
        </li>
      ))}
      {changes.length > 4 ? <li className="text-muted-foreground">+{changes.length - 4}</li> : null}
    </ul>
  );
}

const edges = "px-3 first:ps-5 last:pe-5 xl:px-4 xl:first:ps-5 xl:last:pe-5";
const head = `h-10 ${edges} text-xs font-medium text-muted-foreground`;
const cell = `${edges} py-3 align-top`;

/** Audit log: time (Riyadh), who, action, item link, before → after for the keys that changed. */
export function ActivityLog({ view }: { view: ActivityView }) {
  const { t, lang } = useI18n();

  return (
    <Panel>
      <PanelHeader title={t.activity.title} description={t.activity.description}>
        <nav aria-label={t.activity.columns.entity} className="flex flex-wrap gap-1.5">
          {ACTIVITY_FILTERS.map((f) => {
            const active = view.filter === f;
            return (
              <Link
                key={f}
                href={f === "all" ? "/bills/activity" : `/bills/activity?type=${f}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm transition-colors",
                  active ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {f === "all" ? t.activity.all : t.activity.entities[f]}
                <span className="text-xs tabular-nums opacity-70">{view.counts[f]}</span>
              </Link>
            );
          })}
        </nav>
      </PanelHeader>
      {view.rows.length === 0 ? (
        <EmptyState icon={History} title={t.activity.empty} className="border-t" />
      ) : (
        <Table className="border-t">
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className={head}>{t.activity.columns.time}</TableHead>
              <TableHead className={head}>{t.activity.columns.who}</TableHead>
              <TableHead className={head}>{t.activity.columns.action}</TableHead>
              <TableHead className={head}>{t.activity.columns.entity}</TableHead>
              <TableHead className={cn(head, "w-[30%]")}>{t.activity.columns.changes}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className={cn(cell, "tabular-nums")}>
                  <div className="text-sm whitespace-nowrap">{formatDate(riyadhDate(row.at), lang)}</div>
                  <div className="text-xs text-muted-foreground">{formatTime(row.at, lang)}</div>
                </TableCell>
                <TableCell className={cell}>
                  <div className="flex items-center gap-2">
                    <InitialAvatar name={lang === "ar" ? row.actor.nameAr : row.actor.name} size="sm" tone={row.actorId === "system" ? "muted" : "soft"} />
                    <span className="text-sm">{row.actorId === "system" ? t.ui.system : lang === "ar" ? row.actor.nameAr : row.actor.name}</span>
                  </div>
                </TableCell>
                <TableCell className={cn(cell, "text-sm font-medium")}>{actionLabel(t, row.action)}</TableCell>
                <TableCell className={cn(cell, "max-w-56")}>
                  <div className="text-xs text-muted-foreground">{t.activity.entities[row.entity.type]}</div>
                  {row.href ? (
                    <Link href={row.href} className="block truncate text-sm text-primary hover:underline" dir="auto">
                      {row.entityLabel}
                    </Link>
                  ) : (
                    <span className="block truncate text-sm" dir="auto">{row.entityLabel ?? row.entity.id}</span>
                  )}
                </TableCell>
                <TableCell className={cn(cell, "whitespace-normal")}>
                  <Changes changes={row.changes} people={view.people} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}
