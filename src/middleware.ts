import { NextRequest, NextResponse } from "next/server";

const ADMIN_ONLY_PATTERNS: { method: string; pattern: RegExp }[] = [
  { method: "DELETE", pattern: /^\/api\/songs\// },
  { method: "PUT",    pattern: /^\/api\/dictionary/ },
  { method: "DELETE", pattern: /^\/api\/dictionary/ },
  { method: "POST",   pattern: /^\/api\/import/ },
  { method: "PUT",    pattern: /^\/api\/sync-offset\// },
  { method: "PUT",    pattern: /^\/api\/trim\// },
  { method: "GET",    pattern: /^\/api\/usage/ },
  { method: "GET",    pattern: /^\/api\/fetch-lyrics/ },
  { method: "GET",    pattern: /^\/api\/fetch-transcript/ },
  { method: "POST",   pattern: /^\/api\/quiz\/generate\// },
  { method: "DELETE", pattern: /^\/api\/sentences/ },
];

const ADMIN_ONLY_PAGES = ["/import", "/sentence-bank"];

export function middleware(req: NextRequest) {
  const isAdmin = process.env.ADMIN_MODE === "true";
  const { pathname } = req.nextUrl;

  // Block admin-only pages
  if (!isAdmin && ADMIN_ONLY_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Block admin-only API routes
  if (!isAdmin) {
    for (const { method, pattern } of ADMIN_ONLY_PATTERNS) {
      if (req.method === method && pattern.test(pathname)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/import", "/sentence-bank", "/api/:path*"],
};
