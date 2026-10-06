"""
Public feature-request board — powers the /roadmap page and the floating
Feedback widget. Submitting and voting work anonymously (voter identity is a
client-generated id when there's no session); status changes are admin-only.
"""
import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import desc, func, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.db.models import User, FeatureRequest, FeatureRequestVote
from app.routers.auth import security
from app.routers.crm import require_admin

router = APIRouter(prefix="/api/v1/feedback", tags=["feedback"])

REQUEST_STATUSES = ("under_review", "planned", "in_progress", "shipped", "declined")

_table_ensured = False


def _ensure_tables(db: Session) -> None:
    """Self-healing DDL — alembic 035 creates these, but Render runs no
    migrations at boot, so create lazily on first use (crm.py pattern)."""
    global _table_ensured
    if _table_ensured:
        return
    try:
        db.execute(text(
            """CREATE TABLE IF NOT EXISTS feature_requests (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title VARCHAR(160) NOT NULL,
                body TEXT,
                category VARCHAR(50) NOT NULL DEFAULT 'general',
                status VARCHAR(20) NOT NULL DEFAULT 'under_review',
                votes INTEGER NOT NULL DEFAULT 0,
                author_name VARCHAR(120),
                author_email VARCHAR(255),
                user_id UUID REFERENCES users(id),
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )"""
        ))
        db.execute(text(
            """CREATE TABLE IF NOT EXISTS feature_request_votes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                request_id UUID NOT NULL REFERENCES feature_requests(id) ON DELETE CASCADE,
                voter_id VARCHAR(255) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_feature_request_vote UNIQUE (request_id, voter_id)
            )"""
        ))
        db.commit()
    except Exception:
        db.rollback()
    _table_ensured = True


def get_optional_user(
    credentials=Depends(security),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Like get_current_user but returns None instead of 401 for
    missing/invalid tokens — public endpoints that behave differently for
    signed-in users."""
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


# ── Schemas ──────────────────────────────────────────────────────────────

class FeatureRequestCreate(BaseModel):
    title: str = Field(min_length=5, max_length=160)
    body: Optional[str] = Field(default=None, max_length=5000)
    category: str = Field(default="general", max_length=50)
    author_name: Optional[str] = Field(default=None, max_length=120)
    author_email: Optional[EmailStr] = None

    @field_validator("title", "category")
    @classmethod
    def strip_nonempty(cls, v):
        v = (v or "").strip()
        if not v:
            raise ValueError("Field cannot be empty")
        return v


class FeatureRequestVoteBody(BaseModel):
    voter_id: Optional[str] = Field(default=None, max_length=255)


class FeatureRequestPatch(BaseModel):
    status: Optional[str] = None
    category: Optional[str] = Field(default=None, max_length=50)
    title: Optional[str] = Field(default=None, min_length=5, max_length=160)
    body: Optional[str] = Field(default=None, max_length=5000)

    @field_validator("status")
    @classmethod
    def valid_status(cls, v):
        if v is not None and v not in REQUEST_STATUSES:
            raise ValueError(f"status must be one of {REQUEST_STATUSES}")
        return v


def _to_response(req: FeatureRequest, voted: bool = False) -> dict:
    return {
        "id": str(req.id),
        "title": req.title,
        "body": req.body,
        "category": req.category or "general",
        "status": req.status or "under_review",
        "votes": req.votes or 0,
        "author_name": req.author_name,
        "created_at": req.created_at.isoformat() if req.created_at else None,
        "updated_at": req.updated_at.isoformat() if req.updated_at else None,
        "voted": voted,
    }


def _voter_key(user: Optional[User], voter_id: Optional[str]) -> str:
    if user is not None:
        return f"user:{user.id}"
    vid = (voter_id or "").strip()
    if not vid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="voter_id is required when not signed in",
        )
    return f"anon:{vid}"


# ── Public board ─────────────────────────────────────────────────────────

@router.get("")
def list_feature_requests(
    status_filter: Optional[str] = Query(None, alias="status"),
    category: Optional[str] = Query(None),
    include_declined: bool = Query(False),
    limit: int = Query(200, le=500),
    offset: int = Query(0),
    db: Session = Depends(get_db),
):
    """List feature requests, most-voted first. Declined entries are hidden
    unless ?status=declined or ?include_declined=true is passed."""
    _ensure_tables(db)
    query = db.query(FeatureRequest)
    if status_filter:
        query = query.filter(FeatureRequest.status == status_filter)
    elif not include_declined:
        query = query.filter(FeatureRequest.status != "declined")
    if category:
        query = query.filter(FeatureRequest.category == category)
    rows = (
        query.order_by(desc(FeatureRequest.votes), desc(FeatureRequest.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [_to_response(r) for r in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_feature_request(
    body: FeatureRequestCreate,
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Submit a feature request. Signed-in users are attributed automatically;
    anonymous submissions require author_email."""
    _ensure_tables(db)
    if user is None and not body.author_email:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Email is required for anonymous submissions",
        )

    req = FeatureRequest(
        title=body.title.strip(),
        body=(body.body or "").strip() or None,
        category=body.category.strip() or "general",
        author_name=(user.full_name if user else None) or (body.author_name or "Anonymous"),
        author_email=(user.email if user else None) or (str(body.author_email) if body.author_email else None),
        user_id=user.id if user else None,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    logging.info("Feature request created: %s (%s)", req.id, req.title[:60])
    return _to_response(req)


@router.post("/{request_id}/vote")
def vote_feature_request(
    request_id: UUID,
    body: FeatureRequestVoteBody,
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Toggle a vote. Signed-in users vote as 'user:<id>'; anonymous voters
    pass a client-generated voter_id. Vote count is recounted authoritatively."""
    _ensure_tables(db)
    req = db.query(FeatureRequest).filter(FeatureRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Feature request not found")

    voter = _voter_key(user, body.voter_id)
    existing = (
        db.query(FeatureRequestVote)
        .filter(
            FeatureRequestVote.request_id == request_id,
            FeatureRequestVote.voter_id == voter,
        )
        .first()
    )
    if existing:
        db.delete(existing)
        voted = False
    else:
        db.add(FeatureRequestVote(request_id=request_id, voter_id=voter))
        voted = True
    db.flush()

    # Authoritative recount — never trust the denormalized column.
    req.votes = (
        db.query(func.count(FeatureRequestVote.id))
        .filter(FeatureRequestVote.request_id == request_id)
        .scalar()
        or 0
    )
    db.commit()
    return {"voted": voted, "votes": req.votes}


@router.patch("/{request_id}")
def update_feature_request(
    request_id: UUID,
    body: FeatureRequestPatch,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update status/category/title/body. Admin only (drives the roadmap)."""
    _ensure_tables(db)
    req = db.query(FeatureRequest).filter(FeatureRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Feature request not found")

    if body.status is not None:
        req.status = body.status
    if body.category is not None:
        req.category = body.category.strip() or req.category
    if body.title is not None:
        req.title = body.title.strip()
    if body.body is not None:
        req.body = body.body.strip() or None
    req.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(req)
    return _to_response(req)
