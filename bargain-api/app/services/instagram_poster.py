"""Direct Instagram poster via Meta Graph API.

Posts deals to an Instagram Business account without Buffer.

Instagram requires a two-step process:
1. Create a media container (POST /{ig_user_id}/media)
2. Publish the container (POST /{ig_user_id}/media_publish)

Instagram API requires an image for every post — text-only posts
are not supported. If no image is available, the post is skipped.

Requires:
  INSTAGRAM_BUSINESS_ACCOUNT_ID — IG business account ID (numeric)
  FACEBOOK_PAGE_ACCESS_TOKEN    — Same Meta access token used for FB

Get the IG business account ID:
  Graph API Explorer → GET /me/accounts → select Page →
  GET /{page_id}?fields=instagram_business_account

Graph API v19.0: https://developers.facebook.com/docs/instagram-api
"""
import logging
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

GRAPH_API_BASE = "https://graph.facebook.com/v19.0"

# Instagram has a 2200 char caption limit
MAX_CAPTION_LENGTH = 2200


def is_configured() -> bool:
    """Check if Instagram direct posting is configured."""
    return bool(
        getattr(settings, "INSTAGRAM_BUSINESS_ACCOUNT_ID", "")
        and getattr(settings, "FACEBOOK_PAGE_ACCESS_TOKEN", "")
    )


async def post_to_instagram(
    caption: str,
    image_url: str,
) -> dict:
    """Post an image with caption to Instagram.

    Instagram requires an image for every post.

    Returns dict with:
      - status: "success" or "error"
      - media_id: str (on success)
      - error: str (on failure)
    """
    if not is_configured():
        return {"status": "error", "error": "Instagram not configured"}

    if not image_url:
        return {"status": "error", "error": "Instagram requires an image URL"}

    ig_user_id = settings.INSTAGRAM_BUSINESS_ACCOUNT_ID
    token = settings.FACEBOOK_PAGE_ACCESS_TOKEN

    # Truncate caption to Instagram's limit
    caption = caption[:MAX_CAPTION_LENGTH]

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Step 1: Create media container
            create_url = f"{GRAPH_API_BASE}/{ig_user_id}/media"
            create_params = {"access_token": token}
            create_data = {
                "image_url": image_url,
                "caption": caption,
            }
            resp = await client.post(create_url, params=create_params, data=create_data)

            if resp.status_code != 200:
                error_text = resp.text[:300]
                logger.warning(f"Instagram: media create failed {resp.status_code}: {error_text}")
                return {"status": "error", "error": f"Media create failed: HTTP {resp.status_code}: {error_text}"}

            container_id = resp.json().get("id")
            if not container_id:
                return {"status": "error", "error": "No container ID returned"}

            # Step 2: Publish the media container
            publish_url = f"{GRAPH_API_BASE}/{ig_user_id}/media_publish"
            publish_params = {"access_token": token}
            publish_data = {"creation_id": container_id}
            resp = await client.post(publish_url, params=publish_params, data=publish_data)

            if resp.status_code == 200:
                media_id = resp.json().get("id", "")
                logger.info(f"Instagram: post published (id: {media_id})")
                return {"status": "success", "media_id": media_id}
            else:
                error_text = resp.text[:300]
                logger.warning(f"Instagram: publish failed {resp.status_code}: {error_text}")
                return {"status": "error", "error": f"Publish failed: HTTP {resp.status_code}: {error_text}"}

    except Exception as e:
        logger.error(f"Instagram: post error: {e}")
        return {"status": "error", "error": str(e)}


async def post_deal_to_instagram(
    title: str,
    deal_price: float,
    original_price: Optional[float],
    discount_percent: int,
    retailer: str,
    deal_url: str,
    image_url: Optional[str] = None,
    deal_tier: str = "clearance",
) -> dict:
    """Post a deal to Instagram.

    Reuses the same tweet formatting logic as the Buffer poster.
    Instagram requires an image — if none is available, uses the
    branded fallback image.
    """
    from app.services.x_poster import _format_deal_tweet, FALLBACK_IMAGE_URL

    post_text = _format_deal_tweet(
        title=title,
        deal_price=deal_price,
        original_price=original_price,
        discount_percent=discount_percent,
        retailer=retailer,
        deal_url=deal_url,
        deal_tier=deal_tier,
        utm_source="instagram",
    )

    # Instagram requires an image — use fallback if none provided
    img = image_url or FALLBACK_IMAGE_URL

    return await post_to_instagram(post_text, img)
