import { notFound } from "next/navigation";
import { RunDetail } from "../_components/run-detail";
import { loadRunDetail } from "../data";

/** Desktop run detail + approval (BP-08, BP-10, BP-13..15). */
export default async function PaymentRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await loadRunDetail(decodeURIComponent(id));
  if (!view) notFound();
  return <RunDetail view={view} />;
}
