"""AI read on dropship pools — one deterministic score + LLM narrative.

GET /api/v1/dropship/pools/{pool_id}/ai-read

Scoring is rules-based and honest: margin vs. price floor, fill velocity vs.
deadline, channel fit, freight risk. The LLM only writes the narrative on
top — when unconfigured it returns a template, never blocks the read.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import User, DropshipPool
from app.routers.auth import get_current_user
from app.services import llm_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/dropship", tags=["dropship-ai"])

PAID_DETAIL = "Pools are a Hunter-tier feature. Upgrade to see AI reads."


def _paid(user: User) -> bool:
    return (user.subscription_tier or "free").lower() != "free"


def _score(pool: DropshipPool) -> dict:
    """Deterministic pool score — the AI narrative never invents numbers."""
    unit = float(pool.unit_cost or 0)
    target = float(pool.target_price or 0)
    min_price = float(pool.min_price) if pool.min_price else None
    committed = int(pool.units_committed or 0)
    moq = int(pool.moq_units or 1)
    fill_pct = committed / max(moq, 1)

    reasons: list[str] = []
    flags: list[str] = []
    score = 50  # start neutral

    # Margin health
    if target > 0:
        margin = (target - unit) / target
        if margin >= 0.45:
            score += 20
            reasons.append(f"strong {margin:.0%} target margin")
        elif margin >= 0.3:
            score += 10
            reasons.append(f"healthy {margin:.0%} margin")
        elif margin >= 0.15:
            reasons.append(f"thin {margin:.0%} margin")
            flags.append("margin is thin — fees or a price drop eat it fast")
            score -= 5
        else:
            flags.append(f"margin only {margin:.0%} — barely covers marketplace fees")
            score -= 20
        if min_price and min_price > unit:
            score += 5
            reasons.append("price floor protects downside")
    else:
        flags.append("no target price set")

    # Fill velocity vs deadline
    now = datetime.now(timezone.utc)
    closes = pool.closes_at
    if closes and closes.tzinfo is None:
        closes = closes.replace(tzinfo=timezone.utc)
    opens = pool.opens_at
    if opens and opens.tzinfo is None:
        opens = opens.replace(tzinfo=timezone.utc)
    days_left = max(0.0, (closes - now).total_seconds() / 86400) if closes else 7
    total_days = max(1.0, ((closes - opens).total_seconds() / 86400) if (closes and opens) else 14)
    elapsed_pct = 1 - (days_left / total_days)
    if fill_pct >= 1:
        score += 25
        reasons.append("pool filled — MOQ met")
    elif elapsed_pct > 0:
        pace = fill_pct / elapsed_pct  # >1 = ahead of linear pace
        if pace >= 1.2:
            score += 15
            reasons.append(f"fill pace is ahead ({fill_pct:.0%} committed)")
        elif pace >= 0.7:
            score += 5
            reasons.append(f"on track ({fill_pct:.0%} committed)")
        else:
            flags.append(f"behind pace — {fill_pct:.0%} committed with {days_left:.0f}d left")
            score -= 15
    if days_left < 2 and fill_pct < 0.9:
        flags.append("deadline close and pool not full — commits auto-cancel")

    # Channel fit
    channel = pool.channel or "amazon_fba"
    if channel == "amazon_fba":
        reasons.append("FBA channel — fastest fulfillment, no warehousing")
    elif channel == "walmart_wfs":
        reasons.append("WFS channel — good reach, fewer sellers competing")
    else:
        flags.append("own-store channel — you drive the traffic")
        score -= 5

    # Freight risk
    freight = pool.freight_mode or "us_stock"
    if freight == "us_stock":
        score += 5
        reasons.append("US warehouse stock — no import delay")
    elif freight == "import":
        flags.append("import freight — expect lead-time and customs risk")
        score -= 10

    score = max(0, min(100, score))
    verdict = "strong" if score >= 75 else "fair" if score >= 45 else "risky"
    return {
        "score": score,
        "verdict": verdict,
        "margin_pct": round((target - unit) / target * 100, 1) if target > 0 else None,
        "fill_pct": round(fill_pct * 100),
        "days_left": round(days_left, 1),
        "channel": channel,
        "freight_mode": freight,
        "reasons": reasons[:5],
        "flags": flags[:4],
    }


@router.get("/pools/{pool_id}/ai-read")
async def pool_ai_read(
    pool_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not _paid(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, PAID_DETAIL)

    pool = (
        db.query(DropshipPool)
        .filter(DropshipPool.id == pool_id)
        .first()
    )
    if not pool:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pool not found")

    read = _score(pool)
    product = pool.product
    product_name = getattr(product, "title", None) or "this product"

    # Narrative — LLM writes color commentary on the deterministic facts.
    narrative = None
    ai = False
    try:
        summary = await llm_client.chat(
            [
                {
                    "role": "system",
                    "content": (
                        "You score group-buy inventory pools for resellers. "
                        "Write 2-3 plain sentences: the honest read, the main "
                        "risk, and one concrete next step. Never promise profit; "
                        "if risky, say so plainly. No emojis, no hype."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Pool: {product_name}. Unit cost ${float(pool.unit_cost or 0):.2f}, "
                        f"target ${float(pool.target_price or 0):.2f}, MOQ {pool.moq_units}, "
                        f"committed {pool.units_committed or 0}, channel {read['channel']}, "
                        f"freight {read['freight_mode']}, verdict {read['verdict']} "
                        f"({read['score']}/100). Reasons: {', '.join(read['reasons'])}. "
                        f"Flags: {', '.join(read['flags']) or 'none'}."
                    ),
                },
            ],
            max_tokens=160,
            temperature=0.4,
        )
        if summary:
            narrative = summary.strip()
            ai = True
    except Exception as err:  # noqa: BLE001 — narrative is best-effort
        logger.warning("pool ai-read narrative failed: %s", type(err).__name__)

    if not narrative:
        narrative = (
            f"Scored {read['score']}/100 ({read['verdict']}). "
            + (f"{read['reasons'][0].capitalize()}. " if read["reasons"] else "")
            + (f"Watch: {read['flags'][0]}." if read["flags"] else "No major flags.")
        )

    return {
        "pool_id": str(pool.id),
        "product": product_name,
        "verdict": read["verdict"],
        "score": read["score"],
        "narrative": narrative,
        "ai": ai,
        "metrics": {
            "margin_pct": read["margin_pct"],
            "fill_pct": read["fill_pct"],
            "days_left": read["days_left"],
            "channel": read["channel"],
            "freight_mode": read["freight_mode"],
        },
        "reasons": read["reasons"],
        "flags": read["flags"],
    }
