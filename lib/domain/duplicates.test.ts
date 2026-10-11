import { describe, expect, it } from "vitest";
import { findDuplicate, normalizeInvoiceNumber, normalizeName, sameSupplier } from "./duplicates";
import { makeBill } from "./__fixtures__/builders";

const existing = makeBill({ id: "b_existing" });

describe("findDuplicate", () => {
  it("matches the same invoice UUID (case-insensitive) first", () => {
    const candidate = { id: "b_new", invoiceUuid: "6F1C9A52-3B7E-4D21-9C88-0A4E5B2D7F13", invoiceNumber: "something else" };
    expect(findDuplicate(candidate, [existing])).toEqual({ billId: "b_existing", reason: "invoice_uuid" });
  });

  it("matches the same supplier id and invoice number, ignoring case, spaces and dashes", () => {
    const candidate = { id: "b_new", supplierId: "s_b", invoiceNumber: "inv 2026–0451" };
    expect(findDuplicate(candidate, [existing])).toEqual({ billId: "b_existing", reason: "supplier_invoice_number" });
  });

  it("falls back to the VAT number when a bill has no supplier id yet", () => {
    const candidate = { supplierVat: "310 387 452 600 003", invoiceNumber: "INV-2026-0451" };
    const unlinked = makeBill({ id: "b_unlinked", supplierId: undefined, invoiceUuid: undefined });
    expect(findDuplicate(candidate, [unlinked])).toEqual({ billId: "b_unlinked", reason: "supplier_invoice_number" });
  });

  it("falls back to the normalized name when there is no id or VAT", () => {
    const bill = makeBill({ id: "b_x", supplierId: undefined, supplierVat: undefined, invoiceUuid: undefined, supplierName: "Green Oasis Landscaping Est." });
    expect(findDuplicate({ supplierName: "GREEN OASIS  landscaping est", invoiceNumber: "INV-2026-0451" }, [bill])).toEqual({
      billId: "b_x",
      reason: "supplier_invoice_number",
    });
  });

  it("matches Arabic names, ignoring diacritics and tatweel", () => {
    const bill = makeBill({ id: "b_ar", supplierId: undefined, supplierVat: undefined, invoiceUuid: undefined, supplierName: "x", supplierNameAr: "مؤسسة الواحة الخضراء" });
    expect(findDuplicate({ supplierNameAr: "مُؤسسة الواحــة الخضراء", invoiceNumber: "INV-2026-0451" }, [bill])?.billId).toBe("b_ar");
  });

  it("does not match the same number from a different supplier", () => {
    expect(findDuplicate({ supplierId: "s_a", invoiceNumber: "INV-2026-0451" }, [existing])).toBeNull();
    expect(findDuplicate({ supplierVat: "311902476500003", invoiceNumber: "INV-2026-0451" }, [makeBill({ supplierId: undefined })])).toBeNull();
  });

  it("ignores cancelled bills and the candidate itself", () => {
    expect(findDuplicate({ invoiceUuid: existing.invoiceUuid }, [makeBill({ id: "b_c", status: "cancelled" })])).toBeNull();
    expect(findDuplicate({ id: "b_existing", invoiceUuid: existing.invoiceUuid, supplierId: "s_b", invoiceNumber: "INV-2026-0451" }, [existing])).toBeNull();
  });

  it("does not match on empty invoice numbers or missing identity", () => {
    expect(findDuplicate({ supplierId: "s_b", invoiceNumber: " - " }, [makeBill({ invoiceNumber: "--" })])).toBeNull();
    expect(findDuplicate({}, [existing])).toBeNull();
  });
});

describe("normalizers", () => {
  it("normalizes invoice numbers", () => {
    expect(normalizeInvoiceNumber(" INV-2026 0451 ")).toBe("inv20260451");
    expect(normalizeInvoiceNumber("GOL_2026_1003")).toBe("gol20261003");
    expect(normalizeInvoiceNumber("فاتورة ١٠٠٣")).toBe("فاتورة1003");
  });

  it("normalizes names", () => {
    expect(normalizeName("Green Oasis Landscaping Est.")).toBe("green oasis landscaping est");
    expect(normalizeName("  Co., Ltd. ")).toBe("co ltd");
  });

  it("sameSupplier prefers ids over VAT", () => {
    expect(sameSupplier({ supplierId: "a", supplierVat: "310387452600003" }, { supplierId: "b", supplierVat: "310387452600003" })).toBe(false);
  });
});
