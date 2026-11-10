from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Synchronous engine (psycopg2 driver). The config normalizes DATABASE_URL to
# postgresql+psycopg2:// for Render Postgres, and falls back to sqlite for
# local development.
#
# SQL echo is controlled by SQL_ECHO env var (default False). Setting it to
# True floods logs with every SQL query (~500/sec in production), which causes
# Render's log rate limit to drop important scheduler/error messages.
engine = create_engine(settings.DATABASE_URL, echo=settings.SQL_ECHO)
SessionLocal = sessionmaker(engine, expire_on_commit=False)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_privacy_schema(db) -> None:
    """Email-privacy schema patch — runs at app startup (idempotent).

    Render boots with `alembic upgrade head`, but this is belt-and-suspenders
    for any env where migrations don't run, and it also performs the data
    backfill/sanitization (alembic 036+ chains were in flux when this
    shipped, so this startup patch is the authoritative path until a
    migration lands):

      1. users.nickname column (public handle; backfilled from email local-part)
      1b. users.deleted_at column (self-service account deletion tombstone)
      2. scrub stored author_name values that contain an email address in the
         public-facing tables (deal_threads, deal_thread_comments,
         feature_requests). Linked rows are recomputed from the author's
         nickname/local-part; anonymous rows keep the local-part or fall back
         to 'Hunter'.
    """
    from sqlalchemy import text

    dialect = db.bind.dialect.name if db.bind is not None else ""
    is_pg = dialect == "postgresql"

    # ── 1. users.nickname column ──────────────────────────────────────────
    try:
        if is_pg:
            db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname VARCHAR(60)"))
        else:
            # sqlite has no IF NOT EXISTS for columns — duplicate-column
            # errors are swallowed below.
            db.execute(text("ALTER TABLE users ADD COLUMN nickname VARCHAR(60)"))
        db.commit()
    except Exception:
        db.rollback()

    # ── 2. backfill nickname from email local-part ────────────────────────
    try:
        if is_pg:
            db.execute(text(
                """UPDATE users
                   SET nickname = LEFT(BTRIM(split_part(email, '@', 1)), 60)
                   WHERE (nickname IS NULL OR BTRIM(nickname) = '')
                     AND email LIKE '%@%'"""
            ))
        else:
            db.execute(text(
                """UPDATE users
                   SET nickname = SUBSTR(email, 1, INSTR(email, '@') - 1)
                   WHERE (nickname IS NULL OR TRIM(nickname) = '')
                     AND email LIKE '%@%'"""
            ))
        db.commit()
    except Exception:
        db.rollback()

    # ── 1b. users.deleted_at column ───────────────────────────────────────
    try:
        if is_pg:
            db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP"))
        else:
            db.execute(text("ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP"))
        db.commit()
    except Exception:
        db.rollback()

    # ── 3. scrub emails already stored in public author_name fields ───────
    # Postgres-only: sqlite rows are local-dev fixtures, skip silently.
    if not is_pg:
        return

    linked_scrub = [
        # (table, user-link column)
        ("deal_threads", "author_user_id"),
        ("deal_thread_comments", "user_id"),
        ("feature_requests", "user_id"),
    ]
    for table, link_col in linked_scrub:
        try:
            # Rows linked to a user: recompute from the user's public handle.
            db.execute(text(
                f"""UPDATE {table} t
                    SET author_name = COALESCE(
                        NULLIF(BTRIM(u.nickname), ''),
                        LEFT(BTRIM(split_part(u.email, '@', 1)), 60),
                        'Hunter'
                    )
                    FROM users u
                    WHERE t.{link_col} = u.id
                      AND (t.author_name LIKE '%@%' OR t.author_name IS NULL OR BTRIM(t.author_name) = '')"""
            ))
            # Anonymous rows that ARE an email: keep the local-part.
            db.execute(text(
                f"""UPDATE {table}
                    SET author_name = LEFT(BTRIM(split_part(author_name, '@', 1)), 60)
                    WHERE {link_col} IS NULL
                      AND author_name ~ '^\\S+@\\S+$'"""
            ))
            # Anonymous rows embedding an email among other text: strip it.
            db.execute(text(
                f"""UPDATE {table}
                    SET author_name = COALESCE(
                        NULLIF(BTRIM(regexp_replace(author_name, '\\S+@\\S+', '', 'g')), ''),
                        'Hunter'
                    )
                    WHERE {link_col} IS NULL
                      AND author_name LIKE '%@%'"""
            ))
            db.commit()
        except Exception:
            # Table may not exist yet on this env — lazy CREATE TABLE in the
            # routers will make it (and new rows are already sanitized).
            db.rollback()
