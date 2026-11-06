"""Users nickname column — public handle so real emails never render.

Privacy fix: `User.full_name` fell back to the raw email address, and the
leaderboard / community thread / feature-board serializers emitted it —
so full emails were public. `nickname` is the new public handle, backfilled
from each user's email local-part (they can edit it via PUT /auth/me).

Also scrubs emails already stored in public author_name columns
(deal_threads, deal_thread_comments, feature_requests). The same patch runs
lazily at app startup via `ensure_privacy_schema()` so environments that
skip migrations are still covered (same pattern as 034/035 lazy DDL).

Revision ID: 037
Revises: 036
Create Date: 2026-11-20
"""
import sqlalchemy as sa
from alembic import op

revision = "037"
down_revision = "036"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "nickname" not in [c["name"] for c in inspector.get_columns("users")]:
        op.add_column("users", sa.Column("nickname", sa.String(60), nullable=True))

    # Backfill + scrub below use Postgres functions — skip on other
    # dialects (local sqlite dev has no prod data to scrub anyway).
    if bind.dialect.name != "postgresql":
        return

    # Backfill: nickname = email local-part.
    op.execute(
        """UPDATE users
           SET nickname = LEFT(BTRIM(split_part(email, '@', 1)), 60)
           WHERE (nickname IS NULL OR BTRIM(nickname) = '')
             AND email LIKE '%@%'"""
    )

    # Scrub emails already stored in public-facing author_name fields.
    for table, link_col in (
        ("deal_threads", "author_user_id"),
        ("deal_thread_comments", "user_id"),
        ("feature_requests", "user_id"),
    ):
        if table not in inspector.get_table_names():
            continue
        # Linked rows: recompute from the author's public handle.
        op.execute(
            f"""UPDATE {table} t
                SET author_name = COALESCE(
                    NULLIF(BTRIM(u.nickname), ''),
                    LEFT(BTRIM(split_part(u.email, '@', 1)), 60),
                    'Hunter'
                )
                FROM users u
                WHERE t.{link_col} = u.id
                  AND (t.author_name LIKE '%@%' OR t.author_name IS NULL OR BTRIM(t.author_name) = '')"""
        )
        # Anonymous rows that ARE an email: keep the local-part.
        op.execute(
            f"""UPDATE {table}
                SET author_name = LEFT(BTRIM(split_part(author_name, '@', 1)), 60)
                WHERE {link_col} IS NULL
                  AND author_name ~ '^\\S+@\\S+$'"""
        )
        # Anonymous rows embedding an email among other text: strip it.
        op.execute(
            f"""UPDATE {table}
                SET author_name = COALESCE(
                    NULLIF(BTRIM(regexp_replace(author_name, '\\S+@\\S+', '', 'g')), ''),
                    'Hunter'
                )
                WHERE {link_col} IS NULL
                  AND author_name LIKE '%@%'"""
        )


def downgrade():
    op.drop_column("users", "nickname")
