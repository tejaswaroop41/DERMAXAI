"""
DERMAXAI -- Uncertainty Engine (MCUE)
Uses the predictor's already-computed TTA probabilities so uncertainty
is mathematically consistent with the classification result and does not
perform a second model inference pass.
"""
import numpy as np

from core.config import settings


class UncertaintyEngine:
    def __init__(self, model=None, device=None, mc_passes: int = None, theta_H: float = None):
        self.model = model
        self.device = device
        if theta_H is not None:
            self.theta_H = float(theta_H)
        elif model is not None and getattr(model, "mcue_threshold", None) is not None:
            self.theta_H = float(model.mcue_threshold)
        else:
            self.theta_H = float(settings.UNCERTAINTY_THETA)
        self.mc_passes = mc_passes

    def predictive_entropy(self, probs: np.ndarray) -> float:
        eps = 1e-8
        probs = np.asarray(probs, dtype=np.float32)
        probs = np.clip(probs, eps, 1.0)
        ent = -(probs * np.log(probs)).sum()
        return float(ent / np.log(len(settings.CLASSES)))

    def composite_uncertainty(self, raw_probs=None, image_path: str = None) -> dict:
        """Calculate normalized predictive entropy from predictor output."""
        if raw_probs is None:
            raise ValueError("composite_uncertainty requires raw_probs from predictor.predict()")

        probs = np.asarray(raw_probs, dtype=np.float32)
        if probs.ndim != 1 or len(probs) != len(settings.CLASSES):
            raise ValueError("raw_probs must be a 1-D vector matching settings.CLASSES")
        total = float(probs.sum())
        if not np.isfinite(total) or total <= 0:
            raise ValueError("raw_probs must contain a finite positive probability mass")
        probs = probs / total

        aleatory = self.predictive_entropy(probs)
        epistemic = 0.0
        fusion = 0.0
        composite = aleatory
        requires_review = aleatory > self.theta_H

        return {
            "aleatory_uncertainty": round(aleatory, 4),
            "epistemic_uncertainty": round(epistemic, 4),
            "fusion_uncertainty": round(fusion, 4),
            "composite_uncertainty": round(composite, 4),
            "raw_entropy": round(aleatory, 4),
            "theta_H": round(self.theta_H, 4),
            "requires_review": bool(requires_review),
            "confidence_level": self._confidence_label(aleatory),
        }

    def _confidence_label(self, normalized_score: float) -> str:
        if normalized_score < 0.20: return "Very High"
        if normalized_score < 0.40: return "High"
        if normalized_score < 0.60: return "Moderate"
        if normalized_score < 0.80: return "Low"
        return "Very Low"
