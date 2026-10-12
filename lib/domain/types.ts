// Shared domain contract for Darb Bill Pay (prototype).
// Every layer (rules, services, API, UI) imports from here. Change with care.

/** Integer amount in halalas (1 SAR = 100 halalas). Never use floats for money. */
export type Halalas = number;
/** UTC instant as ISO string, e.g. "2026-10-15T13:10:00.000Z". */
export type ISODateTime = string;
/** Calendar date in Asia/Riyadh, "YYYY-MM-DD". */
export type ISODate = string;

// ---------- People ----------

/** preparer = prepare only (create, edit, submit; cannot approve or pay). approver = can approve and release. */
export type Role = "preparer" | "approver";

export interface User {
  id: string;
  name: string;
  nameAr: string;
  title: string;
  titleAr: string;
  role: Role;
  email: string;
}

// ---------- Money accounts and limits (BP-18) ----------

export interface FundingAccount {
  id: string; // "main" or a subwallet id
  kind: "main" | "subwallet";
  name: string;
  nameAr: string;
  balance: Halalas;
}

export interface Limits {
  perPayment: Halalas;
  daily: Halalas;
}

export interface Company {
  id: string;
  name: string;
  nameAr: string;
  vatNumber: string;
  inboxAddress: string;
  limits: Limits;
  /** Maker-checker is on by default with 2+ approvers (PRD 3). */
  makerChecker: boolean;
}

// ---------- Suppliers (PL-02, BP-05..07) ----------

export type NameCheckResult = "match" | "close_match" | "no_match";

export interface NameCheck {
  result: NameCheckResult;
  /** Account holder name returned by the (mock) bank lookup. */
  returnedName: string;
  checkedAt: ISODateTime;
  /** For close_match: who confirmed it and when. Must be an approver. */
  confirmedBy?: string;
  confirmedAt?: ISODateTime;
}

export type ScreeningStatus = "pending" | "cleared" | "blocked";

export interface BankChangeRequest {
  id: string;
  oldIban: string;
  newIban: string;
  newBankName: string;
  requestedBy: string;
  requestedAt: ISODateTime;
  nameCheck: NameCheck;
  status: "pending" | "approved" | "rejected";
  decidedBy?: string;
  decidedAt?: ISODateTime;
}

export interface Supplier {
  id: string;
  nameEn: string;
  nameAr: string;
  vatNumber: string;
  crNumber: string;
  iban: string;
  bankName: string;
  noticeEmail?: string;
  noticeMobile?: string;
  createdBy: string;
  createdAt: ISODateTime;
  /** Fields prefilled from an e-invoice when the supplier was added. */
  prefilledFromEInvoice?: boolean;
  nameCheck: NameCheck;
  screening: { status: ScreeningStatus; checkedAt: ISODateTime };
  /** Open IBAN change; while present, payments to this supplier are paused (BP-07). */
  pendingBankChange?: BankChangeRequest;
  bankChanges: BankChangeRequest[];
}

// ---------- Bills (PL-01, PL-03, BP-01..04, BP-11, BP-12) ----------

export type BillStatus =
  | "draft"
  | "awaiting_approval"
  | "scheduled"
  | "paid"
  | "failed"
  | "cancelled"
  /** A flagged duplicate the preparer threw away ("Discard this copy"); hidden from the default bills list. */
  | "discarded";

/** Status shown in the UI: Overdue replaces draft/awaiting/scheduled/failed when unpaid past due. */
export type DisplayStatus = BillStatus | "overdue";

export type FieldSource = "xml" | "ocr" | "manual";

export type BillFieldKey =
  | "supplierName"
  | "supplierNameAr"
  | "supplierVat"
  | "supplierCr"
  | "invoiceNumber"
  | "invoiceUuid"
  | "issueDate"
  | "dueDate"
  | "subtotal"
  | "vat"
  | "total";

/** What the invoice reader returns (from ZATCA XML, OCR, or typed by hand). */
export interface ExtractedInvoice {
  supplierName?: string;
  supplierNameAr?: string;
  supplierVat?: string;
  supplierCr?: string;
  supplierIban?: string;
  /** Supplier contact email from the e-invoice (Party/Contact/ElectronicMail); prefills the notice email. */
  supplierEmail?: string;
  supplierAddress?: string;
  buyerName?: string;
  buyerVat?: string;
  invoiceNumber?: string;
  invoiceUuid?: string;
  issueDate?: ISODate;
  dueDate?: ISODate;
  subtotal?: Halalas;
  vat?: Halalas;
  total?: Halalas;
  currency?: string;
  /** Language(s) detected in the invoice text. */
  language?: "ar" | "en" | "bilingual";
  /** Per-field origin. */
  sources: Partial<Record<BillFieldKey, FieldSource>>;
  /** Fields a person must check before submitting (OCR, low confidence, or inconsistent). */
  needsReview: BillFieldKey[];
  warnings: string[];
}

export interface StoredFile {
  id: string;
  name: string;
  mime: "application/pdf" | "image/jpeg" | "image/png" | "application/xml";
  size: number;
  sha256: string;
  /** Path relative to the project root, e.g. "data/files/f_123.pdf" or "fixtures/invoices/x.pdf". */
  path: string;
}

export interface Approval {
  userId: string;
  at: ISODateTime;
  /** Set when approved as part of a run. */
  runId?: string;
  /** IBAN the approval was given for; a later IBAN change invalidates it. */
  ibanSnapshot?: string;
}

/** An approver sent a bill or run back to draft. */
export interface Rejection {
  by: string;
  at: ISODateTime;
  reason?: string;
}

export interface Bill {
  id: string;
  kind: "supplier" | "sadad";
  source: "email" | "upload" | "manual" | "sadad" | "seed";
  /** How fields were read: "e_invoice" = ZATCA XML; "ocr"; "manual". */
  extraction: "e_invoice" | "ocr" | "manual";
  emailId?: string;
  /** Sender of the forwarded email (BP-02). */
  senderEmail?: string;
  file?: StoredFile;

  supplierId?: string;
  supplierName: string;
  supplierNameAr?: string;
  supplierVat?: string;
  supplierCr?: string;
  invoiceNumber: string;
  invoiceUuid?: string;
  issueDate?: ISODate;
  dueDate?: ISODate;
  subtotal?: Halalas;
  vat?: Halalas;
  total: Halalas;
  fieldSources: Partial<Record<BillFieldKey, FieldSource>>;
  needsReview: BillFieldKey[];
  /** Suggested supplier details from the e-invoice (used to prefill "Add supplier"). */
  suggestedSupplier?: Pick<ExtractedInvoice, "supplierName" | "supplierNameAr" | "supplierVat" | "supplierCr" | "supplierIban" | "supplierEmail" | "supplierAddress">;

  sadad?: { billerName: string; billerNameAr: string; billerCode: string; billNumber: string };

  status: BillStatus;
  /** Reader warnings shown with the draft (e.g. "IBAN on the invoice differs from the saved IBAN"). */
  warnings?: string[];
  /** Set when an approver sends the bill back to draft. */
  rejection?: Rejection;
  duplicateOf?: string;
  duplicateReason?: "invoice_uuid" | "supplier_invoice_number";

  payDate?: ISODate;
  runId?: string;
  fundingAccountId: string;
  paymentId?: string;

  createdBy: string;
  createdAt: ISODateTime;
  /** Everyone who edited amount, supplier, date or fields; makers cannot approve alone. */
  editedBy: string[];
  submittedBy?: string;
  submittedAt?: ISODateTime;
  approvals: Approval[];
  cancelledBy?: string;
  cancelledAt?: ISODateTime;
  discardedBy?: string;
  discardedAt?: ISODateTime;
}

// ---------- Rails and payments (PL-04, BP-09, BP-10) ----------

/** instant = instant payments (sarie), 24/7, up to SAR 20,000. sarie = SARIE large-value, Sun-Thu 9:00-15:58. */
export type Rail = "instant" | "sarie" | "sadad";

export interface RailQuote {
  rail: Rail;
  /** When the payment actually leaves (may be later than requested, e.g. after the SARIE cut-off). */
  sendAt: ISODateTime;
  /** Expected arrival date, Asia/Riyadh. */
  arrivalDate: ISODate;
  sameDay: boolean;
  /** Machine-readable reason, e.g. "instant_24_7", "sarie_in_window", "sarie_after_cutoff", "sarie_weekend", "sarie_before_open". */
  reason: string;
}

export type PaymentStatus =
  | "scheduled" // approved, waiting for its send time
  | "held" // paused: IBAN change, short balance retry, limit
  | "sent"
  | "settled"
  | "failed"
  | "returned"
  | "cancelled";

export interface Payment {
  id: string;
  billId: string;
  runId?: string;
  supplierId?: string;
  /** Unique per payment; the rail ignores a repeated key, so a retry never sends twice. */
  requestKey: string;
  amount: Halalas;
  fundingAccountId: string;
  rail: Rail;
  scheduledFor: ISODateTime;
  expectedArrival: ISODate;
  /** Quote given at approval (shown on the run and approval screens, promise C); later holds and sending never change it. */
  quote?: RailQuote;
  /** Quote at the moment it was sent (railAndArrival at sentAt); expectedArrival and the supplier notice follow it. */
  sentQuote?: RailQuote;
  iban?: string;
  status: PaymentStatus;
  holdReason?: "iban_change" | "short_balance" | "daily_limit" | "supplier_check";
  transferRef?: string;
  sentAt?: ISODateTime;
  settledAt?: ISODateTime;
  failureReason?: string;
  attempts: number;
}

export type RunStatus = "draft" | "awaiting_approval" | "approved" | "completed" | "cancelled";

export interface PaymentRun {
  id: string;
  name: string;
  payDate: ISODate;
  billIds: string[];
  status: RunStatus;
  createdBy: string;
  createdAt: ISODateTime;
  editedBy: string[];
  submittedBy?: string;
  submittedAt?: ISODateTime;
  approvals: Approval[];
  rejection?: Rejection;
}

// ---------- Side effects (mocked) ----------

export interface SupplierNotice {
  id: string;
  paymentId: string;
  billId: string;
  supplierId?: string;
  channel: "email" | "sms";
  to: string;
  subjectEn: string;
  bodyEn: string;
  subjectAr: string;
  bodyAr: string;
  sentAt: ISODateTime;
}

export interface AccountingEntry {
  id: string;
  kind: "payment" | "payable";
  billId: string;
  paymentId?: string;
  system: string;
  supplierName: string;
  invoiceNumber: string;
  vat?: Halalas;
  total: Halalas;
  attachmentName?: string;
  status: "synced" | "paid";
  createdAt: ISODateTime;
  /** Mock journal lines shown in the UI. */
  lines: { account: string; debit: Halalas; credit: Halalas }[];
}

export interface Alert {
  id: string;
  at: ISODateTime;
  /** Recipient user id (the finance admin for money alerts). */
  to: string;
  kind: "short_balance" | "payment_failed" | "payment_returned" | "due_soon" | "iban_change" | "approval_needed";
  message: string;
  messageAr: string;
  read: boolean;
}

export interface AuditEvent {
  id: string;
  at: ISODateTime;
  actorId: string; // user id or "system"
  action: string; // e.g. "bill.created", "supplier.bank_change_requested"
  entity: { type: "bill" | "supplier" | "run" | "payment" | "company" | "email"; id: string };
  before?: unknown;
  after?: unknown;
}

export interface InboundEmail {
  id: string;
  from: string;
  to: string;
  subject: string;
  receivedAt: ISODateTime;
  attachments: { filename: string; mime: StoredFile["mime"]; path: string }[];
  processedAt?: ISODateTime;
  billIds: string[];
}

// ---------- Whole demo state ----------

export interface StoreData {
  version: number;
  clock: { now: ISODateTime };
  session: { userId: string };
  company: Company;
  users: User[];
  accounts: FundingAccount[];
  suppliers: Supplier[];
  bills: Bill[];
  runs: PaymentRun[];
  payments: Payment[];
  notices: SupplierNotice[];
  accounting: AccountingEntry[];
  alerts: Alert[];
  audit: AuditEvent[];
  emails: InboundEmail[];
  files: StoredFile[];
  /** Request keys the mock rail has accepted (idempotency). */
  railLedger: {
    requestKey: string;
    transferRef: string;
    at: ISODateTime;
    /** Outcome the mock rail gave the first time; a repeated key gets the same answer. */
    status?: "settled" | "returned";
    amount?: Halalas;
  }[];
}
