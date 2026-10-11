// Mock account-name check (BP-06; BUILD-NOTES 6): fixed outcomes by IBAN; unknown IBANs are a close match.
import type { NameCheck, NameCheckResult } from "@/lib/domain/types";
import { normalizeIban } from "@/lib/domain/iban";

export interface NameCheckService {
  check(iban: string, expectedName: string, now: Date): NameCheck;
}

const FIXED: Record<string, { result: NameCheckResult; returnedName?: string }> = {
  // Supplier A
  SA5880000000318204466710: { result: "match", returnedName: "GREEN OASIS LANDSCAPING EST" },
  // Supplier B, both IBANs
  SA6710000000020315550044: { result: "match", returnedName: "COOL BREEZE HVAC CONTRACTING CO" },
  SA2045000000001234567001: { result: "match", returnedName: "COOL BREEZE HVAC CONTRACTING CO" },
  SA0405000000008800112233: { result: "close_match" },
  SA5215000000004400998877: { result: "no_match", returnedName: "AL MANARA GENERAL TRADING EST" },
  // Rail failure demo: the name matches, the rail returns the payment.
  SA2820000000003300776655: { result: "match" },
};

/** "Cool Breeze HVAC Contracting Co." → "COOL BREEZE HVAC CONTRACTING" (close, not equal). */
export function nearName(name: string): string {
  const words = name
    .toUpperCase()
    .replace(/[^A-Za-z0-9\u00C0-\u024F\u0600-\u06FF\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return (words.length > 2 ? words.slice(0, -1) : [...words, "TRADING"]).join(" ");
}

const exactName = (name: string) =>
  name
    .toUpperCase()
    .replace(/[^A-Za-z0-9\u00C0-\u024F\u0600-\u06FF\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function createFixedNameCheck(): NameCheckService {
  return {
    check(iban, expectedName, now) {
      const fixed = FIXED[normalizeIban(iban)];
      const result = fixed?.result ?? "close_match";
      const returnedName =
        fixed?.returnedName ?? (result === "close_match" ? nearName(expectedName) : exactName(expectedName));
      return { result, returnedName, checkedAt: now.toISOString() };
    },
  };
}
