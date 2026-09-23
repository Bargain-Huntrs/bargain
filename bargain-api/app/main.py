from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routers import auth, watchlist, waitlist, arbitrage, subscriptions, coupons, notifications, affiliate, community, gamification, seller, referrals, resale, newsletter, pinterest, properties, contact, listings, dashboard
from app.routers.alerts import router as alerts_router, scheduler_router

# WebAuthn (passkeys) is optional — requires python-webauthn package
try:
    from app.routers import webauthn
    _HAS_WEBAUTHN = True
except ImportError:
    _HAS_WEBAUTHN = False
from app.services.scheduler import scheduler
from app.core.config import settings

import os
app = FastAPI(
    title="BargainHuntrs API",
    description="Arbitrage intelligence platform API",
    version="0.1.0",
    # Disable docs in production to reduce attack surface
    docs_url=None if os.getenv("ENVIRONMENT", "production") == "production" else "/docs",
    redoc_url=None if os.getenv("ENVIRONMENT", "production") == "production" else "/redoc",
    openapi_url=None if os.getenv("ENVIRONMENT", "production") == "production" else "/openapi.json",
)

# Add CORS middleware — fail fast if ALLOWED_ORIGINS is misconfigured (no wildcard fallback)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security headers on all responses
@app.middleware("HTTP")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response

# Request body size limit (1MB) for non-file-upload endpoints
@app.middleware("HTTP")
async def limit_request_size(request: Request, call_next):
    if request.method in ("POST", "PUT", "PATCH"):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > 1_000_000:  # 1MB
            return JSONResponse(status_code=413, content={"detail": "Request too large"})
    return await call_next(request)

app.include_router(auth.router)
if _HAS_WEBAUTHN:
    app.include_router(webauthn.router)
app.include_router(watchlist.router)
app.include_router(waitlist.router)
app.include_router(arbitrage.router)
app.include_router(subscriptions.router)
app.include_router(coupons.router)
app.include_router(notifications.router)
app.include_router(affiliate.router)
app.include_router(alerts_router)
app.include_router(scheduler_router)
app.include_router(community.router)
app.include_router(gamification.router)
app.include_router(seller.router)
app.include_router(referrals.router)
app.include_router(resale.router)
app.include_router(newsletter.router)
app.include_router(pinterest.router)
app.include_router(properties.router)
app.include_router(listings.router)
app.include_router(dashboard.router)
app.include_router(contact.router)


@app.on_event("startup")
async def startup_event():
    """Start the background scanner on app startup if AUTO_SCAN is enabled."""
    # Security: fail fast if SECRET_KEY is missing or too short (skip in test mode)
    if os.getenv("ENVIRONMENT") != "test" and os.getenv("PYTEST_CURRENT_TEST") is None:
        if not settings.SECRET_KEY or len(settings.SECRET_KEY) < 32:
            raise RuntimeError(
                "SECRET_KEY must be set to a strong random value (>=32 chars) "
                "via environment variable. Generate with: "
                "python -c \"import secrets; print(secrets.token_urlsafe(64))\""
            )

    if settings.AUTO_SCAN:
        scheduler.start()
        print(f"[Startup] Auto-scan enabled — scheduler started (interval: {settings.SCAN_INTERVAL_MINUTES}min)")
    else:
        print("[Startup] Auto-scan disabled — scheduler not started")


@app.on_event("shutdown")
async def shutdown_event():
    """Stop the background scanner on app shutdown."""
    if scheduler.is_running:
        scheduler.stop()
        print("[Shutdown] Scheduler stopped")


@app.get("/")
async def root():
    return {
        "message": "BargainHuntrs API",
        "version": "0.2.0",
        "status": "operational",
        "deploy_id": "bcrypt-fix-2026-07-08"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
