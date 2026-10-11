"use client";

import { Bell, CircleQuestionMark } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { DemoChip } from "./demo-chip";
import { DemoClock } from "./demo-clock";
import { useDemoState } from "./demo-state";
import { LangToggle } from "./lang-toggle";
import { ResetDemoButton } from "./reset-demo-button";
import { UserSwitcher } from "./user-switcher";

/** Inert round icon button (Darb header style). Not part of the prototype. */
function InertIconButton({ icon: Icon, label, className }: { icon: typeof Bell; label: string; className?: string }) {
  const { t } = useI18n();
  return (
    <span
      role="button"
      aria-disabled="true"
      aria-label={label}
      title={t.nav.notInPrototype}
      className={cn(
        "flex size-8 cursor-default items-center justify-center rounded-full border bg-background text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
    </span>
  );
}

/** Right side of the top header: demo controls + Darb's round icon buttons + user avatar/switcher. */
export function DemoBar({ className }: { className?: string }) {
  const { t, lang } = useI18n();
  const demo = useDemoState();
  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-2", className)}>
      <div
        role="group"
        aria-label={t.shell.demoControls}
        className="flex flex-wrap items-center gap-2"
      >
        <DemoChip />
        <DemoClock now={demo.now} onChange={demo.setClock} />
        <ResetDemoButton onReset={demo.resetDemo} />
        <LangToggle lang={lang} onChange={demo.setLang} />
      </div>
      <span aria-hidden className="mx-1 hidden h-6 w-px bg-border xl:block" />
      <div className="flex items-center gap-2">
        <InertIconButton icon={Bell} label={t.shell.notifications} />
        <InertIconButton icon={CircleQuestionMark} label={t.shell.help} className="hidden xl:flex" />
        <UserSwitcher users={demo.users} actingUserId={demo.actingUserId} onChange={demo.setActingUser} />
      </div>
    </div>
  );
}
