// GET /api/bills/{id}  ·  PATCH /api/bills/{id} (edit fields; "reviewed": [fields] clears OCR flags)
import type { BillPatch } from "@/lib/server/services";
import { getBillDetail, markFieldsReviewed, updateBill } from "@/lib/server/services";
import { actor, date, errorJson, fieldKeys, money, act, read, readBody, str, type Body, type Params } from "../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: Params<"id">) {
  const { id } = await params;
  return read((ctx) => getBillDetail(ctx, id));
}

function patchOf(b: Body): BillPatch {
  const patch: BillPatch = {};
  const has = (k: string) => Object.prototype.hasOwnProperty.call(b, k);
  if (has("supplierId")) patch.supplierId = b.supplierId === null ? null : str(b, "supplierId", true);
  for (const k of ["supplierName", "supplierNameAr", "supplierVat", "supplierCr", "invoiceNumber", "fundingAccountId"] as const) {
    if (has(k)) patch[k] = str(b, k) ?? "";
  }
  for (const k of ["issueDate", "dueDate"] as const) if (has(k)) patch[k] = b[k] === null ? null : date(b, k, true);
  if (has("payDate")) patch.payDate = date(b, "payDate", true);
  for (const k of ["subtotal", "vat"] as const) if (has(k)) patch[k] = b[k] === null ? null : money(b, k, true);
  if (has("total")) patch.total = money(b, "total", true);
  if (patch.fundingAccountId === "") delete patch.fundingAccountId;
  return patch;
}

export async function PATCH(req: Request, { params }: Params<"id">) {
  const { id } = await params;
  try {
    const b = await readBody(req);
    return await act((ctx) => {
      const patch = patchOf(b);
      const reviewed = fieldKeys(b, "reviewed");
      const result = updateBill(ctx, id, patch, actor(ctx));
      if (reviewed && reviewed.length > 0) markFieldsReviewed(ctx, id, reviewed, actor(ctx));
      return { changed: result.changed, approvalRestarted: result.approvalRestarted, ...getBillDetail(ctx, id) };
    });
  } catch (err) {
    return errorJson(err);
  }
}
