// UI formatters. Money and Riyadh calendar maths come from lib/domain (single source of truth);
// this file only adds the display strings (short month names, 12-hour clock, Arabic labels).
import { formatAmount, formatSAR as domainFormatSAR } from "@/lib/domain/money";
import { atRiyadh, riyadhDate as domainRiyadhDate, riyadhParts as domainRiyadhParts } from "@/lib/domain/time";
import type { Halalas, ISODate, ISODateTime } from "@/lib/domain/types";
import type { Lang } from "@/lib/i18n/config";

// ---------- Money (lib/domain/money.ts) ----------

/** 4500000 → "45,000.00". */
export const formatHalalas = (amount: Halalas): string => formatAmount(amount);

/** 4500000 → "45,000.00 SAR" (Arabic UI: "45,000.00 ر.س"). */
export const formatSAR = (amount: Halalas, lang: Lang = "en"): string => domainFormatSAR(amount, lang);

export function currencyLabel(lang: Lang): string {
  return lang === "ar" ? "ر.س" : "SAR";
}

// ---------- Riyadh time (lib/domain/time.ts) ----------

const MONTHS: Record<Lang, string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
};

const WEEKDAYS: Record<Lang, string[]> = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  ar: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
};

const pad2 = (n: number) => String(n).padStart(2, "0");

export function riyadhParts(instant: ISODateTime) {
  return domainRiyadhParts(instant);
}

/** Calendar date in Riyadh for a UTC instant: "2026-10-15". */
export function riyadhDate(instant: ISODateTime): ISODate {
  return domainRiyadhDate(instant);
}

/** Riyadh wall-clock time "16:10" for a UTC instant (for <input type="time">). */
export function riyadhTime(instant: ISODateTime): string {
  return domainRiyadhParts(instant).time;
}

/** Riyadh date "YYYY-MM-DD" + time "HH:MM" → UTC ISO instant. */
export function riyadhToInstant(date: ISODate, time: string): ISODateTime {
  return atRiyadh(date, time).toISOString();
}

function parseISODate(date: ISODate) {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() };
}

/** "2026-10-14" → "14 Oct 2026" / "14 أكتوبر 2026". */
export function formatDate(date: ISODate, lang: Lang = "en"): string {
  const p = parseISODate(date);
  return `${p.day} ${MONTHS[lang][p.month - 1]} ${p.year}`;
}

/** "2026-10-14" → "14 Oct" / "14 أكتوبر". */
export function formatShortDate(date: ISODate, lang: Lang = "en"): string {
  const p = parseISODate(date);
  return `${p.day} ${MONTHS[lang][p.month - 1]}`;
}

/** "2026-10-18" → "Sun 18 Oct" / "الأحد 18 أكتوبر". */
export function formatDayDate(date: ISODate, lang: Lang = "en"): string {
  const p = parseISODate(date);
  return `${WEEKDAYS[lang][p.weekday]} ${p.day} ${MONTHS[lang][p.month - 1]}`;
}

function formatTime12(hour: number, minute: number, lang: Lang): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = lang === "ar" ? (hour < 12 ? "ص" : "م") : hour < 12 ? "AM" : "PM";
  return `${h12}:${pad2(minute)} ${suffix}`;
}

/** Riyadh time of an instant: "4:10 PM" / "4:10 م". */
export function formatTime(instant: ISODateTime, lang: Lang = "en"): string {
  const p = domainRiyadhParts(instant);
  return formatTime12(p.hour, p.minute, lang);
}

/** "15 Oct 2026, 4:05 PM" (Riyadh). */
export function formatDateTime(instant: ISODateTime, lang: Lang = "en"): string {
  const p = domainRiyadhParts(instant);
  const comma = lang === "ar" ? "،" : ",";
  return `${formatDate(p.date, lang)}${comma} ${formatTime12(p.hour, p.minute, lang)}`;
}

/**
 * Demo clock: "Thu 15 Oct 2026, 4:10 PM" (+ " Riyadh" when `tzSuffix` is given;
 * "Thu 15 Oct, 4:10 PM" with `withYear: false`). Arabic: "الخميس 15 أكتوبر 2026، 4:10 م".
 */
export function formatClock(
  instant: ISODateTime,
  lang: Lang = "en",
  { tzSuffix, withYear = true }: { tzSuffix?: string; withYear?: boolean } = {},
): string {
  const p = domainRiyadhParts(instant);
  const comma = lang === "ar" ? "،" : ",";
  const date = `${WEEKDAYS[lang][p.weekday]} ${p.day} ${MONTHS[lang][p.month - 1]}${withYear ? ` ${p.year}` : ""}`;
  const text = `${date}${comma} ${formatTime12(p.hour, p.minute, lang)}`;
  return tzSuffix ? `${text} ${tzSuffix}` : text;
}

/** File size: 303.2 KB. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
