// PATCH /api/payees/{id}/bank-account {iban} → {supplier} (request an IBAN change; payments pause, BP-07)
import { requestBankChange } from "@/lib/server/services";
import { actor, errorJson, act, readBody, str, type Params } from "../../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: Params<"id">) {
  const { id } = await params;
  try {
    const b = await readBody(req);
    return await act((ctx) => ({ supplier: requestBankChange(ctx, id, str(b, "iban", true)!, actor(ctx)) }));
  } catch (err) {
    return errorJson(err);
  }
}
