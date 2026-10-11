import { BillsSectionHeader } from "../_components/bills-section-header";
import { AddSupplierButton, SuppliersTable } from "./_components/suppliers-table";
import { loadSuppliersView } from "./data";

export default async function SuppliersPage() {
  const view = await loadSuppliersView();
  return (
    <div className="mx-auto max-w-screen-2xl space-y-6">
      <BillsSectionHeader actions={<AddSupplierButton />} />
      <SuppliersTable rows={view.rows} />
    </div>
  );
}
