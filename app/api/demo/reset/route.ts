// POST /api/demo/reset → DemoState (back to the seed)
import { resetStore } from "@/lib/server/store";
import { makeCtx } from "@/lib/server/context";
import { demoState } from "@/lib/server/services";
import { errorJson, json } from "../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    return json(demoState(makeCtx(await resetStore())));
  } catch (err) {
    return errorJson(err);
  }
}
