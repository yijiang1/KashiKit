import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-token";

const ENV_ADMIN = process.env.ADMIN_MODE === "true";

type Rule = { method?: string; pattern: RegExp };

// Global reference tools — need a site admin (ADMIN_MODE env, or a DB admin user).
const ADMIN_API: Rule[] = [
  { method: "PUT", pattern: /^\/api\/dictionary/ },
  { method: "DELETE", pattern: /^\/api\/dictionary/ },
  { method: "DELETE", pattern: /^\/api\/sentences/ },
  { method: "GET", pattern: /^\/api\/usage/ },
  { method: "POST", pattern: /^\/api\/admin\/backfill-quizzes/ },
  { method: "POST", pattern: /^\/api\/admin\/backfill-grammar/ },
  { method: "POST", pattern: /^\/api\/admin\/regen-all-quizzes\// },
  { method: "POST", pattern: /^\/api\/admin\/retranslate/ },
  // Full-text search over verbatim sentence_bank lyric lines (admin-only page).
  { method: "GET", pattern: /^\/api\/sentence-bank$/ },
];
const ADMIN_PAGES = ["/sentence-bank"];

// The site is otherwise closed: every page and API route needs a session. Only
// the sign-in flow itself is reachable while logged out.
const PUBLIC_PAGES = new Set(["/login", "/register"]);
const PUBLIC_API: Rule[] = [
  { pattern: /^\/api\/auth\/(login|register|logout|me)$/ },
];

function matches(rules: Rule[], method: string, pathname: string): boolean {
  return rules.some((r) => (!r.method || r.method === method) && r.pattern.test(pathname));
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method;
  const isApi = pathname.startsWith("/api/");

  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  const isAdmin = ENV_ADMIN || !!session?.admin;

  // --- admin tier: global reference tools ---
  if (!isAdmin && (matches(ADMIN_API, method, pathname) || ADMIN_PAGES.includes(pathname))) {
    return isApi
      ? NextResponse.json({ error: "Forbidden" }, { status: 403 })
      : NextResponse.redirect(new URL("/", req.url));
  }

  // --- auth wall: everything except the sign-in flow needs a session ---
  const isPublic = PUBLIC_PAGES.has(pathname) || matches(PUBLIC_API, method, pathname);
  if (!session && !ENV_ADMIN && !isPublic) {
    if (isApi) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next internals and static asset files (the two files in
  // /public are .png, covered by the extension list).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|otf|map)$).*)",
  ],
};
