"""Direct Facebook Page poster via Meta Graph API.

Posts deals directly to a Facebook Page without Buffer.

Requires:
  FACEBOOK_PAGE_ACCESS_TOKEN — Page access token (not user token)
  FACEBOOK_PAGE_ID           — Facebook Page ID

Get these from: https://developers.facebook.com/tools/explorer/
Select the Page, grant 'pages_manage_posts' and 'pages_read_engagement'
permissions, then use the Page access token.

Graph API v19.0: https://developers.facebook.com/docs/graph-api
"""
import logging
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

GRAPH_API_BASE = "https://graph.facebook.com/v19.0"


def is_configured() -> bool:
    """Check if Facebook direct posting is configured."""
    return bool(
        getattr(settings, "FACEBOOK_PAGE_ACCESS_TOKEN", "")
        and getattr(settings, "FACEBOOK_PAGE_ID", "")
    )


async def post_to_facebook(
    message: str,
    image_url: Optional[str] = None,
) -> dict:
    """Post a message (with optional image) to a Facebook Page.

    Returns dict with:
      - status: "success" or "error"
      - post_id: str (on success)
      - error: str (on failure)
    """
    if not is_configured():
        return {"status": "error", "error": "Facebook not configured"}

    page_id = settings.FACEBOOK_PAGE_ID
    token = settings.FACEBOOK_PAGE_ACCESS_TOKEN

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            if image_url:
                # Post with photo — use /photos endpoint with published=true
                # This creates a wall post with the image
                url = f"{GRAPH_API_BASE}/{page_id}/photos"
                params = {"access_token": token}
                data = {
                    "url": image_url,
                    "message": message,
                    "published": "true",
                }
                resp = await client.post(url, params=params, data=data)
            else:
                # Text-only post
                url = f"{GRAPH_API_BASE}/{page_id}/feed"
                params = {"access_token": token}
                data = {"message": message}
                resp = await client.post(url, params=params, data=data)

            if resp.status_code == 200:
                result = resp.json()
                post_id = result.get("post_id") or result.get("id", "")
                logger.info(f"Facebook: post created (id: {post_id})")
                return {"status": "success", "post_id": post_id}
            else:
                error_text = resp.text[:300]
                logger.warning(f"Facebook: post failed {resp.status_code}: {error_text}")
                return {"status": "error", "error": f"HTTP {resp.status_code}: {error_text}"}

    except Exception as e:
        logger.error(f"Facebook: post error: {e}")
        return {"status": "error", "error": str(e)}


async def post_deal_to_facebook(
    title: str,
    deal_price: float,
    original_price: Optional[float],
    discount_percent: int,
    retailer: str,
    deal_url: str,
    image_url: Optional[str] = None,
    deal_tier: str = "clearance",
) -> dict:
    """Post a deal to Facebook Page.

    Reuses the same tweet formatting logic as the Buffer poster
    to keep messaging consistent across channels.
    """
    from app.services.x_poster import _format_deal_tweet

    post_text = _format_deal_tweet(
        title=title,
        deal_price=deal_price,
        original_price=original_price,
        discount_percent=discount_percent,
        retailer=retailer,
        deal_url=deal_url,
        deal_tier=deal_tier,
        utm_source="facebook",
    )

    # Facebook allows longer posts, but keep it consistent with X for now
    return await post_to_facebook(post_text, image_url)
