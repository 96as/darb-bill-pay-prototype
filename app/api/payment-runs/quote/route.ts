// POST /api/payment-runs/quote {billIds, payDate, funding?, payDates?} → {quotes} (rail and arrival per bill, before submitting)
import { quoteBills } from "@/lib/server/services";
import { date, errorJson, read, readBody, strArray, strRecord } from "../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const b = await readBody(req);
    return await read((ctx) => ({ quotes: quoteBills(ctx, strArray(b, "billIds", true)!, date(b, "payDate", true)!, strRecord(b, "funding"), strRecord(b, "payDates")) }));
  } catch (err) {
    return errorJson(err);
  }
}
