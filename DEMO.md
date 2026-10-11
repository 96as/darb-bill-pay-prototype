# Demo script: Darb Bill Pay (about 2 minutes)

Click-by-click path through the 7 demo steps in `docs/PRD.md` section 8, with the requirement each step proves.

**Before you start**

1. `npm run dev`, then open http://localhost:3000. It lands on **Bills**.
2. Click **Reset demo** in the top bar and confirm.
3. Check the top bar. The clock should read **Thu 15 Oct 2026, 4:10 PM Riyadh** and the acting user **Noura Al-Harbi · Prepare only**.

**Cast and demo controls**

| Who | Role |
|---|---|
| Noura Al-Harbi | Finance admin, *prepare only*: can create and submit, cannot approve or pay |
| Faisal Al-Otaibi | Approver (operations manager) |
| Reem Al-Qahtani | Approver (CFO) |

- **Switch user:** click the avatar at the top right.
- **Clock:** click the clock to move it forward. It never goes back; **Reset demo** restores Thursday 4:10 PM.
- Everything marked **Mock** is a fixed response: OCR, name check, payee screening, payment rails, email delivery, accounting.

---

## Step 1: Forward an email with two invoices (BP-01, BP-02, BP-03)

1. Open **Bills → Inbox**. Show the company's bills inbox address (*Mock email delivery*).
2. The email **"Fwd: Invoices for October (HVAC + landscaping)"** from `ops@sahab-fm.example` has two attachments:
   - a PDF/A-3-style invoice with its ZATCA XML embedded;
   - a phone photo of an Arabic paper invoice.
3. Click **Process 2 attachments** (this stands in for the forward arriving). Two drafts appear, each saved with its sender:
   - **Cool Breeze HVAC Contracting Co., INV-2026-0451, 45,000.00 SAR**, chip **From e-invoice**.
   - **Green Oasis Landscaping Est., GOL-2026-1003, 8,050.00 SAR**, chip **Check fields (OCR)**.
4. Open the **Cool Breeze** draft:
   - **Read from e-invoice:** the banner says the details came from the e-invoice, and that Darb did *not* check the invoice with ZATCA.
   - **Fields from the XML:** supplier (English and Arabic, shown right-to-left), VAT number, invoice number, date, VAT (5,869.57) and total (45,000.00) each carry **From e-invoice**.
   - **New supplier:** the Supplier card says it isn't in your list yet.
5. Go back and open the **Green Oasis** draft:
   - **Read by OCR (mock):** invoice number, due date and VAT are highlighted **OCR: check**.
   - **Already a supplier:** the Supplier card says **Matched by VAT number**.
   - Click **Mark fields as checked**.

> Promise A: the e-invoice became a correct draft with no typing. The tests cover Arabic, English and bilingual XML, plus hostile XML (XXE, billion laughs).

## Step 2: Upload the first invoice again → duplicate (BP-04)

1. Click **Upload invoice** (Bills page, top right).
2. Choose `fixtures/invoices/INV-2026-0451-cool-breeze.pdf`. Only PDF, image or XML is accepted, and the file is treated as untrusted.
3. The new draft opens with a red **Possible duplicate** banner: *same invoice ID* as INV-2026-0451, with a link to the original. Submit is blocked.
4. Click **Discard this copy**, then confirm.

The other duplicate rule (same supplier + invoice number) can be shown by uploading `fixtures/invoices/GOL-2026-0917-green-oasis.pdf`. It is flagged against the saved bill.

## Step 3: Add the supplier, then change its IBAN (BP-05, BP-06, BP-07)

1. Open the **Cool Breeze** draft and click **Add supplier**. The form is prefilled from the XML, each field marked **From e-invoice**: name (EN/AR), VAT, CR, IBAN `SA67 1000 …` (checksum valid, Saudi National Bank).
2. Enter a notice email (`finance@coolbreeze-hvac.example`) if it isn't prefilled, then click **Save and check name**.
3. The result: **Name check: Match** (mock, name at the bank COOL BREEZE HVAC CONTRACTING CO) and **Payee screening: Cleared (mock)**. Click **View supplier**.
4. Click **Change bank account** and read the warning (call the supplier on a number you already have).
5. Enter `SA2045000000001234567001` and click **Request change**. Now:
   - The supplier shows **Payments paused: IBAN change awaiting approval**.
   - Noura's **Approve change** is disabled ("Only an approver can approve IBAN changes").
   - *(Optional)* a typo such as `SA2045000000001234567002` is refused by the checksum.
6. Switch user to **Faisal Al-Otaibi**. The banner shows old → new IBAN, who asked and when, and the name check on the new account (**Match**). Click **Approve change**.
7. **Bank account history** shows both people and times. **Bills → Activity** shows the audit entries with the IBAN before → after.
8. Switch back to **Noura**.

> Promise B: a changed IBAN can't move money until a different user approves it and a new name check passes. This is tested at the service layer in `lib/server/services/promise-b.test.ts`, including a payment that was already scheduled being held and never sent.

## Step 4: Three bills in one dated run (BP-09, BP-10, BP-18)

1. Go to **Bills → Payment runs → New payment run**. Three draft bills are ready:
   - the two new ones;
   - **GOL-2026-0917, 12,500.00 SAR**, saved earlier, shown **Overdue** on the Bills page.
2. Keep the pay date **Thu 15 Oct 2026**. The table shows **rail and expected arrival per bill** before anything is submitted:
   - Green Oasis 12,500.00 and 8,050.00: **Instant payment (sarie)**, arrive **Thu 15 Oct**, 24/7.
   - Cool Breeze 45,000.00: **SARIE**, arrives **Sun 18 Oct**, *After 3:58 PM cut-off, next banking day*.
3. *(Optional)* Set **Pay from** on the photo bill to **Maintenance projects** (subwallet). The **Scheduled vs available** cards per account update, and the limits card shows per-payment and daily limits.
4. Click **Submit for approval**. The run opens as **Awaiting approval**. Noura can't approve: "Prepare only".

*(Optional cut-off check: click the clock and pick an earlier time. You can't, because the clock only moves forward. The rule "45,000 at Thu 2:00 PM arrives Thursday" is covered in the tests.)*

## Step 5: The approver approves on mobile (BP-08, BP-17)

1. On the run page click **Open on mobile**, or open http://localhost:3000/m. On a desktop it shows in a phone frame; Chrome DevTools device mode also works.
2. Tap the avatar and switch to **Faisal Al-Otaibi**.
3. **My actions** lists the run (65,550.00 SAR) and the SADAD bill. Tap **Review** on the run.
4. Each bill shows **its invoice beside its amount** (tap a thumbnail to open the file), with the rail and arrival, e.g. "SARIE · arrives Sun 18 Oct". Cool Breeze also shows **First payment to this supplier: added by Noura Al-Harbi**.
5. Tap **Approve 3 payments · 65,550.00 SAR**. The result:
   - the two Green Oasis payments are **Settled**: paid now, arrive Thu 15 Oct;
   - Cool Breeze is **Scheduled for Sun 18 Oct**.

> The maker-checker rule is enforced on the server. Noura (prepare only) gets "Prepare only: you can't approve". A creator or editor can't approve their own bill or run, and whoever added a supplier can't approve its first payment.

## Step 6: What the supplier receives and what lands in accounting (BP-13, BP-14, BP-15)

1. Back on desktop, open the run (**Bills → Payment runs**) or the **GOL-2026-1003** bill.
2. Under the paid bill:
   - **What the supplier received:** email in **English and Arabic**, side by side, with payer, invoice number, amount, transfer reference and expected arrival. It shows **No bank details are included** (*Mock email delivery*).
   - **Accounting system (mock):** the payable created at approval and the payment, with supplier, invoice number, VAT, total, the **attached invoice file** and journal lines.
   - **Download payment confirmation:** a bilingual confirmation for the paid bill.
3. Click the clock and pick **Sun 18 Oct, 9:00 AM**. The SARIE window opens:
   - the Cool Breeze payment leaves to the **new** IBAN;
   - its notice goes out with **Expected arrival: Sunday 18 October 2026**, the same date shown on the run screen and the approval screen.

> Promise C: one function (`railAndArrival` in `lib/domain/rails.ts`) gives rail and arrival to the run screen, the approval screen and the supplier notice.

## Step 7: End on the bills view (BP-11, BP-12)

1. Open **Bills**. The stat cards show **main balance**, **scheduled payments** and **available after scheduled** (BP-18), plus the subwallet.
2. The table lists every bill with **status, due date and amount**, including the SADAD bill **National Power Utility (demo biller), 3,240.55 SAR, Awaiting approval**, in the same list with the same statuses.
3. **Owed per supplier** shows the total owed and a row per supplier, with the SADAD biller included.
4. Try the filters: **Status** (e.g. Paid, Overdue) and **Due before**.
5. *(Optional)* Switch to **عربي** in the top bar. The whole layout flips right to left, and amounts read "ر.س".

---

## Edge cases worth showing if there's time

| Try | Expect | BP |
|---|---|---|
| As Noura, approve anything | Disabled with the reason; the API returns 403 | BP-17 |
| Edit the amount of a submitted bill | Approval restarts (back to Awaiting approval) | BP-08 |
| Change a supplier's IBAN after its run was approved | The scheduled payment is held, the run goes back to awaiting approval, and nothing is sent even when the clock passes the pay date | BP-07 |
| Cancel a scheduled payment before it's sent | Cancelled; the money stays in the balance | BP-18 |
| The SADAD bill on mobile (`/m`, as Faisal) | Same approval card and same statuses | BP-12 |

Covered by automated tests rather than clicks: short balance (due-date order, retry next working day, alert the day before), a returned payment going back to the balance, never paying twice (one request key per payment), and per-payment and daily limits. See `npm test`.
