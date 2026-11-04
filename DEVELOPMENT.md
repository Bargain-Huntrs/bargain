# Development Guide

## ⚠️ IMPORTANT: Package Manager
**PERMANENT RULE: Always use pnpm 9.15.5 - NEVER use npm**

## Local Development Setup

### 1. Install pnpm (if not already installed)
```bash
npm install -g pnpm@9.15.5
```

### 2. Install Root Dependencies
```bash
pnpm install
```

### 3. Frontend Setup
```bash
cd bargain-web
cp .env.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_API_URL=https://bargainhuntrs.com
```

### 4. Backend Setup
```bash
cd bargain-api
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/bargainhuntrs
SECRET_KEY=dev-secret-key-change-in-production
```

### 5. Database Setup (Render)
1. Create Render account
2. Create new PostgreSQL project
3. Copy connection string to `.env`

Or use local PostgreSQL:
```bash
# Install PostgreSQL locally
brew install postgresql  # macOS
# or use Docker
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres:15
```

## Running Services

### All Services (from root)
```bash
pnpm run dev
```

### Individual Services

**Frontend (Port 3030):**
```bash
cd bargain-web
pnpm run dev
# Visit http://localhost:3030
```

**Backend (Port 4040):**
```bash
cd bargain-api
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 4040
# Visit http://localhost:4040/docs for API docs
```

## Common Tasks

### Add New Shared Type
```bash
cd packages/shared
# Edit src/index.ts
cd ../..
pnpm run build
```

### Run Linting
```bash
pnpm run lint
```

### Format Code
```bash
pnpm run format
```

### Clean Everything
```bash
pnpm run clean
```

## API Development

### Add New Endpoint
1. Create route file in `bargain-api/app/api/v1/`
2. Import and register in `bargain-api/app/main.py`
3. Add Pydantic models in `bargain-api/app/schemas/`

### Database Migration
```bash
cd bargain-api
alembic revision --autogenerate -m "description"
alembic upgrade head
```

## Frontend Development

### Add New Page
```bash
cd bargain-web
# Create page in app/ directory
# Next.js App Router handles routing automatically
```

### Add API Call
```typescript
// Use fetch or axios with API URL from env
const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/endpoint`);
```

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3030 (frontend)
lsof -ti:3030 | xargs kill -9

# Kill process on port 4040 (backend)
lsof -ti:4040 | xargs kill -9
```

### Python Virtual Environment Issues
```bash
# Recreate venv
cd bargain-api
rm -rf venv
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Node Modules Issues
```bash
# Clean and reinstall (ALWAYS use pnpm)
rm -rf node_modules
pnpm install
```

## Production Deployment

### Current Deployment Architecture
- **Backend**: Render (bargainhuntrs.com:4040)
- **Frontend**: Render (bargain-web.onrender.com:3030)
- **Package Manager**: pnpm 9.15.5 (PERMANENT)

### Backend Deployment (Render)
The backend is already deployed on Render.

**Configuration:**
- Root Directory: `bargain-api`
- Port: 4040
- Domain: bargainhuntrs.com
- Dockerfile: Root Dockerfile with Python 3.11

**To update:**
```bash
git push origin main
# Render auto-deploys from main branch
```

### Frontend Deployment (Render)
The frontend is deployed on Render using render.yaml.

**Configuration:**
- Root Directory: `bargain-web`
- Port: 3030
- Build Command: `corepack enable && corepack prepare pnpm@9.15.5 --activate && pnpm install --frozen-lockfile=false && pnpm run build`
- Start Command: `cd bargain-web && pnpm start`

**To update:**
```bash
git push origin main
# Render auto-deploys from main branch
```

**Important for Render:**
- Always use pnpm, never npm
- Corepack must be enabled for pnpm support
- Lockfile compatibility handled with `--frozen-lockfile=false`
