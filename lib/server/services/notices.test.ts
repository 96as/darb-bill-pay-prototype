// BP-13: what the supplier receives — bilingual, after sending, never bank details.
import { describe, expect, it } from "vitest";
import { approveRun } from "./runs";
import { FAISAL, advance, demoRun, paymentOf, setup } from "../test-helpers";
import { longDate } from "./notices";

const BANK_WORDS = /Al Rajhi|Saudi National Bank|\bSAB\b|Alinma|AlBilad|Riyad Bank|Fransi|Arab National|AlJazira|Investment Bank|الراجحي|الأهلي|السعودي الأول|الإنماء|IBAN|آيبان|ايبان/i;

describe("supplier payment notice", () => {
  it("is sent after the payment leaves, in English and Arabic, with no IBAN or bank name", async () => {
    const ctx = setup();
    const { run, einvoice, photo } = await demoRun(ctx);
    approveRun(ctx, run.id, FAISAL);
    // The photo bill (instant) left now; the SARIE bill has not left, so it has no notice yet.
    expect(ctx.store.notices.map((n) => n.billId)).toEqual(expect.arrayContaining([photo.id]));
    expect(ctx.store.notices.some((n) => n.billId === einvoice.id)).toBe(false);

    advance(ctx, "2026-10-18", "09:00");
    const payment = paymentOf(ctx, einvoice.id)!;
    const notice = ctx.store.notices.find((n) => n.billId === einvoice.id)!;
    expect(notice).toMatchObject({ channel: "email", to: "finance@coolbreeze-hvac.example", paymentId: payment.id, sentAt: payment.sentAt });
    for (const text of [notice.subjectEn, notice.bodyEn]) expect(text).toContain("INV-2026-0451");
    expect(notice.bodyEn).toContain("Sahab Facility Services Co.");
    expect(notice.bodyEn).toContain("45,000.00 SAR");
    expect(notice.bodyEn).toContain(`Transfer reference: ${payment.transferRef}`);
    expect(notice.bodyAr).toContain("شركة سحاب للخدمات المرفقية");
    expect(notice.bodyAr).toContain("45,000.00 ر.س");
    expect(notice.bodyAr).toContain(payment.transferRef!);
    expect(notice.subjectAr).toContain("INV-2026-0451");

    for (const n of ctx.store.notices) {
      const all = [n.subjectEn, n.bodyEn, n.subjectAr, n.bodyAr].join("\n");
      expect(all).not.toMatch(/SA\d{2}\s?\d{4}/); // no IBAN, spaced or not
      expect(all).not.toMatch(/\d{4}\s?\d{4}\s?\d{4}/); // no account-number-like digit runs
      expect(all).not.toMatch(BANK_WORDS);
      expect(all).not.toMatch(/ZATCA|زاتكا|هيئة الزكاة/i); // never claims ZATCA verification
    }
  });

  it("formats dates in both languages", () => {
    expect(longDate("2026-10-18", "en")).toBe("Sunday 18 October 2026");
    expect(longDate("2026-10-18", "ar")).toBe("الأحد 18 أكتوبر 2026");
  });
});
