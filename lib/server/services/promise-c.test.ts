// Promise C: the arrival date shown is the real one — run screen, approval screen and supplier notice agree,
// and all come from railAndArrival (BP-09, BP-13).
import { describe, expect, it } from "vitest";
import { railAndArrival } from "@/lib/domain/rails";
import { quoteBills, getRun, approveRun } from "./runs";
import { noticeArrival } from "./notices";
import { FAISAL, advance, demoRun, paymentOf, riyadh, setup } from "../test-helpers";

describe("SAR 46,000 submitted Thursday 16:10 arrives Sunday 18 October", () => {
  it("quote, approval screen, payment and notice all say SARIE / 2026-10-18", async () => {
    const ctx = setup();
    const { run, einvoice, photo, saved, quotes } = await demoRun(ctx);
    const reference = railAndArrival(4_600_000, new Date(riyadh("2026-10-15", "16:10")));
    expect(reference).toMatchObject({ rail: "sarie", arrivalDate: "2026-10-18", sendAt: "2026-10-18T06:00:00.000Z", reason: "sarie_after_cutoff" });

    // 1. Run screen before submitting (POST /payment-runs/quote and the createRun response).
    const runScreen = quoteBills(ctx, [einvoice.id, photo.id, saved.id], "2026-10-15");
    const fromRunScreen = runScreen.find((q) => q.billId === einvoice.id)!;
    expect(fromRunScreen).toMatchObject({ rail: reference.rail, arrivalDate: reference.arrivalDate, sendAt: reference.sendAt, reason: reference.reason, sameDay: false });
    expect(quotes.find((q) => q.billId === einvoice.id)).toEqual(fromRunScreen);
    // The two small bills go instant and arrive today.
    expect(runScreen.filter((q) => q.billId !== einvoice.id).map((q) => [q.rail, q.arrivalDate])).toEqual([
      ["instant", "2026-10-15"],
      ["instant", "2026-10-15"],
    ]);

    // 2. Approval screen (GET /payment-runs/{id}) before approving.
    const approvalScreen = getRun(ctx, run.id).items.find((i) => i.bill.id === einvoice.id)!.quote;
    expect(approvalScreen).toEqual(fromRunScreen);

    // 3. After approval the payment carries the same quote.
    approveRun(ctx, run.id, FAISAL);
    const payment = paymentOf(ctx, einvoice.id)!;
    expect(payment).toMatchObject({ rail: "sarie", scheduledFor: reference.sendAt, expectedArrival: "2026-10-18", quote: reference });
    expect(getRun(ctx, run.id).items.find((i) => i.bill.id === einvoice.id)!.quote).toEqual(fromRunScreen);

    // 4. Sunday 09:00 it leaves; the supplier notice states the same arrival, computed by the same function.
    advance(ctx, "2026-10-18", "09:00");
    expect(payment.status).toBe("settled");
    // The approval quote is kept as shown (why it arrives after the pay date); the send-time quote sits beside it.
    expect(payment.quote).toEqual(reference);
    expect(payment.sentQuote).toEqual({ rail: "sarie", sendAt: "2026-10-18T06:00:00.000Z", arrivalDate: "2026-10-18", sameDay: true, reason: "sarie_in_window" });
    expect(payment.expectedArrival).toBe(reference.arrivalDate);
    expect(noticeArrival(payment)).toBe(payment.quote!.arrivalDate);
    expect(getRun(ctx, run.id).items.find((i) => i.bill.id === einvoice.id)!.quote).toEqual(fromRunScreen);
    const notice = ctx.store.notices.find((n) => n.billId === einvoice.id)!;
    expect(notice.bodyEn).toContain("Expected arrival: Sunday 18 October 2026");
    expect(notice.bodyAr).toContain("موعد الوصول المتوقع: الأحد 18 أكتوبر 2026");
  });

  it("the same bill approved Thursday 14:00 arrives Thursday", async () => {
    const ctx = setup();
    ctx.store.clock.now = riyadh("2026-10-15", "14:00");
    ctx.now = new Date(ctx.store.clock.now);
    const { run, einvoice } = await demoRun(ctx);
    expect(quoteBills(ctx, [einvoice.id], "2026-10-15")[0]).toMatchObject({ rail: "sarie", arrivalDate: "2026-10-15", sameDay: true });
    approveRun(ctx, run.id, FAISAL);
    expect(paymentOf(ctx, einvoice.id)).toMatchObject({ status: "settled", expectedArrival: "2026-10-15" });
    expect(ctx.store.notices.find((n) => n.billId === einvoice.id)!.bodyEn).toContain("Thursday 15 October 2026");
  });
});
