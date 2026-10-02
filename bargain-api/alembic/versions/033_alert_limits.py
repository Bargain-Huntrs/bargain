"""Add user-controlled alert limits — daily cap, quiet hours, timezone.

Competitor review finding (DealSeek): notification spam with no controls
was a top complaint. Users get a personal max-alerts/day and quiet hours
in their own timezone, applied to email + SMS alerts.

Revision ID: 033
Revises: 032
Create Date: 2026-09-26
"""
import sqlalchemy as sa
from alembic import op

revision = "033"
down_revision = "032"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column("alert_max_per_day", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "users",
        sa.Column("quiet_start_hour", sa.Integer(), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("quiet_end_hour", sa.Integer(), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("alert_timezone", sa.String(64), nullable=True),
    )


def downgrade():
    op.drop_column("users", "alert_timezone")
    op.drop_column("users", "quiet_end_hour")
    op.drop_column("users", "quiet_start_hour")
    op.drop_column("users", "alert_max_per_day")
