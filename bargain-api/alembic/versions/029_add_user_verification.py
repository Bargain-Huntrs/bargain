"""Add email_verified + phone_verified to users.

Revision ID: 029
Revises: 028
Create Date: 2026-09-23
"""
import sqlalchemy as sa
from alembic import op

revision = "029"
down_revision = "028"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column("email_verified", sa.Boolean(), server_default="false", nullable=False),
    )
    op.add_column(
        "users",
        sa.Column("phone_verified", sa.Boolean(), server_default="false", nullable=False),
    )


def downgrade():
    op.drop_column("users", "phone_verified")
    op.drop_column("users", "email_verified")
