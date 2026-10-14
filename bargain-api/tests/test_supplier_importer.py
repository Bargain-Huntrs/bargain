"""Supplier deal-sheet importer tests — Bulk Buy America wholesale flow.

Covers the parser (labeled blocks, delimited rows, freeform), the ~40%
gross-margin flag, and the draft-only import path (products land
is_active=False + status='draft', pools land status='draft' and are only
opened by the admin review endpoint).

Uses the shared ``client``/``db_mock`` fixtures for API tests and a real
in-memory sqlite session for the service layer — same pattern as the
sqlite e2e checks noted in AGENT_STATE.
"""
import uuid
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.models import DropshipPool, DropshipProduct
from app.routers.auth import create_access_token
from app.services.supplier_importer import (
    GROSS_MARGIN_FLOOR,
    SUPPLIER_NAME,
    import_deal_sheet,
    margin_flag,
    parse_deal_sheet,
)


# ── Parser ───────────────────────────────────────────────────────────────

LABELED_SHEET = """
Subject: Bulk Buy America — weekly wholesale deals

Product: 12-Piece Torque Wrench Set
Link: https://bulkbuyamerica.com/products/torque-wrench-12pc
Wholesale: $8.50
MOQ: 100
Max qty: 20
Comp: https://www.amazon.com/dp/B0EXAMPLE1 $34.99

Product: Insulated Water Bottle 32oz
Link: https://bulkbuyamerica.com/products/water-bottle-32
Price: $4.25
MOQ: 200
Max: 25
Comp: https://www.walmart.com/ip/12345678 $19.97
"""


class TestParser:
    def test_labeled_blocks(self):
        deals = parse_deal_sheet(LABELED_SHEET)
        assert len(deals) == 2
        d = deals[0]
        assert d.name == "12-Piece Torque Wrench Set"
        assert d.supplier_url == "https://bulkbuyamerica.com/products/torque-wrench-12pc"
        assert d.wholesale_price == 8.50
        assert d.moq == 100
        assert d.max_qty == 20
        assert d.comp_links == ["https://www.amazon.com/dp/B0EXAMPLE1"]
        assert d.reference_price == 34.99
        assert d.sku.startswith("BBA-")

    def test_delimited_rows(self):
        sheet = (
            "name | price | moq | max | link | comps\n"
            "LED Shop Light 4ft | $11.00 | 150 | 15 | https://bulkbuyamerica.com/x/led-4ft | https://www.amazon.com/dp/B0LED1 $39.95\n"
            "Cast Iron Skillet 12in | $9.75 | 120 | 12 | https://bulkbuyamerica.com/x/skillet | https://www.walmart.com/ip/777 $24.88\n"
        )
        deals = parse_deal_sheet(sheet)
        assert len(deals) == 2
        assert deals[0].name == "LED Shop Light 4ft"
        assert deals[0].wholesale_price == 11.00
        assert deals[0].moq == 150
        assert deals[0].max_qty == 15
        assert deals[1].name == "Cast Iron Skillet 12in"

    def test_freeform_bullets(self):
        sheet = (
            "1. Garage Wall Hooks 10-pack — $6.40 each, MOQ 80, max 10, "
            "https://bulkbuyamerica.com/x/hooks — comp https://www.amazon.com/dp/B0HOOK1\n"
            "2. Collapsible Laundry Basket — $3.90, MOQ: 250, "
            "https://bulkbuyamerica.com/x/basket\n"
        )
        deals = parse_deal_sheet(sheet)
        assert len(deals) == 2
        assert deals[0].moq == 80
        assert deals[0].max_qty == 10
        assert deals[1].wholesale_price == 3.90

    def test_empty_and_junk(self):
        assert parse_deal_sheet("") == []
        assert parse_deal_sheet("Hello,\n\nThanks for your interest!\n\n— BBA") == []


class TestMarginFlag:
    def test_thresholds(self):
        # 40% gross floor: (ref - cost) / ref
        assert margin_flag(60.0, 100.0) == "ok"          # exactly 40%
        assert margin_flag(59.99, 100.0) == "ok"
        assert margin_flag(61.0, 100.0) == "below_floor"  # 39%
        assert margin_flag(10.0, None) == "unknown"
        assert margin_flag(10.0, 0) == "unknown"


# ── Import into draft rows (real sqlite) ────────────────────────────────

@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    DropshipProduct.__table__.create(engine)
    DropshipPool.__table__.create(engine)
    s = sessionmaker(bind=engine)()
    yield s
    s.close()


class TestImportDealSheet:
    def test_creates_draft_rows(self, db):
        result = import_deal_sheet(db, LABELED_SHEET)
        assert result["supplier"] == SUPPLIER_NAME
        assert result["created"] == 2
        assert result["errors"] == 0

        prod = db.query(DropshipProduct).first()
        pool = db.query(DropshipPool).first()
        assert prod.is_active is False
        assert prod.status == "draft"
        assert prod.supplier == SUPPLIER_NAME
        assert prod.source == "supplier_import"
        assert pool.status == "draft"  # never auto-published
        assert pool.moq_units == 100

    def test_margin_flag_on_items(self, db):
        result = import_deal_sheet(db, LABELED_SHEET)
        flags = {it["name"]: it["margin_flag"] for it in result["items"]}
        # $8.50 cost vs $34.99 comp → ~76% gross → ok
        assert flags["12-Piece Torque Wrench Set"] == "ok"
        # $4.25 vs $19.97 → ~79% → ok
        assert flags["Insulated Water Bottle 32oz"] == "ok"

    def test_below_floor_flagged(self, db):
        sheet = "Product: Slim Margin Gadget\nWholesale: $18.00\nMOQ: 50\nComp: https://www.amazon.com/dp/X $24.00\n"
        result = import_deal_sheet(db, sheet)
        item = result["items"][0]
        assert item["margin_flag"] == "below_floor"
        assert item["gross_margin_pct"] == 25
        # Still creates the draft — the flag is for the reviewing admin.
        assert item["status"] == "created"

    def test_reimport_reuses_product(self, db):
        first = import_deal_sheet(db, LABELED_SHEET)
        second = import_deal_sheet(db, LABELED_SHEET)
        assert first["created"] == 2
        assert second["created"] == 0
        assert second["existing"] == 2
        assert db.query(DropshipProduct).count() == 2
        assert db.query(DropshipPool).count() == 2  # no duplicate draft pools

    def test_missing_price_is_error_not_row(self, db):
        sheet = "Product: No Price Listed\nLink: https://bulkbuyamerica.com/x/np\nMOQ: 10\n"
        result = import_deal_sheet(db, sheet)
        assert result["errors"] == 1
        assert result["created"] == 0
        assert db.query(DropshipProduct).count() == 0

    def test_reference_price_fallback(self, db):
        sheet = "Product: Fallback Comp Item\nWholesale: $10.00\nMOQ: 40\n"
        result = import_deal_sheet(db, sheet, reference_price=25.0)
        item = result["items"][0]
        assert item["reference_price"] == 25.0
        assert item["margin_flag"] == "ok"  # 60% gross


# ── API: admin gate on the import endpoint ───────────────────────────────

def _user(role="user", tier="hunter"):
    return SimpleNamespace(
        id=uuid.uuid4(), role=role, subscription_tier=tier, is_active=True,
        email=f"{role}@test.com", stripe_customer_id=None, subscribed_niches=[],
    )


class TestImportEndpoint:
    def test_unauthenticated_401(self, client):
        resp = client.post("/api/v1/dropship/admin/import/bulk-buy-america",
                           json={"text": LABELED_SHEET})
        assert resp.status_code == 401

    def test_non_admin_403(self, client, db_mock):
        db_mock.first_return = _user("user")
        token = create_access_token(str(db_mock.first_return.id))
        resp = client.post(
            "/api/v1/dropship/admin/import/bulk-buy-america",
            json={"text": LABELED_SHEET},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    def test_admin_import_returns_items(self, client, db_mock):
        db_mock.first_return = _user("admin")
        token = create_access_token(str(db_mock.first_return.id))
        resp = client.post(
            "/api/v1/dropship/admin/import/bulk-buy-america",
            json={"text": LABELED_SHEET},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["supplier"] == "Bulk Buy America"
        assert data["margin_floor_pct"] == int(GROSS_MARGIN_FLOOR * 100)
        assert len(data["items"]) == 2
        # Everything created is a draft — nothing opens itself.
        assert all(i["pool_status"] == "draft" for i in data["items"])

    def test_admin_review_requires_admin(self, client, db_mock):
        db_mock.first_return = _user("user")
        token = create_access_token(str(db_mock.first_return.id))
        resp = client.post(
            f"/api/v1/dropship/admin/pools/{uuid.uuid4()}/review",
            json={"action": "open"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403
