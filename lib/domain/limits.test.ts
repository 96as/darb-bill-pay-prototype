import { describe, expect, it } from "vitest";
import { checkDaily, checkPerPayment, dailyRemaining } from "./limits";
import { sar } from "./money";

// Seeded limits (BUILD-NOTES 12).
const LIMITS = { perPayment: sar("100,000.00"), daily: sar("150,000.00") };

describe("checkPerPayment", () => {
  it("allows up to and including the limit", () => {
    expect(checkPerPayment(sar(45000), LIMITS)).toEqual({ ok: true });
    expect(checkPerPayment(sar("100,000.00"), LIMITS).ok).toBe(true);
  });

  it("refuses above the limit", () => {
    const r = checkPerPayment(sar("100,000.01"), LIMITS);
    expect(r).toEqual({
      ok: false,
      code: "per_payment_limit",
      message: "100,000.01 SAR is above the per-payment limit of 100,000.00 SAR",
    });
  });
});

describe("checkDaily", () => {
  it("adds this payment to the day's existing total", () => {
    // Demo run: 45,000 + 8,050 + 12,500 = 65,550.
    expect(checkDaily([sar(8050), sar(12500)], sar(45000), LIMITS).ok).toBe(true);
    expect(checkDaily(sar(105000), sar(45000), LIMITS).ok).toBe(true); // exactly 150,000
  });

  it("refuses when the day would go over", () => {
    const r = checkDaily(sar(120000), sar(45000), LIMITS);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("daily_limit");
      expect(r.message).toContain("30,000.00 SAR left");
    }
    expect(checkDaily([], sar("150,000.01"), LIMITS).ok).toBe(false);
  });

  it("reports what is left", () => {
    expect(dailyRemaining([sar(100000)], LIMITS)).toBe(sar(50000));
    expect(dailyRemaining(sar(200000), LIMITS)).toBe(0);
  });
});
