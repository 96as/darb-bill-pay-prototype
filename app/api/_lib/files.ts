// Serves stored files: only paths recorded in the store, resolved under data/files/ or fixtures/.
import type { StoredFile } from "@/lib/domain/types";
import { diskFiles } from "@/lib/server/files";

const asciiName = (name: string) => name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");

export async function serveFile(file: Pick<StoredFile, "name" | "mime" | "path">, disposition: "inline" | "attachment" = "inline"): Promise<Response> {
  const bytes = await diskFiles.read(file.path);
  const headers: Record<string, string> = {
    "Content-Type": file.mime,
    "Content-Length": String(bytes.length),
    "Content-Disposition": `${disposition}; filename="${asciiName(file.name)}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  };
  // Uploaded XML is untrusted: a browser must never run anything inside it.
  if (file.mime === "application/xml") headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
  return new Response(new Uint8Array(bytes), { headers });
}
