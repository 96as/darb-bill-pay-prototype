// GET /api/payment-runs → {runs}  ·  POST /api/payment-runs {name, payDate, billIds, funding?} → {run, quotes}
import { createRun, listRuns } from "@/lib/server/services";
import { actor, date, errorJson, mutate, read, readBody, str, strArray, strRecord } from "../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return read((ctx) => ({ runs: listRuns(ctx) }));
}

export async function POST(req: Request) {
  try {
    const b = await readBody(req);
    return await mutate(
      (ctx) =>
        createRun(
          ctx,
          { name: str(b, "name") ?? "", payDate: date(b, "payDate", true)!, billIds: strArray(b, "billIds", true)!, funding: strRecord(b, "funding") },
          actor(ctx),
        ),
      201,
    );
  } catch (err) {
    return errorJson(err);
  }
}
