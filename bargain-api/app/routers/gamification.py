"""Gamification endpoints: community stats, voucher draws, and login streaks."""
import logging
import random
from datetime import datetime, date, timedelta
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import User, UserSubmittedDeal, DealVote, VoucherWinner
from app.routers.auth import get_current_user
from app.routers.community import AURA_TIERS, _compute_aura_tier

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/gamification", tags=["gamification"])


# ─── Community Stats ──────────────────────────────────────────────────────────

@router.get("/stats")
async def community_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get community-wide gamification stats (requires auth)."""
    # Total members
    total_members = db.query(User).count()

    # Deals posted (approved)
    deals_posted = db.query(UserSubmittedDeal).filter(
        UserSubmittedDeal.status == "approved",
    ).count()

    # Deals approved today
    today_start = datetime.combine(date.today(), datetime.min.time())
    deals_today = db.query(UserSubmittedDeal).filter(
        UserSubmittedDeal.status == "approved",
        UserSubmittedDeal.reviewed_at >= today_start,
    ).count()

    # Votes cast today
    votes_today = db.query(DealVote).filter(
        DealVote.created_at >= today_start,
    ).count()

    # Top hunter (#1 on leaderboard)
    top_hunter = None
    top_user = (
        db.query(User)
        .order_by(desc(User.aura_points))
        .first()
    )
    if top_user:
        top_hunter = {
            "name": top_user.display_name,
            "aura_points": top_user.aura_points or 0,
        }

    # Most recent voucher winner
    last_voucher_winner = None
    recent_winner = (
        db.query(VoucherWinner)
        .order_by(desc(VoucherWinner.drawn_at))
        .first()
    )
    if recent_winner:
        winner_user = db.query(User).filter(User.id == recent_winner.user_id).first()
        last_voucher_winner = {
            "month": recent_winner.month,
            "user_name": winner_user.display_name if winner_user else None,
            "aura_points_at_draw": recent_winner.aura_points_at_draw,
            "drawn_at": recent_winner.drawn_at.isoformat() if recent_winner.drawn_at else None,
            "status": recent_winner.status,
        }

    return {
        "total_members": total_members,
        "deals_posted": deals_posted,
        "deals_today": deals_today,
        "votes_today": votes_today,
        "top_hunter": top_hunter,
        "last_voucher_winner": last_voucher_winner,
    }


# ─── Voucher Winners ──────────────────────────────────────────────────────────

def _winner_to_response(winner: VoucherWinner, user: Optional[User] = None) -> dict:
    """Serialize a VoucherWinner to a response dict."""
    if user is None:
        user_name = None
    else:
        user_name = user.display_name
    return {
        "id": str(winner.id),
        "month": winner.month,
        "user_name": user_name,
        "aura_points_at_draw": winner.aura_points_at_draw,
        "drawn_at": winner.drawn_at.isoformat() if winner.drawn_at else None,
        "status": winner.status,
    }


@router.get("/voucher/winners")
async def list_voucher_winners(
    limit: int = Query(50, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List past monthly voucher draw winners."""
    winners = (
        db.query(VoucherWinner)
        .order_by(desc(VoucherWinner.drawn_at))
        .limit(limit)
        .all()
    )

    # Batch-fetch user names
    user_ids = [w.user_id for w in winners]
    users = {}
    if user_ids:
        user_rows = db.query(User).filter(User.id.in_(user_ids)).all()
        users = {u.id: u for u in user_rows}

    return [_winner_to_response(w, users.get(w.user_id)) for w in winners]


# ─── Run Monthly Voucher Draw (Admin) ─────────────────────────────────────────

@router.post("/voucher/draw", status_code=status.HTTP_201_CREATED)
async def run_voucher_draw(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Run the monthly $100 voucher draw. Admin only.

    Each user's Aura points act as their ticket count — more points means a
    higher chance of winning. Uses weighted random selection.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Current month in YYYY-MM format
    current_month = datetime.utcnow().strftime("%Y-%m")

    # Prevent duplicate draws for the same month
    existing = db.query(VoucherWinner).filter(
        VoucherWinner.month == current_month,
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Voucher draw for {current_month} has already been completed.",
        )

    # Gather eligible users (must have Aura points > 0)
    users = (
        db.query(User)
        .filter(User.aura_points > 0)
        .all()
    )
    if not users:
        raise HTTPException(
            status_code=400,
            detail="No eligible users with Aura points to draw from.",
        )

    # Weighted random selection — Aura points = ticket count
    weights = [u.aura_points or 0 for u in users]
    winner_user = random.choices(users, weights=weights, k=1)[0]

    # Create the VoucherWinner record
    winner = VoucherWinner(
        user_id=winner_user.id,
        month=current_month,
        prize_amount=100,
        aura_points_at_draw=winner_user.aura_points or 0,
        drawn_at=datetime.utcnow(),
        status="pending",
    )
    db.add(winner)
    db.commit()
    db.refresh(winner)

    logger.info(
        "Voucher draw for %s completed — winner: %s (%s) with %s Aura points",
        current_month,
        winner_user.email,
        winner_user.id,
        winner_user.aura_points,
    )

    return {
        "success": True,
        "winner": _winner_to_response(winner, winner_user),
        "winner_id": str(winner.id),
    }


# ─── Mark Voucher Winner as Paid (Admin) ──────────────────────────────────────

@router.put("/voucher/{winner_id}/paid")
async def mark_voucher_paid(
    winner_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a voucher winner as paid. Admin only."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    winner = db.query(VoucherWinner).filter(VoucherWinner.id == winner_id).first()
    if not winner:
        raise HTTPException(status_code=404, detail="Voucher winner not found")

    winner.status = "paid"
    winner.paid_at = datetime.utcnow()

    db.commit()
    db.refresh(winner)

    winner_user = db.query(User).filter(User.id == winner.user_id).first()

    logger.info(
        "Voucher winner %s marked as paid by admin %s",
        winner.id,
        current_user.email,
    )

    return {
        "success": True,
        "winner": _winner_to_response(winner, winner_user),
    }


# ─── Current User's Login Streak ──────────────────────────────────────────────

@router.get("/streak")
async def login_streak(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the current user's login streak info.

    Calculates days until the streak resets — if the user last logged in
    yesterday, they have 1 day left to log in today and maintain the streak.
    """
    streak = current_user.login_streak or 0
    last_login = current_user.last_login_at
    aura_points = current_user.aura_points or 0
    aura_tier = current_user.aura_tier or _compute_aura_tier(aura_points)

    # Days until streak resets
    days_until_reset = None
    if last_login:
        today = date.today()
        last_login_date = last_login.date() if hasattr(last_login, "date") else last_login
        delta = (today - last_login_date).days
        # If last login was today, streak is safe (0 days until reset risk)
        # If last login was yesterday, 1 day left to maintain (log in today)
        # If 2+ days ago, streak has already reset
        if delta <= 0:
            days_until_reset = 0
        elif delta == 1:
            days_until_reset = 1
        else:
            # Streak already reset — no grace period left
            days_until_reset = 0
            streak = 0

    return {
        "login_streak": streak,
        "last_login_at": last_login.isoformat() if last_login else None,
        "aura_points": aura_points,
        "aura_tier": aura_tier,
        "days_until_reset": days_until_reset,
    }
