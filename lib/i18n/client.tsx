"use client";

import { createContext, useContext, useMemo } from "react";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { dirOf, getDict, type Dict, type Dir, type Lang } from "./index";

interface I18nValue {
  lang: Lang;
  dir: Dir;
  t: Dict;
}

const I18nContext = createContext<I18nValue | null>(null);

/**
 * Mounted once in app/layout.tsx with the language resolved on the server.
 * Also tells Base UI the text direction (menus, selects, tabs flip in Arabic).
 */
export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const value = useMemo<I18nValue>(() => ({ lang, dir: dirOf(lang), t: getDict(lang) }), [lang]);
  return (
    <I18nContext.Provider value={value}>
      <DirectionProvider direction={value.dir}>{children}</DirectionProvider>
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside <I18nProvider>");
  return value;
}

/** The dictionary for the current language, e.g. `const t = useT(); t.bills.title`. */
export function useT(): Dict {
  return useI18n().t;
}

export function useLang(): Lang {
  return useI18n().lang;
}
