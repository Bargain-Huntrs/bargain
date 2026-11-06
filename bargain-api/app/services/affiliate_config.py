"""DB-backed affiliate network configuration.

The Bargain Render account has no API key/CLI session on the ops machine, so
environment variables can't be updated in production — which is how working
CJ/Awin/Rakuten credentials ended up stranded in the local .env while prod
ran unconfigured (or with dead tokens). This module persists affiliate
credentials in the `affiliate_settings` table in the app's own Postgres so
tokens can be seeded/rotated without touching the Render dashboard.

Read path: ``get_affiliate_config(key)``
    1. DB row in ``affiliate_settings`` (authoritative when present)
    2. ``settings.<key>`` env fallback (nothing breaks if the DB row is absent)

The table is lazy-created on first use — Render runs no migrations at boot,
same pattern as crm_activities / feature_requests (alembic 036 also covers it
for real migration runs).

Values are cached in-process for ``_CACHE_TTL_SECONDS`` so the click-out path
doesn't hit Postgres on every tagged URL. DB outages degrade to env values
rather than raising — affiliate tagging must never 500 a click.
"""
import logging
import time
from typing import Optional

from sqlalchemy import text

from app.core.config import settings

logger = logging.getLogger(__name__)

_TABLE = "affiliate_settings"
_CACHE_TTL_SECONDS = 120
_DB_RETRY_SECONDS = 60

_table_ensured = False
_cache: dict = {}
_cache_loaded_at: float = 0.0
_db_skip_until: float = 0.0  # backoff window when the DB is unreachable

# Tracking-domain/tag markers used to recognize affiliate-wrapped deal URLs
# (social posting filter + _has_affiliate_link). Covers every network whose
# feeds can produce deals: Impact.com rotating hosts, Amazon Associates tag,
# eBay campid, Walmart/Target/BestBuy affid, CJ click domains, Rakuten
# linksynergy, Awin awin1 deeplinks, Skimlinks skimresources.
AFFILIATE_TRACKING_MARKERS = [
    # Impact.com rotating tracking hosts + branded partners
    "sjv.io", "7eer.net", "pxf.io", "evyy.net", "vneoga.net", "elfm.net",
    "eyjo.net", "gqco.net", "hmxg.net", "ijrn.net", "jewn.net", "jyeh.net",
    "mtko.net", "tcux.net", "zlvv.net", "goto.walmart.com",
    "affiliates.abebooks.com",
    # Direct tags
    "tag=bargain0ae", "campid=", "affid=",
    # CJ Affiliate click domains
    "jdoqocy.com", "kqzyfj.com", "tkqlhce.com", "dpbolvw.net",
    "anrdoezrs.net", "apmebf.com", "gopjn.com", "pjatr.com", "pjtra.com",
    "pntra.com", "pntrac.com", "pntrs.com", "rjhv.net", "yceml.net",
    # Rakuten Advertising
    "click.linksynergy.com",
    # Awin deeplinks
    "awin1.com",
    # Skimlinks
    "go.skimresources.com",
]


def _session():
    from app.db.session import SessionLocal

    return SessionLocal()


def _ensure_table(db) -> None:
    """Self-healing DDL — create affiliate_settings lazily on first use."""
    global _table_ensured
    if _table_ensured:
        return
    try:
        db.execute(
            text(
                f"""CREATE TABLE IF NOT EXISTS {_TABLE} (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                )"""
            )
        )
        db.commit()
        _table_ensured = True
    except Exception as e:
        logger.warning(f"affiliate_settings ensure-table failed: {e}")
        db.rollback()


def _load_cache(force: bool = False) -> None:
    """Load all affiliate_settings rows into the in-process cache."""
    global _cache, _cache_loaded_at, _db_skip_until

    now = time.time()
    if not force and _cache_loaded_at and (now - _cache_loaded_at < _CACHE_TTL_SECONDS):
        return
    if now < _db_skip_until:
        return  # DB recently failed — use env fallback until backoff expires

    db = _session()
    try:
        _ensure_table(db)
        rows = db.execute(text(f"SELECT key, value FROM {_TABLE}")).fetchall()
        _cache = {r[0]: r[1] for r in rows if r[1]}
        _cache_loaded_at = now
    except Exception as e:
        logger.warning(f"affiliate_settings read failed (env fallback active): {e}")
        _db_skip_until = now + _DB_RETRY_SECONDS
    finally:
        db.close()


def get_affiliate_config(key: str, default: str = "") -> str:
    """Return an affiliate credential: DB value first, env fallback.

    DB wins so a rotated token takes effect without a redeploy. If no DB row
    exists (or the DB is unreachable), the pydantic settings value is used —
    identical behavior to the pre-DB code path.
    """
    _load_cache()
    value = _cache.get(key)
    if value:
        return value
    return getattr(settings, key, default) or default


def affiliate_config_source(key: str) -> str:
    """Report where a key's effective value comes from: 'db' | 'env' | 'unset'."""
    _load_cache()
    if _cache.get(key):
        return "db"
    if getattr(settings, key, ""):
        return "env"
    return "unset"


def set_affiliate_config(key: str, value: str) -> bool:
    """Upsert a credential into affiliate_settings and refresh the cache.

    Used by ops scripts (no HTTP endpoint exposes secret values). Returns
    True on success.
    """
    db = _session()
    try:
        _ensure_table(db)
        db.execute(
            text(
                f"""INSERT INTO {_TABLE} (key, value, updated_at)
                    VALUES (:k, :v, NOW())
                    ON CONFLICT (key) DO UPDATE SET value = :v, updated_at = NOW()"""
            ),
            {"k": key, "v": value},
        )
        db.commit()
        _load_cache(force=True)
        logger.info(f"affiliate_settings: stored {key} (len={len(value)})")
        return True
    except Exception as e:
        logger.error(f"affiliate_settings write failed for {key}: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def clear_affiliate_config(key: str) -> bool:
    """Delete a DB row so the env fallback applies again."""
    db = _session()
    try:
        _ensure_table(db)
        db.execute(text(f"DELETE FROM {_TABLE} WHERE key = :k"), {"k": key})
        db.commit()
        _load_cache(force=True)
        return True
    except Exception as e:
        logger.error(f"affiliate_settings delete failed for {key}: {e}")
        db.rollback()
        return False
    finally:
        db.close()
