import { ApprovalsPanel } from "./_components/approvals-panel";
import { UploadInvoiceButton } from "./_components/bills-actions";
import { BillsSectionHeader } from "./_components/bills-section-header";
import { BillsStats } from "./_components/bills-stats";
import { BillsTableCard } from "./_components/bills-table";
import { OwedPanel } from "./_components/owed-panel";
import { loadBillsView, parseBillsFilters } from "./data";

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const view = await loadBillsView(parseBillsFilters(await searchParams));

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6">
      <BillsSectionHeader actions={<UploadInvoiceButton />} />
      <BillsStats balances={view.balances} />
      <BillsTableCard view={view} />
      <div className="grid gap-6 lg:grid-cols-2">
        <ApprovalsPanel items={view.approvals} />
        <OwedPanel owed={view.owed} />
      </div>
    </div>
  );
}
