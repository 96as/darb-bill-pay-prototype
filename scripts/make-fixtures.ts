/**
 * Regenerates every invoice fixture in fixtures/invoices/ end to end.
 *
 *   npx tsx scripts/make-fixtures.ts                # or: npm run fixtures
 *   npx tsx scripts/make-fixtures.ts --preview-dir /tmp/previews   # also PNG previews of the PDFs (macOS sips)
 *
 * Outputs: the Cool Breeze e-invoice (XML + PDF with the XML attached), the Green Oasis
 * phone photo + mock OCR, the plain Green Oasis PDF for the seeded bill GOL-2026-0917,
 * and the XML test variants.
 *
 * Needs Google Chrome (headless; set CHROME_PATH to override) and, for the photo,
 * python3 with Pillow (falls back to macOS `sips` for the PNG -> JPEG step).
 * All companies, numbers and signatures are fictitious (see docs/BUILD-NOTES.md).
 * The committed outputs are what the app uses; this script is for reproducibility.
 */
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import {
  AFRelationship,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFRef,
  PDFString,
  decodePDFRawStream,
} from "pdf-lib";
import {
  BUYER,
  COOL_BREEZE,
  COOL_BREEZE_INVOICE,
  GREEN_OASIS,
  GREEN_OASIS_INVOICE,
  GREEN_OASIS_INVOICE_0917,
  SAR,
} from "./fixture-lib/data";
import {
  buildBillionLaughsXml,
  buildCoolBreezeXml,
  buildXxeXml,
  coolBreezeQrBase64,
  coolBreezeTotals,
  zatcaQrBase64,
} from "./fixture-lib/invoice-xml";
import { qrSvg } from "./fixture-lib/qr";
import {
  coolBreezeInvoiceHtml,
  greenOasis0917Totals,
  greenOasisInvoicePdfHtml,
  greenOasisPhotoHtml,
} from "./fixture-lib/templates";

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "fixtures", "invoices");
const VARIANTS = path.join(OUT, "variants");
const TEMPLATES = path.join(ROOT, "scripts", "fixture-templates");
const POSTPROCESS_PY = path.join(ROOT, "scripts", "fixture-lib", "photo-postprocess.py");

const FILES = {
  xml: path.join(OUT, "INV-2026-0451-cool-breeze.xml"),
  pdf: path.join(OUT, "INV-2026-0451-cool-breeze.pdf"),
  jpg: path.join(OUT, "GOL-2026-1003-photo.jpg"),
  ocr: path.join(OUT, "GOL-2026-1003-photo.ocr.json"),
  ocrIndex: path.join(OUT, "ocr-index.json"),
  invoiceHtml: path.join(TEMPLATES, "cool-breeze-invoice.html"),
  photoHtml: path.join(TEMPLATES, "green-oasis-photo.html"),
  gol0917Pdf: path.join(OUT, "GOL-2026-0917-green-oasis.pdf"),
  gol0917Html: path.join(TEMPLATES, "green-oasis-0917-invoice.html"),
  /** Not written by this script; indexed if present. */
  gol0917Ocr: path.join(OUT, "GOL-2026-0917-green-oasis.ocr.json"),
};

const sha256 = (buf: Buffer | Uint8Array) => createHash("sha256").update(buf).digest("hex");

function log(msg: string) {
  process.stdout.write(`${msg}\n`);
}

// ---------------------------------------------------------------------------
// Headless Chrome
// ---------------------------------------------------------------------------

function findChrome(): string {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter((p): p is string => Boolean(p));
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error("Google Chrome not found. Set CHROME_PATH.");
  return found;
}

/**
 * Runs headless Chrome once. New headless Chrome on macOS can stay alive after
 * writing its output, so we watch for "bytes written to file" and then stop it.
 */
function runChrome(workDir: string, extraArgs: string[], htmlFile: string, outFile: string): Promise<void> {
  const chrome = findChrome();
  const profile = mkdtempSync(path.join(workDir, "chrome-profile-"));
  rmSync(outFile, { force: true });
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-sync",
    "--use-mock-keychain",
    "--password-store=basic",
    "--force-color-profile=srgb",
    "--run-all-compositor-stages-before-draw",
    `--user-data-dir=${profile}`,
    ...extraArgs,
    pathToFileURL(htmlFile).href,
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(chrome, args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let stopTimer: NodeJS.Timeout | undefined;
    const stop = () => {
      if (child.exitCode === null) child.kill("SIGTERM");
      setTimeout(() => {
        if (child.exitCode === null) child.kill("SIGKILL");
      }, 3000).unref();
    };
    const onData = (chunk: Buffer) => {
      output += chunk.toString();
      if (!stopTimer && /bytes written to file/.test(output)) stopTimer = setTimeout(stop, 400);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    const timeout = setTimeout(stop, 90_000);
    child.on("exit", () => {
      clearTimeout(timeout);
      if (stopTimer) clearTimeout(stopTimer);
      try {
        rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch {
        // Helpers may still be closing; main() removes the whole work dir at the end.
      }
      if (existsSync(outFile) && statSync(outFile).size > 0) resolve();
      else reject(new Error(`Chrome did not produce ${outFile}\n${output.slice(-2000)}`));
    });
    child.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

function writeXmlFixtures(): Buffer {
  mkdirSync(VARIANTS, { recursive: true });
  const bilingual = buildCoolBreezeXml("bilingual");
  writeFileSync(FILES.xml, bilingual);
  copyFileSync(FILES.xml, path.join(VARIANTS, "bilingual.xml"));
  writeFileSync(path.join(VARIANTS, "english.xml"), buildCoolBreezeXml("english"));
  writeFileSync(path.join(VARIANTS, "arabic.xml"), buildCoolBreezeXml("arabic"));
  writeFileSync(path.join(VARIANTS, "malicious-xxe.xml"), buildXxeXml());
  writeFileSync(path.join(VARIANTS, "billion-laughs.xml"), buildBillionLaughsXml());

  // Self-check: the three good files are well-formed and carry the seed values.
  const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false });
  for (const f of ["bilingual.xml", "english.xml", "arabic.xml"]) {
    const xml = readFileSync(path.join(VARIANTS, f), "utf8");
    const valid = XMLValidator.validate(xml);
    if (valid !== true) throw new Error(`${f} is not well-formed: ${JSON.stringify(valid)}`);
    if (/<!DOCTYPE/i.test(xml)) throw new Error(`${f} must not contain a DOCTYPE`);
    const inv = parser.parse(xml).Invoice;
    const party = inv.AccountingSupplierParty.Party;
    const lmt = inv.LegalMonetaryTotal;
    const checks: [string, unknown, string][] = [
      ["ID", inv.ID, COOL_BREEZE_INVOICE.id],
      ["UUID", inv.UUID, COOL_BREEZE_INVOICE.uuid],
      ["IssueDate", inv.IssueDate, COOL_BREEZE_INVOICE.issueDate],
      ["supplier VAT", party.PartyTaxScheme.CompanyID, COOL_BREEZE.vat],
      ["supplier CR", party.PartyIdentification.ID["#text"], COOL_BREEZE.cr],
      ["buyer VAT", inv.AccountingCustomerParty.Party.PartyTaxScheme.CompanyID, BUYER.vat],
      ["IBAN", inv.PaymentMeans.PayeeFinancialAccount.ID, COOL_BREEZE.iban],
      ["due date", inv.PaymentMeans.PaymentDueDate, COOL_BREEZE_INVOICE.dueDate],
      ["TaxExclusiveAmount", lmt.TaxExclusiveAmount["#text"], SAR(COOL_BREEZE_INVOICE.expected.subtotal)],
      ["TaxAmount", inv.TaxTotal[0].TaxAmount["#text"], SAR(COOL_BREEZE_INVOICE.expected.vat)],
      ["PayableAmount", lmt.PayableAmount["#text"], SAR(COOL_BREEZE_INVOICE.expected.total)],
    ];
    for (const [label, got, want] of checks) {
      if (got !== want) throw new Error(`${f}: ${label} is ${String(got)}, expected ${want}`);
    }
  }
  return Buffer.from(bilingual, "utf8");
}

async function buildPdf(xmlBytes: Buffer, tmp: string): Promise<void> {
  const inv = COOL_BREEZE_INVOICE;
  const qr = qrSvg(Buffer.from(coolBreezeQrBase64("bilingual"), "ascii"), { title: "ZATCA QR (demo data)" });
  mkdirSync(TEMPLATES, { recursive: true });
  writeFileSync(FILES.invoiceHtml, coolBreezeInvoiceHtml(coolBreezeTotals(), qr));

  const chromePdf = path.join(tmp, "invoice-chrome.pdf");
  await runChrome(tmp, ["--no-pdf-header-footer", `--print-to-pdf=${chromePdf}`], FILES.invoiceHtml, chromePdf);

  const when = new Date(inv.issueInstantUtc);
  const pdf = await PDFDocument.load(readFileSync(chromePdf), { updateMetadata: false });
  if (pdf.getPageCount() !== 1) throw new Error(`Invoice PDF has ${pdf.getPageCount()} pages, expected 1`);
  pdf.setTitle(`Tax Invoice ${inv.id} – ${COOL_BREEZE.nameEn} (fictitious)`);
  pdf.setAuthor(`${COOL_BREEZE.nameEn} (fictitious demo supplier)`);
  pdf.setSubject("Demo tax invoice with its UBL 2.1 e-invoice XML attached. Fictitious data for the Darb Bill Pay prototype.");
  pdf.setKeywords(["tax invoice", "e-invoice", "UBL 2.1", inv.id, "demo", "fictitious"]);
  pdf.setCreator("Darb Bill Pay prototype fixtures (scripts/make-fixtures.ts, headless Chrome)");
  pdf.setProducer("pdf-lib");
  pdf.setCreationDate(when);
  pdf.setModificationDate(when);
  await pdf.attach(xmlBytes, inv.embeddedXmlName, {
    mimeType: "application/xml",
    description: `E-invoice XML (UBL 2.1) for ${inv.id}. Fictitious demo data.`,
    creationDate: when,
    modificationDate: when,
    afRelationship: AFRelationship.Alternative,
  });
  writeFileSync(FILES.pdf, await pdf.save({ useObjectStreams: false }));
}

/** Re-reads the PDF, walks Catalog -> Names -> EmbeddedFiles, and checks the XML round-trips. */
async function verifyEmbeddedXml(xmlBytes: Buffer): Promise<string> {
  const pdf = await PDFDocument.load(readFileSync(FILES.pdf), { updateMetadata: false });
  const names = pdf.catalog.lookup(PDFName.of("Names"), PDFDict);
  const embeddedFiles = names.lookup(PDFName.of("EmbeddedFiles"), PDFDict);
  const list = embeddedFiles.lookup(PDFName.of("Names"), PDFArray);
  if (list.size() !== 2) throw new Error(`Expected exactly one embedded file, Names array has ${list.size()} entries`);
  const key = list.lookup(0);
  const fileName = key instanceof PDFString || key instanceof PDFHexString ? key.decodeText() : String(key);
  const spec = list.lookup(1, PDFDict);
  const uf = spec.lookup(PDFName.of("UF"));
  const ufName = uf instanceof PDFString || uf instanceof PDFHexString ? uf.decodeText() : "";
  const rel = spec.lookup(PDFName.of("AFRelationship"), PDFName);
  const ef = spec.lookup(PDFName.of("EF"), PDFDict);
  const stream = ef.lookup(PDFName.of("F"));
  if (!(stream instanceof PDFRawStream)) throw new Error("Embedded file stream (/EF /F) missing");
  const subtype = stream.dict.lookup(PDFName.of("Subtype"), PDFName);
  const data = Buffer.from(decodePDFRawStream(stream).decode());

  const af = pdf.catalog.lookup(PDFName.of("AF"), PDFArray);
  const specRef = list.get(1);
  const inAf = af.asArray().some((r) => r instanceof PDFRef && specRef instanceof PDFRef && r === specRef);

  const problems: string[] = [];
  if (fileName !== COOL_BREEZE_INVOICE.embeddedXmlName) problems.push(`name ${fileName}`);
  if (ufName !== COOL_BREEZE_INVOICE.embeddedXmlName) problems.push(`UF ${ufName}`);
  if (subtype !== PDFName.of("application/xml")) problems.push(`Subtype ${subtype.toString()}`);
  if (rel !== PDFName.of("Alternative")) problems.push(`AFRelationship ${rel.toString()}`);
  if (!inAf) problems.push("file spec not listed in Catalog /AF");
  if (Buffer.compare(data, xmlBytes) !== 0) problems.push("embedded bytes differ from the XML fixture");
  if (problems.length) throw new Error(`Embedded XML check failed: ${problems.join("; ")}`);
  return `${fileName} (${data.length} bytes, sha256 ${sha256(data)}) == ${path.basename(FILES.xml)}; Subtype ${subtype.toString()}, AFRelationship /Alternative, listed in /AF`;
}

async function buildPhoto(tmp: string): Promise<void> {
  const inv = GREEN_OASIS_INVOICE;
  const qrPayload = zatcaQrBase64([
    GREEN_OASIS.nameAr,
    GREEN_OASIS.vat,
    inv.qrTimestamp,
    SAR(inv.expected.total),
    SAR(inv.expected.vat),
  ]);
  const qr = qrSvg(Buffer.from(qrPayload, "ascii"), { color: "#111" });
  mkdirSync(TEMPLATES, { recursive: true });
  writeFileSync(FILES.photoHtml, greenOasisPhotoHtml(qr));

  const png = path.join(tmp, "photo.png");
  await runChrome(
    tmp,
    ["--window-size=1200,1600", "--force-device-scale-factor=1", `--screenshot=${png}`],
    FILES.photoHtml,
    png,
  );
  rmSync(FILES.jpg, { force: true });
  const py = spawnSync("python3", ["-I", POSTPROCESS_PY, png, FILES.jpg, "82"], { encoding: "utf8" });
  if (py.status !== 0 || !existsSync(FILES.jpg)) {
    log(`  python3/Pillow step failed (${(py.stderr || py.error?.message || "").trim().split("\n").pop()}); using sips`);
    execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "82", png, "--out", FILES.jpg], { stdio: "ignore" });
  }
}

/** Plain digital PDF for the seeded "saved earlier" bill. No attachment (supplier not on ZATCA integration yet). */
async function buildGreenOasis0917Pdf(tmp: string): Promise<string> {
  const inv = GREEN_OASIS_INVOICE_0917;
  const totals = greenOasis0917Totals();
  const qrPayload = zatcaQrBase64([
    GREEN_OASIS.nameAr,
    GREEN_OASIS.vat,
    `${inv.issueDate}T${inv.issueTime}`,
    SAR(totals.total),
    SAR(totals.vat),
  ]);
  const qr = qrSvg(Buffer.from(qrPayload, "ascii"), { title: "QR (demo data)" });
  mkdirSync(TEMPLATES, { recursive: true });
  writeFileSync(FILES.gol0917Html, greenOasisInvoicePdfHtml(totals, qr));

  const chromePdf = path.join(tmp, "gol-0917-chrome.pdf");
  await runChrome(tmp, ["--no-pdf-header-footer", `--print-to-pdf=${chromePdf}`], FILES.gol0917Html, chromePdf);

  const when = new Date(inv.issueInstantUtc);
  const pdf = await PDFDocument.load(readFileSync(chromePdf), { updateMetadata: false });
  if (pdf.getPageCount() !== 1) throw new Error(`GOL-2026-0917 PDF has ${pdf.getPageCount()} pages, expected 1`);
  pdf.setTitle(`فاتورة ضريبية ${inv.id} – ${GREEN_OASIS.nameEn} (fictitious)`);
  pdf.setAuthor(`${GREEN_OASIS.nameEn} (fictitious demo supplier)`);
  pdf.setSubject("Demo tax invoice (plain PDF, no e-invoice XML). Fictitious data for the Darb Bill Pay prototype.");
  pdf.setKeywords(["tax invoice", inv.id, "demo", "fictitious"]);
  pdf.setCreator("Darb Bill Pay prototype fixtures (scripts/make-fixtures.ts, headless Chrome)");
  pdf.setProducer("pdf-lib");
  pdf.setLanguage("ar");
  pdf.setCreationDate(when);
  pdf.setModificationDate(when);
  const bytes = await pdf.save({ useObjectStreams: false });
  writeFileSync(FILES.gol0917Pdf, bytes);

  // Must stay a plain PDF: no attachments, no /AF.
  const check = await PDFDocument.load(bytes, { updateMetadata: false });
  const names = check.catalog.lookupMaybe(PDFName.of("Names"), PDFDict);
  if (names?.has(PDFName.of("EmbeddedFiles")) || check.catalog.has(PDFName.of("AF"))) {
    throw new Error("GOL-2026-0917 PDF must not carry embedded files");
  }
  return `1 page, no embedded files; ${SAR(totals.subtotal)} + ${SAR(totals.vat)} = ${SAR(totals.total)} SAR`;
}

function writeOcr(): string {
  const inv = GREEN_OASIS_INVOICE;
  const f = (value: string, confidence: number) => ({ value, confidence });
  const ocr = {
    note: "Fixed mock OCR response for GOL-2026-1003-photo.jpg (Darb Bill Pay prototype). Fictitious data.",
    engine: "mock-ocr",
    file: path.basename(FILES.jpg),
    language: "ar",
    currency: "SAR",
    fields: {
      supplierName: f(GREEN_OASIS.nameEn, 0.93),
      supplierNameAr: f(GREEN_OASIS.nameAr, 0.96),
      supplierVat: f(GREEN_OASIS.vat, 0.95),
      supplierCr: f(GREEN_OASIS.cr, 0.91),
      invoiceNumber: f(inv.id, 0.78),
      issueDate: f(inv.issueDate, 0.92),
      dueDate: f(inv.dueDate, 0.71),
      subtotal: f(SAR(inv.expected.subtotal), 0.94),
      vat: f(SAR(inv.expected.vat), 0.82),
      total: f(SAR(inv.expected.total), 0.97),
    },
  };
  writeFileSync(FILES.ocr, `${JSON.stringify(ocr, null, 2)}\n`);
  const jpgHash = sha256(readFileSync(FILES.jpg));
  const index: Record<string, string> = { [jpgHash]: path.basename(FILES.ocr) };
  // This script does not write an OCR answer for GOL-2026-0917. If one is kept next to the
  // PDF (it is maintained separately), index it under the freshly built PDF's hash so a
  // regeneration never leaves a stale entry.
  if (existsSync(FILES.gol0917Ocr)) {
    index[sha256(readFileSync(FILES.gol0917Pdf))] = path.basename(FILES.gol0917Ocr);
    log(`  indexed ${path.basename(FILES.gol0917Ocr)} under the GOL-2026-0917 PDF hash`);
  }
  writeFileSync(FILES.ocrIndex, `${JSON.stringify(index, null, 2)}\n`);
  return jpgHash;
}

function writePreviews(dir: string) {
  mkdirSync(dir, { recursive: true });
  for (const pdf of [FILES.pdf, FILES.gol0917Pdf]) {
    const out = path.join(dir, `${path.basename(pdf)}.png`);
    const r = spawnSync("sips", ["-s", "format", "png", "-Z", "1800", pdf, "--out", out], { stdio: "ignore" });
    log(r.status === 0 ? `  preview: ${out}` : "  preview: sips not available, skipped");
  }
}

async function main() {
  const previewIdx = process.argv.indexOf("--preview-dir");
  const previewDir = previewIdx > -1 ? path.resolve(process.argv[previewIdx + 1]) : undefined;
  const tmp = mkdtempSync(path.join(os.tmpdir(), "darb-fixtures-"));
  try {
    log("1/6 XML (bilingual + variants + hostile files)");
    const xmlBytes = writeXmlFixtures();
    log("2/6 PDF INV-2026-0451 (Chrome print-to-pdf, then attach XML with pdf-lib)");
    await buildPdf(xmlBytes, tmp);
    log("3/6 Verify embedded XML");
    log(`  ${await verifyEmbeddedXml(xmlBytes)}`);
    log("4/6 Photo GOL-2026-1003 (Chrome screenshot -> JPEG)");
    await buildPhoto(tmp);
    log("5/6 PDF GOL-2026-0917 (plain PDF, no attachment)");
    log(`  ${await buildGreenOasis0917Pdf(tmp)}`);
    log("6/6 OCR mock + index");
    const jpgHash = writeOcr();
    if (previewDir) writePreviews(previewDir);

    log("\nFiles:");
    const all = [
      FILES.xml,
      FILES.pdf,
      FILES.jpg,
      FILES.ocr,
      FILES.ocrIndex,
      FILES.gol0917Pdf,
      ...["english.xml", "arabic.xml", "bilingual.xml", "malicious-xxe.xml", "billion-laughs.xml"].map((f) =>
        path.join(VARIANTS, f),
      ),
      FILES.invoiceHtml,
      FILES.photoHtml,
      FILES.gol0917Html,
    ];
    for (const f of all) log(`  ${String(statSync(f).size).padStart(8)}  ${path.relative(ROOT, f)}`);
    log(`\nJPEG sha256: ${jpgHash}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
