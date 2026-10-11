// Mock OCR (BP-03 fallback): a fixed answer per file, found by SHA-256 in fixtures/invoices/ocr-index.json.
import { readFileSync } from "node:fs";
import path from "node:path";
import type { BillFieldKey, ExtractedInvoice } from "@/lib/domain/types";
import { sar, totalsAgree } from "@/lib/domain/money";
import { isISODate } from "@/lib/domain/time";
import { isValidSaudiVat, isValidCr, normalizeDigits } from "@/lib/domain/vat";

export interface OcrService {
  read(bytes: Uint8Array, file: { name: string; sha256: string }): Promise<ExtractedInvoice>;
}

/** Below this, a field is flagged for review. */
export const OCR_CONFIDENCE_THRESHOLD = 0.85;

/** Fields a draft needs before it can be submitted; an unreadable file flags all of them. */
export const REQUIRED_FIELDS: BillFieldKey[] = [
  "supplierName",
  "supplierVat",
  "invoiceNumber",
  "issueDate",
  "dueDate",
  "subtotal",
  "vat",
  "total",
];

const ORDER: BillFieldKey[] = [
  "supplierName",
  "supplierNameAr",
  "supplierVat",
  "supplierCr",
  "invoiceNumber",
  "invoiceUuid",
  "issueDate",
  "dueDate",
  "subtotal",
  "vat",
  "total",
];

const LABEL: Record<BillFieldKey, string> = {
  supplierName: "supplier name",
  supplierNameAr: "Arabic supplier name",
  supplierVat: "VAT number",
  supplierCr: "CR number",
  invoiceNumber: "invoice number",
  invoiceUuid: "invoice ID",
  issueDate: "issue date",
  dueDate: "due date",
  subtotal: "subtotal",
  vat: "VAT",
  total: "total",
};

interface OcrJson {
  language?: ExtractedInvoice["language"];
  currency?: string;
  fields: Partial<Record<BillFieldKey, { value: string; confidence: number }>>;
}

export const NO_FIXED_RESPONSE = "Mock OCR has no fixed response for this file";

export function emptyExtraction(warning = NO_FIXED_RESPONSE): ExtractedInvoice {
  return { sources: {}, needsReview: [...REQUIRED_FIELDS], warnings: [warning] };
}

/** Maps the fixture OCR JSON to an ExtractedInvoice: every field "ocr", low confidence or invalid → needsReview. */
export function mapOcrJson(json: OcrJson): ExtractedInvoice {
  const out: ExtractedInvoice = { sources: {}, needsReview: [], warnings: [], language: json.language, currency: json.currency };
  const review = new Set<BillFieldKey>();
  for (const key of ORDER) {
    const field = json.fields[key];
    if (!field || field.value.trim() === "") {
      if (REQUIRED_FIELDS.includes(key)) review.add(key);
      continue;
    }
    out.sources[key] = "ocr";
    if (field.confidence < OCR_CONFIDENCE_THRESHOLD) review.add(key);
    const value = field.value.trim();
    switch (key) {
      case "subtotal":
      case "vat":
      case "total":
        try {
          out[key] = sar(value);
        } catch {
          review.add(key);
        }
        break;
      case "issueDate":
      case "dueDate":
        if (isISODate(value)) out[key] = value;
        else review.add(key);
        break;
      case "supplierVat":
        out.supplierVat = normalizeDigits(value);
        if (!isValidSaudiVat(out.supplierVat)) review.add(key);
        break;
      case "supplierCr":
        out.supplierCr = normalizeDigits(value);
        if (!isValidCr(out.supplierCr)) review.add(key);
        break;
      default:
        out[key] = value;
    }
  }
  if (out.subtotal !== undefined && out.vat !== undefined && out.total !== undefined && !totalsAgree(out.subtotal, out.vat, out.total)) {
    for (const f of ["subtotal", "vat", "total"] as const) review.add(f);
  }
  out.needsReview = ORDER.filter((k) => review.has(k));
  if (out.needsReview.length > 0) {
    out.warnings.push(`Read by OCR (mock). Check: ${out.needsReview.map((k) => LABEL[k]).join(", ")}.`);
  }
  return out;
}

/** The fixed-response OCR used by the prototype. */
export function createFixtureOcr(dir = path.join(process.cwd(), "fixtures", "invoices")): OcrService {
  let index: Record<string, string> | undefined;
  const loadIndex = () => {
    if (!index) {
      try {
        index = JSON.parse(readFileSync(path.join(dir, "ocr-index.json"), "utf8")) as Record<string, string>;
      } catch {
        index = {};
      }
    }
    return index;
  };
  return {
    async read(_bytes, file) {
      const name = loadIndex()[file.sha256];
      // Only plain file names from our own index are opened.
      if (!name || !/^[\w.-]+\.json$/.test(name)) return emptyExtraction();
      return mapOcrJson(JSON.parse(readFileSync(path.join(dir, name), "utf8")) as OcrJson);
    },
  };
}
