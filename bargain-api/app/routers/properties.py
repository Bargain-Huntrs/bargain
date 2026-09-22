"""
Properties API — distressed / off-market real-estate listings.

Serves aggregated public REO inventory (HUD Home Store, more sources later)
for the /real-estate section. Listings are advertisements for properties
hosted on the source platforms — BargainHuntrs links out, never brokers.
"""
import asyncio
import logging
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.db.session import get_db, SessionLocal
from app.db.models import Property
from app.routers.arbitrage import _verify_cron_secret
from app.services.property_aggregator import aggregate_hud_properties, US_STATES

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/properties", tags=["properties"])


class PropertyResponse(BaseModel):
    id: UUID
    source: str
    source_id: str
    address: str
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    county: Optional[str] = None
    list_price: Optional[Decimal] = None
    bedrooms: Optional[Decimal] = None
    bathrooms: Optional[Decimal] = None
    sqft: Optional[int] = None
    year_built: Optional[int] = None
    property_type: Optional[str] = None
    status: Optional[str] = None
    listing_period: Optional[str] = None
    fha_financing: Optional[str] = None
    eligible_bidders: Optional[str] = None
    list_date: Optional[date] = None
    bid_open_date: Optional[date] = None
    period_deadline: Optional[date] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    image_url: Optional[str] = None
    detail_url: str
    first_seen_at: Optional[datetime] = None
    last_seen_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PropertyListResponse(BaseModel):
    items: List[PropertyResponse]
    total: int
    page: int
    per_page: int
    pages: int


@router.get("", response_model=PropertyListResponse)
async def list_properties(
    state: Optional[str] = Query(None, max_length=2),
    city: Optional[str] = Query(None, max_length=120),
    zip: Optional[str] = Query(None, max_length=10),
    q: Optional[str] = Query(None, max_length=120, description="Address/city/county search"),
    source: Optional[str] = Query(None, max_length=50),
    property_type: Optional[str] = Query(None, max_length=100),
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    min_beds: Optional[float] = Query(None, ge=0),
    sort: str = Query("newest", pattern="^(newest|price_asc|price_desc|sqft_desc)$"),
    page: int = Query(1, ge=1),
    per_page: int = Query(24, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """List active distressed-property listings with filters and pagination."""
    query = db.query(Property).filter(Property.is_active == True)  # noqa: E712

    if state:
        query = query.filter(Property.state == state.upper())
    if city:
        query = query.filter(Property.city.ilike(city))
    if zip:
        query = query.filter(Property.zip == zip)
    if source:
        query = query.filter(Property.source == source)
    if property_type:
        query = query.filter(Property.property_type.ilike(f"%{property_type}%"))
    if min_price is not None:
        query = query.filter(Property.list_price >= min_price)
    if max_price is not None:
        query = query.filter(Property.list_price <= max_price)
    if min_beds is not None:
        query = query.filter(Property.bedrooms >= min_beds)
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                Property.address.ilike(like),
                Property.city.ilike(like),
                Property.county.ilike(like),
            )
        )

    total = query.count()

    if sort == "price_asc":
        query = query.order_by(Property.list_price.asc().nulls_last())
    elif sort == "price_desc":
        query = query.order_by(Property.list_price.desc().nulls_last())
    elif sort == "sqft_desc":
        query = query.order_by(Property.sqft.desc().nulls_last())
    else:
        query = query.order_by(Property.list_date.desc().nulls_last(), Property.first_seen_at.desc())

    items = query.offset((page - 1) * per_page).limit(per_page).all()

    return PropertyListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=(total + per_page - 1) // per_page,
    )


@router.get("/states", response_model=dict)
async def list_states(db: Session = Depends(get_db)):
    """States with active listings, for filter dropdowns."""
    rows = (
        db.query(Property.state, func.count(Property.id))
        .filter(Property.is_active == True, Property.state.isnot(None))  # noqa: E712
        .group_by(Property.state)
        .order_by(Property.state)
        .all()
    )
    return {"states": [{"state": s, "count": c} for s, c in rows], "supported": US_STATES}


@router.get("/{property_id}", response_model=PropertyResponse)
async def get_property(property_id: UUID, db: Session = Depends(get_db)):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    return prop


@router.post("/refresh", response_model=dict)
async def refresh_properties(
    states: Optional[str] = Query(None, description="Comma-separated state codes; default all"),
    _: None = Depends(_verify_cron_secret),
):
    """Cron/admin trigger: fetch latest listings from sources and upsert.

    Runs the HUD aggregation synchronously — ~50 state pages at the client's
    rate limit takes a couple of minutes. Intended for scheduled jobs.
    """
    state_list = [s.strip().upper() for s in states.split(",")] if states else None
    db = SessionLocal()
    try:
        stats = await aggregate_hud_properties(db, states=state_list)
        return {"ok": True, "stats": stats, "ran_at": datetime.utcnow().isoformat()}
    finally:
        db.close()
