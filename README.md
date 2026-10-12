# Darb Bill Pay prototype

A clickable prototype of **Darb Bill Pay** for a product-lead review: a supplier invoice becomes an approved, scheduled payment from the Darb balance over Saudi rails. It is a demo, not production. Everything outside the screens and rules is mocked, and all data is fictitious.

- Scope: the 7-step demo path in `docs/PRD.md` section 8. See **DEMO.md** for the click-by-click script.
- Source of truth: `docs/PRD.md`. `docs/PRD-detailed.md` is the longer Google Doc with the research tabs. `docs/BUILD-NOTES.md` is the build brief and seed.

## Run

```bash
npm install
npm run dev            # http://localhost:3000 → /bills
```

The mobile approval view is at **/m**. On a desktop it renders inside a phone frame.

Requirements: Node 20+. No accounts, keys or network services are needed. Fonts load through `next/font`.

## Test

```bash
npm test               # all tests (Vitest)
npm run test:utc       # the same suite with TZ=UTC: cut-off rules must not depend on the machine's time zone
npm run test:demo      # only the 7-step walkthrough through the API route handlers
```

| Area | Where | What it proves |
|---|---|---|
| Rules (pure) | `lib/domain/*.test.ts` | Rails and cut-offs, IBAN checksum, VAT/CR format, ZATCA XML reader (Arabic, English, bilingual), XXE and billion-laughs rejection, PDF attachment extraction, duplicates, maker-checker, statuses, limits, short-balance plan |
| Services | `lib/server/services/*.test.ts` | Promise A (e-invoice → correct draft), **promise B at the service layer** (a changed IBAN cannot move money until a different user approves it and a new name check passes), promise C (one arrival function for the run screen, the approval screen and the notice), runs, scheduler, idempotency, notices |
| Mocks | `lib/mocks/mocks.test.ts` | Fixed responses, rail idempotency |
| Walkthrough | `tests/demo-walkthrough.test.ts` | The 7 demo steps end to end through `app/api` route handlers, in an isolated temporary store |

## Reset

- In the app: **Demo → Reset demo** (the amber Demo button in the top bar; on a phone it floats at the bottom). You land on /bills.
- From the shell: `curl -X POST localhost:3000/api/demo/reset`, or delete `data/store.json` (and `data/files/`) while the server is stopped.

Demo state lives in memory and is saved to `data/store.json` (gitignored). It is created from the seed on first run. The demo clock starts at **Thu 15 Oct 2026, 4:10 PM Riyadh** and can only move forward. Every user action through the API (create, edit, submit, approve, reject, IBAN request or approval, processing an email…) moves it forward 1 minute, so the Activity log reads as a real sequence. Switching user, changing the clock, reset and marking alerts read do not. Jump ahead with **Demo → Change demo time** (presets included).

## Real vs mocked

| Real (code + tests) | Mocked (fixed responses behind an interface, labelled "Mock" in the UI) |
|---|---|
| Screens, bill statuses, Overdue | OCR (`lib/mocks/ocr.ts`: answers by file hash from `fixtures/invoices/ocr-index.json`) |
| Approval logic: maker-checker, prepare-only role, first-payment rule, IBAN-change lock | Account-name check (`lib/mocks/name-check.ts`: fixed table by IBAN) |
| Duplicate check (invoice UUID, or supplier + invoice number) | Payee screening (`lib/mocks/screening.ts`: always clears) |
| Rails, cut-off and arrival rules in Asia/Riyadh time | Payment rails (`lib/mocks/rail.ts`: idempotent by request key, settles at once, one IBAN returns the payment) |
| Reading the ZATCA XML (UBL 2.1), standalone or embedded in a PDF | Email in (the seeded inbox email) and out (supplier notices are recorded, not sent) |
| Limits, cancellation, short-balance ordering, retries, alerts, audit log | Accounting sync (`lib/mocks/accounting.ts`: an Odoo-style entry in a generic "Accounting system (mock)") |

Uploads are treated as untrusted. Only PDF, JPEG/PNG and XML are accepted, checked by magic bytes, with a 10 MB maximum. XML with any DOCTYPE or ENTITY declaration is refused before parsing, and PDF attachments are size-capped when decompressed. Files are served back only by store id, with `nosniff`.

## How it is built

| Folder | Contents |
|---|---|
| `lib/domain/` | Pure rules, no I/O, time passed in. `rails.ts` holds **the one function** (`railAndArrival`) behind every rail and arrival the app shows |
| `lib/mocks/` | The mocked integrations above |
| `lib/server/` | Store (in memory → `data/store.json`), seed, services, scheduler, audit |
| `app/api/` | Route handlers following the PRD API sketch (`/api/bills`, `/api/payees`, `/api/payment-runs`, plus inbox, files, notices, accounting, summary, demo controls) |
| `app/(app)/` | Desktop screens inside Darb's app shell |
| `app/m/` | Mobile approval view |
| `fixtures/invoices/` | Generated sample invoices (see its README). Regenerate with `npm run fixtures` (needs Google Chrome + Python Pillow) |

Stack: Next.js 15 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui (Base UI), lucide icons, Vitest. Theme tokens are Darb's web-app tokens, set exactly in `app/globals.css`. Fonts are Geist (Latin) and Cairo (Arabic).

## Assumptions

The PRD left these open. Each is the default the prototype uses; change it in one place if Darb decides otherwise.

**Payments and rails**
1. **Rails.** Up to SAR 20,000.00 (inclusive) uses instant payments (sarie), 24/7. Above that, SARIE runs Sunday–Thursday, 09:00 to 15:58 Riyadh. 15:58:59 is still in; 15:59 is not. Before 09:00 on a banking day, the payment leaves at 09:00 the same day; otherwise it leaves at 09:00 on the next banking day. Saudi public holidays are not modelled. SADAD bills pay 24/7, same day. (PRD open questions 2–3.)
2. **Send time.** A payment leaves when it is approved if its pay date is today or earlier; otherwise at 09:00 on its pay date. Then the rail rule applies. So the SAR 46,000 bill approved on Thursday shortly after 4:10 PM stays *Scheduled* until Sun 09:00, leaves then, the supplier is notified then, and it arrives Sunday.
3. **"Paid"** means the payment has left on its rail. The mock settles immediately, so the accounting payable is marked paid at the same time.
4. **Limits** (seeded, admin-set): SAR 100,000 per payment and SAR 150,000 per day. Per-payment is checked at submit. Daily (live payments for the same pay date plus the new one) is checked at approval.
5. **Short balance.** Payments go in due-date order, and those without a due date go last. A payment that doesn't fit is held, and later ones that still fit are paid. The held ones retry at 09:00 on the next working day (Sunday–Thursday). The finance admin is alerted the day before a pay date whose scheduled payments exceed the balance.
6. **A returned or failed payment** goes back to the balance (no net debit). The bill shows Failed and the finance admin gets an alert.
7. **Cancellation.** Draft, awaiting-approval, scheduled and failed bills can be cancelled until the payment has left.

**Approvals and suppliers**
8. **Runs hold draft bills and get one approval** (BP-10). Submitting a run sends all its bills for approval together. The API sketch's "approved bills" is read as "bills approved through the run".
9. **Approval policy.** One approval from a user with the approver role who is not the creator, an editor or the submitter (maker-checker). Thresholds and manager chains are not modelled (open question 5). Bills created from the inbox are created by "system"; the person who processed the email is in the audit log. Marking OCR fields as checked counts as an edit.
10. **First payment to a supplier** (BP-06): approved by someone other than whoever added the supplier, or whoever requested its latest IBAN change. Screening (mock) must have cleared. "Already paid" means paid to the current IBAN, so an IBAN change re-arms the rule.
11. **IBAN change** (BP-07). The supplier's unsent payments are held and their bills or runs go back to awaiting approval. Approving the change (a different user, with the approver role, and a new name check that matches or has a confirmed close match) does not release money by itself; the bill or run needs a fresh approval for the new IBAN. A payment whose approved IBAN differs from the supplier's current IBAN is never sent. The app advises calling the supplier on a known number.
12. **Name check** outcomes come from a fixed table by IBAN. Unknown IBANs return "close match", which needs an approver's confirmation. "No match" blocks.
13. **Adding a supplier** needs a notice email or mobile (BP-05). Open bills with the same VAT number are linked automatically.

**Data and documents**
14. **The PDF/A-3 sample** embeds the ZATCA XML as an attached file, the way PDF/A-3 does. It is not a certified PDF/A-3 file. Darb does not check invoices with ZATCA, so the UI says "read from e-invoice", never "verified by ZATCA".
15. **Overdue** is derived: a bill that is not paid or cancelled and whose due date is before today (Riyadh) shows Overdue.
16. **Accounting** is a generic "Accounting system (mock)" showing an Odoo-style entry (open question 6). The payable is created at approval (BP-15, P1) and marked paid when the payment settles.
17. **Supplier notices** are in Arabic and English, carry payer, invoice number, amount, transfer reference and expected arrival, and never include bank details. The payer's own downloadable payment confirmation does show the masked IBAN and bank.
18. **Duplicates** are flagged on the new draft, which cannot be submitted until it is discarded or marked "not a duplicate" (both are logged). A discarded copy gets the status **Discarded**. This is a terminal status, allowed only from a draft flagged as a duplicate. Discarded bills are hidden from the default list, shown under the "Discarded" filter, and excluded from amounts owed. The PRD does not list this status; it was added at the product lead's request.
19. **No login.** The user switcher sets who is acting (Finance admin = prepare only; two approvers). This is by design for the demo. The API refuses cross-origin state-changing requests.
20. **Fake data only.** Company, people, suppliers, VAT numbers (15 digits, starting and ending in 3), CRs and checksum-valid IBANs are invented. Email domains use `.example`. Bank names are only derived from the IBAN bank code. The SADAD biller is a made-up "National Power Utility (demo biller)".
21. **Logo.** There was no `docs/style/logo.png`, so the sidebar shows the word "Darb" ("درب" in Arabic). The layout follows the app render on darbpay.com and the tokens in the brief.
22. **Pay date per bill.** A run has one pay date and one approval. A bill in it can be set to **Pay on due date**, which gives that bill its own pay date. Rail and arrival come from the same `quotePayment` function either way, and daily limits are checked per pay date.
23. **Early payment.** The app warns ("Paying {n} days early") when the pay date is more than 3 days before the due date. **Recent IBAN change:** approval screens warn when the supplier's bank details changed in the last 30 days, showing when and who requested and approved it.
24. **Approval verification.** "Confirm and release" stands in for Darb's usual approval verification (OTP or similar). It is mocked and labelled so.
25. **Fixture amounts.** VAT is exact at 15% per line and per invoice. The e-invoice is 40,000.00 + 6,000.00 = **46,000.00 SAR** and the saved bill is 11,000.00 + 1,650.00 = **12,650.00 SAR**, so the demo run totals 66,700.00 SAR. 45,000.00 SAR cannot be split into a subtotal plus exact 15% VAT. The rails unit tests still include the spec'd "SAR 45,000 Thursday 4:10 PM arrives Sunday" case.

## What changed after the product-lead review

**1. IBAN change blocker**
- A close name match on a new IBAN now shows the supplier's name next to the name at the bank, with **Confirm name match** for approvers other than the requester. **Approve change** unlocks once it is confirmed.
- **Reject** is always available to an approver who didn't make the request. The requester can **Withdraw request**.
- New service tests cover request → confirm → approve by two users, and reject on a close match.

**2. Payment safety and product logic**
- Approval screens (desktop run, mobile run, single bill) warn when the supplier's bank details changed in the last 30 days.
- Early-payment warning, plus a per-bill **Pay on due date** in the run builder.
- The run builder starts empty, with **Select all** and **Select due before pay date**.
- **Confirm and release** sheet before any approval, labelled as a mock of Darb's approval verification.
- Submit lands on the bill or run page with a toast. Buttons stay locked until navigation finishes.
- Discarded duplicates get a **Discarded** status and filter.
- Fixture VAT is now exact (46,000.00 / 12,650.00).

**3. UX**
- **Bill page:** a sticky action column on the right, at the top on narrow screens. The field source is stated once in the banner, and only fields to check or edited fields are tagged. On paid bills, the supplier notice and accounting entries are collapsed, with one-line summaries.
- **Run table:** fits at 1280px.
- **Header and demo controls:** the header keeps language, alerts and avatar; the demo controls moved into one **Demo** popover (a floating button on phones).
- **Bills home:** prepare-only users see "Waiting for approvers" without Approve or Decline.
- **Toasts:** stacked, at most 3, 4 seconds.
- **Reset:** lands on /bills.
- **Clock:** moves forward 1 minute per action.
- **Requirement IDs:** removed from the UI.
- **Disabled buttons:** every one now says what unblocks it and offers that action on the same screen.

**4. Arabic**
- "دفعات الموردين" / "دفعة موردين جديدة" replace "دفعات السداد"; "سداد" now appears only for SADAD.
- The sidebar shows "درب".
- Date fields show DD/MM/YYYY, with يوم/شهر/سنة in Arabic.
- PDF previews no longer drop letters in the Arabic UI.

**5. Accessibility**
- Icon-only buttons are labelled in both languages.
- Disabled buttons expose their reason through `aria-describedby`.
- Nav items have proper names, and the current page is marked.

## Known limitations

These are prototype-level gaps, not product decisions.

- Reject/Decline does not ask for a reason. The API accepts one.
- Server messages are translated for the known error codes (`lib/i18n/errors.ts`). Anything else falls back to English. Data such as email subjects and bank-returned names stays as received.
- Invoice previews draw PDFs with pdf.js. File responses are sandboxed, so **Download** saves PDFs and XML rather than opening them in a new tab.
- One demo store is shared by every browser tab. To run several dev servers side by side, give each its own `NEXT_DIST_DIR` and `DARB_DATA_DIR`.
- Saudi public holidays and amount-based approval chains are not modelled (see Assumptions 1 and 9).

## Not built (PRD: Next, Later, Out, or BP-16)

Recurring payments, two-way or multi-system sync, auto-pay rules, supplier portal and onboarding link (BP-16), Darb-to-Darb payments, overseas suppliers, PO matching, partial payments, credit notes, direct debit, paying from the client's own bank, real bank, ZATCA, OCR, email or accounting integrations, and authentication beyond the user switcher.
