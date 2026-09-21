"""Unified Direct Poster — posts to X, Facebook, and Instagram directly.

Bypasses Buffer entirely by posting to each platform's native API:
  - X/Twitter: X API v2 (OAuth 1.0a user context)
  - Facebook:  Meta Graph API (Page access token)
  - Instagram: Meta Graph API (IG Business account)

Falls back to Buffer for any platform that isn't configured for direct
posting, so you can migrate gradually — set up one platform at a time.

Env vars:
  # X/Twitter direct
  X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET

  # Facebook direct
  FACEBOOK_PAGE_ACCESS_TOKEN, FACEBOOK_PAGE_ID

  # Instagram direct
  INSTAGRAM_BUSINESS_ACCOUNT_ID (uses same FACEBOOK_PAGE_ACCESS_TOKEN)

  # Buffer fallback (existing)
  BUFFER_API_KEY, BUFFER_CHANNEL_ID, BUFFER_IG_CHANNEL_ID, BUFFER_FB_CHANNEL_ID
"""
import asyncio
import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


def _any_direct_configured() -> bool:
    """Check if any direct posting platform is configured."""
    from app.services import x_direct_poster, facebook_poster, instagram_poster
    return (
        x_direct_poster.is_configured()
        or facebook_poster.is_configured()
        or instagram_poster.is_configured()
    )


def _buffer_configured() -> bool:
    """Check if Buffer is configured (fallback)."""
    from app.services.x_poster import is_configured as buffer_configured
    return buffer_configured()


async def post_deal_to_all_platforms(
    title: str,
    deal_price: float,
    original_price: Optional[float],
    discount_percent: int,
    retailer: str,
    deal_url: str,
    deal_tier: str = "clearance",
    image_url: Optional[str] = None,
    deal_id: Optional[str] = None,
) -> dict:
    """Post a deal to all configured social platforms.

    Posts directly to X, Facebook, and Instagram via their native APIs.
    For any platform not configured for direct posting, falls back to
    Buffer if it's configured.

    Returns dict with:
      - status: "success" if at least one platform succeeded
      - channels_posted: int
      - channels_failed: int
      - results: dict of per-platform results
      - platforms_used: list of platform names that posted
    """
    from app.services import x_direct_poster, facebook_poster, instagram_poster
    from app.services.x_poster import (
        post_deal_to_x as post_to_buffer,
        is_configured as buffer_is_configured,
        _format_deal_tweet,
    )
    from app.services.utm_service import public_deal_url

    results: dict = {}
    posted = 0
    failed = 0
    platforms_used: list[str] = []

    # Use the branded short link if we have a deal_id. UTM source is left
    # untagged here — each platform's formatter adds its own utm_source.
    effective_url = deal_url
    if deal_id:
        effective_url = public_deal_url(deal_id)
    else:
        try:
            from app.services.affiliate_service import add_affiliate_tag
            effective_url = add_affiliate_tag(deal_url, retailer)
        except Exception:
            pass

    # ─── X/Twitter ──────────────────────────────────────────────────
    if x_direct_poster.is_configured():
        try:
            x_result = await x_direct_poster.post_deal_to_x_direct(
                title=title,
                deal_price=deal_price,
                original_price=original_price,
                discount_percent=discount_percent,
                retailer=retailer,
                deal_url=effective_url,
                image_url=image_url,
                deal_tier=deal_tier,
            )
            results["x_direct"] = x_result
            if x_result.get("status") == "success":
                posted += 1
                platforms_used.append("x_direct")
            else:
                failed += 1
                # Fall back to Buffer for X if direct fails and Buffer is configured
                if buffer_is_configured():
                    logger.info("X direct failed, falling back to Buffer for X")
                    buf_result = await post_to_buffer(
                        title=title,
                        deal_price=deal_price,
                        original_price=original_price,
                        discount_percent=discount_percent,
                        retailer=retailer,
                        deal_url=deal_url,
                        deal_tier=deal_tier,
                        image_url=image_url,
                        deal_id=deal_id,
                    )
                    results["x_buffer_fallback"] = buf_result
                    if buf_result.get("status") == "success":
                        posted += 1
                        platforms_used.append("x_buffer")
                    else:
                        failed += 1
        except Exception as e:
            results["x_direct"] = {"status": "error", "error": str(e)}
            failed += 1
    elif buffer_is_configured():
        # Buffer handles X (and possibly IG/FB too)
        buf_result = await post_to_buffer(
            title=title,
            deal_price=deal_price,
            original_price=original_price,
            discount_percent=discount_percent,
            retailer=retailer,
            deal_url=deal_url,
            deal_tier=deal_tier,
            image_url=image_url,
            deal_id=deal_id,
        )
        results["buffer"] = buf_result
        if buf_result.get("status") == "success":
            posted += 1
            platforms_used.append("buffer")
        else:
            failed += 1

    # ─── Facebook ───────────────────────────────────────────────────
    if facebook_poster.is_configured():
        try:
            fb_result = await facebook_poster.post_deal_to_facebook(
                title=title,
                deal_price=deal_price,
                original_price=original_price,
                discount_percent=discount_percent,
                retailer=retailer,
                deal_url=effective_url,
                image_url=image_url,
                deal_tier=deal_tier,
            )
            results["facebook"] = fb_result
            if fb_result.get("status") == "success":
                posted += 1
                platforms_used.append("facebook")
            else:
                failed += 1
        except Exception as e:
            results["facebook"] = {"status": "error", "error": str(e)}
            failed += 1

    # ─── Instagram ──────────────────────────────────────────────────
    if instagram_poster.is_configured():
        try:
            ig_result = await instagram_poster.post_deal_to_instagram(
                title=title,
                deal_price=deal_price,
                original_price=original_price,
                discount_percent=discount_percent,
                retailer=retailer,
                deal_url=effective_url,
                image_url=image_url,
                deal_tier=deal_tier,
            )
            results["instagram"] = ig_result
            if ig_result.get("status") == "success":
                posted += 1
                platforms_used.append("instagram")
            else:
                failed += 1
        except Exception as e:
            results["instagram"] = {"status": "error", "error": str(e)}
            failed += 1

    return {
        "status": "success" if posted > 0 else "error",
        "channels_posted": posted,
        "channels_failed": failed,
        "platforms_used": platforms_used,
        "results": results,
        "error": "; ".join(
            v.get("error", "") for v in results.values()
            if isinstance(v, dict) and v.get("status") == "error"
        ) or None,
    }
