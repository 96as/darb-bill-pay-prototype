// GET /api/summary → balances vs scheduled per account, owed per supplier (incl. SADAD), counts by status
import { billsSummary } from "@/lib/server/services";
import { read } from "../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return read((ctx) => billsSummary(ctx));
}
