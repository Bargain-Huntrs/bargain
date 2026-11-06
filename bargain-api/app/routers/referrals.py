"""Referral / invite system: codes, claims, and leaderboard."""
import random
import string
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, field_validator
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import User, ReferralClaim
from app.routers.auth import get_current_user
from app.routers.community import _compute_aura_tier

router = APIRouter(prefix="/api/v1/referrals", tags=["referrals"])

# Aura rewards for a successful referral
AURA_REFERRER_BONUS = 100
AURA_REFEREE_BONUS = 50


def _generate_referral_code(length: int = 8) -> str:
    """Generate an alphanumeric referral code."""
    alphabet = string.ascii_uppercase + string.digits
    return "".join(random.choices(alphabet, k=length))


def _ensure_referral_code(user: User, db: Session) -> str:
    """Generate and persist a unique referral code for the user if missing."""
    if user.referral_code:
        return user.referral_code

    for _ in range(20):
        code = _generate_referral_code()
        existing = db.query(User).filter(User.referral_code == code).first()
        if not existing:
            user.referral_code = code
            db.commit()
            db.refresh(user)
            return code

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Unable to generate a unique referral code",
    )


class ClaimReferralRequest(BaseModel):
    referral_code: str

    @field_validator("referral_code")
    @classmethod
    def not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("referral_code is required")
        return v.strip()


@router.get("/me")
async def get_my_referrals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the current user's referral code, share link, and referral stats."""
    code = _ensure_referral_code(current_user, db)
    total_aura_earned = (
        db.query(func.sum(ReferralClaim.points_awarded))
        .filter(ReferralClaim.referrer_id == current_user.id)
        .scalar()
        or 0
    )

    return {
        "success": True,
        "referral_code": code,
        "referral_link": f"https://www.bargainhuntrs.com/signup?ref={code}",
        "referral_count": current_user.referral_count or 0,
        "total_aura_earned": int(total_aura_earned),
    }


@router.post("/claim")
async def claim_referral(
    body: ClaimReferralRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Claim a referral code (after signup). Awards both users Aura points."""
    code = body.referral_code.upper()

    # Can't refer yourself
    if current_user.referral_code and current_user.referral_code.upper() == code:
        raise HTTPException(status_code=400, detail="You can't use your own referral code")

    # Already claimed a referral?
    if current_user.referred_by or db.query(ReferralClaim).filter(
        ReferralClaim.referee_id == current_user.id
    ).first():
        raise HTTPException(status_code=400, detail="You have already claimed a referral")

    referrer = db.query(User).filter(
        func.upper(User.referral_code) == code,
        User.is_active == True,
    ).first()
    if not referrer:
        raise HTTPException(status_code=404, detail="Invalid referral code")

    if referrer.id == current_user.id:
        raise HTTPException(status_code=400, detail="You can't use your own referral code")

    # Create the claim record and update both users
    claim = ReferralClaim(
        referrer_id=referrer.id,
        referee_id=current_user.id,
        referral_code=referrer.referral_code,
        points_awarded=AURA_REFERRER_BONUS,
    )
    db.add(claim)

    current_user.referred_by = referrer.id
    current_user.aura_points = (current_user.aura_points or 0) + AURA_REFEREE_BONUS
    current_user.aura_tier = _compute_aura_tier(current_user.aura_points)

    referrer.referral_count = (referrer.referral_count or 0) + 1
    referrer.aura_points = (referrer.aura_points or 0) + AURA_REFERRER_BONUS
    referrer.aura_tier = _compute_aura_tier(referrer.aura_points)

    db.commit()
    db.refresh(current_user)
    db.refresh(referrer)

    return {
        "success": True,
        "referrer_id": str(referrer.id),
        "referral_code": referrer.referral_code,
        "referrer_aura_bonus": AURA_REFERRER_BONUS,
        "referee_aura_bonus": AURA_REFEREE_BONUS,
        "referral_count": referrer.referral_count,
    }


@router.get("/leaderboard")
async def referral_leaderboard(
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db),
):
    """Public leaderboard of top referrers ranked by successful referrals."""
    users = (
        db.query(User)
        .filter(User.referral_count > 0)
        .order_by(desc(User.referral_count))
        .limit(limit)
        .all()
    )

    return [
        {
            "rank": idx + 1,
            "user_id": str(u.id),
            "name": u.display_name,
            "referral_count": u.referral_count or 0,
            "aura_points": u.aura_points or 0,
            "aura_tier": u.aura_tier or "hunter",
        }
        for idx, u in enumerate(users)
    ]
