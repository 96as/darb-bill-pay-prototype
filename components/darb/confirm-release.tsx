"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Halalas, ISODate } from "@/lib/domain/types";
import { plural } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Amount } from "./amount";
import { MockBadge } from "./mock-badge";
import { formatArrival } from "./payment-format";
import { usePortalContainer } from "./portal-container";

/** Earliest arrival date among quotes (rail quotes from lib/domain/rails.ts or stored payments). */
export function earliestArrival(quotes: readonly { arrivalDate: ISODate }[]): ISODate | undefined {
  return quotes.reduce<ISODate | undefined>((min, q) => (!min || q.arrivalDate < min ? q.arrivalDate : min), undefined);
}

/**
 * "Confirm and release": the short step between tapping Approve and the payments being released.
 * Controlled (`open` / `onOpenChange`). A centred dialog on desktop; a bottom sheet inside the phone
 * frame on /m (PortalContainerContext). `onConfirm` runs the approval; keep the sheet open while
 * `pending` and close it yourself on success.
 *
 * Usage: <ConfirmRelease open={open} onOpenChange={setOpen} total={…} count={…}
 *          earliestArrival={earliestArrival(quotes)} pending={busy} onConfirm={approve} />
 */
export function ConfirmRelease({
  open,
  onOpenChange,
  total,
  count,
  earliestArrival: earliest,
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: Halalas;
  count: number;
  earliestArrival?: ISODate;
  onConfirm: () => void;
  pending?: boolean;
}) {
  const { t, lang } = useI18n();
  const c = t.payments.confirm;
  const container = usePortalContainer();
  const sheet = Boolean(container);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <Dialog.Portal container={container}>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup
          className={cn(
            "fixed z-50 flex flex-col gap-4 bg-background p-5 shadow-lg outline-none transition duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0",
            sheet
              ? "inset-x-0 bottom-0 rounded-t-3xl border-t pb-[max(1.25rem,env(safe-area-inset-bottom))] data-ending-style:translate-y-8 data-starting-style:translate-y-8"
              : "top-1/2 left-1/2 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border data-ending-style:scale-95 data-starting-style:scale-95",
          )}
        >
          {sheet ? <span aria-hidden className="mx-auto -mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25" /> : null}
          <div className="space-y-1">
            <Dialog.Title className="text-base font-medium">{c.title}</Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">{c.description}</Dialog.Description>
          </div>
          <dl className="grid gap-2.5 rounded-xl bg-background-secondary px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{c.total}</dt>
              <dd>
                <Amount value={total} className="text-lg font-medium" currencyClassName="text-sm font-normal text-muted-foreground" />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{c.payments}</dt>
              <dd className="font-medium">{plural(lang, c.paymentsCount, count)}</dd>
            </div>
            {earliest ? (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{c.earliestArrival}</dt>
                <dd className="font-medium">{formatArrival(earliest, lang)}</dd>
              </div>
            ) : null}
          </dl>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-px size-4 shrink-0 text-primary" aria-hidden />
            <span className="flex-1">{c.verification}</span>
            <MockBadge />
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="lg" className="h-11" disabled={pending} onClick={() => onOpenChange(false)}>
              {c.cancel}
            </Button>
            <Button size="lg" className="h-11" disabled={pending} onClick={onConfirm}>
              {c.confirm}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
