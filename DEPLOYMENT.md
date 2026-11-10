# Deployment Guide

## CRITICAL: Package Manager
**PERMANENT RULE: Always use pnpm 9.15.5 - NEVER use npm**

## Current Deployment Architecture

```
Frontend: Cloudflare Workers (OpenNext)
  - bargainhuntrs.com, www.bargainhuntrs.com
  - bargain-web.bargain4huntrs.workers.dev
  - Deploy: cd bargain-web && pnpm run deploy
  - NOTE: the old Render bargain-web service is SUSPENDED — do not redeploy

Backend: Oracle Cloud VM (production, since 2026-11)
  - pm2 `bargain-api` (uvicorn, port 4035) on the oracle box
  - Database: Supabase PostgreSQL (shared prod DB)
  - api.bargainhuntrs.com is served by the `bargain-api-guard`
    Cloudflare Worker (route api.bargainhuntrs.com/*), which proxies every
    request to https://bargain-api.settleinpeace.com — a same-account
    public hostname on cloudflared tunnel e0a01d10 → oracle :4035.
  - The api.* DNS CNAME still points at bargain-api-1o0n.onrender.com
    (proxied) as an unreachable fallback — the Worker intercepts all
    traffic before the origin is contacted. A cfargotunnel CNAME can't
    be used because the tunnel lives in a different CF account (1033).
  - Render `bargain-api` service still auto-deploys from main but is
    LEGACY (stale env — missing AI/INTERNAL_API_KEY/etc.) — suspend it
    at dashboard.render.com. render.yaml kept as fallback reference.
  - Source: cloudflare-worker/api-guard.js + api-guard-wrangler.toml
```

## Backend Deployment (Oracle — current production)

### Status: Live
The backend runs on the oracle box (`ssh oracle`): pm2 `bargain-api`,
uvicorn on `localhost:4035`, working dir `~/apps/Bargain/bargain-api`,
env in `~/apps/Bargain/bargain-api/.env`, Supabase prod DB.
`api.bargainhuntrs.com` reaches it via the `bargain-api-guard` Worker →
`bargain-api.settleinpeace.com` → cloudflared tunnel `e0a01d10` → :4035.
Deploy: rsync `bargain-api/app/` to the box + `pm2 restart bargain-api`.

The section below documents the LEGACY Render service — kept for
reference only; it auto-deploys from main but serves nothing real
(stale env). Suspend it at dashboard.render.com.

## Backend Deployment (Render — LEGACY)

### Status: Deployed
The backend is deployed and operational at api.bargainhuntrs.com.

### Configuration
- **Root Directory**: `bargain-api`
- **Port**: 4040
- **Domain**: api.bargainhuntrs.com
- **Dockerfile**: Root Dockerfile with Python 3.11
- **Healthcheck**: `/health` endpoint

### Environment Variables
- `PORT=4040`
- `DATABASE_URL` (Render PostgreSQL connection string)
- `SQL_ECHO=false` (keep SQL logging off in production)
- `AI_BASE_URL=https://si.primetransit.com/v1`, `AI_API_KEY=<SI gateway gate key — get from ops>`, `AI_MODEL=si` — required or all `/api/v1/ai/*` endpoints return 503

### To Update Backend
```bash
git push origin main
# Render auto-deploys from main branch
```

### Render Configuration Files
- `Dockerfile` - Python 3.11 FastAPI setup
- Root directory set to `bargain-api` in Render dashboard

## Frontend Deployment (Cloudflare Workers — OpenNext)

### Status: Deployed
The frontend deploys to **Cloudflare Workers** via `@opennextjs/cloudflare` and serves `bargainhuntrs.com` / `www.bargainhuntrs.com` / `bargain-web.bargain4huntrs.workers.dev`. The legacy Render `bargain-web` service is **suspended** — the section below is kept for history only; do not redeploy it.

### Deploy
```bash
cd bargain-web
CLOUDFLARE_API_TOKEN=<token from .env.cloudflare> pnpm run deploy
```

### Legacy Render Configuration (SUSPENDED)
- **Root Directory**: `bargain-web`
- **Port**: 3030
- **Build Command**: `corepack enable && corepack prepare pnpm@9.15.5 --activate && pnpm install --frozen-lockfile=false && pnpm run build`
- **Start Command**: `cd bargain-web && pnpm start`

### Environment Variables
- `NEXT_PUBLIC_API_URL=https://api.bargainhuntrs.com`
- `NODE_VERSION=24`

### Render Configuration File
- `render.yaml` - Complete Render deployment configuration
- Automatically detected by Render
- Handles pnpm setup via corepack

### To Update Frontend
```bash
git push origin main
# Render auto-deploys from main branch
```

## Important Deployment Rules

### 1. Package Manager (CRITICAL)
- **ALWAYS** use pnpm 9.15.5
- **NEVER** use npm for any reason
- This is permanent for the entire project

### 2. Port Configuration
- **Frontend**: Port 3030 (permanent)
- **Backend**: Port 4040 (permanent)
- Never change these ports

### 3. Corepack for pnpm
- Corepack must be enabled for pnpm support
- Render build command includes: `corepack enable && corepack prepare pnpm@9.15.5 --activate`
- This ensures proper pnpm setup in deployment environments

### 4. Lockfile Handling
- Use `--frozen-lockfile=false` for Render deployment
- Handles lockfile compatibility issues
- Prevents deployment failures

## Deployment Workflow

### 1. Make Changes
```bash
# Make your changes
git add .
git commit -m "Your commit message"
```

### 2. Push to GitHub
```bash
git push origin main
```

### 3. Automatic Deployment
- **Render**: Auto-deploys backend and frontend from main branch
- Both services monitor the GitHub repository

### 4. Monitor Deployment
- **Render**: Check Render dashboard for backend and frontend status
- Both services provide real-time logs

## Troubleshooting

### Backend Deployment Issues

**Healthcheck Failing:**
- Check port is set to 4040 in Render dashboard
- Verify `/health` endpoint exists in FastAPI app
- Check Render logs for startup errors

**Database Connection Issues:**
- Verify DATABASE_URL environment variable is set
- Check PostgreSQL database is running
- Test connection string format

### Frontend Deployment Issues

**Build Failing:**
- Verify pnpm is being used (not npm)
- Check corepack is enabled in build command
- Ensure `--frozen-lockfile=false` is included
- Check Render logs for specific errors

**Start Command Failing:**
- Verify start command uses pnpm
- Check working directory is correct
- Ensure port 3030 is not blocked

**Package Manager Issues:**
- If npm is being used instead of pnpm, check render.yaml
- Verify corepack commands are correct
- Ensure NODE_VERSION is set to 24

## Local Development vs Production

### Local Development
```bash
# Frontend (port 3030)
cd bargain-web
pnpm run dev
# Visit http://localhost:3030

# Backend (port 4040)
cd bargain-api
uvicorn app.main:app --reload --host 0.0.0.0 --port 4040
# Visit http://localhost:4040
```

### Production URLs
- **Frontend**: https://bargainhuntrs.com (Cloudflare Workers; bargain-web.bargain4huntrs.workers.dev)
- **Backend**: https://api.bargainhuntrs.com (origin: https://bargain-api-1o0n.onrender.com)
- **API**: https://api.bargainhuntrs.com/health

## Support

For deployment issues:
1. Check Render dashboard logs
2. Verify environment variables are correctly set
3. Ensure pnpm is being used (not npm)
4. Check port configurations (3030/4040)
5. Review this documentation for common issues

---

**Remember: pnpm 9.15.5 is permanent - never use npm!**
