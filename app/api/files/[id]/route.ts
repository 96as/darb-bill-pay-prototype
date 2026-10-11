// GET /api/files/{id} → the stored file (only ids in store.files; inline, nosniff)
import { loadStore } from "@/lib/server/store";
import { ServiceError } from "@/lib/server/errors";
import { errorJson, type Params } from "../../_lib/http";
import { serveFile } from "../../_lib/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: Params<"id">) {
  const { id } = await params;
  try {
    const file = (await loadStore()).files.find((f) => f.id === id);
    if (!file) throw new ServiceError("not_found", "File not found", 404);
    return await serveFile(file);
  } catch (err) {
    return errorJson(err);
  }
}
