# Project Notes for AI Agents

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

### Backend: Render

- Backend: Render (Docker-based, Python 3.11, port 4030)
- Database: Render PostgreSQL
- Backend URL: `https://api.bargainhuntrs.com`
- Frontend URL: `https://bargainhuntrs.com`
- Configured via `Dockerfile` (backend) and `render.yaml` (backend only)
- Render auto-deploys from `main` branch

## SQL Logging

- `SQL_ECHO` env var controls SQLAlchemy query logging (default: `false`)
- **Never set `SQL_ECHO=true` in production** — it floods logs at ~500/sec and causes Render to drop scheduler/error messages
