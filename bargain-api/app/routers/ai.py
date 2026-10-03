"""AI API Router — LLM-powered deal intelligence.

Endpoints (all prefixed /api/v1/ai):
  - GET  /status                  — is the LLM configured? (public)
  - POST /copilot                 — NL deal copilot with live deal context
  - GET  /deal-verdict/{deal_id}  — cached AI verdict on a specific deal
  - POST /arbitrage-advice        — end-to-end flip analysis (fees, margin, risks)
  - POST /describe                — SEO-friendly title+description for sellers

Every endpoint degrades gracefully: a missing AI_API_KEY returns 503, and a
failed LLM call falls back to a deterministic rules-based answer marked
``"source": "rules"`` so the client can still render something useful.
"""

import logging
import re
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, status
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.db.models import User, ArbitrageDeal, PriceSnapshot
from app.routers.auth import get_current_user
from app.services import llm_client
from app.services.price_predictor import price_predictor
from app.services.deal_scorer import calculate_deal_score
from app.services.profit_calculator import (
    calculate_profit,
    Platform,
    ProductCategory,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])

# ─── In-memory verdict cache ────────────────────────────────────────────────
# Verdicts are deterministic enough over short windows — cache for 6h so
# repeated page views don't burn LLM tokens. Keyed by deal id; cleared on
# restart (fine — worst case is one extra LLM call per deal per deploy).
_VERDICT_TTL = timedelta(hours=6)
_VERDICT_CACHE_MAX = 500
_verdict_cache: dict[str, tuple[datetime, dict]] = {}


def _require_ai():
    """503 when the LLM isn't configured — callers degrade gracefully."""
    if not llm_client.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI features are not configured on this deployment (AI_API_KEY not set).",
        )


def _deal_ref(deal: ArbitrageDeal) -> dict:
    """Compact deal reference for copilot answers."""
    discount = None
    if deal.historical_avg and deal.buy_price and deal.historical_avg > deal.buy_price:
        discount = round(float(1 - deal.buy_price / deal.historical_avg) * 100)
    return {
        "id": str(deal.id),
        "title": deal.title,
        "retailer": deal.retailer or deal.buy_platform,
        "buy_price": float(deal.buy_price) if deal.buy_price else None,
        "historical_avg": float(deal.historical_avg) if deal.historical_avg else None,
        "discount_pct": discount,
        "deal_tier": deal.deal_tier,
        "net_profit": float(deal.net_profit) if deal.net_profit else None,
        "image_url": deal.image_url,
        "url": f"/deals/{deal.id}",
    }


def _deal_context(deal: ArbitrageDeal) -> dict:
    """Structured deal facts fed to the LLM (numbers only — no guesses)."""
    return {
        **_deal_ref(deal),
        "sell_price": float(deal.sell_price) if deal.sell_price else None,
        "sell_platform": deal.sell_platform,
        "roi": float(deal.roi) if deal.roi else None,
        "total_costs": float(deal.total_costs) if deal.total_costs else None,
        "platform_fee": float(deal.platform_fee) if deal.platform_fee else None,
        "bsr": deal.bsr,
        "category": deal.category,
        "niche": deal.niche,
        "score": float(deal.score) if deal.score else None,
        "status": deal.status,
        "dead_report_count": deal.dead_report_count or 0,
        "detected_at": deal.detected_at.isoformat() if deal.detected_at else None,
    }


# ─── Copilot query parsing ──────────────────────────────────────────────────

_STOPWORDS = {
    "the", "and", "for", "with", "find", "deal", "deals", "any", "some", "show",
    "get", "got", "me", "you", "that", "this", "what", "are", "there", "have",
    "under", "below", "over", "than", "less", "more", "best", "good", "cheap",
    "looking", "want", "need", "from", "buy", "price", "prices",
}


def _parse_price_cap(message: str) -> Optional[float]:
    """Pull a max price out of phrases like "under $50" / "below 200"."""
    m = re.search(
        r"(?:under|below|less than|cheaper than|up to|max(?:imum)?(?: price)?|at most)\s*\$?\s*([\d,]+(?:\.\d{1,2})?)",
        message.lower(),
    )
    if not m:
        m = re.search(r"\$\s*([\d,]+(?:\.\d{1,2})?)\s*(?:or less|max|budget)", message.lower())
    if not m:
        return None
    try:
        return float(m.group(1).replace(",", ""))
    except ValueError:
        return None


def _extract_keywords(message: str, limit: int = 6) -> List[str]:
    words = re.findall(r"[a-z0-9']+", message.lower())
    return [w for w in words if len(w) > 2 and w not in _STOPWORDS][:limit]


def _search_deals_for_context(
    db: Session, message: str, limit: int = 12
) -> tuple[list[ArbitrageDeal], dict]:
    """Find active deals matching the user's NL request for LLM context."""
    max_price = _parse_price_cap(message)
    keywords = _extract_keywords(message)

    q = db.query(ArbitrageDeal).filter(
        ArbitrageDeal.status == "active",
        ArbitrageDeal.buy_price > 0,
    )
    if max_price is not None:
        q = q.filter(ArbitrageDeal.buy_price <= Decimal(str(max_price)))
    if keywords:
        q = q.filter(or_(*[ArbitrageDeal.title.ilike(f"%{kw}%") for kw in keywords]))

    deals = q.order_by(ArbitrageDeal.score.desc(), ArbitrageDeal.net_profit.desc()).limit(limit).all()

    # If keyword matching found nothing, fall back to top active deals so the
    # copilot can still suggest *something* real instead of hallucinating.
    if not deals:
        deals = (
            db.query(ArbitrageDeal)
            .filter(ArbitrageDeal.status == "active", ArbitrageDeal.buy_price > 0)
            .order_by(ArbitrageDeal.score.desc(), ArbitrageDeal.net_profit.desc())
            .limit(5)
            .all()
        )
        keywords = []

    return deals, {"max_price": max_price, "keywords": keywords}


# ─── Request/response models ────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str = Field(max_length=2000)


class CopilotRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    history: List[ChatMessage] = Field(default_factory=list, max_length=8)


class ArbitrageAdviceRequest(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    buy_price: float = Field(gt=0)
    sell_price: Optional[float] = Field(default=None, gt=0)
    buy_platform: str = "amazon"
    sell_platform: str = "ebay"
    category: Optional[str] = None
    # When sell_price is omitted and this is true, estimate the resale value
    # from eBay sold comps (network call — bounded by its own timeouts).
    estimate_resale: bool = True


class DescribeRequest(BaseModel):
    product: str = Field(min_length=1, max_length=500)  # what it is
    retailer: Optional[str] = None
    condition: Optional[str] = None  # new, used, open-box
    price: Optional[float] = Field(default=None, gt=0)
    original_price: Optional[float] = Field(default=None, gt=0)
    category: Optional[str] = None
    features: List[str] = Field(default_factory=list, max_length=10)
    tone: str = "deals"  # deals = urgency/value copy


# ─── Platform / category mapping for the profit calculator ──────────────────

def _to_platform(name: str) -> Platform:
    try:
        return Platform((name or "ebay").lower().replace(" ", "_"))
    except ValueError:
        return Platform.EBAY


def _to_category(name: Optional[str]) -> ProductCategory:
    if not name:
        return ProductCategory.GENERIC
    lowered = name.lower()
    for cat in ProductCategory:
        if cat.value in lowered or lowered in cat.value:
            return cat
    return ProductCategory.GENERIC


def _profit_dict(b) -> dict:
    return {
        "buy_price": float(b.buy_price),
        "sell_price": float(b.sell_price),
        "platform_fee": float(b.platform_fee),
        "fulfillment_fee": float(b.fulfillment_fee),
        "shipping_in": float(b.shipping_in),
        "shipping_out": float(b.shipping_out),
        "tax": float(b.tax),
        "return_risk_cost": float(b.return_risk_cost),
        "total_costs": float(b.total_costs),
        "net_profit": float(b.net_profit),
        "roi": float(b.roi),
        "is_profitable": b.is_profitable,
    }


# ─── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/status")
async def ai_status():
    """Public status check so the frontend can hide AI UI when unconfigured."""
    return {
        "configured": llm_client.is_configured(),
        "model": llm_client.model_name() if llm_client.is_configured() else None,
    }


@router.post("/copilot")
async def deal_copilot(
    body: CopilotRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """NL deal copilot: "find me deals on X under $Y".

    Searches live deals for context, then asks the LLM to answer
    conversationally against only the real results — never invented deals.
    """
    _require_ai()

    deals, parsed = _search_deals_for_context(db, body.message)
    deal_refs = [_deal_ref(d) for d in deals]

    system = (
        "You are the BargainHuntrs deal copilot — a concise, friendly assistant "
        "for a deal-hunting marketplace. You ONLY recommend deals from the "
        "CONTEXT DEALS list provided (real live deals). Never invent products, "
        "prices, or deals. If nothing matches, say so plainly and suggest the "
        "closest alternatives from the list. Reference deals by title and price. "
        "Keep answers under 120 words. Reply as JSON: "
        '{"answer": "<text>", "deal_ids": ["<id>", ...]} where deal_ids lists '
        "the ids of the context deals you recommended (may be empty)."
    )
    messages = [{"role": "system", "content": system}]
    for h in body.history:
        if h.role in ("user", "assistant"):
            messages.append({"role": h.role, "content": h.content})
    messages.append({
        "role": "user",
        "content": (
            f"CONTEXT DEALS (JSON): {deal_refs}\n\n"
            f"USER QUESTION: {body.message}"
        ),
    })

    result = await llm_client.chat_json(messages, max_tokens=600)
    if result and isinstance(result.get("answer"), str):
        recommended = set(result.get("deal_ids") or [])
        recommended_deals = [r for r in deal_refs if r["id"] in recommended]
        return {
            "source": "ai",
            "answer": result["answer"],
            "deals": recommended_deals or deal_refs[:5],
            "query": parsed,
        }

    # LLM failed/unparseable — degrade to a rules-based summary of real deals.
    if deals:
        top = deal_refs[:3]
        parts = "; ".join(
            f"{d['title'][:80]} — ${d['buy_price']:.2f}"
            + (f" ({d['discount_pct']}% off)" if d["discount_pct"] else "")
            for d in top
        )
        answer = f"Here are the closest live deals I found: {parts}."
    else:
        answer = "I couldn't find any live deals matching that right now — try broadening the search or check back soon."
    return {
        "source": "rules",
        "answer": answer,
        "deals": deal_refs[:5],
        "query": parsed,
    }


@router.get("/deal-verdict/{deal_id}")
async def deal_verdict(
    deal_id: UUID = Path(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """AI verdict on a deal — worth it? fair price? resale margin?

    Combines the deal's structured fields with the statistical price
    predictor + deal scorer, then lets the LLM synthesize the verdict.
    Results are cached in-memory for 6 hours.
    """
    _require_ai()

    cache_key = str(deal_id)
    cached = _verdict_cache.get(cache_key)
    if cached and cached[0] > datetime.utcnow():
        return cached[1]

    deal = db.query(ArbitrageDeal).filter(ArbitrageDeal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    # Statistical context: price trend + quality score from recorded snapshots.
    snapshots = (
        db.query(PriceSnapshot)
        .filter(PriceSnapshot.item_id == (deal.asin or str(deal.id)))
        .order_by(PriceSnapshot.timestamp.asc())
        .limit(200)
        .all()
    )
    history = [
        {"timestamp": s.timestamp.isoformat(), "price": float(s.price)}
        for s in snapshots if s.price is not None
    ]
    trend = price_predictor.predict_price_trend(history)
    quality = price_predictor.score_deal_quality(
        history,
        float(deal.buy_price or 0),
        float(deal.historical_avg or 0),
    )
    context = _deal_context(deal)
    context["computed_score"] = calculate_deal_score(deal)

    system = (
        "You are a skeptical deal analyst for a resale/arbitrage marketplace. "
        "Given structured deal data and a statistical price prediction, decide "
        "if the deal is worth buying (to keep or to flip). Be honest — weak "
        "margins, stale data, and crowd dead-deal reports should lower your "
        "verdict. Reply as JSON: {\"verdict\": \"buy\"|\"wait\"|\"monitor\"|\"skip\", "
        "\"confidence\": 0-100, \"summary\": \"<2 sentences>\", "
        "\"fair_price\": \"<is the price fair vs historical/typical>\", "
        "\"resale_margin\": \"<flip margin assessment>\", "
        "\"risks\": [\"<risk>\", ...]}"
    )
    result = await llm_client.chat_json(
        [
            {"role": "system", "content": system},
            {"role": "user", "content": (
                f"DEAL: {context}\n\n"
                f"PRICE PREDICTION: {trend}\n\n"
                f"QUALITY SCORE: {quality}"
            )},
        ],
        max_tokens=600,
    )

    if result and isinstance(result.get("summary"), str):
        payload = {
            "source": "ai",
            "deal_id": cache_key,
            "verdict": result.get("verdict") if result.get("verdict") in ("buy", "wait", "monitor", "skip") else "monitor",
            "confidence": max(0, min(100, int(result.get("confidence") or 50))),
            "summary": result["summary"],
            "fair_price": result.get("fair_price") or "",
            "resale_margin": result.get("resale_margin") or "",
            "risks": [str(r) for r in (result.get("risks") or [])][:5],
            "prediction": trend,
            "quality": quality,
        }
    else:
        # Rules fallback: derive the verdict from the predictor + profit data.
        verdict = trend.get("recommendation", "monitor")
        if deal.dead_report_count and deal.dead_report_count >= 2:
            verdict = "skip"
        elif deal.net_profit is not None and deal.net_profit <= 0 and verdict == "buy":
            verdict = "monitor"
        discount_txt = ""
        if deal.historical_avg and deal.buy_price and deal.historical_avg > deal.buy_price:
            pct = round(float(1 - deal.buy_price / deal.historical_avg) * 100)
            discount_txt = f"{pct}% below its historical average (${float(deal.historical_avg):.2f})"
        else:
            discount_txt = "no recorded discount vs. historical average"
        payload = {
            "source": "rules",
            "deal_id": cache_key,
            "verdict": {"buy_now": "buy"}.get(verdict, verdict),
            "confidence": trend.get("confidence", 0),
            "summary": (
                f"Priced at ${float(deal.buy_price or 0):.2f} — {discount_txt}. "
                f"Price trend is {trend.get('trend', 'stable')}."
            ),
            "fair_price": discount_txt.capitalize() + ".",
            "resale_margin": (
                f"Estimated net profit ${float(deal.net_profit):.2f} "
                f"({float(deal.roi) * 100:.0f}% ROI) after fees."
                if deal.net_profit and deal.roi
                else "Resale margin data unavailable."
            ),
            "risks": (
                ["Multiple users reported this deal may be dead"]
                if (deal.dead_report_count or 0) >= 2
                else []
            ),
            "prediction": trend,
            "quality": quality,
        }

    # Cache (evict oldest when full).
    if len(_verdict_cache) >= _VERDICT_CACHE_MAX:
        oldest = min(_verdict_cache, key=lambda k: _verdict_cache[k][0])
        _verdict_cache.pop(oldest, None)
    _verdict_cache[cache_key] = (datetime.utcnow() + _VERDICT_TTL, payload)
    return payload


@router.post("/arbitrage-advice")
async def arbitrage_advice(
    body: ArbitrageAdviceRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """End-to-end analysis of a flip: buy price, fees, resale estimate, risks."""
    _require_ai()

    sell_price = body.sell_price
    resale_estimate = None
    resale_source = None
    if sell_price is None and body.estimate_resale:
        try:
            from app.services.ebay_scraper import get_ebay_market_price

            est = await get_ebay_market_price(body.title, limit=10)
            if est is not None:
                sell_price = float(est)
                resale_estimate = float(est)
                resale_source = "ebay_sold_comps"
        except Exception as e:
            logger.warning("Resale estimate failed: %s", type(e).__name__)

    profit = None
    if sell_price:
        profit = calculate_profit(
            buy_price=Decimal(str(body.buy_price)),
            sell_price=Decimal(str(sell_price)),
            sell_platform=_to_platform(body.sell_platform),
            category=_to_category(body.category),
        )

    system = (
        "You are a resale arbitrage advisor. Given a buy opportunity and a "
        "computed profit breakdown (platform fees, shipping, tax, return risk), "
        "give a practical go/no-go assessment. Be conservative — mention fee "
        "surprises, competition, saturation, and return risk where relevant. "
        "Reply as JSON: {\"recommendation\": \"worth_it\"|\"marginal\"|\"skip\", "
        "\"summary\": \"<2 sentences>\", \"margin_analysis\": \"<margin/fee notes>\", "
        "\"risks\": [\"<risk>\", ...], \"tips\": [\"<tip>\", ...]}"
    )
    user_payload = {
        "item": body.title,
        "buy_price": body.buy_price,
        "buy_platform": body.buy_platform,
        "sell_platform": body.sell_platform,
        "category": body.category,
        "sell_price_used": sell_price,
        "resale_estimate_source": resale_source,
        "profit_breakdown": _profit_dict(profit) if profit else None,
    }
    result = await llm_client.chat_json(
        [
            {"role": "system", "content": system},
            {"role": "user", "content": f"OPPORTUNITY: {user_payload}"},
        ],
        max_tokens=700,
    )

    base = {
        "sell_price_used": sell_price,
        "resale_estimate": resale_estimate,
        "resale_estimate_source": resale_source,
        "profit": _profit_dict(profit) if profit else None,
    }

    if result and isinstance(result.get("summary"), str):
        return {
            "source": "ai",
            "recommendation": result.get("recommendation")
            if result.get("recommendation") in ("worth_it", "marginal", "skip")
            else "marginal",
            "summary": result["summary"],
            "margin_analysis": result.get("margin_analysis") or "",
            "risks": [str(r) for r in (result.get("risks") or [])][:5],
            "tips": [str(t) for t in (result.get("tips") or [])][:5],
            **base,
        }

    # Rules fallback — the computed breakdown is still useful on its own.
    if profit is None:
        return {
            "source": "rules",
            "recommendation": "marginal",
            "summary": "Couldn't estimate a resale price — supply sell_price for a full analysis.",
            "margin_analysis": "",
            "risks": ["No resale pricing data available"],
            "tips": ["Check sold comps on your target platform before buying"],
            **base,
        }
    rec = "worth_it" if profit.net_profit >= 10 and profit.roi >= Decimal("0.25") else (
        "skip" if profit.net_profit <= 0 else "marginal"
    )
    return {
        "source": "rules",
        "recommendation": rec,
        "summary": (
            f"Buy at ${float(profit.buy_price):.2f}, sell around ${float(profit.sell_price):.2f} — "
            f"est. net profit ${float(profit.net_profit):.2f} "
            f"({float(profit.roi) * 100:.0f}% ROI) after fees and costs."
        ),
        "margin_analysis": (
            f"Total costs ${float(profit.total_costs):.2f} including "
            f"${float(profit.platform_fee):.2f} platform fees, "
            f"${float(profit.tax):.2f} tax, and "
            f"${float(profit.return_risk_cost):.2f} return-risk allowance."
        ),
        "risks": ["Return-risk allowance already deducted" if float(profit.return_risk_cost) else "No return risk factored"],
        "tips": [],
        **base,
    }


@router.post("/describe")
async def describe_listing(
    body: DescribeRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate an SEO-friendly title + description from structured fields.

    For sellers cross-posting finds — produces marketplace-ready copy.
    """
    _require_ai()

    facts = {
        "product": body.product,
        "retailer": body.retailer,
        "condition": body.condition or "new",
        "price": body.price,
        "original_price": body.original_price,
        "category": body.category,
        "features": body.features,
    }
    system = (
        "You write concise, SEO-friendly marketplace listing copy for deal "
        "resellers. Honest only — never invent specs or claims not in the "
        "facts provided. Title: max 80 chars, keyword-rich, no clickbait caps. "
        "Description: 2-4 short paragraphs plus a bullet section, plain text. "
        "Reply as JSON: {\"title\": \"...\", \"description\": \"...\", "
        "\"keywords\": [\"...\", ...]}"
    )
    result = await llm_client.chat_json(
        [
            {"role": "system", "content": system},
            {"role": "user", "content": f"LISTING FACTS: {facts}"},
        ],
        max_tokens=800,
    )

    if result and result.get("title") and result.get("description"):
        return {
            "source": "ai",
            "title": str(result["title"])[:200],
            "description": str(result["description"]),
            "keywords": [str(k) for k in (result.get("keywords") or [])][:10],
        }

    # Template fallback — plain but accurate.
    price_txt = f"${body.price:.2f}" if body.price else ""
    was_txt = (
        f" (was ${body.original_price:.2f})"
        if body.original_price and body.price and body.original_price > body.price
        else ""
    )
    cond = body.condition or "new"
    retailer = f" from {body.retailer.replace('_', ' ').title()}" if body.retailer else ""
    feats = "\n".join(f"- {f}" for f in body.features[:10])
    description = (
        f"{body.product} — {cond} condition{retailer}. Priced at {price_txt}{was_txt}.\n\n"
        + (f"Highlights:\n{feats}\n\n" if feats else "")
        + "Fast shipping. Sold as described."
    )
    return {
        "source": "rules",
        "title": f"{body.product} ({cond.title()})"[:80],
        "description": description,
        "keywords": [k for k in [body.category, body.retailer, cond] if k],
    }
