// GET /api/payments/{billId}/confirmation → bilingual HTML payment confirmation download (BP-14);
// ?disposition=inline to view it, ?format=json for the data
import { loadStore } from "@/lib/server/store";
import { makeCtx } from "@/lib/server/context";
import { paymentConfirmation, renderConfirmationHtml } from "@/lib/server/services";
import { errorJson, json, type Params } from "../../../_lib/http";
import { GENERATED_HTML_CSP, contentDisposition, fileSecurityHeaders } from "../../../_lib/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: Params<"billId">) {
  const { billId } = await params;
  try {
    const confirmation = paymentConfirmation(makeCtx(await loadStore()), billId);
    const query = new URL(req.url).searchParams;
    if (query.get("format") === "json") return json(confirmation);
    // A download by default (BP-14); ?disposition=inline opens it in the browser. Either way: our own HTML, strict CSP.
    const kind = query.get("disposition") === "inline" ? "inline" : "attachment";
    const name = `payment-confirmation-${confirmation.invoiceNumber.replace(/[^A-Za-z0-9-]/g, "_")}.html`;
    return new Response(renderConfirmationHtml(confirmation), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": contentDisposition(kind, name),
        ...fileSecurityHeaders(GENERATED_HTML_CSP),
      },
    });
  } catch (err) {
    return errorJson(err);
  }
}
