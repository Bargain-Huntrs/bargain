"""
Admin CRM — Prime-style dashboard/leads/activity pattern adapted to the
deals + affiliate domain. All endpoints require an admin user.

Contacts = platform users; leads = seller submissions + community deal
submissions (moderation pipeline); activities = staff notes/tasks.
"""
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, text
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import (
    User,
    CrmActivity,
    NewsletterSubscriber,
    WaitlistEntry,
    ArbitrageDeal,
    Alert,
    AffiliateClick,
    ReferralClaim,
    SellerSubmission,
    UserSubmittedDeal,
)
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/v1/crm", tags=["crm"])

_table_ensured = False


def _ensure_table(db: Session) -> None:
    """Self-healing DDL — crm_activities is also covered by alembic 034, but
    Render runs no migrations at boot, so create it lazily on first use."""
    global _table_ensured
    if _table_ensured:
        return
    try:
        db.execute(
            text(
                """CREATE TABLE IF NOT EXISTS crm_activities (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    subject_user_id UUID REFERENCES users(id),
                    author_id UUID NOT NULL REFERENCES users(id),
                    type VARCHAR(20) NOT NULL DEFAULT 'note',
                    body TEXT NOT NULL,
                    due_at TIMESTAMP,
                    done_at TIMESTAMP,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                )"""
            )
        )
        db.commit()
    except Exception:
        db.rollback()
    _table_ensured = True


def require_admin(user: User = Depends(get_current_user)) -> User:
    if (user.role or "").lower() != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


# ── Schemas ──────────────────────────────────────────────────────────────

class ActivityCreate(BaseModel):
    subject_user_id: Optional[UUID] = None
    type: str = Field(default="note", pattern="^(note|call|email|meeting|task|status_change)$")
    body: str = Field(min_length=1, max_length=5000)
    due_at: Optional[datetime] = None


class SubmissionReview(BaseModel):
    action: str = Field(pattern="^(approve|reject)$")
    reason: Optional[str] = None


# ── Dashboard ────────────────────────────────────────────────────────────

@router.get("/dashboard/stats")
def dashboard_stats(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    _ensure_table(db)
    now = datetime.utcnow()
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    start_of_last_month = (start_of_month - timedelta(days=1)).replace(day=1)

    total_users = db.query(func.count(User.id)).scalar() or 0
    paid_users = db.query(func.count(User.id)).filter(User.subscription_tier != "free").scalar() or 0
    subscribers = (
        db.query(func.count(NewsletterSubscriber.id))
        .filter(NewsletterSubscriber.is_active == True)  # noqa: E712
        .scalar()
        or 0
    )
    live_deals = (
        db.query(func.count(ArbitrageDeal.id))
        .filter(ArbitrageDeal.status == "active")
        .scalar()
        or 0
    )
    active_alerts = db.query(func.count(Alert.id)).scalar() or 0
    clicks = (
        db.query(
            func.count(AffiliateClick.id),
            func.count(AffiliateClick.id).filter(AffiliateClick.converted == True),  # noqa: E712
            func.coalesce(func.sum(AffiliateClick.commission_earned), 0),
        )
        .first()
    )
    pending_seller = (
        db.query(func.count(SellerSubmission.id))
        .filter(SellerSubmission.status == "pending")
        .scalar()
        or 0
    )
    pending_deals = (
        db.query(func.count(UserSubmittedDeal.id))
        .filter(UserSubmittedDeal.status == "pending")
        .scalar()
        or 0
    )
    waitlist = db.query(func.count(WaitlistEntry.id)).scalar() or 0
    referrals = db.query(func.count(ReferralClaim.id)).scalar() or 0
    signups_this_month = (
        db.query(func.count(User.id)).filter(User.created_at >= start_of_month).scalar() or 0
    )
    signups_last_month = (
        db.query(func.count(User.id))
        .filter(User.created_at >= start_of_last_month, User.created_at < start_of_month)
        .scalar()
        or 0
    )
    tasks_due = (
        db.query(func.count(CrmActivity.id))
        .filter(CrmActivity.type == "task", CrmActivity.done_at.is_(None))
        .scalar()
        or 0
    )

    monthly_growth = (
        ((signups_this_month - signups_last_month) / signups_last_month * 100)
        if signups_last_month > 0
        else (100 if signups_this_month > 0 else 0)
    )

    return {
        "totalUsers": total_users,
        "paidUsers": paid_users,
        "newsletterSubscribers": subscribers,
        "liveDeals": live_deals,
        "activeAlerts": active_alerts,
        "affiliateClicks": clicks[0],
        "conversions": clicks[1],
        "commissionEarned": round(float(clicks[2]), 2),
        "conversionRate": round(clicks[1] / clicks[0] * 100, 1) if clicks[0] else 0,
        "pendingSellerSubmissions": pending_seller,
        "pendingCommunityDeals": pending_deals,
        "waitlistEntries": waitlist,
        "referralClaims": referrals,
        "signupsThisMonth": signups_this_month,
        "monthlyGrowth": round(monthly_growth, 1),
        "tasksDue": tasks_due,
    }


@router.get("/dashboard/activity")
def dashboard_activity(
    limit: int = Query(default=15, le=50),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    _ensure_table(db)
    items = []
    for u in db.query(User).order_by(User.created_at.desc()).limit(min(limit, 6)):
        items.append({
            "id": str(u.id), "type": "signup", "title": "New member",
            "description": u.email, "timestamp": u.created_at.isoformat() if u.created_at else None,
        })
    for s in db.query(SellerSubmission).order_by(SellerSubmission.created_at.desc()).limit(4):
        items.append({
            "id": str(s.id), "type": "submission", "title": "Seller submission",
            "description": s.title[:120], "timestamp": s.created_at.isoformat() if s.created_at else None,
            "status": s.status,
        })
    for d in db.query(UserSubmittedDeal).order_by(UserSubmittedDeal.created_at.desc()).limit(4):
        items.append({
            "id": str(d.id), "type": "submission", "title": "Community deal submitted",
            "description": d.title[:120], "timestamp": d.created_at.isoformat() if d.created_at else None,
            "status": d.status,
        })
    for a in db.query(CrmActivity).order_by(CrmActivity.created_at.desc()).limit(4):
        items.append({
            "id": str(a.id), "type": a.type, "title": "Task" if a.type == "task" else f"Logged {a.type}",
            "description": a.body[:140],
            "timestamp": a.created_at.isoformat() if a.created_at else None,
        })
    items.sort(key=lambda x: x["timestamp"] or "", reverse=True)
    return {"recentActivity": items[:limit]}


# ── Members (contacts) ───────────────────────────────────────────────────

@router.get("/members")
def list_members(
    tier: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    q = db.query(User)
    if tier:
        q = q.filter(User.subscription_tier == tier)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(User.email.ilike(like), User.first_name.ilike(like), User.last_name.ilike(like)))
    users = q.order_by(User.created_at.desc()).limit(limit).all()
    return [
        {
            "id": str(u.id),
            "email": u.email,
            "name": f"{u.first_name or ''} {u.last_name or ''}".strip(),
            "tier": u.subscription_tier,
            "role": u.role,
            "emailVerified": u.email_verified,
            "phoneVerified": u.phone_verified,
            "emailAlerts": u.email_deal_alerts,
            "smsAlerts": u.sms_deal_alerts,
            "createdAt": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


@router.get("/members/{user_id}")
def member_detail(user_id: UUID, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    _ensure_table(db)
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    notes = (
        db.query(CrmActivity)
        .filter(CrmActivity.subject_user_id == user_id)
        .order_by(CrmActivity.created_at.desc())
        .limit(50)
        .all()
    )
    clicks = db.query(func.count(AffiliateClick.id)).filter(AffiliateClick.user_id == user_id).scalar() or 0
    submissions = db.query(func.count(UserSubmittedDeal.id)).filter(UserSubmittedDeal.user_id == user_id).scalar() or 0
    return {
        "id": str(u.id),
        "email": u.email,
        "name": f"{u.first_name or ''} {u.last_name or ''}".strip(),
        "tier": u.subscription_tier,
        "role": u.role,
        "emailVerified": u.email_verified,
        "phoneVerified": u.phone_verified,
        "alertPrefs": {
            "email": u.email_deal_alerts,
            "sms": u.sms_deal_alerts,
            "discord": u.discord_alerts,
            "telegram": u.telegram_alerts,
            "push": u.push_notifications,
        },
        "affiliateClicks": clicks,
        "submittedDeals": submissions,
        "createdAt": u.created_at.isoformat() if u.created_at else None,
        "activities": [
            {
                "id": str(a.id), "type": a.type, "body": a.body,
                "dueAt": a.due_at.isoformat() if a.due_at else None,
                "doneAt": a.done_at.isoformat() if a.done_at else None,
                "createdAt": a.created_at.isoformat() if a.created_at else None,
            }
            for a in notes
        ],
    }


# ── Leads: seller + community submission moderation pipeline ─────────────

@router.get("/leads")
def list_leads(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    kind: Optional[str] = Query(default=None, pattern="^(seller|community)$"),
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    leads = []
    if kind in (None, "seller"):
        q = db.query(SellerSubmission)
        if status_filter:
            q = q.filter(SellerSubmission.status == status_filter)
        for s in q.order_by(SellerSubmission.created_at.desc()).limit(limit):
            leads.append({
                "id": str(s.id), "kind": "seller", "title": s.title, "retailer": s.retailer,
                "type": s.submission_type, "status": s.status, "url": s.url,
                "createdAt": s.created_at.isoformat() if s.created_at else None,
            })
    if kind in (None, "community"):
        q = db.query(UserSubmittedDeal)
        if status_filter:
            q = q.filter(UserSubmittedDeal.status == status_filter)
        for d in q.order_by(UserSubmittedDeal.created_at.desc()).limit(limit):
            leads.append({
                "id": str(d.id), "kind": "community", "title": d.title, "retailer": d.retailer,
                "type": "deal", "status": d.status, "url": d.url, "score": d.score,
                "createdAt": d.created_at.isoformat() if d.created_at else None,
            })
    leads.sort(key=lambda x: x["createdAt"] or "", reverse=True)
    return leads[:limit]


@router.post("/leads/{kind}/{submission_id}/review")
def review_lead(
    kind: str,
    submission_id: UUID,
    body: SubmissionReview,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    model = SellerSubmission if kind == "seller" else UserSubmittedDeal if kind == "community" else None
    if model is None:
        raise HTTPException(status_code=400, detail="kind must be 'seller' or 'community'")
    row = db.query(model).filter(model.id == submission_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Submission not found")
    row.status = "approved" if body.action == "approve" else "rejected"
    row.reviewed_by = admin.id
    row.reviewed_at = datetime.utcnow()
    if kind == "community" and body.action == "reject" and body.reason:
        row.rejection_reason = body.reason[:500]
    db.commit()
    db.refresh(row)
    return {"id": str(row.id), "status": row.status, "reviewedAt": row.reviewed_at.isoformat()}


# ── Activities / tasks ───────────────────────────────────────────────────

@router.post("/activities")
def log_activity(
    body: ActivityCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    _ensure_table(db)
    if body.subject_user_id and not db.query(User.id).filter(User.id == body.subject_user_id).first():
        raise HTTPException(status_code=404, detail="User not found")
    activity = CrmActivity(
        subject_user_id=body.subject_user_id,
        author_id=admin.id,
        type=body.type,
        body=body.body,
        due_at=body.due_at,
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return {"id": str(activity.id), "createdAt": activity.created_at.isoformat()}


@router.get("/tasks")
def list_tasks(
    includeDone: bool = False,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    _ensure_table(db)
    q = db.query(CrmActivity).filter(CrmActivity.type == "task")
    if not includeDone:
        q = q.filter(CrmActivity.done_at.is_(None))
    return [
        {
            "id": str(t.id), "body": t.body, "subjectUserId": str(t.subject_user_id) if t.subject_user_id else None,
            "dueAt": t.due_at.isoformat() if t.due_at else None,
            "doneAt": t.done_at.isoformat() if t.done_at else None,
            "createdAt": t.created_at.isoformat() if t.created_at else None,
        }
        for t in q.order_by(CrmActivity.due_at.asc().nullslast()).limit(100)
    ]


@router.post("/tasks/{task_id}/complete")
def complete_task(task_id: UUID, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    _ensure_table(db)
    task = db.query(CrmActivity).filter(CrmActivity.id == task_id, CrmActivity.type == "task").first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.done_at = datetime.utcnow()
    db.commit()
    return {"id": str(task.id), "doneAt": task.done_at.isoformat()}


# ── Analytics ────────────────────────────────────────────────────────────

@router.get("/analytics/pipeline")
def pipeline_analytics(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    submission_funnel = db.query(SellerSubmission.status, func.count()).group_by(SellerSubmission.status).all()
    community_funnel = db.query(UserSubmittedDeal.status, func.count()).group_by(UserSubmittedDeal.status).all()
    members_by_tier = db.query(User.subscription_tier, func.count()).group_by(User.subscription_tier).all()
    deals_by_status = db.query(ArbitrageDeal.status, func.count()).group_by(ArbitrageDeal.status).all()
    clicks_by_retailer = (
        db.query(AffiliateClick.retailer, func.count(), func.coalesce(func.sum(AffiliateClick.commission_earned), 0))
        .group_by(AffiliateClick.retailer)
        .all()
    )
    return {
        "sellerSubmissions": {s: c for s, c in submission_funnel},
        "communityDeals": {s: c for s, c in community_funnel},
        "membersByTier": {t or "free": c for t, c in members_by_tier},
        "dealsByStatus": {s: c for s, c in deals_by_status},
        "clicksByRetailer": [
            {"retailer": r or "unknown", "clicks": c, "commission": round(float(m), 2)}
            for r, c, m in clicks_by_retailer
        ],
    }


@router.get("/analytics/dashboard")
def analytics_dashboard(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    stats = dashboard_stats(db=db, admin=admin)
    pipeline = pipeline_analytics(db=db, admin=admin)
    deals_by_month = (
        db.query(
            func.to_char(func.date_trunc("month", ArbitrageDeal.detected_at), "Mon"),
            func.count(),
        )
        .filter(ArbitrageDeal.detected_at >= func.date_trunc("month", func.now()) - timedelta(days=150))
        .group_by(func.date_trunc("month", ArbitrageDeal.detected_at))
        .order_by(func.date_trunc("month", ArbitrageDeal.detected_at))
        .all()
    )
    return {**stats, **pipeline, "dealsByMonth": [{"month": m, "count": c} for m, c in deals_by_month]}
