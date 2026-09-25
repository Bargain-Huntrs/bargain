"""Add archived_at to arbitrage_deals.

Revision ID: 030
Revises: 029
Create Date: 2026-09-25
"""
import sqlalchemy as sa
from alembic import op

revision = "030"
down_revision = "029"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "arbitrage_deals",
        sa.Column("archived_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_arbitrage_deals_archived_at", "arbitrage_deals", ["archived_at"])


def downgrade():
    op.drop_index("ix_arbitrage_deals_archived_at", table_name="arbitrage_deals")
    op.drop_column("arbitrage_deals", "archived_at")
