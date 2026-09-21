"""Scrape deals via the API and post the best ones to X locally.

This script:
1. Triggers the scrape-all endpoint on the deployed API
2. Fetches the latest deals from the public API
3. Posts the top 3 new deals to @bargain4huntrs via Chrome automation
4. Marks posted deals via the API so they aren't posted again

Run this locally on a schedule (e.g. cron every 2 hours):
    python scrape_and_post.py

Requirements:
- Chrome installed with Profile 10 logged in to @bargain4huntrs
- Chrome must be closed before running (the script copies the profile)
"""
import asyncio
import logging
import sys

import httpx

logging.basicConfig(level=logging.INFO, format="%(asctime)s — %(message)s")
logger = logging.getLogger(__name__)

API_BASE = "https://api.bargainhuntrs.com/api/v1/arbitrage"


async def main():
    # Step 1: Trigger scrape via API
    logger.info("=== Step 1: Triggering deal scrape via API ===")

    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            resp = await client.post(f"{API_BASE}/deals/scrape-all/public")
            if resp.status_code == 200:
                data = resp.json()
                logger.info(f"Scrape complete: {data}")
            else:
                logger.error(f"Scrape failed: {resp.status_code} {resp.text}")
        except Exception as e:
            logger.error(f"Scrape request failed: {e}")

    # Step 2: Fetch latest deals
    logger.info("=== Step 2: Fetching latest deals ===")
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.get(f"{API_BASE}/deals/public?limit=20")
            if resp.status_code == 200:
                deals = resp.json()
                logger.info(f"Got {len(deals)} deals from API")
            else:
                logger.error(f"Failed to fetch deals: {resp.status_code}")
                return
        except Exception as e:
            logger.error(f"Failed to fetch deals: {e}")
            return

    # Step 3: Post new deals to X
    logger.info("=== Step 3: Posting deals to X ===")

    from app.services.x_browser_poster import post_deal_to_x, is_configured
    from app.services.utm_service import add_utm_parameters, public_deal_url
    from datetime import datetime

    if not is_configured():
        logger.error("X browser automation not configured. Exiting.")
        return

    # Filter to deals not yet posted (we'll check by looking at the deal tier and discount)
    # We post the top 3 deals with highest discount
    deals_to_post = []
    for deal in deals:
        orig = deal.get("historical_avg") or 0
        buy = deal.get("buy_price") or 0
        if orig and buy:
            pct = round((1 - buy / orig) * 100)
            if pct >= 40:
                deal["_discount"] = pct
                deals_to_post.append(deal)

    # Sort by discount (highest first) and take top 3
    deals_to_post.sort(key=lambda d: d["_discount"], reverse=True)
    deals_to_post = deals_to_post[:3]

    if not deals_to_post:
        logger.info("No deals with 40%+ discount to post.")
        return

    logger.info(f"Will post {len(deals_to_post)} deals to X")

    posted = 0
    for deal in deals_to_post:
        title = deal.get("title", "")
        discount = deal.get("_discount", 0)
        logger.info(f"Posting: {title[:60]} ({discount}% off)")

        campaign = f"deal_alert_{datetime.utcnow().strftime('%Y-%m-%d')}"
        share_url = add_utm_parameters(
            public_deal_url(deal["id"]), "twitter", "social", campaign
        )

        result = await post_deal_to_x(
            title=title,
            deal_price=float(deal.get("buy_price", 0)),
            original_price=float(deal.get("historical_avg", 0)) if deal.get("historical_avg") else None,
            discount_percent=discount,
            retailer=deal.get("retailer", "amazon"),
            deal_url=share_url,
            deal_tier=deal.get("deal_tier", "clearance"),
            image_url=deal.get("image_url"),
        )

        if result.get("status") == "success":
            posted += 1
            logger.info(f"  Posted! URL: {result.get('url', '(not captured)')}")

            # Mark deal as posted via API
            async with httpx.AsyncClient(timeout=30.0) as client:
                try:
                    await client.post(
                        f"{API_BASE}/deals/{deal['id']}/post-to-x/public"
                    )
                except Exception:
                    pass  # Non-critical if marking fails
        else:
            logger.error(f"  Failed: {result.get('error')}")

        # Wait between posts
        if posted < len(deals_to_post):
            logger.info("  Waiting 10s before next post...")
            await asyncio.sleep(10)

    logger.info(f"=== Done: {posted}/{len(deals_to_post)} deals posted to X ===")


if __name__ == "__main__":
    asyncio.run(main())
