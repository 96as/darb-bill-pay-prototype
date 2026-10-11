"use client";

import { useState } from "react";
import { Check, Clock, Pencil } from "lucide-react";
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

/** Quick picks for the demo script (Riyadh wall-clock times). */
const PRESETS = [
  { date: "2026-10-15", time: "16:10", note: "presetStart" },
  { date: "2026-10-15", time: "14:00", note: "presetBeforeCutoff" },
  { date: "2026-10-18", time: "09:00", note: "presetSundayOpen" },
  { date: "2026-10-16", time: "23:00", note: "presetWeekend" },
] as const;

/** Demo clock: "Thu 15 Oct 2026, 4:10 PM Riyadh" with an edit control (dialog with quick picks). */
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
      setError(null);
    }
    setOpen(next);
  }

  const [error, setError] = useState<string | null>(null);

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!date || !time) return;
    const next = riyadhToInstant(date, time);
    if (Date.parse(next) < Date.parse(now)) {
      setError(t.demo.forwardOnly);
      return;
    }
    setError(null);
    if (next !== now) onChange(next);
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
          <div className="grid gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">{t.demo.presets}</p>
            <ul className="grid gap-1">
              {PRESETS.map((preset) => {
                const instant = riyadhToInstant(preset.date, preset.time);
                const current = instant === now;
                // The demo clock only moves forward (API: clock_backwards); Reset goes back to the start.
                const past = !current && Date.parse(instant) < Date.parse(now);
                return (
                  <li key={instant}>
                    <button
                      type="button"
                      disabled={past}
                      onClick={() => {
                        if (!current) onChange(instant);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-start transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                        current && "border-primary/40 bg-primary-surface",
                        past && "cursor-not-allowed opacity-50 hover:bg-transparent",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium tabular-nums">{formatClock(instant, lang)}</span>
                        <span className="block text-xs text-muted-foreground">{t.demo[preset.note]}</span>
                      </span>
                      {current ? <Check className="size-4 text-primary" aria-hidden /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <p className="text-xs font-medium text-muted-foreground">{t.demo.custom}</p>
          <div className="-mt-2 grid grid-cols-2 gap-3">
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
          {error ? (
            <p role="alert" className="-mt-2 text-xs text-error-foreground">
              {error}
            </p>
          ) : (
            <p className="-mt-2 text-xs text-muted-foreground">{t.demo.forwardOnly}</p>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>{t.shell.cancel}</DialogClose>
            <Button type="submit">{t.shell.save}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
