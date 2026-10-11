import { BillsSectionHeader } from "../_components/bills-section-header";
import { ActivityLog } from "./_components/activity-log";
import { loadActivityView, parseActivityFilter } from "./data";

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const view = await loadActivityView(parseActivityFilter((await searchParams).type));
  return (
    <div className="mx-auto max-w-screen-2xl space-y-6">
      <BillsSectionHeader />
      <ActivityLog view={view} />
    </div>
  );
}
