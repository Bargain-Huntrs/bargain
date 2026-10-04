# BargainHuntrs — Path to $16,000 MRR

> Executable growth plan for reaching **$16,000 USD in monthly recurring revenue**.
> Platform: bargains/coupons/cashback + arbitrage alerts at [bargainhuntrs.com](https://bargainhuntrs.com)
> Stack: Next.js on Cloudflare Workers, FastAPI on Render (`api.bargainhuntrs.com:4030`), PostgreSQL, Stripe, Resend, Telnyx, Firebase push.
> Last updated: 2026-10-02

---

## 1. Revenue Goal & Current Gap

**Goal:** $16,000/month recurring revenue within 6 months, held and grown through month 12.

**Current state (assumed baseline):**

| Stream | Status | Est. MRR |
|---|---|---|
| Subscriptions (Pro $29 / Enterprise $99) | Live via Stripe, minimal traction | ~$0–500 |
| Affiliate commissions (Amazon, eBay, Walmart, CJ, Impact, Rakuten, Awin) | Integrations built, low traffic | ~$0–200 |
| Featured deal placements | Not sold yet | $0 |
| Cashback revenue share | Not live | $0 |
| Display ads / sponsorships | Not live | $0 |
| **Total** | | **~$0–700** |

**Gap to close: ~$15,300–16,000/month.**

Strategy: build **three pillars** so no single stream carries the target — subscriptions (high margin, truly recurring), affiliate + cashback (scales with traffic), and merchant placements (B2B recurring).

---

## 2. Monetization Streams & Pricing

### Stream A — Paid Subscriptions (target: $8,000/mo)

Existing tiers (see `bargain-web/src/app/pricing/plans.ts` → backend `free`/`pro`/`enterprise`):

| Tier | Price | Value prop |
|---|---|---|
| Free | $0 | 5 alerts/day, 24h delay — top of funnel |
| Pro ("Hustler") | $29/mo | Instant glitch/price-error alerts, unlimited deals, profit calculator |
| Enterprise ("Agency") | $99/mo | Multi-user, API access, priority alerts, white label |

**Math to $8k:**
- 240 × Pro ($29) = $6,960
- 10 × Enterprise ($99) = $990
- ≈ **$7,950/mo**
- At a 4% free→paid conversion, need ~6,000 registered free users; at 2%, ~12,000. Newsletter/alert list target: **10–15k by month 6.**

Optional additions: annual plan at 2 months free ($290/yr Pro) to pull cash forward and cut churn.

### Stream B — Affiliate Commissions (target: $5,000/mo)

Networks already integrated in `bargain-api/app/services/`: Amazon Associates, eBay Partner Network, Walmart, CJ (`affiliate_service.py`), Impact (`impact_affiliate.py`, `impact_api.py`), Rakuten, Awin.

**Assumptions:** avg. commission ~3% of basket (blend of Amazon ~3%, eBay ~1–3%, CJ/Impact merchants 5–15%), avg. order $80 → ~$2.40/attributed order.

**Math to $5k:** ~2,100 attributed orders/month ≈ 70/day. With a 2% click→order conversion, need ~105,000 affiliate clicks/month — i.e. **~3,500 outbound clicks/day** from deal pages, alert emails, and social posts. Feasible at ~100–150k monthly sessions on a deals site (deal pages convert 20–35% CTR to merchant).

### Stream C — Featured Placements, Cashback Split & Ads (target: $3,000/mo)

| Source | Pricing | Math |
|---|---|---|
| Featured deal slot (homepage/newsletter top slot) | $300–500/mo per merchant × 4 | $1,400–2,000 |
| Newsletter sponsored block (weekly, 10k+ subs) | $150/send × 8 sends | $1,200 |
| Cashback margin (keep 20–30% of network cashback via Impact/CJ cashback partners, pass rest to users) | volume-based | $300–800 at scale |
| Programmatic ads (AdSense/Ezoic on blog/SEO pages) | $8–15 RPM on coupon SEO pages | $400–1,000 |
| **Subtotal** | | **~$3,000** |

**Combined target: $8,000 + $5,000 + $3,000 = $16,000/mo.**

---

## 3. Customer Acquisition Strategy

1. **Coupon/deal SEO (primary, compounding):** programmatic landing pages — "store name + coupon code", "category + deals" — one page per merchant fed by the coupons pipeline (`routers/coupons.py`, `public_coupon_scraper.py`). Target long-tail queries; add `last verified` timestamps for freshness. Goal: 500 indexed pages by month 3, 50k organic sessions/mo by month 6.
2. **Daily deal newsletter:** every alert email carries 3–5 affiliate deals; signup CTA on every page. This is the retention engine and the sponsorship inventory.
3. **X/Twitter engine:** execute `docs/x-growth-playbook.md` — fix bio/header, English-only titles, 8–12 posts/day, weekly Top-10 thread, `#BargainHuntrsFind` UGC, influencer DMs. Target: 500 followers by month 3, 2k by month 6.
4. **Browser extension (month 3–4):** lightweight coupon auto-apply + price-drop alert at checkout for Chrome — the classic Rakuten/Honey acquisition loop. Every install = persistent affiliate attribution.
5. **Reddit/forums (manual, non-spam):** contribute in r/deals, r/frugal, r/couponing; site link only in profile/signature where allowed. 10 genuine posts/week.
6. **Referral loop:** every Pro subscriber gets a referral link — 1 free month per converted referral (cheap CAC: $29 vs. ad CAC ~$50+).

---

## 4. Marketing & Promotions

- **Launch promo:** "Founding Hunter" — Pro at $19/mo locked for life, first 100 users only. Urgency + price anchoring.
- **Daily deal drop:** one flagship deal posted 9 AM ET daily across site, email, X — same time, ritualized ("Deal of the Day" per the playbook).
- **Referral credits:** give $10 / get 1 free month (subscription) or give $5 cashback bonus / get $5 (cashback feature).
- **Merchant partnerships:** pitch 10 CJ/Impact merchants/month for exclusive codes ("BARGAIN10") — exclusives convert better and justify featured placement fees.
- **Event pushes:** Prime Day, Black Friday/Cyber Monday, back-to-school — mega-threads + dedicated email blasts (see playbook §3). These weeks can produce 20–30% of annual affiliate revenue.
- **Win-back emails:** Resend automation — 3-email sequence to lapsed free users ("you missed 14 price drops this week").

---

## 5. 30-Day Daily Action Calendar

| Day | Actions |
|---|---|
| 1 | Publish this plan. Baseline metrics snapshot (Stripe MRR, sessions, email subs). Verify all affiliate creds work end-to-end (one click → tracked). |
| 2 | Fix X profile per playbook §1 (bio, header, link w/ UTM). Ensure English-only deal titles in `x_poster.py`. |
| 3 | Ship "Founding Hunter" $19/mo promo: Stripe coupon + banner on `/pricing`. |
| 4 | Build/verify merchant coupon landing page template (store + coupons + affiliate links + `last verified`). |
| 5 | Generate first 50 merchant coupon pages; submit sitemap to Google Search Console + Bing Webmaster. |
| 6 | Set up weekly KPI spreadsheet (subs, MRR, clicks, attributed orders, email subs, followers). |
| 7 | Sunday: first "Top 10 Deals This Week" X thread 7 PM ET. Week-1 review. |
| 8 | Write 3 outreach emails to CJ/Impact merchants requesting exclusive codes. |
| 9 | Launch referral program v1 (unique link per user; manual credit OK). Email existing users. |
| 10 | Publish 2 SEO posts: "How to spot fake Amazon discounts" + "10 stores with the best coupon stacking". |
| 11 | Reddit day: 10 genuine contributions in deal/frugal subs; log responses. |
| 12 | Newsletter send #1 to full list (5 deals + 1 exclusive). A/B subject lines. |
| 13 | Add exit-intent email capture on deal pages ("Get price-error alerts before they sell out"). |
| 14 | Week-2 review. Double posting on whatever content type outperformed. |
| 15 | DM 5 micro-influencers (playbook §8 template). Offer free Pro + shoutout swap. |
| 16 | 50 more merchant coupon pages (total 100). Internally link deal pages → merchant pages. |
| 17 | Set up Resend win-back automation (3-email sequence). |
| 18 | Pitch first featured-deal placement to a merchant already sending traffic ($300/mo intro). |
| 19 | Publish "Best under-$25 finds" thread on X + mirror as SEO listicle. |
| 20 | Add `utm` tracking audit: every X/email link tagged; verify GA attribution. |
| 21 | Week-3 review. Cut lowest-ROI activity; reallocate hour to top channel. |
| 22 | Launch cashback beta page (list cashback rates from Impact/Rakuten partners; "earn X% back"). |
| 23 | 10 more merchant partnership pitches; ask specifically for newsletter sponsorship. |
| 24 | Create annual plan option ($290/yr Pro) in Stripe + pricing page. |
| 25 | Reddit/forums round 2; answer 10 deal questions with genuine help. |
| 26 | Newsletter send #2 — include first sponsored block if a merchant said yes (else affiliate feature). |
| 27 | Spec browser extension MVP (coupon lookup + price alert); create repo stub or backlog ticket. |
| 28 | 50 more merchant pages (150 total). Check Search Console indexing; fix coverage errors. |
| 29 | Publish month-1 recap post ("We found $X,XXX in savings this month") — social proof. |
| 30 | Month-1 retro vs. milestones (§8). Lock the month-2 plan: SEO scale + extension build. |

---

## 6. Phased Roadmap

**Phase 1 — Foundation (Weeks 1–4):** promo launch, affiliate links verified end-to-end, 150 SEO merchant pages, X engine running at playbook cadence, referral v1, KPI dashboard. *Exit: 500+ email subs, first paid subs, ~$500 MRR.*

**Phase 2 — Growth (Weeks 5–12):** scale to 400+ SEO pages, newsletter to 3k subs, 2 sponsored placements sold, cashback beta live, influencer collabs monthly, extension in beta. *Exit: ~$3–4k MRR (subs ~$2k + affiliate ~$1.5k + placements ~$0.5k).*

**Phase 3 — Scale (Months 4–6):** extension public launch (acquisition flywheel), 100k sessions/mo, 8–10k email subs, 6+ placement merchants, event mega-campaigns. *Exit: ~$10–16k MRR.*

**Phase 4 — Optimize (Months 7–12):** hold $16k+; push annual plans (churn ↓), programmatic SEO to 1,000+ pages, hire VA for deal curation/social, negotiate higher affiliate rates via volume, expand to UK/CA via Awin. *Exit: $20k+ run-rate, churn <5%.*

---

## 7. API & Integration Access Checklist

| Service | Purpose | Env vars | Status check |
|---|---|---|---|
| Stripe | Subscriptions, promos, referrals | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` | ☐ test checkout + webhook |
| Amazon Associates (PA-API) | Product data + affiliate links | `AMAZON_ASSOCIATES_TAG` | ☐ links carry tag, English titles |
| eBay Partner Network / Browse API | Deals + commissions | `EBAY_CLIENT_ID/SECRET`, `EBAY_PARTNER_NETWORK_ID` | ☐ |
| Walmart Affiliate | Deals + commissions | `WALMART_AFFILIATE_ID` | ☐ |
| CJ Affiliate | Coupons + commissions | `CJ_ACCESS_TOKEN`, `CJ_WEBSITE_ID` | ☐ Link Search verified (recent fix) |
| Impact | Coupons, cashback partners | `IMPACT_ACCOUNT_SID`, `IMPACT_AUTH_TOKEN`, `IMPACT_PROGRAM_IDS` | ☐ |
| Rakuten | Coupons/cashback rates | `RAKUTEN_AFFILIATE_ID`, `RAKUTEN_WEBSERVICES_TOKEN`, `RAKUTEN_SECURITY_TOKEN` | ☐ |
| Awin | EU/UK merchants | `AWIN_API_TOKEN`, `AWIN_PUBLISHER_ID` | ☐ |
| Resend | Alert + marketing email | `RESEND_API_KEY` | ☐ domain verified, automations on |
| Telnyx | SMS deal alerts (never Twilio) | `TELNYX_API_KEY`, `TELNYX_FROM_NUMBER`, `TELNYX_MESSAGING_PROFILE_ID` | ☐ |
| Firebase | Push notifications | `FIREBASE_CREDENTIALS_PATH` | ☐ |
| Cloudflare | Frontend hosting (bargain-web Worker) | token in `bargain-web/.env.cloudflare` | ☐ `pnpm run deploy` works |
| Render | Backend + Postgres | `DATABASE_URL`, `PORT=4030` | ☐ auto-deploy from main |
| GA4 + Search Console | Attribution + SEO | property + UTM convention (playbook §9) | ☐ |

---

## 8. Metrics & Milestones

| Metric | Mo 1 | Mo 3 | Mo 6 | Mo 12 |
|---|---|---|---|---|
| MRR (all streams) | $500 | $3,500 | $16,000 | $20,000+ |
| Paid subscribers | 15 | 80 | 250 | 400 |
| Email subscribers | 500 | 3,000 | 10,000 | 25,000 |
| Monthly sessions | 5k | 30k | 120k | 300k |
| Affiliate clicks/mo | 5k | 35k | 105k | 250k |
| Attributed orders/mo | 100 | 700 | 2,100 | 5,000 |
| X followers | 100 | 500 | 2,000 | 5,000 |
| Placement sponsors | 0 | 2 | 5 | 8 |
| Free→paid conversion | — | 3% | 4% | 5% |
| Churn | — | <8% | <6% | <5% |

Review weekly (Fridays, per playbook §9). If affiliate RPM or conversion runs below plan by >20% for 2 consecutive weeks, shift effort to placements/subscriptions — never let one stream's shortfall sink the target.

---

## 9. Risk Mitigation & Compliance

- **Affiliate disclosure (FTC):** "As an affiliate we earn from qualifying purchases" disclosure on every deal page, merchant page, newsletter, and X bio. Required by Amazon Associates Operating Agreement.
- **Amazon TOS specifics:** no showing prices without timestamp via PA-API, no affiliate links in emails/ebooks (send users to site pages instead), no link shortening that obscures destination.
- **Coupon accuracy:** `last verified` timestamp on every coupon; auto-expire dead codes; stale codes destroy trust and SEO.
- **Merchant TOS:** featured placements must be labeled "Sponsored"; get written approval for exclusive codes.
- **Email compliance:** CAN-SPAM/CASL — unsubscribe link, physical address, consent-based list only (Resend suppression list respected).
- **SMS (Telnyx):** express written consent, opt-out ("STOP") handling per TCPA/A2P 10DLC registration.
- **Platform risk:** don't auto-spam X (playbook cadence, ≤3 hashtags, English titles) to avoid spam flags; keep a manual-review queue for glitch deals.
- **Dependency risk:** single-network policy change (e.g. Amazon rate cuts) — keep 4+ networks live so revenue diversifies.

---

## 10. Social Media Post Templates (ready to use)

Reuse with UTM: `?utm_source=x&utm_medium=social&utm_campaign=deal_alert`

1. **Price drop**
```
🔥 PRICE DROP: [Product]
was $[XX] → now $[XX] ([XX]% off)

✅ Free shipping
⏰ Won't last — stock is moving

🔗 bargainhuntrs.com/deal/[slug]
#DealAlert #PriceDrop
```
2. **Glitch deal**
```
⚠️ GLITCH DEAL: [Product] at $[X] (was $[XX])

Looks like a price error — order fast, may be cancelled.
Worst case: refund. Best case: 90% off. 🏃

🔗 bargainhuntrs.com/deal/[slug]
#GlitchDeal #PriceError
```
3. **Coupon code**
```
🏷️ WORKING CODE: "[CODE]" takes [X]% off at [Store]

Verified [time] ago. Stacks with sale items.
Full list of live codes: bargainhuntrs.com/coupons/[store]

#CouponCode #SaveMoney
```
4. **Daily drop ritual**
```
☀️ DEAL OF THE DAY — [date]

[Product]: $[XX] → $[X]
That's $[XX] back in your pocket before coffee.

We post one of these every morning at 9 AM ET. 🔔
🔗 bargainhuntrs.com/deal/[slug]
```
5. **Stack tip (value post)**
```
💡 Deal hack: [Store] lets you stack a promo code + cashback + a discounted gift card.

Combined: effectively [XX]% off almost anything.
Here's exactly how to do it 👉 bargainhuntrs.com/blog/[slug]

#Frugal #SaveMoney
```
6. **Under $25 roundup**
```
🧵 Best finds under $25 this week — all verified in stock.

Bookmark this. Your wallet will thank you. 👇
1/6
```
7. **Engagement bait**
```
What's the best deal you've EVER scored? 👇

Reply with the price you paid vs. retail. Best story gets featured Friday. 🏆
```
8. **Poll**
```
Which would you rather see more of?

🔵 Tech deals
🔴 Home & kitchen
🟢 Fashion steals
🟡 Grocery/coupon stacking

Vote + we'll hunt accordingly. 🎯
```
9. **Hunter of the week**
```
🏆 HUNTER OF THE WEEK: @[user]

They spotted this [product] glitch at $[X] ([XX]% off) and tipped the community first.

Want the crown next week? Submit finds → bargainhuntrs.com/community
#BargainHuntrsFind
```
10. **Cashback promo**
```
💰 You're leaving money on the table.

Buy [product] through our link → get [X]% cashback ON TOP of the sale price.
Sale + cashback = double dipping, legally. 😎

🔗 bargainhuntrs.com/deal/[slug]
```
11. **Scarcity/restock**
```
🚨 RESTOCK: The [product] that sold out in 4 hours is BACK at $[X].

Last time it was gone before lunch. Notifications on. 🔔
🔗 bargainhuntrs.com/deal/[slug]
```
12. **Savings flex (social proof)**
```
This month BargainHuntrs found:
💸 $[X],XXX in verified discounts
🏷️ [X] working coupon codes
⚠️ [X] price errors

All free. Tomorrow's drop: 9 AM ET.
bargainhuntrs.com
```
13. **Comparison/shame**
```
Same product.
Amazon: $[XX]
[Other store] with our code: $[X]

Price-check before you buy. Always. 🔍
bargainhuntrs.com/compare/[slug]
```
14. **Pro upsell (soft)**
```
Free users saw this price error 24 hours late.
Pro users got it instantly — it sold out by noon.

Instant alerts. $19/mo founding rate (first 100 only).
bargainhuntrs.com/pricing
```
15. **Weekend home deals**
```
🏡 Weekend clearance watch:

3 home deals worth your time this morning — all [XX]% off+, all in stock.
Thread 👇 or skip to the list: bargainhuntrs.com/deals/home
```

---

*Owner: solo founder/small team. Revisit monthly; update targets as real conversion data arrives.*
