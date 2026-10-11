// Duplicate check (PL-03, BP-04): same invoice UUID, or same supplier + invoice number, flagged before submission.
import type { Bill } from "./types";
import { stripInvisible, toLatinDigits } from "./text";
import { normalizeDigits } from "./vat";

export type DuplicateReason = "invoice_uuid" | "supplier_invoice_number";

export interface DuplicateMatch {
  billId: string;
  reason: DuplicateReason;
}

export type DuplicateCandidate = Partial<
  Pick<Bill, "id" | "supplierId" | "supplierVat" | "supplierName" | "supplierNameAr" | "invoiceNumber" | "invoiceUuid">
>;

/** Case-, space- and dash-insensitive: "INV-2026 0451" = "inv20260451". */
export function normalizeInvoiceNumber(s: string): string {
  return toLatinDigits(stripInvisible(s))
    .toLowerCase()
    .replace(/[\s\-‐-―−_]/g, "");
}

/**
 * Lowercase, Latin digits, Arabic diacritics/tatweel and punctuation dropped, single spaces:
 * "Green Oasis Landscaping Est." = "green oasis landscaping est".
 */
export function normalizeName(s: string): string {
  return toLatinDigits(stripInvisible(s))
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[^0-9a-zÀ-ɏء-غف-يٱ-ۓ]+/g, " ")
    .trim();
}

const normalizeUuid = (s: string) => s.trim().toLowerCase();

/** Same supplier: by supplier id when both have one, else by VAT number, else by English or Arabic name. */
export function sameSupplier(a: DuplicateCandidate, b: DuplicateCandidate): boolean {
  if (a.supplierId && b.supplierId) return a.supplierId === b.supplierId;
  if (a.supplierVat && b.supplierVat) return normalizeDigits(a.supplierVat) === normalizeDigits(b.supplierVat);
  const eq = (x?: string, y?: string) => !!x && !!y && normalizeName(x) !== "" && normalizeName(x) === normalizeName(y);
  return eq(a.supplierName, b.supplierName) || eq(a.supplierNameAr, b.supplierNameAr);
}

/**
 * The first non-cancelled bill (other than the candidate itself) that duplicates the candidate.
 * A UUID match anywhere wins over a supplier + number match.
 */
export function findDuplicate(candidate: DuplicateCandidate, bills: readonly Bill[]): DuplicateMatch | null {
  const others = bills.filter((b) => b.status !== "cancelled" && (!candidate.id || b.id !== candidate.id));

  if (candidate.invoiceUuid) {
    const uuid = normalizeUuid(candidate.invoiceUuid);
    const hit = others.find((b) => b.invoiceUuid && normalizeUuid(b.invoiceUuid) === uuid);
    if (hit) return { billId: hit.id, reason: "invoice_uuid" };
  }

  const number = candidate.invoiceNumber ? normalizeInvoiceNumber(candidate.invoiceNumber) : "";
  if (number) {
    const hit = others.find(
      (b) => b.invoiceNumber && normalizeInvoiceNumber(b.invoiceNumber) === number && sameSupplier(candidate, b),
    );
    if (hit) return { billId: hit.id, reason: "supplier_invoice_number" };
  }
  return null;
}
