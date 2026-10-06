"""CRM activities table — staff notes/tasks pinned to users (admin CRM).

Revision ID: 034
Revises: 033
Create Date: 2026-10-06
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "034"
down_revision = "033"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "crm_activities",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("subject_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("author_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("type", sa.String(20), nullable=False, server_default="note"),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("due_at", sa.DateTime(), nullable=True),
        sa.Column("done_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_crm_activities_subject", "crm_activities", ["subject_user_id"])
    op.create_index("ix_crm_activities_author", "crm_activities", ["author_id"])
    op.create_index("ix_crm_activities_type", "crm_activities", ["type"])


def downgrade():
    op.drop_table("crm_activities")
