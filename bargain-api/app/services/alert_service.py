"""
Alert Service — Phase 1

Creates Alert records in the database and sends email notifications via Resend.

Subscription tier limits:
  - FREE:    5 alerts/day, 24hr delay
  - HUSTLER: 50 alerts/day, no delay
  - PRO:     unlimited, no delay
  - AGENCY:  unlimited, no delay

Deduplication: don't alert the same ASIN within 24h.
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional, Union
import logging

from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import Alert, ArbitrageDeal, User
from app.services.arbitrage import ArbitrageOpportunity

logger = logging.getLogger(__name__)


# Tier configuration: (daily_limit, delay_hours)
# daily_limit of None means unlimited.
TIER_LIMITS = {
    "free": {"daily_limit": 5, "delay_hours": 24},
    "hunter": {"daily_limit": None, "delay_hours": 0},
}

# Valid alert types
VALID_ALERT_TYPES = {"arbitrage", "glitch", "clearance"}


def _normalize_tier(tier: Optional[str]) -> str:
    """Normalize subscription tier to lowercase, defaulting to free."""
    if not tier:
        return "free"
    return tier.lower().strip()


def _count_alerts_today(db: Session, user_id) -> int:
    """Count alerts created for a user in the last 24 hours."""
    cutoff = datetime.utcnow() - timedelta(hours=24)
    return db.query(Alert).filter(
        Alert.user_id == user_id,
        Alert.created_at >= cutoff,
    ).count()


def _recent_alert_for_asin(db: Session, user_id, asin: str) -> Optional[Alert]:
    """Check if an alert was already created for this ASIN in the last 24h."""
    cutoff = datetime.utcnow() - timedelta(hours=24)
    # The ASIN is embedded in the title or description; we search by source_url
    # which contains the Amazon product URL including the ASIN.
    return db.query(Alert).filter(
        Alert.user_id == user_id,
        Alert.source_url.ilike(f"%{asin}%"),
        Alert.created_at >= cutoff,
    ).first()


def user_in_quiet_hours(user: User) -> bool:
    """Whether the user is currently inside their quiet-hours window.

    Quiet hours are evaluated in the user's timezone (alert_timezone, IANA
    name; UTC when unset or invalid). A window crossing midnight (e.g.
    22 → 7) is handled correctly. Both ends unset = no quiet hours.
    """
    start = getattr(user, "quiet_start_hour", None)
    end = getattr(user, "quiet_end_hour", None)
    if start is None or end is None:
        return False
    try:
        from zoneinfo import ZoneInfo
        tz = ZoneInfo(user.alert_timezone) if getattr(user, "alert_timezone", None) else ZoneInfo("UTC")
        hour = datetime.now(tz).hour
    except Exception:
        hour = datetime.utcnow().hour
    if start == end:
        return True  # 24h quiet = alerts off
    if start < end:
        return start <= hour < end
    return hour >= start or hour < end


def _build_alert_from_opportunity(
    user_id,
    opp: Union[ArbitrageOpportunity, ArbitrageDeal],
) -> Alert:
    """Build an Alert record from an ArbitrageOpportunity or ArbitrageDeal."""
    # Determine alert type from deal tier
    deal_tier = getattr(opp, "deal_tier", "arbitrage")
    alert_type = deal_tier if deal_tier in VALID_ALERT_TYPES else "arbitrage"

    # Extract fields (works for both ArbitrageOpportunity and ArbitrageDeal)
    title = getattr(opp, "title", "Unknown Product")
    asin = getattr(opp, "asin", "")
    buy_price = getattr(opp, "buy_price", Decimal("0"))
    sell_price = getattr(opp, "sell_price", Decimal("0"))
    buy_url = getattr(opp, "buy_url", "")

    # Profit info
    profit = getattr(opp, "profit", None)
    if profit:
        net_profit = profit.net_profit
        roi = profit.roi
    else:
        net_profit = getattr(opp, "net_profit", None)
        roi = getattr(opp, "roi", None)

    profit_float = float(net_profit) if net_profit is not None else None
    roi_pct = f" ({float(roi)*100:.0f}% ROI)" if roi is not None else ""

    alert_title = f"[{alert_type.upper()}] {title[:80]}"
    description = (
        f"ASIN: {asin}\n"
        f"Buy Price: ${float(buy_price):.2f}\n"
        f"Sell Price: ${float(sell_price):.2f}\n"
        f"Net Profit: ${profit_float:.2f}{roi_pct}" if profit_float is not None
        else f"ASIN: {asin}\nBuy: ${float(buy_price):.2f}\nSell: ${float(sell_price):.2f}"
    )

    return Alert(
        user_id=user_id,
        type=alert_type,
        title=alert_title,
        description=description,
        source_url=buy_url or f"https://www.amazon.com/dp/{asin}",
        potential_profit=Decimal(str(profit_float)) if profit_float is not None else None,
        status="pending",
    )


def _send_email(to_email: str, subject: str, html_body: str) -> bool:
    """Send an email via Resend. Returns True on success, False on failure."""
    if not settings.RESEND_API_KEY:
        logger.info(f"[EMAIL CONSOLE] To: {to_email} | Subject: {subject}")
        logger.info(f"[EMAIL CONSOLE] Body: {html_body[:200]}")
        return False

    try:
        import resend
        resend.api_key = settings.RESEND_API_KEY

        params = {
            "from": settings.ALERT_FROM_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html_body,
        }
        response = resend.Emails.send(params)
        logger.info(f"Email sent to {to_email}: {response}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False


def _build_email_html(alert: Alert) -> str:
    """Build an HTML email body for an alert."""
    profit_str = ""
    if alert.potential_profit is not None:
        profit_str = f"<p><strong>Potential Profit:</strong> ${float(alert.potential_profit):.2f}</p>"

    url_link = ""
    if alert.source_url:
        url_link = f'<p><a href="{alert.source_url}">View Deal</a></p>'

    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">{alert.title}</h2>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <pre style="white-space: pre-wrap; font-family: Arial, sans-serif;">{alert.description}</pre>
        </div>
        {profit_str}
        {url_link}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
        <p style="color: #6b7280; font-size: 12px;">
            BargainHuntrs — Arbitrage Intelligence Platform
        </p>
    </div>
    """


def create_alert_for_opportunity(
    db: Session,
    user: User,
    opp: Union[ArbitrageOpportunity, ArbitrageDeal],
) -> Optional[Alert]:
    """Create an alert for an arbitrage opportunity.

    Respects subscription tier limits and deduplication rules.

    Args:
        db: Database session
        user: User to alert
        opp: ArbitrageOpportunity or ArbitrageDeal

    Returns:
        The created Alert record, or None if skipped (dedup/limit/delay).
    """
    tier = _normalize_tier(user.subscription_tier)
    tier_config = TIER_LIMITS.get(tier, TIER_LIMITS["free"])

    asin = getattr(opp, "asin", "")
    if not asin:
        logger.warning("Cannot create alert: no ASIN on opportunity")
        return None

    # Deduplication: skip if same ASIN alerted in last 24h
    if _recent_alert_for_asin(db, user.id, asin):
        logger.info(f"Skipping alert for ASIN {asin} — already alerted in last 24h")
        return None

    # Tier limit + personal cap: the stricter of the two wins. A personal
    # cap of 0 means "no personal cap" (tier limit still applies).
    daily_limit = tier_config["daily_limit"]
    personal_cap = getattr(user, "alert_max_per_day", 0) or 0
    if personal_cap > 0 and (daily_limit is None or personal_cap < daily_limit):
        daily_limit = personal_cap
    if daily_limit is not None:
        today_count = _count_alerts_today(db, user.id)
        if today_count >= daily_limit:
            logger.info(
                f"Skipping alert for user {user.id} — daily limit reached "
                f"({today_count}/{daily_limit} for tier '{tier}')"
            )
            return None

    # Quiet hours: the alert still gets created (visible on the dashboard)
    # but the email isn't sent while the user is in their quiet window.
    in_quiet_hours = user_in_quiet_hours(user)

    # Tier delay: FREE tier has 24hr delay (alert is created but email is deferred)
    delay_hours = tier_config["delay_hours"]
    should_send_email = delay_hours == 0 and not in_quiet_hours

    # Build and save the alert
    alert = _build_alert_from_opportunity(user.id, opp)
    db.add(alert)
    db.commit()
    db.refresh(alert)

    # Send email if no delay (or if we want to queue for later)
    if should_send_email:
        html = _build_email_html(alert)
        sent = _send_email(user.email, alert.title, html)
        if sent:
            alert.status = "sent"
            alert.sent_at = datetime.utcnow()
            db.commit()
            logger.info(f"Alert {alert.id} sent via email to {user.email}")
        else:
            # Email not sent (no API key or failure) — still keep the alert record
            alert.status = "logged"
            db.commit()
            logger.info(f"Alert {alert.id} logged (email not sent)")
    else:
        # FREE tier 24hr delay, or the user is inside their quiet-hours
        # window — the alert stays on the dashboard but no email goes out.
        alert.status = "delayed"
        db.commit()
        reason = "quiet hours" if in_quiet_hours else "FREE tier 24hr delay"
        logger.info(f"Alert {alert.id} created but deferred ({reason})")

    return alert


def send_test_alert(db: Session, user: User) -> Alert:
    """Send a test alert to verify email setup.

    Args:
        db: Database session
        user: User to send test alert to

    Returns:
        The created test Alert record.
    """
    alert = Alert(
        user_id=user.id,
        type="arbitrage",
        title="[TEST] BargainHuntrs Alert System Test",
        description=(
            "This is a test alert to verify your email notification setup.\n"
            "If you received this email, alerts are working correctly!"
        ),
        source_url="https://bargainhuntrs.com",
        potential_profit=Decimal("0.00"),
        status="pending",
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    html = _build_email_html(alert)
    sent = _send_email(user.email, alert.title, html)
    if sent:
        alert.status = "sent"
        alert.sent_at = datetime.utcnow()
    else:
        alert.status = "logged"
    db.commit()
    db.refresh(alert)

    return alert
