"""
Scheduled Scanner — Phase 1

A background asyncio task scheduler that runs periodic arbitrage scans.
No Celery needed for MVP — uses asyncio tasks.

Flow:
1. Every SCAN_INTERVAL_MINUTES, runs scan_amazon_for_arbitrage()
2. For each profitable deal found, triggers the alert service
3. Tracks scan runs in the ScanRun table
4. Handles errors gracefully (failed scans don't crash the scheduler)
"""

import asyncio
import hashlib
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo
from decimal import Decimal
from typing import Optional
import logging

from app.core.config import settings
from app.db.session import SessionLocal
from app.db.models import ScanRun, User, ArbitrageDeal
from app.services.arbitrage import scan_amazon_for_arbitrage, find_arbitrage_for_asin, ArbitrageOpportunity
from app.services.profit_calculator import Platform
from app.services.alert_service import create_alert_for_opportunity
from app.services.deal_scorer import calculate_deal_score
from app.services.notification_service import distribute_deal, DealInfo, get_sms_recipients, user_subscribed_to_niche

logger = logging.getLogger(__name__)


class ScanScheduler:
    """Background asyncio task scheduler for periodic arbitrage scans.

    Also runs a deal scraping + X posting task every 2 hours that:
    1. Scrapes Amazon Gold Box + RSS feeds for new deals
    2. Posts the top deals to X via Make.com webhook (runs 24/7, no computer needed)
    """

    def __init__(self, interval_minutes: int = None):
        self.interval_minutes = interval_minutes or settings.SCAN_INTERVAL_MINUTES
        self._task: Optional[asyncio.Task] = None
        self._deal_task: Optional[asyncio.Task] = None
        self._engagement_task: Optional[asyncio.Task] = None
        self._running = False
        self._last_scan_at: Optional[datetime] = None
        self._next_scan_at: Optional[datetime] = None
        self._last_scan_status: str = "never"
        self._last_error: Optional[str] = None
        self._last_deal_scrape_at: Optional[datetime] = None
        self._last_engagement_at: Optional[datetime] = None
        self._resale_reprice_task: Optional[asyncio.Task] = None
        self._last_resale_reprice_at: Optional[datetime] = None
        self._newsletter_daily_task: Optional[asyncio.Task] = None
        self._newsletter_weekly_task: Optional[asyncio.Task] = None
        self._last_newsletter_daily_at: Optional[datetime] = None
        self._last_newsletter_weekly_at: Optional[datetime] = None
        self._coupon_scrape_task: Optional[asyncio.Task] = None
        self._last_coupon_scrape_at: Optional[datetime] = None
        self._listing_scrape_task: Optional[asyncio.Task] = None

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def last_scan_at(self) -> Optional[datetime]:
        return self._last_scan_at

    @property
    def next_scan_at(self) -> Optional[datetime]:
        return self._next_scan_at

    @property
    def last_scan_status(self) -> str:
        return self._last_scan_status

    def get_status(self) -> dict:
        """Get the current scheduler status."""
        return {
            "running": self._running,
            "interval_minutes": self.interval_minutes,
            "last_scan_at": self._last_scan_at.isoformat() if self._last_scan_at else None,
            "next_scan_at": self._next_scan_at.isoformat() if self._next_scan_at else None,
            "last_scan_status": self._last_scan_status,
            "last_error": self._last_error,
            "last_deal_scrape_at": self._last_deal_scrape_at.isoformat() if self._last_deal_scrape_at else None,
            "last_engagement_at": self._last_engagement_at.isoformat() if self._last_engagement_at else None,
            "last_resale_reprice_at": self._last_resale_reprice_at.isoformat() if self._last_resale_reprice_at else None,
            "last_coupon_scrape_at": self._last_coupon_scrape_at.isoformat() if self._last_coupon_scrape_at else None,
        }

    def _get_post_times(self) -> list[time]:
        """Parse BUFFER_POST_TIMES env into a list of datetime.time objects."""
        post_times: list[time] = []
        raw = getattr(settings, "BUFFER_POST_TIMES", "")
        if not raw:
            return post_times
        for entry in raw.split(","):
            entry = entry.strip()
            if not entry:
                continue
            try:
                hour, minute = map(int, entry.split(":"))
                post_times.append(time(hour, minute))
            except ValueError:
                logger.warning(f"Invalid BUFFER_POST_TIMES entry: {entry}")
        return post_times

    def _seconds_until_next_post(self) -> int:
        """Return the number of seconds until the next scheduled Buffer post."""
        tz_name = getattr(settings, "BUFFER_POST_TIMEZONE", "America/New_York") or "America/New_York"
        try:
            tz = ZoneInfo(tz_name)
        except Exception:
            tz = ZoneInfo("America/New_York")

        now = datetime.now(tz)
        post_times = sorted(self._get_post_times())
        if not post_times:
            # Fall back to the legacy interval-based posting if no times configured
            return getattr(settings, "POST_INTERVAL_MINUTES", 90) * 60

        for post_time in post_times:
            candidate = datetime.combine(now.date(), post_time, tzinfo=tz)
            if candidate > now:
                return int((candidate - now).total_seconds())

        # All times have passed today; wait until the first time tomorrow
        tomorrow = now.date() + timedelta(days=1)
        candidate = datetime.combine(tomorrow, post_times[0], tzinfo=tz)
        return int((candidate - now).total_seconds())

    def start(self) -> bool:
        """Start the background scanner. Returns True if started, False if already running."""
        if self._running and self._task and not self._task.done():
            logger.warning("Scheduler is already running")
            return False

        self._running = True
        self._task = asyncio.create_task(self._run_loop())
        # Start the deal scraping + X posting loop
        self._deal_task = asyncio.create_task(self._run_deal_scrape_loop())
        # Start the resale repricing loop (once/day)
        self._resale_reprice_task = asyncio.create_task(self._run_resale_reprice_loop())
        # Start the newsletter digest loops (daily + weekly)
        self._newsletter_daily_task = asyncio.create_task(self._run_newsletter_daily_loop())
        self._newsletter_weekly_task = asyncio.create_task(self._run_newsletter_weekly_loop())
        # Start the coupon scrape loop (every 6 hours by default)
        if getattr(settings, "COUPON_AUTO_SCRAPE", False):
            self._coupon_scrape_task = asyncio.create_task(self._run_coupon_scrape_loop())
        # Start the auction/surplus listing refresh loop (every 4 hours)
        self._listing_scrape_task = asyncio.create_task(self._run_listing_scrape_loop())
        # Start the X engagement automation loop (every 30 minutes) if enabled
        if getattr(settings, "ENGAGEMENT_ENABLED", False):
            self._engagement_task = asyncio.create_task(self._run_engagement_loop())
            logger.info(
                f"Scan scheduler started (interval: {self.interval_minutes}min, "
                f"deal scrape: at {getattr(settings, 'BUFFER_POST_TIMES', '')} {getattr(settings, 'BUFFER_POST_TIMEZONE', 'ET')}, engagement: every 30min, newsletter: daily+weekly)"
            )
        else:
            logger.info(
                f"Scan scheduler started (interval: {self.interval_minutes}min, "
                f"deal scrape: at {getattr(settings, 'BUFFER_POST_TIMES', '')} {getattr(settings, 'BUFFER_POST_TIMEZONE', 'ET')}, engagement: disabled, newsletter: daily+weekly)"
            )
        return True

    def stop(self) -> bool:
        """Stop the background scanner. Returns True if stopped, False if not running."""
        if not self._running:
            logger.warning("Scheduler is not running")
            return False

        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
        if self._deal_task and not self._deal_task.done():
            self._deal_task.cancel()
        if self._engagement_task and not self._engagement_task.done():
            self._engagement_task.cancel()
        if self._resale_reprice_task and not self._resale_reprice_task.done():
            self._resale_reprice_task.cancel()
        if self._coupon_scrape_task and not self._coupon_scrape_task.done():
            self._coupon_scrape_task.cancel()
        if self._listing_scrape_task and not self._listing_scrape_task.done():
            self._listing_scrape_task.cancel()
        self._next_scan_at = None
        logger.info("Scan scheduler stopped")
        return True

    async def _run_loop(self):
        """Main scheduler loop — runs scans at the configured interval."""
        logger.info("Scheduler loop started")

        # Run an initial scan immediately
        await self._run_scan()

        while self._running:
            # Calculate sleep time until next scan
            self._next_scan_at = datetime.utcnow() + timedelta(minutes=self.interval_minutes)
            sleep_seconds = self.interval_minutes * 60

            try:
                await asyncio.sleep(sleep_seconds)
            except asyncio.CancelledError:
                logger.info("Scheduler loop cancelled")
                break

            if not self._running:
                break

            await self._run_scan()

        logger.info("Scheduler loop ended")
        self._next_scan_at = None

    async def _run_deal_scrape_loop(self):
        """Background loop that scrapes and posts one deal to Buffer at scheduled times."""
        post_times = getattr(settings, "BUFFER_POST_TIMES", "")
        timezone = getattr(settings, "BUFFER_POST_TIMEZONE", "America/New_York")
        logger.info(f"Deal scrape + Buffer posting loop started (times: {post_times} {timezone})")

        while self._running:
            sleep_seconds = self._seconds_until_next_post()
            logger.info(f"Next Buffer post in {sleep_seconds}s")

            try:
                await asyncio.sleep(sleep_seconds)
            except asyncio.CancelledError:
                logger.info("Deal scrape loop cancelled")
                break

            if not self._running:
                break

            try:
                await self._scrape_and_post_to_x()
            except Exception as e:
                logger.error(f"Deal scrape loop error: {e}", exc_info=True)

    async def _run_engagement_loop(self):
        """Background loop that runs the X engagement bot every 30 minutes.

        Likes, replies to, and follows deal-hunting accounts on X to grow the
        @bargain4huntrs account. Only runs when ENGAGEMENT_ENABLED is True and
        the required X API v2 tokens are configured.
        """
        ENGAGEMENT_INTERVAL = 30  # minutes
        logger.info("X engagement loop started (every 30min)")

        while self._running:
            try:
                from app.services.engagement_bot import run_engagement_cycle, is_configured

                if not is_configured():
                    logger.info("Engagement bot not configured, skipping cycle")
                else:
                    await run_engagement_cycle()
                    self._last_engagement_at = datetime.utcnow()
            except Exception as e:
                logger.error(f"Engagement loop error: {e}", exc_info=True)

            # Wait for next interval
            try:
                await asyncio.sleep(ENGAGEMENT_INTERVAL * 60)
            except asyncio.CancelledError:
                logger.info("Engagement loop cancelled")
                break

    async def _run_resale_reprice_loop(self):
        """Background loop that refreshes resale pricing suggestions once/day."""
        RESALE_INTERVAL_HOURS = 24
        logger.info("Resale repricing loop started (every 24h)")

        while self._running:
            try:
                await self._refresh_resale_listings()
                self._last_resale_reprice_at = datetime.utcnow()
            except Exception as e:
                logger.error(f"Resale repricing loop error: {e}", exc_info=True)

            try:
                await asyncio.sleep(RESALE_INTERVAL_HOURS * 3600)
            except asyncio.CancelledError:
                logger.info("Resale repricing loop cancelled")
                break

    async def _refresh_resale_listings(self):
        """Recheck market price for every active resale listing and create an
        Alert when a meaningful price change is suggested."""
        from app.db.models import ResaleListing, Alert
        from app.services.resale_pricing import refresh_resale_listing_price

        db = SessionLocal()
        try:
            listings = db.query(ResaleListing).filter(ResaleListing.status == "active").all()
            logger.info(f"Resale repricing: checking {len(listings)} active listings")

            for listing in listings:
                try:
                    result = await refresh_resale_listing_price(listing)
                    listing.competitor_price = result.competitor_price
                    listing.suggested_price = result.suggested_price
                    listing.suggestion_reason = result.reason
                    listing.last_checked_at = result.checked_at
                    db.commit()

                    if result.suggested_price is not None:
                        alert = Alert(
                            user_id=listing.user_id,
                            type="resale_reprice",
                            title=f"Price suggestion: {listing.title[:100]}",
                            description=result.reason,
                            status="pending",
                        )
                        db.add(alert)
                        db.commit()
                except Exception as e:
                    logger.warning(f"Resale reprice failed for listing {listing.id}: {e}")
                    db.rollback()
        finally:
            db.close()

    async def _scrape_and_post_to_x(self):
        """Scrape deals from all sources and post new ones to X via Buffer API."""
        self._last_deal_scrape_at = datetime.utcnow()
        logger.info("Starting deal scrape + X posting cycle...")

        from app.services.amazon_deals_scraper import scrape_all_amazon_deals, save_deals_to_database
        from app.services.rss_deals_scraper import scrape_all_rss_feeds, save_rss_deals_to_database
        from app.services.impact_api import fetch_all_impact_deals, _is_configured as impact_configured
        from app.services.x_poster import post_deal_to_x, is_configured as x_configured

        db = SessionLocal()
        try:
            # Scrape Amazon (Gold Box, Today's Deals, Movers & Shakers, Hot New Releases)
            try:
                amazon_deals = await scrape_all_amazon_deals(max_deals_per_source=50)
                amazon_saved = save_deals_to_database(amazon_deals, db)
                logger.info(f"Amazon: {len(amazon_deals)} found, {amazon_saved} saved")
            except Exception as e:
                logger.error(f"Amazon scrape failed: {e}")

            # Scrape RSS feeds
            try:
                rss_deals = await scrape_all_rss_feeds(min_discount=40)
                rss_saved = save_rss_deals_to_database(rss_deals, db)
                logger.info(f"RSS: {len(rss_deals)} found, {rss_saved} saved")
            except Exception as e:
                logger.error(f"RSS scrape failed: {e}")

            # Backfill images for deals that are missing them (this previously
            # only ran if someone manually hit /deals/update-images/public —
            # it was never actually wired into any automated cycle).
            try:
                from app.services.amazon_deals_scraper import update_missing_images

                images_updated = await update_missing_images(db, max_updates=15)
                if images_updated:
                    logger.info(f"Backfilled {images_updated} missing deal images")
            except Exception as e:
                logger.error(f"Image backfill failed: {e}")

            # Scrape Walmart directly (only does anything with SCRAPER_PROXY_URL set)
            try:
                from app.services.walmart_scraper import search_walmart_deals, save_walmart_deals_to_database

                walmart_deals = await search_walmart_deals(max_deals=50, db_session=db)
                walmart_saved = save_walmart_deals_to_database(walmart_deals, db)
                if walmart_deals:
                    logger.info(f"Walmart: {len(walmart_deals)} found, {walmart_saved} saved")
            except Exception as e:
                logger.error(f"Walmart scrape failed: {e}")

            # Scrape Impact.com product catalogs
            if impact_configured():
                try:
                    impact_deals = await fetch_all_impact_deals()
                    impact_saved = 0
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

                            # Refresh existing deals instead of skipping — see
                            # matching fix in routers/arbitrage.py scrape-all/public.
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

                            # Skip deals that were recently posted (within 7
                            # days) even if they expired — re-creating them
                            # would cause duplicate social posts.
                            deal_url = deal.get("deal_url", "")
                            if deal_url:
                                recently_posted = db.query(ArbitrageDeal).filter(
                                    ArbitrageDeal.buy_url == deal_url,
                                    ArbitrageDeal.alerted_at != None,
                                    ArbitrageDeal.alerted_at > datetime.utcnow() - timedelta(days=7),
                                ).first()
                                if recently_posted:
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
                            new_deal.score = calculate_deal_score(new_deal)
                            db.commit()
                            impact_saved += 1
                        except Exception:
                            db.rollback()
                    logger.info(f"Impact: {len(impact_deals)} found, {impact_saved} saved")
                except Exception as e:
                    logger.error(f"Impact scrape failed: {e}")

            # Expire deals older than 48 hours that haven't been posted
            cutoff = datetime.utcnow() - timedelta(hours=48)
            expired = db.query(ArbitrageDeal).filter(
                ArbitrageDeal.status == "active",
                ArbitrageDeal.alerted_at == None,
                ArbitrageDeal.detected_at < cutoff,
            ).update({ArbitrageDeal.status: "expired"}, synchronize_session=False)
            if expired:
                logger.info(f"Expired {expired} old unposted deals")
                db.commit()

            # Deals that WERE posted are otherwise exempt from expiration
            # forever, so a deal posted once could sit "active" with a
            # stale price on the public feed indefinitely. Give posted
            # deals a much longer, but still finite, lifetime.
            stale_cutoff = datetime.utcnow() - timedelta(days=7)
            stale_expired = db.query(ArbitrageDeal).filter(
                ArbitrageDeal.status == "active",
                ArbitrageDeal.detected_at < stale_cutoff,
            ).update({ArbitrageDeal.status: "expired"}, synchronize_session=False)
            if stale_expired:
                logger.info(f"Expired {stale_expired} stale deals (>7 days old)")
                db.commit()

            # Post new deals to social media via Buffer API
            # ONLY post deals with affiliate tracking links
            if x_configured():
                # Fetch more deals than needed, then filter for affiliate links
                # Order by score (best first) with newest as a tiebreaker.
                # The `score` column is being added in parallel; fall back to the
                # old detected_at-only ordering if it doesn't exist yet.
                try:
                    candidate_deals = (
                        db.query(ArbitrageDeal)
                        .filter(
                            ArbitrageDeal.status == "active",
                            ArbitrageDeal.is_profitable == True,
                            ArbitrageDeal.alerted_at == None,
                        )
                        .order_by(
                            ArbitrageDeal.score.desc(),       # Best deals first
                            ArbitrageDeal.detected_at.desc(),  # Newest as tiebreaker
                        )
                        .limit(20)
                        .all()
                    )
                except Exception:
                    # score column doesn't exist yet — fall back to old ordering
                    logger.info("score column not available, falling back to detected_at ordering")
                    db.rollback()
                    candidate_deals = (
                        db.query(ArbitrageDeal)
                        .filter(
                            ArbitrageDeal.status == "active",
                            ArbitrageDeal.is_profitable == True,
                            ArbitrageDeal.alerted_at == None,
                        )
                        .order_by(ArbitrageDeal.detected_at.desc())
                        .limit(20)
                        .all()
                    )

                # Filter by minimum deal score (if the score attribute is present)
                min_score = settings.MIN_DEAL_SCORE_TO_POST
                scored_deals = []
                for d in candidate_deals:
                    deal_score = getattr(d, "score", None)
                    if deal_score is None or float(deal_score) >= min_score:
                        scored_deals.append(d)
                candidate_deals = scored_deals

                # Ensure retailer diversity — max 2 deals per retailer per cycle
                retailer_counts = {}
                diverse_deals = []
                for d in candidate_deals:
                    retailer = (d.retailer or d.buy_platform or "unknown").lower()
                    if retailer_counts.get(retailer, 0) >= 2:
                        continue
                    retailer_counts[retailer] = retailer_counts.get(retailer, 0) + 1
                    diverse_deals.append(d)
                candidate_deals = diverse_deals

                # Title-based + URL-based dedup: skip deals that match recently posted deals
                # Use 7-day lookback to prevent the same deal from reappearing over multiple days
                dedup_cutoff = datetime.utcnow() - timedelta(days=7)
                recently_posted_titles = set()
                recently_posted_urls = set()
                try:
                    recent_posts = db.query(ArbitrageDeal).filter(
                        ArbitrageDeal.alerted_at != None,
                        ArbitrageDeal.alerted_at > dedup_cutoff,
                    ).all()
                    recently_posted_titles = {d.title.lower().strip() for d in recent_posts}
                    # Extract product SKU/identifier from buy_url for URL-based dedup
                    for d in recent_posts:
                        url = (d.buy_url or "").lower()
                        # Extract prodsku from Walmart URLs, ASIN from Amazon, etc.
                        import re
                        sku_match = re.search(r'prodsku[=:](\w+)', url)
                        asin_match = re.search(r'(/dp/|/ip/)(\w+)', url)
                        if sku_match:
                            recently_posted_urls.add(sku_match.group(1))
                        elif asin_match:
                            recently_posted_urls.add(asin_match.group(2))
                except Exception:
                    pass
                if recently_posted_titles or recently_posted_urls:
                    before = len(candidate_deals)
                    filtered_deals = []
                    for d in candidate_deals:
                        title_key = d.title.lower().strip()
                        url = (d.buy_url or "").lower()
                        # Check title dedup
                        if title_key in recently_posted_titles:
                            continue
                        # Check URL/SKU dedup
                        import re
                        sku_match = re.search(r'prodsku[=:](\w+)', url)
                        asin_match = re.search(r'(/dp/|/ip/)(\w+)', url)
                        sku = sku_match.group(1) if sku_match else None
                        asin = asin_match.group(2) if asin_match else None
                        if sku and sku in recently_posted_urls:
                            continue
                        if asin and asin in recently_posted_urls:
                            continue
                        filtered_deals.append(d)
                    candidate_deals = filtered_deals
                    skipped = before - len(candidate_deals)
                    if skipped:
                        logger.info(f"Skipped {skipped} recently-posted deals (title+URL dedup, 7-day lookback)")

                # Only post deals that have affiliate links
                affiliate_domains = ["sjv.io", "7eer.net", "pxf.io", "evyy.net",
                    "vneoga.net", "elfm.net", "eyjo.net", "gqco.net", "hmxg.net",
                    "ijrn.net", "jewn.net", "jyeh.net", "mtko.net", "tcux.net",
                    "zlvv.net", "goto.walmart.com", "affiliates.abebooks.com",
                    "tag=bargain0ae", "campid=", "affid="]
                max_posts = min(
                    getattr(settings, "MAX_DEALS_PER_CYCLE", 5),
                    getattr(settings, "BUFFER_POSTS_PER_WINDOW", 1),
                )
                new_deals = []
                for d in candidate_deals:
                    url = (d.buy_url or "").lower()
                    if any(x in url for x in affiliate_domains):
                        # Skip deals without real product images
                        img = d.image_url or ""
                        if not img or "/deals/placeholder/" in img or img.endswith(".svg"):
                            continue
                        # Skip non-English deals
                        from app.services.impact_api import _is_non_english_title
                        if _is_non_english_title(d.title or ""):
                            continue
                        new_deals.append(d)
                    if len(new_deals) >= max_posts:
                        break

                if new_deals:
                    logger.info(f"Posting {len(new_deals)} affiliate deals to social media")
                    posted = 0
                    for deal in new_deals:
                        discount = 0
                        if deal.historical_avg and deal.historical_avg > deal.buy_price:
                            discount = int(round((1 - float(deal.buy_price) / float(deal.historical_avg)) * 100))

                        # Use unified direct poster (X + FB + IG native APIs)
                        # with Buffer fallback for unconfigured platforms
                        from app.services.unified_direct_poster import (
                            post_deal_to_all_platforms,
                            _any_direct_configured,
                        )

                        if _any_direct_configured():
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
                        else:
                            result = await post_deal_to_x(
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
                            platforms = result.get("platforms_used", [])
                            logger.info(f"  Posted: {deal.title[:50]} ({', '.join(platforms) or 'buffer'})")
                        else:
                            logger.warning(f"  Post failed: {result.get('error')}")

                        # Small delay between posts
                        await asyncio.sleep(5)

                    logger.info(f"Posting complete: {posted}/{len(new_deals)} posted")
                else:
                    logger.info("No new affiliate deals to post")

                # Log posting metrics for this cycle
                logger.info(
                    f"Posting cycle complete: {len(new_deals)} posted, "
                    f"{len(candidate_deals)} candidates, "
                    f"{expired} expired. "
                    f"Next cycle in {settings.POST_INTERVAL_MINUTES} min."
                )
            else:
                logger.info("Social posting not configured (BUFFER_API_KEY not set)")

            # ─── Post best deals to Discord directly ───────────────────────
            try:
                from app.services.discord_poster import post_deal_to_discord
                from app.core.config import settings as cfg

                if getattr(cfg, "DISCORD_WEBHOOK_URL", None):
                    # Get top 3 deals that haven't been posted to Discord yet
                    discord_candidates = (
                        db.query(ArbitrageDeal)
                        .filter(
                            ArbitrageDeal.status == "active",
                            ArbitrageDeal.is_profitable == True,
                        )
                        .order_by(
                            ArbitrageDeal.score.desc(),
                            ArbitrageDeal.detected_at.desc(),
                        )
                        .limit(3)
                        .all()
                    )

                    discord_posted = 0
                    for deal in discord_candidates:
                        discount = 0
                        if deal.historical_avg and deal.historical_avg > deal.buy_price:
                            discount = int(round((1 - float(deal.buy_price) / float(deal.historical_avg)) * 100))

                        result = await post_deal_to_discord(
                            title=deal.title,
                            deal_price=float(deal.buy_price),
                            original_price=float(deal.historical_avg) if deal.historical_avg else None,
                            discount_percent=discount,
                            retailer=getattr(deal, "retailer", None) or "amazon",
                            deal_url=deal.buy_url or "",
                            image_url=deal.image_url,
                            deal_tier=deal.deal_tier,
                        )

                        if result.get("status") == "success":
                            discord_posted += 1
                            logger.info(f"  Discord posted: {deal.title[:50]}")
                        else:
                            logger.warning(f"  Discord post failed: {result.get('error')}")

                        await asyncio.sleep(2)

                    if discord_posted:
                        logger.info(f"Discord posting: {discord_posted}/{len(discord_candidates)} posted")
                    else:
                        logger.info("No deals posted to Discord this cycle")
                else:
                    logger.info("Discord webhook not configured, skipping")
            except Exception as e:
                logger.error(f"Discord posting failed: {e}", exc_info=True)

            # ─── Post best deal to Pinterest directly ──────────────────────
            try:
                from app.services.pinterest_poster import post_deal_to_pinterest, is_configured as pinterest_configured

                if pinterest_configured():
                    # Get the top deal that hasn't been posted yet
                    pinterest_candidate = (
                        db.query(ArbitrageDeal)
                        .filter(
                            ArbitrageDeal.status == "active",
                            ArbitrageDeal.is_profitable == True,
                        )
                        .order_by(
                            ArbitrageDeal.score.desc(),
                            ArbitrageDeal.detected_at.desc(),
                        )
                        .first()
                    )

                    if pinterest_candidate:
                        discount = 0
                        if pinterest_candidate.historical_avg and pinterest_candidate.historical_avg > pinterest_candidate.buy_price:
                            discount = int(round((1 - float(pinterest_candidate.buy_price) / float(pinterest_candidate.historical_avg)) * 100))

                        result = await post_deal_to_pinterest(
                            title=pinterest_candidate.title,
                            deal_price=float(pinterest_candidate.buy_price),
                            original_price=float(pinterest_candidate.historical_avg) if pinterest_candidate.historical_avg else None,
                            discount_percent=discount,
                            retailer=getattr(pinterest_candidate, "retailer", None) or "amazon",
                            deal_url=pinterest_candidate.buy_url or "",
                            image_url=pinterest_candidate.image_url,
                            deal_tier=pinterest_candidate.deal_tier,
                        )

                        if result.get("status") == "success":
                            logger.info(f"  Pinterest posted: {pinterest_candidate.title[:50]} (pin: {result.get('pin_id')})")
                        else:
                            logger.warning(f"  Pinterest post failed: {result.get('error')}")
                    else:
                        logger.info("No deals to post to Pinterest this cycle")
                else:
                    logger.info("Pinterest not configured, skipping")
            except Exception as e:
                logger.error(f"Pinterest posting failed: {e}", exc_info=True)

            # ─── Send deal alerts to users via email + push ─────────────────
            # NOTE: This only sends to non-X channels (Discord, Telegram, push, SMS).
            # X/Twitter posting is handled exclusively by the X posting section above
            # with proper dedup. We mark the deal as alerted to prevent re-posting.
            try:
                from app.services.notification_service import distribute_deal, DealInfo

                # Get the single best new deal for user notifications
                best_deal = (
                    db.query(ArbitrageDeal)
                    .filter(
                        ArbitrageDeal.status == "active",
                        ArbitrageDeal.is_profitable == True,
                        ArbitrageDeal.alerted_at == None,
                    )
                    .order_by(ArbitrageDeal.score.desc())
                    .first()
                )

                if best_deal:
                    deal_info = DealInfo.from_deal(best_deal)
                    results = await distribute_deal(deal_info, db)
                    posted_count = sum(1 for r in results if r.get("status") == "success")
                    if posted_count:
                        logger.info(f"Deal notifications sent: {posted_count} channels for '{best_deal.title[:40]}'")
                    # Always mark as alerted to prevent re-posting in future cycles,
                    # even if no channels succeeded (avoids infinite retry loops)
                    best_deal.alerted_at = datetime.utcnow()
                    db.commit()
                else:
                    logger.info("No new deals to notify users about")
            except Exception as e:
                logger.error(f"Deal notification failed: {e}", exc_info=True)

        finally:
            db.close()

    async def _run_newsletter_daily_loop(self):
        """Background loop that sends the daily deal digest at 8 AM ET."""
        logger.info("Newsletter daily digest loop started (8 AM ET daily)")
        while self._running:
            try:
                now = datetime.utcnow()
                # 8 AM ET = 12 PM UTC (during EDT) or 1 PM UTC (during EST)
                # Simple approach: check every hour, send at 12 UTC if not already sent today
                if now.hour == 12 and self._last_newsletter_daily_at is not None:
                    if self._last_newsletter_daily_at.date() == now.date():
                        # Already sent today
                        pass
                    else:
                        from app.services.newsletter_service import send_daily_digest
                        sent = send_daily_digest()
                        logger.info(f"Daily digest sent to {sent} subscribers")
                        self._last_newsletter_daily_at = now
                elif now.hour == 12 and self._last_newsletter_daily_at is None:
                    from app.services.newsletter_service import send_daily_digest
                    sent = send_daily_digest()
                    logger.info(f"Daily digest sent to {sent} subscribers")
                    self._last_newsletter_daily_at = now
            except Exception as e:
                logger.error(f"Newsletter daily loop error: {e}", exc_info=True)
            try:
                await asyncio.sleep(3600)  # Check every hour
            except asyncio.CancelledError:
                logger.info("Newsletter daily loop cancelled")
                break

    async def _run_newsletter_weekly_loop(self):
        """Background loop that sends the weekly deal digest on Mondays at 9 AM ET."""
        logger.info("Newsletter weekly digest loop started (Mondays 9 AM ET)")
        while self._running:
            try:
                now = datetime.utcnow()
                # Monday = 0, 9 AM ET ≈ 13 UTC (EDT) or 14 UTC (EST)
                if now.weekday() == 0 and now.hour == 13:
                    if self._last_newsletter_weekly_at is not None:
                        days_since = (now.date() - self._last_newsletter_weekly_at.date()).days
                        if days_since < 7:
                            # Already sent this week
                            pass
                        else:
                            from app.services.newsletter_service import send_weekly_digest
                            sent = send_weekly_digest()
                            logger.info(f"Weekly digest sent to {sent} subscribers")
                            self._last_newsletter_weekly_at = now
                    else:
                        from app.services.newsletter_service import send_weekly_digest
                        sent = send_weekly_digest()
                        logger.info(f"Weekly digest sent to {sent} subscribers")
                        self._last_newsletter_weekly_at = now
            except Exception as e:
                logger.error(f"Newsletter weekly loop error: {e}", exc_info=True)
            try:
                await asyncio.sleep(3600)  # Check every hour
            except asyncio.CancelledError:
                logger.info("Newsletter weekly loop cancelled")
                break

    async def _run_coupon_scrape_loop(self):
        """Background loop that scrapes coupons from Impact + public RSS feeds
        and marks expired coupons every COUPON_SCRAPE_INTERVAL_HOURS (default 6h).
        """
        interval_hours = getattr(settings, "COUPON_SCRAPE_INTERVAL_HOURS", 6)
        logger.info(f"Coupon scrape loop started (every {interval_hours}h)")

        # Run an initial scrape shortly after startup (30s delay to not compete
        # with the initial arbitrage scan)
        try:
            await asyncio.sleep(30)
        except asyncio.CancelledError:
            return

        while self._running:
            try:
                await self._scrape_and_store_coupons()
                self._last_coupon_scrape_at = datetime.utcnow()
            except Exception as e:
                logger.error(f"Coupon scrape loop error: {e}", exc_info=True)

            try:
                await asyncio.sleep(interval_hours * 3600)
            except asyncio.CancelledError:
                logger.info("Coupon scrape loop cancelled")
                break

    async def _run_listing_scrape_loop(self):
        """Background loop that refreshes auction/surplus listings (GSA, ...)
        every LISTING_SCRAPE_INTERVAL_HOURS (default 4h)."""
        from app.services.listing_aggregator import aggregate_gsa_listings

        interval_hours = getattr(settings, "LISTING_SCRAPE_INTERVAL_HOURS", 4)
        logger.info(f"Listing scrape loop started (every {interval_hours}h)")

        # Delay initial run so it doesn't compete with startup scans
        try:
            await asyncio.sleep(60)
        except asyncio.CancelledError:
            return

        while self._running:
            db = SessionLocal()
            try:
                stats = await aggregate_gsa_listings(db)
                logger.info(f"Listing scrape complete: {stats}")
            except Exception as e:
                logger.error(f"Listing scrape loop error: {e}", exc_info=True)
            finally:
                db.close()

            try:
                await asyncio.sleep(interval_hours * 3600)
            except asyncio.CancelledError:
                logger.info("Listing scrape loop cancelled")
                break

    async def _scrape_and_store_coupons(self):
        """Scrape coupons from all sources and upsert into the database.
        Also marks expired coupons as expired.
        """
        from app.services.coupon_scraper import scrape_all_coupons, ScrapedCoupon
        from app.db.models import CouponCode

        logger.info("Starting coupon scrape cycle...")
        db = SessionLocal()
        try:
            scraped_coupons = await scrape_all_coupons()
            saved = 0
            errors = 0

            for sc in scraped_coupons:
                try:
                    existing = db.query(CouponCode).filter(
                        CouponCode.code == sc.code,
                        CouponCode.retailer == sc.retailer,
                    ).first()

                    if existing:
                        existing.title = sc.title
                        existing.description = sc.description
                        existing.discount_type = sc.discount_type
                        existing.discount_value = sc.discount_value
                        existing.min_purchase = sc.min_purchase
                        existing.max_discount = sc.max_discount
                        existing.category = sc.category
                        existing.product_url = sc.product_url
                        existing.source = sc.source
                        existing.source_url = sc.source_url
                        existing.expires_at = sc.expires_at
                        existing.scraped_at = datetime.utcnow()
                        existing.status = "active"
                    else:
                        coupon = CouponCode(
                            code=sc.code,
                            retailer=sc.retailer,
                            title=sc.title,
                            description=sc.description,
                            discount_type=sc.discount_type,
                            discount_value=sc.discount_value,
                            min_purchase=sc.min_purchase,
                            max_discount=sc.max_discount,
                            category=sc.category,
                            product_url=sc.product_url,
                            source=sc.source,
                            source_url=sc.source_url,
                            expires_at=sc.expires_at,
                            status="active",
                            scraped_at=datetime.utcnow(),
                        )
                        db.add(coupon)
                    saved += 1
                except Exception:
                    errors += 1

            db.commit()

            # Mark expired coupons
            expired_count = db.query(CouponCode).filter(
                CouponCode.expires_at < datetime.utcnow(),
                CouponCode.status == "active",
            ).update({CouponCode.status: "expired"}, synchronize_session=False)
            if expired_count:
                db.commit()
                logger.info(f"Marked {expired_count} coupons as expired")

            logger.info(f"Coupon scrape complete: {len(scraped_coupons)} fetched, {saved} saved, {errors} errors")
        finally:
            db.close()

    async def _run_scan(self):
        """Run a single scan cycle."""
        self._last_scan_at = datetime.utcnow()
        logger.info("Starting scheduled scan...")

        db = SessionLocal()
        scan_run = ScanRun(
            scan_type="amazon_ebay_scheduled",
            status="running",
        )
        db.add(scan_run)
        db.commit()
        db.refresh(scan_run)

        try:
            # Run the bulk scan
            opportunities = await scan_amazon_for_arbitrage(
                category="",
                min_discount=Decimal("0.50"),
                max_price=Decimal("500.00"),
                limit=20,
                sell_platform=Platform.EBAY,
            )

            scan_run.products_scanned = 20
            scan_run.deals_found = len(opportunities)

            # Save profitable deals and create alerts for all active users
            deals_alerted = 0
            users = db.query(User).filter(User.is_active == True).all()

            for opp in opportunities:
                if not opp.is_profitable:
                    continue

                # Save the deal to the database
                deal = _save_opportunity(db, opp)
                db.commit()

                # Skip notification if this deal was already alerted (posted to
                # social media or notified before). This prevents duplicate posts
                # across multiple scheduler cycles and container restarts.
                if deal.alerted_at is not None:
                    logger.info(f"Skipping notification for {opp.asin} — already alerted at {deal.alerted_at}")
                    continue

                # Distribute to notification channels (Discord, Telegram, Facebook, SMS, push)
                # NOTE: X/Twitter posting is NOT done here — it's handled exclusively
                # by _scrape_and_post_to_x() which has proper dedup logic.
                deal_info = DealInfo.from_opportunity(opp)
                # SMS recipients are filtered by niche subscription: a user with
                # no subscriptions receives all niches; otherwise only their picks.
                sms_recipients = get_sms_recipients(db, niche=opp.niche)
                try:
                    await distribute_deal(deal_info, db, sms_recipients=sms_recipients)
                except Exception as e:
                    logger.error(f"Notification distribution failed for {opp.asin}: {e}")

                # Create email alerts only for users subscribed to this niche
                # (users with no niche subscription receive all niches)
                for user in users:
                    if not user_subscribed_to_niche(user, opp.niche):
                        continue
                    alert = create_alert_for_opportunity(db, user, opp)
                    if alert:
                        deals_alerted += 1

            scan_run.deals_alerted = deals_alerted
            scan_run.completed_at = datetime.utcnow()
            scan_run.status = "completed"
            db.commit()

            self._last_scan_status = "completed"
            self._last_error = None
            logger.info(
                f"Scheduled scan completed: {len(opportunities)} deals found, "
                f"{deals_alerted} alerts sent"
            )

        except Exception as e:
            scan_run.status = "failed"
            scan_run.error = str(e)
            scan_run.completed_at = datetime.utcnow()
            db.commit()

            self._last_scan_status = "failed"
            self._last_error = str(e)
            logger.error(f"Scheduled scan failed: {e}", exc_info=True)

        finally:
            db.close()


def _save_opportunity(db, opp: ArbitrageOpportunity) -> ArbitrageDeal:
    """Save an ArbitrageOpportunity to the database (dedup within 24h)."""
    cutoff = datetime.utcnow() - timedelta(hours=24)
    existing = db.query(ArbitrageDeal).filter(
        ArbitrageDeal.asin == opp.asin,
        ArbitrageDeal.detected_at >= cutoff,
    ).first()

    if existing:
        # Update existing deal with latest data
        existing.buy_price = opp.buy_price
        existing.sell_price = opp.sell_price
        if opp.profit:
            existing.net_profit = opp.profit.net_profit
            existing.roi = opp.profit.roi
            existing.total_costs = opp.profit.total_costs
            existing.platform_fee = opp.profit.platform_fee
        existing.is_profitable = opp.is_profitable
        existing.detected_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing

    deal = ArbitrageDeal(
        asin=opp.asin,
        title=opp.title,
        image_url=opp.image_url,
        buy_url=opp.buy_url,
        buy_price=opp.buy_price,
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
        is_profitable=opp.is_profitable,
        status="active",
    )
    db.add(deal)
    deal.score = calculate_deal_score(deal)
    db.commit()
    db.refresh(deal)
    return deal


# Global scheduler instance
scheduler = ScanScheduler()
