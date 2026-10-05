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

- (none)

## Recently landed

- devin-orchestrator `ef41ee4` — **live console-error fixes:** added `mobile-web-app-capable` meta, excluded `_headers` from Workbox precache, switched Amazon deal-image URLs to the more forgiving `images-na.ssl-images-amazon.com/images/P/{asin}.01.LZZZZZZZ.jpg` pattern, hardened `verify_password`/login streak to avoid 500s from legacy/null hashes or malformed timestamps, and added a global exception handler that preserves CORS headers on unhandled errors. API auto-deploys to Render on push; web Cloudflare deploy in progress.
- devin-growth-plan `d2ad31f` — **$16k MRR growth plan**: `docs/16K_MONTHLY_GROWTH_PLAN.md` (revenue math across subs/affiliate/placements, 30-day calendar, phased roadmap, API checklist, KPIs, compliance, 15 social post templates).
- 2026-10-02 — **AGENT_STATE.md established** (adopting the Prime/Dexana multi-agent coordination convention).
- devin-ai `bae42c2` — **AI layer**: `services/llm_client.py` (OpenAI-compatible, `AI_BASE_URL`/`AI_API_KEY`/`AI_MODEL` in config.py), `routers/ai.py` at `/api/v1/ai` (status public; copilot/deal-verdict/arbitrage-advice/describe authed; 503 unconfigured, `source:"rules"` fallbacks), `DealCopilot.tsx` chat on /deals, `AiVerdict.tsx` on deal detail. Note: `TestAuthFlow` + `test_full_resale_flow` fail pre-existing — tests post register bodies without the now-required `phoneNumber`.

### Stripe sync (2026-10-04) — devin

- Audited Stripe account via API (live key present in repo env). See portfolio report for cross-account details.
