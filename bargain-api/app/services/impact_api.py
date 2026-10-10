"""Impact.com Affiliate API Integration.

Fetches deals, products, and promo codes from Impact.com brand partnerships.
Uses the Partner API v16 with HTTP Basic auth.

Env vars:
  IMPACT_ACCOUNT_SID — Account SID from Impact.com API settings
  IMPACT_AUTH_TOKEN  — Auth Token from Impact.com API settings

API Base: https://api.impact.com/Mediapartners/{AccountSID}/...
Version: 16 (set via IR-Version header or IrVersion query param)
"""
import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Optional
from urllib.parse import quote

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

IMPACT_API_BASE = "https://api.impact.com"
IMPACT_API_VERSION = "16"

# Locale path prefixes that indicate non-English product pages (ADOR etc.)
LOCALE_PATHS = ("/fr/", "/de/", "/es/", "/it/", "/nl/", "/pt/", "/ja/",
                "/ko/", "/zh/", "/ru/", "/ar/")

# Non-USD currency query params that indicate localized pricing
NON_USD_CURRENCIES = ("currency=EUR", "currency=GBP", "currency=CAD",
                      "currency=AUD", "currency=JPY", "currency=CNY",
                      "currency=INR", "currency=BRL", "currency=MXN")


def _is_localized_url(url: str) -> bool:
    """Return True if a product URL points to a non-English locale.

    ADOR (and similar Impact.com catalogs) return multiple localized URLs
    for the same product (e.g. /fr/, /de/). We only want English (/en/ or
    no locale prefix) and USD pricing.
    """
    if not url:
        return False
    url_lower = url.lower()
    # Non-USD currency param → localized
    if any(cur in url_lower for cur in NON_USD_CURRENCIES):
        return True
    # Locale path prefix (but not /en/) → localized
    if any(loc in url_lower for loc in LOCALE_PATHS):
        return True
    return False


# Common non-English product title keywords (German, French, Spanish, Italian)
# Used to filter out localized product names that slip past URL filtering
NON_ENGLISH_TITLE_KEYWORDS = (
    # German
    "damen", "weiblich", "herren", "männlich", "kinder", "kleid", "hose",
    "pullover", "jacke", "mantel", "rock", "bluse", "hemd", "schuhe",
    "stiefel", "sandalen", "tasche", "rucksack", "geldbörse", "schmuck",
    "kette", "ring", "ohrringe", "armband", "uhr", "sonnenbrille",
    "hut", "mütze", "schal", "handschuhe", "unterwäsche", "bikini",
    "bademode", "nachtwäsche", "hausanzug", "pyjama", "morgenmantel",
    # French
    "femme", "femmes", "homme", "hommes", "enfant", "enfants", "robe",
    "pantalon", "chemise", "chemisier", "veste", "manteau", "jupe",
    "blouse", "chaussures", "bottes", "sac", "camisole", "tissu",
    "ourlet", "ondulé", "décontractée", "décontracté", "élégant",
    "élégante", "sans", "manches", "manche", "col", "taille", "haute",
    "étroit", "large", "satin", "imprimé", "imprimée", "fleurs",
    "fleur", "vacances", "travail", "quotidien", "été", "printemps",
    "automne", "hiver", "coton", "lin", "laine", "soie", "cuir",
    "d'été", "d'automne", "d'hiver", "découpe", "bouton", "boutonné",
    "pas cher", "pour femme", "pour homme",
    # Spanish
    "mujer", "mujeres", "hombre", "hombres", "niño", "niña", "niños",
    "vestido", "vestidos", "pantalón", "pantalones", "camisa", "camisas",
    "chaqueta", "abrigo", "falda", "faldas", "blusa", "blusas",
    "zapatos", "bolsa", "barato", "para mujer", "para hombre",
    # Italian
    "donna", "donne", "uomo", "uomini", "bambino", "bambina",
    "vestito", "vestiti", "pantaloni", "camicia", "camicie",
    "giacca", "cappotto", "gonna", "gonne", "blusa", "bluse",
    "scarpe", "borsa", "borse", "economico",
)

# Strongly indicative non-English words — even 1 match means non-English
NON_ENGLISH_STRONG_KEYWORDS = (
    "femmes", "décontractée", "décontracté", "élégante", "élégant",
    "ourlet", "ondulé", "camisole", "imprimé", "imprimée",
    "echancré", "échancré", "rayures", "géométriques", "geometriques",
    "tissu", "pour femme", "pour homme", "d'été", "d'automne",
    "quotidien", "vacances", "printemps", "automne",
    "damen", "weiblich", "herren", "männlich",
    "mujeres", "para mujer", "para hombre",
    "donne", "uomini",
)


def _is_non_english_title(title: str) -> bool:
    """Return True if a product title appears to be non-English.

    Checks for common German/French/Spanish/Italian clothing keywords
    that ADOR and similar catalogs include in localized product names.
    A single strong keyword match is enough; otherwise 2+ regular matches.
    """
    if not title:
        return False
    title_lower = title.lower()
    # Strong keywords — even 1 match means non-English
    for kw in NON_ENGLISH_STRONG_KEYWORDS:
        if kw in title_lower:
            return True
    # Regular keywords — 2+ matches means likely non-English
    matches = sum(1 for kw in NON_ENGLISH_TITLE_KEYWORDS if kw in title_lower)
    return matches >= 2


def _is_configured() -> bool:
    return bool(getattr(settings, "IMPACT_ACCOUNT_SID", "")) and \
           bool(getattr(settings, "IMPACT_AUTH_TOKEN", ""))


def is_configured() -> bool:
    """Public alias for _is_configured."""
    return _is_configured()


def _get_auth():
    return (settings.IMPACT_ACCOUNT_SID, settings.IMPACT_AUTH_TOKEN)


def _get_headers():
    return {
        "Accept": "application/json",
        "IR-Version": IMPACT_API_VERSION,
    }


@dataclass
class ImpactCampaign:
    """A brand partnership campaign from Impact.com."""
    campaign_id: str
    campaign_name: str
    advertiser_name: str
    advertiser_url: str
    campaign_logo: str = ""
    campaign_description: str = ""


@dataclass
class ImpactProduct:
    """A product from an Impact.com catalog."""
    product_id: str
    name: str
    description: str
    url: str  # Affiliate tracking URL
    image_url: str
    price: Optional[Decimal] = None
    original_price: Optional[Decimal] = None
    brand: str = ""
    category: str = ""
    campaign_id: str = ""
    campaign_name: str = ""
    manufacturer: str = ""


@dataclass
class ImpactPromoCode:
    """A promo code / coupon from Impact.com Ads endpoint."""
    code: str
    retailer: str
    title: str
    description: Optional[str] = None
    discount_type: str = "percentage"  # percentage, fixed, free_shipping
    discount_value: Decimal = Decimal("0")
    min_purchase: Optional[Decimal] = None
    max_discount: Optional[Decimal] = None
    category: Optional[str] = None
    tracking_url: str = ""
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


async def fetch_campaigns() -> list[ImpactCampaign]:
    """Fetch all brand partnership campaigns."""
    if not _is_configured():
        logger.info("Impact.com not configured — skipping")
        return []

    sid = settings.IMPACT_ACCOUNT_SID
    auth = _get_auth()
    headers = _get_headers()
    campaigns: list[ImpactCampaign] = []

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            url = f"{IMPACT_API_BASE}/Mediapartners/{sid}/Campaigns"
            resp = await client.get(url, auth=auth, headers=headers, params={"PageSize": "100"})

            if resp.status_code != 200:
                logger.warning(f"Impact campaigns error: {resp.status_code}")
                return []

            data = resp.json()
            for c in data.get("Campaigns", []):
                campaigns.append(ImpactCampaign(
                    campaign_id=str(c.get("CampaignId", "")),
                    campaign_name=c.get("CampaignName", ""),
                    advertiser_name=c.get("AdvertiserName", ""),
                    advertiser_url=c.get("AdvertiserUrl", ""),
                    campaign_logo=c.get("CampaignLogoUri", ""),
                    campaign_description=c.get("CampaignDescription", ""),
                ))

    except Exception as e:
        logger.error(f"Impact campaigns fetch failed: {e}")

    logger.info(f"Impact: {len(campaigns)} campaigns")
    return campaigns


async def fetch_catalogs() -> list[dict]:
    """Fetch all product catalogs from Impact.com."""
    if not _is_configured():
        return []

    sid = settings.IMPACT_ACCOUNT_SID
    auth = _get_auth()
    headers = _get_headers()

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            url = f"{IMPACT_API_BASE}/Mediapartners/{sid}/Catalogs"
            resp = await client.get(url, auth=auth, headers=headers, params={"PageSize": "100"})

            if resp.status_code != 200:
                logger.warning(f"Impact catalogs error: {resp.status_code}")
                return []

            data = resp.json()
            catalogs = data.get("Catalogs", [])
            logger.info(f"Impact: {len(catalogs)} catalogs")
            return catalogs

    except Exception as e:
        logger.error(f"Impact catalogs fetch failed: {e}")
        return []


async def fetch_catalog_items(catalog_id: str, page_size: int = 50, page: int = 1) -> list[ImpactProduct]:
    """Fetch products from a specific catalog.

    Args:
        catalog_id: The Impact.com catalog ID.
        page_size: Number of items per page (max 100).
        page: Page number (1-based).

    Returns:
        List of ImpactProduct objects.
    """
    if not _is_configured():
        return []

    sid = settings.IMPACT_ACCOUNT_SID
    auth = _get_auth()
    headers = _get_headers()
    products: list[ImpactProduct] = []

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            url = f"{IMPACT_API_BASE}/Mediapartners/{sid}/Catalogs/{catalog_id}/Items"
            resp = await client.get(url, auth=auth, headers=headers, params={
                "PageSize": str(page_size),
                "Page": str(page),
            })

            if resp.status_code != 200:
                logger.warning(f"Impact catalog {catalog_id} items error: {resp.status_code}")
                return []

            data = resp.json()
            filtered_count = 0
            for item in data.get("Items", []):
                # Skip localized (non-English / non-USD) product URLs
                product_url = item.get("Url", "")
                if _is_localized_url(product_url):
                    filtered_count += 1
                    continue

                # Parse price (Impact.com uses CurrentPrice, not Price)
                price = None
                price_str = item.get("CurrentPrice", "") or item.get("Price", "")
                if price_str:
                    try:
                        price = Decimal(str(price_str))
                    except Exception:
                        pass

                # Parse original price
                original_price = None
                orig_str = item.get("OriginalPrice", "")
                if orig_str:
                    try:
                        original_price = Decimal(str(orig_str))
                    except Exception:
                        pass

                # If original price is higher, we have a discount
                if original_price and price and original_price > price:
                    pass  # Keep both — original_price > price means it's on sale
                elif original_price and price and original_price == price:
                    original_price = None  # No discount

                # Get image
                image_url = ""
                images = item.get("Images", [])
                if images and isinstance(images, list):
                    image_url = images[0].get("Url", "") if isinstance(images[0], dict) else ""
                if not image_url:
                    image_url = item.get("ImageUrl", "")

                products.append(ImpactProduct(
                    product_id=item.get("Id", ""),
                    name=item.get("Name", "")[:500],
                    description=item.get("Description", "")[:1000],
                    url=product_url,
                    image_url=image_url,
                    price=price,
                    original_price=original_price,
                    brand=item.get("Brand", ""),
                    category=item.get("Category", ""),
                    campaign_id=str(item.get("CampaignId", "")),
                    campaign_name=item.get("CampaignName", ""),
                    manufacturer=item.get("Manufacturer", ""),
                ))

            if filtered_count:
                logger.info(
                    f"Impact catalog {catalog_id}: filtered out {filtered_count} "
                    f"localized (non-English/non-USD) products"
                )

    except Exception as e:
        logger.error(f"Impact catalog items fetch failed: {e}")

    return products


async def fetch_discounted_products(min_discount: int = 20, max_products: int = 50) -> list[ImpactProduct]:
    """Fetch products with discounts from Impact.com catalogs.

    Scans smaller catalogs for products with sale prices, filtering to
    those with at least min_discount% off.

    Args:
        min_discount: Minimum discount percentage.
        max_products: Maximum number of products to return.

    Returns:
        List of discounted ImpactProduct objects.
    """
    if not _is_configured():
        return []

    # Get catalogs, prefer smaller ones (faster to scan)
    catalogs = await fetch_catalogs()
    if not catalogs:
        return []

    # Sort by number of items (smallest first) and skip huge catalogs
    sorted_catalogs = sorted(catalogs, key=lambda c: int(c.get("NumberOfItems", 0) or 0))
    # Include catalogs up to 50,000 items (still scannable in reasonable time)
    # Prioritize catalogs from different advertisers for variety
    target_catalogs = [c for c in sorted_catalogs if int(c.get("NumberOfItems", 0) or 0) <= 50000][:40]

    all_products: list[ImpactProduct] = []
    for catalog in target_catalogs:
        if len(all_products) >= max_products:
            break

        catalog_id = catalog.get("Id", "")
        if not catalog_id:
            continue

        items = await fetch_catalog_items(catalog_id, page_size=50)
        for item in items:
            if item.original_price and item.price and item.original_price > item.price:
                discount = int(round((1 - float(item.price) / float(item.original_price)) * 100))
                if discount >= min_discount:
                    all_products.append(item)
                    if len(all_products) >= max_products:
                        break

    logger.info(f"Impact: {len(all_products)} discounted products found")
    return all_products


async def fetch_promo_codes() -> list[ImpactPromoCode]:
    """Fetch promo codes / coupons from Impact.com Ads endpoint.

    The Ads endpoint returns promotional links including coupon codes
    for all approved campaigns.
    """
    if not _is_configured():
        logger.info("Impact.com not configured — no promo codes")
        return []

    sid = settings.IMPACT_ACCOUNT_SID
    auth = _get_auth()
    headers = _get_headers()
    promos: list[ImpactPromoCode] = []

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Fetch campaigns first to map campaign IDs to retailer names
            campaigns = await fetch_campaigns()
            campaign_map = {c.campaign_id: c for c in campaigns}

            # Fetch ads/promo links from all campaigns
            for campaign in campaigns:
                try:
                    url = f"{IMPACT_API_BASE}/Mediapartners/{sid}/Ads"
                    params = {
                        "CampaignId": campaign.campaign_id,
                        "PageSize": "50",
                    }
                    resp = await client.get(url, auth=auth, headers=headers, params=params)

                    if resp.status_code != 200:
                        continue

                    data = resp.json()
                    for ad in data.get("Ads", []):
                        # Only process promo/coupon type ads
                        ad_type = ad.get("Type", "").lower()
                        if ad_type not in ("promo", "coupon", "text link", "link"):
                            continue

                        code = ad.get("PromoCode", "") or ad.get("CouponCode", "") or ""
                        if not code:
                            continue

                        # Parse discount from title/description
                        title = ad.get("Name", "") or ad.get("Title", "")
                        description = ad.get("Description", "")
                        discount_type = "percentage"
                        discount_value = Decimal("0")

                        text = f"{title} {description}".lower()
                        if "free shipping" in text:
                            discount_type = "free_shipping"
                        elif "%" in text:
                            # Extract percentage
                            import re
                            pct_match = re.search(r'(\d+)\s*%', text)
                            if pct_match:
                                discount_type = "percentage"
                                discount_value = Decimal(pct_match.group(1))
                        elif "$" in text and "off" in text:
                            import re
                            dollar_match = re.search(r'\$(\d+(?:\.\d+)?)', text)
                            if dollar_match:
                                discount_type = "fixed"
                                discount_value = Decimal(dollar_match.group(1))

                        # Parse dates
                        start_date = None
                        end_date = None
                        try:
                            if ad.get("StartDate"):
                                start_date = datetime.fromisoformat(ad["StartDate"].replace("Z", "+00:00"))
                        except Exception:
                            pass
                        try:
                            if ad.get("EndDate"):
                                end_date = datetime.fromisoformat(ad["EndDate"].replace("Z", "+00:00"))
                        except Exception:
                            pass

                        retailer = _normalize_retailer(campaign.campaign_name)

                        promos.append(ImpactPromoCode(
                            code=code,
                            retailer=retailer,
                            title=title[:200],
                            description=description[:500] if description else None,
                            discount_type=discount_type,
                            discount_value=discount_value,
                            category=campaign.campaign_name,
                            tracking_url=ad.get("TrackingUrl", "") or ad.get("LandingUrl", ""),
                            start_date=start_date,
                            end_date=end_date,
                        ))
                except Exception as e:
                    logger.debug(f"Ads fetch for campaign {campaign.campaign_id}: {e}")
                    continue

    except Exception as e:
        logger.error(f"Impact promo codes fetch failed: {e}")

    logger.info(f"Impact: {len(promos)} promo codes found")
    return promos


async def fetch_walmart_deals(min_discount: int = 15, max_products: int = 100) -> list[ImpactProduct]:
    """Fetch discounted Walmart products specifically, bypassing the small-catalog cutoff.

    ``fetch_discounted_products`` only scans catalogs with <= 50,000 items so it can
    cheaply sample variety across many advertisers. Walmart's catalog has millions of
    SKUs, so it's silently excluded by that cutoff and effectively never surfaces
    through the generic path — this targets the Walmart campaign's catalog(s) directly
    and paginates through them instead of skipping them for being "too big".
    """
    if not _is_configured():
        return []

    campaigns = await fetch_campaigns()
    walmart_campaign_ids = {
        c.campaign_id for c in campaigns if "walmart" in c.campaign_name.lower()
    }
    if not walmart_campaign_ids:
        logger.info("Impact: no Walmart campaign found (program not joined/approved yet)")
        return []

    catalogs = await fetch_catalogs()
    walmart_catalog_ids = [
        c.get("Id") for c in catalogs
        if str(c.get("CampaignId", "")) in walmart_campaign_ids and c.get("Id")
    ]
    if not walmart_catalog_ids:
        logger.info("Impact: Walmart campaign has no product catalogs")
        return []

    discounted: list[ImpactProduct] = []
    max_pages = 20  # up to 1,000 items per catalog (50/page) before giving up
    for catalog_id in walmart_catalog_ids:
        page = 1
        while page <= max_pages and len(discounted) < max_products:
            items = await fetch_catalog_items(catalog_id, page_size=50, page=page)
            if not items:
                break
            for item in items:
                if _is_localized_url(item.url):
                    continue
                if not (item.original_price and item.price and item.original_price > item.price):
                    continue
                discount = int(round((1 - float(item.price) / float(item.original_price)) * 100))
                if discount >= min_discount:
                    discounted.append(item)
            page += 1

    logger.info(f"Impact Walmart: {len(discounted)} discounted products found")
    return discounted[:max_products]


async def fetch_all_impact_deals() -> list[dict]:
    """Fetch all deals from Impact.com — campaigns, products, and catalogs.

    Returns a list of deal dictionaries ready for the API.
    """
    if not _is_configured():
        return []

    products = await fetch_discounted_products(min_discount=20, max_products=50)

    # Walmart's catalog is too large to be picked up by the generic small-catalog
    # scan above, so it's fetched separately and merged in here.
    try:
        walmart_products = await fetch_walmart_deals(min_discount=15, max_products=50)
        seen_urls = {p.url for p in products}
        products.extend(p for p in walmart_products if p.url not in seen_urls)
    except Exception as e:
        logger.warning(f"Impact Walmart-specific fetch failed: {e}")

    deals = []
    filtered_count = 0
    for product in products:
        # Final safety filter: skip any localized URLs that slipped through
        if _is_localized_url(product.url):
            filtered_count += 1
            continue
        # Skip non-English product titles (German/French/Spanish/Italian)
        if _is_non_english_title(product.name):
            filtered_count += 1
            continue

        discount = 0
        if product.original_price and product.price and product.original_price > product.price:
            discount = int(round((1 - float(product.price) / float(product.original_price)) * 100))

        deals.append({
            "title": product.name,
            "deal_url": product.url,
            "image_url": product.image_url,
            "deal_price": float(product.price) if product.price else None,
            "original_price": float(product.original_price) if product.original_price else None,
            "discount_percent": discount,
            "retailer": _normalize_retailer(product.campaign_name),
            "network": "impact",
            "campaign_id": product.campaign_id,
        })

    if filtered_count:
        logger.info(
            f"Impact: filtered out {filtered_count} localized deals in fetch_all_impact_deals"
        )
    logger.info(f"Impact: returning {len(deals)} deals")
    return deals


def _normalize_retailer(campaign_name: str) -> str:
    """Normalize campaign name to retailer key."""
    name_lower = campaign_name.lower()
    if "walmart" in name_lower:
        return "walmart"
    if "herbspro" in name_lower or "herbs pro" in name_lower:
        return "herbspro"
    if "eufy" in name_lower:
        return "eufy"
    if "belkin" in name_lower:
        return "belkin"
    if "lenovo" in name_lower:
        return "lenovo"
    if "canva" in name_lower:
        return "canva"
    if "abebooks" in name_lower:
        return "abebooks"
    if "bark" in name_lower:
        return "barkbox"
    if "golf" in name_lower:
        return "golf_partner"
    if "umbra" in name_lower:
        return "umbra"
    if "wine" in name_lower:
        return "wine_express"
    if "namecheap" in name_lower:
        return "namecheap"
    if "envato" in name_lower:
        return "envato"
    if "invideo" in name_lower:
        return "invideo"
    if "ador" in name_lower or "lightinthebox" in name_lower:
        return "ador"
    if "bistromd" in name_lower or "bistro" in name_lower:
        return "bistromd"
    if "night air" in name_lower:
        return "night_air"
    if "ebrands" in name_lower:
        return "ebrands"
    if "digitrading" in name_lower:
        return "digitrading"
    if "sentrypc" in name_lower or "spytech" in name_lower:
        return "sentrypc"
    if "martinic" in name_lower:
        return "martinic"
    if "vetster" in name_lower:
        return "vetster"
    if "life360" in name_lower:
        return "life360"
    if "kin insurance" in name_lower:
        return "kin_insurance"
    if "sesame" in name_lower:
        return "sesame_care"
    if "because market" in name_lower:
        return "because_market"
    if "anthology" in name_lower:
        return "anthology"
    if "trends furniture" in name_lower or "25home" in name_lower:
        return "25home"
    if "zhuoshi" in name_lower or "diyustom" in name_lower:
        return "diyustom"
    if "luxe collective" in name_lower:
        return "luxe_collective"
    if "mx select" in name_lower or "mxfitness" in name_lower:
        return "mx_fitness"
    if "elpumps" in name_lower:
        return "elpumps"
    if "skystra" in name_lower:
        return "skystra"
    if "utsource" in name_lower:
        return "utsource"
    if "arbiship" in name_lower:
        return "arbiship"
    if "leadpages" in name_lower:
        return "leadpages"
    if "coinsmart" in name_lower:
        return "coinsmart"
    if "atlasvpn" in name_lower or "peakstar" in name_lower:
        return "atlasvpn"
    if "mylio" in name_lower:
        return "mylio"
    if "parzin" in name_lower:
        return "parzin"
    if "network solutions" in name_lower:
        return "network_solutions"
    if "web.com" in name_lower:
        return "webdotcom"
    if "prodege" in name_lower or "mypoints" in name_lower:
        return "mypoints"
    if "dun & bradstreet" in name_lower or "dnb" in name_lower:
        return "dun_bradstreet"
    if "points" in name_lower:
        return "points"
    return name_lower.replace(" ", "_").replace("affiliate", "").strip("_")[:30]
