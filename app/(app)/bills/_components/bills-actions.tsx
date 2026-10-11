"use client";

import { Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

// Not wired yet: upload (POST /bills) and runs (POST /payment-runs) come in the next build steps.

export function UploadInvoiceButton() {
  const t = useT();
  return (
    <Button variant="pill" size="lg" className="px-4">
      <Upload aria-hidden />
      {t.bills.uploadInvoice}
    </Button>
  );
}

export function NewPaymentRunButton({ className }: { className?: string }) {
  const t = useT();
  return (
    <Button size="lg" className={className}>
      <Plus aria-hidden />
      {t.bills.newPaymentRun}
    </Button>
  );
}
