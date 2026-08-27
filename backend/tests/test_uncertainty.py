import numpy as np
import pytest

from ai.uncertainty import UncertaintyEngine


def test_mc_dropout_decomposes_aleatory_and_epistemic_uncertainty():
    engine = UncertaintyEngine(theta_H=0.95, mc_passes=4)
    tta = np.array([0.80, 0.05, 0.04, 0.03, 0.03, 0.03, 0.02], dtype=np.float32)
    mc_samples = np.array([
        [0.99, 0.002, 0.002, 0.001, 0.001, 0.002, 0.002],
        [0.70, 0.08, 0.06, 0.04, 0.04, 0.04, 0.04],
        [0.95, 0.01, 0.01, 0.005, 0.005, 0.005, 0.015],
        [0.55, 0.12, 0.08, 0.07, 0.06, 0.06, 0.06],
    ], dtype=np.float32)

    result = engine.composite_uncertainty(raw_probs=tta, mc_probs=mc_samples)

    assert result["mc_passes"] == 4
    assert 0.0 <= result["aleatory_uncertainty"] <= 1.0
    assert 0.0 < result["epistemic_uncertainty"] <= 1.0
    assert 0.0 <= result["fusion_uncertainty"] <= 1.0
    assert 0.0 <= result["composite_uncertainty"] <= 1.0
    assert result["raw_entropy"] >= result["aleatory_uncertainty"]


def test_identical_mc_samples_have_zero_epistemic_uncertainty():
    engine = UncertaintyEngine(theta_H=0.95)
    probs = np.array([0.90, 0.02, 0.02, 0.01, 0.02, 0.02, 0.01], dtype=np.float32)
    mc_samples = np.repeat(probs[None, :], repeats=5, axis=0)

    result = engine.composite_uncertainty(raw_probs=probs, mc_probs=mc_samples)

    assert result["epistemic_uncertainty"] == 0.0
    assert result["aleatory_uncertainty"] == result["raw_entropy"]


def test_uncertainty_requires_mc_probabilities():
    engine = UncertaintyEngine()
    probs = np.array([0.9, 0.02, 0.02, 0.01, 0.02, 0.02, 0.01], dtype=np.float32)

    with pytest.raises(ValueError, match="mc_probs"):
        engine.composite_uncertainty(raw_probs=probs)


def test_uncertainty_validates_mc_shape():
    engine = UncertaintyEngine()
    probs = np.array([0.9, 0.02, 0.02, 0.01, 0.02, 0.02, 0.01], dtype=np.float32)

    with pytest.raises(ValueError, match="shape"):
        engine.composite_uncertainty(raw_probs=probs, mc_probs=probs)
