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
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
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
from app.db.models import User
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

    options = generate_registration_options(
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
    _registration_challenges[str(user_id)] = options.challenge

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

    challenge = _registration_challenges.pop(str(user_id), None)
    if challenge is None:
        raise ValueError("No pending registration challenge. Start registration again.")

    verified = verify_registration_response(
        credential=credential,
        expected_challenge=challenge,
        expected_rp_id=_rp_id(),
        expected_origin=_origin(),
    )

    # Store the credential on the user.
    user.credential_id = bytes_to_base64url(verified.credential_id)
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
        options = generate_authentication_options(rp_id=_rp_id())
        _authentication_challenges[email] = options.challenge
        return options_to_json(options)

    allow_credentials: list[PublicKeyCredentialDescriptor] = []
    if user.credential_id:
        allow_credentials.append(
            PublicKeyCredentialDescriptor(id=base64url_to_bytes(user.credential_id))
        )

    options = generate_authentication_options(
        rp_id=_rp_id(),
        allow_credentials=allow_credentials or None,
        user_verification=UserVerificationRequirement.PREFERRED,
    )

    _authentication_challenges[email] = options.challenge
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
    challenge = _authentication_challenges.pop(email, None)
    if challenge is None:
        raise ValueError("No pending authentication challenge. Start login again.")

    # Look up the user by email to fetch their stored public key + sign count.
    user = db.query(User).filter(User.email == email).first()
    if user is None or not user.credential_id or not user.public_key:
        raise ValueError("No passkey registered for this user")

    verified = verify_authentication_response(
        credential=credential,
        expected_challenge=challenge,
        expected_rp_id=_rp_id(),
        expected_origin=_origin(),
        credential_public_key=user.public_key,
        credential_current_sign_count=user.sign_count,
    )

    # Update the stored sign count to detect cloned authenticators.
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
