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
from app.services.affiliate_config import get_affiliate_config

logger = logging.getLogger(__name__)

# NOTE: all network credentials are read through get_affiliate_config() —
# DB row in affiliate_settings wins, env var is the fallback. This lets
# tokens be seeded/rotated in Postgres without Render dashboard access.


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

# OAuth access-token cache (client_credentials grant — tokens live 3600s).
_rakuten_token_cache: dict = {"token": None, "expires_at": 0.0}


def _rakuten_configured() -> bool:
    """Rakuten needs a Developer Portal OAuth app — the legacy webservices
    token no longer authenticates api.linksynergy.com (returns 401
    'access token is missing' as a param and 'invalid_token' as a bearer)."""
    return (
        bool(get_affiliate_config("RAKUTEN_CLIENT_ID"))
        and bool(get_affiliate_config("RAKUTEN_CLIENT_SECRET"))
        and bool(get_affiliate_config("RAKUTEN_SITE_ID"))
    )


async def _rakuten_access_token(client: httpx.AsyncClient) -> Optional[str]:
    """Mint (or reuse) an OAuth bearer via client_credentials.

    POST /token with Basic auth (client_id:client_secret) and scope=<Site ID>.
    Returns the short-lived access_token; cached for its lifetime minus a
    safety buffer so the scheduler doesn't re-auth every call.
    """
    import base64
    import time

    cached = _rakuten_token_cache.get("token")
    if cached and time.time() < _rakuten_token_cache.get("expires_at", 0):
        return cached

    client_id = get_affiliate_config("RAKUTEN_CLIENT_ID")
    client_secret = get_affiliate_config("RAKUTEN_CLIENT_SECRET")
    site_id = get_affiliate_config("RAKUTEN_SITE_ID")

    basic = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    resp = await client.post(
        f"{RAKUTEN_API_BASE}/token",
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": f"Basic {basic}",
        },
        data={"grant_type": "client_credentials", "scope": site_id},
    )
    if resp.status_code != 200:
        logger.warning(f"Rakuten OAuth token error: {resp.status_code} {resp.text[:200]}")
        return None

    data = resp.json()
    token = data.get("access_token")
    if not token:
        logger.warning(f"Rakuten OAuth response missing access_token: {resp.text[:200]}")
        return None

    _rakuten_token_cache["token"] = token
    _rakuten_token_cache["expires_at"] = time.time() + int(data.get("expires_in", 3600)) - 120
    return token


async def fetch_rakuten_coupons(max_results: int = 100) -> list[AffiliateDeal]:
    """Fetch coupons/deals from Rakuten Advertising Coupon Feed API.

    Requires RAKUTEN_CLIENT_ID + RAKUTEN_CLIENT_SECRET + RAKUTEN_SITE_ID
    (Developer Portal OAuth app, scope = publisher Site ID).
    """
    if not _rakuten_configured():
        logger.info("Rakuten not configured — skipping")
        return []

    deals: list[AffiliateDeal] = []

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            token = await _rakuten_access_token(client)
            if not token:
                return []

            # Coupon Feed API — Bearer auth (the legacy ?token= param is dead).
            url = f"{RAKUTEN_API_BASE}/coupon/1.0"
            params = {
                "network": "1",  # US network
                "resultsperpage": str(max_results),
                "pagenumber": "1",
            }
            resp = await client.get(
                url,
                params=params,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/xml",
                },
            )

            if resp.status_code != 200:
                logger.warning(f"Rakuten API error: {resp.status_code}")
                return []

            # Rakuten returns XML — actual schema: <couponfeed><link>
            # with offerdescription/clickurl/couponcode/offerenddate/
            # advertisername children (no offername/url fields).
            # NOTE: bs4 Tags have no .findtext() (ElementTree API) — use
            # .find(name).get_text() via _txt or every link silently skips.
            soup = BeautifulSoup(resp.text, "xml")

            def _txt(tag, name: str) -> str:
                el = tag.find(name)
                return el.get_text() if el else ""

            for link in soup.find_all("link"):
                try:
                    title = _txt(link, "offername") or _txt(link, "offerdescription")
                    deal_url = _txt(link, "clickurl")
                    original_url = _txt(link, "url") or deal_url
                    promo_code = _txt(link, "couponcode")
                    image = _txt(link, "imageurl")
                    expires = _txt(link, "offerend") or _txt(link, "offerenddate")
                    advertiser = _txt(link, "advertisername")

                    if not title or not deal_url:
                        continue

                    retailer = _normalize_retailer(advertiser)
                    expires_at = None
                    if expires:
                        # Formats seen: 2026-11-20T23:00Z and 2026-11-20
                        try:
                            expires_at = datetime.fromisoformat(
                                expires.replace("Z", "+00:00")
                            ).replace(tzinfo=None)
                        except (ValueError, TypeError):
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
                        description=f"{advertiser} — {_txt(link, 'offerdescription')}"[:1000],
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
    return bool(get_affiliate_config("AWIN_API_TOKEN")) and bool(get_affiliate_config("AWIN_PUBLISHER_ID"))


async def fetch_awin_promotions(max_results: int = 200) -> list[AffiliateDeal]:
    """Fetch promotions/deals from Awin Offers API.

    Requires AWIN_API_TOKEN and AWIN_PUBLISHER_ID env vars.
    Uses POST /publisher/{publisherId}/promotions (Awin's correct endpoint).
    Fetches promotions from joined advertisers, filtering client-side
    since the API's advertiserIds filter doesn't reliably work.
    Region-filtered to AWIN_REGIONS (default US) — the feed is EU/IT-heavy
    but bargainhuntrs.com is a US site.
    """
    if not _awin_configured():
        logger.info("Awin not configured — skipping")
        return []

    token = get_affiliate_config("AWIN_API_TOKEN")
    publisher_id = get_affiliate_config("AWIN_PUBLISHER_ID")
    deals: list[AffiliateDeal] = []
    joined_passed = 0
    region_filtered = 0

    # Allowed advertiser regions — comma-separated ISO Alpha-2 codes,
    # DB-overridable like every other affiliate setting.
    allowed_regions = {
        r.strip().upper()
        for r in (get_affiliate_config("AWIN_REGIONS") or "US").split(",")
        if r.strip()
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # First, get joined advertiser IDs + their primary regions
            prog_url = f"{AWIN_API_BASE}/publishers/{publisher_id}/programmes"
            prog_params = {"accessToken": token, "relationship": "joined"}
            joined_ids: set[int] = set()
            advertiser_regions: dict[int, str] = {}
            try:
                prog_resp = await client.get(prog_url, params=prog_params)
                if prog_resp.status_code == 200:
                    programmes = prog_resp.json()
                    if isinstance(programmes, list):
                        joined_ids = {p.get("id") for p in programmes if p.get("id")}
                        for p in programmes:
                            region = (p.get("primaryRegion") or {}).get("countryCode")
                            if p.get("id") and region:
                                advertiser_regions[p["id"]] = region.upper()
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

                    # JOINED ONLY — owner directive 2026-11-06: non-joined
                    # advertisers can't pay commission, so their promos are
                    # filler, not deals. Skip them; the fix for low volume is
                    # joining more programmes, not widening the net.
                    if not advertiser_info.get("joined"):
                        continue
                    joined_passed += 1

                    # REGION FILTER — keep only promos whose advertiser's
                    # primaryRegion (from the joined-programmes call) is in
                    # AWIN_REGIONS. Unknown region (programmes fetch failed
                    # or advertiser missing) fails open so a lookup outage
                    # doesn't zero the feed.
                    adv_region = advertiser_regions.get(advertiser_id)
                    if adv_region and adv_region not in allowed_regions:
                        region_filtered += 1
                        continue

                    # Promo-level region targeting — when Awin scopes a
                    # promotion to specific regions (regions.all=false +
                    # regions.list), require overlap with AWIN_REGIONS.
                    promo_regions = promo.get("regions") or {}
                    if promo_regions.get("all") is False:
                        promo_region_codes = {
                            (r.get("countryCode") or "").upper()
                            for r in promo_regions.get("list") or []
                        }
                        if (
                            allowed_regions
                            and promo_region_codes
                            and promo_region_codes.isdisjoint(allowed_regions)
                        ):
                            region_filtered += 1
                            continue

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

    logger.info(
        f"Awin: {len(unique_deals)} promotions fetched (from {len(deals)} raw, deduped; "
        f"{joined_passed} joined, {region_filtered} dropped by region filter "
        f"{sorted(allowed_regions)})"
    )
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

    token = get_affiliate_config("AWIN_API_TOKEN")
    publisher_id = get_affiliate_config("AWIN_PUBLISHER_ID")

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
    return bool(get_affiliate_config("CJ_ACCESS_TOKEN")) and bool(get_affiliate_config("CJ_WEBSITE_ID"))


async def fetch_cj_links(max_results: int = 100) -> list[AffiliateDeal]:
    """Fetch promotional links from CJ Affiliate Link Search API.

    Requires CJ_ACCESS_TOKEN and CJ_WEBSITE_ID env vars.
    """
    if not _cj_configured():
        logger.info("CJ Affiliate not configured — skipping")
        return []

    token = get_affiliate_config("CJ_ACCESS_TOKEN")
    website_id = get_affiliate_config("CJ_WEBSITE_ID")
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
    return bool(get_affiliate_config("SKIMLINKS_PRODUCT_KEY"))


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
    product_key = get_affiliate_config("SKIMLINKS_PRODUCT_KEY")
    return f"https://go.skimresources.com?id={product_key}&url={quote(url, safe='')}"


# ============================================================
# Utility Functions
# ============================================================

_RETAILER_MAP = {
    "walmart": "walmart",
    "walmart.com": "walmart",
    "herbspro": "herbspro",
    "herbspro.com": "herbspro",
    "herbs pro": "herbspro",
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
