"""Seller portal endpoints — verified sellers submit coupons and price drops."""
import logging
from decimal import Decimal
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import desc, func, text
from sqlalchemy.orm import Session
from uuid import UUID

from app.db.session import get_db
from app.db.models import User, SellerSubmission, CouponCode, ArbitrageDeal
from app.routers.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/seller", tags=["seller"])


# ─── Request Models ────────────────────────────────────────────────────────────

class ApplySellerRequest(BaseModel):
    store_name: str
    website: str

    @field_validator("store_name", "website")
    @classmethod
    def not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("Field cannot be empty")
        return v.strip()


class SubmitCouponRequest(BaseModel):
    title: str
    url: str
    retailer: str
    coupon_code: str
    discount_type: str = "percentage"  # percentage, fixed, free_shipping
    discount_value: float
    expires_at: Optional[datetime] = None
    category: Optional[str] = None
    description: Optional[str] = None

    @field_validator("title", "url", "retailer", "coupon_code")
    @classmethod
    def not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("Field cannot be empty")
        return v.strip()


class SubmitPriceDropRequest(BaseModel):
    title: str
    url: str
    retailer: str
    original_price: float
    sale_price: float
    image_url: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None

    @field_validator("title", "url", "retailer")
    @classmethod
    def not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("Field cannot be empty")
        return v.strip()

    @field_validator("sale_price", "original_price")
    @classmethod
    def positive_price(cls, v):
        if v is None or v <= 0:
            raise ValueError("Price must be greater than 0")
        return v


class BulkDealItem(BaseModel):
    title: str
    url: str
    retailer: str
    original_price: float
    sale_price: float
    image_url: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None


class BulkSubmitRequest(BaseModel):
    deals: List[BulkDealItem]


# ─── Helpers ───────────────────────────────────────────────────────────────────

def _require_verified_seller(user: User):
    """Raise 403 if the user is not a verified seller."""
    if not user.is_verified_seller:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Verified seller account required.",
        )


def _submission_to_response(sub: SellerSubmission) -> dict:
    return {
        "id": str(sub.id),
        "submission_type": sub.submission_type,
        "title": sub.title,
        "url": sub.url,
        "retailer": sub.retailer,
        "image_url": sub.image_url,
        "category": sub.category,
        "description": sub.description,
        "coupon_code": sub.coupon_code,
        "discount_type": sub.discount_type,
        "discount_value": float(sub.discount_value) if sub.discount_value is not None else None,
        "expires_at": sub.expires_at.isoformat() if sub.expires_at else None,
        "original_price": float(sub.original_price) if sub.original_price is not None else None,
        "sale_price": float(sub.sale_price) if sub.sale_price is not None else None,
        "status": sub.status,
        # getattr — column may not exist until the showcase DDL/migration runs.
        "is_demo": bool(getattr(sub, "is_demo", False)),
        "promoted_deal_id": str(sub.promoted_deal_id) if sub.promoted_deal_id else None,
        "promoted_coupon_id": str(sub.promoted_coupon_id) if sub.promoted_coupon_id else None,
        "created_at": sub.created_at.isoformat() if sub.created_at else None,
    }


# ─── Seller showcase (public, demo-gated) ──────────────────────────────────────

_showcase_ensured = False
_DEMO_SELLER_EMAIL = "showcase@bargainhuntrs.com"


def _ensure_showcase_schema(db: Session) -> None:
    """Self-healing showcase DDL + seed — mirrors crm.py's _ensure_table.

    Alembic 038 covers this properly, but prod runs no migrations at boot,
    so the column + demo rows are created lazily on first showcase read.
    """
    global _showcase_ensured
    if _showcase_ensured:
        return
    try:
        db.execute(
            text(
                "ALTER TABLE seller_submissions "
                "ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false"
            )
        )
        db.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_seller_submissions_is_demo "
                "ON seller_submissions (is_demo)"
            )
        )
        db.execute(
            text(
                """INSERT INTO users (id, email, hashed_password, role, is_active,
                                    email_verified, is_verified_seller,
                                    seller_store_name, seller_website,
                                    created_at, updated_at)
                   SELECT gen_random_uuid(), :email,
                          '$2b$12$showcasedemohash00000000000000000000000000000000000000',
                          'customer', true, true, true,
                          'BargainHuntrs Showcase', 'https://bargainhuntrs.com',
                          now(), now()
                   WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = :email)"""
            ),
            {"email": _DEMO_SELLER_EMAIL},
        )
        db.execute(
            text(
                """INSERT INTO seller_submissions
                     (id, seller_id, submission_type, title, url, retailer,
                      category, description, coupon_code, discount_type,
                      discount_value, original_price, sale_price, status,
                      is_demo, created_at)
                   SELECT gen_random_uuid(), u.id, v.*, 'approved', true, now()
                   FROM (
                       VALUES
                         ('coupon_code', 'Extra 20% off Kitchen & Dining (demo)',
                          'https://bargainhuntrs.com/deals', 'Target', 'kitchen',
                          'Demo showcase listing — illustrates how verified-seller coupons appear in the feed.',
                          'DEMO20', 'percentage', 20.0, NULL, NULL),
                         ('coupon_code', 'Free shipping sitewide over $35 (demo)',
                          'https://bargainhuntrs.com/deals', 'Walmart', 'general',
                          'Demo showcase listing — sample free-shipping seller submission.',
                          'DEMOSHIP', 'free_shipping', 0.0, NULL, NULL),
                         ('price_drop', 'Robot vacuum 40% price drop (demo)',
                          'https://bargainhuntrs.com/deals', 'Amazon', 'electronics',
                          'Demo showcase listing — sample seller-reported price drop with markdown math.',
                          NULL, NULL, NULL, 299.99, 179.99),
                         ('price_drop', 'Winter jacket clearance markdown (demo)',
                          'https://bargainhuntrs.com/deals', 'Target', 'apparel',
                          'Demo showcase listing — clearance price-drop card.',
                          NULL, NULL, NULL, 89.99, 44.99),
                         ('coupon_code', '15% off first-order welcome code (demo)',
                          'https://bargainhuntrs.com/deals', 'Best Buy', 'electronics',
                          'Demo showcase listing — welcome-code style submission.',
                          'WELCOME15', 'percentage', 15.0, NULL, NULL)
                   ) AS v(submission_type, title, url, retailer, category,
                          description, coupon_code, discount_type, discount_value,
                          original_price, sale_price),
                   (SELECT id FROM users WHERE email = :email LIMIT 1) AS u
                   WHERE NOT EXISTS
                     (SELECT 1 FROM seller_submissions WHERE is_demo = true)"""
            ),
            {"email": _DEMO_SELLER_EMAIL},
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    _showcase_ensured = True


@router.get("/showcase")
async def seller_showcase(
    limit: int = 12,
    db: Session = Depends(get_db),
):
    """Public seller showcase — approved submissions surfaced to visitors so
    the seller portal shows what published seller content looks like.

    Demo rows (is_demo) seed automatically until real approved submissions
    exist; each row carries the flag so the UI can label it. Safe public
    fields only — no seller identity, no review internals.
    """
    _ensure_showcase_schema(db)
    rows = (
        db.query(SellerSubmission)
        .filter(SellerSubmission.status == "approved")
        .order_by(
            # Demo filler sinks below real approved seller content.
            SellerSubmission.is_demo.asc(),
            desc(SellerSubmission.created_at),
        )
        .limit(min(limit, 24))
        .all()
    )
    return {
        "items": [
            {
                "id": str(s.id),
                "submission_type": s.submission_type,
                "title": s.title,
                "url": s.url,
                "retailer": s.retailer,
                "image_url": s.image_url,
                "category": s.category,
                "coupon_code": s.coupon_code,
                "discount_type": s.discount_type,
                "discount_value": float(s.discount_value) if s.discount_value is not None else None,
                "original_price": float(s.original_price) if s.original_price is not None else None,
                "sale_price": float(s.sale_price) if s.sale_price is not None else None,
                "is_demo": bool(getattr(s, "is_demo", False)),
            }
            for s in rows
        ]
    }


# ─── Apply to Become a Verified Seller ─────────────────────────────────────────

@router.post("/apply", status_code=status.HTTP_200_OK)
async def apply_as_seller(
    body: ApplySellerRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Apply to become a verified seller. Creates a pending application
    that must be approved by an admin before the user can post deals/coupons."""
    current_user.is_verified_seller = False  # Pending — admin must approve
    current_user.seller_store_name = body.store_name
    current_user.seller_website = body.website

    db.commit()
    db.refresh(current_user)

    logger.info(f"User {current_user.email} applied as seller: {body.store_name} (pending approval)")

    return {
        "success": True,
        "status": "pending",
        "message": "Your seller application has been submitted and is pending admin approval.",
        "seller_profile": {
            "is_verified_seller": current_user.is_verified_seller,
            "seller_store_name": current_user.seller_store_name,
            "seller_website": current_user.seller_website,
        },
    }


# ─── Get Seller Profile ────────────────────────────────────────────────────────

@router.get("/profile")
async def get_seller_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the current user's seller profile and submission counts."""
    _require_verified_seller(current_user)

    counts = db.query(
        SellerSubmission.submission_type,
        SellerSubmission.status,
        func.count(SellerSubmission.id),
    ).filter(
        SellerSubmission.seller_id == current_user.id,
    ).group_by(
        SellerSubmission.submission_type, SellerSubmission.status,
    ).all()

    submission_counts = {}
    for submission_type, sub_status, count in counts:
        key = f"{submission_type}_{sub_status}"
        submission_counts[key] = count

    total = db.query(func.count(SellerSubmission.id)).filter(
        SellerSubmission.seller_id == current_user.id,
    ).scalar() or 0

    return {
        "is_verified_seller": current_user.is_verified_seller,
        "seller_store_name": current_user.seller_store_name,
        "seller_website": current_user.seller_website,
        "total_submissions": total,
        "submission_counts": submission_counts,
    }


# ─── Submit a Coupon Code ──────────────────────────────────────────────────────

@router.post("/submit/coupon", status_code=status.HTTP_201_CREATED)
async def submit_coupon(
    body: SubmitCouponRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit a coupon code. Verified sellers are auto-approved."""
    _require_verified_seller(current_user)

    # Create the SellerSubmission record
    submission = SellerSubmission(
        seller_id=current_user.id,
        submission_type="coupon_code",
        title=body.title,
        url=body.url,
        retailer=body.retailer.lower(),
        coupon_code=body.coupon_code,
        discount_type=body.discount_type,
        discount_value=Decimal(str(body.discount_value)),
        expires_at=body.expires_at,
        category=body.category,
        description=body.description,
        status="approved",
        reviewed_at=datetime.utcnow(),
    )
    db.add(submission)
    db.flush()  # get the submission id

    # Auto-approve: create the CouponCode record directly
    coupon = CouponCode(
        code=body.coupon_code,
        retailer=body.retailer.lower(),
        title=body.title,
        description=body.description,
        discount_type=body.discount_type,
        discount_value=Decimal(str(body.discount_value)),
        category=body.category,
        product_url=body.url,
        source="seller",
        source_url=body.url,
        expires_at=body.expires_at,
        verified=True,
        verified_at=datetime.utcnow(),
        status="active",
    )
    db.add(coupon)
    db.flush()

    # Link the submission to the promoted coupon
    submission.promoted_coupon_id = coupon.id

    db.commit()
    db.refresh(submission)
    db.refresh(coupon)

    logger.info(
        f"Seller {current_user.email} submitted coupon '{body.coupon_code}' for {body.retailer}"
    )

    return {
        "success": True,
        "submission": _submission_to_response(submission),
        "coupon": {
            "id": str(coupon.id),
            "code": coupon.code,
            "retailer": coupon.retailer,
            "discount_type": coupon.discount_type,
            "discount_value": float(coupon.discount_value) if coupon.discount_value is not None else None,
            "status": coupon.status,
            "verified": coupon.verified,
        },
    }


# ─── Submit a Price Drop ───────────────────────────────────────────────────────

@router.post("/submit/price-drop", status_code=status.HTTP_201_CREATED)
async def submit_price_drop(
    body: SubmitPriceDropRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit a price drop. Verified sellers are auto-approved."""
    _require_verified_seller(current_user)

    if body.sale_price >= body.original_price:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sale price must be lower than original price.",
        )

    # Compute discount percentage
    discount_percent = round(
        (1 - body.sale_price / body.original_price) * 100, 1
    )

    # Create the SellerSubmission record
    submission = SellerSubmission(
        seller_id=current_user.id,
        submission_type="price_drop",
        title=body.title,
        url=body.url,
        retailer=body.retailer.lower(),
        image_url=body.image_url,
        category=body.category,
        description=body.description,
        original_price=Decimal(str(body.original_price)),
        sale_price=Decimal(str(body.sale_price)),
        status="approved",
        reviewed_at=datetime.utcnow(),
    )
    db.add(submission)
    db.flush()

    # Auto-approve: create the ArbitrageDeal record directly
    deal = ArbitrageDeal(
        asin=f"SELLER-{submission.id}",  # synthetic identifier for seller-submitted deals
        title=body.title,
        image_url=body.image_url,
        buy_url=body.url,
        buy_platform="seller",
        retailer=body.retailer.lower(),
        deal_source="online",
        buy_price=Decimal(str(body.sale_price)),
        sell_platform="seller",
        sell_price=Decimal(str(body.original_price)),
        category=body.category,
        niche=body.category,
        is_profitable=True,
        status="active",
        deal_tier="clearance",
    )
    db.add(deal)
    db.flush()

    # Link the submission to the promoted deal
    submission.promoted_deal_id = deal.id

    db.commit()
    db.refresh(submission)
    db.refresh(deal)

    logger.info(
        f"Seller {current_user.email} submitted price drop '{body.title}' for {body.retailer}"
    )

    return {
        "success": True,
        "submission": _submission_to_response(submission),
        "deal": {
            "id": str(deal.id),
            "title": deal.title,
            "retailer": deal.retailer,
            "buy_price": float(deal.buy_price) if deal.buy_price is not None else None,
            "sell_price": float(deal.sell_price) if deal.sell_price is not None else None,
            "discount_percent": discount_percent,
            "status": deal.status,
        },
    }


# ─── Bulk Submit Deals ─────────────────────────────────────────────────────────

@router.post("/submit/bulk", status_code=status.HTTP_201_CREATED)
async def bulk_submit_deals(
    body: BulkSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Bulk submit price-drop deals. Verified sellers only."""
    _require_verified_seller(current_user)

    if not body.deals:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No deals provided.",
        )

    success_count = 0
    errors = []

    for idx, item in enumerate(body.deals):
        try:
            if item.sale_price >= item.original_price:
                errors.append({
                    "index": idx,
                    "title": item.title,
                    "error": "Sale price must be lower than original price.",
                })
                continue

            submission = SellerSubmission(
                seller_id=current_user.id,
                submission_type="price_drop",
                title=item.title,
                url=item.url,
                retailer=item.retailer.lower(),
                image_url=item.image_url,
                category=item.category,
                description=item.description,
                original_price=Decimal(str(item.original_price)),
                sale_price=Decimal(str(item.sale_price)),
                status="approved",
                reviewed_at=datetime.utcnow(),
            )
            db.add(submission)
            db.flush()

            deal = ArbitrageDeal(
                asin=f"SELLER-{submission.id}",
                title=item.title,
                image_url=item.image_url,
                buy_url=item.url,
                buy_platform="seller",
                retailer=item.retailer.lower(),
                deal_source="online",
                buy_price=Decimal(str(item.sale_price)),
                sell_platform="seller",
                sell_price=Decimal(str(item.original_price)),
                category=item.category,
                niche=item.category,
                is_profitable=True,
                status="active",
                deal_tier="clearance",
            )
            db.add(deal)
            db.flush()

            submission.promoted_deal_id = deal.id
            success_count += 1

        except Exception as e:
            logger.error(f"Bulk submit error at index {idx}: {e}")
            errors.append({
                "index": idx,
                "title": getattr(item, "title", None),
                "error": str(e),
            })

    db.commit()

    logger.info(
        f"Seller {current_user.email} bulk submitted {success_count}/{len(body.deals)} deals"
    )

    return {
        "success": True,
        "total_requested": len(body.deals),
        "successful": success_count,
        "errors": errors,
    }


# ─── List Seller's Own Submissions ─────────────────────────────────────────────

@router.get("/submissions")
async def list_seller_submissions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all submissions for the current seller, newest first."""
    _require_verified_seller(current_user)

    submissions = db.query(SellerSubmission).filter(
        SellerSubmission.seller_id == current_user.id,
    ).order_by(desc(SellerSubmission.created_at)).all()

    return [_submission_to_response(s) for s in submissions]


# ─── Deactivate a Submission ───────────────────────────────────────────────────

@router.put("/submissions/{submission_id}/deactivate")
async def deactivate_submission(
    submission_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deactivate (reject) a seller's own submission, removing it from the feed."""
    _require_verified_seller(current_user)

    submission = db.query(SellerSubmission).filter(
        SellerSubmission.id == submission_id,
        SellerSubmission.seller_id == current_user.id,
    ).first()

    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found.",
        )

    submission.status = "rejected"
    submission.reviewed_at = datetime.utcnow()

    # Also deactivate the promoted coupon/deal if it exists
    if submission.promoted_coupon_id:
        coupon = db.query(CouponCode).filter(
            CouponCode.id == submission.promoted_coupon_id,
        ).first()
        if coupon:
            coupon.status = "expired"

    if submission.promoted_deal_id:
        deal = db.query(ArbitrageDeal).filter(
            ArbitrageDeal.id == submission.promoted_deal_id,
        ).first()
        if deal:
            deal.status = "rejected"

    db.commit()
    db.refresh(submission)

    logger.info(
        f"Seller {current_user.email} deactivated submission {submission_id}"
    )

    return {
        "success": True,
        "submission": _submission_to_response(submission),
    }
