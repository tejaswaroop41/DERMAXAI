import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from core.config import _bounded_int_value, _default_model_path


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


@pytest.mark.parametrize("raw", ["0", "9", "-1", "99"])
def test_tta_bounds_reject_values_outside_supported_view_count(raw):
    with pytest.raises(RuntimeError, match="TTA_VIEWS must be between 1 and 8"):
        _bounded_int_value("TTA_VIEWS", raw, 1, 8)


def test_tta_bounds_accept_supported_view_count():
    assert _bounded_int_value("TTA_VIEWS", "8", 1, 8) == 8


def test_non_integer_runtime_config_is_rejected():
    with pytest.raises(RuntimeError, match="MC_DROPOUT_PASSES must be an integer"):
        _bounded_int_value("MC_DROPOUT_PASSES", "many", 1, 64)


def test_mc_dropout_bounds_reject_unbounded_values():
    with pytest.raises(RuntimeError, match="MC_DROPOUT_PASSES must be between 1 and 64"):
        _bounded_int_value("MC_DROPOUT_PASSES", "65", 1, 64)
