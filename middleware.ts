import { NextResponse, type NextRequest } from "next/server";
import { LANG_COOKIE, LANG_HEADER, LANG_QUERY_PARAM, isLang } from "@/lib/i18n/config";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) return guardApi(request);
  return languageOverride(request);
}

// The demo has no login by design (user switcher only), so the API must at least refuse
// state-changing requests sent by other websites in the same browser (CSRF).
function guardApi(request: NextRequest) {
  if (SAFE_METHODS.has(request.method)) return NextResponse.next();
  const site = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  const crossSite = site === "cross-site" || (origin !== null && origin !== request.nextUrl.origin);
  if (!crossSite) return NextResponse.next();
  return NextResponse.json(
    { error: { code: "cross_origin", message: "Cross-origin requests are not allowed" } },
    { status: 403 },
  );
}

// Demo/testing language override: `/bills?lang=ar` renders this request in Arabic
// (via a request header read by getLang) and saves the choice in the `lang` cookie.
function languageOverride(request: NextRequest) {
  const lang = request.nextUrl.searchParams.get(LANG_QUERY_PARAM);
  if (!isLang(lang)) return NextResponse.next();

  const headers = new Headers(request.headers);
  headers.set(LANG_HEADER, lang);
  const response = NextResponse.next({ request: { headers } });
  response.cookies.set(LANG_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return response;
}

export const config = {
  matcher: ["/api/:path*", "/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
