import { BillsSectionHeader } from "../_components/bills-section-header";
import { NewRunLink } from "./_components/new-run-link";
import { RunsTable } from "./_components/runs-table";
import { loadRunsList } from "./data";

/** Payment runs list (BP-10). */
export default async function PaymentRunsPage() {
  const { rows } = await loadRunsList();
  return (
    <div className="mx-auto max-w-screen-2xl space-y-6">
      <BillsSectionHeader actions={<NewRunLink />} />
      <RunsTable rows={rows} />
    </div>
  );
}
