// POST /api/payment-runs/{id}/approve → RunView & {scheduler}
import { approveRun } from "@/lib/server/services";
import { actor, act, type Params } from "../../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: Params<"id">) {
  const { id } = await params;
  return act((ctx) => approveRun(ctx, id, actor(ctx)));
}
