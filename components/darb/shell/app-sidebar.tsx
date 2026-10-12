"use client";

import { useId } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building } from "lucide-react";
import { InitialAvatar } from "@/components/darb/initial-avatar";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { useDemoState } from "./demo-state";
import { DARB_LOGO_SRC, NAV_BOTTOM, NAV_GROUPS, type NavItem } from "./nav-config";

export function DarbWordmark({ className }: { className?: string }) {
  const { t, lang } = useI18n();
  // Arabic UI: "درب" (no logo image is configured; with one, the image carries the brand).
  const word = lang === "ar" && !DARB_LOGO_SRC ? "درب" : "Darb";
  return (
    <Link
      href="/bills"
      aria-label={`${word} · ${t.nav.bills}`}
      lang={word === "Darb" ? "en" : "ar"}
      className={cn(
        "inline-flex items-center gap-2 rounded-md text-xl leading-none font-medium tracking-tight text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        word === "Darb" ? "font-sans" : "font-arabic",
        className,
      )}
    >
      {DARB_LOGO_SRC ? (
        // eslint-disable-next-line @next/next/no-img-element -- static 24px logo slot
        <img src={DARB_LOGO_SRC} alt="" width={24} height={24} className="size-6" />
      ) : null}
      {word}
    </Link>
  );
}

function NavEntry({ item, onNavigate, inertDescId }: { item: NavItem; onNavigate?: () => void; inertDescId: string }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const label = t.nav[item.key];
  const Icon = item.icon;
  const active = item.href ? pathname === item.href || pathname.startsWith(`${item.href}/`) : false;

  // The NEW pill is visual only; the accessible name is the label alone.
  const badge = item.isNew ? (
    <span
      aria-hidden
      className={cn(
        "ms-auto rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold",
        active ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
      )}
    >
      {t.nav.newBadge}
    </span>
  ) : null;

  const base = "flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors";

  if (!item.href) {
    return (
      <li>
        <span
          role="link"
          aria-label={label}
          aria-disabled="true"
          aria-describedby={inertDescId}
          title={t.nav.notInPrototype}
          className={cn(base, "cursor-default text-muted-foreground")}
        >
          <Icon className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{label}</span>
          {badge}
        </span>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={cn(
          base,
          "outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          active ? "bg-primary-surface font-medium text-primary" : "text-foreground hover:bg-muted",
        )}
      >
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
        {badge}
      </Link>
    </li>
  );
}

/** Sidebar body (nav groups, pinned Settings, company + acting user). Shared by the desktop sidebar and the mobile sheet. */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { t, lang } = useI18n();
  const { company, actingUser } = useDemoState();
  const descId = useId();
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Shared description for the inert items (their tooltip says the same). */}
      <span id={descId} className="sr-only">
        {t.nav.notInPrototype}
      </span>
      <nav aria-label={t.nav.label} className="flex-1 overflow-y-auto px-3 py-2">
        {NAV_GROUPS.map((group, i) => (
          <ul key={i} className={cn("space-y-0.5", i > 0 && "mt-3 border-t pt-3")}>
            {group.map((item) => (
              <NavEntry key={item.key} item={item} onNavigate={onNavigate} inertDescId={descId} />
            ))}
          </ul>
        ))}
      </nav>
      <div className="px-3 pb-3">
        <ul>
          <NavEntry item={NAV_BOTTOM} onNavigate={onNavigate} inertDescId={descId} />
        </ul>
      </div>
      <div className="flex items-center gap-3 border-t px-4 py-3">
        <InitialAvatar name={company.name} icon={Building} tone="muted" size="sm" />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-medium" title={lang === "ar" ? company.nameAr : company.name}>
            {lang === "ar" ? company.nameAr : company.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {lang === "ar" ? actingUser.nameAr : actingUser.name} · {t.shell.roles[actingUser.role]}
          </p>
        </div>
      </div>
    </div>
  );
}

/** White left sidebar (w-64, border-e). Hidden under md, where the header shows a menu button instead. */
export function AppSidebar({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-e bg-background md:flex",
        className,
      )}
    >
      <div className="flex h-16 shrink-0 items-center px-6">
        <DarbWordmark />
      </div>
      <SidebarContent />
    </aside>
  );
}
