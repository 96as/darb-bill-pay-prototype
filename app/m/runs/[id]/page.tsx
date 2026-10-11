import { notFound } from "next/navigation";
import { loadRunDetail } from "@/app/(app)/bills/runs/data";
import { MobileRunApproval } from "../../_components/run-approval";

export default async function MobileRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await loadRunDetail(decodeURIComponent(id));
  if (!view) notFound();
  return <MobileRunApproval view={view} />;
}
