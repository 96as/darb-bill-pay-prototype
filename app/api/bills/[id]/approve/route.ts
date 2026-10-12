// POST /api/bills/{id}/approve → {bill, payment, scheduler} (single bill outside a run, e.g. SADAD)
import { approveBill } from "@/lib/server/services";
import { actor, act, type Params } from "../../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: Params<"id">) {
  const { id } = await params;
  return act((ctx) => approveBill(ctx, id, actor(ctx)));
}
