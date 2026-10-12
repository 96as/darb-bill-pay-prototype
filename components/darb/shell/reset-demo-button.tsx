"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/client";

/** "Reset demo" with a confirmation dialog. */
export function ResetDemoButton({
  onReset,
  className,
  open: openProp,
  onOpenChange,
  hideTrigger,
}: {
  onReset: () => void;
  className?: string;
  /** Controlled mode (opened from the Demo panel, rendered outside it). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const t = useT();
  const [innerOpen, setInnerOpen] = useState(false);
  const open = openProp ?? innerOpen;
  const setOpen = (next: boolean) => (onOpenChange ? onOpenChange(next) : setInnerOpen(next));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {hideTrigger ? null : (
        <DialogTrigger render={<Button variant="outline" className={className} />}>
          <RotateCcw aria-hidden />
          {t.shell.resetDemo}
        </DialogTrigger>
      )}
      <DialogContent closeLabel={t.ui.close}>
        <DialogHeader>
          <DialogTitle>{t.shell.resetTitle}</DialogTitle>
          <DialogDescription>{t.shell.resetDescription}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{t.shell.cancel}</DialogClose>
          <Button
            onClick={() => {
              onReset();
              setOpen(false);
            }}
          >
            {t.shell.resetConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
