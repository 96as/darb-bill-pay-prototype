// POST /api/bills/{id}/discard → {bill} ("Discard this copy" for a flagged duplicate; status "discarded", BP-04)
import { discardDuplicate } from "@/lib/server/services";
import { act, actor, type Params } from "../../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: Params<"id">) {
  const { id } = await params;
  return act((ctx) => ({ bill: discardDuplicate(ctx, id, actor(ctx)) }));
}
