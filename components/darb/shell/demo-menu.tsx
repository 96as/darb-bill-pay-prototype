"use client";

import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { Check, Clock, FlaskConical, Pencil, RotateCcw } from "lucide-react";
import { InitialAvatar } from "@/components/darb/initial-avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useI18n } from "@/lib/i18n/client";
import { formatClock } from "@/lib/ui/format";
import { cn } from "@/lib/utils";
import { DemoClock } from "./demo-clock";
import { useDemoState } from "./demo-state";
import { ResetDemoButton } from "./reset-demo-button";

/** What the Demo button opens: prototype note, demo clock, acting user, reset. */
function DemoPanelBody({ onClock, onReset, onDone }: { onClock: () => void; onReset: () => void; onDone: () => void }) {
  const { t, lang } = useI18n();
  const demo = useDemoState();
  return (
    <div className="grid min-w-0 grid-cols-1 gap-4">
      <p className="text-xs text-muted-foreground">{t.shell.prototypeTooltip}</p>

      <section className="grid gap-1.5">
        <h3 className="text-xs font-medium text-muted-foreground">{t.shell.clockLabel}</h3>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2">
          <span className="flex min-w-0 items-center gap-2 text-sm tabular-nums">
            <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">
              {formatClock(demo.now, lang)} <span className="text-muted-foreground">{t.shell.tzSuffix}</span>
            </span>
          </span>
          <Button variant="pill" size="sm" onClick={onClock}>
            <Pencil aria-hidden />
            {t.shell.editClock}
          </Button>
        </div>
      </section>

      <section className="grid gap-1.5">
        <h3 className="text-xs font-medium text-muted-foreground">{t.shell.actingAs}</h3>
        <ul className="grid gap-1" role="radiogroup" aria-label={t.shell.switchUser}>
          {demo.users.map((user) => {
            const selected = user.id === demo.actingUserId;
            return (
              <li key={user.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    if (!selected) demo.setActingUser(user.id);
                    onDone();
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-start transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                    selected && "border-primary/40 bg-primary-surface",
                  )}
                >
                  <InitialAvatar name={lang === "ar" ? user.nameAr : user.name} tone={selected ? "solid" : "soft"} size="sm" />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-sm font-medium">{lang === "ar" ? user.nameAr : user.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {lang === "ar" ? user.titleAr : user.title} · {t.shell.roles[user.role]}
                    </span>
                  </span>
                  {selected ? <Check className="size-4 text-primary" aria-hidden /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <Button variant="outline" onClick={onReset} className="w-full">
        <RotateCcw aria-hidden />
        {t.shell.resetDemo}
      </Button>
    </div>
  );
}

/**
 * The demo controls behind one amber "Demo" button: a popover in the header on desktop, a floating
 * button (bottom-end, flips in Arabic) with a sheet on phones. The clock and reset dialogs are rendered
 * here, outside the popover/sheet, so closing the panel doesn't unmount them.
 */
export function DemoMenu() {
  const { t, dir } = useI18n();
  const demo = useDemoState();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [clockOpen, setClockOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const closePanels = () => {
    setPopoverOpen(false);
    setSheetOpen(false);
  };
  const body = (
    <DemoPanelBody
      onDone={closePanels}
      onClock={() => {
        closePanels();
        setClockOpen(true);
      }}
      onReset={() => {
        closePanels();
        setResetOpen(true);
      }}
    />
  );
  const chip = (
    <>
      <FlaskConical className="size-3.5" aria-hidden />
      {t.shell.demo}
    </>
  );

  return (
    <>
      {/* Desktop: header button + popover */}
      <Popover.Root open={popoverOpen} onOpenChange={setPopoverOpen}>
        <Popover.Trigger
          aria-label={t.shell.demoControls}
          className="hidden h-8 items-center gap-1.5 rounded-full bg-warning px-3 text-xs font-medium whitespace-nowrap text-warning-foreground transition-colors outline-none hover:bg-warning/80 focus-visible:ring-3 focus-visible:ring-ring/50 md:inline-flex"
        >
          {chip}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="bottom" align="end" sideOffset={8} className="isolate z-50">
            <Popover.Popup className="w-[22rem] origin-(--transform-origin) rounded-xl bg-popover p-4 text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
              <Popover.Title className="mb-1 flex items-center gap-2 text-sm font-medium">
                <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-warning px-2.5 text-xs text-warning-foreground">
                  {chip}
                </span>
                {t.shell.prototypeNote}
              </Popover.Title>
              {body}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      {/* Phones: floating button bottom-end + sheet */}
      <button
        type="button"
        aria-label={t.shell.demoControls}
        onClick={() => setSheetOpen(true)}
        className="fixed end-4 bottom-4 z-40 inline-flex h-11 items-center gap-1.5 rounded-full bg-warning px-4 text-sm font-medium text-warning-foreground shadow-lg ring-1 ring-warning-foreground/20 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:hidden"
      >
        {chip}
      </button>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85svh] gap-3 overflow-y-auto rounded-t-2xl p-5" closeLabel={t.ui.close}>
          <SheetTitle className="flex items-center gap-2 pe-8">
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-warning px-2.5 text-xs text-warning-foreground">
              {chip}
            </span>
            {t.shell.prototypeNote}
          </SheetTitle>
          <SheetDescription className="sr-only">{t.shell.demoControls}</SheetDescription>
          <div dir={dir} className="min-w-0">
            {body}
          </div>
        </SheetContent>
      </Sheet>

      <DemoClock now={demo.now} onChange={demo.setClock} open={clockOpen} onOpenChange={setClockOpen} hideTrigger />
      <ResetDemoButton onReset={demo.resetDemo} open={resetOpen} onOpenChange={setResetOpen} hideTrigger />
    </>
  );
}
