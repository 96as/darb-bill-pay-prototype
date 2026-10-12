# Build notes (shared brief for everyone working on the prototype)

Source of truth: `docs/PRD.md` (section 8 = scope; sections 3-4 + appendix = rules and API).
`docs/PRD-detailed.md` is the longer Google Doc (research tabs) for background only.
Shared types: `lib/domain/types.ts`. Money is integer halalas everywhere.

## Layers

| Folder | What lives there | Rules |
|---|---|---|
| `lib/domain/` | Pure rules: rails, IBAN, VAT, money, ZATCA XML reader, PDF XML extraction, duplicates, permissions, statuses | No I/O, no `Date.now()`; time is always passed in. Unit tested next to the file (`*.test.ts`). |
| `lib/mocks/` | OCR, name check, payee screening, payment rail, email in/out, accounting sync | Each is an interface + one fixed-response implementation. Everything here is labelled "Mock" in the UI. |
| `lib/server/` | Store (in memory, saved to `data/store.json`), seed, services, scheduler | Services take `(ctx, ...args)` where `ctx = { store, now, mocks }`; they mutate `ctx.store` and write audit events. Tested at the service layer. |
| `app/api/` | Route handlers following the PRD API sketch | Thin: load store, call a service, save, return JSON. |
| `app/(app)/` | Desktop screens in Darb's app shell | Server components read via services; client components mutate via `fetch` to `app/api`, then `router.refresh()`. |
| `app/m/` | Mobile approval view (same tokens) | |

## Decisions taken while the product lead was away (copy into README Assumptions)

1. **Runs hold draft bills and get one approval.** Submitting a run sends all its bills for one approval (BP-10). On approval, each bill gets its own payment. The API sketch's "approved bills" wording is read as "bills approved through the run".
2. **Send time.** A payment is sent when it is approved if its pay date is today or past; otherwise at 09:00 Riyadh on its pay date. The rail function then moves SARIE payments to the next window. A SARIE payment approved Thu 16:10 stays *Scheduled* until Sun 09:00; it is sent then, its supplier notice goes out then, and it arrives Sunday. Instant (sarie) payments send immediately.
3. **SARIE window:** Sun-Thu, 09:00 to 15:58 Riyadh inclusive (15:58:59 is still in; 15:59:00 is not). Before 09:00 on a banking day → same day 09:00. Saudi public holidays are not modelled (none fall in the demo window).
4. **Rail threshold:** amount ≤ 20,000.00 SAR → instant (sarie), 24/7; amount > 20,000.00 → SARIE. SADAD bills use the SADAD rail (24/7, same day).
5. **Approval policy:** one approval from a user with the approver role who is not the bill/run creator, editor, or the user who added/changed the supplier's IBAN (for the first payment). Amount thresholds and manager chains are not modelled (PRD open question 5).
6. **Name check outcomes** come from a fixed table by IBAN (mock). Unknown IBANs return "close match" so a person must confirm.
7. **"Paid"** = the payment has been sent on its rail. Settlement is instant in the mock (SARIE settles at send). Accounting entry marked paid at settlement.
8. **Accounting system** is a generic "Accounting system (mock)" showing an Odoo-style journal entry (PRD open question 6).
9. **PDF/A-3:** the sample PDF embeds the ZATCA XML as an attached file the way PDF/A-3 does; it is not certified PDF/A-3 (no XMP/ICC conformance claims).
10. **Overdue** is derived: a bill not paid/cancelled whose due date is before today (Riyadh) shows Overdue.
11. **Short balance:** at send time payments in a run are paid in due-date order while the source account covers them; the rest are held and retried at 09:00 on the next working day (Sun-Thu). The day before a pay date, if scheduled payments exceed the balance, the finance admin gets an alert.
12. **Limits** (seeded): per payment 100,000.00 SAR, daily 150,000.00 SAR. Checked at submit (per-payment) and at approval (daily total for the pay date).
13. **Cancel** is allowed for draft, awaiting approval and scheduled bills until the payment is sent.
14. **The demo has no login.** The user switcher sets who is acting; that user is stored in the demo state.
15. The bills inbox address is fake: `bills.sahab-fm@inbox.darbpay.example`.

## Seed (all fake)

Demo clock: **Thu 15 Oct 2026, 16:10 Riyadh** = `2026-10-15T13:10:00.000Z`.

Company: **Sahab Facility Services Co.** / شركة سحاب للخدمات المرفقية, VAT 310458812300003, CR 1010765432.

Users:
| id | Name | Role |
|---|---|---|
| u_noura | Noura Al-Harbi / نورة الحربي, Finance admin | preparer (prepare only) |
| u_faisal | Faisal Al-Otaibi / فيصل العتيبي, Operations manager | approver |
| u_reem | Reem Al-Qahtani / ريم القحطاني, CFO | approver |

Accounts: main balance 180,000.00 SAR; subwallet "Maintenance projects" / "مشاريع الصيانة" 40,000.00 SAR.

Suppliers:
| | Supplier A (saved) | Supplier B (new, from e-invoice) |
|---|---|---|
| Name EN | Green Oasis Landscaping Est. | Cool Breeze HVAC Contracting Co. |
| Name AR | مؤسسة الواحة الخضراء لتنسيق الحدائق | شركة النسيم البارد للمقاولات والتكييف |
| VAT | 311902476500003 | 310387452600003 |
| CR | 1010847261 | 1010932185 |
| IBAN | SA5880000000318204466710 (Al Rajhi Bank) | SA6710000000020315550044 (Saudi National Bank), from XML |
| Changed IBAN (demo step 3) | | SA2045000000001234567001 (SAB) |
| Notice | accounts@greenoasis.example / +966 5x xxx xxxx | finance@coolbreeze-hvac.example |
| Name check | match | match (both IBANs) |

Other mock name-check IBANs: SA0405000000008800112233 → close match; SA5215000000004400998877 → no match; SA2820000000003300776655 → rail returns the payment (failure demo, tests only).

Bills:
| Bill | Supplier | Invoice no. | Issue | Due | Subtotal | VAT | Total | Status |
|---|---|---|---|---|---|---|---|---|
| Saved earlier | A | GOL-2026-0917 | 2026-09-20 | 2026-10-14 | 11,000.00 | 1,650.00 | 12,650.00 | draft → shows Overdue |
| Paid history | A | GOL-2026-0822 | 2026-08-25 | 2026-09-24 | 6,000.00 | 900.00 | 6,900.00 | paid (2026-09-22) |
| SADAD | National Power Utility (demo biller) / شركة الطاقة الوطنية (تجريبي), biller 901, bill no. 1002387745 | | 2026-10-05 | 2026-10-25 | | | 3,240.55 | awaiting approval |
| E-invoice (email) | B | INV-2026-0451 | 2026-10-13 | 2026-11-12 | 40,000.00 | 6,000.00 | 46,000.00 | created in step 1 |
| Photo (email, OCR) | A | GOL-2026-1003 | 2026-10-10 | 2026-10-25 | 7,000.00 | 1,050.00 | 8,050.00 | created in step 1 |

E-invoice UUID: `6f1c9a52-3b7e-4d21-9c88-0a4e5b2d7f13`.

Seeded email (unprocessed): from `ops@sahab-fm.example` to the inbox, subject "Fwd: Invoices for October (HVAC + landscaping)", attachments:
`fixtures/invoices/INV-2026-0451-cool-breeze.pdf` and `fixtures/invoices/GOL-2026-1003-photo.jpg`.
