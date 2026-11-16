/**
 * Single source of truth for the site's security header set.
 *
 * Consumed by:
 *  - next.config.ts headers() — stamps the set on every document response
 *  - src/proxy.ts — the apex→www 301 short-circuits before headers() runs,
 *    so the redirect itself must carry the same set
 *
 * public/_headers holds a static mirror for CF Pages-style serving — it
 * can't import code, so it must stay byte-identical to CSP below. If you
 * change CSP here, update _headers in the same commit.
 */
export const CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://www.googletagmanager.com https://static.cloudflareinsights.com https://*.impactcdn.com https://*.impactradius.com https://*.sjv.io https://*.7eer.net https://*.pxf.io https://*.evyy.net https://js.stripe.com https://www.google.com https://www.recaptcha.net https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' https: data: blob:; connect-src 'self' https://api.bargainhuntrs.com https://www.bargainhuntrs.com https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://*.googletagmanager.com https://*.impactradius.com https://*.sjv.io https://*.7eer.net https://*.pxf.io https://*.googleapis.com https://*.stripe.com wss:; frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://m.stripe.network https://checkout.stripe.com https://www.google.com https://www.recaptcha.net https://recaptcha.google.com https://*.firebaseapp.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'";

export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CSP,
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
};
