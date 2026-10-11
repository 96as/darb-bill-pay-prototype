// GET /api/bills?status=&due_before=  ·  POST /api/bills (multipart "file", or JSON for a manual/SADAD bill)
import { isISODate } from "@/lib/domain/time";
import { ServiceError } from "@/lib/server/errors";
import { today } from "@/lib/server/context";
import { createManualBill, ingestFile, listBills, MAX_UPLOAD_BYTES } from "@/lib/server/services";
import { actor, date, errorJson, isDisplayStatus, money, mutate, read, readBody, str, type Body } from "../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") || undefined;
  const dueBefore = url.searchParams.get("due_before") || undefined;
  return read((ctx) => {
    if (status !== undefined && !isDisplayStatus(status)) {
      throw new ServiceError("invalid_field", "status must be draft, awaiting_approval, scheduled, paid, failed, cancelled or overdue", 400);
    }
    if (dueBefore !== undefined && !isISODate(dueBefore)) throw new ServiceError("invalid_field", "due_before must be a date (YYYY-MM-DD)", 400);
    return { today: today(ctx), rows: listBills(ctx, { status, dueBefore }) };
  });
}

function sadadOf(b: Body) {
  const s = b.sadad;
  if (s === undefined || s === null) return undefined;
  if (typeof s !== "object" || Array.isArray(s)) throw new ServiceError("invalid_field", "sadad must be an object", 400);
  const o = s as Body;
  return { billerName: str(o, "billerName", true)!, billerNameAr: str(o, "billerNameAr"), billerCode: str(o, "billerCode", true)!, billNumber: str(o, "billNumber", true)! };
}

export async function POST(req: Request) {
  try {
    if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await req.formData().catch(() => {
        throw new ServiceError("invalid_form", 'Send the invoice in the multipart field "file"', 400);
      });
      const file = form.get("file");
      if (!(file instanceof File)) throw new ServiceError("missing_file", 'Send the invoice in the multipart field "file"', 400);
      if (file.size > MAX_UPLOAD_BYTES) throw new ServiceError("file_too_large", "Files up to 10 MB are accepted", 413);
      const bytes = new Uint8Array(await file.arrayBuffer());
      return await mutate((ctx) => ingestFile(ctx, { bytes, filename: file.name, source: "upload", actorId: actor(ctx) }), 201);
    }
    const b = await readBody(req);
    return await mutate(
      (ctx) =>
        createManualBill(
          ctx,
          {
            supplierId: str(b, "supplierId"),
            supplierName: str(b, "supplierName"),
            supplierNameAr: str(b, "supplierNameAr"),
            supplierVat: str(b, "supplierVat"),
            supplierCr: str(b, "supplierCr"),
            invoiceNumber: str(b, "invoiceNumber"),
            issueDate: date(b, "issueDate"),
            dueDate: date(b, "dueDate"),
            subtotal: money(b, "subtotal"),
            vat: money(b, "vat"),
            total: money(b, "total", true)!,
            fundingAccountId: str(b, "fundingAccountId"),
            sadad: sadadOf(b),
          },
          actor(ctx),
        ),
      201,
    );
  } catch (err) {
    return errorJson(err);
  }
}
