"""Add saved_deals — bookmarked deals synced to the account.

Revision ID: 032
Revises: 031
Create Date: 2026-09-26
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "032"
down_revision = "031"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "saved_deals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("deal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("arbitrage_deals.id"), nullable=False),
        sa.Column("saved_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_saved_deals_user_id", "saved_deals", ["user_id"])
    op.create_index("ix_saved_deals_deal_id", "saved_deals", ["deal_id"])
    op.create_unique_constraint("uq_saved_deals_user_deal", "saved_deals", ["user_id", "deal_id"])


def downgrade():
    op.drop_constraint("uq_saved_deals_user_deal", "saved_deals")
    op.drop_index("ix_saved_deals_deal_id", table_name="saved_deals")
    op.drop_index("ix_saved_deals_user_id", table_name="saved_deals")
    op.drop_table("saved_deals")
