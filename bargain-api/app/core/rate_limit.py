"""Light in-memory rate limiting — per-process, resets on restart.

Shared by public/unauthenticated endpoints (auth, report-dead, newsletter,
waitlist) and community posting. Enough to blunt spam and brute force
without adding Redis for a first pass. Extracted from community.py's
private limiter so every router shares one implementation.

Usage::

    rate_limit_or_429("auth-login", request_ip(request))
"""

import time
from typing import Optional

from fastapi import HTTPException, Request, status

_RATE_LIMIT_STATE: dict[str, list[float]] = {}

# kind -> (max hits, window seconds). Limits are per-key (usually per-IP)
# and sized so normal use never trips them — they exist to stop abuse:
# credential stuffing, email-bombing arbitrary addresses, dead-report
# griefing, and community spam.
_RATE_LIMITS: dict[str, tuple[int, int]] = {
    # Community posting (moved from community.py — same values)
    "thread": (5, 3600),
    "comment": (30, 3600),
    # Crowd deal moderation — dedup makes repeat reports meaningless, this
    # caps raw write volume per IP on top of that.
    "report-dead": (20, 3600),
    # Credential brute force / stuffing — matches the @Throttle(5/min)
    # reference posture in reid-api, with headroom for shared IPs (NAT).
    "auth-login": (10, 300),
    "auth-register": (10, 3600),
    # Unauthenticated endpoints that trigger an outbound email — an open
    # relay to bomb arbitrary inboxes without this.
    "forgot-password": (5, 3600),
    "newsletter-subscribe": (5, 3600),
    "waitlist-join": (5, 3600),
}


def rate_limit_or_429(
    kind: str,
    key: str,
    detail: str = "Too many requests — please try again later",
) -> None:
    """Record a hit for `kind:key`; raise HTTP 429 once over the limit."""
    max_hits, window = _RATE_LIMITS[kind]
    now = time.time()
    bucket = _RATE_LIMIT_STATE.setdefault(f"{kind}:{key}", [])
    bucket[:] = [t for t in bucket if now - t < window]
    if len(bucket) >= max_hits:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
        )
    bucket.append(now)


def request_ip(request: Optional[Request]) -> str:
    """Best-effort client IP — prefers X-Forwarded-For (the api-guard
    Cloudflare Worker and tunnel both forward the real address)."""
    if request is None:
        return "anon"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "anon"
