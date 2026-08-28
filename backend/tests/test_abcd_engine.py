import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from ai.abcd_engine import _normalized_color_variation


def test_color_variation_is_normalized_to_unit_interval():
    pixels = __import__('numpy').array([
        [0, 0, 0],
        [255, 255, 255],
        [0, 255, 128],
    ], dtype=__import__('numpy').uint8)

    value = _normalized_color_variation(pixels)

    assert 0.0 <= value <= 1.0


def test_constant_color_has_zero_variation():
    np = __import__('numpy')
    pixels = np.full((20, 3), 120, dtype=np.uint8)

    assert _normalized_color_variation(pixels) == 0.0


def test_empty_color_pixels_return_none():
    np = __import__('numpy')

    assert _normalized_color_variation(np.empty((0, 3), dtype=np.uint8)) is None
