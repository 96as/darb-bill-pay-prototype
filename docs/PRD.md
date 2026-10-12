# Darb Bill Pay — PRD v6

Oct 12, 2026 · @Abdulrahman · Draft for review

## **0. Overview**

**Darb Bill Pay turns a supplier invoice into an approved, scheduled payment, paid from the client's Darb balance over Saudi rails.** It extends today's Bill Pay (SADAD) to supplier invoices and reuses Darb's balance, approvals and transfers.

| Question | Answer |
| :---- | :---- |
| **Who is it for?** | Existing Darb clients who already pay suppliers by local transfer: the finance admin who prepares payments, the approvers who release them, and the accountant who closes the books |
| **Why does Darb win?** | Clients pay suppliers from bank portals that don't read the invoice, show it to the approver or sync it to the books. Darb does all three where clients already hold spend money and approval rules; the cost is topping up Darb first |
| **What does Darb get?** | More client money held and moved through Darb. Supplier payments are 76% of the value businesses pay (SAMA, 2021), so Bill Pay grows balances, payment volume and retention, with no new price |

**The MVP in three parts**

* **Capture:** upload or forward an invoice; Bill Pay reads its ZATCA XML if present, else uses OCR.

* **Control:** supplier list with IBAN, name check and IBAN-change lock, plus Darb's approval rules.

* **Pay:** now, on a date or in a run; SADAD bills in the same list; each payment syncs to accounting with its invoice.

**North Star:** supplier bills paid on time through Darb per month.

## **1. Problem & why now**

**Darb already pays suppliers three ways (a vendor-locked card, an approved SARIE transfer, SADAD for registered billers), but each starts from a payment, not the invoice.** Reading invoices, tracking what is due and proving what was paid still happen outside Darb.

**Paying a supplier invoice today and with Bill Pay** (our reading of Darb's pages, not a Darb statement):

> *Diagram: today vs with Bill Pay.* Today: supplier emails a PDF or photo → someone retypes supplier, IBAN, amount → admin approves the transfer → money goes over SARIE → accountant matches payment to invoice. With Bill Pay: invoice forwarded to the bills inbox → fields read from e-invoice XML or OCR → approver sees the invoice and approves → paid now, on a date or in a run → supplier notified; synced with invoice.

| Pain | Evidence |
| :---- | :---- |
| Supplier payments are most of the money businesses move | SAMA payments study, 2021: "Payment to suppliers (B2B) account for 50% of total payments by volume and 76% of total payments by value" |
| SMEs lose track of what they owe | Visa survey of 262 Saudi SMEs: 30% struggle to track outstanding invoices; only 45% use an integrated payment-and-business tool |
| Slow approvals cost money | Darb's own blog: slow manual approval of "each … maintenance invoice" delays supplier payments and loses early-payment discounts |

**Why now**

* **The rails are built and the direction is named.** SADAD went live Sep 28, 2026, subwallets Sep 20; on Oct 6 Darb called itself "corporate cards, expense management, and bill payments together in one platform".

* **Invoices are becoming data.** ZATCA Wave 25 brings taxpayers with VAT revenue above SAR 187,500 into e-invoicing's integration phase "by no later than February 1, 2027".

* **Competitors are moving.** SiFi lists "Invoice management (coming soon)"; Wafeq sells payouts to Saudi enterprises

## **2. Market & benchmark insights**

**No product we found runs the full invoice-to-payment loop for Saudi SMEs.** Global tools have it but don't serve Saudi Arabia; local and regional players each cover part. We benchmark one per type: global reference (Ramp), regional peer with Darb's model (Pemo), Saudi accounting (Wafeq) and direct Saudi rival (SiFi).

| Stage | Ramp | Pemo | Wafeq | SiFi | Darb Bill Pay MVP |
| :---- | :---- | :---- | :---- | :---- | :---- |
| Serves Saudi businesses | ❌ | ⚠️ cards only | ✅ | ✅ | ✅ |
| Capture invoices (email, upload, OCR) | ✅ | ✅ | ✅ | ❌ "coming soon" | ✅ |
| Read the ZATCA e-invoice XML | n/a | ? | ? (OCR only found) | ? | ✅ |
| Supplier list with account-name check | ✅ | ? | ⚠️ list, no name check | ✅ | ✅ |
| Approval rules before money moves | ✅ | ⚠️ UAE only | ⚠️ bill approval Premium+; payment release Enterprise | ✅ paid plan | ✅ reuses Darb's |
| Schedule and batch payments | ✅ | ? | ⚠️ batch claimed (Enterprise); no scheduling found | ? | ✅ |
| Pay Saudi suppliers by bank transfer | n/a: US payers | ❌ AED, UAE only | ⚠️ Enterprise, client's SAB or Al Rajhi account | ✅ by IBAN | ✅ SARIE; instant payments (sarie) to confirm |
| SADAD bills in the same list | n/a | ? | ❌ users have asked | ? | ✅ |
| Bills sync to accounting as payables | ✅ | ? | ✅ it is the ledger | ⚠️ payments sync as expenses | ⚠️ payment + invoice (P0), bill sync (P1) |
| **What Darb takes** | The core loop, clear statuses, a separate release step; no software fee | Bill pay fits on top of cards and a wallet; a threat if it brings it to KSA | Capture is table stakes; more partner than rival | Supplier directory and name check are needed for parity | The full loop in KSA, plus e-invoice XML and SADAD in one list |

✅ has it · ⚠️ partly · ❌ not offered · ? not found in public sources (checked Oct 9–11, 2026).

**The gap Darb takes:** one self-serve flow from supplier invoice to approval, payment and accounting sync. Bank portals pay but don't capture invoices; Wafeq captures but releases payments on Enterprise only; SiFi and Hala pay but don't capture invoices yet. Plus reading suppliers' ZATCA XML, which none of the players we checked does publicly (Oct 2026), and SADAD bills in the same list.

## **3. Part A — Platform PRD**

**Bill Pay reuses seven capabilities Darb already runs and adds five new ones to the platform, each needed by at least one more Darb product.**

**Why a Platform PRD and a Consumer PRD.** Money controls (who releases money, IBAN checks, limits, audit) sit in the money layer Darb's products already share, so every product inherits them. A capability enters Part A only if two or more Darb products need it within a year.

> *Diagram: Bill Pay adds five capabilities on top of what Darb already runs.* Products on top: Bill Pay (this PRD), local transfers, international (soon). New platform capabilities (Part A): PL-01 bills ledger, PL-02 supplier registry, PL-03 invoice reader, PL-04 payment scheduler, PL-05 payment notices. Already in Darb, reused: balance and subwallets, approval engine, local transfers (SARIE), SADAD payments, receipt AI, accounting sync, roles and audit logs. Underneath: Saudi rails (instant payments (sarie) up to SAR 20,000, SARIE in banking hours, SADAD).

### **New capabilities**

| ID | Capability | What it does | How Bill Pay uses it | Who else reuses it | Non-functional bar |
| :---- | :---- | :---- | :---- | :---- | :---- |
| PL-01 | **Bills ledger** | One record per bill: supplier, invoice number, dates, amounts, VAT, file, status. The source of truth for what is owed | Every bill, whatever its source, lands here and moves through one set of statuses | SADAD bills, international transfers, AP reports | Every status change logged with who and when; amounts locked after approval (an edit restarts approval) |
| PL-02 | **Supplier registry** | Saved suppliers with IBAN, bank, VAT number and CR (commercial registration); name check before the first payment; a lock on IBAN changes | Pay a supplier without retyping the IBAN | Local and international transfers, future payroll | IBAN format and checksum validated; an IBAN change needs a second person and a new name check before money moves |
| PL-03 | **Invoice reader** | Reads the ZATCA XML inside a PDF/A-3 or a standalone XML; falls back to OCR; flags duplicates | Turns an uploaded or forwarded file into a draft bill | Expense receipts and VAT reports (TRN extraction today) | Files treated as untrusted input; each field marked XML or OCR; duplicate check on the invoice's unique ID, or supplier + invoice number |
| PL-04 | **Payment scheduler** | Executes payments on a chosen date, alone or as a run of several bills, on the right rail | Pay now, pay on a date, pay a batch | Scheduled transfers, international transfers, subwallet top-ups | A payment is never sent twice; balance checked before each run; cut-offs respected (below) |
| PL-05 | **Payment notices** | Tells the supplier a payment was sent (invoice number, amount, expected arrival) and alerts the client (due soon, failed) | Supplier notice; due and failure alerts | Transfers, SADAD, international transfers | Sent only after the payment is confirmed; never includes bank details |

**Rails the scheduler must respect.** Instant payments (sarie): 24/7 up to SAR 20,000, with account verification. Larger amounts go by SARIE, same day in banking hours, Sunday–Thursday. Arrival is the latest of pay date, approval and funds, skipping weekends and bank holidays: a large bill approved after Thursday's cut-off arrives Sunday, shown before approval. Darb's access, the cut-off (3:58 PM in Darb's top-up help) and the rail for exactly SAR 20,000 are open questions 2–3.

**Money flow.** Clients top up their Darb balance from their own bank (instant up to SAR 20,000, otherwise SARIE in banking hours), and Bill Pay pays suppliers only from that balance or a subwallet. Scheduled bills show against the available balance but aren't held, since cards share it; a bill that meets a short balance waits and retries (BP-10). Bill Pay is free within current plans; Darb gains held balances and payment volume. Funding options and pricing are compared in a separate finance note.

### **Platform rules (apply to every product)**

* **Never pay twice:** each payment carries a unique request key, so a retry cannot send money again.

* **Maker and checker:** every bill, first payment and IBAN change needs a second person, whatever the amount; transfer thresholds only add approvers. Whoever creates or edits it can't approve it. One-person companies are outside the pilot. It matches Darb's promise, "Not a riyal leaves without your approval".

* **Limits and cancellation:** per-payment and daily limits set by the admin apply to every product, and a scheduled payment can be cancelled until it is sent.

* **Full audit trail:** every create, edit, approve and pay event keeps who, when, and the before and after values.

* **Data stays in Saudi Arabia,** as Darb's security page already commits: "hosted within the Kingdom of Saudi Arabia".

## **4. Part B — Consumer PRD**

**"Consumer" \= the Darb client company and its people, plus the supplier who gets paid.** Part B is their experience on top of the platform: bill inbox, review, approval, payment and what the supplier receives.

### **Personas**

Launch client: a facility-management firm paying HVAC, lift and landscaping contractors, one of the industries Darb already targets.

| Persona | Role in Darb today | Job in Bill Pay | Pain today |
| :---- | :---- | :---- | :---- |
| **Finance admin** (prepares) | Account Manager | Collects invoices, checks drafts, sets the pay date or run, submits | Retypes every invoice and IBAN into a transfer |
| **Approver** (owner or manager) | Manager in the approval chain | Approves bills and runs, often from the app; approval releases the payment | Approves a transfer without seeing the invoice behind it |
| **Accountant** | View-only accountant | Closes the month, files VAT | Matches payments to invoices by hand |
| **Supplier** | None (no Darb account) | Gets paid on time and knows it | Calls to ask whether invoice 123 was paid |

### **MVP scope**

**In the pilot:** the 11 P0 requirements below, built in three milestones (section 7); the 7 P1s follow at launch. **Left out, and why:**

| Feature | When | Why |
| :---- | :---- | :---- |
| Recurring payments (rent, retainers) | Next | 25% of Ramp's bills used recurring; the single-bill loop comes first |
| Bill sync to the other systems, two-way sync | Next | Built after the first system proves the pattern |
| Auto-pay rules, supplier portal, Darb-to-Darb payments | Later | Auto-pay removes the human approval; the portal is a second product |
| Overseas suppliers | Later | Follows Darb's international transfers ("Coming soon") |
| PO matching, partial payments, credit notes | Out | Only 3% of Ramp's bills matched a PO; partial payments to check with pilot clients |
| Supplier pulls the money (direct debit) | Out | Hands the supplier control of the client's money |
| Pay from the client's own bank | Out | No open banking payment-initiation licence found in KSA |

### **Who does what**

> *Diagram (swimlane): who does what, one bill from invoice to books.* Lanes and steps, in order (Capture → Check → Submit → Approve → Pay → Close):
> - Supplier (no Darb account): sends an invoice (email, PDF or photo); at the end gets a payment notice in Arabic and English.
> - Finance admin (prepares): uploads or forwards it (BP-01, 02); checks the draft and adds the supplier (BP-03, 05); sets pay date or run and submits (BP-09, 10); only if needed, tops up the balance if short (BP-10, 18).
> - Darb (system): reads XML, else OCR, and runs the duplicate check (BP-03, 04); name check and IBAN-change lock (BP-06, 07); shows rail and real arrival date (BP-09); pays from the Darb balance, never twice, over sarie or SARIE (BP-10); sends the supplier notice and syncs payment + invoice (BP-13, 14).
> - Approver (owner or manager): only if needed, confirms a name match or IBAN change and dismisses a duplicate (BP-04, 06, 07); sees the invoice and approves or rejects (BP-08). Rejected bills go back to the finance admin with a reason.
> - Accountant (view only): finds payment and invoice in the books (BP-14, 15).

### **Requirements**

| ID | Pri. | Requirement | Acceptance criteria |
| :---- | :---- | :---- | :---- |
| BP-01 | P0 | Upload invoices on web and app | PDF, image or XML creates a draft bill with the file attached |
| BP-02 | P1 | A bills inbox address per company | Each attachment in a forwarded email becomes its own draft; the sender is saved |
| BP-03 | P0 | Read the ZATCA XML, else OCR | XML fields (supplier, VAT no., invoice no., date, VAT, total) marked "from e-invoice"; else OCR, with unclear fields confirmed. Tested on Arabic, English and bilingual samples |
| BP-04 | P0 | Duplicate check | Match on invoice ID, or supplier + invoice number, against open or paid bills blocks submission; only an approver dismisses, with a reason |
| BP-05 | P0 | Supplier list | Name, IBAN, VAT number, CR, notice email or mobile; bad IBAN checksum refused; matched by VAT number, else picked by hand |
| BP-06 | P0 | Name check and first-payment approval | Before the first payment: match proceeds, close match needs approver confirmation, no match or no answer blocks. First payment approved by someone other than who added the supplier, after payee screening |
| BP-07 | P0 | IBAN-change lock | Payments pause until a different user approves and a new name check passes; unsent bills re-approved; both users logged |
| BP-08 | P0 | Approval releases the payment | Approver sees invoice, last 4 IBAN digits, amount, VAT and arrival; approval releases payment on its date; rejection needs a reason; editing amount, supplier, IBAN or date restarts approval |
| BP-09 | P0 | Pay now or on a date | Rail and arrival shown before submitting and approving (section 3 rule); a scheduled payment runs once |
| BP-10 | P1 | Payment runs | One pay date, one approval; each payment succeeds or fails alone. Short balance: admin alerted the day before; due-date order, the rest retry up to 3 working days. No rail answer: never resent. Failed or returned: money back, admin alerted |
| BP-11 | P0 | Bills view | Every bill with status, due date and amount (Overdue if past due); total owed per supplier; filters by status and due date |
| BP-12 | P1 | SADAD bills in the same list | SADAD bills show in the bills view with the same statuses and approval policy |
| BP-13 | P1 | Supplier payment notice | After the payment is confirmed, the supplier gets an email or SMS in Arabic and English with the payer, invoice number, amount, transfer reference and expected arrival; no bank details |
| BP-14 | P0 | Payment synced with its invoice, plus proof | The synced transaction carries the invoice file, number, supplier and VAT amount; a payment confirmation can be downloaded for every paid bill |
| BP-15 | P1 | Bill synced as a payable (one system) | An approved bill creates a payable there; it is marked paid when Darb's payment settles |
| BP-16 | P1 | Supplier onboarding link | Single-use link; the supplier enters IBAN, VAT number and CR and uploads the bank's IBAN letter; details are saved only after admin review and a name check |
| BP-17 | P1 | Prepare and approve permissions | A new prepare-only role (today's Account Manager has full access) can create and submit bills but cannot approve or pay |
| BP-18 | P0 | Money controls | Admin-set per-payment and daily limits; scheduled payments cancellable until sent; the bills view shows scheduled vs available balance (cards share it); each bill pays from the main balance or a subwallet |

## **5. Goals, metrics & tracking**

**North Star: supplier bills paid on time through Darb per month.** It combines adoption and value in one number. On time \= settled on or before the due date fixed at approval (issue date + 30 days if none); a bill counts once, in the month it settles; SADAD bills are reported separately.

**Objectives:**

O1 make Darb the place clients pay supplier invoices · 

O2 move suppliers' money safely · 

O3 remove retyping · 

O4 grow Darb's balances and payment volume; Bill Pay stays free within current plans. Targets are proposals for the first two quarters, calibrated with Darb's data.

| Metric | Type | Layer | Target (proposed) | Events | Owner |
| :---- | :---- | :---- | :---- | :---- | :---- |
| Supplier bills paid on time through Darb per month | North Star | Consumer | Baseline in pilot month 1 | bill_approved, payment_settled | Product |
| Companies paying 5+ supplier bills a month | O1 | Consumer | Share of clients sending local transfers, set from Darb's data | payment_settled | Product |
| Median time from bill created to approved | O1 | Consumer | Under 24 hours | bill_created, bill_approved | Product |
| New suppliers whose name check returns a result | O2 | Platform | 95% | payee_name_checked | Risk |
| Payments that succeed on the first attempt | O2 | Platform | 99.5% | payment_sent, payment_failed, payment_settled | Payments engineering |
| Bills submitted without editing an extracted field | O3 | Platform | 80% | bill_extracted, bill_field_edited, bill_submitted | Payments engineering |
| Average Darb balance held by Bill Pay clients, against similar clients without it | O4 | Business | Baseline in the pilot; target set with Darb's data | balance_snapshot (daily) | Finance |
| Supplier payment value through Darb (SAR a month) | O4 | Business | Baseline in the pilot; target set with Darb's data | payment_settled | Finance |
| 6-month retention of Bill Pay clients, against similar clients without it | O4 | Business | Higher than the comparison group | client_active_month | Growth |
| Duplicate payments sent | Guardrail | Platform | 0 | bill_duplicate_flagged, bill_duplicate_dismissed, payment_sent | Risk |
| Payments to a wrong account | Guardrail | Platform | 0 | payment_returned, wrong_account_reported | Risk |
| Payments that bypassed a control (name check, IBAN-change approval, required approval) | Guardrail | Platform | 0 | payment_sent, payee_bank_change_approved | Risk |
| Support tickets per 100 bills paid | Guardrail | Consumer | No rise month on month | support_ticket_created | Operations |
| Share of bills read from ZATCA XML | Watched | Platform | None; should rise with ZATCA's waves | bill_extracted | Payments engineering |

## **6. Risks, compliance & dependencies**

**Wrong-account and double payments are blocked by requirements, not left to each screen:** BP-04 to BP-10, BP-17 and BP-18. Three risks need more:

| Risk | Mitigation |
| :---- | :---- |
| A fake "our bank details changed" email | Beyond BP-07's lock, the approver is prompted to call the supplier on a known number, as Ramp does |
| Over-promising on ZATCA | Bill Pay does not check invoices with ZATCA, so it says "read from e-invoice", never "verified by ZATCA" or "VAT guaranteed". ZATCA's guidelines tie VAT deduction to clearance: "Uncleared invoices will not be eligible for VAT deduction" |
| A malicious file uploaded as an invoice | The invoice reader (PL-03) treats every file as untrusted input |

**Dependencies:** open questions 2 and 7 (name check access, payee screening); two new permissions and bills as a request type in the approval engine; payables through the first accounting system's API (BP-15); receipt AI extended to invoice fields.

## **7. Rollout & roadmap**

**Bill Pay pilots with invited existing clients, who need no new onboarding and already pay suppliers through Darb, then opens to all once the safety gate holds. The pilot also tests pre-funding: do clients top up Darb rather than pay from their bank portal?**

Gates are proposals; a safety incident pauses the flow. **Delivery plan, with no hires:** Bill Pay is the team's first priority (about 2.3 engineers of time), built on Darb's existing transfers and approval engine and reusing the prototype's code. The pilot is about 30 engineer-weeks (20 to 45), so invited clients start in Q3 2027. To fit, OCR, app approval, accounting sync, subwallet choice and the automatic name check move to launch, and Darb's operations team checks new supplier accounts by hand during the pilot. Names, ranges and the arithmetic are in the Delivery estimate & team tab.

| When | Work | Exit check |
| :---- | :---- | :---- |
| Q4 2026 | Prepare: rail and name-check access requests, confirm Bill Pay can reuse Darb's transfers and approval engine, designs, pilot clients; start building in December | Reuse confirmed; designs signed off |
| Q1 2027 | M1 Bills and capture, M2 Supplier safety | Drafts from real invoices; IBAN-change lock works end to end |
| Q2 2027 | M3 Approve and pay (until early June), then security review, compliance sign-off and Darb paying its own suppliers | Ready for invited clients |
| Q3 2027 | Pilot with invited clients from July; launch work built alongside | Pilot gate |
| Q4 2027 | Launch work: OCR, app approval, accounting sync, automatic name check, payment runs and the other P1s | P1s complete |
| Q1 2028 | Open to all clients | Launch about March 2028, after Eid al-Fitr |

## **8. Prototype**

**The prototype proves the three hardest promises: an e-invoice becomes a correct draft without typing, a changed IBAN can't move money, and the arrival date follows the real rail rules.** Link: to be added once built.

**Two-minute demo path**

15. Forward two invoices to the bills inbox: a PDF/A-3 with XML and a phone photo. One draft is marked "from e-invoice", the other asks to check its fields (BP-01 to BP-03).  
16. Upload the first invoice again; it is flagged as a duplicate (BP-04).  
17. Add the supplier: the name check passes. Change its IBAN: payments pause until a second user confirms the name match and approves (BP-05 to BP-07).  
18. Put three bills (the two new ones and one saved earlier) in a dated run. The app shows rail and arrival per bill; a SAR 45,000 bill submitted after Thursday's cut-off shows Sunday (BP-09, BP-10, BP-18).  
19. The approver approves the run on mobile, with each invoice beside its amount; the preparer can't approve (BP-08, BP-17).  
20. Show what the supplier receives and what lands in the accounting system (BP-13, BP-14; BP-15 as a mock).  
21. End on the bills view: what is owed per supplier, with a SADAD bill in the same list (BP-11, BP-12).

**Real vs mocked:** screens, bill statuses, approval logic, duplicate check, cut-off rules and reading a sample ZATCA XML are real. OCR, the name check, payment rails, email delivery and accounting sync are mocked with fixed responses.

## **9. Open questions & assumptions**

**Seven questions need Darb's input; each has the assumption this PRD uses until it is answered.**

| # | Question | Assumption used meanwhile |
| :---- | :---- | :---- |
| 1 | Does this extend today's Bill Pay (SADAD) menu item, or is it a separate product? | It extends it: same menu item, one bills list |
| 2 | Can Darb send transfers up to SAR 20,000 over instant payments (sarie), and use their account-name verification? | Yes to both; if not, the bank's IBAN letter plus a second-person check |
| 3 | What is the SARIE cut-off for outgoing transfers, and which rail takes exactly SAR 20,000? | 3:58 PM, Sunday–Thursday, as for top-ups; SAR 20,000 goes instant |
| 4 | Is Bill Pay free, or charged per payment? | Free within current plans; Darb keeps earning from cards and Enterprise, with payment fees possible later (proposal) |
| 5 | Which approval thresholds apply to bills by default? | At least one approver, plus transfers' thresholds |
| 6 | Which accounting system gets bill sync first? | Odoo or Zoho Books, both with Darb setup guides; picked by client usage |
| 7 | What screening does a new supplier account need before payment? | Darb's existing compliance checks apply to every new payee |

## **Appendix**

### **API sketch**

Illustrative only; engineering owns the real contract.

| Call | What it does | Capability |
| :---- | :---- | :---- |
| POST /bills | Create a draft bill from a file (PDF, image, XML) or by hand; returns the extracted fields, their source and any duplicate | PL-01, PL-03 |
| POST /bills/{id}/submit | Send a bill to Darb's existing approval engine | PL-01 |
| POST /payees | Add a supplier; runs IBAN validation and the name check | PL-02 |
| PATCH /payees/{id}/bank-account | Change an IBAN; the supplier stays blocked until a second person approves | PL-02 |
| POST /payment-runs | Create a run with a pay date; it pays after approval; returns the expected arrival per bill | PL-04 |
| Events | bill_approved, payment_sent, payment_settled, payment_failed, payee_bank_changed | PL-01, PL-04, PL-05 |

### **Sources**

All sources were opened Oct 9–11, 2026. The full research, with the exact quote behind each claim, is in the [Research & sources]() tab, which also sources every cell of the section 2 table.

**Darb:** [SADAD bill payments (Bill Pay)](https://darbpay.com/features/sadad-bill-payments) · [Local transfers](https://darbpay.com/products/local-transfers) · [Accounting sync](https://darbpay.com/features/accounting-integrations) · [Security](https://darbpay.com/company/security) · [Facility management](https://darbpay.com/solutions/facility-management) · [Payable-turnover blog](https://darbpay.com/resources/blog/boosting-payable-turnover-ratio-how-saudi-companies-accelerate-supplier-payments) · [Top-up help (SARIE hours)](https://darbpay.com/help-center/transaction/top-up-wallet) · [Odoo guide](https://darbpay.com/help-center/accounting-integrations/odoo-integration) · [Zoho Books guide](https://darbpay.com/help-center/accounting-integrations/zoho-books) · [CEO's LinkedIn (SADAD and subwallet launches)](https://www.linkedin.com/in/abulmohsenalbabtain/recent-activity/all/) · [Darb LinkedIn, Oct 6, 2026](https://www.linkedin.com/feed/update/urn:li:activity:7513193953815511040/)

**Regulators and market:** [SAMA payments study 2021](https://www.sama.gov.sa/en-US/Documents/National_Payments_Usage_Study_en.pdf) · [Visa SME survey (Zawya)](https://www.zawya.com/en/press-release/research-studies/visa-report-highlights-opportunity-to-connect-digital-payments-with-business-operations-for-saudi-smes-1428261) · [ZATCA Wave 25](https://zatca.gov.sa/en/MediaCenter/News/Pages/Wave25-E-invoicing.aspx) · [ZATCA E-Invoicing Detailed Guidelines](https://zatca.gov.sa/en/E-Invoicing/Introduction/Guidelines/Documents/E-Invoicing_Detailed__Guideline.pdf) · [SAMA sarie](https://www.sama.gov.sa/en-US/payment/Pages/SARIE.aspx) · [SAMA news on recipient verification](https://sama.gov.sa/en-US/MediaCenter/News/Pages/news-649.aspx) · [SAMA open banking licences](https://www.sama.gov.sa/en-US/MediaCenter/News/Pages/news-1136.aspx)

**Competitors:** [How Ramp makes money](https://support.ramp.com/how-ramp-makes-money) · [How Ramp uses Bill Pay](https://ramp.com/blog/how-ramp-uses-ramp-bill-pay) · [Ramp: managing bills](https://support.ramp.com/managing-bills-and-payments-on-bill-pay) · [Ramp: bill pay fraud](https://support.ramp.com/bill-pay-fraud) · [SiFi pricing](https://www.sifi.app/en/pricing/) · [Wafeq payout automation](https://www.wafeq.com/en-sa/payout-automation)
