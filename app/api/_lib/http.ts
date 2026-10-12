// Thin glue between route handlers and services: load/lock/save the store, map errors to JSON.
import { NextResponse } from "next/server";
import type { BillFieldKey, DisplayStatus, Halalas } from "@/lib/domain/types";
import { sar } from "@/lib/domain/money";
import { isISODate } from "@/lib/domain/time";
import { ServiceError } from "@/lib/server/errors";
import { loadStore, withStore } from "@/lib/server/store";
import { makeCtx, type Ctx } from "@/lib/server/context";
import { diskFiles } from "@/lib/server/files";
import { runScheduler } from "@/lib/server/services/scheduler";

export type Params<K extends string> = { params: Promise<Record<K, string>> };

const NO_STORE = { "Cache-Control": "no-store" };

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: NO_STORE });

export function errorJson(err: unknown): NextResponse {
  if (err instanceof ServiceError) return json({ error: { code: err.code, message: err.message } }, err.httpStatus);
  console.error("[api]", err);
  return json({ error: { code: "internal", message: "Something went wrong" } }, 500);
}

const ctxFor = (store: Awaited<ReturnType<typeof loadStore>>) => makeCtx(store, { files: diskFiles });

/** Read-only handler: loads the store, never saves. */
export async function read(fn: (ctx: Ctx) => unknown | Promise<unknown>): Promise<NextResponse> {
  try {
    return json(await fn(ctxFor(await loadStore())));
  } catch (err) {
    return errorJson(err);
  }
}

/** Mutating handler: one at a time, saved only if the service did not throw. */
export async function mutate(fn: (ctx: Ctx) => unknown | Promise<unknown>, status = 200): Promise<NextResponse> {
  try {
    return json(await withStore((store) => fn(ctxFor(store))), status);
  } catch (err) {
    return errorJson(err);
  }
}

/** Each user action moves the demo clock on by a minute, so the activity log reads in order. */
export const ACTION_TICK_MS = 60_000;

/**
 * A user action (create, edit, submit, approve, reject, cancel/discard, process email, supplier and IBAN steps,
 * runs): advances the demo clock by ACTION_TICK_MS, runs the service, then runs the scheduler. Saved only if
 * nothing threw (so a refused action does not move the clock). Demo controls and alert reads use mutate().
 */
export async function act(fn: (ctx: Ctx) => unknown | Promise<unknown>, status = 200): Promise<NextResponse> {
  try {
    return json(
      await withStore(async (store) => {
        const ctx = ctxFor(store);
        ctx.now = new Date(ctx.now.getTime() + ACTION_TICK_MS);
        store.clock.now = ctx.now.toISOString();
        const result = await fn(ctx);
        runScheduler(ctx);
        return result;
      }),
      status,
    );
  } catch (err) {
    return errorJson(err);
  }
}

/** The acting user is the demo session's user (the user switcher). */
export const actor = (ctx: Ctx) => ctx.store.session.userId;

// ---------- Request body parsing ----------

export type Body = Record<string, unknown>;

export async function readBody(req: Request): Promise<Body> {
  const text = await req.text();
  if (!text.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ServiceError("invalid_json", "The request body is not valid JSON", 400);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ServiceError("invalid_json", "The request body must be a JSON object", 400);
  }
  return parsed as Body;
}

const bad = (key: string, what: string) => new ServiceError("invalid_field", `${key} must be ${what}`, 400);

export function str(b: Body, key: string, required = false): string | undefined {
  const v = b[key];
  if (v === undefined || v === null || v === "") {
    if (required) throw bad(key, "given");
    return undefined;
  }
  if (typeof v !== "string") throw bad(key, "a string");
  return v;
}

export function date(b: Body, key: string, required = false): string | undefined {
  const v = str(b, key, required);
  if (v !== undefined && !isISODate(v)) throw bad(key, "a date (YYYY-MM-DD)");
  return v;
}

/** Amounts: integer halalas (4500000) or a SAR string ("45,000.00"). */
export function money(b: Body, key: string, required = false): Halalas | undefined {
  const v = b[key];
  if (v === undefined || v === null || v === "") {
    if (required) throw bad(key, "given");
    return undefined;
  }
  if (typeof v === "number") {
    if (!Number.isSafeInteger(v)) throw bad(key, "whole halalas (e.g. 4500000) or a SAR string (e.g. \"45,000.00\")");
    return v;
  }
  if (typeof v === "string") {
    try {
      return sar(v);
    } catch {
      throw bad(key, "an amount like \"45,000.00\"");
    }
  }
  throw bad(key, "an amount");
}

export function strArray(b: Body, key: string, required = false): string[] | undefined {
  const v = b[key];
  if (v === undefined || v === null) {
    if (required) throw bad(key, "given");
    return undefined;
  }
  if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) throw bad(key, "a list of strings");
  return v as string[];
}

export function strRecord(b: Body, key: string): Record<string, string> | undefined {
  const v = b[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "object" || Array.isArray(v) || !Object.values(v).every((x) => typeof x === "string")) {
    throw bad(key, "an object of strings");
  }
  return v as Record<string, string>;
}

const FIELD_KEYS: readonly BillFieldKey[] = [
  "supplierName",
  "supplierNameAr",
  "supplierVat",
  "supplierCr",
  "invoiceNumber",
  "invoiceUuid",
  "issueDate",
  "dueDate",
  "subtotal",
  "vat",
  "total",
];

export function fieldKeys(b: Body, key: string): BillFieldKey[] | undefined {
  const v = strArray(b, key);
  if (v && !v.every((k) => (FIELD_KEYS as readonly string[]).includes(k))) throw bad(key, `a list of: ${FIELD_KEYS.join(", ")}`);
  return v as BillFieldKey[] | undefined;
}

const DISPLAY = ["draft", "awaiting_approval", "scheduled", "paid", "failed", "cancelled", "discarded", "overdue"] as const satisfies readonly DisplayStatus[];
export const isDisplayStatus = (v: unknown): v is DisplayStatus => typeof v === "string" && (DISPLAY as readonly string[]).includes(v);
