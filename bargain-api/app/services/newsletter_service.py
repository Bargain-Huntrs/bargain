"""Newsletter service — daily and weekly deal digest emails.

Fetches top deals from the database, groups them by retailer/category,
renders a dark-themed HTML email, and sends via Resend to all active
subscribers. Falls back to console logging when RESEND_API_KEY is unset.
"""
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional

from app.core.config import settings
from app.db.session import SessionLocal
from app.db.models import ArbitrageDeal, NewsletterSubscriber

logger = logging.getLogger(__name__)

FROM_EMAIL = "noreply@bargainhuntrs.com"
SITE_URL = "https://www.bargainhuntrs.com"
DEALS_URL = f"{SITE_URL}/deals"
UNSUB_URL = f"{SITE_URL}/newsletter"


def _send_email(to_email: str, subject: str, html_body: str) -> bool:
    """Send an email via Resend. Returns True on success, False on failure."""
    if not settings.RESEND_API_KEY:
        logger.info(f"[NEWSLETTER CONSOLE] To: {to_email} | Subject: {subject}")
        return False
    try:
        import resend
        resend.api_key = settings.RESEND_API_KEY
        params = {
            "from": FROM_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html_body,
        }
        response = resend.Emails.send(params)
        logger.info(f"Newsletter sent to {to_email}: {response}")
        return True
    except Exception as e:
        logger.error(f"Failed to send newsletter to {to_email}: {e}")
        return False


def _deal_discount(deal: ArbitrageDeal) -> int:
    """Calculate discount percentage for a deal."""
    if deal.historical_avg and deal.historical_avg > deal.buy_price and deal.buy_price > 0:
        return int(round((1 - float(deal.buy_price) / float(deal.historical_avg)) * 100))
    return 0


def _retailer_label(retailer: Optional[str]) -> str:
    if not retailer:
        return "Amazon"
    mapping = {
        "amazon": "Amazon",
        "walmart": "Walmart",
        "target": "Target",
        "best_buy": "Best Buy",
        "bestbuy": "Best Buy",
        "home_depot": "Home Depot",
        "homedepot": "Home Depot",
        "lowes": "Lowe's",
        "costco": "Costco",
        "ebay": "eBay",
        "newegg": "Newegg",
        "adorama": "Adorama",
        "woot": "Woot",
        "corsair": "Corsair",
        "lenovo": "Lenovo",
    }
    key = retailer.lower().replace("-", "_")
    return mapping.get(key, retailer.replace("_", " ").title())


def _fetch_top_deals(db, limit: int = 10, days: int = 1):
    """Fetch top deals sorted by discount percentage / profit potential."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    query = (
        db.query(ArbitrageDeal)
        .filter(
            ArbitrageDeal.is_profitable == True,
            ArbitrageDeal.status == "active",
            ArbitrageDeal.buy_price > 0,
            ArbitrageDeal.detected_at >= cutoff,
        )
        .order_by(
            ArbitrageDeal.net_profit.desc(),
            ArbitrageDeal.score.desc(),
            ArbitrageDeal.detected_at.desc(),
        )
        .limit(limit * 3)  # over-fetch for dedup + filtering
    )
    all_deals = query.all()

    # Filter to 20%+ discount and dedup by title
    seen = set()
    filtered = []
    for d in all_deals:
        if not d.historical_avg or d.historical_avg <= d.buy_price:
            continue
        disc = (Decimal(str(d.historical_avg)) - Decimal(str(d.buy_price))) / Decimal(str(d.historical_avg))
        if disc < Decimal("0.20"):
            continue
        title_key = (d.title or "")[:80].lower().strip()
        if title_key and title_key not in seen:
            seen.add(title_key)
            filtered.append(d)
        if len(filtered) >= limit:
            break

    # Sort by discount percentage descending
    filtered.sort(key=lambda d: _deal_discount(d), reverse=True)
    return filtered[:limit]


def _group_deals_by_retailer(deals):
    """Group deals by retailer for sectioned display."""
    groups = {}
    for deal in deals:
        retailer = _retailer_label(getattr(deal, "retailer", None) or deal.buy_platform)
        groups.setdefault(retailer, []).append(deal)
    return groups


def _render_deal_card(deal: ArbitrageDeal) -> str:
    """Render a single deal card as inline-styled HTML."""
    discount = _deal_discount(deal)
    original = f"${float(deal.historical_avg):.2f}" if deal.historical_avg else ""
    sale = f"${float(deal.buy_price):.2f}"
    image = deal.image_url or f"{SITE_URL}/logos/profile-icon-dark.png"
    title = (deal.title or "")[:120]
    url = deal.buy_url or f"{DEALS_URL}"
    tier = getattr(deal, "deal_tier", "arbitrage") or "arbitrage"
    tier_label = tier.upper()
    tier_colors = {
        "glitch": "#f59e0b",
        "clearance": "#a855f7",
        "arbitrage": "#10b981",
        "watch": "#3b82f6",
    }
    tier_color = tier_colors.get(tier, "#10b981")
    profit_str = ""
    if deal.net_profit and float(deal.net_profit) > 0:
        profit_str = f'<p style="margin:4px 0 0;font-size:13px;color:#10b981;font-weight:600;">Profit: ${float(deal.net_profit):.2f}</p>'

    return f"""
    <div style="background:#1c1c1f;border:1px solid #2a2a2e;border-radius:10px;overflow:hidden;margin-bottom:16px;">
      <div style="display:flex;flex-direction:column;">
        <div style="background:#111114;height:140px;display:flex;align-items:center;justify-content:center;overflow:hidden;">
          <img src="{image}" alt="{title}" style="max-height:140px;max-width:100%;object-fit:contain;" />
        </div>
        <div style="padding:16px;">
          <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
            <span style="background:{tier_color};color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;">{tier_label}</span>
            {f'<span style="background:#ef4444;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;">{discount}% OFF</span>' if discount > 0 else ''}
          </div>
          <p style="margin:0 0 10px;font-size:14px;font-weight:600;color:#e4e4e7;line-height:1.4;">{title}</p>
          <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:10px;">
            <span style="font-size:20px;font-weight:800;color:#fff;">{sale}</span>
            {f'<span style="font-size:14px;color:#71717a;text-decoration:line-through;">{original}</span>' if original else ''}
          </div>
          {profit_str}
          <a href="{url}" style="display:inline-block;margin-top:10px;background:#10b981;color:#fff;font-size:13px;font-weight:700;padding:10px 20px;border-radius:8px;text-decoration:none;">Shop Now</a>
        </div>
      </div>
    </div>"""


def _render_digest_html(deals, subscriber: NewsletterSubscriber, is_weekly: bool) -> str:
    """Render the full digest email HTML."""
    groups = _group_deals_by_retailer(deals)
    period = "This Week" if is_weekly else "Today"
    subject_period = "Weekly" if is_weekly else "Daily"
    deal_count = len(deals)

    # Build grouped deal sections
    sections_html = ""
    for retailer, retailer_deals in groups.items():
        cards = "".join(_render_deal_card(d) for d in retailer_deals)
        sections_html += f"""
        <div style="margin-bottom:24px;">
          <h3 style="color:#a1a1aa;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">{retailer}</h3>
          {cards}
        </div>"""

    name = subscriber.name or "there"
    unsub_link = f"{UNSUB_URL}?email={subscriber.email}"

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>BargainHuntrs {subject_period} Deal Digest</title>
    </head>
    <body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;background:#09090b;">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#18181b 0%,#27272a 100%);padding:32px 24px;text-align:center;border-bottom:1px solid #27272a;">
          <div style="display:inline-flex;align-items:center;gap:8px;margin-bottom:12px;">
            <span style="background:#fafafa;color:#18181b;font-size:14px;font-weight:900;padding:4px 10px;border-radius:8px;">BH</span>
            <span style="color:#fafafa;font-size:18px;font-weight:800;letter-spacing:-0.5px;">BargainHuntrs</span>
          </div>
          <h1 style="color:#fafafa;font-size:24px;margin:0;font-weight:800;">{subject_period} Deal Digest</h1>
          <p style="color:#a1a1aa;font-size:14px;margin:8px 0 0;">{period}'s top {deal_count} deals hand-picked for you</p>
        </div>

        <!-- Body -->
        <div style="padding:24px;">
          <p style="color:#d4d4d8;font-size:15px;line-height:1.6;margin:0 0 24px;">
            Hey {name}, here are the best deals we found {period.lower()}. Prices can change fast -- grab them before they're gone.
          </p>

          {sections_html}

          <!-- View All CTA -->
          <div style="text-align:center;margin:32px 0 24px;">
            <a href="{DEALS_URL}" style="display:inline-block;background:#fafafa;color:#18181b;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none;">View All Deals</a>
          </div>

          <!-- Footer -->
          <div style="border-top:1px solid #27272a;padding:24px 0;text-align:center;">
            <p style="color:#71717a;font-size:12px;line-height:1.6;margin:0 0 8px;">
              BargainHuntrs -- Arbitrage Intelligence Platform<br>
              You received this email because you subscribed to our deal digest.
            </p>
            <a href="{unsub_link}" style="color:#52525b;font-size:12px;text-decoration:underline;">Unsubscribe</a>
          </div>
        </div>
      </div>
    </body>
    </html>"""


def _get_active_subscribers(db):
    """Return all active newsletter subscribers."""
    return db.query(NewsletterSubscriber).filter(NewsletterSubscriber.is_active == True).all()


def send_daily_digest() -> int:
    """Send the daily deal digest to all active subscribers. Returns count sent."""
    db = SessionLocal()
    try:
        deals = _fetch_top_deals(db, limit=10, days=1)
        if not deals:
            logger.info("No deals found for daily digest -- skipping")
            return 0

        subscribers = _get_active_subscribers(db)
        if not subscribers:
            logger.info("No active subscribers for daily digest")
            return 0

        sent = 0
        for sub in subscribers:
            html = _render_digest_html(deals, sub, is_weekly=False)
            subject = "Today's Top 10 Deals -- BargainHuntrs Daily Digest"
            if _send_email(sub.email, subject, html):
                sent += 1

        logger.info(f"Daily digest sent to {sent}/{len(subscribers)} subscribers")
        return sent
    except Exception as e:
        logger.error(f"Daily digest failed: {e}", exc_info=True)
        return 0
    finally:
        db.close()


def send_weekly_digest() -> int:
    """Send the weekly deal digest to all active subscribers. Returns count sent."""
    db = SessionLocal()
    try:
        deals = _fetch_top_deals(db, limit=20, days=7)
        if not deals:
            logger.info("No deals found for weekly digest -- skipping")
            return 0

        subscribers = _get_active_subscribers(db)
        if not subscribers:
            logger.info("No active subscribers for weekly digest")
            return 0

        sent = 0
        for sub in subscribers:
            html = _render_digest_html(deals, sub, is_weekly=True)
            subject = "This Week's Top 20 Deals -- BargainHuntrs Weekly Digest"
            if _send_email(sub.email, subject, html):
                sent += 1

        logger.info(f"Weekly digest sent to {sent}/{len(subscribers)} subscribers")
        return sent
    except Exception as e:
        logger.error(f"Weekly digest failed: {e}", exc_info=True)
        return 0
    finally:
        db.close()


def send_newsletter_confirmation(email: str, name: Optional[str] = None, api_base_url: str = "https://api.bargainhuntrs.com", token: str = "") -> bool:
    """Send the double-opt-in confirmation email (not a welcome — the
    subscription only activates when the recipient clicks the link, so an
    unauthenticated POST can't enrol (and spam) arbitrary inboxes)."""
    display_name = name or "there"
    confirm_url = f"{api_base_url}/api/v1/newsletter/confirm?token={token}"
    html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;background:#09090b;">
        <div style="background:linear-gradient(135deg,#18181b 0%,#27272a 100%);padding:32px 24px;text-align:center;border-bottom:1px solid #27272a;">
          <div style="display:inline-flex;align-items:center;gap:8px;margin-bottom:12px;">
            <span style="background:#fafafa;color:#18181b;font-size:14px;font-weight:900;padding:4px 10px;border-radius:8px;">BH</span>
            <span style="color:#fafafa;font-size:18px;font-weight:800;letter-spacing:-0.5px;">BargainHuntrs</span>
          </div>
          <h1 style="color:#fafafa;font-size:24px;margin:0;font-weight:800;">Confirm your subscription</h1>
          <p style="color:#a1a1aa;font-size:14px;margin:8px 0 0;">One click and the daily deal digest is yours</p>
        </div>
        <div style="padding:32px 24px;">
          <h2 style="color:#fafafa;font-size:20px;margin:0 0 16px;">Hey {display_name},</h2>
          <p style="color:#d4d4d8;font-size:15px;line-height:1.6;margin:0 0 20px;">
            Someone (hopefully you) asked to get the BargainHuntrs deal digest at this
            address. Click below to confirm -- top deals, pricing glitches, and clearance
            finds delivered every morning.
          </p>
          <div style="text-align:center;margin:28px 0;">
            <a href="{confirm_url}" style="display:inline-block;background:#10b981;color:#fff;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none;">Confirm Subscription</a>
          </div>
          <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0;">
            If you didn't request this, just ignore the email -- you won't be
            subscribed and won't hear from us again.
          </p>
          <div style="border-top:1px solid #27272a;padding:20px 0;margin-top:24px;text-align:center;">
            <p style="color:#71717a;font-size:12px;margin:0;">
              BargainHuntrs -- Arbitrage Intelligence Platform
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>"""
    return _send_email(email, "Confirm your BargainHuntrs subscription", html)


def send_welcome_newsletter(email: str, name: Optional[str] = None) -> bool:
    """Send a welcome email to a new newsletter subscriber."""
    display_name = name or "there"
    html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;background:#09090b;">
        <div style="background:linear-gradient(135deg,#18181b 0%,#27272a 100%);padding:32px 24px;text-align:center;border-bottom:1px solid #27272a;">
          <div style="display:inline-flex;align-items:center;gap:8px;margin-bottom:12px;">
            <span style="background:#fafafa;color:#18181b;font-size:14px;font-weight:900;padding:4px 10px;border-radius:8px;">BH</span>
            <span style="color:#fafafa;font-size:18px;font-weight:800;letter-spacing:-0.5px;">BargainHuntrs</span>
          </div>
          <h1 style="color:#fafafa;font-size:24px;margin:0;font-weight:800;">You're In!</h1>
          <p style="color:#a1a1aa;font-size:14px;margin:8px 0 0;">Daily deal digest starts tomorrow</p>
        </div>
        <div style="padding:32px 24px;">
          <h2 style="color:#fafafa;font-size:20px;margin:0 0 16px;">Hey {display_name},</h2>
          <p style="color:#d4d4d8;font-size:15px;line-height:1.6;margin:0 0 20px;">
            Welcome to the BargainHuntrs newsletter. Every morning you'll get the top 10 deals
            from across 500+ retailers -- pricing glitches, clearance, and arbitrage opportunities
            delivered straight to your inbox.
          </p>
          <div style="background:#18181b;border:1px solid #27272a;border-radius:10px;padding:20px;margin:20px 0;">
            <p style="color:#a1a1aa;font-size:13px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">What you get:</p>
            <ul style="color:#d4d4d8;font-size:14px;line-height:2;margin:0;padding-left:20px;">
              <li>Daily digest of the top 10 deals</li>
              <li>Weekly roundup of the 20 best deals</li>
              <li>Early access to pricing glitches</li>
              <li>Exclusive deals not on the public feed</li>
            </ul>
          </div>
          <div style="text-align:center;margin:28px 0;">
            <a href="{DEALS_URL}" style="display:inline-block;background:#10b981;color:#fff;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none;">Browse Today's Deals</a>
          </div>
          <div style="border-top:1px solid #27272a;padding:20px 0;text-align:center;">
            <p style="color:#71717a;font-size:12px;margin:0;">
              BargainHuntrs -- Arbitrage Intelligence Platform<br>
              <a href="{UNSUB_URL}?email={email}" style="color:#52525b;text-decoration:underline;">Unsubscribe</a>
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>"""
    return _send_email(email, "Welcome to BargainHuntrs Deals Newsletter", html)
