"""Property aggregator — pulls distressed/REO listings from public sources.

Phase 1 source: HUD Home Store (hudhomestore.gov), the federal bank-REO
marketplace. Its state search page embeds the full listing set as JSON in a
hidden ``available_prop`` input — no JS execution needed.

Dedup: rows are keyed on (source, source_id). ``address_hash`` (normalized
street+city+state+zip sha256) is indexed so future sources that overlap the
same physical property can be linked/merged instead of duplicated.

Compliance: listings are treated as advertisements hosted on the source
site — we link out to detail_url, never broker the transaction.
"""
import asyncio
import hashlib
import html as html_lib
import json
import logging
import re
import time
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
from typing import Optional

import httpx
from sqlalchemy.orm import Session

from app.db.models import Property

logger = logging.getLogger(__name__)

HUD_BASE = "https://www.hudhomestore.gov"
HUD_SOURCE = "hud_homestore"

US_STATES = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID",
    "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS",
    "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK",
    "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV",
    "WI", "WY", "DC",
]

_AVAILABLE_PROP_RE = re.compile(
    r'id="available_prop" value="(\[.*?\])"\s*/?>', re.S
)


def normalize_address_hash(
    address: str, city: str, state: str, zip_code: str
) -> str:
    """Deterministic dedup key for a physical property.

    Normalizes case/whitespace and common street suffixes so the same
    address arriving from different sources collides on one hash.
    """
    norm = " ".join((address or "").upper().split())
    norm = re.sub(r"\b(STREET)\b", "ST", norm)
    norm = re.sub(r"\b(AVENUE)\b", "AVE", norm)
    norm = re.sub(r"\b(ROAD)\b", "RD", norm)
    norm = re.sub(r"\b(DRIVE)\b", "DR", norm)
    norm = re.sub(r"\b(LANE)\b", "LN", norm)
    norm = re.sub(r"\b(BOULEVARD)\b", "BLVD", norm)
    norm = re.sub(r"\b(COURT)\b", "CT", norm)
    norm = re.sub(r"\b(PLACE)\b", "PL", norm)
    norm = re.sub(r"\b(NORTH|SOUTH|EAST|WEST)\b",
                  lambda m: {"NORTH": "N", "SOUTH": "S", "EAST": "E", "WEST": "W"}[m.group(1)],
                  norm)
    key = "|".join(
        [
            norm,
            " ".join((city or "").upper().split()),
            (state or "").upper().strip(),
            (zip_code or "")[:5],
        ]
    )
    return hashlib.sha256(key.encode()).hexdigest()


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


def _to_date(value) -> Optional[date]:
    """Parse HUD MM/DD/YYYY dates."""
    if not value:
        return None
    for fmt in ("%m/%d/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(value).strip(), fmt).date()
        except ValueError:
            continue
    return None


def extract_hud_listings(page_html: str) -> list[dict]:
    """Pull the embedded listing JSON array out of a HUD search page."""
    m = _AVAILABLE_PROP_RE.search(page_html or "")
    if not m:
        return []
    try:
        data = json.loads(html_lib.unescape(m.group(1)))
    except json.JSONDecodeError:
        logger.warning("HUD available_prop JSON failed to parse")
        return []
    return data if isinstance(data, list) else []


def _hud_detail_url(case_number: str) -> str:
    return f"{HUD_BASE}/propertydetails?casenumber={case_number}"


def _hud_record(raw: dict) -> Optional[dict]:
    """Map a raw HUD listing dict onto the Property column set."""
    case = (raw.get("propertyCaseNumber") or "").strip()
    address = (raw.get("propertyAddress") or "").strip()
    if not case or not address:
        return None
    city = (raw.get("propertyCity") or "").strip()
    state = (raw.get("propertyState") or "").strip().upper()
    zip_code = (raw.get("propertyZip") or "").strip()
    return {
        "source": HUD_SOURCE,
        "source_id": case,
        "address": address,
        "city": city,
        "state": state,
        "zip": zip_code,
        "county": raw.get("propertyCounty"),
        "address_hash": normalize_address_hash(address, city, state, zip_code),
        "list_price": _to_decimal(raw.get("listPrice")),
        "bedrooms": _to_decimal(raw.get("bedrooms")),
        "bathrooms": _to_decimal(raw.get("bathroomsdecimal") or raw.get("bathrooms")),
        "sqft": _to_int(raw.get("squareFootage")),
        "year_built": _to_int(raw.get("yearBuilt")),
        "property_type": raw.get("propertyType"),
        "status": raw.get("propertyStatus") or raw.get("propertyStatusDesc"),
        "listing_period": raw.get("listingPeriod"),
        "fha_financing": raw.get("fhaFinancing"),
        "eligible_bidders": (raw.get("eligibleBidders") or "")[:150] or None,
        "list_date": _to_date(raw.get("listDate")),
        "bid_open_date": _to_date(raw.get("bidOpenDate")),
        "period_deadline": _to_date(raw.get("periodDeadlineDate")),
        "latitude": float(raw["latitude"]) if raw.get("latitude") else None,
        "longitude": float(raw["longitude"]) if raw.get("longitude") else None,
        "image_url": raw.get("propertyThumb"),
        "detail_url": _hud_detail_url(case),
    }


async def fetch_hud_state_listings(client: httpx.AsyncClient, state: str) -> list[dict]:
    """Fetch and parse one state's HUD listing page."""
    url = f"{HUD_BASE}/searchresult?citystate={state}"
    resp = await client.get(url)
    if resp.status_code != 200:
        logger.warning(f"HUD fetch failed for {state}: HTTP {resp.status_code}")
        return []
    listings = extract_hud_listings(resp.text)
    logger.info(f"HUD {state}: {len(listings)} listings")
    return listings


async def aggregate_hud_properties(
    db: Session, states: Optional[list[str]] = None
) -> dict:
    """Fetch HUD listings for the given states (default: all) and upsert.

    Rows not seen in the latest fetch for their state are marked inactive
    rather than deleted, preserving history and dedup stability.
    """
    states = states or US_STATES
    now = datetime.utcnow()
    stats = {"states": 0, "fetched": 0, "created": 0, "updated": 0, "deactivated": 0, "errors": 0}

    # Plain httpx works for hudhomestore.gov — TLS-impersonating clients
    # (curl_cffi browser profiles) actually trigger its bot check.
    headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True, headers=headers) as client:
        for state in states:
            stats["states"] += 1
            try:
                raw_listings = await fetch_hud_state_listings(client, state)
            except Exception as e:
                stats["errors"] += 1
                logger.error(f"HUD {state} fetch error: {e}")
                await asyncio.sleep(3.0)
                continue
            stats["fetched"] += len(raw_listings)

            seen_ids: set[str] = set()
            for raw in raw_listings:
                rec = _hud_record(raw)
                if not rec:
                    continue
                seen_ids.add(rec["source_id"])
                existing = (
                    db.query(Property)
                    .filter(
                        Property.source == rec["source"],
                        Property.source_id == rec["source_id"],
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
                    db.add(Property(**rec, is_active=True, last_seen_at=now, first_seen_at=now))
                    stats["created"] += 1

            # Deactivate HUD rows in this state that vanished from the feed
            stale = (
                db.query(Property)
                .filter(
                    Property.source == HUD_SOURCE,
                    Property.state == state,
                    Property.is_active == True,  # noqa: E712
                )
                .all()
            )
            for prop in stale:
                if prop.source_id not in seen_ids:
                    prop.is_active = False
                    prop.updated_at = now
                    stats["deactivated"] += 1

            db.commit()
            # Politeness: ~2s between state pages
            await asyncio.sleep(2.0)

    logger.info(f"HUD aggregation complete: {stats}")
    return stats
