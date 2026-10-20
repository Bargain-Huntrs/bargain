"""Stripe integration service.

Handles checkout session creation, webhook processing, customer management,
and subscription lifecycle for the BargainHuntrs subscription plans.

Subscription plans:
  - Free       ($0/mo)
  - Pro        ($29/mo)
  - Enterprise ($99/mo)
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

import stripe
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import User, Subscription

logger = logging.getLogger(__name__)

# Configure the Stripe API key. STRIPE_SECRET_KEY is preferred, falling back
# to STRIPE_API_KEY for backwards compatibility with existing deployments.
stripe.api_key = settings.STRIPE_SECRET_KEY or settings.STRIPE_API_KEY

# Subscription plan definitions. The Stripe price IDs are sourced from env
# vars so each environment can point to its own Stripe products.
SUBSCRIPTION_PLANS: dict[str, dict[str, Any]] = {
    "free": {
        "name": "Free",
        "price": 0,
        "interval": "month",
        "stripe_price_id": settings.STRIPE_PRICE_FREE,
    },
    "hunter": {
        "name": "Hunter",
        "price": 9.99,
        "interval": "month",
        "stripe_price_id": settings.STRIPE_PRICE_HUNTER,
    },
    "pro": {
        "name": "Pro",
        "price": 19.0,
        "interval": "month",
        "stripe_price_id": settings.STRIPE_PRICE_PRO,
    },
    "agency": {
        "name": "Agency",
        "price": 49.0,
        "interval": "month",
        "stripe_price_id": settings.STRIPE_PRICE_AGENCY,
    },
}


def _resolve_stripe_customer(user: User, db: Session) -> str:
    """Return the user's Stripe customer ID, creating one if missing."""
    if user.stripe_customer_id:
        return user.stripe_customer_id

    customer = create_customer(user.email)
    user.stripe_customer_id = customer["id"]
    db.commit()
    return user.stripe_customer_id


def create_customer(email: str) -> dict[str, Any]:
    """Create a Stripe customer for the given email address."""
    customer = stripe.Customer.create(email=email)
    return {"id": customer.id, "email": customer.email}


def create_checkout_session(user_id: UUID, plan_id: str, db: Session) -> dict[str, Any]:
    """Create a Stripe Checkout session for subscribing to a plan.

    Args:
        user_id: The internal user ID.
        plan_id: One of "free" or "hunter".
        db: SQLAlchemy session.

    Returns:
        Dict containing the checkout session URL and ID.
    """
    plan = SUBSCRIPTION_PLANS.get(plan_id)
    if plan is None:
        raise ValueError(f"Unknown plan_id: {plan_id}. Must be one of: {list(SUBSCRIPTION_PLANS)}")

    if plan["price"] == 0:
        # Free plan does not require a Stripe checkout session.
        return {"url": None, "session_id": None, "plan": plan_id, "free": True}

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise ValueError("User not found")

    customer_id = _resolve_stripe_customer(user, db)

    success_url = f"{settings.FRONTEND_URL}/billing/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{settings.FRONTEND_URL}/billing/cancel"

    session = stripe.checkout.Session.create(
        mode="subscription",
        customer=customer_id,
        line_items=[{"price": plan["stripe_price_id"], "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": str(user_id),
            "plan_id": plan_id,
        },
        subscription_data={
            "metadata": {
                "user_id": str(user_id),
                "plan_id": plan_id,
            }
        },
    )

    return {"url": session.url, "session_id": session.id, "plan": plan_id}


def cancel_subscription(subscription_id: str) -> dict[str, Any]:
    """Cancel a Stripe subscription at the end of the current period."""
    subscription = stripe.Subscription.modify(
        subscription_id,
        cancel_at_period_end=True,
    )
    return {
        "id": subscription.id,
        "status": subscription.status,
        "cancel_at_period_end": subscription.cancel_at_period_end,
    }


def _sync_subscription_record(
    db: Session,
    user: User,
    stripe_subscription: Any,
    plan_id: Optional[str] = None,
) -> Subscription:
    """Create or update the local Subscription record from a Stripe subscription."""
    sub = (
        db.query(Subscription)
        .filter(Subscription.stripe_subscription_id == stripe_subscription.id)
        .first()
    )
    if sub is None:
        sub = Subscription(
            user_id=user.id,
            stripe_subscription_id=stripe_subscription.id,
        )
        db.add(sub)

    sub.status = stripe_subscription.status
    sub.tier = plan_id or user.subscription_tier
    sub.cancel_at_period_end = getattr(stripe_subscription, "cancel_at_period_end", False)
    current_period_end = getattr(stripe_subscription, "current_period_end", None)
    if current_period_end:
        sub.current_period_end = datetime.utcfromtimestamp(current_period_end)

    # Update the user's subscription tier + subscription id.
    if plan_id:
        user.subscription_tier = plan_id
    user.stripe_subscription_id = stripe_subscription.id

    db.commit()
    db.refresh(sub)
    return sub


def handle_webhook(payload: bytes, signature: str, db: Session) -> dict[str, Any]:
    """Verify and process a Stripe webhook event.

    Args:
        payload: Raw request body bytes.
        signature: The Stripe-Signature header value.
        db: SQLAlchemy session.

    Returns:
        Dict describing the processed event.
    """
    try:
        event = stripe.Webhook.construct_event(
            payload, signature, settings.STRIPE_WEBHOOK_SECRET
        )
    except stripe.error.SignatureVerificationError:
        logger.warning("Stripe webhook signature verification failed")
        return {"received": False, "error": "Invalid signature"}
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Stripe webhook construction failed: %s", exc)
        return {"received": False, "error": str(exc)}

    event_type = event["type"]
    data = event["data"]["object"]
    logger.info("Processing Stripe webhook: %s", event_type)

    if event_type == "checkout.session.completed":
        _handle_checkout_completed(db, data)
    elif event_type in (
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    ):
        _handle_subscription_event(db, data, event_type)
    elif event_type == "invoice.payment_succeeded":
        _handle_invoice_payment_succeeded(db, data)
    elif event_type == "invoice.payment_failed":
        _handle_invoice_payment_failed(db, data)
    else:
        logger.info("Unhandled Stripe event type: %s", event_type)

    return {"received": True, "type": event_type}


def _handle_checkout_completed(db: Session, session: dict[str, Any]) -> None:
    user_id = session.get("metadata", {}).get("user_id")
    plan_id = session.get("metadata", {}).get("plan_id")
    if not user_id:
        return
    user = db.query(User).filter(User.id == UUID(user_id)).first()
    if user is None:
        return
    if plan_id:
        user.subscription_tier = plan_id
    if session.get("customer"):
        user.stripe_customer_id = session["customer"]
    if session.get("subscription"):
        user.stripe_subscription_id = session["subscription"]
    db.commit()


def _handle_subscription_event(db: Session, sub: dict[str, Any], event_type: str) -> None:
    customer_id = sub.get("customer")
    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if user is None:
        logger.warning("No user found for Stripe customer %s", customer_id)
        return

    plan_id = sub.get("metadata", {}).get("plan_id") or user.subscription_tier
    if event_type == "customer.subscription.deleted":
        user.subscription_tier = "free"
        user.stripe_subscription_id = None
        db.commit()
        return

    _sync_subscription_record(db, user, sub, plan_id=plan_id)


def _handle_invoice_payment_succeeded(db: Session, invoice: dict[str, Any]) -> None:
    customer_id = invoice.get("customer")
    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if user is None:
        return
    logger.info("Payment succeeded for user %s", user.id)


def _handle_invoice_payment_failed(db: Session, invoice: dict[str, Any]) -> None:
    customer_id = invoice.get("customer")
    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if user is None:
        return
    # Downgrade to free on failed payment so the user isn't locked out.
    user.subscription_tier = "free"
    db.commit()
    logger.warning("Payment failed for user %s — downgraded to free", user.id)
