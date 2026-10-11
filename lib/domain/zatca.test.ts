import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { InvoiceXmlError, parseZatcaInvoice, primarySupplierName } from "./zatca";
import { UnsafeXmlError, MAX_XML_BYTES } from "./xml-safety";
import { BILLION_LAUGHS_XML, PARAMETER_ENTITY_XML, XXE_XML } from "./__fixtures__/hostile-xml";

const fixture = (name: string) => readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");
const BILINGUAL = fixture("zatca-bilingual.xml");
const ENGLISH = fixture("zatca-english.xml");
const ARABIC = fixture("zatca-arabic.xml");

describe("parseZatcaInvoice: bilingual ZATCA invoice (Supplier B, INV-2026-0451)", () => {
  const inv = parseZatcaInvoice(BILINGUAL);

  it("reads every field from the XML", () => {
    expect(inv).toEqual({
      supplierName: "Cool Breeze HVAC Contracting Co.",
      supplierNameAr: "شركة النسيم البارد للمقاولات والتكييف",
      supplierVat: "310387452600003",
      supplierCr: "1010932185",
      supplierIban: "SA6710000000020315550044",
      supplierEmail: "finance@coolbreeze-hvac.example",
      supplierAddress: "7421 King Fahd Road, Al Olaya, Riyadh 12214, SA",
      buyerName: "Sahab Facility Services Co.",
      buyerVat: "310458812300003",
      invoiceNumber: "INV-2026-0451",
      invoiceUuid: "6f1c9a52-3b7e-4d21-9c88-0a4e5b2d7f13",
      issueDate: "2026-10-13",
      dueDate: "2026-11-12",
      subtotal: 3_913_043,
      vat: 586_957,
      total: 4_500_000,
      currency: "SAR",
      language: "bilingual",
      sources: {
        supplierName: "xml",
        supplierNameAr: "xml",
        supplierVat: "xml",
        supplierCr: "xml",
        invoiceNumber: "xml",
        invoiceUuid: "xml",
        issueDate: "xml",
        dueDate: "xml",
        subtotal: "xml",
        vat: "xml",
        total: "xml",
      },
      needsReview: [],
      warnings: [],
    });
  });

  it("ignores the ICV counter UUID and the signature block", () => {
    expect(inv.invoiceUuid).not.toBe("451");
    expect(inv.invoiceNumber).toBe("INV-2026-0451");
  });
});

describe("parseZatcaInvoice: English invoice", () => {
  const inv = parseZatcaInvoice(ENGLISH);

  it("reads PartyName, cbc:DueDate and a spaced IBAN", () => {
    expect(inv).toMatchObject({
      supplierName: "Green Oasis Landscaping Est.",
      supplierVat: "311902476500003",
      supplierCr: "1010847261",
      supplierIban: "SA5880000000318204466710",
      buyerName: "Sahab Facility Services Co.",
      invoiceNumber: "GOL-2026-0917",
      issueDate: "2026-09-20",
      dueDate: "2026-10-14",
      subtotal: 1_086_957,
      vat: 163_043,
      total: 1_250_000,
      language: "en",
      needsReview: [],
      warnings: [],
    });
    expect(inv.supplierNameAr).toBeUndefined();
    expect(inv.sources.supplierNameAr).toBeUndefined();
  });
});

describe("parseZatcaInvoice: Arabic invoice with other namespace prefixes", () => {
  const inv = parseZatcaInvoice(ARABIC);

  it("reads an Arabic-only supplier without flagging the missing English name", () => {
    expect(inv).toMatchObject({
      supplierNameAr: "مؤسسة الواحة الخضراء لتنسيق الحدائق",
      supplierVat: "311902476500003",
      buyerName: "شركة سحاب للخدمات المرفقية",
      invoiceNumber: "GOL-2026-1003",
      invoiceUuid: "a3c1f0e2-7b44-4c9d-9e1a-5f6b7c8d9e01",
      issueDate: "2026-10-10",
      dueDate: "2026-10-25",
      subtotal: 700_000,
      vat: 105_000,
      total: 805_000,
      language: "ar",
      needsReview: [],
    });
    expect(inv.supplierName).toBeUndefined();
    expect(inv.supplierAddress).toBe("3120 شارع العليا, الورود, الرياض 12251, SA");
    expect(primarySupplierName(inv)).toBe("مؤسسة الواحة الخضراء لتنسيق الحدائق");
  });
});

describe("parseZatcaInvoice: review flags", () => {
  it("flags totals that do not add up", () => {
    const xml = BILINGUAL.replace(
      '<cbc:TaxInclusiveAmount currencyID="SAR">45000.00</cbc:TaxInclusiveAmount>',
      '<cbc:TaxInclusiveAmount currencyID="SAR">45000.05</cbc:TaxInclusiveAmount>',
    ).replace(
      '<cbc:PayableAmount currencyID="SAR">45000.00</cbc:PayableAmount>',
      '<cbc:PayableAmount currencyID="SAR">45000.05</cbc:PayableAmount>',
    );
    const inv = parseZatcaInvoice(xml);
    expect(inv.total).toBe(4_500_005);
    expect(inv.needsReview).toEqual(["subtotal", "vat", "total"]);
    expect(inv.warnings.join(" ")).toMatch(/does not equal total 45,000.05/);
  });

  it("tolerates a one-halala rounding difference", () => {
    const xml = BILINGUAL.replace(
      '<cbc:TaxExclusiveAmount currencyID="SAR">39130.43</cbc:TaxExclusiveAmount>',
      '<cbc:TaxExclusiveAmount currencyID="SAR">39130.44</cbc:TaxExclusiveAmount>',
    );
    expect(parseZatcaInvoice(xml).needsReview).toEqual([]);
  });

  it("flags an invalid supplier VAT number and CR", () => {
    const xml = BILINGUAL.replace("<cbc:CompanyID>310387452600003</cbc:CompanyID>", "<cbc:CompanyID>310387452600002</cbc:CompanyID>").replace(
      '<cbc:ID schemeID="CRN">1010932185</cbc:ID>',
      '<cbc:ID schemeID="CRN">10109321</cbc:ID>',
    );
    const inv = parseZatcaInvoice(xml);
    expect(inv.supplierVat).toBe("310387452600002");
    expect(inv.needsReview).toEqual(["supplierVat", "supplierCr"]);
    expect(inv.sources.supplierVat).toBe("xml");
  });

  it("flags missing required fields", () => {
    const xml = ENGLISH.replace(/<cbc:UUID>.*<\/cbc:UUID>/, "")
      .replace(/<cbc:DueDate>.*<\/cbc:DueDate>/, "")
      .replace(/<cac:TaxTotal>[\s\S]*?<\/cac:TaxTotal>/g, "")
      .replace(/<cac:PartyTaxScheme>\s*<cbc:CompanyID>311902476500003[\s\S]*?<\/cac:PartyTaxScheme>/, "");
    const inv = parseZatcaInvoice(xml);
    expect(inv.needsReview).toEqual(["supplierVat", "invoiceUuid", "dueDate", "vat"]);
    expect(inv.invoiceUuid).toBeUndefined();
    expect(inv.sources.vat).toBeUndefined();
    expect(inv.warnings.length).toBeGreaterThanOrEqual(4);
  });

  it("flags a missing supplier name and an invalid issue date", () => {
    const xml = ENGLISH.replace(/<cac:PartyName>[\s\S]*?<\/cac:PartyName>/, "").replace("2026-09-20", "20/09/2026");
    const inv = parseZatcaInvoice(xml);
    expect(inv.needsReview).toEqual(["supplierName", "issueDate"]);
    expect(inv.issueDate).toBeUndefined();
  });

  it("does not suggest an IBAN that fails its checksum", () => {
    const xml = BILINGUAL.replace("<cbc:ID>SA6710000000020315550044</cbc:ID>", "<cbc:ID>SA6710000000020315550045</cbc:ID>");
    const inv = parseZatcaInvoice(xml);
    expect(inv.supplierIban).toBeUndefined();
    expect(inv.warnings).toContain("IBAN •••• 0045 in the e-invoice is not a valid Saudi IBAN");
  });

  it("flags a prepaid amount (payable differs from tax-inclusive)", () => {
    const xml = BILINGUAL.replace(
      '<cbc:PrepaidAmount currencyID="SAR">0.00</cbc:PrepaidAmount>',
      '<cbc:PrepaidAmount currencyID="SAR">5000.00</cbc:PrepaidAmount>',
    ).replace('<cbc:PayableAmount currencyID="SAR">45000.00</cbc:PayableAmount>', '<cbc:PayableAmount currencyID="SAR">40000.00</cbc:PayableAmount>');
    const inv = parseZatcaInvoice(xml);
    expect(inv.total).toBe(4_000_000);
    expect(inv.needsReview).toEqual(["total"]);
  });

  it("flags a non-SAR invoice and takes VAT in the document currency", () => {
    const xml = ENGLISH.replace("<cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>", "<cbc:DocumentCurrencyCode>USD</cbc:DocumentCurrencyCode>")
      .replace(/currencyID="SAR">(10869\.57|12500\.00)</g, 'currencyID="USD">$1<')
      .replace('<cbc:TaxAmount currencyID="SAR">1630.43</cbc:TaxAmount>\n    <cac:TaxSubtotal>', '<cbc:TaxAmount currencyID="USD">1630.43</cbc:TaxAmount>\n    <cac:TaxSubtotal>')
      .replace('<cbc:TaxAmount currencyID="SAR">1630.43</cbc:TaxAmount>\n  </cac:TaxTotal>', '<cbc:TaxAmount currencyID="SAR">6114.11</cbc:TaxAmount>\n  </cac:TaxTotal>');
    const inv = parseZatcaInvoice(xml);
    expect(inv.currency).toBe("USD");
    expect(inv.vat).toBe(163_043);
    expect(inv.needsReview).toEqual(["total"]);
  });

  it("decodes predefined entities in text", () => {
    const xml = ENGLISH.replace("Green Oasis Landscaping Est.", "Green Oasis &amp; Sons Est.");
    expect(parseZatcaInvoice(xml).supplierName).toBe("Green Oasis & Sons Est.");
  });

  it("splits bilingual names written Arabic first with a slash", () => {
    const xml = ENGLISH.replace(
      "<cbc:Name>Green Oasis Landscaping Est.</cbc:Name>",
      "<cbc:Name>مؤسسة الواحة الخضراء لتنسيق الحدائق / Green Oasis Landscaping Est.</cbc:Name>",
    );
    const inv = parseZatcaInvoice(xml);
    expect(inv.supplierName).toBe("Green Oasis Landscaping Est.");
    expect(inv.supplierNameAr).toBe("مؤسسة الواحة الخضراء لتنسيق الحدائق");
    expect(inv.language).toBe("bilingual");
  });

  it("reads the supplier contact email, ignoring anything not shaped like an email", () => {
    expect(parseZatcaInvoice(ENGLISH).supplierEmail).toBeUndefined(); // no Contact in that file
    for (const bad of ["finance at coolbreeze", "a@b", "&lt;script&gt;@x.example", ""]) {
      const xml = BILINGUAL.replace("finance@coolbreeze-hvac.example", bad);
      expect(parseZatcaInvoice(xml).supplierEmail, bad).toBeUndefined();
    }
  });

  it("does not split an English name that contains a slash", () => {
    const xml = ENGLISH.replace("Green Oasis Landscaping Est.", "A/C Masters Co.");
    expect(parseZatcaInvoice(xml).supplierName).toBe("A/C Masters Co.");
  });
});

describe("parseZatcaInvoice: hostile and broken input", () => {
  it("refuses XXE", () => {
    expect(() => parseZatcaInvoice(XXE_XML)).toThrow(UnsafeXmlError);
  });

  it("refuses billion laughs", () => {
    expect(() => parseZatcaInvoice(BILLION_LAUGHS_XML)).toThrow(UnsafeXmlError);
  });

  it("refuses parameter entities", () => {
    expect(() => parseZatcaInvoice(PARAMETER_ENTITY_XML)).toThrow(UnsafeXmlError);
  });

  it("refuses oversize XML", () => {
    const big = BILINGUAL.replace("</Invoice>", `<cbc:Note>${"x".repeat(MAX_XML_BYTES)}</cbc:Note></Invoice>`);
    expect(() => parseZatcaInvoice(big)).toThrow(UnsafeXmlError);
  });

  it("refuses malformed XML", () => {
    expect(() => parseZatcaInvoice("<Invoice><ID>1</Invoice>")).toThrow(InvoiceXmlError);
  });

  it("refuses XML that is not an invoice", () => {
    try {
      parseZatcaInvoice("<Order><ID>1</ID></Order>");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(InvoiceXmlError);
      expect((e as InvoiceXmlError).reason).toBe("not_invoice");
    }
  });
});
