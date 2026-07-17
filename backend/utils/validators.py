"""
DERMAXAI v6 — Input Validators
Validation helpers for uploaded images, patient data, and form fields.
"""
import os
from typing import Optional

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp"}
MAX_IMAGE_SIZE_MB = 10
MIN_AGE = 0
MAX_AGE = 120


def validate_image_extension(filename: str) -> bool:
    ext = os.path.splitext(filename)[1].lower()
    return ext in ALLOWED_IMAGE_EXTENSIONS


def validate_image_size(file_bytes: bytes) -> bool:
    size_mb = len(file_bytes) / (1024 * 1024)
    return size_mb <= MAX_IMAGE_SIZE_MB


def validate_age(age: Optional[int]) -> bool:
    if age is None:
        return True
    return MIN_AGE <= age <= MAX_AGE


def validate_email(email: str) -> bool:
    import re
    pattern = r'^[\w\.-]+@[\w\.-]+\.\w+$'
    return bool(re.match(pattern, email))


def validate_password_strength(password: str) -> dict:
    issues = []
    if len(password) < 8:
        issues.append("Password must be at least 8 characters")
    if not any(c.isupper() for c in password):
        issues.append("Password should contain an uppercase letter")
    if not any(c.isdigit() for c in password):
        issues.append("Password should contain a number")
    return {"is_valid": len(issues) == 0, "issues": issues}


def sanitize_filename(filename: str) -> str:
    """Strips potentially dangerous characters from uploaded filenames."""
    import re
    name = re.sub(r'[^\w\-_\.]', '_', filename)
    return name[:100]   # cap length
