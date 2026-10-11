"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { UploadInvoiceDialog } from "@/components/darb/upload-invoice";
import { buttonVariants } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** Upload dialog: POST /api/bills, then opens the new bill. */
export function UploadInvoiceButton() {
  return <UploadInvoiceDialog />;
}

/** Payment runs are built by the runs screen (/bills/runs/new). */
export function NewPaymentRunButton({ className }: { className?: string }) {
  const t = useT();
  return (
    <Link href="/bills/runs/new" className={cn(buttonVariants({ size: "lg" }), className)}>
      <Plus aria-hidden />
      {t.bills.newPaymentRun}
    </Link>
  );
}
