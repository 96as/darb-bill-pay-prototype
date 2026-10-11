"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Alert, ISODateTime, Role } from "@/lib/domain/types";
import { fmt } from "@/lib/i18n";
import { LANG_COOKIE, LANG_QUERY_PARAM, type Lang } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";
import { ApiError, api, errorMessage } from "@/lib/ui/api";
import { formatClock } from "@/lib/ui/format";

export interface DemoUser {
  id: string;
  name: string;
  nameAr: string;
  title: string;
  titleAr: string;
  role: Role;
}

export interface DemoCompany {
  name: string;
  nameAr: string;
}

export type DemoAlert = Pick<Alert, "id" | "at" | "kind" | "message" | "messageAr" | "read">;

export interface DemoShellData {
  company: DemoCompany;
  users: DemoUser[];
  actingUserId: string;
  now: ISODateTime;
  /** Alerts addressed to the acting user, newest first. */
  alerts: DemoAlert[];
}

interface DemoStateValue extends DemoShellData {
  actingUser: DemoUser;
  pending: boolean;
  setActingUser: (userId: string) => void;
  setClock: (now: ISODateTime) => void;
  resetDemo: () => void;
  setLang: (lang: Lang) => void;
}

const DemoStateContext = createContext<DemoStateValue | null>(null);

/**
 * Demo controls for the shell. Acting user and clock live in the store (session.userId, clock.now):
 *   POST /api/demo/user {userId} · POST /api/demo/clock {now} · POST /api/demo/reset
 * then router.refresh() re-renders every server component with the new store, and the effects
 * below re-sync this state from the fresh props. Updates are optimistic; on an API error the
 * change is reverted and the message is shown in a toast. While the API route is missing
 * (backend not landed), the change stays local so the demo still works on screen.
 */
export function DemoStateProvider({ initial, children }: { initial: DemoShellData; children: React.ReactNode }) {
  const router = useRouter();
  const { t, lang } = useI18n();
  const [actingUserId, setActingUserId] = useState(initial.actingUserId);
  const [now, setNow] = useState(initial.now);
  const [pending, setPending] = useState(false);

  // Server data wins whenever it changes (after router.refresh()).
  useEffect(() => setActingUserId(initial.actingUserId), [initial.actingUserId]);
  useEffect(() => setNow(initial.now), [initial.now]);

  const call = useCallback(
    async (path: string, body: Record<string, unknown>, revert: () => void, success: string) => {
      setPending(true);
      try {
        await api.post(path, body);
        toast.success(success);
        router.refresh();
      } catch (error) {
        if (error instanceof ApiError && error.code === "not_available") {
          toast.info(t.demo.localOnly);
        } else {
          revert();
          toast.error(errorMessage(error));
        }
      } finally {
        setPending(false);
      }
    },
    [router, t.demo.localOnly],
  );

  const setActingUser = useCallback(
    (userId: string) => {
      const previous = actingUserId;
      if (userId === previous) return;
      const user = initial.users.find((u) => u.id === userId);
      setActingUserId(userId);
      void call(
        "/api/demo/user",
        { userId },
        () => setActingUserId(previous),
        fmt(t.demo.switchedUser, { name: user ? (lang === "ar" ? user.nameAr : user.name) : userId }),
      );
    },
    [actingUserId, call, initial.users, lang, t.demo.switchedUser],
  );

  const setClock = useCallback(
    (next: ISODateTime) => {
      const previous = now;
      setNow(next);
      void call(
        "/api/demo/clock",
        { now: next },
        () => setNow(previous),
        fmt(t.demo.clockSet, { time: formatClock(next, lang) }),
      );
    },
    [call, lang, now, t.demo.clockSet],
  );

  const resetDemo = useCallback(() => {
    const previous = { actingUserId, now };
    setActingUserId(initial.actingUserId);
    setNow(initial.now);
    void call(
      "/api/demo/reset",
      {},
      () => {
        setActingUserId(previous.actingUserId);
        setNow(previous.now);
      },
      t.demo.resetDone,
    );
  }, [actingUserId, call, initial.actingUserId, initial.now, now, t.demo.resetDone]);

  const setLang = useCallback(
    (next: Lang) => {
      document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      // A `?lang=` test override in the URL would win over the cookie on refresh:
      // drop it with a full reload. Otherwise a server refresh re-renders <html lang dir>.
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

  const value = useMemo<DemoStateValue>(() => {
    const actingUser = initial.users.find((u) => u.id === actingUserId) ?? initial.users[0];
    return {
      ...initial,
      actingUserId,
      now,
      actingUser,
      pending,
      setActingUser,
      setClock,
      resetDemo,
      setLang,
    };
  }, [initial, actingUserId, now, pending, setActingUser, setClock, resetDemo, setLang]);

  return <DemoStateContext.Provider value={value}>{children}</DemoStateContext.Provider>;
}

export function useDemoState(): DemoStateValue {
  const value = useContext(DemoStateContext);
  if (!value) throw new Error("useDemoState must be used inside <DemoStateProvider>");
  return value;
}
