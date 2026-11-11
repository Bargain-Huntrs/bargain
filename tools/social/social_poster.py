#!/usr/bin/env python3
"""
BargainHuntrs — Social Poster

Buffer replacement at $0. Reads a content queue, posts whatever is due to
every configured platform, and records what was sent. Designed to run once
daily from launchd — see scripts/bargain-crons.sh and
~/Library/LaunchAgents/com.bargain.cron-social-daily.plist.

Supported platforms (all free tiers / free APIs):
  - Bluesky   — free API, just app-password auth (easiest to set up)
  - Mastodon  — free API on any instance
  - Reddit    — free OAuth; posts to a subreddit you own/mod (r/bargainhuntrs)
  - Facebook  — Graph API, posts to a Facebook Page (needs page access token)
  - LinkedIn  — member post via w_member_social (OAuth app required)
  - Nextdoor  — Publish API, posts to our business page (OAuth, see nextdoor_auth.py)
  - X/Twitter — free tier is write-only, 500 posts/mo (OAuth1 user context)
  - Buffer    — GraphQL API, posts to every connected channel (X, FB, IG…)

Queue format (content_queue.json):
  [
    {
      "date": "2026-09-16",               # ISO date the post goes out
      "text": "…",                         # shared text (per-platform override below)
      "link": "https://bargainhuntrs.com",  # optional, appended where supported
      "platforms": {                       # optional per-platform text overrides
        "reddit": {"title": "…", "subreddit": "bargainhuntrs"}
      }
    }
  ]

State is tracked in posted_state.json — safe to re-run; it only sends items
whose date <= today and that haven't been posted to that platform yet.

Usage:
  python social_poster.py                     # post everything due today
  python social_poster.py --dry-run           # preview
  python social_poster.py --date 2026-09-20   # force a specific date
"""

import argparse
import base64
import datetime as dt
import json
import os
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path

HERE = Path(__file__).parent
QUEUE_FILE = HERE / "content_queue.json"
STATE_FILE = HERE / "posted_state.json"

UA = os.environ.get("POSTER_UA", "Bargain-SocialPoster/1.0")


def _http(url: str, method: str = "GET", headers: dict | None = None,
          data: dict | bytes | None = None, form: bool = False,
          resp_headers: dict | None = None) -> tuple[int, dict]:
    hdrs = {"User-Agent": UA, **(headers or {})}
    body = None
    if data is not None:
        if isinstance(data, bytes):
            body = data
        elif form:
            body = urllib.parse.urlencode(data).encode()
            hdrs["Content-Type"] = "application/x-www-form-urlencoded"
        else:
            body = json.dumps(data).encode()
            hdrs["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            if resp_headers is not None:
                resp_headers.update(resp.headers)
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as exc:
        if resp_headers is not None:
            resp_headers.update(exc.headers or {})
        try:
            err_body = json.loads(exc.read().decode() or "{}")
        except Exception:  # noqa: BLE001
            err_body = {}
        return exc.code, err_body
    except Exception as exc:  # noqa: BLE001
        return 0, {"error": str(exc)}


def _http_multipart(url: str, file_field: str, file_path: Path,
                    fields: dict | None = None, headers: dict | None = None,
                    mime: str = "image/png") -> tuple[int, dict]:
    """Minimal multipart/form-data POST — one file + optional text fields.
    urllib has no multipart support, so we build the body by hand."""
    boundary = "bargainposter" + base64.b16encode(os.urandom(8)).decode().lower()
    parts: list[bytes] = []
    for k, v in (fields or {}).items():
        parts.append(
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
        )
    parts.append(
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"{file_field}\"; "
        f"filename=\"{file_path.name}\"\r\nContent-Type: {mime}\r\n\r\n".encode()
        + file_path.read_bytes() + b"\r\n"
    )
    parts.append(f"--{boundary}--\r\n".encode())
    body = b"".join(parts)

    hdrs = {"User-Agent": UA, "Content-Type": f"multipart/form-data; boundary={boundary}",
            **(headers or {})}
    req = urllib.request.Request(url, data=body, headers=hdrs, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as exc:
        try:
            return exc.code, json.loads(exc.read().decode() or "{}")
        except Exception:  # noqa: BLE001
            return exc.code, {}
    except Exception as exc:  # noqa: BLE001
        return 0, {"error": str(exc)}


def _http_bytes(url: str, body: bytes, headers: dict | None = None,
                method: str = "POST") -> tuple[int, dict]:
    """Raw-bytes POST (Bluesky blob upload, LinkedIn image PUT)."""
    hdrs = {"User-Agent": UA, **(headers or {})}
    req = urllib.request.Request(url, data=body, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode() or "{}"
            return resp.status, json.loads(raw)
    except urllib.error.HTTPError as exc:
        try:
            return exc.code, json.loads(exc.read().decode() or "{}")
        except Exception:  # noqa: BLE001
            return exc.code, {}
    except Exception as exc:  # noqa: BLE001
        return 0, {"error": str(exc)}


# ---------------------------------------------------------------------------
# Platform adapters — each returns (ok: bool, detail: str)
# `media` is a Path to an image (usually a card_maker.py render) or None.
# ---------------------------------------------------------------------------

def post_bluesky(text: str, link: str | None, media: Path | None = None) -> tuple[bool, str]:
    handle = os.environ.get("BLUESKY_HANDLE")
    app_pw = os.environ.get("BLUESKY_APP_PASSWORD")
    if not (handle and app_pw):
        return False, "BLUESKY_HANDLE/BLUESKY_APP_PASSWORD not set"

    status, sess = _http(
        "https://bsky.social/xrpc/com.atproto.server.createSession",
        method="POST",
        data={"identifier": handle, "password": app_pw},
    )
    if status != 200:
        return False, f"auth failed: {sess}"

    # Bluesky hard-limits posts to 300 graphemes — truncate the body so
    # body + "\n\n" + link fits, leaving headroom for multi-codepoint
    # graphemes (chars != graphemes).
    limit = 280
    if link and len(text) + len(link) + 2 > limit:
        text = text[: limit - len(link) - 3].rstrip() + "…"
    elif not link and len(text) > limit:
        text = text[: limit - 1].rstrip() + "…"
    full_text = f"{text}\n\n{link}" if link else text
    record = {
        "repo": sess["did"],
        "collection": "app.bsky.feed.post",
        "record": {
            "text": full_text,
            "createdAt": dt.datetime.now(dt.timezone.utc).isoformat(),
            "$type": "app.bsky.feed.post",
        },
    }
    if link:
        # Facet so the URL renders as a link
        start = full_text.index(link)
        record["record"]["facets"] = [{
            "index": {"byteStart": len(full_text[:start].encode()), "byteEnd": len(full_text.encode())},
            "features": [{"$type": "app.bsky.richtext.facet#link", "uri": link}],
        }]

    if media:
        status, blob = _http_bytes(
            "https://bsky.social/xrpc/com.atproto.repo.uploadBlob",
            body=media.read_bytes(),
            headers={
                "Authorization": f"Bearer {sess['accessJwt']}",
                "Content-Type": "image/png",
            },
        )
        if status == 200 and blob.get("blob"):
            record["record"]["embed"] = {
                "$type": "app.bsky.embed.images",
                "images": [{"image": blob["blob"], "alt": text[:1000]}],
            }
        else:
            print(f"  WARNING: Bluesky image upload failed ({status}), posting text-only")

    status, res = _http(
        "https://bsky.social/xrpc/com.atproto.repo.createRecord",
        method="POST",
        headers={"Authorization": f"Bearer {sess['accessJwt']}"},
        data=record,
    )
    return (status == 200), (res.get("uri") or str(res))


def post_mastodon(text: str, link: str | None, poll: list | None = None, media: Path | None = None) -> tuple[bool, str]:
    instance = os.environ.get("MASTODON_INSTANCE")  # e.g. mastodon.social
    token = os.environ.get("MASTODON_ACCESS_TOKEN")
    if not (instance and token):
        return False, "MASTODON_INSTANCE/MASTODON_ACCESS_TOKEN not set"
    status_text = f"{text}\n\n{link}" if link else text
    payload: dict = {"status": status_text}
    # Mastodon supports native polls — 2–4 options, expires_in seconds
    if poll and 2 <= len(poll) <= 4:
        payload["poll"] = {"options": poll, "expires_in": 86400}
    if media:
        status, res = _http_multipart(
            f"https://{instance}/api/v2/media",
            file_field="file",
            file_path=media,
            fields={"description": text[:1500]},
            headers={"Authorization": f"Bearer {token}"},
        )
        if status == 200 and res.get("id"):
            payload["media_ids"] = [res["id"]]
        else:
            print(f"  WARNING: Mastodon image upload failed ({status}), posting text-only")
    status, res = _http(
        f"https://{instance}/api/v1/statuses",
        method="POST",
        headers={"Authorization": f"Bearer {token}"},
        data=payload,
    )
    return (status in (200, 201)), (res.get("url") or str(res))


def post_reddit(text: str, link: str | None, subreddit: str, title: str) -> tuple[bool, str]:
    client_id = os.environ.get("REDDIT_CLIENT_ID")
    client_secret = os.environ.get("REDDIT_CLIENT_SECRET")
    username = os.environ.get("REDDIT_USERNAME")
    password = os.environ.get("REDDIT_PASSWORD")
    if not all([client_id, client_secret, username, password]):
        return False, "REDDIT_* credentials not set"

    auth = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    status, tok = _http(
        "https://www.reddit.com/api/v1/access_token",
        method="POST",
        headers={"Authorization": f"Basic {auth}"},
        data={"grant_type": "password", "username": username, "password": password},
        form=True,
    )
    if status != 200 or "access_token" not in tok:
        return False, f"auth failed: {tok}"

    kind = "link" if link else "self"
    status, res = _http(
        "https://oauth.reddit.com/api/submit",
        method="POST",
        headers={"Authorization": f"Bearer {tok['access_token']}"},
        data={
            "sr": subreddit,
            "title": title,
            "kind": kind,
            "url": link or "",
            "text": text,
            "resubmit": "true",
        },
        form=True,
    )
    errors = (res.get("json") or {}).get("errors") or []
    return (status == 200 and not errors), (str(res)[:200])


def post_facebook_page(text: str, link: str | None, media: Path | None = None) -> tuple[bool, str]:
    page_id = os.environ.get("FB_PAGE_ID")
    token = os.environ.get("FB_PAGE_ACCESS_TOKEN")
    if not (page_id and token):
        return False, "FB_PAGE_ID/FB_PAGE_ACCESS_TOKEN not set"
    if media:
        # /photos puts the image inline in the feed — much more engaging
        # than a bare link post. Caption stays link-free (outbound links in
        # the body suppress reach); the link goes in a first comment below.
        status, res = _http_multipart(
            f"https://graph.facebook.com/v21.0/{page_id}/photos",
            file_field="source",
            file_path=media,
            fields={"caption": text, "access_token": token},
        )
        post_id = res.get("post_id") or res.get("id")
        if status == 200 and post_id and link:
            _http(
                f"https://graph.facebook.com/v21.0/{post_id}/comments",
                method="POST",
                data={"message": link, "access_token": token},
            )
        return (status == 200 and "id" in res), (post_id or str(res))
    payload: dict = {"message": text, "access_token": token}
    # Bump the version if Graph returns "this version is deprecated" —
    # Meta retires versions roughly every 2 years.
    status, res = _http(
        f"https://graph.facebook.com/v21.0/{page_id}/feed",
        method="POST",
        data=payload,
    )
    post_id = res.get("id")
    if status == 200 and post_id and link:
        _http(
            f"https://graph.facebook.com/v21.0/{post_id}/comments",
            method="POST",
            data={"message": link, "access_token": token},
        )
    return (status == 200 and "id" in res), (post_id or str(res))


def post_linkedin(text: str, link: str | None, media: Path | None = None, as_: str | None = None) -> tuple[bool, str]:
    token = os.environ.get("LINKEDIN_ACCESS_TOKEN")
    person_id = os.environ.get("LINKEDIN_PERSON_ID")  # opaque person ID (e.g. "oG0bEvBDaS")
    org_id = os.environ.get("LINKEDIN_ORG_ID")        # numeric org/page ID (e.g. "18359696")
    if not (token and (person_id or org_id)):
        return False, "LINKEDIN_ACCESS_TOKEN + LINKEDIN_PERSON_ID or LINKEDIN_ORG_ID not set"

    # Posts API (replaces legacy /v2/ugcPosts). Author must be
    # urn:li:person:<opaque_id> for member posts or urn:li:organization:<id>
    # for org posts. The opaque person ID is NOT the numeric member ID —
    # obtain it via GET /v2/userinfo ("sub" field) or the API error hint.
    # When LINKEDIN_ORG_ID is set we post AS the company page; the token
    # needs the w_organization_social scope and the member must be a page
    # admin, otherwise the API returns 403 AUTHORIZATION_FAILED.
    # Per-item override: queue entry sets platforms.linkedin.as = "person"
    # (founder-voice posts on the member profile) or "org" (brand posts on
    # the page). Default = org when configured, else person.
    want_org = bool(org_id) if as_ is None else (as_ == "org")
    if want_org and org_id:
        author = org_id if org_id.startswith("urn:li:") else f"urn:li:organization:{org_id}"
    elif person_id:
        author = person_id if person_id.startswith("urn:li:") else f"urn:li:person:{person_id}"
    elif org_id:
        author = org_id if org_id.startswith("urn:li:") else f"urn:li:organization:{org_id}"
    else:
        return False, "requested author identity not configured"

    content = {
        "author": author,
        # Outbound links in the post body suppress LinkedIn distribution —
        # commentary stays link-free; the link lands in a first comment
        # after the post URN comes back in x-restli-id.
        "commentary": text,
        "visibility": "PUBLIC",
        "distribution": {
            "feedDistribution": "MAIN_FEED",
            "targetEntities": [],
            "thirdPartyDistributionChannels": [],
        },
        "lifecycleState": "PUBLISHED",
        "isReshareDisabledByAuthor": False,
    }

    if media:
        # Images API: initializeUpload returns an uploadUrl, PUT the bytes,
        # then reference the image URN in the post's content.media block.
        li_headers = {
            "Authorization": f"Bearer {token}",
            "Linkedin-Version": "202510",
            "X-Restli-Protocol-Version": "2.0.0",
        }
        status, res = _http(
            "https://api.linkedin.com/rest/images?action=initializeUpload",
            method="POST",
            headers=li_headers,
            data={"initializeUploadRequest": {"owner": author}},
        )
        upload = (res.get("value") or {})
        if status == 200 and upload.get("uploadUrl") and upload.get("image"):
            # The presigned uploadUrl PUT must carry the image's real
            # Content-Type — LinkedIn 400s the upload without it.
            mime = "image/jpeg" if media.suffix.lower() in (".jpg", ".jpeg") else "image/png"
            up_status, _ = _http_bytes(
                upload["uploadUrl"],
                body=media.read_bytes(),
                headers={"Authorization": f"Bearer {token}", "Content-Type": mime},
                method="PUT",
            )
            if up_status in (200, 201):
                # Image processing is async — poll until AVAILABLE so the
                # post doesn't render without media (PROCESSING_FAILED risk).
                img_urn = upload["image"]
                for _ in range(6):
                    st, info = _http(
                        f"https://api.linkedin.com/rest/images/{urllib.parse.quote(img_urn, safe='')}",
                        headers=li_headers,
                    )
                    istatus = (info.get("status") or "").upper()
                    if st != 200 or istatus == "AVAILABLE":
                        break
                    time.sleep(5)
                content["content"] = {"media": {"id": img_urn}}
            else:
                print(f"  WARNING: LinkedIn image PUT failed ({up_status}), posting text-only")
        else:
            print(f"  WARNING: LinkedIn image init failed ({status}), posting text-only")

    # The Posts API returns 201 with an EMPTY body — the created post URN
    # only comes back in the x-restli-id response header. Capture it so
    # posted_state.json records a real ref instead of "{}".
    resp_headers: dict = {}
    status, res = _http(
        "https://api.linkedin.com/rest/posts",
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Linkedin-Version": "202510",
            "X-Restli-Protocol-Version": "2.0.0",
        },
        data=content,
        resp_headers=resp_headers,
    )
    urn = resp_headers.get("x-restli-id") or resp_headers.get("X-Restli-Id")
    if status in (200, 201) and urn and link:
        # First comment carries the CTA link so the post body stays clean.
        encoded = urllib.parse.quote(urn, safe="")
        _http(
            f"https://api.linkedin.com/rest/socialActions/{encoded}/comments",
            method="POST",
            headers={
                "Authorization": f"Bearer {token}",
                "Linkedin-Version": "202510",
                "X-Restli-Protocol-Version": "2.0.0",
            },
            data={"actor": author, "message": {"text": link}},
        )
    return (status in (200, 201)), (urn or res.get("id") or str(res))


NEXTDOOR_API = "https://nextdoor.com/external/api/partner/v1"
NEXTDOOR_TOKEN_URL = "https://auth.nextdoor.com/v2/token"
NEXTDOOR_SCOPES = "openid post:write post:read profile"


def _nextdoor_token() -> tuple[str | None, str]:
    """Return (access_token, error). Prefers a stored access token (Nextdoor
    tokens are long-lived — ~1yr); falls back to the refresh_token grant."""
    at = os.environ.get("NEXTDOOR_ACCESS_TOKEN")
    if at:
        return at, ""
    cid = os.environ.get("NEXTDOOR_CLIENT_ID")
    cs = os.environ.get("NEXTDOOR_CLIENT_SECRET")
    rt = os.environ.get("NEXTDOOR_REFRESH_TOKEN")
    if not all([cid, cs, rt]):
        return None, "NEXTDOOR_ACCESS_TOKEN or NEXTDOOR_CLIENT_ID/NEXTDOOR_CLIENT_SECRET/NEXTDOOR_REFRESH_TOKEN not set"
    basic = base64.b64encode(f"{cid}:{cs}".encode()).decode()
    status, res = _http(
        NEXTDOOR_TOKEN_URL,
        method="POST",
        headers={"Authorization": f"Basic {basic}"},
        data={"grant_type": "refresh_token", "refresh_token": rt, "scope": NEXTDOOR_SCOPES},
        form=True,
    )
    if status != 200 or not res.get("access_token"):
        return None, f"token refresh failed ({status}): {res}"
    new_rt = res.get("refresh_token")
    if new_rt and new_rt != rt:
        # Never print the token itself — CI logs are not a secret store.
        print("  WARNING: Nextdoor rotated the refresh token — re-run "
              "nextdoor_auth.py refresh and update the NEXTDOOR_REFRESH_TOKEN secret.")
    return res["access_token"], ""


def _nextdoor_profile_id(token: str) -> str | None:
    """Business profile to post as. NEXTDOOR_PROFILE_ID wins; otherwise
    auto-discover the account's business profile via /me/profiles."""
    pid = os.environ.get("NEXTDOOR_PROFILE_ID")
    if pid:
        return pid
    status, res = _http(
        f"{NEXTDOOR_API}/me/profiles",
        headers={"Authorization": f"Bearer {token}"},
    )
    if status != 200:
        return None
    for p in res.get("profile_list") or []:
        if p.get("is_business_profile"):
            return p.get("id")
    return res.get("primary_profile_id")


def post_nextdoor(text: str, link: str | None) -> tuple[bool, str]:
    token, err = _nextdoor_token()
    if not token:
        return False, err
    body: dict = {"body_text": text[:8192], "hashtag": "BargainHuntrs"}
    if link:
        body["smartlink_url"] = link  # renders a link preview card
    pid = _nextdoor_profile_id(token)
    if pid:
        body["secure_profile_id"] = pid  # post as the BargainHuntrs page
    status, res = _http(
        f"{NEXTDOOR_API}/post/create/",
        method="POST",
        headers={"Authorization": f"Bearer {token}"},
        data=body,
    )
    ok = status == 200 and res.get("result") == "success"
    return ok, (res.get("share_link") or str(res))


def _tumblr_token() -> tuple[str | None, str]:
    """Return (access_token, error). Prefers a stored access token; falls
    back to the refresh_token grant (Tumblr access tokens expire ~1hr)."""
    at = os.environ.get("TUMBLR_ACCESS_TOKEN")
    if at:
        return at, ""
    cid = os.environ.get("TUMBLR_CLIENT_ID")
    cs = os.environ.get("TUMBLR_CLIENT_SECRET")
    rt = os.environ.get("TUMBLR_REFRESH_TOKEN")
    if not all([cid, cs, rt]):
        return None, "TUMBLR_ACCESS_TOKEN or TUMBLR_CLIENT_ID/TUMBLR_CLIENT_SECRET/TUMBLR_REFRESH_TOKEN not set"
    basic = base64.b64encode(f"{cid}:{cs}".encode()).decode()
    status, res = _http(
        "https://api.tumblr.com/v2/oauth2/token",
        method="POST",
        headers={"Authorization": f"Basic {basic}"},
        data={"grant_type": "refresh_token", "refresh_token": rt},
        form=True,
    )
    if status != 200 or not res.get("access_token"):
        return None, f"token refresh failed ({status}): {res}"
    new_rt = res.get("refresh_token")
    if new_rt and new_rt != rt:
        # Never print the token itself — CI logs are not a secret store.
        print("  WARNING: Tumblr rotated the refresh token — re-run "
              "tumblr_auth.py and update TUMBLR_REFRESH_TOKEN.")
    return res["access_token"], ""


def post_tumblr(text: str, link: str | None) -> tuple[bool, str]:
    """NPF text post (+ link card) to the BargainHuntrs blog. Text-only —
    cards live on the platforms that render media."""
    token, err = _tumblr_token()
    if not token:
        return False, err
    blog = os.environ.get("TUMBLR_BLOG", "bargainhuntrs")
    content = [{"type": "text", "text": text}]
    if link:
        content.append({"type": "link", "url": link, "display_url": link})
    status, res = _http(
        f"https://api.tumblr.com/v2/blog/{blog}/posts",
        method="POST",
        headers={"Authorization": f"Bearer {token}"},
        data={"content": content},
    )
    ok = status == 201 and bool((res.get("response") or {}).get("id"))
    return ok, str((res.get("response") or {}).get("id") or res)


def _x_oauth_header(ck: str, cs: str, at: str, ats: str, method: str, url: str) -> str:
    """HMAC-SHA1 OAuth 1.0a header for a request with a non-form body."""
    import hashlib
    import hmac
    import secrets
    import time as _time

    oauth_params = {
        "oauth_consumer_key": ck,
        "oauth_nonce": secrets.token_hex(16),
        "oauth_signature_method": "HMAC-SHA1",
        "oauth_timestamp": str(int(_time.time())),
        "oauth_token": at,
        "oauth_version": "1.0",
    }
    param_str = "&".join(
        f"{urllib.parse.quote(k, safe='')}={urllib.parse.quote(v, safe='')}"
        for k, v in sorted(oauth_params.items())
    )
    base = f"{method}&{urllib.parse.quote(url, safe='')}&{urllib.parse.quote(param_str, safe='')}"
    signing_key = f"{urllib.parse.quote(cs, safe='')}&{urllib.parse.quote(ats, safe='')}"
    oauth_params["oauth_signature"] = base64.b64encode(
        hmac.new(signing_key.encode(), base.encode(), hashlib.sha1).digest()
    ).decode()
    return "OAuth " + ", ".join(
        f'{urllib.parse.quote(k, safe="")}="{urllib.parse.quote(v, safe="")}"'
        for k, v in sorted(oauth_params.items())
    )


def post_x(text: str, link: str | None, poll: list | None = None, media: Path | None = None) -> tuple[bool, str]:
    # OAuth 1.0a user context — free tier, write-only
    ck = os.environ.get("X_API_KEY")
    cs = os.environ.get("X_API_SECRET")
    at = os.environ.get("X_ACCESS_TOKEN")
    ats = os.environ.get("X_ACCESS_TOKEN_SECRET")
    if not all([ck, cs, at, ats]):
        return False, "X_* credentials not set"

    full_text = f"{text}\n\n{link}" if link else text
    url = "https://api.twitter.com/2/tweets"
    auth_header = _x_oauth_header(ck, cs, at, ats, "POST", url)

    tweet: dict = {"text": full_text}
    # X v2 supports native polls — 2–4 options, duration in minutes (max 10080)
    if poll and 2 <= len(poll) <= 4:
        tweet["poll"] = {"options": poll, "duration_minutes": 1440}

    if media:
        # Media upload lives on upload.twitter.com (v1.1) — separate host,
        # separate signature. Multipart 'media' field, returns media_id_string.
        up_url = "https://upload.twitter.com/1.1/media/upload.json"
        up_header = _x_oauth_header(ck, cs, at, ats, "POST", up_url)
        status, res = _http_multipart(
            up_url,
            file_field="media",
            file_path=media,
            headers={"Authorization": up_header},
        )
        mid = res.get("media_id_string") or res.get("media_id")
        if status in (200, 201) and mid:
            tweet["media"] = {"media_ids": [str(mid)]}
        else:
            print(f"  WARNING: X media upload failed ({status}), posting text-only")

    status, res = _http(
        url,
        method="POST",
        headers={"Authorization": auth_header},
        data=tweet,
    )
    return (status == 201), (str(res)[:200])


BUFFER_GQL = "https://api.buffer.com"


def _buffer_gql(token: str, query: str, variables: dict | None = None) -> dict:
    _, res = _http(
        BUFFER_GQL,
        method="POST",
        headers={"Authorization": f"Bearer {token}"},
        data={"query": query, "variables": variables or {}},
    )
    return res if isinstance(res, dict) else {}


def buffer_fit_text(text: str, link: str | None, service: str) -> str:
    """X enforces 280 chars; the other Buffer channels allow long posts.
    For twitter/x channels trim the body at a word boundary and keep the
    link (it carries the CTA) so the whole post lands <= 280."""
    full = f"{text}\n\n{link}" if link else text
    if service not in ("twitter", "x") or len(full) <= 280:
        return full
    suffix = f"…\n\n{link}" if link else "…"
    budget = 280 - len(suffix)
    head = text[:budget]
    cut = head.rsplit(" ", 1)[0].rstrip() if " " in head else head
    return f"{cut}{suffix}"


def post_buffer(text: str, link: str | None, *_args) -> tuple[bool, str]:
    """Publish via Buffer's GraphQL API to every connected channel (X, FB,
    IG, LinkedIn — whatever the Buffer org has linked). mode=shareNow: the
    daily cron already handles scheduling, so Buffer is just the publisher.

    Env:
      BUFFER_ACCESS_TOKEN  — public API token (buffer.com → Settings → API)
      BUFFER_ORG_ID        — optional; defaults to first organization
      BUFFER_CHANNEL_IDS   — optional CSV; default posts to ALL connected
                             channels (isDisconnected channels are skipped)
    """
    token = os.environ.get("BUFFER_ACCESS_TOKEN")
    if not token:
        return False, "BUFFER_ACCESS_TOKEN not set"

    org_id = os.environ.get("BUFFER_ORG_ID")
    if not org_id:
        res = _buffer_gql(token, "{ account { organizations { id } } }")
        orgs = (((res.get("data") or {}).get("account") or {}).get("organizations")) or []
        org_id = orgs[0]["id"] if orgs else None
    if not org_id:
        return False, "no Buffer organization found"

    res = _buffer_gql(
        token,
        '{ channels(input: {organizationId: "%s"}) { id name service isDisconnected } }' % org_id,
    )
    channels = [c for c in ((res.get("data") or {}).get("channels") or []) if not c.get("isDisconnected")]
    allow = {c.strip() for c in os.environ.get("BUFFER_CHANNEL_IDS", "").split(",") if c.strip()}
    targets = [c for c in channels if not allow or c.get("id") in allow]
    if not targets:
        return False, "no Buffer channels connected (link X/FB/etc in Buffer dashboard)"

    mutation = (
        "mutation($input: CreatePostInput!) { createPost(input: $input) { __typename "
        "... on PostActionSuccess { post { id } } "
        "... on InvalidInputError { message } ... on LimitReachedError { message } "
        "... on UnauthorizedError { message } ... on UnexpectedError { message } } }"
    )
    posted, errs = [], []
    for ch in targets:
        # FB is covered by the direct post_facebook_page path — Buffer's
        # createPost rejects facebook channels without a channel-specific
        # post type the public schema doesn't expose cleanly.
        if ch.get("service") == "facebook":
            continue
        res = _buffer_gql(token, mutation, {"input": {
            "channelId": ch["id"],
            "text": buffer_fit_text(text, link, ch.get("service") or ""),
            "mode": "shareNow",
            "schedulingType": "automatic",
            "needsApproval": False,
            "assets": [],
        }})
        r = (res.get("data") or {}).get("createPost") or {}
        if r.get("__typename") == "PostActionSuccess":
            posted.append(f"{ch.get('service')}:{(r.get('post') or {}).get('id')}")
        else:
            errs.append(f"{ch.get('service')}:{r.get('message') or res.get('errors') or r}")
    if posted:
        tail = f" (failed: {'; '.join(errs)})" if errs else ""
        return True, "; ".join(posted) + tail
    return False, "; ".join(errs) or "Buffer createPost failed"


# ---------------------------------------------------------------------------

def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {}


def save_state(state: dict) -> None:
    # Drop empty per-date entries — they only exist when every platform was
    # skipped/failed, and keeping them writes junk like {"2026-09-16": {}}.
    state = {d: v for d, v in state.items() if v}
    STATE_FILE.write_text(json.dumps(state, indent=2))


def main() -> None:
    p = argparse.ArgumentParser(description="Post queued content to social platforms")
    p.add_argument("--queue", default=str(QUEUE_FILE))
    p.add_argument("--date", help="Force post for this date (YYYY-MM-DD)")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    queue = json.loads(Path(args.queue).read_text())
    state = load_state()
    today = args.date or str(dt.date.today())

    platforms = {
        "bluesky": post_bluesky,
        "mastodon": post_mastodon,
        "facebook": post_facebook_page,
        "linkedin": post_linkedin,
        "nextdoor": post_nextdoor,
        "tumblr": post_tumblr,
        "x": post_x,
        "buffer": post_buffer,
    }

    # Post only the most recent due item — never backfill the whole queue at
    # once (30 posts in one run would get accounts flagged as spam).
    def expected(item):
        plats = set(platforms)
        if (item.get("platforms") or {}).get("reddit"):
            plats.add("reddit")
        return plats

    due = sorted(
        (item for item in queue
         if item["date"] <= today
         and expected(item) - set(state.get(item["date"], {}))),
        key=lambda i: i["date"],
    )[-1:]
    if not due:
        print("Nothing due today.")
        return

    sent = skipped = failed = 0
    for item in due:
        text = item["text"]
        link = item.get("link")
        item_state = state.setdefault(item["date"], {})

        # Image for this post: explicit "image" field wins, else the
        # auto-rendered card for this date from card_maker.py.
        media: Path | None = None
        if item.get("image"):
            cand = HERE / item["image"]
            media = cand if cand.exists() else None
        else:
            cand = HERE / "cards" / f"{item['date']}.png"
            media = cand if cand.exists() else None

        for name, fn in platforms.items():
            if item_state.get(name):
                continue  # already posted
            override = (item.get("platforms") or {}).get(name) or {}
            ptext = override.get("text", text)
            plink = override.get("link", link)
            # Native polls only supported on X + Mastodon; other platforms
            # just get the question text.
            poll = item.get("poll") if name in ("x", "mastodon") else None
            # Nextdoor/Reddit stay text-only (smartlink preview covers ND).
            use_media = media if name in ("bluesky", "mastodon", "facebook", "linkedin", "x") else None

            if args.dry_run:
                tag = " [poll]" if poll else ""
                tag += " [img]" if use_media else ""
                print(f"  [dry-run] {item['date']} {name}{tag}: {ptext[:70]}…")
                sent += 1
                continue

            if name in ("x", "mastodon"):
                ok, detail = fn(ptext, plink, poll, use_media)
            elif name == "linkedin":
                ok, detail = fn(ptext, plink, use_media, override.get("as"))
            elif name in ("bluesky", "facebook"):
                ok, detail = fn(ptext, plink, use_media)
            else:
                ok, detail = fn(ptext, plink)
            if ok:
                print(f"  posted {item['date']} → {name}: {detail}")
                item_state[name] = {"at": str(dt.datetime.now()), "ref": detail}
                sent += 1
            else:
                # Credentials missing vs. real failure
                if "not set" in detail:
                    skipped += 1
                else:
                    print(f"  FAILED {name}: {detail}")
                    failed += 1
            if not args.dry_run:
                save_state(state)

        # Reddit is special-cased (title + subreddit)
        reddit_cfg = (item.get("platforms") or {}).get("reddit")
        if reddit_cfg and not item_state.get("reddit"):
            subreddit = reddit_cfg.get("subreddit") or "bargainhuntrs"
            title = reddit_cfg.get("title") or text.split("\n")[0][:290]
            if args.dry_run:
                print(f"  [dry-run] {item['date']} reddit r/{subreddit}: {title[:60]}")
                sent += 1
            else:
                ok, detail = post_reddit(text, link, subreddit, title)
                if ok:
                    print(f"  posted {item['date']} → reddit: {detail}")
                    item_state["reddit"] = {"at": str(dt.datetime.now()), "ref": detail}
                    sent += 1
                elif "not set" in detail:
                    skipped += 1
                else:
                    print(f"  FAILED reddit: {detail}")
                    failed += 1
            if not args.dry_run:
                save_state(state)

    print(f"\nDone: {sent} posted, {skipped} skipped (no creds), {failed} failed")


if __name__ == "__main__":
    sys.exit(main())
