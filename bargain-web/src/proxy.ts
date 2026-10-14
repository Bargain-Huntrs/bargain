import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Canonical host consolidation — the sitemap and metadataBase both use
// www.bargainhuntrs.com, so the apex domain and the workers.dev origin must
// 301 here instead of serving duplicate copies that split ranking signals.
// Runs as the OpenNext external middleware (edge) on every matched request.
// (Next 16 renamed the middleware.ts convention to proxy.ts — same role.)
const CANONICAL_ORIGIN = "https://www.bargainhuntrs.com";
const NON_CANONICAL_HOSTS = new Set([
  "bargainhuntrs.com",
  "bargain-web.bargain4huntrs.workers.dev",
]);

export function proxy(request: NextRequest) {
  try {
    const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
    if (NON_CANONICAL_HOSTS.has(host)) {
      const target = new URL(
        request.nextUrl.pathname + request.nextUrl.search,
        CANONICAL_ORIGIN,
      );
      return NextResponse.redirect(target, 301);
    }
  } catch {
    // never let a redirect check break a request
  }
  return NextResponse.next();
}

export const config = {
  // Documents/pages only — skip _next assets, API routes, and any path that
  // looks like a file (robots.txt, sw.js, icons, sitemap.xml, etc.).
  matcher: ["/((?!_next/|api/|.*\\.[a-z0-9]+$).*)"],
};
