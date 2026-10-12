# Handover: recording the Darb Bill Pay demo

Context for a new session whose job is to **record a demo video** of this prototype. Read this first, then `DEMO.md` (the click-by-click script). Everything below was verified on the committed code (`main`, Oct 12, 2026).

## 1. What this is (30 seconds)

- **What it is:** a clickable prototype of **Darb Bill Pay**, a new section of Darb's web app (app.darbpay.com). It turns a supplier invoice into an approved, scheduled payment from the Darb balance. It is built for a product-lead review: a demo, not production.
- **Source of truth:** `docs/PRD.md` (v6). The demo follows PRD section 8, a 7-step path.
- **It proves three promises:**
  - **A.** An e-invoice (ZATCA XML inside a PDF) becomes a correct draft with no typing.
  - **B.** A changed IBAN can't move money until a different user approves it and the name check passes.
  - **C.** The arrival date shown is real: one function gives it to the run screen, the approval screen and the supplier notice.
- **Mocked, and labelled "Mock" in the UI:** OCR, name check, payee screening, payment rails, email in/out, accounting sync.
- **Real:** screens, statuses, approval rules, duplicate check, cut-off rules, and the XML reading.
- **Data:** all fake. Company, people and suppliers are invented; VAT numbers and IBANs are valid-format but not real. Email domains use `.example`.

## 2. Run it

```bash
npm install
```
```bash
npm run dev
```

- **Desktop app:** http://localhost:3000. It lands on `/bills`.
- **Mobile approval view:** http://localhost:3000/m. On a desktop it renders inside a phone frame; at a real 375px width there's no frame.
- **Tests:** `npm test` should pass, 339 tests. It is not needed for recording.

**Port 3000 may already be taken** by an older `next-server` from this folder. Check with `lsof -i :3000`.
- If it's yours, stop it and restart, or record on another port.
- To run a clean, isolated copy that doesn't touch `data/store.json`:

```bash
NEXT_DIST_DIR=.next-rec DARB_DATA_DIR=/tmp/darb-rec-data npm run dev -- -p 3100
```

**Before each take**
1. Click **Demo → Reset demo** and confirm. You land on `/bills`.
2. Then **load each page once**, since dev mode compiles on first visit:
   - `/bills`, `/bills/inbox`, `/bills/suppliers`, `/bills/runs/new`, `/m`;
   - a bill page, which loads the PDF viewer.

The first PDF preview takes a few seconds while pdf.js compiles. For a smoother take, use `npm run build && npm start` instead of `dev`.

## 3. Demo state after reset

| Thing | Value |
|---|---|
| Clock | **Thu 15 Oct 2026, 4:10 PM Riyadh**. Each user action adds 1 minute. It never goes back; only Reset rewinds it |
| Company | Sahab Facility Services Co. / شركة سحاب للخدمات المرفقية |
| Balances | Main 180,000.00 SAR; subwallet "Maintenance projects" 40,000.00 SAR |
| Limits | 100,000 SAR per payment, 150,000 SAR per day |
| Users | **Noura Al-Harbi** (Finance admin, *Prepare only*, default) · **Faisal Al-Otaibi** (Approver) · **Reem Al-Qahtani** (Approver, CFO) |
| Saved supplier | Green Oasis Landscaping Est., IBAN …6710 (Al Rajhi), name check Match |
| Saved bill | GOL-2026-0917, **12,650.00 SAR**, due 14 Oct, so it shows **Overdue** (its PDF is attached) |
| Paid history | GOL-2026-0822, 6,900.00 SAR, paid in September |
| SADAD bill | National Power Utility (demo biller), 3,240.55 SAR, Awaiting approval |
| Inbox | One unprocessed email from `ops@sahab-fm.example` with 2 attachments |

**Created during the demo**

| Id | What |
|---|---|
| `b_1` | Cool Breeze e-invoice, **46,000.00 SAR** (40,000 + 6,000 VAT) |
| `b_2` | Green Oasis photo, OCR, **8,050.00 SAR** |
| `b_3` | The duplicate upload |
| `s_1` | Supplier Cool Breeze |
| `run_1` | The payment run |

The run total is **66,700.00 SAR**.

## 4. The values you'll type or pick

| Where | Value |
|---|---|
| Duplicate upload (step 2) | `fixtures/invoices/INV-2026-0451-cool-breeze.pdf` |
| Optional second duplicate rule | `fixtures/invoices/GOL-2026-0917-green-oasis.pdf` (same supplier + invoice number) |
| Supplier notice email | Prefilled from the XML: `finance@coolbreeze-hvac.example` |
| New IBAN, clean path (name check **Match**) | `SA2045000000001234567001` (SAB) |
| New IBAN, close-match path (shows **Confirm name match**) | `SA0405000000008800112233` |
| New IBAN that **no-matches** (approve blocked, reject allowed) | `SA5215000000004400998877` |
| Checksum typo (refused) | `SA2045000000001234567002` |
| Clock jump for step 6 | **Demo → Change demo time → Sun 18 Oct, 9:00 AM** (a preset) |

Other clock presets:
- Thu 2:00 PM is before the cut-off. It is disabled after 4:10 PM because the clock only moves forward.
- Fri 16 Oct 11:00 PM is a weekend instant payment.

## 5. Recording script (short version; full clicks in `DEMO.md`)

Suggested length is 2–3 minutes. The voice-over lines are suggestions.

1. **Capture (BP-01–03):** Bills → **Inbox** → **Process 2 attachments**.
   - Open the Cool Breeze draft: the banner reads "Read from e-invoice"; the PDF is on the left and the fields on the right.
   - Open the Green Oasis photo: invoice number, due date and VAT are tagged "OCR: check". Click **Mark fields as checked**.
   - *"Structured e-invoices need no typing; photos go through OCR and the uncertain fields are flagged."*
2. **Duplicate (BP-04):** **Upload invoice** → the same PDF → red **Possible duplicate** → **Discard this copy**. It becomes *Discarded* and leaves the list.
3. **Supplier and IBAN lock (BP-05–07):**
   - On the Cool Breeze draft → **Add supplier** (prefilled) → **Save and check name**: Match.
   - **View supplier → Change bank account** → `SA2045000000001234567001` → **Request change**. The supplier is now "Payments paused". Noura can't approve; a **Switch user** link sits under the button.
   - Switch to **Faisal** → read the "call the supplier" advice → **Approve change**.
   - *(Optional: use the close-match IBAN to show **Confirm name match** first.)*
4. **Run (BP-09, 10, 18):** switch back to **Noura** → Payment runs → **New payment run** → **Select all**.
   - Point at the rails: two Green Oasis bills go **Instant, Thu 15 Oct**; Cool Breeze 46,000 goes **SARIE, Sun 18 Oct, after the 3:58 PM cut-off**, with "Paying 28 days early".
   - *(Optional: "Pay on due date" on one bill.)*
   - **Submit for approval**: you land on the run page with a toast.
5. **Mobile approval (BP-08, 17):** **Open on mobile** (or `/m`) → avatar → **Faisal** → **Review**.
   - Each card shows the invoice page beside its amount, plus "Bank details changed on …" and "First payment to this supplier".
   - **Approve 3 payments · 66,700.00 SAR** → **Confirm and release**.
   - Result: two **Settled**, Cool Breeze **Scheduled for Sun 18 Oct**.
6. **Supplier notice and accounting (BP-13–15):**
   - Open bill GOL-2026-1003 → expand **What the supplier received** (English + Arabic, "No bank details are included") → expand the two **Accounting system (mock)** entries → **Download payment confirmation**.
   - Then **Demo → Change demo time → Sun 18 Oct 9:00 AM**. The Cool Breeze payment leaves to the new IBAN; its notice says *Expected arrival: Sunday 18 October 2026*. That is the same date the run screen showed before approval (promise C).
7. **Bills view (BP-11, 12):** **Bills**:
   - scheduled vs available balance;
   - the SADAD bill in the same list;
   - **Owed per supplier**;
   - the filters.

   Finish by switching to **عربي**: the whole layout flips right-to-left and the sidebar reads "درب".

## 6. Recording tips

**Window sizes**
- **Desktop:** 1280×800 or 1440×900. The run table and header are designed to fit at 1280 without sideways scroll.
- **Mobile:** use Chrome DevTools device mode at **375×812**, or just show `/m` on desktop, which uses the phone frame. The floating **Demo** button is only in the desktop shell, so it never covers the mobile approve bar.

**Where the controls are**
- **Demo controls** (clock, reset, user switch) are behind the amber **Demo** button in the header. The header itself shows only language, alerts and the avatar, like Darb's app.
- **Switching user quickly:** the avatar menu, or any **Switch user** link under a disabled button.

**Arabic**
- Use the **EN / عربي** toggle, or add `?lang=ar` to any URL.
- Supplier payment runs are "دفعات الموردين"; "سداد" only ever means SADAD.

**Behaviour to expect on camera**
- **Toasts** appear bottom-right (bottom-left in Arabic), at most 3 at a time, and disappear after 4 seconds.
- **Disabled buttons always explain why** and offer the fix on the same screen. That makes good material for showing the safety rules.
- **Clock ticks:** the Activity tab (Bills → Activity) shows each action one minute apart.

## 7. Gotchas

- **Clock only moves forward.** If you jump to Sunday by mistake, you have to Reset and redo everything.
- **Reset deletes uploaded files**, and ids restart (`b_1`, `b_2`, …).
- **PDF links:**
  - "Download" saves PDFs and XML rather than opening them in a tab. File responses are sandboxed for security.
  - The preview inside the app uses pdf.js and works in any browser.
- **Upload needs the file picker.** For a scripted recording, you can upload with curl instead:

  ```bash
  curl -X POST localhost:3000/api/bills -F "file=@fixtures/invoices/INV-2026-0451-cool-breeze.pdf"
  ```

  Same-origin or curl requests only; the API refuses cross-site POSTs.
- **One shared demo state** serves every tab and browser on that server. Don't run two people through the same server at once.
- **Logo:** the sidebar shows the word "Darb" / "درب". No logo file is installed; downloading Darb's logo was never approved.
- **The SAR 45,000 figure** in PRD section 8 is **46,000.00** in the app, because the fixture VAT was made exactly 15%. Say "a 46,000 bill" on camera.

## 8. Driving it without clicking (for B-roll or fast setup)

All under `/api` (same origin). The acting user is whoever is selected in the demo.

```bash
B=localhost:3000; J='content-type: application/json'
curl -X POST $B/api/demo/reset
curl -X POST $B/api/inbox/e_october/process
curl -X POST $B/api/payees -H "$J" -d '{"nameEn":"Cool Breeze HVAC Contracting Co.","nameAr":"شركة النسيم البارد للمقاولات والتكييف","vatNumber":"310387452600003","crNumber":"1010932185","iban":"SA6710000000020315550044","noticeEmail":"finance@coolbreeze-hvac.example","fromBillId":"b_1"}'
curl -X PATCH $B/api/payees/s_1/bank-account -H "$J" -d '{"iban":"SA2045000000001234567001"}'
curl -X POST $B/api/demo/user -H "$J" -d '{"userId":"u_faisal"}'
curl -X POST $B/api/payees/s_1/bank-account/approve
curl -X POST $B/api/demo/user -H "$J" -d '{"userId":"u_noura"}'
curl -X PATCH $B/api/bills/b_2 -H "$J" -d '{"reviewed":["invoiceNumber","dueDate","vat"]}'
curl -X POST $B/api/payment-runs -H "$J" -d '{"name":"Supplier payments · 15 Oct 2026","payDate":"2026-10-15","billIds":["b_gol_0917","b_2","b_1"]}'
curl -X POST $B/api/payment-runs/run_1/submit
curl -X POST $B/api/demo/user -H "$J" -d '{"userId":"u_faisal"}'
# now record step 5 from the mobile view; afterwards:
curl -X POST $B/api/demo/clock -H "$J" -d '{"date":"2026-10-18","time":"09:00"}'
```

This lets you start a take at any step. Running every command up to `submit` leaves the app ready for the mobile approval shot.

## 9. Where things are

| File | What |
|---|---|
| `DEMO.md` | Full click-by-click demo script with BP IDs, plus edge cases worth showing |
| `README.md` | Run, test, reset, real vs mocked, 25 assumptions, what changed after review, known limitations |
| `docs/PRD.md` | PRD v6 |
| `docs/ESTIMATE.md` | Production estimate, team and roadmap |
| `docs/BUILD-NOTES.md` | Seed data and build decisions |
| `fixtures/invoices/README.md` | What each sample invoice is and how to regenerate them |
| `lib/domain/rails.ts` | The single rail and arrival function (promise C) |
| `lib/domain/permissions.ts` | Maker-checker, IBAN-change and first-payment rules (promise B) |
| `lib/domain/zatca.ts`, `pdf-xml.ts` | E-invoice reading (promise A) |
| `app/(app)/` | Desktop screens |
| `app/m/` | Mobile approval |
| `components/darb/` | Shared UI |

## 10. Open items (not blockers for recording)

- Reject and Decline don't ask for a reason; the API accepts one.
- Saudi public holidays aren't modelled.
- Logo file not installed (see Gotchas).
