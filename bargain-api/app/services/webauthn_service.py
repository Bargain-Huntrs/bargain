"""WebAuthn (passkey) integration service.

Provides registration and authentication flows using the WebAuthn protocol
so users can sign in with passkeys instead of (or in addition to) passwords.

Flows:
  Registration:
    1. generate_registration_options(user_id)  -> challenge (sent to browser)
    2. verify_registration(user_id, credential) -> stores passkey on the user
  Authentication:
    1. generate_authentication_options(email)   -> challenge (sent to browser)
    2. verify_authentication(credential)        -> returns a JWT
"""
from __future__ import annotations

import logging
from typing import Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from webauthn import (
    generate_registration_options as _gen_reg_options,
    verify_registration_response,
    generate_authentication_options as _gen_auth_options,
    verify_authentication_response,
    options_to_json,
)
from webauthn.helpers import bytes_to_base64url, base64url_to_bytes
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    AuthenticatorAttachment,
    UserVerificationRequirement,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
)

from app.core.config import settings
from app.db.models import User, WebAuthnCredential, WebAuthnChallenge
from app.db.session import engine
from datetime import datetime, timedelta
from app.routers.auth import create_access_token, create_refresh_token

logger = logging.getLogger(__name__)

# In-memory challenge store. In production this should be replaced with a
# shared cache (e.g. Redis) so challenges survive across processes/servers.
_registration_challenges: dict[str, bytes] = {}
_authentication_challenges: dict[str, bytes] = {}

ACCESS_TOKEN_EXPIRE_SECONDS = 30 * 24 * 60 * 60  # 30 days


def _rp_id() -> str:
    return settings.WEB_AUTHN_RP_ID


def _rp_name() -> str:
    return settings.WEB_AUTHN_RP_NAME


def _origin() -> str:
    return settings.WEB_AUTHN_ORIGIN


def generate_registration_options(user_id: UUID, db: Session) -> str:
    """Generate WebAuthn registration options (a challenge) for a user.

    Returns the options as a JSON string ready to pass to
    `navigator.credentials.create()` on the frontend via SimpleWebAuthn.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise ValueError("User not found")

    exclude_credentials: list[PublicKeyCredentialDescriptor] = []
    if user.credential_id:
        exclude_credentials.append(
            PublicKeyCredentialDescriptor(id=base64url_to_bytes(user.credential_id))
        )

    options = _gen_reg_options(
        rp_id=_rp_id(),
        rp_name=_rp_name(),
        user_name=user.email,
        user_id=str(user.id).encode("utf-8"),
        user_display_name=user.full_name,
        authenticator_selection=AuthenticatorSelectionCriteria(
            authenticator_attachment=AuthenticatorAttachment.PLATFORM,
            resident_key=ResidentKeyRequirement.REQUIRED,
            user_verification=UserVerificationRequirement.PREFERRED,
        ),
        exclude_credentials=exclude_credentials or None,
    )

    # Store the challenge for verification in the next step.
    _store_challenge(db, f'reg:{user_id}', options.challenge)

    return options_to_json(options)


def verify_registration(user_id: UUID, credential: str, db: Session) -> dict[str, Any]:
    """Verify a WebAuthn registration response and store the passkey on the user.

    Args:
        user_id: The internal user ID.
        credential: The registration credential JSON returned by the browser.
        db: SQLAlchemy session.

    Returns:
        Dict describing the stored credential.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise ValueError("User not found")

    challenge = _pop_challenge(db, f'reg:{user_id}')
    if challenge is None:
        raise ValueError("No pending registration challenge. Start registration again.")

    verified = verify_registration_response(
        credential=credential,
        expected_challenge=challenge,
        expected_rp_id=_rp_id(),
        expected_origin=_origin(),
    )

    # Store per-device credential row; keep legacy user.* cols synced (the
    # latest credential) for any surface still reading them.
    cred_id_b64 = bytes_to_base64url(verified.credential_id)
    _ensure_tables(db)
    db.add(WebAuthnCredential(
        user_id=user.id,
        credential_id=cred_id_b64,
        public_key=bytes(verified.credential_public_key),
        sign_count=verified.sign_count,
        aaguid=str(verified.aaguid) if getattr(verified, "aaguid", None) else None,
        transports=[t.value for t in (verified.transports or [])] if getattr(verified, "transports", None) else None,
        backed_up=bool(getattr(verified, "credential_backed_up", False)),
    ))
    user.credential_id = cred_id_b64
    user.public_key = verified.credential_public_key
    user.sign_count = verified.sign_count
    user.aaguid = str(verified.aaguid) if getattr(verified, "aaguid", None) else None
    db.commit()

    logger.info("Passkey registered for user %s", user.id)
    return {
        "verified": True,
        "credential_id": user.credential_id,
        "aaguid": user.aaguid,
    }


def generate_authentication_options(email: str, db: Session) -> str:
    """Generate WebAuthn authentication options (a challenge) for a user.

    Returns the options as a JSON string ready to pass to
    `navigator.credentials.get()` on the frontend via SimpleWebAuthn.
    """
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        # Don't leak whether the email exists — return generic options.
        options = _gen_auth_options(rp_id=_rp_id())
        _store_challenge(db, f'auth:{email}', options.challenge)
        return options_to_json(options)

    _ensure_tables(db)
    seen = set()
    allow_credentials: list[PublicKeyCredentialDescriptor] = []
    for row in db.query(WebAuthnCredential).filter(WebAuthnCredential.user_id == user.id).all():
        seen.add(row.credential_id)
        allow_credentials.append(PublicKeyCredentialDescriptor(id=base64url_to_bytes(row.credential_id)))
    if user.credential_id and user.credential_id not in seen:
        allow_credentials.append(
            PublicKeyCredentialDescriptor(id=base64url_to_bytes(user.credential_id))
        )

    options = _gen_auth_options(
        rp_id=_rp_id(),
        allow_credentials=allow_credentials or None,
        user_verification=UserVerificationRequirement.PREFERRED,
    )

    _store_challenge(db, f'auth:{email}', options.challenge)
    return options_to_json(options)


def verify_authentication(credential: str, email: str, db: Session) -> dict[str, Any]:
    """Verify a WebAuthn authentication response and return a JWT.

    Args:
        credential: The authentication credential JSON returned by the browser.
        email: The email used to start the authentication flow.
        db: SQLAlchemy session.

    Returns:
        Dict containing access/refresh tokens and the user, mirroring the
        password login response shape.
    """
    challenge = _pop_challenge(db, f'auth:{email}')
    if challenge is None:
        raise ValueError("No pending authentication challenge. Start login again.")

    # Look up the user by email to fetch their stored public key + sign count.
    user = db.query(User).filter(User.email == email).first()
    if user is None or not user.credential_id or not user.public_key:
        raise ValueError("No passkey registered for this user")

    # Resolve which credential was asserted — per-device row if present,
    # legacy user.* columns otherwise.
    import json as _json
    cred_json = _json.loads(credential) if isinstance(credential, str) else credential
    asserted_id = cred_json.get("id")
    cred_row = None
    _ensure_tables(db)
    if asserted_id:
        cred_row = db.query(WebAuthnCredential).filter(
            WebAuthnCredential.credential_id == asserted_id,
            WebAuthnCredential.user_id == user.id,
        ).first()
    public_key = bytes(cred_row.public_key) if cred_row else user.public_key
    sign_count = cred_row.sign_count if cred_row else (user.sign_count or 0)
    if not public_key:
        raise ValueError("No passkey registered for this user")

    verified = verify_authentication_response(
        credential=credential,
        expected_challenge=challenge,
        expected_rp_id=_rp_id(),
        expected_origin=_origin(),
        credential_public_key=public_key,
        credential_current_sign_count=sign_count,
    )

    # Update the stored sign count to detect cloned authenticators.
    if cred_row:
        cred_row.sign_count = verified.new_sign_count
        cred_row.last_used_at = datetime.utcnow()
    user.sign_count = verified.new_sign_count
    db.commit()

    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))
    user.refresh_token = refresh_token
    db.commit()

    logger.info("Passkey login succeeded for user %s", user.id)
    return {
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "expiresIn": ACCESS_TOKEN_EXPIRE_SECONDS,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "firstName": user.first_name,
            "lastName": user.last_name,
            "role": user.role,
        },
    }
