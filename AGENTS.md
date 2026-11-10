# Project Notes for AI Agents
## Owner Identity (mandatory for all outbound communications)

- The owner's name is **Obdul Reid** — spelled O-B-D-U-L. Never "Abdul", never any other variant.
- Any email, letter, signature, or message signed on behalf of the owner MUST use "Obdul Reid". Verify the spelling before sending.


## SMS Provider: Telnyx ONLY

**NEVER use Twilio.** Twilio is not used in any project. All SMS, MMS, and messaging functionality uses **Telnyx** exclusively.

- Use the Telnyx API (`https://api.telnyx.com/v2/messages`) for sending SMS
- Env vars: `TELNYX_API_KEY`, `TELNYX_FROM_NUMBER`, `TELNYX_MESSAGING_PROFILE_ID`
- Do not suggest, install, or reference Twilio in any code, config, or documentation

## Package Manager

- Backend (bargain-api): Python with pip, FastAPI
- Frontend (bargain-web): Next.js with pnpm (NEVER use npm)

## Deployment

**NEVER reference Railway.** The project has migrated from Railway.

### Frontend: Cloudflare Workers (OpenNext)

- Frontend (`bargain-web`) deploys to **Cloudflare Workers** via OpenNext (`@opennextjs/cloudflare`)
- Account: `b1bbb4b15c23a085297612bcb6800edb` (Bargain4huntrs@gmail.com's Account)
- Worker: `bargain-web` — serves `bargainhuntrs.com`, `www.bargainhuntrs.com`, `bargain-web.bargain4huntrs.workers.dev`
- Deploy: `cd bargain-web && CLOUDFLARE_API_TOKEN=<token> pnpm run deploy` (use `pnpm run deploy`, NOT bare `pnpm deploy` — that collides with pnpm's workspace deploy command)
- Token lives in `bargain-web/.env.cloudflare` (gitignored via `.env*`)
- The old Render `bargain-web` service is suspended — do not redeploy it

### Backend: Oracle Cloud VM (production since 2026-11)

- Production API = pm2 `bargain-api` (uvicorn, **port 4035**) on the oracle box (`ssh oracle`, `~/apps/Bargain/bargain-api`, env in `.env` there)
- Database: **Supabase** PostgreSQL (shared prod DB)
- `api.bargainhuntrs.com` is served by the **`bargain-api-guard` Cloudflare Worker** (route `api.bargainhuntrs.com/*`), which proxies every request to `https://bargain-api.settleinpeace.com` — a public hostname on cloudflared tunnel `e0a01d10` → oracle `:4035`. The tunnel lives in settle's CF account, so api.* can't CNAME to it directly (error 1033) — the Worker hop is the fix. Source: `cloudflare-worker/api-guard.js`; deploy via `wrangler deploy -c cloudflare-worker/api-guard-wrangler.toml` with the token in `bargain-web/.env.cloudflare`
- The api.* DNS CNAME still points at `bargain-api-1o0n.onrender.com` (proxied) as an unreachable fallback
- **Render `bargain-api` is LEGACY** — it auto-deploys from `main` but has a stale env and serves nothing real; suspend at dashboard.render.com. `render.yaml`/`Dockerfile` kept as reference
- Backend URL: `https://api.bargainhuntrs.com` · Frontend URL: `https://bargainhuntrs.com`
- **AI/SI endpoints need env on the box:** `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL=si` in `~/apps/Bargain/bargain-api/.env` — without `AI_API_KEY` every `/api/v1/ai/*` returns 503 (check via `/api/v1/ai/status` → `configured:true` = oracle, `false` = stale Render)

## SQL Logging

- `SQL_ECHO` env var controls SQLAlchemy query logging (default: `false`)
- **Never set `SQL_ECHO=true` in production** — it floods logs at ~500/sec and causes Render to drop scheduler/error messages

## Multi-Agent Coordination (mandatory)

- **Before starting any task, read `.devin/AGENT_STATE.md`** — it lists who is working on what, recently landed commits, and blockers. Claim your work under "Active"; move it to "Recently landed" with the commit hash when done.
- **Check `.devin/OWNER_FLAGS.md` before starting work** — the owner posts live issues/requests there from the command center (synced every ~5 min); treat new lines as priority items. Read-only — don't edit it; record what you did in AGENT_STATE.md.
- **Check `.devin/OWNER_TASKS.md`** — owner-assigned tasks land here; work them and mark the line `- [x]` — the sync reports it done to the owner.
- **Human-blocked?** append one line to `.devin/NEEDS_HUMAN.md` (`- <date> | <blocked> | needs: <action> | ref:`) — it surfaces in the owner's command-center inbox.
