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

// Per-song creation / editing tools — need any signed-in user. The route
// handler then enforces per-song ownership (owner or admin).
const AUTH_API: Rule[] = [
  { method: "POST", pattern: /^\/api\/import/ },
  { method: "PUT", pattern: /^\/api\/difficulty\// },
  { method: "POST", pattern: /^\/api\/difficulty\/assess\// },
  { method: "PUT", pattern: /^\/api\/trim\// },
  { method: "POST", pattern: /^\/api\/quiz\/generate\// },
  { method: "DELETE", pattern: /^\/api\/songs\// },
  { method: "PATCH", pattern: /^\/api\/songs\// },
  { method: "GET", pattern: /^\/api\/fetch-lyrics/ },
  { method: "GET", pattern: /^\/api\/fetch-transcript/ },
  { pattern: /^\/api\/admin\/lyrics-editor\// },
  // Read endpoints that return verbatim lyric lines / translations or
  // lyric-derived quiz text. Gated so no copyrighted lyric content reaches
  // unauthenticated callers (also enforced in each route handler).
  { method: "GET", pattern: /^\/api\/kana$/ },
  { method: "GET", pattern: /^\/api\/pinyin$/ },
  { method: "GET", pattern: /^\/api\/sentences$/ },
  { method: "GET", pattern: /^\/api\/study\// },
  { method: "GET", pattern: /^\/api\/quiz$/ },
  { pattern: /^\/api\/pronunciation\// },
];
// Pages that server-render verbatim lyric lines + translations. Gated so no
// copyrighted lyric content is served to unauthenticated visitors. (Interim
// containment — revisit when the excerpt redesign gives these a public,
// short-excerpt-only view.)
const AUTH_PAGES = ["/import", "/admin/lyrics-editor", "/study", "/grammar", "/account"];

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

  // --- auth tier: signed-in users only ---
  const needsAuth =
    matches(AUTH_API, method, pathname) ||
    AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!session && needsAuth) {
    if (isApi) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/import",
    "/account",
    "/sentence-bank",
    "/admin/:path*",
    "/api/:path*",
    "/study/:path*",
    "/grammar",
  ],
};
