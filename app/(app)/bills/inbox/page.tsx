import { BillsSectionHeader } from "../_components/bills-section-header";
import { UploadInvoiceButton } from "../_components/bills-actions";
import { loadInboxView } from "./data";
import { InboxAddressCard, InboxEmails, InboxUpload } from "./_components/inbox";

export default async function BillsInboxPage() {
  const view = await loadInboxView();
  return (
    <div className="mx-auto max-w-screen-2xl space-y-6">
      <BillsSectionHeader actions={<UploadInvoiceButton />} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <InboxAddressCard address={view.address} />
          <InboxEmails emails={view.emails} />
        </div>
        <InboxUpload />
      </div>
    </div>
  );
}
