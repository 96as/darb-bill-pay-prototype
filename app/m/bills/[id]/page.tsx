import { notFound } from "next/navigation";
import { loadBillApproval } from "@/app/(app)/bills/runs/data";
import { MobileBillApproval } from "../../_components/bill-approval";

export default async function MobileBillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await loadBillApproval(decodeURIComponent(id));
  if (!view) notFound();
  return <MobileBillApproval view={view} />;
}
