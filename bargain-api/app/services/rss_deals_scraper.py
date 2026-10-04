"""Multi-Source RSS Deal Scraper.

Scrapes multiple deal RSS feeds to find discounted products from various
retailers. Each feed is parsed for deal titles, prices, and discount info.

Sources:
- Slickdeals (frontpage RSS) — community-posted deals
- TechBargains (RSS) — tech-focused deals, 600+ items
- BensBargains (RSS) — general deals
- DansDeals (RSS) — deals and coupons

Each deal is parsed to extract:
- Product name
- Deal price
- Original price (if mentioned)
- Discount percentage
- Retailer name
- Product URL (if available)
"""
import asyncio
import hashlib
import logging
import re
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Optional

import httpx
from bs4 import BeautifulSoup

from app.services.scraper import _parse_price

logger = logging.getLogger(__name__)

# RSS feed sources
RSS_SOURCES = {
    "slickdeals": {
        "url": "https://slickdeals.net/newsearch.php?mode=frontpage&rss=1",
        "referer": "https://slickdeals.net",
    },
    "techbargains": {
        "url": "https://www.techbargains.com/rss.xml",
        "referer": "https://www.techbargains.com",
    },
    "bensbargains": {
        "url": "https://www.bensbargains.com/rss",
        "referer": "https://www.bensbargains.com",
    },
    "dansdeals": {
        "url": "https://www.dansdeals.com/feed/",
        "referer": "https://www.dansdeals.com",
    },
}


@dataclass
class RSSDeal:
    """A deal parsed from an RSS feed."""
    title: str
    deal_url: str
    product_url: str
    source: str  # which feed it came from
    deal_price: Optional[Decimal] = None
    original_price: Optional[Decimal] = None
    discount_percent: Optional[int] = None
    retailer: str = "unknown"
    image_url: Optional[str] = None
    description: str = ""
    posted_at: Optional[datetime] = None


# Retailer detection patterns
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
    (r"aliexpress\.com|aliexpress", "aliexpress"),
    (r"banggood\.com|banggood", "banggood"),
    (r"woot\.com|woot", "woot"),
    (r"verizon", "verizon"),
    (r"att\.com|at&t", "att"),
    (r"t-mobile|tmobile", "tmobile"),
    (r"apple\.com|apple store", "apple"),
    (r"microsoft\.com|microsoft store", "microsoft"),
    (r"sony\.com|sony store", "sony"),
    (r"dell\.com|dell", "dell"),
    (r"hp\.com|hewlett packard", "hp"),
    (r"lenovo\.com|lenovo", "lenovo"),
    (r"razer\.com|razer", "razer"),
    (r"logitech\.com|logitech", "logitech"),
    (r"anker\.com|anker", "anker"),
]


def _detect_retailer(text: str) -> str:
    """Detect retailer from text content."""
    text_lower = text.lower()
    for pattern, retailer in _RETAILER_PATTERNS:
        if re.search(pattern, text_lower):
            return retailer
    return "unknown"


def _extract_prices(text: str) -> tuple[Optional[Decimal], Optional[Decimal], Optional[int]]:
    """Extract deal price, original price, and discount percent from text.

    Returns (deal_price, original_price, discount_percent).
    """
    # Find all prices
    prices = re.findall(r'\$(\d+\.?\d*)', text)
    parsed = [_parse_price(f"${p}") for p in prices]
    parsed = [p for p in parsed if p and p > 0]

    if not parsed:
        return None, None, None

    deal_price = parsed[0]

    # Look for original/list price patterns
    original_price = None
    orig_patterns = [
        r'(?:was|regular|list|orig(?:inal)?|normally|retail)\s*:?\s*\$(\d+\.?\d*)',
        r'\$(\d+\.?\d*)\s*(?:was|regular|list)',
        r'(?:reg\.?)\s*\$(\d+\.?\d*)',
    ]
    for pattern in orig_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            p = _parse_price(f"${match.group(1)}")
            if p and p > deal_price:
                original_price = p
                break

    # If second price is higher, it might be original
    if not original_price and len(parsed) >= 2:
        for p in parsed[1:]:
            if p > deal_price:
                original_price = p
                break

    # Extract discount percent
    discount_percent = None
    pct_match = re.search(r'(\d+)\s*%\s*off', text, re.IGNORECASE)
    if pct_match:
        discount_percent = int(pct_match.group(1))
    elif original_price and deal_price and original_price > deal_price:
        discount_percent = int(round((1 - deal_price / original_price) * 100))

    return deal_price, original_price, discount_percent


def _extract_amazon_asin(text: str) -> Optional[str]:
    """Extract an Amazon ASIN from text."""
    match = re.search(r'/dp/([A-Z0-9]{10})', text)
    if match:
        return match.group(1)
    match = re.search(r'/gp/product/([A-Z0-9]{10})', text)
    if match:
        return match.group(1)
    match = re.search(r'\b(B0[A-Z0-9]{8})\b', text)
    if match:
        return match.group(1)
    return None


def _extract_product_url(description: str) -> str:
    """Extract a direct product URL from text."""
    urls = re.findall(r'https?://[^\s<>"\']+', description)
    for url in urls:
        if any(skip in url for skip in ["slickdeals.net", "techbargains.com", "bensbargains.com", "dansdeals.com"]):
            continue
        return url
    return ""


def _clean_title(title: str) -> str:
    """Clean deal title — remove price suffixes and prefixes."""
    title = re.sub(r'\s*\$\d+\.?\d*\s*.*$', '', title)
    title = re.sub(r'^Prime\s*Members?:\s*', '', title, flags=re.IGNORECASE)
    title = re.sub(r'^Select\s*Accts?:\s*', '', title, flags=re.IGNORECASE)
    title = re.sub(r'^YMMV:?\s*', '', title, flags=re.IGNORECASE)
    title = re.sub(r'^Deal:?\s*', '', title, flags=re.IGNORECASE)
    return title.strip()


async def _fetch_feed(source_name: str, source_config: dict) -> str:
    """Fetch an RSS feed."""
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        resp = await client.get(
            source_config["url"],
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                "Referer": source_config.get("referer", ""),
            },
        )
        if resp.status_code == 200:
            return resp.text
        logger.warning(f"{source_name}: HTTP {resp.status_code}")
        return ""


def _parse_rss_feed(html: str, source_name: str) -> list[RSSDeal]:
    """Parse an RSS XML feed into RSSDeal objects."""
    soup = BeautifulSoup(html, "xml")
    deals: list[RSSDeal] = []

    for item in soup.find_all("item"):
        try:
            title_el = item.find("title")
            link_el = item.find("link")
            desc_el = item.find("description")
            date_el = item.find("pubDate")

            if not title_el:
                continue

            title = title_el.get_text(strip=True)
            deal_url = link_el.get_text(strip=True) if link_el else ""
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

            # Extract prices and discount
            full_text = f"{title} {description}"
            deal_price, original_price, discount_percent = _extract_prices(full_text)

            # Detect retailer
            retailer = _detect_retailer(full_text)

            # Extract product URL
            product_url = _extract_product_url(description)

            # Extract ASIN for Amazon deals
            asin = _extract_amazon_asin(f"{description} {product_url}")
            image_url = (
                f"https://images-na.ssl-images-amazon.com/images/P/{asin}.01.LZZZZZZZ.jpg"
                if asin
                else None
            )

            # Clean title
            clean_title = _clean_title(title)

            deal = RSSDeal(
                title=clean_title[:500],
                deal_url=deal_url,
                product_url=product_url,
                source=source_name,
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
            logger.debug(f"Failed to parse {source_name} item: {e}")
            continue

    return deals


async def scrape_all_rss_feeds(min_discount: int = 40) -> list[RSSDeal]:
    """Scrape all RSS feeds and return deals with >= min_discount% off.

    Args:
        min_discount: Minimum discount percentage to include.

    Returns:
        List of RSSDeal objects with >= min_discount% discount.
    """
    logger.info(f"Scraping {len(RSS_SOURCES)} RSS feeds (min {min_discount}% discount)...")

    # Fetch all feeds concurrently
    tasks = [_fetch_feed(name, config) for name, config in RSS_SOURCES.items()]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    all_deals: list[RSSDeal] = []
    for (source_name, _), result in zip(RSS_SOURCES.items(), results):
        if isinstance(result, Exception):
            logger.warning(f"{source_name}: {result}")
            continue
        if not result:
            continue
        deals = _parse_rss_feed(result, source_name)
        logger.info(f"{source_name}: {len(deals)} deals parsed")
        all_deals.extend(deals)

    logger.info(f"Total: {len(all_deals)} deals from all feeds")

    # Filter by discount
    filtered = [d for d in all_deals if (d.discount_percent or 0) >= min_discount]
    logger.info(f"Filtered: {len(filtered)} deals with {min_discount}%+ discount")

    return filtered


def save_rss_deals_to_database(deals: list[RSSDeal], db_session) -> int:
    """Save RSS deals to the ArbitrageDeal table."""
    from app.db.models import ArbitrageDeal
    from app.services.affiliate_service import add_affiliate_tag
    from app.services.deal_scorer import calculate_deal_score
    from decimal import Decimal as D

    saved = 0
    for deal in deals:
        try:
            if not deal.deal_price:
                continue

            # Use ASIN as ID for Amazon deals, hash for others
            asin = _extract_amazon_asin(f"{deal.description} {deal.product_url}")
            deal_id = asin or hashlib.md5(deal.deal_url.encode()).hexdigest()[:20]

            # Check for duplicates
            existing = (
                db_session.query(ArbitrageDeal)
                .filter(
                    ArbitrageDeal.asin == deal_id,
                    ArbitrageDeal.status == "active",
                )
                .first()
            )
            if existing:
                continue

            # Build buy URL — apply affiliate tags for all retailers
            buy_url = deal.product_url or deal.deal_url
            if deal.retailer == "amazon" and asin:
                buy_url = add_affiliate_tag(
                    f"https://www.amazon.com/dp/{asin}", "amazon", asin
                )
            elif deal.product_url:
                # Use the actual product URL with affiliate tag
                buy_url = add_affiliate_tag(deal.product_url, deal.retailer)
            else:
                # Try to affiliate-tag the deal URL itself
                buy_url = add_affiliate_tag(deal.deal_url, deal.retailer)

            original_price = deal.original_price or deal.deal_price
            net_profit = original_price - deal.deal_price if original_price else D("0")
            roi = float(net_profit / original_price) if original_price and original_price > 0 else 0

            tier = "glitch" if (deal.discount_percent or 0) >= 75 else "clearance"

            new_deal = ArbitrageDeal(
                asin=deal_id,
                title=deal.title,
                image_url=deal.image_url,
                buy_url=buy_url,
                buy_platform=deal.retailer,
                retailer=deal.retailer,
                deal_source="online",
                buy_price=deal.deal_price,
                sell_platform=deal.source,
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
            new_deal.score = calculate_deal_score(new_deal)
            db_session.commit()
            saved += 1

        except Exception as e:
            logger.warning(f"Failed to save RSS deal: {e}")
            db_session.rollback()

    logger.info(f"Saved {saved} RSS deals to database")
    return saved
