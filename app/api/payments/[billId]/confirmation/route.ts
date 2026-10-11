// GET /api/payments/{billId}/confirmation → bilingual HTML payment confirmation download (BP-14); ?format=json for the data
import { loadStore } from "@/lib/server/store";
import { makeCtx } from "@/lib/server/context";
import { paymentConfirmation, renderConfirmationHtml } from "@/lib/server/services";
import { errorJson, json, type Params } from "../../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: Params<"billId">) {
  const { billId } = await params;
  try {
    const confirmation = paymentConfirmation(makeCtx(await loadStore()), billId);
    if (new URL(req.url).searchParams.get("format") === "json") return json(confirmation);
    const name = `payment-confirmation-${confirmation.invoiceNumber.replace(/[^A-Za-z0-9-]/g, "_")}.html`;
    return new Response(renderConfirmationHtml(confirmation), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return errorJson(err);
  }
}
