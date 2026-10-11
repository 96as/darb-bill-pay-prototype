"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ISODateTime, Role } from "@/lib/domain/types";
import { LANG_COOKIE, LANG_QUERY_PARAM, type Lang } from "@/lib/i18n/config";

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

export interface DemoShellData {
  company: DemoCompany;
  users: DemoUser[];
  actingUserId: string;
  now: ISODateTime;
}

interface DemoStateValue extends DemoShellData {
  actingUser: DemoUser;
  setActingUser: (userId: string) => void;
  setClock: (now: ISODateTime) => void;
  resetDemo: () => void;
  setLang: (lang: Lang) => void;
}

const DemoStateContext = createContext<DemoStateValue | null>(null);

/**
 * Demo controls state for the shell (acting user, clock, reset, language).
 *
 * WIRING (later): replace the local `set*` calls below with
 *   POST /api/demo/user  { userId }
 *   POST /api/demo/clock { now }
 *   POST /api/demo/reset
 * followed by `router.refresh()`. The server then re-renders with the new store, and
 * the effect below re-syncs this state from the fresh props.
 */
export function DemoStateProvider({ initial, children }: { initial: DemoShellData; children: React.ReactNode }) {
  const router = useRouter();
  const [actingUserId, setActingUserId] = useState(initial.actingUserId);
  const [now, setNow] = useState(initial.now);

  // Server data wins whenever it changes (after router.refresh()).
  useEffect(() => setActingUserId(initial.actingUserId), [initial.actingUserId]);
  useEffect(() => setNow(initial.now), [initial.now]);

  const setActingUser = useCallback((userId: string) => {
    setActingUserId(userId); // TODO wire: POST /api/demo/user, then router.refresh()
  }, []);

  const setClock = useCallback((next: ISODateTime) => {
    setNow(next); // TODO wire: POST /api/demo/clock, then router.refresh()
  }, []);

  const resetDemo = useCallback(() => {
    // TODO wire: POST /api/demo/reset, then router.refresh()
    setActingUserId(initial.actingUserId);
    setNow(initial.now);
  }, [initial.actingUserId, initial.now]);

  const setLang = useCallback(
    (lang: Lang) => {
      document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
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
      setActingUser,
      setClock,
      resetDemo,
      setLang,
    };
  }, [initial, actingUserId, now, setActingUser, setClock, resetDemo, setLang]);

  return <DemoStateContext.Provider value={value}>{children}</DemoStateContext.Provider>;
}

export function useDemoState(): DemoStateValue {
  const value = useContext(DemoStateContext);
  if (!value) throw new Error("useDemoState must be used inside <DemoStateProvider>");
  return value;
}
