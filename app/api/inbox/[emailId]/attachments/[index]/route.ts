// GET /api/inbox/{emailId}/attachments/{index} → the attachment file (preview before processing)
import { loadStore } from "@/lib/server/store";
import { ServiceError } from "@/lib/server/errors";
import { errorJson, type Params } from "../../../../_lib/http";
import { serveFile } from "../../../../_lib/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: Params<"emailId" | "index">) {
  const { emailId, index } = await params;
  try {
    const store = await loadStore();
    const email = store.emails.find((e) => e.id === emailId);
    const attachment = email?.attachments[Number(index)];
    if (!email || !/^\d+$/.test(index) || !attachment) throw new ServiceError("not_found", "Attachment not found", 404);
    return await serveFile({ name: attachment.filename, mime: attachment.mime, path: attachment.path });
  } catch (err) {
    return errorJson(err);
  }
}
