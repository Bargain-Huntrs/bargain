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

// Security headers (Sentury X first-scan fix). The apex→www 301 must carry
// the same set as the pages it redirects to — scanners probe the redirect
// response itself. Stamped on the redirect ONLY: the middleware-generated
// 301 short-circuits before next.config.ts headers() runs, while the
// passthrough response still flows through headers() — stamping it here
// too produced a duplicated header set on every www 200.
// Kept in sync with next.config.ts headers() + public/_headers.
const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://www.googletagmanager.com https://static.cloudflareinsights.com https://*.impactcdn.com https://*.impactradius.com https://*.sjv.io https://*.7eer.net https://*.pxf.io https://*.evyy.net https://js.stripe.com https://www.google.com https://www.recaptcha.net https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' https: data: blob:; connect-src 'self' https://api.bargainhuntrs.com https://www.bargainhuntrs.com https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://*.googletagmanager.com https://*.impactradius.com https://*.sjv.io https://*.7eer.net https://*.pxf.io https://*.googleapis.com https://*.stripe.com wss:; frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://m.stripe.network https://checkout.stripe.com https://www.google.com https://www.recaptcha.net https://recaptcha.google.com https://*.firebaseapp.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
  "Strict-Transport-Security":
    "max-age=63072000; includeSubDomains; preload",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
};

function withSecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export function proxy(request: NextRequest) {
  try {
    const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
    if (NON_CANONICAL_HOSTS.has(host)) {
      const target = new URL(
        request.nextUrl.pathname + request.nextUrl.search,
        CANONICAL_ORIGIN,
      );
      return withSecurityHeaders(NextResponse.redirect(target, 301));
    }
  } catch {
    // never let a redirect check break a request
  }
  // Passthrough: headers() adds the security set downstream — don't duplicate.
  return NextResponse.next();
}

export const config = {
  // Documents/pages only — skip _next assets, API routes, and any path that
  // looks like a file (robots.txt, sw.js, icons, sitemap.xml, etc.).
  matcher: ["/((?!_next/|api/|.*\\.[a-z0-9]+$).*)"],
};
