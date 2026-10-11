"use client";

import { Popover } from "@base-ui/react/popover";
import { Bell, BellOff, CalendarClock, CircleAlert, KeyRound, ShieldCheck, Undo2, Wallet, type LucideIcon } from "lucide-react";
import type { Alert } from "@/lib/domain/types";
import { fmt } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { api } from "@/lib/ui/api";
import { formatDateTime } from "@/lib/ui/format";
import { useApiAction } from "@/lib/ui/use-api-action";
import { cn } from "@/lib/utils";
import { useDemoState } from "./demo-state";

const KIND_ICON: Record<Alert["kind"], LucideIcon> = {
  short_balance: Wallet,
  payment_failed: CircleAlert,
  payment_returned: Undo2,
  due_soon: CalendarClock,
  iban_change: KeyRound,
  approval_needed: ShieldCheck,
};

const KIND_TONE: Record<Alert["kind"], string> = {
  short_balance: "bg-warning text-warning-foreground",
  payment_failed: "bg-error text-error-foreground",
  payment_returned: "bg-error text-error-foreground",
  due_soon: "bg-warning text-warning-foreground",
  iban_change: "bg-warning text-warning-foreground",
  approval_needed: "bg-information text-information-foreground",
};

/** Round bell in the header: store.alerts for the acting user, with an unread dot. */
export function AlertsBell() {
  const { t, lang } = useI18n();
  const { alerts, actingUser } = useDemoState();
  const { run, pending } = useApiAction();
  const unread = alerts.filter((a) => !a.read).length;
  const label = unread > 0 ? `${t.alerts.title} (${fmt(t.alerts.unread, { count: unread })})` : t.alerts.title;

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={label}
        className="relative flex size-8 items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted"
      >
        <Bell className="size-4" aria-hidden />
        {unread > 0 ? (
          <span
            aria-hidden
            className="absolute -end-0.5 -top-0.5 size-2.5 rounded-full border-2 border-background bg-error-foreground"
          />
        ) : null}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="isolate z-50">
          <Popover.Popup className="w-80 origin-(--transform-origin) rounded-xl bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <div className="min-w-0">
                <Popover.Title className="text-sm font-medium">{t.alerts.title}</Popover.Title>
                <Popover.Description className="truncate text-xs text-muted-foreground">
                  {fmt(t.alerts.description, { name: lang === "ar" ? actingUser.nameAr : actingUser.name })}
                </Popover.Description>
              </div>
              {unread > 0 ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => api.post("/api/alerts/read-all"))}
                  className="shrink-0 rounded-md text-xs font-medium text-primary hover:underline disabled:opacity-50"
                >
                  {t.alerts.markAllRead}
                </button>
              ) : null}
            </div>
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
                <BellOff className="size-5" aria-hidden />
                {t.alerts.empty}
              </div>
            ) : (
              <ul className="max-h-96 divide-y overflow-y-auto">
                {alerts.map((alert) => {
                  const Icon = KIND_ICON[alert.kind];
                  return (
                    <li key={alert.id}>
                      <button
                        type="button"
                        disabled={alert.read || pending}
                        onClick={() => run(() => api.post(`/api/alerts/${alert.id}/read`))}
                        className={cn(
                          "flex w-full gap-3 px-4 py-3 text-start outline-none focus-visible:bg-muted disabled:cursor-default",
                          !alert.read && "bg-primary-surface/40 hover:bg-primary-surface/70",
                        )}
                      >
                      <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full", KIND_TONE[alert.kind])}>
                        <Icon className="size-3.5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="flex items-center gap-1.5 text-xs font-medium">
                          {t.alerts.kinds[alert.kind]}
                          {!alert.read ? <span aria-hidden className="size-1.5 rounded-full bg-primary" /> : null}
                        </p>
                        <p className="text-sm leading-snug" lang={lang === "ar" ? "ar" : undefined}>
                          {lang === "ar" ? alert.messageAr : alert.message}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">{formatDateTime(alert.at, lang)}</p>
                      </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
