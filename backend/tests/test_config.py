import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from core.config import BASE_DIR, settings


def test_default_model_path_matches_documented_checkpoint_name():
    assert settings.MODEL_PATH == str(BASE_DIR / "models" / "best.pth")
