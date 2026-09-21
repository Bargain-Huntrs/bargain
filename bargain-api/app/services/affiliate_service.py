"""Affiliate link injection service.

Appends affiliate tracking parameters to retailer URLs so the platform
earns commission on qualifying purchases. Falls back to plain URLs if
affiliate IDs are not configured.
"""
import time
import urllib.parse
from typing import Optional

import httpx

from app.core.config import settings
from app.services.utm_service import add_utm_parameters

# Default UTM parameters applied to every affiliate link so clicks can be
# attributed back to BargainHuntrs regardless of which page generated them.
DEFAULT_UTM_SOURCE = "bargainhuntrs"
DEFAULT_UTM_MEDIUM = "referral"
DEFAULT_UTM_CAMPAIGN = "deal_click"

_AWIN_CACHE_TTL_SECONDS = 300
_awin_programmes_cache: Optional[list[dict]] = None
_awin_cache_timestamp: Optional[float] = None


def add_amazon_affiliate(url: str, asin: str = "") -> str:
    """Add Amazon Associates tag to an Amazon product URL."""
    if not settings.AMAZON_ASSOCIATES_TAG:
        return url
    if "tag=" in url:
        # Already has an affiliate tag — don't double-tag
        return url
    separator = "&" if "?" in url else "?"
    return f"{url}{separator}tag={settings.AMAZON_ASSOCIATES_TAG}"


def add_ebay_affiliate(url: str) -> str:
    """Add eBay Partner Network tracking to an eBay URL."""
    if not settings.EBAY_PARTNER_NETWORK_ID:
        return url
    if "campid=" in url:
        # Already has an eBay campaign ID — don't double-tag
        return url
    separator = "&" if "?" in url else "?"
    return f"{url}{separator}campid={settings.EBAY_PARTNER_NETWORK_ID}"


def add_walmart_affiliate(url: str) -> str:
    """Add Walmart affiliate tracking."""
    if not settings.WALMART_AFFILIATE_ID:
        return url
    if "affid=" in url:
        # Already has a Walmart affiliate ID — don't double-tag
        return url
    separator = "&" if "?" in url else "?"
    return f"{url}{separator}affid={settings.WALMART_AFFILIATE_ID}"


def add_target_affiliate(url: str) -> str:
    """Add Target affiliate tracking."""
    if not settings.TARGET_AFFILIATE_ID:
        return url
    if "affid=" in url:
        # Already has a Target affiliate ID — don't double-tag
        return url
    separator = "&" if "?" in url else "?"
    return f"{url}{separator}affid={settings.TARGET_AFFILIATE_ID}"


def add_bestbuy_affiliate(url: str) -> str:
    """Add Best Buy affiliate tracking."""
    if not settings.BESTBUY_AFFILIATE_ID:
        return url
    if "affid=" in url:
        # Already has a Best Buy affiliate ID — don't double-tag
        return url
    separator = "&" if "?" in url else "?"
    return f"{url}{separator}affid={settings.BESTBUY_AFFILIATE_ID}"


def _normalize_domain(domain: str) -> str:
    """Strip www and trailing slash from a domain for matching."""
    d = domain.lower().strip().rstrip("/")
    if d.startswith("www."):
        d = d[4:]
    return d


def _get_url_domain(url: str) -> str:
    """Extract normalized hostname from a URL."""
    try:
        parsed = urllib.parse.urlparse(url)
        return _normalize_domain(parsed.hostname or "")
    except Exception:
        return ""


def _load_awin_programmes() -> list[dict]:
    """Fetch and cache the Awin joined programmes list."""
    global _awin_programmes_cache, _awin_cache_timestamp

    token = getattr(settings, "AWIN_API_TOKEN", "")
    publisher_id = getattr(settings, "AWIN_PUBLISHER_ID", "")
    if not token or not publisher_id:
        return []

    now = time.time()
    if _awin_programmes_cache is not None and _awin_cache_timestamp and (
        now - _awin_cache_timestamp < _AWIN_CACHE_TTL_SECONDS
    ):
        return _awin_programmes_cache

    try:
        resp = httpx.get(
            f"https://api.awin.com/publishers/{publisher_id}/programmes",
            params={"accessToken": token, "relationship": "joined"},
            timeout=30.0,
        )
        if resp.status_code == 200:
            _awin_programmes_cache = resp.json()
            _awin_cache_timestamp = now
            return _awin_programmes_cache
    except Exception:
        pass

    return _awin_programmes_cache or []


def _find_awin_advertiser_id(url: str) -> Optional[int]:
    """Find the Awin advertiser ID whose domains match the URL."""
    target_domain = _get_url_domain(url)
    if not target_domain:
        return None

    programmes = _load_awin_programmes()
    for prog in programmes:
        prog_id = prog.get("id")
        if not prog_id:
            continue

        domains: set[str] = set()
        display_url = prog.get("displayUrl", "")
        if display_url:
            try:
                domains.add(_normalize_domain(urllib.parse.urlparse(display_url).hostname or ""))
            except Exception:
                pass

        for domain_entry in prog.get("validDomains", []):
            domain = domain_entry.get("domain", "") if isinstance(domain_entry, dict) else domain_entry
            if domain:
                domains.add(_normalize_domain(domain))

        if target_domain in domains:
            return int(prog_id)

    return None


def add_awin_affiliate(url: str) -> str:
    """Convert a URL into an Awin deeplink if the merchant is in a joined programme."""
    publisher_id = getattr(settings, "AWIN_PUBLISHER_ID", "")
    if not publisher_id:
        return url

    advertiser_id = _find_awin_advertiser_id(url)
    if not advertiser_id:
        return url

    encoded = urllib.parse.quote(url, safe="")
    return (
        f"https://www.awin1.com/cread.php?"
        f"awinmid={advertiser_id}&awinaffid={publisher_id}&p={encoded}"
    )


def detect_retailer(url: str) -> str:
    """Detect the retailer from a URL. Returns lowercase retailer name or ''."""
    if not url:
        return ""
    url_lower = url.lower()
    if "amazon." in url_lower:
        return "amazon"
    if "ebay." in url_lower:
        return "ebay"
    if "walmart." in url_lower:
        return "walmart"
    if "target." in url_lower:
        return "target"
    if "bestbuy." in url_lower or "best buy" in url_lower:
        return "bestbuy"
    return ""


def add_affiliate_tag(url: str, retailer: str = "", asin: str = "") -> str:
    """Auto-detect retailer from URL and apply the correct affiliate tag.

    Tries Impact.com affiliate links first (for supported retailers like
    Walmart, ADOR, Eufy, etc.), then falls back to direct affiliate tags
    (Amazon Associates, eBay Partner Network, etc.).

    Falls back to the plain URL when no affiliate ID is configured or the
    retailer is unsupported.
    """
    if not url:
        return url

    # Don't affiliate-tag deal aggregator URLs — they're not retailer sites
    aggregator_domains = ["slickdeals.net", "dansdeals.com", "techbargains.com",
                          "bensbargains.com", "dealnews.com"]
    url_lower = url.lower()
    if any(domain in url_lower for domain in aggregator_domains):
        return url

    detected = retailer.lower() if retailer else detect_retailer(url)

    # Try Impact.com first (covers Walmart, ADOR, Eufy, Lenovo, etc.)
    try:
        from app.services.impact_affiliate import add_impact_affiliate, is_impact_link
        # Already an Impact tracking link — return as-is so the deep link
        # isn't destroyed by re-wrapping or direct-tag appending.
        if is_impact_link(url):
            return url
        impact_url = add_impact_affiliate(url, detected)
        if impact_url != url:
            return impact_url
    except Exception:
        pass

    # Fall back to direct affiliate tags
    if detected == "amazon":
        return add_amazon_affiliate(url, asin)
    if detected == "ebay":
        return add_ebay_affiliate(url)
    if detected == "walmart":
        return add_walmart_affiliate(url)
    if detected == "target":
        return add_target_affiliate(url)
    if detected == "bestbuy":
        return add_bestbuy_affiliate(url)

    # Fall back to Awin for any other joined merchant
    awin_url = add_awin_affiliate(url)
    if awin_url != url:
        tagged = awin_url
    else:
        tagged = url

    # Ensure every outgoing affiliate link carries UTM tracking parameters.
    # Existing utm_source/utm_medium are preserved; utm_campaign is always set.
    return add_utm_parameters(
        tagged,
        DEFAULT_UTM_SOURCE,
        DEFAULT_UTM_MEDIUM,
        DEFAULT_UTM_CAMPAIGN,
    )
