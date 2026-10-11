import { describe, expect, it } from "vitest";
import { formatIban, isValidIban, isValidSaudiIban, maskIban, normalizeIban, saudiBankFromIban } from "./iban";

// Every IBAN in docs/BUILD-NOTES.md.
const SEED_IBANS = {
  SA5880000000318204466710: "Al Rajhi Bank",
  SA6710000000020315550044: "Saudi National Bank",
  SA2045000000001234567001: "SAB",
  SA0405000000008800112233: "Alinma Bank",
  SA5215000000004400998877: "Bank AlBilad",
  SA2820000000003300776655: "Riyad Bank",
} as const;

describe("IBAN validation", () => {
  it.each(Object.keys(SEED_IBANS))("accepts seed IBAN %s", (iban) => {
    expect(isValidIban(iban)).toBe(true);
    expect(isValidSaudiIban(iban)).toBe(true);
  });

  it("accepts spaced, lowercase and Arabic-digit input", () => {
    expect(isValidSaudiIban("sa67 1000 0000 0203 1555 0044")).toBe(true);
    expect(isValidSaudiIban("‏SA67-1000-0000-0203-1555-0044")).toBe(true);
    expect(isValidSaudiIban("SA٦٧١٠٠٠٠٠٠٠٠٢٠٣١٥٥٥٠٠٤٤")).toBe(true);
  });

  it("accepts valid foreign IBANs generically, but not as Saudi", () => {
    expect(isValidIban("GB82 WEST 1234 5698 7654 32")).toBe(true);
    expect(isValidIban("DE89370400440532013000")).toBe(true);
    expect(isValidSaudiIban("GB82WEST12345698765432")).toBe(false);
  });

  it.each([
    ["one digit changed", "SA6710000000020315550045"],
    ["two digits swapped", "SA6710000000020315550404"],
    ["wrong check digits", "SA6810000000020315550044"],
    ["too short", "SA671000000002031555004"],
    ["too long", "SA67100000000203155500440"],
    ["letters in Saudi BBAN", "SA67100000000203155500AB"],
    ["no country", "6710000000020315550044"],
    ["empty", ""],
    ["garbage", "not an iban"],
  ])("refuses %s", (_label, iban) => {
    expect(isValidSaudiIban(iban)).toBe(false);
  });

  it("refuses a generic IBAN with a bad checksum", () => {
    expect(isValidIban("GB82WEST12345698765433")).toBe(false);
  });
});

describe("bank lookup", () => {
  it.each(Object.entries(SEED_IBANS))("%s → %s", (iban, name) => {
    expect(saudiBankFromIban(iban)?.name).toBe(name);
  });

  it("covers the required bank codes", () => {
    const codes: Record<string, string> = {
      "80": "Al Rajhi Bank",
      "10": "Saudi National Bank",
      "45": "SAB",
      "05": "Alinma Bank",
      "15": "Bank AlBilad",
      "20": "Riyad Bank",
      "55": "Banque Saudi Fransi",
      "30": "Arab National Bank",
      "60": "Bank AlJazira",
      "65": "Saudi Investment Bank",
    };
    for (const [code, name] of Object.entries(codes)) {
      expect(saudiBankFromIban(`SA00${code}000000000000000000`)).toMatchObject({ code, name });
    }
  });

  it("returns Arabic names and null for unknown or non-Saudi", () => {
    expect(saudiBankFromIban("SA5880000000318204466710")?.nameAr).toBe("مصرف الراجحي");
    expect(saudiBankFromIban("SA0099000000000000000000")).toBeNull();
    expect(saudiBankFromIban("GB82WEST12345698765432")).toBeNull();
  });
});

describe("formatting", () => {
  it("normalizes", () => {
    expect(normalizeIban(" sa67 1000-0000 0203 1555 0044 ")).toBe("SA6710000000020315550044");
  });

  it("groups by 4", () => {
    expect(formatIban("SA6710000000020315550044")).toBe("SA67 1000 0000 0203 1555 0044");
    expect(formatIban("sa67 10000000020315550044")).toBe("SA67 1000 0000 0203 1555 0044");
  });

  it("masks all but the last 4", () => {
    expect(maskIban("SA6710000000020315550044")).toBe("•••• 0044");
    expect(maskIban("SA67 1000 0000 0203 1555 0044")).toBe("•••• 0044");
    expect(maskIban("123")).toBe("••••");
  });
});
