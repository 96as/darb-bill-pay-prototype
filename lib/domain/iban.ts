// IBAN format and checksum (PL-02: "IBAN format and checksum validated"; BP-05: a failing IBAN is refused).
import { stripInvisible, toLatinDigits } from "./text";

/** Strips spaces, dashes and invisible marks, uppercases, converts Arabic digits. */
export function normalizeIban(raw: string): string {
  return toLatinDigits(stripInvisible(raw)).replace(/[\s-]/g, "").toUpperCase();
}

/** ISO 13616: country code, 2 check digits, 11-30 alphanumerics, mod 97 = 1. */
export function isValidIban(raw: string): boolean {
  const iban = normalizeIban(raw);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  return mod97(iban.slice(4) + iban.slice(0, 4)) === 1;
}

/** Letters become 10..35, then the remainder is taken digit by digit (no BigInt needed). */
function mod97(s: string): number {
  let rem = 0;
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    const value = code >= 65 ? code - 55 : code - 48;
    rem = value >= 10 ? (rem * 100 + value) % 97 : (rem * 10 + value) % 97;
  }
  return rem;
}

/** Saudi IBAN: "SA" + 2 check digits + 2-digit bank code + 18-digit account = 24 characters. */
export function isValidSaudiIban(raw: string): boolean {
  const iban = normalizeIban(raw);
  return /^SA\d{22}$/.test(iban) && isValidIban(iban);
}

export interface SaudiBank {
  code: string;
  name: string;
  nameAr: string;
}

const SAUDI_BANKS: Record<string, Omit<SaudiBank, "code">> = {
  "05": { name: "Alinma Bank", nameAr: "مصرف الإنماء" },
  "10": { name: "Saudi National Bank", nameAr: "البنك الأهلي السعودي" },
  "15": { name: "Bank AlBilad", nameAr: "بنك البلاد" },
  "20": { name: "Riyad Bank", nameAr: "بنك الرياض" },
  "30": { name: "Arab National Bank", nameAr: "البنك العربي الوطني" },
  "45": { name: "SAB", nameAr: "البنك السعودي الأول" },
  "55": { name: "Banque Saudi Fransi", nameAr: "البنك السعودي الفرنسي" },
  "60": { name: "Bank AlJazira", nameAr: "بنك الجزيرة" },
  "65": { name: "Saudi Investment Bank", nameAr: "البنك السعودي للاستثمار" },
  "80": { name: "Al Rajhi Bank", nameAr: "مصرف الراجحي" },
};

/** Bank from the 2-digit code after the check digits (characters 5-6). Null if not Saudi or unknown. */
export function saudiBankFromIban(raw: string): SaudiBank | null {
  const iban = normalizeIban(raw);
  if (!/^SA\d{4}/.test(iban)) return null;
  const code = iban.slice(4, 6);
  const bank = SAUDI_BANKS[code];
  return bank ? { code, ...bank } : null;
}

/** "SA67 1000 0000 0203 1555 0044". */
export function formatIban(raw: string): string {
  return normalizeIban(raw).replace(/(.{4})(?=.)/g, "$1 ");
}

/** Shows only the last 4 characters: "•••• 0044". Used wherever full bank details must not appear. */
export function maskIban(raw: string): string {
  const iban = normalizeIban(raw);
  return iban.length > 4 ? `•••• ${iban.slice(-4)}` : "••••";
}
