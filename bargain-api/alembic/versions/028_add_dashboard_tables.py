"""Add deal_claims + user_list_items (dashboard haul tracker / lists).

Revision ID: 028
Revises: 027
Create Date: 2026-09-23
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "028"
down_revision = "027"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "deal_claims",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("deal_id", UUID(as_uuid=True), sa.ForeignKey("arbitrage_deals.id")),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("image_url", sa.String(1000)),
        sa.Column("buy_url", sa.String(1000)),
        sa.Column("buy_platform", sa.String(50)),
        sa.Column("sell_platform", sa.String(50)),
        sa.Column("quantity", sa.Integer(), server_default="1", nullable=False),
        sa.Column("buy_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("est_sell_price", sa.Numeric(10, 2)),
        sa.Column("est_net_profit", sa.Numeric(10, 2)),
        sa.Column("status", sa.String(20), server_default="bought", nullable=False),
        sa.Column("listing_url", sa.String(1000)),
        sa.Column("sold_price", sa.Numeric(10, 2)),
        sa.Column("purchased_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("listed_at", sa.DateTime()),
        sa.Column("sold_at", sa.DateTime()),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_deal_claims_user_id", "deal_claims", ["user_id"])
    op.create_index("ix_deal_claims_deal_id", "deal_claims", ["deal_id"])
    op.create_index("ix_deal_claims_status", "deal_claims", ["status"])

    op.create_table(
        "user_list_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("list_type", sa.String(20), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("url", sa.String(1000)),
        sa.Column("target_price", sa.Numeric(10, 2)),
        sa.Column("notes", sa.Text()),
        sa.Column("matched_deal_id", UUID(as_uuid=True), sa.ForeignKey("arbitrage_deals.id")),
        sa.Column("matched_at", sa.DateTime()),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_user_list_items_user_id", "user_list_items", ["user_id"])
    op.create_index("ix_user_list_items_list_type", "user_list_items", ["list_type"])
    op.create_index("ix_user_list_items_is_active", "user_list_items", ["is_active"])


def downgrade():
    for idx in (
        "ix_user_list_items_is_active",
        "ix_user_list_items_list_type",
        "ix_user_list_items_user_id",
    ):
        op.drop_index(idx, table_name="user_list_items")
    op.drop_table("user_list_items")
    for idx in ("ix_deal_claims_status", "ix_deal_claims_deal_id", "ix_deal_claims_user_id"):
        op.drop_index(idx, table_name="deal_claims")
    op.drop_table("deal_claims")
