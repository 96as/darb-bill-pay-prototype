// Part 2, "What launch adds": inbox + OCR, payment runs, app approval, supplier notice + accounting, SADAD + Arabic.
import { api, COOL_BREEZE, IBAN } from "../lib/api";
import type { Scene } from "./types";
import { banner, button, dialog, link, panel, toast } from "./ui";

export const part2: Scene[] = [
  {
    id: "P2-1",
    part: 2,
    title: "Email inbox + OCR",
    user: "u_noura",
    start: "/bills",
    apply: async () => {
      await api.post("/api/inbox/e_october/process");
      await api.patch("/api/bills/b_2", { reviewed: ["invoiceNumber", "dueDate", "vat"] });
    },
    async run(d) {
      const { page } = d;
      await d.hold(800, "Bills page");
      await d.clickNav(link(page, "Inbox"), /\/bills\/inbox/, "Inbox");
      await d.see(page.getByText("Fwd: Invoices for October").first(), "the forwarded email");
      await d.hold(1200, "forwarded email with 2 attachments");
      await d.click(button(page, "Process 2 attachments"), "Process 2 attachments");
      await d.see(page.getByText("GOL-2026-1003").first(), "the Green Oasis photo draft");
      await d.hold(1200, "two drafts created");
      await d.clickNav(page.locator('a[href="/bills/b_2"]').first(), /\/bills\/b_2/, "the Green Oasis photo draft");
      const ocr = banner(page, "Read by OCR");
      await d.see(ocr, 'the "Read by OCR (mock)" banner');
      await d.hold(800, "photo draft");
      await d.zoom(ocr, { fit: "text", name: '"check these fields" prompt', text: "Launch · email inbox + OCR", ms: 2500 });
      await d.shot();
      const fields = panel(page, "Invoice details");
      await d.scrollTo(fields, "center");
      await d.see(fields.getByText("OCR — check").first(), 'fields tagged "OCR — check"');
      await d.hold(1500, 'invoice number, due date and VAT tagged "OCR — check"');
      await d.scrollTo(ocr, "center");
      await d.click(ocr.getByRole("button", { name: "Mark fields as checked" }), "Mark fields as checked");
      await d.see(toast(page, "Fields marked as checked"), "the fields-checked toast");
      await d.hold(1200, "fields checked");
    },
  },
  {
    id: "P2-2",
    part: 2,
    title: "Payment run",
    user: "u_noura",
    start: "/bills",
    before: async () => {
      // Off camera: the supplier and its IBAN change (shown in Part 1), so the run has its bank-change warnings.
      await api.user("u_noura");
      await api.post("/api/payees", { ...COOL_BREEZE, fromBillId: "b_1" });
      await api.patch("/api/payees/s_1/bank-account", { iban: IBAN.clean });
      await api.user("u_faisal");
      await api.post("/api/payees/s_1/bank-account/approve");
      await api.user("u_noura");
    },
    apply: async () => {
      await api.user("u_noura");
      await api.post("/api/payment-runs", { name: "Supplier payments · 15 Oct 2026", payDate: "2026-10-15", billIds: ["b_gol_0917", "b_2", "b_1"] });
      await api.post("/api/payment-runs/run_1/submit");
    },
    async run(d) {
      const { page } = d;
      await d.hold(600, "Bills page");
      await d.clickNav(link(page, "New payment run").first(), /\/bills\/runs\/new/, "New payment run");
      await d.hold(800, "new run");
      await d.click(button(page, "Select all"), "Select all");
      await d.see(page.getByText("66,700.00").first(), "the run total 66,700.00");
      await d.hold(1000, "three bills selected");
      const table = page.locator("table").first();
      await d.zoom(table, { name: "rail and arrival per bill", scale: 1.4, ms: 2500 });
      const total = page.locator("section, aside").filter({ hasText: "66,700.00" }).last();
      await d.zoom(total, { name: "run total and one approval", text: "Launch · many bills, one approval", ms: 2500 });
      await d.shot();
      await d.clickNav(page.getByRole("button", { name: "Submit for approval" }).last(), /\/bills\/runs\/run_/, "Submit for approval");
      await d.see(page.getByText("Awaiting approval").first(), "run Awaiting approval");
      await d.hold(1200, "run submitted");
    },
  },
  {
    id: "P2-3",
    part: 2,
    title: "Approve in the app",
    user: "u_faisal",
    start: "/m",
    mobile: true,
    apply: async () => {
      await api.user("u_faisal");
      await api.post("/api/payment-runs/run_1/approve");
    },
    async run(d) {
      const { page } = d;
      await d.see(page.getByText("My actions").first(), "My actions");
      await d.hold(1200, "My actions");
      await d.text("Launch · approve from the app", { ms: 2500, position: "top" });
      await d.clickNav(button(page, "Review").or(link(page, "Review")).first(), /\/m\/runs\//, "Review");
      await d.see(page.getByText(/Bank details changed on/).first(), "the bank-change line on the Cool Breeze card");
      await d.hold(1200, "run cards: invoice beside amount");
      await d.moveTo(195, 520);
      await d.wheel(500);
      await d.hold(1200, "Cool Breeze card: bank changed, first payment");
      const approve = page.getByRole("button", { name: /Approve 3 payments/ });
      await d.click(approve, "Approve 3 payments · 66,700.00 SAR");
      const sheet = dialog(page);
      await d.see(sheet.getByText("Confirm and release").first(), "the Confirm and release sheet");
      await d.hold(1500, "confirm sheet");
      await d.shot();
      await d.click(sheet.getByRole("button", { name: "Confirm and release" }), "Confirm and release");
      await d.see(page.getByText(/Settled/).first(), "Settled payments");
      await d.hold(2500, "two settled, Cool Breeze scheduled for Sun 18 Oct");
    },
  },
  {
    id: "P2-4",
    part: 2,
    title: "Supplier notice + accounting sync",
    user: "u_noura",
    start: "/bills/b_2",
    apply: async () => {},
    async run(d) {
      const { page } = d;
      await d.hold(1000, "paid bill GOL-2026-1003");
      const notice = page.getByRole("button", { name: /What the supplier received/ }).first();
      await d.click(notice, "What the supplier received");
      const noticeBody = page.getByText("No bank details are included").first();
      await d.see(noticeBody, "the bilingual supplier notice");
      await d.hold(800, "supplier notice open");
      const noticeBox = page.locator("section, details, div").filter({ has: noticeBody }).filter({ hasText: "What the supplier received" }).last();
      await d.zoom(noticeBox, { name: "supplier notice (English + Arabic)", text: "Launch · supplier notified, books updated", ms: 2500 });
      await d.shot();
      const acct = page.locator("[data-entry-kind] button[aria-expanded]");
      const n = await acct.count();
      d.check(n === 2, `expected 2 Accounting system (mock) entries, found ${n}`);
      await d.click(acct.nth(0), "Payable (bill approved)");
      await d.hold(800, "payable entry open");
      await d.click(acct.nth(1), "Payment entry");
      const payment = page.locator('[data-entry-kind="payment"]');
      await d.scrollTo(payment, "center");
      await d.hold(800, "payment entry: supplier, invoice, VAT, file, journal lines");
      await d.zoom(payment, { name: "accounting entry (payment, invoice attached, journal lines)", ms: 2500 });
    },
  },
  {
    id: "P2-5",
    part: 2,
    title: "SADAD in the same list + Arabic",
    user: "u_noura",
    start: "/bills",
    apply: async () => {},
    async run(d) {
      const { page } = d;
      await d.hold(800, "Bills list");
      const row = page.locator("tr").filter({ hasText: "National Power Utility" }).first();
      await d.zoom(row, { name: "SADAD row", text: "Launch · SADAD bills in the same list", ms: 2500, pad: 6 });
      await d.shot();
      const from = d.now();
      await d.click(button(page, "عربي"), "the عربي toggle");
      await d.see(page.locator('html[dir="rtl"]'), "the right-to-left layout");
      await d.settle("switch to Arabic", from);
      await d.see(page.getByText("درب").first(), "the Arabic sidebar wordmark");
      await d.hold(3000, "Arabic view (right-to-left)");
      await d.shot(`${d.log.id}-arabic`);
    },
  },
];
