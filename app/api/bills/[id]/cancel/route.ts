// POST /api/bills/{id}/cancel → {bill} (until the payment is sent, BP-18)
import { cancelBill } from "@/lib/server/services";
import { actor, mutate, type Params } from "../../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: Params<"id">) {
  const { id } = await params;
  return mutate((ctx) => ({ bill: cancelBill(ctx, id, actor(ctx)) }));
}
