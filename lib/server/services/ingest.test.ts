// Promise A: an e-invoice becomes a correct draft without typing (BP-01..05).
import { describe, expect, it } from "vitest";
import { ingestFile, submitBill, dismissDuplicate, listBills, getBillDetail, createManualBill } from "./bills";
import { processEmail, listEmails } from "./inbox";
import { SEED_IDS, FIXTURE_PDF, FIXTURE_PHOTO, FIXTURE_SAVED_PDF } from "../seed";
import { addSupplierB, expectCode, fixture, NOURA, processSeedEmail, setup, IBAN_B } from "../test-helpers";
import { BILLION_LAUGHS_XML, XXE_XML } from "@/lib/domain/__fixtures__/hostile-xml";

const enc = new TextEncoder();
const XML_FIELDS = ["supplierName", "supplierNameAr", "supplierVat", "supplierCr", "invoiceNumber", "invoiceUuid", "issueDate", "dueDate", "subtotal", "vat", "total"];

describe("ingest the fixture PDF/A-3 (promise A)", () => {
  it("creates a draft with every field from the embedded XML", async () => {
    const ctx = setup();
    const { bill, duplicate, warnings } = await ingestFile(ctx, {
      bytes: await fixture(FIXTURE_PDF),
      filename: "INV-2026-0451-cool-breeze.pdf",
      source: "upload",
      actorId: NOURA,
    });
    expect(bill).toMatchObject({
      kind: "supplier",
      source: "upload",
      extraction: "e_invoice",
      status: "draft",
      supplierName: "Cool Breeze HVAC Contracting Co.",
      supplierNameAr: "شركة النسيم البارد للمقاولات والتكييف",
      supplierVat: "310387452600003",
      supplierCr: "1010932185",
      invoiceNumber: "INV-2026-0451",
      invoiceUuid: "6f1c9a52-3b7e-4d21-9c88-0a4e5b2d7f13",
      issueDate: "2026-10-13",
      dueDate: "2026-11-12",
      subtotal: 3_913_043,
      vat: 586_957,
      total: 4_500_000,
      needsReview: [],
      createdBy: NOURA,
      suggestedSupplier: { supplierIban: IBAN_B, supplierVat: "310387452600003", supplierEmail: "finance@coolbreeze-hvac.example" },
    });
    expect(Object.keys(bill.fieldSources).sort()).toEqual([...XML_FIELDS].sort());
    expect(Object.values(bill.fieldSources).every((s) => s === "xml")).toBe(true);
    expect(bill.supplierId).toBeUndefined(); // Supplier B is not saved yet
    expect(duplicate).toBeNull();
    expect(warnings).toEqual([]);
    expect(bill.file).toMatchObject({ name: "INV-2026-0451-cool-breeze.pdf", mime: "application/pdf", path: `data/files/${bill.file!.id}.pdf` });
    expect(ctx.store.files).toContainEqual(bill.file);
    expect(ctx.store.audit.at(-1)).toMatchObject({ action: "bill.created", actorId: NOURA, entity: { type: "bill", id: bill.id } });
  });

  it("matches the supplier by VAT number once B is saved (BP-05)", async () => {
    const ctx = setup();
    const first = await ingestFile(ctx, { bytes: await fixture(FIXTURE_PDF), filename: "a.pdf", source: "upload", actorId: NOURA });
    const supplier = addSupplierB(ctx);
    expect(ctx.store.bills.find((b) => b.id === first.bill.id)?.supplierId).toBe(supplier.id); // existing draft linked
    const again = await ingestFile(ctx, { bytes: await fixture(FIXTURE_PDF), filename: "b.pdf", source: "upload", actorId: NOURA });
    expect(again.bill.supplierId).toBe(supplier.id);
    expect(again.duplicate).toEqual({ billId: first.bill.id, reason: "invoice_uuid" });
  });

  it.each([
    ["english", "en", "Cool Breeze HVAC Contracting Co.", undefined],
    ["arabic", "ar", "شركة النسيم البارد للمقاولات والتكييف", "شركة النسيم البارد للمقاولات والتكييف"],
    ["bilingual", "bilingual", "Cool Breeze HVAC Contracting Co.", "شركة النسيم البارد للمقاولات والتكييف"],
  ])("reads the %s XML variant uploaded on its own", async (variant, _lang, name, nameAr) => {
    const ctx = setup();
    const { bill } = await ingestFile(ctx, { bytes: await fixture(`fixtures/invoices/variants/${variant}.xml`), filename: `${variant}.xml`, source: "upload", actorId: NOURA });
    expect(bill.extraction).toBe("e_invoice");
    expect(bill.file?.mime).toBe("application/xml");
    expect(bill.supplierName).toBe(name);
    expect(bill.supplierNameAr).toBe(nameAr);
    expect(bill.total).toBe(4_500_000);
    expect(bill.needsReview).toEqual([]);
  });

  it.each([
    ["XXE", XXE_XML],
    ["billion laughs", BILLION_LAUGHS_XML],
  ])("refuses %s XML", async (_label, xml) => {
    const ctx = setup();
    const err = await expectCode(() => ingestFile(ctx, { bytes: enc.encode(xml), filename: "evil.xml", source: "upload", actorId: NOURA }), "unsafe_xml");
    expect(err.httpStatus).toBe(422);
    expect(ctx.store.bills.length).toBe(3);
    expect(ctx.store.files.map((f) => f.id)).toEqual([SEED_IDS.files.savedDraft]); // nothing stored
  });

  it("refuses the fixture hostile files too", async () => {
    const ctx = setup();
    for (const f of ["malicious-xxe.xml", "billion-laughs.xml"]) {
      await expectCode(async () => ingestFile(ctx, { bytes: await fixture(`fixtures/invoices/variants/${f}`), filename: f, source: "upload", actorId: NOURA }), "unsafe_xml");
    }
  });

  it("refuses anything but PDF, image or XML, empty files and files over 10 MB", async () => {
    const ctx = setup();
    const err = await expectCode(() => ingestFile(ctx, { bytes: enc.encode("MZ\x90\x00 not really"), filename: "invoice.pdf", source: "upload", actorId: NOURA }), "unsupported_file");
    expect(err.httpStatus).toBe(415);
    await expectCode(() => ingestFile(ctx, { bytes: new Uint8Array(0), filename: "x.pdf", source: "upload", actorId: NOURA }), "empty_file");
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set(enc.encode("%PDF-1.7"));
    expect((await expectCode(() => ingestFile(ctx, { bytes: big, filename: "big.pdf", source: "upload", actorId: NOURA }), "file_too_large")).httpStatus).toBe(413);
  });

  it("falls back to mock OCR for an unknown photo, flagging every required field", async () => {
    const ctx = setup();
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    const { bill, warnings } = await ingestFile(ctx, { bytes: png, filename: "scan.png", source: "upload", actorId: NOURA });
    expect(bill.extraction).toBe("ocr");
    expect(bill.total).toBe(0);
    expect(bill.needsReview).toEqual(["supplierName", "supplierVat", "invoiceNumber", "issueDate", "dueDate", "subtotal", "vat", "total"]);
    expect(warnings).toEqual(["Mock OCR has no fixed response for this file"]);
  });

  it("refuses an unknown user", async () => {
    const ctx = setup();
    await expectCode(async () => ingestFile(ctx, { bytes: await fixture(FIXTURE_PDF), filename: "a.pdf", source: "upload", actorId: "u_nobody" }), "unknown_user");
  });
});

describe("bills inbox (BP-02)", () => {
  it("turns each attachment into its own draft, saving the sender", async () => {
    const ctx = setup();
    const { einvoice, photo } = await processSeedEmail(ctx);
    for (const bill of [einvoice, photo]) {
      expect(bill).toMatchObject({ source: "email", emailId: SEED_IDS.email, senderEmail: "ops@sahab-fm.example", status: "draft", createdBy: "system" });
    }
    expect(einvoice.extraction).toBe("e_invoice");
    expect(einvoice.file?.path).toBe(FIXTURE_PDF); // fixtures are referenced, not copied
    // The photo: OCR, flagged fields, matched to Supplier A by VAT.
    expect(photo).toMatchObject({
      extraction: "ocr",
      supplierId: SEED_IDS.supplierA,
      invoiceNumber: "GOL-2026-1003",
      total: 805_000,
      needsReview: ["invoiceNumber", "dueDate", "vat"],
    });
    expect(photo.file?.path).toBe(FIXTURE_PHOTO);
    expect(Object.values(photo.fieldSources).every((s) => s === "ocr")).toBe(true);
    const email = ctx.store.emails[0];
    expect(email.processedAt).toBe(ctx.now.toISOString());
    expect(email.billIds).toEqual([einvoice.id, photo.id]);
    expect(listEmails(ctx).emails[0].bills.map((b) => b.id)).toEqual([einvoice.id, photo.id]);
  });

  it("reports an unreadable attachment without failing the others", async () => {
    const ctx = setup();
    ctx.store.emails[0].attachments.push({ filename: "missing.pdf", mime: "application/pdf", path: "fixtures/invoices/does-not-exist.pdf" });
    const result = await processEmail(ctx, SEED_IDS.email, NOURA);
    expect(result.bills).toHaveLength(2);
    expect(result.errors).toEqual([{ filename: "missing.pdf", code: "attachment_unreadable", message: "The attachment could not be read" }]);
  });

  it("refuses attachment paths outside fixtures/ and data/files/", async () => {
    const ctx = setup();
    ctx.store.emails[0].attachments = [{ filename: "pkg.xml", mime: "application/xml", path: "../package.json" }];
    const result = await processEmail(ctx, SEED_IDS.email, NOURA);
    expect(result.bills).toHaveLength(0);
    expect(result.errors[0].code).toBe("attachment_unreadable");
  });

  it("is idempotent", async () => {
    const ctx = setup();
    const first = await processEmail(ctx, SEED_IDS.email, NOURA);
    const second = await processEmail(ctx, SEED_IDS.email, NOURA);
    expect(second.alreadyProcessed).toBe(true);
    expect(second.bills.map((b) => b.id)).toEqual(first.bills.map((b) => b.id));
    expect(ctx.store.bills.length).toBe(5);
  });
});

describe("duplicates (BP-04)", () => {
  it("flags the same PDF uploaded after the email, and blocks submit until resolved", async () => {
    const ctx = setup();
    const { einvoice } = await processSeedEmail(ctx);
    const { bill, duplicate } = await ingestFile(ctx, { bytes: await fixture(FIXTURE_PDF), filename: "again.pdf", source: "upload", actorId: NOURA });
    expect(duplicate).toEqual({ billId: einvoice.id, reason: "invoice_uuid" });
    expect(bill).toMatchObject({ status: "draft", duplicateOf: einvoice.id, duplicateReason: "invoice_uuid" });
    expect(getBillDetail(ctx, bill.id).duplicateOfBill).toMatchObject({ id: einvoice.id, invoiceNumber: "INV-2026-0451" });

    addSupplierB(ctx);
    await expectCode(() => submitBill(ctx, bill.id, NOURA, { payDate: "2026-10-15" }), "duplicate_unresolved");
    dismissDuplicate(ctx, bill.id, NOURA);
    expect(ctx.store.audit.at(-1)).toMatchObject({ action: "bill.duplicate_dismissed", before: { duplicateOf: einvoice.id } });
    expect(submitBill(ctx, bill.id, NOURA, { payDate: "2026-10-15" }).bill.status).toBe("awaiting_approval");
  });

  it("flags the saved bill's PDF uploaded again by supplier + invoice number (no UUID in a plain PDF)", async () => {
    const ctx = setup();
    const { bill, duplicate } = await ingestFile(ctx, { bytes: await fixture(FIXTURE_SAVED_PDF), filename: "GOL-2026-0917-green-oasis.pdf", source: "upload", actorId: NOURA });
    expect(bill).toMatchObject({ extraction: "ocr", supplierId: SEED_IDS.supplierA, invoiceNumber: "GOL-2026-0917", total: 1_250_000, needsReview: [] });
    expect(bill.invoiceUuid).toBeUndefined();
    expect(duplicate).toEqual({ billId: SEED_IDS.bills.savedDraft, reason: "supplier_invoice_number" });
    expect(bill).toMatchObject({ duplicateOf: SEED_IDS.bills.savedDraft, duplicateReason: "supplier_invoice_number" });
  });

  it("flags a manual bill with the same supplier and invoice number", () => {
    const ctx = setup();
    const { bill } = createManualBill(ctx, { supplierId: SEED_IDS.supplierA, invoiceNumber: "gol 2026 0917", total: 1_250_000 }, NOURA);
    expect(bill).toMatchObject({ duplicateOf: SEED_IDS.bills.savedDraft, duplicateReason: "supplier_invoice_number" });
  });
});

describe("listBills", () => {
  it("shows the saved draft as Overdue and filters by status and due date", async () => {
    const ctx = setup();
    const rows = listBills(ctx);
    expect(rows.find((r) => r.bill.id === SEED_IDS.bills.savedDraft)?.displayStatus).toBe("overdue");
    expect(listBills(ctx, { status: "overdue" }).map((r) => r.bill.id)).toEqual([SEED_IDS.bills.savedDraft]);
    expect(listBills(ctx, { dueBefore: "2026-10-20" }).map((r) => r.bill.id).sort()).toEqual([SEED_IDS.bills.paidHistory, SEED_IDS.bills.savedDraft].sort());
    // The SADAD bill is in the same list with a live quote for its pay date (BP-12).
    expect(rows.find((r) => r.bill.id === SEED_IDS.bills.sadad)?.quote).toMatchObject({ rail: "sadad", arrivalDate: "2026-10-25" });
  });
});
