// Lookups and small helpers shared by the services.
import type { Alert, Bill, ISODate, Payment, PaymentRun, RailQuote, Supplier } from "@/lib/domain/types";
import { normalizeIban } from "@/lib/domain/iban";
import { quotePayment, quoteSadadPayment } from "@/lib/domain/rails";
import { riyadhDate } from "@/lib/domain/time";
import { formatSAR } from "@/lib/domain/money";
import type { Ctx } from "../context";
import { notFound } from "../errors";
import { newId } from "../ids";

export function getBill(ctx: Ctx, id: string): Bill {
  const bill = ctx.store.bills.find((b) => b.id === id);
  if (!bill) throw notFound("Bill", id);
  return bill;
}

export function getSupplier(ctx: Ctx, id: string): Supplier {
  const supplier = ctx.store.suppliers.find((s) => s.id === id);
  if (!supplier) throw notFound("Supplier", id);
  return supplier;
}

export const findSupplier = (ctx: Ctx, id: string | undefined) =>
  id ? ctx.store.suppliers.find((s) => s.id === id) : undefined;

export function getRunById(ctx: Ctx, id: string): PaymentRun {
  const run = ctx.store.runs.find((r) => r.id === id);
  if (!run) throw notFound("Payment run", id);
  return run;
}

export function getPayment(ctx: Ctx, id: string): Payment {
  const payment = ctx.store.payments.find((p) => p.id === id);
  if (!payment) throw notFound("Payment", id);
  return payment;
}

/** The bill's payment that has not left yet (scheduled or held). */
export const unsentPayment = (ctx: Ctx, billId: string): Payment | undefined =>
  ctx.store.payments.find((p) => p.billId === billId && (p.status === "scheduled" || p.status === "held"));

/** The bill's latest payment, whatever its status. */
export const latestPayment = (ctx: Ctx, bill: Bill): Payment | undefined =>
  (bill.paymentId && ctx.store.payments.find((p) => p.id === bill.paymentId)) ||
  [...ctx.store.payments].reverse().find((p) => p.billId === bill.id);

const SENT: ReadonlySet<Payment["status"]> = new Set(["sent", "settled"]);

/** BP-06 "first payment" means first to the supplier's current IBAN (accepted decision from phase 1). */
export function paidToCurrentIban(ctx: Ctx, supplier: Supplier): boolean {
  const iban = normalizeIban(supplier.iban);
  return ctx.store.payments.some(
    (p) => p.supplierId === supplier.id && SENT.has(p.status) && !!p.iban && normalizeIban(p.iban) === iban,
  );
}

export const paidSupplierIds = (ctx: Ctx): Set<string> =>
  new Set(ctx.store.suppliers.filter((s) => paidToCurrentIban(ctx, s)).map((s) => s.id));

/** Rail and arrival for a bill paid on `payDate`, seen from now (promise C: always via the rails module). */
export function quoteFor(ctx: Ctx, bill: Bill, payDate: ISODate): RailQuote {
  return bill.kind === "sadad" ? quoteSadadPayment(payDate, ctx.now) : quotePayment(bill.total, payDate, ctx.now);
}

/** The quote shown for an existing payment: the one stored with it, else rebuilt from its fields. */
export function quoteOfPayment(payment: Payment): RailQuote {
  return (
    payment.quote ?? {
      rail: payment.rail,
      sendAt: payment.sentAt ?? payment.scheduledFor,
      arrivalDate: payment.expectedArrival,
      sameDay: payment.expectedArrival === riyadhDate(payment.sentAt ?? payment.scheduledFor),
      reason: payment.rail === "instant" ? "instant_24_7" : payment.rail === "sadad" ? "sadad_24_7" : "sarie_in_window",
    }
  );
}

const LIVE: ReadonlySet<Payment["status"]> = new Set(["scheduled", "held", "sent", "settled"]);

/** Money already committed for a pay date (BUILD-NOTES 12: daily limit on the pay date's total). */
export function committedForDay(ctx: Ctx, day: ISODate, excludeBillIds: ReadonlySet<string> = new Set()): number {
  let sum = 0;
  for (const p of ctx.store.payments) {
    if (!LIVE.has(p.status) || excludeBillIds.has(p.billId)) continue;
    const bill = ctx.store.bills.find((b) => b.id === p.billId);
    const payDay = bill?.payDate ?? p.scheduledFor.slice(0, 10);
    if (payDay === day) sum += p.amount;
  }
  return sum;
}

/** "Cool Breeze HVAC Contracting Co. INV-2026-0451 (45,000.00 SAR)". */
export function billLabel(bill: Bill, lang: "en" | "ar" = "en"): string {
  const name = lang === "ar" ? (bill.sadad?.billerNameAr ?? bill.supplierNameAr ?? bill.supplierName) : (bill.sadad?.billerName ?? bill.supplierName);
  const number = bill.sadad?.billNumber ?? bill.invoiceNumber;
  return `${name} ${number} (${formatSAR(bill.total, lang)})`;
}

/** Adds an alert per recipient; with `dedupe`, skips recipients that already have the same message. */
export function notify(
  ctx: Ctx,
  to: string[],
  kind: Alert["kind"],
  message: string,
  messageAr: string,
  opts: { dedupe?: boolean } = {},
): Alert[] {
  const out: Alert[] = [];
  for (const userId of to) {
    if (opts.dedupe && ctx.store.alerts.some((a) => a.to === userId && a.kind === kind && a.message === message)) continue;
    const alert: Alert = { id: newId(ctx.store, "al"), at: ctx.now.toISOString(), to: userId, kind, message, messageAr, read: false };
    ctx.store.alerts.push(alert);
    out.push(alert);
  }
  return out;
}
