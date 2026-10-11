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
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,540px)]">
          <div className="xl:sticky xl:top-24">
            <InvoicePreview file={view.bill.file} title={view.bill.invoiceNumber} />
          </div>
          <div className="min-w-0 space-y-6">
            <BillFields />
            <BillSupplier />
            <BillActions />
            <BillMeta />
          </div>
        </div>
      </div>
    </BillProvider>
  );
}
