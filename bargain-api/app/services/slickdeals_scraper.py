"""Slickdeals RSS Scraper.

Scrapes Slickdeals' frontpage RSS feed to find real deals posted by the
community. Slickdeals aggregates deals from multiple retailers (Amazon,
eBay, Walmart, Home Depot, etc.) and the RSS feed is publicly accessible.

Each deal in the feed includes:
- Title (with price and discount info)
- Link to the Slickdeals deal page
- Description (contains retailer name and original price)

We parse the title/description to extract:
- Product name
- Deal price
- Original price (if mentioned)
- Discount percentage
- Retailer name
- Product URL (if directly linked)
"""
import asyncio
import hashlib
import logging
import re
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Optional
from urllib.parse import urlparse, parse_qs

from bs4 import BeautifulSoup

from app.services.http_client import ScrapingClient
from app.services.affiliate_service import add_affiliate_tag
from app.services.scraper import _parse_price

logger = logging.getLogger(__name__)

SLICKDEALS_RSS_URL = "https://slickdeals.net/newsearch.php?mode=frontpage&rss=1"


@dataclass
class Slickdeal:
    """A deal parsed from Slickdeals RSS feed."""
    title: str
    deal_url: str  # Slickdeals deal page URL
    product_url: str  # Direct retailer URL (if extractable)
    deal_price: Optional[Decimal] = None
    original_price: Optional[Decimal] = None
    discount_percent: Optional[int] = None
    retailer: str = "unknown"
    image_url: Optional[str] = None
    description: str = ""
    posted_at: Optional[datetime] = None


# Mapping from retailer mentions to our internal retailer keys
_RETAILER_PATTERNS = [
    (r"amazon\.com|amazon", "amazon"),
    (r"ebay\.com|ebay", "ebay"),
    (r"walmart\.com|walmart", "walmart"),
    (r"homedepot\.com|home depot", "home_depot"),
    (r"lowes\.com|lowe'?s", "lowes"),
    (r"target\.com|target", "target"),
    (r"bestbuy\.com|best buy", "best_buy"),
    (r"newegg\.com|newegg", "newegg"),
    (r"costco\.com|costco", "costco"),
    (r"acehardware\.com|ace hardware", "ace_hardware"),
    (r"corsair\.com|corsair", "corsair"),
    (r"monoprice\.com|monoprice", "monoprice"),
    (r"bhphotovideo\.com|b&h", "bhphoto"),
    (r"adorama\.com|adorama", "adorama"),
    (r"staples\.com|staples", "staples"),
    (r"office\s*depot|officedepot", "office_depot"),
    (r"macy'?s|macys\.com", "macys"),
    (r"kohl'?s|kohls\.com", "kohls"),
    (r"wayfair\.com|wayfair", "wayfair"),
    (r"overstock\.com|overstock", "overstock"),
    (r"samsclub\.com|sam'?s club", "samsclub"),
    (r"jet\.com|jet\.com", "jet"),
    (r"aliexpress\.com|aliexpress", "aliexpress"),
    (r"banggood\.com|banggood", "banggood"),
    (r"geekbuying\.com|geekbuying", "geekbuying"),
    (r"woot\.com|woot", "woot"),
    (r"meritline\.com|meritline", "meritline"),
]


def _detect_retailer(text: str) -> str:
    """Detect retailer from text content."""
    text_lower = text.lower()
    for pattern, retailer in _RETAILER_PATTERNS:
        if re.search(pattern, text_lower):
            return retailer
    return "unknown"


def _extract_product_url(description: str) -> str:
    """Extract a direct product URL from the deal description."""
    # Slickdeals descriptions often contain direct links like:
    # "Amazon [amazon.com] has Product Name for $XX"
    # or links to the retailer directly
    urls = re.findall(r'https?://[^\s<>"\']+', description)
    for url in urls:
        # Skip slickdeals URLs and tracking URLs
        if "slickdeals.net" in url or "slickdeals" in url:
            continue
        return url
    return ""


def _extract_amazon_asin(description: str) -> Optional[str]:
    """Extract an Amazon ASIN from the deal description or URL."""
    # Look for /dp/ASIN pattern in any URL
    match = re.search(r'/dp/([A-Z0-9]{10})', description)
    if match:
        return match.group(1)
    # Look for /gp/product/ASIN
    match = re.search(r'/gp/product/([A-Z0-9]{10})', description)
    if match:
        return match.group(1)
    # Look for bare ASIN patterns (B0 followed by 8 alphanumeric chars)
    match = re.search(r'\b(B0[A-Z0-9]{8})\b', description)
    if match:
        return match.group(1)
    return None


def _construct_amazon_image_url(asin: str) -> str:
    """Construct an Amazon product image URL from an ASIN.

    Amazon stores product images at predictable URLs based on the ASIN.
    We use the legacy images-na.ssl-images-amazon.com P-images path, which is
    more forgiving for arbitrary ASIN-like identifiers than the media CDN.
    Note: This is a best-effort URL — the actual image ID varies per product.
    """
    return f"https://images-na.ssl-images-amazon.com/images/P/{asin}.01.LZZZZZZZ.jpg"


def _extract_prices(title: str, description: str) -> tuple[Optional[Decimal], Optional[Decimal]]:
    """Extract deal price and original price from title and description.

    Returns (deal_price, original_price).
    """
    text = f"{title} {description}"

    # Find all prices in the text
    prices = re.findall(r'\$(\d+\.?\d*)', text)
    if not prices:
        return None, None

    parsed_prices = [_parse_price(f"${p}") for p in prices]
    parsed_prices = [p for p in parsed_prices if p and p > 0]

    if not parsed_prices:
        return None, None

    # The first price is usually the deal price
    deal_price = parsed_prices[0]

    # Look for original/list price patterns
    original_patterns = [
        r'(?:was|regular|list|orig(?:inal)?|normally|retail)\s*:?\s*\$(\d+\.?\d*)',
        r'\$(\d+\.?\d*)\s*(?:was|regular|list)',
        r'(?:save|discount)\s+\$(\d+\.?\d*)',
        r'(\d+)%\s*off',
    ]

    original_price = None
    for pattern in original_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            val = match.group(1)
            if "%" in pattern:
                # It's a percentage — calculate original from deal price
                pct = Decimal(val)
                if pct > 0 and pct < 100:
                    original_price = (deal_price / (Decimal("100") - pct) * Decimal("100")).quantize(Decimal("0.01"))
            else:
                p = _parse_price(f"${val}")
                if p and p > deal_price:
                    original_price = p
            break

    # If we have multiple prices and the second is higher, it might be the original
    if not original_price and len(parsed_prices) >= 2:
        for p in parsed_prices[1:]:
            if p > deal_price:
                original_price = p
                break

    return deal_price, original_price


def _extract_discount_percent(text: str) -> Optional[int]:
    """Extract discount percentage from text."""
    match = re.search(r'(\d+)\s*%\s*off', text, re.IGNORECASE)
    if match:
        return int(match.group(1))
    return None


def _clean_title(title: str) -> str:
    """Clean the deal title — remove price suffixes and extra info."""
    # Remove trailing price info like "$4 + Free Shipping"
    title = re.sub(r'\s*\$\d+\.?\d*\s*.*$', '', title)
    # Remove "Prime Members:" prefix
    title = re.sub(r'^Prime\s*Members?:\s*', '', title, flags=re.IGNORECASE)
    # Remove "Select Accts:" prefix
    title = re.sub(r'^Select\s*Accts?:\s*', '', title, flags=re.IGNORECASE)
    # Remove "YMMV:" prefix
    title = re.sub(r'^YMMV:?\s*', '', title, flags=re.IGNORECASE)
    return title.strip()


def _parse_slickdeals_rss(html: str) -> list[Slickdeal]:
    """Parse the Slickdeals RSS XML feed."""
    soup = BeautifulSoup(html, "xml")
    deals: list[Slickdeal] = []

    for item in soup.find_all("item"):
        try:
            title_el = item.find("title")
            link_el = item.find("link")
            desc_el = item.find("description")
            date_el = item.find("pubDate")

            if not title_el or not link_el:
                continue

            title = title_el.get_text(strip=True)
            deal_url = link_el.get_text(strip=True)
            description = desc_el.get_text(strip=True) if desc_el else ""
            posted_at = None
            if date_el:
                try:
                    posted_at = datetime.strptime(
                        date_el.get_text(strip=True),
                        "%a, %d %b %Y %H:%M:%S %z",
                    ).replace(tzinfo=None)
                except (ValueError, TypeError):
                    pass

            # Extract prices
            deal_price, original_price = _extract_prices(title, description)

            # Extract discount percent
            discount_percent = _extract_discount_percent(f"{title} {description}")

            # If we have both prices, calculate discount
            if not discount_percent and deal_price and original_price and original_price > deal_price:
                discount_percent = int(round((1 - deal_price / original_price) * 100))

            # Detect retailer
            retailer = _detect_retailer(f"{title} {description}")

            # Extract product URL
            product_url = _extract_product_url(description)

            # Extract Amazon ASIN for image URL
            asin = _extract_amazon_asin(f"{description} {product_url}")
            image_url = _construct_amazon_image_url(asin) if asin else None

            # Clean title
            clean_title = _clean_title(title)

            deal = Slickdeal(
                title=clean_title[:500],
                deal_url=deal_url,
                product_url=product_url,
                deal_price=deal_price,
                original_price=original_price,
                discount_percent=discount_percent,
                retailer=retailer,
                image_url=image_url,
                description=description[:1000],
                posted_at=posted_at,
            )
            deals.append(deal)

        except Exception as e:
            logger.debug(f"Failed to parse Slickdeals item: {e}")
            continue

    return deals


async def scrape_slickdeals(min_discount: int = 40) -> list[Slickdeal]:
    """Scrape Slickdeals RSS feed for deals with at least min_discount% off.

    Args:
        min_discount: Minimum discount percentage to include.

    Returns:
        List of Slickdeal objects with >= min_discount% discount.
    """
    logger.info(f"Scraping Slickdeals RSS (min {min_discount}% discount)...")

    async with ScrapingClient(rate_limit_seconds=2.0) as client:
        html = await client.get_html(SLICKDEALS_RSS_URL, referer="https://slickdeals.net")
        if not html:
            logger.warning("Failed to fetch Slickdeals RSS feed")
            return []

    all_deals = _parse_slickdeals_rss(html)
    logger.info(f"Slickdeals: found {len(all_deals)} total deals")

    # Filter by discount percentage
    filtered = [d for d in all_deals if (d.discount_percent or 0) >= min_discount]
    logger.info(f"Slickdeals: {len(filtered)} deals with {min_discount}%+ discount")

    return filtered


def save_slickdeals_to_database(deals: list[Slickdeal], db_session) -> int:
    """Save Slickdeals deals to the ArbitrageDeal table."""
    from app.db.models import ArbitrageDeal
    from decimal import Decimal as D

    saved = 0
    for deal in deals:
        try:
            if not deal.deal_price:
                continue

            # Extract ASIN for Amazon deals
            asin = _extract_amazon_asin(f"{deal.description} {deal.product_url}")
            deal_id = asin or hashlib.md5(deal.deal_url.encode()).hexdigest()[:20]

            # Check if deal already exists
            existing = (
                db_session.query(ArbitrageDeal)
                .filter(
                    ArbitrageDeal.asin == deal_id,
                    ArbitrageDeal.status == "active",
                )
                .first()
            )
            if existing:
                continue  # Skip duplicates

            # Build the buy URL
            buy_url = deal.product_url or deal.deal_url
            if deal.retailer == "amazon" and asin:
                buy_url = add_affiliate_tag(
                    f"https://www.amazon.com/dp/{asin}", "amazon", asin
                )
            elif deal.retailer == "amazon" and buy_url:
                asin_match = re.search(r'/dp/([A-Z0-9]{10})', buy_url)
                if asin_match:
                    buy_url = add_affiliate_tag(buy_url, "amazon", asin_match.group(1))

            # Construct image URL if we don't have one but have an ASIN
            image_url = deal.image_url
            if not image_url and asin:
                image_url = _construct_amazon_image_url(asin)

            original_price = deal.original_price or deal.deal_price
            net_profit = original_price - deal.deal_price if original_price else D("0")
            roi = float(net_profit / original_price) if original_price and original_price > 0 else 0

            # Price errors (75%+ off) get the "glitch" tier
            tier = "glitch" if (deal.discount_percent or 0) >= 75 else "clearance"

            new_deal = ArbitrageDeal(
                asin=deal_id,
                title=deal.title,
                image_url=image_url,
                buy_url=buy_url,
                buy_platform=deal.retailer,
                retailer=deal.retailer,
                deal_source="online",
                buy_price=deal.deal_price,
                sell_platform="slickdeals",
                sell_price=original_price,
                historical_avg=original_price,
                deal_tier=tier,
                net_profit=net_profit,
                roi=roi,
                is_profitable=True,
                status="active",
                detected_at=deal.posted_at or datetime.utcnow(),
            )
            db_session.add(new_deal)
            db_session.commit()
            saved += 1

        except Exception as e:
            logger.warning(f"Failed to save Slickdeals deal: {e}")
            db_session.rollback()

    logger.info(f"Saved {saved} Slickdeals deals to database")
    return saved
