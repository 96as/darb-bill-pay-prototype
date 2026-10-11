// POST /api/bills/{id}/submit {payDate, fundingAccountId?} → {bill, quote}
import { submitBill } from "@/lib/server/services";
import { actor, date, errorJson, mutate, readBody, str, type Params } from "../../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: Params<"id">) {
  const { id } = await params;
  try {
    const b = await readBody(req);
    return await mutate((ctx) => submitBill(ctx, id, actor(ctx), { payDate: date(b, "payDate", true)!, fundingAccountId: str(b, "fundingAccountId") }));
  } catch (err) {
    return errorJson(err);
  }
}
