import { NextResponse, type NextRequest } from "next/server";

/*
 * Fast, optimistic gate (F10): a visitor with no session cookie is sent to sign-in (pages) or gets 401 (video API)
 * before anything renders. It does NOT validate the session — the dashboard layout, every server action and every
 * API route check the session in the database. It also tells the server which page was asked for, so sign-in can
 * return there.
 */

const SESSION_COOKIE = "explivio_session";
const PUBLIC_PAGES = new Set(["/login", "/signup", "/forgot-password", "/verify-email", "/reset-password"]);

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = request.cookies.has(SESSION_COOKIE);
  if (pathname.startsWith("/api/")) {
    return signedIn ? NextResponse.next() : NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (PUBLIC_PAGES.has(pathname)) return NextResponse.next();
  if (!signedIn) {
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }
  const headers = new Headers(request.headers);
  headers.set("x-explivio-path", `${pathname}${search}`);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Everything except Next.js assets, the favicon and the database health check.
  matcher: ["/((?!_next/|favicon.ico|api/health/).*)"],
};
