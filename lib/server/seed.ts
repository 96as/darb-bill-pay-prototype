// The demo seed, exactly as docs/BUILD-NOTES.md "Seed". Deterministic ids so tests and DEMO.md can name them.
// Supplier B (Cool Breeze) is NOT seeded: it is added in demo step 3 from the e-invoice.
import type { AuditEvent, Bill, BillFieldKey, FieldSource, StoreData } from "@/lib/domain/types";

export const STORE_VERSION = 1;

export const SEED_IDS = {
  company: "c_sahab",
  users: { noura: "u_noura", faisal: "u_faisal", reem: "u_reem" },
  accounts: { main: "main", maintenance: "w_maintenance" },
  supplierA: "s_green_oasis",
  bills: { savedDraft: "b_gol_0917", paidHistory: "b_gol_0822", sadad: "b_sadad_power" },
  payments: { paidHistory: "p_gol_0822" },
  email: "e_october",
} as const;

/** Demo clock: Thu 15 Oct 2026, 16:10 Riyadh. */
export const SEED_NOW = "2026-10-15T13:10:00.000Z";

export const FIXTURE_PDF = "fixtures/invoices/INV-2026-0451-cool-breeze.pdf";
export const FIXTURE_PHOTO = "fixtures/invoices/GOL-2026-1003-photo.jpg";

const IBAN_A = "SA5880000000318204466710";

const manual = (...keys: BillFieldKey[]): Partial<Record<BillFieldKey, FieldSource>> =>
  Object.fromEntries(keys.map((k) => [k, "manual" as const]));

const SUPPLIER_A_FIELDS: BillFieldKey[] = ["supplierName", "supplierNameAr", "supplierVat", "supplierCr", "invoiceNumber", "issueDate", "dueDate", "subtotal", "vat", "total"];

const supplierABill = {
  kind: "supplier",
  source: "manual",
  extraction: "manual",
  supplierId: SEED_IDS.supplierA,
  supplierName: "Green Oasis Landscaping Est.",
  supplierNameAr: "مؤسسة الواحة الخضراء لتنسيق الحدائق",
  supplierVat: "311902476500003",
  supplierCr: "1010847261",
  fieldSources: manual(...SUPPLIER_A_FIELDS),
  needsReview: [],
  fundingAccountId: SEED_IDS.accounts.main,
  createdBy: SEED_IDS.users.noura,
  editedBy: [],
  approvals: [],
} satisfies Partial<Bill>;

function seedAudit(): AuditEvent[] {
  const ev = (n: number, at: string, actorId: string, action: string, type: AuditEvent["entity"]["type"], id: string, after?: unknown): AuditEvent => ({
    id: `ev_seed_${n}`,
    at,
    actorId,
    action,
    entity: { type, id },
    ...(after !== undefined ? { after } : {}),
  });
  return [
    ev(1, "2026-08-20T08:00:00.000Z", "u_noura", "supplier.created", "supplier", SEED_IDS.supplierA, { iban: IBAN_A, nameCheck: "match" }),
    ev(2, "2026-08-26T08:00:00.000Z", "u_noura", "bill.created", "bill", SEED_IDS.bills.paidHistory, { invoiceNumber: "GOL-2026-0822", total: 690_000 }),
    ev(3, "2026-09-21T07:30:00.000Z", "u_noura", "bill.created", "bill", SEED_IDS.bills.savedDraft, { invoiceNumber: "GOL-2026-0917", total: 1_250_000 }),
    ev(4, "2026-09-21T09:00:00.000Z", "u_noura", "bill.submitted", "bill", SEED_IDS.bills.paidHistory, { payDate: "2026-09-22" }),
    ev(5, "2026-09-22T05:55:00.000Z", "u_reem", "bill.approved", "bill", SEED_IDS.bills.paidHistory, { ibanSnapshot: IBAN_A }),
    ev(6, "2026-09-22T06:00:02.000Z", "system", "payment.sent", "payment", SEED_IDS.payments.paidHistory, { transferRef: "DRB-20260922-000101", rail: "instant" }),
    ev(7, "2026-10-06T06:15:00.000Z", "u_noura", "bill.created", "bill", SEED_IDS.bills.sadad, { billerCode: "901", billNumber: "1002387745" }),
    ev(8, "2026-10-06T06:20:00.000Z", "u_noura", "bill.submitted", "bill", SEED_IDS.bills.sadad, { payDate: "2026-10-25" }),
  ];
}

export function createSeed(): StoreData {
  return {
    version: STORE_VERSION,
    clock: { now: SEED_NOW },
    session: { userId: SEED_IDS.users.noura },
    company: {
      id: SEED_IDS.company,
      name: "Sahab Facility Services Co.",
      nameAr: "شركة سحاب للخدمات المرفقية",
      vatNumber: "310458812300003",
      inboxAddress: "bills.sahab-fm@inbox.darbpay.example",
      limits: { perPayment: 10_000_000, daily: 15_000_000 },
      makerChecker: true,
    },
    users: [
      { id: "u_noura", name: "Noura Al-Harbi", nameAr: "نورة الحربي", title: "Finance admin", titleAr: "مسؤولة المالية", role: "preparer", email: "noura@sahab-fm.example" },
      { id: "u_faisal", name: "Faisal Al-Otaibi", nameAr: "فيصل العتيبي", title: "Operations manager", titleAr: "مدير العمليات", role: "approver", email: "faisal@sahab-fm.example" },
      { id: "u_reem", name: "Reem Al-Qahtani", nameAr: "ريم القحطاني", title: "CFO", titleAr: "المديرة المالية", role: "approver", email: "reem@sahab-fm.example" },
    ],
    accounts: [
      { id: SEED_IDS.accounts.main, kind: "main", name: "Main balance", nameAr: "الرصيد الرئيسي", balance: 18_000_000 },
      { id: SEED_IDS.accounts.maintenance, kind: "subwallet", name: "Maintenance projects", nameAr: "مشاريع الصيانة", balance: 4_000_000 },
    ],
    suppliers: [
      {
        id: SEED_IDS.supplierA,
        nameEn: "Green Oasis Landscaping Est.",
        nameAr: "مؤسسة الواحة الخضراء لتنسيق الحدائق",
        vatNumber: "311902476500003",
        crNumber: "1010847261",
        iban: IBAN_A,
        bankName: "Al Rajhi Bank",
        noticeEmail: "accounts@greenoasis.example",
        createdBy: SEED_IDS.users.noura,
        createdAt: "2026-08-20T08:00:00.000Z",
        nameCheck: { result: "match", returnedName: "GREEN OASIS LANDSCAPING EST", checkedAt: "2026-08-20T08:00:05.000Z" },
        screening: { status: "cleared", checkedAt: "2026-08-20T08:00:10.000Z" },
        bankChanges: [],
      },
    ],
    bills: [
      {
        ...supplierABill,
        id: SEED_IDS.bills.savedDraft,
        invoiceNumber: "GOL-2026-0917",
        issueDate: "2026-09-20",
        dueDate: "2026-10-14",
        subtotal: 1_086_957,
        vat: 163_043,
        total: 1_250_000,
        status: "draft",
        createdAt: "2026-09-21T07:30:00.000Z",
      },
      {
        ...supplierABill,
        id: SEED_IDS.bills.paidHistory,
        invoiceNumber: "GOL-2026-0822",
        issueDate: "2026-08-25",
        dueDate: "2026-09-24",
        subtotal: 600_000,
        vat: 90_000,
        total: 690_000,
        status: "paid",
        payDate: "2026-09-22",
        paymentId: SEED_IDS.payments.paidHistory,
        createdAt: "2026-08-26T08:00:00.000Z",
        submittedBy: SEED_IDS.users.noura,
        submittedAt: "2026-09-21T09:00:00.000Z",
        approvals: [{ userId: SEED_IDS.users.reem, at: "2026-09-22T05:55:00.000Z", ibanSnapshot: IBAN_A }],
      },
      {
        id: SEED_IDS.bills.sadad,
        kind: "sadad",
        source: "sadad",
        extraction: "manual",
        supplierName: "National Power Utility (demo biller)",
        supplierNameAr: "شركة الطاقة الوطنية (تجريبي)",
        invoiceNumber: "1002387745",
        issueDate: "2026-10-05",
        dueDate: "2026-10-25",
        total: 324_055,
        fieldSources: manual("supplierName", "supplierNameAr", "invoiceNumber", "issueDate", "dueDate", "total"),
        needsReview: [],
        sadad: {
          billerName: "National Power Utility (demo biller)",
          billerNameAr: "شركة الطاقة الوطنية (تجريبي)",
          billerCode: "901",
          billNumber: "1002387745",
        },
        status: "awaiting_approval",
        payDate: "2026-10-25",
        fundingAccountId: SEED_IDS.accounts.main,
        createdBy: SEED_IDS.users.noura,
        createdAt: "2026-10-06T06:15:00.000Z",
        editedBy: [],
        submittedBy: SEED_IDS.users.noura,
        submittedAt: "2026-10-06T06:20:00.000Z",
        approvals: [],
      },
    ],
    runs: [],
    payments: [
      {
        id: SEED_IDS.payments.paidHistory,
        billId: SEED_IDS.bills.paidHistory,
        supplierId: SEED_IDS.supplierA,
        requestKey: `pay_${SEED_IDS.bills.paidHistory}`,
        amount: 690_000,
        fundingAccountId: SEED_IDS.accounts.main,
        rail: "instant",
        scheduledFor: "2026-09-22T06:00:00.000Z",
        expectedArrival: "2026-09-22",
        iban: IBAN_A,
        status: "settled",
        transferRef: "DRB-20260922-000101",
        sentAt: "2026-09-22T06:00:02.000Z",
        settledAt: "2026-09-22T06:00:02.000Z",
        attempts: 1,
      },
    ],
    notices: [],
    accounting: [
      {
        id: "acc_seed_payable_0822",
        kind: "payable",
        billId: SEED_IDS.bills.paidHistory,
        system: "Accounting system (mock)",
        supplierName: "Green Oasis Landscaping Est.",
        invoiceNumber: "GOL-2026-0822",
        vat: 90_000,
        total: 690_000,
        status: "paid",
        createdAt: "2026-09-22T05:55:00.000Z",
        lines: [
          { account: "Expenses", debit: 600_000, credit: 0 },
          { account: "VAT input 15%", debit: 90_000, credit: 0 },
          { account: "Accounts payable", debit: 0, credit: 690_000 },
        ],
      },
      {
        id: "acc_seed_payment_0822",
        kind: "payment",
        billId: SEED_IDS.bills.paidHistory,
        paymentId: SEED_IDS.payments.paidHistory,
        system: "Accounting system (mock)",
        supplierName: "Green Oasis Landscaping Est.",
        invoiceNumber: "GOL-2026-0822",
        vat: 90_000,
        total: 690_000,
        status: "synced",
        createdAt: "2026-09-22T06:00:02.000Z",
        lines: [
          { account: "Accounts payable", debit: 690_000, credit: 0 },
          { account: "Darb balance", debit: 0, credit: 690_000 },
        ],
      },
    ],
    alerts: [
      { id: "al_seed_1", at: "2026-10-06T06:20:00.000Z", to: "u_faisal", kind: "approval_needed", message: "National Power Utility (demo biller) bill 1002387745 (3,240.55 SAR) is waiting for your approval.", messageAr: "فاتورة شركة الطاقة الوطنية (تجريبي) رقم 1002387745 (3,240.55 ر.س) بانتظار موافقتك.", read: false },
      { id: "al_seed_2", at: "2026-10-06T06:20:00.000Z", to: "u_reem", kind: "approval_needed", message: "National Power Utility (demo biller) bill 1002387745 (3,240.55 SAR) is waiting for your approval.", messageAr: "فاتورة شركة الطاقة الوطنية (تجريبي) رقم 1002387745 (3,240.55 ر.س) بانتظار موافقتك.", read: false },
    ],
    audit: seedAudit(),
    emails: [
      {
        id: SEED_IDS.email,
        from: "ops@sahab-fm.example",
        to: "bills.sahab-fm@inbox.darbpay.example",
        subject: "Fwd: Invoices for October (HVAC + landscaping)",
        receivedAt: "2026-10-15T13:02:00.000Z",
        attachments: [
          { filename: "INV-2026-0451-cool-breeze.pdf", mime: "application/pdf", path: FIXTURE_PDF },
          { filename: "GOL-2026-1003-photo.jpg", mime: "image/jpeg", path: FIXTURE_PHOTO },
        ],
        billIds: [],
      },
    ],
    files: [],
    railLedger: [{ requestKey: `pay_${SEED_IDS.bills.paidHistory}`, transferRef: "DRB-20260922-000101", at: "2026-09-22T06:00:02.000Z", status: "settled", amount: 690_000 }],
  };
}
