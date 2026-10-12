# Darb Bill Pay: delivery estimate, team and roadmap

Planning estimate for discussion, not a commitment. Based on PRD v6 (`docs/PRD.md`) and on building the prototype in this folder. I can't see Darb's systems or team; every statement about them is marked **[A]** (assumption).

## Summary

**Effort**

| Phase | Engineer-weeks, best / likely / worst |
|---|---|
| Pilot (the 11 P0s, plus the safety half of BP-10 moved in, see section 3) | 40 / 60 / 90 |
| Launch (the P1s) | 16 / 24 / 40 |
| **Total** | **56 / 84 / 130** |

Design, QA and product management come on top.

**Team:** about six engineers:
- one staff engineer or tech lead;
- two senior backend engineers, one of them for payments;
- one mid-level engineer each for backend, web and mobile.

They are supported by one QA engineer, one product designer, one PM, and part-time security, DevOps and compliance.

**Dates:** likely **pilot start late June 2027** (best late April, worst mid-August) and likely **launch in October 2027** (best August, worst January 2028). Q4 2026 is for access requests, spikes and design.

**Critical path:** rail access, the name check and the payment scheduler. It is not the screens.

## 1. Estimate per requirement

**Reading the table**
- Effort is in engineer-weeks: best / likely / worst.
- Levels: **S** senior, **M** mid, **J** junior, **TL** staff or tech lead.
- Skills: BE backend, FE web frontend, MOB mobile, QA, PAY payments integration, OPS DevOps, SEC security.
- "OQ" means an open question in PRD section 9.
- Each "Reuse" line is my guess about what Darb already has.

| ID | What production needs (reuse **[A]** → new) | Effort | Skills | Level | Depends on | Biggest unknown |
|---|---|---|---|---|---|---|
| PL-01 | **Bills ledger.** Reuse: transaction store, audit log. New: bill record, bill/payment/run status machines, KSA file storage, edit-restarts-approval, API | 3 / 5 / 8 | BE | S | — | Whether bills can live in the existing transactions model or need a new service |
| BP-01 | **Upload, web and app.** Reuse: receipt upload in the app. New: invoice upload (PDF, image, XML), type sniffing, size limits, malware scan, draft creation | 2 / 3 / 5 | BE, FE, MOB, SEC | M (S review) | PL-01 | Whether the existing upload path can take PDFs and XML safely |
| BP-03 | **XML, else OCR.** New: UBL 2.1 reader, PDF/A-3 attachment extraction, safe XML. Reuse and extend: receipt AI for invoice fields, with confidence and a review step. Plus a test set of Arabic, English and bilingual invoices | 4 / 6 / 10 | BE, FE, MOB | S | PL-01, receipt-AI team | Receipt-AI accuracy on Arabic invoices; whether the vendor is hosted in KSA |
| BP-04 | **Duplicate check.** New: UUID match, or supplier + normalised invoice number; blocks submission; approver-only dismiss with a reason | 1 / 1.5 / 3 | BE, FE | M | PL-01, BP-05 | Invoices with no supplier match yet |
| BP-05 | **Supplier list.** Reuse: transfer beneficiaries. New: VAT, CR, notice contact, IBAN checksum, bank from IBAN, match by VAT | 2 / 3 / 4 | BE, FE, MOB | M | PL-01 | How far today's beneficiary model can be extended |
| BP-06 | **Name check and first-payment approval.** New: account-name verification call, close-match confirmation, "no answer blocks", payee screening hook, first-payment rule in the approval engine | 3 / 5 / 9 | BE, PAY, FE | S | OQ 2, OQ 7, BP-05, BP-08 | Access to sarie account verification through Darb's bank |
| BP-07 | **IBAN-change lock.** New: change request, pause unsent payments, reset approvals, re-approval, stale-approval guard, two-user log, "call the supplier" prompt | 2 / 3 / 5 | BE, FE, MOB | S | BP-05, BP-06, BP-08 | Approval-engine support for a new request type |
| BP-08 | **Approval releases payment.** Reuse: approval engine and manager chain. New: bills as a request type, approver view (invoice, last 4 IBAN digits, VAT, arrival) on web and app, reject with a reason, restart on edit | 4 / 6 / 9 | BE, FE, MOB | S + TL | Approval engine team, OQ 5 | Scale of change to the shared approval engine |
| BP-09 | **Pay now or on a date (scheduler core).** Reuse: SARIE transfer service. New: rail routing (instant vs SARIE), cut-off and bank-holiday calendar, single arrival function, scheduled jobs that run once, request keys, rail status updates | 5 / 8 / 12 | BE, PAY, OPS | S | OQ 2, OQ 3, PL-01 | Whether the rail gives a reliable status and how idempotent it is |
| BP-10 | **Payment runs and failure handling.** Safety half: short balance, retry up to 3 working days, "no rail answer: never resent" (needs reconciliation), money back on return, alerts (2 / 3 / 4). Runs half: grouping and one approval for many bills (1 / 2 / 4) | 3 / 5 / 8 | BE, PAY, FE | S | BP-09 | Bank inquiry API for payments with an unknown outcome |
| BP-11 | **Bills view.** Statuses, Overdue, owed per supplier, filters, web and app list | 1.5 / 2.5 / 4 | FE, MOB, BE | M | PL-01 | — |
| BP-14 | **Payment synced with invoice, plus proof.** Reuse: accounting sync. New: attach invoice file, number, supplier, VAT; bilingual payment confirmation PDF | 2 / 3 / 5 | BE, FE | M | BP-09 | Whether today's sync can carry an attachment per transaction |
| BP-18 | **Money controls.** Reuse: limits, subwallets **[A]**. New: apply to bills, cancel until sent, scheduled vs available view, funding source per bill | 2 / 3 / 4 | BE, FE | M | BP-09 | Whether limits are shared with transfers or separate |
| BP-02 | **Bills inbox address.** Reuse: "email us the receipt" flow. New: address per company, attachment fan-out, sender saved, spoofing rules | 2 / 3 / 5 | BE, OPS, SEC | M | BP-01 | Inbound mail vendor hosted in KSA |
| BP-12 | **SADAD in the same list.** Map existing SADAD bills into the ledger, same statuses and approvals | 2 / 3 / 5 | BE, FE | M | PL-01, BP-08 | How SADAD bills are modelled today |
| BP-13 | **Supplier notice.** Reuse: notification service. New: bilingual email and SMS sent after confirmation, no bank details | 1 / 2 / 3 | BE | M / J | BP-09 | SMS sender ID approval |
| BP-15 | **Bill as payable (one system).** New: payables API for Odoo or Zoho, vendor mapping, marked paid on settle, error queue | 3 / 4 / 7 | BE | M (S review) | OQ 6 | Partner API limits and vendor matching |
| BP-16 | **Supplier onboarding link.** New: public single-use page, IBAN letter upload, admin review, name check | 3 / 4 / 6 | BE, FE, SEC | S review | BP-05, BP-06 | Abuse of a public page; review of IBAN letters |
| BP-17 | **Prepare-only role.** New role across products and in the approval engine | 1.5 / 3 / 5 | BE, FE, MOB | S + TL | Roles/permissions owners | How many products read today's roles |
| PL-05 | **Payment notices.** Covered by BP-13 plus failure and due alerts in BP-10 | — | — | — | — | — |
| X | **Cross-cutting, pilot.** Observability, reconciliation dashboard, runbooks, analytics events (section 5), Arabic/RTL QA, feature flags | 5 / 7 / 10 | BE, OPS, FE | M | — | — |
| X | **Cross-cutting, launch.** Scale, pen-test fixes, analytics | 2 / 3 / 5 | BE, OPS | M | — | — |

## 2. What the prototype taught us

Prototype size: about 5,300 lines of rules and services and 2,700 lines of tests (339 tests), against about 11,600 lines of screens. The rules were the hard part. They are the parts worth reading before building.

**Harder than the PRD makes them look**

1. **Arrival date** (`lib/domain/rails.ts`, `lib/domain/time.ts`, `lib/server/services/scheduler.ts`)
   - A payment has three times:
     - the planned send time (pay date, or now);
     - the approval time;
     - the actual send time (after the cut-off, a short balance or a retry).
   - We had to keep the quote shown at approval separate from the send-time quote (`Payment.quote` and `sentQuote`). Otherwise the notice and the approval screen disagree.
   - Production adds a bank-holiday calendar and the "funds" input from PRD v6.
   - The rules must not depend on the server's time zone. The tests run in three zones.
2. **IBAN-change lock** (`lib/server/services/suppliers.ts`, `lib/domain/permissions.ts`)
   - One change touches five things:
     - it holds unsent payments;
     - it resets approvals on those bills;
     - it sends runs back to awaiting approval;
     - it re-arms the first-payment rule;
     - a guard (`ibanSnapshot`) stops a stale approval from paying a new IBAN.
   - The close-match path caused a real dead end in the prototype UI, found in review. The approval panel needs a design for every combination of name-check result and user role.
   - Reject, withdraw and approve are three different rules.
3. **Never pay twice** (`lib/mocks/rail.ts`, `lib/server/services/runs.ts`, `scheduler.ts`)
   - Each payment keeps one request key across retries and holds. A material edit cancels the payment and creates a new key.
   - The mock rail settles instantly. Real rails don't, and PRD v6 says a payment with no rail answer is never resent. That needs a status inquiry and reconciliation with the bank. The prototype doesn't model this, and it is the largest production gap.
4. **Status machines** (`lib/domain/status.ts`)
   - There are three: bill, payment and run.
   - Overdue is derived, not stored. Discarded and returned-after-paid are easy to forget.
5. **Duplicates** (`lib/domain/duplicates.ts`)
   - The core rule is easy. The edges are not:
     - an invoice that arrives before its supplier exists (match on VAT, then name);
     - OCR invoices with no UUID;
     - invoice numbers with Arabic digits and dashes;
     - discarding versus dismissing.
6. **Reading ZATCA XML** (`lib/domain/zatca.ts`, `pdf-xml.ts`, `xml-safety.ts`)
   - Bilingual names, two TaxTotal blocks and PDF/A-3 attachment trees all need handling.
   - XXE must be blocked before parsing; the parser's defaults are not enough.
   - Real invoices round VAT per line. Validate totals with a small tolerance.

**Easier than expected:** IBAN checksum, VAT/CR format, limits, the bills view and filters, supplier CRUD, notice content and file-type sniffing. Darb's engineers can reuse the tests in `lib/domain/*.test.ts`, `lib/server/services/promise-*.test.ts` and `tests/demo-walkthrough.test.ts` as acceptance cases.

## 3. Priority check (smallest safe loop: capture, check, approve, pay, prove)

| P0 | Verdict for pilot | Why |
|---|---|---|
| BP-01 upload | Keep | The only capture path in the pilot |
| BP-03 XML / OCR | Keep XML; **OCR can be trimmed** | XML + manual entry is the safe floor. Ship OCR only if the Q4 spike shows usable Arabic accuracy |
| BP-04 duplicates | Keep | Safety |
| BP-05 suppliers | Keep, **move its data model into M1** | M1's matching and duplicate rule need supplier identity |
| BP-06 name check | Keep | Safety |
| BP-07 IBAN lock | Keep | Safety |
| BP-08 approval | Keep | Maker-checker is the core promise |
| BP-09 pay now / date | Keep | The pay step |
| BP-11 bills view | Keep, simple | Admins need to see what is owed and what failed |
| BP-14 sync + proof | Keep the **proof** (confirmation); invoice-attached sync can follow if the pilot clients' system isn't connected | "Prove" in the loop |
| BP-18 money controls | Keep limits and cancel; **subwallet choice can trim** | Limits and cancel are safety |

**Changes to the split and order**
- **Move BP-10's safety half into M3:** short balance, no rail answer never resent, money back on return. A single scheduled payment can meet a short balance or a silent rail too. Run grouping stays at launch.
- **Start the scheduler early.** BP-09 is the riskiest build and depends on outside access. Spike it in Q4 2026 and build it from M1 in parallel, not last.
- **Build M1 and M2 as two parallel streams** (capture and suppliers), not in sequence.
- **Enforce maker-checker in the pilot** (creator ≠ approver, first payment, IBAN change) through BP-06/07/08, even though BP-17's new role stays at launch. Pilot clients can use two existing users.

## 4. Quarterly roadmap

| Quarter | Work, in build order | Exit check |
|---|---|---|
| **Q4 2026** (from 12 Oct) | Request sarie and account-verification access (OQ 2–3). Agree payee screening (OQ 7) and the first accounting system (OQ 6). Receipt-AI spike on ~100 real Arabic invoices. Approval-engine design (bills request type, first payment, IBAN change). Scheduler and idempotency spike. Bank-holiday calendar source. Threat model. Web and app designs. Pick pilot clients. Staff the team | Access requests filed; engine design agreed; OCR go/no-go; designs signed off |
| **Q1 2027** | M1 (PL-01, BP-01, 03, 04, 11) and M2 (BP-05, 06, 07) in parallel; scheduler core (BP-09) started | Drafts from real pilot-client invoices; name check working in the bank's sandbox |
| **Q2 2027** | M3 (BP-08, 09, 14, 18, BP-10 safety half). Internal dogfood. Security review and compliance sign-off | **Pilot starts late June** (likely) |
| **Q3 2027** | Pilot runs (≥ 8 weeks, reviewed weekly). Build P1: BP-02, 10 runs, 12, 13, 15, 16, 17 | **Pilot gate:** all zero-tolerance guardrails at 0; 99.5% first-attempt success over the agreed sample |
| **Q4 2027** | Launch hardening, pen-test fixes, open to all clients (**October**, likely) | **Launch gate:** companies paying 5+ supplier bills a month on track to the O1 target |

## 5. Team per quarter

Counts are full-time equivalents. "Part" means part-time.

**Q4 2026 (prepare)**

| Role | Level | Count |
|---|---|---|
| Tech lead | Staff | 0.5 |
| Backend (payments) | Senior | 1 |
| Product designer | Mid/senior | 1 |
| Product manager | — | 1 |
| Security, compliance | Part | 0.2 each |

**Q1 2027 and Q2 2027 (build the pilot)**

| Role | Level | Count |
|---|---|---|
| Tech lead | Staff | 1 (about half hands-on) |
| Backend (payments, scheduler, rails) | Senior | 1 |
| Backend (ledger, suppliers, approvals) | Senior | 1 |
| Backend | Mid | 1 |
| Web frontend | Mid | 1 |
| Mobile | Mid | 1 **[A]** cross-platform app; 2 if native iOS and Android |
| QA (manual + automation) | Mid | 1 |
| Product designer | Mid/senior | 1 |
| Product manager | — | 1 |
| DevOps, security, compliance | Part | 0.25 each; security rises to 0.5 in Q2 for the review |

**Q3 2027 (pilot + P1)**: same as Q2. Add a **web junior** for the P1 screens. Reserve 20% of engineering time for pilot support. Security stays at 0.25 for the onboarding link.

**Q4 2027 (launch)**

| Role | Level | Count |
|---|---|---|
| Tech lead | Staff | 0.5 |
| Backend | Senior | 1 |
| Backend | Mid | 1 |
| Web frontend | Mid | 1 |
| Mobile | Mid | 0.5 |
| QA | Mid | 1 |
| Designer | Mid/senior | 0.5 |
| Product manager | — | 1 |

**Must be senior:** anything that moves money or touches IBANs:
- scheduler, rails and idempotency (BP-09, BP-10);
- reconciliation;
- name check and IBAN lock (BP-06, BP-07);
- approval-engine changes (BP-08, BP-17).

Untrusted file parsing (BP-03) and the public onboarding page (BP-16) need senior security review.

**Smaller team (1 senior + 2 mid, no tech lead, no mobile engineer)**
- **Capacity:** about 18 engineer-weeks a quarter, against about 38 for the full team.
- **Pilot:** code complete around October 2027, so it starts around **November 2027**, about **5 months later**.
- **Launch:** around **Q2 2028**, about **7–8 months later**.
- **The single senior** becomes the bottleneck for every money path and needs an outside reviewer.
- **Mobile approval** would ship as responsive web in the pilot.

## 6. The arithmetic

**Effort per milestone (engineer-weeks, best / likely / worst)**

| Milestone | Items | Effort |
|---|---|---|
| M1 Bills and capture | PL-01, BP-01, 03, 04, 11 | 11.5 / 18 / 30 |
| M2 Supplier safety | BP-05, 06, 07 | 7 / 11 / 18 |
| M3 Approve and pay | BP-08, 09, 14, 18, BP-10 safety | 15 / 23 / 34 |
| Cross-cutting, pilot | | 5 / 7 / 10 |
| **Pilot total** (rounded) | | **40 / 60 / 90** |
| Launch | BP-02, 10 runs, 12, 13, 15, 16, 17, cross-cutting | **16 / 24 / 40** |

**Working weeks and capacity per engineer**

Capacity = working weeks × focus factor 0.65 (meetings, reviews, bugs, on-call). Holiday dates follow the Hijri calendar and are approximate.

| Quarter | Working weeks | Capacity per engineer |
|---|---|---|
| Q1 2027 | 13 − Founding Day (22 Feb) − Eid al-Fitr (about 9–13 Mar) − Ramadan reduced hours (about 8 Feb–9 Mar, at 75%) ≈ **10.8** | ≈ **7.0** eng-weeks |
| Q2 2027 | 13 − Eid al-Adha (about 15–19 May) − leave ≈ **11.5** | ≈ **7.5** |
| Q3 2027 | 13 − National Day (23 Sep) − summer leave ≈ **10.8** | ≈ **7.0** |
| Q4 2027 | ≈ **12.5** | ≈ **8.1** |

**From effort to dates (likely case)**
- About 5.5 engineers (the tech lead counts as half) give 38.5 eng-weeks in Q1 and 41 in Q2.
- The 60-week pilot is code complete by **late May 2027**.
- Then the buffers:
  - 2–3 weeks of security review and fixes;
  - 2–4 weeks of compliance and any SAMA-related checks **[A]**: Darb's compliance confirms whether a new supplier-payment flow under its existing licence needs notification. Parts can run in parallel with the security review.
- That puts the pilot start in **late June 2027**.
- P1 (24 eng-weeks) fits in Q3 at 80% capacity (about 31 eng-weeks).
- The pilot needs at least 8 weeks to reach the agreed sample, so the gate falls in early September and **launch in October 2027**, after National Day.
- **Worst case (90 + 40):** pilot in **mid-August 2027**, launch **December 2027 to January 2028**.
- **Best case (40 + 16):** pilot in **late April**, launch in **August**.

## 7. Risks to the timeline

| Risk | If it slips | Start early |
|---|---|---|
| **sarie and account-name verification access** (OQ 2) | No instant rail or name check, so no pilot. The fallback is IBAN letter + second-person check: +3–4 weeks of build, a weaker name check | File in Q4 2026 through Darb's bank; build against the sandbox |
| **SARIE cut-off and exact SAR 20,000 rail** (OQ 3) | Wrong arrival dates, which breaks promise C | Confirm in writing in Q4; the rule is isolated in one function |
| **Payee screening** (OQ 7) | First payments blocked | Agree the API or manual queue with compliance in Q4 |
| **Rail status and reconciliation** | "Never resend" can't be guaranteed; the pilot can't start safely | Scheduler spike in Q4; ask the bank for an inquiry API |
| **Receipt AI on invoices / OCR vendor** | No OCR in the pilot; manual entry only | Q4 spike; confirm KSA hosting |
| **Accounting partner API** (OQ 6, BP-15) | Launch without bill sync | Get a sandbox in Q2 |
| **Inbound email infrastructure** (BP-02) | Launch without the inbox | Pick a KSA-hosted vendor and set up the domain in Q2 |
| **Approval-engine changes** (bills, first payment, IBAN change) | Blocks M2 and M3; shared with transfers | Design in Q4 with the engine owners; put changes behind flags |
| **New prepare-only role** (BP-17) | Touches every product's permissions | Inventory role checks in Q2 |
| **Mobile release cycles** (store review, forced updates) | Approval on the app ships weeks after web | Release the app shell early behind a flag; web approval as fallback |
| **Ramadan and summer staffing** | Q1 and Q3 capacity is lower than it looks | Already in the arithmetic; don't schedule gates in Ramadan |
