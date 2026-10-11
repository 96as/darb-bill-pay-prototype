// GET /api/alerts?unread=1 → {alerts, unread} for the acting user
import { listAlerts } from "@/lib/server/services";
import { actor, read } from "../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const unreadOnly = new URL(req.url).searchParams.get("unread") === "1";
  return read((ctx) => listAlerts(ctx, actor(ctx), { unreadOnly }));
}
