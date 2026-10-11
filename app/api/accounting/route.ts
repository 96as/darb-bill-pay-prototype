// GET /api/accounting?billId= → {system, entries} (what landed in the accounting system, BP-14/15)
import { ACCOUNTING_SYSTEM } from "@/lib/mocks/accounting";
import { read } from "../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const billId = new URL(req.url).searchParams.get("billId");
  return read((ctx) => ({
    system: ACCOUNTING_SYSTEM,
    entries: ctx.store.accounting.filter((e) => !billId || e.billId === billId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  }));
}
