// POST /api/payees/{id}/bank-account/approve → {supplier} (second user, new name check must pass)
import { approveBankChange } from "@/lib/server/services";
import { actor, act, type Params } from "../../../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: Params<"id">) {
  const { id } = await params;
  return act((ctx) => ({ supplier: approveBankChange(ctx, id, actor(ctx)) }));
}
