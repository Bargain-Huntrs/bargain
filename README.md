# BargainHuntrs 🎯

**Find it. Flip it. Profit.**

Arbitrage intelligence platform that monitors pricing anomalies, clearance events, and cross-platform opportunities to help resellers maximize profits.

## 🏗️ Architecture

This is a monorepo built with:

- **Frontend**: Next.js 16 + TypeScript + Tailwind CSS
- **Backend**: Python FastAPI + PostgreSQL
- **Storage**: Supabase (files/images)
- **Payments**: Stripe
- **Alerts**: Resend (email) + Firebase (SMS/push)
- **Hosting**: Render (backend + frontend)
- **Monorepo Tooling**: Turborepo
- **Package Manager**: pnpm 9.15.5 (PERMANENT - do not change)

## 📁 Project Structure

```
bargain/
├── bargain-web/          # Next.js frontend application
├── bargain-api/          # FastAPI backend service
├── packages/
│   ├── shared/          # Shared TypeScript types and utilities
│   └── config/          # Shared ESLint, Prettier, and TSConfig
├── package.json         # Root package.json with workspaces
├── turbo.json           # Turborepo configuration
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 24.0.0
- pnpm >= 9.15.5 (PERMANENT - do not use npm)
- Python >= 3.11
- PostgreSQL (via Render)

### Installation

1. **Clone and install dependencies:**
```bash
cd /Volumes/Os_Sites/bargain
pnpm install
```

2. **Set up frontend:**
```bash
cd bargain-web
cp .env.example .env.local
# Edit .env.local with your configuration
```

3. **Set up backend:**
```bash
cd bargain-api
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your configuration
```

### Development

Run all services in development mode:

```bash
# From root
pnpm run dev
```

Or run individually:

```bash
# Frontend (Next.js) - Port 3030
cd bargain-web
pnpm run dev
# Visit http://localhost:3030

# Backend (FastAPI) - Port 4040
cd bargain-api
uvicorn app.main:app --reload --host 0.0.0.0 --port 4040
# Visit http://localhost:4040/docs for API docs
```

### Build

```bash
pnpm run build
```

### Lint & Format

```bash
pnpm run lint
pnpm run format
```

## 🎯 Features (Phased Rollout)

### Phase 1 (Weeks 1-2) - MVP
- ✅ Price error / glitch alerts
- ✅ Email/SMS notifications
- ✅ Stripe subscription paywall
- ✅ Landing page + waitlist
- ✅ JWT authentication (email/password)
- ✅ WebAuthn / passkey authentication
- ✅ Billing management page (Stripe checkout + cancel)

### Phase 2 (Month 2) ❌
- ❌ Cross-platform arbitrage scanner (eBay ↔ Amazon)
- ❌ Price comparison engine

### Phase 3 (Month 3) ❌
- ❌ Reseller analytics dashboard
- ❌ ROI tracking per user

### Phase 4 (Month 4) ❌
- ❌ Brick & mortar clearance alerts
- ❌ Zip code based store notifications

### Phase 5 (Months 5-6) ❌
- ❌ International arbitrage layer
- ❌ Tariff/duty calculator

## 💰 Subscription Tiers

| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | 5 alerts/day, 24hr delay |
| Hustler | $29/mo | 50 alerts, same-day, basic analytics |
| Pro | $79/mo | Unlimited, instant alerts, profit calculator |
| Agency | $199/mo | Multi-user, API access, white label |

## 🔧 Tech Stack Details

### Frontend (bargain-web)
- **Framework**: Next.js 16 with App Router
- **Styling**: Tailwind CSS 4
- **Language**: TypeScript
- **Auth**: NextAuth.js / Clerk
- **Port**: 3030
- **Deployment**: Render (free tier)
- **Package Manager**: pnpm 9.15.5

### Backend (bargain-api)
- **Framework**: FastAPI
- **Database**: PostgreSQL (Render)
- **ORM**: SQLAlchemy 2.0 (async)
- **Authentication**: JWT (python-jose)
- **Port**: 4040
- **Deployment**: Render
- **Domain**: bargainhuntrs.com

### Integrations
- **Payments**: Stripe API
- **Email**: Resend API
- **SMS/Push**: Firebase Cloud Messaging
- **Storage**: Supabase Storage
- **Scraping**: BeautifulSoup4 + httpx

## 📊 Database Schema

Core tables (PostgreSQL):
- `users` - User accounts and subscriptions
- `subscriptions` - Stripe subscription data
- `alerts` - Price alerts and notifications
- `price_snapshots` - Historical price data
- `watchlist_items` - User watchlists

## 🔐 Environment Variables

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:4040
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Backend (.env)
```env
DATABASE_URL=postgresql+asyncpg://...
SECRET_KEY=your-secret-key
STRIPE_API_KEY=sk_test_...
RESEND_API_KEY=re_...
FIREBASE_CREDENTIALS_PATH=./firebase-credentials.json
```

## 🧪 Testing

```bash
# Frontend
cd bargain-web
pnpm test

# Backend
cd bargain-api
pytest
```

## 📦 Deployment

### Current Deployment Architecture
- **Backend**: Render (api.bargainhuntrs.com:4040)
- **Frontend**: Render (bargain-web.onrender.com:3030)
- **Package Manager**: pnpm 9.15.5 (PERMANENT - never use npm)

### Backend Deployment (Render)
The backend is deployed on Render at api.bargainhuntrs.com.

**Configuration:**
- Root Directory: `bargain-api`
- Port: 4040
- Domain: bargainhuntrs.com
- Dockerfile: Root Dockerfile with Python 3.11

**Environment Variables:**
- `DATABASE_URL` (PostgreSQL connection string)
- `PORT=4040`

### Frontend Deployment (Render)
The frontend is deployed on Render using the render.yaml configuration.

**Configuration:**
- Root Directory: `bargain-web`
- Port: 3030
- Build Command: `corepack enable && corepack prepare pnpm@9.15.5 --activate && pnpm install --frozen-lockfile=false && pnpm run build`
- Start Command: `cd bargain-web && pnpm start`

**Environment Variables:**
- `NEXT_PUBLIC_API_URL=https://bargainhuntrs.com`
- `NODE_VERSION=24`

**Important:**
- Always use pnpm, never npm
- Corepack must be enabled for pnpm support
- Lockfile compatibility handled with `--frozen-lockfile=false`

### Manual Deployment

**To update backend:**
```bash
git push origin main
# Render auto-deploys from main branch
```

**To update frontend:**
```bash
git push origin main
# Render auto-deploys from main branch
```

## 🤝 Contributing

This is a proprietary project. For internal team coordination:

1. Create feature branches from `main`
2. Run tests and linting before PRs
3. Use conventional commit messages
4. Update documentation as needed

## 📄 License

Proprietary - All rights reserved

## 🆘 Support

For technical issues or questions, contact the development team.

---

Built with ❤️ for resellers who want to maximize their arbitrage opportunities.
