# Invoice fixtures

Sample invoices for the Darb Bill Pay prototype: the two attachments on the seeded email, the mock OCR answer for the photo, and XML variants for the invoice reader tests.

**All data here is fake.** Cool Breeze HVAC Contracting Co., Green Oasis Landscaping Est. and Sahab Facility Services Co. are made-up companies. Their VAT numbers, CR numbers, IBANs, addresses, e-mail addresses (`*.example`), signatures and stamps are invented, and the values come from the seed in `docs/BUILD-NOTES.md`. No real company's data is used. Each document says on its face that it is a demo with fictitious data.

## Files

| File | What it is |
|---|---|
| `INV-2026-0451-cool-breeze.xml` | ZATCA-style UBL 2.1 **standard tax invoice** (`InvoiceTypeCode` 388, `name="0100000"`) from Cool Breeze to Sahab. Bilingual names: `PartyName/Name` is Arabic, and `PartyLegalEntity/RegistrationName` is `"Cool Breeze HVAC Contracting Co. \| شركة النسيم البارد للمقاولات والتكييف"`. ID `INV-2026-0451`, UUID `6f1c9a52-3b7e-4d21-9c88-0a4e5b2d7f13`, issued 2026-10-13 10:42:17, due 2026-11-12 (`PaymentMeans/PaymentDueDate`, code 42), IBAN `SA6710000000020315550044`. Two lines; totals 39,130.43 + VAT 5,869.57 = 45,000.00 SAR. No DOCTYPE. |
| `INV-2026-0451-cool-breeze.pdf` | One-page A4 bilingual (English + Arabic) tax invoice for the same invoice. The XML above is attached as **`INV-2026-0451.xml`**, byte for byte. It is attached the way PDF/A-3 attaches files, but the PDF is **not certified PDF/A-3** (no XMP metadata, no output intent). |
| `GOL-2026-1003-photo.jpg` | 1200×1600 JPEG (quality 82, no EXIF) made to look like a phone photo of an Arabic paper tax invoice from مؤسسة الواحة الخضراء لتنسيق الحدائق (Green Oasis Landscaping Est.) on a wooden desk. Invoice GOL-2026-1003, dated 2026/10/10, due 2026/10/25, 7,000.00 + VAT 1,050.00 = 8,050.00 SAR, billed to Sahab. |
| `GOL-2026-1003-photo.ocr.json` | The fixed mock OCR response for the photo. Fields are `{ value, confidence }`. Amounts are SAR strings (`"8050.00"`) and dates are ISO. `invoiceNumber` (0.78), `dueDate` (0.71) and `vat` (0.82) are below 0.85, so they get flagged for review. `language: "ar"`. Every value is correct; only the confidence is low. |
| `ocr-index.json` | `{ "<sha256 of the JPEG>": "GOL-2026-1003-photo.ocr.json" }`. The mock OCR finds its answer by file hash. |
| `variants/bilingual.xml` | Byte-identical copy of `INV-2026-0451-cool-breeze.xml`. |
| `variants/english.xml` | Same invoice with English-only names (supplier, buyer, bank, line items, notes). |
| `variants/arabic.xml` | Same invoice with Arabic-only names, including Arabic addresses. |
| `variants/malicious-xxe.xml` | **Hostile input.** Its DOCTYPE declares `<!ENTITY xxe SYSTEM "file:///etc/passwd">`, which is used as the supplier name. The app must reject it. |
| `variants/billion-laughs.xml` | **Hostile input.** Nested-entity expansion attack (`&lol9;`, about 3 GB if expanded). The app must reject it. |

All three good variants carry the same numbers, ID and UUID as the main XML. If you import one after the main invoice, the duplicate check should flag it. The only differences are the names and the matching QR tag 1.

### Notes for whoever reads these files

- **VAT rounding (1 halala).** The seed fixes the total at 45,000.00, so VAT is 5,869.57. But 39,130.43 × 15% = 5,869.5645, which rounds to 5,869.56. To make the XML add up, I picked line amounts whose rounded line VATs sum to the seed figure: 2,527.51 + 3,342.06 = 5,869.57. Line totals (`RoundingAmount`) are 19,377.55 + 25,622.45 = 45,000.00. A check of the form "VAT = taxable × 15%" needs a ±0.01 SAR tolerance. The seeded GOL-2026-0917 bill (10,869.57 / 1,630.43) has the same 1-halala effect. GOL-2026-1003 is exact.
- **Two `TaxTotal` elements.** The first has the `TaxSubtotal` and the second has only `TaxAmount`. Real ZATCA files often put them the other way round, so a reader must not depend on the order.
- **Dummy cryptography.** The `UBLExtensions` signature block, the certificate, the digests, `PIH`, and QR tags 6–8 are placeholders. Each base64 value decodes to text such as `FAKE-ECDSA-SIGNATURE|prototype fixture|…`. None of them will validate. `ICV` is 451.
- **QR codes are real.** Both documents print a scannable QR code. It holds the base64 TLV from the XML's `AdditionalDocumentReference[ID=QR]`: tags 1–5 are seller, VAT number, time stamp, total and VAT, and tags 6–8 are dummies. The photo's QR uses tags 1–5 only. Both were decoded back (CoreImage, including from the photo) as a check.
- **Attachment details.** The PDF has `Catalog → Names → EmbeddedFiles` with one entry, `INV-2026-0451.xml`. Its file spec has `/AFRelationship /Alternative` and is listed in the catalog `/AF` array. The embedded stream has `/Subtype /application#2Fxml` (that is, `application/xml`) and is Flate-compressed.
- **Hostile files vs. the parser.** fast-xml-parser 5.11.2 with default options throws on the external entity ("External entities are not supported"). It parses `billion-laughs.xml` *without error* and returns the literal string `"&lol9;"` as the supplier name. So the reader should reject any `<!DOCTYPE` / `<!ENTITY` before parsing instead of relying on parser defaults.

## Regenerating

```bash
npm run fixtures                       # = npx tsx scripts/make-fixtures.ts
npx tsx scripts/make-fixtures.ts --preview-dir /tmp/previews   # also writes a PNG of the PDF (macOS sips)
```

The script rewrites every file in this folder from `scripts/fixture-lib/` (seed data, the XML builder, the HTML templates, the QR encoder and the photo post-processing). It writes the rendered HTML to `scripts/fixture-templates/` so you can open it in a browser. The steps are:

1. Build the three XML variants and the two hostile files, then parse the good ones back and assert the seed values: ID, UUID, VAT/CR numbers, IBAN, due date and totals.
2. Print `scripts/fixture-templates/cool-breeze-invoice.html` to PDF with headless Chrome (`--print-to-pdf --no-pdf-header-footer`), so Arabic is shaped by a real browser. Then use pdf-lib to set the metadata and attach the XML.
3. Re-open the PDF with pdf-lib, walk `Catalog/Names/EmbeddedFiles`, inflate the stream, and fail unless it is byte-identical to the XML. The script also checks the file name, MIME subtype, AFRelationship and `/AF`.
4. Screenshot `scripts/fixture-templates/green-oasis-photo.html` at 1200×1600. Then `scripts/fixture-lib/photo-postprocess.py` adds a warm tint, slight blur and fixed-seed noise, and saves a JPEG at quality 82. If python3/Pillow is missing it falls back to `sips`.
5. Write the OCR JSON, hash the new JPEG and rewrite `ocr-index.json`.

Requirements: Google Chrome (set `CHROME_PATH` to override the macOS default) and python3 with Pillow (numpy is optional). The script uses macOS fonts: Geeza Pro, Helvetica Neue and Arial. On the same machine a rerun gives the same JPEG bytes. Other machines or Chrome versions may render slightly differently, which changes the JPEG hash. That is fine because the index is rewritten in the same run. Commit the JPEG and `ocr-index.json` together.

Independent check of the attachment (poppler):

```bash
pdfdetach -list fixtures/invoices/INV-2026-0451-cool-breeze.pdf
pdfdetach -save 1 -o /tmp/INV-2026-0451.xml fixtures/invoices/INV-2026-0451-cool-breeze.pdf
cmp /tmp/INV-2026-0451.xml fixtures/invoices/INV-2026-0451-cool-breeze.xml && echo identical
```
