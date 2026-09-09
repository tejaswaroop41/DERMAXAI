"""SMTP email helpers used by authentication flows."""

import smtplib
from email.message import EmailMessage

from core.config import settings


class EmailDeliveryError(RuntimeError):
    """Raised when an outbound email cannot be delivered."""


def send_password_reset_email(recipient: str, reset_link: str) -> None:
    """Send a password-reset message using the configured SMTP server."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD or not settings.SMTP_FROM:
        raise EmailDeliveryError("SMTP credentials are not configured")

    message = EmailMessage()
    message["Subject"] = "DERMAXAI password reset"
    message["From"] = settings.SMTP_FROM
    message["To"] = recipient
    message.set_content(
        "A password reset was requested for your DERMAXAI account.\n\n"
        f"Reset your password using this link:\n{reset_link}\n\n"
        f"This link expires in {settings.PASSWORD_RESET_TOKEN_MINUTES} minutes and can only be used once.\n"
        "If you did not request this, you can safely ignore this email."
    )

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
            if settings.SMTP_STARTTLS:
                smtp.starttls()
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        raise EmailDeliveryError("Password reset email could not be delivered") from exc
