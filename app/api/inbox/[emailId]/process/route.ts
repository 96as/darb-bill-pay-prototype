// POST /api/inbox/{emailId}/process → {email, bills, errors, alreadyProcessed} (idempotent)
import { processEmail } from "@/lib/server/services";
import { actor, mutate, type Params } from "../../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: Params<"emailId">) {
  const { emailId } = await params;
  return mutate((ctx) => processEmail(ctx, emailId, actor(ctx)));
}
