// GET /api/payees/{id} → {supplier, paidToCurrentIban, openBills, owed, bills, audit,
//   checks: {approveChange, rejectChange, withdrawChange, confirmMatch}} (RuleResults for the acting user)
import { auditFor } from "@/lib/server/audit";
import { getSupplier } from "@/lib/server/services/common";
import { listBills, supplierChecks, supplierRow } from "@/lib/server/services";
import { actor, read, type Params } from "../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: Params<"id">) {
  const { id } = await params;
  return read((ctx) => {
    const supplier = getSupplier(ctx, id);
    return {
      ...supplierRow(ctx, supplier),
      bills: listBills(ctx).filter((r) => r.bill.supplierId === supplier.id),
      audit: auditFor(ctx, "supplier", supplier.id),
      checks: supplierChecks(ctx, supplier, actor(ctx)),
    };
  });
}
