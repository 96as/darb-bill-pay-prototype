// POST /api/alerts/read-all → {marked}
import { markAllAlertsRead } from "@/lib/server/services";
import { actor, mutate } from "../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return mutate((ctx) => ({ marked: markAllAlertsRead(ctx, actor(ctx)) }));
}
