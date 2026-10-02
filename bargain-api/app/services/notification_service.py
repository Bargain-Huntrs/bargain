"""
Notification Service — Deal Distribution

Central service that fans out arbitrage deals to all configured channels:
  - Discord (webhook)
  - Telegram (bot API)
  - X.com / Twitter (API v2)
  - Facebook (Graph API page post)
  - SMS (Telnyx)
  - Email (delegated to alert_service)

Each channel is independent — if one fails, others still send.
All sends are logged to the notification_logs table for auditability.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional, Union
from dataclasses import dataclass
import asyncio
import logging

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import NotificationLog, ArbitrageDeal, User
from app.services.arbitrage import ArbitrageOpportunity

logger = logging.getLogger(__name__)


@dataclass
class DealInfo:
    """Normalized deal info for notification messages."""
    asin: str
    title: str
    buy_price: Decimal
    sell_price: Decimal
    net_profit: Optional[Decimal]
    roi: Optional[Decimal]
    deal_tier: str
    buy_url: str
    image_url: Optional[str] = None
    category: Optional[str] = None
    niche: Optional[str] = None
    retailer: Optional[str] = None
    applied_coupon_code: Optional[str] = None
    coupon_discount: Optional[Decimal] = None

    @classmethod
    def from_opportunity(cls, opp: ArbitrageOpportunity) -> "DealInfo":
        return cls(
            asin=opp.asin,
            title=opp.title,
            buy_price=opp.buy_price,
            sell_price=opp.sell_price,
            net_profit=opp.profit.net_profit if opp.profit else None,
            roi=opp.profit.roi if opp.profit else None,
            deal_tier=opp.deal_tier,
            buy_url=opp.buy_url,
            image_url=opp.image_url,
            category=opp.category,
            niche=opp.niche,
            retailer=getattr(opp, "retailer", None) or getattr(opp, "buy_platform", None),
            applied_coupon_code=opp.applied_coupon_code,
            coupon_discount=opp.coupon_discount,
        )

    @classmethod
    def from_deal(cls, deal: ArbitrageDeal) -> "DealInfo":
        return cls(
            asin=deal.asin,
            title=deal.title,
            buy_price=deal.buy_price,
            sell_price=deal.sell_price,
            net_profit=deal.net_profit,
            roi=deal.roi,
            deal_tier=deal.deal_tier,
            buy_url=deal.buy_url or f"https://www.amazon.com/dp/{deal.asin}",
            image_url=deal.image_url,
            category=deal.category,
            niche=getattr(deal, "niche", None),
            retailer=getattr(deal, "retailer", None) or getattr(deal, "buy_platform", None),
        )

    # ── Compat accessors for channel senders ─────────────────────────────
    # send_discord/send_push were written against a deal payload with
    # deal_price/original_price/deal_url/retailer fields — DealInfo calls
    # them buy_price/sell_price/buy_url. These properties keep the senders
    # working instead of raising AttributeError on every send.
    @property
    def deal_price(self):
        return self.buy_price

    @property
    def original_price(self):
        return self.sell_price

    @property
    def deal_url(self):
        return self.buy_url

    @property
    def discount_percent(self) -> int:
        if self.sell_price and self.buy_price and self.sell_price > self.buy_price:
            return int(round((1 - float(self.buy_price) / float(self.sell_price)) * 100))
        return 0

    @property
    def roi_pct(self) -> str:
        if self.roi:
            return f"{float(self.roi)*100:.0f}%"
        return "N/A"

    @property
    def profit_str(self) -> str:
        if self.net_profit:
            return f"${float(self.net_profit):.2f}"
        return "N/A"

    @property
    def is_glitch(self) -> bool:
        return self.deal_tier == "glitch"


# ─── Message builders ───────────────────────────────────────────────────────

def build_short_message(deal: DealInfo) -> str:
    """Short message for SMS / Twitter (under 280 chars)."""
    glitch_tag = " ⚡GLITCH" if deal.is_glitch else ""
    coupon_tag = f" + coupon {deal.applied_coupon_code}" if deal.applied_coupon_code else ""
    msg = (
        f"🔥 Deal{glitch_tag}: {deal.title[:60]}\n"
        f"Buy ${float(deal.buy_price):.2f} → Sell ${float(deal.sell_price):.2f}\n"
        f"Profit {deal.profit_str} ({deal.roi_pct} ROI){coupon_tag}\n"
        f"{deal.buy_url}"
    )
    return msg[:280]


def build_rich_message(deal: DealInfo) -> str:
    """Rich message for Discord / Telegram / Facebook."""
    glitch_tag = " ⚡ PRICE GLITCH" if deal.is_glitch else ""
    coupon_line = ""
    if deal.applied_coupon_code and deal.coupon_discount:
        coupon_line = f"\n🎫 Coupon: {deal.applied_coupon_code} (−${float(deal.coupon_discount):.2f})"

    return (
        f"🔥 **Arbitrage Deal{glitch_tag}**\n"
        f"📦 {deal.title}\n"
        f"🏷️ Buy: ${float(deal.buy_price):.2f} ({deal.deal_tier})\n"
        f"💰 Sell: ${float(deal.sell_price):.2f}\n"
        f"📊 Net Profit: {deal.profit_str} ({deal.roi_pct} ROI)"
        f"{coupon_line}\n"
        f"🔗 {deal.buy_url}"
    )


# ─── Discord ────────────────────────────────────────────────────────────────

async def send_discord(deal: DealInfo) -> bool:
    """Post deal to Discord via webhook (rich embed)."""
    if not settings.DISCORD_WEBHOOK_URL:
        logger.debug("Discord webhook not configured, skipping")
        return False

    from app.services.discord_poster import post_deal_to_discord

    result = await post_deal_to_discord(
        title=deal.title,
        deal_price=float(deal.deal_price) if deal.deal_price else 0,
        original_price=float(deal.original_price) if deal.original_price else None,
        discount_percent=int(deal.discount_percent) if deal.discount_percent else 0,
        retailer=deal.retailer or "amazon",
        deal_url=deal.deal_url or "",
        image_url=deal.image_url,
        deal_tier="glitch" if deal.is_glitch else "clearance",
    )
    return result.get("status") == "success"


# ─── Telegram ───────────────────────────────────────────────────────────────

async def send_telegram(deal: DealInfo) -> bool:
    """Post deal to Telegram channel via bot API."""
    if not settings.TELEGRAM_BOT_TOKEN or not settings.TELEGRAM_CHANNEL_ID:
        logger.debug("Telegram not configured, skipping")
        return False

    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": settings.TELEGRAM_CHANNEL_ID,
        "text": build_rich_message(deal),
        "parse_mode": "Markdown",
        "disable_web_page_preview": False,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            logger.info(f"Telegram: posted deal {deal.asin}")
            return True
        except Exception as e:
            logger.error(f"Telegram: failed to post {deal.asin}: {e}")
            return False


# ─── X.com (Twitter) ────────────────────────────────────────────────────────

async def send_twitter(deal: DealInfo) -> bool:
    """Post deal to X.com / Twitter using API v2."""
    if not all([settings.TWITTER_API_KEY, settings.TWITTER_API_SECRET,
                settings.TWITTER_ACCESS_TOKEN, settings.TWITTER_ACCESS_TOKEN_SECRET]):
        logger.debug("Twitter not configured, skipping")
        return False

    # Use OAuth 1.0a for posting
    try:
        from requests.auth import OAuth1
        import requests as req

        auth = OAuth1(
            settings.TWITTER_API_KEY,
            settings.TWITTER_API_SECRET,
            settings.TWITTER_ACCESS_TOKEN,
            settings.TWITTER_ACCESS_TOKEN_SECRET,
        )

        tweet_text = build_short_message(deal)
        response = req.post(
            "https://api.twitter.com/2/tweets",
            json={"text": tweet_text},
            auth=auth,
            timeout=15,
        )
        response.raise_for_status()
        logger.info(f"Twitter: posted deal {deal.asin}")
        return True
    except Exception as e:
        logger.error(f"Twitter: failed to post {deal.asin}: {e}")
        return False


# ─── Facebook ───────────────────────────────────────────────────────────────

async def send_facebook(deal: DealInfo) -> bool:
    """Post deal to Facebook page via Graph API."""
    if not settings.FACEBOOK_PAGE_ACCESS_TOKEN or not settings.FACEBOOK_PAGE_ID:
        logger.debug("Facebook not configured, skipping")
        return False

    url = f"https://graph.facebook.com/v18.0/{settings.FACEBOOK_PAGE_ID}/feed"
    payload = {
        "message": build_rich_message(deal),
        "link": deal.buy_url,
        "access_token": settings.FACEBOOK_PAGE_ACCESS_TOKEN,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.post(url, data=payload)
            response.raise_for_status()
            logger.info(f"Facebook: posted deal {deal.asin}")
            return True
        except Exception as e:
            logger.error(f"Facebook: failed to post {deal.asin}: {e}")
            return False


# ─── SMS (Telnyx) ───────────────────────────────────────────────────────────

async def send_sms(deal: DealInfo, phone_number: str) -> bool:
    """Send a deal alert SMS via Telnyx. No-ops when Telnyx isn't configured."""
    if not settings.TELNYX_API_KEY or not settings.TELNYX_FROM_NUMBER:
        logger.debug("Telnyx not configured, skipping SMS")
        return False

    payload: dict = {
        "from": settings.TELNYX_FROM_NUMBER,
        "to": phone_number,
        "text": build_short_message(deal),
    }
    if settings.TELNYX_MESSAGING_PROFILE_ID:
        payload["messaging_profile_id"] = settings.TELNYX_MESSAGING_PROFILE_ID

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.post(
                "https://api.telnyx.com/v2/messages",
                json=payload,
                headers={
                    "Authorization": f"Bearer {settings.TELNYX_API_KEY}",
                    "Content-Type": "application/json",
                },
            )
            response.raise_for_status()
            logger.info(f"SMS sent to ***{phone_number[-4:]} for {deal.asin}")
            return True
        except Exception as e:
            logger.error(f"SMS to ***{phone_number[-4:]} failed: {e}")
            return False


# ─── Push (Firebase Cloud Messaging) ────────────────────────────────────────

async def send_push(deal: DealInfo, fcm_token: str) -> bool:
    """Send push notification via Firebase Cloud Messaging."""
    from app.services.firebase_service import send_push_notification

    title = f"🔥 {deal.deal_tier.upper()}" if deal.deal_tier != "clearance" else "💰 Deal Alert"
    body = f"{deal.title[:60]}\n${deal.deal_price} (was ${deal.original_price}) at {deal.retailer}"

    result = await send_push_notification(
        token=fcm_token,
        title=title,
        body=body,
        url=deal.deal_url,
        image_url=deal.image_url,
    )
    return result.get("status") == "success"


# ─── Central distribution ───────────────────────────────────────────────────

async def distribute_deal(
    deal: DealInfo,
    db: Session,
    push_recipients: Optional[list[str]] = None,
    sms_recipients: Optional[list[str]] = None,
) -> dict:
    """Distribute a deal to all configured notification channels.

    Args:
        deal: DealInfo with deal details
        db: Database session for logging
        push_recipients: List of FCM tokens for push notifications (users with push enabled)
        sms_recipients: List of phone numbers for SMS alerts (Hunter tier users with SMS opted in)

    Returns:
        Dict of channel -> success bool
    """
    # Skip low-profit deals unless it's a glitch
    min_profit = Decimal(str(settings.NOTIFY_MIN_PROFIT))
    if not deal.is_glitch and deal.net_profit and deal.net_profit < min_profit:
        logger.info(f"Skipping notifications for {deal.asin} — profit ${deal.net_profit} < ${min_profit}")
        return {}

    channels: dict[str, asyncio.Task] = {}

    # Social channels (broadcast to everyone)
    # Discord webhook (new rich embed poster)
    if settings.DISCORD_WEBHOOK_URL:
        channels["discord"] = asyncio.create_task(send_discord(deal))
    if settings.TELEGRAM_BOT_TOKEN:
        channels["telegram"] = asyncio.create_task(send_telegram(deal))

    # X/Twitter posting is handled EXCLUSIVELY by the scheduler's
    # _scrape_and_post_to_x() function, which has proper dedup logic
    # (title-based, URL-based, and alerted_at checks). Posting to X from
    # distribute_deal() caused duplicate posts because it bypassed dedup.
    #
    # DO NOT post to X/Twitter from here. Only post to non-X channels.
    from app.services import reddit_poster, discord_poster

    # Compute discount % from buy/sell price
    discount_pct = 0
    if deal.sell_price and deal.buy_price and deal.sell_price > deal.buy_price:
        discount_pct = int(round((1 - float(deal.buy_price) / float(deal.sell_price)) * 100))

    # Common kwargs for direct posters (non-X channels only)
    poster_kwargs = {
        "title": deal.title,
        "deal_price": float(deal.buy_price) if deal.buy_price else 0,
        "original_price": float(deal.sell_price) if deal.sell_price else None,
        "discount_percent": discount_pct,
        "retailer": deal.retailer or "amazon",
        "deal_url": deal.buy_url or "",
        "image_url": deal.image_url,
        "deal_tier": "glitch" if deal.is_glitch else (deal.deal_tier or "clearance"),
    }

    # Reddit (post to r/deals, r/buildapcsales, etc.)
    if reddit_poster.is_configured():
        channels["reddit"] = asyncio.create_task(
            reddit_poster.post_deal_to_reddit(**poster_kwargs)
        )

    # Facebook (no X/Twitter — that's handled by the scheduler)
    if settings.FACEBOOK_PAGE_ACCESS_TOKEN:
        channels["facebook"] = asyncio.create_task(send_facebook(deal))

    # Push notifications (per-recipient FCM tokens)
    if push_recipients:
        for token in push_recipients:
            channels[f"push:{token[:20]}"] = asyncio.create_task(send_push(deal, token))

    # SMS alerts (Hunter tier phone numbers). Recipient logged as last-4 only.
    if sms_recipients:
        for phone in sms_recipients:
            channels[f"sms:***{phone[-4:]}"] = asyncio.create_task(send_sms(deal, phone))
    # Wait for all
    results = {}
    for name, task in channels.items():
        try:
            success = await task
            results[name] = success

            # Log to database
            log = NotificationLog(
                asin=deal.asin,
                channel=name.split(":")[0],
                recipient=name.split(":")[1] if ":" in name else None,
                message=build_short_message(deal),
                status="sent" if success else "failed",
                sent_at=datetime.utcnow() if success else None,
            )
            db.add(log)
        except Exception as e:
            results[name] = False
            log = NotificationLog(
                asin=deal.asin,
                channel=name.split(":")[0],
                recipient=name.split(":")[1] if ":" in name else None,
                message=build_short_message(deal),
                status="failed",
                error=str(e),
            )
            db.add(log)

    db.commit()

    sent_count = sum(1 for v in results.values() if v)
    total_count = len(results)
    logger.info(f"Distributed deal {deal.asin} to {sent_count}/{total_count} channels")

    return results


def get_sms_recipients(db: Session, niche: Optional[str] = None) -> list[str]:
    """Get phone numbers of users who should receive SMS alerts.

    Only Hunter tier users who have opted into SMS deal alerts and have
    a phone number on file.

    Args:
        niche: Optional niche key. When provided, only users whose
            `subscribed_niches` includes this niche (or who have no
            niche subscription = all niches) are returned.
    """
    users = db.query(User).all()

    recipients: list[str] = []
    for u in users:
        # Only Hunter tier users get SMS alerts
        tier = (u.subscription_tier or "free").lower()
        if tier != "hunter":
            continue

        # Respect SMS deal alert preference
        if not getattr(u, "sms_deal_alerts", False):
            continue

        # Niche subscription filter
        if niche:
            subs = u.subscribed_niches or []
            if subs and niche not in subs:
                continue

        # Quiet hours — never SMS a user inside their quiet window.
        from app.services.alert_service import user_in_quiet_hours
        if user_in_quiet_hours(u):
            continue

        phone = getattr(u, "phone_number", None)
        if phone:
            recipients.append(phone)
    return recipients


def user_subscribed_to_niche(user: User, niche: Optional[str]) -> bool:
    """Check whether a user should receive alerts for a given niche.

    A user with no niche subscriptions receives all niches. A user with
    subscriptions only receives niches in their list.
    """
    if not niche:
        return True  # No niche on the deal → send to everyone
    subs = user.subscribed_niches or []
    return not subs or niche in subs
