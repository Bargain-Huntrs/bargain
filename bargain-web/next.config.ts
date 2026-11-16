import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import { SECURITY_HEADERS } from "./src/lib/securityHeaders";

// Cloudflare Pages sets CF_PAGES=1 automatically.
// When building for CF Pages, use static export; otherwise use standalone (Render).
const isCloudflarePages = process.env.CF_PAGES === "1" || process.env.OUTPUT_EXPORT === "1";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "https://api.bargainhuntrs.com",
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
  },
  output: isCloudflarePages ? "export" : "standalone",
  // next/image remote-config decision: NO remotePatterns — raw <img> is the
  // repo convention (same as favestate-web). Deal images come from arbitrary
  // retailer CDNs, so a remote allowlist would have to be https:* anyway;
  // unoptimized stays on for static-export (CF Pages) builds.
  ...(isCloudflarePages ? {
    images: { unoptimized: true },
    trailingSlash: true,
  } : {}),
  async headers() {
    return [{
      source: '/(.*)',
      // CSP lives in src/lib/securityHeaders.ts — also stamped by src/proxy.ts
      // on the apex→www 301 and mirrored statically in public/_headers.
      // js.stripe.com script/frame + m.stripe.network frame = Stripe Elements
      // (PoolPaymentSetup); *.googleapis.com connect + google/recaptcha/
      // firebaseapp frames = Firebase phone auth + FCM.
      headers: Object.entries(SECURITY_HEADERS).map(([key, value]) => ({
        key,
        value,
      })),
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
    // Cloudflare Pages consumes _headers as config — don't precache/serve it as an asset.
    exclude: [/_headers/],
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
