"""
Pinterest OAuth Router

Handles the OAuth 2.0 flow for getting a Pinterest access token with
write permissions (pins:write, boards:write).

Flow:
1. User visits /api/v1/pinterest/auth -> redirected to Pinterest login
2. Pinterest redirects back to /api/v1/pinterest/callback with a code
3. We exchange the code for an access token and return it
"""

import hashlib
import logging
import os
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse, JSONResponse
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/pinterest", tags=["pinterest"])

PINTEREST_AUTH_URL = "https://www.pinterest.com/oauth/"
PINTEREST_TOKEN_URL = "https://api.pinterest.com/v5/oauth/token"
REDIRECT_URI = "https://api.bargainhuntrs.com/api/v1/pinterest/callback"

# Scopes needed for posting deals
SCOPES = "boards:read,pins:read,pins:write,boards:write,user_accounts:read"


def _setup_secret() -> str:
    """The shared ops secret that gates this one-time owner flow."""
    secret = os.getenv("SCRAPE_CRON_SECRET", "")
    if not secret:
        raise HTTPException(
            status_code=503,
            detail="Pinterest setup disabled. Set SCRAPE_CRON_SECRET first.",
        )
    return secret


def _oauth_state() -> str:
    """Unforgeable OAuth state — derived from the ops secret so only a flow
    started through /auth (which requires the key) can produce a callback."""
    return hashlib.sha256(f"{_setup_secret()}|pinterest-oauth".encode()).hexdigest()[:24]


@router.get("/auth")
async def pinterest_auth(key: str = Query("", description="Ops setup key (SCRAPE_CRON_SECRET)")):
    """Redirect user to Pinterest OAuth consent screen.

    Owner-only bootstrap: requires ?key=<SCRAPE_CRON_SECRET>. Without it
    anyone could kick off an OAuth grant against our app id."""
    app_id = os.getenv("PINTEREST_APP_ID", "")
    if not app_id:
        raise HTTPException(status_code=503, detail="PINTEREST_APP_ID not configured")
    if key != _setup_secret():
        raise HTTPException(status_code=403, detail="Invalid or missing setup key.")

    auth_url = (
        f"{PINTEREST_AUTH_URL}?response_type=code"
        f"&client_id={app_id}"
        f"&redirect_uri={REDIRECT_URI}"
        f"&scope={SCOPES}"
        f"&state={_oauth_state()}"
    )
    return RedirectResponse(url=auth_url)


@router.get("/callback")
async def pinterest_callback(
    code: str = Query(..., description="OAuth authorization code"),
    state: str = Query("", description="OAuth state issued by /auth"),
):
    """Handle OAuth callback and exchange code for access token."""
    if state != _oauth_state():
        raise HTTPException(status_code=403, detail="Invalid OAuth state.")

    app_id = os.getenv("PINTEREST_APP_ID", "")
    app_secret = os.getenv("PINTEREST_APP_SECRET", "")

    if not app_id or not app_secret:
        raise HTTPException(status_code=503, detail="Pinterest app credentials not configured")

    # Exchange the authorization code for an access token
    async with httpx.AsyncClient() as client:
        response = await client.post(
            PINTEREST_TOKEN_URL,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": REDIRECT_URI,
            },
            auth=(app_id, app_secret),
        )

    if response.status_code != 200:
        logger.error(f"Pinterest token exchange failed: {response.status_code} {response.text}")
        raise HTTPException(
            status_code=502,
            detail=f"Failed to exchange code for token: {response.text}",
        )

    token_data = response.json()
    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")

    if not access_token:
        raise HTTPException(status_code=502, detail="No access token in response")

    logger.info("Pinterest OAuth token obtained successfully")

    # Return the token so it can be saved to Render env vars
    return JSONResponse({
        "status": "success",
        "message": "Pinterest access token obtained. Save this to Render env vars.",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": token_data.get("token_type", "bearer"),
        "expires_in": token_data.get("expires_in"),
        "instructions": "Set PINTEREST_ACCESS_TOKEN on Render with the access_token value above.",
    })
