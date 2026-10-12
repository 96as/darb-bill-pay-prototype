// POST /api/payees/{id}/name-check/confirm → {supplier} (approver confirms a close match, BP-06)
import { confirmCloseMatch } from "@/lib/server/services";
import { actor, act, type Params } from "../../../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: Params<"id">) {
  const { id } = await params;
  return act((ctx) => ({ supplier: confirmCloseMatch(ctx, id, actor(ctx)) }));
}
