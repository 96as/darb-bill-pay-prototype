// Saudi VAT registration number and commercial registration (CR) formats (BP-05).
import { stripInvisible, toLatinDigits } from "./text";

/** Strips spaces, dashes and invisible marks; converts Arabic digits. */
export function normalizeDigits(raw: string): string {
  return toLatinDigits(stripInvisible(raw)).replace(/[\s-]/g, "");
}

/** ZATCA VAT number: 15 digits, starts with 3 and ends with 3. */
export function isValidSaudiVat(raw: string): boolean {
  return /^3\d{13}3$/.test(normalizeDigits(raw));
}

/** Commercial registration number: 10 digits. */
export function isValidCr(raw: string): boolean {
  return /^\d{10}$/.test(normalizeDigits(raw));
}
