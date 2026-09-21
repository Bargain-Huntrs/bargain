"""Direct X/Twitter poster using X API v2.

Posts deals directly to X/Twitter without Buffer, bypassing the
free-tier queue limit (10 posts). The X API v2 free tier allows
1,500 posts/month (~50/day).

Supports two auth methods:
  1. OAuth 2.0 (preferred): X_OAUTH2_ACCESS_TOKEN, X_OAUTH2_REFRESH_TOKEN, X_CLIENT_ID
  2. OAuth 1.0a (legacy): X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET

Get these from: https://developer.x.com/en/portal/dashboard
Free tier: 1,500 posts/month, post creation enabled.
"""

import logging
import os
from datetime import datetime
from typing import Optional
from urllib.parse import urlparse

import httpx

from app.core.config import settings
from app.services.utm_service import add_utm_parameters

logger = logging.getLogger(__name__)

X_API_BASE = "https://api.x.com/2"
X_UPLOAD_BASE = "https://upload.x.com/1.1/media"
X_TOKEN_URL = "https://api.x.com/2/oauth2/token"

# Rate limit: 1,500 posts/month on free tier
# We self-impose ~50/day to stay safe
MAX_POSTS_PER_DAY = 50

# In-memory cache for refreshed OAuth 2.0 token
_cached_oauth2_token: Optional[str] = None


def _has_oauth2() -> bool:
    """Check if OAuth 2.0 credentials are available."""
    return bool(
        getattr(settings, "X_OAUTH2_ACCESS_TOKEN", "")
        and getattr(settings, "X_CLIENT_ID", "")
    )


def _has_oauth1() -> bool:
    """Check if OAuth 1.0a credentials are available."""
    return bool(
        getattr(settings, "X_API_KEY", "")
        and getattr(settings, "X_API_SECRET", "")
        and getattr(settings, "X_ACCESS_TOKEN", "")
        and getattr(settings, "X_ACCESS_TOKEN_SECRET", "")
    )


def is_configured() -> bool:
    """Check if X direct posting is configured and enabled.

    Requires both credentials and X_DIRECT_ENABLED env var (defaults to
    false until X API credits are purchased).
    """
    if not getattr(settings, "X_DIRECT_ENABLED", False):
        return False
    return _has_oauth2() or _has_oauth1()


async def _get_oauth2_token(client: httpx.AsyncClient) -> Optional[str]:
    """Get a valid OAuth 2.0 access token, refreshing if needed.

    Uses the cached token if available, or refreshes using the
    refresh token + client ID.
    """
    global _cached_oauth2_token

    if _cached_oauth2_token:
        return _cached_oauth2_token

    # Try the stored access token first
    access_token = getattr(settings, "X_OAUTH2_ACCESS_TOKEN", "")
    refresh_token = getattr(settings, "X_OAUTH2_REFRESH_TOKEN", "")
    client_id = getattr(settings, "X_CLIENT_ID", "")

    if access_token:
        _cached_oauth2_token = access_token
        return access_token

    if not refresh_token or not client_id:
        return None

    # Refresh the token
    try:
        resp = await client.post(
            X_TOKEN_URL,
            data={
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
                "client_id": client_id,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=15.0,
        )
        if resp.status_code == 200:
            data = resp.json()
            _cached_oauth2_token = data.get("access_token")
            logger.info("X direct: OAuth 2.0 token refreshed successfully")
            return _cached_oauth2_token
        else:
            logger.warning(f"X direct: token refresh failed {resp.status_code}: {resp.text[:200]}")
            return None
    except Exception as e:
        logger.warning(f"X direct: token refresh error: {e}")
        return None


async def _upload_media(image_url: str, client: httpx.AsyncClient, auth_token: str) -> Optional[str]:
    """Upload an image to X and return the media_id.

    X requires images to be uploaded separately before referencing
    them in a tweet. We download the image from the URL and upload
    it to X's media endpoint.
    """
    try:
        # Security: validate image URL to prevent SSRF
        from urllib.parse import urlparse
        import ipaddress
        parsed = urlparse(image_url)
        if parsed.scheme not in ("http", "https"):
            logger.warning(f"X direct: rejecting non-http image URL")
            return None
        hostname = parsed.hostname or ""
        if not hostname:
            return None
        try:
            ip = ipaddress.ip_address(hostname)
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                logger.warning(f"X direct: rejecting internal IP image URL")
                return None
        except ValueError:
            pass
        if hostname in ("169.254.169.254", "metadata.google.internal", "metadata.azure.com"):
            return None

        # Download the image
        img_resp = await client.get(image_url, timeout=15.0)
        if img_resp.status_code != 200:
            logger.warning(f"X direct: image download failed {img_resp.status_code}")
            return None

        content_type = img_resp.headers.get("content-type", "")
        if "image" not in content_type and not image_url.endswith((".jpg", ".jpeg", ".png", ".gif", ".webp")):
            logger.warning(f"X direct: not an image ({content_type}), skipping media upload")
            return None

        # Determine media category
        if "gif" in content_type or image_url.endswith(".gif"):
            media_category = "tweet_gif"
        elif "png" in content_type or image_url.endswith(".png"):
            media_category = "tweet_image"
        else:
            media_category = "tweet_image"

        # Upload via OAuth 2.0 Bearer token
        upload_url = f"{X_UPLOAD_BASE}/upload.json"
        files = {"media": img_resp.content}
        data = {"media_category": media_category}

        resp = await client.post(
            upload_url,
            data=data,
            files=files,
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30.0,
        )

        if resp.status_code == 200:
            media_id = resp.json().get("media_id_string")
            logger.info(f"X direct: media uploaded (id: {media_id})")
            return media_id
        else:
            logger.warning(f"X direct: media upload failed {resp.status_code}: {resp.text[:200]}")
            return None

    except Exception as e:
        logger.warning(f"X direct: media upload error: {e}")
        return None


async def post_tweet(
    text: str,
    image_url: Optional[str] = None,
) -> dict:
    """Post a tweet directly via X API v2.

    Uses OAuth 2.0 if available, falls back to OAuth 1.0a.

    Returns dict with:
      - status: "success" or "error"
      - tweet_id: str (on success)
      - error: str (on failure)
    """
    if not is_configured():
        return {"status": "error", "error": "X direct posting not configured"}

    try:
        # Build tweet payload
        payload: dict = {"text": text}

        async with httpx.AsyncClient(timeout=30.0) as client:
            # ─── OAuth 2.0 path ───
            if _has_oauth2():
                auth_token = await _get_oauth2_token(client)
                if not auth_token:
                    return {"status": "error", "error": "Failed to get OAuth 2.0 token"}

                # Upload image if provided
                if image_url:
                    media_id = await _upload_media(image_url, client, auth_token)
                    if media_id:
                        payload["media"] = {"media_ids": [media_id]}

                # Post the tweet using OAuth 2.0 Bearer token
                resp = await client.post(
                    f"{X_API_BASE}/tweets",
                    json=payload,
                    headers={"Authorization": f"Bearer {auth_token}"},
                    timeout=30.0,
                )

                if resp.status_code in (200, 201):
                    data = resp.json()
                    tweet_id = data.get("data", {}).get("id", "")
                    logger.info(f"X direct: tweet posted via OAuth 2.0 (id: {tweet_id})")
                    return {"status": "success", "tweet_id": tweet_id, "data": data}
                elif resp.status_code == 401:
                    # Token expired — refresh and retry once
                    global _cached_oauth2_token
                    _cached_oauth2_token = None
                    auth_token = await _get_oauth2_token(client)
                    if auth_token:
                        resp = await client.post(
                            f"{X_API_BASE}/tweets",
                            json=payload,
                            headers={"Authorization": f"Bearer {auth_token}"},
                            timeout=30.0,
                        )
                        if resp.status_code in (200, 201):
                            data = resp.json()
                            tweet_id = data.get("data", {}).get("id", "")
                            logger.info(f"X direct: tweet posted after token refresh (id: {tweet_id})")
                            return {"status": "success", "tweet_id": tweet_id, "data": data}
                    error_text = resp.text[:300]
                    logger.warning(f"X direct: tweet failed after refresh {resp.status_code}: {error_text}")
                    return {"status": "error", "error": f"HTTP {resp.status_code}: {error_text}"}
                else:
                    error_text = resp.text[:300]
                    logger.warning(f"X direct: tweet failed {resp.status_code}: {error_text}")
                    return {"status": "error", "error": f"HTTP {resp.status_code}: {error_text}"}

            # ─── OAuth 1.0a fallback ───
            from httpx_oauth.v1 import OAuth1Client

            # Upload image if provided
            if image_url:
                # For OAuth 1.0a, use the bearer token for media upload
                media_token = getattr(settings, "X_BEARER_TOKEN", "") or settings.X_ACCESS_TOKEN
                media_id = await _upload_media(image_url, client, media_token)
                if media_id:
                    payload["media"] = {"media_ids": [media_id]}

            async with OAuth1Client(
                client_id=settings.X_API_KEY,
                client_secret=settings.X_API_SECRET,
                token=settings.X_ACCESS_TOKEN,
                token_secret=settings.X_ACCESS_TOKEN_SECRET,
            ) as oauth_client:
                resp = await oauth_client.post(
                    f"{X_API_BASE}/tweets",
                    json=payload,
                    timeout=30.0,
                )

                if resp.status_code in (200, 201):
                    data = resp.json()
                    tweet_id = data.get("data", {}).get("id", "")
                    logger.info(f"X direct: tweet posted via OAuth 1.0a (id: {tweet_id})")
                    return {"status": "success", "tweet_id": tweet_id, "data": data}
                else:
                    error_text = resp.text[:300]
                    logger.warning(f"X direct: tweet failed {resp.status_code}: {error_text}")
                    return {"status": "error", "error": f"HTTP {resp.status_code}: {error_text}"}

    except ImportError:
        return {"status": "error", "error": "httpx-oauth not installed. Run: pip install httpx-oauth"}
    except Exception as e:
        logger.error(f"X direct: post error: {e}")
        return {"status": "error", "error": str(e)}


async def post_deal_to_x_direct(
    title: str,
    deal_price: float,
    original_price: Optional[float],
    discount_percent: int,
    retailer: str,
    deal_url: str,
    image_url: Optional[str] = None,
    deal_tier: str = "clearance",
) -> dict:
    """Post a deal directly to X/Twitter.

    Reuses the same tweet formatting logic as the Buffer poster
    to keep messaging consistent across channels.
    """
    from app.services.x_poster import _format_deal_tweet

    tweet_text = _format_deal_tweet(
        title=title,
        deal_price=deal_price,
        original_price=original_price,
        discount_percent=discount_percent,
        retailer=retailer,
        deal_url=deal_url,
        deal_tier=deal_tier,
        utm_source="twitter",
    )

    return await post_tweet(tweet_text, image_url)
