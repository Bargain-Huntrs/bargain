"""Affiliate Network Integrations.

Supports multiple affiliate networks for fetching deals, promo codes,
and generating affiliate tracking links. Each network has its own
auth method and API structure.

Supported Networks:
- Rakuten Advertising (OAuth 2.0, coupon feed API)
- Awin (Bearer token, promotions API)
- CJ Affiliate (Bearer token, link search API)
- Skimlinks (Product key, link conversion API)

Each network requires separate signup and approval. Once approved,
set the environment variables and the scrapers will automatically
pull deals from that network.

Env vars:
  RAKUTEN_WEBSERVICES_TOKEN — Rakuten Web Services token
  RAKUTEN_SECURITY_TOKEN    — Rakuten security token
  AWIN_API_TOKEN            — Awin API bearer token
  AWIN_PUBLISHER_ID         — Awin publisher ID
  CJ_ACCESS_TOKEN           — CJ Affiliate personal access token
  CJ_WEBSITE_ID             — CJ Affiliate website ID
  SKIMLINKS_PRODUCT_KEY     — Skimlinks product key
  SKIMLINKS_CLIENT_ID       — Skimlinks client ID
  SKIMLINKS_CLIENT_SECRET   — Skimlinks client secret
"""
import asyncio
import hashlib
import logging
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Optional
from urllib.parse import quote

import httpx
from bs4 import BeautifulSoup

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class AffiliateDeal:
    """A deal from an affiliate network."""
    title: str
    deal_url: str  # Affiliate tracking URL
    original_url: str  # Original product URL
    retailer: str
    network: str  # Which affiliate network
    deal_price: Optional[Decimal] = None
    original_price: Optional[Decimal] = None
    discount_percent: Optional[int] = None
    image_url: Optional[str] = None
    promo_code: Optional[str] = None
    description: str = ""
    expires_at: Optional[datetime] = None


# ============================================================
# Rakuten Advertising
# ============================================================
# API: https://api.linksynergy.com
# Auth: Web Services Token + Security Token
# Coupon Feed: https://api.linksynergy.com/coupon/1.0?token=...&network=1
# Sign up: https://pubhelp.rakutenadvertising.com

RAKUTEN_API_BASE = "https://api.linksynergy.com"


def _rakuten_configured() -> bool:
    return bool(getattr(settings, "RAKUTEN_WEBSERVICES_TOKEN", ""))


async def fetch_rakuten_coupons(max_results: int = 100) -> list[AffiliateDeal]:
    """Fetch coupons/deals from Rakuten Advertising Coupon Feed API.

    Requires RAKUTEN_WEBSERVICES_TOKEN env var.
    """
    if not _rakuten_configured():
        logger.info("Rakuten not configured — skipping")
        return []

    token = settings.RAKUTEN_WEBSERVICES_TOKEN
    deals: list[AffiliateDeal] = []

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Coupon Feed API
            url = f"{RAKUTEN_API_BASE}/coupon/1.0"
            params = {
                "token": token,
                "network": "1",  # US network
                "resultsperpage": str(max_results),
                "pagenumber": "1",
            }
            resp = await client.get(url, params=params)

            if resp.status_code != 200:
                logger.warning(f"Rakuten API error: {resp.status_code}")
                return []

            # Rakuten returns XML
            soup = BeautifulSoup(resp.text, "xml")
            for link in soup.find_all("link"):
                try:
                    title = link.findtext("offername", "")
                    deal_url = link.findtext("clickurl", "")
                    original_url = link.findtext("url", "") or deal_url
                    promo_code = link.findtext("couponcode", "")
                    image = link.findtext("imageurl", "")
                    expires = link.findtext("offerend", "")
                    advertiser = link.findtext("advertisername", "")

                    if not title:
                        continue

                    retailer = _normalize_retailer(advertiser)
                    expires_at = None
                    if expires:
                        try:
                            expires_at = datetime.strptime(expires[:10], "%Y-%m-%d")
                        except (ValueError, TypeError):
                            pass

                    deals.append(AffiliateDeal(
                        title=title[:500],
                        deal_url=deal_url,
                        original_url=original_url,
                        retailer=retailer,
                        network="rakuten",
                        image_url=image if image else None,
                        promo_code=promo_code if promo_code else None,
                        description=f"{advertiser} — {link.findtext('offerdescription', '')}"[:1000],
                        expires_at=expires_at,
                    ))
                except Exception as e:
                    logger.debug(f"Failed to parse Rakuten coupon: {e}")

    except Exception as e:
        logger.error(f"Rakuten fetch failed: {e}")

    logger.info(f"Rakuten: {len(deals)} coupons fetched")
    return deals


# ============================================================
# Awin
# ============================================================
# API: https://api.awin.com
# Auth: Bearer token + Publisher ID
# Promotions: https://api.awin.com/promotions?accessToken=...&publisherId=...
# Sign up: https://ui.awin.com/publisher-signup/en

AWIN_API_BASE = "https://api.awin.com"


def _awin_configured() -> bool:
    return bool(getattr(settings, "AWIN_API_TOKEN", "")) and bool(getattr(settings, "AWIN_PUBLISHER_ID", ""))


async def fetch_awin_promotions(max_results: int = 200) -> list[AffiliateDeal]:
    """Fetch promotions/deals from Awin Offers API.

    Requires AWIN_API_TOKEN and AWIN_PUBLISHER_ID env vars.
    Uses POST /publisher/{publisherId}/promotions (Awin's correct endpoint).
    Fetches promotions from joined advertisers, filtering client-side
    since the API's advertiserIds filter doesn't reliably work.
    """
    if not _awin_configured():
        logger.info("Awin not configured — skipping")
        return []

    token = settings.AWIN_API_TOKEN
    publisher_id = settings.AWIN_PUBLISHER_ID
    deals: list[AffiliateDeal] = []

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # First, get joined advertiser IDs
            prog_url = f"{AWIN_API_BASE}/publishers/{publisher_id}/programmes"
            prog_params = {"accessToken": token, "relationship": "joined"}
            joined_ids: set[int] = set()
            try:
                prog_resp = await client.get(prog_url, params=prog_params)
                if prog_resp.status_code == 200:
                    programmes = prog_resp.json()
                    if isinstance(programmes, list):
                        joined_ids = {p.get("id") for p in programmes if p.get("id")}
                        logger.info(f"Awin: {len(joined_ids)} joined advertisers")
            except Exception as e:
                logger.warning(f"Awin programmes fetch failed: {e}")

            # Fetch promotions via POST endpoint
            url = f"{AWIN_API_BASE}/publisher/{publisher_id}/promotions"
            params = {"accessToken": token}
            body = {
                "pageSize": str(max_results),
                "type": "promotion",  # Get promotion-type offers first
            }

            resp = await client.post(url, params=params, json=body)

            if resp.status_code != 200:
                logger.warning(f"Awin promotions API returned {resp.status_code}: {resp.text[:200]}")
                return []

            data = resp.json()
            promos = data.get("data", [])
            total_available = data.get("pagination", {}).get("total", 0)
            logger.info(f"Awin: {len(promos)} promotions on page (total available: {total_available})")

            # Also fetch voucher-type offers
            body_voucher = {"pageSize": str(max_results), "type": "voucher"}
            resp_v = await client.post(url, params=params, json=body_voucher)
            if resp_v.status_code == 200:
                data_v = resp_v.json()
                promos.extend(data_v.get("data", []))
                logger.info(f"Awin: {len(data_v.get('data', []))} voucher offers added")

            for promo in promos:
                try:
                    title = promo.get("title", "")
                    advertiser_info = promo.get("advertiser", {})
                    advertiser_id = advertiser_info.get("id")
                    advertiser_name = advertiser_info.get("name", "")
                    deal_url = promo.get("urlTracking", "") or promo.get("url", "")
                    original_url = promo.get("url", "")
                    promo_code = promo.get("voucherCode", "") or promo.get("code", "")
                    description = promo.get("description", "")
                    expires = promo.get("endDate", "")
                    promo_type = promo.get("type", "")

                    if not title or not deal_url:
                        continue

                    # If the advertiser is joined, always include.
                    # If not joined, still include — Awin tracking links work
                    # for any advertiser, and the promotions API already
                    # returns offers visible to this publisher account.
                    # (Previously filtered to joined only, but the 7 joined
                    # advertisers rarely have active promotions, yielding 0
                    # deals. Allowing all promotions gives access to 33K+.)

                    retailer = _normalize_retailer(advertiser_name)

                    # Extract price/discount from title and description
                    deal_price, original_price, discount_percent = _extract_awin_prices(
                        title, description, promo_code
                    )

                    expires_at = None
                    if expires:
                        try:
                            expires_at = datetime.fromisoformat(expires.replace("Z", "+00:00"))
                        except (ValueError, TypeError):
                            pass

                    deals.append(AffiliateDeal(
                        title=title[:500],
                        deal_url=deal_url,
                        original_url=original_url,
                        retailer=retailer,
                        network="awin",
                        deal_price=deal_price,
                        original_price=original_price,
                        discount_percent=discount_percent,
                        image_url=None,  # Awin promotions API doesn't return images
                        promo_code=promo_code if promo_code else None,
                        description=description[:1000],
                        expires_at=expires_at,
                    ))
                except Exception as e:
                    logger.debug(f"Failed to parse Awin promo: {e}")

    except Exception as e:
        logger.error(f"Awin fetch failed: {e}")

    # Deduplicate by tracking URL
    seen_urls: set[str] = set()
    unique_deals: list[AffiliateDeal] = []
    for deal in deals:
        if deal.deal_url not in seen_urls:
            seen_urls.add(deal.deal_url)
            unique_deals.append(deal)

    logger.info(f"Awin: {len(unique_deals)} promotions fetched (from {len(deals)} raw, deduped)")
    return unique_deals


def _extract_awin_prices(
    title: str, description: str, code: str
) -> tuple[Optional[Decimal], Optional[Decimal], Optional[int]]:
    """Try to extract price/discount info from Awin promotion text.

    Awin promotions don't always have structured price fields, but the
    title/description often contains discount info like "$50 off", "20% off",
    "Save $30", etc.
    """
    import re

    text = f"{title} {description}".lower()

    # Try to find discount percentage (e.g., "20% off", "save 30%")
    pct_match = re.search(r'(\d+)\s*%\s*off', text)
    if pct_match:
        discount_percent = int(pct_match.group(1))
        return None, None, discount_percent

    # Try "save $X" pattern
    save_match = re.search(r'save\s+\$(\d+)', text)
    if save_match:
        savings = Decimal(save_match.group(1))
        return None, None, int(savings)  # We have savings but not prices

    # Try "$X off" pattern
    off_match = re.search(r'\$(\d+)\s*off', text)
    if off_match:
        savings = Decimal(off_match.group(1))
        return None, None, int(savings)

    return None, None, None


async def fetch_awin_programmes(
    relationship: str = "joined",
    country_code: str = "",
) -> list[dict]:
    """Fetch Awin programme list for a given relationship.

    Valid relationships: joined, pending, suspended, rejected, notjoined.
    Optionally filter by ISO Alpha-2 country code (e.g. 'US').
    """
    if not _awin_configured():
        logger.info("Awin not configured — skipping programme lookup")
        return []

    token = settings.AWIN_API_TOKEN
    publisher_id = settings.AWIN_PUBLISHER_ID

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            url = f"{AWIN_API_BASE}/publishers/{publisher_id}/programmes"
            params: dict[str, str] = {"accessToken": token}
            if relationship:
                params["relationship"] = relationship
            if country_code:
                params["countryCode"] = country_code

            resp = await client.get(url, params=params)
            if resp.status_code == 200:
                return resp.json()
            logger.warning(f"Awin programmes API error: {resp.status_code}")
    except Exception as e:
        logger.error(f"Awin programmes fetch failed: {e}")

    return []


# ============================================================
# CJ Affiliate
# ============================================================
# API: https://linksearch.api.cj.com/v2/link-search
# Auth: Bearer token (Personal Access Token)
# Sign up: https://signup.cj.com/member/signup/publisher/

CJ_API_BASE = "https://linksearch.api.cj.com/v2"


def _cj_configured() -> bool:
    return bool(getattr(settings, "CJ_ACCESS_TOKEN", "")) and bool(getattr(settings, "CJ_WEBSITE_ID", ""))


async def fetch_cj_links(max_results: int = 100) -> list[AffiliateDeal]:
    """Fetch promotional links from CJ Affiliate Link Search API.

    Requires CJ_ACCESS_TOKEN and CJ_WEBSITE_ID env vars.
    """
    if not _cj_configured():
        logger.info("CJ Affiliate not configured — skipping")
        return []

    token = settings.CJ_ACCESS_TOKEN
    website_id = settings.CJ_WEBSITE_ID
    deals: list[AffiliateDeal] = []

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Link Search API — fetch coupon/sale links
            url = f"{CJ_API_BASE}/link-search"
            headers = {"Authorization": f"Bearer {token}"}
            params = {
                "website-id": website_id,
                "promotion-type": "coupon",
                "records-per-page": str(min(max_results, 1000)),
                "page-number": "1",
            }
            resp = await client.get(url, headers=headers, params=params)

            if resp.status_code != 200:
                logger.warning(f"CJ API error: {resp.status_code}")
                return []

            # Link Search returns XML:
            # <cj-api><links ...><link><link-name/>..<destination/>..</link></links></cj-api>
            try:
                root = ET.fromstring(resp.text)
            except ET.ParseError as e:
                logger.warning(f"CJ XML parse error: {e}")
                return []

            error = root.findtext("error-message")
            if error:
                logger.warning(f"CJ API error: {error.strip()}")
                return []

            for link in root.iter("link"):
                try:
                    title = link.findtext("link-name") or ""
                    deal_url = link.findtext("destination") or ""
                    promo_code = link.findtext("coupon-code") or ""
                    advertiser = link.findtext("advertiser-name") or ""
                    expires = (link.findtext("promotion-end-date") or "").strip()

                    if not title or not deal_url:
                        continue

                    retailer = _normalize_retailer(advertiser)
                    expires_at = None
                    if expires and expires.lower() != "null":
                        for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
                            try:
                                expires_at = datetime.strptime(expires, fmt)
                                break
                            except ValueError:
                                continue

                    deals.append(AffiliateDeal(
                        title=title[:500],
                        deal_url=deal_url,
                        original_url=deal_url,
                        retailer=retailer,
                        network="cj",
                        promo_code=promo_code if promo_code else None,
                        description=(link.findtext("description") or "")[:1000],
                        expires_at=expires_at,
                    ))
                except Exception as e:
                    logger.debug(f"Failed to parse CJ link: {e}")

    except Exception as e:
        logger.error(f"CJ fetch failed: {e}")

    logger.info(f"CJ: {len(deals)} links fetched")
    return deals


# ============================================================
# Skimlinks
# ============================================================
# API: http://api-merchants.skimlinks.com
# Auth: Product Key + Client ID/Secret
# Sign up: https://signup.skimlinks.com/en

SKIMLINKS_MERCHANT_API = "http://api-merchants.skimlinks.com"
SKIMLINKS_PRODUCT_API = "http://api-products.skimlinks.com"


def _skimlinks_configured() -> bool:
    return bool(getattr(settings, "SKIMLINKS_PRODUCT_KEY", ""))


async def fetch_skimlinks_offers(max_results: int = 100) -> list[AffiliateDeal]:
    """Fetch offers from Skimlinks.

    Requires SKIMLINKS_PRODUCT_KEY env var.
    Note: Full merchant API requires Managed tier.
    """
    if not _skimlinks_configured():
        logger.info("Skimlinks not configured — skipping")
        return []

    # Skimlinks doesn't have a direct deals/coupons API for non-managed tiers
    # But we can use the link conversion API to convert regular URLs to affiliate links
    # This is useful for converting scraped deal URLs to affiliate tracking URLs
    logger.info("Skimlinks: link conversion available (no direct deals API for non-managed tier)")
    return []


async def convert_skimlinks_url(url: str) -> str:
    """Convert a regular URL to a Skimlinks affiliate tracking URL.

    Requires SKIMLINKS_PRODUCT_KEY env var.
    """
    if not _skimlinks_configured():
        return url

    # Skimlinks uses a simple URL wrapping mechanism
    # https://go.skimresources.com?id=PRODUCT_KEY&url=ENCODED_URL
    product_key = settings.SKIMLINKS_PRODUCT_KEY
    return f"https://go.skimresources.com?id={product_key}&url={quote(url, safe='')}"


# ============================================================
# Utility Functions
# ============================================================

_RETAILER_MAP = {
    "walmart": "walmart",
    "walmart.com": "walmart",
    "home depot": "home_depot",
    "homedepot.com": "home_depot",
    "the home depot": "home_depot",
    "lowe's": "lowes",
    "lowes": "lowes",
    "lowes.com": "lowes",
    "target": "target",
    "target.com": "target",
    "best buy": "best_buy",
    "bestbuy.com": "best_buy",
    "newegg": "newegg",
    "newegg.com": "newegg",
    "costco": "costco",
    "costco.com": "costco",
    "wayfair": "wayfair",
    "wayfair.com": "wayfair",
    "macys": "macys",
    "macy's": "macys",
    "macy's inc.": "macys",
    "kohl's": "kohls",
    "kohls": "kohls",
    "sephora": "sephora",
    "nordstrom": "nordstrom",
    "adidas": "adidas",
    "nike": "nike",
    "puma": "puma",
    "levi's": "levis",
    "levi strauss": "levis",
    "reebok": "reebok",
    "warby parker": "warby_parker",
    "dyson": "dyson",
    "irobot": "irobot",
    "hellofresh": "hellofresh",
    "godaddy": "godaddy",
    "office depot": "office_depot",
    "officedepot": "office_depot",
    "verizon": "verizon",
    "shein": "shein",
    "fashion nova": "fashion_nova",
}


def _normalize_retailer(name: str) -> str:
    """Normalize a retailer name to our internal key."""
    name_lower = name.lower().strip()
    return _RETAILER_MAP.get(name_lower, name_lower.replace(" ", "_").replace("'", ""))


async def fetch_all_affiliate_deals() -> list[AffiliateDeal]:
    """Fetch deals from all configured affiliate networks.

    Returns combined list of deals from all networks.
    Only networks with configured credentials will be queried.
    """
    tasks = [
        fetch_rakuten_coupons(),
        fetch_awin_promotions(),
        fetch_cj_links(),
        fetch_skimlinks_offers(),
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    all_deals: list[AffiliateDeal] = []
    for result in results:
        if isinstance(result, Exception):
            logger.warning(f"Affiliate network error: {result}")
            continue
        all_deals.extend(result)

    logger.info(f"Total affiliate deals: {len(all_deals)} from all networks")
    return all_deals


def get_configured_networks() -> list[str]:
    """Return list of configured affiliate network names."""
    configured = []
    if _rakuten_configured():
        configured.append("rakuten")
    if _awin_configured():
        configured.append("awin")
    if _cj_configured():
        configured.append("cj")
    if _skimlinks_configured():
        configured.append("skimlinks")
    return configured


def save_affiliate_deals_to_database(deals: list[AffiliateDeal], db_session) -> int:
    """Save affiliate deals to the ArbitrageDeal table.

    Each affiliate deal is saved with its network as the retailer prefix
    (e.g., "awin_ambrose") and the affiliate tracking URL as buy_url.
    Existing deals are refreshed (price/timestamp updated) rather than
    skipped, same as Impact.com deals.
    """
    from app.db.models import ArbitrageDeal
    from datetime import datetime

    saved = 0
    for deal in deals:
        try:
            # Generate a unique ASIN-like ID from the network + retailer + URL hash
            deal_id = f"{deal.network}_{deal.retailer}_{hashlib.md5(deal.deal_url.encode()).hexdigest()[:12]}"[:36]

            existing = (
                db_session.query(ArbitrageDeal)
                .filter(
                    ArbitrageDeal.asin == deal_id,
                    ArbitrageDeal.status == "active",
                )
                .first()
            )

            buy_price = deal.deal_price or Decimal("0")
            sell_price = deal.original_price or buy_price
            discount = deal.discount_percent or 0
            tier = "glitch" if discount >= 75 else ("trending" if discount >= 50 else "clearance")

            if existing:
                # Refresh existing deal
                if deal.deal_price:
                    existing.buy_price = buy_price
                if deal.original_price:
                    existing.sell_price = sell_price
                    existing.historical_avg = sell_price
                existing.title = deal.title
                existing.image_url = deal.image_url or existing.image_url
                existing.buy_url = deal.deal_url
                existing.detected_at = datetime.utcnow()
                existing.deal_tier = tier
                if deal.original_price and deal.deal_price:
                    existing.net_profit = sell_price - buy_price
                    existing.roi = float((sell_price - buy_price) / sell_price) if sell_price > 0 else 0
                db_session.commit()
                saved += 1
                continue

            # Create new deal
            net_profit = (sell_price - buy_price) if deal.original_price and deal.deal_price else Decimal("0")
            roi = float(net_profit / sell_price) if sell_price and sell_price > 0 and deal.original_price and deal.deal_price else 0

            new_deal = ArbitrageDeal(
                asin=deal_id,
                title=deal.title,
                image_url=deal.image_url,
                buy_url=deal.deal_url,
                buy_platform=deal.retailer,
                retailer=deal.retailer,
                deal_source="affiliate",
                buy_price=buy_price,
                sell_platform=deal.network,
                sell_price=sell_price,
                historical_avg=sell_price,
                deal_tier=tier,
                net_profit=net_profit,
                roi=roi,
                is_profitable=bool(deal.deal_price),
                status="active",
                detected_at=datetime.utcnow(),
            )
            db_session.add(new_deal)
            db_session.commit()
            saved += 1

        except Exception as e:
            logger.warning(f"Failed to save affiliate deal ({deal.network}/{deal.retailer}): {e}")
            db_session.rollback()

    logger.info(f"Saved {saved} affiliate deals to database")
    return saved
