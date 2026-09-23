import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

// Cloudflare Pages sets CF_PAGES=1 automatically.
// When building for CF Pages, use static export; otherwise use standalone (Render).
const isCloudflarePages = process.env.CF_PAGES === "1" || process.env.OUTPUT_EXPORT === "1";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "https://api.bargainhuntrs.com",
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
  },
  output: isCloudflarePages ? "export" : "standalone",
  // For static export, we need to set the base path and image config
  ...(isCloudflarePages ? {
    images: { unoptimized: true },
    trailingSlash: true,
  } : {}),
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        {
          key: 'Content-Security-Policy',
          value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://www.googletagmanager.com https://static.cloudflareinsights.com https://*.impactcdn.com https://*.impactradius.com https://*.sjv.io https://*.7eer.net https://*.pxf.io https://*.evyy.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' https: data: blob:; connect-src 'self' https://api.bargainhuntrs.com https://www.bargainhuntrs.com https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://*.googletagmanager.com https://*.impactradius.com https://*.sjv.io https://*.7eer.net https://*.pxf.io wss:; frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
        },
      ],
    }];
  },
};

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  disable: process.env.NODE_ENV === "development",
  // Don't precache the start URL — precached HTML goes stale after deploys.
  cacheStartUrl: false,
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    runtimeCaching: [
      {
        // Page navigations always hit the network — the default "pages"
        // runtime cache (24h) was serving stale builds after deploys.
        // Custom rules are registered before the defaults, so this wins.
        urlPattern: ({ request }: { request: Request }) =>
          request.mode === "navigate",
        handler: "NetworkOnly",
      },
    ],
  },
});

export default withPWA(nextConfig);
