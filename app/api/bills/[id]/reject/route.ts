// POST /api/bills/{id}/reject {reason?} → {bill}
import { rejectBill } from "@/lib/server/services";
import { actor, errorJson, act, readBody, str, type Params } from "../../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: Params<"id">) {
  const { id } = await params;
  try {
    const b = await readBody(req);
    return await act((ctx) => ({ bill: rejectBill(ctx, id, actor(ctx), str(b, "reason")) }));
  } catch (err) {
    return errorJson(err);
  }
}
