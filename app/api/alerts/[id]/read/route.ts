// POST /api/alerts/{id}/read → {alert}
import { markAlertRead } from "@/lib/server/services";
import { actor, mutate, type Params } from "../../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: Params<"id">) {
  const { id } = await params;
  return mutate((ctx) => ({ alert: markAlertRead(ctx, id, actor(ctx)) }));
}
