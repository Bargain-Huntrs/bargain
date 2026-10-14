# BargainHuntrs — Path to $16,000 MRR

> Platform: deals/coupons/cashback + arbitrage alerts at [bargainhuntrs.com](https://bargainhuntrs.com)
> Stack: Next.js on Cloudflare Workers, FastAPI on Render (`api.bargainhuntrs.com`), PostgreSQL, Stripe, Resend, Telnyx, Firebase push.
> **Resources:** bootstrap only — agents + organic acquisition. No ad spend assumed.
> **Last verified:** 2026-10-21 (live probes, not assumptions)

---

## 0. Status Snapshot — verified live state

| Piece | State | Evidence |
|---|---|---|
| Web (Cloudflare Worker `bargain-web`) | ✅ `bargainhuntrs.com` → 200 | live probe |
| **API (Render `bargain-api`)** | ✅ **UP** — `api.bargainhuntrs.com/health` → 200; real origin is **`bargain-api-1o0n.onrender.com`** (Render appends a random suffix — `bargain-api.onrender.com` was never ours; its 404 `x-render-routing: no-server` is expected). Earlier "down/000" = **free-plan cold start** (15-min idle spin-down → ~50-90s wake > probe timeout). In-app keep-alive self-ping shipped (`SELF_PING_URL`) — see Phase 0.1 | live re-probe 2026-10-14 |
| Sitemap | ✅ `/sitemap.xml` → 200 (stores/deals routes) | live probe |
| Affiliate integrations | ⚠️ Code built for Amazon, eBay, Walmart, CJ, Impact, Rakuten, Awin (`app/services/affiliate_*.py`, `*_scraper.py`) — live-credential coverage unknown | code audit |
| CRM module | ✅ `bargain-api/app/routers/crm.py` + `/admin/crm` shipped | repo |
| Social autoposter | ⚠️ Built, fails loudly without platform secrets | workflow |
| Stripe checkout | ⚠️ Built (`/subscriptions/create-checkout-session`); **unverifiable while API is down** | code |
| Password reset | 🔴 Broken chain — `RESEND_API_KEY` on Render corrupted, `INTERNAL_API_KEY` + `ALERT_FROM_EMAIL` must be pasted to Render | AGENT_STATE |
| Render deploys | ✅ Auto-deploy confirmed working — endpoints from Oct-8+ commits (`/api/v1/feedback`, `/api/v1/community/threads`, dropship) are live in prod | live probe 2026-10-14 |
| Revenue baseline | ~$0–500 | no settled data |

**One-line read:** the API is alive — the earlier "down" reading caught a free-tier cold start plus a wrong origin hostname in our docs. Phase 0 is now **keeping it warm** (keep-alive + paid plan eventually) and finishing the env-var plumbing so reset emails and checkout actually work end-to-end.

---

## 1. Revenue Goal & Current Gap

| Item | Value |
|------|-------|
| Target monthly revenue | **$16,000** |
| Current baseline | **~$0** (API down = zero functioning revenue path) |
| Gap | **$16,000** |
| First $16k horizon | 6 months after API restored |

**⚠️ Pricing correction vs. the Oct-2 draft:** live pricing is **Free + Hunter $9.99/mo** (`bargain-web/src/app/pricing/plans.ts`) — the old plan assumed Pro $29 / Enterprise $99. At $9.99, subscriptions alone need ~800 paid subs for $8K; that's not the near-term pillar. The realistic mix leans harder on **affiliate commissions + merchant placements**, with subscriptions as margin on top — or a **price/tier rethink** (below).

---

## 2. Monetization Streams (build status tagged)

| Stream | Model | Price | Status |
|--------|-------|-------|--------|
| **Hunter subscription** | Instant glitch/price-error alerts, unlimited deals, calculator | **$9.99/mo** | **[BUILT]** Stripe checkout exists; consider adding Pro $19 + Agency $49 tiers |
| **Affiliate commissions** | Amazon, eBay, Walmart, CJ, Impact, Rakuten, Awin | ~3% blended of basket ≈ $2.40/order at $80 AOV | **[NEEDS-CREDS + traffic]** — integrations coded; verify live tags |
| **Featured deal placements** | Homepage/newsletter top slots, labeled Sponsored | $300–500/mo × 4–6 merchants | **[BUILT-ish]** — inventory exists once traffic exists |
| **Newsletter sponsorship** | Sponsored block in daily deal email | $150/send × 8 | **[NOT-BUILT]** — needs list size first |
| **Cashback margin** | Keep 20–30% of network cashback, pass rest to users | volume-based | **[PARTIAL]** — Impact/Rakuten cashback partners exist |
| **Display ads** | Ezoic/AdSense on SEO/coupon pages | $8–15 RPM | **[NOT-BUILT]** — apply once ≥10k sessions/mo |

### Math to $16,000/month — rebalanced for real pricing

| Stream | Volume | Price | Monthly revenue |
|--------|--------|-------|-----------------|
| Hunter subs | 400 | $9.99 | $3,996 |
| Affiliate commissions | ~2,500 attributed orders | $2.40 | $6,000 |
| Featured placements | 6 merchants | $400 | $2,400 |
| Newsletter sponsorships | 8 sends | $150 | $1,200 |
| Cashback margin | volume | — | $1,200 |
| Display ads | ~100k sessions @ $12 RPM | — | $1,200 |
| **Total** | | | **$15,996** |

**Volume needed for the affiliate pillar:** ~2,500 attributed orders/mo ≈ 83/day ≈ 4,000 outbound clicks/day at 2% conversion ≈ **120–150k sessions/mo** on deal pages (20–35% CTR to merchant). That's the real traffic target — subscriptions and placements ride on it.

**Optional pricing uplift:** add a mid-tier **Pro $19/mo** (priority alerts + API) and **Agency $49/mo** (multi-seat, white label). At 200 Hunter + 150 Pro + 20 Agency the subscription line alone ≈ $6.8K. Decide after Hunter churn data exists.

---

## 3. Phase-Gated Execution Plan

### Phase 0 — Keep the API warm + working plumbing (this week)
**Exit gate: `api.bargainhuntrs.com/health` → 200 consistently (no cold-start 000s) and a real checkout session can be created.**

| # | Task | Where |
|---|------|-------|
| 0.1 | ~~Diagnose `bargain-api`~~ **DONE 2026-10-14**: service is live; CNAME `api.bargainhuntrs.com → bargain-api-1o0n.onrender.com` (verified via Cloudflare API). Cold-start fix shipped: in-app self-ping every 10 min (`SELF_PING_URL`, gated on `RENDER` env var) + health-check workflow now pings the real origin. Optional backup: free external pinger (cron-job.org/UptimeRobot) on `/health` | shipped |
| 0.2 | Verify repo connection survived `obdulr/bargain → Bargain-Huntrs` org rename; recent commits (`2c061f9`, `da9e755`) may never have deployed | Render dashboard (user) |
| 0.3 | Paste reset-email env vars to Render: `RESEND_API_KEY` (new send-only — current is corrupted), `INTERNAL_API_KEY` (= worker secret in `bargain-api/.env`), `ALERT_FROM_EMAIL` | Render dashboard (user) |
| 0.4 | Confirm `DATABASE_URL` + Render Postgres live; `SQL_ECHO` must stay `false` in prod | Render dashboard |
| 0.5 | E2E: signup → password reset email → login → create checkout session | Playwright after 0.1–0.3 |

### Phase 1 — Money plumbing verified
**Exit gate: a $9.99 Hunter charge succeeds in prod; one affiliate click attributes end-to-end.**

| # | Task |
|---|------|
| 1.1 | Stripe: verify `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price env for Hunter; test checkout + webhook in prod |
| 1.2 | Verify each affiliate cred produces attributed links: `AMAZON_ASSOCIATES_TAG`, `EBAY_CLIENT_ID/SECRET` + `EBAY_PARTNER_NETWORK_ID`, `WALMART_AFFILIATE_ID`, `CJ_ACCESS_TOKEN` + `CJ_WEBSITE_ID`, `IMPACT_*`, `RAKUTEN_*`, `AWIN_*` — mark dead ones in checklist |
| 1.3 | FTC affiliate disclosure on every deal page + newsletter (required by Amazon TOS too) |
| 1.4 | `last verified` timestamps on coupons; auto-expire dead codes (trust + SEO) |

### Phase 2 — Acquisition engine
**Exit gate: ≥100 merchant coupon pages indexed, ≥1 social channel posting daily, newsletter ≥500 subs.**

| # | Task |
|---|------|
| 2.1 | Programmatic merchant pages ("store + coupon code") from the coupons pipeline — 150 pages month 1, 500 by month 3 |
| 2.2 | Submit sitemap to Google Search Console + Bing WMT (user grants access) |
| 2.3 | Activate social poster: X + Reddit creds → workflow secrets (8–12 posts/day cadence per `docs/x-growth-playbook.md`) |
| 2.4 | Daily "Deal of the Day" ritual 9AM ET → site + email + X simultaneously |
| 2.5 | Newsletter: 3–5 affiliate deals per send; signup CTA on every page; win-back automation via Resend |
| 2.6 | Reddit/forums: 10 genuine contributions/week in r/deals, r/frugal, r/couponing (link in profile only) |
| 2.7 | Referral loop: unique link per user — 1 free month per converted referral |
| 2.8 | Merchant outreach: 10 CJ/Impact merchants/month for exclusive codes (`BARGAIN10`) via sales-outreach skill |

### Phase 3 — Conversion & retention
**Exit gate: free→paid ≥3%, email capture ≥5% of deal-page visitors, churn <8%.**

| # | Task |
|---|------|
| 3.1 | Exit-intent capture on deal pages ("price-error alerts before they sell out") |
| 3.2 | "Founding Hunter" anchor: $9.99 locked-for-life first 100 users → creates conversion urgency |
| 3.3 | Annual plan $99/yr (2 months free) → pulls cash forward, cuts churn |
| 3.4 | UTM audit: every X/email link tagged; GA4 conversion events on signup + checkout + affiliate outclick |

### Phase 4 — Scale to $16K
- Browser extension (coupon auto-apply + price-drop alert) — the Rakuten/Honey acquisition loop; every install = persistent affiliate attribution. **This is the single biggest lever for the affiliate pillar.**
- Event mega-campaigns: Prime Day, BFCM, back-to-school (20–30% of annual affiliate revenue weeks)
- Cashback page (Impact/Rakuten rates → "earn X% back")
- UK/CA expansion via Awin
- Optional paid test only after organic converts (bootstrap exception)

---

## 4. Weekly KPI Scorecard

| Metric | Mo 1 | Mo 3 | Mo 6 | Mo 12 |
|--------|------|------|------|-------|
| MRR (all streams) | $500 | $3,500 | $16,000 | $20,000+ |
| Paid subscribers | 15 | 80 | 400 | 600 |
| Email subscribers | 500 | 3,000 | 10,000 | 25,000 |
| Monthly sessions | 5k | 30k | 120k | 300k |
| Affiliate clicks/mo | 5k | 35k | 105k | 250k |
| Attributed orders/mo | 100 | 700 | 2,500 | 5,000 |
| Placement sponsors | 0 | 2 | 6 | 10 |
| Free→paid | — | 3% | 4% | 5% |
| Churn | — | <8% | <6% | <5% |

Review Fridays. If affiliate RPM/conversion runs >20% under plan for 2 consecutive weeks, shift effort to placements/subscriptions — never let one stream's shortfall sink the target.

---

## 5. Compliance Guardrails

- **FTC/Amazon:** "As an affiliate we earn from qualifying purchases" on every deal page, merchant page, newsletter, X bio. Amazon TOS: no prices without timestamps via PA-API, **no affiliate links in emails** (link to site pages instead), no obscured link shorteners.
- **Coupons:** `last verified` stamps; auto-expire dead codes.
- **Placements:** always labeled "Sponsored"; written approval for exclusive codes.
- **Email:** CAN-SPAM/CASL — unsubscribe link, physical address, suppression list respected.
- **SMS (Telnyx only):** express consent, STOP handling, A2P 10DLC.
- **Social:** ≤3 hashtags, English titles, manual-review queue for glitch deals — avoid spam flags.
- **Never set `SQL_ECHO=true` in production.**

---

## 6. Blocked on user (the honest list)

| # | Action | Unlocks |
|---|--------|---------|
| 1 | Render dashboard: check `bargain-api` suspension + `api.bargainhuntrs.com` CNAME target | **The entire product — API is down** |
| 2 | Render dashboard: verify repo connection post-`Bargain-Huntrs` org rename | Deploys |
| 3 | Render env: paste `RESEND_API_KEY`, `INTERNAL_API_KEY`, `ALERT_FROM_EMAIL` | Password reset emails |
| 4 | Affiliate dashboards: confirm which network creds are live/approved | Affiliate pillar |
| 5 | Create X + Reddit app creds → workflow secrets | Daily social distribution |
| 6 | Verify domain in Google Search Console → submit sitemap | Coupon-page indexation |
