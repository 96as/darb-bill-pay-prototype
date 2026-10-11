import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createFixtureOcr, mapOcrJson, NO_FIXED_RESPONSE, REQUIRED_FIELDS } from "./ocr";
import { createFixedNameCheck, nearName } from "./name-check";
import { createMockRail, RETURNED_IBAN, RailRejectedError } from "./rail";
import { createMockAccounting } from "./accounting";
import { createClearingScreening } from "./screening";
import { createSeed } from "@/lib/server/seed";
import { fixture, riyadh } from "@/lib/server/test-helpers";

const NOW = new Date("2026-10-15T13:10:00.000Z"); // Thu 16:10 Riyadh

describe("mock OCR", () => {
  it("answers for the fixture photo by its SHA-256, flagging low-confidence fields", async () => {
    const bytes = await fixture("fixtures/invoices/GOL-2026-1003-photo.jpg");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const inv = await createFixtureOcr().read(bytes, { name: "GOL-2026-1003-photo.jpg", sha256 });
    expect(inv).toMatchObject({
      supplierName: "Green Oasis Landscaping Est.",
      supplierNameAr: "مؤسسة الواحة الخضراء لتنسيق الحدائق",
      supplierVat: "311902476500003",
      invoiceNumber: "GOL-2026-1003",
      issueDate: "2026-10-10",
      dueDate: "2026-10-25",
      subtotal: 700_000,
      vat: 105_000,
      total: 805_000,
      language: "ar",
      needsReview: ["invoiceNumber", "dueDate", "vat"],
    });
    expect(Object.values(inv.sources).every((s) => s === "ocr")).toBe(true);
    expect(inv.sources.total).toBe("ocr");
  });

  it("returns an empty extraction with every required field flagged for an unknown image", async () => {
    const inv = await createFixtureOcr().read(new Uint8Array([1, 2, 3]), { name: "x.jpg", sha256: "0".repeat(64) });
    expect(inv.needsReview).toEqual(REQUIRED_FIELDS);
    expect(inv.warnings).toEqual([NO_FIXED_RESPONSE]);
    expect(inv.total).toBeUndefined();
  });

  it("flags invalid values and inconsistent totals", () => {
    const inv = mapOcrJson({
      fields: {
        supplierName: { value: "X", confidence: 0.99 },
        supplierVat: { value: "123", confidence: 0.99 },
        invoiceNumber: { value: "1", confidence: 0.99 },
        issueDate: { value: "10/10/2026", confidence: 0.99 },
        dueDate: { value: "2026-10-25", confidence: 0.99 },
        subtotal: { value: "100.00", confidence: 0.99 },
        vat: { value: "15.00", confidence: 0.99 },
        total: { value: "120.00", confidence: 0.99 },
      },
    });
    expect(inv.needsReview).toEqual(["supplierVat", "issueDate", "subtotal", "vat", "total"]);
  });
});

describe("seed", () => {
  it("attaches the saved bill's invoice PDF, hashed from the fixture", async () => {
    const store = createSeed();
    const bill = store.bills.find((b) => b.id === "b_gol_0917")!;
    const bytes = await fixture("fixtures/invoices/GOL-2026-0917-green-oasis.pdf");
    expect(bill.file).toEqual({
      id: "f_seed_gol_0917",
      name: "GOL-2026-0917-green-oasis.pdf",
      mime: "application/pdf",
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      path: "fixtures/invoices/GOL-2026-0917-green-oasis.pdf",
    });
    expect(store.files).toEqual([bill.file]);
    expect(bill).toMatchObject({ source: "upload", extraction: "manual" });
  });
});

describe("mock name check", () => {
  const check = createFixedNameCheck();
  it("follows the BUILD-NOTES table", () => {
    expect(check.check("SA5880000000318204466710", "Green Oasis Landscaping Est.", NOW).result).toBe("match");
    expect(check.check("SA67 1000 0000 0203 1555 0044", "Cool Breeze", NOW).result).toBe("match");
    expect(check.check("SA2045000000001234567001", "Cool Breeze", NOW).result).toBe("match");
    expect(check.check("SA0405000000008800112233", "Cool Breeze HVAC Contracting Co.", NOW)).toMatchObject({
      result: "close_match",
      returnedName: "COOL BREEZE HVAC CONTRACTING",
    });
    expect(check.check("SA5215000000004400998877", "Cool Breeze", NOW).result).toBe("no_match");
    expect(check.check(RETURNED_IBAN, "Desert Lifts Co.", NOW)).toMatchObject({ result: "match", returnedName: "DESERT LIFTS CO" });
  });

  it("returns a close match with a near name for unknown IBANs", () => {
    const r = check.check("SA0380000000608010167519", "Desert Lifts Co.", NOW);
    expect(r).toEqual({ result: "close_match", returnedName: "DESERT LIFTS", checkedAt: NOW.toISOString() });
    expect(nearName("Acme Co")).toBe("ACME CO TRADING");
  });
});

describe("mock screening", () => {
  it("clears", () => {
    expect(createClearingScreening().screen({ nameEn: "x", vatNumber: "y", iban: "z" }, NOW)).toEqual({ status: "cleared", checkedAt: NOW.toISOString() });
  });
});

describe("mock rail", () => {
  it("is idempotent by request key: one ledger row, same answer", () => {
    const store = createSeed();
    const rail = createMockRail();
    const rows = store.railLedger.length;
    const first = rail.send({ requestKey: "pay_x", amount: 805_000, rail: "instant", iban: "SA5880000000318204466710" }, store, NOW);
    const again = rail.send({ requestKey: "pay_x", amount: 805_000, rail: "instant", iban: "SA5880000000318204466710" }, store, new Date(NOW.getTime() + 60_000));
    expect(first).toMatchObject({ status: "settled", duplicate: false, transferRef: "DRB-20261015-000102" });
    expect(again).toEqual({ ...first, duplicate: true });
    expect(store.railLedger.length).toBe(rows + 1);
  });

  it("returns payments to the failure-demo IBAN and remembers that outcome", () => {
    const store = createSeed();
    const rail = createMockRail();
    expect(rail.send({ requestKey: "k", amount: 100, rail: "instant", iban: RETURNED_IBAN }, store, NOW).status).toBe("returned");
    expect(rail.send({ requestKey: "k", amount: 100, rail: "instant", iban: RETURNED_IBAN }, store, NOW)).toMatchObject({ status: "returned", duplicate: true });
  });

  it("refuses SARIE outside its window and bad requests", () => {
    const store = createSeed();
    const rail = createMockRail();
    expect(() => rail.send({ requestKey: "a", amount: 4_500_000, rail: "sarie", iban: "SA6710000000020315550044" }, store, NOW)).toThrow(RailRejectedError);
    expect(rail.send({ requestKey: "b", amount: 4_500_000, rail: "sarie", iban: "SA6710000000020315550044" }, store, new Date(riyadh("2026-10-18", "09:00"))).status).toBe("settled");
    expect(() => rail.send({ requestKey: "c", amount: 0, rail: "instant", iban: "x" }, store, NOW)).toThrow(RailRejectedError);
    expect(() => rail.send({ requestKey: "d", amount: 100, rail: "instant" }, store, NOW)).toThrow(RailRejectedError);
  });
});

describe("mock accounting", () => {
  it("books a payable and a payment with the invoice file, number, supplier and VAT", () => {
    const store = createSeed();
    const acc = createMockAccounting();
    const bill = store.bills.find((b) => b.id === "b_gol_0917")!;
    const payable = acc.syncPayable(store, { ...bill, file: { id: "f_1", name: "GOL.pdf", mime: "application/pdf", size: 1, sha256: "x", path: "p" } }, NOW);
    expect(payable).toMatchObject({ kind: "payable", invoiceNumber: "GOL-2026-0917", vat: 163_043, total: 1_250_000, attachmentName: "GOL.pdf", status: "synced", system: "Accounting system (mock)" });
    expect(payable.lines.reduce((s, l) => s + l.debit - l.credit, 0)).toBe(0);
    expect(acc.syncPayable(store, bill, NOW).id).toBe(payable.id); // once per bill
    const payment = acc.syncPayment(store, bill, { ...store.payments[0], id: "pay_9", amount: 1_250_000, fundingAccountId: "w_maintenance" }, NOW);
    expect(payment.lines).toEqual([
      { account: "Accounts payable", debit: 1_250_000, credit: 0 },
      { account: "Darb subwallet: Maintenance projects", debit: 0, credit: 1_250_000 },
    ]);
    expect(acc.markPayablePaid(store, bill.id)?.status).toBe("paid");
  });
});
