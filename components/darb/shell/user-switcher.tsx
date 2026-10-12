"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InitialAvatar } from "@/components/darb/initial-avatar";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import type { DemoUser } from "./demo-state";

/** Demo user switcher: round primary avatar + acting user's name and role ("Prepare only" / "Approver"). */
export function UserSwitcher({
  users,
  actingUserId,
  onChange,
  open,
  onOpenChange,
  className,
}: {
  users: DemoUser[];
  actingUserId: string;
  onChange: (userId: string) => void;
  /** Controlled open state (optional), so other screens can open the switcher. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  const { t, lang } = useI18n();
  const acting = users.find((u) => u.id === actingUserId) ?? users[0];
  const nameOf = (u: DemoUser) => (lang === "ar" ? u.nameAr : u.name);
  const titleOf = (u: DemoUser) => (lang === "ar" ? u.titleAr : u.title);

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange ? (next) => onOpenChange(next) : undefined}>
      <DropdownMenuTrigger
        aria-label={`${t.shell.switchUser}: ${nameOf(acting)}`}
        className={cn(
          "flex h-10 items-center gap-2.5 rounded-full py-1 ps-1 pe-2.5 text-start transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted",
          className,
        )}
      >
        <InitialAvatar name={nameOf(acting)} tone="solid" size="sm" />
        <span className="hidden min-w-0 flex-col leading-tight lg:flex">
          <span className="truncate text-sm font-medium">{nameOf(acting)}</span>
          <span className="truncate text-xs text-muted-foreground">{t.shell.roles[acting.role]}</span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1.5">{t.shell.switchUser}</DropdownMenuLabel>
          {users.map((user) => {
            const selected = user.id === acting.id;
            return (
              <DropdownMenuItem
                key={user.id}
                onClick={() => onChange(user.id)}
                className="gap-2.5 px-2 py-2"
                aria-current={selected ? "true" : undefined}
              >
                <InitialAvatar name={nameOf(user)} tone={selected ? "solid" : "soft"} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate font-medium">{nameOf(user)}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {titleOf(user)} · {t.shell.roles[user.role]}
                  </span>
                </span>
                {selected ? <Check className="size-4 text-primary" aria-hidden /> : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
