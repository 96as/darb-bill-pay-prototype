import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AFRelationship, PDFArray, PDFDict, PDFDocument, PDFName, StandardFonts } from "pdf-lib";
import { extractEmbeddedXml } from "./pdf-xml";
import { parseZatcaInvoice } from "./zatca";
import { MAX_XML_BYTES, UnsafeXmlError } from "./xml-safety";

const BILINGUAL = readFileSync(new URL("./__fixtures__/zatca-bilingual.xml", import.meta.url), "utf8");
const enc = new TextEncoder();

async function pdfWith(attachments: { name: string; bytes: Uint8Array; mimeType: string }[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  page.drawText("INV-2026-0451", { x: 50, y: 780, size: 14, font: await doc.embedFont(StandardFonts.Helvetica) });
  for (const a of attachments) {
    await doc.attach(a.bytes, a.name, { mimeType: a.mimeType, afRelationship: AFRelationship.Data });
  }
  return doc.save();
}

const xmlAttachment = (xml = BILINGUAL, name = "INV-2026-0451.xml") => ({
  name,
  bytes: enc.encode(xml),
  mimeType: "application/xml",
});

describe("extractEmbeddedXml", () => {
  it("finds the XML that pdf-lib attached PDF/A-3 style and it parses", async () => {
    const pdf = await pdfWith([xmlAttachment()]);
    const found = await extractEmbeddedXml(pdf);
    expect(found?.filename).toBe("INV-2026-0451.xml");
    expect(found?.xml).toBe(BILINGUAL);
    expect(parseZatcaInvoice(found!.xml).total).toBe(4_500_000);
  });

  it("returns null for a PDF without attachments", async () => {
    expect(await extractEmbeddedXml(await pdfWith([]))).toBeNull();
  });

  it("returns null when the only attachment is not XML", async () => {
    const pdf = await pdfWith([{ name: "photo.png", bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]), mimeType: "image/png" }]);
    expect(await extractEmbeddedXml(pdf)).toBeNull();
  });

  it("skips non-XML attachments and returns the first *.xml", async () => {
    const pdf = await pdfWith([
      { name: "notes.txt", bytes: enc.encode("hello"), mimeType: "text/plain" },
      xmlAttachment(BILINGUAL, "invoice.XML"),
      xmlAttachment("<Invoice/>", "second.xml"),
    ]);
    const found = await extractEmbeddedXml(pdf);
    expect(found?.filename).toBe("invoice.XML");
    expect(found?.xml).toBe(BILINGUAL);
  });

  it("recognises an XML MIME subtype when the name has no .xml extension", async () => {
    const pdf = await pdfWith([{ name: "zatca-invoice", bytes: enc.encode("<Invoice/>"), mimeType: "application/xml" }]);
    expect(await extractEmbeddedXml(pdf)).toEqual({ filename: "zatca-invoice", xml: "<Invoice/>" });
  });

  it("strips a UTF-8 BOM", async () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...enc.encode("<Invoice/>")]);
    const pdf = await pdfWith([{ name: "invoice.xml", bytes, mimeType: "application/xml" }]);
    expect((await extractEmbeddedXml(pdf))?.xml).toBe("<Invoice/>");
  });

  it("finds the XML through /AF when there is no EmbeddedFiles name tree", async () => {
    const doc = await PDFDocument.load(await pdfWith([xmlAttachment()]));
    doc.catalog.delete(PDFName.of("Names"));
    expect(doc.catalog.get(PDFName.of("AF"))).toBeDefined();
    const found = await extractEmbeddedXml(await doc.save());
    expect(found?.filename).toBe("INV-2026-0451.xml");
  });

  it("walks /Kids in the name tree", async () => {
    const doc = await PDFDocument.load(await pdfWith([xmlAttachment()]));
    const ctx = doc.context;
    const names = doc.catalog.lookup(PDFName.of("Names"), PDFDict);
    const tree = names.lookup(PDFName.of("EmbeddedFiles"), PDFDict);
    const pairs = tree.lookup(PDFName.of("Names"), PDFArray);
    const leaf = ctx.register(ctx.obj({ Names: pairs }));
    const middle = ctx.register(ctx.obj({ Kids: [leaf] }));
    tree.delete(PDFName.of("Names"));
    tree.set(PDFName.of("Kids"), ctx.obj([middle]));
    doc.catalog.delete(PDFName.of("AF")); // prove the name tree path alone works
    const found = await extractEmbeddedXml(await doc.save());
    expect(found?.filename).toBe("INV-2026-0451.xml");
    expect(found?.xml).toBe(BILINGUAL);
  });

  it("keeps only the base name of a path-like attachment name", async () => {
    const pdf = await pdfWith([xmlAttachment(BILINGUAL, "../../etc/invoice.xml")]);
    expect((await extractEmbeddedXml(pdf))?.filename).toBe("invoice.xml");
  });

  it("stops a decompression bomb at the XML size limit", async () => {
    const huge = enc.encode(`<Invoice>${" ".repeat(MAX_XML_BYTES + 10)}</Invoice>`);
    const pdf = await pdfWith([{ name: "bomb.xml", bytes: huge, mimeType: "application/xml" }]);
    expect(pdf.length).toBeLessThan(100_000); // it really is a compressed bomb
    await expect(extractEmbeddedXml(pdf)).rejects.toBeInstanceOf(UnsafeXmlError);
  });

  it("rejects bytes that are not a PDF", async () => {
    await expect(extractEmbeddedXml(enc.encode("not a pdf at all"))).rejects.toThrow();
  });
});
