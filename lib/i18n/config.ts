// Shared i18n constants (safe to import from server, client and middleware).

export const LANGS = ["en", "ar"] as const;
export type Lang = (typeof LANGS)[number];
export type Dir = "ltr" | "rtl";

export const DEFAULT_LANG: Lang = "en";

/** Cookie that stores the chosen UI language (set by the EN/عربي toggle). */
export const LANG_COOKIE = "lang";
/** `?lang=ar` query override (demo/testing). The middleware copies it into this request header and the cookie. */
export const LANG_QUERY_PARAM = "lang";
export const LANG_HEADER = "x-darb-lang";

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGS as readonly string[]).includes(value);
}

export function dirOf(lang: Lang): Dir {
  return lang === "ar" ? "rtl" : "ltr";
}
