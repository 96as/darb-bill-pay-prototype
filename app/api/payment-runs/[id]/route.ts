// GET /api/payment-runs/{id} → {run, items: [{bill, displayStatus, supplier, payment, quote}], totals, audit}
import { getRun } from "@/lib/server/services";
import { read, type Params } from "../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: Params<"id">) {
  const { id } = await params;
  return read((ctx) => getRun(ctx, id));
}
