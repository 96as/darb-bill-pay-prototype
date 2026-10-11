// Reads a ZATCA (UBL 2.1) e-invoice XML into an ExtractedInvoice (PL-03, BP-03). Every field found is source "xml".
import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { BillFieldKey, ExtractedInvoice, Halalas } from "./types";
import { assertSafeXml, decodeXmlText } from "./xml-safety";
import { sar, totalsAgree, formatAmount } from "./money";
import { isValidSaudiVat, isValidCr, normalizeDigits } from "./vat";
import { isValidSaudiIban, maskIban, normalizeIban } from "./iban";
import { isISODate } from "./time";
import { scriptOf } from "./text";

export class InvoiceXmlError extends Error {
  constructor(
    readonly reason: "malformed" | "not_invoice",
    message: string,
  ) {
    super(message);
    this.name = "InvoiceXmlError";
  }
}

// Entities and DTDs are off: assertSafeXml has already refused DOCTYPE/ENTITY, and the parser never expands anything.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  processEntities: false,
  htmlEntities: false,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  ignoreDeclaration: true,
  ignorePiTags: true,
  // Every element is an array, so navigation is uniform whether a tag appears once or twice.
  isArray: (_name, _jpath, _isLeaf, isAttribute) => !isAttribute,
});

type XNode = Record<string, unknown>;

/** Child elements along a path; each step fans out over repeated elements. */
function all(node: unknown, ...names: string[]): unknown[] {
  let level: unknown[] = [node];
  for (const name of names) {
    level = level.flatMap((n) => (n && typeof n === "object" && Array.isArray((n as XNode)[name]) ? ((n as XNode)[name] as unknown[]) : []));
  }
  return level;
}

function textOf(el: unknown): string | undefined {
  const raw = typeof el === "string" ? el : el && typeof el === "object" ? (el as XNode)["#text"] : undefined;
  if (typeof raw !== "string") return undefined;
  const s = decodeXmlText(raw).trim();
  return s === "" ? undefined : s;
}

function attrOf(el: unknown, name: string): string | undefined {
  const v = el && typeof el === "object" ? (el as XNode)[`@_${name}`] : undefined;
  return typeof v === "string" ? v.trim() : undefined;
}

function texts(node: unknown, ...names: string[]): string[] {
  return all(node, ...names)
    .map(textOf)
    .filter((s): s is string => s !== undefined);
}

const first = (node: unknown, ...names: string[]): string | undefined => texts(node, ...names)[0];

// "Cool Breeze HVAC Contracting Co. | شركة …": split only when both scripts are present.
const BILINGUAL_SEPARATOR = /\s*\|\s*|\s+\/\s+|\s+[-–—]\s+|\s*\n\s*/;

function splitBilingual(s: string): string[] {
  const parts = s.split(BILINGUAL_SEPARATOR).map((p) => p.trim()).filter(Boolean);
  const scripts = new Set(parts.map(scriptOf));
  return scripts.has("arabic") && scripts.has("latin") ? parts : [s];
}

function pickNames(candidates: string[]): { en?: string; ar?: string } {
  const out: { en?: string; ar?: string } = {};
  for (const part of candidates.flatMap(splitBilingual)) {
    const script = scriptOf(part);
    if (script === "latin") out.en ??= part;
    else if (script === "arabic") out.ar ??= part;
  }
  return out;
}

function partyNames(party: unknown): string[] {
  return [...texts(party, "PartyLegalEntity", "RegistrationName"), ...texts(party, "PartyName", "Name")];
}

function addressOf(party: unknown): string | undefined {
  const a = all(party, "PostalAddress")[0];
  if (!a) return undefined;
  const join = (sep: string, ...xs: (string | undefined)[]) => xs.filter(Boolean).join(sep) || undefined;
  return join(
    ", ",
    join(" ", first(a, "BuildingNumber"), first(a, "StreetName")),
    first(a, "AdditionalStreetName"),
    first(a, "CitySubdivisionName"),
    join(" ", first(a, "CityName"), first(a, "PostalZone")),
    first(a, "Country", "IdentificationCode"),
  );
}

const SIMPLE_EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

const REVIEW_ORDER: BillFieldKey[] = [
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

/**
 * Parses a ZATCA UBL 2.1 invoice. Throws UnsafeXmlError (DOCTYPE/ENTITY/oversize) or InvoiceXmlError
 * (not well-formed, not an Invoice). Missing or inconsistent fields do not throw: they land in
 * needsReview with a warning.
 */
export function parseZatcaInvoice(xml: string): ExtractedInvoice {
  assertSafeXml(xml);
  const valid = XMLValidator.validate(xml);
  if (valid !== true) throw new InvoiceXmlError("malformed", `XML is not well-formed: ${valid.err.msg} (line ${valid.err.line})`);

  const doc = parser.parse(xml) as XNode;
  const inv = Array.isArray(doc.Invoice) ? doc.Invoice[0] : undefined;
  if (!inv || typeof inv !== "object") throw new InvoiceXmlError("not_invoice", "Not a UBL Invoice document");

  const review = new Set<BillFieldKey>();
  const warnings: string[] = [];
  const flag = (field: BillFieldKey, warning?: string) => {
    review.add(field);
    if (warning) warnings.push(warning);
  };

  const out: Omit<ExtractedInvoice, "sources" | "needsReview" | "warnings"> = {};

  // Supplier (seller)
  const seller = all(inv, "AccountingSupplierParty", "Party")[0];
  const names = pickNames(partyNames(seller));
  out.supplierName = names.en;
  out.supplierNameAr = names.ar;
  if (!names.en && !names.ar) flag("supplierName", "Supplier name is missing from the e-invoice");

  const vatRaw = first(seller, "PartyTaxScheme", "CompanyID");
  if (!vatRaw) flag("supplierVat", "Supplier VAT number is missing from the e-invoice");
  else {
    out.supplierVat = normalizeDigits(vatRaw);
    if (!isValidSaudiVat(out.supplierVat)) flag("supplierVat", `Supplier VAT number ${out.supplierVat} is not a valid Saudi VAT number`);
  }

  const crRaw = all(seller, "PartyIdentification", "ID").find((el) => attrOf(el, "schemeID")?.toUpperCase() === "CRN");
  const cr = textOf(crRaw);
  if (cr) {
    out.supplierCr = normalizeDigits(cr);
    if (!isValidCr(out.supplierCr)) flag("supplierCr", `Supplier CR ${out.supplierCr} is not 10 digits`);
  } else warnings.push("No supplier CR (schemeID CRN) in the e-invoice");

  out.supplierAddress = addressOf(seller);
  // Contact email prefills the supplier's notice email; anything not shaped like an email is ignored.
  const email = first(seller, "Contact", "ElectronicMail");
  if (email && SIMPLE_EMAIL.test(email)) out.supplierEmail = email;

  // Buyer
  const buyer = all(inv, "AccountingCustomerParty", "Party")[0];
  const buyerNames = pickNames(partyNames(buyer));
  out.buyerName = buyerNames.en ?? buyerNames.ar;
  const buyerVat = first(buyer, "PartyTaxScheme", "CompanyID");
  if (buyerVat) out.buyerVat = normalizeDigits(buyerVat);

  // Identity and dates
  out.invoiceNumber = first(inv, "ID");
  if (!out.invoiceNumber) flag("invoiceNumber", "Invoice number is missing from the e-invoice");
  out.invoiceUuid = first(inv, "UUID")?.toLowerCase();
  if (!out.invoiceUuid) flag("invoiceUuid", "Invoice UUID is missing; duplicates can only be matched by supplier and number");

  const issue = first(inv, "IssueDate");
  if (isISODate(issue)) out.issueDate = issue;
  else flag("issueDate", issue ? `Issue date "${issue}" is not a valid date` : "Issue date is missing from the e-invoice");

  const due = first(inv, "DueDate") ?? first(inv, "PaymentMeans", "PaymentDueDate");
  if (isISODate(due)) out.dueDate = due;
  else flag("dueDate", due ? `Due date "${due}" is not a valid date` : "No due date in the e-invoice; set one before paying");

  // Bank account (only a valid Saudi IBAN is suggested; BP-05 refuses a failing checksum)
  const ibans = texts(inv, "PaymentMeans", "PayeeFinancialAccount", "ID").map(normalizeIban);
  out.supplierIban = ibans.find(isValidSaudiIban);
  if (!out.supplierIban && ibans.length > 0) warnings.push(`IBAN ${maskIban(ibans[0])} in the e-invoice is not a valid Saudi IBAN`);

  // Amounts
  out.currency = first(inv, "DocumentCurrencyCode")?.toUpperCase();
  const amount = (el: unknown, label: string): Halalas | undefined => {
    const t = textOf(el);
    if (t === undefined) return undefined;
    try {
      return sar(t);
    } catch {
      warnings.push(`${label} "${t}" is not a valid amount`);
      return undefined;
    }
  };
  const totals = all(inv, "LegalMonetaryTotal")[0];
  out.subtotal = amount(all(totals, "TaxExclusiveAmount")[0], "Subtotal");
  out.vat = amount(pickTaxAmount(inv, out.currency), "VAT");
  const taxInclusive = amount(all(totals, "TaxInclusiveAmount")[0], "Tax-inclusive total");
  const payable = amount(all(totals, "PayableAmount")[0], "Payable amount");
  out.total = payable ?? taxInclusive;

  if (out.subtotal === undefined) flag("subtotal", "Subtotal (tax-exclusive amount) is missing");
  if (out.vat === undefined) flag("vat", "VAT amount is missing");
  if (out.total === undefined) flag("total", "Total (payable amount) is missing");

  if (out.subtotal !== undefined && out.vat !== undefined && out.total !== undefined) {
    // Compare with the tax-inclusive amount when present: a prepaid amount legitimately lowers PayableAmount.
    const gross = taxInclusive ?? out.total;
    if (!totalsAgree(out.subtotal, out.vat, gross)) {
      for (const f of ["subtotal", "vat", "total"] as const) review.add(f);
      warnings.push(
        `Subtotal ${formatAmount(out.subtotal)} + VAT ${formatAmount(out.vat)} does not equal total ${formatAmount(gross)}`,
      );
    }
  }
  if (payable !== undefined && taxInclusive !== undefined && payable !== taxInclusive) {
    flag("total", `Payable amount ${formatAmount(payable)} differs from the tax-inclusive total ${formatAmount(taxInclusive)}`);
  }
  if (out.currency && out.currency !== "SAR") flag("total", `Invoice currency is ${out.currency}; only SAR bills can be paid`);

  out.language = detectLanguage(inv, seller, buyer);

  // Drop absent fields, so `field in result` means "the XML had it".
  for (const key of Object.keys(out) as (keyof typeof out)[]) {
    if (out[key] === undefined) delete out[key];
  }
  const sources: ExtractedInvoice["sources"] = {};
  for (const field of REVIEW_ORDER) {
    if (field in out) sources[field] = "xml";
  }
  return { ...out, sources, needsReview: REVIEW_ORDER.filter((f) => review.has(f)), warnings };
}

/**
 * ZATCA invoices carry two TaxTotal elements (one with TaxSubtotal breakdown, one in the tax currency).
 * Take the TaxAmount in the document currency (consistent with the other totals), else in SAR, else the first.
 */
function pickTaxAmount(inv: unknown, currency: string | undefined): unknown {
  const amounts = all(inv, "TaxTotal").map((t) => all(t, "TaxAmount")[0]).filter((a) => textOf(a) !== undefined);
  const inCurrency = (c: string | undefined) => (c ? amounts.find((a) => attrOf(a, "currencyID")?.toUpperCase() === c) : undefined);
  return inCurrency(currency) ?? inCurrency("SAR") ?? amounts[0];
}

/** Arabic, English or bilingual from the party names, item names and notes. */
function detectLanguage(inv: unknown, seller: unknown, buyer: unknown): ExtractedInvoice["language"] {
  const segments = [
    ...partyNames(seller),
    ...partyNames(buyer),
    ...texts(inv, "InvoiceLine", "Item", "Name"),
    ...texts(inv, "Note"),
  ].flatMap(splitBilingual);
  const scripts = new Set(segments.map(scriptOf));
  if (scripts.has("arabic") && scripts.has("latin")) return "bilingual";
  if (scripts.has("arabic")) return "ar";
  if (scripts.has("latin")) return "en";
  return undefined;
}

/** Display name for a bill: English when the invoice has one, else Arabic. */
export function primarySupplierName(inv: Pick<ExtractedInvoice, "supplierName" | "supplierNameAr">): string | undefined {
  return inv.supplierName ?? inv.supplierNameAr;
}
