"use client";

import { useId } from "react";
import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { errorMessage, hasErrorMessage } from "@/lib/i18n/errors";
import { cn } from "@/lib/utils";

/** Anything shaped like a rule result: lib/domain RuleResult, a service check, or a UI Gate. */
export interface GateLike {
  ok: boolean;
  code?: string;
  message?: string;
}

/** The action that unblocks a disabled button, shown next to the reason (it must be on the same screen). */
export interface Unblock {
  label: string;
  onClick?: () => void;
  href?: string;
}

/** Reason text for a denied gate, in the UI language (lib/i18n/errors.ts, then the core dictionary, then the server text). */
export function useGateReason() {
  const { t, lang } = useI18n();
  return (gate: GateLike | undefined): string | undefined => {
    if (!gate || gate.ok) return undefined;
    const fallback =
      (lang === "ar" && gate.code ? t.permissions[gate.code] : undefined) ?? gate.message ?? t.permissions[gate.code ?? ""] ?? "";
    return hasErrorMessage(gate.code) ? errorMessage(gate.code, fallback, lang) : fallback;
  };
}

/**
 * The reason a button is disabled, plus the action that unblocks it.
 * Give it an `id` and point the button's aria-describedby at it.
 */
export function GateReason({
  id,
  gate,
  unblock,
  className,
}: {
  id: string;
  gate: GateLike;
  unblock?: Unblock;
  className?: string;
}) {
  const reason = useGateReason()(gate);
  if (gate.ok || !reason) return null;
  const action = unblock ? (
    unblock.href ? (
      <Link
        href={unblock.href}
        className="inline-flex items-center gap-1 font-medium whitespace-nowrap text-primary hover:underline hover:underline-offset-4"
      >
        {unblock.label}
        <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
      </Link>
    ) : (
      <button
        type="button"
        onClick={unblock.onClick}
        className="inline-flex items-center gap-1 rounded-md font-medium whitespace-nowrap text-primary outline-none hover:underline hover:underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {unblock.label}
        <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
      </button>
    )
  ) : null;
  return (
    <p id={id} className={cn("flex items-start gap-1.5 text-xs text-muted-foreground", className)}>
      <Info className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>
        {reason}
        {action ? <> {action}</> : null}
      </span>
    </p>
  );
}

type ButtonProps = React.ComponentProps<typeof Button>;

/**
 * A button that is disabled when its gate is denied, and then says why under it and offers the
 * action that unblocks it (app-wide rule: no dead ends). `pending` disables without a reason.
 * For a pair of buttons with the same gate, render one <GateReason> and pass its id as `describedBy`
 * with `showReason={false}` on each button.
 */
export function GatedButton({
  gate,
  unblock,
  pending,
  showReason = true,
  describedBy,
  wrapperClassName,
  disabled,
  ...props
}: ButtonProps & {
  gate: GateLike;
  unblock?: Unblock;
  pending?: boolean;
  showReason?: boolean;
  describedBy?: string;
  wrapperClassName?: string;
}) {
  const ownId = useId();
  const reasonId = describedBy ?? ownId;
  const blocked = !gate.ok;
  const button = (
    <Button
      {...props}
      disabled={blocked || pending || disabled}
      aria-describedby={blocked ? reasonId : undefined}
    />
  );
  if (!showReason || !blocked) return button;
  return (
    <span className={cn("inline-flex flex-col items-start gap-1.5", wrapperClassName)}>
      {button}
      <GateReason id={reasonId} gate={gate} unblock={unblock} />
    </span>
  );
}
