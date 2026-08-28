import numpy as np
import pytest
from PIL import Image

from ai.gradcam import GradCAMEngine


class _ModelWithoutBackboneBlocks:
    pass


def test_generate_fails_closed_when_target_layer_unavailable(tmp_path):
    image_path = tmp_path / "sample.jpg"
    Image.fromarray(np.zeros((32, 32, 3), dtype=np.uint8)).save(image_path)

    engine = GradCAMEngine(_ModelWithoutBackboneBlocks(), "cpu")

    with pytest.raises(RuntimeError, match="target layer is unavailable"):
        engine.generate(str(image_path), 0, str(tmp_path / "heatmap.jpg"))

    assert not (tmp_path / "heatmap.jpg").exists()


def test_get_heatmap_stats_reports_fallback_without_claiming_explanation():
    image_path = tmp_path / "sample.jpg"
    Image.fromarray(np.zeros((32, 32, 3), dtype=np.uint8)).save(image_path)

    engine = GradCAMEngine(_ModelWithoutBackboneBlocks(), "cpu")
    stats = engine.get_heatmap_stats(str(image_path), 0)

    assert stats["fallback"] is True
    assert stats["focus_concentration"] == 0.0
    assert stats["lesion_coverage_pct"] == 0.0
