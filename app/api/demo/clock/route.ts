// POST /api/demo/clock {now: ISO} or {date: "YYYY-MM-DD", time: "HH:mm"} (Riyadh) → {state, scheduler}
import { atRiyadh } from "@/lib/domain/time";
import { ServiceError } from "@/lib/server/errors";
import { setClock } from "@/lib/server/services";
import { actor, date, errorJson, mutate, readBody, str } from "../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const b = await readBody(req);
    let iso = str(b, "now");
    if (!iso) {
      const day = date(b, "date", true)!;
      const time = str(b, "time") ?? "09:00";
      try {
        iso = atRiyadh(day, time).toISOString();
      } catch {
        throw new ServiceError("invalid_field", "time must be HH:mm", 400);
      }
    }
    const target = iso;
    return await mutate((ctx) => setClock(ctx, target, actor(ctx)));
  } catch (err) {
    return errorJson(err);
  }
}
