// GET /api/audit?type=bill|supplier|run|payment|email|company&id=&limit= → {events} (newest first)
import { read } from "../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const type = q.get("type");
  const id = q.get("id");
  const limit = Math.min(Math.max(Number(q.get("limit")) || 200, 1), 1000);
  return read((ctx) => ({
    events: ctx.store.audit
      .filter((e) => (!type || e.entity.type === type) && (!id || e.entity.id === id))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, limit),
  }));
}
