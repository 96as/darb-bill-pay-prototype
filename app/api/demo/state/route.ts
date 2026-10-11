// GET /api/demo/state → {now, riyadh, session, users, company}
import { demoState } from "@/lib/server/services";
import { read } from "../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return read((ctx) => demoState(ctx));
}
