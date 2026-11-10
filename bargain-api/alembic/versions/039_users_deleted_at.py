"""users.deleted_at — self-service account deletion tombstone.

DELETE /api/v1/auth/me anonymizes the user row instead of hard-deleting it
(~20 tables carry users.id FKs without cascade, so a raw DELETE would
violate constraints or orphan community/financial records). deleted_at
marks when the tombstone happened for audit/retention sweeps.

Prod runs no migrations at boot — ensure_privacy_schema() in
app/db/session.py applies the same ALTER lazily at startup; this migration
keeps environments that DO run alembic (Render, fresh dev DBs) in sync.

Revision ID: 039
Revises: 038
Create Date: 2026-11-22
"""
import sqlalchemy as sa
from alembic import op

revision = "039"
down_revision = "038"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("deleted_at", sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column("users", "deleted_at")
