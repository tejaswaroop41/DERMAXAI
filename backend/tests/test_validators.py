import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from utils.validators import (
    MAX_AGE,
    MAX_PASSWORD_LENGTH,
    MIN_AGE,
    MIN_PASSWORD_LENGTH,
    normalize_email,
    validate_age,
    validate_email,
    validate_image_extension,
    validate_password_strength,
)


def test_validate_image_extension_rejects_missing_filename():
    assert validate_image_extension(None) is False
    assert validate_image_extension("") is False


def test_validate_image_extension_accepts_supported_case_insensitive_extensions():
    assert validate_image_extension("lesion.JPG") is True
    assert validate_image_extension("lesion.bmp") is True


def test_validate_image_extension_rejects_unsupported_extensions():
    assert validate_image_extension("lesion.gif") is False
    assert validate_image_extension("lesion.png.exe") is False


def test_age_policy_has_explicit_bounds():
    assert validate_age(MIN_AGE) is True
    assert validate_age(MAX_AGE) is True
    assert validate_age(MIN_AGE - 1) is False
    assert validate_age(MAX_AGE + 1) is False
    assert validate_age(None) is True


def test_email_policy_normalizes_case_and_whitespace():
    assert normalize_email("  TEST.User@example.com ") == "test.user@example.com"
    assert validate_email("TEST.User@example.com") is True
    assert validate_email("not-an-email") is False
    assert validate_email("user@example") is False


def test_password_policy_is_single_canonical_rule():
    valid = "StrongPass1"
    assert MIN_PASSWORD_LENGTH == 8
    assert MAX_PASSWORD_LENGTH == 128
    assert validate_password_strength(valid)["is_valid"] is True
    assert validate_password_strength("short1A")["is_valid"] is False
    assert validate_password_strength("alllowercase1")["is_valid"] is False
    assert validate_password_strength("NoNumberHere")["is_valid"] is False
    assert validate_password_strength("A1")["is_valid"] is False
    assert validate_password_strength("A1" + "a" * 128)["is_valid"] is False
