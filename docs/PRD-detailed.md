# Darb Bill Pay — PRD v2  

# **Darb Bill Pay — PRD v1**

Oct 11, 2026 · @Abdulrahman · Draft for review

## **0. Overview**

**Darb Bill Pay turns a supplier invoice into an approved, scheduled payment in one place, paid from the client's Darb balance over Saudi local rails.** It extends what Darb's site already calls Bill Pay, today its SADAD bill payments, to supplier invoices, reusing the balance, approvals and transfers Darb already runs.

|  |  |
| :-: | :-: |
| Question | Answer |
| \*\*Who is it for?\*\* | Existing Darb clients who already pay suppliers by local transfer: the finance admin who prepares payments, the approvers who release them, and the accountant who closes the books |
| \*\*Why does Darb win?\*\* | No Saudi spend platform we found runs the full loop from invoice to payment for SMEs. Darb already holds the money, the approval rules and the rails; the invoice side is the missing piece |

**The MVP in three parts**

  - **Capture:** upload or forward an invoice. Bill Pay reads the ZATCA e-invoice XML when the file carries it, and OCR otherwise.
  - **Control:** a supplier list with IBAN, name check and a lock on IBAN changes, plus Darb's existing approval rules.
  - **Pay:** pay now, on a date, or several bills in one run. SADAD bills sit in the same list, and each payment syncs to accounting with its invoice attached.

**North Star:** supplier bills paid on time through Darb per month.

## **1. Problem & why now**

**Darb can already pay a supplier three ways, but every way starts from a payment, never from the supplier's invoice.** A vendor-locked card, an approved local transfer over SARIE, or SADAD for registered billers. The invoice itself (reading it, tracking what is due, proving what was paid) still happens outside Darb.

**How a client pays a supplier invoice today, and with Bill Pay** (our reading of Darb's pages, not a Darb statement):

|  |  |
| :-: | :-: |
| Pain | Evidence |
| Supplier payments are most of the money businesses move | SAMA payments study, 2021: "Payment to suppliers (B2B) account for 50% of total payments by volume and 76% of total payments by value" |
| SMEs lose track of what they owe | Visa survey of 262 Saudi SMEs: 30% struggle to track outstanding invoices; only 45% use an integrated payment-and-business tool |
| Slow approvals cost money | Darb's own blog: slow manual approval of "each … maintenance invoice" delays supplier payments and loses early-payment discounts |

**Why now**

  - **The rails are built and the direction is named.** SADAD went live on Sep 28, 2026 and subwallets on Sep 20. On Oct 6 Darb described itself as "corporate cards, expense management, and bill payments together in one platform".
  - **Invoices are becoming data.** ZATCA's Wave 25 requires taxpayers with VAT revenue above SAR 187,500 to join e-invoicing's integration phase "by no later than February 1, 2027".
  - **Competitors are moving, and Darb holds the money.** SiFi lists "Invoice management (coming soon)" and Wafeq sells payouts to Saudi enterprises. Most Saudi accounting tools only record bills, and we found no open banking licence for starting payments from a client's bank.

## **2. Market & benchmark insights**

**No product we found runs the full loop from supplier invoice to payment for Saudi SMEs from a SAMA-licensed balance.** Global tools have the loop but don't serve Saudi Arabia; Saudi and regional players each have part of it. We benchmark one player per type: the global reference (Ramp), the regional peer with Darb's model (Pemo), Saudi accounting (Wafeq) and Darb's direct Saudi rival (SiFi).

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| Stage | Ramp | Pemo | Wafeq | SiFi | Darb Bill Pay MVP |
| Serves Saudi businesses | ❌ | ⚠️ cards only | ✅ | ✅ | ✅ |
| Capture invoices (email, upload, OCR) | ✅ | ✅ | ✅ | ❌ "coming soon" | ✅ |
| Read the ZATCA e-invoice XML | n/a | ? | ? (OCR only found) | ? | ✅ |
| Supplier list with account-name check | ✅ | ? | ⚠️ list, no name check | ✅ | ✅ |
| Approval rules before money moves | ✅ | ⚠️ UAE only | ⚠️ payment release Enterprise only | ✅ paid plan | ✅ reuses Darb's |
| Schedule and batch payments | ✅ | ? | ⚠️ batch claimed (Enterprise); no scheduling found | ? | ✅ |
| Pay Saudi suppliers by bank transfer | ❌ | ❌ AED, UAE only | ⚠️ Enterprise, client's SAB or Al Rajhi account | ✅ by IBAN | ✅ SARIE; instant payments (sarie) to confirm |
| SADAD bills in the same list | n/a | ? | ❌ users have asked | ? | ✅ |
| Bills sync to accounting as payables | ✅ | ? | ✅ it is the ledger | ⚠️ payments sync as expenses | ⚠️ payment + invoice (P0), bill sync (P1) |
| \*\*What Darb takes\*\* | The core loop, clear statuses, a separate release step; no software fee | Bill pay fits on top of cards and a wallet; a threat if it brings it to KSA | Capture is table stakes; more partner than rival | Supplier directory and name check are needed for parity | The full loop in KSA, plus e-invoice XML and SADAD in one list |

✅ has it · ⚠️ partly · ❌ not offered · ? not found in public sources (checked Oct 9–10, 2026).

**The gap Darb takes:** the full loop for Saudi SMEs, paid from a SAMA-licensed balance with approvals built in; reading the ZATCA e-invoice XML, where we found no Saudi spend or SME accounting product that publicly imports suppliers' ZATCA XML into payables (Oct 2026); and supplier invoices and SADAD bills in one list, under one approval policy.

  
  
  
  
  
  
  

## **3. Part A — Platform PRD**

**Bill Pay reuses seven capabilities Darb already runs and adds five new ones to the platform, each needed by at least one more Darb product.**

**Why a Platform PRD and a Consumer PRD.** Darb is already built as one money layer under several products: cards, transfers and SADAD draw on one balance, and transfers already go through manager-chain approvals. Money controls (who releases money, IBAN checks, limits, audit) belong in that layer, so every product inherits them. Engineering and risk judge Part A on reliability; product and business judge Part B on adoption. To avoid over-engineering the MVP, a capability enters Part A only if two or more Darb products need it within a year.

The bottom layer is what Darb runs today; the shaded boxes are the new capabilities, specified below.

### **New capabilities**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| ID | Capability | What it does | How Bill Pay uses it | Who else reuses it | Non-functional bar |
| PL-01 | \*\*Bills ledger\*\* | One record per bill: supplier, invoice number, dates, amounts, VAT, file, status. The source of truth for what is owed | Every bill, whatever its source, lands here and moves through one set of statuses | SADAD bills, international transfers, AP reports | Every status change logged with who and when; amounts locked after approval (an edit restarts approval) |
| PL-02 | \*\*Supplier registry\*\* | Saved suppliers with IBAN, bank, VAT number and CR (commercial registration); name check before the first payment; a lock on IBAN changes | Pay a supplier without retyping the IBAN | Local and international transfers, future payroll | IBAN format and checksum validated; an IBAN change needs a second person and a new name check before money moves |
| PL-03 | \*\*Invoice reader\*\* | Reads the ZATCA XML inside a PDF/A-3 or a standalone XML; falls back to OCR; flags duplicates | Turns an uploaded or forwarded file into a draft bill | Expense receipts and VAT reports (TRN extraction today) | Files treated as untrusted input; each field marked XML or OCR; duplicate check on the invoice's unique ID, or supplier + invoice number |
| PL-04 | \*\*Payment scheduler\*\* | Executes payments on a chosen date, alone or as a run of several bills, on the right rail | Pay now, pay on a date, pay a batch | Scheduled transfers, international transfers, subwallet top-ups | A payment is never sent twice; balance checked before each run; cut-offs respected (below) |
| PL-05 | \*\*Payment notices\*\* | Tells the supplier a payment was sent (invoice number, amount, expected arrival) and alerts the client (due soon, failed) | Supplier notice; due and failure alerts | Transfers, SADAD, international transfers | Sent only after the payment leaves; never includes bank details |

**Rails the scheduler must respect.** Instant payments (sarie) run 24/7 up to SAR 20,000 and include recipient account verification; whether Darb can send over them is open question 2. Above SAR 20,000, SARIE settles the same day in banking hours only. Darb's help gives a 3:58 PM cut-off, Sunday–Thursday, for incoming money, so a large bill approved on Thursday afternoon arrives on Sunday, and the app shows that date before approval.

### **Platform rules (apply to every product)**

  - **Never pay twice:** each payment carries a unique request key, so a retry cannot send money again.
  - **Maker and checker:** the person who creates or edits a bill or supplier cannot also approve it alone. On by default when a company has two or more approvers; a one-person company can turn it off, and the choice is logged. This matches Darb's promise, "Not a riyal leaves without your approval".
  - **Limits and cancellation:** per-payment and daily limits set by the admin apply to every product, and a scheduled payment can be cancelled until it is sent.
  - **Full audit trail:** every create, edit, approve and pay event keeps who, when, and the before and after values.
  - **Data stays in Saudi Arabia,** as Darb's security page already commits: "hosted within the Kingdom of Saudi Arabia".

## **4. Part B — Consumer PRD**

**"Consumer" here means the Darb client company and its people, plus the supplier who gets paid.** The consumer side is the experience on top of the platform: the bill inbox, review, approval, payment and what the supplier receives.

### **Personas**

Launch client: a facility-management firm paying HVAC, lift and landscaping contractors, one of the industries Darb already targets.

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| Persona | Role in Darb today | Job in Bill Pay | Pain today |
| \*\*Finance admin\*\* (prepares) | Account Manager | Collects invoices, checks drafts, sets the pay date or run, submits | Retypes every invoice and IBAN into a transfer |
| \*\*Approver\*\* (owner or manager) | Manager in the approval chain | Approves bills and runs, often from the app; approval releases the payment | Approves a transfer without seeing the invoice behind it |
| \*\*Accountant\*\* | View-only accountant | Closes the month, files VAT | Matches payments to invoices by hand |
| \*\*Supplier\*\* | None (no Darb account) | Gets paid on time and knows it | Calls to ask whether invoice 123 was paid |

### **MVP scope**

**In the MVP:** everything in the requirements table below, BP-01 to BP-18 (BP-15 and BP-16 are P1). **Left out, and why:**

|  |  |  |
| :-: | :-: | :-: |
| Feature | When | Why |
| Recurring payments (rent, retainers) | Next | 25% of Ramp's bills used recurring; the single-bill loop comes first |
| Bill sync to the other systems, two-way sync | Next | Built after the first system proves the pattern |
| Auto-pay rules, supplier portal, Darb-to-Darb payments | Later | Auto-pay removes the human approval; the portal is a second product |
| Overseas suppliers | Out | Follows Darb's international transfers ("Coming soon") |
| PO matching, partial payments, credit notes | Out | Only 3% of Ramp's bills matched a PO |
| Supplier pulls the money (direct debit) | Out | Hands the supplier control of the client's money |
| Pay from the client's own bank | Out | No open banking payment-initiation licence found in KSA |

### **Main journey**

Statuses follow Ramp's pattern; an unpaid bill past its due date also shows Overdue.

Unhappy paths (unclear fields, duplicates, a name mismatch, a changed IBAN, a short balance, failed or rejected payments, cancellation) are specified in the acceptance criteria of BP-03, 04, 06, 07, 08, 10 and 18.

  
  
  
  
  
  
  
  
  
  
  

### **Requirements**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| ID | Pri. | Requirement | Acceptance criteria |
| BP-01 | P0 | Upload invoices on web and app | PDF, image or XML creates a draft bill with the file attached |
| BP-02 | P0 | A bills inbox address per company | Each attachment in a forwarded email becomes its own draft; the sender is saved |
| BP-03 | P0 | Read the ZATCA XML, else OCR | From a PDF/A-3 with XML, supplier, VAT number, invoice number, date, VAT and total come from the XML and are marked "from e-invoice"; OCR fields are marked for review; Arabic, English and bilingual invoices work |
| BP-04 | P0 | Duplicate check | Same invoice ID, or same supplier + invoice number, is flagged before submission |
| BP-05 | P0 | Supplier list | Saved with name, IBAN, VAT number, CR and a notice email or mobile; an IBAN failing its checksum is refused; a new invoice is matched to its supplier by VAT number |
| BP-06 | P0 | Name check and first-payment approval | Before the first payment the account holder's name is checked: a match proceeds, a close match needs the approver to confirm, no match blocks. The first payment needs approval from someone other than the person who added the supplier, after Darb's payee screening clears |
| BP-07 | P0 | IBAN-change lock | A change pauses payments to that supplier until a second user approves; both users and times are logged |
| BP-08 | P0 | Approval releases the payment | The preparer sets the pay date (or adds the bill to a run) before submitting. Bills follow the same thresholds and manager chain as transfers, and approval releases the payment on that date. The creator can't be the only approver; edits to amount, supplier, IBAN or date restart approval |
| BP-09 | P0 | Pay now or on a date | Before submitting, the app shows the rail and expected arrival; a scheduled payment runs once, on its date |
| BP-10 | P0 | Payment runs | A run groups bills under one pay date and is approved once; each payment succeeds or fails on its own. If the balance is short, bills pay in due-date order and the rest retry the next working day, with the admin alerted the day before. A failed or returned payment puts the money back in the balance and alerts the admin |
| BP-11 | P0 | Bills view | Every bill with status, due date and amount; total owed per supplier; filters by status and due date |
| BP-12 | P0 | SADAD bills in the same list | SADAD bills show in the bills view with the same statuses and approval policy |
| BP-13 | P0 | Supplier payment notice | After sending, the supplier gets an email or SMS in Arabic and English with the payer, invoice number, amount, transfer reference and expected arrival; no bank details |
| BP-14 | P0 | Payment synced with its invoice, plus proof | The synced transaction carries the invoice file, number, supplier and VAT amount; a payment confirmation can be downloaded for every paid bill |
| BP-15 | P1 | Bill synced as a payable (one system) | An approved bill creates a payable there; it is marked paid when Darb's payment settles |
| BP-16 | P1 | Supplier onboarding link | Single-use link; the supplier enters IBAN, VAT number and CR and uploads the bank's IBAN letter; details are saved only after admin review and a name check |
| BP-17 | P0 | Prepare and approve permissions | A user who can only prepare can create and submit bills but cannot approve or pay |
| BP-18 | P0 | Money controls | The admin sets per-payment and daily limits; a scheduled payment can be cancelled until it is sent; the bills view shows scheduled vs available balance (cards draw on the same balance); each bill pays from the main balance or a subwallet |

  
  
  

## **5. Goals, metrics & tracking**

**North Star: supplier bills paid on time through Darb per month.** It counts adoption (bills flow through Darb) and value (they arrive on time) in one number. "On time" = the payment settles on or before the due date; a bill without a due date counts as on time if paid within 30 days of issue (a product decision).

**Objectives:**

O1 make Darb the place clients pay supplier invoices · 

O2 move suppliers' money safely · 

O3 remove retyping. Targets are proposals for the first two quarters after launch, to calibrate with Darb's data. Each event is logged once at the platform layer, so every product reads it the same way.

  

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| Metric | Type | Layer | Target (proposed) | Events | Owner |
| Supplier bills paid on time through Darb per month | North Star | Consumer | Grows every month | bill\\\_created, payment\\\_settled | Product |
| Companies paying 5+ supplier bills a month | O1 | Consumer | 150 (base: clients already sending local transfers) | payment\\\_settled | Product |
| Bills paid on time | O1 | Consumer | 70% | bill\\\_due, payment\\\_settled | Product |
| Median time from bill created to approved | O1 | Consumer | Under 24 hours | bill\\\_created, bill\\\_approved | Product |
| New suppliers whose name check returns a result | O2 | Platform | 95% | payee\\\_name\\\_checked | Risk |
| Payments that succeed on the first attempt | O2 | Platform | 99.5% | payment\\\_sent, payment\\\_failed, payment\\\_settled | Payments engineering |
| Bills submitted without editing an extracted field | O3 | Platform | 80% | bill\\\_extracted, bill\\\_field\\\_edited, bill\\\_submitted | Payments engineering |
| Duplicate payments sent | Guardrail | Platform | 0 | bill\\\_duplicate\\\_flagged, bill\\\_duplicate\\\_dismissed, payment\\\_sent | Risk |
| Payments to a wrong account | Guardrail | Platform | 0 | payment\\\_returned, wrong\\\_account\\\_reported | Risk |
| Payments without a passed or confirmed name check | Guardrail | Platform | 0 | payment\\\_sent | Risk |
| Payments to a changed IBAN before the second approval | Guardrail | Platform | 0 | payee\\\_bank\\\_changed, payee\\\_bank\\\_change\\\_approved | Risk |
| Payments released without the required approval | Guardrail | Platform | 0 | payment\\\_sent | Risk |
| Support tickets per 100 bills paid | Guardrail | Consumer | No rise month on month | support\\\_ticket\\\_created | Operations |
| Share of bills read from ZATCA XML | Watched | Platform | None; should rise with ZATCA's waves | bill\\\_extracted | Payments engineering |

  

## **6. Risks, compliance & dependencies**

**Money going to the wrong account or out twice is blocked by requirements, not left to each screen:** BP-04 (duplicates), BP-05 to BP-07 (supplier list, name check, IBAN-change lock), BP-08 and BP-17 (maker and checker) and BP-18 (limits). Three risks need more than a requirement:

|  |  |
| :-: | :-: |
| Risk | Mitigation |
| A fake "our bank details changed" email | Beyond the IBAN-change lock (BP-07), the app advises calling the supplier on a known number before approving, as Ramp does |
| Over-promising on ZATCA | Bill Pay does not check invoices with ZATCA, so it says "read from e-invoice", never "verified by ZATCA" or "VAT guaranteed". ZATCA's guidelines tie VAT deduction to clearance: "Uncleared invoices will not be eligible for VAT deduction" |
| A malicious file uploaded as an invoice | The invoice reader (PL-03) treats every file as untrusted input |

**Dependencies:** open questions 2 and 7 (name check access, payee screening); two new permissions and bills as a request type in the approval engine; payables through the first accounting system's API (BP-15); receipt AI extended to invoice fields.

  
  
  

## **7. Rollout & roadmap**

**Bill Pay ships first to an invite-only pilot of existing clients, and opens to all clients only after the safety gate holds.** Existing clients need no new onboarding, and their supplier payments already run through Darb's transfers.

Both gates are proposals and use the numbers from section 5; Darb sets the pilot size.

  
  
  
  

## **8. Prototype**

**The prototype proves the three hardest promises: an e-invoice becomes a correct draft without typing, a changed IBAN can't move money, and the arrival date shown is the real one.** Link: to be added once built.

**Two-minute demo path**

1.  Forward two invoices to the bills inbox: a PDF/A-3 with XML and a phone photo. One draft is marked "from e-invoice", the other asks to check its fields (BP-01 to BP-03).
2.  Upload the first invoice again; it is flagged as a duplicate (BP-04).
3.  Add the supplier: the name check passes. Change its IBAN: payments pause until a second user approves (BP-05 to BP-07).
4.  Put three bills (the two new ones and one saved earlier) in a run on a date. The app shows the rail and arrival per bill; a SAR 45,000 bill submitted on Thursday afternoon shows Sunday (BP-09, BP-10, BP-18).
5.  The approver approves the run on mobile, with each invoice beside its amount (BP-08, BP-17).
6.  Show what the supplier receives and what lands in the accounting system (BP-13 to BP-15).
7.  End on the bills view: what is owed per supplier, with a SADAD bill in the same list (BP-11, BP-12).

**Real vs mocked:** screens, bill statuses, approval logic, duplicate check, cut-off rules and reading a sample ZATCA XML are real. OCR, the name check, payment rails, email delivery and accounting sync are mocked with fixed responses.

  
  

## **9. Open questions & assumptions**

**Seven questions need Darb's input; each has the assumption this PRD uses until it is answered.**

|  |  |  |
| :-: | :-: | :-: |
| \\\# | Question | Assumption used meanwhile |
| 1 | Does this extend the Bill Pay (SADAD) page and menu item Darb has today, or is it a separate product? | It extends it: same menu item, one bills list |
| 2 | Can Darb send transfers up to SAR 20,000 over instant payments (sarie), and use their account-name verification? | Yes to both |
| 3 | What is the cut-off for sending large transfers over SARIE? | The same as for top-ups: 3:58 PM, Sunday–Thursday |
| 4 | Is Bill Pay free, or charged per payment? | Free within current plans; Darb keeps earning from cards and Enterprise, with payment fees possible later (proposal) |
| 5 | Which approval thresholds apply to bills by default? | The same thresholds as transfers |
| 6 | Which accounting system gets bill sync first? | Odoo or Zoho Books, both with Darb setup guides; picked by client usage |
| 7 | What screening does a new supplier account need before payment? | Darb's existing compliance checks apply to every new payee |

  
  
  
  
  

## **Appendix**

### **API sketch**

Illustrative only; engineering owns the real contract.

|  |  |  |
| :-: | :-: | :-: |
| Call | What it does | Capability |
| POST /bills | Create a draft bill from a file (PDF, image, XML) or by hand; returns the extracted fields, their source and any duplicate | PL-01, PL-03 |
| GET /bills?status=\\\&due\\\_before= | List bills for the bills view | PL-01 |
| POST /bills/{id}/submit | Send a bill to Darb's existing approval engine | PL-01 |
| POST /payees | Add a supplier; runs IBAN validation and the name check | PL-02 |
| PATCH /payees/{id}/bank-account | Change an IBAN; the supplier stays blocked until a second person approves | PL-02 |
| POST /payment-runs | Schedule one or more approved bills for a date; returns the expected arrival per bill | PL-04 |
| GET /payment-runs/{id} | Status of each payment in a run | PL-04 |
| Events | bill.approved, payment.sent, payment.settled, payment.failed, payee.bank\\\_changed | PL-01, PL-04, PL-05 |

### **Glossary**

|  |  |
| :-: | :-: |
| Term | Meaning |
| Instant payments (sarie) | SAMA's instant payment system: 24/7, up to SAR 20,000 |
| SARIE | SAMA's large-value transfer system: banking hours |
| ZATCA e-invoice | A tax invoice cleared by ZATCA, sent as XML or as a PDF/A-3 with the XML embedded |
| P0 / P1 | Must have for launch / should have for launch |

### **Sources**

All sources were opened Oct 9–11, 2026. The full research, with the exact quote behind each claim, is in the [Darb product dossier](https://claude.ai/code/artifact/e5f84494-c970-4a8c-bffd-945cbed368a4) and the [competitor knowledge base](https://claude.ai/code/artifact/baa8013c-11d1-4b71-9482-2bfbb34f180a), which also sources every cell of the section 2 table.

**Darb:** [SADAD bill payments (Bill Pay)](https://darbpay.com/features/sadad-bill-payments) · [Local transfers](https://darbpay.com/products/local-transfers) · [Accounting sync](https://darbpay.com/features/accounting-integrations) · [Security](https://darbpay.com/company/security) · [Facility management](https://darbpay.com/solutions/facility-management) · [Payable-turnover blog](https://darbpay.com/resources/blog/boosting-payable-turnover-ratio-how-saudi-companies-accelerate-supplier-payments) · [Top-up help (SARIE hours)](https://darbpay.com/help-center/transaction/top-up-wallet) · [Odoo guide](https://darbpay.com/help-center/accounting-integrations/odoo-integration) · [Zoho Books guide](https://darbpay.com/help-center/accounting-integrations/zoho-books) · [CEO's LinkedIn (SADAD and subwallet launches)](https://www.linkedin.com/in/abulmohsenalbabtain/recent-activity/all/) · [Darb LinkedIn, Oct 6, 2026](https://www.linkedin.com/feed/update/urn:li:activity:7513193953815511040/)

**Regulators and market:** [SAMA payments study 2021](https://www.sama.gov.sa/en-US/Documents/National_Payments_Usage_Study_en.pdf) · [Visa SME survey (Zawya)](https://www.zawya.com/en/press-release/research-studies/visa-report-highlights-opportunity-to-connect-digital-payments-with-business-operations-for-saudi-smes-1428261) · [ZATCA Wave 25](https://zatca.gov.sa/en/MediaCenter/News/Pages/Wave25-E-invoicing.aspx) · [ZATCA E-Invoicing Detailed Guidelines](https://zatca.gov.sa/en/E-Invoicing/Introduction/Guidelines/Documents/E-Invoicing_Detailed__Guideline.pdf) · [SAMA sarie](https://www.sama.gov.sa/en-US/payment/Pages/SARIE.aspx) · [SAMA news on recipient verification](https://sama.gov.sa/en-US/MediaCenter/News/Pages/news-649.aspx) · [SAMA open banking licences](https://www.sama.gov.sa/en-US/MediaCenter/News/Pages/news-1136.aspx)

**Competitors:** [How Ramp makes money](https://support.ramp.com/how-ramp-makes-money) · [How Ramp uses Bill Pay](https://ramp.com/blog/how-ramp-uses-ramp-bill-pay) · [Ramp: managing bills](https://support.ramp.com/managing-bills-and-payments-on-bill-pay) · [Ramp: bill pay fraud](https://support.ramp.com/bill-pay-fraud) · [SiFi pricing](https://www.sifi.app/en/pricing/) · [Wafeq payout automation  
](https://www.wafeq.com/en-sa/payout-automation)

# Darb Bill Pay - PRD V3**  
**

# **Darb Bill Pay — PRD v1**

Oct 11, 2026 · @Abdulrahman · Draft for review

## **0. Overview**

**Darb Bill Pay turns a supplier invoice into an approved, scheduled payment, paid from the client's Darb balance over Saudi rails.** It extends today's Bill Pay (SADAD) to supplier invoices and reuses Darb's balance, approvals and transfers.

|  |  |
| :-: | :-: |
| Question | Answer |
| \*\*Who is it for?\*\* | Existing Darb clients who already pay suppliers by local transfer: the finance admin who prepares payments, the approvers who release them, and the accountant who closes the books |
| \*\*Why does Darb win?\*\* | No Saudi spend platform we found runs the full loop from invoice to payment for SMEs. Darb already holds the money, the approval rules and the rails; the invoice side is the missing piece |

**The MVP in three parts**

  - **Capture:** upload or forward an invoice; Bill Pay reads its ZATCA XML if present, else uses OCR.
  - **Control:** supplier list with IBAN, name check and IBAN-change lock, plus Darb's approval rules.
  - **Pay:** now, on a date or in a run; SADAD bills in the same list; each payment syncs to accounting with its invoice.

**North Star:** supplier bills paid on time through Darb per month.

## **1. Problem & why now**

**Darb already pays suppliers three ways (a vendor-locked card, an approved SARIE transfer, SADAD for registered billers), but each starts from a payment, not the invoice.** Reading invoices, tracking what is due and proving what was paid still happen outside Darb.

**Paying a supplier invoice today and with Bill Pay** (our reading of Darb's pages, not a Darb statement):

|  |  |
| :-: | :-: |
| Pain | Evidence |
| Supplier payments are most of the money businesses move | SAMA payments study, 2021: "Payment to suppliers (B2B) account for 50% of total payments by volume and 76% of total payments by value" |
| SMEs lose track of what they owe | Visa survey of 262 Saudi SMEs: 30% struggle to track outstanding invoices; only 45% use an integrated payment-and-business tool |
| Slow approvals cost money | Darb's own blog: slow manual approval of "each … maintenance invoice" delays supplier payments and loses early-payment discounts |

**Why now**

  - **The rails are built and the direction is named.** SADAD went live Sep 28, 2026, subwallets Sep 20; on Oct 6 Darb called itself "corporate cards, expense management, and bill payments together in one platform".
  - **Invoices are becoming data.** ZATCA Wave 25 brings taxpayers with VAT revenue above SAR 187,500 into e-invoicing's integration phase "by no later than February 1, 2027".
  - **Competitors are moving, and Darb holds the money.** SiFi lists "Invoice management (coming soon)"; Wafeq sells payouts to Saudi enterprises. Most Saudi accounting tools only record bills, and we found no open banking licence for starting payments from a client's bank.

## **2. Market & benchmark insights**

**No product we found runs the full invoice-to-payment loop for Saudi SMEs from a SAMA-licensed balance.** Global tools have it but don't serve Saudi Arabia; local and regional players each cover part. We benchmark one per type: global reference (Ramp), regional peer with Darb's model (Pemo), Saudi accounting (Wafeq) and direct Saudi rival (SiFi).

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| Stage | Ramp | Pemo | Wafeq | SiFi | Darb Bill Pay MVP |
| Serves Saudi businesses | ❌ | ⚠️ cards only | ✅ | ✅ | ✅ |
| Capture invoices (email, upload, OCR) | ✅ | ✅ | ✅ | ❌ "coming soon" | ✅ |
| Read the ZATCA e-invoice XML | n/a | ? | ? (OCR only found) | ? | ✅ |
| Supplier list with account-name check | ✅ | ? | ⚠️ list, no name check | ✅ | ✅ |
| Approval rules before money moves | ✅ | ⚠️ UAE only | ⚠️ payment release Enterprise only | ✅ paid plan | ✅ reuses Darb's |
| Schedule and batch payments | ✅ | ? | ⚠️ batch claimed (Enterprise); no scheduling found | ? | ✅ |
| Pay Saudi suppliers by bank transfer | ❌ | ❌ AED, UAE only | ⚠️ Enterprise, client's SAB or Al Rajhi account | ✅ by IBAN | ✅ SARIE; instant payments (sarie) to confirm |
| SADAD bills in the same list | n/a | ? | ❌ users have asked | ? | ✅ |
| Bills sync to accounting as payables | ✅ | ? | ✅ it is the ledger | ⚠️ payments sync as expenses | ⚠️ payment + invoice (P0), bill sync (P1) |
| \*\*What Darb takes\*\* | The core loop, clear statuses, a separate release step; no software fee | Bill pay fits on top of cards and a wallet; a threat if it brings it to KSA | Capture is table stakes; more partner than rival | Supplier directory and name check are needed for parity | The full loop in KSA, plus e-invoice XML and SADAD in one list |

✅ has it · ⚠️ partly · ❌ not offered · ? not found in public sources (checked Oct 9–10, 2026).

**The gap Darb takes:** the full loop for Saudi SMEs from a SAMA-licensed balance, with approvals built in; importing suppliers' ZATCA XML into payables, which no Saudi spend or SME accounting product we found does publicly (Oct 2026); and supplier invoices and SADAD bills in one list under one approval policy.

  
  
  
  
  
  
  

## **3. Part A — Platform PRD**

**Bill Pay reuses seven capabilities Darb already runs and adds five new ones to the platform, each needed by at least one more Darb product.**

**Why a Platform PRD and a Consumer PRD.** Darb already runs one money layer under several products: cards, transfers and SADAD share one balance, and transfers use manager-chain approvals. Money controls (who releases money, IBAN checks, limits, audit) belong there, so every product inherits them. Engineering and risk judge Part A on reliability; product and business judge Part B on adoption. To avoid over-engineering, a capability enters Part A only if two or more Darb products need it within a year.

### **New capabilities**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| ID | Capability | What it does | How Bill Pay uses it | Who else reuses it | Non-functional bar |
| PL-01 | \*\*Bills ledger\*\* | One record per bill: supplier, invoice number, dates, amounts, VAT, file, status. The source of truth for what is owed | Every bill, whatever its source, lands here and moves through one set of statuses | SADAD bills, international transfers, AP reports | Every status change logged with who and when; amounts locked after approval (an edit restarts approval) |
| PL-02 | \*\*Supplier registry\*\* | Saved suppliers with IBAN, bank, VAT number and CR (commercial registration); name check before the first payment; a lock on IBAN changes | Pay a supplier without retyping the IBAN | Local and international transfers, future payroll | IBAN format and checksum validated; an IBAN change needs a second person and a new name check before money moves |
| PL-03 | \*\*Invoice reader\*\* | Reads the ZATCA XML inside a PDF/A-3 or a standalone XML; falls back to OCR; flags duplicates | Turns an uploaded or forwarded file into a draft bill | Expense receipts and VAT reports (TRN extraction today) | Files treated as untrusted input; each field marked XML or OCR; duplicate check on the invoice's unique ID, or supplier + invoice number |
| PL-04 | \*\*Payment scheduler\*\* | Executes payments on a chosen date, alone or as a run of several bills, on the right rail | Pay now, pay on a date, pay a batch | Scheduled transfers, international transfers, subwallet top-ups | A payment is never sent twice; balance checked before each run; cut-offs respected (below) |
| PL-05 | \*\*Payment notices\*\* | Tells the supplier a payment was sent (invoice number, amount, expected arrival) and alerts the client (due soon, failed) | Supplier notice; due and failure alerts | Transfers, SADAD, international transfers | Sent only after the payment leaves; never includes bank details |

**Rails the scheduler must respect.** Instant payments (sarie): 24/7 up to SAR 20,000, with recipient account verification; Darb's access is open question 2. Above SAR 20,000, SARIE settles same day in banking hours only (Darb's top-up help gives a 3:58 PM cut-off, Sunday–Thursday), so a large bill approved Thursday afternoon arrives Sunday; the app shows that date before approval.

### **Platform rules (apply to every product)**

  - **Never pay twice:** each payment carries a unique request key, so a retry cannot send money again.
  - **Maker and checker:** whoever creates or edits a bill or supplier cannot approve it alone. On by default with two or more approvers; a one-person company can turn it off (logged). It matches Darb's promise, "Not a riyal leaves without your approval".
  - **Limits and cancellation:** per-payment and daily limits set by the admin apply to every product, and a scheduled payment can be cancelled until it is sent.
  - **Full audit trail:** every create, edit, approve and pay event keeps who, when, and the before and after values.
  - **Data stays in Saudi Arabia,** as Darb's security page already commits: "hosted within the Kingdom of Saudi Arabia".

  
  

## **4. Part B — Consumer PRD**

**"Consumer" = the Darb client company and its people, plus the supplier who gets paid.** Part B is their experience on top of the platform: bill inbox, review, approval, payment and what the supplier receives.

### **Personas**

Launch client: a facility-management firm paying HVAC, lift and landscaping contractors, one of the industries Darb already targets.

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| Persona | Role in Darb today | Job in Bill Pay | Pain today |
| \*\*Finance admin\*\* (prepares) | Account Manager | Collects invoices, checks drafts, sets the pay date or run, submits | Retypes every invoice and IBAN into a transfer |
| \*\*Approver\*\* (owner or manager) | Manager in the approval chain | Approves bills and runs, often from the app; approval releases the payment | Approves a transfer without seeing the invoice behind it |
| \*\*Accountant\*\* | View-only accountant | Closes the month, files VAT | Matches payments to invoices by hand |
| \*\*Supplier\*\* | None (no Darb account) | Gets paid on time and knows it | Calls to ask whether invoice 123 was paid |

### **MVP scope**

**In the MVP:** everything in the requirements table below, BP-01 to BP-18 (BP-15 and BP-16 are P1). **Left out, and why:**

|  |  |  |
| :-: | :-: | :-: |
| Feature | When | Why |
| Recurring payments (rent, retainers) | Next | 25% of Ramp's bills used recurring; the single-bill loop comes first |
| Bill sync to the other systems, two-way sync | Next | Built after the first system proves the pattern |
| Auto-pay rules, supplier portal, Darb-to-Darb payments | Later | Auto-pay removes the human approval; the portal is a second product |
| Overseas suppliers | Out | Follows Darb's international transfers ("Coming soon") |
| PO matching, partial payments, credit notes | Out | Only 3% of Ramp's bills matched a PO |
| Supplier pulls the money (direct debit) | Out | Hands the supplier control of the client's money |
| Pay from the client's own bank | Out | No open banking payment-initiation licence found in KSA |

### **Main journey**

Statuses follow Ramp's; an unpaid bill past due also shows Overdue.

Unhappy paths (unclear fields, duplicates, name mismatch, changed IBAN, short balance, failed or rejected payments, cancellation) are in the acceptance criteria of BP-03, 04, 06, 07, 08, 10 and 18.

  
  
  
  
  
  
  
  

### **Requirements**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| ID | Pri. | Requirement | Acceptance criteria |
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

  
  
  
  

## **5. Goals, metrics & tracking**

**North Star: supplier bills paid on time through Darb per month.** It combines adoption (bills flow through Darb) and value (on time) in one number. On time = settled by the due date, or within 30 days of issue if there is none (a product decision).

**Objectives:**

O1 make Darb the place clients pay supplier invoices · 

O2 move suppliers' money safely · 

O3 remove retyping. Targets are proposals for the first two quarters, calibrated with Darb's data. Events are logged once at the platform layer, so every product reads them the same way.

  

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| Metric | Type | Layer | Target (proposed) | Events | Owner |
| Supplier bills paid on time through Darb per month | North Star | Consumer | Grows every month | bill\\\_created, payment\\\_settled | Product |
| Companies paying 5+ supplier bills a month | O1 | Consumer | 150 (base: clients already sending local transfers) | payment\\\_settled | Product |
| Bills paid on time | O1 | Consumer | 70% | bill\\\_due, payment\\\_settled | Product |
| Median time from bill created to approved | O1 | Consumer | Under 24 hours | bill\\\_created, bill\\\_approved | Product |
| New suppliers whose name check returns a result | O2 | Platform | 95% | payee\\\_name\\\_checked | Risk |
| Payments that succeed on the first attempt | O2 | Platform | 99.5% | payment\\\_sent, payment\\\_failed, payment\\\_settled | Payments engineering |
| Bills submitted without editing an extracted field | O3 | Platform | 80% | bill\\\_extracted, bill\\\_field\\\_edited, bill\\\_submitted | Payments engineering |
| Duplicate payments sent | Guardrail | Platform | 0 | bill\\\_duplicate\\\_flagged, bill\\\_duplicate\\\_dismissed, payment\\\_sent | Risk |
| Payments to a wrong account | Guardrail | Platform | 0 | payment\\\_returned, wrong\\\_account\\\_reported | Risk |
| Payments without a passed or confirmed name check | Guardrail | Platform | 0 | payment\\\_sent | Risk |
| Payments to a changed IBAN before the second approval | Guardrail | Platform | 0 | payee\\\_bank\\\_changed, payee\\\_bank\\\_change\\\_approved | Risk |
| Payments released without the required approval | Guardrail | Platform | 0 | payment\\\_sent | Risk |
| Support tickets per 100 bills paid | Guardrail | Consumer | No rise month on month | support\\\_ticket\\\_created | Operations |
| Share of bills read from ZATCA XML | Watched | Platform | None; should rise with ZATCA's waves | bill\\\_extracted | Payments engineering |

  
  
  
  

## **6. Risks, compliance & dependencies**

**Wrong-account and double payments are blocked by requirements, not left to each screen:** BP-04 (duplicates), BP-05 to BP-07 (supplier list, name check, IBAN lock), BP-08 and BP-17 (maker and checker), BP-18 (limits). Three risks need more:

|  |  |
| :-: | :-: |
| Risk | Mitigation |
| A fake "our bank details changed" email | Beyond the IBAN-change lock (BP-07), the app advises calling the supplier on a known number before approving, as Ramp does |
| Over-promising on ZATCA | Bill Pay does not check invoices with ZATCA, so it says "read from e-invoice", never "verified by ZATCA" or "VAT guaranteed". ZATCA's guidelines tie VAT deduction to clearance: "Uncleared invoices will not be eligible for VAT deduction" |
| A malicious file uploaded as an invoice | The invoice reader (PL-03) treats every file as untrusted input |

**Dependencies:** open questions 2 and 7 (name check access, payee screening); two new permissions and bills as a request type in the approval engine; payables through the first accounting system's API (BP-15); receipt AI extended to invoice fields.

  
  
  

## **7. Rollout & roadmap**

**Bill Pay pilots with invited existing clients, who need no new onboarding and already pay suppliers through Darb, then opens to all once the safety gate holds.**

Both gates are proposals and use the numbers from section 5; Darb sets the pilot size.

  
  
  

## **8. Prototype**

**The prototype proves the three hardest promises: an e-invoice becomes a correct draft without typing, a changed IBAN can't move money, and the arrival date shown is the real one.** Link: to be added once built.

**Two-minute demo path**

1.  Forward two invoices to the bills inbox: a PDF/A-3 with XML and a phone photo. One draft is marked "from e-invoice", the other asks to check its fields (BP-01 to BP-03).
2.  Upload the first invoice again; it is flagged as a duplicate (BP-04).
3.  Add the supplier: the name check passes. Change its IBAN: payments pause until a second user approves (BP-05 to BP-07).
4.  Put three bills (the two new ones and one saved earlier) in a dated run. The app shows rail and arrival per bill; a SAR 45,000 bill submitted Thursday afternoon shows Sunday (BP-09, BP-10, BP-18).
5.  The approver approves the run on mobile, with each invoice beside its amount (BP-08, BP-17).
6.  Show what the supplier receives and what lands in the accounting system (BP-13 to BP-15).
7.  End on the bills view: what is owed per supplier, with a SADAD bill in the same list (BP-11, BP-12).

**Real vs mocked:** screens, bill statuses, approval logic, duplicate check, cut-off rules and reading a sample ZATCA XML are real. OCR, the name check, payment rails, email delivery and accounting sync are mocked with fixed responses.

  
  

## **9. Open questions & assumptions**

**Seven questions need Darb's input; each has the assumption this PRD uses until it is answered.**

|  |  |  |
| :-: | :-: | :-: |
| \\\# | Question | Assumption used meanwhile |
| 1 | Does this extend today's Bill Pay (SADAD) menu item, or is it a separate product? | It extends it: same menu item, one bills list |
| 2 | Can Darb send transfers up to SAR 20,000 over instant payments (sarie), and use their account-name verification? | Yes to both |
| 3 | What is the cut-off for sending large transfers over SARIE? | The same as for top-ups: 3:58 PM, Sunday–Thursday |
| 4 | Is Bill Pay free, or charged per payment? | Free within current plans; Darb keeps earning from cards and Enterprise, with payment fees possible later (proposal) |
| 5 | Which approval thresholds apply to bills by default? | The same thresholds as transfers |
| 6 | Which accounting system gets bill sync first? | Odoo or Zoho Books, both with Darb setup guides; picked by client usage |
| 7 | What screening does a new supplier account need before payment? | Darb's existing compliance checks apply to every new payee |

  
  
  
  
  

## **Appendix**

### **API sketch**

Illustrative only; engineering owns the real contract.

|  |  |  |
| :-: | :-: | :-: |
| Call | What it does | Capability |
| POST /bills | Create a draft bill from a file (PDF, image, XML) or by hand; returns the extracted fields, their source and any duplicate | PL-01, PL-03 |
| GET /bills?status=\\\&due\\\_before= | List bills for the bills view | PL-01 |
| POST /bills/{id}/submit | Send a bill to Darb's existing approval engine | PL-01 |
| POST /payees | Add a supplier; runs IBAN validation and the name check | PL-02 |
| PATCH /payees/{id}/bank-account | Change an IBAN; the supplier stays blocked until a second person approves | PL-02 |
| POST /payment-runs | Schedule one or more approved bills for a date; returns the expected arrival per bill | PL-04 |
| GET /payment-runs/{id} | Status of each payment in a run | PL-04 |
| Events | bill.approved, payment.sent, payment.settled, payment.failed, payee.bank\\\_changed | PL-01, PL-04, PL-05 |

### **Glossary**

|  |  |
| :-: | :-: |
| Term | Meaning |
| Instant payments (sarie) | SAMA's instant payment system: 24/7, up to SAR 20,000 |
| SARIE | SAMA's large-value transfer system: banking hours |
| ZATCA e-invoice | A tax invoice cleared by ZATCA, sent as XML or as a PDF/A-3 with the XML embedded |
| P0 / P1 | Must have for launch / should have for launch |

### **Sources**

All sources were opened Oct 9–11, 2026. The full research, with the exact quote behind each claim, is in the [Research & sources](about:blank) tab, which also sources every cell of the section 2 table.

**Darb:** [SADAD bill payments (Bill Pay)](https://darbpay.com/features/sadad-bill-payments) · [Local transfers](https://darbpay.com/products/local-transfers) · [Accounting sync](https://darbpay.com/features/accounting-integrations) · [Security](https://darbpay.com/company/security) · [Facility management](https://darbpay.com/solutions/facility-management) · [Payable-turnover blog](https://darbpay.com/resources/blog/boosting-payable-turnover-ratio-how-saudi-companies-accelerate-supplier-payments) · [Top-up help (SARIE hours)](https://darbpay.com/help-center/transaction/top-up-wallet) · [Odoo guide](https://darbpay.com/help-center/accounting-integrations/odoo-integration) · [Zoho Books guide](https://darbpay.com/help-center/accounting-integrations/zoho-books) · [CEO's LinkedIn (SADAD and subwallet launches)](https://www.linkedin.com/in/abulmohsenalbabtain/recent-activity/all/) · [Darb LinkedIn, Oct 6, 2026](https://www.linkedin.com/feed/update/urn:li:activity:7513193953815511040/)

**Regulators and market:** [SAMA payments study 2021](https://www.sama.gov.sa/en-US/Documents/National_Payments_Usage_Study_en.pdf) · [Visa SME survey (Zawya)](https://www.zawya.com/en/press-release/research-studies/visa-report-highlights-opportunity-to-connect-digital-payments-with-business-operations-for-saudi-smes-1428261) · [ZATCA Wave 25](https://zatca.gov.sa/en/MediaCenter/News/Pages/Wave25-E-invoicing.aspx) · [ZATCA E-Invoicing Detailed Guidelines](https://zatca.gov.sa/en/E-Invoicing/Introduction/Guidelines/Documents/E-Invoicing_Detailed__Guideline.pdf) · [SAMA sarie](https://www.sama.gov.sa/en-US/payment/Pages/SARIE.aspx) · [SAMA news on recipient verification](https://sama.gov.sa/en-US/MediaCenter/News/Pages/news-649.aspx) · [SAMA open banking licences](https://www.sama.gov.sa/en-US/MediaCenter/News/Pages/news-1136.aspx)

**Competitors:** [How Ramp makes money](https://support.ramp.com/how-ramp-makes-money) · [How Ramp uses Bill Pay](https://ramp.com/blog/how-ramp-uses-ramp-bill-pay) · [Ramp: managing bills](https://support.ramp.com/managing-bills-and-payments-on-bill-pay) · [Ramp: bill pay fraud](https://support.ramp.com/bill-pay-fraud) · [SiFi pricing](https://www.sifi.app/en/pricing/) · [Wafeq payout automation  
](https://www.wafeq.com/en-sa/payout-automation)

# Research & sources**  
**

# **Research & sources**

The research behind the PRD, with a link to every source and the exact words each claim rests on. All sources were opened Oct 9–11, 2026, from Darb's website, help centre, newsroom and LinkedIn pages, and from public pages of the products and regulators named. It has three parts:

  - [**Darb in plain words**](https://docs.google.com/document/d/1eoPirdvVi0Ez3WEWKbcms4i6G6ryOMVqzqOvSgVNmiw/edit#heading=h.5bx62422hzfv): a short guide to Darb's products, clients and recent releases.
  - [**Darb evidence (exact quotes)**](https://docs.google.com/document/d/1eoPirdvVi0Ez3WEWKbcms4i6G6ryOMVqzqOvSgVNmiw/edit#heading=h.uaocpfsxaj59): the quote and source behind each point, plus the flows, pricing and gaps.
  - [**Bill pay competitors**](https://docs.google.com/document/d/1eoPirdvVi0Ez3WEWKbcms4i6G6ryOMVqzqOvSgVNmiw/edit#heading=h.p3cp6wdd3arq): Ramp in depth, global benchmarks, Saudi and regional players, Saudi rails and rules.

## **Darb in plain words**

A short guide to Darb's product, built from every page of darbpay.com (about 150 pages: products, solutions, blog, help centre, newsroom, compare, rewards) and the LinkedIn pages of Darb and its leaders. Each point links to its source; the exact quotes are in the evidence section below.

### **Darb in one minute**

  - **What it is:** a business account for Saudi companies that combines company cards, budgets, approvals, bill payments and bank transfers. Its tagline: "Business spending. Under control." ([homepage](https://darbpay.com/en))
  - **Licence:** a SAMA-licensed e-money institution, not a bank. Clients keep their own bank and load money into Darb. ([security](https://darbpay.com/company/security), [homepage FAQ](https://darbpay.com/en))
  - **Who built it:** Abdulmohsen Al Babtain (CEO, Tamara co-founder) with Mohammed Chbeib (Head of Engineering, ex-Solarisbank). Founded 2025, live January 2026. ([about](https://darbpay.com/company/about), [LinkedIn](https://www.linkedin.com/in/abulmohsenalbabtain/details/experience/))
  - **Size:** "more than 1,000 Saudi companies" within six months of going live; a team of 11–50. ([about](https://darbpay.com/company/about), [LinkedIn](https://www.linkedin.com/company/darbpay/about/))
  - **Where it started:** fleets and fuel ("FinTech for field-based companies"). It now covers all company spend. ([licence post](https://www.linkedin.com/feed/update/urn:li:activity:7394042125505531904/))
  - **How it makes money:** the platform is free. Darb charges card fees, and Enterprise (ERP integration) is custom-priced. ([pricing](https://darbpay.com/pricing))
  - **Its pitch in one line:** control spending *before* it happens, not after. ([spend controls](https://darbpay.com/features/spend-controls))

### **The product map**

Darb has four product families. Almost everything is built around a **card**; the money-moving products (SADAD, transfers, subwallets) are newer. Each product name links to its page.

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| Family | Product | What it does, in one line | Status |
| Cards | \[Corporate cards\](https://darbpay.com/products/corporate-cards) | Physical and virtual Visa cards for people or teams, each with its own limit | Live |
| Cards | \[Procurement card\](https://darbpay.com/products/procurement-card) | Virtual cards locked to one vendor (ads, SaaS, suppliers, government fees) | Live |
| Cards | \[Virtual cards\](https://darbpay.com/features/virtual-cards) | Issued in one click; includes one-time "burner" cards that self-destruct after one supplier payment | Live |
| Cards | \[Petty cash card\](https://darbpay.com/products/petty-cash) | Replaces cash: a daily or trip budget that expires on its own | Live |
| Cards | \[Ads card\](https://darbpay.com/products/ads-card), \[Subscription card\](https://darbpay.com/subscription-card) | One card per ad platform or SaaS tool; freeze the card to cancel the subscription | Live |
| Cards | \[Rewards\](https://darbpay.com/rewards) | 2% uncapped cashback on eligible international spend; Signature cards add airport lounges and travel offers | Live |
| Control | \[Spend controls\](https://darbpay.com/features/spend-controls) | Limits, allowed merchant types, working hours, weekend blocks | Live |
| Control | \[Approval workflows\](https://darbpay.com/products/approval-workflows) | Requests go up the manager chain; amount thresholds decide who must approve | Live (no help article yet) |
| Control | \[Expense management\](https://darbpay.com/features/expense-management), \[Zero-touch\](https://darbpay.com/features/zero-touch-expenses) | Snap the receipt; AI reads supplier, VAT number and amount, then matches it to the payment | Live |
| Control | \[Accounting sync\](https://darbpay.com/features/accounting-integrations) | Pushes transactions into Odoo, Zoho Books, Daftra and Wafeq, already coded | Live |
| Money movement | \[SADAD bill payments\](https://darbpay.com/features/sadad-bill-payments) | Pay STC, electricity, government and ZATCA bills from the Darb balance | New (Sep 28, 2026) |
| Money movement | \[Local transfers\](https://darbpay.com/products/local-transfers) | Team requests a transfer to any Saudi bank account; the admin approves; money goes over SARIE | Live (no help article yet) |
| Money movement | \[Team wallets / subwallets\](https://darbpay.com/products/team-wallets) | A separate budget per branch, team or project, funded from the main balance | New (Sep 20, 2026) |
| Money movement | \[International transfers\](https://darbpay.com/products/international-transfers) | Pay overseas suppliers in 10 destinations, with a second approver | Coming soon |
| Fleet | \[Fuel card\](https://darbpay.com/products/fleet-card), \[Darb Medal\](https://darbpay.com/resources/newsroom/darb-medal) | Works at every Saudi station; driver photographs the odometer before fuelling | Live |
| Fleet | \[Station coverage\](https://darbpay.com/features/station-coverage) | Every station in KSA plus workshops; works across the GCC | Live |
| Fleet | \[Violation detection\](https://darbpay.com/features/violation-detection) | Daily traffic-fine checks with Muroor; alerts the fleet manager | Live |

Status is based on the menu, newsroom, LinkedIn and help centre. "No help article yet" means a product page exists but the help centre has no how-to for it ([help centre](https://darbpay.com/help-center)). One mismatch: the homepage carousel shows a SAR → USD transfer that "Arrives today", while the menu calls international transfers "Coming soon" ([homepage](https://darbpay.com/en)).

### **How a client uses Darb, start to finish**

1.  **Sign up online.** Enter the company's unified number (starts with 70), verify with Nafath, and upload the articles of association. ([sign-up](https://darbpay.com/help-center/getting-started/applying-and-signing-up))
2.  **Load money.** Transfer from the company bank to the client's own Darb IBAN. Under SAR 20,000 arrives instantly; larger amounts go by SARIE, same day in banking hours. ([top-up](https://darbpay.com/help-center/transaction/top-up-wallet))
3.  **Set up the team.** Invite cardholders or drivers, create groups or subwallets with budgets, and add vehicles. ([inviting](https://darbpay.com/help-center/user-management/inviting-cardholders), [groups](https://darbpay.com/help-center/groups/setting-up-groups))
4.  **Issue cards with rules.** Each card gets a limit, allowed merchant types and allowed hours. Fleet rules attach to the vehicle, not the card. ([card policy](https://darbpay.com/help-center/cards-management/set-up-card-policy), [fleet policy](https://darbpay.com/help-center/policy-management/create-fleet-card-policy))
5.  **Employees spend.** They use the card, Apple Pay or mada Pay; drivers unlock the card with an odometer photo first. ([fuel](https://darbpay.com/help-center/transaction/make-fuel-transaction))
6.  **Receipts come in.** The app asks for a photo; AI matches it to the payment. With the policy on, a card freezes if a receipt is 3 days late. ([receipts](https://darbpay.com/help-center/cards-management/require-receipts-and-card-freeze))
7.  **Finance closes the month.** Alerts flag issues, reports export to PDF or Excel, and transactions sync to the accounting system. ([alerts](https://darbpay.com/help-center/alerts-compliance/how-to-manage-alerts), [reports](https://darbpay.com/help-center/reports/transaction-report))

**What the dashboard looks like:** the help centre names these sections: Cards, Team (cardholders and drivers), Fleet, Policy, Transactions, Reports, Alerts, Compliance (traffic violations), Groups, Accounting, Billing (Darb's own fees) and Settings (Cards, Billing, Users, Notifications). Admins work on the web; employees and drivers use the app. ([how to access Darb](https://darbpay.com/help-center/log-in/how-to-access-darbpay))

**Roles that exist today:** Account Manager (full access), Viewer (read-only), Group Owner / Manager, Cardholder, Driver, and a view-only accountant. The help centre describes no "approver" or "payer" role. ([users](https://darbpay.com/help-center/settings/users-settings))

### **How Darb pays suppliers today, and what is missing**

Today Darb can pay a supplier three ways, but all of them start from a **payment**. None starts from the supplier's **invoice**.

**The three ways that exist:**

1.  **A card per supplier.** This is Darb's main answer: across its solutions pages, paying a vendor means giving the vendor its own card, e.g. "Create dedicated cards for poultry, produce, cleaning supplies" ([restaurants](https://darbpay.com/solutions/restaurants)), or a one-time "burner" card for a new supplier ([virtual cards](https://darbpay.com/features/virtual-cards)).
2.  **A bank transfer after approval.** An employee requests a transfer (who, how much, why), the admin approves, and the money goes to any Saudi bank over SARIE ([local transfers](https://darbpay.com/products/local-transfers), [about](https://darbpay.com/company/about)).
3.  **SADAD.** For billers such as STC, electricity, government and ZATCA: choose the biller, enter the bill number, review, confirm ([SADAD page](https://darbpay.com/features/sadad-bill-payments), [launch post](https://www.linkedin.com/in/abulmohsenalbabtain/recent-activity/all/)).

**What no Darb page mentions:**

  - Capturing a supplier's invoice *before* paying it (receipts are only captured *after* a card payment)
  - A supplier list with saved bank details (IBAN)
  - Due dates, payment terms (Net 30) or scheduled payments
  - Paying many invoices at once (batch)
  - Partial payments, or matching invoices to purchase orders
  - Syncing bills to accounting as payables (today only transactions sync)
  - An approver or payer role for bills

The help centre has no article on SADAD, transfers or approvals, and the blog never mentions IBANs, bank transfers or payment terms.

**How Darb itself talks about payables:** its blog explains accounts payable as "the money you owe your suppliers" and promises you'll "know exactly what you owe, to whom, and when", but the answer it gives is cards ([liabilities post](https://darbpay.com/resources/blog/understanding-the-meaning-of-liabilities-in-accounting-how-darb-simplifies-finan)). Another post says slow manual approval of "each … maintenance invoice" delays supplier payments and loses early-payment discounts ([payable turnover post](https://darbpay.com/resources/blog/boosting-payable-turnover-ratio-how-saudi-companies-accelerate-supplier-payments)).

**So:** many suppliers (wholesalers, contractors, landlords, workshops) send an invoice and expect a bank transfer, not a card. That is the gap a Bill Pay product would fill. This conclusion is our reading of the sources; Darb has not stated it.

### **Who the clients are**

Two kinds of client show up again and again: **companies with people in the field** (vehicles, branches, sites) and **growing SMEs spending online** (ads, SaaS). Darb's site lists 13 target industries, but those pages name no customers; the named clients come from LinkedIn.

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| Client | Type | What Darb says they use it for | Source |
| Coca-Cola Bottling Co. of Saudi Arabia | Distribution | Fuel, purchases, field spend, matching invoices to transactions | \[LinkedIn\](https://www.linkedin.com/feed/update/urn:li:activity:7475452866787225602/) |
| GASCO | Gas distribution | Team cards instead of cash and scattered invoices | \[LinkedIn\](https://www.linkedin.com/feed/update/urn:li:activity:7472179592779370496/) |
| Kudu (350+ branches) | Restaurants | Purchases, branch spend, delivery fuel | \[LinkedIn\](https://www.linkedin.com/feed/update/urn:li:activity:7482386772589436928/) |
| Tanmiah Food | Food, 4 GCC countries | Fleet and team spend across countries in one platform | \[LinkedIn\](https://www.linkedin.com/feed/update/urn:li:activity:7469636865424257024/) |
| Salam | Telecom | Tech purchases, travel, invoices, approvals | \[LinkedIn\](https://www.linkedin.com/feed/update/urn:li:activity:7479836356878221312/) |
| Makkah Construction | Construction, hospitality | Projects, purchases, \*\*suppliers\*\*, fuel | \[LinkedIn\](https://www.linkedin.com/feed/update/urn:li:activity:7484902443257016321/) |
| Theeb | Car rental | Fuel at any station, maintenance | \[LinkedIn\](https://www.linkedin.com/feed/update/urn:li:activity:7461686950098255872/) |
| SUCCO (53 vehicles) | Manufacturing | Fuel: 15% saved; reconciliation from 18 hours to 12 minutes | \[case study\](https://darbpay.com/case-studies/succo) |
| Food Smith, Al Wazn Al Mithali, Faheem, Lorenzo, Hawa | SMEs | Ads, subscriptions, petty cash, per-branch cards | \[LinkedIn\](https://www.linkedin.com/company/darbpay/posts/?feedView=all), \[homepage\](https://darbpay.com/en) |

**Industries Darb targets** ([solutions menu](https://darbpay.com/en)): logistics, delivery, construction, facility management, technology, marketing agencies, law firms, real estate, healthcare, charities (50% off for eligible nonprofits, [charities](https://darbpay.com/solutions/charities)), tourism, restaurants, car rental.

**Supplier spend in these industries:** facility management pays HVAC, lift and landscaping contractors; healthcare buys medical equipment and pharmaceuticals; tourism pays venues and caterers; restaurants buy produce and poultry ([facility management](https://darbpay.com/solutions/facility-management), [healthcare](https://darbpay.com/solutions/healthcare), [tourism](https://darbpay.com/solutions/tourism), [restaurants](https://darbpay.com/solutions/restaurants)). These are good personas for Bill Pay.

### **How Darb thinks**

The same few ideas run through every page, blog post and LinkedIn post.

|  |  |  |
| :-: | :-: | :-: |
| Idea | In Darb's words | Source |
| Control before the money moves | "The system enforces your policy at the terminal — before the money moves, not after." | \[blog\](https://darbpay.com/resources/blog/streamline-your-business-spending-the-power-of-employee-expense-cards-and-virtua) |
| Nothing leaves without approval | "Not a riyal leaves without your approval." | \[local transfers\](https://darbpay.com/products/local-transfers) |
| No chasing receipts at month-end | "Month-end becomes a review, not a rebuild." | \[blog\](https://darbpay.com/resources/blog/streamline-your-business-spending-the-power-of-employee-expense-cards-and-virtua) |
| One card per job or vendor | "One vendor, one card" | \[subscription card\](https://darbpay.com/subscription-card) |
| Stop fraud and leakage | "Every Medal payment requires the live odometer reading" | \[Medal\](https://darbpay.com/resources/newsroom/darb-medal) |
| Keep your bank; Darb sits on top | "Keep your bank. Darb handles the spending admin" | \[homepage\](https://darbpay.com/en) |
| Built for Saudi | SAMA-licensed, data kept in KSA, Arabic-first; integrations with Nafath, Muroor, SADAD | \[security\](https://darbpay.com/company/security), \[launch\](https://darbpay.com/resources/newsroom/launch) |
| One place for everything | "البطاقات والفواتير والموافقات والتقارير كلها في مكان واحد" (cards, invoices, approvals and reports, all in one place) | \[LinkedIn\](https://www.linkedin.com/feed/update/urn:li:activity:7475837918654210048/) |

**The CEO's own lens:** "Risk, Cost and Time are all that matters to Payments" ([LinkedIn](https://www.linkedin.com/in/abulmohsenalbabtain/recent-activity/all/)). Every Bill Pay decision can be judged this way: does it make paying a supplier safer, cheaper or faster?

**Brand voice:** short, confident, Saudi dialect in Arabic. The tagline "درب يضبطها" (Darb sorts it out) appears on almost every post ([LinkedIn](https://www.linkedin.com/company/darbpay/posts/?feedView=all)).

### **What shipped recently and what is coming**

Darb ships something visible about once a month. The newest releases all move money (SADAD, subwallets), and on Oct 6 Darb started calling itself a platform for cards, expense management **and bill payments**. Bill Pay is the next step on that path.

|  |  |  |
| :-: | :-: | :-: |
| When | What | Source |
| Oct 6, 2026 | "corporate cards, expense management, and bill payments together in one platform" | \[LinkedIn\](https://www.linkedin.com/feed/update/urn:li:activity:7513193953815511040/) |
| Sep 28, 2026 | SADAD bill payments live | \[LinkedIn\](https://www.linkedin.com/in/abulmohsenalbabtain/recent-activity/all/) |
| Sep 20, 2026 | Subwallets live | \[LinkedIn\](https://www.linkedin.com/in/abulmohsenalbabtain/recent-activity/all/) |
| Aug 16, 2026 | Odoo sync | \[LinkedIn\](https://www.linkedin.com/feed/update/urn:li:activity:7494718518681239552/) |
| Jul 2026 | SME offer: no platform fees, 5 free cards | \[newsroom\](https://darbpay.com/resources/newsroom/sme-offer) |
| May 21, 2026 | Darb Medal (fuel payment device) | \[newsroom\](https://darbpay.com/resources/newsroom/darb-medal) |
| Apr 2026 | mada Pay; mobile app on iOS and Android | \[newsroom\](https://darbpay.com/resources/newsroom/mada-pay-support), \[LinkedIn\](https://www.linkedin.com/feed/update/urn:li:activity:7447908708094894080/) |
| Jan 2026 | Public launch | \[newsroom\](https://darbpay.com/resources/newsroom/launch) |
| \*\*Next\*\* | International transfers ("Coming soon") | \[product page\](https://darbpay.com/products/international-transfers) |

Other hints: the CEO is writing about "the opportunity ahead for credit cards" ([LinkedIn](https://www.linkedin.com/in/abulmohsenalbabtain/recent-activity/all/)), and Darb has no open jobs on LinkedIn right now ([jobs](https://www.linkedin.com/company/darbpay/jobs/)).

## **Darb evidence (exact quotes)**

Every statement below cites its source and quotes the words it rests on. Anything without a source is marked as unverified.

### **At a glance**

Darb is a SAMA-licensed business account for Saudi companies: corporate cards, team wallets, approvals, SADAD bills and bank transfers. Fleet fuel is one product line among several. The biggest finding for Bill Pay: **Darb already has a page called "Bill Pay" (SADAD) and already sends approved supplier transfers over SARIE.** The new Bill Pay product extends these; it does not start from zero.

|  |  |  |
| :-: | :-: | :-: |
| What | Exact words from the source | Source |
| What Darb is | "Corporate cards and expense management, built for Saudi businesses." | \[Darb homepage\](https://darbpay.com/en) |
| Positioning | "The all-in-one business account" | \[Darb homepage\](https://darbpay.com/en) |
| Licence | "licensed by the Saudi Central Bank under Licence No. 30/Sh M/1447 to provide payment services as an Electronic Money Institution" | \[Darb homepage\](https://darbpay.com/en) |
| Scale | "Within six months of going live, more than 1,000 Saudi companies were running their spend on Darb." | \[About\](https://darbpay.com/company/about) |
| Bill pay today | Menu item "Bill Pay: Pay government bills and vendors via SADAD, in one place." | \[Darb homepage\](https://darbpay.com/en) |
| Supplier transfers today | "Connected to SARIE: We decided to solve the approval problem before the transfer happened. We built an approval system that triggers the transfer to the supplier's account." | \[About\](https://darbpay.com/company/about) |
| How it sits next to banks | "Keep your bank. Darb handles the spending admin" | \[Darb homepage FAQ\](https://darbpay.com/en) |

### **Company**

Darb (legal name Darb Pay for Information Technology) was founded in 2025, got its SAMA licence in November 2025 and went live in January 2026. It is a team of 11–50 in Riyadh, with an engineering lead in Berlin.

#### **Timeline**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| When | What happened | Exact words from the source | Source |
| Apr 2025 | CEO leaves Tamara | "Co‑Founder, Chief Product Officer / EVP Core, tamara, Feb 2020 - Apr 2025" | \[Abdulmohsen, LinkedIn experience\](https://www.linkedin.com/in/abulmohsenalbabtain/details/experience/) |
| Nov 2024 | Head of Engineering starts (before the company's founding year) | "Founding Member and Head of Engineering, Darb, Nov 2024 - Present" | \[Mohammed Chbeib, LinkedIn experience\](https://www.linkedin.com/in/mshbeab/details/experience/) |
| 2025 | Founded | "Founded 2025" | \[Darb LinkedIn About\](https://www.linkedin.com/company/darbpay/about/) |
| 2025 | Founding partnership | "The Berlin pact: I met Mohamed Chbieb in Berlin. Mohamed believed in the idea, and we started working." | \[About\](https://darbpay.com/company/about) |
| Nov 11, 2025 | SAMA licence announced | "Darb Pay for Information Technology has been officially licensed by the Saudi Central Bank (SAMA) to pioneer the digitization of vehicle expense management." | \[Darb LinkedIn post\](https://www.linkedin.com/feed/update/urn:li:activity:7394042125505531904/); also \[SPA news\](https://spa.gov.sa/en/N2441444) |
| Jan 2026 | Public launch | "Today marks the official launch of Darb — a corporate expense and fleet management platform built from the ground up for the Saudi market." | \[Newsroom: launch\](https://darbpay.com/resources/newsroom/launch) |
| Jan 2026 | CEO role starts | "Co-Founder, CEO, Darb, Jan 2026 - Present" | \[Abdulmohsen, LinkedIn experience\](https://www.linkedin.com/in/abulmohsenalbabtain/details/experience/) |
| By mid-2026 | 1,000 companies | "Within six months of going live, more than 1,000 Saudi companies were running their spend on Darb." | \[About\](https://darbpay.com/company/about) |

#### **Licence**

|  |  |  |
| :-: | :-: | :-: |
| Point | Exact words | Source |
| Type | "Darb received an EMI Major License from SAMA, in record time." | \[About\](https://darbpay.com/company/about) |
| Number | "licensed by the Saudi Central Bank under license number 30 / ش م / 1447" | \[Security\](https://darbpay.com/company/security) |
| Not a bank | "Is Darb a bank? No. Darb is a financial technology company licensed by the Saudi Central Bank to provide payment services within the scope of its license." | \[Security\](https://darbpay.com/company/security) |
| Client money | "Client funds are held in segregated accounts with a licensed Saudi bank" | \[Security\](https://darbpay.com/company/security) |

SPA describes the licence as "e-wallet solutions"; Darb's own site calls it an "EMI Major License". Both refer to the same licence.

#### **Why it was founded (the CEO's own words)**

*"Payments for ad campaigns were declined by the bank, supplier transfers took days only to bounce back, and even the simplest tasks required a branch visit." —* [*About*](https://darbpay.com/company/about)

Supplier payments are part of the founding problem. That makes Bill Pay core to Darb's story, not a side feature.

#### **Team**

Team size: "11-50 employees" and "65 associated members" ([LinkedIn About](https://www.linkedin.com/company/darbpay/about/)). The LinkedIn "People" list also mixes in staff from unrelated companies with "Darb" in their names, so treat that count loosely.

**Funding: not found.** No funding round appears on Darb's site or LinkedIn pages.

### **Products today**

Darb's site menu groups its products into four families: Cards & Expenses, Payments & Wallets, Fleet, and Platform, plus one "Coming soon" item ([homepage menu](https://darbpay.com/en)). The rows marked **bold** matter most for Bill Pay.

#### **Payments & Wallets**

|  |  |  |
| :-: | :-: | :-: |
| Product | What it does, in Darb's words | Source |
| \*\*Bill Pay (SADAD)\*\* | "STC, Mobily, Zain, Saudi Electricity, Ministry of Interior fees and ZATCA — settled through SADAD, recorded like every other transaction." Also: "Attach receipts directly to SADAD bills"; "Speak to Darb about your business's SADAD limit, subject to approval." | \[SADAD page\](https://darbpay.com/features/sadad-bill-payments) |
| \*\*Local transfers\*\* | "Transfer to any bank account in Saudi Arabia. Your team submits the request, and you have the final say." Flow: "Your team requests → You approve → The money arrives". Illustration shows beneficiary "Supplier account", reason "Office supplies". | \[Local transfers\](https://darbpay.com/products/local-transfers) |
| Team wallets / Subwallets | "Give every team, branch or project its own wallet and IBAN" (homepage). "A ⃁ 10,000 wallet means ⃁ 10,000 for the team—not ⃁ 10,000 per card." | \[Homepage\](https://darbpay.com/en), \[Team wallets\](https://darbpay.com/products/team-wallets) |
| Main balance top-up | Clients fund Darb by bank transfer to a unique IBAN: "Open the Top-Up Instructions panel to see your unique IBAN. Make a bank transfer from your company account to that IBAN." | \[Help: first top-up\](https://darbpay.com/help-center/getting-started/first-top-up-and-first-card) |

#### **Cards & Expenses**

|  |  |  |
| :-: | :-: | :-: |
| Product | What it does, in Darb's words | Source |
| Corporate cards | "Issue unlimited virtual and physical Visa cards for your team"; "Apply per-card limits and merchant-category controls before spending begins." | \[Homepage\](https://darbpay.com/en), \[Corporate cards\](https://darbpay.com/products/corporate-cards) |
| \*\*Procurement card\*\* | "Unlimited virtual cards for ads, SaaS, and vendor payments." "Issue a new card in one second. Lock it to a specific vendor, set a hard spending limit" | \[Procurement card\](https://darbpay.com/products/procurement-card) |
| \*\*Single-use cards for suppliers\*\* | "Paying a new supplier? Generate a one-time virtual card. The moment the payment clears, the card automatically destroys itself." | \[Virtual cards\](https://darbpay.com/features/virtual-cards) |
| Ads card | "Issue a virtual card for every campaign, earn up to 2% cashback" | \[Ads card\](https://darbpay.com/products/ads-card) |
| Subscription card | "Freeze the card and it's done. The payment bounces and the subscription ends" | \[Subscription card\](https://darbpay.com/subscription-card) |
| Petty cash card | "Issue a Darb card with the exact limit — they spend, you watch every riyal, and receipts match themselves." Per-diems that expire: "Driver to Dammam? ⃁ 500/day, expires Friday sunset." | \[Petty cash\](https://darbpay.com/products/petty-cash) |
| Expense management | "Darb extracts supplier, invoice and VAT details from each receipt"; "A card with a missing receipt is frozen after three days." | \[Expense management\](https://darbpay.com/features/expense-management) |
| Spend controls | Limits (daily, monthly, one-time), merchant categories, schedules: "Block weekends, restrict after-hours, or set custom schedules per team." | \[Spend controls\](https://darbpay.com/features/spend-controls) |
| Wallet payments | Apple Pay ("Darb controls still apply") and mada Pay ("All Darb corporate cards — fleet, petty cash, and procurement — are now officially supported on the mada Pay wallet") | \[Apple Pay\](https://darbpay.com/apple-pay), \[mada Pay news\](https://darbpay.com/resources/newsroom/mada-pay-support) |

#### **Fleet**

|  |  |  |
| :-: | :-: | :-: |
| Product | What it does, in Darb's words | Source |
| Fuel card | "Use the Darb Fuel Card at all fuel stations across Saudi Arabia, not just one selected network." "Restricted to fuel-station merchant categories by default." | \[Fleet card\](https://darbpay.com/products/fleet-card) |
| Darb Medal | "the first Visa-certified wearable payment device in the world built specifically for commercial vehicles. … It clips onto the car keys"; "Every Medal payment requires the live odometer reading" | \[Medal launch\](https://darbpay.com/resources/newsroom/darb-medal) |

#### **Platform**

|  |  |  |
| :-: | :-: | :-: |
| Product | What it does, in Darb's words | Source |
| \*\*Approval workflows\*\* | "Requests route to the right approver through the manager chain"; "Amount thresholds decide what needs approval"; "Darb supports approval on card transactions, bills and payments." | \[Approval workflows\](https://darbpay.com/products/approval-workflows) |
| \*\*Accounting sync\*\* | "One-click sync to Zoho, Odoo, Wafeq and more." The integrations page also names Dynamics 365 BC, SAP and Oracle. | \[Homepage menu\](https://darbpay.com/en), \[Integrations\](https://darbpay.com/features/accounting-integrations) |
| AI coding and VAT | "Darb's AI codes small transactions to the right expense account using the attached invoice." "AI extracts Tax Registration Numbers" | \[Expense management\](https://darbpay.com/features/expense-management), \[Zero-touch\](https://darbpay.com/features/zero-touch-expenses) |

#### **Coming soon**

|  |  |  |
| :-: | :-: | :-: |
| Product | What Darb says | Source |
| International transfers | "Coming soon: pay global suppliers from your Darb account." Product page: "Pay suppliers, overseas teams and business services"; "Ten destinations" (US, Europe, China, India, Philippines, Turkey, UAE, Egypt, Hong Kong, UK); "Initiated by finance team → Details validated → Second approver → Sent → Logged" | \[Homepage menu\](https://darbpay.com/en), \[International transfers\](https://darbpay.com/products/international-transfers) |

### **Flows, step by step**

These are the flows Darb documents publicly, in its own order. The two payment flows (local transfer and SADAD) are the closest to Bill Pay.

#### **1. Company sign-up and KYB (**[**help article**](https://darbpay.com/help-center/getting-started/applying-and-signing-up)**,** [**KYB article**](https://darbpay.com/help-center/getting-started/kyb-kyc-verification)**)**

1.  "Go to app.darbpay.com/client/signup"; use the business email and "National Unified Number (starting with 70)".
2.  "Your company's legal name will appear automatically based on your National Unified Number."
3.  The signatory confirms identity; a non-signatory uploads a "power of attorney letter".
4.  Phone verification by OTP, then Nafath: "open the Nafath app to confirm".
5.  "Upload your company Article of Association and Bylaws documents".
6.  "Review the summary of your application, agree to Darb's Terms and Conditions, then submit."

KYB checks include "commercial registration (CR)", "Tax and ZATCA registration information (if applicable)" and "Ownership structure and key shareholders".

#### **2. Funding the account (**[**top-up article**](https://darbpay.com/help-center/transaction/top-up-wallet)**)**

1.  "From the dashboard, click Top Up" to see "Bank Name, Beneficiary Name, IBAN, Bank Account Number".
2.  Transfer from the company bank: "Please transfer funds only from the registered corporate bank account."
3.  Settlement: IPS "Under 20,000 ⃁", "Available 24/7", "Instant"; SARIE "20,000 ⃁ and above", "9:00 AM – 3:58 PM Saudi time, Sun–Thu", "Same-day settlement", otherwise "Next working day".

#### **3. Local transfer to a supplier (**[**Local transfers**](https://darbpay.com/products/local-transfers)**)**

1.  "Anyone on your team can submit a transfer request: who it's for, how much, and why."
2.  "The request comes to you. Approve or decline. Nothing moves without your approval."
3.  "Once you approve, the money is transferred to the beneficiary's account at any Saudi bank."

The About page says this flow runs on SARIE: "We built an approval system that triggers the transfer to the supplier's account." ([About](https://darbpay.com/company/about))

#### **4. Paying a SADAD bill (**[**Darb LinkedIn post, Sep 28, 2026**](https://www.linkedin.com/in/abulmohsenalbabtain/recent-activity/all/)**, reposted by the CEO)**

The launch post (Arabic) gives the flow in four steps: "اختر المفوتر، أدخل رقم الفاتورة، راجع التفاصيل… وأكّد السداد"

1.  Choose the biller.
2.  Enter the bill number.
3.  Review the details.
4.  Confirm the payment.

After payment, per the [SADAD page](https://darbpay.com/features/sadad-bill-payments): "Attach receipts directly to SADAD bills" and "Sync SADAD payments with your accounting software".

#### **5. Approvals (**[**Approval workflows**](https://darbpay.com/products/approval-workflows)**)**

1.  "Employees and drivers request a new card or a limit increase from the Darb app."
2.  "Requests route to the right approver through the manager chain."
3.  "Amount thresholds decide what needs approval and what does not." The example policy sends ⃁ 2,000+ to a manager and ⃁ 7,500+ to finance.
4.  "Approvers have one inbox for everything pending", including "card transactions, bills and payments".

#### **6. Card spend and receipts (**[**receipt article**](https://darbpay.com/help-center/transaction/upload-receipt-after-transaction)**,** [**Expense management**](https://darbpay.com/features/expense-management)**)**

1.  "The employee makes a transaction."
2.  "Darb prompts the employee to upload a receipt." Options: the app, the camera, or "Email us back the receipt and we'll attach it to the transaction."
3.  "Darb matches the receipt to the transaction."
4.  If the receipt is missing on a Travel & Expense card with the policy on: "A card with a missing receipt is frozen after three days."

#### **7. Fleet fuelling (**[**fuel transaction article**](https://darbpay.com/help-center/transaction/make-fuel-transaction)**)**

1.  "Open the Darb mobile app" and "tap Unlock Card."
2.  "take a photo of the vehicle's odometer."
3.  "Once the odometer photo is accepted, your card will be unlocked and ready to use."
4.  "After the payment is completed, the card will return to its normal secure state."

#### **Roles**

Roles named in the help centre: "Account Manager — full access" and "Viewer — view-only access" ([Users settings](https://darbpay.com/help-center/settings/users-settings)); "Group Owner" and "Group Managers" ([Groups](https://darbpay.com/help-center/groups/setting-up-groups)); team members as "Cardholders" or "Drivers" ([Inviting cardholders](https://darbpay.com/help-center/user-management/inviting-cardholders)); an accountant "view-only access" that "Cannot approve spend" ([Zero-touch](https://darbpay.com/features/zero-touch-expenses)). No public page describes an approver or payer role for bills or transfers beyond the "manager chain".

### **Pricing and business model**

The platform is free; Darb charges card fees; that it also earns on card spend is our inference from the cashback it pays, not a stated fact. No public price exists for transfers, SADAD payments or international transfers, and Darb's own pages disagree on card fees.

|  |  |  |
| :-: | :-: | :-: |
| Item | Exact words from the source | Source |
| Plans | "Basic: Free, No platform subscription fee" · "Enterprise: Custom pricing … Everything in Basic, plus: ERP integration" | \[Pricing\](https://darbpay.com/pricing) |
| Corporate card fees | "Virtual corporate cards are free. Your first 5 physical corporate cards are free, with a 50 ⃁ issuance fee for each additional card." | \[Pricing FAQ\](https://darbpay.com/pricing) |
| Fleet card fees (version 1) | "Fleet card subscriptions are 20 ⃁ per month for a physical card … and 15 ⃁ per month for a virtual card" | \[Pricing FAQ\](https://darbpay.com/pricing) |
| Fleet card fees (version 2) | "Fleet Cards — Plastic Card: ⃁ 240/year, Keychain Card: ⃁ 240/year, Virtual Card: Free." | \[Help: new card\](https://darbpay.com/help-center/cards-management/creating-a-new-card) |
| Fleet card fees (version 3) | "SAR 14.99 per active card monthly, no charges for inactive cards" (read Oct 8; the page returned 404 on Oct 9) | darbpay.com/llm-info |
| Cashback | "2% cashback on eligible international spending", "such as Google and Meta advertising and software subscriptions" | \[Pricing\](https://darbpay.com/pricing) |
| SME offer (Jul 2026) | "100% off platform fees, the first 5 cards free, unlimited free virtual cards, and 50% off upcoming plastic card orders", with a Monsha'at "establishment size certificate" | \[Newsroom: SME offer\](https://darbpay.com/resources/newsroom/sme-offer) |
| International transfers | "⃁ 25 Flat-fee example … Illustrative values awaiting finance confirmation. Not a quote." | \[International transfers\](https://darbpay.com/products/international-transfers) |
| Partner perks | Calo, DirectKSA, Sweater and Mohasby offers; "Create a Darb account to see exact discounts" | \[Partners\](https://darbpay.com/partners) |

The cashback terms define the account as prepaid: "'Wallet' means the Customer's DarbPay prepaid wallet/balance used to fund card transactions." ([Cashback terms](https://darbpay.com/legal/cashback)) So every Darb payment, Bill Pay included, is paid from money the client has already loaded. No page we read describes a credit line.

**Pricing is open:** none of the payment products (local transfers, SADAD) shows a fee. Whether Bill Pay is free, per-transfer or part of Enterprise is open question 4 in the PRD.

### **Clients and verticals**

Darb's named clients run from large field-operations companies (Coca-Cola bottler, GASCO, Kudu, Tanmiah) to SMEs. Several posts mention suppliers and invoices (فواتير, موردين) next to cards, which points to real demand for bill payments.

#### **Named clients (newest first)**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| Client | Sector | What Darb says they use it for (exact words) | Source, date |
| Food Smith | Restaurants (several brands) | "إصدار بطاقة لكل موظف … وتنظيم مصاريف الإعلانات والاشتراكات والعهد والمصروفات النثرية" (a card per employee, ads, subscriptions, petty cash) | \[LinkedIn video post\](https://www.linkedin.com/feed/update/urn:li:activity:7489976897758453760/), Aug 3, 2026 |
| Al Wazn Al Mithali (الوزن المثالي) | Nutrition retail | "يتابع مصاريف الإعلانات والبرامج والعمليات" (ads, software, operations) | \[LinkedIn\](https://www.linkedin.com/feed/update/urn:li:activity:7487827709432365057/), Jul 28, 2026 |
| Makkah Construction & Development | Construction, hospitality | Spend spans "المشاريع والمشتريات، وفرق العمل، والموردين، والتنقل والوقود" (projects, purchases, teams, \*\*suppliers\*\*, travel, fuel) | \[LinkedIn\](https://www.linkedin.com/feed/update/urn:li:activity:7484902443257016321/), Jul 20, 2026 |
| Kudu | Restaurants, 350+ branches | "المشتريات، وتجهيزات المطاعم، ومصروفات الفروع، والوقود" (purchases, restaurant supplies, branch spend, fuel) | \[LinkedIn\](https://www.linkedin.com/feed/update/urn:li:activity:7482386772589436928/), Jul 13, 2026 |
| Salam | Telecom, digital infrastructure | "مشتريات تقنية، معدات، اشتراكات، سفر، فواتير…" and "ربط الفواتير بالعمليات المالية" (linking \*\*invoices\*\* to transactions) | \[LinkedIn\](https://www.linkedin.com/feed/update/urn:li:activity:7479836356878221312/), Jul 6, 2026 |
| Coca-Cola Bottling Co. of Saudi Arabia | FMCG distribution | "وقود، مشتريات، مصاريف ميدانية، فواتير" and "مطابقة أسهل بين الفواتير والعمليات" (fuel, purchases, field spend, \*\*invoices\*\*) | \[LinkedIn\](https://www.linkedin.com/feed/update/urn:li:activity:7475452866787225602/), Jun 24, 2026 |
| GASCO | Gas distribution | "بدل الكاش، الفواتير المتفرقة، والمتابعة اليدوية" (instead of cash, scattered invoices, manual tracking) | \[LinkedIn\](https://www.linkedin.com/feed/update/urn:li:activity:7472179592779370496/), Jun 15, 2026 |
| Tanmiah Food Company | Food, KSA/UAE/Kuwait/Bahrain | Fleet and teams paying "في أي دولة ببطاقة واحدة"; cost per km; "توحيد جميع المصاريف التشغيلية" | \[LinkedIn\](https://www.linkedin.com/feed/update/urn:li:activity:7469636865424257024/), Jun 8, 2026 |
| Faheem | Education platform | 2% cashback on marketing; sync "مع Zoho Books"; auditors get "صلاحية دخول للاطلاع فقط" (view-only access) | \[LinkedIn\](https://www.linkedin.com/feed/update/urn:li:activity:7467100252475502592/), Jun 1, 2026 |
| Theeb Rent a Car | Car rental | "التخلص من قيود الموردين والمحطات المحددة"; fuel, maintenance, daily operations | \[LinkedIn\](https://www.linkedin.com/feed/update/urn:li:activity:7461686950098255872/), May 17, 2026; site testimonial on \[homepage\](https://darbpay.com/en) |
| SUCCO | Insulation manufacturer, Jubail; 53 vehicles | "cut reconciliation from 18 hours to 12 minutes, and saved 15% on fuel costs" | \[Case study\](https://darbpay.com/case-studies/succo) |
| Hawa Knitting Trading Co. | Trading | "Every riyal we spend on ads, suppliers, and tools comes back to us." | \[Homepage testimonial\](https://darbpay.com/en) |
| Lorenzo | Multi-branch | "each branch has its own card with its own limit" | \[Homepage testimonial\](https://darbpay.com/en) |

The homepage's named logos today are only Theeb, Lorenzo and Hawa (from the page source, Oct 9). Other names such as PepsiCo, Carrier and Futtaim came up in an earlier summary of the page but could not be confirmed, so they are listed under "Not found / unverified".

#### **Verticals Darb targets**

The solutions menu lists: "Logistics, Delivery, Construction, Facility management" (Operations); "Technology, Marketing agencies, Law firms, Real estate" (Business); "Healthcare, Tourism & hospitality, Restaurants, Car rental, Charities" (Services & community) ([homepage menu](https://darbpay.com/en)).

The licence post states the origin focus: "FinTech for field-based companies" ([LinkedIn, Nov 11, 2025](https://www.linkedin.com/feed/update/urn:li:activity:7394042125505531904/)). The LinkedIn About now reads: "It brings corporate cards, expense tracking, approvals, receipts, payments and fuel management into one place" ([LinkedIn About](https://www.linkedin.com/company/darbpay/about/)). Darb started fleet-first and has broadened into a general spend platform.

### **Integrations, security and tech**

Three accounting systems have step-by-step setup guides: Odoo, Zoho Books and Daftra (chart of accounts). The others are named on marketing pages only. Security is built around SAMA's rules: segregated client funds, data kept in Saudi Arabia, role-based permissions and audit logs.

#### **Accounting**

|  |  |  |
| :-: | :-: | :-: |
| System | Status as described | Source |
| Odoo | Help guide: "Paste the URL of your Odoo database" and an Odoo API key | \[Help: Odoo\](https://darbpay.com/help-center/accounting-integrations/odoo-integration); launch post on \[LinkedIn\](https://www.linkedin.com/feed/update/urn:li:activity:7494718518681239552/), Aug 16, 2026 |
| Zoho Books | Help guide: "Sign in to Zoho and authorize Darb" | \[Help: Zoho Books\](https://darbpay.com/help-center/accounting-integrations/zoho-books) |
| Daftra | Chart-of-accounts CSV upload: "Rename the columns to GL Account ID and GL Account Name" | \[Help: Daftra\](https://darbpay.com/help-center/accounting-integrations/daftra-chart-of-accounts) |
| Wafeq | Shown as "Connected" in page illustrations | \[Procurement card\](https://darbpay.com/products/procurement-card) |
| Dynamics 365 BC, SAP, Oracle | Shown as "Available" in the same illustration | \[Procurement card\](https://darbpay.com/products/procurement-card) |
| QuickBooks | Appears in an illustration only | \[Integrations\](https://darbpay.com/features/accounting-integrations) |
| ERP integration as a paid tier | "Enterprise … Everything in Basic, plus: ERP integration" | \[Pricing\](https://darbpay.com/pricing) |

#### **Security and controls**

|  |  |  |
| :-: | :-: | :-: |
| Point | Exact words | Source |
| Data residency | "Darb's data is hosted within the Kingdom of Saudi Arabia … Data is not transferred outside the Kingdom." | \[Security\](https://darbpay.com/company/security) |
| Standards | "Built to the SAMA Cyber Security Framework"; "PCI DSS certified card infrastructure" | \[Homepage\](https://darbpay.com/en) |
| Governance | "Role-based user permissions"; "Approval levels based on transaction value"; "Multi-factor authentication for sensitive actions"; "Audit trails for relevant activities and changes" | \[Security\](https://darbpay.com/company/security) |
| Transaction controls | "Spending limits, Geographic restrictions, Merchant and category restrictions, Time-based restrictions, Approval rules, User authentication, Real-time transaction monitoring" | \[Security\](https://darbpay.com/company/security) |
| Risk engine | Flags off-hours fills and location mismatches with a "95/100 risk score" example | \[LinkedIn, Dec 3, 2025\](https://www.linkedin.com/feed/update/urn:li:activity:7401911838566682624/) |
| OTP on sensitive actions | Placing a card order: "An OTP will be sent to the authorized mobile number … Only authorized admins can complete this step." | \[Help: first card\](https://darbpay.com/help-center/getting-started/first-top-up-and-first-card) |

#### **Tech and channels**

|  |  |  |
| :-: | :-: | :-: |
| Point | Exact words | Source |
| Card network | "Applicable Visa membership requirements" | \[Security\](https://darbpay.com/company/security) |
| Web app | "app.darbpay.com" (client portal) | \[Help: sign-up\](https://darbpay.com/help-center/getting-started/applying-and-signing-up) |
| Mobile app | "The Darb Mobile App is officially live on iOS and Android\\\!" | \[LinkedIn, Apr 9, 2026\](https://www.linkedin.com/feed/update/urn:li:activity:7447908708094894080/) |
| Payment rails used | SADAD ("Connected to SADAD"), SARIE ("Connected to SARIE"), IPS for top-ups under ⃁ 20,000 | \[About\](https://darbpay.com/company/about), \[Top-up help\](https://darbpay.com/help-center/transaction/top-up-wallet) |
| Identity | Nafath for KYC; "Import from Tamm System" for bulk user upload | \[Sign-up help\](https://darbpay.com/help-center/getting-started/applying-and-signing-up), \[Inviting cardholders\](https://darbpay.com/help-center/user-management/inviting-cardholders) |
| Language | "Darb is SAMA-licensed, Arabic-first" | \[Newsroom: launch\](https://darbpay.com/resources/newsroom/launch) |

### **Recent releases and near future**

Darb ships fast: roughly one visible release a month, with SADAD (Sep 28) and subwallets (Sep 20) the most recent. On Oct 6 it described itself as cards, expense management **and bill payments**. International transfers are the only feature publicly marked "Coming soon".

#### **Release log (newest first)**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| Date | Release | Exact words | Source |
| Oct 6, 2026 | Positioning at the CFO Leadership Summit | "discover how Darb brings corporate cards, expense management, and bill payments together in one platform" | \[Darb LinkedIn\](https://www.linkedin.com/feed/update/urn:li:activity:7513193953815511040/) |
| Sep 28, 2026 | SADAD bill payments live | "جديد درب ð خدمة «سداد» صارت متاحة\\\! الحين تقدر تسدّد فواتير شركتك مباشرة من منصة درب" | Darb post, reposted on \[Abdulmohsen's activity\](https://www.linkedin.com/in/abulmohsenalbabtain/recent-activity/all/) |
| Sep 20, 2026 | Subwallets live | "المحافظ الفرعية وصلت درب\\\!" — a wallet per branch or team, funded from the main balance, with team cards linked to it | Darb post, reposted on \[Abdulmohsen's activity\](https://www.linkedin.com/in/abulmohsenalbabtain/recent-activity/all/) |
| Aug 16, 2026 | Odoo sync | "الحين تقدر تربط حسابك في درب مع Odoo" | \[Darb LinkedIn\](https://www.linkedin.com/feed/update/urn:li:activity:7494718518681239552/) |
| Jul 2026 | SME offer | "100% off platform fees, the first 5 cards free" | \[Newsroom\](https://darbpay.com/resources/newsroom/sme-offer) |
| May 21, 2026 | Darb Medal | "the world's first-ever Visa-approved payment device built entirely for commercial vehicles" | \[Abdulmohsen's post\](https://www.linkedin.com/in/abulmohsenalbabtain/recent-activity/all/) |
| Apr 2026 | mada Pay support | "Darb Cards Are Now Live on mada Pay" | \[Newsroom\](https://darbpay.com/resources/newsroom/mada-pay-support) |
| Apr 9, 2026 | Mobile app | "officially live on iOS and Android" | \[Darb LinkedIn\](https://www.linkedin.com/feed/update/urn:li:activity:7447908708094894080/) |
| Mar 2026 | Sweater partnership | "5% instant cashback" on car care | \[Newsroom\](https://darbpay.com/resources/newsroom/sweater-partnership) |
| Jan 2026 | Public launch | "Darb changes this with three core products" (fleet, procurement, petty cash) | \[Newsroom\](https://darbpay.com/resources/newsroom/launch) |

#### **Signals about what comes next**

|  |  |  |
| :-: | :-: | :-: |
| Signal | Exact words | Source |
| International transfers | "Coming soon: pay global suppliers from your Darb account." | \[Homepage menu\](https://darbpay.com/en) |
| Company ambition | "Our ambition has grown … More to come soon." | \[About\](https://darbpay.com/company/about) |
| Bill pay already in the approval engine | "Darb supports approval on card transactions, bills and payments." | \[Approval workflows\](https://darbpay.com/products/approval-workflows) |
| Founding pain | "supplier transfers took days only to bounce back" | \[About\](https://darbpay.com/company/about) |
| Finance-team roadmap (Jul 2026) | Darb's finance team uses its own product and asked for features that "موجودة في الرود ماب من قبل مايقول وبتكون لايف هذا الشهر" (already on the roadmap, live this month) | \[LinkedIn repost\](https://www.linkedin.com/in/abdullah-alajmi-91130b295/recent-activity/all/) |
| CEO's interest in credit | The Payments Desk No. 4 explores "the opportunity ahead for credit cards"; CEO: "This presents a massive opportunity in Saudi Arabia." | \[Abdulmohsen's activity\](https://www.linkedin.com/in/abulmohsenalbabtain/recent-activity/all/), Sep 22, 2026 |
| CEO's VAT thesis | "Most companies I meet are quietly writing off 15% of their small spend … because nobody kept a SAR 12 receipt." | \[Abdulmohsen's activity\](https://www.linkedin.com/in/abulmohsenalbabtain/recent-activity/all/), Jul 14, 2026 |
| CEO's payments framework | "Risk, Cost and Time are all that matters to Payments." | \[Abdulmohsen's activity\](https://www.linkedin.com/in/abulmohsenalbabtain/recent-activity/all/), Jun 11, 2026 |
| CEO on team design | "we still need PMs (perhaps fewer), dedicated designers, and highly leveraged, productive engineers working together, not blending into one." | \[Abdulmohsen's activity\](https://www.linkedin.com/in/abulmohsenalbabtain/recent-activity/all/), Mar 19, 2026 |
| Hiring | "There are no jobs right now." | \[Darb LinkedIn Jobs\](https://www.linkedin.com/company/darbpay/jobs/), Oct 9, 2026 |

The CEO's "risk, cost and time" framework is a useful lens: judge every Bill Pay decision by whether it makes paying a supplier safer, cheaper or faster.

### **What Bill Pay can build on, and the gaps**

Darb already moves money to suppliers three ways: a SARIE transfer after approval, a SADAD bill, or a vendor-locked or one-time card. What no public page describes is the **invoice side**: receiving a supplier's invoice, keeping a vendor list, tracking due dates, and scheduling or batching payments. That gap is most likely what "Bill Pay" fills. This is our reading of the sources, not something Darb has said.

|  |  |  |
| :-: | :-: | :-: |
| Building block | Exists today? (evidence) | Not described on any public page |
| Money source | Yes: a prepaid main balance funded by IBAN top-up, plus subwallets (\[Top-up help\](https://darbpay.com/help-center/transaction/top-up-wallet), \[Cashback terms\](https://darbpay.com/legal/cashback)) | Paying straight from the client's bank account |
| Bank transfer to a supplier | Yes: "Transfer to any bank account in Saudi Arabia" after approval, via SARIE (\[Local transfers\](https://darbpay.com/products/local-transfers), \[About\](https://darbpay.com/company/about)) | Saved beneficiaries or vendor profiles; IBAN-name checks; scheduled, recurring or batch transfers |
| Biller payments | Yes: SADAD, live since Sep 28, 2026 (\[SADAD\](https://darbpay.com/features/sadad-bill-payments)) | Recurring SADAD bills or due-date reminders |
| Card payment to a supplier | Yes: procurement, vendor-locked and single-use cards (\[Procurement\](https://darbpay.com/products/procurement-card), \[Virtual cards\](https://darbpay.com/features/virtual-cards)) | — |
| Approvals | Yes: manager chain, amount thresholds, multi-step; covers "bills and payments" (\[Approval workflows\](https://darbpay.com/products/approval-workflows)) | Approval rules by vendor; maker-checker roles for releasing payments |
| Reading documents | Yes, for receipts: "Darb extracts supplier, invoice and VAT details from each receipt" (\[Expense management\](https://darbpay.com/features/expense-management)) | Capturing supplier invoices \*before\* payment (upload or email inbox); due dates; ZATCA e-invoice XML |
| Accounting | Yes: sync to Odoo, Zoho, Daftra (CoA), Wafeq; AI GL coding (\[Integrations\](https://darbpay.com/features/accounting-integrations)) | Syncing bills as payables (AP) rather than as card expenses; AP aging |
| Audit trail | Yes: "Audit trails for relevant activities and changes" (\[Security\](https://darbpay.com/company/security)) | — |
| Cross-border | Coming soon: international transfers to 10 destinations (\[International transfers\](https://darbpay.com/products/international-transfers)) | — |

### **Not found or unverified**

No public source answers these, or the sources contradict each other. The PRD treats them as assumptions or open questions.

|  |  |  |
| :-: | :-: | :-: |
| Question | What the sources show | Why it matters for Bill Pay |
| Fees and limits for local transfers and SADAD | No fee shown; SADAD limit is "subject to approval" (\[SADAD\](https://darbpay.com/features/sadad-bill-payments)) | Pricing and limits (open question 4) |
| Card fees | Three different versions across Darb's own pages (see Pricing) | The PRD quotes no fee |
| How many companies | "more than 1,000" (\[About\](https://darbpay.com/company/about)) vs "Join hundreds of companies" (newsroom footer, e.g. \[launch\](https://darbpay.com/resources/newsroom/launch)) | Sizing claims |
| Licence date | Announced Nov 11, 2025 (\[SPA\](https://spa.gov.sa/en/N2441444)); newsroom item dated February 2026 (\[newsroom\](https://darbpay.com/resources/newsroom/sama-license)) | Minor; cite Nov 2025 |
| Help-centre FAQ answers | Questions such as "Can I make a bank transfer through Darb?" and "Are Darb cards debit or credit cards?" are listed, but their answers load only in the browser and were not captured (\[FAQ\](https://darbpay.com/help-center/faq/frequently-asked-questions)) | Answers not captured |
| Local transfers help article | Product page exists, but the help centre has no transfer how-to | Hints the transfer flow may be new or limited |
| Other homepage logos (PepsiCo, Carrier, Futtaim) | Seen in an Oct 8 summary of the homepage; not in the Oct 9 page source | Not named in the PRD |
| Which accounting syncs are live | Setup guides exist only for Odoo, Zoho Books, Daftra | AP sync scope |
| Funding | Nothing on the site or LinkedIn | Context only |
| What "Bill Pay" means internally | The menu already uses "Bill Pay" for SADAD; the case study describes "manage and automate payments to their vendors" | Scope (open question 1) |

### **More evidence from the full-site read (Oct 9)**

We read every remaining page: 13 solutions pages, all 28 blog posts, all help-centre articles, plus rewards, compare, referrals, station coverage, violation detection and the expense-filter tool.

|  |  |  |
| :-: | :-: | :-: |
| Finding | Exact words | Source |
| Supplier payments on solutions pages are always cards | "Create dedicated cards for poultry, produce, cleaning supplies, or marketing" | \[Restaurants\](https://darbpay.com/solutions/restaurants) |
| Facility management vendors | "Dedicate corporate cards to HVAC suppliers, lift maintenance and landscaping contracts" | \[Facility management\](https://darbpay.com/solutions/facility-management) |
| Blog on accounts payable | "Let's talk about "accounts payable" – that's the money you owe your suppliers" | \[Liabilities post\](https://darbpay.com/resources/blog/understanding-the-meaning-of-liabilities-in-accounting-how-darb-simplifies-finan) |
| Blog on slow supplier payments | "Slow payments mean you might miss early payment discounts." | \[Payable turnover post\](https://darbpay.com/resources/blog/boosting-payable-turnover-ratio-how-saudi-companies-accelerate-supplier-payments) |
| Blog on control | "The system enforces your policy at the terminal — before the money moves, not after." | \[Blog\](https://darbpay.com/resources/blog/streamline-your-business-spending-the-power-of-employee-expense-cards-and-virtua) |
| Darb's own billing (not client AP) | "Billing relates to Darb products and services … not transactions made using Darb cards." | \[Help: subscription invoice\](https://darbpay.com/help-center/billing/darbpay-subscription-invoice) |
| Rewards | "Earn 2% uncapped cashback on eligible international business spend"; lounges "with each eligible Darb Signature Card" | \[Rewards\](https://darbpay.com/rewards) |
| Government integrations | "Muroor, Tamm, TGA, Wasl" | \[Compare\](https://darbpay.com/resources/compare) |
| Traffic fines | "Darb runs daily automated checks on all your drivers through direct integration with Muroor." | \[Violation detection\](https://darbpay.com/features/violation-detection) |
| GCC use | "Darb cards work across the GCC — UAE, Bahrain, Kuwait, Oman, and Qatar." | \[Station coverage\](https://darbpay.com/features/station-coverage) |
| Nonprofit discount | "50% off Darb for eligible licensed nonprofits" | \[Charities\](https://darbpay.com/solutions/charities) |
| Referrals | "Earn ⃁ 3,000 when you refer a company to Darb" | \[Referrals\](https://darbpay.com/referrals) |
| Free AI tool | "Paste a credit-card statement and let AI separate business from personal spend" | \[Expense filter\](https://darbpay.com/resources/expense-filter) |

**Not found anywhere on the site:** a help article for SADAD, local transfers or approvals; any mention of IBAN-based supplier payments, payment terms, purchase-order matching or invoice approval in the blog; an approver role in the help centre.

### **Sources**

All pages opened Oct 8–9, 2026.

**Darb website:** [Homepage](https://darbpay.com/en) · [About](https://darbpay.com/company/about) · [Security](https://darbpay.com/company/security) · [Pricing](https://darbpay.com/pricing) · [Local transfers](https://darbpay.com/products/local-transfers) · [SADAD](https://darbpay.com/features/sadad-bill-payments) · [Approval workflows](https://darbpay.com/products/approval-workflows) · [Procurement card](https://darbpay.com/products/procurement-card) · [International transfers](https://darbpay.com/products/international-transfers) · [Corporate cards](https://darbpay.com/products/corporate-cards) · [Team wallets](https://darbpay.com/products/team-wallets) · [Petty cash](https://darbpay.com/products/petty-cash) · [Fleet card](https://darbpay.com/products/fleet-card) · [Ads card](https://darbpay.com/products/ads-card) · [Subscription card](https://darbpay.com/subscription-card) · [Expense management](https://darbpay.com/features/expense-management) · [Spend controls](https://darbpay.com/features/spend-controls) · [Zero-touch expenses](https://darbpay.com/features/zero-touch-expenses) · [Virtual cards](https://darbpay.com/features/virtual-cards) · [Accounting integrations](https://darbpay.com/features/accounting-integrations) · [Apple Pay](https://darbpay.com/apple-pay) · [Partners](https://darbpay.com/partners) · [Cashback terms](https://darbpay.com/legal/cashback) · [SUCCO case study](https://darbpay.com/case-studies/succo) · [Darb vs Alaan](https://darbpay.com/resources/compare/alaan) · [Darb vs Hala](https://darbpay.com/resources/compare/hala)

**Newsroom:** [Launch](https://darbpay.com/resources/newsroom/launch) · [SAMA licence](https://darbpay.com/resources/newsroom/sama-license) · [mada Pay](https://darbpay.com/resources/newsroom/mada-pay-support) · [Darb Medal](https://darbpay.com/resources/newsroom/darb-medal) · [Sweater](https://darbpay.com/resources/newsroom/sweater-partnership) · [SME offer](https://darbpay.com/resources/newsroom/sme-offer)

**Help centre:** [Sign-up](https://darbpay.com/help-center/getting-started/applying-and-signing-up) · [KYB/KYC](https://darbpay.com/help-center/getting-started/kyb-kyc-verification) · [First top-up](https://darbpay.com/help-center/getting-started/first-top-up-and-first-card) · [Top up wallet](https://darbpay.com/help-center/transaction/top-up-wallet) · [Users](https://darbpay.com/help-center/settings/users-settings) · [Groups](https://darbpay.com/help-center/groups/setting-up-groups) · [Inviting cardholders](https://darbpay.com/help-center/user-management/inviting-cardholders) · [New card](https://darbpay.com/help-center/cards-management/creating-a-new-card) · [Receipts](https://darbpay.com/help-center/transaction/upload-receipt-after-transaction) · [Fuel transaction](https://darbpay.com/help-center/transaction/make-fuel-transaction) · [Odoo](https://darbpay.com/help-center/accounting-integrations/odoo-integration) · [Zoho Books](https://darbpay.com/help-center/accounting-integrations/zoho-books) · [Daftra](https://darbpay.com/help-center/accounting-integrations/daftra-chart-of-accounts) · [FAQ](https://darbpay.com/help-center/faq/frequently-asked-questions)

**LinkedIn:** [Darb About](https://www.linkedin.com/company/darbpay/about/) · [Darb posts](https://www.linkedin.com/company/darbpay/posts/?feedView=all) · [Darb people](https://www.linkedin.com/company/darbpay/people/) · [Darb jobs](https://www.linkedin.com/company/darbpay/jobs/) · [Abdulmohsen Al Babtain: experience](https://www.linkedin.com/in/abulmohsenalbabtain/details/experience/) and [activity](https://www.linkedin.com/in/abulmohsenalbabtain/recent-activity/all/)

**Other:** [SPA: SAMA licenses Darb Pay](https://spa.gov.sa/en/N2441444)

LinkedIn post dates are worked out from each post's ID, so they are exact to the day.

## **Bill pay competitors**

What Ramp and the other bill pay products actually do, and who offers bill pay in Saudi Arabia today. Every point links to its source.

### **At a glance**

The full invoice-to-payment loop is standard abroad and missing in Saudi Arabia. Every global product has it but none serves Saudi businesses; Saudi players each have part of it. Darb sits in the Saudi spend-platform group, alongside SiFi, which is closest to adding the invoice side.

### **Ramp Bill Pay deep dive**

Ramp gives Bill Pay away free and earns on everything around it: card spend, fast or international payments, and money parked in Ramp Checking. Ramp calls it its "fastest growing product ever" ([AP agents launch](https://ramp.com/blog/ramp-ap-agents-announcement)). Over 10,000 businesses used it by March 2025 ([how Ramp uses Bill Pay](https://ramp.com/blog/how-ramp-uses-ramp-bill-pay)).

#### **How a bill moves through Ramp**

1.  **Bill arrives.** Forward it to the company's own *@ap.ramp.com* inbox, drag and drop, upload a CSV, create it by hand, receive it from a vendor in Ramp's Vendor Network, or submit it by API ([bill pay overview](https://support.ramp.com/bill-pay-overview), [creating draft bills](https://support.ramp.com/creating-draft-bills-on-bill-pay)).
2.  **OCR fills the draft** in "30–60 seconds": invoice number, dates, total, line items, PO number, vendor and even the vendor's bank details ([creating draft bills](https://support.ramp.com/creating-draft-bills-on-bill-pay)). Marketing claims 99% accuracy ([Bill Pay page](https://ramp.com/bill-pay)).
3.  **Review and code.** Someone checks the draft, picks a payment method and GL codes; vendor defaults pre-fill the gaps.
4.  **Approve.** Rules route it to the right people (see below). Changing the vendor, amount, method or date restarts approvals.
5.  **Release (optional, paid tier).** A final "payment release" step before money moves, so the person who prepares a payment run isn't the one who sends it.
6.  **Pay.** Ramp debits the company's account, then credits the vendor.
7.  **Sync.** The bill syncs to the accounting system when created or approved; the payment syncs once paid.

Bill statuses Ramp shows include *Missing info, Awaiting approvals, Scheduled, Initiated, Waiting for vendor, Payment failed, Paid, Rejected* ([managing bills](https://support.ramp.com/managing-bills-and-payments-on-bill-pay)).

#### **Controls**

|  |  |
| :-: | :-: |
| Control | How Ramp does it |
| Approval rules | By amount on the free plan; by department, vendor, location, PO match or GL field on Plus; multi-layer with AND/OR steps (\[approvals\](https://support.ramp.com/bill-pay-approvals)) |
| Separation of duties | Optional setting: "A Ramp account holder cannot approve their own bill" (\[approvals\](https://support.ramp.com/bill-pay-approvals)) |
| AP clerk role | Can create and edit draft bills and vendors; submitting and seeing bank details must be granted (\[AP role\](https://support.ramp.com/accounts-payable-role-on-ramp)) |
| Fraud checks | Scans bills before payment and shows yellow or red alerts; red needs a logged reason to dismiss. Ramp advises calling the vendor on a verified number (\[fraud\](https://support.ramp.com/bill-pay-fraud)) |
| Bank-detail changes | Vendors change details behind MFA; the payer must accept changes (\[vendor network\](https://support.ramp.com/ramp-vendor-network)) |
| Duplicates | Exact duplicate files filtered at intake; the fraud agent also checks duplicate invoices (\[AP agents\](https://support.ramp.com/ap-agents-available-in-ramp-bill-pay)) |

#### **Ways to pay and how fast**

|  |  |
| :-: | :-: |
| Method | Typical timing |
| ACH (standard US bank transfer) | 2–4 business days |
| Same-day ACH | Same day if approved before 3:50 PM ET |
| RTP (instant) | 10–15 minutes, from Ramp Checking only |
| Domestic wire | 0–5 business days |
| International (SWIFT USD or 41 local currencies) | About 30 minutes to 2 business days |
| Card (incl. one-time virtual card sent to the vendor) | Varies; vendor must accept Visa |
| Check | 4–7 business days |
| Stablecoin (beta, Jul 2026) | Within 5 minutes, 24/7 |

Source: [payment methods and timelines](https://support.ramp.com/bill-payment-methods-and-timelines). The payer chooses the method; Ramp emails vendors "a secure link" to give their bank details, and vendors "don't need to create a Ramp account to get paid" ([request vendor details](https://support.ramp.com/request-payment-tax-and-other-details-from-vendors), [Bill Pay page](https://ramp.com/bill-pay)).

#### **Accounting**

Syncs with QuickBooks, Xero, NetSuite, Sage Intacct, Business Central and Acumatica; GL coding per line; 3-way PO matching flags overbilling; partial payments (up to 20 per bill); AP aging report ([accounting](https://support.ramp.com/bill-pay-accounting), [3-way match](https://support.ramp.com/3-way-match-with-ramp-procurement)).

#### **AI ("Agents for AP", Oct 7, 2025)**

Line-level GL coding ("\~85%" right first time), fraud checks before approval, approval summaries with recommendations (90,000 issued, 90% accepted), and automatic card payments through vendor portals ([launch post](https://ramp.com/blog/ramp-ap-agents-announcement)). The automatic bill-creation agent "doesn't approve bills or bypass approvers" ([AP agents](https://support.ramp.com/ap-agents-available-in-ramp-bill-pay)).

#### **Pricing**

Free plan, no software fee. Per payment: ACH $0.59, check $1.99, same-day ACH $10, domestic wire $15, SWIFT $20; these fees are waived when paying from Ramp Checking ([fees](https://support.ramp.com/bill-pay-fees)). Ramp earns a share of card fees, Plus subscriptions ($15/user/month) and "supplementary services such as international and same-day payments" ([how Ramp makes money](https://support.ramp.com/how-ramp-makes-money)).

#### **What actually gets used**

Ramp's own usage data is a useful reality check for an MVP: only 3% of bills matched to POs, 5% of volume paid by card, 7.5% used payment release and 25% used recurring bills (March 2025, [how Ramp uses Bill Pay](https://ramp.com/blog/how-ramp-uses-ramp-bill-pay)). The core loop (capture, approve, pay, sync) carries most of the value; advanced features are a minority.

### **Global benchmarks**

Ten products, one lesson each. All of them share the same core loop as Ramp; they differ in who they serve and where they make money. None serves businesses based in Saudi Arabia (Brex even lists Saudi Arabia as unsupported for wires).

|  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: |
| Product | Who it serves | The idea worth learning | How it makes money | Source |
| \[BILL\](https://www.bill.com/product/accounts-payable) | US SMBs and accounting firms | \*\*Pay by card, vendor gets a transfer\*\*: you pay with your card (+2.9%), the vendor still receives ACH or check. Network of 5M+ vendors | $49–89/user/month + per-payment fees (ACH $0.59) | \[pricing\](https://www.bill.com/pricing), \[pay by card\](https://www.bill.com/product/pay-by-card) |
| \[Brex\](https://www.brex.com/product/bill-pay) | Startups to enterprise, US | \*\*Vendor self-onboarding link\*\*: a single-use link valid 72 hours where the vendor enters bank and tax details | Card rewards; fees not published | \[vendor support\](https://www.brex.com/support/vendor-support), \[wire locations\](https://www.brex.com/support/international-wire-locations) |
| \[Airwallex\](https://www.airwallex.com/spend-management/bill-pay) | Global SMEs (US, UK, EU, AU, Asia) | \*\*Bill pay on a multi-currency wallet\*\*; an extra payout approval on top of bill approval | FX margin (0.5–1%) and SWIFT fees | \[pricing\](https://www.airwallex.com/pricing) |
| \[Mercury\](https://mercury.com/bill-pay) | US-registered companies | \*\*Free bill pay bundled with the account\*\*, approvals in Slack, duplicate detection | 1% FX; paid plans | \[overview\](https://support.mercury.com/hc/en-us/articles/28768945847316-Bill-Pay-overview) |
| \[Tipalti\](https://tipalti.com/accounts-payable-software/) | Mid-market finance teams paying many suppliers | \*\*Supplier portal\*\*: suppliers enter and maintain their own bank details, checked against "26,000 global banking rules" | From $99/month + per-payment fees | \[supplier management\](https://tipalti.com/ap-automation/supplier-management/), \[global payments\](https://tipalti.com/en-uk/product/global-payments/) |
| \[Melio\](https://melio.com/pricing/) | US small businesses (bought by Xero, Oct 2025) | \*\*Vendors need no account at all\*\*; card payments delivered as bank transfer or check | Card fee 2.9%, fast-payment fees | \[vendor blog\](https://melio.com/blog/how-to-start-paying-vendors-online-with-melio/) |
| \[Payhawk\](https://payhawk.com/accounts-payable) | European mid-market | \*\*E-invoice networks\*\* (Peppol, Poland's KSeF, Italy's SDI) and an AI agent that logs into supplier portals to fetch invoices; rule that no one can both change supplier details and authorise payment | Quote-based | \[pricing\](https://payhawk.com/pricing) |
| \[Spendesk\](https://www.spendesk.com/product/accounts-payable/) | European finance teams | \*\*Strict roles\*\*: requester, approver, controller; "Only Account Owners can confirm payments"; can also export a payment file to pay from your own bank | Platform fee + per-transaction | \[pay your invoices\](https://helpcenter.spendesk.com/en/articles/4198466-pay-your-invoices) |
| \[Pleo\](https://www.pleo.io/en/invoices) | European SMEs (40,000+ companies) | \*\*First-time supplier verification\*\*, usually the same business day; duplicates flagged | Per-user plans + per-payment fees; controls only on higher plans | \[paying an invoice\](https://help.pleo.io/en/support/solutions/articles/103000285539-paying-a-supplier-invoice), \[pricing\](https://www.pleo.io/en/pricing) |
| \[Qonto\](https://qonto.com/en-de/invoicing/supplier-invoices) | European SMEs and freelancers | \*\*Verification of Payee\*\* (checks the name matches the IBAN), "4-eye" approval for big payments, and \*\*pay later\*\* in 3, 9 or 12 instalments | Monthly plans incl. transfer bundles | \[verification of payee\](https://support-fr.qonto.com/hc/en-us/articles/39107454970769-What-is-Verification-of-Payee-and-how-does-it-protect-my-payments), \[pricing\](https://qonto.com/en/pricing) |

#### **Table stakes (nearly everyone has these)**

1.  A dedicated email inbox plus OCR that turns invoices into draft bills (BILL, Brex, Mercury, Pleo, Spendesk, Qonto, Airwallex).
2.  Rule-based, multi-level approvals by amount, vendor or team (Brex, Pleo, Spendesk, Airwallex, Payhawk, Mercury).
3.  Duplicate-bill detection (BILL, Mercury, Spendesk, Pleo, Qonto, Payhawk).
4.  Two-way accounting sync (all ten).
5.  Scheduled and batch payment runs (BILL, Brex, Airwallex, Qonto, Pleo).
6.  A bank-transfer option plus a card option, often a single-use virtual card (BILL, Brex, Spendesk, Airwallex, Melio).
7.  Audit trail and separation of duties (BILL, Brex, Airwallex, Payhawk, Spendesk).

#### **Differentiators (only some have these)**

  - Pay by card even when the vendor doesn't take cards (BILL, Melio).
  - Vendor network or self-service supplier portal (BILL, Tipalti, Brex's link).
  - Checking that the bank account name matches the supplier (Qonto, Pleo).
  - Financing at the moment of payment (Qonto pay later, Melio pay over time).
  - Pulling invoices straight from national e-invoice networks (Payhawk, Qonto).

### **Saudi and regional players**

**No SAMA-licensed wallet in Saudi Arabia runs the full loop (capture an invoice, approve, schedule, pay, reconcile) for SMEs today.** The pieces exist, but spread across banks, accounting tools and spend platforms. Two players are moving towards it: Wafeq (accounting software that sells a near-full loop to Saudi enterprises only, releasing payments from the client's SAB or Al Rajhi account) and SiFi (a Saudi spend platform with a supplier directory, invoice management "coming soon"). Darb would be early, but not alone for long.

#### **Who offers what**

|  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: |
| Player | Type | What it offers for paying suppliers | What's missing | Source |
| \*\*Wafeq\*\* | Saudi accounting software | All plans: invoice inbox, WhatsApp, upload and OCR; bill approval; due dates; reconciliation. Enterprise only (sales-led): payment release from the client's own SAB or Al Rajhi account with Maker → Checker → Authorizer and OTP; Tabby and Raff named as KSA users | Self-serve SMEs pay outside Wafeq; Saudi bank flow undocumented; no scheduled payments, SADAD, account-name check or duplicate detection (see the stage-by-stage check below) | \[payout automation\](https://www.wafeq.com/en-sa/payout-automation) |
| \*\*SiFi\*\* | SAMA-licensed Saudi spend platform | Partner Hub (Jul 2026): supplier directory, "Pay Saudi bank accounts by IBAN", details checked before saving; account-name verification (May 2026) | "Invoice management (coming soon)"; payments abroad "coming soon" | \[Partner Hub\](https://www.sifi.app/en/resources/changelog/partner-hub/), \[pricing\](https://www.sifi.app/en/pricing/) |
| \*\*Hala\*\* | SAMA-licensed business account | SADAD bills incl. "suppliers invoices for several major Saudi providers"; scheduled and recurring bills and transfers; role-based approvals (corporate) | No invoice capture or bulk supplier payments found | \[SADAD\](https://hala.com/en/products/payments/sadad), \[corporate account\](https://hala.com/en/products/account/corporate-account) |
| \*\*Nqoodlet\*\* | Saudi spend platform | Positioning: pay suppliers from contact profiles | Transfers and SADAD shown as "Soon" | \[pricing\](https://nqoodlet.com/en/pricing/) |
| \*\*Bank portals\*\* (Alinma, Riyad, Al Rajhi, SNB, SAB, GIB) | Banks | Bulk transfers, SADAD and government payments, payroll files, approval hierarchies, beneficiary management; some connect to ERPs (Al Rajhi B2B: SAR 50,000 setup) | No invoice capture or matching; clunky for SMEs | \[Alinma\](https://www.alinma.com/en/Corporate/Cash-Management/Alinma-Business-Online), \[Al Rajhi B2B\](https://www.alrajhibank.com.sa/en/Business/Cash-Management/Products/Business-2-Business) |
| \*\*Esal (إيصال)\*\* | SAMA's B2B e-invoice payment system (since 2019) | Buyers view, approve, reject or dispute supplier invoices and pay through banks; auto-reconciliation | Only works if the supplier issues invoices through Esal | \[SAMA Esal page\](https://www.sama.gov.sa/en-US/payment/Pages/Esal.aspx) |
| \*\*Alaan\*\* | UAE spend platform | Full loop in the UAE ("Add bill" → bill approval → payment approval) | In KSA: cards only, funds with Al Rajhi. Supplier payments run in AED under the UAE regulator, and Saudi Arabia is not on its payout country list | \[SuperPay help\](https://help.alaanpay.com/en/articles/16024154-how-to-create-a-superpay-transfer), \[payout countries\](https://help.alaanpay.com/en/articles/14946262-alaan-payables-supported-countries-and-currencies), \[KSA cards\](https://www.alaan.com/blog/building-alaan-for-ksa-a-story-of-late-nights-engineering-breakthroughs) |
| \*\*Pemo\*\* | UAE spend platform, KSA cards via neoleap since Apr 2025 | UAE: invoice inbox, OCR, approvals, then "Pay with Pemo" from a UAE (ruya bank) account, "AED transfers within the UAE" only. KSA: cards, receipts, invoice tracking | In KSA (checked Oct 10): no bank transfers from Pemo. Invoices are paid "using a Pemo card or outside Pemo"; the KSA site is now a cards page only | \[Bill Pay (UAE)\](https://help.pemo.io/en/articles/15923724-business-bank-account-and-bill-pay), \[invoices\](https://help.pemo.io/en/articles/12256275-invoices), \[KSA cards\](https://www.pemo.io/sa/cards-lp), \[KSA launch\](https://www.pemo.io/press-rooms/pemo-launches-in-saudi-arabia-to-empower-businesses-with-smarter-expense-management) |
| \*\*HyperSpend\*\* (HyperPay + Mastercard) | New Saudi spend platform (Sep 2026) | Cards and multi-level approvals | No supplier or bill pay mentioned | \[HyperSpend\](https://www.hyper-spend.com/) |
| \*\*Lean Technologies\*\* | Open-banking infrastructure | Payouts API: single and bulk payouts from the company's own bank account | Developer API, not an SME app | \[payouts docs\](https://docs.leantech.me/v2.0-KSA/docs/getting-started-with-payouts.md) |
| \*\*Qoyod, Daftra, Zoho Books (KSA)\*\* | Accounting tools | Record bills only; Qoyod's bank link is "read-only" | Cannot pay | \[Qoyod\](https://www.qoyod.com/en/knowledge-base/integrations/integration-banking/) |

#### **Wafeq, checked stage by stage**

Wafeq comes closest, but only for Saudi enterprises, and its Saudi payment flow is sold rather than documented. For self-serve Saudi SMEs the money still moves in the bank's own portal.

|  |  |  |
| :-: | :-: | :-: |
| Stage | Self-serve plans (SAR 119–249/month) | Enterprise ("Request pricing") |
| Capture | Yes: personal email inbox, WhatsApp (since Feb 2026), upload, OCR of supplier, reference, date, currency and amount | Same; unlimited scans |
| Approve | Bill approval before posting (Premium and up) | Adds payment release: Maker → Checker → Authorizer with OTP (claimed, no Saudi how-to) |
| Schedule | Due dates and aging only; no dated, scheduled or recurring payments found | Same |
| Pay | Outside Wafeq; the user records the payment | Released from the client's own SAB or Al Rajhi account; listed as "KSA: SABB, Al Rajhi (Enterprise only)" in Apr 2025 |
| Reconcile | Statement import and suggested matches | Direct Saudi bank feeds (claimed) |
| Not found anywhere | SADAD (open user requests), supplier account-name check, duplicate-bill detection (open user requests), turning a supplier's ZATCA e-invoice into a bill | Same |

Wafeq's own English articles from Aug 2026 call only its UAE bank (Wio) "live today"; the Arabic version claims Al Rajhi and SAB too. No SAMA licence for Wafeq was found; the money moves through the client's bank. Sources: [pricing](https://www.wafeq.com/en-sa/pricing), [payout automation](https://www.wafeq.com/en-sa/payout-automation), [WafeqNEXT 2025](https://www.wafeq.com/en-sa/press-releases/reimagining-wafeq-for-next-generation-accounting:-amine-alameddine-at-wafeqnext-dubai-2025), [bulk payouts article](https://www.wafeq.com/en/business-hub/for-business/automate-bulk-payouts-for-enterprises), [inbox](https://help.wafeq.com/hc/en-sa/articles/21711057088412), [creating a bill](https://help.wafeq.com/hc/en-sa/articles/21551928514972-Creating-a-bill), [approval workflow](https://help.wafeq.com/hc/en-sa/articles/27930787481244), [payment requests API](https://developer.wafeq.com/reference/payment_requests_create), [Tabby case study](https://www.wafeq.com/en/case-studies/tabby-x-wafeq-synergy-scaling-at-its-best), [SADAD request](https://help.wafeq.com/hc/en-sa/community/posts/26036439082268), [duplicate request](https://help.wafeq.com/hc/en-sa/community/posts/29149866989468).

**For Darb:** Wafeq and Darb look more complementary than head-to-head for SMEs. Wafeq is the books; Darb holds the money and works with any bank. SiFi already syncs its payments into Wafeq as expenses or journals, not as paid bills. This is our inference from the sources ([SiFi–Wafeq sync](https://help.wafeq.com/hc/en-sa/articles/30270006668700)).

#### **How Saudi companies pay suppliers today**

  - "Payment to suppliers (B2B) account for 50% of total payments by volume and 76% of total payments by value" ([SAMA payments study 2021](https://www.sama.gov.sa/en-US/Documents/National_Payments_Usage_Study_en.pdf)).
  - Credit transfers are "the most common method of payment adopted by businesses"; cash has fallen to about 4% of business payments by volume ([SAMA payments study 2023](https://www.sama.gov.sa/en-US/Documents/Report_on_Payments_Usage_Study_2023_en.pdf)).
  - In 2021, about 24% of SME supplier payments were still cash, against under 1% for large firms ([SAMA 2021](https://www.sama.gov.sa/en-US/Documents/National_Payments_Usage_Study_en.pdf)).
  - Only 45% of Saudi SMEs use an integrated payment-and-business tool, and 30% struggle to track outstanding invoices (Visa survey of 262 SMEs, [Zawya](https://www.zawya.com/en/press-release/research-studies/visa-report-highlights-opportunity-to-connect-digital-payments-with-business-operations-for-saudi-smes-1428261)).

In short: supplier payments are the biggest slice of business payments in Saudi Arabia by value. Most go by bank transfer from bank portals, with little help on the invoice side.

### **Feature comparison**

Darb already matches the Saudi field on approvals, SADAD and paying from its own balance. It lags on the invoice side: capture, supplier list, name checks, scheduling and batch payments. Those are exactly the rows Ramp and BILL treat as basics.

|  |  |  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| Capability | Ramp | BILL | Wafeq | SiFi | Hala | Bank portals | \*\*Darb today\*\* |
| Invoice capture (email/upload + OCR) | Yes | Yes | Yes | Soon | ? | No | Receipts only, after a card payment |
| Supplier list with saved bank details | Yes | Yes (network) | Yes (beneficiaries) | Yes | ? | Yes (beneficiaries) | ? |
| Bank account name check | Yes | ? | No | Yes | ? | Partly (sarie checks the recipient) | ? |
| Multi-level approval rules | Yes | Yes | Bill approval; payment release claimed (Enterprise) | Yes (paid plan) | Yes (corporate) | Yes | Yes (manager chain, amount thresholds) |
| Scheduled or recurring payments | Yes | Yes | No (due dates only) | ? | Yes | ? | ? |
| Batch payments | Yes (paid plan) | Yes | Claimed (Enterprise) | ? | ? | Yes | ? |
| Duplicate-bill detection | Yes | Yes | No (users have asked for it) | ? | ? | ? | ? |
| SADAD bills | n/a (US) | n/a (US) | No (users have asked for it) | ? | Yes | Yes | Yes |
| Card option for suppliers | Yes | Yes | ? | Yes (cards) | ? | No | Yes (vendor-locked, one-time cards) |
| Pays from its own balance | Yes, or linked bank | Linked bank | No: client's SAB or Al Rajhi account (Enterprise) | Yes | Yes | Yes | Yes |
| Syncs bills to accounting as payables | Yes | Yes | Yes (it is the ledger) | ? | Partly ("ERP-ready") | Partly (ERP links) | Transactions only |

"?" = not found in public sources, not proof the feature is missing. Sources: Ramp and BILL as in the sections above; [Wafeq](https://www.wafeq.com/en-sa/payout-automation) and its [scheduling article](https://help.wafeq.com/hc/en-sa/articles/18469042296092) and [SADAD request](https://help.wafeq.com/hc/en-sa/community/posts/25719541686684-Add-Support-for-SADAD-Payment-Method-in-KSA); [SiFi Partner Hub](https://www.sifi.app/en/resources/changelog/partner-hub/) and [pricing](https://www.sifi.app/en/pricing/); [Hala SADAD](https://hala.com/en/products/payments/sadad) and [local transfers](https://hala.com/en/products/payments/local-transfers); [sarie](https://www.sama.gov.sa/en-US/payment/Pages/SARIE.aspx); Darb from the Darb sections above.

### **Saudi rails and rules that shape the design**

The Saudi rails replace Ramp's ACH, check and wire. Two facts drive most MVP decisions: bank transfers are the main way suppliers get paid, and open banking cannot yet start payments from a client's own bank, so Darb pays from its own balance.

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| Rail or rule | Key facts | What it means for Bill Pay | Source |
| \*\*sarie instant payments\*\* | Runs "24/7, throughout the year"; transfers of SAR 20,000 or less are instant; under SAR 2,500 can go by mobile, ID or email without adding a beneficiary; recipient account verification covers corporate accounts | Bills up to SAR 20,000 can be paid instantly at any hour; verify the account name before the first payment | \[SAMA sarie\](https://www.sama.gov.sa/en-US/payment/Pages/SARIE.aspx), \[SAMA news\](https://sama.gov.sa/en-US/MediaCenter/News/Pages/news-649.aspx) |
| \*\*SARIE large-value\*\* | Above SAR 20,000: same-day only in banking hours; Darb's own help says 9:00 AM–3:58 PM Sun–Thu, otherwise next working day | Scheduling must respect cut-offs: a big bill approved Thursday afternoon arrives Sunday | \[Darb top-up help\](https://darbpay.com/help-center/transaction/top-up-wallet) |
| \*\*SADAD\*\* | SAMA's bill system since 2004; billers present bills, payable through "all banking channels and licensed digital wallets" | Works only when the supplier is a registered biller; most SME suppliers aren't, so SADAD covers utilities and government, not most supplier invoices | \[SAMA SADAD\](https://www.sama.gov.sa/en-US/payment/Pages/SADAD.aspx) |
| \*\*Esal\*\* | SAMA's B2B invoice presentment and payment system on SADAD infrastructure (since 2019) | A possible later integration for suppliers already invoicing through it | \[SAMA Esal\](https://www.sama.gov.sa/en-US/payment/Pages/Esal.aspx) |
| \*\*ZATCA e-invoicing (Phase 2)\*\* | B2B invoices must be cleared by ZATCA before reaching the buyer; format is XML or PDF/A-3 with embedded XML. Wave 25 (revenue above SAR 187,500) integrates by Feb 1, 2027 | A growing share of supplier invoices carry structured data, so Bill Pay can read the embedded XML instead of relying only on OCR, and check the supplier's VAT number | \[ZATCA Wave 25\](https://zatca.gov.sa/en/MediaCenter/News/Pages/Wave25-E-invoicing.aspx), \[E-Invoicing Detailed Guidelines\](https://zatca.gov.sa/en/E-Invoicing/Introduction/Guidelines/Documents/E-Invoicing\_Detailed\_\_Guideline.pdf), \[overview (secondary)\](https://www.fiscal-requirements.com/news/5672-e-invoicing-in-saudi-arabia-review) |
| \*\*Open banking, payment initiation\*\* | Rules issued Sep 2024; licences so far cover account information only (Lean and Neotek, Mar 2026; Malaa, Jul 2026); no payment-initiation go-live found | Paying straight from the client's own bank isn't ready; the MVP pays from the Darb balance | \[SAMA licences\](https://www.sama.gov.sa/en-US/MediaCenter/News/Pages/news-1136.aspx), \[framework release\](https://www.openbankingexpo.com/news/saudi-central-bank-issues-second-release-of-open-banking-framework/) |
| \*\*VAT\*\* | 15% standard rate | Show VAT separately on each bill | \[Darb expense page\](https://darbpay.com/features/expense-management) |

One caveat: the sarie instant limit has stayed at SAR 20,000 on current SAMA and bank pages, though SAMA studied raising it in 2022 ([Argaam](https://www.argaam.com/en/article/articledetail/id/1581534)).

### **Patterns worth copying, and what not to copy**

Copy the core loop that every product shares; skip the US-specific machinery and the advanced features few customers use. The judgement calls below are our reading of the research, not facts from a source.

**Worth copying**

|  |  |  |
| :-: | :-: | :-: |
| Pattern | Seen at | Why it fits Darb |
| A company invoice inbox (forward an email) + OCR into a draft bill | Ramp, BILL, Brex, Pleo, Qonto, Wafeq | Darb already reads receipts with AI and accepts receipts by email reply |
| Vendor fills in their own bank details through a secure link | Ramp, Brex (72-hour single-use link), Tipalti | Removes manual IBAN typing, the main source of wrong payments |
| Check the account name before the first payment | Qonto, Pleo, SiFi | sarie already supports recipient account verification |
| Prepare vs release split (one person sets up, another sends) | Ramp payment release, Spendesk, Payhawk, Wafeq | Fits Darb's existing "Your team proposes. You decide" transfer flow |
| Alert on bank-detail changes and duplicate bills | Ramp, BILL, Mercury, Pleo | The two most common ways money goes to the wrong place |
| Pay on the due date, in a batch | Ramp, BILL, Brex, Qonto | Clients keep cash longer; matches how finance teams run weekly payment runs |
| Bill Pay free, earn around it | Ramp, Mercury, Airwallex | Matches Darb's free platform; revenue can come from cards, balances and fast or international payments |

**Not worth copying for an MVP**

  - **Checks, ACH, wires, 1099 tax forms:** US-only; Saudi rails are sarie, SARIE and SADAD.
  - **3-way PO matching:** only 3% of Ramp bills matched POs; most Saudi SMEs don't run formal POs.
  - **Line-level AI coding and approval agents:** Ramp made them paid-tier extras.
  - **Stablecoin and multi-currency payouts:** Darb's international transfers are still "coming soon".
  - **A full vendor network:** BILL needed millions of vendors for it to matter; a simple vendor link is enough at first.

**Where Darb can be different**

  - Read ZATCA e-invoice XML; none of the players researched mentions doing this for Saudi invoices.
  - One place for both supplier invoices (transfer) and SADAD bills.
  - Saudi-first details: Arabic invoices, SAR, VAT number checks, SARIE cut-offs in the schedule.

### **Not found or unverified**

|  |  |
| :-: | :-: |
| Question | What the research shows |
| Does Pemo or Alaan pay suppliers in KSA? | Checked Oct 10: no for both, as far as public sources show. Bill pay runs from UAE accounts in AED; Saudi users get cards, and invoices are paid by card or outside the app. Only their sales teams could confirm a quiet rollout |
| Does Wafeq's payout work with Saudi banks today? | Sold to enterprises via SAB and Al Rajhi (Tabby, Raff named); no Saudi how-to docs; its Aug 2026 English content calls only Wio "live" |
| SiFi invoice management launch date | Listed as "coming soon" |
| Official SARIE large-value cut-off | Not found on SAMA's site; Darb and SiFi help pages give 3:58 PM and 3:00 PM |
| sarie instant limit raised above SAR 20,000? | No change found |
| Open banking payment initiation live? | No licence or go-live found; one tracker claims it is live, which contradicts SAMA's wording |
| Ramp foreign-exchange markup, card-payment fees | Not published |
| Brex, Airwallex, Spendesk, Payhawk per-payment fees | Not published |
| Capital One–Brex deal closing | Announced Jan 22, 2026; closing not verified |

### **Sources**

All opened Oct 9–10, 2026.

**Ramp:** [Bill Pay](https://ramp.com/bill-pay) · [Pricing](https://ramp.com/pricing) · [AP agents launch](https://ramp.com/blog/ramp-ap-agents-announcement) · [How Ramp uses Bill Pay](https://ramp.com/blog/how-ramp-uses-ramp-bill-pay) · [Stablecoins](https://ramp.com/blog/introducing-stablecoins) · [Bill Pay overview](https://support.ramp.com/bill-pay-overview) · [Creating draft bills](https://support.ramp.com/creating-draft-bills-on-bill-pay) · [Managing bills](https://support.ramp.com/managing-bills-and-payments-on-bill-pay) · [Approvals](https://support.ramp.com/bill-pay-approvals) · [AP role](https://support.ramp.com/accounts-payable-role-on-ramp) · [Fraud](https://support.ramp.com/bill-pay-fraud) · [Vendor network](https://support.ramp.com/ramp-vendor-network) · [AP agents](https://support.ramp.com/ap-agents-available-in-ramp-bill-pay) · [Payment methods](https://support.ramp.com/bill-payment-methods-and-timelines) · [Vendor details request](https://support.ramp.com/request-payment-tax-and-other-details-from-vendors) · [Accounting](https://support.ramp.com/bill-pay-accounting) · [3-way match](https://support.ramp.com/3-way-match-with-ramp-procurement) · [Fees](https://support.ramp.com/bill-pay-fees) · [How Ramp makes money](https://support.ramp.com/how-ramp-makes-money)

**Global:** [BILL AP](https://www.bill.com/product/accounts-payable) · [BILL pricing](https://www.bill.com/pricing) · [BILL pay by card](https://www.bill.com/product/pay-by-card) · [Brex Bill Pay](https://www.brex.com/product/bill-pay) · [Brex vendor support](https://www.brex.com/support/vendor-support) · [Brex wire locations](https://www.brex.com/support/international-wire-locations) · [Airwallex Bill Pay](https://www.airwallex.com/spend-management/bill-pay) · [Airwallex pricing](https://www.airwallex.com/pricing) · [Mercury Bill Pay](https://mercury.com/bill-pay) · [Tipalti AP](https://tipalti.com/accounts-payable-software/) · [Tipalti supplier management](https://tipalti.com/ap-automation/supplier-management/) · [Melio pricing](https://melio.com/pricing/) · [Payhawk AP](https://payhawk.com/accounts-payable) · [Spendesk AP](https://www.spendesk.com/product/accounts-payable/) · [Pleo invoices](https://www.pleo.io/en/invoices) · [Qonto supplier invoices](https://qonto.com/en-de/invoicing/supplier-invoices) · [Qonto verification of payee](https://support-fr.qonto.com/hc/en-us/articles/39107454970769-What-is-Verification-of-Payee-and-how-does-it-protect-my-payments)

**Saudi and regional:** [Wafeq payout automation](https://www.wafeq.com/en-sa/payout-automation) · [SiFi Partner Hub](https://www.sifi.app/en/resources/changelog/partner-hub/) · [SiFi pricing](https://www.sifi.app/en/pricing/) · [Hala SADAD](https://hala.com/en/products/payments/sadad) · [Hala corporate account](https://hala.com/en/products/account/corporate-account) · [Nqoodlet pricing](https://nqoodlet.com/en/pricing/) · [Alinma Business Online](https://www.alinma.com/en/Corporate/Cash-Management/Alinma-Business-Online) · [Al Rajhi B2B](https://www.alrajhibank.com.sa/en/Business/Cash-Management/Products/Business-2-Business) · [Alaan SuperPay](https://help.alaanpay.com/en/articles/16024154-how-to-create-a-superpay-transfer) · [Alaan KSA](https://alaan.com/waitlist) · [Pemo invoices](https://www.pemo.io/invoice-payments) · [HyperSpend](https://www.hyper-spend.com/) · [Lean payouts](https://docs.leantech.me/v2.0-KSA/docs/getting-started-with-payouts.md) · [Qoyod banking](https://www.qoyod.com/en/knowledge-base/integrations/integration-banking/)

**Rails and rules:** [SAMA sarie](https://www.sama.gov.sa/en-US/payment/Pages/SARIE.aspx) · [SAMA SADAD](https://www.sama.gov.sa/en-US/payment/Pages/SADAD.aspx) · [SAMA Esal](https://www.sama.gov.sa/en-US/payment/Pages/Esal.aspx) · [SAMA open banking licences](https://www.sama.gov.sa/en-US/MediaCenter/News/Pages/news-1136.aspx) · [ZATCA Wave 25](https://zatca.gov.sa/en/MediaCenter/News/Pages/Wave25-E-invoicing.aspx) · [ZATCA E-Invoicing Detailed Guidelines](https://zatca.gov.sa/en/E-Invoicing/Introduction/Guidelines/Documents/E-Invoicing_Detailed__Guideline.pdf) · [SAMA payments study 2021](https://www.sama.gov.sa/en-US/Documents/National_Payments_Usage_Study_en.pdf) · [SAMA payments study 2023](https://www.sama.gov.sa/en-US/Documents/Report_on_Payments_Usage_Study_2023_en.pdf) · [Visa SME survey](https://www.zawya.com/en/press-release/research-studies/visa-report-highlights-opportunity-to-connect-digital-payments-with-business-operations-for-saudi-smes-1428261)

