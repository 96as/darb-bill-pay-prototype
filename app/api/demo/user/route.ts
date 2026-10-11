// POST /api/demo/user {userId} → DemoState (the user switcher)
import { setUser } from "@/lib/server/services";
import { errorJson, mutate, readBody, str } from "../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const b = await readBody(req);
    return await mutate((ctx) => setUser(ctx, str(b, "userId", true)!));
  } catch (err) {
    return errorJson(err);
  }
}
