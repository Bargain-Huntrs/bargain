"""Dropship Pools API — group-buy wholesale events + US-warehouse catalog.

The model: AI curates hot products, a pool opens with an MOQ, hunters commit
units to hit the pooled wholesale rate. All-or-nothing — commits are
reservations while a pool is open and only lock when it fills; an expired
pool cancels every commit (nobody pays). Each hunter buys and owns their
units and resells them on their own accounts. This is a group purchase,
not a pooled investment — Bargain never holds inventory or sale proceeds.

Endpoints (all prefixed /api/v1/dropship):
  - GET  /products              — catalog feed (niche filter, watch/save flags)
  - GET  /curated               — AI-ranked picks for the user's niches
  - POST /products/{id}/watch   — toggle demand vote (feeds pool curation)
  - POST /products/{id}/save    — save to product list
  - DEL  /products/{id}/save
  - GET  /saved                 — the user's product list
  - GET  /pools                 — open/recent pools with live progress
  - GET  /pools/{id}            — deal sheet for one pool
  - POST /pools/{id}/commit     — commit units (paid tier)
  - GET  /commits               — the user's active commitments
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import (
    User,
    DropshipProduct,
    DropshipSaved,
    DropshipWatch,
    DropshipPool,
    DropshipPoolCommit,
    DropshipChannelVote,
)
from app.routers.auth import get_current_user
from app.services import llm_client
from app.services.dropship_catalog import CATALOG
from app.services.niche_service import get_all_niches

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/dropship", tags=["dropship"])

PAID_DETAIL = "Pools are a Hunter-tier feature. Upgrade to commit units."

_tables_ensured = False


def _ensure_tables(db: Session) -> None:
    """Self-healing DDL — Render runs no migrations at boot, so create the
    dropship tables lazily on first use (same pattern as crm.py)."""
    global _tables_ensured
    if _tables_ensured:
        return
    try:
        db.execute(text(
            """CREATE TABLE IF NOT EXISTS dropship_products (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                sku VARCHAR(120) UNIQUE NOT NULL,
                title VARCHAR(500) NOT NULL,
                description TEXT,
                niche VARCHAR(50) NOT NULL,
                supplier VARCHAR(120) NOT NULL,
                warehouse_state VARCHAR(2),
                cost NUMERIC(10,2) NOT NULL,
                suggested_price NUMERIC(10,2) NOT NULL,
                shipping_days_min INTEGER DEFAULT 2,
                shipping_days_max INTEGER DEFAULT 5,
                image_url VARCHAR(1000),
                supplier_url VARCHAR(1000),
                trending_score FLOAT DEFAULT 0,
                is_active BOOLEAN DEFAULT TRUE,
                source VARCHAR(50) DEFAULT 'curated',
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )"""
        ))
        db.execute(text(
            """CREATE TABLE IF NOT EXISTS dropship_saved (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id),
                product_id UUID NOT NULL REFERENCES dropship_products(id),
                status VARCHAR(20) DEFAULT 'saved',
                notes TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_dropship_saved_user_product UNIQUE (user_id, product_id)
            )"""
        ))
        db.execute(text(
            """CREATE TABLE IF NOT EXISTS dropship_watches (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id),
                product_id UUID NOT NULL REFERENCES dropship_products(id),
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_dropship_watch_user_product UNIQUE (user_id, product_id)
            )"""
        ))
        db.execute(text(
            """CREATE TABLE IF NOT EXISTS dropship_pools (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                product_id UUID NOT NULL REFERENCES dropship_products(id),
                moq_units INTEGER NOT NULL,
                unit_cost NUMERIC(10,2) NOT NULL,
                target_price NUMERIC(10,2) NOT NULL,
                min_price NUMERIC(10,2),
                max_units_per_hunter INTEGER DEFAULT 10,
                units_committed INTEGER DEFAULT 0,
                status VARCHAR(20) DEFAULT 'open',
                deal_notes TEXT,
                opens_at TIMESTAMP NOT NULL DEFAULT NOW(),
                closes_at TIMESTAMP NOT NULL,
                filled_at TIMESTAMP,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )"""
        ))
        db.execute(text(
            """CREATE TABLE IF NOT EXISTS dropship_pool_commits (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                pool_id UUID NOT NULL REFERENCES dropship_pools(id),
                user_id UUID NOT NULL REFERENCES users(id),
                units INTEGER NOT NULL,
                unit_price NUMERIC(10,2) NOT NULL,
                status VARCHAR(20) DEFAULT 'reserved',
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_dropship_commit_pool_user UNIQUE (pool_id, user_id)
            )"""
        ))
        db.execute(text(
            """CREATE TABLE IF NOT EXISTS dropship_channel_votes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id),
                channel VARCHAR(30) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_dropship_chvote_user_channel UNIQUE (user_id, channel)
            )"""
        ))
        # Column upgrades for tables created before the fulfillment model —
        # ADD COLUMN IF NOT EXISTS is a no-op on fresh installs.
        for stmt in (
            "ALTER TABLE dropship_pools ADD COLUMN IF NOT EXISTS channel VARCHAR(30) DEFAULT 'amazon_fba'",
            "ALTER TABLE dropship_pools ADD COLUMN IF NOT EXISTS origin VARCHAR(10) DEFAULT 'us'",
            "ALTER TABLE dropship_pools ADD COLUMN IF NOT EXISTS freight_mode VARCHAR(20) DEFAULT 'us_stock'",
            "ALTER TABLE dropship_pools ADD COLUMN IF NOT EXISTS delivery_days_max INTEGER DEFAULT 7",
            "ALTER TABLE dropship_pool_commits ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(80)",
            "ALTER TABLE dropship_pool_commits ADD COLUMN IF NOT EXISTS hold_amount_cents INTEGER",
        ):
            db.execute(text(stmt))
        db.commit()
    except Exception:
        db.rollback()
    _tables_ensured = True


def _seed(db: Session) -> None:
    """Load the starter catalog + a few live pools when the table is empty.
    Upserts by sku so later runs update prices without duplicating."""
    existing = db.query(func.count(DropshipProduct.id)).scalar() or 0
    if not existing:
        for row in CATALOG:
            db.add(DropshipProduct(
                sku=row["sku"], title=row["title"], description=row.get("description"),
                niche=row["niche"], supplier=row["supplier"],
                warehouse_state=row.get("warehouse_state"),
                cost=row["cost"], suggested_price=row["suggested_price"],
                shipping_days_min=row.get("shipping_days_min", 2),
                shipping_days_max=row.get("shipping_days_max", 5),
                image_url=row.get("image_url"), supplier_url=row.get("supplier_url"),
                trending_score=row.get("trending_score", 0), source="curated",
            ))
        db.commit()

    # Seed pools on the hottest catalog items if none exist.
    if (db.query(func.count(DropshipPool.id)).scalar() or 0) > 0:
        return
    # sku: (moq, unit_cost, origin, freight_mode, delivery_days_max)
    picks = {
        "PET-002": (100, 9.90, "us", "us_stock", 7),
        "KIT-002": (150, 7.80, "us", "us_stock", 7),
        "PET-001": (200, 3.90, "china", "air", 12),
    }
    prods = {
        p.sku: p
        for p in db.query(DropshipProduct).filter(DropshipProduct.sku.in_(picks.keys())).all()
    }
    for sku, (moq, unit_cost, origin, freight, days) in picks.items():
        prod = prods.get(sku)
        if not prod:
            continue
        notes = (
            "AI deal sheet — bulk rate negotiated below single-unit wholesale. "
            "Hunters buy and own their units; each resells on their own store."
        )
        if origin == "china":
            notes += " China-direct via air freight — freight cost is baked into the unit rate."
        db.add(DropshipPool(
            product_id=prod.id, moq_units=moq, unit_cost=unit_cost,
            target_price=prod.suggested_price,
            min_price=round(float(prod.suggested_price) * 0.9, 2),
            max_units_per_hunter=10,
            channel="amazon_fba", origin=origin, freight_mode=freight,
            delivery_days_max=days,
            deal_notes=notes,
            closes_at=datetime.utcnow() + timedelta(days=7),
        ))
    db.commit()


# ── Stripe auth-holds ────────────────────────────────────────────────────
# Commits place a manual-capture hold when the hunter has a saved card and
# Stripe is configured; holds capture on fill and release on expiry. When
# Stripe isn't configured (dev/staging) commits proceed with hold=None so
# the pool mechanics stay testable.

def _stripe():
    from app.core.config import settings
    if not (settings.STRIPE_SECRET_KEY or settings.STRIPE_API_KEY):
        return None
    import stripe as stripe_lib
    stripe_lib.api_key = settings.STRIPE_SECRET_KEY or settings.STRIPE_API_KEY
    return stripe_lib


def _user_card_pm(stripe_lib, user: User) -> Optional[str]:
    """First saved card on the hunter's Stripe customer — used for the
    off-session hold. Hunters add a card via /payment-method/setup."""
    if not user.stripe_customer_id:
        return None
    try:
        pms = stripe_lib.PaymentMethod.list(customer=user.stripe_customer_id, type="card")
        return pms.data[0].id if pms.data else None
    except Exception as exc:
        logger.warning("pm list failed for %s: %s", user.id, exc)
        return None


def _place_hold(db: Session, user: User, amount_cents: int) -> tuple[Optional[str], bool]:
    """Create a manual-capture PaymentIntent on the hunter's saved card.
    Returns (payment_intent_id, hold_required). hold_required=False means
    Stripe isn't configured or the user has no card — the commit proceeds
    as a plain reservation."""
    stripe_lib = _stripe()
    if not stripe_lib:
        return None, False
    pm = _user_card_pm(stripe_lib, user)
    if not pm:
        return None, False
    try:
        pi = stripe_lib.PaymentIntent.create(
            amount=amount_cents, currency="usd", customer=user.stripe_customer_id,
            payment_method=pm, off_session=True, confirm=True,
            capture_method="manual",
            description="Dropship pool unit hold — captures only if the pool fills",
        )
        return pi.id, True
    except stripe_lib.error.CardError as exc:
        raise HTTPException(status_code=402, detail=f"Card declined: {exc.user_message or 'try another card'}")
    except Exception as exc:
        logger.warning("hold failed for user %s: %s", user.id, exc)
        return None, False


def _settle_holds(db: Session, pool_id, capture: bool) -> None:
    """Capture every confirmed commit's hold (pool filled) or release every
    reserved commit's hold (pool expired)."""
    stripe_lib = _stripe()
    if not stripe_lib:
        return
    commits = db.query(DropshipPoolCommit).filter(
        DropshipPoolCommit.pool_id == pool_id,
        DropshipPoolCommit.stripe_payment_intent_id.isnot(None),
    ).all()
    for c in commits:
        try:
            if capture:
                stripe_lib.PaymentIntent.capture(c.stripe_payment_intent_id)
            else:
                stripe_lib.PaymentIntent.cancel(c.stripe_payment_intent_id)
        except Exception as exc:
            logger.warning("hold %s failed for intent %s: %s",
                           "capture" if capture else "release",
                           c.stripe_payment_intent_id, exc)


def _require_paid(user: User) -> None:
    if (user.subscription_tier or "free").lower() == "free":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=PAID_DETAIL)


def _product_out(p: DropshipProduct, watching: set, saved: set) -> dict:
    cost = float(p.cost)
    price = float(p.suggested_price)
    return {
        "id": str(p.id),
        "sku": p.sku,
        "title": p.title,
        "description": p.description,
        "niche": p.niche,
        "supplier": p.supplier,
        "warehouse_state": p.warehouse_state,
        "cost": cost,
        "suggested_price": price,
        "est_margin_pct": round((price - cost) / price * 100) if price > 0 else None,
        "shipping_days_min": p.shipping_days_min,
        "shipping_days_max": p.shipping_days_max,
        "image_url": p.image_url,
        "trending_score": p.trending_score,
        "watching": str(p.id) in watching,
        "saved": str(p.id) in saved,
    }


def _pool_out(pool: DropshipPool, my_commit: Optional[DropshipPoolCommit] = None) -> dict:
    p = pool.product
    unit = float(pool.unit_cost)
    target = float(pool.target_price)
    remaining = max(0, pool.moq_units - (pool.units_committed or 0))
    return {
        "id": str(pool.id),
        "status": pool.status,
        "product": _product_out(p, set(), set()) if p else None,
        "moq_units": pool.moq_units,
        "units_committed": pool.units_committed or 0,
        "units_remaining": remaining,
        "fill_pct": round((pool.units_committed or 0) / pool.moq_units * 100),
        "unit_cost": unit,
        "target_price": target,
        "min_price": float(pool.min_price) if pool.min_price else None,
        "est_margin_pct": round((target - unit) / target * 100) if target > 0 else None,
        "max_units_per_hunter": pool.max_units_per_hunter,
        "channel": pool.channel or "amazon_fba",
        "origin": pool.origin or "us",
        "freight_mode": pool.freight_mode or "us_stock",
        "delivery_days_max": pool.delivery_days_max or 7,
        "deal_notes": pool.deal_notes,
        "opens_at": pool.opens_at.isoformat() if pool.opens_at else None,
        "closes_at": pool.closes_at.isoformat() if pool.closes_at else None,
        "filled_at": pool.filled_at.isoformat() if pool.filled_at else None,
        "my_commit": (
            {"units": my_commit.units, "unit_price": float(my_commit.unit_price),
             "status": my_commit.status}
            if my_commit else None
        ),
    }


def _expire_stale_pools(db: Session) -> None:
    """Close open pools past their deadline — commits auto-cancel, nobody
    was charged (commits are reservations until fill)."""
    stale = (
        db.query(DropshipPool)
        .filter(DropshipPool.status == "open", DropshipPool.closes_at < datetime.utcnow())
        .all()
    )
    for pool in stale:
        pool.status = "expired"
        _settle_holds(db, pool.id, capture=False)
        for c in db.query(DropshipPoolCommit).filter(
            DropshipPoolCommit.pool_id == pool.id,
            DropshipPoolCommit.status == "reserved",
        ).all():
            c.status = "cancelled"
    if stale:
        db.commit()


def _my_flags(db: Session, user: User) -> tuple[set, set]:
    watching = {
        str(w.product_id)
        for w in db.query(DropshipWatch).filter(DropshipWatch.user_id == user.id).all()
    }
    saved = {
        str(s.product_id)
        for s in db.query(DropshipSaved).filter(DropshipSaved.user_id == user.id).all()
    }
    return watching, saved


# ── Catalog ──────────────────────────────────────────────────────────────

@router.get("/products")
def list_products(
    niche: Optional[str] = Query(None),
    sort: str = Query("trending", pattern="^(trending|margin|new)$"),
    limit: int = Query(48, le=200),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_tables(db)
    _seed(db)
    q = db.query(DropshipProduct).filter(DropshipProduct.is_active == True)  # noqa: E712
    if niche:
        q = q.filter(DropshipProduct.niche == niche)
    if sort == "margin":
        q = q.order_by((DropshipProduct.suggested_price - DropshipProduct.cost).desc())
    elif sort == "new":
        q = q.order_by(DropshipProduct.created_at.desc())
    else:
        q = q.order_by(DropshipProduct.trending_score.desc())
    watching, saved = _my_flags(db, user)
    return [_product_out(p, watching, saved) for p in q.limit(limit).all()]


@router.get("/curated")
def curated_feed(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """AI-ranked picks for the user's subscribed niches, each with a one-line
    'why this' reason. Deterministic fallback when the LLM isn't configured."""
    _ensure_tables(db)
    _seed(db)
    niches = user.subscribed_niches or []
    q = db.query(DropshipProduct).filter(DropshipProduct.is_active == True)  # noqa: E712
    if niches:
        q = q.filter(DropshipProduct.niche.in_(niches))
    candidates = q.order_by(DropshipProduct.trending_score.desc()).limit(12).all()
    watching, saved = _my_flags(db, user)
    items = [_product_out(p, watching, saved) for p in candidates]

    reasons: dict[str, str] = {}
    ai = False
    if llm_client.is_configured() and items:
        try:
            import asyncio
            brief = [
                {"i": i, "title": it["title"], "niche": it["niche"],
                 "cost": it["cost"], "price": it["suggested_price"],
                 "margin": it["est_margin_pct"], "heat": it["trending_score"]}
                for i, it in enumerate(items)
            ]
            content = asyncio.run(llm_client.chat(
                messages=[
                    {"role": "system", "content":
                        "You are a dropship product analyst. For each product in the JSON array, "
                        "write ONE short reason (max 15 words) why a reseller should care — hook on "
                        "margin, demand, or timing. Reply ONLY with a JSON object mapping the 'i' "
                        "index to the reason string. No markdown."},
                    {"role": "user", "content": json.dumps(brief)},
                ],
                max_tokens=500, temperature=0.5, json_mode=True,
            ))
            parsed = json.loads(content) if content else {}
            for k, v in parsed.items():
                if str(k).isdigit() and isinstance(v, str):
                    reasons[str(k)] = v[:160]
            ai = bool(reasons)
        except Exception:
            pass  # rules fallback below

    if not ai:
        for i, it in enumerate(items):
            reasons[str(i)] = (
                f"{it['est_margin_pct']}% margin" if it["est_margin_pct"] else "High-margin pick"
            ) + (f" · trending {int(it['trending_score'])}/100" if it["trending_score"] else "")

    for i, it in enumerate(items):
        it["why"] = reasons.get(str(i), "")
    return {"ai": ai, "niches": niches or None, "items": items}


# ── Demand votes (watch) + saved list ────────────────────────────────────

@router.post("/products/{product_id}/watch")
def toggle_watch(
    product_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Toggle a demand vote. Watch counts feed the AI signal that decides
    which products graduate into pools — free for all members."""
    _ensure_tables(db)
    existing = (
        db.query(DropshipWatch)
        .filter(DropshipWatch.user_id == user.id, DropshipWatch.product_id == product_id)
        .first()
    )
    if existing:
        db.delete(existing)
        watching = False
    else:
        db.add(DropshipWatch(user_id=user.id, product_id=product_id))
        watching = True
    db.commit()
    count = (
        db.query(func.count(DropshipWatch.id))
        .filter(DropshipWatch.product_id == product_id)
        .scalar() or 0
    )
    return {"watching": watching, "watchers": count}


@router.post("/products/{product_id}/save")
def save_product(
    product_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_tables(db)
    _require_paid(user)
    existing = (
        db.query(DropshipSaved)
        .filter(DropshipSaved.user_id == user.id, DropshipSaved.product_id == product_id)
        .first()
    )
    if not existing:
        db.add(DropshipSaved(user_id=user.id, product_id=product_id))
        db.commit()
    return {"saved": True}


@router.delete("/products/{product_id}/save")
def unsave_product(
    product_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_tables(db)
    db.query(DropshipSaved).filter(
        DropshipSaved.user_id == user.id, DropshipSaved.product_id == product_id
    ).delete()
    db.commit()
    return {"saved": False}


@router.get("/saved")
def list_saved(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_tables(db)
    _require_paid(user)
    watching, saved = _my_flags(db, user)
    rows = (
        db.query(DropshipSaved)
        .filter(DropshipSaved.user_id == user.id)
        .order_by(DropshipSaved.created_at.desc())
        .all()
    )
    return [
        {**_product_out(r.product, watching, saved), "list_status": r.status,
         "saved_at": r.created_at.isoformat() if r.created_at else None}
        for r in rows if r.product
    ]


# ── Pools ────────────────────────────────────────────────────────────────

@router.get("/pools")
def list_pools(
    status_filter: str = Query("open", alias="status", pattern="^(open|filled|expired|all)$"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_tables(db)
    _seed(db)
    _expire_stale_pools(db)
    q = db.query(DropshipPool)
    if status_filter != "all":
        q = q.filter(DropshipPool.status == status_filter)
    pools = q.order_by(
        (DropshipPool.status == "open").desc(), DropshipPool.closes_at.asc()
    ).limit(50).all()

    my_commits = {
        str(c.pool_id): c
        for c in db.query(DropshipPoolCommit).filter(DropshipPoolCommit.user_id == user.id).all()
    }
    return [_pool_out(p, my_commits.get(str(p.id))) for p in pools]


@router.get("/pools/{pool_id}")
def get_pool(
    pool_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_tables(db)
    _expire_stale_pools(db)
    pool = db.query(DropshipPool).filter(DropshipPool.id == pool_id).first()
    if not pool:
        raise HTTPException(status_code=404, detail="Pool not found")
    my_commit = (
        db.query(DropshipPoolCommit)
        .filter(DropshipPoolCommit.pool_id == pool_id, DropshipPoolCommit.user_id == user.id)
        .first()
    )
    out = _pool_out(pool, my_commit)
    out["hunters"] = (
        db.query(func.count(DropshipPoolCommit.id))
        .filter(DropshipPoolCommit.pool_id == pool_id,
                DropshipPoolCommit.status.in_(["reserved", "confirmed"]))
        .scalar() or 0
    )
    return out


class CommitBody(BaseModel):
    units: int = Field(ge=1, le=100)


@router.post("/pools/{pool_id}/commit", status_code=status.HTTP_201_CREATED)
def commit_units(
    pool_id: UUID,
    body: CommitBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Reserve units in an open pool. Paid tier only. Commitments are locked —
    they confirm if the pool fills and auto-cancel if it expires (nothing is
    charged until fill; wire Stripe auth-holds here when payments go live)."""
    _ensure_tables(db)
    _expire_stale_pools(db)
    _require_paid(user)

    pool = db.query(DropshipPool).filter(DropshipPool.id == pool_id).first()
    if not pool or pool.status != "open":
        raise HTTPException(status_code=409, detail="This pool is no longer open")
    if pool.closes_at < datetime.utcnow():
        raise HTTPException(status_code=409, detail="This pool has closed")

    existing = (
        db.query(DropshipPoolCommit)
        .filter(DropshipPoolCommit.pool_id == pool_id, DropshipPoolCommit.user_id == user.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="You've already committed to this pool")

    max_per = pool.max_units_per_hunter or 10
    if body.units > max_per:
        raise HTTPException(status_code=422, detail=f"Max {max_per} units per hunter in this pool")
    remaining = pool.moq_units - (pool.units_committed or 0)
    if body.units > remaining:
        raise HTTPException(
            status_code=409,
            detail=f"Only {remaining} unit{'s' if remaining == 1 else 's'} left in this pool",
        )

    amount_cents = int(round(float(pool.unit_cost) * body.units * 100))
    intent_id, held = _place_hold(db, user, amount_cents)

    commit = DropshipPoolCommit(
        pool_id=pool.id, user_id=user.id,
        units=body.units, unit_price=pool.unit_cost, status="reserved",
        stripe_payment_intent_id=intent_id,
        hold_amount_cents=amount_cents if held else None,
    )
    db.add(commit)
    pool.units_committed = (pool.units_committed or 0) + body.units

    # All-or-nothing: on fill, every reservation locks in and holds capture.
    if pool.units_committed >= pool.moq_units:
        pool.status = "filled"
        pool.filled_at = datetime.utcnow()
        db.query(DropshipPoolCommit).filter(
            DropshipPoolCommit.pool_id == pool.id,
            DropshipPoolCommit.status == "reserved",
        ).update({"status": "confirmed"}, synchronize_session=False)
        _settle_holds(db, pool.id, capture=True)

    db.commit()
    db.refresh(commit)
    return {"commit": {"units": commit.units, "unit_price": float(commit.unit_price),
                       "status": commit.status},
            "hold": "authorized" if held else "none",
            "pool_status": pool.status,
            "units_committed": pool.units_committed}


@router.get("/commits")
def my_commits(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_tables(db)
    rows = (
        db.query(DropshipPoolCommit)
        .filter(DropshipPoolCommit.user_id == user.id)
        .order_by(DropshipPoolCommit.created_at.desc())
        .all()
    )
    return [
        {**_pool_out(c.pool, c), "commit_id": str(c.id)}
        for c in rows if c.pool
    ]


# ── Channels + payment method ────────────────────────────────────────────

CHANNELS = [
    {"key": "amazon_fba", "label": "Amazon FBA", "live": True,
     "desc": "Units ship to YOUR seller account — you sell, you keep the proceeds"},
    {"key": "walmart_wfs", "label": "Walmart WFS", "live": False,
     "desc": "Walmart Fulfillment Services — vote to unlock"},
    {"key": "own_store", "label": "Your own store", "live": False,
     "desc": "Bulk ships to you or your 3PL — Shopify/eBay/etc."},
]


@router.get("/channels")
def list_channels(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retailer channels + live vote counts. amazon_fba is live; hunters vote
    on which integration ships next."""
    _ensure_tables(db)
    counts = dict(
        db.query(DropshipChannelVote.channel, func.count(DropshipChannelVote.id))
        .group_by(DropshipChannelVote.channel)
        .all()
    )
    mine = {
        v.channel for v in
        db.query(DropshipChannelVote).filter(DropshipChannelVote.user_id == user.id).all()
    }
    return [
        {**c, "votes": counts.get(c["key"], 0), "voted": c["key"] in mine}
        for c in CHANNELS
    ]


class ChannelVoteBody(BaseModel):
    channel: str = Field(..., pattern="^(amazon_fba|walmart_wfs|own_store)$")


@router.post("/channels/vote")
def vote_channel(
    body: ChannelVoteBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Toggle a vote for the next channel integration."""
    _ensure_tables(db)
    row = (
        db.query(DropshipChannelVote)
        .filter(DropshipChannelVote.user_id == user.id,
                DropshipChannelVote.channel == body.channel)
        .first()
    )
    if row:
        db.delete(row)
        voted = False
    else:
        db.add(DropshipChannelVote(user_id=user.id, channel=body.channel))
        voted = True
    db.commit()
    votes = db.query(func.count(DropshipChannelVote.id)).filter(
        DropshipChannelVote.channel == body.channel
    ).scalar() or 0
    return {"voted": voted, "channel": body.channel, "votes": votes}


@router.post("/payment-method/setup")
def setup_payment_method(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return a SetupIntent client_secret so the web can collect a card for
    pool auth-holds (Stripe PaymentElement). Hold captures only on fill."""
    stripe_lib = _stripe()
    if not stripe_lib:
        raise HTTPException(status_code=503, detail="Payments not configured yet")
    if not user.stripe_customer_id:
        from app.services.stripe_service import create_customer
        try:
            user.stripe_customer_id = create_customer(user.email)["id"]
            db.commit()
        except Exception as exc:
            logger.warning("customer create failed for %s: %s", user.id, exc)
            raise HTTPException(status_code=502, detail="Couldn't set up billing — try again")
    si = stripe_lib.SetupIntent.create(
        customer=user.stripe_customer_id,
        payment_method_types=["card"],
        usage="off_session",
    )
    return {"client_secret": si.client_secret}


@router.get("/niches")
def dropship_niches(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Niche list with live catalog counts — drives the filter chips."""
    _ensure_tables(db)
    _seed(db)
    counts = dict(
        db.query(DropshipProduct.niche, func.count(DropshipProduct.id))
        .filter(DropshipProduct.is_active == True)  # noqa: E712
        .group_by(DropshipProduct.niche)
        .all()
    )
    return [
        {"key": n.key, "display_name": n.display_name, "emoji": n.emoji,
         "count": counts.get(n.key, 0)}
        for n in get_all_niches()
    ]
