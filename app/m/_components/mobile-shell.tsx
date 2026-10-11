"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { InitialAvatar } from "@/components/darb/initial-avatar";
import { ApiError, postJSON } from "@/components/darb/payment-actions";
import { PortalContainerContext } from "@/components/darb/portal-container";
import type { DemoUser } from "@/components/darb/shell/demo-state";
import { LangToggle } from "@/components/darb/shell/lang-toggle";
import { LANG_COOKIE, LANG_QUERY_PARAM, type Lang } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { BottomSheet } from "./bottom-sheet";

interface MobileDemoValue {
  users: DemoUser[];
  actingUser: DemoUser;
  setActingUser: (userId: string) => void;
}

const MobileDemoContext = createContext<MobileDemoValue | null>(null);

export function useMobileDemo(): MobileDemoValue {
  const value = useContext(MobileDemoContext);
  if (!value) throw new Error("useMobileDemo must be used inside <MobileShell>");
  return value;
}

/**
 * Mobile approval view shell: a phone-width column. On desktop it sits in a subtle phone frame
 * (36px radius) on the secondary background; at real phone width there is no frame.
 * The frame is the containing block for overlays (`transform`), so sheets stay inside it.
 */
export function MobileShell({
  users,
  actingUserId,
  children,
}: {
  users: DemoUser[];
  actingUserId: string;
  children: React.ReactNode;
}) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const frameRef = useRef<HTMLDivElement>(null);
  const [acting, setActing] = useState(actingUserId);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Server data wins after router.refresh().
  useEffect(() => setActing(actingUserId), [actingUserId]);

  const setActingUser = useCallback(
    async (userId: string) => {
      setSheetOpen(false);
      try {
        await postJSON("/api/demo/user", { userId });
        setActing(userId);
        router.refresh();
      } catch (err) {
        // Until POST /api/demo/user exists, switch locally (like the desktop demo bar does today).
        if (err instanceof ApiError && (err.status === 404 || err.status === 405)) setActing(userId);
        else toast.error(err instanceof ApiError && err.message ? err.message : t.payments.errors.generic);
      }
    },
    [router, t],
  );

  const setLang = useCallback(
    (next: Lang) => {
      document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      const url = new URL(window.location.href);
      if (url.searchParams.has(LANG_QUERY_PARAM)) {
        url.searchParams.delete(LANG_QUERY_PARAM);
        window.location.replace(url);
        return;
      }
      router.refresh();
    },
    [router],
  );

  const value = useMemo<MobileDemoValue>(
    () => ({ users, actingUser: users.find((u) => u.id === acting) ?? users[0], setActingUser }),
    [users, acting, setActingUser],
  );
  const nameOf = (u: DemoUser) => (lang === "ar" ? u.nameAr : u.name);

  return (
    <MobileDemoContext.Provider value={value}>
      <PortalContainerContext.Provider value={frameRef}>
        <div className="min-h-svh bg-background md:flex md:items-center md:justify-center md:bg-background-secondary md:p-8">
          <div
            ref={frameRef}
            className="relative mx-auto flex min-h-svh w-full max-w-[400px] flex-col bg-background md:h-[min(860px,calc(100svh-4rem))] md:min-h-0 md:overflow-hidden md:rounded-[36px] md:border md:shadow-xl md:ring-8 md:ring-foreground/[0.04] md:[transform:translateZ(0)]"
          >
            <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
              <Link
                href="/m"
                lang="en"
                className="rounded-md text-xl leading-none font-medium tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Darb
              </Link>
              <div className="ms-auto flex items-center gap-2">
                <LangToggle lang={lang} onChange={setLang} />
                <button
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  aria-label={`${t.payments.mobile.switchUser}: ${nameOf(value.actingUser)}`}
                  className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <InitialAvatar name={nameOf(value.actingUser)} tone="solid" size="sm" />
                </button>
              </div>
            </header>
            <div className="flex flex-1 flex-col md:min-h-0 md:overflow-y-auto">{children}</div>
          </div>
        </div>

        <BottomSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title={t.payments.mobile.switchUser}
          description={`${t.shell.actingAs}: ${nameOf(value.actingUser)}`}
        >
          <ul className="space-y-1 pb-1">
            {users.map((user) => {
              const selected = user.id === value.actingUser.id;
              return (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => setActingUser(user.id)}
                    aria-current={selected ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                      selected && "bg-primary-surface hover:bg-primary-surface",
                    )}
                  >
                    <InitialAvatar name={nameOf(user)} tone={selected ? "solid" : "soft"} size="sm" />
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="truncate text-sm font-medium">{nameOf(user)}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {lang === "ar" ? user.titleAr : user.title} · {t.shell.roles[user.role]}
                      </span>
                    </span>
                    {selected ? <Check className="size-4 text-primary" aria-hidden /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </BottomSheet>
      </PortalContainerContext.Provider>
    </MobileDemoContext.Provider>
  );
}
