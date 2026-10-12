// Test helpers: an in-memory seeded context and the demo steps as one-liners. Only fixtures are read from disk.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Bill } from "@/lib/domain/types";
import { atRiyadh } from "@/lib/domain/time";
import { createSeed, SEED_IDS } from "./seed";
import { makeCtx, type Ctx } from "./context";
import { processEmail } from "./services/inbox";
import { addSupplier } from "./services/suppliers";
import { markFieldsReviewed } from "./services/bills";
import { createRun, submitRun } from "./services/runs";
import { setClock } from "./services/demo";
import { ServiceError } from "./errors";

export const NOURA = SEED_IDS.users.noura;
export const FAISAL = SEED_IDS.users.faisal;
export const REEM = SEED_IDS.users.reem;

export const IBAN_A = "SA5880000000318204466710";
export const IBAN_B = "SA6710000000020315550044";
export const IBAN_B_NEW = "SA2045000000001234567001";
export const IBAN_CLOSE = "SA0405000000008800112233";
export const IBAN_NO_MATCH = "SA5215000000004400998877";

export function setup(): Ctx {
  return makeCtx(createSeed());
}

export async function fixture(rel: string): Promise<Uint8Array> {
  return new Uint8Array(await readFile(path.join(process.cwd(), rel)));
}

/** Riyadh wall-clock instant as ISO. */
export const riyadh = (date: string, time: string) => atRiyadh(date, time).toISOString();

export function advance(ctx: Ctx, date: string, time: string) {
  return setClock(ctx, riyadh(date, time), NOURA);
}

/** Expects a ServiceError with this code; returns it. */
export async function expectCode(fn: () => unknown, code: string): Promise<ServiceError> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof ServiceError && err.code === code) return err;
    throw new Error(`Expected ServiceError "${code}", got ${err instanceof ServiceError ? `"${err.code}": ${err.message}` : String(err)}`);
  }
  throw new Error(`Expected ServiceError "${code}", but nothing was thrown`);
}

/** Demo step 1: the seeded email becomes the e-invoice draft (Supplier B) and the photo draft (Supplier A). */
export async function processSeedEmail(ctx: Ctx): Promise<{ einvoice: Bill; photo: Bill }> {
  const { bills } = await processEmail(ctx, SEED_IDS.email, NOURA);
  const einvoice = bills.find((b) => b.invoiceNumber === "INV-2026-0451");
  const photo = bills.find((b) => b.extraction === "ocr");
  if (!einvoice || !photo) throw new Error("seed email did not produce both bills");
  return { einvoice, photo };
}

/** Demo step 3: Supplier B added from the e-invoice. */
export function addSupplierB(ctx: Ctx, actorId: string = NOURA, iban: string = IBAN_B, fromBillId?: string) {
  return addSupplier(
    ctx,
    {
      nameEn: "Cool Breeze HVAC Contracting Co.",
      nameAr: "شركة النسيم البارد للمقاولات والتكييف",
      vatNumber: "310387452600003",
      crNumber: "1010932185",
      iban,
      noticeEmail: "finance@coolbreeze-hvac.example",
      fromBillId,
    },
    actorId,
  );
}

/**
 * Demo up to step 4: email processed, B added, OCR fields checked, a run of the three bills
 * (46,000 e-invoice, 8,050 photo, 12,650 saved draft) dated today and submitted by Noura.
 */
export async function demoRun(ctx: Ctx, opts: { payDate?: string; funding?: Record<string, string>; submit?: boolean } = {}) {
  const { einvoice, photo } = await processSeedEmail(ctx);
  const supplierB = addSupplierB(ctx, NOURA, IBAN_B, einvoice.id);
  markFieldsReviewed(ctx, photo.id, [...photo.needsReview], NOURA);
  const saved = ctx.store.bills.find((b) => b.id === SEED_IDS.bills.savedDraft)!;
  const { run, quotes } = createRun(
    ctx,
    { name: "October suppliers", payDate: opts.payDate ?? "2026-10-15", billIds: [einvoice.id, photo.id, saved.id], funding: opts.funding },
    NOURA,
  );
  if (opts.submit !== false) submitRun(ctx, run.id, NOURA);
  return { run, quotes, einvoice, photo, saved, supplierB };
}

export const balanceOf = (ctx: Ctx, accountId = "main") => ctx.store.accounts.find((a) => a.id === accountId)!.balance;
export const paymentOf = (ctx: Ctx, billId: string) => [...ctx.store.payments].reverse().find((p) => p.billId === billId);
export const billOf = (ctx: Ctx, billId: string) => ctx.store.bills.find((b) => b.id === billId)!;
