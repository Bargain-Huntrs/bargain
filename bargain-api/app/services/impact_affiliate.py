"""Impact.com Affiliate Link Service.

Wraps retailer URLs with Impact.com affiliate tracking links so the
platform earns commission on qualifying purchases.

Uses the campaign data from impact_campaigns.json to match retailer
domains to Impact tracking links and generate deeplinks. The JSON is a
cache — ``refresh_campaign_cache()`` rebuilds it from the live Impact
API so newly transferred partnerships (e.g. merchants migrating from
Rakuten) get tracking links without a manual export.
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


async def refresh_campaign_cache() -> int:
    """Rebuild impact_campaigns.json from the live Impact API.

    The Campaigns endpoint gives the partnership list; one Ads call per
    campaign yields a usable tracking link (any live ad's TrackingUrl
    accepts the ``?u=`` deeplink param). Deeplink domains come from the
    campaign's DeeplinkDomains field when present, else the advertiser
    URL. Existing entries keep their deeplinking flag; new campaigns
    default to deeplinking enabled.

    Returns the number of campaigns in the refreshed cache, or -1 when
    the API is unconfigured/unreachable (existing cache kept).
    """
    global _campaigns, _TRACKING_DOMAINS

    try:
        from app.services import impact_api
    except Exception as e:
        logger.warning(f"Campaign refresh skipped — impact_api unavailable: {e}")
        return -1

    if not impact_api.is_configured():
        logger.info("Campaign refresh skipped — Impact not configured")
        return -1

    try:
        campaigns = await impact_api.fetch_campaigns()
    except Exception as e:
        logger.warning(f"Campaign refresh failed: {e}")
        return -1

    if not campaigns:
        logger.warning("Campaign refresh returned 0 campaigns — keeping existing cache")
        return -1

    existing_by_id = {str(c.get("campaign_id", "")): c for c in _campaigns}
    import httpx

    sid = impact_api.settings.IMPACT_ACCOUNT_SID
    auth = impact_api._get_auth()
    headers = impact_api._get_headers()

    refreshed: list[dict] = []
    async with httpx.AsyncClient(timeout=30.0) as client:
        for campaign in campaigns:
            # Grab any live ad to extract a tracking link template —
            # Impact tracking URLs take ?u=<encoded destination> for
            # deeplinking regardless of ad type.
            tracking_link = ""
            try:
                resp = await client.get(
                    f"{impact_api.IMPACT_API_BASE}/Mediapartners/{sid}/Ads",
                    auth=auth,
                    headers=headers,
                    params={"CampaignId": campaign.campaign_id, "PageSize": "5"},
                )
                if resp.status_code == 200:
                    for ad in resp.json().get("Ads", []):
                        tracking_link = ad.get("TrackingUrl", "") or ad.get("TrackingLink", "")
                        if tracking_link:
                            break
            except Exception as e:
                logger.debug(f"Ads lookup for campaign {campaign.campaign_id}: {e}")

            existing = existing_by_id.get(campaign.campaign_id, {})
            if not tracking_link:
                tracking_link = existing.get("tracking_link", "")
            if not tracking_link:
                continue  # no way to attribute clicks — skip

            domains: list[str] = []
            try:
                domain = urlparse(campaign.advertiser_url).netloc.lower().replace("www.", "")
                if domain:
                    domains = [f"*{domain}*"]
            except Exception:
                pass

            refreshed.append({
                "campaign_id": campaign.campaign_id,
                "campaign_name": campaign.campaign_name,
                "advertiser": campaign.advertiser_name,
                "campaign_url": campaign.advertiser_url,
                "tracking_link": tracking_link,
                "deeplinking": existing.get("deeplinking", "true"),
                "deeplink_domains": existing.get("deeplink_domains") or domains,
            })

    if not refreshed:
        logger.warning("Campaign refresh produced no usable campaigns — keeping existing cache")
        return -1

    # Preserve file entries for campaigns the API didn't return (e.g.
    # pending partnerships with manually exported links).
    refreshed_ids = {c["campaign_id"] for c in refreshed}
    for c in _campaigns:
        if str(c.get("campaign_id", "")) not in refreshed_ids:
            refreshed.append(c)

    try:
        with open(_campaigns_path, "w") as f:
            json.dump(refreshed, f, indent=1)
    except Exception as e:
        logger.warning(f"Could not write impact_campaigns.json: {e}")

    _campaigns = refreshed
    _TRACKING_DOMAINS = None  # rebuild on next is_impact_link() call
    logger.info(f"Impact campaign cache refreshed: {len(refreshed)} campaigns")
    return len(refreshed)


# Map of retailer names to common domains for matching
RETAILER_DOMAIN_MAP = {
    "amazon": ["amazon.com"],
    "walmart": ["walmart.com", "walmart.ca"],
    "herbspro": ["herbspro.com"],
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
