"""Add properties table (real-estate aggregation, Phase 1).

Revision ID: 026
Revises: 025
Create Date: 2026-09-22
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "026"
down_revision = "025"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "properties",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("source_id", sa.String(100), nullable=False),
        sa.Column("address", sa.String(300), nullable=False),
        sa.Column("city", sa.String(120)),
        sa.Column("state", sa.String(2)),
        sa.Column("zip", sa.String(10)),
        sa.Column("county", sa.String(120)),
        sa.Column("address_hash", sa.String(64)),
        sa.Column("list_price", sa.Numeric(12, 2)),
        sa.Column("bedrooms", sa.Numeric(4, 1)),
        sa.Column("bathrooms", sa.Numeric(4, 1)),
        sa.Column("sqft", sa.Integer()),
        sa.Column("year_built", sa.Integer()),
        sa.Column("property_type", sa.String(100)),
        sa.Column("status", sa.String(50)),
        sa.Column("listing_period", sa.String(50)),
        sa.Column("fha_financing", sa.String(50)),
        sa.Column("eligible_bidders", sa.String(150)),
        sa.Column("list_date", sa.Date()),
        sa.Column("bid_open_date", sa.Date()),
        sa.Column("period_deadline", sa.Date()),
        sa.Column("latitude", sa.Float()),
        sa.Column("longitude", sa.Float()),
        sa.Column("image_url", sa.String(1000)),
        sa.Column("detail_url", sa.String(1000), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true()),
        sa.Column("first_seen_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("source", "source_id", name="uq_properties_source_source_id"),
    )
    op.create_index("ix_properties_source", "properties", ["source"])
    op.create_index("ix_properties_city", "properties", ["city"])
    op.create_index("ix_properties_state", "properties", ["state"])
    op.create_index("ix_properties_zip", "properties", ["zip"])
    op.create_index("ix_properties_address_hash", "properties", ["address_hash"])
    op.create_index("ix_properties_is_active", "properties", ["is_active"])
    op.create_index("ix_properties_last_seen_at", "properties", ["last_seen_at"])
    op.create_index("ix_properties_list_price", "properties", ["list_price"])


def downgrade():
    for idx in (
        "ix_properties_list_price",
        "ix_properties_last_seen_at",
        "ix_properties_is_active",
        "ix_properties_address_hash",
        "ix_properties_zip",
        "ix_properties_state",
        "ix_properties_city",
        "ix_properties_source",
    ):
        op.drop_index(idx, table_name="properties")
    op.drop_table("properties")
