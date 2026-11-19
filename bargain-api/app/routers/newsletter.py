"""Newsletter API Router — subscribe, unsubscribe, admin listing, digest trigger."""
import os
import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status, Header
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy import text
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db.session import get_db
from app.db.models import NewsletterSubscriber, User
from app.core.rate_limit import rate_limit_or_429, request_ip
from app.routers.auth import get_current_user
from app.services.newsletter_service import (
    send_daily_digest,
    send_weekly_digest,
    send_newsletter_confirmation,
    send_welcome_newsletter,
)

router = APIRouter(prefix="/api/v1/newsletter", tags=["newsletter"])

_SITE_URL = "https://www.bargainhuntrs.com"
_API_URL = os.getenv("PUBLIC_API_URL", "https://api.bargainhuntrs.com")
# A fresh pending confirmation is resent at most this often — a griefer
# re-POSTing the same victim can't turn one request into N emails.
_CONFIRM_RESEND_SECONDS = 600


# --- Schemas ---

class SubscribeRequest(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    source: Optional[str] = None


class UnsubscribeRequest(BaseModel):
    email: EmailStr


class SubscriberResponse(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    subscribed_at: Optional[str] = None
    is_active: bool
    source: Optional[str] = None


class DigestResponse(BaseModel):
    sent: int
    digest_type: str


# --- Cron secret helper ---

def _verify_cron_secret(x_cron_secret: Optional[str] = Header(None)):
    expected = os.getenv("SCRAPE_CRON_SECRET")
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Newsletter digest endpoints are not configured. Set SCRAPE_CRON_SECRET.",
        )
    if x_cron_secret != expected:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing cron secret.",
        )


def _require_admin(current_user: User):
    if (current_user.role or "").lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )


# --- Double opt-in plumbing ---
#
# The subscribe endpoint is unauthenticated, so it cannot grant an active
# subscription (or fire a welcome email) on a bare POST — that made it an
# open relay for bombing arbitrary inboxes. New/re-activating addresses get
# a pending row + a confirmation email; the subscription flips to active only
# when the recipient clicks the confirm link, and the welcome email is
# deferred to that click. Confirmations live in their own table (lazy DDL,
# same pattern as community/crm _ensure_table — prod runs no migrations at
# boot) so newsletter_subscribers and its ORM model are untouched.

_confirmations_ensured = False


def _ensure_confirmations_schema(db: Session) -> None:
    global _confirmations_ensured
    if _confirmations_ensured:
        return
    try:
        db.execute(text(
            """CREATE TABLE IF NOT EXISTS newsletter_confirmations (
                email VARCHAR(255) PRIMARY KEY,
                token VARCHAR(64) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )"""
        ))
        db.commit()
    except Exception:
        db.rollback()
    _confirmations_ensured = True


def _pending_confirmation(db: Session, email: str):
    return db.execute(
        text("SELECT token, created_at FROM newsletter_confirmations WHERE email = :email"),
        {"email": email},
    ).first()


def _issue_confirmation(db: Session, email: str) -> tuple[str, bool]:
    """Upsert the pending-confirmation row.

    Returns (token, should_send) — should_send is False when a fresh pending
    row already exists, so repeat POSTs don't re-email the address.
    """
    existing = _pending_confirmation(db, email)
    if existing and existing[1] is not None:
        age = datetime.utcnow() - existing[1]
        if age < timedelta(seconds=_CONFIRM_RESEND_SECONDS):
            return existing[0], False
    token = secrets.token_urlsafe(32)
    db.execute(text(
        """INSERT INTO newsletter_confirmations (email, token, created_at)
           VALUES (:email, :token, NOW())
           ON CONFLICT (email) DO UPDATE SET token = :token, created_at = NOW()"""
    ), {"email": email, "token": token})
    return token, True


# --- Endpoints ---

@router.post("/subscribe", response_model=dict, status_code=status.HTTP_201_CREATED)
async def subscribe(request: Request, body: SubscribeRequest, db: Session = Depends(get_db)):
    """Start a newsletter subscription — double opt-in.

    Creates a pending subscription and emails a confirmation link; the
    address is only activated (and welcomed) by /confirm. IP rate-limited,
    and repeat posts inside the resend window don't re-email.
    """
    rate_limit_or_429("newsletter-subscribe", request_ip(request))
    _ensure_confirmations_schema(db)

    email = body.email.lower()
    existing = db.query(NewsletterSubscriber).filter(
        NewsletterSubscriber.email == email
    ).first()

    if existing and existing.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email is already subscribed.",
        )

    if existing:
        # Previously unsubscribed (or still-pending) — refresh metadata but
        # stay inactive until the new confirmation is clicked.
        existing.name = body.name or existing.name
        existing.source = body.source or existing.source
    else:
        db.add(NewsletterSubscriber(
            email=email,
            name=body.name,
            source=body.source or "website",
            is_active=False,
            subscribed_at=datetime.utcnow(),
        ))
    db.commit()

    try:
        token, should_send = _issue_confirmation(db, email)
        db.commit()
    except Exception:
        # The confirmation table is the only thing standing between this
        # open endpoint and arbitrary-address email sends — fail closed.
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Subscriptions are temporarily unavailable — please try again later.",
        )

    if should_send:
        try:
            send_newsletter_confirmation(email, body.name, _API_URL, token)
        except Exception:
            pass

    return {"status": "pending_confirmation", "email": email}


@router.get("/confirm", response_model=None)
async def confirm_subscription(token: str = Query(..., min_length=10), db: Session = Depends(get_db)):
    """Complete double opt-in — activates the subscription and sends the
    welcome email, then redirects to the newsletter preferences page."""
    _ensure_confirmations_schema(db)

    try:
        row = db.execute(
            text("SELECT email FROM newsletter_confirmations WHERE token = :token"),
            {"token": token},
        ).first()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Confirmations are temporarily unavailable — please try again later.",
        )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired confirmation link.",
        )
    email = row[0]

    sub = db.query(NewsletterSubscriber).filter(NewsletterSubscriber.email == email).first()
    if sub:
        sub.is_active = True
        sub.unsubscribed_at = None
        if sub.subscribed_at is None:
            sub.subscribed_at = datetime.utcnow()
    else:
        db.add(NewsletterSubscriber(
            email=email,
            source="website",
            is_active=True,
            subscribed_at=datetime.utcnow(),
        ))
    db.execute(
        text("DELETE FROM newsletter_confirmations WHERE email = :email"),
        {"email": email},
    )
    db.commit()

    try:
        send_welcome_newsletter(email, sub.name if sub else None)
    except Exception:
        pass

    return RedirectResponse(url=f"{_SITE_URL}/newsletter?confirmed=1", status_code=303)


@router.post("/unsubscribe", response_model=dict)
async def unsubscribe(body: UnsubscribeRequest, db: Session = Depends(get_db)):
    """Remove an email from the newsletter list."""
    sub = db.query(NewsletterSubscriber).filter(
        NewsletterSubscriber.email == body.email.lower()
    ).first()

    if not sub or not sub.is_active:
        return {"status": "not_subscribed", "email": body.email.lower()}

    sub.is_active = False
    sub.unsubscribed_at = datetime.utcnow()
    db.commit()

    return {"status": "unsubscribed", "email": body.email.lower()}


@router.get("/subscribers", response_model=List[SubscriberResponse])
async def list_subscribers(
    active_only: bool = Query(True, description="Filter to active subscribers only"),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin only — list all newsletter subscribers."""
    _require_admin(current_user)
    query = db.query(NewsletterSubscriber)
    if active_only:
        query = query.filter(NewsletterSubscriber.is_active == True)
    query = query.order_by(NewsletterSubscriber.subscribed_at.desc())
    subs = query.offset(offset).limit(limit).all()
    return [
        SubscriberResponse(
            id=str(s.id),
            email=s.email,
            name=s.name,
            subscribed_at=s.subscribed_at.isoformat() if s.subscribed_at else None,
            is_active=s.is_active,
            source=s.source,
        )
        for s in subs
    ]


@router.post("/send-digest", response_model=DigestResponse)
async def trigger_digest(
    digest_type: str = Query("daily", description="daily or weekly"),
    x_cron_secret: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Trigger sending the deal digest to all subscribers. Protected by cron secret."""
    _verify_cron_secret(x_cron_secret)

    if digest_type == "weekly":
        sent = send_weekly_digest()
    else:
        sent = send_daily_digest()

    return DigestResponse(sent=sent, digest_type=digest_type)
