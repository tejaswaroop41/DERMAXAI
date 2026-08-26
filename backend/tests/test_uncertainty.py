import numpy as np

from ai.uncertainty import UncertaintyEngine


def test_entropy_uses_supplied_probabilities_without_image_inference():
    engine = UncertaintyEngine(theta_H=0.9)
    probs = np.array([0.9, 0.02, 0.02, 0.01, 0.02, 0.02, 0.01], dtype=np.float32)
    result = engine.composite_uncertainty(raw_probs=probs)
    assert 0.0 <= result["composite_uncertainty"] <= 1.0
    assert result["raw_entropy"] == result["composite_uncertainty"]
    assert result["requires_review"] is False


def test_uncertainty_requires_probabilities():
    engine = UncertaintyEngine()
    try:
        engine.composite_uncertainty()
    except ValueError as exc:
        assert "raw_probs" in str(exc)
    else:
        raise AssertionError("Expected ValueError when raw_probs is missing")
