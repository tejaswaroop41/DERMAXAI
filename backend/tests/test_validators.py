import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from utils.validators import validate_image_extension


def test_validate_image_extension_rejects_missing_filename():
    assert validate_image_extension(None) is False
    assert validate_image_extension("") is False


def test_validate_image_extension_accepts_supported_case_insensitive_extensions():
    assert validate_image_extension("lesion.JPG") is True
    assert validate_image_extension("lesion.bmp") is True


def test_validate_image_extension_rejects_unsupported_extensions():
    assert validate_image_extension("lesion.gif") is False
    assert validate_image_extension("lesion.png.exe") is False
