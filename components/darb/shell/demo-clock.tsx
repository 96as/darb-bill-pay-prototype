"use client";

import { useState } from "react";
import { Clock, Pencil } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ISODateTime } from "@/lib/domain/types";
import { useI18n } from "@/lib/i18n/client";
import { formatClock, riyadhDate, riyadhTime, riyadhToInstant } from "@/lib/ui/format";
import { cn } from "@/lib/utils";

/** Demo clock: "Thu 15 Oct 2026, 4:10 PM Riyadh" with an edit control (dialog). */
export function DemoClock({
  now,
  onChange,
  className,
}: {
  now: ISODateTime;
  onChange: (now: ISODateTime) => void;
  className?: string;
}) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(riyadhDate(now));
  const [time, setTime] = useState(riyadhTime(now));

  function handleOpenChange(next: boolean) {
    if (next) {
      setDate(riyadhDate(now));
      setTime(riyadhTime(now));
    }
    setOpen(next);
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!date || !time) return;
    onChange(riyadhToInstant(date, time));
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label={`${t.shell.clockLabel}: ${formatClock(now, lang, { tzSuffix: t.shell.tzSuffix })}. ${t.shell.editClock}`}
            className={cn(
              "group/clock inline-flex h-8 items-center gap-2 rounded-lg border bg-background px-2.5 text-sm whitespace-nowrap tabular-nums transition-colors outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              className,
            )}
          />
        }
      >
        <Clock className="size-4 text-muted-foreground" aria-hidden />
        <span aria-hidden>
          <span className="hidden xl:inline">{formatClock(now, lang)}</span>
          <span className="xl:hidden">{formatClock(now, lang, { withYear: false })}</span>{" "}
          <span className="text-muted-foreground">{t.shell.tzSuffix}</span>
        </span>
        <Pencil className="size-3.5 text-muted-foreground group-hover/clock:text-primary" aria-hidden />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={save} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t.shell.clockTitle}</DialogTitle>
            <DialogDescription>{t.shell.clockDescription}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="demo-clock-date">{t.shell.date}</Label>
              <Input id="demo-clock-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="demo-clock-time">
                {t.shell.time} <span className="font-normal text-muted-foreground">({t.shell.tzSuffix})</span>
              </Label>
              <Input id="demo-clock-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>{t.shell.cancel}</DialogClose>
            <Button type="submit">{t.shell.save}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
