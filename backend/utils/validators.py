"""
DERMAXAI v6 — Input Validators
Validation helpers for uploaded images, patient data, and form fields.
"""
import os
import re
from typing import Optional

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp"}
MAX_IMAGE_SIZE_MB = 10
MIN_AGE = 0
MAX_AGE = 120
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128


def validate_image_extension(filename: Optional[str]) -> bool:
    if not filename:
        return False
    ext = os.path.splitext(filename)[1].lower()
    return ext in ALLOWED_IMAGE_EXTENSIONS


def validate_image_size(file_bytes: bytes) -> bool:
    if not isinstance(file_bytes, (bytes, bytearray)):
        return False
    return len(file_bytes) <= MAX_IMAGE_SIZE_MB * 1024 * 1024


def validate_age(age: Optional[int]) -> bool:
    if age is None:
        return True
    return MIN_AGE <= age <= MAX_AGE


def normalize_email(email: str) -> str:
    """Return the canonical email identity used by the application."""
    return email.strip().lower()


def validate_email(email: str) -> bool:
    """Validate a conservative application-level email shape."""
    normalized = normalize_email(email)
    pattern = r'^[A-Za-z0-9][A-Za-z0-9._%+\-]*@[A-Za-z0-9][A-Za-z0-9.\-]*\.[A-Za-z]{2,}$'
    return bool(re.fullmatch(pattern, normalized))


def validate_password_strength(password: str) -> dict:
    """Validate the canonical password policy used by account creation."""
    issues = []
    if len(password) < MIN_PASSWORD_LENGTH:
        issues.append(f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
    if len(password) > MAX_PASSWORD_LENGTH:
        issues.append(f"Password must be at most {MAX_PASSWORD_LENGTH} characters")
    if not any(c.isupper() for c in password):
        issues.append("Password must contain an uppercase letter")
    if not any(c.isalpha() for c in password):
        issues.append("Password must contain a letter")
    if not any(c.isdigit() for c in password):
        issues.append("Password must contain a number")
    return {"is_valid": len(issues) == 0, "issues": issues}


def sanitize_filename(filename: str) -> str:
    """Strip path separators and dangerous characters from an upload name."""
    name = os.path.basename(filename or "upload")
    name = re.sub(r'[^\w\-.]', '_', name)
    return name[:100] or "upload"
