// TEMPORARY local formatters for the UI.
// A domain `formatSAR` will land in lib/domain/money.ts; swap `formatSAR` below to it then.
// Everything here is deterministic (no Intl date/locale data), so server and client render the same text.
import type { Halalas, ISODate, ISODateTime } from "@/lib/domain/types";
import type { Lang } from "@/lib/i18n/config";

// ---------- Money ----------

const CURRENCY: Record<Lang, string> = { en: "SAR", ar: "ر.س" };

/** 4500000 → "45,000.00" (integer math, no floats). */
export function formatHalalas(amount: Halalas): string {
  const negative = amount < 0;
  const abs = Math.abs(Math.trunc(amount));
  const whole = Math.floor(abs / 100);
  const fraction = abs % 100;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}.${String(fraction).padStart(2, "0")}`;
}

/** 4500000 → "45,000.00 SAR" (Arabic UI: "45,000.00 ر.س"). */
export function formatSAR(amount: Halalas, lang: Lang = "en"): string {
  return `${formatHalalas(amount)} ${CURRENCY[lang]}`;
}

export function currencyLabel(lang: Lang): string {
  return CURRENCY[lang];
}

// ---------- Dates (Asia/Riyadh is UTC+3 all year, no DST) ----------

const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

const MONTHS: Record<Lang, string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
};

const WEEKDAYS: Record<Lang, string[]> = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  ar: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
};

interface RiyadhParts {
  year: number;
  month: number; // 1-12
  day: number;
  weekday: number; // 0 = Sunday
  hour: number; // 0-23
  minute: number;
}

export function riyadhParts(instant: ISODateTime): RiyadhParts {
  const d = new Date(new Date(instant).getTime() + RIYADH_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Calendar date in Riyadh for a UTC instant: "2026-10-15". */
export function riyadhDate(instant: ISODateTime): ISODate {
  const p = riyadhParts(instant);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** Riyadh wall-clock time "16:10" for a UTC instant (for <input type="time">). */
export function riyadhTime(instant: ISODateTime): string {
  const p = riyadhParts(instant);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** Riyadh date "YYYY-MM-DD" + time "HH:MM" → UTC ISO instant. */
export function riyadhToInstant(date: ISODate, time: string): ISODateTime {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - RIYADH_OFFSET_MS).toISOString();
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

function formatTime12(hour: number, minute: number, lang: Lang): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = lang === "ar" ? (hour < 12 ? "ص" : "م") : hour < 12 ? "AM" : "PM";
  return `${h12}:${pad2(minute)} ${suffix}`;
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
  const p = riyadhParts(instant);
  const comma = lang === "ar" ? "،" : ",";
  const date = `${WEEKDAYS[lang][p.weekday]} ${p.day} ${MONTHS[lang][p.month - 1]}${withYear ? ` ${p.year}` : ""}`;
  const text = `${date}${comma} ${formatTime12(p.hour, p.minute, lang)}`;
  return tzSuffix ? `${text} ${tzSuffix}` : text;
}
