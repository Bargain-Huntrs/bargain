"""Impact.com Affiliate Link Service.

Wraps retailer URLs with Impact.com affiliate tracking links so the
platform earns commission on qualifying purchases.

Uses the campaign data from impact_campaigns.json to match retailer
domains to Impact tracking links and generate deeplinks.
"""
import json
import logging
import os
import re
from urllib.parse import quote, urlparse

logger = logging.getLogger(__name__)

# Load campaign data
_campaigns = []
_campaigns_path = os.path.join(os.path.dirname(__file__), "..", "data", "impact_campaigns.json")
try:
    with open(_campaigns_path) as f:
        _campaigns = json.load(f)
    logger.info(f"Loaded {len(_campaigns)} Impact campaigns")
except Exception as e:
    logger.warning(f"Could not load impact_campaigns.json: {e}")


# Map of retailer names to common domains for matching
RETAILER_DOMAIN_MAP = {
    "amazon": ["amazon.com"],
    "walmart": ["walmart.com", "walmart.ca"],
    "ador": ["ador.com"],
    "eufy": ["eufy.com", "us.eufy.com", "us.eufylife.com"],
    "belkin": ["belkin.com"],
    "lenovo": ["lenovo.com"],
    "namecheap": ["namecheap.com"],
    "dhgate": ["dhgate.com"],
    "abebooks": ["abebooks.com"],
    "barkbox": ["barkbox.com"],
    "wine_express": ["wineexpress.com"],
    "sentrypc": ["sentrypc.com"],
    "invideo": ["invideo.io"],
    "golf_partner": ["golfpartnerusa.com"],
    "sesame_care": ["sesamecare.com"],
    "silver_cuisine": ["silvercuisine.com"],
    "natural_cycles": ["naturalcycles.com"],
    "coach_soak": ["coachsoak.com"],
    "gevi": ["gevi.com", "gevilife.com"],
    "boyd_sleep": ["nightairbeds.com"],
    "skystra": ["skystra.com"],
    "shopflys": ["shopflys.com"],
    "gearup": ["gearupbooster.com"],
    "ssls": ["ssls.com"],
    "arbiship": ["arbiship.com"],
}


def _domain_matches(url_domain: str, deeplink_domains: list[str]) -> bool:
    """Check if a URL domain matches any of the campaign's deeplink domains."""
    url_lower = url_domain.lower()
    for pattern in deeplink_domains:
        pattern = pattern.lower().strip()
        if pattern.startswith("*."):
            # Wildcard subdomain
            base = pattern[2:]
            if url_lower == base or url_lower.endswith("." + base):
                return True
        elif pattern.startswith("*") and pattern.endswith("*"):
            # Contains pattern
            base = pattern[1:-1]
            if base in url_lower:
                return True
        elif pattern.startswith("*"):
            base = pattern[1:]
            if url_lower.endswith(base):
                return True
        elif pattern.endswith("*"):
            base = pattern[:-1]
            if url_lower.startswith(base):
                return True
        elif pattern.startswith("."):
            if url_lower.endswith(pattern) or url_lower == pattern[1:]:
                return True
        else:
            if url_lower == pattern or url_lower.endswith("." + pattern):
                return True
    return False


def _find_campaign_for_url(url: str) -> dict | None:
    """Find the best matching Impact campaign for a given URL."""
    if not url or not _campaigns:
        return None

    try:
        domain = urlparse(url).netloc.lower().replace("www.", "")
    except Exception:
        return None

    # First try deeplink-enabled campaigns with matching domains
    for campaign in _campaigns:
        if not campaign.get("deeplinking"):
            continue
        domains = campaign.get("deeplink_domains", [])
        if _domain_matches(domain, domains):
            return campaign

    # Fall back to campaign URL domain match
    for campaign in _campaigns:
        campaign_url = campaign.get("campaign_url", "")
        if campaign_url:
            try:
                cdomain = urlparse(campaign_url).netloc.lower().replace("www.", "")
                if domain == cdomain or domain.endswith("." + cdomain):
                    return campaign
            except Exception:
                pass

    return None


def _find_campaign_for_retailer(retailer: str) -> dict | None:
    """Find an Impact campaign by retailer name."""
    retailer_lower = retailer.lower().strip()

    # Map retailer to domains
    domains = RETAILER_DOMAIN_MAP.get(retailer_lower, [])
    for domain in domains:
        for campaign in _campaigns:
            if not campaign.get("deeplinking"):
                continue
            if _domain_matches(domain, campaign.get("deeplink_domains", [])):
                return campaign

    # Try matching by campaign name
    for campaign in _campaigns:
        cname = campaign.get("campaign_name", "").lower()
        if retailer_lower in cname or cname in retailer_lower:
            return campaign

    return None


def create_impact_deeplink(tracking_link: str, destination_url: str) -> str:
    """Create a deeplink from an Impact tracking link and a destination URL.

    Impact deeplinks work by appending the destination URL as a parameter.
    The format is: {tracking_link}?u={destination_url}
    """
    if not tracking_link or not destination_url:
        return destination_url

    # If the tracking link already has query params, use & instead of ?
    separator = "&" if "?" in tracking_link else "?"
    return f"{tracking_link}{separator}u={quote(destination_url, safe='')}"


def _tracking_link_domains() -> set[str]:
    """Hostnames of all Impact tracking links in the campaign data."""
    domains: set[str] = set()
    for campaign in _campaigns:
        link = campaign.get("tracking_link", "")
        if link:
            try:
                host = urlparse(link).netloc.lower()
                if host:
                    domains.add(host)
            except Exception:
                pass
    return domains


_TRACKING_DOMAINS: set[str] | None = None


def is_impact_link(url: str) -> bool:
    """True if the URL is already an Impact affiliate tracking link.

    Covers every tracking domain in the campaign data (goto.walmart.com,
    *.sjv.io, *.7eer.net, branded Impact hosts, etc.) plus the generic
    Impact short-domain suffixes as a safety net.
    """
    global _TRACKING_DOMAINS
    if _TRACKING_DOMAINS is None:
        _TRACKING_DOMAINS = _tracking_link_domains()
    try:
        host = urlparse(url).netloc.lower()
    except Exception:
        return False
    if not host:
        return False
    if host in _TRACKING_DOMAINS:
        return True
    return any(
        host == d or host.endswith("." + d)
        for d in ("sjv.io", "7eer.net", "pxf.io", "evyy.net")
    )


def add_impact_affiliate(url: str, retailer: str = "") -> str:
    """Wrap a URL with an Impact.com affiliate tracking link.

    Args:
        url: The destination URL (e.g., a product page on a retailer's site)
        retailer: Optional retailer name for matching

    Returns:
        The URL wrapped with an Impact affiliate tracking link,
        or the original URL if no matching campaign is found.
    """
    if not url:
        return url

    # Already an Impact tracking link — don't double-wrap. Re-wrapping
    # nests the link inside another tracking URL and loses the deep
    # link, sending clicks to the merchant homepage instead of the product.
    if is_impact_link(url):
        return url

    # Try to find a matching campaign
    campaign = _find_campaign_for_url(url)
    if not campaign and retailer:
        campaign = _find_campaign_for_retailer(retailer)

    if not campaign:
        return url

    tracking_link = campaign.get("tracking_link", "")
    if not tracking_link:
        return url

    # If deeplinking is enabled, create a deeplink to the specific product
    if campaign.get("deeplinking"):
        deeplink = create_impact_deeplink(tracking_link, url)
        logger.info(f"Impact deeplink: {campaign['campaign_name']} -> {deeplink[:80]}")
        return deeplink

    # Otherwise just use the tracking link directly
    logger.info(f"Impact link: {campaign['campaign_name']} -> {tracking_link[:80]}")
    return tracking_link


def get_all_retailer_campaigns() -> list[dict]:
    """Get all campaigns that have tracking links — for display/debugging."""
    return _campaigns
