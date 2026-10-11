// Bills: ingest (PL-03, BP-01..04), edit, submit, approve, reject, cancel, list (BP-11, BP-12, BP-18).
import { createHash } from "node:crypto";
import type {
  Bill,
  BillFieldKey,
  DisplayStatus,
  ExtractedInvoice,
  FundingAccount,
  Halalas,
  ISODate,
  Payment,
  RailQuote,
  StoredFile,
  Supplier,
} from "@/lib/domain/types";
import { sniffFileType, mimeFor, type AcceptedFileType } from "@/lib/domain/file-type";
import { parseZatcaInvoice, InvoiceXmlError } from "@/lib/domain/zatca";
import { extractEmbeddedXml } from "@/lib/domain/pdf-xml";
import { UnsafeXmlError, decodeXmlBytes } from "@/lib/domain/xml-safety";
import { findDuplicate, type DuplicateMatch } from "@/lib/domain/duplicates";
import { canApproveBill, canCancel, canPrepare, materialEditRestartsApproval, type MaterialSnapshot } from "@/lib/domain/permissions";
import { checkDaily, checkPerPayment } from "@/lib/domain/limits";
import { assertTransition, displayStatus } from "@/lib/domain/status";
import { isISODate } from "@/lib/domain/time";
import { isValidSaudiVat, isValidCr, normalizeDigits } from "@/lib/domain/vat";
import { maskIban, normalizeIban } from "@/lib/domain/iban";
import { totalsAgree } from "@/lib/domain/money";
import type { RuleResult } from "@/lib/domain/result";
import type { Ctx } from "../context";
import { approverIds, getAccount, getUser, sessionUserId, today } from "../context";
import { ServiceError, conflict, ensure, invalid } from "../errors";
import { audit, auditFor } from "../audit";
import { newId } from "../ids";
import {
  billLabel,
  committedForDay,
  findSupplier,
  getBill,
  latestPayment,
  notify,
  paidToCurrentIban,
  quoteFor,
  quoteOfPayment,
  unsentPayment,
} from "./common";
import { approveAndSchedule, assertSubmittable, requireApproverRole, restartApproval } from "./workflow";
import { runScheduler, type SchedulerReport } from "./scheduler";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const EXT: Record<AcceptedFileType, string> = { pdf: "pdf", jpeg: "jpg", png: "png", xml: "xml" };

const FIELD_KEYS: BillFieldKey[] = [
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

function prepare(ctx: Ctx, actorId: string) {
  const user = getUser(ctx, actorId);
  ensure(canPrepare(user));
  return user;
}

// ---------- Ingest ----------

export interface IngestInput {
  bytes: Uint8Array;
  filename: string;
  source: "upload" | "email";
  emailId?: string;
  senderEmail?: string;
  /** User id, or "system" for the bills inbox. */
  actorId: string;
  /** For fixture files (the seeded email): reference this path instead of copying the bytes. */
  existingPath?: string;
}

export interface IngestResult {
  bill: Bill;
  duplicate: DuplicateMatch | null;
  warnings: string[];
}

const sanitizeFilename = (name: string) =>
  (name.split(/[\\/]/).pop() ?? "file").replace(/[\u0000-\u001f\u007f"<>|:*?]/g, "_").slice(0, 120) || "file";

async function readInvoice(
  ctx: Ctx,
  type: AcceptedFileType,
  bytes: Uint8Array,
  file: { name: string; sha256: string },
): Promise<{ extracted: ExtractedInvoice; extraction: Bill["extraction"] }> {
  try {
    if (type === "xml") return { extracted: parseZatcaInvoice(decodeXmlBytes(bytes)), extraction: "e_invoice" };
    if (type === "pdf") {
      let embedded;
      try {
        embedded = await extractEmbeddedXml(bytes);
      } catch (err) {
        if (err instanceof UnsafeXmlError) throw err;
        throw invalid("unreadable_pdf", "The PDF could not be read");
      }
      if (embedded) {
        try {
          return { extracted: parseZatcaInvoice(embedded.xml), extraction: "e_invoice" };
        } catch (err) {
          if (!(err instanceof InvoiceXmlError)) throw err;
          const ocr = await ctx.mocks.ocr.read(bytes, file);
          ocr.warnings.unshift(`The attached ${embedded.filename} is not a ZATCA invoice; fields were read by OCR`);
          return { extracted: ocr, extraction: "ocr" };
        }
      }
    }
    return { extracted: await ctx.mocks.ocr.read(bytes, file), extraction: "ocr" };
  } catch (err) {
    if (err instanceof UnsafeXmlError) throw invalid("unsafe_xml", `The XML was refused: ${err.message}`);
    if (err instanceof InvoiceXmlError) throw invalid("invalid_xml", err.message);
    throw err;
  }
}

/** BP-01/BP-02/BP-03: a PDF, image or XML becomes a draft bill with the file attached and every field's source. */
export async function ingestFile(ctx: Ctx, input: IngestInput): Promise<IngestResult> {
  if (input.actorId !== "system") prepare(ctx, input.actorId);
  if (input.bytes.length === 0) throw invalid("empty_file", "The file is empty");
  if (input.bytes.length > MAX_UPLOAD_BYTES) throw new ServiceError("file_too_large", "Files up to 10 MB are accepted", 413);
  const type = sniffFileType(input.bytes, input.filename);
  if (!type) throw new ServiceError("unsupported_file", "Upload a PDF, a photo (JPEG or PNG) or a ZATCA XML file", 415);

  const name = sanitizeFilename(input.filename);
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const { extracted, extraction } = await readInvoice(ctx, type, input.bytes, { name, sha256 });

  const fileId = newId(ctx.store, "f");
  const path = input.existingPath ?? (await ctx.files.save(fileId, EXT[type], input.bytes));
  const file: StoredFile = { id: fileId, name, mime: mimeFor(type), size: input.bytes.length, sha256, path };
  ctx.store.files.push(file);

  // BP-05: a new invoice is matched to its supplier by VAT number.
  const supplier = extracted.supplierVat ? ctx.store.suppliers.find((s) => s.vatNumber === extracted.supplierVat) : undefined;
  const warnings = [...extracted.warnings];
  if (supplier && extracted.supplierIban && normalizeIban(extracted.supplierIban) !== normalizeIban(supplier.iban)) {
    warnings.push(
      `The IBAN on this invoice (${maskIban(extracted.supplierIban)}) differs from the saved IBAN for ${supplier.nameEn} (${maskIban(supplier.iban)}). Payments go to the saved IBAN; changing it needs an approved IBAN change.`,
    );
  }

  const bill: Bill = {
    id: newId(ctx.store, "b"),
    kind: "supplier",
    source: input.source,
    extraction,
    ...(input.emailId ? { emailId: input.emailId } : {}),
    ...(input.senderEmail ? { senderEmail: input.senderEmail } : {}),
    file,
    ...(supplier ? { supplierId: supplier.id } : {}),
    supplierName: extracted.supplierName ?? extracted.supplierNameAr ?? supplier?.nameEn ?? "",
    supplierNameAr: extracted.supplierNameAr ?? supplier?.nameAr,
    supplierVat: extracted.supplierVat,
    supplierCr: extracted.supplierCr,
    invoiceNumber: extracted.invoiceNumber ?? "",
    invoiceUuid: extracted.invoiceUuid,
    issueDate: extracted.issueDate,
    dueDate: extracted.dueDate,
    subtotal: extracted.subtotal,
    vat: extracted.vat,
    total: extracted.total ?? 0,
    fieldSources: { ...extracted.sources },
    needsReview: [...extracted.needsReview],
    ...(warnings.length > 0 ? { warnings } : {}),
    ...(extraction === "e_invoice"
      ? {
          suggestedSupplier: {
            supplierName: extracted.supplierName,
            supplierNameAr: extracted.supplierNameAr,
            supplierVat: extracted.supplierVat,
            supplierCr: extracted.supplierCr,
            supplierIban: extracted.supplierIban,
            supplierAddress: extracted.supplierAddress,
          },
        }
      : {}),
    status: "draft",
    fundingAccountId: "main",
    createdBy: input.actorId,
    createdAt: ctx.now.toISOString(),
    editedBy: [],
    approvals: [],
  };
  stripUndefined(bill);

  // BP-04: flagged before submission; the draft is still created.
  const duplicate = findDuplicate(bill, ctx.store.bills);
  if (duplicate) {
    bill.duplicateOf = duplicate.billId;
    bill.duplicateReason = duplicate.reason;
  }
  ctx.store.bills.push(bill);
  audit(ctx, input.actorId, "bill.created", { type: "bill", id: bill.id }, undefined, {
    source: bill.source,
    extraction: bill.extraction,
    file: file.name,
    emailId: bill.emailId,
    senderEmail: bill.senderEmail,
    supplierId: bill.supplierId,
    invoiceNumber: bill.invoiceNumber,
    total: bill.total,
    needsReview: bill.needsReview,
    duplicateOf: bill.duplicateOf,
  });
  return { bill, duplicate, warnings };
}

function stripUndefined<T extends object>(o: T): T {
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === undefined) delete o[k];
  return o;
}

// ---------- Manual bills ----------

export interface ManualBillInput {
  supplierId?: string;
  supplierName?: string;
  supplierNameAr?: string;
  supplierVat?: string;
  supplierCr?: string;
  invoiceNumber?: string;
  issueDate?: ISODate;
  dueDate?: ISODate;
  subtotal?: Halalas;
  vat?: Halalas;
  total: Halalas;
  fundingAccountId?: string;
  /** A SADAD bill (BP-12) instead of a supplier invoice. */
  sadad?: { billerName: string; billerNameAr?: string; billerCode: string; billNumber: string };
}

function checkAmount(name: string, v: unknown, required = false): Halalas | undefined {
  if (v === undefined || v === null) {
    if (required) throw invalid("invalid_amount", `${name} is required`);
    return undefined;
  }
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0) throw invalid("invalid_amount", `${name} must be a whole number of halalas`);
  return v;
}

function checkDate(name: string, v: unknown): ISODate | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (!isISODate(v)) throw invalid("invalid_date", `${name} must be a date (YYYY-MM-DD)`);
  return v;
}

export function createManualBill(ctx: Ctx, input: ManualBillInput, actorId: string): IngestResult {
  prepare(ctx, actorId);
  const total = checkAmount("Total", input.total, true)!;
  if (total <= 0) throw invalid("invalid_amount", "Total must be more than zero");
  const subtotal = checkAmount("Subtotal", input.subtotal);
  const vat = checkAmount("VAT", input.vat);
  if (subtotal !== undefined && vat !== undefined && !totalsAgree(subtotal, vat, total)) {
    throw invalid("totals_mismatch", "Subtotal plus VAT does not equal the total");
  }
  const fundingAccountId = input.fundingAccountId ?? "main";
  getAccount(ctx, fundingAccountId);

  let supplier: Supplier | undefined;
  if (input.supplierId) {
    supplier = findSupplier(ctx, input.supplierId);
    if (!supplier) throw invalid("unknown_supplier", "Supplier not found");
  }
  const vatNumber = supplier?.vatNumber ?? (input.supplierVat ? normalizeDigits(input.supplierVat) : undefined);
  if (vatNumber && !isValidSaudiVat(vatNumber)) throw invalid("invalid_vat", "VAT number must be 15 digits, starting and ending with 3");
  if (input.supplierCr && !isValidCr(input.supplierCr)) throw invalid("invalid_cr", "CR number must be 10 digits");

  const sadad = input.sadad;
  if (sadad && (!sadad.billerName?.trim() || !sadad.billerCode?.trim() || !sadad.billNumber?.trim())) {
    throw invalid("invalid_sadad", "A SADAD bill needs the biller name, biller code and bill number");
  }
  const supplierName = sadad?.billerName ?? supplier?.nameEn ?? input.supplierName?.trim();
  if (!supplierName) throw invalid("missing_supplier", "Choose a supplier or type its name");
  const invoiceNumber = (sadad?.billNumber ?? input.invoiceNumber ?? "").trim();
  if (!invoiceNumber) throw invalid("missing_invoice_number", "The invoice number is required");

  const bill: Bill = stripUndefined({
    id: newId(ctx.store, "b"),
    kind: sadad ? "sadad" : "supplier",
    source: sadad ? "sadad" : "manual",
    extraction: "manual",
    supplierId: supplier?.id,
    supplierName,
    supplierNameAr: sadad?.billerNameAr ?? supplier?.nameAr ?? input.supplierNameAr,
    supplierVat: sadad ? undefined : vatNumber,
    supplierCr: sadad ? undefined : (supplier?.crNumber ?? input.supplierCr),
    invoiceNumber,
    issueDate: checkDate("Issue date", input.issueDate),
    dueDate: checkDate("Due date", input.dueDate),
    subtotal,
    vat,
    total,
    fieldSources: {},
    needsReview: [],
    ...(sadad ? { sadad: { billerName: sadad.billerName, billerNameAr: sadad.billerNameAr ?? sadad.billerName, billerCode: sadad.billerCode, billNumber: sadad.billNumber } } : {}),
    status: "draft",
    fundingAccountId,
    createdBy: actorId,
    createdAt: ctx.now.toISOString(),
    editedBy: [],
    approvals: [],
  } as Bill);
  for (const key of FIELD_KEYS) if (bill[key] !== undefined) bill.fieldSources[key] = "manual";

  const duplicate = findDuplicate(bill, ctx.store.bills);
  if (duplicate) {
    bill.duplicateOf = duplicate.billId;
    bill.duplicateReason = duplicate.reason;
  }
  ctx.store.bills.push(bill);
  audit(ctx, actorId, "bill.created", { type: "bill", id: bill.id }, undefined, {
    source: bill.source,
    invoiceNumber: bill.invoiceNumber,
    total: bill.total,
    supplierId: bill.supplierId,
    duplicateOf: bill.duplicateOf,
  });
  return { bill, duplicate, warnings: [] };
}

// ---------- Edit ----------

export interface BillPatch {
  supplierId?: string | null;
  supplierName?: string;
  supplierNameAr?: string;
  supplierVat?: string;
  supplierCr?: string;
  invoiceNumber?: string;
  issueDate?: ISODate | null;
  dueDate?: ISODate | null;
  subtotal?: Halalas | null;
  vat?: Halalas | null;
  total?: Halalas;
  payDate?: ISODate;
  fundingAccountId?: string;
}

const EDITABLE: ReadonlySet<Bill["status"]> = new Set(["draft", "awaiting_approval", "scheduled", "failed"]);

function assertEditable(ctx: Ctx, bill: Bill): void {
  if (!EDITABLE.has(bill.status)) throw conflict("not_editable", `A ${bill.status} bill cannot be edited`);
  const payment = latestPayment(ctx, bill);
  if (payment && (payment.status === "sent" || payment.status === "settled")) throw conflict("payment_sent", "The payment has already been sent");
}

function materialSnapshot(ctx: Ctx, bill: Bill): MaterialSnapshot {
  return {
    total: bill.total,
    subtotal: bill.subtotal,
    vat: bill.vat,
    supplierId: bill.supplierId,
    supplierName: bill.supplierName,
    payDate: bill.payDate,
    dueDate: bill.dueDate,
    sadad: bill.sadad,
    iban: findSupplier(ctx, bill.supplierId)?.iban,
  };
}

const IDENTITY: ReadonlySet<string> = new Set(["supplierId", "supplierName", "supplierNameAr", "supplierVat", "invoiceNumber", "invoiceUuid"]);

export interface UpdateResult {
  bill: Bill;
  changed: string[];
  approvalRestarted: boolean;
}

/**
 * Edits a bill. Edited fields become "manual" and leave needsReview; the editor joins editedBy (maker-checker).
 * BP-08: editing amount, supplier, IBAN or date of a bill in approval restarts approval.
 */
export function updateBill(ctx: Ctx, id: string, patch: BillPatch, actorId: string): UpdateResult {
  prepare(ctx, actorId);
  const bill = getBill(ctx, id);
  assertEditable(ctx, bill);
  const beforeMaterial = materialSnapshot(ctx, bill);
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  const set = (key: keyof Bill, value: unknown) => {
    const current = bill[key];
    if (current === value || (value === undefined && current === undefined)) return;
    before[key] = current;
    after[key] = value;
    if (value === undefined) delete bill[key];
    else (bill as unknown as Record<string, unknown>)[key] = value;
  };

  if (patch.supplierId !== undefined) {
    if (patch.supplierId === null) set("supplierId", undefined);
    else {
      const supplier = findSupplier(ctx, patch.supplierId);
      if (!supplier) throw invalid("unknown_supplier", "Supplier not found");
      set("supplierId", supplier.id);
      set("supplierName", supplier.nameEn);
      set("supplierNameAr", supplier.nameAr);
      set("supplierVat", supplier.vatNumber);
      set("supplierCr", supplier.crNumber);
    }
  }
  if (patch.supplierName !== undefined) set("supplierName", patch.supplierName.trim());
  if (patch.supplierNameAr !== undefined) set("supplierNameAr", patch.supplierNameAr.trim() || undefined);
  if (patch.supplierVat !== undefined) {
    const vat = normalizeDigits(patch.supplierVat);
    if (vat && !isValidSaudiVat(vat)) throw invalid("invalid_vat", "VAT number must be 15 digits, starting and ending with 3");
    set("supplierVat", vat || undefined);
  }
  if (patch.supplierCr !== undefined) {
    const cr = normalizeDigits(patch.supplierCr);
    if (cr && !isValidCr(cr)) throw invalid("invalid_cr", "CR number must be 10 digits");
    set("supplierCr", cr || undefined);
  }
  if (patch.invoiceNumber !== undefined) set("invoiceNumber", patch.invoiceNumber.trim());
  if (patch.issueDate !== undefined) set("issueDate", checkDate("Issue date", patch.issueDate));
  if (patch.dueDate !== undefined) set("dueDate", checkDate("Due date", patch.dueDate));
  if (patch.subtotal !== undefined) set("subtotal", checkAmount("Subtotal", patch.subtotal));
  if (patch.vat !== undefined) set("vat", checkAmount("VAT", patch.vat));
  if (patch.total !== undefined) set("total", checkAmount("Total", patch.total, true));
  if (patch.payDate !== undefined) {
    const payDate = checkDate("Pay date", patch.payDate);
    if (payDate && payDate < today(ctx)) throw invalid("pay_date_in_past", "The pay date cannot be in the past");
    set("payDate", payDate);
  }
  if (patch.fundingAccountId !== undefined) {
    getAccount(ctx, patch.fundingAccountId);
    set("fundingAccountId", patch.fundingAccountId);
  }

  const changed = Object.keys(after);
  if (changed.length === 0) return { bill, changed, approvalRestarted: false };

  for (const key of changed) {
    if ((FIELD_KEYS as string[]).includes(key)) {
      bill.fieldSources[key as BillFieldKey] = "manual";
      bill.needsReview = bill.needsReview.filter((f) => f !== key);
    }
  }
  if (!bill.editedBy.includes(actorId)) bill.editedBy.push(actorId);
  const payment = unsentPayment(ctx, bill.id);
  if (payment && after.fundingAccountId) payment.fundingAccountId = bill.fundingAccountId;

  if (bill.status !== "draft" && after.total !== undefined) ensure(checkPerPayment(bill.total, ctx.store.company.limits), 422);

  let approvalRestarted = false;
  const inApproval = bill.status === "awaiting_approval" || bill.status === "scheduled";
  if (inApproval && materialEditRestartsApproval(beforeMaterial, materialSnapshot(ctx, bill))) {
    restartApproval(ctx, bill, actorId, "edit");
    approvalRestarted = true;
  }
  if (changed.some((k) => IDENTITY.has(k))) {
    const dup = findDuplicate(bill, ctx.store.bills);
    if (dup) {
      bill.duplicateOf = dup.billId;
      bill.duplicateReason = dup.reason;
    } else {
      delete bill.duplicateOf;
      delete bill.duplicateReason;
    }
  }
  audit(ctx, actorId, "bill.updated", { type: "bill", id: bill.id }, before, { ...after, approvalRestarted });
  return { bill, changed, approvalRestarted };
}

/** The preparer checked flagged fields against the file without changing them. */
export function markFieldsReviewed(ctx: Ctx, id: string, fields: BillFieldKey[], actorId: string): Bill {
  prepare(ctx, actorId);
  const bill = getBill(ctx, id);
  assertEditable(ctx, bill);
  const cleared = bill.needsReview.filter((f) => fields.includes(f));
  if (cleared.length === 0) return bill;
  bill.needsReview = bill.needsReview.filter((f) => !fields.includes(f));
  if (!bill.editedBy.includes(actorId)) bill.editedBy.push(actorId);
  audit(ctx, actorId, "bill.fields_reviewed", { type: "bill", id: bill.id }, { needsReview: [...bill.needsReview, ...cleared] }, { needsReview: bill.needsReview, reviewed: cleared });
  return bill;
}

export function dismissDuplicate(ctx: Ctx, id: string, actorId: string): Bill {
  prepare(ctx, actorId);
  const bill = getBill(ctx, id);
  if (!bill.duplicateOf) throw conflict("not_duplicate", "This bill is not flagged as a duplicate");
  const before = { duplicateOf: bill.duplicateOf, duplicateReason: bill.duplicateReason };
  delete bill.duplicateOf;
  delete bill.duplicateReason;
  audit(ctx, actorId, "bill.duplicate_dismissed", { type: "bill", id: bill.id }, before, { duplicateOf: null });
  return bill;
}

// ---------- Submit / approve / reject / cancel ----------

export interface SubmitInput {
  payDate: ISODate;
  fundingAccountId?: string;
}

/** BP-08/BP-09: the preparer sets the pay date and account, sees rail and arrival, and sends for approval. */
export function submitBill(ctx: Ctx, id: string, actorId: string, input: SubmitInput): { bill: Bill; quote: RailQuote } {
  prepare(ctx, actorId);
  const bill = getBill(ctx, id);
  if (bill.runId) throw conflict("in_run", "This bill is in a payment run; submit the run instead");
  if (bill.status !== "draft") throw conflict("not_draft", "Only a draft can be submitted");
  const fundingAccountId = input.fundingAccountId ?? bill.fundingAccountId;
  assertSubmittable(ctx, bill, input.payDate, fundingAccountId);
  assertTransition(bill.status, "awaiting_approval");
  bill.status = "awaiting_approval";
  bill.payDate = input.payDate;
  bill.fundingAccountId = fundingAccountId;
  bill.submittedBy = actorId;
  bill.submittedAt = ctx.now.toISOString();
  bill.approvals = [];
  delete bill.rejection;
  const quote = quoteFor(ctx, bill, input.payDate);
  audit(ctx, actorId, "bill.submitted", { type: "bill", id: bill.id }, { status: "draft" }, {
    status: "awaiting_approval",
    payDate: bill.payDate,
    fundingAccountId,
    rail: quote.rail,
    arrivalDate: quote.arrivalDate,
  });
  notify(ctx, approverIds(ctx).filter((u) => u !== actorId), "approval_needed", `${billLabel(bill)} is waiting for your approval.`, `${billLabel(bill, "ar")} بانتظار موافقتك.`);
  return { bill, quote };
}

/** BP-08: approval releases the payment on its pay date (single bill outside a run, e.g. SADAD). */
export function approveBill(ctx: Ctx, id: string, actorId: string): { bill: Bill; payment: Payment; scheduler: SchedulerReport } {
  const user = getUser(ctx, actorId);
  const bill = getBill(ctx, id);
  if (bill.runId) throw conflict("in_run", "This bill is in a payment run; approve the run instead");
  const supplier = bill.kind === "supplier" ? findSupplier(ctx, bill.supplierId) : undefined;
  ensure(
    canApproveBill(user, bill, supplier, {
      supplierHasPaid: supplier ? paidToCurrentIban(ctx, supplier) : true,
      makerChecker: ctx.store.company.makerChecker,
    }),
  );
  const payDate = bill.payDate ?? today(ctx);
  ensure(checkPerPayment(bill.total, ctx.store.company.limits), 422);
  ensure(checkDaily(committedForDay(ctx, payDate, new Set([bill.id])), bill.total, ctx.store.company.limits), 422);
  const payment = approveAndSchedule(ctx, bill, user);
  const scheduler = runScheduler(ctx);
  return { bill, payment, scheduler };
}

export function rejectBill(ctx: Ctx, id: string, actorId: string, reason?: string): Bill {
  const user = getUser(ctx, actorId);
  requireApproverRole(user, "reject bills");
  const bill = getBill(ctx, id);
  if (bill.runId) throw conflict("in_run", "This bill is in a payment run; reject the run instead");
  if (bill.status !== "awaiting_approval") throw conflict("not_awaiting_approval", "This bill is not waiting for approval");
  assertTransition(bill.status, "draft");
  bill.status = "draft";
  bill.approvals = [];
  bill.rejection = { by: actorId, at: ctx.now.toISOString(), ...(reason?.trim() ? { reason: reason.trim() } : {}) };
  audit(ctx, actorId, "bill.rejected", { type: "bill", id: bill.id }, { status: "awaiting_approval" }, { status: "draft", reason: bill.rejection.reason });
  return bill;
}

/** BP-18: a bill (and its scheduled payment) can be cancelled until the payment is sent. */
export function cancelBill(ctx: Ctx, id: string, actorId: string): Bill {
  prepare(ctx, actorId);
  const bill = getBill(ctx, id);
  ensure(canCancel(bill, latestPayment(ctx, bill)), 409);
  const before = { status: bill.status };
  assertTransition(bill.status, "cancelled");
  bill.status = "cancelled";
  bill.cancelledBy = actorId;
  bill.cancelledAt = ctx.now.toISOString();
  const payment = unsentPayment(ctx, bill.id);
  if (payment) {
    const paymentBefore = { status: payment.status };
    payment.status = "cancelled";
    audit(ctx, actorId, "payment.cancelled", { type: "payment", id: payment.id }, paymentBefore, { status: "cancelled" });
  }
  audit(ctx, actorId, "bill.cancelled", { type: "bill", id: bill.id }, before, { status: "cancelled" });
  return bill;
}

// ---------- Read models ----------

export interface BillListFilters {
  status?: DisplayStatus;
  /** Due date strictly before this day (GET /bills?due_before=). */
  dueBefore?: ISODate;
}

export interface BillRow {
  bill: Bill;
  displayStatus: DisplayStatus;
  supplier?: Pick<Supplier, "id" | "nameEn" | "nameAr" | "bankName">;
  payment?: Payment;
  /** Rail and arrival: the payment's when approved, else a live quote for the pay date. */
  quote?: RailQuote;
  run?: { id: string; name: string; status: string };
}

function quoteForBill(ctx: Ctx, bill: Bill, payment: Payment | undefined): RailQuote | undefined {
  if (payment && payment.status !== "cancelled") return quoteOfPayment(payment);
  if ((bill.status === "draft" || bill.status === "awaiting_approval") && bill.payDate && bill.total > 0) {
    return quoteFor(ctx, bill, bill.payDate < today(ctx) ? today(ctx) : bill.payDate);
  }
  return undefined;
}

function toRow(ctx: Ctx, bill: Bill): BillRow {
  const supplier = findSupplier(ctx, bill.supplierId);
  const payment = latestPayment(ctx, bill);
  const run = bill.runId ? ctx.store.runs.find((r) => r.id === bill.runId) : undefined;
  return stripUndefined({
    bill,
    displayStatus: displayStatus(bill, today(ctx)),
    supplier: supplier ? { id: supplier.id, nameEn: supplier.nameEn, nameAr: supplier.nameAr, bankName: supplier.bankName } : undefined,
    payment,
    quote: quoteForBill(ctx, bill, payment),
    run: run ? { id: run.id, name: run.name, status: run.status } : undefined,
  });
}

const isOpen = (s: DisplayStatus) => s !== "paid" && s !== "cancelled";

export function listBills(ctx: Ctx, filters: BillListFilters = {}): BillRow[] {
  return ctx.store.bills
    .map((b) => toRow(ctx, b))
    .filter((r) => !filters.status || r.displayStatus === filters.status)
    .filter((r) => !filters.dueBefore || (!!r.bill.dueDate && r.bill.dueDate < filters.dueBefore))
    .sort((a, b) => {
      const ao = isOpen(a.displayStatus);
      const bo = isOpen(b.displayStatus);
      if (ao !== bo) return ao ? -1 : 1;
      const ad = a.bill.dueDate ?? "9999-12-31";
      const bd = b.bill.dueDate ?? "9999-12-31";
      return ao ? ad.localeCompare(bd) : bd.localeCompare(ad);
    });
}

export interface BillDetail extends BillRow {
  payments: Payment[];
  duplicateOfBill?: { id: string; invoiceNumber: string; status: Bill["status"]; supplierName: string };
  audit: ReturnType<typeof auditFor>;
  /** What the acting user may do now, with the reason when not (for disabling buttons). */
  checks: { submit: RuleResult; approve: RuleResult; cancel: RuleResult };
}

export function getBillDetail(ctx: Ctx, id: string): BillDetail {
  const bill = getBill(ctx, id);
  const row = toRow(ctx, bill);
  const dup = bill.duplicateOf ? ctx.store.bills.find((b) => b.id === bill.duplicateOf) : undefined;
  const actor = getUser(ctx, sessionUserId(ctx));
  const supplier = bill.kind === "supplier" ? findSupplier(ctx, bill.supplierId) : undefined;
  return {
    ...row,
    payments: ctx.store.payments.filter((p) => p.billId === bill.id),
    ...(dup ? { duplicateOfBill: { id: dup.id, invoiceNumber: dup.invoiceNumber, status: dup.status, supplierName: dup.supplierName } } : {}),
    audit: auditFor(ctx, "bill", bill.id),
    checks: {
      submit: tryRule(() => {
        if (bill.runId) throw conflict("in_run", "This bill is in a payment run; submit the run instead");
        if (bill.status !== "draft") throw conflict("not_draft", "Only a draft can be submitted");
        assertSubmittable(ctx, bill, bill.payDate && bill.payDate >= today(ctx) ? bill.payDate : today(ctx), bill.fundingAccountId);
      }),
      approve: bill.runId
        ? { ok: false, code: "in_run", message: "Approve the payment run instead" }
        : canApproveBill(actor, bill, supplier, {
            supplierHasPaid: supplier ? paidToCurrentIban(ctx, supplier) : true,
            makerChecker: ctx.store.company.makerChecker,
          }),
      cancel: canCancel(bill, latestPayment(ctx, bill)),
    },
  };
}

function tryRule(fn: () => void): RuleResult {
  try {
    fn();
    return { ok: true };
  } catch (err) {
    if (err instanceof ServiceError) return { ok: false, code: err.code, message: err.message };
    throw err;
  }
}

export interface BillsSummary {
  today: ISODate;
  /**
   * scheduled = approved payments not yet sent (scheduled or held); available = balance − scheduled (BP-18).
   * pendingApproval = bills submitted for approval from this account, not yet approved (shown separately).
   */
  accounts: (Pick<FundingAccount, "id" | "kind" | "name" | "nameAr" | "balance"> & { scheduled: Halalas; available: Halalas; pendingApproval: Halalas })[];
  totals: { balance: Halalas; scheduled: Halalas; available: Halalas; pendingApproval: Halalas };
  owedBySupplier: {
    key: string;
    kind: Bill["kind"];
    supplierId?: string;
    billerCode?: string;
    name: string;
    nameAr?: string;
    total: Halalas;
    count: number;
    overdueCount: number;
    nextDue?: ISODate;
  }[];
  owedTotal: Halalas;
  counts: Record<DisplayStatus, number>;
}

/** BP-11/BP-18: balances vs scheduled, what is owed per supplier (SADAD included), counts by status. */
export function billsSummary(ctx: Ctx): BillsSummary {
  const day = today(ctx);
  const pending = ctx.store.payments.filter((p) => p.status === "scheduled" || p.status === "held");
  const awaiting = ctx.store.bills.filter((b) => b.status === "awaiting_approval");
  const accounts = ctx.store.accounts.map((a) => {
    const scheduled = pending.filter((p) => p.fundingAccountId === a.id).reduce((s, p) => s + p.amount, 0);
    const pendingApproval = awaiting.filter((b) => b.fundingAccountId === a.id).reduce((s, b) => s + b.total, 0);
    return { id: a.id, kind: a.kind, name: a.name, nameAr: a.nameAr, balance: a.balance, scheduled, available: a.balance - scheduled, pendingApproval };
  });
  const counts = { draft: 0, awaiting_approval: 0, scheduled: 0, paid: 0, failed: 0, cancelled: 0, overdue: 0 } as Record<DisplayStatus, number>;
  const groups = new Map<string, BillsSummary["owedBySupplier"][number]>();
  for (const bill of ctx.store.bills) {
    const status = displayStatus(bill, day);
    counts[status] += 1;
    if (!isOpen(status)) continue;
    const supplier = findSupplier(ctx, bill.supplierId);
    const key = bill.supplierId ?? (bill.sadad ? `sadad:${bill.sadad.billerCode}` : bill.supplierVat ? `vat:${bill.supplierVat}` : `name:${bill.supplierName}`);
    const group = groups.get(key) ?? stripUndefined({
      key,
      kind: bill.kind,
      supplierId: bill.supplierId,
      billerCode: bill.sadad?.billerCode,
      name: supplier?.nameEn ?? bill.sadad?.billerName ?? bill.supplierName,
      nameAr: supplier?.nameAr ?? bill.sadad?.billerNameAr ?? bill.supplierNameAr,
      total: 0,
      count: 0,
      overdueCount: 0,
    } as BillsSummary["owedBySupplier"][number]);
    group.total += bill.total;
    group.count += 1;
    if (status === "overdue") group.overdueCount += 1;
    if (bill.dueDate && (!group.nextDue || bill.dueDate < group.nextDue)) group.nextDue = bill.dueDate;
    groups.set(key, group);
  }
  const owedBySupplier = [...groups.values()].sort((a, b) => b.total - a.total);
  const sum = (k: "balance" | "scheduled" | "available" | "pendingApproval") => accounts.reduce((s, a) => s + a[k], 0);
  return {
    today: day,
    accounts,
    totals: { balance: sum("balance"), scheduled: sum("scheduled"), available: sum("available"), pendingApproval: sum("pendingApproval") },
    owedBySupplier,
    owedTotal: owedBySupplier.reduce((s, g) => s + g.total, 0),
    counts,
  };
}
