import { describe, expect, it } from "vitest";
import {
  INSTANT_MAX,
  plannedSendAt,
  quotePayment,
  quoteSadadPayment,
  railAndArrival,
  railFor,
  sadadQuote,
  sarieSendTime,
} from "./rails";
import { atRiyadh } from "./time";
import { sar } from "./money";

// All instants are built from Riyadh wall-clock time, so these pass under any process TZ.
const at = atRiyadh;

describe("railAndArrival", () => {
  it("SAR 45,000 on Thu 15 Oct 2026 16:10 arrives Sun 18 Oct (after the cut-off)", () => {
    const q = railAndArrival(sar("45,000.00"), at("2026-10-15", "16:10"));
    expect(q).toEqual({
      rail: "sarie",
      sendAt: "2026-10-18T06:00:00.000Z", // Sun 09:00 Riyadh
      arrivalDate: "2026-10-18",
      sameDay: false,
      reason: "sarie_after_cutoff",
    });
  });

  it("SAR 45,000 on Thu 14:00 arrives Thu", () => {
    const sendAt = at("2026-10-15", "14:00");
    const q = railAndArrival(sar(45000), sendAt);
    expect(q.rail).toBe("sarie");
    expect(q.sendAt).toBe(sendAt.toISOString());
    expect(q.arrivalDate).toBe("2026-10-15");
    expect(q.sameDay).toBe(true);
    expect(q.reason).toBe("sarie_in_window");
  });

  it("SAR 8,050 on Fri 16 Oct 23:00 goes instant and arrives Fri", () => {
    const sendAt = at("2026-10-16", "23:00");
    const q = railAndArrival(sar("8,050.00"), sendAt);
    expect(q).toEqual({
      rail: "instant",
      sendAt: sendAt.toISOString(),
      arrivalDate: "2026-10-16",
      sameDay: true,
      reason: "instant_24_7",
    });
  });

  it("SAR 20,000.00 is instant; SAR 20,000.01 is SARIE", () => {
    expect(INSTANT_MAX).toBe(sar("20,000.00"));
    expect(railFor(sar("20,000.00"))).toBe("instant");
    expect(railFor(sar("20,000.01"))).toBe("sarie");
    const friday = at("2026-10-16", "10:00");
    expect(railAndArrival(2_000_000, friday).rail).toBe("instant");
    expect(railAndArrival(2_000_000, friday).arrivalDate).toBe("2026-10-16");
    expect(railAndArrival(2_000_001, friday).rail).toBe("sarie");
    expect(railAndArrival(2_000_001, friday).arrivalDate).toBe("2026-10-18");
  });

  it("15:58 is inside the window, 15:59 is not", () => {
    expect(railAndArrival(sar(45000), at("2026-10-15", "15:58")).arrivalDate).toBe("2026-10-15");
    expect(railAndArrival(sar(45000), at("2026-10-15", "15:58:59")).arrivalDate).toBe("2026-10-15");
    const q = railAndArrival(sar(45000), at("2026-10-15", "15:59"));
    expect(q.arrivalDate).toBe("2026-10-18");
    expect(q.reason).toBe("sarie_after_cutoff");
    // A Sunday at 15:59 moves to Monday.
    expect(railAndArrival(sar(45000), at("2026-10-18", "15:59")).arrivalDate).toBe("2026-10-19");
  });

  it("09:00 sharp is open", () => {
    const q = railAndArrival(sar(45000), at("2026-10-18", "09:00"));
    expect(q.reason).toBe("sarie_in_window");
    expect(q.sendAt).toBe("2026-10-18T06:00:00.000Z");
  });

  it("Saturday moves to Sunday 09:00", () => {
    const q = railAndArrival(sar(45000), at("2026-10-17", "11:00"));
    expect(q.sendAt).toBe(at("2026-10-18", "09:00").toISOString());
    expect(q.arrivalDate).toBe("2026-10-18");
    expect(q.sameDay).toBe(false);
    expect(q.reason).toBe("sarie_weekend");
  });

  it("Friday morning also moves to Sunday", () => {
    expect(railAndArrival(sar(45000), at("2026-10-16", "08:00")).arrivalDate).toBe("2026-10-18");
  });

  it("before 09:00 on Sunday moves to Sunday 09:00", () => {
    const q = railAndArrival(sar(45000), at("2026-10-18", "07:30"));
    expect(q.sendAt).toBe(at("2026-10-18", "09:00").toISOString());
    expect(q.arrivalDate).toBe("2026-10-18");
    expect(q.sameDay).toBe(true);
    expect(q.reason).toBe("sarie_before_open");
  });

  it("just after Riyadh midnight Thursday→Friday is the weekend", () => {
    // Thu 21:30 UTC = Fri 00:30 Riyadh
    expect(sarieSendTime(new Date("2026-10-15T21:30:00.000Z")).reason).toBe("sarie_weekend");
  });

  it("does not mutate the input date", () => {
    const sendAt = at("2026-10-15", "16:10");
    const before = sendAt.getTime();
    railAndArrival(sar(45000), sendAt);
    expect(sendAt.getTime()).toBe(before);
  });

  it("refuses zero, negative and fractional amounts", () => {
    const now = at("2026-10-15", "10:00");
    expect(() => railAndArrival(0, now)).toThrow(RangeError);
    expect(() => railAndArrival(-100, now)).toThrow(RangeError);
    expect(() => railAndArrival(10.5, now)).toThrow(TypeError);
  });
});

describe("plannedSendAt / quotePayment", () => {
  const now = at("2026-10-15", "16:10"); // demo clock

  it("sends at approval when the pay date is today or past", () => {
    expect(plannedSendAt("2026-10-15", now).toISOString()).toBe(now.toISOString());
    expect(plannedSendAt("2026-10-01", now).toISOString()).toBe(now.toISOString());
  });

  it("sends at 09:00 Riyadh on a future pay date", () => {
    expect(plannedSendAt("2026-10-20", now).toISOString()).toBe("2026-10-20T06:00:00.000Z");
    expect(plannedSendAt("2026-10-16", now).toISOString()).toBe("2026-10-16T06:00:00.000Z");
  });

  it("refuses a malformed pay date", () => {
    expect(() => plannedSendAt("2026-1-5", now)).toThrow(RangeError);
  });

  it("quotes the demo payments", () => {
    expect(quotePayment(sar(45000), "2026-10-15", now).arrivalDate).toBe("2026-10-18");
    expect(quotePayment(sar(8050), "2026-10-15", now)).toMatchObject({ rail: "instant", arrivalDate: "2026-10-15" });
    expect(quotePayment(sar(12500), "2026-10-15", now)).toMatchObject({ rail: "instant", arrivalDate: "2026-10-15" });
  });

  it("a future pay date on a Friday goes SARIE on Sunday, instant on Friday", () => {
    expect(quotePayment(sar(45000), "2026-10-23", now)).toMatchObject({ arrivalDate: "2026-10-25", reason: "sarie_weekend" });
    expect(quotePayment(sar(8050), "2026-10-23", now)).toMatchObject({
      rail: "instant",
      arrivalDate: "2026-10-23",
      sendAt: "2026-10-23T06:00:00.000Z",
    });
  });

  it("a future banking-day pay date goes SARIE at 09:00 the same day", () => {
    expect(quotePayment(sar(45000), "2026-10-20", now)).toMatchObject({
      rail: "sarie",
      sendAt: "2026-10-20T06:00:00.000Z",
      arrivalDate: "2026-10-20",
      sameDay: true,
      reason: "sarie_in_window",
    });
  });
});

describe("SADAD", () => {
  it("is 24/7 and same day", () => {
    const fridayNight = at("2026-10-16", "23:00");
    expect(sadadQuote(fridayNight)).toEqual({
      rail: "sadad",
      sendAt: fridayNight.toISOString(),
      arrivalDate: "2026-10-16",
      sameDay: true,
      reason: "sadad_24_7",
    });
    expect(quoteSadadPayment("2026-10-15", at("2026-10-15", "16:10")).arrivalDate).toBe("2026-10-15");
  });
});
