# Demo script: Darb Bill Pay (about 2 minutes)

Click-by-click path through the 7 demo steps in `docs/PRD.md` section 8. Each step lists the requirements it proves.

**Before you start**

1. `npm run dev`, then open http://localhost:3000. It lands on **Bills**.
2. Click the amber **Demo** button (top bar; on a phone it floats at the bottom), then **Reset demo**, and confirm. You land on **Bills**.
3. The Demo panel shows the clock at **Thu 15 Oct 2026, 4:10 PM Riyadh**, acting as **Noura Al-Harbi · Prepare only**.

**Cast and demo controls**

| Who | Role |
|---|---|
| Noura Al-Harbi | Finance admin, *prepare only*: creates and submits, cannot approve or pay |
| Faisal Al-Otaibi | Approver (operations manager) |
| Reem Al-Qahtani | Approver (CFO) |

- **Switching user:** click the avatar at the top right, or use **Demo → Acting as**. Any "Switch user" link under a disabled button opens the same menu.
- **The clock:**
  - Each action (create, submit, approve, pay…) moves it forward 1 minute, so the Activity log reads as a real sequence.
  - To jump ahead, use **Demo → Change demo time**. It never goes back.
- **Mock labels:** everything marked **Mock** is a fixed response: OCR, name check, payee screening, payment rails, email delivery, accounting.
- **Disabled buttons:** a disabled button always says why, with the action that unblocks it right next to it.

---

## Step 1: Forward an email with two invoices (BP-01, BP-02, BP-03)

1. Open **Bills → Inbox**. It shows the company's bills inbox address (*Mock email delivery*).
2. The email **"Fwd: Invoices for October (HVAC + landscaping)"** from `ops@sahab-fm.example` carries two attachments:
   - a PDF/A-3-style invoice with its ZATCA XML embedded;
   - a phone photo of an Arabic paper invoice.
3. Click **Process 2 attachments**, which stands in for the forward arriving. Two drafts appear, each saved with its sender:
   - **Cool Breeze HVAC Contracting Co., INV-2026-0451, 46,000.00 SAR**, chip **From e-invoice**;
   - **Green Oasis Landscaping Est., GOL-2026-1003, 8,050.00 SAR**, chip **Check fields (OCR)**.
4. Open the **Cool Breeze** draft:
   - The banner says **Read from e-invoice**, and that Darb did *not* check the invoice with ZATCA.
   - The invoice PDF renders on the left.
   - These came from the XML: supplier (EN/AR, shown right-to-left), VAT number, invoice number, date, VAT 6,000.00 and total 46,000.00.
   - The action panel on the right stays in view while you scroll. It says **New supplier: not in your list**.
5. Go back and open the **Green Oasis** draft:
   - The banner says **Read by OCR (mock)**.
   - Only invoice number, due date and VAT are tagged **OCR: check**.
   - The supplier card shows **Matched by VAT number**.
   - **Submit for approval** is disabled, and the reason sits under it with **Mark fields as checked**. Click it.

> Promise A: the e-invoice became a correct draft with no typing. The tests cover Arabic, English and bilingual XML, plus hostile XML (XXE, billion laughs).

## Step 2: Upload the first invoice again → duplicate (BP-04)

1. Click **Upload invoice** (Bills page, top right) and choose `fixtures/invoices/INV-2026-0451-cool-breeze.pdf`. Only PDF, image or XML is accepted, and files are treated as untrusted.
2. The new draft opens with a red **Possible duplicate** banner: *same invoice ID* as INV-2026-0451, with a link to the original. Submitting is blocked.
3. Click **Discard this copy** and confirm.
   - The bill becomes **Discarded** (muted badge).
   - It disappears from the default Bills list.
   - Status filter → **Discarded** shows it again.

The other duplicate rule (same supplier + invoice number): uploading `fixtures/invoices/GOL-2026-0917-green-oasis.pdf` is flagged against the saved bill.

## Step 3: Add the supplier, then change its IBAN (BP-05, BP-06, BP-07)

1. On the **Cool Breeze** draft, click **Add supplier**.
   - The form is prefilled from the XML, each field tagged **From e-invoice**: name (EN/AR), VAT, CR, notice email `finance@coolbreeze-hvac.example`, and IBAN `SA67 1000 …` (checksum valid, Saudi National Bank).
2. Click **Save and check name**.
   - **Name check: Match** (mock).
   - **Payee screening: Cleared (mock)**.
3. Click **View supplier**, then **Change bank account**.
   - The dialog warns you to call the supplier on a number you already have.
4. Enter `SA2045000000001234567001` and click **Request change**.
   - The supplier shows **Payments paused: IBAN change awaiting approval**.
   - As Noura, Approve is disabled, with "Prepare only… **Switch user**". Noura can **Withdraw request**.
5. Click **Switch user** and pick **Faisal Al-Otaibi**. The panel shows old → new IBAN, who asked and when, and the name check on the new account. Above the buttons is the advice to call the supplier on a known number.
   - **If the result is "Close match"** (any IBAN outside the demo table, e.g. `SA0405000000008800112233`), the panel shows the supplier's name next to the name at the bank. Click **Confirm name match**; **Approve change** then becomes available.
   - **Reject** is always available to an approver who didn't make the request.
6. Click **Approve change**. The toast says *New IBAN is active*.
7. **Bank account history** shows both people and times. **Bills → Activity** lists request → confirm → approve, one minute apart, with the IBAN before → after.
8. Switch back to **Noura**.

> Promise B: a changed IBAN can't move money until a different user approves it and the new name check passes or is confirmed. It is tested at the service layer (`lib/server/services/promise-b.test.ts`): close match → confirm → approve by two users, reject on a close match, and a payment that was already scheduled being held and never sent.

## Step 4: Three bills in one dated run (BP-09, BP-10, BP-18)

1. Go to **Bills → Payment runs → New payment run**. Nothing is ticked yet.
2. Click **Select all**. This ticks three bills:
   - the two new bills;
   - **GOL-2026-0917, 12,650.00 SAR**, saved earlier and shown **Overdue** on the Bills page.

   Alternatively, use **Select due before pay date** to pick only the overdue bill.
3. Keep the pay date **15/10/2026**. Each bill shows its rail and expected arrival before you submit:
   - Green Oasis 12,650.00 and 8,050.00: **Instant payment (sarie)**, arrive **Thu 15 Oct**, 24/7.
   - Cool Breeze 46,000.00: **SARIE**, arrives **Sun 18 Oct**, *After 3:58 PM cut-off, next banking day*. It also shows **Paying 28 days early (due 12 Nov 2026)**.
4. *(Optional)*
   - Turn on **Pay on due date** for a bill: its own date and arrival update, e.g. GOL-2026-1003 → Sun 25 Oct.
   - Set **Pay from** to **Maintenance projects** (subwallet). The **Scheduled vs available** cards update.
   - The run summary shows per-payment and daily limits.
5. Click **Submit for approval**. You land on the run page with a success toast. The run is **Awaiting approval**, and Noura's Approve/Reject are disabled with **Switch user** beside the reason.

## Step 5: The approver approves on mobile (BP-08, BP-17)

1. On the run page, click **Open on mobile**, or open http://localhost:3000/m. On a desktop it shows in a phone frame; Chrome DevTools at 375px also works.
2. Tap the avatar and switch to **Faisal Al-Otaibi**.
3. **My actions** shows the balance with **Awaiting approval**, the run (66,700.00 SAR) and the SADAD bill. Tap **Review** on the run.
4. Each card shows the **invoice page beside its amount**, with rail and arrival (tap a thumbnail to open it full screen).
   - Cool Breeze shows **Bank details changed on 15 Oct 2026 · requested by Noura Al-Harbi, approved by Faisal Al-Otaibi**.
   - It also shows **First payment to this supplier: added by Noura Al-Harbi**.
5. Tap **Approve 3 payments · 66,700.00 SAR**. A **Confirm and release** sheet shows:
   - total 66,700.00, 3 payments, earliest arrival Thu 15 Oct;
   - the note "In Darb this step uses your usual approval verification (mock)".
6. Tap **Confirm and release**. The result:
   - both Green Oasis payments are **Settled**: paid now, arrive Thu 15 Oct;
   - Cool Breeze is **Scheduled for Sun 18 Oct**.

> Maker-checker is enforced on the server:
> - Noura (prepare only) can't approve.
> - A creator or editor can't approve their own bill or run.
> - Whoever added a supplier, or requested its IBAN change, can't approve its first payment.

## Step 6: What the supplier receives and what lands in accounting (BP-13, BP-14, BP-15)

1. Back on desktop, open the **GOL-2026-1003** bill or the run. On a paid bill the sections are collapsed, each with a one-line summary.
2. Expand **What the supplier received**. It is an email in **English and Arabic** with payer, invoice number, amount, transfer reference and expected arrival, and it states **No bank details are included** (*Mock email delivery*).
3. Expand the two **Accounting system (mock)** entries:
   - the payable created at approval;
   - the payment, with supplier, invoice number, VAT, total, the **attached invoice file** and the journal lines.
4. Click **Download payment confirmation**.
5. **Demo → Change demo time → Sun 18 Oct, 9:00 AM.** The SARIE window opens:
   - the Cool Breeze payment leaves to the **new** IBAN;
   - its notice says **Expected arrival: Sunday 18 October 2026**, the same date shown on the run screen and the approval screen.

> Promise C: one function (`railAndArrival` in `lib/domain/rails.ts`) gives rail and arrival to the run screen, the approval screen and the supplier notice.

## Step 7: End on the bills view (BP-11, BP-12)

1. Open **Bills**.
   - The stat cards show main balance, scheduled payments and available after scheduled (BP-18), plus the subwallet.
2. The table lists every bill with status, due date and amount.
   - The SADAD bill **National Power Utility (demo biller), 3,240.55 SAR, Awaiting approval** sits in the same list, with the same statuses.
   - The discarded duplicate isn't in the list.
3. **Owed per supplier** shows the total and a row per supplier, SADAD biller included.
4. Try the **Status** filter (Paid, Overdue, Discarded) and **Due before** (DD/MM/YYYY).
5. Switch to **عربي**:
   - the layout flips right to left;
   - the sidebar shows "درب";
   - supplier payment runs read "دفعات الموردين";
   - amounts read "ر.س";
   - dates read يوم/شهر/سنة.

---

## Edge cases worth showing if there's time

| Try | Expect | BP |
|---|---|---|
| As Noura, approve anything | Disabled, with the reason and a Switch user link; the API returns 403 | BP-17 |
| Edit the amount of a submitted bill | Approval restarts (Awaiting approval again) | BP-08 |
| Change a supplier's IBAN after its run was approved | The scheduled payment is held, the run goes back to awaiting approval, and nothing is sent even when the clock passes the pay date | BP-07 |
| Faisal rejects a close-match IBAN change | The old IBAN stays; the change is in history as rejected | BP-07 |
| Cancel a scheduled payment before it's sent | Cancelled; the money stays in the balance | BP-18 |
| The SADAD bill on mobile (`/m`, as Faisal) | Same approval card, same confirm sheet, same statuses | BP-12 |

These are covered by automated tests rather than clicks (see `npm test`):
- short balance: due-date order, retry on the next working day, and an alert the day before;
- a returned payment going back to the balance;
- never paying twice (one request key per payment);
- per-payment and daily limits.
