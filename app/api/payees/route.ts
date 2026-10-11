// GET /api/payees → {suppliers: SupplierRow[]}  ·  POST /api/payees → {supplier} (IBAN checksum, name check, screening)
import { addSupplier, listSuppliers } from "@/lib/server/services";
import { actor, errorJson, mutate, read, readBody, str } from "../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return read((ctx) => ({ suppliers: listSuppliers(ctx) }));
}

export async function POST(req: Request) {
  try {
    const b = await readBody(req);
    return await mutate(
      (ctx) => ({
        supplier: addSupplier(
          ctx,
          {
            nameEn: str(b, "nameEn", true)!,
            nameAr: str(b, "nameAr"),
            vatNumber: str(b, "vatNumber", true)!,
            crNumber: str(b, "crNumber"),
            iban: str(b, "iban", true)!,
            noticeEmail: str(b, "noticeEmail"),
            noticeMobile: str(b, "noticeMobile"),
            fromBillId: str(b, "fromBillId"),
          },
          actor(ctx),
        ),
      }),
      201,
    );
  } catch (err) {
    return errorJson(err);
  }
}
