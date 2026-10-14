"""Supplier deal-sheet importer — Bulk Buy America wholesale email flow.

Admins paste the supplier's deal-sheet email text; this module parses each
deal row (product name/link, wholesale price, MOQ, max qty, Amazon/Walmart
comp links) into a structured record and creates DRAFT catalog rows:

  - ``DropshipProduct`` — ``supplier="Bulk Buy America"``,
    ``source="supplier_import"``, ``status="draft"``, ``is_active=False``
    (hidden from the hunter-facing catalog feeds).
  - ``DropshipPool`` — ``status="draft"`` (never published automatically;
    a pool only goes ``open`` when an admin marks it fulfillable via the
    review endpoint in ``routers/dropship.py``).

Each parsed deal gets a gross-margin flag computed against a reference
(comp) price: ``ok`` when gross margin >= ``GROSS_MARGIN_FLOOR`` (40%),
``below_floor`` under it, ``unknown`` when no reference price exists.

Supported paste formats (tolerant by design — supplier emails vary):

  1. Delimited rows, one deal per line:
       Product Name | $8.50 | MOQ 100 | Max 20 | https://supplier/... | https://amazon.com/...
     (| or tab separated; a leading header row is auto-skipped)

  2. Labeled blocks separated by blank lines:
       Name: Torque Wrench Set
       Link: https://bulkbuyamerica.com/...
       Wholesale: $8.50
       MOQ: 100
       Max qty: 20
       Comp: https://www.amazon.com/dp/... $34.99
       Comp: https://www.walmart.com/ip/... $36.00

  3. Freeform numbered/bulleted blocks mixing labels and bare values.
"""

import hashlib
import logging
import re
from dataclasses import dataclass, field
from decimal import Decimal
from typing import List, Optional

from sqlalchemy.orm import Session

from app.db.models import DropshipPool, DropshipProduct

logger = logging.getLogger(__name__)

SUPPLIER_NAME = "Bulk Buy America"
SOURCE = "supplier_import"

#: Gross-margin floor — deals below this are flagged ``below_floor`` for the
#: reviewing admin instead of silently landing in the catalog.
GROSS_MARGIN_FLOOR = 0.40

#: Pool window assigned at import; the admin can re-set it at review time.
DEFAULT_POOL_DAYS = 14

COMP_DOMAINS = ("amazon.", "walmart.", "ebay.", "target.", "bestbuy.", "homedepot.", "lowes.")

_URL_RE = re.compile(r"https?://[^\s,)<>\]'\"]+", re.I)
_MONEY_RE = re.compile(r"\$\s*(\d[\d,]*(?:\.\d{1,2})?)|(\d[\d,]*\.\d{2})\b")
_INT_RE = re.compile(r"\d[\d,]*")

_COST_LABEL_RE = re.compile(
    r"(?:wholesale|unit\s*(?:price|cost)|cost|price|each|buy\s*(?:price|cost))"
    r"[^0-9$]{0,15}\$?\s*(\d[\d,]*(?:\.\d{1,2})?)",
    re.I,
)
_REF_LABEL_RE = re.compile(
    r"(?:comp(?:\s*price)?|reference|ref\s*price|sells?\s*for|retail|market|"
    r"amazon\s*price|walmart\s*price|msrp|map)"
    r"[^0-9$]{0,15}\$?\s*(\d[\d,]*(?:\.\d{1,2})?)",
    re.I,
)
_MOQ_RE = re.compile(r"\bmoq\b[^0-9]{0,15}(\d[\d,]*)", re.I)
_MIN_ORDER_RE = re.compile(r"\bmin(?:imum)?\s*order\b[^0-9]{0,15}(\d[\d,]*)", re.I)
_MAX_RE = re.compile(r"\bmax(?:imum)?\b[^0-9]{0,20}(\d[\d,]*)", re.I)
_NAME_LABEL_RE = re.compile(
    r"^\s*(?:product(?:\s*name)?|item|name|title)\s*[:=\-–]\s*(.+?)\s*$",
    re.I | re.M,
)
_QTY_ONLY_RE = re.compile(r"^\s*(?:qty|quantity|units)\s*[:=]?\s*(\d[\d,]*)\s*$", re.I)


@dataclass
class ParsedSupplierDeal:
    """One deal row extracted from the pasted sheet."""

    name: Optional[str] = None
    supplier_url: Optional[str] = None
    wholesale_price: Optional[float] = None
    moq: Optional[int] = None
    max_qty: Optional[int] = None
    comp_links: List[str] = field(default_factory=list)
    reference_price: Optional[float] = None
    raw: str = ""
    warnings: List[str] = field(default_factory=list)

    @property
    def gross_margin_pct(self) -> Optional[int]:
        if not self.reference_price or self.reference_price <= 0 or self.wholesale_price is None:
            return None
        return round((self.reference_price - self.wholesale_price) / self.reference_price * 100)

    @property
    def margin_flag(self) -> str:
        m = self.gross_margin_pct
        if m is None:
            return "unknown"
        return "ok" if m >= GROSS_MARGIN_FLOOR * 100 else "below_floor"

    @property
    def sku(self) -> str:
        """Deterministic SKU — re-importing the same deal sheet updates the
        existing draft instead of duplicating it."""
        slug = re.sub(r"[^a-z0-9]+", "-", (self.name or "item").lower()).strip("-")[:40] or "item"
        digest = hashlib.sha1(f"{self.name}|{self.supplier_url}".encode()).hexdigest()[:6].upper()
        return f"BBA-{slug}-{digest}"[:120]


def _money(text: str) -> Optional[float]:
    m = _MONEY_RE.search(text)
    if not m:
        return None
    raw = m.group(1) or m.group(2)
    return float(raw.replace(",", ""))


def _int(text: str) -> Optional[int]:
    m = _INT_RE.search(text)
    return int(m.group(0).replace(",", "")) if m else None


def _is_comp_url(url: str) -> bool:
    low = url.lower()
    return any(d in low for d in COMP_DOMAINS)


def _split_blocks(text: str) -> List[str]:
    """Split the paste into per-deal chunks. Pipe/tab-delimited sheets parse
    line-by-line; everything else splits on blank lines, then again on
    numbered/bulleted lines that carry their own price or link."""
    lines = [ln.rstrip() for ln in text.replace("\r\n", "\n").split("\n")]
    # Drop pasted email headers — they're never deal rows.
    lines = [
        ln for ln in lines
        if not re.match(r"(?i)^\s*(subject|from|to|date|sent|cc|bcc|reply-to)\s*:", ln)
    ]

    delimited = [ln for ln in lines if ln.count("|") >= 2 or ln.count("\t") >= 2]
    if len(delimited) >= max(1, sum(1 for ln in lines if ln.strip()) // 2):
        blocks = []
        for ln in delimited:
            low = ln.lower()
            # Skip a header row like "name | price | moq | max | link"
            if ("name" in low or "product" in low) and ("price" in low or "moq" in low):
                continue
            blocks.append(ln)
        return blocks

    chunks: List[List[str]] = []
    cur: List[str] = []
    dealish = re.compile(r"(\$\s*\d|\bmoq\b|https?://|\bmax\b|\bwholesale\b)", re.I)
    starter = re.compile(r"^\s*(?:\d+[\.\)]|[-•*])\s+")

    for ln in lines:
        if not ln.strip():
            if cur:
                chunks.append(cur)
                cur = []
            continue
        # A new numbered/bulleted line that itself looks like a deal starts a
        # new chunk (unless the current chunk is still empty).
        if cur and starter.match(ln) and dealish.search(ln):
            chunks.append(cur)
            cur = []
        cur.append(ln)
    if cur:
        chunks.append(cur)

    # Fallback: nothing split (single-block paste of one-per-line deals) —
    # treat each line as its own deal only when most lines are self-contained:
    # a URL, or both a price-ish and a qty-ish signal on the same line. Bare
    # labeled fragments ("Wholesale: $18", "MOQ: 50") are continuations of a
    # single deal, not separate ones.
    if len(chunks) <= 1:
        nonempty = [ln for ln in lines if ln.strip()]
        standalone = [
            ln for ln in nonempty
            if _URL_RE.search(ln)
            or (re.search(r"\$\s*\d|\bwholesale\b", ln, re.I)
                and re.search(r"(?i)\b(moq|max|qty)\b", ln))
        ]
        if len(nonempty) > 2 and len(standalone) >= max(2, len(nonempty) // 2):
            return nonempty

    return ["\n".join(c) for c in chunks if any(dealish.search(ln) for ln in c)]


def _parse_block(block: str) -> ParsedSupplierDeal:
    deal = ParsedSupplierDeal(raw=block.strip()[:2000])
    text = block

    # URLs first — comp links go to comps, the first remaining link is the
    # supplier/product link.
    urls = _URL_RE.findall(text)
    for u in urls:
        u = u.rstrip(".,;)")
        if _is_comp_url(u):
            deal.comp_links.append(u)
        elif deal.supplier_url is None:
            deal.supplier_url = u

    # Labeled fields
    m = _NAME_LABEL_RE.search(text)
    if m:
        deal.name = m.group(1).strip()
    m = _COST_LABEL_RE.search(text)
    if m:
        deal.wholesale_price = float(m.group(1).replace(",", ""))
    m = _REF_LABEL_RE.search(text)
    if m:
        deal.reference_price = float(m.group(1).replace(",", ""))
    if deal.reference_price is None:
        # "Comp: https://amazon.com/dp/X $34.99" — the label regex can't reach
        # across the URL, so scan comp-ish lines for a money amount.
        for ln in text.split("\n"):
            ln_urls = _URL_RE.findall(ln)
            if re.search(r"(?i)\b(comps?|reference|ref|retail|msrp|map|sells?\s*for)\b", ln) \
                    or any(_is_comp_url(u) for u in ln_urls):
                m2 = _MONEY_RE.search(_URL_RE.sub(" ", ln))
                if m2:
                    deal.reference_price = float(
                        (m2.group(1) or m2.group(2)).replace(",", ""))
                    break
    m = _MOQ_RE.search(text) or _MIN_ORDER_RE.search(text)
    if m:
        deal.moq = _int(m.group(1))
    m = _MAX_RE.search(text)
    if m:
        deal.max_qty = _int(m.group(1))

    if "|" in text or "\t" in text:
        # Delimited row: name | price | moq | max | links | comps
        parts = [p.strip() for p in re.split(r"[|\t]", text) if p.strip()]
        money_parts, int_parts, rest_parts = [], [], []
        qty_field = re.compile(
            r"(?i)^\s*(?:moq|max(?:imum)?|qty|quantity|units|min(?:imum)?\s*order)?"
            r"\s*[:=]?\s*\d[\d,]*\s*$"
        )
        for p in parts:
            if _URL_RE.search(p):
                continue
            if _MONEY_RE.search(p):
                money_parts.append(p)
            elif qty_field.match(p):
                # Pure numeric/qty slot ("150", "MOQ 100", "max 20") — a name
                # with digits in it ("LED Shop Light 4ft") stays a name.
                int_parts.append(p)
            else:
                rest_parts.append(p)
        if deal.name is None and rest_parts:
            deal.name = rest_parts[0]
        if deal.wholesale_price is None and money_parts:
            deal.wholesale_price = _money(money_parts[0])
        if deal.reference_price is None and len(money_parts) > 1:
            deal.reference_price = _money(money_parts[-1])
        if deal.moq is None:
            for p in int_parts:
                if _MOQ_RE.search(p) or _MIN_ORDER_RE.search(p):
                    deal.moq = _int(p)
                    break
        if deal.max_qty is None:
            for p in int_parts:
                if _MAX_RE.search(p):
                    deal.max_qty = _int(p)
                    break
        if deal.moq is None and int_parts:
            deal.moq = _int(int_parts[0])
        if deal.max_qty is None and len(int_parts) > 1:
            deal.max_qty = _int(int_parts[1])
    else:
        # Freeform block: fallbacks for anything the labels missed.
        if deal.wholesale_price is None:
            deal.wholesale_price = _money(text)
        if deal.name is None:
            for ln in text.split("\n"):
                ln = re.sub(r"^\s*(?:\d+[\.\)]|[-•*])\s+", "", ln).strip()
                if (
                    len(ln) >= 4
                    and not _URL_RE.search(ln)
                    and not _MONEY_RE.search(ln)
                    and not re.match(r"(?i)^(moq|max|min|wholesale|cost|price|comp|link|url)\b", ln)
                ):
                    deal.name = ln
                    break
    if deal.name and _URL_RE.search(deal.name):
        # "Product name/link" pasted as a bare URL
        u = deal.name.strip()
        if deal.supplier_url is None and not _is_comp_url(u):
            deal.supplier_url = u
        deal.name = None  # let the fallback below title it from the URL slug
        deal.warnings.append("name was a bare URL — titled from link")

    if deal.name is None and deal.supplier_url:
        slug = deal.supplier_url.rstrip("/").split("/")[-1]
        slug = re.sub(r"[-_]+", " ", re.sub(r"\.(html?|php|aspx?)$", "", slug)).strip()
        deal.name = slug.title() if len(slug) >= 3 else None
    if deal.name:
        deal.name = deal.name.strip().strip("-–—").strip()
        if len(deal.name) > 480:
            deal.name = deal.name[:480]

    if deal.wholesale_price is None:
        deal.warnings.append("no wholesale price parsed")
    if deal.moq is None:
        deal.warnings.append("no MOQ parsed — defaulted")
    return deal


def parse_deal_sheet(text: str) -> List[ParsedSupplierDeal]:
    """Parse pasted deal-sheet text into structured deal rows."""
    if not text or not text.strip():
        return []
    deals = [_parse_block(b) for b in _split_blocks(text)]
    # A real deal row must carry at least one machine-usable field — a
    # name-only block is just prose from the email body.
    return [
        d for d in deals
        if d.wholesale_price is not None or d.moq is not None
        or d.supplier_url or d.comp_links
    ]


def margin_flag(cost: float, reference_price: Optional[float]) -> str:
    """Gross-margin flag vs the ~40% floor."""
    if not reference_price or reference_price <= 0:
        return "unknown"
    pct = (reference_price - cost) / reference_price * 100
    return "ok" if pct >= GROSS_MARGIN_FLOOR * 100 else "below_floor"


def import_deal_sheet(
    db: Session,
    text: str,
    *,
    reference_price: Optional[float] = None,
    niche: str = "general",
    supplier: str = SUPPLIER_NAME,
    pool_days: int = DEFAULT_POOL_DAYS,
    default_max_per_hunter: int = 10,
) -> dict:
    """Parse the sheet and create DRAFT ``DropshipProduct`` + ``DropshipPool``
    rows. Nothing here publishes — pools stay ``draft`` until an admin marks
    them fulfillable via the review endpoint.

    ``reference_price`` is a sheet-level fallback comp price for deals that
    didn't carry their own.
    """
    from datetime import datetime, timedelta

    parsed = parse_deal_sheet(text)
    items = []
    created = existing = errors = 0

    for i, deal in enumerate(parsed):
        if not deal.name:
            items.append({
                "index": i, "status": "error",
                "error": "no product name or link could be parsed",
                "raw": deal.raw[:300], "warnings": deal.warnings,
            })
            errors += 1
            continue
        if deal.wholesale_price is None:
            items.append({
                "index": i, "status": "error", "name": deal.name,
                "error": "no wholesale price parsed — deal skipped",
                "raw": deal.raw[:300], "warnings": deal.warnings,
            })
            errors += 1
            continue

        ref = deal.reference_price or reference_price
        flag = margin_flag(deal.wholesale_price, ref)
        margin_pct = (
            round((ref - deal.wholesale_price) / ref * 100)
            if ref and ref > 0 else None
        )
        moq = deal.moq or deal.max_qty or 50
        if deal.moq is None:
            deal.warnings.append(f"MOQ defaulted to {moq}")
        # Target sell price: the comp/reference price when known, otherwise
        # the exact 40%-floor price (cost / 0.6) so the draft band never
        # pretends a margin it doesn't have.
        target = ref if ref else round(deal.wholesale_price / (1 - GROSS_MARGIN_FLOOR), 2)
        max_per = deal.max_qty or default_max_per_hunter

        try:
            product = (
                db.query(DropshipProduct)
                .filter(DropshipProduct.sku == deal.sku)
                .first()
            )
            product_status = "created"
            if product:
                product_status = "existing_product"
                # Refresh the draft fields — a re-paste is a price update.
                product.cost = Decimal(str(round(deal.wholesale_price, 2)))
                product.suggested_price = Decimal(str(round(target, 2)))
                product.supplier_url = deal.supplier_url or product.supplier_url
            else:
                product = DropshipProduct(
                    sku=deal.sku,
                    title=deal.name,
                    description=(
                        f"Imported from {supplier} deal sheet. "
                        + (f"Comps: {', '.join(deal.comp_links)}" if deal.comp_links else "")
                    ).strip(),
                    niche=niche,
                    supplier=supplier,
                    cost=Decimal(str(round(deal.wholesale_price, 2))),
                    suggested_price=Decimal(str(round(target, 2))),
                    supplier_url=deal.supplier_url,
                    is_active=False,
                    status="draft",
                    source=SOURCE,
                )
                db.add(product)
                db.flush()

            # Don't stack a second live/draft pool on the same product.
            pool = (
                db.query(DropshipPool)
                .filter(
                    DropshipPool.product_id == product.id,
                    DropshipPool.status.in_(["draft", "pending_review", "open"]),
                )
                .first()
            )
            pool_status = "existing_pool"
            if not pool:
                notes = (
                    f"{supplier} import — wholesale ${deal.wholesale_price:.2f}, "
                    f"MOQ {moq}, max {max_per}/hunter."
                )
                if deal.comp_links:
                    notes += f" Comps: {', '.join(deal.comp_links)}."
                notes += (
                    f" Gross margin vs ref: "
                    f"{margin_pct if margin_pct is not None else 'n/a'}% "
                    f"({flag}, floor {int(GROSS_MARGIN_FLOOR * 100)}%)."
                )
                pool = DropshipPool(
                    product_id=product.id,
                    moq_units=moq,
                    unit_cost=Decimal(str(round(deal.wholesale_price, 2))),
                    target_price=Decimal(str(round(target, 2))),
                    min_price=Decimal(str(round(deal.wholesale_price / (1 - GROSS_MARGIN_FLOOR), 2))),
                    max_units_per_hunter=max_per,
                    status="draft",
                    channel="amazon_fba",
                    origin="us",
                    freight_mode="us_stock",
                    delivery_days_max=7,
                    deal_notes=notes,
                    closes_at=datetime.utcnow() + timedelta(days=pool_days),
                )
                db.add(pool)
                db.flush()
                pool_status = "draft_created"

            items.append({
                "index": i,
                "status": "created" if product_status == "created" else product_status,
                "name": deal.name,
                "sku": product.sku,
                "product_id": str(product.id),
                "product_status": product_status,
                "pool_id": str(pool.id),
                "pool_status": "draft" if pool_status == "draft_created" else pool.status,
                "wholesale_price": deal.wholesale_price,
                "reference_price": ref,
                "gross_margin_pct": margin_pct,
                "margin_flag": flag,
                "moq": moq,
                "max_qty_per_hunter": max_per,
                "comp_links": deal.comp_links,
                "warnings": deal.warnings,
            })
            if product_status == "created":
                created += 1
            else:
                existing += 1
        except Exception as exc:  # keep going — one bad row shouldn't sink the paste
            logger.warning("supplier import row %d failed: %s", i, exc)
            db.rollback()
            items.append({
                "index": i, "status": "error", "name": deal.name,
                "error": f"{type(exc).__name__}: {exc}", "warnings": deal.warnings,
            })
            errors += 1

    db.commit()
    return {
        "supplier": supplier,
        "parsed": len(parsed),
        "created": created,
        "existing": existing,
        "errors": errors,
        "margin_floor_pct": int(GROSS_MARGIN_FLOOR * 100),
        "items": items,
    }
