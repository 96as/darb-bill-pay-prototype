# Darb Bill Pay — PRD v1
Oct 11, 2026 · @Abdulrahman · Draft for review
## 0. Overview
Darb Bill Pay turns a supplier invoice into an approved, scheduled payment, paid from the client's Darb balance over Saudi rails. It extends today's Bill Pay (SADAD) to supplier invoices and reuses Darb's balance, approvals and transfers.
| Question | Answer |
|---|---|
| Who is it for? | Existing Darb clients who already pay suppliers by local transfer: the finance admin who prepares payments, the approvers who release them, and the accountant who closes the books |
| Why does Darb win? | No Saudi spend platform we found runs the full loop from invoice to payment for SMEs. Darb already holds the money, the approval rules and the rails; the invoice side is the missing piece |
The MVP in three parts
- Capture: upload or forward an invoice; Bill Pay reads its ZATCA XML if present, else uses OCR.
- Control: supplier list with IBAN, name check and IBAN-change lock, plus Darb's approval rules.
- Pay: now, on a date or in a run; SADAD bills in the same list; each payment syncs to accounting with its invoice.
North Star: supplier bills paid on time through Darb per month.
## 1. Problem & why now
Darb already pays suppliers three ways (a vendor-locked card, an approved SARIE transfer, SADAD for registered billers), but each starts from a payment, not the invoice. Reading invoices, tracking what is due and proving what was paid still happen outside Darb.
Paying a supplier invoice today and with Bill Pay (our reading of Darb's pages, not a Darb statement):
| Pain | Evidence |
|---|---|
| Supplier payments are most of the money businesses move | SAMA payments study, 2021: "Payment to suppliers (B2B) account for 50% of total payments by volume and 76% of total payments by value" |
| SMEs lose track of what they owe | Visa survey of 262 Saudi SMEs: 30% struggle to track outstanding invoices; only 45% use an integrated payment-and-business tool |
| Slow approvals cost money | Darb's own blog: slow manual approval of "each … maintenance invoice" delays supplier payments and loses early-payment discounts |
Why now
- The rails are built and the direction is named. SADAD went live Sep 28, 2026, subwallets Sep 20; on Oct 6 Darb called itself "corporate cards, expense management, and bill payments together in one platform".
- Invoices are becoming data. ZATCA Wave 25 brings taxpayers with VAT revenue above SAR 187,500 into e-invoicing's integration phase "by no later than February 1, 2027".
- Competitors are moving, and Darb holds the money. SiFi lists "Invoice management (coming soon)"; Wafeq sells payouts to Saudi enterprises. Most Saudi accounting tools only record bills, and we found no open banking licence for starting payments from a client's bank.
## 2. Market & benchmark insights
No product we found runs the full invoice-to-payment loop for Saudi SMEs from a SAMA-licensed balance. Global tools have it but don't serve Saudi Arabia; local and regional players each cover part. We benchmark one per type: global reference (Ramp), regional peer with Darb's model (Pemo), Saudi accounting (Wafeq) and direct Saudi rival (SiFi).
| Stage | Ramp | Pemo | Wafeq | SiFi | Darb Bill Pay MVP |
|---|---|---|---|---|---|
| Serves Saudi businesses | ❌ | ⚠️ cards only | ✅ | ✅ | ✅ |
| Capture invoices (email, upload, OCR) | ✅ | ✅ | ✅ | ❌ "coming soon" | ✅ |
| Read the ZATCA e-invoice XML | n/a | ? | ? (OCR only found) | ? | ✅ |
| Supplier list with account-name check | ✅ | ? | ⚠️ list, no name check | ✅ | ✅ |
| Approval rules before money moves | ✅ | ⚠️ UAE only | ⚠️ payment release Enterprise only | ✅ paid plan | ✅ reuses Darb's |
| Schedule and batch payments | ✅ | ? | ⚠️ batch claimed (Enterprise); no scheduling found | ? | ✅ |
| Pay Saudi suppliers by bank transfer | ❌ | ❌ AED, UAE only | ⚠️ Enterprise, client's SAB or Al Rajhi account | ✅ by IBAN | ✅ SARIE; instant payments (sarie) to confirm |
| SADAD bills in the same list | n/a | ? | ❌ users have asked | ? | ✅ |
| Bills sync to accounting as payables | ✅ | ? | ✅ it is the ledger | ⚠️ payments sync as expenses | ⚠️ payment + invoice (P0), bill sync (P1) |
| What Darb takes | The core loop, clear statuses, a separate release step; no software fee | Bill pay fits on top of cards and a wallet; a threat if it brings it to KSA | Capture is table stakes; more partner than rival | Supplier directory and name check are needed for parity | The full loop in KSA, plus e-invoice XML and SADAD in one list |
✅ has it · ⚠️ partly · ❌ not offered · ? not found in public sources (checked Oct 9–10, 2026).
The gap Darb takes: the full loop for Saudi SMEs from a SAMA-licensed balance, with approvals built in; importing suppliers' ZATCA XML into payables, which no Saudi spend or SME accounting product we found does publicly (Oct 2026); and supplier invoices and SADAD bills in one list under one approval policy.
## 3. Part A — Platform PRD
Bill Pay reuses seven capabilities Darb already runs and adds five new ones to the platform, each needed by at least one more Darb product.
Why a Platform PRD and a Consumer PRD. Darb already runs one money layer under several products: cards, transfers and SADAD share one balance, and transfers use manager-chain approvals. Money controls (who releases money, IBAN checks, limits, audit) belong there, so every product inherits them. Engineering and risk judge Part A on reliability; product and business judge Part B on adoption. To avoid over-engineering, a capability enters Part A only if two or more Darb products need it within a year.
### New capabilities
| ID | Capability | What it does | How Bill Pay uses it | Who else reuses it | Non-functional bar |
|---|---|---|---|---|---|
| PL-01 | Bills ledger | One record per bill: supplier, invoice number, dates, amounts, VAT, file, status. The source of truth for what is owed | Every bill, whatever its source, lands here and moves through one set of statuses | SADAD bills, international transfers, AP reports | Every status change logged with who and when; amounts locked after approval (an edit restarts approval) |
| PL-02 | Supplier registry | Saved suppliers with IBAN, bank, VAT number and CR (commercial registration); name check before the first payment; a lock on IBAN changes | Pay a supplier without retyping the IBAN | Local and international transfers, future payroll | IBAN format and checksum validated; an IBAN change needs a second person and a new name check before money moves |
| PL-03 | Invoice reader | Reads the ZATCA XML inside a PDF/A-3 or a standalone XML; falls back to OCR; flags duplicates | Turns an uploaded or forwarded file into a draft bill | Expense receipts and VAT reports (TRN extraction today) | Files treated as untrusted input; each field marked XML or OCR; duplicate check on the invoice's unique ID, or supplier + invoice number |
| PL-04 | Payment scheduler | Executes payments on a chosen date, alone or as a run of several bills, on the right rail | Pay now, pay on a date, pay a batch | Scheduled transfers, international transfers, subwallet top-ups | A payment is never sent twice; balance checked before each run; cut-offs respected (below) |
| PL-05 | Payment notices | Tells the supplier a payment was sent (invoice number, amount, expected arrival) and alerts the client (due soon, failed) | Supplier notice; due and failure alerts | Transfers, SADAD, international transfers | Sent only after the payment leaves; never includes bank details |
Rails the scheduler must respect. Instant payments (sarie): 24/7 up to SAR 20,000, with recipient account verification; Darb's access is open question 2. Above SAR 20,000, SARIE settles same day in banking hours only (Darb's top-up help gives a 3:58 PM cut-off, Sunday–Thursday), so a large bill approved Thursday afternoon arrives Sunday; the app shows that date before approval.
### Platform rules (apply to every product)
- Never pay twice: each payment carries a unique request key, so a retry cannot send money again.
- Maker and checker: whoever creates or edits a bill or supplier cannot approve it alone. On by default with two or more approvers; a one-person company can turn it off (logged). It matches Darb's promise, "Not a riyal leaves without your approval".
- Limits and cancellation: per-payment and daily limits set by the admin apply to every product, and a scheduled payment can be cancelled until it is sent.
- Full audit trail: every create, edit, approve and pay event keeps who, when, and the before and after values.
- Data stays in Saudi Arabia, as Darb's security page already commits: "hosted within the Kingdom of Saudi Arabia".
## 4. Part B — Consumer PRD
"Consumer" = the Darb client company and its people, plus the supplier who gets paid. Part B is their experience on top of the platform: bill inbox, review, approval, payment and what the supplier receives.
### Personas
Launch client: a facility-management firm paying HVAC, lift and landscaping contractors, one of the industries Darb already targets.
| Persona | Role in Darb today | Job in Bill Pay | Pain today |
|---|---|---|---|
| Finance admin (prepares) | Account Manager | Collects invoices, checks drafts, sets the pay date or run, submits | Retypes every invoice and IBAN into a transfer |
| Approver (owner or manager) | Manager in the approval chain | Approves bills and runs, often from the app; approval releases the payment | Approves a transfer without seeing the invoice behind it |
| Accountant | View-only accountant | Closes the month, files VAT | Matches payments to invoices by hand |
| Supplier | None (no Darb account) | Gets paid on time and knows it | Calls to ask whether invoice 123 was paid |
### MVP scope
In the MVP: everything in the requirements table below, BP-01 to BP-18 (BP-15 and BP-16 are P1). Left out, and why:
| Feature | When | Why |
|---|---|---|
| Recurring payments (rent, retainers) | Next | 25% of Ramp's bills used recurring; the single-bill loop comes first |
| Bill sync to the other systems, two-way sync | Next | Built after the first system proves the pattern |
| Auto-pay rules, supplier portal, Darb-to-Darb payments | Later | Auto-pay removes the human approval; the portal is a second product |
| Overseas suppliers | Out | Follows Darb's international transfers ("Coming soon") |
| PO matching, partial payments, credit notes | Out | Only 3% of Ramp's bills matched a PO |
| Supplier pulls the money (direct debit) | Out | Hands the supplier control of the client's money |
| Pay from the client's own bank | Out | No open banking payment-initiation licence found in KSA |
### Main journey
Statuses follow Ramp's; an unpaid bill past due also shows Overdue.
Unhappy paths (unclear fields, duplicates, name mismatch, changed IBAN, short balance, failed or rejected payments, cancellation) are in the acceptance criteria of BP-03, 04, 06, 07, 08, 10 and 18.
### Requirements
| ID | Pri. | Requirement | Acceptance criteria |
|---|---|---|---|
| BP-01 | P0 | Upload invoices on web and app | PDF, image or XML creates a draft bill with the file attached |
| BP-02 | P0 | A bills inbox address per company | Each attachment in a forwarded email becomes its own draft; the sender is saved |
| BP-03 | P0 | Read the ZATCA XML, else OCR | PDF/A-3 with XML: supplier, VAT number, invoice number, date, VAT and total come from the XML, marked "from e-invoice"; OCR fields are flagged for review; works for Arabic, English and bilingual invoices |
| BP-04 | P0 | Duplicate check | Same invoice ID, or same supplier + invoice number, is flagged before submission |
| BP-05 | P0 | Supplier list | Saved with name, IBAN, VAT number, CR and a notice email or mobile; an IBAN failing its checksum is refused; a new invoice is matched to its supplier by VAT number |
| BP-06 | P0 | Name check and first-payment approval | Before the first payment, the account name is checked: match proceeds, close match needs the approver's confirmation, no match blocks. The first payment needs approval from someone other than whoever added the supplier, after Darb's payee screening clears |
| BP-07 | P0 | IBAN-change lock | A change pauses payments to that supplier until a second user approves; both users and times are logged |
| BP-08 | P0 | Approval releases the payment | The preparer sets the pay date or run before submitting. Bills follow transfers' thresholds and manager chain; approval releases payment on that date. The creator can't be the only approver; editing amount, supplier, IBAN or date restarts approval |
| BP-09 | P0 | Pay now or on a date | Before submitting, the app shows the rail and expected arrival; a scheduled payment runs once, on its date |
| BP-10 | P0 | Payment runs | A run groups bills under one pay date and one approval; each payment succeeds or fails on its own. Short balance: bills pay in due-date order, the rest retry next working day, and the admin is alerted the day before. A failed or returned payment goes back to the balance and alerts the admin |
| BP-11 | P0 | Bills view | Every bill with status, due date and amount; total owed per supplier; filters by status and due date |
| BP-12 | P0 | SADAD bills in the same list | SADAD bills show in the bills view with the same statuses and approval policy |
| BP-13 | P0 | Supplier payment notice | After sending, the supplier gets an email or SMS in Arabic and English with the payer, invoice number, amount, transfer reference and expected arrival; no bank details |
| BP-14 | P0 | Payment synced with its invoice, plus proof | The synced transaction carries the invoice file, number, supplier and VAT amount; a payment confirmation can be downloaded for every paid bill |
| BP-15 | P1 | Bill synced as a payable (one system) | An approved bill creates a payable there; it is marked paid when Darb's payment settles |
| BP-16 | P1 | Supplier onboarding link | Single-use link; the supplier enters IBAN, VAT number and CR and uploads the bank's IBAN letter; details are saved only after admin review and a name check |
| BP-17 | P0 | Prepare and approve permissions | A user who can only prepare can create and submit bills but cannot approve or pay |
| BP-18 | P0 | Money controls | Admin-set per-payment and daily limits; scheduled payments cancellable until sent; the bills view shows scheduled vs available balance (cards share it); each bill pays from the main balance or a subwallet |
## 5. Goals, metrics & tracking
North Star: supplier bills paid on time through Darb per month. It combines adoption (bills flow through Darb) and value (on time) in one number. On time = settled by the due date, or within 30 days of issue if there is none (a product decision).
Objectives:
O1 make Darb the place clients pay supplier invoices · 
O2 move suppliers' money safely · 
O3 remove retyping. Targets are proposals for the first two quarters, calibrated with Darb's data. Events are logged once at the platform layer, so every product reads them the same way.
| Metric | Type | Layer | Target (proposed) | Events | Owner |
|---|---|---|---|---|---|
| Supplier bills paid on time through Darb per month | North Star | Consumer | Grows every month | bill_created, payment_settled | Product |
| Companies paying 5+ supplier bills a month | O1 | Consumer | 150 (base: clients already sending local transfers) | payment_settled | Product |
| Bills paid on time | O1 | Consumer | 70% | bill_due, payment_settled | Product |
| Median time from bill created to approved | O1 | Consumer | Under 24 hours | bill_created, bill_approved | Product |
| New suppliers whose name check returns a result | O2 | Platform | 95% | payee_name_checked | Risk |
| Payments that succeed on the first attempt | O2 | Platform | 99.5% | payment_sent, payment_failed, payment_settled | Payments engineering |
| Bills submitted without editing an extracted field | O3 | Platform | 80% | bill_extracted, bill_field_edited, bill_submitted | Payments engineering |
| Duplicate payments sent | Guardrail | Platform | 0 | bill_duplicate_flagged, bill_duplicate_dismissed, payment_sent | Risk |
| Payments to a wrong account | Guardrail | Platform | 0 | payment_returned, wrong_account_reported | Risk |
| Payments without a passed or confirmed name check | Guardrail | Platform | 0 | payment_sent | Risk |
| Payments to a changed IBAN before the second approval | Guardrail | Platform | 0 | payee_bank_changed, payee_bank_change_approved | Risk |
| Payments released without the required approval | Guardrail | Platform | 0 | payment_sent | Risk |
| Support tickets per 100 bills paid | Guardrail | Consumer | No rise month on month | support_ticket_created | Operations |
| Share of bills read from ZATCA XML | Watched | Platform | None; should rise with ZATCA's waves | bill_extracted | Payments engineering |
## 6. Risks, compliance & dependencies
Wrong-account and double payments are blocked by requirements, not left to each screen: BP-04 (duplicates), BP-05 to BP-07 (supplier list, name check, IBAN lock), BP-08 and BP-17 (maker and checker), BP-18 (limits). Three risks need more:
| Risk | Mitigation |
|---|---|
| A fake "our bank details changed" email | Beyond the IBAN-change lock (BP-07), the app advises calling the supplier on a known number before approving, as Ramp does |
| Over-promising on ZATCA | Bill Pay does not check invoices with ZATCA, so it says "read from e-invoice", never "verified by ZATCA" or "VAT guaranteed". ZATCA's guidelines tie VAT deduction to clearance: "Uncleared invoices will not be eligible for VAT deduction" |
| A malicious file uploaded as an invoice | The invoice reader (PL-03) treats every file as untrusted input |
Dependencies: open questions 2 and 7 (name check access, payee screening); two new permissions and bills as a request type in the approval engine; payables through the first accounting system's API (BP-15); receipt AI extended to invoice fields.
## 7. Rollout & roadmap
Bill Pay pilots with invited existing clients, who need no new onboarding and already pay suppliers through Darb, then opens to all once the safety gate holds.
Both gates are proposals and use the numbers from section 5; Darb sets the pilot size.
## 8. Prototype
The prototype proves the three hardest promises: an e-invoice becomes a correct draft without typing, a changed IBAN can't move money, and the arrival date shown is the real one. Link: to be added once built.
Two-minute demo path
- Forward two invoices to the bills inbox: a PDF/A-3 with XML and a phone photo. One draft is marked "from e-invoice", the other asks to check its fields (BP-01 to BP-03).
- Upload the first invoice again; it is flagged as a duplicate (BP-04).
- Add the supplier: the name check passes. Change its IBAN: payments pause until a second user approves (BP-05 to BP-07).
- Put three bills (the two new ones and one saved earlier) in a dated run. The app shows rail and arrival per bill; a SAR 45,000 bill submitted Thursday afternoon shows Sunday (BP-09, BP-10, BP-18).
- The approver approves the run on mobile, with each invoice beside its amount (BP-08, BP-17).
- Show what the supplier receives and what lands in the accounting system (BP-13 to BP-15).
- End on the bills view: what is owed per supplier, with a SADAD bill in the same list (BP-11, BP-12).
Real vs mocked: screens, bill statuses, approval logic, duplicate check, cut-off rules and reading a sample ZATCA XML are real. OCR, the name check, payment rails, email delivery and accounting sync are mocked with fixed responses.
## 9. Open questions & assumptions
Seven questions need Darb's input; each has the assumption this PRD uses until it is answered.
| # | Question | Assumption used meanwhile |
|---|---|---|
| 1 | Does this extend today's Bill Pay (SADAD) menu item, or is it a separate product? | It extends it: same menu item, one bills list |
| 2 | Can Darb send transfers up to SAR 20,000 over instant payments (sarie), and use their account-name verification? | Yes to both |
| 3 | What is the cut-off for sending large transfers over SARIE? | The same as for top-ups: 3:58 PM, Sunday–Thursday |
| 4 | Is Bill Pay free, or charged per payment? | Free within current plans; Darb keeps earning from cards and Enterprise, with payment fees possible later (proposal) |
| 5 | Which approval thresholds apply to bills by default? | The same thresholds as transfers |
| 6 | Which accounting system gets bill sync first? | Odoo or Zoho Books, both with Darb setup guides; picked by client usage |
| 7 | What screening does a new supplier account need before payment? | Darb's existing compliance checks apply to every new payee |
## Appendix
### API sketch
Illustrative only; engineering owns the real contract.
| Call | What it does | Capability |
|---|---|---|
| POST /bills | Create a draft bill from a file (PDF, image, XML) or by hand; returns the extracted fields, their source and any duplicate | PL-01, PL-03 |
| GET /bills?status=&due_before= | List bills for the bills view | PL-01 |
| POST /bills/{id}/submit | Send a bill to Darb's existing approval engine | PL-01 |
| POST /payees | Add a supplier; runs IBAN validation and the name check | PL-02 |
| PATCH /payees/{id}/bank-account | Change an IBAN; the supplier stays blocked until a second person approves | PL-02 |
| POST /payment-runs | Schedule one or more approved bills for a date; returns the expected arrival per bill | PL-04 |
| GET /payment-runs/{id} | Status of each payment in a run | PL-04 |
| Events | bill.approved, payment.sent, payment.settled, payment.failed, payee.bank_changed | PL-01, PL-04, PL-05 |
### Glossary
| Term | Meaning |
|---|---|
| Instant payments (sarie) | SAMA's instant payment system: 24/7, up to SAR 20,000 |
| SARIE | SAMA's large-value transfer system: banking hours |
| ZATCA e-invoice | A tax invoice cleared by ZATCA, sent as XML or as a PDF/A-3 with the XML embedded |
| P0 / P1 | Must have for launch / should have for launch |
### Sources
All sources were opened Oct 9–11, 2026. The full research, with the exact quote behind each claim, is in the Research & sources tab of the PRD Google Doc, which also sources every cell of the section 2 table.
Darb: SADAD bill payments (Bill Pay) · Local transfers · Accounting sync · Security · Facility management · Payable-turnover blog · Top-up help (SARIE hours) · Odoo guide · Zoho Books guide · CEO's LinkedIn (SADAD and subwallet launches) · Darb LinkedIn, Oct 6, 2026
Regulators and market: SAMA payments study 2021 · Visa SME survey (Zawya) · ZATCA Wave 25 · ZATCA E-Invoicing Detailed Guidelines · SAMA sarie · SAMA news on recipient verification · SAMA open banking licences
Competitors: How Ramp makes money · How Ramp uses Bill Pay · Ramp: managing bills · Ramp: bill pay fraud · SiFi pricing · Wafeq payout automation