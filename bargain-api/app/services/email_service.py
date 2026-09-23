"""Transactional email service for BargainHuntrs using Resend.

Sends welcome, password reset, and deal approval emails.
Falls back to console logging when RESEND_API_KEY is not set.
"""
import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


def _send_email(to_email: str, subject: str, html_body: str) -> bool:
    """Send an email via Resend. Returns True on success, False on failure."""
    if not settings.RESEND_API_KEY:
        logger.info(f"[EMAIL CONSOLE] To: {to_email} | Subject: {subject}")
        return False

    try:
        import resend
        resend.api_key = settings.RESEND_API_KEY

        params = {
            "from": settings.ALERT_FROM_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html_body,
        }
        response = resend.Emails.send(params)
        logger.info(f"Email sent to {to_email}: {response}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False


def send_welcome_email(email: str, first_name: Optional[str] = None) -> bool:
    """Send a welcome email to a newly registered user."""
    name = first_name or "there"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Welcome to BargainHuntrs</h1>
            <p style="color: #bfdbfe; margin: 8px 0 0;">Hidden deals & price errors the moment they go live</p>
        </div>
        <div style="padding: 32px;">
            <h2 style="color: #1f2937; margin: 0 0 16px;">Hey {name},</h2>
            <p style="color: #4b5563; line-height: 1.6;">
                You're in. BargainHuntrs scans 500+ retailers in real time to catch
                pricing glitches, clearance deals, and arbitrage opportunities before
                anyone else.
            </p>
            <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <h3 style="color: #1f2937; margin: 0 0 12px;">Here's what you can do right now:</h3>
                <ul style="color: #4b5563; line-height: 1.8; padding-left: 20px; margin: 0;">
                    <li>Browse live deals on our deal feed</li>
                    <li>Set up a watchlist for products you're tracking</li>
                    <li>Submit deals you've found and earn Aura points</li>
                    <li>Get daily email alerts for new deals</li>
                </ul>
            </div>
            <div style="text-align: center; margin: 32px 0;">
                <a href="https://bargainhuntrs.com/deals" style="background: #2563eb; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Start Hunting Deals</a>
            </div>
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
                Want instant alerts and SMS notifications? Upgrade to Hunter for $9.99/month
                and never miss a deal.
            </p>
        </div>
        <div style="border-top: 1px solid #e5e7eb; padding: 24px; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                BargainHuntrs — Arbitrage Intelligence Platform<br>
                You received this email because you signed up at bargainhuntrs.com
            </p>
        </div>
    </div>
    """
    return _send_email(email, "Welcome to BargainHuntrs — Start finding deals today", html)


def send_password_reset_email(email: str, reset_token: str, first_name: Optional[str] = None) -> bool:
    """Send a password reset email with a reset link."""
    name = first_name or "there"
    reset_url = f"https://bargainhuntrs.com/reset-password?token={reset_token}"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: #1f2937; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Reset Your Password</h1>
        </div>
        <div style="padding: 32px;">
            <h2 style="color: #1f2937;">Hey {name},</h2>
            <p style="color: #4b5563; line-height: 1.6;">
                We received a request to reset your BargainHuntrs password. Click the
                button below to set a new password:
            </p>
            <div style="text-align: center; margin: 32px 0;">
                <a href="{reset_url}" style="background: #2563eb; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Reset Password</a>
            </div>
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
                If you didn't request this, you can safely ignore this email. Your
                password won't be changed. This link expires in 1 hour.
            </p>
        </div>
        <div style="border-top: 1px solid #e5e7eb; padding: 24px; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">BargainHuntrs — Arbitrage Intelligence Platform</p>
        </div>
    </div>
    """
    return _send_email(email, "Reset your BargainHuntrs password", html)


def send_verification_email(email: str, token: str, first_name: Optional[str] = None) -> bool:
    """Send an email-verification link (24h expiry)."""
    name = first_name or "there"
    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Verify Your Email</h1>
        </div>
        <div style="padding: 32px;">
            <h2 style="color: #1f2937;">Hey {name},</h2>
            <p style="color: #4b5563; line-height: 1.6;">
                Confirm this email address for your BargainHuntrs account by clicking
                the button below. This link expires in 24 hours.
            </p>
            <div style="text-align: center; margin: 32px 0;">
                <a href="{verify_url}" style="background: #2563eb; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Verify Email Address</a>
            </div>
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
                If you didn't create an account, you can safely ignore this email.
            </p>
        </div>
        <div style="border-top: 1px solid #e5e7eb; padding: 24px; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">BargainHuntrs — Arbitrage Intelligence Platform</p>
        </div>
    </div>
    """
    return _send_email(email, "Verify your BargainHuntrs email", html)


def send_deal_approved_email(email: str, deal_title: str, first_name: Optional[str] = None) -> bool:
    """Send an email when a user's submitted deal is approved."""
    name = first_name or "there"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Your Deal Was Approved!</h1>
        </div>
        <div style="padding: 32px;">
            <h2 style="color: #1f2937;">Nice find, {name}!</h2>
            <p style="color: #4b5563; line-height: 1.6;">
                Your submitted deal <strong>"{deal_title}"</strong> has been approved
                and is now live on BargainHuntrs. The community can now vote on it.
            </p>
            <div style="background: #ecfdf5; border-radius: 8px; padding: 16px; margin: 24px 0;">
                <p style="color: #059669; margin: 0; font-weight: bold;">
                    +50 Aura Points awarded!
                </p>
            </div>
            <p style="color: #4b5563; line-height: 1.6;">
                Keep submitting deals to climb the leaderboard and reach GOAT status.
            </p>
            <div style="text-align: center; margin: 24px 0;">
                <a href="https://bargainhuntrs.com/community" style="background: #059669; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">View Your Deal</a>
            </div>
        </div>
        <div style="border-top: 1px solid #e5e7eb; padding: 24px; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">BargainHuntrs — Arbitrage Intelligence Platform</p>
        </div>
    </div>
    """
    return _send_email(email, f"Your deal '{deal_title}' was approved!", html)
