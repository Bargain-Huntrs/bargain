"""Add listings table (generalized auction/surplus aggregation).

Revision ID: 027
Revises: 026
Create Date: 2026-09-24
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "027"
down_revision = "026"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "listings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("source_id", sa.String(120), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("source_category", sa.String(150)),
        sa.Column("current_bid", sa.Numeric(14, 2)),
        sa.Column("min_bid", sa.Numeric(14, 2)),
        sa.Column("num_bids", sa.Integer()),
        sa.Column("sale_method", sa.String(50)),
        sa.Column("status", sa.String(50)),
        sa.Column("start_date", sa.DateTime()),
        sa.Column("end_date", sa.DateTime()),
        sa.Column("city", sa.String(120)),
        sa.Column("state", sa.String(2)),
        sa.Column("zip", sa.String(10)),
        sa.Column("country", sa.String(2), server_default="US"),
        sa.Column("image_url", sa.String(1000)),
        sa.Column("detail_url", sa.String(1000), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true()),
        sa.Column("first_seen_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("source", "source_id", name="uq_listings_source_source_id"),
    )
    op.create_index("ix_listings_source", "listings", ["source"])
    op.create_index("ix_listings_category", "listings", ["category"])
    op.create_index("ix_listings_city", "listings", ["city"])
    op.create_index("ix_listings_state", "listings", ["state"])
    op.create_index("ix_listings_end_date", "listings", ["end_date"])
    op.create_index("ix_listings_is_active", "listings", ["is_active"])
    op.create_index("ix_listings_last_seen_at", "listings", ["last_seen_at"])
    op.create_index("ix_listings_current_bid", "listings", ["current_bid"])


def downgrade():
    for idx in (
        "ix_listings_current_bid",
        "ix_listings_last_seen_at",
        "ix_listings_is_active",
        "ix_listings_end_date",
        "ix_listings_state",
        "ix_listings_city",
        "ix_listings_category",
        "ix_listings_source",
    ):
        op.drop_index(idx, table_name="listings")
    op.drop_table("listings")
