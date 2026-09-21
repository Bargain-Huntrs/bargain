"""Buffer API Integration for Multi-Platform Auto-Posting.

Posts deals directly to Buffer, which posts them to:
  - X (@bargain4huntrs)
  - Instagram (@bargainhuntrs)
  - Facebook (Bargain Huntrs)

Runs 24/7 on the Render server — no computer, browser, or Make.com needed.

Env vars:
  BUFFER_API_KEY      — Buffer API access token
  BUFFER_CHANNEL_ID   — Buffer channel ID for X account (primary)
  BUFFER_IG_CHANNEL_ID — Buffer channel ID for Instagram
  BUFFER_FB_CHANNEL_ID — Buffer channel ID for Facebook
"""
import asyncio
import logging
import random
from datetime import datetime
from typing import Optional

import httpx

from app.core.config import settings
from app.services.utm_service import add_utm_parameters

logger = logging.getLogger(__name__)

BUFFER_API_URL = "https://api.buffer.com/graphql"

FALLBACK_IMAGE_URL = getattr(settings, "FALLBACK_IMAGE_URL", "") or \
    "https://www.bargainhuntrs.com/og-image.png"

# Facebook's crawlers are frequently blocked by retailer CDNs (Amazon, Walmart,
# etc.), causing "Missing or invalid image file" errors. For Facebook, always
# use the branded fallback image instead of retailer deal images.
FACEBOOK_FALLBACK_IMAGE_URL = getattr(settings, "FACEBOOK_FALLBACK_IMAGE_URL", "") or \
    FALLBACK_IMAGE_URL


async def _verify_image_url(url: str) -> bool:
    """Verify that an image URL is reachable and returns an image.

    Tries a lightweight HEAD request first, then falls back to a ranged GET
    with a browser user-agent so retailer CDNs (Amazon, Walmart, etc.) don't
    block us. Accepts the URL if the Content-Type is image/* or the path ends
    with a known image extension and the request succeeds.
    """
    if not url:
        return False

    IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".svg"}
    clean_path = httpx.URL(url).path.split("?")[0].split("#")[0].lower()
    has_image_ext = any(clean_path.endswith(ext) for ext in IMAGE_EXTENSIONS)

    headers = {
        "User-Agent": getattr(
            settings, "USER_AGENT", "Mozilla/5.0 (compatible; BargainHuntrs/1.0)"
        ),
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Range": "bytes=0-0",
    }

    try:
        async with httpx.AsyncClient(
            timeout=10.0, follow_redirects=True, headers=headers
        ) as client:
            # HEAD first to avoid any download if the server supports it
            resp = await client.head(url)
            if resp.status_code in (200, 206):
                content_type = resp.headers.get("content-type", "").lower()
                if content_type.startswith("image/"):
                    return True
                if not content_type and has_image_ext:
                    return True

            # Some hosts reject HEAD; use a ranged GET so we only pull 1 byte
            async with client.stream("GET", url) as stream:
                if stream.status_code in (200, 206):
                    content_type = stream.headers.get("content-type", "").lower()
                    if content_type.startswith("image/"):
                        return True
                    if not content_type and has_image_ext:
                        return True

            return False
    except Exception as e:
        logger.warning(f"Image verification error for {url}: {e}")
        return False


async def get_buffer_queue_count(api_key: str, org_id: str, channel_ids: list[str]) -> int:
    """Query Buffer's GraphQL API for the number of queued/scheduled posts."""
    counts = await get_buffer_queue_counts_per_channel(api_key, org_id, channel_ids)
    return sum(counts.values())


async def get_buffer_queue_counts_per_channel(
    api_key: str, org_id: str, channel_ids: list[str]
) -> dict[str, int]:
    """Query Buffer's GraphQL API for queued post counts per channel.

    Returns a dict mapping channel_id → scheduled post count.
    Queries each channel separately because Buffer's API caps results at 10
    total when querying multiple channels at once.
    """
    if not org_id or not channel_ids:
        return {}

    query = """
    query QueueCount($input: PostsInput!) {
      posts(input: $input) {
        edges { node { id } }
      }
    }
    """

    counts: dict[str, int] = {}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            for cid in channel_ids:
                variables = {
                    "input": {
                        "organizationId": org_id,
                        "filter": {
                            "status": "scheduled",
                            "channelIds": [cid],
                        },
                    }
                }
                resp = await client.post(
                    BUFFER_API_URL,
                    json={"query": query, "variables": variables},
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("errors"):
                        logger.warning(
                            f"Buffer queue query error for {cid}: "
                            f"{data['errors'][0].get('message', 'Unknown')}"
                        )
                        counts[cid] = 0
                    else:
                        edges = data.get("data", {}).get("posts", {}).get("edges", [])
                        counts[cid] = len(edges)
                else:
                    logger.warning(
                        f"Buffer queue API returned HTTP {resp.status_code} for {cid}"
                    )
                    counts[cid] = 0
    except Exception as e:
        logger.warning(f"Failed to query Buffer queue counts: {e}")
        return {cid: 0 for cid in channel_ids}

    return counts


async def get_stuck_channel_ids(api_key: str, org_id: str, channel_ids: list[str]) -> set[str]:
    """Detect channels with stuck posts (created >24h ago, still scheduled).

    These channels are likely disconnected and can't publish. Posting to them
    just fills the queue with posts that never drain.
    Queries each channel separately (Buffer API caps multi-channel results at 10).
    """
    if not org_id or not channel_ids:
        return set()

    query = """
    query StuckPosts($input: PostsInput!) {
      posts(input: $input) {
        edges { node { id createdAt } }
      }
    }
    """

    from datetime import datetime, timezone, timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

    stuck: dict[str, int] = {}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            for cid in channel_ids:
                variables = {
                    "input": {
                        "organizationId": org_id,
                        "filter": {
                            "status": "scheduled",
                            "channelIds": [cid],
                        },
                    }
                }
                resp = await client.post(
                    BUFFER_API_URL,
                    json={"query": query, "variables": variables},
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                )
                if resp.status_code != 200:
                    continue
                data = resp.json()
                if data.get("errors"):
                    continue
                edges = data.get("data", {}).get("posts", {}).get("edges", [])
                for edge in edges:
                    node = edge.get("node", {})
                    created = node.get("createdAt", "")
                    if not created:
                        continue
                    try:
                        created_dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                        if created_dt < cutoff:
                            stuck[cid] = stuck.get(cid, 0) + 1
                    except (ValueError, TypeError):
                        pass
    except Exception as e:
        logger.warning(f"Failed to query stuck posts: {e}")

    # A channel is "stuck" if it has 3+ posts older than 24h
    stuck_channels = {cid for cid, count in stuck.items() if count >= 3}
    if stuck_channels:
        logger.warning(
            f"Buffer channels with stuck posts (likely disconnected): {stuck_channels}"
        )
    return stuck_channels

# All Buffer channel IDs — posts go to all configured channels
def _get_all_channel_ids() -> list[str]:
    """Get all configured Buffer channel IDs."""
    ids = []
    if getattr(settings, "BUFFER_CHANNEL_ID", ""):
        ids.append(settings.BUFFER_CHANNEL_ID)  # X/Twitter
    if getattr(settings, "BUFFER_IG_CHANNEL_ID", ""):
        ids.append(settings.BUFFER_IG_CHANNEL_ID)  # Instagram
    if getattr(settings, "BUFFER_FB_CHANNEL_ID", ""):
        ids.append(settings.BUFFER_FB_CHANNEL_ID)  # Facebook
    return ids


def is_configured() -> bool:
    """Check if Buffer API is configured."""


async def clear_buffer_queue(channel_ids: Optional[list[str]] = None) -> dict:
    """Delete all scheduled posts from Buffer channels.

    Used to clear clogged queues full of failed/stuck posts.
    Returns counts of deleted posts per channel.
    """
    if not is_configured():
        return {"status": "error", "error": "Buffer not configured"}

    api_key = settings.BUFFER_API_KEY
    org_id = getattr(settings, "BUFFER_ORG_ID", "")
    if not org_id:
        return {"status": "error", "error": "BUFFER_ORG_ID not set"}

    if channel_ids is None:
        channel_ids = _get_all_channel_ids()

    if not channel_ids:
        return {"status": "error", "error": "No channel IDs configured"}

    list_query = """
    query ListPosts($input: PostsInput!) {
      posts(input: $input) {
        edges { node { id } }
      }
    }
    """

    delete_mutation = """
    mutation DeletePost($input: DeletePostInput!) {
      deletePost(input: $input) {
        __typename
      }
    }
    """

    results = {}
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            for cid in channel_ids:
                # Fetch and delete all scheduled AND error posts for this channel
                # Buffer API caps results at 10 per query, so loop until empty
                total_deleted = 0
                total_found = 0
                for post_status in ("scheduled", "error"):
                    while True:
                        variables = {
                            "input": {
                                "organizationId": org_id,
                                "filter": {
                                    "status": post_status,
                                    "channelIds": [cid],
                                },
                            },
                        }
                    resp = await client.post(
                        BUFFER_API_URL,
                        json={"query": list_query, "variables": variables},
                        headers={
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type": "application/json",
                        },
                    )
                    if resp.status_code != 200:
                        if total_found == 0:
                            results[cid] = {"error": f"HTTP {resp.status_code}", "deleted": 0}
                        break

                    data = resp.json()
                    if data.get("errors"):
                        if total_found == 0:
                            results[cid] = {"error": data["errors"][0].get("message", ""), "deleted": 0}
                        break

                    edges = data.get("data", {}).get("posts", {}).get("edges", [])
                    post_ids = [e["node"]["id"] for e in edges if e.get("node", {}).get("id")]

                    if not post_ids:
                        break  # No more posts to delete

                    total_found += len(post_ids)

                    for pid in post_ids:
                        try:
                            del_resp = await client.post(
                                BUFFER_API_URL,
                                json={
                                    "query": delete_mutation,
                                    "variables": {"input": {"id": pid}},
                                },
                                headers={
                                    "Authorization": f"Bearer {api_key}",
                                    "Content-Type": "application/json",
                                },
                            )
                            if del_resp.status_code == 200:
                                del_data = del_resp.json()
                                if not del_data.get("errors"):
                                    total_deleted += 1
                        except Exception:
                            pass

                results[cid] = {"deleted": total_deleted, "total_found": total_found}
                if total_deleted:
                    logger.info(f"Cleared {total_deleted}/{total_found} posts from Buffer channel {cid}")

    except Exception as e:
        logger.error(f"Failed to clear Buffer queue: {e}")
        return {"status": "error", "error": str(e), "results": results}

    total_deleted = sum(r.get("deleted", 0) for r in results.values())
    return {"status": "success", "total_deleted": total_deleted, "results": results}


def is_configured() -> bool:
    """Check if Buffer API is configured."""
    return bool(getattr(settings, "BUFFER_API_KEY", "")) and \
           bool(getattr(settings, "BUFFER_CHANNEL_ID", ""))


# Hashtag sets per deal tier — randomly picked for variety
HASHTAG_SETS = {
    "clearance": [
        "#deals #clearance",
        "#DealAlert #ClearanceDeals",
        "#bargain #deals",
        "#AmazonDeals #SaveMoney",
        "#DealOfTheDay #Clearance",
    ],
    "glitch": [
        "#priceerror #deal",
        "#PriceError #GlitchDeal",
        "#PriceMistake #DealAlert",
        "#ErrorDeal #Bargain",
        "#Glitch #DealOfTheDay",
    ],
    "default": [
        "#deals #bargain",
        "#DealAlert #BargainHunt",
        "#SaveMoney #Deals",
        "#BargainHuntrs #Deals",
        "#DealOfTheDay #Bargain",
    ],
}

# Prefix variety by discount level — randomly picked for variety
PREFIX_SETS = {
    "75+": ["⚡ Price error", "🚨 Insane deal", "🔥 Glitch alert"],
    "50-74": ["🔥 Mega deal", "� Huge savings", "⚡ Big discount"],
    "25-49": ["🔥 Hot deal", "💰 Great price", "✨ Nice find"],
    "<25": ["💡 Quick deal", "📌 Saving", "✅ Deal"],
}

# Call-to-action lines — added 30% of the time for variety
CTA_LINES = [
    "Limited time",
    "While supplies last",
    "Won't last long",
]


def _pick_prefix(discount_percent: int, deal_tier: str) -> str:
    """Pick a randomized prefix based on discount level and deal tier."""
    if deal_tier == "glitch" or discount_percent >= 75:
        return random.choice(PREFIX_SETS["75+"])
    if discount_percent >= 50:
        return random.choice(PREFIX_SETS["50-74"])
    if discount_percent >= 25:
        return random.choice(PREFIX_SETS["25-49"])
    return random.choice(PREFIX_SETS["<25"])


def _format_deal_tweet(
    title: str,
    deal_price: float,
    original_price: Optional[float],
    discount_percent: int,
    retailer: str,
    deal_url: str,
    deal_tier: str = "clearance",
    utm_source: str = "twitter",
) -> str:
    """Format a deal into a tweet (max 280 characters) with varied formatting."""
    retailer_names = {
        "amazon": "Amazon",
        "ebay": "eBay",
        "walmart": "Walmart",
        "home_depot": "Home Depot",
        "target": "Target",
        "best_buy": "Best Buy",
        "newegg": "Newegg",
        "costco": "Costco",
        "lowes": "Lowe's",
        "ace_hardware": "Ace Hardware",
        "corsair": "Corsair",
        "overstock": "Overstock",
        "bhphoto": "B&H Photo",
        "ador": "ADOR",
        "eufy": "Eufy",
        "belkin": "Belkin",
        "lenovo": "Lenovo",
        "woot": "Woot",
    }
    retailer_name = retailer_names.get(retailer, retailer.replace("_", " ").title())

    # Randomized prefix based on discount level / tier
    prefix = _pick_prefix(discount_percent, deal_tier)

    # Randomized hashtags per tier
    tier_key = deal_tier if deal_tier in HASHTAG_SETS else "default"
    hashtags = random.choice(HASHTAG_SETS[tier_key])

    max_title_len = 80
    short_title = title[:max_title_len].strip()
    if len(title) > max_title_len:
        short_title += "…"

    if original_price and original_price > deal_price:
        savings = original_price - deal_price
        price_line = f"${deal_price:.0f} (was ${original_price:.0f}) at {retailer_name}\nSave ${savings:.0f}"
    else:
        price_line = f"${deal_price:.0f} at {retailer_name}"

    # Random CTA ~30% of the time
    cta = f" — {random.choice(CTA_LINES)}" if random.random() < 0.3 else ""

    # Tag outgoing deal link with UTM parameters for the target platform
    campaign = f"deal_alert_{datetime.utcnow().strftime('%Y-%m-%d')}"
    deal_url = add_utm_parameters(deal_url, utm_source, "social", campaign)

    tweet = f"{prefix}\n{short_title}\n{price_line}{cta}\n\n{deal_url}\n\n{hashtags}"

    if len(tweet) > 280:
        excess = len(tweet) - 280
        short_title = title[: max(20, max_title_len - excess - 1)].strip() + "…"
        tweet = f"{prefix}\n{short_title}\n{price_line}{cta}\n\n{deal_url}\n\n{hashtags}"
        if len(tweet) > 280:
            tweet = f"{prefix}\n{short_title}\n{price_line}{cta}\n\n{deal_url}"

    return tweet


async def _post_to_channel(api_key: str, channel_id: str, text: str, image_url: Optional[str] = None, service: str = "twitter") -> dict:
    """Post to a single Buffer channel via GraphQL API."""
    mutation = """
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        __typename
        ... on PostActionSuccess {
          post {
            id
            status
          }
        }
        ... on MutationError {
          message
        }
      }
    }
    """

    input_data = {
        "channelId": channel_id,
        "text": text,
        "schedulingType": "automatic",
        "mode": "addToQueue",
        "assets": [],
    }

    # Instagram and Facebook require metadata with post type
    metadata = {}
    if service == "instagram":
        metadata["instagram"] = {"type": "post", "shouldShareToFeed": True}
    elif service == "facebook":
        metadata["facebook"] = {"type": "post"}

    # Instagram requires at least one image
    # Facebook works better with an image too
    # X/Twitter also gets images for better engagement
    # Verify the image URL before sending to Buffer.
    # If the deal image fails verification, skip the image entirely for X
    # (text-only post) and skip the channel for Instagram/Facebook (they
    # require images). Do NOT fall back to a branding image — only post
    # real product images.
    #
    # Facebook's crawlers are frequently blocked by retailer CDNs (Amazon,
    # Walmart, etc.), so skip Facebook if we can't verify the image.
    if service == "facebook":
        # Facebook often can't fetch retailer CDN images — skip FB entirely
        # rather than posting with a branding image
        if image_url and await _verify_image_url(image_url):
            img_to_use = image_url
        else:
            logger.info(f"Skipping Facebook — no verifiable product image")
            return {"status": "skipped", "error": "No verifiable product image for Facebook", "channel_id": channel_id, "service": service}
    else:
        img_to_use = image_url
        if img_to_use:
            if not await _verify_image_url(img_to_use):
                logger.warning(
                    f"Image verification failed for {service}, posting without image"
                )
                img_to_use = None
        else:
            img_to_use = None

    # Instagram requires an image — skip if none
    if service == "instagram" and not img_to_use:
        logger.info(f"Skipping Instagram — no verifiable product image")
        return {"status": "skipped", "error": "No verifiable product image for Instagram", "channel_id": channel_id, "service": service}

    if img_to_use:
        input_data["assets"] = [{"image": {"url": img_to_use}}]

    if metadata:
        input_data["metadata"] = metadata

    variables = {"input": input_data}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                BUFFER_API_URL,
                json={"query": mutation, "variables": variables},
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )

            if resp.status_code == 200:
                data = resp.json()

                if data.get("errors"):
                    error_msg = data["errors"][0].get("message", "Unknown error")
                    logger.error(f"Buffer GraphQL error ({service}): {error_msg}")
                    return {"status": "error", "error": error_msg, "channel_id": channel_id, "service": service}

                result = data.get("data", {}).get("createPost", {})

                if result.get("__typename") == "PostActionSuccess":
                    post = result.get("post", {})
                    logger.info(f"Buffer post created: {post.get('id')} ({service})")
                    return {
                        "status": "success",
                        "post_id": post.get("id"),
                        "channel_id": channel_id,
                        "service": service,
                    }
                else:
                    error_msg = result.get("message", "Unknown error")
                    logger.error(f"Buffer API error ({service}): {error_msg}")
                    return {"status": "error", "error": error_msg, "channel_id": channel_id, "service": service}
            else:
                logger.error(f"Buffer API HTTP error ({service}): {resp.status_code} {resp.text[:200]}")
                return {"status": "error", "error": f"HTTP {resp.status_code}", "channel_id": channel_id, "service": service}

    except Exception as e:
        logger.error(f"Failed to post to Buffer ({service}): {e}")
        return {"status": "error", "error": str(e), "channel_id": channel_id, "service": service}


def _retag_utm_source(text: str, service: str) -> str:
    """Point utm_source at the actual Buffer channel.

    Buffer posts one text to X/IG/FB; swap the twitter tag for the real
    service so Instagram/Facebook clicks aren't attributed to Twitter.
    """
    if service == "twitter":
        return text
    return text.replace("utm_source=twitter", f"utm_source={service}")


async def post_to_buffer(tweet_text: str, image_url: Optional[str] = None) -> dict:
    """Post to all configured Buffer channels (X, Instagram, Facebook).

    Buffer will post to each platform automatically.
    Skips channels that are disconnected (detected via stuck posts) to
    prevent them from filling the queue with posts that never publish.
    """
    if not is_configured():
        return {"status": "error", "error": "BUFFER_API_KEY or BUFFER_CHANNEL_ID not set"}

    api_key = settings.BUFFER_API_KEY
    org_id = getattr(settings, "BUFFER_ORG_ID", "")

    # Build channel list with service types
    channels = []
    if getattr(settings, "BUFFER_CHANNEL_ID", ""):
        channels.append((settings.BUFFER_CHANNEL_ID, "twitter"))
    if getattr(settings, "BUFFER_IG_CHANNEL_ID", ""):
        channels.append((settings.BUFFER_IG_CHANNEL_ID, "instagram"))
    if getattr(settings, "BUFFER_FB_CHANNEL_ID", ""):
        channels.append((settings.BUFFER_FB_CHANNEL_ID, "facebook"))

    if not channels:
        return {"status": "error", "error": "No Buffer channels configured"}

    max_queue = getattr(settings, "BUFFER_MAX_QUEUE", 10)
    channel_ids = [cid for cid, _ in channels]

    # Detect disconnected channels (3+ posts stuck for >24h)
    stuck_channels = await get_stuck_channel_ids(api_key, org_id, channel_ids)
    if stuck_channels:
        logger.warning(
            f"Skipping disconnected Buffer channels: {stuck_channels}. "
            f"Re-authenticate them in Buffer dashboard."
        )
        channels = [(cid, svc) for cid, svc in channels if cid not in stuck_channels]
        if not channels:
            return {
                "status": "error",
                "error": "All Buffer channels are disconnected. Re-authenticate in Buffer dashboard.",
                "skipped_channels": list(stuck_channels),
            }

    # Check queue limit per-channel (not total) so one stuck channel
    # doesn't block healthy channels
    active_channel_ids = [cid for cid, _ in channels]
    per_channel_counts = await get_buffer_queue_counts_per_channel(
        api_key, org_id, active_channel_ids
    )

    # Skip channels that are individually at the queue limit
    at_limit_channels = {
        cid for cid in active_channel_ids
        if per_channel_counts.get(cid, 0) >= max_queue
    }
    if at_limit_channels:
        logger.warning(
            f"Buffer channels at queue limit ({at_limit_channels}). Skipping them."
        )
        channels = [(cid, svc) for cid, svc in channels if cid not in at_limit_channels]
        if not channels:
            total = sum(per_channel_counts.values())
            return {
                "status": "queue_full",
                "queue_count": total,
                "max_queue": max_queue,
                "error": f"Buffer queue full for all active channels",
            }

    # Post to all healthy channels concurrently. Buffer shares one text
    # across channels, so retag utm_source per channel for accurate
    # attribution (the deal URL is the only link in the text).
    tasks = [
        _post_to_channel(api_key, cid, _retag_utm_source(tweet_text, svc), image_url, svc)
        for cid, svc in channels
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    successes = [r for r in results if isinstance(r, dict) and r.get("status") == "success"]
    failures = [r for r in results if isinstance(r, dict) and r.get("status") == "error"]

    if successes:
        return {
            "status": "success",
            "post_id": successes[0].get("post_id"),
            "channels_posted": len(successes),
            "channels_failed": len(failures),
            "skipped_channels": list(stuck_channels | at_limit_channels),
            "results": results,
        }
    else:
        return {
            "status": "error",
            "error": "; ".join(f.get("error", "?") for f in failures) or "All channels failed",
            "skipped_channels": list(stuck_channels | at_limit_channels),
            "results": results,
        }


async def post_deal_to_x(
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
    """Format a deal as a post and send it to all social platforms via Buffer.

    Posts to X (@bargain4huntrs), Instagram (@bargainhuntrs), and
    Facebook (Bargain Huntrs) simultaneously.
    Uses a short redirect link when deal_id is provided to keep posts clean.
    """
    # Use short link if we have a deal_id, otherwise use full affiliate URL
    if deal_id:
        from app.services.utm_service import public_deal_url
        # Add UTM params to the branded short link
        campaign = f"deal_alert_{datetime.utcnow().strftime('%Y-%m-%d')}"
        deal_url = add_utm_parameters(public_deal_url(deal_id), "twitter", "social", campaign)
    else:
        # Ensure deal URL has affiliate tag
        try:
            from app.services.affiliate_service import add_affiliate_tag
            deal_url = add_affiliate_tag(deal_url, retailer)
        except Exception:
            pass

    tweet_text = _format_deal_tweet(
        title=title,
        deal_price=deal_price,
        original_price=original_price,
        discount_percent=discount_percent,
        retailer=retailer,
        deal_url=deal_url,
        deal_tier=deal_tier,
    )

    result = await post_to_buffer(tweet_text, image_url=image_url)

    if result.get("status") == "success":
        return {
            "status": "success",
            "post_id": result.get("post_id"),
            "channels_posted": result.get("channels_posted", 0),
            "channels_failed": result.get("channels_failed", 0),
            "tweet_text": tweet_text,
        }
    else:
        return {
            "status": "error",
            "error": result.get("error"),
            "tweet_text": tweet_text,
        }
