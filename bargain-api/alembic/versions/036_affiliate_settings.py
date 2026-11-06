"""DB-backed affiliate network settings.

Table: affiliate_settings — simple key/value store for affiliate network
credentials (CJ/Awin/Rakuten/Skimlinks tokens, publisher IDs). Lets tokens be
seeded/rotated in the app's own Postgres when the hosting dashboard's env
vars can't be updated. The runtime also lazy-creates this table on first use
(same pattern as 034_crm_activities) because prod runs no migrations at boot.

Revision ID: 036
Revises: 035
Create Date: 2026-11-05
"""
import sqlalchemy as sa
from alembic import op

revision = "036"
down_revision = "035"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "affiliate_settings",
        sa.Column("key", sa.Text(), primary_key=True),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("affiliate_settings")
