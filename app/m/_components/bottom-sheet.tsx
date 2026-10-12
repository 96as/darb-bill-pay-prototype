"use client";

import { Dialog } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { usePortalContainer } from "@/components/darb/portal-container";
import { cn } from "@/lib/utils";

/** Phone-style bottom sheet. Portalled into the phone frame (on desktop) via PortalContainerContext. */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const container = usePortalContainer();
  const t = useT();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={container}>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[85%] flex-col rounded-t-3xl border-t bg-background pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg outline-none transition duration-200 data-ending-style:translate-y-8 data-ending-style:opacity-0 data-starting-style:translate-y-8 data-starting-style:opacity-0",
            className,
          )}
        >
          <span aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25" />
          <Dialog.Close
            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "absolute end-3 top-3")}
            aria-label={t.payments.close}
          >
            <XIcon aria-hidden />
          </Dialog.Close>
          <div className="space-y-1 px-5 pt-3 pb-3 pe-12">
            <Dialog.Title className="text-base font-medium">{title}</Dialog.Title>
            {description ? <Dialog.Description className="text-sm text-muted-foreground">{description}</Dialog.Description> : null}
          </div>
          <div className="min-h-0 overflow-y-auto px-5">{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
