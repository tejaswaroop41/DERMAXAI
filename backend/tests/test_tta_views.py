import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from core.config import settings
from core.preprocessing import get_tta_transforms


def test_tta_uses_configured_number_of_views():
    transforms = get_tta_transforms(settings.TTA_VIEWS)
    assert settings.TTA_VIEWS == 8
    assert len(transforms) == settings.TTA_VIEWS


def test_tta_view_count_does_not_change_with_legacy_alias():
    assert settings.TTA_CROPS == settings.TTA_VIEWS
