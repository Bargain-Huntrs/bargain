"""
Arbitrage API Router — Phase 1

Endpoints for scanning, viewing, and managing arbitrage opportunities.
"""

from decimal import Decimal
import asyncio
import hashlib
import logging
import os
from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, status, Header
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import func, cast, Date
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timedelta

from app.db.session import get_db
from app.db.models import User, ArbitrageDeal, ScanRun, PriceSnapshot, AffiliateClick
from app.core.config import settings
from app.routers.auth import get_current_user
from app.services.affiliate_service import add_affiliate_tag, detect_retailer


def _verify_cron_secret(x_cron_secret: Optional[str] = Header(None)):
    """Protect public scrape endpoints with a shared secret.
    Set SCRAPE_CRON_SECRET env var and pass it as X-Cron-Secret header."""
    expected = os.getenv("SCRAPE_CRON_SECRET")
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Scrape endpoints are not configured. Set SCRAPE_CRON_SECRET.",
        )
    if x_cron_secret != expected:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing cron secret.",
        )
from app.services.arbitrage import (
    find_arbitrage_for_asin,
    scan_amazon_for_arbitrage,
    scan_niche,
    ArbitrageOpportunity,
)
from app.services.profit_calculator import Platform
from app.services.niche_service import get_niche, get_all_niches

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/arbitrage", tags=["arbitrage"])


class ScanRequest(BaseModel):
    asin: Optional[str] = None  # Single ASIN scan
    category: str = ""
    min_discount: float = 0.50  # 50% minimum discount
    max_price: float = 500.00
    limit: int = 20
    sell_platform: str = "ebay"


class DealResponse(BaseModel):
    id: str
    asin: str
    title: str
    image_url: Optional[str] = None
    buy_url: Optional[str] = None
    buy_price: float
    sell_price: float
    historical_avg: Optional[float] = None
    discrepancy: Optional[float] = None
    deal_tier: str
    retailer: Optional[str] = None
    deal_source: Optional[str] = None
    net_profit: Optional[float] = None
    roi: Optional[float] = None
    total_costs: Optional[float] = None
    platform_fee: Optional[float] = None
    bsr: Optional[int] = None
    category: Optional[str] = None
    niche: Optional[str] = None
    is_profitable: bool
    status: str
    detected_at: str
    # Auto-matched best coupon (if any applicable coupon exists)
    best_coupon: Optional[dict] = None  # {code, discount_type, discount_value, effective_price, savings}


@router.get("/deals/public", response_model=List[DealResponse])
async def list_public_deals(
    tier: Optional[str] = Query(None, description="Filter by deal tier"),
    niche: Optional[str] = Query(None, description="Filter by niche"),
    source: Optional[str] = Query(None, description="Filter by deal source: online, in_store, nearby"),
    limit: int = Query(20, le=200),
    offset: int = Query(0),
    db: Session = Depends(get_db),
):
    """Public deals feed — no authentication required.

    Returns active profitable deals for display on the homepage so
    non-logged-in visitors can browse and click affiliate links.
    Use source=nearby to filter for deals at retailers with physical stores.
    """
    query = db.query(ArbitrageDeal).filter(
        ArbitrageDeal.is_profitable == True,
        ArbitrageDeal.status == "active",
        ArbitrageDeal.historical_avg != None,
        ArbitrageDeal.buy_price > 0,
        # 20%+ discount pushed into SQL: buy_price <= historical_avg * 0.8
        ArbitrageDeal.buy_price <= ArbitrageDeal.historical_avg * Decimal("0.8"),
    )

    if tier:
        query = query.filter(ArbitrageDeal.deal_tier == tier)

    if niche:
        query = query.filter(ArbitrageDeal.niche == niche)

    if source == "online":
        query = query.filter(ArbitrageDeal.deal_source == "online")
    elif source == "in_store":
        query = query.filter(ArbitrageDeal.deal_source == "in_store")
    elif source == "nearby":
        # Nearby = deals from retailers with physical stores
        nearby_retailers = [
            "walmart", "target", "best_buy", "bestbuy", "home_depot", "homedepot",
            "lowes", "costco", "samsclub", "sams_club", "kohls", "macys",
            "office_depot", "office_max", "staples", "bed_bath_beyond",
            "petsmart", "petco", "academy", "dick_sporting_goods",
            "tj_maxx", "marshalls", "ross", "ulta", "sephora",
        ]
        query = query.filter(ArbitrageDeal.retailer.in_(nearby_retailers))

    # Bounded scan: dedup/language filters shrink the set, so fetch a
    # generous window instead of the whole table (was query.all() → 86s).
    query = query.order_by(ArbitrageDeal.net_profit.desc())
    all_deals = query.limit(min(offset + limit * 6, 600)).all()

    filtered = [d for d in all_deals if d.historical_avg and d.buy_price]

    # Filter out non-English (French/German/Spanish/Italian) product titles.
    # These slip in from ADOR's localized catalog entries despite scrape-time
    # filtering — older deals saved before the filter was added still show up.
    from app.services.impact_api import _is_non_english_title
    filtered = [d for d in filtered if not _is_non_english_title(d.title or "")]

    # Deduplicate by title (keep first occurrence — highest net_profit since sorted)
    # Use a normalized key: first 80 chars, lowercased, with extra whitespace removed
    seen_titles = set()
    unique_deals = []
    for d in filtered:
        title_key = " ".join((d.title or "")[:80].lower().split())
        if title_key and title_key not in seen_titles:
            seen_titles.add(title_key)
            unique_deals.append(d)

    deals = unique_deals[offset:offset + limit]
    # One coupon query for the whole page instead of N+1 per deal.
    best_coupons = _best_coupons_batch(deals, db)
    return [_deal_to_response(d, db=None, best_coupon=best_coupons.get(str(d.id))) for d in deals]
async def get_public_deal(
    deal_id: UUID = Path(..., description="Public deal ID"),
    db: Session = Depends(get_db),
):
    """Get a single public deal by ID for share previews. No auth required."""
    deal = db.query(ArbitrageDeal).filter(
        ArbitrageDeal.id == deal_id,
        ArbitrageDeal.is_profitable == True,
        ArbitrageDeal.status == "active",
        ArbitrageDeal.historical_avg != None,
        ArbitrageDeal.buy_price > 0,
    ).filter(
        ArbitrageDeal.historical_avg > ArbitrageDeal.buy_price
    ).first()
    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")
    return _deal_to_response(deal, db)


@router.post("/deals/scrape-amazon", response_model=dict)
async def scrape_amazon_deals_endpoint(
    max_deals: int = Query(50, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Scrape Amazon's Today's Deals page for real, currently-active deals.

    Requires authentication (admin/cron trigger). Fetches genuine discounted
    products from Amazon's Gold Box and /deals pages and stores them in the
    database so they appear on the homepage deals feed.
    """
    from app.services.amazon_deals_scraper import scrape_amazon_deals, save_deals_to_database

    try:
        deals = await scrape_amazon_deals(max_deals=max_deals)
        saved = save_deals_to_database(deals, db)
        return {
            "deals_found": len(deals),
            "deals_saved": saved,
            "status": "success",
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to scrape Amazon deals: {str(e)}",
        )


@router.post("/deals/scrape-amazon/public", response_model=dict)
async def scrape_amazon_deals_public(
    max_deals: int = Query(50, le=100),
    db: Session = Depends(get_db),
    _: None = Depends(_verify_cron_secret),
):
    """Public endpoint to scrape Amazon's Today's Deals — no auth required.

    Used for cron jobs and manual triggers to populate the deals feed.
    """
    from app.services.amazon_deals_scraper import scrape_amazon_deals, save_deals_to_database

    try:
        deals = await scrape_amazon_deals(max_deals=max_deals)
        saved = save_deals_to_database(deals, db)
        return {
            "deals_found": len(deals),
            "deals_saved": saved,
            "status": "success",
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to scrape Amazon deals: {str(e)}",
        )


@router.post("/deals/scrape-walmart/public", response_model=dict)
async def scrape_walmart_deals_public(
    max_deals: int = Query(50, le=100),
    min_discount: int = Query(15, ge=0, le=90),
    db: Session = Depends(get_db),
    _: None = Depends(_verify_cron_secret),
):
    """Public endpoint to scrape Walmart's deals hub — no auth required.

    Requires SCRAPER_PROXY_URL to be configured; Walmart drops connections
    from unproxied cloud/datacenter IPs outright, so this returns
    deals_found=0 (not an error) when no proxy is set.
    """
    from app.services.walmart_scraper import search_walmart_deals, save_walmart_deals_to_database

    try:
        deals = await search_walmart_deals(max_deals=max_deals, min_discount=min_discount, db_session=db)
        saved = save_walmart_deals_to_database(deals, db)
        return {
            "deals_found": len(deals),
            "deals_saved": saved,
            "status": "success",
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to scrape Walmart deals: {str(e)}",
        )


@router.post("/deals/scrape-slickdeals/public", response_model=dict)
async def scrape_slickdeals_public(
    min_discount: int = Query(40, ge=0, le=90),
    db: Session = Depends(get_db),
    _: None = Depends(_verify_cron_secret),
):
    """Public endpoint to scrape Slickdeals RSS — no auth required.

    Fetches community-posted deals from Slickdeals' frontpage RSS feed
    and stores those with >= min_discount% discount in the database.
    """
    from app.services.slickdeals_scraper import scrape_slickdeals, save_slickdeals_to_database

    try:
        deals = await scrape_slickdeals(min_discount=min_discount)
        saved = save_slickdeals_to_database(deals, db)
        return {
            "deals_found": len(deals),
            "deals_saved": saved,
            "status": "success",
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to scrape Slickdeals: {str(e)}",
        )


@router.post("/deals/scrape-all/public", response_model=dict)
async def scrape_all_deals_public(
    db: Session = Depends(get_db),
    _: None = Depends(_verify_cron_secret),
):
    """Public endpoint to scrape all deal sources — no auth required.

    Runs all scrapers (Amazon Gold Box + RSS feeds + affiliate networks)
    and combines the results into the deals database. Used for periodic cron jobs.
    """
    from app.services.amazon_deals_scraper import scrape_amazon_deals, save_deals_to_database
    from app.services.rss_deals_scraper import scrape_all_rss_feeds, save_rss_deals_to_database
    from app.services.affiliate_networks import fetch_all_affiliate_deals, get_configured_networks

    results = {"sources": {}, "total_saved": 0, "status": "success"}

    # Amazon Gold Box
    try:
        amazon_deals = await scrape_amazon_deals(max_deals=50)
        amazon_saved = save_deals_to_database(amazon_deals, db)
        results["sources"]["amazon"] = {
            "found": len(amazon_deals),
            "saved": amazon_saved,
        }
        results["total_saved"] += amazon_saved
    except Exception as e:
        results["sources"]["amazon"] = {"error": str(e)}

    # RSS feeds (Slickdeals, TechBargains, BensBargains, DansDeals)
    try:
        rss_deals = await scrape_all_rss_feeds(min_discount=40)
        rss_saved = save_rss_deals_to_database(rss_deals, db)
        results["sources"]["rss_feeds"] = {
            "found": len(rss_deals),
            "saved": rss_saved,
        }
        results["total_saved"] += rss_saved
    except Exception as e:
        results["sources"]["rss_feeds"] = {"error": str(e)}

    # Backfill missing deal images. This endpoint (update-images/public) has
    # existed for a while but was never actually wired into any automated
    # cycle before now, which is why the majority of deals had no image.
    try:
        from app.services.amazon_deals_scraper import update_missing_images

        images_updated = await update_missing_images(db, max_updates=15)
        results["images_updated"] = images_updated
    except Exception as e:
        results["images_updated_error"] = str(e)

    # Backfill placeholder images for deals still missing images after the
    # proxy-gated Amazon backfill above. This generates branded SVG
    # placeholders (served from /deals/placeholder/{id}) so the frontend
    # always has a visual to show — no external proxy needed.
    try:
        base_url = "https://api.bargainhuntrs.com/api/v1/arbitrage"
        missing = (
            db.query(ArbitrageDeal)
            .filter(
                ArbitrageDeal.status == "active",
                ArbitrageDeal.image_url.is_(None)
                | (ArbitrageDeal.image_url == "")
                | (ArbitrageDeal.image_url == "None")
                | (ArbitrageDeal.image_url == "null"),
            )
            .all()
        )
        for deal in missing:
            deal.image_url = f"{base_url}/deals/placeholder/{deal.id}"
        if missing:
            db.commit()
        results["placeholders_set"] = len(missing)
    except Exception as e:
        db.rollback()
        results["placeholders_error"] = str(e)

    # Walmart direct scrape (only does anything if SCRAPER_PROXY_URL is set —
    # see walmart_scraper.py docstring for why it's a hard requirement there)
    try:
        from app.services.walmart_scraper import search_walmart_deals, save_walmart_deals_to_database

        walmart_deals = await search_walmart_deals(max_deals=50, db_session=db)
        walmart_saved = save_walmart_deals_to_database(walmart_deals, db)
        results["sources"]["walmart"] = {
            "found": len(walmart_deals),
            "saved": walmart_saved,
        }
        results["total_saved"] += walmart_saved
    except Exception as e:
        results["sources"]["walmart"] = {"error": str(e)}

    # Affiliate networks (only if configured)
    configured = get_configured_networks()
    if configured:
        try:
            from app.services.affiliate_networks import save_affiliate_deals_to_database

            affiliate_deals = await fetch_all_affiliate_deals()
            affiliate_saved = save_affiliate_deals_to_database(affiliate_deals, db)
            results["sources"]["affiliate_networks"] = {
                "configured": configured,
                "found": len(affiliate_deals),
                "saved": affiliate_saved,
            }
            results["total_saved"] += affiliate_saved
        except Exception as e:
            results["sources"]["affiliate_networks"] = {"error": str(e)}
    else:
        results["sources"]["affiliate_networks"] = {
            "configured": [],
            "message": "No affiliate networks configured. Sign up at Rakuten, Awin, or CJ Affiliate."
        }

    # Impact.com products (if configured)
    from app.services.impact_api import fetch_all_impact_deals, _is_configured as impact_configured
    if impact_configured():
        try:
            impact_deals = await fetch_all_impact_deals()
            impact_saved = 0
            impact_errors = 0
            for deal in impact_deals:
                try:
                    if not deal.get("deal_price") or not deal.get("title"):
                        continue

                    deal_id = f"impact_{deal.get('campaign_id', '')}_{hashlib.md5(deal.get('title', '').encode()).hexdigest()[:12]}"[:36]

                    orig = deal.get("original_price") or 0
                    buy = deal.get("deal_price") or 0
                    if not buy or buy <= 0:
                        continue

                    tier = "glitch" if (deal.get("discount_percent", 0) or 0) >= 75 else "clearance"

                    # Refresh existing deals instead of skipping them — previously
                    # a re-scraped Impact product was ignored entirely once first
                    # inserted, so its price/timestamp froze forever even as the
                    # actual price changed or the deal went stale.
                    existing = db.query(ArbitrageDeal).filter(
                        ArbitrageDeal.asin == deal_id,
                        ArbitrageDeal.status == "active",
                    ).first()
                    if existing:
                        existing.buy_price = buy
                        existing.sell_price = orig if orig else buy
                        existing.historical_avg = orig if orig else buy
                        existing.image_url = deal.get("image_url") or existing.image_url
                        existing.deal_tier = tier
                        existing.net_profit = (orig - buy) if orig else 0
                        existing.roi = float((orig - buy) / orig) if orig and orig > 0 else 0
                        existing.detected_at = datetime.utcnow()
                        db.commit()
                        impact_saved += 1
                        continue

                    new_deal = ArbitrageDeal(
                        asin=deal_id,
                        title=deal.get("title", "")[:500],
                        image_url=deal.get("image_url"),
                        buy_url=deal.get("deal_url"),
                        buy_platform=deal.get("retailer", "unknown"),
                        retailer=deal.get("retailer", "unknown"),
                        deal_source="online",
                        buy_price=buy,
                        sell_platform="impact",
                        sell_price=orig if orig else buy,
                        historical_avg=orig if orig else buy,
                        deal_tier=tier,
                        net_profit=(orig - buy) if orig else 0,
                        roi=float((orig - buy) / orig) if orig and orig > 0 else 0,
                        is_profitable=True,
                        status="active",
                        detected_at=datetime.utcnow(),
                    )
                    db.add(new_deal)
                    db.commit()
                    impact_saved += 1
                except Exception as e:
                    db.rollback()
                    impact_errors += 1
                    if impact_errors <= 3:
                        logger.warning(f"Failed to save Impact deal: {e}")

            results["sources"]["impact"] = {
                "found": len(impact_deals),
                "saved": impact_saved,
                "errors": impact_errors,
            }
            results["total_saved"] += impact_saved
        except Exception as e:
            results["sources"]["impact"] = {"error": str(e)}

    # Expire stale deals. Deals that were never posted expire after 48h;
    # deals that WERE posted are otherwise exempt from expiration forever
    # (see scheduler.py), so without this a posted deal's stale price could
    # sit "active" on the public feed indefinitely. This endpoint is the
    # most reliably-triggered path in production (via the buffer-poster
    # GitHub Action cron), so the cleanup lives here too, not just in the
    # in-process scheduler loop which only runs while the dyno is awake.
    try:
        unposted_cutoff = datetime.utcnow() - timedelta(hours=48)
        unposted_expired = db.query(ArbitrageDeal).filter(
            ArbitrageDeal.status == "active",
            ArbitrageDeal.alerted_at == None,
            ArbitrageDeal.detected_at < unposted_cutoff,
        ).update({ArbitrageDeal.status: "expired"}, synchronize_session=False)

        stale_cutoff = datetime.utcnow() - timedelta(days=7)
        stale_expired = db.query(ArbitrageDeal).filter(
            ArbitrageDeal.status == "active",
            ArbitrageDeal.detected_at < stale_cutoff,
        ).update({ArbitrageDeal.status: "expired"}, synchronize_session=False)

        # Archive dead deals (expired/rejected, or alerted >7d) — kept 90
        # days for dedup/metrics, then hard-deleted.
        archive_cutoff = datetime.utcnow() - timedelta(days=7)
        archived = db.query(ArbitrageDeal).filter(
            ArbitrageDeal.archived_at == None,
            (
                ArbitrageDeal.status.in_(["expired", "rejected"])
                | (
                    (ArbitrageDeal.status == "alerted")
                    & (ArbitrageDeal.detected_at < archive_cutoff)
                )
            ),
        ).update(
            {
                ArbitrageDeal.status: "archived",
                ArbitrageDeal.archived_at: datetime.utcnow(),
            },
            synchronize_session=False,
        )

        purge_cutoff = datetime.utcnow() - timedelta(days=90)
        purged = db.query(ArbitrageDeal).filter(
            ArbitrageDeal.status == "archived",
            ArbitrageDeal.archived_at != None,
            ArbitrageDeal.archived_at < purge_cutoff,
        ).delete(synchronize_session=False)

        if unposted_expired or stale_expired or archived or purged:
            db.commit()
        results["expired"] = {"unposted": unposted_expired, "stale": stale_expired}
        results["archived"] = archived
        results["purged"] = purged
    except Exception as e:
        db.rollback()
        results["expire_error"] = str(e)

    # Auto-post new deals to X via Make.com (if configured)
    from app.services.x_poster import is_configured as x_configured
    if x_configured():
        try:
            # Find deals not yet posted to X
            new_deals = (
                db.query(ArbitrageDeal)
                .filter(
                    ArbitrageDeal.status == "active",
                    ArbitrageDeal.is_profitable == True,
                    ArbitrageDeal.alerted_at == None,
                )
                .order_by(ArbitrageDeal.detected_at.desc())
                .limit(settings.BUFFER_POSTS_PER_WINDOW)
                .all()
            )
            if new_deals:
                from app.services.x_poster import post_deal_to_x
                posted = 0
                for deal in new_deals:
                    discount = 0
                    if deal.historical_avg and deal.historical_avg > deal.buy_price:
                        discount = int(round((1 - float(deal.buy_price) / float(deal.historical_avg)) * 100))
                    result = await post_deal_to_x(
                        title=deal.title,
                        deal_price=float(deal.buy_price),
                        original_price=float(deal.historical_avg) if deal.historical_avg else None,
                        discount_percent=discount,
                        retailer=getattr(deal, "retailer", None) or "amazon",
                        deal_url=deal.buy_url or "",
                        deal_tier=deal.deal_tier,
                        image_url=deal.image_url,
                    )
                    if result.get("status") == "success":
                        posted += 1
                        deal.alerted_at = datetime.utcnow()
                        db.commit()
                    # Capture per-channel details for the first post for diagnostics
                    if "buffer_details" not in results:
                        results["buffer_details"] = {
                            "status": result.get("status"),
                            "channels_posted": result.get("channels_posted", 0),
                            "channels_failed": result.get("channels_failed", 0),
                            "error": result.get("error"),
                        }
                results["x_posted"] = posted
            else:
                results["x_posted"] = 0
        except Exception as e:
            results["x_posted"] = 0
            results["x_error"] = str(e)

    return results


@router.post("/deals/test-buffer/public", response_model=dict)
async def test_buffer_post_public(
    db: Session = Depends(get_db),
):
    """Test Buffer posting to all configured channels — no auth required.

    Picks the most recent active deal and attempts to post it to all
    configured Buffer channels (X, Instagram, Facebook). Returns the
    per-channel result so you can see which channels are working.
    Does NOT mark the deal as alerted.
    """
    from app.services.x_poster import post_deal_to_x, is_configured, _get_all_channel_ids

    if not is_configured():
        return {
            "status": "error",
            "error": "BUFFER_API_KEY or BUFFER_CHANNEL_ID not set",
            "configured_channels": _get_all_channel_ids(),
        }

    deal = (
        db.query(ArbitrageDeal)
        .filter(
            ArbitrageDeal.status == "active",
            ArbitrageDeal.is_profitable == True,
        )
        .order_by(ArbitrageDeal.detected_at.desc())
        .first()
    )
    if not deal:
        return {"status": "error", "error": "No active deals to test with"}

    discount = 0
    if deal.historical_avg and deal.historical_avg > deal.buy_price:
        discount = int(round((1 - float(deal.buy_price) / float(deal.historical_avg) * 100)))

    result = await post_deal_to_x(
        title=deal.title,
        deal_price=float(deal.buy_price),
        original_price=float(deal.historical_avg) if deal.historical_avg else None,
        discount_percent=discount,
        retailer=getattr(deal, "retailer", None) or "amazon",
        deal_url=deal.buy_url or "",
        deal_tier=deal.deal_tier,
        image_url=deal.image_url,
    )

    return {
        "status": result.get("status"),
        "channels_posted": result.get("channels_posted", 0),
        "channels_failed": result.get("channels_failed", 0),
        "error": result.get("error"),
        "configured_channel_count": len(_get_all_channel_ids()),
        "deal_used": str(deal.id),
        "tweet_text": result.get("tweet_text", "")[:200],
    }


@router.post("/deals/test-social/public", response_model=dict)
async def test_social_posting_public(
    db: Session = Depends(get_db),
):
    """Test all direct social posting channels — no auth required.

    Tests X direct API, Reddit, and Discord webhook posting using
    the most recent active deal. Returns per-channel results.
    Does NOT mark the deal as alerted.
    """
    from app.services import x_direct_poster, reddit_poster, discord_poster, pinterest_poster

    deal = (
        db.query(ArbitrageDeal)
        .filter(
            ArbitrageDeal.status == "active",
            ArbitrageDeal.is_profitable == True,
        )
        .order_by(ArbitrageDeal.detected_at.desc())
        .first()
    )
    if not deal:
        return {"status": "error", "error": "No active deals to test with"}

    discount = 0
    if deal.historical_avg and deal.historical_avg > deal.buy_price:
        discount = int(round((1 - float(deal.buy_price) / float(deal.historical_avg)) * 100))

    deal_kwargs = {
        "title": deal.title,
        "deal_price": float(deal.buy_price),
        "original_price": float(deal.historical_avg) if deal.historical_avg else None,
        "discount_percent": discount,
        "retailer": getattr(deal, "retailer", None) or "amazon",
        "deal_url": deal.buy_url or "",
        "image_url": deal.image_url,
        "deal_tier": deal.deal_tier,
    }

    results: dict = {"deal_used": str(deal.id), "channels": {}}

    # X direct
    if x_direct_poster.is_configured():
        x_result = await x_direct_poster.post_deal_to_x_direct(**deal_kwargs)
        results["channels"]["x_direct"] = x_result
    else:
        results["channels"]["x_direct"] = {"status": "skipped", "error": "Not configured"}

    # Reddit
    if reddit_poster.is_configured():
        reddit_result = await reddit_poster.post_deal_to_reddit(**deal_kwargs)
        results["channels"]["reddit"] = reddit_result
    else:
        results["channels"]["reddit"] = {"status": "skipped", "error": "Not configured"}

    # Discord
    if discord_poster.is_configured():
        discord_result = await discord_poster.post_deal_to_discord(**deal_kwargs)
        results["channels"]["discord"] = discord_result
    else:
        results["channels"]["discord"] = {"status": "skipped", "error": "Not configured"}

    # Pinterest
    if pinterest_poster.is_configured():
        pinterest_result = await pinterest_poster.post_deal_to_pinterest(**deal_kwargs)
        results["channels"]["pinterest"] = pinterest_result
    else:
        results["channels"]["pinterest"] = {"status": "skipped", "error": "Not configured"}

    # Summary
    posted = sum(1 for v in results["channels"].values() if v.get("status") == "success")
    failed = sum(1 for v in results["channels"].values() if v.get("status") == "error")
    skipped = sum(1 for v in results["channels"].values() if v.get("status") == "skipped")
    results["summary"] = {
        "posted": posted,
        "failed": failed,
        "skipped": skipped,
    }

    return results


@router.post("/deals/update-images/public", response_model=dict)
async def update_deal_images_public(
    max_updates: int = Query(10, le=20),
    db: Session = Depends(get_db),
):
    """Public endpoint to fetch missing deal images — no auth required.

    Iterates through active deals without images and fetches them
    from Amazon product pages. Rate-limited to avoid blocking.
    Keeps max_updates low to avoid Render timeout.
    """
    from app.services.amazon_deals_scraper import update_missing_images

    try:
        updated = await update_missing_images(db, max_updates=max_updates)
        return {
            "images_updated": updated,
            "status": "success",
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update images: {str(e)}",
        )



@router.get("/deals/placeholder/{deal_id}")
async def get_deal_placeholder_image(
    deal_id: str,
    db: Session = Depends(get_db),
):
    """Generate a branded SVG placeholder image for a deal.

    Used as a fallback image_url for deals that don't have a real product
    image. Returns an SVG with the deal title, price, and BargainHuntrs
    branding — no external requests or proxy needed.
    """
    from app.db.models import ArbitrageDeal

    deal = db.query(ArbitrageDeal).filter(ArbitrageDeal.id == deal_id).first()
    if not deal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deal not found",
        )

    title = (deal.title or "Deal")[:60]
    price = f"${deal.buy_price}" if deal.buy_price else ""
    discount = ""
    if deal.historical_avg and deal.buy_price and deal.historical_avg > deal.buy_price:
        pct = int(round((1 - float(deal.buy_price) / float(deal.historical_avg)) * 100))
        if pct > 0:
            discount = f"{pct}% OFF"

    # Truncate title for display
    display_title = title if len(title) <= 40 else title[:37] + "..."

    # Pick a gradient based on deal tier
    tier = deal.deal_tier or "clearance"
    gradients = {
        "glitch": ("#7c3aed", "#ec4899"),
        "trending": ("#f59e0b", "#ef4444"),
        "clearance": ("#10b981", "#3b82f6"),
    }
    c1, c2 = gradients.get(tier, gradients["clearance"])

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:{c1}"/>
      <stop offset="100%" style="stop-color:{c2}"/>
    </linearGradient>
  </defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <text x="200" y="180" font-family="system-ui,sans-serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">{price}</text>
  <text x="200" y="220" font-family="system-ui,sans-serif" font-size="20" font-weight="bold" fill="white" fill-opacity="0.9" text-anchor="middle" dominant-baseline="middle">{discount}</text>
  <text x="200" y="300" font-family="system-ui,sans-serif" font-size="14" fill="white" fill-opacity="0.85" text-anchor="middle" dominant-baseline="middle">{display_title}</text>
  <text x="200" y="370" font-family="system-ui,sans-serif" font-size="12" font-weight="bold" fill="white" fill-opacity="0.6" text-anchor="middle">BargainHuntrs</text>
</svg>"""

    from fastapi import Response
    return Response(content=svg, media_type="image/svg+xml", headers={
        "Cache-Control": "public, max-age=86400",
    })


@router.post("/deals/backfill-placeholders/public", response_model=dict)
async def backfill_placeholder_images_public(
    db: Session = Depends(get_db),
    max_updates: int = Query(500, le=2000),
):
    """Set placeholder image URLs for active deals missing images — no auth.

    Generates a data-URI SVG placeholder for each deal without an image_url
    and saves it to the database. This runs once to backfill existing deals;
    new deals should get real images from the scraper. No proxy needed.
    """
    from app.db.models import ArbitrageDeal
    import urllib.parse

    deals_without_images = (
        db.query(ArbitrageDeal)
        .filter(
            ArbitrageDeal.status == "active",
            ArbitrageDeal.image_url.is_(None)
            | (ArbitrageDeal.image_url == "")
            | (ArbitrageDeal.image_url == "None")
            | (ArbitrageDeal.image_url == "null"),
        )
        .limit(max_updates)
        .all()
    )

    if not deals_without_images:
        return {"placeholders_set": 0, "status": "success"}

    updated = 0
    base_url = "https://api.bargainhuntrs.com/api/v1/arbitrage"
    for deal in deals_without_images:
        deal.image_url = f"{base_url}/deals/placeholder/{deal.id}"
        updated += 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to backfill placeholders: {str(e)}",
        )

    return {"placeholders_set": updated, "status": "success"}


@router.post("/deals/{deal_id}/post-to-x/public", response_model=dict)
async def post_deal_to_x_public(
    deal_id: str,
    db: Session = Depends(get_db),
):
    """Post a specific deal to all social platforms — no auth required.

    Only posts deals with affiliate tracking links.
    Posts to X, Instagram, and Facebook via Buffer.
    """
    from app.services.x_poster import post_deal_to_x, is_configured

    if not is_configured():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Posting not configured. Set BUFFER_API_KEY env var.",
        )

    deal = db.query(ArbitrageDeal).filter(ArbitrageDeal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    # Only post deals with affiliate links
    if not _has_affiliate_link(deal.buy_url):
        raise HTTPException(
            status_code=400,
            detail="This deal does not have an affiliate link and cannot be posted.",
        )

    discount = 0
    if deal.historical_avg and deal.historical_avg > deal.buy_price:
        discount = int(round((1 - float(deal.buy_price) / float(deal.historical_avg)) * 100))

    result = await post_deal_to_x(
        title=deal.title,
        deal_price=float(deal.buy_price),
        original_price=float(deal.historical_avg) if deal.historical_avg else None,
        discount_percent=discount,
        retailer=getattr(deal, "retailer", None) or "amazon",
        deal_url=deal.buy_url or "",
        deal_tier=deal.deal_tier,
        image_url=deal.image_url,
    )

    if result.get("status") == "success":
        deal.alerted_at = datetime.utcnow()
        db.commit()

    return result


def _has_affiliate_link(url: str) -> bool:
    """Check if a URL has an affiliate/tracking link."""
    if not url:
        return False
    url_lower = url.lower()
    # Impact.com tracking domains
    impact_domains = ["sjv.io", "7eer.net", "pxf.io", "evyy.net", "vneoga.net",
                      "elfm.net", "eyjo.net", "gqco.net", "hmxg.net", "ijrn.net",
                      "jewn.net", "jyeh.net", "mtko.net", "tcux.net", "zlvv.net"]
    # Direct affiliate tags
    affiliate_tags = ["tag=bargain0ae", "campid=", "affid=", "goto.walmart.com",
                      "affiliates.abebooks.com"]
    if any(d in url_lower for d in impact_domains):
        return True
    if any(t in url_lower for t in affiliate_tags):
        return True
    return False


@router.post("/deals/scrape-impact/public", response_model=dict)
async def scrape_impact_deals_public(
    db: Session = Depends(get_db),
):
    """Public endpoint to scrape Impact.com deals — no auth required.

    Fetches discounted products and promo codes from joined Impact.com
    campaigns and saves them to the database with affiliate tracking links.
    Used by the GitHub Actions workflow to populate deals before posting.
    """
    from app.services.impact_api import (
        fetch_all_impact_deals,
        fetch_promo_codes,
        is_configured as impact_configured,
    )

    if not impact_configured():
        return {
            "status": "error",
            "error": "Impact.com not configured. Set IMPACT_ACCOUNT_SID and IMPACT_AUTH_TOKEN env vars.",
            "deals_found": 0,
            "deals_saved": 0,
        }

    results = {"status": "success", "deals": {}, "promo_codes": {}}

    # Fetch product deals from Impact catalogs
    try:
        impact_deals = await fetch_all_impact_deals()
        deals_saved = 0
        deals_errors = 0

        for deal in impact_deals:
            try:
                if not deal.get("deal_price") or not deal.get("title"):
                    continue

                deal_id = f"impact_{deal.get('campaign_id', '')}_{hashlib.md5(deal.get('title', '').encode()).hexdigest()[:12]}"[:36]

                orig = deal.get("original_price") or 0
                buy = deal.get("deal_price") or 0
                if not buy or buy <= 0:
                    continue

                tier = "glitch" if (deal.get("discount_percent", 0) or 0) >= 75 else "clearance"

                existing = db.query(ArbitrageDeal).filter(
                    ArbitrageDeal.asin == deal_id,
                    ArbitrageDeal.status == "active",
                ).first()

                if existing:
                    existing.buy_price = buy
                    existing.sell_price = orig if orig else buy
                    existing.historical_avg = orig if orig else buy
                    existing.image_url = deal.get("image_url") or existing.image_url
                    existing.deal_tier = tier
                    existing.net_profit = (orig - buy) if orig else 0
                    existing.roi = float((orig - buy) / orig) if orig and orig > 0 else 0
                    existing.detected_at = datetime.utcnow()
                    db.commit()
                    deals_saved += 1
                    continue

                # Skip deals that were recently posted (within 7 days) even if
                # they expired — re-creating them would cause duplicate posts.
                deal_url = deal.get("deal_url", "")
                if deal_url:
                    recently_posted_url = db.query(ArbitrageDeal).filter(
                        ArbitrageDeal.buy_url == deal_url,
                        ArbitrageDeal.alerted_at != None,
                        ArbitrageDeal.alerted_at > datetime.utcnow() - timedelta(days=7),
                    ).first()
                    if recently_posted_url:
                        continue

                new_deal = ArbitrageDeal(
                    asin=deal_id,
                    title=deal.get("title", "")[:500],
                    image_url=deal.get("image_url"),
                    buy_url=deal.get("deal_url"),
                    buy_platform=deal.get("retailer", "unknown"),
                    retailer=deal.get("retailer", "unknown"),
                    deal_source="online",
                    buy_price=buy,
                    sell_platform="impact",
                    sell_price=orig if orig else buy,
                    historical_avg=orig if orig else buy,
                    deal_tier=tier,
                    net_profit=(orig - buy) if orig else 0,
                    roi=float((orig - buy) / orig) if orig and orig > 0 else 0,
                    is_profitable=True,
                    status="active",
                    detected_at=datetime.utcnow(),
                )
                db.add(new_deal)
                db.commit()
                deals_saved += 1
            except Exception as e:
                db.rollback()
                deals_errors += 1
                if deals_errors <= 3:
                    logger.warning(f"Failed to save Impact deal: {e}")

        results["deals"] = {
            "found": len(impact_deals),
            "saved": deals_saved,
            "errors": deals_errors,
        }
    except Exception as e:
        results["deals"] = {"error": str(e)}

    # Fetch promo codes from Impact Ads endpoint
    try:
        promos = await fetch_promo_codes()
        from app.db.models import CouponCode
        promos_saved = 0
        for promo in promos:
            try:
                if not promo.code or not promo.retailer:
                    continue

                existing = db.query(CouponCode).filter(
                    CouponCode.code == promo.code,
                    CouponCode.retailer == promo.retailer,
                ).first()

                if existing:
                    existing.title = promo.title[:500]
                    existing.description = promo.description
                    existing.discount_type = promo.discount_type
                    existing.discount_value = promo.discount_value
                    existing.source = "impact_api"
                    if promo.end_date:
                        existing.expires_at = promo.end_date
                    existing.scraped_at = datetime.utcnow()
                    db.commit()
                    promos_saved += 1
                    continue

                new_coupon = CouponCode(
                    code=promo.code,
                    retailer=promo.retailer,
                    title=promo.title[:500],
                    description=promo.description,
                    discount_type=promo.discount_type,
                    discount_value=promo.discount_value,
                    product_url=promo.tracking_url,
                    source="impact_api",
                    source_url=promo.tracking_url,
                    expires_at=promo.end_date,
                    status="active",
                    scraped_at=datetime.utcnow(),
                )
                db.add(new_coupon)
                db.commit()
                promos_saved += 1
            except Exception as e:
                db.rollback()
                if promos_saved == 0:
                    logger.warning(f"Failed to save Impact promo code: {e}")

        results["promo_codes"] = {
            "found": len(promos),
            "saved": promos_saved,
        }
    except Exception as e:
        results["promo_codes"] = {"error": str(e)}

    return results


@router.post("/deals/post-new-to-x/public", response_model=dict)
async def post_new_deals_to_x_public(
    max_posts: int = Query(5, le=10),
    db: Session = Depends(get_db),
):
    """Post deals that haven't been posted to social media yet — no auth required.

    Only posts deals that have affiliate tracking links.
    Posts directly to X, Facebook, and Instagram via native APIs (bypassing
    Buffer). Falls back to Buffer for any platform not configured for direct
    posting. Includes 7-day title + URL dedup to prevent duplicate posts.
    """
    from app.services.unified_direct_poster import (
        post_deal_to_all_platforms,
        _any_direct_configured,
        _buffer_configured,
    )
    import re

    if not _any_direct_configured() and not _buffer_configured():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No posting configured. Set X_API_KEY/X_ACCESS_TOKEN for direct posting, or BUFFER_API_KEY for Buffer.",
        )

    deals_to_post = (
        db.query(ArbitrageDeal)
        .filter(
            ArbitrageDeal.status == "active",
            ArbitrageDeal.is_profitable == True,
            ArbitrageDeal.alerted_at == None,
        )
        .order_by(ArbitrageDeal.detected_at.desc())
        .limit(max_posts * 5)  # Fetch more to allow for dedup filtering
        .all()
    )

    # Only post deals with affiliate links
    affiliate_deals = [d for d in deals_to_post if _has_affiliate_link(d.buy_url)]

    # Only post deals with real product images (not placeholders, SVGs, or missing)
    def _has_real_image(deal) -> bool:
        img = deal.image_url or ""
        if not img:
            return False
        if "/deals/placeholder/" in img:
            return False
        if img.endswith(".svg") or "svg" in img.lower():
            return False
        if img in ("None", "null", ""):
            return False
        return True

    deals_with_images = [d for d in affiliate_deals if _has_real_image(d)]
    skipped_no_image = len(affiliate_deals) - len(deals_with_images)
    affiliate_deals = deals_with_images

    # Skip non-English deals (German, French, Spanish, Italian, etc.)
    from app.services.impact_api import _is_non_english_title
    deals_english = [d for d in affiliate_deals if not _is_non_english_title(d.title or "")]
    skipped_non_english = len(affiliate_deals) - len(deals_english)
    affiliate_deals = deals_english

    if not affiliate_deals:
        return {
            "posted": 0,
            "status": "success",
            "skipped_no_image": skipped_no_image,
            "skipped_non_english": skipped_non_english,
            "message": "No new deals with affiliate links and real images to post",
        }

    # ─── 7-day dedup: skip deals matching recently posted titles or URLs ───
    dedup_cutoff = datetime.utcnow() - timedelta(days=7)
    recently_posted = db.query(ArbitrageDeal).filter(
        ArbitrageDeal.alerted_at != None,
        ArbitrageDeal.alerted_at > dedup_cutoff,
    ).all()

    recently_posted_titles = {" ".join((d.title or "").lower().split()) for d in recently_posted}
    recently_posted_skus = set()
    recently_posted_asins = set()
    for d in recently_posted:
        url = (d.buy_url or "").lower()
        sku_match = re.search(r'prodsku[=:](\w+)', url)
        asin_match = re.search(r'(/dp/|/ip/)(\w+)', url)
        if sku_match:
            recently_posted_skus.add(sku_match.group(1))
        elif asin_match:
            recently_posted_asins.add(asin_match.group(2))

    deduped_deals = []
    skipped_dedup = 0
    for d in affiliate_deals:
        title_key = " ".join((d.title or "").lower().split())
        url = (d.buy_url or "").lower()
        if title_key in recently_posted_titles:
            skipped_dedup += 1
            continue
        sku_match = re.search(r'prodsku[=:](\w+)', url)
        asin_match = re.search(r'(/dp/|/ip/)(\w+)', url)
        sku = sku_match.group(1) if sku_match else None
        asin = asin_match.group(2) if asin_match else None
        if sku and sku in recently_posted_skus:
            skipped_dedup += 1
            continue
        if asin and asin in recently_posted_asins:
            skipped_dedup += 1
            continue
        deduped_deals.append(d)

    if skipped_dedup:
        logger.info(f"post-new-to-x: skipped {skipped_dedup} deals (7-day title+URL dedup)")

    affiliate_deals = deduped_deals

    if not affiliate_deals:
        return {"posted": 0, "status": "success", "message": "No new deals to post (all recently posted)"}

    results = []
    posted = 0
    for deal in affiliate_deals[:max_posts]:
        discount = 0
        if deal.historical_avg and deal.historical_avg > deal.buy_price:
            discount = int(round((1 - float(deal.buy_price) / float(deal.historical_avg)) * 100))

        result = await post_deal_to_all_platforms(
            title=deal.title,
            deal_price=float(deal.buy_price),
            original_price=float(deal.historical_avg) if deal.historical_avg else None,
            discount_percent=discount,
            retailer=getattr(deal, "retailer", None) or "amazon",
            deal_url=deal.buy_url or "",
            deal_tier=deal.deal_tier,
            image_url=deal.image_url,
            deal_id=str(deal.id),
        )

        if result.get("status") == "success":
            posted += 1
            deal.alerted_at = datetime.utcnow()
            db.commit()
            results.append({
                "deal_id": str(deal.id),
                "title": deal.title[:60],
                "platforms": result.get("platforms_used", []),
                "channels_posted": result.get("channels_posted", 0),
            })
        else:
            results.append({
                "deal_id": str(deal.id),
                "title": deal.title[:60],
                "error": result.get("error"),
            })

    return {
        "posted": posted,
        "total": len(deals_to_post),
        "skipped_dedup": skipped_dedup,
        "skipped_no_image": skipped_no_image,
        "skipped_non_english": skipped_non_english,
        "results": results,
        "status": "success",
    }


@router.post("/deals/cleanup-non-english/public", response_model=dict)
async def cleanup_non_english_deals_public(
    db: Session = Depends(get_db),
):
    """Expire non-English (French/German/Spanish/Italian) deals from the database.

    Scans active deals and marks any with non-English titles as expired.
    This cleans up localized ADOR products that were saved before the
    language filter was added to the scrape pipeline.
    No auth required — safe to call from GitHub Actions or manually.
    """
    from app.services.impact_api import _is_non_english_title

    active_deals = db.query(ArbitrageDeal).filter(
        ArbitrageDeal.status == "active",
    ).all()

    expired_count = 0
    for deal in active_deals:
        if _is_non_english_title(deal.title or ""):
            deal.status = "expired"
            expired_count += 1

    if expired_count:
        db.commit()

    return {
        "status": "success",
        "expired": expired_count,
        "message": f"Expired {expired_count} non-English deals",
    }


@router.post("/deals/cleanup-duplicates/public", response_model=dict)
async def cleanup_duplicate_deals_public(
    db: Session = Depends(get_db),
):
    """Remove duplicate deals from the database — no auth required.

    Finds and expires duplicates based on:
    1. Exact same buy_url (keeps the oldest deal, expires the rest)
    2. Exact same normalized title (keeps the oldest, expires the rest)
    3. Same ASIN (keeps the oldest, expires the rest)

    Safe to call from GitHub Actions or manually.
    """
    import re
    from collections import defaultdict

    active_deals = db.query(ArbitrageDeal).filter(
        ArbitrageDeal.status == "active",
    ).order_by(ArbitrageDeal.detected_at.asc()).all()

    expired_count = 0
    expired_ids = []
    reasons = {"url": 0, "title": 0, "asin": 0}

    # Group by URL
    url_groups = defaultdict(list)
    for d in active_deals:
        if d.buy_url:
            url_groups[d.buy_url].append(d)

    # Group by normalized title
    def normalize_title(t):
        return re.sub(r'[^a-z0-9 ]', '', (t or '').lower()).strip()

    title_groups = defaultdict(list)
    for d in active_deals:
        key = normalize_title(d.title)
        if key:
            title_groups[key].append(d)

    # Group by ASIN
    asin_groups = defaultdict(list)
    for d in active_deals:
        if d.asin:
            asin_groups[d.asin].append(d)

    expired_set = set()

    # Expire URL duplicates (keep oldest)
    for url, deals in url_groups.items():
        if len(deals) > 1:
            for d in deals[1:]:
                if d.id not in expired_set:
                    d.status = "expired"
                    expired_set.add(d.id)
                    expired_ids.append(str(d.id))
                    expired_count += 1
                    reasons["url"] += 1

    # Expire title duplicates (keep oldest)
    for key, deals in title_groups.items():
        if len(deals) > 1:
            for d in deals[1:]:
                if d.id not in expired_set:
                    d.status = "expired"
                    expired_set.add(d.id)
                    expired_ids.append(str(d.id))
                    expired_count += 1
                    reasons["title"] += 1

    # Expire ASIN duplicates (keep oldest)
    for asin, deals in asin_groups.items():
        if len(deals) > 1:
            for d in deals[1:]:
                if d.id not in expired_set:
                    d.status = "expired"
                    expired_set.add(d.id)
                    expired_ids.append(str(d.id))
                    expired_count += 1
                    reasons["asin"] += 1

    if expired_count:
        db.commit()

    return {
        "status": "success",
        "expired": expired_count,
        "by_reason": reasons,
        "expired_ids": expired_ids,
        "message": f"Expired {expired_count} duplicate deals (url={reasons['url']}, title={reasons['title']}, asin={reasons['asin']})",
    }


@router.post("/buffer/clear-queue/public", response_model=dict)
async def clear_buffer_queue_public():
    """Delete all scheduled posts from Buffer to clear clogged queues.

    No auth required — called manually when Buffer queue is full of
    failed/stuck posts that need to be cleared before new posts can flow.
    """
    from app.services.x_poster import clear_buffer_queue
    result = await clear_buffer_queue()
    return result


@router.get("/affiliate-networks/status", response_model=dict)
async def affiliate_networks_status():
    """Check which affiliate networks are configured.

    Returns the status of each affiliate network and signup URLs
    for those that aren't configured yet.
    """
    from app.services.affiliate_networks import get_configured_networks

    configured = get_configured_networks()

    networks = {
        "rakuten": {
            "configured": "rakuten" in configured,
            "signup_url": "https://pubhelp.rakutenadvertising.com/hc/en-us/articles/20898125890573-Publisher-Sign-Up-Process",
            "difficulty": "Easy — open network, no traffic requirements",
            "retailers": "Macy's, Sephora, Nordstrom, Adidas, Nike, Puma",
            "env_vars": ["RAKUTEN_WEBSERVICES_TOKEN", "RAKUTEN_SECURITY_TOKEN"],
        },
        "awin": {
            "configured": "awin" in configured,
            "signup_url": "https://ui.awin.com/publisher-signup/en",
            "difficulty": "Medium — requires $1 deposit (refunded)",
            "retailers": "Walmart, Target, 30K+ merchants (includes former ShareASale)",
            "env_vars": ["AWIN_API_TOKEN", "AWIN_PUBLISHER_ID"],
        },
        "cj": {
            "configured": "cj" in configured,
            "signup_url": "https://signup.cj.com/member/signup/publisher/",
            "difficulty": "Medium-Hard — two-level approval (network + merchants)",
            "retailers": "Lowe's, Wayfair, GoDaddy, Office Depot, Verizon",
            "env_vars": ["CJ_ACCESS_TOKEN", "CJ_WEBSITE_ID"],
        },
        "skimlinks": {
            "configured": "skimlinks" in configured,
            "signup_url": "https://signup.skimlinks.com/en",
            "difficulty": "Medium — manual review (2 business days)",
            "retailers": "Walmart, Best Buy, Home Depot, Wayfair, Kohl's",
            "env_vars": ["SKIMLINKS_PRODUCT_KEY", "SKIMLINKS_CLIENT_ID", "SKIMLINKS_CLIENT_SECRET"],
        },
    }

    return {
        "configured": configured,
        "networks": networks,
        "recommendation": "Sign up for Rakuten first (easiest approval), then Awin and CJ Affiliate.",
    }


@router.get("/niches", response_model=List[dict])
async def list_niches(
    current_user: User = Depends(get_current_user),
):
    """List all available niche categories for deal scanning/filtering."""
    return [
        {
            "key": n.key,
            "name": n.display_name,
            "emoji": n.emoji,
            "description": n.description,
            "typical_margin": n.typical_margin,
        }
        for n in get_all_niches()
    ]


@router.post("/scan/{niche}", response_model=dict)
async def scan_niche_endpoint(
    niche: str,
    max_products: int = Query(20, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Scan for arbitrage deals in a specific niche category.

    Uses the niche's Amazon (Keepa) category ID to limit the scan, then
    tags and saves every profitable deal with the niche key.
    """
    if not get_niche(niche):
        raise HTTPException(status_code=404, detail=f"Unknown niche: {niche}")

    scan_run = ScanRun(
        scan_type=f"niche_{niche}",
        status="running",
    )
    db.add(scan_run)
    db.commit()
    db.refresh(scan_run)

    try:
        opportunities = await scan_niche(niche, max_products=max_products)

        scan_run.products_scanned = max_products
        scan_run.deals_found = len(opportunities)
        scan_run.completed_at = datetime.utcnow()
        scan_run.status = "completed"

        saved_deals = []
        for opp in opportunities:
            if opp.is_profitable:
                deal = _save_opportunity(db, opp)
                saved_deals.append(opp.to_dict())

        db.commit()

        return {
            "scan_id": str(scan_run.id),
            "niche": niche,
            "products_scanned": max_products,
            "deals_found": len(opportunities),
            "deals": saved_deals,
        }
    except Exception as e:
        scan_run.status = "failed"
        scan_run.error = str(e)
        scan_run.completed_at = datetime.utcnow()
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Scan failed: {str(e)}",
        )


@router.post("/scan", response_model=dict)
async def scan_for_deals(
    body: ScanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Scan Amazon for arbitrage opportunities.

    If `asin` is provided, scans a single product.
    Otherwise, searches Amazon for discounted products and checks each against eBay.

    Requires Keepa API key for bulk scanning.
    """
    # Create scan run record
    scan_run = ScanRun(
        scan_type=f"amazon_{body.sell_platform}",
        status="running",
    )
    db.add(scan_run)
    db.commit()
    db.refresh(scan_run)

    try:
        if body.asin:
            # Single ASIN scan
            platform = Platform(body.sell_platform) if body.sell_platform else Platform.EBAY
            opportunity = await find_arbitrage_for_asin(body.asin, platform)

            scan_run.products_scanned = 1
            scan_run.completed_at = datetime.utcnow()
            scan_run.status = "completed"

            if opportunity and opportunity.is_profitable:
                # Save to database
                deal = _save_opportunity(db, opportunity)
                scan_run.deals_found = 1
                db.commit()

                return {
                    "scan_id": str(scan_run.id),
                    "products_scanned": 1,
                    "deals_found": 1,
                    "deals": [opportunity.to_dict()],
                }
            else:
                db.commit()
                return {
                    "scan_id": str(scan_run.id),
                    "products_scanned": 1,
                    "deals_found": 0,
                    "deals": [],
                    "message": "No profitable deals found for this ASIN",
                }
        else:
            # Bulk scan
            platform = Platform(body.sell_platform) if body.sell_platform else Platform.EBAY
            opportunities = await scan_amazon_for_arbitrage(
                category=body.category,
                min_discount=Decimal(str(body.min_discount)),
                max_price=Decimal(str(body.max_price)),
                limit=body.limit,
                sell_platform=platform,
            )

            scan_run.products_scanned = body.limit
            scan_run.deals_found = len(opportunities)
            scan_run.completed_at = datetime.utcnow()
            scan_run.status = "completed"

            # Save profitable deals to database
            saved_deals = []
            for opp in opportunities:
                if opp.is_profitable:
                    deal = _save_opportunity(db, opp)
                    saved_deals.append(opp.to_dict())

            db.commit()

            return {
                "scan_id": str(scan_run.id),
                "products_scanned": body.limit,
                "deals_found": len(opportunities),
                "deals": saved_deals,
            }

    except Exception as e:
        scan_run.status = "failed"
        scan_run.error = str(e)
        scan_run.completed_at = datetime.utcnow()
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Scan failed: {str(e)}",
        )


@router.get("/deals", response_model=List[DealResponse])
async def list_deals(
    tier: Optional[str] = Query(None, description="Filter by deal tier (glitch, clearance, arbitrage)"),
    niche: Optional[str] = Query(None, description="Filter by niche (electronics, tools_home_improvement, etc.)"),
    min_profit: Optional[float] = Query(None, description="Minimum net profit"),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List arbitrage deals, optionally filtered by tier, niche, and minimum profit.

    Free users see glitch deals with a 1-hour delay (early access for Hunter).
    Hunter users see all deals immediately, including priority glitch deals.
    """
    query = db.query(ArbitrageDeal).filter(ArbitrageDeal.is_profitable == True)

    if tier:
        query = query.filter(ArbitrageDeal.deal_tier == tier)

    if niche:
        query = query.filter(ArbitrageDeal.niche == niche)

    if min_profit is not None:
        query = query.filter(ArbitrageDeal.net_profit >= Decimal(str(min_profit)))

    # Tier-based early access: free users see glitch deals 1 hour after detection
    user_tier = (getattr(current_user, "subscription_tier", "free") or "free").lower()
    if user_tier == "free":
        glitch_cutoff = datetime.utcnow() - timedelta(hours=1)
        # Free users: glitch deals must be older than 1 hour
        query = query.filter(
            (ArbitrageDeal.deal_tier != "glitch") |
            (ArbitrageDeal.detected_at <= glitch_cutoff)
        )

    query = query.order_by(ArbitrageDeal.net_profit.desc())
    deals = query.offset(offset).limit(limit).all()

    return [_deal_to_response(d, db) for d in deals]


@router.get("/deals/{deal_id}", response_model=DealResponse)
async def get_deal(
    deal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific deal by ID."""
    deal = db.query(ArbitrageDeal).filter(ArbitrageDeal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return _deal_to_response(deal, db)


@router.get("/deals/{deal_id}/prediction")
async def get_price_prediction(
    deal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get ML price prediction for a specific deal. PRO/ENTERPRISE feature.

    Free users receive a basic recommendation only; PRO/ENTERPRISE users
    get the full detailed analysis (confidence, predicted low, volatility,
    deal-quality score).
    """
    deal = db.query(ArbitrageDeal).filter(ArbitrageDeal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    from app.services.price_predictor import price_predictor

    # Build price history from stored PriceSnapshots for this ASIN
    snapshots = (
        db.query(PriceSnapshot)
        .filter(PriceSnapshot.item_id == deal.asin)
        .order_by(PriceSnapshot.timestamp.asc())
        .limit(100)
        .all()
    )

    price_history = [
        {"timestamp": s.timestamp.isoformat() if s.timestamp else None, "price": float(s.price)}
        for s in snapshots
        if s.price is not None
    ]

    # If we have no snapshot history, synthesize a minimal history from the
    # deal's own buy price / historical average so the predictor still works.
    if len(price_history) < price_predictor.min_data_points:
        synthetic = []
        if deal.historical_avg and deal.buy_price:
            avg = float(deal.historical_avg)
            cur = float(deal.buy_price)
            # Interpolate a few points between historical avg and current price
            steps = price_predictor.min_data_points
            for i in range(steps):
                frac = i / (steps - 1)
                synthetic.append({
                    "timestamp": None,
                    "price": round(avg + (cur - avg) * frac, 2),
                })
        price_history = synthetic

    current_price = float(deal.buy_price) if deal.buy_price else 0.0
    historical_avg = float(deal.historical_avg) if deal.historical_avg else 0.0

    trend = price_predictor.predict_price_trend(price_history)
    quality = price_predictor.score_deal_quality(price_history, current_price, historical_avg)

    tier = (current_user.subscription_tier or "free").lower()
    is_paid = tier in ("pro", "enterprise")

    if is_paid:
        return {
            "deal_id": str(deal.id),
            "asin": deal.asin,
            "current_price": current_price,
            "trend": trend,
            "deal_quality": quality,
            "tier": tier,
        }

    # Free users: basic recommendation only
    return {
        "deal_id": str(deal.id),
        "asin": deal.asin,
        "current_price": current_price,
        "recommendation": trend.get("recommendation", "monitor"),
        "tier": tier,
        "message": "Upgrade to PRO for full price prediction analysis.",
    }


@router.get("/stats", response_model=dict)
async def get_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get arbitrage scanning statistics."""
    total_deals = db.query(ArbitrageDeal).filter(ArbitrageDeal.is_profitable == True).count()
    active_deals = db.query(ArbitrageDeal).filter(
        ArbitrageDeal.is_profitable == True,
        ArbitrageDeal.status == "active",
    ).count()

    # Count by tier
    tier_counts = {}
    for tier in ["glitch", "clearance", "arbitrage", "watch"]:
        count = db.query(ArbitrageDeal).filter(
            ArbitrageDeal.deal_tier == tier,
            ArbitrageDeal.is_profitable == True,
        ).count()
        if count > 0:
            tier_counts[tier] = count

    # Recent scans
    recent_scans = db.query(ScanRun).order_by(ScanRun.started_at.desc()).limit(10).all()

    return {
        "total_profitable_deals": total_deals,
        "active_deals": active_deals,
        "tier_counts": tier_counts,
        "recent_scans": [
            {
                "id": str(s.id),
                "scan_type": s.scan_type,
                "products_scanned": s.products_scanned,
                "deals_found": s.deals_found,
                "status": s.status,
                "started_at": s.started_at.isoformat() if s.started_at else None,
                "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            }
            for s in recent_scans
        ],
    }


@router.delete("/deals/all", response_model=dict)
async def delete_all_deals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete all arbitrage deals. Useful for clearing stale data."""
    count = db.query(ArbitrageDeal).count()
    db.query(ArbitrageDeal).delete()
    db.commit()
    return {"deleted": count}


def _save_opportunity(db: Session, opp: ArbitrageOpportunity) -> ArbitrageDeal:
    """Save an ArbitrageOpportunity to the database."""
    # Check for existing deal with same ASIN (dedup within 24h)
    from datetime import timedelta
    cutoff = datetime.utcnow() - timedelta(hours=24)
    existing = db.query(ArbitrageDeal).filter(
        ArbitrageDeal.asin == opp.asin,
        ArbitrageDeal.detected_at >= cutoff,
    ).first()

    if existing:
        # Update existing deal
        existing.buy_price = opp.buy_price
        existing.sell_price = opp.sell_price
        existing.net_profit = opp.profit.net_profit if opp.profit else None
        existing.roi = opp.profit.roi if opp.profit else None
        existing.total_costs = opp.profit.total_costs if opp.profit else None
        existing.platform_fee = opp.profit.platform_fee if opp.profit else None
        existing.detected_at = datetime.utcnow()
        if opp.niche:
            existing.niche = opp.niche
        db.commit()
        db.refresh(existing)
        return existing

    deal = ArbitrageDeal(
        asin=opp.asin,
        title=opp.title,
        image_url=opp.image_url,
        buy_url=opp.buy_url,
        buy_platform="amazon",
        buy_price=opp.buy_price,
        sell_platform=opp.sell_platform,
        sell_price=opp.sell_price,
        historical_avg=opp.historical_avg,
        discrepancy=opp.discrepancy,
        deal_tier=opp.deal_tier,
        net_profit=opp.profit.net_profit if opp.profit else None,
        roi=opp.profit.roi if opp.profit else None,
        total_costs=opp.profit.total_costs if opp.profit else None,
        platform_fee=opp.profit.platform_fee if opp.profit else None,
        bsr=opp.bsr,
        category=opp.category,
        niche=opp.niche,
        is_profitable=opp.is_profitable,
        status="active",
    )
    db.add(deal)
    db.commit()
    db.refresh(deal)
    return deal


def _deal_to_response(deal: ArbitrageDeal, db: Session = None, best_coupon: Optional[dict] = None) -> DealResponse:
    """Convert an ArbitrageDeal model to a DealResponse.

    When a db session is provided, auto-matches the best applicable coupon
    for the deal's retailer and includes the effective price after coupon.
    Pass `best_coupon` to skip the per-deal lookup (batch path).
    """
    image_url = deal.image_url
    # Don't filter out Amazon image URLs — ASIN-based URLs like
    # https://m.media-amazon.com/images/I/B0HCRVD7VP._AC_SL240_.jpg
    # are valid image URLs that Amazon serves correctly.

    if best_coupon is None and db is not None:
        best_coupon = _find_best_coupon_for_deal(deal, db)

    return DealResponse(
        id=str(deal.id),
        asin=deal.asin,
        title=deal.title,
        image_url=image_url,
        buy_url=deal.buy_url,
        buy_price=float(deal.buy_price),
        sell_price=float(deal.sell_price),
        historical_avg=float(deal.historical_avg) if deal.historical_avg else None,
        discrepancy=float(deal.discrepancy) if deal.discrepancy else None,
        deal_tier=deal.deal_tier,
        retailer=getattr(deal, "retailer", None) or deal.buy_platform or "amazon",
        deal_source=getattr(deal, "deal_source", None) or "online",
        net_profit=float(deal.net_profit) if deal.net_profit else None,
        roi=float(deal.roi) if deal.roi else None,
        total_costs=float(deal.total_costs) if deal.total_costs else None,
        platform_fee=float(deal.platform_fee) if deal.platform_fee else None,
        bsr=deal.bsr,
        category=deal.category,
        niche=deal.niche,
        is_profitable=deal.is_profitable,
        status=deal.status,
        detected_at=deal.detected_at.isoformat() if deal.detected_at else "",
        best_coupon=best_coupon,
    )


def _best_coupons_batch(deals: list, db: Session) -> dict:
    """Match best coupons for a page of deals with a single DB query.

    Returns {deal_id_str: best_coupon_dict}. Replaces the per-deal
    `_find_best_coupon_for_deal` lookups which were an N+1 (~50 queries).
    """
    if not deals:
        return {}
    try:
        from app.db.models import CouponCode
        from app.services.coupon_scraper import calculate_discounted_price, ScrapedCoupon
        from collections import defaultdict

        # Collect every retailer variant across the page
        variants = set()
        deal_retailers = {}
        for d in deals:
            r = (getattr(d, "retailer", None) or d.buy_platform or "amazon").lower()
            deal_retailers[str(d.id)] = r
            variants.add(r)
            variants.add(r.replace("_", ""))

        coupons = db.query(CouponCode).filter(
            CouponCode.retailer.in_(list(variants)),
            CouponCode.status == "active",
            (CouponCode.expires_at.is_(None)) | (CouponCode.expires_at > datetime.utcnow()),
        ).order_by(CouponCode.discount_value.desc()).all()

        by_retailer = defaultdict(list)
        for c in coupons:
            by_retailer[c.retailer].append(c)

        results = {}
        for d in deals:
            retailer = deal_retailers[str(d.id)]
            candidates = (
                by_retailer.get(retailer, []) + by_retailer.get(retailer.replace("_", ""), [])
            )
            if d.category:
                cat = d.category.lower()
                candidates = [c for c in candidates if c.category is None or c.category == cat]

            best, best_savings = None, Decimal("0")
            for coupon in candidates[:5]:
                scraped = ScrapedCoupon(
                    code=coupon.code,
                    retailer=coupon.retailer,
                    title=coupon.title,
                    discount_type=coupon.discount_type,
                    discount_value=coupon.discount_value or Decimal("0"),
                    min_purchase=coupon.min_purchase,
                    max_discount=coupon.max_discount,
                )
                effective_price, savings = calculate_discounted_price(
                    Decimal(str(d.buy_price)), scraped
                )
                if savings > best_savings:
                    best_savings = savings
                    best = {
                        "id": str(coupon.id),
                        "code": coupon.code,
                        "discount_type": coupon.discount_type,
                        "discount_value": float(coupon.discount_value) if coupon.discount_value else 0,
                        "effective_price": float(effective_price),
                        "savings": float(savings),
                        "title": coupon.title[:100],
                    }
            if best:
                results[str(d.id)] = best
        return results
    except Exception:
        return {}


def _find_best_coupon_for_deal(deal: ArbitrageDeal, db: Session) -> Optional[dict]:
    """Find the best applicable coupon for a deal and return a summary dict.

    Returns None if no applicable coupon is found or if the coupon provides
    no actual discount.
    """
    try:
        from app.db.models import CouponCode
        from app.services.coupon_scraper import calculate_discounted_price, ScrapedCoupon
        from datetime import datetime

        retailer = (getattr(deal, "retailer", None) or deal.buy_platform or "amazon").lower()

        # Also try matching without the underscore variant (e.g. "best_buy" -> "bestbuy")
        retailer_variants = [retailer, retailer.replace("_", "")]

        query = db.query(CouponCode).filter(
            CouponCode.retailer.in_(retailer_variants),
            CouponCode.status == "active",
            (CouponCode.expires_at.is_(None)) | (CouponCode.expires_at > datetime.utcnow()),
        )

        if deal.category:
            query = query.filter(
                (CouponCode.category.is_(None)) | (CouponCode.category == deal.category.lower())
            )

        coupons = query.order_by(CouponCode.discount_value.desc()).limit(5).all()

        best = None
        best_savings = Decimal("0")
        for coupon in coupons:
            scraped = ScrapedCoupon(
                code=coupon.code,
                retailer=coupon.retailer,
                title=coupon.title,
                discount_type=coupon.discount_type,
                discount_value=coupon.discount_value or Decimal("0"),
                min_purchase=coupon.min_purchase,
                max_discount=coupon.max_discount,
            )
            effective_price, savings = calculate_discounted_price(
                Decimal(str(deal.buy_price)), scraped
            )
            if savings > best_savings:
                best_savings = savings
                best = {
                    "id": str(coupon.id),
                    "code": coupon.code,
                    "discount_type": coupon.discount_type,
                    "discount_value": float(coupon.discount_value) if coupon.discount_value else 0,
                    "effective_price": float(effective_price),
                    "savings": float(savings),
                    "title": coupon.title[:100],
                }

        return best
    except Exception:
        return None


# ─── Short Link Redirect (GET, for social media posts) ─────────────────────

@router.get("/d/{deal_id}")
async def short_link_redirect(
    deal_id: UUID = Path(..., description="Deal ID for short link redirect"),
    db: Session = Depends(get_db),
    request: Request = None,
):
    """GET-based redirect for use in social media posts.

    Creates a short URL like:
      https://api.bargainhuntrs.com/api/v1/arbitrage/d/{deal_id}

    Tracks the click and 302-redirects to the affiliate URL.
    """
    deal = db.query(ArbitrageDeal).filter(ArbitrageDeal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    buy_url = deal.buy_url or ""
    if not buy_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This deal does not have a purchase link.",
        )

    retailer = deal.retailer or detect_retailer(buy_url) or "amazon"
    affiliate_url = add_affiliate_tag(buy_url, retailer, deal.asin or "")

    # Record the click (best-effort)
    try:
        click = AffiliateClick(
            deal_id=deal.id,
            user_id=None,
            retailer=retailer,
            original_url=buy_url,
            affiliate_url=affiliate_url,
            asin=deal.asin or None,
            clicked_at=datetime.utcnow(),
            user_agent=request.headers.get("user-agent") if request else None,
            referrer=request.headers.get("referer") if request else None,
            ip_hash=_hash_ip(_client_ip(request)) if request else None,
        )
        db.add(click)
        db.commit()
    except Exception as e:
        logger.warning(f"Failed to log short link click: {e}")
        db.rollback()

    return RedirectResponse(url=affiliate_url, status_code=status.HTTP_302_FOUND)


# ─── Affiliate Click Tracking (redirect-based) ──────────────────────────────

def _hash_ip(ip: str) -> str:
    """SHA-256 hash an IP address for privacy-preserving analytics."""
    if not ip:
        return None
    return hashlib.sha256(ip.encode("utf-8")).hexdigest()


def _client_ip(request: Request) -> str:
    """Extract the client IP, respecting X-Forwarded-For from Render's proxy."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else ""


@router.post("/deals/{deal_id}/click")
async def track_deal_click(
    deal_id: UUID = Path(..., description="The deal to track and redirect to"),
    db: Session = Depends(get_db),
    request: Request = None,
):
    """Track a click on a deal and redirect to the affiliate URL.

    No authentication required -- works for anonymous visitors. Records the
    deal_id, retailer, timestamp, user_agent, referrer, and a hashed IP for
    analytics, then issues a 302 redirect to the affiliate-tagged URL.
    """
    deal = db.query(ArbitrageDeal).filter(ArbitrageDeal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    buy_url = deal.buy_url or ""
    if not buy_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This deal does not have a purchase link.",
        )

    retailer = deal.retailer or detect_retailer(buy_url) or "amazon"
    affiliate_url = add_affiliate_tag(buy_url, retailer, deal.asin or "")

    # Record the click (best-effort -- never block the redirect on a DB error)
    try:
        click = AffiliateClick(
            deal_id=deal.id,
            user_id=None,
            retailer=retailer,
            original_url=buy_url,
            affiliate_url=affiliate_url,
            asin=deal.asin or None,
            clicked_at=datetime.utcnow(),
            user_agent=request.headers.get("user-agent") if request else None,
            referrer=request.headers.get("referer") if request else None,
            ip_hash=_hash_ip(_client_ip(request)) if request else None,
        )
        db.add(click)
        db.commit()
    except Exception as e:
        logger.warning(f"Failed to log deal click redirect: {e}")
        db.rollback()

    return RedirectResponse(url=affiliate_url, status_code=status.HTTP_302_FOUND)


# ─── Affiliate Stats (admin only) ───────────────────────────────────────────

def _require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that ensures the authenticated user has an admin role."""
    if (current_user.role or "").lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return current_user


# Rough commission-rate estimates by retailer (percentage of order value).
# Used for the "estimated commission earned" figure in admin stats.
_ESTIMATED_COMMISSION_RATES = {
    "amazon": 0.04,
    "ebay": 0.03,
    "walmart": 0.04,
    "target": 0.04,
    "bestbuy": 0.03,
    "best_buy": 0.03,
    "home_depot": 0.03,
    "homedepot": 0.03,
    "lowes": 0.03,
    "costco": 0.02,
    "newegg": 0.03,
}


@router.get("/affiliate/stats")
async def affiliate_stats(
    current_user: User = Depends(_require_admin),
    db: Session = Depends(get_db),
    days: int = Query(30, ge=1, le=365, description="Lookback window in days"),
):
    """Admin-only aggregate affiliate click statistics.

    Returns click counts broken down by retailer, by day, and by deal, plus
    an estimated commission figure based on average deal buy prices and
    approximate retailer commission rates.
    """
    since = datetime.utcnow() - timedelta(days=days)

    try:
        base = db.query(AffiliateClick).filter(AffiliateClick.clicked_at >= since)

        total_clicks = base.count()

        # Clicks by retailer
        by_retailer_rows = (
            db.query(AffiliateClick.retailer, func.count(AffiliateClick.id))
            .filter(AffiliateClick.clicked_at >= since)
            .group_by(AffiliateClick.retailer)
            .all()
        )
        clicks_by_retailer = [
            {"retailer": r or "unknown", "clicks": c}
            for r, c in by_retailer_rows
        ]

        # Clicks by day
        by_day_rows = (
            db.query(
                cast(AffiliateClick.clicked_at, Date).label("day"),
                func.count(AffiliateClick.id),
            )
            .filter(AffiliateClick.clicked_at >= since)
            .group_by("day")
            .order_by("day")
            .all()
        )
        clicks_by_day = [
            {"date": d.isoformat(), "clicks": c}
            for d, c in by_day_rows
        ]

        # Clicks by deal (top 50)
        by_deal_rows = (
            db.query(
                AffiliateClick.deal_id,
                func.count(AffiliateClick.id),
            )
            .filter(AffiliateClick.clicked_at >= since)
            .group_by(AffiliateClick.deal_id)
            .order_by(func.count(AffiliateClick.id).desc())
            .limit(50)
            .all()
        )
        deal_ids = [row[0] for row in by_deal_rows if row[0]]
        deals_map = {}
        if deal_ids:
            deals = db.query(ArbitrageDeal).filter(ArbitrageDeal.id.in_(deal_ids)).all()
            deals_map = {d.id: d for d in deals}

        clicks_by_deal = []
        estimated_commission = 0.0
        for deal_id, count in by_deal_rows:
            deal = deals_map.get(deal_id)
            title = deal.title if deal else None
            retailer = deal.retailer if deal else None
            buy_price = float(deal.buy_price) if deal and deal.buy_price else 0.0
            rate = _ESTIMATED_COMMISSION_RATES.get((retailer or "").lower(), 0.03)
            estimated_commission += buy_price * rate * count
            clicks_by_deal.append({
                "deal_id": str(deal_id) if deal_id else None,
                "title": title,
                "retailer": retailer,
                "clicks": count,
                "estimated_commission": round(buy_price * rate * count, 2),
            })

        return {
            "days": days,
            "total_clicks": total_clicks,
            "clicks_by_retailer": clicks_by_retailer,
            "clicks_by_day": clicks_by_day,
            "clicks_by_deal": clicks_by_deal,
            "estimated_commission_earned": round(estimated_commission, 2),
        }
    except Exception as e:
        logger.warning(f"Failed to query affiliate admin stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load affiliate stats",
        )
