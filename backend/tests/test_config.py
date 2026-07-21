import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from core.config import _default_model_path


def test_default_model_path_uses_documented_checkpoint_name_when_no_file_exists(tmp_path):
    assert _default_model_path(tmp_path) == str(tmp_path / "models" / "best.pth")


def test_default_model_path_falls_back_to_legacy_checkpoint_name(tmp_path):
    models_dir = tmp_path / "models"
    models_dir.mkdir()
    legacy_checkpoint = models_dir / "dermaxai_v5_best.pth"
    legacy_checkpoint.touch()

    assert _default_model_path(tmp_path) == str(legacy_checkpoint)


def test_default_model_path_prefers_best_checkpoint_name(tmp_path):
    models_dir = tmp_path / "models"
    models_dir.mkdir()
    preferred_checkpoint = models_dir / "best.pth"
    legacy_checkpoint = models_dir / "dermaxai_v5_best.pth"
    preferred_checkpoint.touch()
    legacy_checkpoint.touch()

    assert _default_model_path(tmp_path) == str(preferred_checkpoint)
