// Part 1, "The pilot loop": capture → check → approve → pay → prove, on the web (desktop).
import path from "node:path";
import { api, COOL_BREEZE, IBAN } from "../lib/api";
import { FIXTURES, OUT } from "../lib/config";
import type { Director } from "../lib/human";
import type { Scene } from "./types";
import { banner, button, dialog, link, panel, toast } from "./ui";

const E_INVOICE = path.join(FIXTURES, "INV-2026-0451-cool-breeze.pdf");

/** Upload dialog → "choose a file" (Playwright answers the file chooser, so no OS dialog shows) → Upload. */
async function uploadOnCamera(d: Director, file: string, expectUrl: RegExp) {
  const { page } = d;
  await d.click(button(page, "Upload invoice"), "the Upload invoice button");
  const dlg = dialog(page);
  await d.see(dlg.getByText("choose a file"), "the upload dialog");
  await d.hold(800, "upload dialog open");
  const chooser = page.waitForEvent("filechooser");
  await d.click(dlg.getByText("choose a file"), "choose a file");
  await (await chooser).setFiles(file);
  await d.see(dlg.getByText(path.basename(file)), "the chosen file in the dialog");
  await d.hold(700, "file chosen");
  await d.clickNav(dlg.getByRole("button", { name: "Upload", exact: true }), expectUrl, "Upload");
}

export const part1: Scene[] = [
  {
    id: "P1-1",
    part: 1,
    title: "Upload an e-invoice",
    user: "u_noura",
    start: "/bills",
    apply: async () => {
      await api.upload(E_INVOICE);
    },
    async run(d) {
      const { page } = d;
      await d.hold(1500, "Bills page");
      await uploadOnCamera(d, E_INVOICE, /\/bills\/b_1/);
      const eBanner = banner(page, "Read from e-invoice");
      await d.see(eBanner, 'the "Read from e-invoice" banner');
      await d.see(page.getByText("46,000.00").first(), "the 46,000.00 total");
      await d.hold(1500, "draft opened");
      await d.zoom(eBanner, { fit: "text", name: '"Read from e-invoice" banner', text: "Read from the invoice's ZATCA XML. No typing." });
      await d.shot();
      const fields = panel(page, "Invoice details");
      await d.scrollTo(fields, "center");
      await d.hold(600, "fields in view");
      await d.zoom(fields.getByText("Invoice number", { exact: true }), {
        name: "fields read from the XML (invoice number → total)",
        to: fields.getByText("46,000.00 SAR"),
        pad: 24,
      });
      await d.hold(1500, "end of scene");
    },
  },
  {
    id: "P1-2",
    part: 1,
    title: "Duplicate blocked",
    user: "u_noura",
    start: "/bills/b_1",
    apply: async () => {
      await api.upload(E_INVOICE);
      await api.post("/api/bills/b_2/discard");
    },
    async run(d) {
      const { page } = d;
      await d.hold(1000, "the original draft");
      await d.clickNav(link(page, "All bills"), /\/bills$/, "All bills");
      await d.hold(800, "Bills list");
      await uploadOnCamera(d, E_INVOICE, /\/bills\/b_2/);
      const dup = banner(page, "Possible duplicate");
      await d.see(dup, 'the red "Possible duplicate" banner');
      await d.hold(1500, "duplicate draft opened");
      await d.zoom(dup, { fit: "text", name: "duplicate block", text: "Same invoice twice? Blocked." });
      await d.shot();
      await d.click(button(page, "Discard this copy"), "Discard this copy");
      const dlg = dialog(page);
      await d.see(dlg, "the discard confirmation");
      await d.hold(1000, "confirm discard");
      await d.click(dlg.getByRole("button", { name: /discard/i }).last(), "the confirm Discard button");
      await d.see(banner(page, "Discarded"), 'the "Discarded" state');
      await d.hold(1500, "copy discarded");
    },
  },
  {
    id: "P1-3",
    part: 1,
    title: "New supplier + name check",
    user: "u_noura",
    start: "/bills/b_1",
    apply: async () => {
      await api.post("/api/payees", { ...COOL_BREEZE, fromBillId: "b_1" });
    },
    async run(d) {
      const { page } = d;
      await d.hold(1000, "draft: new supplier, not in your list");
      await d.clickNav(link(page, "Add supplier").first(), /\/bills\/suppliers\/new/, "Add supplier");
      await d.see(page.getByText("From e-invoice").first(), "fields tagged From e-invoice");
      await d.hold(1500, "form prefilled from the XML");
      const save = button(page, "Save and check name");
      await d.scrollTo(save, "center");
      await d.hold(800, "prefilled IBAN and notice email");
      await d.click(save, "Save and check name");
      await d.see(page.getByText("Supplier saved").first(), "the Supplier saved result");
      const result = page.getByText("Match", { exact: true }).first();
      await d.see(result, "the name-check result (Match)");
      await d.hold(1000, "name check result");
      await d.zoom(page.getByText("Name check", { exact: true }).first(), {
        name: "name-check result (Match, name at the bank, payee screening)",
        to: page.getByText("Cleared (mock)").first(),
        pad: 22,
        text: "Bank confirms the account name",
        subtitle: "In the pilot, Darb ops checks this by hand",
      });
      await d.shot();
      await d.hold(1000, "end of scene");
    },
  },
  {
    id: "P1-4",
    part: 1,
    title: "IBAN-change lock",
    user: "u_noura",
    start: "/bills/suppliers/s_1",
    apply: async () => {
      await api.user("u_noura");
      await api.patch("/api/payees/s_1/bank-account", { iban: IBAN.closeMatch });
      await api.user("u_faisal");
      await api.post("/api/payees/s_1/name-check/confirm");
      await api.post("/api/payees/s_1/bank-account/approve");
    },
    async run(d) {
      const { page } = d;
      await d.hold(1200, "supplier page (Noura, preparer)");
      await d.click(button(page, "Change bank account"), "Change bank account");
      const dlg = dialog(page);
      await d.see(dlg.getByText("Call the supplier", { exact: false }), "the call-the-supplier warning");
      await d.hold(1500, "warning: call the supplier on a known number");
      await d.click(dlg.getByRole("textbox").first(), "the New IBAN field");
      await d.type(IBAN.closeMatch, "typing the new IBAN");
      await d.see(dlg.getByText("Valid Saudi IBAN"), "the IBAN checksum confirmation");
      await d.hold(800, "IBAN valid");
      await d.click(dlg.getByRole("button", { name: "Request change" }), "Request change");
      const paused = page.getByText("IBAN change waiting for approval").first();
      await d.see(paused, "the paused-payments notice");
      await d.hold(1200, "change requested");
      await d.zoom(paused, {
        fit: "text",
        name: "paused-payments notice (requested by Noura, payments paused)",
        to: page.getByText(/Payments to this supplier are paused until a second person approves/).first(),
        pad: 18,
        text: "IBAN changed → unsent payments pause",
      });
      await d.shot(`${d.log.id}-preparer`);
      await d.hold(1500, "Noura can't approve (Switch user under the button)");

      // Switch to the approver through the demo API (the Demo panel stays hidden).
      const from = d.now();
      await api.user("u_faisal");
      await page.reload();
      await d.settle("user switch to Faisal (reload)", from);
      await d.restoreCursor();
      await d.text("Now: Faisal · approver", { ms: 2000, position: "top" });
      await d.see(button(page, "Confirm name match"), "Confirm name match (close match)");
      const pending = page.locator("section").filter({ has: button(page, "Confirm name match") }).last();
      await d.reveal(pending);
      await d.hold(1500, "close match: compare the names");
      await d.zoom(page.getByText("Close match: compare the names before confirming").first(), {
        fit: "text",
        name: "confirm match + approve buttons",
        to: [page.getByText("Name at the bank", { exact: true }).first().locator(".."), button(page, "Approve change")],
        pad: 18,
        text: "A second person must approve the change",
        subtitle: "In the pilot, Darb ops checks the name by hand",
      });
      await d.click(button(page, "Confirm name match"), "Confirm name match");
      await d.see(toast(page, "Name match confirmed"), "the name-confirmed toast");
      await d.hold(1000, "name match confirmed");
      await d.click(button(page, "Approve change"), "Approve change");
      await d.see(toast(page, "New IBAN is active"), "the New IBAN is active toast");
      await d.hold(1500, "new IBAN active");
      const history = panel(page, "Bank account history");
      await d.scrollTo(history, "center");
      await d.zoom(history, { name: "audit line: requested by Noura, approved by Faisal", scale: 1.6 });
      await d.shot();
      await d.hold(1000, "end of scene");
    },
  },
  {
    id: "P1-5",
    part: 1,
    title: "Submit and pay on a date",
    user: "u_noura",
    start: "/bills",
    apply: async () => {
      await api.user("u_noura");
      await api.post("/api/bills/b_1/submit", { payDate: "2026-10-15" });
    },
    async run(d) {
      const { page } = d;
      await d.hold(1000, "Bills list");
      await d.clickNav(page.getByText("INV-2026-0451").first(), /\/bills\/b_1/, "the Cool Breeze bill");
      const quote = page.locator("dl").filter({ hasText: "Expected arrival" }).first();
      await d.see(quote, "rail and expected arrival in the submit panel");
      await d.see(page.getByText("Sun 18 Oct").first(), "arrival Sun 18 Oct");
      await d.reveal(quote);
      await d.hold(1200, "submit panel");
      await d.zoom(quote, { name: "rail + expected arrival", text: "Rail and arrival date, before approval" });
      await d.shot();
      const reason = page.getByText(/cut-off has passed/).first();
      await d.zoom(reason, { name: "Sunday arrival (after the 3:58 PM cut-off)", text: "After Thursday's cut-off → arrives Sunday", pad: 14 });
      await d.click(page.getByRole("button", { name: "Submit for approval", exact: true }).last(), "Submit for approval");
      await d.see(page.getByText("Awaiting approval").first(), "status Awaiting approval");
      await d.hold(1500, "submitted, awaiting approval");
    },
  },
  {
    id: "P1-6",
    part: 1,
    title: "Approve on the web",
    user: "u_faisal",
    start: "/bills/b_1",
    apply: async () => {
      await api.user("u_faisal");
      await api.post("/api/bills/b_1/approve");
    },
    async run(d) {
      const { page } = d;
      await d.see(page.getByText("Awaiting approval").first(), "status Awaiting approval");
      await d.hold(1500, "approval view (Faisal): amount, status, invoice");
      const invoice = page.locator("section").filter({ has: page.getByRole("heading", { name: "Invoice", exact: true }) }).first();
      const approval = page.locator("section").filter({ hasText: "Waiting for approval" }).last();
      await d.scrollTo(approval, "center");
      await d.hold(800, "invoice beside the approval panel");
      await d.zoom(invoice, { name: "invoice beside the amount (approval panel)", to: approval, text: "Approver sees the invoice, not just an amount" });
      const changed = page.getByText(/Bank details changed on/).first();
      await d.see(changed, 'the "Bank details changed on …" line');
      await d.zoom(changed, { fit: "text", name: "bank-change line: requested by Noura, approved by Faisal", pad: 14 });
      await d.shot();
      const approve = page.getByRole("button", { name: /^Approve/ }).first();
      await d.click(approve, "Approve");
      const dlg = dialog(page);
      await d.see(dlg.getByText("Confirm and release").first(), "the Confirm and release sheet");
      await d.hold(1500, "confirm sheet: total, payments, earliest arrival");
      await d.click(dlg.getByRole("button", { name: "Confirm and release" }), "Confirm and release");
      await d.see(page.getByText(/Scheduled/).first(), "status Scheduled");
      await d.hold(1500, "scheduled for Sun 18 Oct");
    },
  },
  {
    id: "P1-7",
    part: 1,
    title: "Paid + proof",
    user: "u_noura",
    start: "/bills/b_1",
    before: async () => {
      // Sunday 9:00 AM: the SARIE window opens and the scheduled payment leaves (promise C).
      await api.clock("2026-10-18", "09:00");
    },
    apply: async () => {},
    async run(d) {
      const { page } = d;
      await d.see(page.getByText("Paid").first(), "status Paid");
      await d.text("Sunday 18 Oct, 9:00 AM", { ms: 2000, position: "top" });
      await d.hold(1000, "paid bill");
      const dl = page.getByRole("link", { name: "Download payment confirmation" }).or(button(page, "Download payment confirmation"));
      await d.reveal(dl.first());
      await d.hold(800, "download button");
      const download = page.waitForEvent("download");
      await d.click(dl, "Download payment confirmation");
      const file = await download;
      await file.saveAs(path.join(OUT.downloads, file.suggestedFilename()));
      await d.hold(600, "downloaded");
      // Show the same document on camera (the route's ?disposition=inline view).
      await d.goto("/api/payments/b_1/confirmation?disposition=inline");
      await d.see(page.getByText("Cool Breeze").first(), "the confirmation document");
      await d.hold(1200, "payment confirmation (English)");
      await d.moveTo(900, 560);
      await d.zoom(page.getByText("Payment confirmation").first(), {
        fit: "text",
        name: "the confirmation document (English + Arabic), title → expected arrival",
        to: page.locator("tr, div, p").filter({ hasText: /^Expected arrival/ }).last(),
        pad: 20,
        text: "Proof of payment, Arabic and English",
      });
      await d.shot();
      await d.moveToEl(page.getByText("Expected arrival").first());
      await d.hold(1500, "expected arrival Sunday 18 October 2026");
    },
  },
  {
    id: "P1-8",
    part: 1,
    title: "Bills view",
    user: "u_noura",
    start: "/bills",
    apply: async () => {},
    async run(d) {
      const { page } = d;
      await d.hold(1500, "Bills view");
      const owed = panel(page, "Owed per supplier");
      await d.scrollTo(owed, "center");
      await d.hold(600, "owed per supplier");
      await d.zoom(owed, { name: "totals per supplier", text: "Everything owed, per supplier" });
      await d.shot();
      const status = page.getByRole("combobox").first();
      await d.scrollTo(status, "center");
      await d.click(status, "the Status filter");
      await d.click(page.getByRole("option", { name: "Overdue" }), "Overdue");
      await d.see(page.getByText("GOL-2026-0917").first(), "the overdue bill GOL-2026-0917");
      await d.hold(2500, "Overdue filter applied");
    },
  },
];
