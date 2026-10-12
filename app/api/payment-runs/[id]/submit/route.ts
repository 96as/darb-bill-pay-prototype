// POST /api/payment-runs/{id}/submit → RunView
import { submitRun } from "@/lib/server/services";
import { actor, act, type Params } from "../../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: Params<"id">) {
  const { id } = await params;
  return act((ctx) => submitRun(ctx, id, actor(ctx)));
}
