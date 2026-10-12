"use client";

import { useState } from "react";
import { ConfirmRelease } from "@/components/darb/confirm-release";
import type { Halalas, ISODate } from "@/lib/domain/types";

/**
 * Desktop "Confirm and release" before approving a bill: the shared ConfirmRelease sheet
 * (total, number of payments, earliest arrival, usual approval verification note), with the
 * pending state handled here and the sheet closed once the approval succeeds.
 */
export function ReleaseConfirm({
  open,
  onOpenChange,
  total,
  payments,
  earliestArrival,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: Halalas;
  payments: number;
  earliestArrival?: ISODate;
  onConfirm: () => Promise<unknown> | void;
}) {
  const [pending, setPending] = useState(false);
  return (
    <ConfirmRelease
      open={open}
      onOpenChange={onOpenChange}
      total={total}
      count={payments}
      earliestArrival={earliestArrival}
      pending={pending}
      onConfirm={async () => {
        setPending(true);
        try {
          await onConfirm();
          onOpenChange(false);
        } finally {
          setPending(false);
        }
      }}
    />
  );
}
