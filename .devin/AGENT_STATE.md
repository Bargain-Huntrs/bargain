# Agent State — shared worklog for concurrent agents

Multiple agents work on this repo at once. **Read this file before starting any task** and update it as you work so other agents don't collide with you.

## Protocol

1. **Before starting**: scan "Active" below for overlapping files/features. If someone claimed your area, pick non-overlapping files or wait.
2. **Claim your work**: add a line under "Active" — `[date] agent-name — task — files/dirs you're touching`.
3. **While working**: prefer small commits pushed frequently so others can `git pull` — long-lived uncommitted work is what causes collisions.
4. **When done**: move your line to "Recently landed" with the commit hash, and remove stale claims.
5. **Blockers that need the human**: put them in "Blocked on user" so any agent can surface them.

## Active

| Agent | Task | Files/areas |
|---|---|---|
| devin-bargain | full audit + P0/P1 fixes | whole repo |

## Blocked on user

- **PORTFOLIO-WIDE (2026-10-06) — Render deploys may be dead; repo moved to an org**: `obdulr/bargain` → `Bargain-Huntrs/bargain` (public). On Notyced + Dexana the same org migration left Render's stored repo ID 404 → every deploy fails → stale images. **Verify in the Render dashboard that `bargain-api`'s repo connection still works** — if recent commits (`2c061f9` internal reset fields, `da9e755` affiliate fixes) never deployed, that also explains why resets still behave like the old code. If disconnected: authorize the Render GitHub App on the `Bargain-Huntrs` org, reconnect the repo — public repo, so no app access is needed for fetches once repointed.
- **Render env vars needed for password-reset emails** — bargainhuntrs.com is now verified on the shared Resend account. Paste ALL THREE of these from `bargain-api/.env` (gitignored) into the Render dashboard `bargain-api` service env: `RESEND_API_KEY` (new send-only key — the one currently on Render is corrupted, which is why no reset email has ever sent), `INTERNAL_API_KEY` (must equal the bargain-web Worker secret — the worker was re-set to exactly this `.env` value on 2026-10-06 so a straight copy works), and `ALERT_FROM_EMAIL`. Once `INTERNAL_API_KEY` matches, the worker's Resend fallback sends even if the backend's own key is still wrong — the chain is self-healing from that point.
- **Cloudflare Email Routing enable** — zone `ea39efb5615bd9bdbbb5079e899bbade`: MX + destination `bargain4huntrs@gmail.com` (verified) + catch-all rule staged, but zone-level routing flag needs enabling in the CF dashboard (Email > Email Routing > Get started) — token lacks that scope. Once enabled, all mail to *@bargainhuntrs.com forwards to the Gmail like Prime's setup.

## Recently landed

- 2026-10-09 devin-megaplan `5f2a7b9` — **AI pool read**: `GET /dropship/pools/{id}/ai-read` (Hunter-gated) — deterministic score (margin vs floor, fill pace vs deadline, channel fit, freight risk) + LLM narrative constrained to scored facts w/ template fallback. Web: "AI read" expander on each pool card (verdict badge, score, narrative, flags). tsc + app import verified.

- 2026-10-08 devin `0c26089` — **Vote-to-unlock**: 25 product watchers auto-open a pool (`_maybe_open_pool` in toggle_watch — MOQ = watchers×4 clamped 50–500, unit cost ~75% of wholesale, cap = MOQ/20, 14-day window, skips if a live pool exists). Products now return `watchers`/`unlock_at` (one GROUP BY, no N+1); watch response returns `pool_opened`; cards show "N/25" + pool-opened notice refreshes the board. Verified on sqlite (opens at exactly 25, no dupes). Also shipped earlier this session: `d18214c` (managed_fba channel vote + cash_timeline payout-lag on deal sheets).

- 2026-10-08 devin `18dc8b0` — **Dropship pools: channels + Stripe holds + freight**. Pools carry `channel` (amazon_fba live — hunters' own SP-API accounts, Walmart WFS + own_store vote-gated), `origin`, `freight_mode`, `delivery_days_max`. `/dropship/channels` + POST `/channels/vote` (`dropship_channel_votes`); `/payment-method/setup` returns SetupIntent for off-session card holds; commit creates a manual-capture PaymentIntent (capture on fill, release on expiry — no-hold path when Stripe/card absent). Lazy DDL now ALTERs new columns onto existing tables. Web: channel badge per pool card + "which retailer next" vote strip. Verified sqlite e2e + tsc. Next: SP-API developer application (user action — Seller Central), real group-purchase ToS.

- 2026-10-08 devin `a193e8f` — **Dropship Pools v1** (pooled group-buy, NOT pooled investing): hunters commit actual units toward supplier MOQ at group-negotiated rate; all-or-nothing fill, reservations auto-cancel on expiry, nothing charged until fill (Stripe auth-holds are the future hook in `commit_units`). API: `routers/dropship.py` (`/api/v1/dropship/*` — pools+commit, commits, products, AI curated w/ deterministic fallback, watch/save, niches), models `DropshipPool`/`DropshipPoolCommit`/`DropshipWatch` w/ lazy `_ensure_tables` DDL (Render runs no migrations), seeded 47-product US-warehouse catalog (`services/dropship_catalog.py`) + 3 starter pools. Paid-gated (hunter tier) for commits/catalog. Web: `/dropship` board — pool cards w/ fill bars, deal sheet (unit cost→target price, est margin, MOQ), inline commit confirm w/ "buying inventory, resale not guaranteed" disclosure, niche chips, watch/save, upgrade CTA for free tier; Header "Dropship" nav group; dashboard "Dropship" tab (my units + open pools). Copy is deal-sheet language only — no ROI/investment/investor framing. Verified: py_compile + sqlite e2e (seed, 403 free gate, commit/dup/cap guards, all-or-nothing fill→confirmed, per-user commits), bargain-web tsc clean. Still needed before real money: Stripe auth-holds in commit, group-purchase ToS, legal review.

- 2026-10-08 devin-features `6bec508` (+`8a05e3b`, `5cc29cc`) — **feature board + community deal feed**. API: `routers/feedback.py` (`/api/v1/feedback` — public board, anonymous votes via `voter_id`, admin PATCH via crm `require_admin`); `community.py` appended `deal_threads` endpoints (`/api/v1/community/threads` hot/new, comments, toggle vote w/ authoritative recount, owner/admin delete, in-mem 5-threads/hr + 30-comments/hr rate limit). Tables `feature_requests`/`feature_request_votes`/`deal_threads`/`deal_thread_comments`/`deal_thread_votes` — alembic 035 + lazy CREATE TABLE IF NOT EXISTS (Render runs no migrations; verified live 200s). NOTE: did NOT reuse `user_submitted_deals` — that's a moderation queue (pending→approved→promoted to arbitrage_deals); threads publish instantly + support guests/comments. Web: `/roadmap` board, `/community` rebuilt as thread feed + `/community/[id]` detail (generateStaticParams()=>[] pattern), `FeedbackWidget` edge tab in layout, nav/footer/sitemap links, `bargain_voter_id`/`bargain_voted` localStorage. Web deployed to Cloudflare (`ccb932e0`); API live on Render. Old aura/submit-for-moderation UI removed from /community (endpoints still exist; leaderboard untouched).

- 2026-10-07 devin `a2219e6` — **weekly revenue-KPI workflow (Mon 13:10 UTC) — same pattern. Needs STRIPE_SECRET_KEY repo secret.**

- devin `5a2042e` — **/stores SEO section**: per-retailer deal pages (`/stores/[slug]`) with per-store metadata/canonical + `/stores` index + `GET /deals/public-retailers` API (live retailer counts) + `retailer` filter on `/deals/public` + dynamic sitemap store URLs + footer link. Helpers in `src/lib/retailers.ts`. Slug resolution goes through `public-retailers` so URL slugs map to exact DB retailer values. Needs API redeploy to return data.

- 2026-10-06 devin-ci `b9c1102` — **Workflow failure cleanup**: autofix pnpm/action-setup v2/9→v4/9.15.5; buffer-poster post step hard-failed on curl timeout 3x/day (endpoint legitimately runs >5min) — raised cap to 9min, dropped counterproductive retry, non-200 now ::warning:: (backend health still covered by health-check.yml).

- devin `b543913` — **admin CRM UI**: `/admin/crm` (Overview/Members/Moderation/Tasks) wired to `/api/v1/crm/*` via new typed helpers in `lib/api.ts`. Fixed router prefix → `/api/v1/crm`. Admin link added to `/admin`.

- devin `9dfa256` — **admin CRM** (`bargain-api/app/routers/crm.py`, alembic `034`): Prime-pattern CRM adapted to deals/affiliate — `/crm/dashboard/*` (members, paid tier, live deals, affiliate clicks/commissions, pending submissions, waitlist, referrals, tasks-due), `/crm/members` directory + detail (alert prefs, engagement), `/crm/leads` seller+community submission moderation pipeline with approve/reject, `/crm/activities` + `/crm/tasks`, `/crm/analytics` funnels. Admin-gated via JWT role check. `crm_activities` table has alembic 034 AND lazy `CREATE TABLE IF NOT EXISTS` (Render runs no migrations at boot).
- devin `e0b3889` — **AI chat white-labeled**: `DealCopilot.tsx` renamed `DealAssistant.tsx`; chat heading, launcher aria-label, sign-in prompt, error fallback, and the LLM system prompt in `routers/ai.py` no longer say 'copilot' — customers see 'Deal Assistant'. API path `/api/v1/ai/copilot` unchanged (internal). bargain-web tsc clean.
- devin-orchestrator `ef41ee4` — **live console-error fixes:** added `mobile-web-app-capable` meta, excluded `_headers` from Workbox precache, switched Amazon deal-image URLs to the more forgiving `images-na.ssl-images-amazon.com/images/P/{asin}.01.LZZZZZZZ.jpg` pattern, hardened `verify_password`/login streak to avoid 500s from legacy/null hashes or malformed timestamps, and added a global exception handler that preserves CORS headers on unhandled errors. API auto-deploys to Render on push; web Cloudflare deploy in progress.
- devin-growth-plan `d2ad31f` — **$16k MRR growth plan**: `docs/16K_MONTHLY_GROWTH_PLAN.md` (revenue math across subs/affiliate/placements, 30-day calendar, phased roadmap, API checklist, KPIs, compliance, 15 social post templates).
- 2026-10-02 — **AGENT_STATE.md established** (adopting the Prime/Dexana multi-agent coordination convention).
- devin-ai `bae42c2` — **AI layer**: `services/llm_client.py` (OpenAI-compatible, `AI_BASE_URL`/`AI_API_KEY`/`AI_MODEL` in config.py), `routers/ai.py` at `/api/v1/ai` (status public; copilot/deal-verdict/arbitrage-advice/describe authed; 503 unconfigured, `source:"rules"` fallbacks), `DealCopilot.tsx` chat on /deals, `AiVerdict.tsx` on deal detail. Note: `TestAuthFlow` + `test_full_resale_flow` fail pre-existing — tests post register bodies without the now-required `phoneNumber`.

### Stripe sync (2026-10-04) — devin

- Audited Stripe account via API (live key present in repo env). See portfolio report for cross-account details.
