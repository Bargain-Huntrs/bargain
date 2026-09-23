import random
import string
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import bcrypt
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.config import settings
from app.db.session import get_db
from app.db.models import User, ReferralClaim
from app.services.niche_service import get_all_niches, get_niche
from app.services.email_service import send_welcome_email, send_password_reset_email, send_verification_email

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
security = HTTPBearer(auto_error=False)

ACCESS_TOKEN_EXPIRE_SECONDS = 60 * 60  # 1 hour (was 30 days — too long)
REFRESH_TOKEN_EXPIRE_DAYS = 14  # 14 days (was 60)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    firstName: str
    lastName: str
    phoneNumber: str
    phoneIdToken: str | None = None  # Firebase ID token proving phone ownership
    referralCode: str | None = None

    @field_validator("firstName", "lastName")
    @classmethod
    def validate_name(cls, v):
        v = v.strip()
        if not v or len(v) > 100:
            raise ValueError("First and last name are required (max 100 chars)")
        return v

    @field_validator("phoneNumber")
    @classmethod
    def validate_phone(cls, v):
        v = (v or "").strip()
        import re
        if not re.fullmatch(r"\+[1-9]\d{6,14}", v):
            raise ValueError("Phone number must be in E.164 format (e.g. +15551234567)")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v) > 128:
            raise ValueError("Password must be at most 128 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenRequest(BaseModel):
    token: str


class UpdateNichePreferences(BaseModel):
    subscribed_niches: list[str] = []


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def _generate_referral_code(length: int = 8) -> str:
    """Generate a short, unique alphanumeric referral code."""
    alphabet = string.ascii_uppercase + string.digits
    return "".join(random.choices(alphabet, k=length))


def _compute_aura_tier(points: int) -> str:
    """Compute Aura tier from total points."""
    from app.routers.community import AURA_TIERS
    for threshold, tier in AURA_TIERS:
        if points >= threshold:
            return tier
    return "hunter"


# Aura rewards for successful referrals
AURA_REFERRER_BONUS = 100
AURA_REFEREE_BONUS = 50


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(seconds=ACCESS_TOKEN_EXPIRE_SECONDS)
    to_encode = {"sub": str(user_id), "exp": expire}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {"sub": str(user_id), "type": "refresh", "exp": expire}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")

    try:
        payload = jwt.decode(credentials.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None or payload.get("type") == "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(User).filter(User.id == UUID(user_id)).first()
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


@router.post("/register")
async def register(body: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User with this email already exists")

    # Verify phone via Firebase if an ID token was provided
    phone_number = body.phoneNumber
    phone_verified = False
    if body.phoneIdToken:
        verified_phone = _verify_firebase_phone_token(body.phoneIdToken)
        if not verified_phone:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Phone verification failed — please verify your number again")
        if phone_number and verified_phone != phone_number:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verified phone number doesn't match the number entered")
        phone_number = verified_phone
        phone_verified = True
        # Reject if another account already owns this verified number
        if db.query(User).filter(User.phone_number == phone_number, User.phone_verified == True).first():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That phone number is already linked to another account")

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        first_name=body.firstName,
        last_name=body.lastName,
        phone_number=phone_number,
        phone_verified=phone_verified,
        email_verified=False,
    )
    db.add(user)
    db.flush()  # Get user.id before commit

    # Generate a unique referral code for the new user
    for _ in range(20):
        code = _generate_referral_code()
        if not db.query(User).filter(User.referral_code == code).first():
            user.referral_code = code
            break
    if not user.referral_code:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to generate referral code")

    # Process optional referral code used during signup
    if body.referralCode:
        ref_code = body.referralCode.strip().upper()
        if ref_code == user.referral_code:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You can't use your own referral code")

        referrer = db.query(User).filter(
            func.upper(User.referral_code) == ref_code,
            User.is_active == True,
        ).first()
        if not referrer:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid referral code")

        user.referred_by = referrer.id
        user.aura_points = (user.aura_points or 0) + AURA_REFEREE_BONUS
        user.aura_tier = _compute_aura_tier(user.aura_points)

        referrer.referral_count = (referrer.referral_count or 0) + 1
        referrer.aura_points = (referrer.aura_points or 0) + AURA_REFERRER_BONUS
        referrer.aura_tier = _compute_aura_tier(referrer.aura_points)

        claim = ReferralClaim(
            referrer_id=referrer.id,
            referee_id=user.id,
            referral_code=referrer.referral_code,
            points_awarded=AURA_REFERRER_BONUS,
        )
        db.add(claim)

    db.commit()
    db.refresh(user)

    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))
    user.refresh_token = refresh_token
    db.commit()

    # Send welcome + verification emails (non-blocking, fail silently)
    send_welcome_email(user.email, user.first_name)
    send_verification_email(user.email, _make_email_verify_token(user.id), user.first_name)

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
            "phoneNumber": user.phone_number,
            "emailVerified": user.email_verified,
            "phoneVerified": user.phone_verified,
        },
    }


def _make_email_verify_token(user_id) -> str:
    return jwt.encode(
        {"sub": str(user_id), "type": "email_verify", "exp": datetime.now(timezone.utc) + timedelta(hours=24)},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def _verify_firebase_phone_token(id_token: str) -> str | None:
    """Verify a Firebase ID token and return its verified E.164 phone number, or None."""
    try:
        from app.services.firebase_service import _init_firebase
        app = _init_firebase()
        if not app:
            return None
        from firebase_admin import auth as fb_auth
        decoded = fb_auth.verify_id_token(id_token, app=app)
        return decoded.get("phone_number") or (decoded.get("firebase", {}).get("identities", {}).get("phone", [None])[0])
    except Exception:
        return None


class VerifyEmailRequest(BaseModel):
    token: str


@router.post("/verify-email")
async def verify_email(body: VerifyEmailRequest, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(body.token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "email_verify":
            raise HTTPException(status_code=400, detail="Invalid verification link")
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=400, detail="Verification link is invalid or expired — request a new one")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="Account not found")

    user.email_verified = True
    db.commit()
    return {"success": True, "message": "Email verified"}


@router.post("/resend-verification")
async def resend_verification(current_user: User = Depends(get_current_user)):
    if current_user.email_verified:
        return {"success": True, "message": "Email already verified"}
    send_verification_email(current_user.email, _make_email_verify_token(current_user.id), current_user.first_name)
    return {"success": True, "message": "Verification email sent"}


class VerifyPhoneRequest(BaseModel):
    idToken: str


@router.post("/verify-phone")
async def verify_phone(
    body: VerifyPhoneRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Verify a phone number via a Firebase Phone Auth ID token."""
    phone = _verify_firebase_phone_token(body.idToken)
    if not phone:
        raise HTTPException(status_code=400, detail="Phone verification failed — try again")

    conflict = db.query(User).filter(
        User.phone_number == phone,
        User.phone_verified == True,
        User.id != current_user.id,
    ).first()
    if conflict:
        raise HTTPException(status_code=409, detail="That phone number is already linked to another account")

    current_user.phone_number = phone
    current_user.phone_verified = True
    db.commit()
    return {"success": True, "phoneNumber": phone, "phoneVerified": True}


@router.post("/login")
async def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if user is None or not user.is_active or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))
    user.refresh_token = refresh_token

    # Daily login streak + Aura bonus
    now = datetime.now(timezone.utc)
    aura_bonus = 0
    if user.last_login_at:
        from datetime import timedelta as _td
        days_since = (now.replace(tzinfo=None) - user.last_login_at.replace(tzinfo=None) if user.last_login_at.tzinfo else user.last_login_at).days
        if days_since == 1:
            user.login_streak = (user.login_streak or 0) + 1
            # Aura bonus: 5 pts per day, capped at 50 for 10-day streak
            aura_bonus = min(5 * user.login_streak, 50)
        elif days_since > 1:
            user.login_streak = 1
            aura_bonus = 5
    else:
        user.login_streak = 1
        aura_bonus = 5

    if aura_bonus > 0:
        user.aura_points = (user.aura_points or 0) + aura_bonus
        # Recompute tier
        from app.routers.community import _compute_aura_tier
        user.aura_tier = _compute_aura_tier(user.aura_points)

    user.last_login_at = now.replace(tzinfo=None)
    db.commit()

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
            "phoneNumber": user.phone_number,
            "emailVerified": user.email_verified,
            "phoneVerified": user.phone_verified,
        },
        "auraBonus": aura_bonus,
        "loginStreak": user.login_streak,
    }


@router.get("/profile")
async def profile(current_user: User = Depends(get_current_user)):
    return {
        "success": True,
        "id": str(current_user.id),
        "email": current_user.email,
        "firstName": current_user.first_name,
        "lastName": current_user.last_name,
        "role": current_user.role,
        "subscriptionTier": current_user.subscription_tier,
        "subscribedNiches": current_user.subscribed_niches or [],
        "phoneNumber": current_user.phone_number,
        "emailVerified": current_user.email_verified,
        "phoneVerified": current_user.phone_verified,
    }


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    """Alias for /profile that the frontend calls as /api/v1/auth/me."""
    return {
        "success": True,
        "id": str(current_user.id),
        "email": current_user.email,
        "firstName": current_user.first_name,
        "lastName": current_user.last_name,
        "role": current_user.role,
        "subscriptionTier": current_user.subscription_tier,
        "subscribedNiches": current_user.subscribed_niches or [],
        "phoneNumber": current_user.phone_number,
        "emailVerified": current_user.email_verified,
        "phoneVerified": current_user.phone_verified,
    }


class UpdateMeRequest(BaseModel):
    firstName: str | None = None
    lastName: str | None = None

    @field_validator("firstName", "lastName")
    @classmethod
    def validate_name(cls, v):
        if v is None:
            return v
        v = v.strip()
        if not v or len(v) > 100:
            raise ValueError("Names must be 1-100 characters")
        return v


@router.put("/me")
async def update_me(
    body: UpdateMeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update profile fields (first/last name)."""
    if body.firstName is not None:
        current_user.first_name = body.firstName
    if body.lastName is not None:
        current_user.last_name = body.lastName
    db.commit()
    return {"success": True, "firstName": current_user.first_name, "lastName": current_user.last_name}


@router.get("/me/niches")
async def get_my_niches(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the current user's niche subscriptions and all available niches."""
    available = [
        {
            "key": n.key,
            "name": n.display_name,
            "emoji": n.emoji,
            "description": n.description,
            "typical_margin": n.typical_margin,
        }
        for n in get_all_niches()
    ]
    return {
        "subscribed_niches": current_user.subscribed_niches or [],
        "available_niches": available,
    }


@router.put("/me/niches")
async def update_my_niches(
    body: UpdateNichePreferences,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the current user's niche subscriptions.

    Send an empty list to subscribe to all niches (no filter).
    Only valid niche keys are accepted; unknown keys are rejected.
    """
    valid_keys = {n.key for n in get_all_niches()}
    invalid = [k for k in body.subscribed_niches if k not in valid_keys]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown niche(s): {', '.join(invalid)}",
        )

    current_user.subscribed_niches = list(body.subscribed_niches)
    db.commit()
    db.refresh(current_user)

    return {
        "success": True,
        "subscribed_niches": current_user.subscribed_niches or [],
    }


class UpdatePhone(BaseModel):
    phone_number: str


@router.put("/me/phone")
async def update_phone(
    body: UpdatePhone,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the current user's phone number for SMS alerts.

    Only Hunter tier users receive SMS alerts. The phone number should be
    in E.164 format (e.g. +1234567890).
    """
    phone = body.phone_number.strip() if body.phone_number else None
    if phone and not phone.startswith("+"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number must be in E.164 format (e.g. +1234567890)",
        )

    if phone != current_user.phone_number:
        current_user.phone_verified = False
    current_user.phone_number = phone
    db.commit()
    db.refresh(current_user)

    return {
        "success": True,
        "phoneNumber": current_user.phone_number,
    }


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v) > 128:
            raise ValueError("Password must be at most 128 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")
        return v


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Request a password reset link. Always returns success (don't leak if email exists)."""
    user = db.query(User).filter(User.email == body.email).first()
    if user:
        # Generate a short-lived reset token (1 hour)
        reset_token = jwt.encode(
            {"sub": str(user.id), "type": "password_reset", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )
        send_password_reset_email(user.email, reset_token, user.first_name)

    return {"success": True, "message": "If an account exists with that email, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Reset password using a valid reset token."""
    try:
        payload = jwt.decode(body.token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "password_reset":
            raise HTTPException(status_code=400, detail="Invalid reset token")
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = hash_password(body.new_password)
    # Invalidate all existing refresh tokens after password reset
    user.refresh_token = None
    db.commit()

    return {"success": True, "message": "Password reset successfully."}


@router.post("/refresh")
async def refresh(body: TokenRequest, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(body.token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(User).filter(User.id == UUID(user_id)).first()
    if user is None or not user.is_active or user.refresh_token != body.token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    access_token = create_access_token(str(user.id))
    return {"accessToken": access_token, "expiresIn": ACCESS_TOKEN_EXPIRE_SECONDS}
