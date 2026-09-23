"""
Dashboard API — the hunter's HQ: haul tracking (P&L ledger) and user lists.

Haul = deals the user claimed via "I bought this" or added manually.
Realized profit only counts items marked sold; potential uses the deal's
estimated net profit for unsold items. Lists = shopping / wishlist / bolo.
"""
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import ArbitrageDeal, DealClaim, User, UserListItem
from app.routers.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])

CLAIM_STATUSES = {"bought", "listed", "sold"}
LIST_TYPES = {"shopping", "wishlist", "bolo"}


# ─── Schemas ────────────────────────────────────────────────────────────────

class ClaimCreate(BaseModel):
    deal_id: Optional[UUID] = None
    title: Optional[str] = Field(None, max_length=500)
    buy_price: Optional[float] = Field(None, ge=0)
    quantity: int = Field(1, ge=1, le=1000)
    notes: Optional[str] = None


class ClaimUpdate(BaseModel):
    status: Optional[str] = None
    sold_price: Optional[float] = Field(None, ge=0)
    listing_url: Optional[str] = Field(None, max_length=1000)
    buy_price: Optional[float] = Field(None, ge=0)
    quantity: Optional[int] = Field(None, ge=1, le=1000)
    notes: Optional[str] = None


class ClaimResponse(BaseModel):
    id: UUID
    deal_id: Optional[UUID] = None
    title: str
    image_url: Optional[str] = None
    buy_url: Optional[str] = None
    buy_platform: Optional[str] = None
    sell_platform: Optional[str] = None
    quantity: int
    buy_price: Decimal
    est_sell_price: Optional[Decimal] = None
    est_net_profit: Optional[Decimal] = None
    status: str
    listing_url: Optional[str] = None
    sold_price: Optional[Decimal] = None
    purchased_at: Optional[datetime] = None
    listed_at: Optional[datetime] = None
    sold_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ListItemCreate(BaseModel):
    list_type: str
    title: str = Field(..., max_length=500)
    url: Optional[str] = Field(None, max_length=1000)
    target_price: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = None


class ListItemUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=500)
    url: Optional[str] = Field(None, max_length=1000)
    target_price: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class ListItemResponse(BaseModel):
    id: UUID
    list_type: str
    title: str
    url: Optional[str] = None
    target_price: Optional[Decimal] = None
    notes: Optional[str] = None
    matched_deal_id: Optional[UUID] = None
    matched_at: Optional[datetime] = None
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProfitDay(BaseModel):
    date: str
    realized: float
    potential: float


class ProfitSummary(BaseModel):
    total_spent: float
    realized_profit: float
    potential_profit: float
    realized_roi: float
    items_bought: int
    items_listed: int
    items_sold: int
    series: List[ProfitDay]


# ─── Haul (deal claims) ─────────────────────────────────────────────────────

@router.get("/haul", response_model=List[ClaimResponse])
async def get_haul(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(DealClaim).filter(DealClaim.user_id == user.id)
    if status_filter in CLAIM_STATUSES:
        q = q.filter(DealClaim.status == status_filter)
    return q.order_by(DealClaim.created_at.desc()).all()


@router.post("/haul", response_model=ClaimResponse, status_code=status.HTTP_201_CREATED)
async def create_claim(
    body: ClaimCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if body.deal_id:
        deal = db.query(ArbitrageDeal).filter(ArbitrageDeal.id == body.deal_id).first()
        if not deal:
            raise HTTPException(status_code=404, detail="Deal not found")
        claim = DealClaim(
            user_id=user.id,
            deal_id=deal.id,
            title=deal.title,
            image_url=deal.image_url,
            buy_url=deal.buy_url,
            buy_platform=deal.buy_platform or deal.retailer,
            sell_platform=deal.sell_platform,
            quantity=body.quantity,
            buy_price=body.buy_price if body.buy_price is not None else deal.buy_price,
            est_sell_price=deal.sell_price,
            est_net_profit=deal.net_profit,
            status="bought",
            notes=body.notes,
        )
    else:
        if not body.title or body.buy_price is None:
            raise HTTPException(status_code=422, detail="Manual entries need title and buy_price")
        claim = DealClaim(
            user_id=user.id,
            title=body.title,
            quantity=body.quantity,
            buy_price=body.buy_price,
            status="bought",
            notes=body.notes,
        )
    db.add(claim)
    db.commit()
    db.refresh(claim)
    return claim


@router.patch("/haul/{claim_id}", response_model=ClaimResponse)
async def update_claim(
    claim_id: UUID,
    body: ClaimUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    claim = (
        db.query(DealClaim)
        .filter(DealClaim.id == claim_id, DealClaim.user_id == user.id)
        .first()
    )
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    data = body.model_dump(exclude_unset=True)
    new_status = data.pop("status", None)
    if new_status is not None:
        if new_status not in CLAIM_STATUSES:
            raise HTTPException(status_code=422, detail="Invalid status")
        claim.status = new_status
        if new_status == "listed" and not claim.listed_at:
            claim.listed_at = datetime.utcnow()
        if new_status == "sold":
            if not claim.sold_at:
                claim.sold_at = datetime.utcnow()
            # Selling requires a sale price
            if claim.sold_price is None and data.get("sold_price") is None:
                raise HTTPException(status_code=422, detail="sold_price required when marking sold")

    for k, v in data.items():
        setattr(claim, k, v)

    db.commit()
    db.refresh(claim)
    return claim


@router.delete("/haul/{claim_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_claim(
    claim_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    claim = (
        db.query(DealClaim)
        .filter(DealClaim.id == claim_id, DealClaim.user_id == user.id)
        .first()
    )
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    db.delete(claim)
    db.commit()


# ─── Lists (shopping / wishlist / bolo) ─────────────────────────────────────

@router.get("/lists", response_model=List[ListItemResponse])
async def get_list_items(
    list_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(UserListItem).filter(
        UserListItem.user_id == user.id, UserListItem.is_active == True  # noqa: E712
    )
    if list_type in LIST_TYPES:
        q = q.filter(UserListItem.list_type == list_type)
    return q.order_by(UserListItem.created_at.desc()).all()


@router.post("/lists", response_model=ListItemResponse, status_code=status.HTTP_201_CREATED)
async def create_list_item(
    body: ListItemCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if body.list_type not in LIST_TYPES:
        raise HTTPException(status_code=422, detail="Invalid list_type")
    item = UserListItem(
        user_id=user.id,
        list_type=body.list_type,
        title=body.title,
        url=body.url,
        target_price=body.target_price,
        notes=body.notes,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/lists/{item_id}", response_model=ListItemResponse)
async def update_list_item(
    item_id: UUID,
    body: ListItemUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = (
        db.query(UserListItem)
        .filter(UserListItem.id == item_id, UserListItem.user_id == user.id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/lists/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_list_item(
    item_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = (
        db.query(UserListItem)
        .filter(UserListItem.id == item_id, UserListItem.user_id == user.id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.is_active = False
    db.commit()


# ─── Profit summary ─────────────────────────────────────────────────────────

@router.get("/profit-summary", response_model=ProfitSummary)
async def profit_summary(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    claims = db.query(DealClaim).filter(DealClaim.user_id == user.id).all()

    total_spent = sum(float(c.buy_price or 0) * (c.quantity or 1) for c in claims)
    realized = sum(
        (float(c.sold_price or 0) - float(c.buy_price or 0)) * (c.quantity or 1)
        for c in claims
        if c.status == "sold" and c.sold_price is not None
    )
    potential = sum(
        float(c.est_net_profit or 0) * (c.quantity or 1)
        for c in claims
        if c.status in ("bought", "listed")
    )
    spent_on_sold = sum(
        float(c.buy_price or 0) * (c.quantity or 1)
        for c in claims
        if c.status == "sold"
    )

    # Daily series, last 90 days
    since = datetime.utcnow() - timedelta(days=90)
    day_map: dict[str, dict] = {}
    for c in claims:
        if c.status == "sold" and c.sold_price is not None and c.sold_at and c.sold_at >= since:
            d = c.sold_at.date().isoformat()
            day_map.setdefault(d, {"realized": 0.0, "potential": 0.0})
            day_map[d]["realized"] += (float(c.sold_price) - float(c.buy_price or 0)) * (c.quantity or 1)
        elif c.status in ("bought", "listed") and c.purchased_at and c.purchased_at >= since:
            d = c.purchased_at.date().isoformat()
            day_map.setdefault(d, {"realized": 0.0, "potential": 0.0})
            day_map[d]["potential"] += float(c.est_net_profit or 0) * (c.quantity or 1)

    series = [
        ProfitDay(date=d, realized=v["realized"], potential=v["potential"])
        for d, v in sorted(day_map.items())
    ]

    return ProfitSummary(
        total_spent=round(total_spent, 2),
        realized_profit=round(realized, 2),
        potential_profit=round(potential, 2),
        realized_roi=round(realized / spent_on_sold, 4) if spent_on_sold else 0.0,
        items_bought=sum(1 for c in claims if c.status == "bought"),
        items_listed=sum(1 for c in claims if c.status == "listed"),
        items_sold=sum(1 for c in claims if c.status == "sold"),
        series=series,
    )
