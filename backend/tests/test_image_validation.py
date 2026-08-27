import io
import os
import sys

import pytest
from PIL import Image
from fastapi import HTTPException

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from ai.predictor import validate_image_file


def _write_image(path, image_format="PNG"):
    image = Image.new("RGB", (8, 8), "white")
    image.save(path, format=image_format)


def test_validate_image_file_accepts_matching_png(tmp_path):
    path = tmp_path / "lesion.png"
    _write_image(path, "PNG")
    validate_image_file(str(path))


def test_validate_image_file_rejects_extension_format_mismatch(tmp_path):
    path = tmp_path / "lesion.png"
    _write_image(path, "JPEG")
    with pytest.raises(HTTPException) as exc:
        validate_image_file(str(path))
    assert exc.value.status_code == 400
    assert exc.value.detail == "Invalid image file"


def test_validate_image_file_rejects_renamed_text_file(tmp_path):
    path = tmp_path / "lesion.jpg"
    path.write_bytes(b"this is not an image")
    with pytest.raises(HTTPException) as exc:
        validate_image_file(str(path))
    assert exc.value.status_code == 400
    assert exc.value.detail == "Invalid image file"


def test_validate_image_file_rejects_unsupported_extension(tmp_path):
    path = tmp_path / "lesion.gif"
    path.write_bytes(b"GIF89a")
    with pytest.raises(HTTPException) as exc:
        validate_image_file(str(path))
    assert exc.value.status_code == 400
    assert exc.value.detail == "Unsupported image format"
