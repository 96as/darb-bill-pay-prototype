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
export function ResetDemoButton({ onReset, className }: { onReset: () => void; className?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className={className} />}>
        <RotateCcw aria-hidden />
        <span className="hidden xl:inline">{t.shell.resetDemo}</span>
        <span className="sr-only xl:hidden">{t.shell.resetDemo}</span>
      </DialogTrigger>
      <DialogContent>
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
