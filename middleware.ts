import { NextResponse, type NextRequest } from "next/server";
import { LANG_COOKIE, LANG_HEADER, LANG_QUERY_PARAM, isLang } from "@/lib/i18n/config";

// Demo/testing language override: `/bills?lang=ar` renders this request in Arabic
// (via a request header read by getLang) and saves the choice in the `lang` cookie.
export function middleware(request: NextRequest) {
  const lang = request.nextUrl.searchParams.get(LANG_QUERY_PARAM);
  if (!isLang(lang)) return NextResponse.next();

  const headers = new Headers(request.headers);
  headers.set(LANG_HEADER, lang);
  const response = NextResponse.next({ request: { headers } });
  response.cookies.set(LANG_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
