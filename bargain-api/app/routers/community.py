"""Community deal submission, voting, and leaderboard endpoints."""
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy import desc, func
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from app.db.session import get_db
from app.db.models import User, UserSubmittedDeal, DealVote, ArbitrageDeal
from app.routers.auth import get_current_user
from app.services.email_service import send_deal_approved_email
from app.services.deal_scorer import calculate_deal_score
from app.services.niche_service import NICHES as NICHE_KEYS

router = APIRouter(prefix="/api/v1/community", tags=["community"])

# Aura points configuration
AURA_SUBMIT_DEAL = 10       # Points for submitting a deal
AURA_DEAL_APPROVED = 50     # Bonus when deal is approved
AURA_UPVOTE_RECEIVED = 2    # Points per upvote on your deal
AURA_DOWNVOTE_PENALTY = 1   # Points lost per downvote
AURA_VOTE_BONUS = 1         # Points for voting on others' deals

# Aura tier thresholds
AURA_TIERS = [
    (10000, "goat"),
    (1000, "elite"),
    (0, "hunter"),
]


def _compute_aura_tier(points: int) -> str:
    for threshold, tier in AURA_TIERS:
        if points >= threshold:
            return tier
    return "hunter"


class SubmitDealRequest(BaseModel):
    title: str
    url: str
    retailer: str
    original_price: Optional[float] = None
    sale_price: Optional[float] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None

    @field_validator("title", "url", "retailer")
    @classmethod
    def not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("Field cannot be empty")
        return v.strip()

    @field_validator("url")
    @classmethod
    def must_be_https(cls, v):
        """Reject javascript:, data:, and other unsafe URL schemes to prevent XSS."""
        from urllib.parse import urlparse
        parsed = urlparse(v)
        if parsed.scheme not in ("http", "https"):
            raise ValueError("URL must start with http:// or https://")
        if not parsed.hostname:
            raise ValueError("URL must have a valid hostname")
        return v


class VoteRequest(BaseModel):
    vote: int  # 1 = upvote, -1 = downvote

    @field_validator("vote")
    @classmethod
    def valid_vote(cls, v):
        if v not in (1, -1):
            raise ValueError("Vote must be 1 (upvote) or -1 (downvote)")
        return v


class ModerateDealRequest(BaseModel):
    status: str  # approved or rejected
    rejection_reason: Optional[str] = None


class DealResponse(BaseModel):
    id: str
    title: str
    url: str
    image_url: Optional[str] = None
    retailer: str
    original_price: Optional[float] = None
    sale_price: Optional[float] = None
    discount_percent: Optional[float] = None
    category: Optional[str] = None
    description: Optional[str] = None
    status: str
    upvotes: int
    downvotes: int
    score: int
    user_aura: int
    user_tier: str
    created_at: str
    user_vote: Optional[int] = None  # 1, -1, or None if not voted


def _deal_to_response(deal: UserSubmittedDeal, user_vote: Optional[int] = None) -> dict:
    discount = None
    if deal.original_price and deal.sale_price and deal.original_price > 0:
        discount = round(
            (1 - float(deal.sale_price) / float(deal.original_price)) * 100, 1
        )
    elif deal.discount_percent:
        discount = float(deal.discount_percent)

    return {
        "id": str(deal.id),
        "title": deal.title,
        "url": deal.url,
        "image_url": deal.image_url,
        "retailer": deal.retailer,
        "original_price": float(deal.original_price) if deal.original_price else None,
        "sale_price": float(deal.sale_price) if deal.sale_price else None,
        "discount_percent": discount,
        "category": deal.category,
        "description": deal.description,
        "status": deal.status,
        "upvotes": deal.upvotes or 0,
        "downvotes": deal.downvotes or 0,
        "score": deal.score or 0,
        "user_aura": deal.user.aura_points if deal.user else 0,
        "user_tier": deal.user.aura_tier if deal.user else "hunter",
        "created_at": deal.created_at.isoformat() if deal.created_at else None,
        "user_vote": user_vote,
    }


# ─── Submit a Deal ────────────────────────────────────────────────────────────

@router.post("/deals/submit", status_code=status.HTTP_201_CREATED)
async def submit_deal(
    body: SubmitDealRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit a community deal. Awards 10 Aura points."""
    # Check for duplicate URL
    existing = db.query(UserSubmittedDeal).filter(
        UserSubmittedDeal.url == body.url,
        UserSubmittedDeal.status != "rejected",
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This deal URL has already been submitted.",
        )

    discount = None
    if body.original_price and body.sale_price and body.original_price > 0:
        discount = round((1 - body.sale_price / body.original_price) * 100, 1)

    deal = UserSubmittedDeal(
        user_id=current_user.id,
        title=body.title,
        url=body.url,
        image_url=body.image_url,
        retailer=body.retailer.lower(),
        original_price=Decimal(str(body.original_price)) if body.original_price else None,
        sale_price=Decimal(str(body.sale_price)) if body.sale_price else None,
        discount_percent=discount,
        category=body.category,
        description=body.description,
    )
    db.add(deal)

    # Award Aura points for submitting
    current_user.aura_points = (current_user.aura_points or 0) + AURA_SUBMIT_DEAL
    current_user.aura_tier = _compute_aura_tier(current_user.aura_points)

    db.commit()
    db.refresh(deal)

    return {
        "success": True,
        "deal": _deal_to_response(deal),
        "aura_points": current_user.aura_points,
        "aura_tier": current_user.aura_tier,
    }


# ─── List Community Deals ─────────────────────────────────────────────────────

@router.get("/deals")
async def list_community_deals(
    status_filter: str = Query("approved", alias="status"),
    sort: str = Query("hot", description="hot, new, top"),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List community-submitted deals. Default: approved, sorted by hot (score)."""
    query = db.query(UserSubmittedDeal)

    # Non-admin users can only see approved deals (plus their own pending)
    if current_user.role == "admin":
        if status_filter != "all":
            query = query.filter(UserSubmittedDeal.status == status_filter)
    else:
        query = query.filter(
            (UserSubmittedDeal.status == "approved") |
            (UserSubmittedDeal.user_id == current_user.id)
        )

    # Sorting
    if sort == "new":
        query = query.order_by(desc(UserSubmittedDeal.created_at))
    elif sort == "top":
        query = query.order_by(desc(UserSubmittedDeal.score))
    else:  # hot
        query = query.order_by(desc(UserSubmittedDeal.score), desc(UserSubmittedDeal.created_at))

    deals = query.offset(offset).limit(limit).all()

    # Get user's votes for these deals
    deal_ids = [d.id for d in deals]
    votes = {}
    if deal_ids:
        vote_rows = db.query(DealVote).filter(
            DealVote.deal_id.in_(deal_ids),
            DealVote.user_id == current_user.id,
        ).all()
        votes = {v.deal_id: v.vote for v in vote_rows}

    return [_deal_to_response(d, votes.get(d.id)) for d in deals]


# ─── Public Deal Feed (no auth) ───────────────────────────────────────────────

@router.get("/deals/public")
async def list_public_community_deals(
    sort: str = Query("hot", description="hot, new, top"),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    db: Session = Depends(get_db),
):
    """List approved community deals — public, no auth required."""
    query = db.query(UserSubmittedDeal).filter(UserSubmittedDeal.status == "approved")

    if sort == "new":
        query = query.order_by(desc(UserSubmittedDeal.created_at))
    elif sort == "top":
        query = query.order_by(desc(UserSubmittedDeal.score))
    else:  # hot
        query = query.order_by(desc(UserSubmittedDeal.score), desc(UserSubmittedDeal.created_at))

    deals = query.offset(offset).limit(limit).all()
    return [_deal_to_response(d) for d in deals]


# ─── Get Single Deal ──────────────────────────────────────────────────────────

@router.get("/deals/{deal_id}")
async def get_community_deal(
    deal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single community deal by ID."""
    deal = db.query(UserSubmittedDeal).filter(UserSubmittedDeal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    # Non-admin users can only see approved deals or their own
    if deal.status != "approved" and deal.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=404, detail="Deal not found")

    vote = db.query(DealVote).filter(
        DealVote.deal_id == deal.id,
        DealVote.user_id == current_user.id,
    ).first()

    return _deal_to_response(deal, vote.vote if vote else None)


# ─── Vote on a Deal ───────────────────────────────────────────────────────────

@router.post("/deals/{deal_id}/vote")
async def vote_deal(
    deal_id: UUID,
    body: VoteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Vote on a community deal. Awards 1 Aura point to voter, adjusts submitter's Aura."""
    deal = db.query(UserSubmittedDeal).filter(UserSubmittedDeal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    if deal.status != "approved":
        raise HTTPException(status_code=400, detail="Can only vote on approved deals")

    if deal.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot vote on your own deal")

    # Check existing vote
    existing = db.query(DealVote).filter(
        DealVote.deal_id == deal_id,
        DealVote.user_id == current_user.id,
    ).first()

    if existing:
        if existing.vote == body.vote:
            # Same vote — remove it (toggle off)
            db.delete(existing)
            if body.vote == 1:
                deal.upvotes = max(0, (deal.upvotes or 0) - 1)
            else:
                deal.downvotes = max(0, (deal.downvotes or 0) - 1)
            deal.score = (deal.upvotes or 0) - (deal.downvotes or 0)
            db.commit()
            db.refresh(deal)
            return {
                "success": True,
                "action": "removed",
                "upvotes": deal.upvotes,
                "downvotes": deal.downvotes,
                "score": deal.score,
            }
        else:
            # Change vote
            old_vote = existing.vote
            existing.vote = body.vote
            if body.vote == 1:
                deal.upvotes = (deal.upvotes or 0) + 1
                deal.downvotes = max(0, (deal.downvotes or 0) - 1)
            else:
                deal.downvotes = (deal.downvotes or 0) + 1
                deal.upvotes = max(0, (deal.upvotes or 0) - 1)
            deal.score = (deal.upvotes or 0) - (deal.downvotes or 0)
    else:
        # New vote
        vote = DealVote(deal_id=deal_id, user_id=current_user.id, vote=body.vote)
        db.add(vote)
        if body.vote == 1:
            deal.upvotes = (deal.upvotes or 0) + 1
        else:
            deal.downvotes = (deal.downvotes or 0) + 1
        deal.score = (deal.upvotes or 0) - (deal.downvotes or 0)

        # Award Aura to voter for participating
        current_user.aura_points = (current_user.aura_points or 0) + AURA_VOTE_BONUS
        current_user.aura_tier = _compute_aura_tier(current_user.aura_points)

    # Adjust submitter's Aura based on vote
    submitter = db.query(User).filter(User.id == deal.user_id).first()
    if submitter:
        if body.vote == 1:
            submitter.aura_points = (submitter.aura_points or 0) + AURA_UPVOTE_RECEIVED
        else:
            submitter.aura_points = max(0, (submitter.aura_points or 0) - AURA_DOWNVOTE_PENALTY)
        submitter.aura_tier = _compute_aura_tier(submitter.aura_points)

    db.commit()
    db.refresh(deal)

    return {
        "success": True,
        "action": "voted",
        "upvotes": deal.upvotes,
        "downvotes": deal.downvotes,
        "score": deal.score,
        "aura_points": current_user.aura_points,
        "aura_tier": current_user.aura_tier,
    }


# ─── Admin Moderation ─────────────────────────────────────────────────────────

@router.put("/deals/{deal_id}/moderate")
async def moderate_deal(
    deal_id: UUID,
    body: ModerateDealRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Approve or reject a submitted deal. Admin only."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    deal = db.query(UserSubmittedDeal).filter(UserSubmittedDeal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    if body.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")

    deal.status = body.status
    deal.reviewed_by = current_user.id
    deal.reviewed_at = datetime.utcnow()

    if body.status == "rejected":
        deal.rejection_reason = body.rejection_reason
    else:
        # Award bonus Aura to submitter for approved deal
        submitter = db.query(User).filter(User.id == deal.user_id).first()
        if submitter:
            submitter.aura_points = (submitter.aura_points or 0) + AURA_DEAL_APPROVED
            submitter.aura_tier = _compute_aura_tier(submitter.aura_points)
            # Send approval email
            send_deal_approved_email(submitter.email, deal.title, submitter.first_name)

        # Create an ArbitrageDeal so the community deal appears in the main /deals feed
        buy_price = deal.sale_price or deal.original_price or Decimal("0")
        sell_price = deal.original_price or deal.sale_price or Decimal("0")
        niche = deal.category if deal.category and deal.category in NICHE_KEYS else None

        promoted_deal = ArbitrageDeal(
            asin=f"community_{deal.id}",
            title=deal.title,
            image_url=deal.image_url,
            buy_url=deal.url,
            buy_platform="community",
            retailer=deal.retailer,
            deal_source="online",
            buy_price=buy_price,
            sell_price=sell_price,
            historical_avg=deal.original_price,
            deal_tier="clearance",
            is_profitable=True,
            status="active",
            category=deal.category,
            niche=niche,
        )
        db.add(promoted_deal)
        promoted_deal.score = calculate_deal_score(promoted_deal)
        db.flush()  # Populate promoted_deal.id
        deal.promoted_deal_id = promoted_deal.id

    db.commit()
    db.refresh(deal)

    return {
        "success": True,
        "deal_id": str(deal.id),
        "status": deal.status,
        "promoted_deal_id": str(deal.promoted_deal_id) if deal.promoted_deal_id else None,
    }


# ─── Leaderboard ──────────────────────────────────────────────────────────────

@router.get("/leaderboard")
async def leaderboard(
    limit: int = Query(50, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the Aura leaderboard — top deal hunters ranked by Aura points."""
    users = (
        db.query(User)
        .filter(User.aura_points > 0)
        .order_by(desc(User.aura_points))
        .limit(limit)
        .all()
    )

    # Count approved deals per user
    deal_counts = (
        db.query(UserSubmittedDeal.user_id, func.count(UserSubmittedDeal.id))
        .filter(UserSubmittedDeal.status == "approved")
        .group_by(UserSubmittedDeal.user_id)
        .all()
    )
    deal_count_map = {uid: count for uid, count in deal_counts}

    return [
        {
            "rank": idx + 1,
            "user_id": str(u.id),
            "name": u.full_name if hasattr(u, "full_name") else f"User{str(u.id)[:8]}",
            "aura_points": u.aura_points or 0,
            "aura_tier": u.aura_tier or "hunter",
            "deals_submitted": deal_count_map.get(u.id, 0),
            "is_you": u.id == current_user.id,
        }
        for idx, u in enumerate(users)
    ]


@router.get("/leaderboard/public")
async def public_leaderboard(
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db),
):
    """Public Aura leaderboard — no auth required."""
    users = (
        db.query(User)
        .filter(User.aura_points > 0)
        .order_by(desc(User.aura_points))
        .limit(limit)
        .all()
    )

    deal_counts = (
        db.query(UserSubmittedDeal.user_id, func.count(UserSubmittedDeal.id))
        .filter(UserSubmittedDeal.status == "approved")
        .group_by(UserSubmittedDeal.user_id)
        .all()
    )
    deal_count_map = {uid: count for uid, count in deal_counts}

    return [
        {
            "rank": idx + 1,
            "user_id": str(u.id),
            "name": u.full_name if hasattr(u, "full_name") else f"User{str(u.id)[:8]}",
            "aura_points": u.aura_points or 0,
            "aura_tier": u.aura_tier or "hunter",
            "deals_submitted": deal_count_map.get(u.id, 0),
            "is_you": False,
        }
        for idx, u in enumerate(users)
    ]


# ─── User's Own Submitted Deals ───────────────────────────────────────────────

@router.get("/my-deals")
async def my_deals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the current user's submitted deals (all statuses)."""
    deals = (
        db.query(UserSubmittedDeal)
        .filter(UserSubmittedDeal.user_id == current_user.id)
        .order_by(desc(UserSubmittedDeal.created_at))
        .all()
    )
    return [_deal_to_response(d) for d in deals]


# ─── User's Aura Stats ────────────────────────────────────────────────────────

@router.get("/aura")
async def my_aura(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the current user's Aura stats."""
    total_deals = db.query(UserSubmittedDeal).filter(
        UserSubmittedDeal.user_id == current_user.id,
    ).count()
    approved_deals = db.query(UserSubmittedDeal).filter(
        UserSubmittedDeal.user_id == current_user.id,
        UserSubmittedDeal.status == "approved",
    ).count()
    total_upvotes = db.query(func.sum(UserSubmittedDeal.upvotes)).filter(
        UserSubmittedDeal.user_id == current_user.id,
    ).scalar() or 0

    points = current_user.aura_points or 0
    tier = current_user.aura_tier or "hunter"

    # Next tier info
    next_tier = None
    points_to_next = 0
    for threshold, t in AURA_TIERS:
        if points < threshold:
            next_tier = t
            points_to_next = threshold - points
            break

    return {
        "aura_points": points,
        "aura_tier": tier,
        "next_tier": next_tier,
        "points_to_next": points_to_next,
        "deals_submitted": total_deals,
        "deals_approved": approved_deals,
        "total_upvotes_received": int(total_upvotes),
    }


@router.post("/seed", status_code=status.HTTP_200_OK)
async def seed_community_deals(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Seed community deals from the best arbitrage deals.

    Admin-only endpoint that takes the top active arbitrage deals and
    creates pre-approved community submissions so the community page
    isn't empty. Uses the system/bot user if one exists, otherwise
    uses the current admin user.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    # Get top active arbitrage deals with images
    deals = db.query(ArbitrageDeal).filter(
        ArbitrageDeal.status == "active",
        ArbitrageDeal.is_profitable == True,
        ArbitrageDeal.image_url.isnot(None),
    ).order_by(
        ArbitrageDeal.score.desc(),
        ArbitrageDeal.detected_at.desc(),
    ).limit(15).all()

    # Check for existing seeded deals to avoid duplicates
    existing_urls = set(
        r[0] for r in db.query(UserSubmittedDeal.url).all()
    )

    seeded = 0
    for deal in deals:
        if not deal.buy_url or deal.buy_url in existing_urls:
            continue

        discount = 0
        if deal.historical_avg and deal.historical_avg > deal.buy_price:
            discount = int(round((1 - float(deal.buy_price) / float(deal.historical_avg)) * 100))

        community_deal = UserSubmittedDeal(
            user_id=current_user.id,
            title=deal.title[:500] if deal.title else "Untitled Deal",
            url=deal.buy_url,
            image_url=deal.image_url,
            retailer=deal.retailer or deal.buy_platform or "unknown",
            original_price=deal.historical_avg,
            sale_price=deal.buy_price,
            discount_percent=discount,
            category=getattr(deal, "deal_tier", None) or "clearance",
            description=f"Auto-seeded from arbitrage scan. {discount}% off at {deal.retailer or 'retailer'}.",
            status="approved",
            reviewed_by=current_user.id,
            reviewed_at=datetime.utcnow(),
            upvotes=0,
            downvotes=0,
            score=0,
        )
        db.add(community_deal)
        existing_urls.add(deal.buy_url)
        seeded += 1

    db.commit()
    return {"status": "success", "seeded": seeded, "message": f"Seeded {seeded} community deals"}


# ═══════════════════════════════════════════════════════════════════════════
# Community deal threads — Slickdeals-style public feed.
#
# Distinct from the UserSubmittedDeal pipeline above (which is a moderation
# queue that promotes into arbitrage_deals): threads publish immediately,
# support anonymous authors/voters, and have comments.
# ═══════════════════════════════════════════════════════════════════════════

import time
from jose import JWTError, jwt
from sqlalchemy import text
from app.core.config import settings
from app.routers.auth import security
from app.db.models import DealThread, DealThreadComment, DealThreadVote

_thread_tables_ensured = False


def _ensure_thread_tables(db: Session) -> None:
    """Self-healing DDL — alembic 035 creates these, but Render runs no
    migrations at boot, so create lazily on first use (crm.py pattern)."""
    global _thread_tables_ensured
    if _thread_tables_ensured:
        return
    try:
        db.execute(text(
            """CREATE TABLE IF NOT EXISTS deal_threads (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                author_user_id UUID REFERENCES users(id),
                author_name VARCHAR(120) NOT NULL,
                author_email VARCHAR(255),
                title VARCHAR(300) NOT NULL,
                body TEXT,
                url VARCHAR(1000),
                retailer VARCHAR(100),
                price_cents INTEGER,
                original_price_cents INTEGER,
                status VARCHAR(20) NOT NULL DEFAULT 'published',
                upvotes INTEGER NOT NULL DEFAULT 0,
                comments_count INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )"""
        ))
        db.execute(text(
            """CREATE TABLE IF NOT EXISTS deal_thread_comments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                thread_id UUID NOT NULL REFERENCES deal_threads(id) ON DELETE CASCADE,
                user_id UUID REFERENCES users(id),
                author_name VARCHAR(120) NOT NULL,
                body TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )"""
        ))
        db.execute(text(
            """CREATE TABLE IF NOT EXISTS deal_thread_votes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                thread_id UUID NOT NULL REFERENCES deal_threads(id) ON DELETE CASCADE,
                voter_id VARCHAR(255) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_deal_thread_vote UNIQUE (thread_id, voter_id)
            )"""
        ))
        db.commit()
    except Exception:
        db.rollback()
    _thread_tables_ensured = True


def get_optional_user(
    credentials=Depends(security),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Returns the user when a valid bearer token is present, else None —
    for public endpoints that attribute posts/votes to signed-in users."""
    if credentials is None:
        return None
    try:
        payload = jwt.decode(
            credentials.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        user_id = payload.get("sub")
        if user_id is None or payload.get("type") == "refresh":
            return None
        user = db.query(User).filter(User.id == UUID(user_id)).first()
        if user is None or not user.is_active:
            return None
        return user
    except (JWTError, ValueError):
        return None


# Light in-memory rate limiting — per Render instance, resets on deploy.
# Enough to blunt spam without adding Redis for a first pass.
_RATE_LIMIT_STATE: dict = {}
_RATE_LIMIT_WINDOW = 3600  # 1 hour
_RATE_LIMIT_MAX = {"thread": 5, "comment": 30}


def _rate_limit_or_429(kind: str, key: str) -> None:
    now = time.time()
    bucket = _RATE_LIMIT_STATE.setdefault(f"{kind}:{key}", [])
    bucket[:] = [t for t in bucket if now - t < _RATE_LIMIT_WINDOW]
    if len(bucket) >= _RATE_LIMIT_MAX[kind]:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="You're posting too fast — please try again later",
        )
    bucket.append(now)


def _rate_key(request, user: Optional[User]) -> str:
    if user is not None:
        return f"u:{user.id}"
    forwarded = request.headers.get("x-forwarded-for") if request else None
    ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request and request.client else "anon")
    return f"ip:{ip}"


class ThreadCreateRequest(BaseModel):
    title: str
    body: Optional[str] = None
    url: Optional[str] = None
    retailer: Optional[str] = None
    price_cents: Optional[int] = None
    original_price_cents: Optional[int] = None
    author_name: Optional[str] = None
    author_email: Optional[EmailStr] = None

    @field_validator("title")
    @classmethod
    def title_length(cls, v):
        v = (v or "").strip()
        if len(v) < 5:
            raise ValueError("Title must be at least 5 characters")
        if len(v) > 300:
            raise ValueError("Title must be at most 300 characters")
        return v

    @field_validator("url")
    @classmethod
    def url_scheme(cls, v):
        if v is None:
            return v
        v = v.strip()
        if not v:
            return None
        from urllib.parse import urlparse
        parsed = urlparse(v)
        if parsed.scheme not in ("http", "https") or not parsed.hostname:
            raise ValueError("URL must start with http:// or https://")
        if len(v) > 1000:
            raise ValueError("URL too long")
        return v

    @field_validator("price_cents", "original_price_cents")
    @classmethod
    def sane_price(cls, v):
        if v is not None and (v < 0 or v > 100_000_000):
            raise ValueError("Price out of range")
        return v


class CommentCreateRequest(BaseModel):
    body: str
    author_name: Optional[str] = None
    author_email: Optional[EmailStr] = None

    @field_validator("body")
    @classmethod
    def body_length(cls, v):
        v = (v or "").strip()
        if not v:
            raise ValueError("Comment cannot be empty")
        if len(v) > 5000:
            raise ValueError("Comment too long")
        return v


class ThreadVoteRequest(BaseModel):
    voter_id: Optional[str] = None


def _thread_voter_key(user: Optional[User], voter_id: Optional[str]) -> str:
    if user is not None:
        return f"user:{user.id}"
    vid = (voter_id or "").strip()
    if not vid:
        raise HTTPException(status_code=400, detail="voter_id is required when not signed in")
    return f"anon:{vid}"


def _thread_to_dict(t: DealThread, voted: bool = False) -> dict:
    return {
        "id": str(t.id),
        "title": t.title,
        "body": t.body,
        "url": t.url,
        "retailer": t.retailer,
        "price_cents": t.price_cents,
        "original_price_cents": t.original_price_cents,
        "status": t.status,
        "upvotes": t.upvotes or 0,
        "comments_count": t.comments_count or 0,
        "author_name": t.author_name,
        "author_user_id": str(t.author_user_id) if t.author_user_id else None,
        "is_member": t.author_user_id is not None,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "voted": voted,
    }


def _comment_to_dict(c: DealThreadComment) -> dict:
    return {
        "id": str(c.id),
        "author_name": c.author_name,
        "is_member": c.user_id is not None,
        "body": c.body,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


@router.get("/threads")
async def list_deal_threads(
    sort: str = Query("hot", description="hot or new"),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    db: Session = Depends(get_db),
):
    """Public thread list. hot = votes + comments decayed by age; new = latest."""
    _ensure_thread_tables(db)
    query = db.query(DealThread).filter(DealThread.status == "published")
    if sort == "new":
        query = query.order_by(desc(DealThread.created_at))
    else:
        # Reddit-lite hot rank: engagement / (age_hours + 2)^1.5
        age_hours = func.extract("epoch", func.now() - DealThread.created_at) / 3600.0
        hot = (DealThread.upvotes + DealThread.comments_count + 1) / func.power(age_hours + 2, 1.5)
        query = query.order_by(desc(hot), desc(DealThread.created_at))
    return [_thread_to_dict(t) for t in query.offset(offset).limit(limit).all()]


@router.post("/threads", status_code=status.HTTP_201_CREATED)
async def create_deal_thread(
    body: ThreadCreateRequest,
    request: Request,
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Start a deal thread. Signed-in users are attributed; anonymous posters
    must provide a display name + email (email stays private). Requires a
    deal URL or body text so empty spam titles can't post."""
    _ensure_thread_tables(db)

    if not body.url and not (body.body or "").strip():
        raise HTTPException(status_code=422, detail="Provide a deal link or a description")
    if user is None:
        if not (body.author_name or "").strip():
            raise HTTPException(status_code=422, detail="Display name is required when not signed in")
        if not (body.author_email or "").strip():
            raise HTTPException(status_code=422, detail="Email is required when not signed in")
    _rate_limit_or_429("thread", _rate_key(request, user))

    thread = DealThread(
        author_user_id=user.id if user else None,
        author_name=(user.full_name if user else body.author_name.strip())[:120],
        author_email=(user.email if user else (body.author_email or "").strip()) or None,
        title=body.title.strip(),
        body=(body.body or "").strip() or None,
        url=body.url,
        retailer=(body.retailer or "").strip()[:100] or None,
        price_cents=body.price_cents,
        original_price_cents=body.original_price_cents,
    )
    db.add(thread)
    db.commit()
    db.refresh(thread)
    return _thread_to_dict(thread)


@router.get("/threads/{thread_id}")
async def get_deal_thread(thread_id: UUID, db: Session = Depends(get_db)):
    """Thread detail + comments. Public for published threads."""
    _ensure_thread_tables(db)
    thread = db.query(DealThread).filter(
        DealThread.id == thread_id,
        DealThread.status == "published",
    ).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    comments = (
        db.query(DealThreadComment)
        .filter(DealThreadComment.thread_id == thread_id)
        .order_by(DealThreadComment.created_at)
        .all()
    )
    data = _thread_to_dict(thread)
    data["comments"] = [_comment_to_dict(c) for c in comments]
    return data


@router.post("/threads/{thread_id}/comments", status_code=status.HTTP_201_CREATED)
async def create_thread_comment(
    thread_id: UUID,
    body: CommentCreateRequest,
    request: Request,
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Comment on a thread. Anonymous commenters need a display name."""
    _ensure_thread_tables(db)
    thread = db.query(DealThread).filter(
        DealThread.id == thread_id,
        DealThread.status == "published",
    ).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    if user is None and not (body.author_name or "").strip():
        raise HTTPException(status_code=422, detail="Display name is required when not signed in")
    _rate_limit_or_429("comment", _rate_key(request, user))

    comment = DealThreadComment(
        thread_id=thread_id,
        user_id=user.id if user else None,
        author_name=(user.full_name if user else body.author_name.strip())[:120],
        body=body.body.strip(),
    )
    db.add(comment)
    db.flush()
    # Authoritative recount
    thread.comments_count = (
        db.query(func.count(DealThreadComment.id))
        .filter(DealThreadComment.thread_id == thread_id)
        .scalar() or 0
    )
    db.commit()
    db.refresh(comment)
    return _comment_to_dict(comment)


@router.post("/threads/{thread_id}/vote")
async def vote_deal_thread(
    thread_id: UUID,
    body: ThreadVoteRequest,
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Toggle an upvote. voter = user id when signed in, else client voter_id.
    Count is recounted from deal_thread_votes — never trusted blindly."""
    _ensure_thread_tables(db)
    thread = db.query(DealThread).filter(
        DealThread.id == thread_id,
        DealThread.status == "published",
    ).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    voter = _thread_voter_key(user, body.voter_id)
    existing = db.query(DealThreadVote).filter(
        DealThreadVote.thread_id == thread_id,
        DealThreadVote.voter_id == voter,
    ).first()
    if existing:
        db.delete(existing)
        voted = False
    else:
        db.add(DealThreadVote(thread_id=thread_id, voter_id=voter))
        voted = True
    db.flush()
    thread.upvotes = (
        db.query(func.count(DealThreadVote.id))
        .filter(DealThreadVote.thread_id == thread_id)
        .scalar() or 0
    )
    db.commit()
    return {"voted": voted, "upvotes": thread.upvotes}


@router.delete("/threads/{thread_id}")
async def delete_deal_thread(
    thread_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a thread — author or admin only. Comments/votes cascade."""
    _ensure_thread_tables(db)
    thread = db.query(DealThread).filter(DealThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    is_admin = (current_user.role or "").lower() == "admin"
    if thread.author_user_id != current_user.id and not is_admin:
        raise HTTPException(status_code=403, detail="Not allowed")
    db.query(DealThreadVote).filter(DealThreadVote.thread_id == thread_id).delete()
    db.query(DealThreadComment).filter(DealThreadComment.thread_id == thread_id).delete()
    db.delete(thread)
    db.commit()
    return {"deleted": True}
