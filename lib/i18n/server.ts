// Server-only: reads the request. Do not import from client components.
import { cookies, headers } from "next/headers";
import { DEFAULT_LANG, LANG_COOKIE, LANG_HEADER, isLang, type Lang } from "./config";

/**
 * UI language for this request.
 * 1. `?lang=ar|en` query override (demo/testing): middleware.ts copies it into the
 *    `x-darb-lang` request header (and saves it in the cookie for later requests).
 * 2. The `lang` cookie set by the EN/عربي toggle.
 * 3. English.
 */
export async function getLang(): Promise<Lang> {
  const override = (await headers()).get(LANG_HEADER);
  if (isLang(override)) return override;
  const fromCookie = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(fromCookie) ? fromCookie : DEFAULT_LANG;
}

export { getDict } from "./index";
