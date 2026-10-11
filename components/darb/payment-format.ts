// Text for payments: Riyadh dates, rail labels, rail reasons, approval hints.
// Pure (no hooks), so server and client components render the same text.
import type { Bill, ISODate, ISODateTime, Rail, Supplier } from "@/lib/domain/types";
import { parseISODate, riyadhParts, weekdayName } from "@/lib/domain/time";
import { fmt, type Dict, type Lang } from "@/lib/i18n";

const MONTHS: Record<Lang, readonly string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
};

const pad2 = (n: number) => String(n).padStart(2, "0");

/** "2026-10-18" → "Sun 18 Oct" / "الأحد 18 أكتوبر" (the expected-arrival format). */
export function formatArrival(date: ISODate, lang: Lang): string {
  const { month, day } = parseISODate(date);
  return `${weekdayName(date, lang, { short: true })} ${day} ${MONTHS[lang][month - 1]}`;
}

/** "2026-10-15" → "Thu 15 Oct 2026". */
export function formatDayDate(date: ISODate, lang: Lang): string {
  return `${formatArrival(date, lang)} ${parseISODate(date).year}`;
}

/** "2026-10-14" → "14 Oct 2026" (same as the bills table). */
export function formatPlainDate(date: ISODate, lang: Lang): string {
  const { year, month, day } = parseISODate(date);
  return `${day} ${MONTHS[lang][month - 1]} ${year}`;
}

/** Riyadh wall-clock time, 12-hour: "9:00 AM" / "9:00 ص". */
export function formatTime(instant: ISODateTime, lang: Lang): string {
  const { hour, minute } = riyadhParts(instant);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = lang === "ar" ? (hour < 12 ? "ص" : "م") : hour < 12 ? "AM" : "PM";
  return `${h12}:${pad2(minute)} ${suffix}`;
}

/** An instant in Riyadh: "Sun 18 Oct, 9:00 AM" / "الأحد 18 أكتوبر، 9:00 ص". */
export function formatInstant(instant: ISODateTime, lang: Lang): string {
  const { date } = riyadhParts(instant);
  return `${formatArrival(date, lang)}${lang === "ar" ? "،" : ","} ${formatTime(instant, lang)}`;
}

export function railLabel(rail: Rail, t: Dict): string {
  return t.payments.rails[rail];
}

/** Rail reason in words ("After 3:58 PM cut-off — next banking day"); empty when unknown. */
export function reasonLabel(reason: string | undefined, t: Dict): string {
  return reason ? (t.payments.reasons[reason] ?? "") : "";
}

/** Supplier/biller display name in the UI language. */
export function payeeName(bill: Pick<Bill, "supplierName" | "supplierNameAr" | "sadad">, lang: Lang, supplier?: Supplier): string {
  const en = supplier?.nameEn ?? bill.sadad?.billerName ?? bill.supplierName;
  const ar = supplier?.nameAr ?? bill.sadad?.billerNameAr ?? bill.supplierNameAr;
  return lang === "ar" && ar ? ar : en;
}

/** Invoice number, or "SADAD bill 1002387745". */
export function billReference(bill: Pick<Bill, "invoiceNumber" | "sadad">, t: Dict): string {
  return bill.sadad ? fmt(t.payments.sadadBill, { number: bill.sadad.billNumber }) : bill.invoiceNumber;
}

/**
 * A permission denial (lib/domain/permissions.ts) in the UI language. Fills {invoice}/{supplier}
 * from the bill the denial names; falls back to the domain's English message for unknown codes.
 */
export function permissionMessage(
  denial: { code: string; message: string; billId?: string },
  t: Dict,
  lang: Lang,
  lookup: { bills?: readonly Bill[]; suppliers?: readonly Supplier[] } = {},
): string {
  const template = t.payments.permissions[denial.code];
  if (!template) return denial.message;
  const bill = denial.billId ? lookup.bills?.find((b) => b.id === denial.billId) : lookup.bills?.length === 1 ? lookup.bills[0] : undefined;
  const supplier = bill?.supplierId ? lookup.suppliers?.find((s) => s.id === bill.supplierId) : undefined;
  return fmt(template, {
    invoice: bill ? billReference(bill, t) : "",
    supplier: bill ? payeeName(bill, lang, supplier) : "",
  });
}
