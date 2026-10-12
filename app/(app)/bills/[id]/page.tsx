import { notFound } from "next/navigation";
import { BillActions, BillPaymentSection } from "./_components/bill-actions";
import { BillBanners } from "./_components/bill-banners";
import { BillProvider } from "./_components/bill-context";
import { BillFields } from "./_components/bill-fields";
import { BillHeader } from "./_components/bill-header";
import { BillMeta } from "./_components/bill-meta";
import { BillSupplier } from "./_components/bill-supplier";
import { InvoicePreview } from "./_components/invoice-preview";
import { loadBillDetail } from "./data";

export default async function BillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await loadBillDetail(id);
  if (!view) notFound();

  return (
    <BillProvider view={view}>
      <div className="mx-auto max-w-screen-2xl space-y-6">
        <BillHeader />
        <BillBanners />
        <BillPaymentSection />
        {/* Desktop: the action column is sticky on the right; narrow screens: it comes first. */}
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
          <aside className="order-first min-w-0 space-y-6 xl:sticky xl:top-20 xl:order-last xl:max-h-[calc(100svh-6rem)] xl:overflow-y-auto xl:pb-1">
            <BillSupplier />
            <BillActions />
          </aside>
          <div className="min-w-0 space-y-6">
            <InvoicePreview file={view.bill.file} title={view.bill.invoiceNumber} />
            <BillFields />
            <BillMeta />
          </div>
        </div>
      </div>
    </BillProvider>
  );
}
