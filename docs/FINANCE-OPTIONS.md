# Darb Bill Pay — Finance options

*The money behind Bill Pay: where it comes from, the options, why this one, and how Darb earns. Companion to PRD v6 and the delivery estimate. Facts checked on 12 Oct 2026; sources at the end.*

## 1. Decision

**Pilot:** pay suppliers from the client's pre-funded Darb balance (option A), as PRD v6 says. It is the only option that works today under Darb's own SAMA licence as an Electronic Money Institution. It needs no new partner or hire, and it keeps every money control inside Darb.

**Later options, each with its trigger:**
- Clients' own banks (C), for large clients who won't pre-fund.
- Open-banking payment initiation (B), once SAMA's payment initiation goes live.
- Pay-later through a licensed finance partner (E), when clients ask for terms.
- Cards (D) stay a niche for suppliers who already accept them.

**What would change the pilot choice:** the pilot is built to test pre-funding. If invited clients won't top up Darb ahead of paying suppliers, C becomes the next build, starting with the largest clients.

## 2. Options compared

| | A. Darb balance (pre-funded) | B. Open-banking payment initiation | C. Instructions to the client's own bank | D. Pay by card | E. Pay now, settle later |
|---|---|---|---|---|---|
| **Regulatory status, licence** | Allowed under Darb's EMI licence (No. 30/Sh M/1447); client funds safeguarded at a licensed bank | Rules issued Sep 2024; SAMA's Sep 2026 forum still discussed "banks' readiness". Open-banking licences so far are account information only. Darb would need a payment initiation permission | The bank executes the payment. Each bank needs its own agreement (SAB Connect, Al Rajhi B2B, SNB B2B…). Whether Darb needs a licence to relay instructions is unverified | Allowed: Darb already issues Visa cards, including single-use supplier cards | Needs a SAMA finance licence (SME finance or debt crowdfunding). SAMA's pay-later (BNPL) rules are written for consumers. An e-money institution may not lend safeguarded funds, so a partner is required |
| **Time to market** (Q3 2027 pilot, no hires) | Fits: reuses top-up, transfers and approvals | Not before payment initiation is live; date unknown | Months per bank (agreements, whitelisting, integration); doesn't fit the pilot | Product exists; the card-payment flow is small | Partner deal + credit integration; after launch |
| **Client effort and cash friction** | Top up first. Instant up to SAR 20,000 (24/7); above that, SARIE in banking hours | None: the money stays in the client's bank until paid | None to fund, but a per-bank setup (Al Rajhi B2B: SAR 50,000 + SAR 10,000 a year) and an authoriser step at the bank | Card limit must cover the bill | None now; repay later with a financing charge |
| **Control and safety** | All in Darb: maker-checker, IBAN-change lock, name check, one request key per payment | Mostly in Darb; the bank confirms consent | Split: release often happens at the bank (e.g. the authoriser enters the bank's OTP); the bank's beneficiary rules apply | Darb controls the card (single-use, vendor-locked); no IBAN involved | Darb controls the approval; the partner controls credit |
| **Supplier experience** | Normal bank transfer, no fee to the supplier; instant up to SAR 20,000 | Same as A | Same as A | Supplier must accept cards and pays a merchant fee: mada at most 0.8% in store; credit cards about 1.75–2.5% (bank-set) | Paid in full now, by transfer |
| **What Darb earns; effect on O4** | Grows balances and payment volume directly. No fee today | Volume goes up, balances don't | Little: no balance held, and the volume runs through the client's bank | Card volume and interchange (the domestic commercial rate is unverified) | Revenue share from the partner; volume goes up |
| **Dependencies and risks** | Clients must accept pre-funding; the balance is shared with cards | SAMA timeline; Darb's permission; bank coverage | Bank by bank; setup cost; corporate-only uptake | Low card acceptance among contractors (no official data); fee pushback | Credit risk sits with the partner; Shariah structure (Tawarruq); new licensing |

## 3. Why the Darb balance now

- **The licence is already there.** Darb is a SAMA-licensed Electronic Money Institution. Holding client money and sending local transfers is what it already does. Payment initiation (B) isn't live, and every open-banking licence SAMA has announced so far covers account information only.
- **It fits the no-hire, Q3 2027 plan.** Top-ups, transfers, subwallets and the approval engine all exist (PRD section 7). B and C each need new integrations, bank by bank or rail by rail.
- **Darb keeps every control.** Because Darb sends the payment itself, three controls hold end to end:
  - the IBAN-change lock;
  - the name check;
  - one request key per payment.

  In C, the final release moves to the bank's own tools, and Darb's rules stop at the handover.
- **Suppliers get a plain transfer, free to them.** Card payments would cost the supplier up to 0.8% (mada) or about 1.75–2.5% (credit).
- **It is the model peers chose.** SiFi pays suppliers from its balance (Partner Hub, Jul 2026). So does Pemo, from a "wallet you top up in advance". Wafeq takes route C, and only on its Enterprise plan.
- **The honest costs, and how the PRD handles them:**
  - **Clients must top up first,** and amounts over SAR 20,000 only arrive in SARIE hours. The PRD:
    - shows scheduled against available balance;
    - alerts the admin the day before a short balance;
    - retries for up to 3 working days;
    - tests pre-funding explicitly in the pilot.
  - **The balance is shared with cards and not reserved,** so card spend can starve a scheduled bill. The PRD lets each bill pay from a subwallet, so a "Supplier payments" subwallet keeps the money apart.
  - **Suggested addition:** a one-tap "top up this run" request at approval. It shows the client's top-up IBAN and the exact amount.

**Challenge (PRD sections 1–2):** the PRD says SiFi lists "Invoice management (coming soon)" and that SiFi and Hala "don't capture invoices yet". That is out of date. SiFi launched Partner Hub on 12 Jul 2026, paying Saudi IBANs from SiFi, and has a "Pay from an invoice" flow that reads the invoice and drafts the payment. Darb's differentiation narrows to the ZATCA XML reading, the IBAN-change lock and SADAD in the same list. The PRD should update the benchmark row and the "gap" paragraph.

**Note on Ramp:** Ramp's Bill Pay is no longer fully free. Since 1 Jun 2026 it charges $0.59 per standard ACH payment, waived when bills are paid from Ramp's own account. That is a useful precedent for "free when paid from our balance".

## 4. How Darb earns from Bill Pay, in stages

**Now: free within plans; returns come from money held and moved.**
- **Payment volume and stickiness.** Supplier payments are 76% of business payment value (SAMA, 2021). Moving them into Darb raises payment volume and 6-month retention, both O4 metrics.
- **Card spend from the same balance.** Darb earns interchange on card spend. Its published 2% cashback covers eligible *international* spend only, so the domestic rate is unverified.
- **Plan upgrades.** Enterprise is Darb's paid tier (ERP integration). Accounting-heavy Bill Pay clients are natural candidates.
- **Don't count on earning from held balances.** SAMA's rules for e-money institutions say:
  - client funds stay in a separate safeguarding account at a licensed bank, for no other purpose;
  - investing them needs SAMA approval, and only in secure, liquid assets;
  - Darb may not pay clients interest or any benefit tied to how long they hold e-money (Art. 69(3)).

  Whether Darb may keep any return on approved investments is unverified. I found no Saudi Shariah ruling on returns from wallet balances. The nearest precedent is Malaysia's central bank Shariah council: it treats wallet balances as a loan (qard) from the user, with any return belonging to the issuer. That is a reference only.

  So the plan assumes **no income from held balances**. Their value is indirect: volume, card spend and retention.

**Later: possible payment fees.** Price against what clients pay their bank today.

| Reference | Price |
|---|---|
| SAMA caps, retail customers only | Instant (sarie) at most SAR 1. SARIE electronic SAR 7 same day, SAR 5 next day |
| Corporate bank tariffs (bank-set, not capped) | SAB: SAR 5.75 including VAT for an electronic next-day SARIE (2022–23 schedule). BNP Paribas KSA: SAR 7 per domestic payment (Jul 2026) |
| Bank ERP links | Al Rajhi B2B: SAR 50,000 setup + SAR 10,000 a year |
| Wafeq | Payouts on Enterprise only ("request pricing"); no per-payout fee published |
| SiFi | Fee "shown before you send"; not published |

Any Darb fee should sit at or below the bank's own per-transfer price, or be bundled into Enterprise. A fee for priority (same-day SARIE) is easier to justify than a fee for every payment.

**Later still: pay-later financing through a partner.** Darb can't lend safeguarded funds, so this needs a licensed partner, with Darb earning a revenue share. Candidates:
- **Lendo:** debt crowdfunding licence; invoice financing up to 80% of the invoice, fees "do not exceed 3%" (self-reported).
- **Manafa:** finance company, licensed by SAMA in 2022.
- **Hala:** Shariah-compliant (Tawarruq) business financing up to SAR 2M that can be used to "pay suppliers".
- **Tabby:** reported an SME finance licence in Jun 2026, per Tabby (press).

## 5. Illustrative sizing

These are assumptions, not a forecast. Darb should plug in its own numbers.

**Extra average balance held = N clients × monthly supplier payments through Bill Pay (SAR) × average days the money sits in Darb before payout ÷ 30**

**Supplier payment value through Darb per year = N × monthly supplier payments × 12**

| N pilot clients | Monthly supplier payments per client | Days held before payout | Extra average balance | Payment value per year |
|---|---|---|---|---|
| 20 | SAR 300,000 | 5 | **SAR 1,000,000** | SAR 72M |

"Days held" depends on behaviour:
- **Just-in-time top-ups** hold for 1–2 days.
- **A buffer for the month's run** holds for 7–10 days.

The pilot's daily balance snapshot (O4) measures this directly.

## 6. Triggers to revisit

| Trigger | Move |
|---|---|
| SAMA announces payment initiation live at major banks, and Darb gets a payment initiation permission | Add **B** as a funding choice: no top-up step |
| Large clients refuse to pre-fund, or the pilot shows top-ups block payments | Offer **C** to them, starting with banks that have open corporate APIs (SAB Connect, Al Rajhi B2B) |
| Clients ask for payment terms, or suppliers offer early-payment discounts | Add **E** with a licensed partner |
| Suppliers start asking for card payment, or card acceptance among contractors rises | Promote **D** inside Bill Pay (single-use supplier cards) |
| O4 balances don't rise against the comparison group | Rethink the free model and the top-up user experience |
| SAMA approves investing safeguarded funds and confirms who keeps the return; Shariah board agrees | Revisit the earnings model |

## 7. Open questions for Darb

1. Has SAMA approved, or would it approve, investing Darb's safeguarded funds, and may Darb keep the return? What is the Shariah board's view?
2. Does Darb's EMI licence set limits on business wallet balances, or on paying third parties at supplier-payment scale?
3. What domestic interchange does Darb earn on commercial Visa spend? This sizes the card-side gain.
4. Would sending payment instructions to a client's own bank (C) need a licence or a bank partnership for Darb?
5. What does Darb pay its own bank per outgoing SARIE and instant transfer? That is the cost of keeping Bill Pay free.

## Sources

All checked 12 Oct 2026.

**SAMA and regulation**
- [SAMA: second release of the Open Banking Framework (payment initiation), Sep 2024](https://www.sama.gov.sa/en-us/mediacenter/news/pages/news-1036.aspx)
- [SAMA: Open Banking Forum, Sep 2026 ("banks' readiness for Payment Initiation Services")](https://www.sama.gov.sa/en-us/mediacenter/news/pages/news-1171.aspx)
- [SAMA: open-banking licences for account information, Mar 2026](https://www.sama.gov.sa/en-us/mediacenter/news/pages/news-1136.aspx)
- [SAMA: Malaa licence, Jul 2026](https://www.sama.gov.sa/en-US/MediaCenter/News/Pages/news-1161.aspx)
- [SAMA Rulebook: Implementing Regulations, Art. 93 (safeguarding)](https://rulebook.sama.gov.sa/en/article-93-2)
- [SAMA Rulebook: e-money institution prohibitions, Art. 69](https://rulebook.sama.gov.sa/en/node/1513)
- [SAMA Rulebook: safeguarding circular, Jul 2024](https://rulebook.sama.gov.sa/en/safeguarding-safeguarded-funds)
- [SAMA: Darb Pay licensed (e-wallet), Nov 2025](https://www.sama.gov.sa/en-US/MediaCenter/News/Pages/news-1117.aspx)
- [SAMA: sarie launch (instant under SAR 20,000)](https://sama.gov.sa/en-US/MediaCenter/News/Pages/news-649.aspx)
- [SAMA Rulebook: Guide to Financial Institutions Services Fees (retail caps)](https://rulebook.sama.gov.sa/en/guide-financial-institutions-services-fees)
- [SAMA: fees guide announcement](https://www.sama.gov.sa/en-US/MediaCenter/News/pages/news-1126.aspx)
- [SAMA National Payments Usage Study, 2021 (p. 32)](https://sama.gov.sa/en-US/Documents/National_Payments_Usage_Study_en.pdf)
- [SAMA BNPL rules (consumer)](https://www.rulebook.sama.gov.sa/sites/default/files/en_net_file_store/SAMA_EN_6523_VER1.pdf)
- [SAMA Rulebook: Finance Companies Control Law](https://rulebook.sama.gov.sa/en/node/226)
- [SAMA Rulebook: mada e-commerce fees](https://rulebook.sama.gov.sa/en/use-mada-bank-cards-buying-products-through-internet)
- [SAIB: mada merchant fee (0.8%, max 40)](https://www.saib.com.sa/en/mada)
- [Bank Negara Malaysia Shariah Advisory Council: e-money as qard (reference only)](https://www.bnm.gov.my/-/ruling-of-the-shariah-advisory-council-sac-of-the-bank-negara-malaysia-at-its-201-meeting-and-26th-special-meeting-statement)

**Darb**
- [Darb homepage (EMI licence)](https://darbpay.com/en)
- [Darb pricing](https://www.darbpay.com/en/pricing)
- [Darb cashback terms](https://darbpay.com/legal/cashback)
- [Darb top-up help](https://darbpay.com/help-center/transaction/top-up-wallet)
- [Darb virtual cards](https://darbpay.com/features/virtual-cards)

**Banks**
- [SAB corporate charges](https://www.sab.com/content/dam/sabpws/sme/Schedule-of%20bank-charges-corporate-banking-2022.pdf)
- [SAB Connect (B2B)](https://sab.com/en/corporate/ways-to-bank/sab-connect-b2b/)
- [Al Rajhi Business 2 Business](https://www.alrajhibank.com.sa/en/Business/Cash-Management/Products/Business-2-Business)
- [Al Rajhi fees](https://alrajhibank.com.sa/en/Personal/Accounts/Products-and-Services-fees)
- [Al Rajhi POS rates](https://alrajhibank.com.sa/-/media/Project/AlrajhiPWS/Shared/Home/Business/Cash-Management/Reprice-Debit-and-Credit-for-POS-1.pdf)
- [SNB B2B Solutions](https://www.alahli.com/en/pages/business/ways-of-banking/b2b-solutions)
- [Riyad Bank MA-CUG](https://www.riyadbank.com/corporate-banking/payments-collection/macug)
- [BNP Paribas KSA tariff, Jul 2026](https://mea.bnpparibas.com/app/uploads/sites/20/2026/07/tariff-ksa-kafd-27-07-2026.pdf)

**Competitors and peers**
- [Wafeq payout automation](https://www.wafeq.com/en-sa/payout-automation)
- [Wafeq pricing](https://www.wafeq.com/en-sa/pricing)
- [Wafeq press release (Enterprise, SAB / Al Rajhi)](https://www.wafeq.com/en-sa/press-releases/reimagining-wafeq-for-next-generation-accounting:-amine-alameddine-at-wafeqnext-dubai-2025)
- [SiFi pricing](https://sifi.app/en/pricing)
- [SiFi Partner Hub](https://www.sifi.app/en/resources/changelog/partner-hub)
- [SiFi: pay from an invoice](https://support.sifi.app/portal/en/kb/articles/pay-from-an-invoice-21-6-2026)
- [Pemo vendor payments](https://www.pemo.io/post/vendor-payment-automation-software)
- [Ramp: Bill Pay fees](https://support.ramp.com/hc/en-us/articles/34238671485715-Bill-Pay-fees)
- [Ramp: how Ramp makes money](https://support.ramp.com/hc/en-us/articles/360043060273-How-Ramp-makes-money)

**Financing partners**
- [Lendo invoice financing](https://www.lendo.sa/en/business/invoice-financing)
- [SAMA: Manafa licence](https://sama.gov.sa/en-US/News/Pages/news-801.aspx)
- [Hala financing](https://hala.com/en/products/financing)
- [Tabby: KSA finance licences (press)](https://tabby.ai/en-AE/newsroom/finance-licences-ksa)
