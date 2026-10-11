// Supplier payment notice (PL-05, BP-13): sent only after the payment leaves; Arabic and English;
// payer, invoice number, amount, transfer reference and expected arrival. Never any bank details.
import type { Bill, ISODate, Payment, Supplier, SupplierNotice } from "@/lib/domain/types";
import { formatSAR } from "@/lib/domain/money";
import { railAndArrival } from "@/lib/domain/rails";
import { parseISODate, weekdayName } from "@/lib/domain/time";
import type { Ctx } from "../context";
import { ServiceError } from "../errors";
import { newId } from "../ids";

const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

/** "Sunday 18 October 2026" / "الأحد 18 أكتوبر 2026" (Latin digits, as in Darb's app). */
export function longDate(date: ISODate, lang: "en" | "ar"): string {
  const { year, month, day } = parseISODate(date);
  const months = lang === "ar" ? MONTHS_AR : MONTHS_EN;
  return `${weekdayName(date, lang)} ${day} ${months[month - 1]} ${year}`;
}

/** Arrival the supplier is told: computed by the same rail function as the quote before approval (promise C). */
export function noticeArrival(payment: Payment): ISODate {
  if (!payment.sentAt) throw new ServiceError("not_sent", "A notice is only sent after the payment leaves", 409);
  return railAndArrival(payment.amount, new Date(payment.sentAt)).arrivalDate;
}

/** Builds the notice, or null when the supplier has no notice email or mobile. */
export function buildSupplierNotice(ctx: Ctx, bill: Bill, payment: Payment, supplier: Supplier): SupplierNotice | null {
  if (!payment.sentAt || !payment.transferRef) throw new ServiceError("not_sent", "A notice is only sent after the payment leaves", 409);
  const to = supplier.noticeEmail ?? supplier.noticeMobile;
  if (!to) return null;
  const arrival = noticeArrival(payment);
  const company = ctx.store.company;
  const invoice = bill.invoiceNumber;

  const bodyEn = [
    `${company.name} has sent you a payment through Darb.`,
    "",
    `Invoice: ${invoice}`,
    `Amount: ${formatSAR(payment.amount)}`,
    `Transfer reference: ${payment.transferRef}`,
    `Expected arrival: ${longDate(arrival, "en")}`,
    "",
    `Questions about this payment? Contact ${company.name} and quote the transfer reference.`,
  ].join("\n");

  const bodyAr = [
    `أرسلت ${company.nameAr} لكم دفعة عبر درب.`,
    "",
    `رقم الفاتورة: ${invoice}`,
    `المبلغ: ${formatSAR(payment.amount, "ar")}`,
    `مرجع التحويل: ${payment.transferRef}`,
    `موعد الوصول المتوقع: ${longDate(arrival, "ar")}`,
    "",
    `لأي استفسار عن هذه الدفعة، تواصلوا مع ${company.nameAr} واذكروا مرجع التحويل.`,
  ].join("\n");

  return {
    id: newId(ctx.store, "ntc"),
    paymentId: payment.id,
    billId: bill.id,
    supplierId: supplier.id,
    channel: supplier.noticeEmail ? "email" : "sms",
    to,
    subjectEn: `Payment sent for invoice ${invoice}`,
    bodyEn,
    subjectAr: `تم إرسال دفعة الفاتورة ${invoice}`,
    bodyAr,
    sentAt: ctx.now.toISOString(),
  };
}
