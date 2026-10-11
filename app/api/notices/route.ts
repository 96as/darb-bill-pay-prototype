// GET /api/notices?billId= → {notices} (what suppliers received, BP-13)
import { read } from "../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const billId = new URL(req.url).searchParams.get("billId");
  return read((ctx) => ({
    notices: ctx.store.notices.filter((n) => !billId || n.billId === billId).sort((a, b) => b.sentAt.localeCompare(a.sentAt)),
  }));
}
