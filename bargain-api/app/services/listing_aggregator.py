"""Auction/surplus listing aggregator — pulls public government surplus feeds.

Phase 1 source: GSA Auctions (gsaauctions.gov), the federal personal-property
marketplace. Its public search API (used by the SPA itself, no auth) returns
live lots with bids, locations, and closing dates.

Dedup: rows are keyed on (source, source_id) where source_id is the GSA
``lotId``. Rows that vanish from the feed are marked inactive, not deleted.

Images: GSA serves photos via expiring S3 presigned URLs. We store the raw
``uri`` (e.g. ``sales/41QSCI26481/1/2590850.JPG``) and resolve fresh URLs at
read time via the public ``/api/v1/storage/presigned-urls`` endpoint.

Compliance: listings are advertisements hosted on the source site — we link
out to detail_url, never broker the transaction.
"""
import asyncio
import logging
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Optional

import httpx
from sqlalchemy.orm import Session

from app.db.models import Listing

logger = logging.getLogger(__name__)

GSA_SOURCE = "gsa_auctions"
GSA_API_BASE = "https://www.ppms.gov/gw/auction/ppms"
GSA_COMMON_BASE = "https://www.ppms.gov/gw/common/ppms"
GSA_SITE = "https://www.gsaauctions.gov"

PAGE_SIZE = 50
MAX_PAGES_PER_STATUS = 40  # hard cap; GSA active inventory is far smaller
AUCTION_STATUSES = ("active", "preview")

# GSA category codes -> normalized BargainHuntrs category
GSA_CATEGORY_MAP = {
    "20": "vehicle",    # Aircraft and Aircraft Parts
    "40": "vehicle",    # Boats and Marine Equipment
    "90": "vehicle",    # Fire Trucks and Fire Fighting Equipment
    "130": "collectible",  # Artifacts, Jewelry and Exotic Collectibles
    "170": "vehicle",   # Motorcycles & Bicycles
    "200": "vehicle",   # Trailers, Tractors and Manufactured Housing
    "300": "vehicle",   # Vehicles
}

UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}


def _to_decimal(value) -> Optional[Decimal]:
    if value in (None, "", "null"):
        return None
    try:
        return Decimal(str(value).replace(",", "").replace("$", ""))
    except (InvalidOperation, ValueError):
        return None


def _to_int(value) -> Optional[int]:
    if value in (None, "", "null"):
        return None
    try:
        return int(float(str(value)))
    except (ValueError, TypeError):
        return None


def _to_datetime(value) -> Optional[datetime]:
    """Parse GSA ISO datetimes (``2026-09-03T10:00:00``)."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return None


def _gsa_detail_url(auction_id) -> str:
    return f"{GSA_SITE}/auctions/preview/{auction_id}"


def _gsa_record(raw: dict, category_names: dict) -> Optional[dict]:
    """Map a raw GSA auctionDTO onto the Listing column set."""
    lot_id = raw.get("lotId")
    title = (raw.get("lotName") or "").strip()
    auction_id = raw.get("auctionId")
    if not lot_id or not title or not auction_id:
        return None
    loc = raw.get("location") or {}
    code = str(raw.get("categoryCode") or "")
    return {
        "source": GSA_SOURCE,
        "source_id": str(lot_id),
        "category": GSA_CATEGORY_MAP.get(code, "surplus"),
        "title": title[:500],
        "description": raw.get("lotDescription") or raw.get("saleDetails"),
        "source_category": category_names.get(code),
        "current_bid": _to_decimal(raw.get("currentBid")),
        "min_bid": _to_decimal(raw.get("minBid")),
        "num_bids": _to_int(raw.get("numberOfBidders")),
        "sale_method": raw.get("saleMethod"),
        "status": raw.get("status"),
        "start_date": _to_datetime(raw.get("startDate")),
        "end_date": _to_datetime(raw.get("endDate")),
        "city": loc.get("city"),
        "state": (loc.get("state") or "").upper() or None,
        "zip": loc.get("zipCode"),
        "country": "US",
        "image_url": raw.get("uri"),  # raw storage uri — resolved at read time
        "detail_url": _gsa_detail_url(auction_id),
    }


async def fetch_gsa_page(
    client: httpx.AsyncClient, status_filter: str, page: int
) -> dict:
    """One page of the GSA public lot search."""
    body = {
        "advancedSearchText": "",
        "auctionSearchTypeAdvanced": "contains",
        "auctionStatus": status_filter,
        "categoryCodeList": [],
        "unCheckedCategoryList": [],
        "states": [],
        "zipCode": "",
        "radius": "",
        "auctionType": "",
        "saleNumber": "",
        "auctionEndDateFrom": "",
        "auctionEndDateTo": "",
    }
    resp = await client.post(
        f"{GSA_API_BASE}/api/v1/auctions",
        params={"page": page, "size": PAGE_SIZE},
        json=body,
    )
    resp.raise_for_status()
    return resp.json()


async def resolve_gsa_image_urls(
    client: httpx.AsyncClient, uris: list[str]
) -> dict[str, str]:
    """Batch-resolve raw GSA storage uris to fresh presigned URLs."""
    files = [
        {"id": str(i), "fileName": uri.rsplit("/", 1)[-1], "uri": uri}
        for i, uri in enumerate(uris)
    ]
    try:
        resp = await client.post(
            f"{GSA_COMMON_BASE}/api/v1/storage/presigned-urls", json=files
        )
        resp.raise_for_status()
        return {
            item["uri"]: item["presignedUrl"]
            for item in resp.json()
            if item.get("uri") and item.get("presignedUrl")
        }
    except Exception as e:
        logger.warning(f"GSA presigned-url resolution failed: {e}")
        return {}


async def resolve_listing_images(listings: list[Listing]) -> dict[str, str]:
    """Resolve raw GSA storage uris to fresh presigned URLs.

    Returns a ``{uri: presigned_url}`` map — callers apply it to the
    serialized response. Never write presigned URLs back to the DB: they
    expire after ~1 hour while the raw uri is permanent.
    """
    uris = [
        l.image_url
        for l in listings
        if l.source == GSA_SOURCE and l.image_url and not l.image_url.startswith("http")
    ]
    if not uris:
        return {}
    async with httpx.AsyncClient(timeout=15.0, headers=UA) as client:
        return await resolve_gsa_image_urls(client, uris)


async def aggregate_gsa_listings(db: Session) -> dict:
    """Fetch all active + preview GSA lots and upsert into ``listings``.

    Rows not seen in the latest fetch are marked inactive rather than
    deleted, preserving history and dedup stability.
    """
    now = datetime.utcnow()
    stats = {"fetched": 0, "created": 0, "updated": 0, "deactivated": 0, "errors": 0}
    seen_ids: set[str] = set()

    async with httpx.AsyncClient(timeout=30.0, headers=UA) as client:
        for status_filter in AUCTION_STATUSES:
            for page in range(1, MAX_PAGES_PER_STATUS + 1):
                try:
                    data = await fetch_gsa_page(client, status_filter, page)
                except Exception as e:
                    stats["errors"] += 1
                    logger.error(f"GSA {status_filter} page {page} fetch error: {e}")
                    break
                lots = data.get("auctionDTOList") or []
                category_names = {
                    str(c.get("categoryCode")): c.get("categoryName")
                    for c in (data.get("lotAuctionsCategoryCountDTOList") or [])
                }
                stats["fetched"] += len(lots)

                for raw in lots:
                    rec = _gsa_record(raw, category_names)
                    if not rec:
                        continue
                    seen_ids.add(rec["source_id"])
                    existing = (
                        db.query(Listing)
                        .filter(
                            Listing.source == rec["source"],
                            Listing.source_id == rec["source_id"],
                        )
                        .first()
                    )
                    if existing:
                        for k, v in rec.items():
                            if k not in ("source", "source_id"):
                                setattr(existing, k, v)
                        existing.is_active = True
                        existing.last_seen_at = now
                        stats["updated"] += 1
                    else:
                        db.add(
                            Listing(
                                **rec,
                                is_active=True,
                                last_seen_at=now,
                                first_seen_at=now,
                            )
                        )
                        stats["created"] += 1

                db.commit()
                if page >= (data.get("totalPages") or 1):
                    break
                await asyncio.sleep(1.0)  # politeness between pages

    # Deactivate GSA rows that vanished from both feeds
    stale = (
        db.query(Listing)
        .filter(
            Listing.source == GSA_SOURCE,
            Listing.is_active == True,  # noqa: E712
        )
        .all()
    )
    for listing in stale:
        if listing.source_id not in seen_ids:
            listing.is_active = False
            listing.updated_at = now
            stats["deactivated"] += 1
    db.commit()

    logger.info(f"GSA aggregation complete: {stats}")
    return stats
