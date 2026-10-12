// POST /api/payees/{id}/bank-account/reject → {supplier} (approver rejects, or requester withdraws)
import { rejectBankChange } from "@/lib/server/services";
import { actor, act, type Params } from "../../../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: Params<"id">) {
  const { id } = await params;
  return act((ctx) => ({ supplier: rejectBankChange(ctx, id, actor(ctx)) }));
}
