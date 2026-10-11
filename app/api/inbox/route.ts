// GET /api/inbox → {address, emails: [{email, bills}]}
import { listEmails } from "@/lib/server/services";
import { read } from "../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return read((ctx) => listEmails(ctx));
}
