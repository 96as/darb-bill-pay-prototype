import { describe, expect, it } from "vitest";
import {
  formatAmount,
  formatSAR,
  sar,
  splitVatInclusive,
  sumHalalas,
  toDecimalString,
  totalsAgree,
  vatOn,
} from "./money";

describe("sar", () => {
  it.each([
    ["45,000.00", 4_500_000],
    ["45000", 4_500_000],
    ["45000.5", 4_500_050],
    ["0.05", 5],
    ["1,234,567.89", 123_456_789],
    ["  SAR 1,234.50 ", 123_450],
    ["45,000.00 SAR", 4_500_000],
    ["45,000.00 ر.س", 4_500_000],
    ["٤٥٬٠٠٠٫٠٠", 4_500_000],
    ["-12.34", -1_234],
    ["45000.000", 4_500_000],
    ["0", 0],
  ])("parses %j", (input, expected) => {
    expect(sar(input)).toBe(expected);
  });

  it("parses numbers without float drift", () => {
    expect(sar(45000)).toBe(4_500_000);
    expect(sar(45000.1)).toBe(4_500_010);
    expect(sar(39130.43)).toBe(3_913_043);
    expect(sar(5869.57)).toBe(586_957);
    expect(sar(0.1 + 0.2)).toBe(30);
    expect(sar(1234567.89)).toBe(123_456_789);
    expect(Object.is(sar(-0), 0)).toBe(true);
  });

  it.each(["45000.005", "abc", "", "4,5000.00", "1e5", "12.", ".5", "45 000", "SAR", "1,000.00.00"])(
    "rejects %j",
    (input) => {
      expect(() => sar(input)).toThrow(RangeError);
    },
  );

  it("rejects numbers with real third decimals, non-finite and huge values", () => {
    expect(() => sar(45000.005)).toThrow(RangeError);
    expect(() => sar(1.005)).toThrow(RangeError);
    expect(() => sar(Number.NaN)).toThrow(RangeError);
    expect(() => sar(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => sar(1e13)).toThrow(RangeError);
    expect(() => sar("99999999999999")).toThrow(RangeError);
  });
});

describe("formatting", () => {
  it("formats Darb style", () => {
    expect(formatSAR(4_500_000)).toBe("45,000.00 SAR");
    expect(formatSAR(5)).toBe("0.05 SAR");
    expect(formatSAR(0)).toBe("0.00 SAR");
    expect(formatSAR(-123_456)).toBe("-1,234.56 SAR");
    expect(formatSAR(123_456_789_00)).toBe("123,456,789.00 SAR");
  });

  it("uses the Arabic currency label with Latin digits for ar locales", () => {
    expect(formatSAR(4_500_000, "ar")).toBe("45,000.00 ر.س");
    expect(formatSAR(805_000, "ar-SA")).toBe("8,050.00 ر.س");
  });

  it("formats bare amounts and decimals", () => {
    expect(formatAmount(100)).toBe("1.00");
    expect(formatAmount(99)).toBe("0.99");
    expect(toDecimalString(4_500_000)).toBe("45000.00");
  });

  it("refuses non-integer halalas", () => {
    expect(() => formatSAR(1.5)).toThrow(TypeError);
  });

  it("round-trips", () => {
    for (const h of [0, 1, 99, 100, 101, 4_500_000, 3_913_043, 123_456_789]) {
      expect(sar(formatAmount(h))).toBe(h);
      expect(sar(formatSAR(h))).toBe(h);
      expect(sar(formatSAR(h, "ar"))).toBe(h);
    }
  });
});

describe("VAT", () => {
  it("computes 15% VAT rounded half up", () => {
    expect(vatOn(1_000_000)).toBe(150_000);
    expect(vatOn(700_000)).toBe(105_000);
    expect(vatOn(10)).toBe(2); // 1.5 → 2
    expect(vatOn(-10)).toBe(-2);
    expect(vatOn(1_000_000, 0)).toBe(0);
  });

  it("splits VAT-inclusive totals like the seed invoices", () => {
    expect(splitVatInclusive(4_500_000)).toEqual({ subtotal: 3_913_043, vat: 586_957 });
    expect(splitVatInclusive(1_250_000)).toEqual({ subtotal: 1_086_957, vat: 163_043 });
    expect(splitVatInclusive(805_000)).toEqual({ subtotal: 700_000, vat: 105_000 });
    expect(splitVatInclusive(690_000)).toEqual({ subtotal: 600_000, vat: 90_000 });
  });

  it("checks totals within one halala", () => {
    expect(totalsAgree(3_913_043, 586_957, 4_500_000)).toBe(true);
    expect(totalsAgree(3_913_043, 586_956, 4_500_000)).toBe(true);
    expect(totalsAgree(3_913_043, 586_955, 4_500_000)).toBe(false);
    expect(totalsAgree(3_913_043, 586_955, 4_500_000, 2)).toBe(true);
  });

  it("sums", () => {
    expect(sumHalalas([])).toBe(0);
    expect(sumHalalas([4_500_000, 805_000, 1_250_000])).toBe(6_555_000);
  });
});
