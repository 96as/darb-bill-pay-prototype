// Alerts for the acting user (due soon, failed/returned, short balance, IBAN change, approval needed).
import type { Alert } from "@/lib/domain/types";
import type { Ctx } from "../context";
import { notFound, ServiceError } from "../errors";

export function listAlerts(ctx: Ctx, userId: string, opts: { unreadOnly?: boolean } = {}): { alerts: Alert[]; unread: number } {
  const mine = ctx.store.alerts.filter((a) => a.to === userId).sort((a, b) => b.at.localeCompare(a.at));
  return { alerts: opts.unreadOnly ? mine.filter((a) => !a.read) : mine, unread: mine.filter((a) => !a.read).length };
}

export function markAlertRead(ctx: Ctx, alertId: string, userId: string): Alert {
  const alert = ctx.store.alerts.find((a) => a.id === alertId);
  if (!alert) throw notFound("Alert", alertId);
  if (alert.to !== userId) throw new ServiceError("not_yours", "This alert belongs to another user", 403);
  alert.read = true;
  return alert;
}

export function markAllAlertsRead(ctx: Ctx, userId: string): number {
  let n = 0;
  for (const a of ctx.store.alerts) {
    if (a.to === userId && !a.read) {
      a.read = true;
      n++;
    }
  }
  return n;
}
