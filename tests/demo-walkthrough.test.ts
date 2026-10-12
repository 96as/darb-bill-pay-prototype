// The two-minute demo (PRD section 8), walked through the real API route handlers against an isolated store
// in a temp directory (DARB_DATA_DIR). Each step asserts what the product lead sees on screen.
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AccountingEntry, AuditEvent, InboundEmail, Supplier, SupplierNotice } from "@/lib/domain/types";
import type { BillDetail, BillQuote, BillRow, BillsSummary, DemoState, IngestResult, ProcessResult, RunView, SchedulerReport, SupplierChecks } from "@/lib/server/services";

import * as demoReset from "@/app/api/demo/reset/route";
import * as demoState from "@/app/api/demo/state/route";
import * as demoUser from "@/app/api/demo/user/route";
import * as demoClock from "@/app/api/demo/clock/route";
import * as inbox from "@/app/api/inbox/route";
import * as inboxProcess from "@/app/api/inbox/[emailId]/process/route";
import * as bills from "@/app/api/bills/route";
import * as bill from "@/app/api/bills/[id]/route";
import * as billSubmit from "@/app/api/bills/[id]/submit/route";
import * as billCancel from "@/app/api/bills/[id]/cancel/route";
import * as files from "@/app/api/files/[id]/route";
import * as payees from "@/app/api/payees/route";
import * as payee from "@/app/api/payees/[id]/route";
import * as bankAccount from "@/app/api/payees/[id]/bank-account/route";
import * as bankApprove from "@/app/api/payees/[id]/bank-account/approve/route";
import * as nameCheckConfirm from "@/app/api/payees/[id]/name-check/confirm/route";
import * as audit from "@/app/api/audit/route";
import * as alerts from "@/app/api/alerts/route";
import * as runQuote from "@/app/api/payment-runs/quote/route";
import * as runs from "@/app/api/payment-runs/route";
import * as run from "@/app/api/payment-runs/[id]/route";
import * as runSubmit from "@/app/api/payment-runs/[id]/submit/route";
import * as runApprove from "@/app/api/payment-runs/[id]/approve/route";
import * as summary from "@/app/api/summary/route";
import * as notices from "@/app/api/notices/route";
import * as accounting from "@/app/api/accounting/route";
import * as confirmation from "@/app/api/payments/[billId]/confirmation/route";

// ---------- Calling route handlers the way Next 15 does ----------

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
type ApiError = { error: { code: string; message: string } };

interface CallOpts {
  json?: unknown;
  form?: FormData;
  params?: Record<string, string>;
}

async function call<T>(handler: unknown, method: string, url: string, opts: CallOpts = {}): Promise<{ status: number; body: T; res: Response }> {
  const init: RequestInit = { method };
  if (opts.json !== undefined) {
    init.body = JSON.stringify(opts.json);
    init.headers = { "content-type": "application/json" };
  } else if (opts.form) {
    init.body = opts.form;
  }
  const res = await (handler as Handler)(new Request(`http://localhost${url}`, init), { params: Promise.resolve(opts.params ?? {}) });
  const type = res.headers.get("content-type") ?? "";
  const body = (type.includes("application/json") ? await res.clone().json() : await res.clone().text()) as T;
  return { status: res.status, body, res };
}

const actAs = (userId: string) => call<DemoState>(demoUser.POST, "POST", "/api/demo/user", { json: { userId } });

const PDF_PATH = path.join(process.cwd(), "fixtures/invoices/INV-2026-0451-cool-breeze.pdf");
const IBAN_B = "SA6710000000020315550044";
const IBAN_B_NEW = "SA2045000000001234567001";
const NO_IBAN = /SA\d{2}\s?\d{4}|\d{4}\s?\d{4}\s?\d{4}|IBAN|آيبان|Saudi National Bank|\bSAB\b|البنك/;

let dataDir: string;
let stepFourQuotes: BillQuote[] = [];

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(os.tmpdir(), "darb-demo-"));
  process.env.DARB_DATA_DIR = dataDir;
  const { status, body } = await call<DemoState>(demoReset.POST, "POST", "/api/demo/reset");
  expect(status).toBe(200);
  expect(body).toMatchObject({ now: "2026-10-15T13:10:00.000Z", session: { userId: "u_noura" } });
  expect(existsSync(path.join(dataDir, "store.json"))).toBe(true);
});

afterAll(() => {
  delete process.env.DARB_DATA_DIR;
  rmSync(dataDir, { recursive: true, force: true });
});

// ---------- Step 1 ----------

describe("Step 1 — forward two invoices to the bills inbox (BP-01, BP-02, BP-03)", () => {
  it("BP-02: the inbox shows the seeded email, unprocessed, with two attachments", async () => {
    const { status, body } = await call<{ address: string; emails: { email: InboundEmail }[] }>(inbox.GET, "GET", "/api/inbox");
    expect(status).toBe(200);
    expect(body.address).toBe("bills.sahab-fm@inbox.darbpay.example");
    const email = body.emails.find((e) => e.email.id === "e_october")!.email;
    expect(email.processedAt).toBeUndefined();
    expect(email.billIds).toEqual([]);
    expect(email.attachments.map((a) => a.filename)).toEqual(["INV-2026-0451-cool-breeze.pdf", "GOL-2026-1003-photo.jpg"]);
  });

  it("BP-01/BP-02: processing turns each attachment into its own draft bill with the file attached and the sender saved", async () => {
    const { status, body } = await call<ProcessResult>(inboxProcess.POST, "POST", "/api/inbox/e_october/process", { params: { emailId: "e_october" } });
    expect(status).toBe(200);
    expect(body.errors).toEqual([]);
    expect(body.bills.map((b) => [b.id, b.status, b.source, b.senderEmail])).toEqual([
      ["b_1", "draft", "email", "ops@sahab-fm.example"],
      ["b_2", "draft", "email", "ops@sahab-fm.example"],
    ]);
    for (const b of body.bills) {
      const file = await call<string>(files.GET, "GET", `/api/files/${b.file!.id}`, { params: { id: b.file!.id } });
      expect(file.status).toBe(200);
      expect(file.res.headers.get("content-type")).toBe(b.file!.mime);
    }
  });

  it("BP-03: the PDF/A-3 becomes a draft 'from e-invoice' — supplier, VAT number, invoice number, date, VAT and total from the XML", async () => {
    const { body } = await call<BillDetail>(bill.GET, "GET", "/api/bills/b_1", { params: { id: "b_1" } });
    expect(body.bill).toMatchObject({
      extraction: "e_invoice",
      supplierName: "Cool Breeze HVAC Contracting Co.",
      supplierVat: "310387452600003",
      invoiceNumber: "INV-2026-0451",
      issueDate: "2026-10-13",
      vat: 586_957,
      total: 4_500_000,
      needsReview: [],
      file: { name: "INV-2026-0451-cool-breeze.pdf", mime: "application/pdf" },
    });
    for (const field of ["supplierName", "supplierVat", "invoiceNumber", "issueDate", "vat", "total"] as const) {
      expect(body.bill.fieldSources[field], field).toBe("xml");
    }
    expect(body.bill.supplierId).toBeUndefined(); // Cool Breeze is not a saved supplier yet
    expect(body.bill.suggestedSupplier?.supplierIban).toBe(IBAN_B);
  });

  it("BP-03: the phone photo is read by (mock) OCR, asks to check its low-confidence fields, and is matched to Green Oasis by VAT number", async () => {
    const { body } = await call<BillDetail>(bill.GET, "GET", "/api/bills/b_2", { params: { id: "b_2" } });
    expect(body.bill).toMatchObject({ extraction: "ocr", supplierId: "s_green_oasis", supplierVat: "311902476500003", invoiceNumber: "GOL-2026-1003", total: 805_000 });
    expect(body.bill.needsReview).toEqual(expect.arrayContaining(["invoiceNumber", "dueDate", "vat"]));
    expect(Object.values(body.bill.fieldSources).every((s) => s === "ocr")).toBe(true);
    expect(body.checks.submit).toMatchObject({ ok: false, code: "needs_review" });
  });
});

// ---------- Step 2 ----------

describe("Step 2 — upload the first invoice again (BP-04)", () => {
  it("BP-04: the same PDF uploaded again is flagged as a duplicate of b_1 by its invoice UUID", async () => {
    const form = new FormData();
    form.append("file", new File([readFileSync(PDF_PATH)], "INV-2026-0451-cool-breeze.pdf", { type: "application/pdf" }));
    const { status, body } = await call<IngestResult>(bills.POST, "POST", "/api/bills", { form });
    expect(status).toBe(201);
    expect(body.duplicate).toEqual({ billId: "b_1", reason: "invoice_uuid" });
    expect(body.bill).toMatchObject({ id: "b_3", status: "draft", source: "upload", duplicateOf: "b_1", duplicateReason: "invoice_uuid" });
    expect(existsSync(path.join(dataDir, "files", `${body.bill.file!.id}.pdf`))).toBe(true); // stored in the isolated data dir
  });

  it("BP-04: submitting the duplicate is refused; it is cancelled instead", async () => {
    const submit = await call<ApiError>(billSubmit.POST, "POST", "/api/bills/b_3/submit", { params: { id: "b_3" }, json: { payDate: "2026-10-15" } });
    expect(submit.status).toBe(409);
    expect(submit.body.error.code).toBe("duplicate_unresolved");
    const cancel = await call<{ bill: { status: string; cancelledBy: string } }>(billCancel.POST, "POST", "/api/bills/b_3/cancel", { params: { id: "b_3" } });
    expect(cancel.status).toBe(200);
    expect(cancel.body.bill).toMatchObject({ status: "cancelled", cancelledBy: "u_noura" });
  });
});

// ---------- Step 3 ----------

describe("Step 3 — add the supplier, then change its IBAN (BP-05, BP-06, BP-07)", () => {
  it("BP-05/BP-06: adding Cool Breeze from the e-invoice passes the name check and screening, and links b_1 by VAT number", async () => {
    const { body: b1 } = await call<BillDetail>(bill.GET, "GET", "/api/bills/b_1", { params: { id: "b_1" } });
    const s = b1.bill.suggestedSupplier!;
    expect(s.supplierEmail).toBe("finance@coolbreeze-hvac.example");
    const { status, body } = await call<{ supplier: Supplier }>(payees.POST, "POST", "/api/payees", {
      json: {
        nameEn: s.supplierName,
        nameAr: s.supplierNameAr,
        vatNumber: s.supplierVat,
        crNumber: s.supplierCr,
        iban: s.supplierIban,
        noticeEmail: s.supplierEmail, // prefilled from the e-invoice's supplier contact
        fromBillId: "b_1",
      },
    });
    expect(status).toBe(201);
    expect(body.supplier).toMatchObject({
      id: "s_1",
      iban: IBAN_B,
      bankName: "Saudi National Bank",
      prefilledFromEInvoice: true,
      createdBy: "u_noura",
      nameCheck: { result: "match" },
      screening: { status: "cleared" },
    });
    const { body: linked } = await call<BillDetail>(bill.GET, "GET", "/api/bills/b_1", { params: { id: "b_1" } });
    expect(linked.bill.supplierId).toBe("s_1");
  });

  it("BP-05: an IBAN failing its checksum is refused (422)", async () => {
    const { status, body } = await call<ApiError>(payees.POST, "POST", "/api/payees", {
      json: { nameEn: "Typo Trading Est.", vatNumber: "310999999900003", iban: "SA6710000000020315550045", noticeEmail: "ap@typo.example" },
    });
    expect(status).toBe(422);
    expect(body.error.code).toBe("invalid_iban");
  });

  it("BP-07: changing the IBAN pauses payments to the supplier and alerts the approvers", async () => {
    const { status, body } = await call<{ supplier: Supplier }>(bankAccount.PATCH, "PATCH", "/api/payees/s_1/bank-account", {
      params: { id: "s_1" },
      json: { iban: IBAN_B_NEW },
    });
    expect(status).toBe(200);
    expect(body.supplier.iban).toBe(IBAN_B); // unchanged until a second person approves
    expect(body.supplier.pendingBankChange).toMatchObject({ newIban: IBAN_B_NEW, newBankName: "SAB", requestedBy: "u_noura", status: "pending", nameCheck: { result: "match" } });
    await actAs("u_reem");
    const { body: reemAlerts } = await call<{ alerts: { kind: string }[] }>(alerts.GET, "GET", "/api/alerts?unread=1");
    expect(reemAlerts.alerts.map((a) => a.kind)).toContain("iban_change");
    await actAs("u_noura");
  });

  it("BP-07: the person who asked cannot approve the change", async () => {
    const { status, body } = await call<ApiError>(bankApprove.POST, "POST", "/api/payees/s_1/bank-account/approve", { params: { id: "s_1" } });
    expect(status).toBe(403);
    expect(body.error.code).toBe("not_approver");
  });

  it("BP-07: a second user (Reem) approves; the IBAN changes and both users and times are logged", async () => {
    await actAs("u_reem");
    const { status, body } = await call<{ supplier: Supplier }>(bankApprove.POST, "POST", "/api/payees/s_1/bank-account/approve", { params: { id: "s_1" } });
    expect(status).toBe(200);
    expect(body.supplier).toMatchObject({ iban: IBAN_B_NEW, bankName: "SAB" });
    expect(body.supplier.pendingBankChange).toBeUndefined();
    expect(body.supplier.bankChanges[0]).toMatchObject({ requestedBy: "u_noura", decidedBy: "u_reem", status: "approved" });

    const { body: log } = await call<{ events: AuditEvent[] }>(audit.GET, "GET", "/api/audit?type=supplier&id=s_1");
    const requested = log.events.find((e) => e.action === "supplier.bank_change_requested")!;
    const approved = log.events.find((e) => e.action === "supplier.bank_change_approved")!;
    expect(requested).toMatchObject({ actorId: "u_noura", before: { iban: IBAN_B }, after: { iban: IBAN_B_NEW } });
    expect(approved).toMatchObject({ actorId: "u_reem", before: { iban: IBAN_B }, after: { iban: IBAN_B_NEW, requestedBy: "u_noura", approvedBy: "u_reem" } });
    expect(requested.at).toBe("2026-10-15T13:10:00.000Z");
    expect((approved.after as { requestedAt: string; approvedAt: string }).approvedAt).toBe("2026-10-15T13:10:00.000Z");

    const { body: detail } = await call<{ supplier: Supplier; audit: AuditEvent[] }>(payee.GET, "GET", "/api/payees/s_1", { params: { id: "s_1" } });
    expect(detail.audit.map((e) => e.action)).toEqual(expect.arrayContaining(["supplier.created", "supplier.bank_change_requested", "supplier.bank_change_approved"]));
    await actAs("u_noura");
  });
});

describe("Step 3 (extra) — an IBAN the bank only half-recognises can still be decided (BP-06, BP-07)", () => {
  const IBAN_UNKNOWN = "SA3380000000000098765432"; // valid checksum, unknown to the mock bank → close match
  const checksFor = async () => {
    const { body } = await call<{ checks: SupplierChecks }>(payee.GET, "GET", "/api/payees/s_green_oasis", { params: { id: "s_green_oasis" } });
    return Object.fromEntries(Object.entries(body.checks).map(([k, v]) => [k, v.ok ? "ok" : v.code]));
  };

  it("BP-06/BP-07: Faisal confirms the close match, Reem approves; the requester could only withdraw", async () => {
    const req = await call<{ supplier: Supplier }>(bankAccount.PATCH, "PATCH", "/api/payees/s_green_oasis/bank-account", {
      params: { id: "s_green_oasis" },
      json: { iban: IBAN_UNKNOWN },
    });
    expect(req.status).toBe(200);
    expect(req.body.supplier.pendingBankChange).toMatchObject({ newIban: IBAN_UNKNOWN, nameCheck: { result: "close_match" } });
    expect(await checksFor()).toEqual({ approveChange: "not_approver", rejectChange: "not_approver", withdrawChange: "ok", confirmMatch: "not_approver" });

    await actAs("u_faisal");
    expect(await checksFor()).toEqual({ approveChange: "name_check_unconfirmed", rejectChange: "ok", withdrawChange: "not_requester", confirmMatch: "ok" });
    const confirm = await call<{ supplier: Supplier }>(nameCheckConfirm.POST, "POST", "/api/payees/s_green_oasis/name-check/confirm", { params: { id: "s_green_oasis" } });
    expect(confirm.status).toBe(200);
    expect(confirm.body.supplier.pendingBankChange?.nameCheck).toMatchObject({ result: "close_match", confirmedBy: "u_faisal" });
    expect((await checksFor()).approveChange).toBe("ok");

    await actAs("u_reem");
    const approve = await call<{ supplier: Supplier }>(bankApprove.POST, "POST", "/api/payees/s_green_oasis/bank-account/approve", { params: { id: "s_green_oasis" } });
    expect(approve.status).toBe(200);
    expect(approve.body.supplier).toMatchObject({ iban: IBAN_UNKNOWN, bankName: "Al Rajhi Bank" });
    expect(approve.body.supplier.pendingBankChange).toBeUndefined();

    const { body: log } = await call<{ events: AuditEvent[] }>(audit.GET, "GET", "/api/audit?type=supplier&id=s_green_oasis");
    expect(log.events.map((e) => [e.action, e.actorId])).toEqual(
      expect.arrayContaining([
        ["supplier.bank_change_requested", "u_noura"],
        ["supplier.name_check_confirmed", "u_faisal"],
        ["supplier.bank_change_approved", "u_reem"],
      ]),
    );
    await actAs("u_noura");
  });
});

// ---------- Step 4 ----------

describe("Step 4 — put three bills in a dated run (BP-09, BP-10, BP-18)", () => {
  it("the preparer checks the photo's flagged fields", async () => {
    const { status, body } = await call<BillDetail>(bill.PATCH, "PATCH", "/api/bills/b_2", { params: { id: "b_2" }, json: { reviewed: ["invoiceNumber", "dueDate", "vat"] } });
    expect(status).toBe(200);
    expect(body.bill.needsReview).toEqual([]);
    expect(body.checks.submit).toEqual({ ok: true });
  });

  it("BP-09: before submitting, the app shows rail and arrival — SAR 45,000 on Thursday 16:10 arrives Sunday 18 October", async () => {
    const { status, body } = await call<{ quotes: BillQuote[] }>(runQuote.POST, "POST", "/api/payment-runs/quote", {
      json: { billIds: ["b_1", "b_2", "b_gol_0917"], payDate: "2026-10-15" },
    });
    expect(status).toBe(200);
    const byBill = Object.fromEntries(body.quotes.map((q) => [q.billId, q]));
    expect(byBill.b_1).toMatchObject({ amount: 4_500_000, rail: "sarie", arrivalDate: "2026-10-18", sameDay: false, reason: "sarie_after_cutoff" });
    expect(byBill.b_2).toMatchObject({ amount: 805_000, rail: "instant", arrivalDate: "2026-10-15" });
    expect(byBill.b_gol_0917).toMatchObject({ amount: 1_250_000, rail: "instant", arrivalDate: "2026-10-15" });
    stepFourQuotes = body.quotes;
  });

  it("BP-10/BP-18: the run groups the bills under one pay date, with the photo bill paid from the maintenance subwallet", async () => {
    const { status, body } = await call<{ run: RunView["run"]; quotes: BillQuote[] }>(runs.POST, "POST", "/api/payment-runs", {
      json: { name: "October suppliers", payDate: "2026-10-15", billIds: ["b_1", "b_2", "b_gol_0917"], funding: { b_2: "w_maintenance" } },
    });
    expect(status).toBe(201);
    expect(body.run).toMatchObject({ id: "run_1", status: "draft", payDate: "2026-10-15", createdBy: "u_noura" });
    expect(body.quotes.find((q) => q.billId === "b_2")?.fundingAccountId).toBe("w_maintenance");
    expect(body.quotes.find((q) => q.billId === "b_1")).toMatchObject({ rail: "sarie", arrivalDate: "2026-10-18" });

    const submitted = await call<RunView>(runSubmit.POST, "POST", "/api/payment-runs/run_1/submit", { params: { id: "run_1" } });
    expect(submitted.status).toBe(200);
    expect(submitted.body.run.status).toBe("awaiting_approval");
    expect(submitted.body.items.every((i) => i.bill.status === "awaiting_approval")).toBe(true);
  });

  it("BP-18: the summary shows scheduled vs available balance per account, with what awaits approval", async () => {
    const { body } = await call<BillsSummary>(summary.GET, "GET", "/api/summary");
    const main = body.accounts.find((a) => a.id === "main")!;
    const sub = body.accounts.find((a) => a.id === "w_maintenance")!;
    expect(main).toMatchObject({ balance: 18_000_000, scheduled: 0, available: 18_000_000, pendingApproval: 4_500_000 + 1_250_000 + 324_055 });
    expect(sub).toMatchObject({ balance: 4_000_000, scheduled: 0, available: 4_000_000, pendingApproval: 805_000 });
  });
});

// ---------- Step 5 ----------

describe("Step 5 — the approver approves the run (BP-08, BP-17)", () => {
  it("BP-17: the preparer cannot approve (403)", async () => {
    const { status, body } = await call<ApiError>(runApprove.POST, "POST", "/api/payment-runs/run_1/approve", { params: { id: "run_1" } });
    expect(status).toBe(403);
    expect(body.error.code).toBe("not_approver");
  });

  it("BP-08: Faisal (not a maker) approves; instant payments leave now, the SARIE one waits for Sunday", async () => {
    await actAs("u_faisal");
    const { status, body } = await call<RunView & { scheduler: SchedulerReport }>(runApprove.POST, "POST", "/api/payment-runs/run_1/approve", { params: { id: "run_1" } });
    expect(status).toBe(200);
    expect(body.run).toMatchObject({ status: "approved", approvals: [{ userId: "u_faisal" }] });
    expect(body.scheduler.sent).toHaveLength(2);
    await actAs("u_noura");
  });

  it("BP-08: the run shows each invoice beside its amount, with rail and arrival; b_1 arrives 18 Oct as quoted in step 4 (promise C)", async () => {
    const { status, body } = await call<RunView>(run.GET, "GET", "/api/payment-runs/run_1", { params: { id: "run_1" } });
    expect(status).toBe(200);
    const items = Object.fromEntries(body.items.map((i) => [i.bill.id, i]));
    expect(body.items.map((i) => i.bill.id).sort()).toEqual(["b_1", "b_2", "b_gol_0917"]);
    for (const item of body.items) {
      const file = item.bill.file;
      expect(file, `${item.bill.id} has its invoice file`).toBeDefined();
      const served = await call<string>(files.GET, "GET", `/api/files/${file!.id}`, { params: { id: file!.id } });
      expect(served.status).toBe(200);
      expect(served.res.headers.get("content-type")).toBe(file!.mime);
    }
    expect(items.b_gol_0917.bill.file).toMatchObject({ name: "GOL-2026-0917-green-oasis.pdf", mime: "application/pdf" });
    expect(items.b_2.payment).toMatchObject({ status: "settled", rail: "instant", fundingAccountId: "w_maintenance" });
    expect(items.b_gol_0917.payment).toMatchObject({ status: "settled", rail: "instant", fundingAccountId: "main" });
    expect(items.b_1.payment).toMatchObject({ status: "scheduled", rail: "sarie", expectedArrival: "2026-10-18", iban: IBAN_B_NEW });
    const quoted = stepFourQuotes.find((q) => q.billId === "b_1")!;
    expect(items.b_1.quote).toEqual(quoted);
    expect(items.b_1.payment!.expectedArrival).toBe(quoted.arrivalDate);
    expect(body.totals).toMatchObject({ amount: 6_555_000, count: 3, byAccount: { main: 5_750_000, w_maintenance: 805_000 } });
  });
});

// ---------- Step 6 ----------

describe("Step 6 — what the supplier receives and what lands in accounting (BP-13, BP-14, BP-15)", () => {
  it("BP-13: suppliers of the sent payments get a bilingual notice without bank details", async () => {
    for (const billId of ["b_2", "b_gol_0917"]) {
      const { body } = await call<{ notices: SupplierNotice[] }>(notices.GET, "GET", `/api/notices?billId=${billId}`);
      expect(body.notices).toHaveLength(1);
      const n = body.notices[0];
      expect(n).toMatchObject({ channel: "email", to: "accounts@greenoasis.example" });
      expect(n.bodyEn).toContain("Sahab Facility Services Co.");
      expect(n.bodyAr).toContain("شركة سحاب للخدمات المرفقية");
      expect([n.subjectEn, n.bodyEn, n.subjectAr, n.bodyAr].join("\n")).not.toMatch(NO_IBAN);
    }
    const { body: none } = await call<{ notices: SupplierNotice[] }>(notices.GET, "GET", "/api/notices?billId=b_1");
    expect(none.notices).toEqual([]); // not sent yet, so no notice
  });

  it("BP-14/BP-15: the accounting system has the payable (marked paid) and the payment with invoice file, number, supplier and VAT", async () => {
    const { body } = await call<{ system: string; entries: AccountingEntry[] }>(accounting.GET, "GET", "/api/accounting?billId=b_2");
    expect(body.system).toBe("Accounting system (mock)");
    expect(body.entries.find((e) => e.kind === "payment")).toMatchObject({
      attachmentName: "GOL-2026-1003-photo.jpg",
      invoiceNumber: "GOL-2026-1003",
      supplierName: "Green Oasis Landscaping Est.",
      vat: 105_000,
      total: 805_000,
    });
    expect(body.entries.find((e) => e.kind === "payable")?.status).toBe("paid");
    const { body: b1 } = await call<{ entries: AccountingEntry[] }>(accounting.GET, "GET", "/api/accounting?billId=b_1");
    expect(b1.entries.map((e) => [e.kind, e.status])).toEqual([["payable", "synced"]]); // approved, not yet paid
  });

  it("BP-14: a payment confirmation can be downloaded for a paid bill", async () => {
    const { status, body, res } = await call<string>(confirmation.GET, "GET", "/api/payments/b_2/confirmation", { params: { billId: "b_2" } });
    expect(status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(body).toContain("GOL-2026-1003");
    expect(body).toContain("8,050.00 SAR");
    const unpaid = await call<ApiError>(confirmation.GET, "GET", "/api/payments/b_1/confirmation", { params: { billId: "b_1" } });
    expect(unpaid.status).toBe(409);
  });

  it("Sunday 09:00: the SARIE payment leaves; the notice says it arrives Sunday 18 October, with no bank details", async () => {
    const { status, body } = await call<{ state: DemoState; scheduler: SchedulerReport }>(demoClock.POST, "POST", "/api/demo/clock", {
      json: { date: "2026-10-18", time: "09:00" },
    });
    expect(status).toBe(200);
    expect(body.state.riyadh).toMatchObject({ date: "2026-10-18", time: "09:00", weekday: "Sunday" });
    expect(body.scheduler.sent).toHaveLength(1);

    const { body: b1 } = await call<BillDetail>(bill.GET, "GET", "/api/bills/b_1", { params: { id: "b_1" } });
    expect(b1.bill.status).toBe("paid");
    expect(b1.payment).toMatchObject({ status: "settled", iban: IBAN_B_NEW, expectedArrival: "2026-10-18" });
    // The approval quote (why it arrives after the pay date) is kept; the send-time quote is stored beside it.
    const q4 = stepFourQuotes.find((q) => q.billId === "b_1")!;
    expect(b1.payment!.quote).toEqual({ rail: q4.rail, sendAt: q4.sendAt, arrivalDate: q4.arrivalDate, sameDay: q4.sameDay, reason: q4.reason });
    expect(b1.payment!.quote!.reason).toBe("sarie_after_cutoff");
    expect(b1.payment!.sentQuote).toMatchObject({ reason: "sarie_in_window", arrivalDate: "2026-10-18" });

    const { body: n } = await call<{ notices: SupplierNotice[] }>(notices.GET, "GET", "/api/notices?billId=b_1");
    expect(n.notices).toHaveLength(1);
    const notice = n.notices[0];
    expect(notice.to).toBe("finance@coolbreeze-hvac.example");
    expect(notice.bodyEn).toContain("Expected arrival: Sunday 18 October 2026");
    expect(notice.bodyAr).toContain("الأحد 18 أكتوبر 2026");
    expect(notice.bodyEn).toContain(b1.payment!.transferRef!);
    expect([notice.subjectEn, notice.bodyEn, notice.subjectAr, notice.bodyAr].join("\n")).not.toMatch(NO_IBAN);
  });

  it("BP-18: the subwallet paid 8,050.00 and the main balance 57,500.00", async () => {
    const { body } = await call<BillsSummary>(summary.GET, "GET", "/api/summary");
    expect(body.accounts.find((a) => a.id === "w_maintenance")).toMatchObject({ balance: 4_000_000 - 805_000, scheduled: 0 });
    expect(body.accounts.find((a) => a.id === "main")).toMatchObject({ balance: 18_000_000 - 5_750_000, scheduled: 0 });
  });
});

// ---------- Step 7 ----------

describe("Step 7 — the bills view: owed per supplier, SADAD in the same list (BP-11, BP-12)", () => {
  it("BP-11/BP-12: every bill with status, due date and amount; the SADAD bill sits in the same list with the same statuses", async () => {
    const { status, body } = await call<{ today: string; rows: BillRow[] }>(bills.GET, "GET", "/api/bills");
    expect(status).toBe(200);
    expect(body.today).toBe("2026-10-18");
    const rows = Object.fromEntries(body.rows.map((r) => [r.bill.id, r]));
    expect(Object.keys(rows).sort()).toEqual(["b_1", "b_2", "b_3", "b_gol_0822", "b_gol_0917", "b_sadad_power"]);
    expect(rows.b_sadad_power).toMatchObject({ displayStatus: "awaiting_approval", bill: { kind: "sadad", total: 324_055, dueDate: "2026-10-25" }, quote: { rail: "sadad" } });
    expect(rows.b_1.displayStatus).toBe("paid");
    expect(rows.b_3.displayStatus).toBe("cancelled");
    for (const r of body.rows) expect(["draft", "awaiting_approval", "scheduled", "paid", "failed", "cancelled", "overdue"]).toContain(r.displayStatus);
  });

  it("BP-11: the summary shows what is owed per supplier, SADAD biller included", async () => {
    const { body } = await call<BillsSummary>(summary.GET, "GET", "/api/summary");
    const sadad = body.owedBySupplier.find((g) => g.key === "sadad:901");
    expect(sadad).toMatchObject({ kind: "sadad", name: "National Power Utility (demo biller)", total: 324_055, count: 1 });
    expect(body.owedTotal).toBe(body.owedBySupplier.reduce((s, g) => s + g.total, 0));
    expect(body.counts).toMatchObject({ paid: 4, awaiting_approval: 1, cancelled: 1, overdue: 0 });
  });

  it("BP-11: filters by status and due date", async () => {
    const paid = await call<{ rows: BillRow[] }>(bills.GET, "GET", "/api/bills?status=paid");
    expect(paid.body.rows.map((r) => r.bill.id).sort()).toEqual(["b_1", "b_2", "b_gol_0822", "b_gol_0917"]);
    const due = await call<{ rows: BillRow[] }>(bills.GET, "GET", "/api/bills?due_before=2026-10-20");
    expect(due.body.rows.map((r) => r.bill.id).sort()).toEqual(["b_gol_0822", "b_gol_0917"]);
    const both = await call<{ rows: BillRow[] }>(bills.GET, "GET", "/api/bills?status=awaiting_approval&due_before=2026-10-31");
    expect(both.body.rows.map((r) => r.bill.id)).toEqual(["b_sadad_power"]);
    const bad = await call<ApiError>(bills.GET, "GET", "/api/bills?status=late");
    expect(bad.status).toBe(400);
  });
});

// ---------- Duplicate by supplier + invoice number ----------

describe("Also BP-04 — the saved bill's plain PDF uploaded again", () => {
  it("BP-04: is flagged as a duplicate of b_gol_0917 by supplier + invoice number (a plain PDF has no UUID)", async () => {
    const form = new FormData();
    const bytes = readFileSync(path.join(process.cwd(), "fixtures/invoices/GOL-2026-0917-green-oasis.pdf"));
    form.append("file", new File([bytes], "GOL-2026-0917-green-oasis.pdf", { type: "application/pdf" }));
    const { status, body } = await call<IngestResult>(bills.POST, "POST", "/api/bills", { form });
    expect(status).toBe(201);
    expect(body.duplicate).toEqual({ billId: "b_gol_0917", reason: "supplier_invoice_number" });
    expect(body.bill).toMatchObject({ extraction: "ocr", supplierId: "s_green_oasis", invoiceNumber: "GOL-2026-0917", duplicateOf: "b_gol_0917" });
    expect(body.bill.invoiceUuid).toBeUndefined();
  });
});

// ---------- Reset ----------

describe("Reset", () => {
  it("POST /api/demo/reset restores the seed", async () => {
    const { status } = await call<DemoState>(demoReset.POST, "POST", "/api/demo/reset");
    expect(status).toBe(200);
    const { body: state } = await call<DemoState>(demoState.GET, "GET", "/api/demo/state");
    expect(state).toMatchObject({ now: "2026-10-15T13:10:00.000Z", session: { userId: "u_noura" } });
    const { body: list } = await call<{ rows: BillRow[] }>(bills.GET, "GET", "/api/bills");
    expect(list.rows.map((r) => r.bill.id).sort()).toEqual(["b_gol_0822", "b_gol_0917", "b_sadad_power"]);
    const { body: box } = await call<{ emails: { email: InboundEmail }[] }>(inbox.GET, "GET", "/api/inbox");
    expect(box.emails[0].email.processedAt).toBeUndefined();
    const { body: payeeList } = await call<{ suppliers: { supplier: Supplier }[] }>(payees.GET, "GET", "/api/payees");
    expect(payeeList.suppliers.map((r) => r.supplier.id)).toEqual(["s_green_oasis"]);
    expect(existsSync(path.join(dataDir, "files"))).toBe(false); // uploads cleared: ids restart from the seed
  });
});
