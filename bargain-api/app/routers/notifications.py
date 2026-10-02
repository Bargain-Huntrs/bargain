"""
Notification API Router

Endpoints for viewing notification history and testing channels.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from app.db.session import get_db
from app.db.models import User, NotificationLog, ArbitrageDeal
from app.routers.auth import get_current_user
from app.services.notification_service import distribute_deal, DealInfo
from app.services.niche_service import get_all_niches, get_niche
from app.core.config import settings

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


class NotificationResponse(BaseModel):
    id: str
    asin: Optional[str] = None
    channel: str
    recipient: Optional[str] = None
    status: str
    error: Optional[str] = None
    sent_at: Optional[str] = None
    created_at: str


class ChannelStatus(BaseModel):
    channel: str
    configured: bool


class TestNotificationResponse(BaseModel):
    results: dict


@router.get("/channels", response_model=List[ChannelStatus])
async def list_channels(
    current_user: User = Depends(get_current_user),
):
    """List all notification channels and their configuration status."""
    channels = [
        ("discord", bool(settings.DISCORD_WEBHOOK_URL)),
        ("telegram", bool(settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHANNEL_ID)),
        ("twitter", bool(settings.TWITTER_API_KEY and settings.TWITTER_ACCESS_TOKEN)),
        ("facebook", bool(settings.FACEBOOK_PAGE_ACCESS_TOKEN and settings.FACEBOOK_PAGE_ID)),
        ("push", bool(settings.FIREBASE_PROJECT_ID and settings.FIREBASE_CLIENT_EMAIL)),
        ("email", bool(settings.RESEND_API_KEY)),
    ]
    return [ChannelStatus(channel=name, configured=configured) for name, configured in channels]


@router.get("/history", response_model=List[NotificationResponse])
async def notification_history(
    channel: Optional[str] = Query(None, description="Filter by channel"),
    status: Optional[str] = Query(None, description="Filter by status (sent, failed)"),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """View notification send history. Non-admin users see only their own notifications."""
    query = db.query(NotificationLog)

    # Non-admin users only see their own notifications (filtered by recipient)
    is_admin = getattr(current_user, "is_admin", False)
    if not is_admin:
        # Filter to notifications sent to this user's email or FCM token
        user_email = current_user.email or ""
        query = query.filter(NotificationLog.recipient == user_email)

    if channel:
        query = query.filter(NotificationLog.channel == channel)
    if status:
        query = query.filter(NotificationLog.status == status)

    query = query.order_by(NotificationLog.created_at.desc())
    logs = query.offset(offset).limit(limit).all()

    return [
        NotificationResponse(
            id=str(log.id),
            asin=log.asin,
            channel=log.channel,
            # Redact recipient for non-admin users
            recipient=log.recipient if is_admin else "***",
            status=log.status,
            error=log.error,
            sent_at=log.sent_at.isoformat() if log.sent_at else None,
            created_at=log.created_at.isoformat() if log.created_at else "",
        )
        for log in logs
    ]


@router.post("/test", response_model=TestNotificationResponse)
async def test_notification(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a test notification to all configured channels. Admin only."""
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required to send test notifications.")
    test_deal = DealInfo(
        asin="TEST001",
        title="Test Deal — Notification System Check",
        buy_price=__import__("decimal").Decimal("19.99"),
        sell_price=__import__("decimal").Decimal("39.99"),
        net_profit=__import__("decimal").Decimal("12.50"),
        roi=__import__("decimal").Decimal("0.63"),
        deal_tier="arbitrage",
        buy_url="https://www.amazon.com/dp/B08N5WRWNW",
        image_url=None,
    )

    results = await distribute_deal(test_deal, db)
    return TestNotificationResponse(results=results)


@router.post("/deal/{deal_id}/distribute", response_model=TestNotificationResponse)
async def distribute_existing_deal(
    deal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Manually distribute an existing arbitrage deal to all notification channels. Admin only."""
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required to distribute deals.")
    deal = db.query(ArbitrageDeal).filter(ArbitrageDeal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    deal_info = DealInfo.from_deal(deal)
    results = await distribute_deal(deal_info, db)
    return TestNotificationResponse(results=results)


# ─── Notification Preferences ───────────────────────────────────────────────

class NotificationPreferencesResponse(BaseModel):
    email_deal_alerts: bool
    sms_deal_alerts: bool
    discord_alerts: bool
    telegram_alerts: bool
    push_notifications: bool
    weekly_digest: bool
    glitch_alerts: bool
    alert_max_per_day: int = 0
    quiet_start_hour: Optional[int] = None
    quiet_end_hour: Optional[int] = None
    alert_timezone: Optional[str] = None


class NotificationPreferencesUpdate(BaseModel):
    email_deal_alerts: Optional[bool] = None
    sms_deal_alerts: Optional[bool] = None
    discord_alerts: Optional[bool] = None
    telegram_alerts: Optional[bool] = None
    push_notifications: Optional[bool] = None
    weekly_digest: Optional[bool] = None
    glitch_alerts: Optional[bool] = None
    alert_max_per_day: Optional[int] = None
    quiet_start_hour: Optional[int] = None
    quiet_end_hour: Optional[int] = None
    alert_timezone: Optional[str] = None


def _prefs_response(current_user: User) -> NotificationPreferencesResponse:
    return NotificationPreferencesResponse(
        email_deal_alerts=bool(current_user.email_deal_alerts),
        sms_deal_alerts=bool(current_user.sms_deal_alerts),
        discord_alerts=bool(current_user.discord_alerts),
        telegram_alerts=bool(current_user.telegram_alerts),
        push_notifications=bool(current_user.push_notifications),
        weekly_digest=bool(current_user.weekly_digest),
        glitch_alerts=bool(current_user.glitch_alerts),
        alert_max_per_day=int(current_user.alert_max_per_day or 0),
        quiet_start_hour=current_user.quiet_start_hour,
        quiet_end_hour=current_user.quiet_end_hour,
        alert_timezone=current_user.alert_timezone,
    )


@router.get("/preferences", response_model=NotificationPreferencesResponse)
async def get_notification_preferences(
    current_user: User = Depends(get_current_user),
):
    """Return the current user's notification preferences."""
    return _prefs_response(current_user)


@router.put("/preferences", response_model=NotificationPreferencesResponse)
async def update_notification_preferences(
    body: NotificationPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the current user's notification preferences.

    SMS deal alerts require a Hunter subscription.
    """
    is_hunter = (current_user.subscription_tier or "").lower() == "hunter"

    # SMS alerts are restricted to Hunter tier users.
    if body.sms_deal_alerts is True and not is_hunter:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SMS deal alerts require a Hunter subscription.",
        )

    # Validate the new limit fields before touching the user row.
    if body.alert_max_per_day is not None and not (0 <= body.alert_max_per_day <= 500):
        raise HTTPException(status_code=400, detail="alert_max_per_day must be 0 (unlimited) – 500")
    for h in (body.quiet_start_hour, body.quiet_end_hour):
        if h is not None and not (0 <= h <= 23):
            raise HTTPException(status_code=400, detail="quiet hours must be 0–23")
    if body.alert_timezone is not None:
        try:
            from zoneinfo import ZoneInfo
            ZoneInfo(body.alert_timezone)
        except Exception:
            raise HTTPException(status_code=400, detail="alert_timezone must be an IANA name like America/Chicago")

    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)

    return _prefs_response(current_user)


# ─── Niche Subscriptions ────────────────────────────────────────────────────

class NicheSubscriptionResponse(BaseModel):
    available_niches: list[dict]
    subscribed_niches: list[str]


@router.get("/niches", response_model=NicheSubscriptionResponse)
async def get_niche_subscriptions(
    current_user: User = Depends(get_current_user),
):
    """Return all available niches and the current user's subscriptions."""
    available = [
        {
            "key": n.key,
            "name": n.display_name,
            "emoji": n.emoji,
            "description": n.description,
            "typical_margin": n.typical_margin,
        }
        for n in get_all_niches()
    ]
    return NicheSubscriptionResponse(
        available_niches=available,
        subscribed_niches=current_user.subscribed_niches or [],
    )


@router.post("/niches/{niche}/subscribe")
async def subscribe_to_niche(
    niche: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Subscribe the current user to a specific niche."""
    n = get_niche(niche)
    if not n:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown niche: {niche}",
        )

    current_subs = set(current_user.subscribed_niches or [])
    current_subs.add(niche)
    current_user.subscribed_niches = list(current_subs)

    db.commit()
    db.refresh(current_user)

    return {"success": True, "subscribed_niches": current_user.subscribed_niches or []}


@router.delete("/niches/{niche}/unsubscribe")
async def unsubscribe_from_niche(
    niche: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Unsubscribe the current user from a specific niche."""
    n = get_niche(niche)
    if not n:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown niche: {niche}",
        )

    current_subs = set(current_user.subscribed_niches or [])
    current_subs.discard(niche)
    current_user.subscribed_niches = list(current_subs)

    db.commit()
    db.refresh(current_user)

    return {"success": True, "subscribed_niches": current_user.subscribed_niches or []}


# --- Firebase Cloud Messaging (push notifications) ---


class FCMTokenRequest(BaseModel):
    token: str


class PushTestRequest(BaseModel):
    title: str = "Test Push Notification"
    body: str = "This is a test from BargainHuntrs!"


@router.post("/push/register")
async def register_fcm_token(
    req: FCMTokenRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Register or update the user's FCM token for web push notifications."""
    if not req.token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="FCM token is required",
        )

    current_user.fcm_token = req.token
    current_user.push_notifications = True
    db.commit()

    return {"success": True, "message": "FCM token registered"}


@router.delete("/push/unregister")
async def unregister_fcm_token(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove the user's FCM token (disable push notifications)."""
    current_user.fcm_token = None
    current_user.push_notifications = False
    db.commit()

    return {"success": True, "message": "FCM token removed"}


@router.post("/push/test")
async def test_push_notification(
    req: PushTestRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a test push notification to the current user."""
    from app.services.firebase_service import send_push_notification, is_firebase_configured

    if not is_firebase_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Push notifications are not configured",
        )

    if not current_user.fcm_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No FCM token registered. Enable push notifications first.",
        )

    result = await send_push_notification(
        token=current_user.fcm_token,
        title=req.title,
        body=req.body,
        url="https://www.bargainhuntrs.com/deals",
    )

    if result.get("status") == "invalid_token":
        current_user.fcm_token = None
        current_user.push_notifications = False
        db.commit()

    return result
