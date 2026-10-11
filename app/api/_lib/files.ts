// Serves stored files: only paths recorded in the store, resolved under data/files/ or fixtures/.
// Uploaded files are untrusted (PL-03): they are served sandboxed so nothing in them can run on our origin.
import type { StoredFile } from "@/lib/domain/types";
import { diskFiles } from "@/lib/server/files";

/** CSP for stored/uploaded files: sandboxed (no scripts, opaque origin), nothing loads except same-origin/data images. */
export const STORED_FILE_CSP = "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'";
/** CSP for HTML we generate ourselves (the payment confirmation): no scripts, no external loads. */
export const GENERATED_HTML_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:";

const asciiName = (name: string) => name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");

export function contentDisposition(kind: "inline" | "attachment", name: string): string {
  return `${kind}; filename="${asciiName(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/** Security headers every file response carries. */
export function fileSecurityHeaders(csp: string): Record<string, string> {
  return {
    "Content-Security-Policy": csp,
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Cache-Control": "private, no-store",
  };
}

/** PDF and images inline (the viewer fetches the bytes); XML always as a download, never rendered. */
export async function serveFile(file: Pick<StoredFile, "name" | "mime" | "path">): Promise<Response> {
  const bytes = await diskFiles.read(file.path);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(bytes.length),
      "Content-Disposition": contentDisposition(file.mime === "application/xml" ? "attachment" : "inline", file.name),
      ...fileSecurityHeaders(STORED_FILE_CSP),
    },
  });
}
