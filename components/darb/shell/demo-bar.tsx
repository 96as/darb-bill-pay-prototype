"use client";

import { CircleQuestionMark } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { AlertsBell } from "./alerts-bell";
import { DemoMenu } from "./demo-menu";
import { useDemoState } from "./demo-state";
import { LangToggle } from "./lang-toggle";
import { UserSwitcher } from "./user-switcher";

/** Inert round icon button (Darb header style). Not part of the prototype. */
function InertIconButton({ icon: Icon, label, className }: { icon: typeof CircleQuestionMark; label: string; className?: string }) {
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

/**
 * Right side of the top header, one row at every width: the Demo button (desktop; phones get a
 * floating one), language, alerts, help and the user avatar (which opens the user switcher).
 */
export function DemoBar({ className }: { className?: string }) {
  const { t, lang } = useI18n();
  const demo = useDemoState();
  return (
    <div className={cn("flex shrink-0 items-center gap-2", className)}>
      <DemoMenu />
      <LangToggle lang={lang} onChange={demo.setLang} />
      <AlertsBell />
      <InertIconButton icon={CircleQuestionMark} label={t.shell.help} className="hidden xl:flex" />
      <UserSwitcher
        users={demo.users}
        actingUserId={demo.actingUserId}
        onChange={demo.setActingUser}
        open={demo.switcherOpen}
        onOpenChange={demo.setSwitcherOpen}
      />
    </div>
  );
}
