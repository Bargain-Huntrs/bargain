"""Contact form endpoint — emails submissions to the team inbox."""
import html
import logging

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr, field_validator

from app.services.email_service import _send_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/contact", tags=["contact"])

CONTACT_INBOX = "hello@bargainhuntrs.com"

TOPICS = ["general", "support", "partnership", "seller", "press", "other"]


class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    topic: str = "general"
    message: str

    @field_validator("name", "message")
    @classmethod
    def not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("Field cannot be empty")
        return v.strip()

    @field_validator("message")
    @classmethod
    def message_length(cls, v):
        if len(v) > 5000:
            raise ValueError("Message too long")
        return v

    @field_validator("topic")
    @classmethod
    def valid_topic(cls, v):
        return v if v in TOPICS else "general"


class ContactResponse(BaseModel):
    success: bool
    message: str


@router.post("", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
async def submit_contact(body: ContactRequest):
    """Forward a contact-form submission to the team inbox."""
    esc = html.escape
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="margin-bottom: 4px;">New contact form submission</h2>
        <p style="color: #666; margin-top: 0;">Topic: <strong>{esc(body.topic)}</strong></p>
        <table style="border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 4px 12px 4px 0; color: #666;">Name</td><td><strong>{esc(body.name)}</strong></td></tr>
            <tr><td style="padding: 4px 12px 4px 0; color: #666;">Email</td><td><a href="mailto:{esc(body.email)}">{esc(body.email)}</a></td></tr>
        </table>
        <div style="background: #f4f4f5; border-radius: 8px; padding: 16px; white-space: pre-wrap;">{esc(body.message)}</div>
    </div>
    """
    sent = _send_email(CONTACT_INBOX, f"[Contact] {body.topic}: {body.name}", html_body)
    if not sent:
        logger.warning(f"Contact form email not delivered (no RESEND key or send failure) — from {body.email}, topic {body.topic}")
    return ContactResponse(success=True, message="Your message has been sent.")
