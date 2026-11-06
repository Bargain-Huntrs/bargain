# BargainHuntrs — SEO & Marketing/Promotions Strategy

_Last updated 2026-11-21 by devin-seo-sweep. Companion to `docs/16K_MONTHLY_GROWTH_PLAN.md` (revenue math) and `docs/x-growth-playbook.md` (X tactics)._

---

## 1. Current posture (post-audit snapshot)

**What the site already has (verified in code):**

- Canonical host consolidated: apex + `workers.dev` 301 → `www.bargainhuntrs.com` via `src/proxy.ts` edge middleware.
- Dynamic sitemap (`src/app/sitemap.ts`): ~40 static routes + live deal URLs (up to 2,000) + `/stores/{slug}` per active retailer + `/coupons/{slug}` per coupon retailer. `robots.txt` served via `src/app/robots.ts`.
- Per-route metadata on all indexable routes; OG/Twitter cards inherit `/og-image.png` from the root layout.
- JSON-LD already live: `Organization` + `ItemList` + `WebSite`/`SearchAction` (homepage), `Product`/`Offer` server-rendered on `/deals/[id]`, `FAQPage` on all 7 SEO deal-landing pages (`today`, `amazon-deals`, `walmart-deals`, `clearance`, `price-drops`, `over-50-off`, `under-10`), `Article`/`HowTo` on the 4 guides, `FAQPage` on `/real-estate`.
- All `<img>` tags have alt text; every public page has exactly one `<h1>`.
- Click-out monetization: `/d/{id}` short link → API logs the click → 302 to affiliate URL (Impact/Awin/direct tags + UTMs). 100% of recent deal bursts carried affiliate URLs.

**Fixed in this sweep (2026-11-21):**

- 14 client-component pages had no metadata → added `layout.tsx` metadata (indexable: `/auctions`, `/seller`, `/referrals`, `/community/leaderboard`, `/signup`; **noindexed**: `/login`, `/forgot-password`, `/reset-password`, `/verify-email`, `/dashboard`, `/settings`, `/admin`, `/billing`, `/dropship` — the last is a login-redirect for anon visitors).
- Missing canonicals added on 11 static pages + per-thread canonical on `/community/[id]`.
- `/deals/detail` (legacy alias that always renders an error state) → `noindex`.
- `/deals/amazon` → canonical → `/deals/amazon-deals` (two Amazon pages were competing for the same query).
- `Product` JSON-LD moved server-side into initial HTML (was hydration-dependent).
- `/referrals`, `/privacy`, `/terms` added to sitemap.

**Remaining gaps (flagged, not fixed — out of "cheap fix" scope):**

- Deal pages render body content client-side (`DealPageClient` reads `window.location.pathname`). Metadata + JSON-LD are server-rendered, but crawlers that don't execute JS (Bing, most social scrapers) see an empty body. A future win: SSR the deal payload into the page (the fetch is already server-side in `generateMetadata`).
- `/dropship` has no public landing — anon visitors are bounced to `/login`. A public marketing page for group-buy pools is a product decision, not an SEO fix.
- No `/tools` index page; the 3 tools are only reachable via direct URL/footer.
- Community threads are thin UGC — indexable, but quality depends on volume.
- No Google Search Console verification meta found (verifications are Impact/Pinterest only) — add the GSC token when known, or verify via DNS on Cloudflare.

---

## 2. SEO strategy — where we can actually win

"Deals site" head terms (`amazon deals`, `coupon codes`, `promo codes`) are owned by Slickdeals, RetailMeNot, Honey, Kinja, and every major publisher. A new domain will not rank there in 2026. The realistic wedges, in priority order:

### Wedge A — Arbitrage/reseller tooling keywords (thin competition, buyer intent)

Our tools are real, free, and target queries incumbents ignore because there's no ad product behind them:

| Target query cluster | Asset | Status |
|---|---|---|
| `arbitrage profit calculator`, `reseller profit calculator`, `fba profit calculator` | `/tools/profit-calculator` | Live, metadata done |
| `listing description generator`, `ebay listing title generator` | `/tools/listing-generator` | Live, metadata + keywords done |
| `real estate deal calculator`, `arv calculator` | `/tools/real-estate-calculator` | Live |
| `price glitch finder`, `how to find price glitches` | `/guides/how-to-find-price-glitches` + `/deals` feed | Live, HowTo schema |
| `amazon arbitrage guide`, `retail arbitrage for beginners` | 2 guide pages | Live, Article schema |
| `government surplus auctions`, `gsa auction deals` | `/auctions` | Live (metadata added this sweep) |

Play: expand each tool page with a short honest explainer + internal links to 2–3 relevant guides and the deal feed. Thin content is the main risk — each tool needs ~150 words of unique copy, not a redesign.

### Wedge B — Programmatic deal pages (the model supports it)

`arbitrage_deals` carries `retailer`, `category`, `niche`, `source`. Existing programmatic surfaces:

- `/stores/{slug}` — live, server-rendered, canonical, in sitemap. **This is the best scaling asset.** Every joined Awin advertiser that produces deals gets a page.
- `/coupons/{slug}` — live per retailer, auto-grows with the coupon pipeline.

Next programmatic layer (cheap, no new data):

1. `/deals/category/{slug}` (or `/categories/{slug}`) — one page per distinct `category` value with real volume (electronics, home, tools, toys…). Same `SeoPageLayout` pattern + `ItemList`/`FAQPage` schema. Gate on a minimum deal count (e.g. ≥10 live deals) so we don't ship thin pages.
2. `/deals/niche/{slug}` for arbitrage niches (`niche` column) — these map directly to the arbitrage-tool keyword wedge (`"electronics arbitrage deals"`, `"tools arbitrage"`).
3. Keep deal-detail URLs in the sitemap (already live) — each Product-schema page is a long-tail entry point.

### Wedge C — Freshness/velocity (what we uniquely have)

- `/deals/today` + `/deals` are genuinely live feeds — lean into "updated X min ago" copy (already rendered) and `changeFrequency: hourly` in sitemap (done).
- Google News/Discover: not realistic near-term; skip.

### Wedge D — Brand + community

- `bargainhuntrs` brand queries — own them fully (sitename schema live).
- `/community` threads — long-tail UGC; keep indexable, prune nothing yet.

### What NOT to chase

- Generic `{retailer} coupon code` head terms — RetailMeNot owns them; our `/coupons/{slug}` pages exist for coverage/internal linking, not as a growth engine.
- Programmatic spam pages (every product × every retailer) — affiliate sites get deindexed for this. Minimum-content thresholds on every template.

---

## 3. Promotions & distribution strategy

### 3.1 Affiliate monetization (the revenue layer)

| Network | Status | Action |
|---|---|---|
| **Impact** (Walmart + 39 campaigns) | ✅ Fully live — feed, UTT sitewide, verified redirect chain | None — measure RPM by retailer |
| **Amazon Associates** (`bargain0ae-20`) | ✅ Live tags | Ensure `amzn` tag on every Amazon click-out |
| **Awin** | ✅ Feed live on oracle (954 `awin_*` rows) — **joined advertisers only** (~12 programmes) pay | Priority: join more programmes (dashboard task); non-joined rows are display filler |
| **CJ** | ⚠️ Account active, token works, `CJ_*` env vars never deployed to Render | Paste env vars on Render (already in NEEDS_HUMAN) |
| **Rakuten** | ⚠️ Account active, webservices token 401s | Regenerate token, deploy |
| **Skimlinks** | ⏳ Pending approval | Follow up |
| eBay PN / Target / Best Buy direct | ❌ Never configured | Apply — eBay especially (auction/reseller audience fit) |

Rule: every click-out stays routed through `/d/{id}` so attribution and internal click logging both fire. Don't add raw retailer links in new surfaces.

### 3.2 Social — X posting (already automated)

- `bargain-api/app/services/x_poster.py` + `.github/workflows/buffer-poster.yml` (3×/day) + scheduler deal-post bursts at `BUFFER_POST_TIMES` (09/13/17 ET). Observed: ~40 posts/7d.
- Opportunity: per-network post templates — "Awin deal of the hour" posts only when a *joined* advertiser deal fires, so promoted posts always map to payable clicks.
- X playbook details live in `docs/x-growth-playbook.md` — this doc defers to it for cadence/format.

### 3.3 Push alerts (retention engine)

- FCM web push is wired (`src/lib/firebase.ts`, `firebase-messaging-sw.js`, notification prefs at `/settings/notifications`).
- Price-drop alerts + watchlist triggers exist server-side. Growth lever: prompt PWA install (PwaInstallPrompt exists) → push opt-in → alert when a watched category fires. Push CTR beats email for deal velocity.

### 3.4 Email digests

- Newsletter daily/weekly loops exist in the scheduler — **currently blocked on `RESEND_API_KEY`/`INTERNAL_API_KEY` env vars on Render** (see `.devin/NEEDS_HUMAN.md`). This is the highest-value blocked channel: a daily "top 5 deals" digest is the cheapest retention mechanism available.

### 3.5 Referral mechanics (live)

- `/referrals`: 100 Aura to referrer + 50 to referee per signup, public leaderboard. Aura is points-only (no cash value) — honest, low-abuse.
- Growth lever: referral link already carries `?ref` prefill — add referral CTA into the deal-alert email/push copy once email is unblocked.

### 3.6 Community flywheel

- Threads + voting + `/roadmap` feature board + leaderboard. Cheap retention; feeds content freshness. Moderation is admin-API-only — watch spam as volume grows.

---

## 4. Conversion paths

```
Organic/ social hit
  → SEO landing page (/deals/today, /stores/x, /coupons/x, /guides/*)
    → path A: click-out via /d/{id}          → affiliate commission (immediate revenue)
    → path B: signup gate (prices blurred)   → free account
      → watchlist/alert/push opt-in          → return visits
        → upgrade trigger (full prices, SMS, arbitrage tools)
          → Hunter $9.99 / Pro $19 / Agency $49
    → path C: /referrals share               → new signup (k-factor)
```

Subscription tiers (verified in Stripe config): Free → Hunter $9.99/mo → Pro $19/mo → Agency $49/mo. Paid gates: full deal prices, instant alerts, arbitrage scan tools, dropship commits.

---

## 5. 30 / 60 / 90-day plan

**Next 30 days (all unblocked, cheap):**

1. Deploy the SEO fixes from this sweep (`cd bargain-web && pnpm run build:cf && pnpm run deploy` — web has no auto-deploy).
2. Verify property in Google Search Console + submit sitemap; add the GSC verification meta/DNS record.
3. Unblock email digests — paste `RESEND_API_KEY` + `INTERNAL_API_KEY` + `ALERT_FROM_EMAIL` on Render (NEEDS_HUMAN).
4. Deploy `CJ_*` env vars + regenerated Rakuten token on Render (NEEDS_HUMAN) — widens payable inventory.
5. `/deals/category/{slug}` programmatic pages for the top ~8 categories by live deal count (same `SeoPageLayout` template — ~1 file + sitemap loop).
6. Join more Awin programmes (dashboard task — joined-only pays).

**Days 31–60:**

7. `/deals/niche/{slug}` pages gated on ≥10 live deals; cross-link from tool pages.
8. `/tools` index page + expand each tool page's unique copy (~150 words, honest).
9. SSR deal body on `/deals/[id]` (payload already fetched server-side) — closes the no-JS indexability gap.
10. Per-network X post template (joined-advertiser deals only) + weekly digest with referral CTA.
11. First KPI baseline: GSC impressions/clicks, `/d/` click-outs by network, signup rate per landing page.

**Days 61–90:**

12. Public `/dropship` marketing landing (product decision — currently auth-gated).
13. Apply for eBay Partner Network; evaluate Target/Best Buy direct programs.
14. Prune or consolidate any programmatic page under threshold; refresh guides with real internal data (e.g. "top categories by deal count this month" — honest, auto-updating).
15. Review GSC query data → double down on whichever wedge (tools vs. stores vs. categories) is actually pulling impressions; kill what's flat.

## 6. Measurement & honesty guardrails

- KPIs: GSC impressions→clicks per page class; `/d/{id}` click-outs + affiliate-clicks table by network; signups; free→paid conversion; push subscribers.
- Copy rules: no invented discount percentages (use computed `discountPercent` only), no fake "verified" badges, disclose affiliate relationships inline at click-out points (FTC proximity rules — already implemented).
- Schema rules: only mark up what's visibly on the page (FAQPage only where FAQs render — done; no aggregateRating/Product-review markup we can't support).
