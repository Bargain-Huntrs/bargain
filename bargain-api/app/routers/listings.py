"""
Listings API — government surplus and auction inventory.

Serves aggregated public auction listings (GSA Auctions first, GovDeals and
more later) for the /auctions section. Listings are advertisements hosted on
the source platforms — BargainHuntrs links out, never brokers.
"""
import logging
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.db.session import get_db, SessionLocal
from app.db.models import Listing
from app.routers.arbitrage import _verify_cron_secret
from app.services.listing_aggregator import (
    aggregate_gsa_listings,
    resolve_listing_images,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/listings", tags=["listings"])


class ListingResponse(BaseModel):
    id: UUID
    source: str
    source_id: str
    category: str
    title: str
    description: Optional[str] = None
    source_category: Optional[str] = None
    current_bid: Optional[Decimal] = None
    min_bid: Optional[Decimal] = None
    num_bids: Optional[int] = None
    sale_method: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    image_url: Optional[str] = None
    detail_url: str
    first_seen_at: Optional[datetime] = None
    last_seen_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ListingListResponse(BaseModel):
    items: List[ListingResponse]
    total: int
    page: int
    per_page: int
    pages: int


def _serialize(listing: Listing, image_map: dict) -> ListingResponse:
    resp = ListingResponse.model_validate(listing)
    resolved = image_map.get(listing.image_url or "")
    if resolved:
        resp.image_url = resolved
    return resp


@router.get("", response_model=ListingListResponse)
async def list_listings(
    category: Optional[str] = Query(None, max_length=50),
    source: Optional[str] = Query(None, max_length=50),
    state: Optional[str] = Query(None, max_length=2),
    city: Optional[str] = Query(None, max_length=120),
    q: Optional[str] = Query(None, max_length=200, description="Title/description search"),
    min_bid: Optional[float] = Query(None, ge=0),
    max_bid: Optional[float] = Query(None, ge=0),
    sort: str = Query("ending_soon", pattern="^(ending_soon|newest|bid_asc|bid_desc)$"),
    page: int = Query(1, ge=1),
    per_page: int = Query(24, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """List active auction/surplus listings with filters and pagination."""
    query = db.query(Listing).filter(Listing.is_active == True)  # noqa: E712

    if category:
        query = query.filter(Listing.category == category)
    if source:
        query = query.filter(Listing.source == source)
    if state:
        query = query.filter(Listing.state == state.upper())
    if city:
        query = query.filter(Listing.city.ilike(city))
    if min_bid is not None:
        query = query.filter(Listing.current_bid >= min_bid)
    if max_bid is not None:
        query = query.filter(Listing.current_bid <= max_bid)
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(Listing.title.ilike(like), Listing.description.ilike(like))
        )

    if sort == "bid_asc":
        query = query.order_by(Listing.current_bid.asc().nullslast())
    elif sort == "bid_desc":
        query = query.order_by(Listing.current_bid.desc().nullslast())
    elif sort == "newest":
        query = query.order_by(Listing.first_seen_at.desc())
    else:  # ending_soon — live auctions closing first, previews last
        query = query.order_by(Listing.end_date.asc().nullslast())

    total = query.count()
    items = query.offset((page - 1) * per_page).limit(per_page).all()

    image_map = await resolve_listing_images(items)
    pages = (total + per_page - 1) // per_page
    return ListingListResponse(
        items=[_serialize(l, image_map) for l in items],
        total=total,
        page=page,
        per_page=per_page,
        pages=pages,
    )


@router.get("/categories")
async def listing_categories(db: Session = Depends(get_db)):
    """Active listing counts grouped by our normalized category."""
    rows = (
        db.query(Listing.category, func.count(Listing.id))
        .filter(Listing.is_active == True)  # noqa: E712
        .group_by(Listing.category)
        .order_by(Listing.category)
        .all()
    )
    return {"categories": [{"category": c, "count": n} for c, n in rows]}


@router.get("/states")
async def listing_states(db: Session = Depends(get_db)):
    """States with active listings, for filter dropdowns."""
    rows = (
        db.query(Listing.state, func.count(Listing.id))
        .filter(Listing.is_active == True, Listing.state.isnot(None))  # noqa: E712
        .group_by(Listing.state)
        .order_by(Listing.state)
        .all()
    )
    return {"states": [{"state": s, "count": c} for s, c in rows]}


@router.get("/{listing_id}", response_model=ListingResponse)
async def get_listing(listing_id: UUID, db: Session = Depends(get_db)):
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found")
    image_map = await resolve_listing_images([listing])
    return _serialize(listing, image_map)


@router.post("/refresh", response_model=dict)
async def refresh_listings(_: None = Depends(_verify_cron_secret)):
    """Cron/admin trigger: fetch latest auction listings and upsert."""
    db = SessionLocal()
    try:
        stats = await aggregate_gsa_listings(db)
        return {"ok": True, "stats": stats, "ran_at": datetime.utcnow().isoformat()}
    finally:
        db.close()
