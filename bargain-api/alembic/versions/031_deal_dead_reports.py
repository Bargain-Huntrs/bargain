"""Add dead_report_count to arbitrage_deals for crowd dead-deal reports.

Revision ID: 031
Revises: 030
Create Date: 2026-09-26
"""
import sqlalchemy as sa
from alembic import op

revision = "031"
down_revision = "030"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "arbitrage_deals",
        sa.Column("dead_report_count", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade():
    op.drop_column("arbitrage_deals", "dead_report_count")
