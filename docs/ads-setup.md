# Ads & Conversion Tracking Setup — BargainHuntrs

**Tracking first, spend second** — this doc covers the plumbing only. No ad
spend and no ad-account creation has been done on the owner's behalf.

## Tags (all env-gated — nothing loads when unset)

| Tag | Env var | Loader |
|---|---|---|
| GTM container (`GTM-XXXX`) **or** GA4/Google Ads tag (`G-`/`AW-`) | `NEXT_PUBLIC_GTM_ID` | `src/app/components/GoogleAnalytics.tsx` |
| (legacy alias) GA4 tag id | `NEXT_PUBLIC_GA4_ID` | same component — kept for existing deploys |
| Microsoft Advertising UET | `NEXT_PUBLIC_MS_UET_ID` | same component |

- `GoogleAnalytics` was extended (not duplicated) — it now loads the Google
  tag (`gtm.js` for `GTM-` ids, `gtag.js` for `G-`/`AW-` ids) and Microsoft
  UET, and still returns `null` when nothing is configured.
- Mounted once in `src/app/layout.tsx` (`<GoogleAnalytics />`).
- Impact affiliate tracking (`impactStat`) is separate and always-on in the
  layout — untouched.
- Set env vars as Cloudflare Worker env vars (or `.env.local` in dev).

## Conversion events fired

| Event | File | Trigger |
|---|---|---|
| `sign_up` | `src/app/signup/page.tsx` | `authService.register` success |
| `login` | `src/app/login/page.tsx` | `authService.login` success |
| `begin_checkout` | `src/app/pricing/PricingPlans.tsx` | Stripe checkout session created (before redirect) |

`trackEvent()` in `src/lib/ads.ts` pushes `{event: name, ...}` to
`window.dataLayer` (consumed by GTM), calls `window.gtag('event', …)` when
gtag.js is loaded, and pushes a UET custom event when UET is loaded. All
no-ops until tags exist.

## What the owner must create (agents must NOT create accounts or spend)

1. **Google Ads** — <https://ads.google.com> → **Expert Mode** → "Create an
   account without a campaign". **Tools → Conversions → New conversion action
   → Website**: `sign_up` and `begin_checkout` (or import from GA4). API
   uploads later: **Tools → Setup → API Center** → request a developer token
   (basic access, no spend required). Put the tag id in `NEXT_PUBLIC_GTM_ID`
   (or keep using `NEXT_PUBLIC_GA4_ID` for a plain GA4 tag).
2. **Microsoft Ads** — <https://ads.microsoft.com> → account →
   **Tools → UET tag → Create UET tag** → tag id into `NEXT_PUBLIC_MS_UET_ID`.
   **Tools → Conversion goals** — custom-event goals matching `sign_up` /
   `login` / `begin_checkout`.
3. **Meta pixel** (optional, later) — Meta Events Manager → Web data source →
   add snippet behind `NEXT_PUBLIC_META_PIXEL_ID` when needed.

## UTM convention (all campaigns)

- `utm_source` — network: `google`, `bing`, `meta`, `x`, `newsletter`
- `utm_medium` — `cpc`, `paid_social`, `email`, `referral`
- `utm_campaign` — `bargain-<goal>-<yyyymm>` (e.g. `bargain-signup-202612`)
- `utm_content` — creative/ad-variant slug
- `utm_term` — keyword or audience label (paid search only)

## Privacy

Disclosure lives in `src/app/privacy/page.tsx` §4 ("Cookies and tracking") —
Analytics + Ad measurement + Affiliate attribution bullets — required before
pixels go live.
