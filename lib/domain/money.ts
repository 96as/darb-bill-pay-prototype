// Money is always integer halalas (1 SAR = 100 halalas). Parse at the edge, format at the edge.
import type { Halalas } from "./types";
import { stripInvisible, toLatinDigits } from "./text";

/** Largest amount we accept anywhere: SAR 10 billion. Keeps every value a safe integer. */
export const MAX_HALALAS: Halalas = 1_000_000_000_000;

/** Saudi standard VAT rate, percent. */
export const VAT_RATE_PERCENT = 15;

const CURRENCY_LABEL = /^(?:SAR|SR|ر\.?\s?س\.?|﷼|⃁)\s*|\s*(?:SAR|SR|ر\.?\s?س\.?|﷼|⃁)$/gi;
const AMOUNT = /^(-)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?$/;

/**
 * Parses an amount in riyals to halalas without float drift.
 * Accepts 45000, 45000.5, "45,000.00", "SAR 45,000.00", "45,000.00 ر.س", "٤٥٬٠٠٠٫٠٠".
 * Throws RangeError on anything else, including more than 2 non-zero decimals.
 */
export function sar(input: string | number): Halalas {
  const h = typeof input === "number" ? fromNumber(input) : fromString(input);
  return assertInRange(h === 0 ? 0 : h); // normalise -0
}

function fromString(raw: string): Halalas {
  const s = toLatinDigits(stripInvisible(raw)).trim().replace(CURRENCY_LABEL, "").trim();
  const m = AMOUNT.exec(s);
  if (!m) throw new RangeError(`Not an amount: "${raw}"`);
  const [, minus, wholeDigits, fracDigits = ""] = m;
  if (/[1-9]/.test(fracDigits.slice(2))) throw new RangeError(`More than 2 decimals: "${raw}"`);
  const whole = wholeDigits.replace(/,/g, "");
  if (whole.length > 13) throw new RangeError(`Amount too large: "${raw}"`);
  const h = Number(whole) * 100 + Number(fracDigits.slice(0, 2).padEnd(2, "0"));
  return minus ? -h : h;
}

function fromNumber(n: number): Halalas {
  if (!Number.isFinite(n)) throw new RangeError(`Not an amount: ${n}`);
  if (Math.abs(n) * 100 > MAX_HALALAS) throw new RangeError(`Amount too large: ${n}`);
  const x = n * 100;
  const h = Math.round(x);
  // Float drift (45000.1 * 100 = 4500010.000000001) is tiny; a real 3rd decimal is not.
  if (Math.abs(x - h) > 0.001) throw new RangeError(`More than 2 decimals: ${n}`);
  return h;
}

function assertInRange(h: Halalas): Halalas {
  if (!Number.isSafeInteger(h) || Math.abs(h) > MAX_HALALAS) throw new RangeError(`Amount out of range: ${h}`);
  return h;
}

export function assertHalalas(h: Halalas): void {
  if (!Number.isSafeInteger(h)) throw new TypeError(`Halalas must be an integer, got ${h}`);
}

/** "45,000.00" (Latin digits, comma thousands, 2 decimals). */
export function formatAmount(h: Halalas): string {
  assertHalalas(h);
  const abs = Math.abs(h);
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = (abs % 100).toString().padStart(2, "0");
  return `${h < 0 ? "-" : ""}${whole}.${frac}`;
}

/** Darb's format: "45,000.00 SAR"; for an Arabic locale "45,000.00 ر.س" (Latin digits kept). */
export function formatSAR(h: Halalas, locale: string = "en"): string {
  return `${formatAmount(h)} ${locale.toLowerCase().startsWith("ar") ? "ر.س" : "SAR"}`;
}

/** Plain decimal for files and XML: 4500000 → "45000.00". */
export function toDecimalString(h: Halalas): string {
  return formatAmount(h).replace(/,/g, "");
}

// ---------- VAT ----------

/** Integer division rounded half away from zero. */
function divRound(a: number, b: number): number {
  const q = Math.floor((Math.abs(a) * 2 + b) / (2 * b));
  return a < 0 ? -q : q;
}

/** VAT on a VAT-exclusive amount, rounded to the halala (half up). */
export function vatOn(subtotal: Halalas, ratePercent: number = VAT_RATE_PERCENT): Halalas {
  assertHalalas(subtotal);
  return divRound(subtotal * ratePercent, 100);
}

/** Splits a VAT-inclusive total: 45,000.00 → 39,130.43 + 5,869.57. */
export function splitVatInclusive(
  total: Halalas,
  ratePercent: number = VAT_RATE_PERCENT,
): { subtotal: Halalas; vat: Halalas } {
  assertHalalas(total);
  const subtotal = divRound(total * 100, 100 + ratePercent);
  return { subtotal, vat: total - subtotal };
}

/** True when subtotal + VAT equals the total within `tolerance` halalas (default 1). */
export function totalsAgree(subtotal: Halalas, vat: Halalas, total: Halalas, tolerance: Halalas = 1): boolean {
  return Math.abs(subtotal + vat - total) <= tolerance;
}

export function sumHalalas(amounts: readonly Halalas[]): Halalas {
  return amounts.reduce((acc, a) => acc + a, 0);
}
