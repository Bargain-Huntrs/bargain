"""Feature-request board + community deal threads.

Tables: feature_requests, feature_request_votes, deal_threads,
deal_thread_comments, deal_thread_votes. The routers also carry lazy
CREATE TABLE IF NOT EXISTS fallbacks because Render runs no migrations at
boot (same pattern as 034_crm_activities).

Revision ID: 035
Revises: 034
Create Date: 2026-10-08
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "035"
down_revision = "034"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "feature_requests",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("category", sa.String(50), nullable=False, server_default="general"),
        sa.Column("status", sa.String(20), nullable=False, server_default="under_review"),
        sa.Column("votes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("author_name", sa.String(120), nullable=True),
        sa.Column("author_email", sa.String(255), nullable=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_feature_requests_status", "feature_requests", ["status"])
    op.create_index("ix_feature_requests_category", "feature_requests", ["category"])
    op.create_index("ix_feature_requests_created", "feature_requests", ["created_at"])
    op.create_index("ix_feature_requests_user", "feature_requests", ["user_id"])

    op.create_table(
        "feature_request_votes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "request_id",
            UUID(as_uuid=True),
            sa.ForeignKey("feature_requests.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("voter_id", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("request_id", "voter_id", name="uq_feature_request_vote"),
    )
    op.create_index("ix_feature_request_votes_request", "feature_request_votes", ["request_id"])

    op.create_table(
        "deal_threads",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("author_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("author_name", sa.String(120), nullable=False),
        sa.Column("author_email", sa.String(255), nullable=True),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("url", sa.String(1000), nullable=True),
        sa.Column("retailer", sa.String(100), nullable=True),
        sa.Column("price_cents", sa.Integer(), nullable=True),
        sa.Column("original_price_cents", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="published"),
        sa.Column("upvotes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("comments_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_deal_threads_status", "deal_threads", ["status"])
    op.create_index("ix_deal_threads_created", "deal_threads", ["created_at"])
    op.create_index("ix_deal_threads_author", "deal_threads", ["author_user_id"])

    op.create_table(
        "deal_thread_comments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "thread_id",
            UUID(as_uuid=True),
            sa.ForeignKey("deal_threads.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("author_name", sa.String(120), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_deal_thread_comments_thread", "deal_thread_comments", ["thread_id"])

    op.create_table(
        "deal_thread_votes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "thread_id",
            UUID(as_uuid=True),
            sa.ForeignKey("deal_threads.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("voter_id", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("thread_id", "voter_id", name="uq_deal_thread_vote"),
    )
    op.create_index("ix_deal_thread_votes_thread", "deal_thread_votes", ["thread_id"])


def downgrade():
    op.drop_table("deal_thread_votes")
    op.drop_table("deal_thread_comments")
    op.drop_table("deal_threads")
    op.drop_table("feature_request_votes")
    op.drop_table("feature_requests")
