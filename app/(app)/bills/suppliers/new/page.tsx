import { loadNewSupplierView } from "../data";
import { SupplierForm } from "../_components/supplier-form";

export default async function NewSupplierPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const fromBill = Array.isArray(params.fromBill) ? params.fromBill[0] : params.fromBill;
  const view = await loadNewSupplierView(fromBill);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SupplierForm view={view} />
    </div>
  );
}
