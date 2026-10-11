import { notFound } from "next/navigation";
import { loadSupplierDetail } from "../data";
import { SupplierDetail } from "../_components/supplier-detail";

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await loadSupplierDetail(id);
  if (!view) notFound();
  return <SupplierDetail view={view} />;
}
