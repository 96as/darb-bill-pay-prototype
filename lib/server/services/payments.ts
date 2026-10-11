// Payments: cancel until sent (BP-18) and the downloadable payment confirmation (BP-14).
import type { Bill } from "@/lib/domain/types";
import { formatSAR } from "@/lib/domain/money";
import { maskIban } from "@/lib/domain/iban";
import type { Ctx } from "../context";
import { conflict } from "../errors";
import { findSupplier, getBill, getPayment, latestPayment } from "./common";
import { cancelBill } from "./bills";
import { longDate } from "./notices";
import { riyadhParts } from "@/lib/domain/time";

/** Cancelling a scheduled payment cancels its bill (BP-18: until it is sent). */
export function cancelPayment(ctx: Ctx, paymentId: string, actorId: string): Bill {
  return cancelBill(ctx, getPayment(ctx, paymentId).billId, actorId);
}

export interface PaymentConfirmation {
  payer: { name: string; nameAr: string; vatNumber: string };
  payee: { name: string; nameAr?: string; bankName?: string; ibanMasked?: string; billerCode?: string };
  invoiceNumber: string;
  invoiceFile?: string;
  vat?: number;
  amount: number;
  amountText: string;
  amountTextAr: string;
  rail: string;
  transferRef: string;
  sentAt: string;
  settledAt?: string;
  expectedArrival: string;
  fundingAccount: string;
  approvedBy: string[];
}

const RAIL_LABEL: Record<string, { en: string; ar: string }> = {
  instant: { en: "Instant payment (sarie)", ar: "دفع فوري (سريع)" },
  sarie: { en: "SARIE transfer", ar: "تحويل سريع (SARIE)" },
  sadad: { en: "SADAD", ar: "سداد" },
};

export function paymentConfirmation(ctx: Ctx, billId: string): PaymentConfirmation {
  const bill = getBill(ctx, billId);
  const payment = latestPayment(ctx, bill);
  if (bill.status !== "paid" || !payment || payment.status !== "settled" || !payment.transferRef || !payment.sentAt) {
    throw conflict("not_paid", "A confirmation is available once the bill is paid");
  }
  const supplier = findSupplier(ctx, payment.supplierId);
  const account = ctx.store.accounts.find((a) => a.id === payment.fundingAccountId);
  const userName = (id: string) => ctx.store.users.find((u) => u.id === id)?.name ?? id;
  return {
    payer: { name: ctx.store.company.name, nameAr: ctx.store.company.nameAr, vatNumber: ctx.store.company.vatNumber },
    payee: bill.sadad
      ? { name: bill.sadad.billerName, nameAr: bill.sadad.billerNameAr, billerCode: bill.sadad.billerCode }
      : { name: supplier?.nameEn ?? bill.supplierName, nameAr: supplier?.nameAr ?? bill.supplierNameAr, bankName: supplier?.bankName, ibanMasked: payment.iban ? maskIban(payment.iban) : undefined },
    invoiceNumber: bill.sadad?.billNumber ?? bill.invoiceNumber,
    invoiceFile: bill.file?.name,
    vat: bill.vat,
    amount: payment.amount,
    amountText: formatSAR(payment.amount),
    amountTextAr: formatSAR(payment.amount, "ar"),
    rail: payment.rail,
    transferRef: payment.transferRef,
    sentAt: payment.sentAt,
    settledAt: payment.settledAt,
    expectedArrival: payment.expectedArrival,
    fundingAccount: account?.name ?? payment.fundingAccountId,
    approvedBy: bill.approvals.map((a) => userName(a.userId)),
  };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** A self-contained bilingual HTML page (no scripts, no external assets) to download. */
export function renderConfirmationHtml(c: PaymentConfirmation): string {
  const sent = riyadhParts(c.sentAt);
  const rows: [string, string, string][] = [
    ["Payer", "الدافع", `${c.payer.name} · ${c.payer.nameAr}`],
    ["Paid to", "المستفيد", [c.payee.name, c.payee.nameAr].filter(Boolean).join(" · ")],
    ...(c.payee.bankName ? [["Bank", "البنك", `${c.payee.bankName} ${c.payee.ibanMasked ?? ""}`.trim()] as [string, string, string]] : []),
    ...(c.payee.billerCode ? [["SADAD biller", "رمز المفوتر", c.payee.billerCode] as [string, string, string]] : []),
    ["Invoice", "الفاتورة", c.invoiceNumber + (c.invoiceFile ? ` (${c.invoiceFile})` : "")],
    ["Amount", "المبلغ", `${c.amountText} · ${c.amountTextAr}`],
    ...(c.vat !== undefined ? [["VAT included", "ضريبة القيمة المضافة", formatSAR(c.vat)] as [string, string, string]] : []),
    ["Rail", "قناة الدفع", `${RAIL_LABEL[c.rail]?.en ?? c.rail} · ${RAIL_LABEL[c.rail]?.ar ?? c.rail}`],
    ["Transfer reference", "مرجع التحويل", c.transferRef],
    ["Sent", "تاريخ الإرسال", `${sent.date} ${sent.time} (Riyadh)`],
    ["Expected arrival", "موعد الوصول المتوقع", `${longDate(c.expectedArrival, "en")} · ${longDate(c.expectedArrival, "ar")}`],
    ["Paid from", "من حساب", c.fundingAccount],
    ["Approved by", "الموافقة", c.approvedBy.join(", ")],
  ];
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Payment confirmation ${esc(c.transferRef)}</title>
<style>body{font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;max-width:720px;margin:32px auto;padding:0 16px;color:#111}
h1{font-size:20px;margin:0 0 4px}p.sub{color:#555;margin:0 0 24px}table{width:100%;border-collapse:collapse}
td{padding:8px 6px;border-bottom:1px solid #e5e5e5;vertical-align:top}td.ar{direction:rtl;text-align:right;color:#555}
.note{margin-top:24px;font-size:12px;color:#666}</style></head>
<body><h1>Payment confirmation · تأكيد الدفع</h1><p class="sub">Darb Bill Pay (prototype, mock rail)</p>
<table>${rows.map(([en, ar, v]) => `<tr><td>${esc(en)}</td><td>${esc(v)}</td><td class="ar">${esc(ar)}</td></tr>`).join("")}</table>
<p class="note">Generated by the Darb Bill Pay prototype. Payment rails are simulated; this is not a bank document.</p>
</body></html>`;
}
