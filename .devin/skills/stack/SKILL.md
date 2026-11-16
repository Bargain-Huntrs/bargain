---
name: stack
description: BargainHuntrs architecture and deployment truth — Next.js/pnpm web on Cloudflare Workers + Python FastAPI backend on the Oracle box behind a Cloudflare api-guard worker + Supabase Postgres + Expo mobile. Use for ANY bargain-web, bargain-api, or bargain-mobile task before writing code or deploying — deploy commands, the api-guard proxy hop, AI env vars, and the stale-Render gotchas.
triggers:
  - user
  - model
---

# Bargain Stack — what actually runs where

Monorepo: `bargain-web` (Next.js, **pnpm only**), `bargain-api` (**Python FastAPI, pip**), `bargain-mobile` (Expo). Mixed toolchain — JS side is pnpm-only, API is Python.

## Web — Cloudflare Workers (OpenNext)

- Worker `bargain-web` serves `bargainhuntrs.com`, `www.bargainhuntrs.com`, `bargain-web.bargain4huntrs.workers.dev`. CF account `b1bbb4b15c23a085297612bcb6800edb` (Bargain4huntrs@gmail.com).
- Deploy: `cd bargain-web && CLOUDFLARE_API_TOKEN=<token> pnpm run deploy` — **must be `pnpm run deploy`, NOT bare `pnpm deploy`** (that collides with pnpm's workspace deploy command).
- Token lives in `bargain-web/.env.cloudflare` (gitignored via `.env*`).
- Old Render `bargain-web` service is suspended — do not redeploy it.

## API — Oracle box, with a proxy hop that matters

- Production API = pm2 `bargain-api` (uvicorn, **port 4035**) on `ssh oracle`, `~/apps/Bargain/bargain-api`, env in `.env` there.
- `api.bargainhuntrs.com` is served by the **`bargain-api-guard` Cloudflare Worker** (route `api.bargainhuntrs.com/*`) which proxies to `https://bargain-api.settleinpeace.com` — a hostname on cloudflared tunnel `e0a01d10` → oracle `:4035`. The tunnel lives in **settle's CF account**, so api.* can't CNAME directly (error 1033) — the Worker hop is the fix.
- api-guard source: `cloudflare-worker/api-guard.js`; deploy via `wrangler deploy -c cloudflare-worker/api-guard-wrangler.toml` with the token from `bargain-web/.env.cloudflare`.
- **Render `bargain-api` is LEGACY** — auto-deploys from main but stale env, serves nothing real; suspend at dashboard.render.com. `render.yaml`/`Dockerfile` are reference only.
- Database: **Supabase** PostgreSQL (shared prod DB).

## AI/SI env (required or every `/api/v1/ai/*` 503s)

- `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL=si` in `~/apps/Bargain/bargain-api/.env` on the box.
- Check: `GET /api/v1/ai/status` → `configured:true` = oracle (live), `false` = stale Render.

## Gotchas that have bitten agents

- `SQL_ECHO=true` floods logs ~500/sec — **never set in production**.
- api.* DNS CNAME still points at dead Render host as unreachable fallback — that's expected, not a bug.

## Verification checklist before claiming done

- API: deploy dist → `pm2 restart bargain-api` → `curl https://api.bargainhuntrs.com/api/v1/ai/status` (or relevant endpoint) live 200 — going through the api-guard worker proves the whole chain.
- Web: build + `pnpm run deploy` → record worker version → `curl -I https://bargainhuntrs.com` 200 + spot-check changed route.
- Mobile: `pnpm type-check` + ESLint on touched files. No EAS cloud builds (billing gate) — local builds only.
